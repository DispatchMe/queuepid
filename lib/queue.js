/* jshint esnext:true */
import { ensure } from 'simplecheck';
import { MongoClient, ObjectID } from 'mongodb';
import { EventEmitter } from 'events';
import { Promise } from 'es6-promise-polyfill';

export class Job extends EventEmitter {
  constructor(metaCollection, driver, message) {
    super();
    this._message = message;
    this._collection = metaCollection;
    this._messageData = driver.getData(message);
    this._driver = driver;
  }

  getData() {
    return this._message;
  }

  getInfo() {
    if (this.info) return Promise.resolve(this.info);

    return new Promise((resolve, reject) => {
      this._collection.findOne({
        _id: new ObjectID(this._messageData.jobId)
      }, (err, doc) => {
        if (err) reject(err);
        else if (!doc) {
          reject(new Error('Job document not found in database!'));
        } else {
          this.info = doc;
          resolve(doc);
        }
      });
    });
  }

  // Allows storing arbitrary metadata on the msg
  setMetaData(key, val) {
    if(!this.info.metadata) {
      this.info.metadata = {};
    }

    this.info.metadata[key] = val;
  }

  log() {
    if (this.debug) {
      console.log(JSON.stringify(Array.prototype.slice.call(arguments)));
    }

    if (!this.info.logs) {
      this.info.logs = [];
    }

    // Don't save...it will save when we update the status with any logs that were added.
    this.info.logs.push({
      timestamp: new Date(),
      message: Array.prototype.slice.call(arguments)
    });
  }

  fail(err, opts = {}) {
    return this.done(err, null, opts);
  }

  succeed(result) {
    return this.done(null, result);
  }

  done(err, result, opts = {}) {
    let removeFromQueue = false;

    // Set the logs no matter what (because we're not running save here, we're doing other stuff)
    let modify = {
      $set: {
        logs: this.info.logs,
        metadata: this.info.metadata
      }
    };

    if (err) {
      // Check if we're at the retry limit
      let retries = this.info.retries || 0;

      modify.$push = {
        'failures': {
          timestamp: new Date(),
          error: err.message
        }
      };

      if (retries > this.info.retryLimit || opts.fatal === true) {
        // Stop it entirely
        modify.$set.status = 'failed';
        removeFromQueue = true;
      } else {
        modify.$set.retries = retries + 1;
        modify.$set.status = 'queued';
      }
    } else {
      modify.$set.result = result;
      modify.$set.status = 'done';
      removeFromQueue = true;
      modify.$set.completedAt = new Date();
    }

    return new Promise((resolve, reject) => {
      this._collection.update({
        _id: new ObjectID(this.info._id),
      }, modify, function(err, data) {
        if (err) reject(err);
        else resolve(data);
      });
    }).then(() => {
      if (removeFromQueue) {
        return this._driver.ack(this._message);
      }
    }).then((res) => {
      // Store the results of the ack for now
      this.log('Ack result', res);
      return new Promise((resolve1, reject1) => {
        this._collection.update({
          _id: new ObjectID(this.info._id)
        }, {
          $set: {
            logs: this.info.logs
          }
        }, (err, data) => {
          if (err) {
            // There might be a bug that resolves this promise twice sometimes - need to
            // add logging to debug.
            this.log('Failed to update', err.message);
            reject1(err);
          } else {
            resolve1(data);
          }
        });
      });
    }).then(() => {
      this.emit('done');
    });
  }

