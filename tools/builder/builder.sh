#!/usr/bin/env bash

###############################################################################
#
###############################################################################

# Init
set -e

# Get the script path
pushd `dirname $0` > /dev/null
SCRIPT_PATH=`pwd`
popd > /dev/null

# Project directories
ROOT_PROJECT_DIR=${SCRIPT_PATH}/../..
PROJECT_DIR=${ROOT_PROJECT_DIR}/tools/builder
BUILD_DIR=${PROJECT_DIR}/build

# VoltDB_SRC
VOLTDB_SRC=${ROOT_PROJECT_DIR}/../voltdb

# Get VoltDB version
VOLTDB_VERSION=`cat ${VOLTDB_SRC}/version.txt`

# Get OS version
OS_VERSION_LABEL=${1:-ubuntu-14.04}

# Info
echo "builder | Building VoltDB build environment Docker image (VoltDB: ${VOLTDB_VERSION}, OS: ${OS_VERSION_LABEL})"

# Build builder docker image
${PROJECT_DIR}/src/builder-docker-build.sh ${VOLTDB_VERSION} ${OS_VERSION_LABEL}

# Info
echo "builder | Running VoltDB build (VoltDB: ${VOLTDB_VERSION}, OS: ${OS_VERSION_LABEL})"

# Run builder docker container
${PROJECT_DIR}/src/builder-docker-run.sh ${OS_VERSION_LABEL}