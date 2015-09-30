'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _expect = require('expect');

var _expect2 = _interopRequireDefault(_expect);

var _queue = require('./queue');

var _queue2 = _interopRequireDefault(_queue);

var _mockDriver = require('./mockDriver');

var _mockDriver2 = _interopRequireDefault(_mockDriver);

var _worker = require('./worker');

var _worker2 = _interopRequireDefault(_worker);

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

  it('should run infinite worker pool', function (done) {
    var _this2 = this;

    // Write 10 messages
    var promises = [];
    for (var i = 0; i < 10; i++) {
      promises.push(this.queue.sendMessage({
        foo: 'bar'
      }));
    }

    var pool = undefined;
    Promise.all(promises).then(function () {
      pool = new _worker2['default'](_this2.queue, {
        maxConcurrent: 5,
        wait: 10
      }, function (job) {
        job.done();
      });

      pool.start();
    }).then(function () {
      setTimeout(function () {
        (0, _expect2['default'])(_this2.queue._driver.ack.calls.length).toEqual(10);
        pool.stop();
        done();
      }, 30);
    })['catch'](done);
  });
});