## Queue Interface

Enqueing a message is done via a call to sendMessage.

Messages without or with a "send_after" property in the past, are sent immediately.

Messages with a "send_after" property in the future are stored in the database with a status of 'delayed'. These messages can be sent by a call to sendDelayedMessages().
