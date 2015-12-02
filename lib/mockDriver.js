/* jshint esnext:true */
import {
  SQS
}
from 'aws-sdk';
import {
  ensure
}
from 'simplecheck';

// For unique IDs
import hat from 'hat';

export default class MockDriver {
  constructor(config) {
    this._messages = [];
    this._timeoutsById = {};
  }

  write(data, delay = 0) {
    let id = hat(64);
    this._messages.push({
      id: id,
      data: data
    });

    return Promise.resolve(data);
  }

  sentMessage(msg, delay) {
    this._timeoutsById[msg.id] = setTimeout(() => {
      this._messages.push(msg);
    }, delay);
  }

  read(count = 1) {
    let messages = this._messages.slice(0, count);
    messages.forEach(msg => this.sentMessage(msg, 30));

    this._messages = this._messages.slice(count);
    return Promise.resolve(messages);
  }

  ack(msg) {
    let timeout = this._timeoutsById[msg.id];
    if (timeout) {
      clearTimeout(timeout);
    }
    return 'acked';
  }

  getData(msg) {
    return msg.data;
  }

  extend(msg, time) {
    delete(this._timeoutsById[msg.id]);
    this.sentMessage(msg, time);

    return Promise.resolve();
  }
}
