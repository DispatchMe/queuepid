/* jshint esnext:true */
import expect, {
  createSpy, spyOn, isSpy
}
from 'expect';
import Queue from './queue';
import MockDriver from './mockDriver';
import WorkerPool from './worker';

describe('queue', () => {
  beforeEach(function(done) {
    this.queue = new Queue('testQueue', new MockDriver(), {
      mongoUrl: 'mongodb://localhost/test'
    });

    spyOn(this.queue._driver, 'ack').andCallThrough();

    this.queue.connect().then(done).catch(done);
  });
  afterEach(function(done) {
    this.queue.purge().then(() => {
      return this.queue.disconnect();
    }).then(done).catch(done);
  });

  it('should run infinite worker pool and ensure max concurrency', function(done) {
    this.timeout(3000);
    // Write 10000 messages
    let promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(this.queue.sendMessage({
        foo: 'bar'
      }));
    }

    let pool;
    Promise.all(promises).then(() => {
      pool = new WorkerPool(this.queue, {
        maxConcurrent: 5,
        wait: 10
      }, function(job) {
        setTimeout(() => {
          job.done();
        }, 10);
      });

      pool.start();
    }).then(() => {
      setTimeout(() => {
        expect(this.queue._driver.ack.calls.length).toEqual(10);
        pool.stop();
        done();
      }, 2000);

    }).catch(done);
  });
});
