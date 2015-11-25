/* jshint esnext:true */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('events');

var WorkerPool = (function (_EventEmitter) {
  _inherits(WorkerPool, _EventEmitter);

  function WorkerPool(queue, config, handler) {
    _classCallCheck(this, WorkerPool);

    _get(Object.getPrototypeOf(WorkerPool.prototype), 'constructor', this).call(this);
    this.config = config;
    this.handler = handler;
    this.queue = queue;
    this._workers = [];
  }

  _createClass(WorkerPool, [{
    key: 'start',
    value: function start() {
      for (var i = 0; i < this.config.maxConcurrent; i++) {
        var worker = new Worker(this.queue, this.handler, this);
        this._workers.push(worker);
        worker.start();
      }
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._workers.forEach(function (worker) {
        return worker.stop();
      });
    }
  }]);

  return WorkerPool;
})(_events.EventEmitter);

exports['default'] = WorkerPool;

var Worker = (function () {
  function Worker(queue, handler, pool) {
    _classCallCheck(this, Worker);

    this.queue = queue;
    this.handler = handler;
    this.pool = pool;

    this._wait = pool.config.wait ? pool.config.wait : 500;
  }

  _createClass(Worker, [{
    key: 'start',
    value: function start() {
      this._stop = false;
      this.poll();
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._stop = true;
    }
  }, {
    key: 'loop',
    value: function loop() {
      var _this = this;

      setTimeout(function () {
        return _this.poll();
      }, this._wait);
    }
  }, {
    key: 'poll',
    value: function poll() {
      var _this2 = this;

      if (this._stop === true) {
        return;
      }
      this.queue.getMessage().then(function (job) {
        if (job) {
          job.on('done', function () {
            return _this2.loop();
          });
          _this2.handler(job);
        } else {
          _this2.loop();
        }
      })['catch'](function (err) {
        _this2.pool.emit('error', err);
        _this2.loop();
      });
    }
  }]);

  return Worker;
})();

module.exports = exports['default'];