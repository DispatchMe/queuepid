queuepid
======

Queupid is a back-end agnostic job queue. It solves a few problems with existing solutions:

1. If you want to know what's inside of the queue (to be able to cancel queued tasks, etc), you can't use a solution like SQS or RabbitMQ.
2. With a database-backed solution, you CAN see what's in the queue, but you lose the high-availability and pure scalability benefits of solutions like SQS or RabbitMQ

The optimal solution, in my mind, is a hybrid: use a proven, scalable, high-availability back-end, but keep job info, status, and other metadata in a database and let that guide how messages are handled when received from the queue back-end. 

## Basics
A Quepid queue uses a **driver** to interact with the queue back-end. The public API of the queue is agnostic to the driver, so you can swap out drivers or modify existing ones without having to change anything relying on the queue.

Message metadata is stored in a Mongo database (provided to the queue via `config.mongoUrl`). The body of the message written to the back-end is a simple JSON object with one key, `jobId`, which references the ID of the message in the Mongo database. When a message is received, the corresponding metadata is looked up, and the message is handled accordingly. If, for example, the metadata document's `status` property is set to `"canceled"`, the job is not handled; instead, it is just removed from the queue.

This of course adds a few milliseconds to the overall processing time, but in my opinion this is outweight by the benefit of being able to inspect messages in the queue and have more control over the flow.

## Usage

### Configure a queue
```js
import {Queue, SQSDriver} from 'queuepid';

const queue = new Queue('queue name', new SQSDriver({
  accessKeyId:'<access key>',
  secretAccessKey:'<secret key>',
  region:'<region>'
}), {
  mongoUrl:'mongodb://localhost/queue',
  retryLimit:10
});
```

### Send a message
The second argument of `sendMessage` is the number of seconds to keep the message in the queue before it is visible.

```js
queue.sendMessage({
  foo:'bar'
}, 10, {
  retryLimit:5
}).then((messageId) => {
  console.log('message sent with ID %s', messageId);
});
```

### Work the queue
You can either work one message at a time...

```js
queue.getMessage().then((job) => {
  if(job) {
    // Work...
    job.succeed('End result').then...

    // Or fail and retry (unless retry limit was hit)
    job.fail(new Error('Something went wrong')).then...

    // Or fail and skip retries (fatal)
    job.fail(new Error('Fatal error!!!'), {
      fatal:true
    }).then...
  } else {
    console.log('Nothing to do!');
  }
});
```

Or work with a worker pool...

```js
import {WorkerPool} from 'queuepid';

const pool = new WorkerPool(queue, {
  // Workers to run in parallel
  maxConcurrent:10,

  // Milliseconds to wait before polling again if no messages
  wait:500
}, function(job) {
  // Work...
  let data = job.info;
  job.succeed('End result');
});
```

