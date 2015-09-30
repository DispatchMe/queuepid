import {SQS} from 'aws-sdk';
import {ensure} from 'simplecheck';

export default class SQSDriver {
  constructor(config) {
    ensure(config.queueUrl, String);
    this.queueUrl = config.queueUrl;
    this._client = new SQS(config);
  }

  write(data, delay=0) {
    ensure(data, Object);
    ensure(delay, Number);

    const params = {
      MessageBody:JSON.stringify(data),
      QueueUrl:this.queueUrl,
      DelaySeconds:delay,
    }

    return Promise((resolve, reject) => {
      this._client.sendMessage(params, (err, data) => {
        if(err) reject(err);
        else resolve(data);
      });
    });
  }

  read(count = 1) {
    const params = {
      QueueUrl:this.queueUrl,
      MaxNumberOfMessages:count,
      WaitTimeSeconds:10
    };

    return Promise((resolve, reject) => {
      this._client.receiveMessage(params, (err, data) => {
        if(err) reject(err);
        else resolve(data.messages);
      });
    });
  }

  ack(msg) {
    ensure(msg.ReceiptHandle, String);

    const params = {
      QueueUrl:this.queueUrl,
      ReceiptHandle:msg.ReceiptHandle
    };

    return Promise((resolve, reject) => {
      this._client.deleteMessage(params, (err, data) => {
        if(err) reject(err);
        else resolve(data);
      });
    })
  }

  getData(msg) {
    return JSON.parse(msg.Body);
  }
}
