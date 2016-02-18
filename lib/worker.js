/* jshint esnext:true */
import {
  EventEmitter
}
from 'events';


const STATE_IDLE = 'idle';
const STATE_POLLING = 'polling';
const STATE_HANDLING = 'handling';
const STATE_STOPPED = 'stopped';
export default class WorkerPool extends EventEmitter {
  constructor(queue, config, handler) {
    super();
    this.config = config;
    this.handler = handler;
    this.queue = queue;
    this._workers = [];
  }

  start() {
    for (let i = 0; i < this.config.maxConcurrent; i++) {
      let worker = new Worker(this.queue, this.handler, this);
      this._workers.push(worker);
      worker.start();
    }
  }

  stop() {
    this._workers.forEach(worker => worker.stop());
  }
}

class Worker {
  constructor(queue, handler, pool) {
    this.queue = queue;
    this.handler = handler;
    this.pool = pool;

    this._setState(STATE_IDLE);
    this._wait = pool.config.wait ? pool.config.wait : 500;
  }

  _setState(state) {
    this._state = state;
  }

  start() {
    this._stop = false;
    this.poll();
  }

  stop() {
    this._stop = true;
  }

  loop() {
    this._setState(STATE_IDLE);
    setTimeout(() => {
      this.poll();
    }, this._wait);
  }

  poll() {
    if (this._stop === true) {
      return;
    }

    let handleDone = () => {
      this.loop();
    };

    this._setState(STATE_POLLING);
    this.queue.getMessage().then((job) => {
      if (job) {
        this._setState(STATE_HANDLING);
        if (this.pool.config.debug === true) {
          job.debug = true;
        }
        job.once('done', handleDone);
        this.handler(job);
      } else {
        this.loop();
      }
      job = null;
    }).catch((err) => {
      this.loop();
      this.pool.emit('error', err);

    });
  }
}
