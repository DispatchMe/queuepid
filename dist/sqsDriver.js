'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _awsSdk = require('aws-sdk');

var _simplecheck = require('simplecheck');

var SQSDriver = (function () {
  function SQSDriver(config) {
    _classCallCheck(this, SQSDriver);

    (0, _simplecheck.ensure)(config.queueUrl, String);
    this.queueUrl = config.queueUrl;
    this._client = new _awsSdk.SQS(config);
  }

  _createClass(SQSDriver, [{
    key: 'write',
    value: function write(data) {
      var _this = this;

      var delay = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      (0, _simplecheck.ensure)(data, Object);
      (0, _simplecheck.ensure)(delay, Number);

      var params = {
        MessageBody: JSON.stringify(data),
        QueueUrl: this.queueUrl,
        DelaySeconds: delay
      };

      return Promise(function (resolve, reject) {
        _this._client.sendMessage(params, function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      });
    }
  }, {
    key: 'read',
    value: function read() {
      var _this2 = this;

      var count = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];

      var params = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: count,
        WaitTimeSeconds: 10
      };

      return Promise(function (resolve, reject) {
        _this2._client.receiveMessage(params, function (err, data) {
          if (err) reject(err);else resolve(data.messages);
        });
      });
    }
  }, {
    key: 'ack',
    value: function ack(msg) {
      var _this3 = this;

      (0, _simplecheck.ensure)(msg.ReceiptHandle, String);

      var params = {
        QueueUrl: this.queueUrl,
        ReceiptHandle: msg.ReceiptHandle
      };

      return Promise(function (resolve, reject) {
        _this3._client.deleteMessage(params, function (err, data) {
          if (err) reject(err);else resolve(data);
        });
      });
    }
  }, {
    key: 'getData',
    value: function getData(msg) {
      return JSON.parse(msg.Body);
    }
  }]);

  return SQSDriver;
})();

exports['default'] = SQSDriver;
module.exports = exports['default'];