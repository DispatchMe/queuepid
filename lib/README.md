## Queue Interface

Enqueing a message is done via a call to sendMessage. Whether this message is sent in the future or immediately is determined by the "sendAfter" property, an ISO8601 timestamp on the object's payload.

Messages without or with a "sendAfter" property in the past, are sent immediately.

Messages with a "sendAfter" property in the future are stored in the database with a status of 'delayed'. These messages can be sent by a call to sendDelayedMessages().
