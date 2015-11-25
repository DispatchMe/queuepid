/* jshint esnext:true */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _simplecheck = require('simplecheck');

var _mongodb = require('mongodb');

var _events = require('events');

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

      if (this.info) return Promise.resolve(this.info);

      return new Promise(function (resolve, reject) {
        _this._collection.findOne({
          _id: _this._messageData.jobId
        }, function (err, doc) {
          if (err) reject(err);else {
            _this.info = doc;
            resolve(doc);
          }
        });
      });
    }
  }, {
    key: 'log',
    value: function log() {
      // Don't save...it will save when we update the status with any logs that were added.
      this.info.log.push({
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

      var modify = {
        $set: {}
      };

      if (err) {
        // Check if we're at the retry limit
        var retries = this.info.retries || 0;

        modify.$push = {
          'failures': {
            timestamp: Date.now(),
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
        modify.$set.completedAt = Date.now();
      }

      return new Promise(function (resolve, reject) {
        _this2._collection.update({
          _id: _this2.info._id
        }, modify, function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      }).then(function () {
        if (removeFromQueue) {
          return _this2._driver.ack(_this2._message);
        }
      }).then(function () {
        _this2.emit('done');
      });
    }
  }, {
    key: 'save',
    value: function save() {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        _this3._collection.update({
          _id: _this3.info._id
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
          if (meta.status === 'canceled') {
            // Cancel it!
            return _this4._driver.ack(_this4._message);
          }
        } else {
          _this4.info.status = 'running';
          _this4.info.startedAt = Date.now();
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

      return new Promise(function (resolve, reject) {
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

      return new Promise(function (resolve, reject) {
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
      return new Promise(function (resolve, reject) {
        _this7._collection.update({
          _id: msgId
        }, _defineProperty({
          status: status
        }, statusKey, Date.now()), function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      });
    }
  }, {
    key: 'getMeta',
    value: function getMeta(msgId) {
      var _this8 = this;

      return new Promise(function (resolve, reject) {
        _this8._collection.findOne({
          _id: msgId
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
      return new Promise(function (resolve, reject) {
        _this10._collection.insert({
          data: data,
          createdAt: Date.now(),
          status: 'queued',
          retries: 0,
          retryLimit: 10,
          log: []
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
      });
    }
  }]);

  return Queue;
})();

exports['default'] = Queue;
module.exports = exports['default'];