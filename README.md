VoltDB NodeJS Wire Protocol Driver 2.0
======================================

Requirements
============

Node.js 6.11.0 or later
VoltDB 7.5 or later


Installation
============
Run NPM to install all the dependencies for the driver itself. The example application does not automatically install its dependencies, so do `npm install` in both the directory where the node.js driver is installed and the example/voter/voter folder as well.

    npm install

Introduction
============
The VoltDB is a high throughput, ACID compliant database that works best when using an asynchronous client. This wire driver runs in asynchronous mode only.

Please see the documentation for administering and using VoltDB on the [VoltDB community page][1]


Example Application
===================

The example uses the voter example server included in the VoltDB distribution. It is found in `VOLTDB_HOME/examples/voter`.

1\. Start the server

```
./run.sh server
```

2\. In a second terminal, run the sample

```
cd ./examples/voter/voter
node ./app.js
```

3\. Open a browser and connect to localhost:3000 and watch the voting results.

The example include detailed comments about how the application runs in the app.js and volt.js files.

You may want to set the number of VoltDB *sites per host* to something interesting in `VOLTDB_HOME/examples/voter/deployment.xml`. The
*sites per host* value is equivalent to the number of cores that VoltDB will use for the server when you are running a single instance on localhost.


Driver Modules
==============
----------


VoltClient
==========
This provides the interface for connecting to the VoltDB server, managing event processing and executing stored procedures.

Methods
-----------
VoltClient(configurationArray)
-------------------------

 - configurationArray: A collection of configurations for connecting to and managing all of the nodes within the VoltDB cluster.

Creates an instance of the client and sets internal properties, but does not perform the actual connection operation.

VoltClient.connect(callback)
----------------------------

 - callback: A handler that gets the success and failure statuses for each of the servers specified in the `configurationArray` in the `VoltClient`

Attempts to connect to each of the VoltDB server configurations passed into the constructor. The callback will be invoked for each connection. Connections may fail and the callback will receive error information. See the **Callbacks** section for callback parameter information.

VoltClient.callProcedure(query, readCallback, writeCallback)
------------------------------------------------------------
 - query: An instance of a `VoltQuery` object.
 - readCallback: callback that receives the results of a query.
 - writeCallback: callback that is invoked when the client driver is able to write again to the driver.

This function manages all queries to the VoltDB server. This includes whether it is safe to allow for more writes, encoding of query parameters and management of the outgoing query queue.

Calling this function in a loop is generally discouraged since it can lead to blocking socket reads. The VoltDB server will drop a connection if data lingers on the socket for too long. The `writeCallback` handler is mechanism for avoiding that particular problem is it will get invoked each time the driver is able to issue another query.

See the **Callbacks** section for callback parameter information.

VoltConfiguration
=================
Create a VoltConfiguration object for each server within a VoltDB cluster. Pass this configuration into the `VoltClient(configurationArray)` constructor.


 - VoltConfiguration.host: The server name
 - VoltConfiguration.port: The server port (optional)
 - VoltConfiguration.username: Username if not using the default. (optional)
 - VoltConfiguration.password: Password if not using the default. (optional)
 - VoltConfiguration.service: Service if not using the default. (optional)
 - VoltConfiguration.queryTimeout: How long a query should be allowed to be pending before the driver issues an error message. (optional)
 - VoltConfiguration.queryTimeoutInterval: The interval for checking for queries that have timed out. Also cleans out the queue of processed queries. (optional)
 - VoltConfiguration.flushInterval: How long to wait before flushing the query queue. (optional)
 - VoltConfiguration.messageQueueSize: Maximum number of messages to place in the driver's internal message queue before writing them to the outgoing socket. The default value is set to 10 and it is not recommended to create queue much larger as the gains become less significant as the queue grows. (optional)
 - VoltConfiguration.maxConsecutiveWrites: The driver will only allow this number of writes to the outgoing queue and socket before requiring a read operation. This is necessary to ensure that read operations are not blocked. The default value is 5000 queries. If you find that connections between the client and server are being dropped by the server, then lower this value to ensure more frequent reads. (optional)

VoltProcedure
=============
Defines a template for a query, which includes the name of the procedure and the parameter types that can be passed to the query.

