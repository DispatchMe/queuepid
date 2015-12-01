/* jshint esnext:true */
import {
  EventEmitter
}
from 'events';



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

    this._wait = pool.config.wait ? pool.config.wait : 500;
  }

  start() {
    this._stop = false;
    this.poll();
  }

  stop() {
    this._stop = true;
  }

  loop() {
    setTimeout(() => this.poll(), this._wait);
  }

  poll() {
    if (this._stop === true) {
      return;
    }
    this.queue.getMessage().then((job) => {
      if (job) {
        if (this.pool.config.debug === true) {
          job.debug = true;
        }
        job.on('done', () => this.loop());
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
