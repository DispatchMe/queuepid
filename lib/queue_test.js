/* jshint esnext: true*/
import expect, {
  createSpy, spyOn, isSpy
}
from 'expect';
import Queue from './queue';
import MockDriver from './mockDriver';

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

  it('should set status to running when picked up from the queue', function(done) {
    this.queue.sendMessage({
      foo: 'bar'
    }).then(() => {
      return this.queue.getMessage();
    }).then(msg => {
      expect(msg.info.data).toEqual({
        foo: 'bar'
      });
      expect(msg.info.status).toEqual('running');
      done();
    }).catch(done);
  });

  it('should cancel a message in the driver if its status in mongo is canceled', function(done) {
    this.queue.sendMessage({
      foo: 'bar'
    }).then((msg) => {
      return this.queue.setStatus(msg.jobId, 'canceled');
    }).then(() => {
      return this.queue.getMessage();
    }).then(msg => {
      expect(msg).toEqual(null);
      expect(this.queue._driver._messages.length).toEqual(0);
      done();
    }).catch(done);
  });

  it('should ack and set status to complete when done is called with no error', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then((msg) => {
      jobId = msg.jobId;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(null, 'result');
    }).then(() => {
      return this.queue.getMeta(jobId);
    }).then((doc) => {
      expect(doc.status).toEqual('done');
      expect(doc.completedAt).toExist();
      expect(this.queue._driver.ack).toHaveBeenCalled();
      done();
    }).catch(done);
  });

  it('should not ack and status should be back to queued with one failure if done is called with a normal error', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then((msg) => {
      jobId = msg.jobId;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(new Error('Something went wrong'));
    }).then(() => {
      return this.queue.getMeta(jobId);
    }).then((doc) => {
      expect(doc.status).toEqual('queued');
      expect(doc.failures.length).toEqual(1);
      expect(this.queue._driver.ack.calls.length).toEqual(0);
      expect(doc.retries).toEqual(1);
      done();
    }).catch(done);
  });

  it('should ack and status should be failed with one failure if done is called with an error and opts.fatal is true', function(done) {
    let jobId;

    this.queue.sendMessage({
      foo: 'bar'
    }).then((msg) => {
      jobId = msg.jobId;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(new Error('Something went wrong'), null, {
        fatal: true
      });
    }).then(() => {
      return this.queue.getMeta(jobId);
    }).then((doc) => {
      expect(doc.status).toEqual('failed');
      expect(doc.failures.length).toEqual(1);
      expect(this.queue._driver.ack.calls.length).toEqual(1);
      expect(doc.retries).toEqual(0);
      done();
    }).catch(done);
  });

  it('should store logs in mongo', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then(msg => {
      jobId = msg.jobId;
      return this.queue.getMessage();
    }).then(msg => {
      msg.log('testing 1234');
      return msg.done();
    }).then(() => {
      return this.queue.getMeta(jobId);
    }).then(doc => {
      expect(doc.logs.length).toEqual(1);
      expect(doc.logs[0].message).toEqual(['testing 1234']);
      done();
    }).catch(done);
  });
});
