## Queue Interface

Messages can be sent in the queue and based on the property "send_after" take one of two paths.

Messages without or with a "send_after" property in the past, have their messages sent immediately. The message metadata and payload is stored in the datastore and the id of the object in the database is put into the queue.

Messages with a "send_after" property in the future are stored in the database with a status of 'waiting'. These messages can be sent by a call to sendDelayedMessages(), which queues up message for consumption by workers.