Methods
-------
VoltProcedure(name, types)
--------------------------

 - name: The name of the stored procedure.
 - types: An array of types specified as a set of strings.

**Example**
```
var resultsProc = new VoltProcedure('Results');
var initProc = new VoltProcedure('Initialize', ['int', 'string']);
var voteProc = new VoltProcedure('Vote', ['long', 'int', 'long']);
```

A complete list of types is specified in the **Data Types** section


VoltProcedure.getQuery()
--------------------------------
Returns an instance of a VoltQuery.

VoltQuery
=========
VoltQuery is necessary for query invocation, but the application developer does very little with it. A VoltQuery is produced by the `VoltProcedure.getQuery()` function. That object is then passed to the `VoltClient.callProcedure`function.

VoltQuery(procName, types)
--------------------------
Called only by the VoltProcedure object.


Callbacks
=========
---------
All callbacks take follow the same structure:
<callback name>(errorCode, eventCode, result)
 - errorCode: Will be set to null if successful or a numeric value if an error occurred. See **Error Codes** for details on each error code.

**Example 1: Using status codes**
```
client.callProcedure(query, displayResults(errorCode, eventCode, results) {
    if(errorCode == VoltConstants.STATUS_CODES.SUCCESS) {
      // Success!
    } else {
      // Error handling
    }
  });
```


**Example 2: No status codes**
```
client.callProcedure(query, displayResults(errorCode, eventCode, results) {
    if(errorCode) {
      // Error Handling
    } else {
      // Success!
    }
  });
```


Events
======
----------

SESSION\_EVENT
--------------
 - SESSION\_EVENT.CONNECTION: A successful connection to the volt server
 - SESSION\_EVENT.CONNECTION\_ERROR: Could not connect, see both the status code and the event handler's message parameter.
 - SESSION\_EVENT.QUERY\_RESPONSE: Query executed and returned.
 - SESSION\_EVENT.QUERY\_ALLOWED: Indicates that the application may execute another query Note that this prevents your application from flooding the database and the application's code from blocking.
 - SESSION\_EVENT.QUERY\_RESPONSE\_ERROR:The query was successfully dispatched but theVoltDB server either had a critical fault or dropped the connection.
 - SESSION\_EVENT.QUERY\_DISPATCH\_ERROR: The client could not dispatch the query.
 - SESSION\_EVENT.FATAL\_ERROR: A critical error occurred that was above and beyond all other error conditions.

Error Codes
===========
----------

STATUS\_CODES
============
 - STATUS\_CODES.SUCCESS: Operation succeeded. Note that the value of this constant is null.
 - STATUS\_CODES.USER\_ABORT: The user's stored procedure intentionally threw an exception of type `UserAbortException`.
 - STATUS\_CODES.GRACEFUL\_FAILURE: Query had an error that rolled back the transaction.
 - STATUS\_CODES.UNEXPECTED\_FAILURE: Query had an error, rolled back the transaction and caused additional errors.
 - STATUS\_CODES.CONNECTION\_LOST: The connection to VoltDB was lost before the query returned. This is not issued by the server, but is issued by the client.
 - STATUS\_CODES.SERVER\_UNAVAILABLE: Attempted to use an invalid connection.
 - STATUS\_CODES.CONNECTION\_TIMEOUT: The server stopped replying.
 - STATUS\_CODES.QUERY\_TIMEOUT:  The server issues a message saying that the query took too long to execute.
 - STATUS\_CODES.QUERY\_TOOK\_TOO\_LONG: Driver issued message indicating that the server has taken too long to respond.

Data Types
===========
----------
These data types are not JavaScript data types. The driver uses these type specifiers to encode a JavaScript type into a VoltDB type.
 - null: Use `null`
 - byte: Use a number, not a string
 - tinyint: Use a number, not a string
 - short: Use a number, not a string
 - smallint: Use a number, not a string
 - int: Use a number, not a string
 - integer: Use a number, not a string
 - long: Use a number, not a string
 - bigint: Use a number, not a string
 - double: Use a number, not a string
 - float: Use a number, not a string
 - string: Use a string
 - date: Use a number, not a string
 - timestamp: Use a number, not a string
 - decimal: Use a number, not a string
 - varbinary: Use a `Buffer`



  [1]: http://community.voltdb.com/
