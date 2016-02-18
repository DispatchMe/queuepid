/* jshint esnext:true */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _simplecheck = require('simplecheck');

var _mongodb = require('mongodb');

var _events = require('events');

var _es6PromisePolyfill = require('es6-promise-polyfill');

var Job = (function (_EventEmitter) {
  _inherits(Job, _EventEmitter);

  function Job(metaCollection, driver, message) {
    _classCallCheck(this, Job);

    _get(Object.getPrototypeOf(Job.prototype), 'constructor', this).call(this);
    this._message = message;
    this._collection = metaCollection;
    this._messageData = driver.getData(message);
    this._driver = driver;
  }

  _createClass(Job, [{
    key: 'getData',
    value: function getData() {
      return this._message;
    }
  }, {
    key: 'getMeta',
    value: function getMeta() {
      var _this = this;

      if (this.info) return _es6PromisePolyfill.Promise.resolve(this.info);

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this._collection.findOne({
          _id: new _mongodb.ObjectID(_this._messageData.jobId)
        }, function (err, doc) {
          if (err) reject(err);else if (!doc) {
            reject(new Error('Job document not found in database!'));
          } else {
            _this.info = doc;
            resolve(doc);
          }
        });
      });
    }
  }, {
    key: 'log',
    value: function log() {
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
  }, {
    key: 'fail',
    value: function fail(err) {
      var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.done(err, null, opts);
    }
  }, {
    key: 'succeed',
    value: function succeed(result) {
      return this.done(null, result);
    }
  }, {
    key: 'done',
    value: function done(err, result) {
      var _this2 = this;

      var opts = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var removeFromQueue = false;

      // Set the logs no matter what (because we're not running save here, we're doing other stuff)
      var modify = {
        $set: {
          logs: this.info.logs
        }
      };

      if (err) {
        // Check if we're at the retry limit
        var retries = this.info.retries || 0;

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

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this2._collection.update({
          _id: new _mongodb.ObjectID(_this2.info._id)
        }, modify, function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      }).then(function () {
        if (removeFromQueue) {
          return _this2._driver.ack(_this2._message);
        }
      }).then(function (res) {
        // Store the results of the ack for now
        _this2.log('Ack result', res);
        return new _es6PromisePolyfill.Promise(function (resolve1, reject1) {
          _this2._collection.update({
            _id: new _mongodb.ObjectID(_this2.info._id)
          }, {
            $set: {
              logs: _this2.info.logs
            }
          }, function (err, data) {
            if (err) {
              // There might be a bug that resolves this promise twice sometimes - need to
              // add logging to debug.
              _this2.log('Failed to update', err.message);
              reject1(err);
            } else {
              resolve1(data);
            }
          });
        });
      }).then(function () {
        _this2.emit('done');
      });
    }
  }, {
    key: 'save',
    value: function save() {
      var _this3 = this;

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this3._collection.update({
          _id: new _mongodb.ObjectID(_this3.info._id)
        }, {
          $set: _this3.info
        }, function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      });
    }
  }, {
    key: 'start',
    value: function start() {
      var _this4 = this;

      var ok = true;
      return this.getMeta().then(function (meta) {
        // It can either be "queued" or "running" (if it timed out)
        if (meta.status !== 'queued' && meta.status !== 'running') {
          ok = false;
          if (meta.status === 'canceled' || 'done') {
            // Cancel it! If it's "done", that means the queue delivered a duplicate message, so we
            // need to ack it again (??) and do nothing else.
            return _this4._driver.ack(_this4._message);
          }
        } else {
          _this4.info.status = 'running';
          _this4.info.startedAt = new Date();
          return _this4.save();
        }
      }).then(function () {
        if (ok === true) {
          return _this4;
        } else {
          return null;
        }
      });
    }
  }]);

  return Job;
})(_events.EventEmitter);

exports.Job = Job;

var Queue = (function () {
  function Queue(name, driver, config) {
    _classCallCheck(this, Queue);

    (0, _simplecheck.ensure)(driver.write, Function);
    (0, _simplecheck.ensure)(driver.read, Function);
    (0, _simplecheck.ensure)(driver.ack, Function);
    // ensure(driver.extend, Function);

    this._name = name;
    this._cleanName = name.replace(/[^A-Za-z\_]/g, '');
    this._driver = driver;
    this.config = config;
  }

  _createClass(Queue, [{
    key: 'connect',
    value: function connect() {
      var _this5 = this;

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _mongodb.MongoClient.connect(_this5.config.mongoUrl, function (err, db) {
          if (err) reject(err);else {
            _this5._db = db;
            _this5._collection = db.collection(_this5._cleanName + '_jobs');
            resolve();
          }
        });
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this._db) this._db.close();
    }
  }, {
    key: 'purge',
    value: function purge() {
      var _this6 = this;

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this6._collection.remove({}, function (err) {
          if (err) reject(err);else resolve();
        });
      });
    }
  }, {
    key: 'setStatus',
    value: function setStatus(msgId, status) {
      var _this7 = this;

      var statusKey = status + 'At';
      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this7._collection.update({
          _id: new _mongodb.ObjectID(msgId)
        }, _defineProperty({
          status: status
        }, statusKey, new Date()), function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      });
    }
  }, {
    key: 'getMeta',
    value: function getMeta(msgId) {
      var _this8 = this;

      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this8._collection.findOne({
          _id: new _mongodb.ObjectID(msgId)
        }, function (err, doc) {
          if (err) reject(err);else resolve(doc);
        });
      });
    }
  }, {
    key: 'getMessage',
    value: function getMessage() {
      var _this9 = this;

      var job = undefined;
      return this._driver.read(1).then(function (messages) {
        if (messages.length > 0) {
          job = new Job(_this9._collection, _this9._driver, messages[0]);
          return job.start();
        } else {
          return null;
        }
      });
    }
  }, {
    key: 'sendMessage',
    value: function sendMessage(data, delay) {
      var _this10 = this;

      var id = undefined;
      // Insert into the jobs collection...
      return new _es6PromisePolyfill.Promise(function (resolve, reject) {
        _this10._collection.insert({
          data: data,
          createdAt: new Date(),
          status: 'queued',
          retries: 0,
          retryLimit: 10,
          logs: []
        }, function (err, data) {
          if (err) reject(err);else {
            id = data.ops[0]._id;
            resolve();
          }
        });
      }).then(function () {
        return _this10._driver.write({
          jobId: id
        }, delay);
      }).then(function () {
        return id;
      });
    }
  }]);

  return Queue;
})();

exports['default'] = Queue;