  save() {
    return new Promise((resolve, reject) => {
      this._collection.update({
        _id: new ObjectID(this.info._id),
      }, {
        $set: this.info
      }, function(err, data) {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  start() {
    let ok = true;
    return this.getInfo().then((info) => {
      // It can either be "queued" or "running" (if it timed out)
      if (info.status !== 'queued' && info.status !== 'running') {
        ok = false;
        if (info.status === 'canceled' || 'done') {
          // Cancel it! If it's "done", that means the queue delivered a duplicate message, so we
          // need to ack it again (??) and do nothing else.
          return this._driver.ack(this._message);
        }
      } else {
        this.info.status = 'running';
        this.info.startedAt = new Date();
        return this.save();
      }
    }).then(() => {
      if (ok === true) {
        return this;
      } else {
        return null;
      }
    });
  }
}

export default class Queue {
  constructor(name, driver, config) {
    ensure(driver.write, Function);
    ensure(driver.read, Function);
    ensure(driver.ack, Function);
    // ensure(driver.extend, Function);

    this._name = name;
    this._cleanName = name.replace(/[^A-Za-z\_]/g, '');
    this._driver = driver;
    this.config = config;
  }

  connect() {
    return new Promise((resolve, reject) => {
      MongoClient.connect(this.config.mongoUrl, (err, db) => {
        if (err) reject(err);
        else {
          this._db = db;
          this._collection = db.collection(this._cleanName + '_jobs');
          resolve();
        }
      });
    });
  }
  disconnect() {
    if (this._db) this._db.close();
  }

  purge() {
    return new Promise((resolve, reject) => {
      this._collection.remove({}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  setStatus(msgId, status) {
    let statusKey = status + 'At';
    return new Promise((resolve, reject) => {
      this._collection.update({
        _id: new ObjectID(msgId)
      }, {
        $set: {
          status: status,
          [statusKey]: new Date()
        }
      }, function(err, data) {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  getInfo(msgId) {
    return new Promise((resolve, reject) => {
      this._collection.findOne({
        _id: new ObjectID(msgId)
      }, function(err, doc) {
        if (err) reject(err);
        else resolve(doc);
      });
    });
  }

  /**
   * Returns a single message document based on metadata within that message
   * Useful for doing lookups when you don't have the message ID
   * @param  {Objet} meta The metadata
   * @return {Promise<Doc>}
   */
  getInfoFromMeta(meta) {
    let parsed = {};
    for(let k in meta) {
      parsed[`metadata.${k}`] = meta[k];
    }

    return new Promise((resolve, reject) => {
      this._collection.findOne(parsed, (err, doc) => {
        if(err) reject(err);
        else resolve(doc);
      });
    });
  }

  getMessage() {
    let job;
    return this._driver.read(1).then((messages) => {
      if (messages.length > 0) {
        job = new Job(this._collection, this._driver, messages[0]);
        return job.start();
      } else {
        return null;
      }
    });
  }

  // Incoming messages get sent either now or later based on sendAfter
  sendMessage(data, delay, metadata = {}) {
    if (data.sendAfter) {
      const now = new Date();

      // Parse sendAfter as a date
      data.sendAfter = new Date(data.sendAfter)

      if (data.sendAfter.getTime() < now.getTime()) {
        return this.sendMessageNow(data, delay, metadata = {})
      } else {
        return this.sendMessageLater(data, metadata = {})
      }
    }
    else {
      return this.sendMessageNow(data, delay, metadata = {})
    }
  }

  sendMessageLater(data, metadata = {}) {
    let id;
    // Insert into the jobs collection...
    return new Promise((resolve, reject) => {
      this._collection.insert({
        data: data,
        createdAt: new Date(),
        status: 'delayed',
        retries: 0,
        retryLimit: 10,
        logs: [],
        sendAfter: data.sendAfter,
        metadata: metadata,
      }, function(err, data) {
        if (err) reject(err);
        else {
          id = data.ops[0]._id;
          resolve();
        }
      });
    }).then(() => {
      return id;
    });
  }

  sendMessageNow(data, delay, metadata = {}) {
    let id;
    // Insert into the jobs collection...
    return new Promise((resolve, reject) => {
      this._collection.insert({
        data: data,
        createdAt: new Date(),
        status: 'queued',
        retries: 0,
        retryLimit: 10,
        logs: [],
        metadata: metadata,
      }, function(err, data) {
        if (err) reject(err);
        else {
          id = data.ops[0]._id;
          resolve();
        }
      });
    }).then(() => {
      return this._driver.write({
        jobId: id
      }, delay);
    }).then(() => {
      return id;
    });
  }

  sendDelayedMessages() {
    const query = {
      'status' : 'delayed',
      'sendAfter' : { $lte : new Date() }
    }
    return new Promise((resolve, reject) => {
      this._collection.find(query, (err, jobs) => {
        if (err) reject(err);
        else {
          // Recursively write the returned jobs to the queue
          const write = (err, jobs) => {
            if (err) reject(err);

            if (jobs.length) {
              const job = jobs.pop();
              this._driver.write({
                jobId: job._id,
              }).then(function () {
                write(null, jobs);
              });
            } else resolve();
          }

          jobs.toArray(write);
        }
      });
    });
  }
}
