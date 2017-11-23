#!/usr/bin/env bash

function help() {
    echo "Usage: ./run.sh {clean|catalog|server}"
}

if [ -z "$VOLTDB_HOME" ]
then
    echo "VOLTDB_HOME must be set";
    help
    exit 1
else
    APPNAME="typetest"
    CLASSPATH="`ls -x $VOLTDB_HOME/voltdb/voltdb-*.jar | tr '[:space:]' ':'``ls -x $VOLTDB_HOME/lib/*.jar | tr '[:space:]' ':'`"
    VOLTDB="$VOLTDB_HOME/bin/voltdb"
    VOLTCOMPILER="$VOLTDB_HOME/bin/voltcompiler"
    LICENSE="$VOLTDB_HOME/voltdb/license.xml"
    LEADER="localhost"
fi

# remove build artifacts
function clean() {
    rm -rf obj debugoutput $APPNAME.jar voltdbroot plannerlog.txt voltdbroot
}

# compile the source code for procedures and the client
function srccompile() {
    mkdir -p obj
    javac -classpath $CLASSPATH -d obj \
        -sourcepath ./src \
        ./src/com/voltdb/test/typetest/proc/*.java
    jar  cvf  $APPNAME.jar -C obj .
    # stop if compilation fails
    if [ $? != 0 ]; then exit; fi
}

# build an application catalog
function catalog() {
    srccompile

    # stop if compilation fails
    if [ $? != 0 ]; then exit; fi
}

# run the voltdb server locally
function server() {
    # if a catalog doesn't exist, build one
    if [ ! -f $APPNAME.jar ]; then catalog; fi
    
  DOCKER_QUERY=`docker port node1 21212`
  if [ $? -eq 0 ]; then
    PORT=`echo ${DOCKER_QUERY} | cut -d: -f2`
    # Found a Docker container running Volt, load the procs into the db
    echo "Found local Docker container running Volt, loading schema"
    echo "load classes typetest.jar;" | sqlcmd --port=$PORT
    echo "file ddl-drop.sql;" | sqlcmd --port=$PORT
    echo "file ddl.sql;" | sqlcmd --port=$PORT
  else
    # No Docker container running Volt, start a local instance if we can
    echo "Could not find local Docker container running Volt, starting local instance with schema"
    # run the server
    $VOLTDB init -C deployment.xml -f -j $APPNAME.jar -s ddl.sql
    $VOLTDB start
  fi
}

# Run the target passed as the first arg on the command line
# If no first arg, run server
if [ $# -gt 1 ]; then help; exit; fi
if [ $# = 1 ]; then $1; else server; fi