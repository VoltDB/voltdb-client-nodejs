VoltDB NodeJS Wire Protocol Driver 0.1.1
========================================

Requirements
------------

Node.js 0.6.10
VoltDB 2.1.3


Installation
------------

To use the sample ./voternoui.js, install the required node libraries:

    npm install cli
    npm install bignumber


Example Application
-------------------

The example uses the voter example server included in the VoltDB distribution. It is found in `VOLTDB_HOME/examples/voter`.

1. Start the server 

    ./run.sh server

2. In a second terminal, run the sample

    node ./voternoui.js [-h voltdb_host] [-c number_of_votes]

No parameters will default to:

    node ./voternoui.js -h localhost -c 10000


You may want to set the number of VoltDB *sites per host* to something interesting in `VOLTDB_HOME/examples/voter/deployment.xml`. The 
*sites per host* value is equivalent to the number of cores that VoltDB will use for the server when you are running a single instance on localhost.


Known Issues
------------

Driver does not currently support varbinary type. 