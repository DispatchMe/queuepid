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
      mongoUrl: 'mongodb://localhost/test',
      schedule: 'every 5 min'
    });

    spyOn(this.queue._driver, 'ack').andCallThrough();

    this.queue.connect().then(() => {
      done();
    }).catch(done);
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

  it('should store message in database with status delayed and not enqueue in driver', function (done) {
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    this.queue.sendMessage({
      payload: {
        foo: 'bar',
        sendAfter: tomorrow
      }
    }).then(jobId => {
      expect(this.queue._driver._messages.length).toEqual(0);
      return this.queue.getInfo(jobId);
    }).then(doc => {
      expect(doc.status).toEqual('delayed');
      done();
    }).catch(done);
  });

  it('properly selects when to send message based on sendAfter', function (done) {
    // Set up sendAfter times
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    this.queue.sendMessage({
      payload: {
        foo: 'bar',
        sendAfter: yesterday
      }
    }).then(() => {
      expect(this.queue._driver._messages.length).toEqual(1);
      return this.queue.sendMessage({
        payload: {
          foo: 'barbar',
          sendAfter: tomorrow
        }
      });
    }).then(() => {
      expect(this.queue._driver._messages.length).toEqual(1);
      this.queue._collection.count(function(err, count) {
        expect(count).toEqual(2);
      });
      done();
    }).catch(done);
  });

  it('sends messages with status delayed and send after < now', function (done) {
    var tk = require('timekeeper');

    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    let day_after_tomorrow = new Date();
    day_after_tomorrow.setDate(day_after_tomorrow.getDate() + 2);

    this.queue.sendMessage({
      payload: {
        foo: 'bar',
        sendAfter: tomorrow
      }
    }).then(() => {
      tk.travel(day_after_tomorrow);
      expect(this.queue._driver._messages.length).toEqual(0);
      return this.queue.sendDelayedMessages();
    }).then(() => {
      tk.reset();
      expect(this.queue._driver._messages.length).toEqual(1);
      done()
    }).catch(done);
  });

  it('Doesnt break for no jobs', function(done) {
    this.queue.sendDelayedMessages().then(() => {
      done();
    }).catch(done);
  });

  it('should cancel a message in the driver if its status in mongo is canceled', function(done) {
    this.queue.sendMessage({
      foo: 'bar'
    }).then(jobId => {
      return this.queue.setStatus(jobId, 'canceled');
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
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(null, 'result');
    }).then(() => {
      return this.queue.getInfo(jobId);
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
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(new Error('Something went wrong'));
    }).then(() => {
      return this.queue.getInfo(jobId);
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
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      return msg.done(new Error('Something went wrong'), null, {
        fatal: true
      });
    }).then(() => {
      return this.queue.getInfo(jobId);
    }).then((doc) => {
      expect(doc.status).toEqual('failed');
      expect(doc.failures.length).toEqual(1);
      expect(this.queue._driver.ack.calls.length).toEqual(1);
      expect(doc.retries).toEqual(0);
      done();
    }).catch(done);
  });

  it('should store logs in mongo and store the ack result', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      // remove logs to make sure it comes back
      msg.info.logs = null;
      msg.log('testing 1234');
      return msg.done();
    }).then(() => {
      return this.queue.getInfo(jobId);
    }).then(doc => {
      expect(doc.logs.length).toEqual(2);
      expect(doc.logs[0].message).toEqual(['testing 1234']);
      expect(doc.logs[1].message).toEqual(['Ack result', 'acked']);
      done();
    }).catch(done);
  });

  it('should be able to log complex things with debug on', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      msg.debug = true;
      msg.log('testing 1234', {
        foo: 'bar'
      }, new Error('testing 123'));
      done();
    }).catch(done);
  });

  it('should store arbitary metadata and allow lookup by that data', function(done) {
    let jobId;
    this.queue.sendMessage({
      foo: 'bar'
    }).then(id => {
      jobId = id;
      return this.queue.getMessage();
    }).then(msg => {
      msg.setMetaData('foo', 'bar')
      return msg.done();
    }).then(() => {
      return this.queue.getInfo(jobId);
    }).then(doc => {
      expect(doc.metadata.foo).toEqual('bar');
      return this.queue.getInfoFromMeta({
        foo:'bar'
      });
    }).then(doc => {
      expect(doc._id).toEqual(jobId);
      done();
    }).catch(done);
  });


});
