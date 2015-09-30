'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _expect = require('expect');

var _expect2 = _interopRequireDefault(_expect);

var _queue = require('./queue');

var _queue2 = _interopRequireDefault(_queue);

var _mockDriver = require('./mockDriver');

var _mockDriver2 = _interopRequireDefault(_mockDriver);

describe('queue', function () {
  beforeEach(function (done) {
    this.queue = new _queue2['default']('testQueue', new _mockDriver2['default'](), {
      mongoUrl: 'mongodb://localhost/test'
    });

    (0, _expect.spyOn)(this.queue._driver, 'ack').andCallThrough();

    this.queue.connect().then(done)['catch'](done);
  });
  afterEach(function (done) {
    var _this = this;

    this.queue.purge().then(function () {
      return _this.queue.disconnect();
    }).then(done)['catch'](done);
  });

  it('should set status to running when picked up from the queue', function (done) {
    var _this2 = this;

    this.queue.sendMessage({ foo: 'bar' }).then(function () {
      return _this2.queue.getMessage();
    }).then(function (msg) {
      (0, _expect2['default'])(msg.info.data).toEqual({ foo: 'bar' });
      (0, _expect2['default'])(msg.info.status).toEqual('running');
      done();
    })['catch'](done);
  });

  it('should cancel a message in the driver if its status in mongo is canceled', function (done) {
    var _this3 = this;

    this.queue.sendMessage({ foo: 'bar' }).then(function (msg) {
      return _this3.queue.setStatus(msg.jobId, 'canceled');
    }).then(function () {
      return _this3.queue.getMessage();
    }).then(function (msg) {
      (0, _expect2['default'])(msg).toEqual(null);
      (0, _expect2['default'])(_this3.queue._driver._messages.length).toEqual(0);
      done();
    })['catch'](done);
  });

  it('should ack and set status to complete when done is called with no error', function (done) {
    var _this4 = this;

    var jobId = undefined;
    this.queue.sendMessage({ foo: 'bar' }).then(function (msg) {
      jobId = msg.jobId;
      return _this4.queue.getMessage();
    }).then(function (msg) {
      return msg.done(null, 'result');
    }).then(function () {
      return _this4.queue.getMeta(jobId);
    }).then(function (doc) {
      (0, _expect2['default'])(doc.status).toEqual('done');
      (0, _expect2['default'])(doc.completedAt).toExist();
      (0, _expect2['default'])(_this4.queue._driver.ack).toHaveBeenCalled();
      done();
    })['catch'](done);
  });

  it('should not ack and status should be back to queued with one failure if done is called with a normal error', function (done) {
    var _this5 = this;

    var jobId = undefined;
    this.queue.sendMessage({ foo: 'bar' }).then(function (msg) {
      jobId = msg.jobId;
      return _this5.queue.getMessage();
    }).then(function (msg) {
      return msg.done(new Error('Something went wrong'));
    }).then(function () {
      return _this5.queue.getMeta(jobId);
    }).then(function (doc) {
      (0, _expect2['default'])(doc.status).toEqual('queued');
      (0, _expect2['default'])(doc.failures.length).toEqual(1);
      (0, _expect2['default'])(_this5.queue._driver.ack.calls.length).toEqual(0);
      (0, _expect2['default'])(doc.retries).toEqual(1);
      done();
    })['catch'](done);
  });

  it('should ack and status should be failed with one failure if done is called with an error and opts.fatal is true', function (done) {
    var _this6 = this;

    var jobId = undefined;

    this.queue.sendMessage({ foo: 'bar' }).then(function (msg) {
      jobId = msg.jobId;
      return _this6.queue.getMessage();
    }).then(function (msg) {
      return msg.done(new Error('Something went wrong'), null, {
        fatal: true
      });
    }).then(function () {
      return _this6.queue.getMeta(jobId);
    }).then(function (doc) {
      (0, _expect2['default'])(doc.status).toEqual('failed');
      (0, _expect2['default'])(doc.failures.length).toEqual(1);
      (0, _expect2['default'])(_this6.queue._driver.ack.calls.length).toEqual(1);
      (0, _expect2['default'])(doc.retries).toEqual(0);
      done();
    })['catch'](done);
  });
});