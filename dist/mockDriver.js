/* jshint esnext:true */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _awsSdk = require('aws-sdk');

var _simplecheck = require('simplecheck');

// For unique IDs

var _hat = require('hat');

var _hat2 = _interopRequireDefault(_hat);

var MockDriver = (function () {
  function MockDriver(config) {
    _classCallCheck(this, MockDriver);

    this._messages = [];
    this._timeoutsById = {};
  }

  _createClass(MockDriver, [{
    key: 'write',
    value: function write(data) {
      var delay = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var id = (0, _hat2['default'])(64);
      this._messages.push({
        id: id,
        data: data
      });

      return Promise.resolve(data);
    }
  }, {
    key: 'sentMessage',
    value: function sentMessage(msg, delay) {
      var _this = this;

      this._timeoutsById[msg.id] = setTimeout(function () {
        _this._messages.push(msg);
      }, delay);
    }
  }, {
    key: 'read',
    value: function read() {
      var _this2 = this;

      var count = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];

      var messages = this._messages.slice(0, count);
      messages.forEach(function (msg) {
        return _this2.sentMessage(msg, 30);
      });

      this._messages = this._messages.slice(count);
      return Promise.resolve(messages);
    }
  }, {
    key: 'ack',
    value: function ack(msg) {
      var timeout = this._timeoutsById[msg.id];
      if (timeout) {
        clearTimeout(timeout);
      }
      return 'acked';
    }
  }, {
    key: 'getData',
    value: function getData(msg) {
      return msg.data;
    }
  }, {
    key: 'extend',
    value: function extend(msg, time) {
      delete this._timeoutsById[msg.id];
      this.sentMessage(msg, time);

      return Promise.resolve();
    }
  }]);

  return MockDriver;
})();

exports['default'] = MockDriver;
module.exports = exports['default'];