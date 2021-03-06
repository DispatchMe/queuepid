/* jshint esnext:true */
import {
  SQS
}
from 'aws-sdk';
import {
  ensure
}
from 'simplecheck';
import {
  Promise
}
from 'es6-promise-polyfill';
export default class SQSDriver {
  constructor(config) {
    ensure(config.queueUrl, String);
    this.queueUrl = config.queueUrl;
    this._client = new SQS(config);
  }

  write(data, delay = 0) {
    ensure(data, Object);
    ensure(delay, Number);

    const params = {
      MessageBody: JSON.stringify(data),
      QueueUrl: this.queueUrl,
      DelaySeconds: delay,
    };

    return new Promise((resolve, reject) => {
      this._client.sendMessage(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  read(count = 1) {
    const params = {
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: count,
      WaitTimeSeconds: 10
    };


    return new Promise((resolve, reject) => {
      this._client.receiveMessage(params, (err, data) => {
        if (err) reject(err);
        else {
          resolve(data.Messages || []);
        }
      });
    });
  }

  ack(msg) {
    ensure(msg.ReceiptHandle, String);

    const params = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: msg.ReceiptHandle
    };


    return new Promise((resolve, reject) => {
      this._client.deleteMessage(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  getData(msg) {
    return JSON.parse(msg.Body);
  }
}
