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
ROOT_PROJECT_DIR=${SCRIPT_PATH}/../../..
PROJECT_DIR=${ROOT_PROJECT_DIR}/tools/runner
BUILD_DIR=${PROJECT_DIR}/build

# VoltDB_SRC
VOLTDB_SRC=${ROOT_PROJECT_DIR}/../voltdb

# VoltDB version
VOLTDB_VERSION=`cat ${VOLTDB_SRC}/version.txt`
VOLTDB_VERSION_LABEL=voltdb-${VOLTDB_VERSION}

# Get OS version
OS_VERSION_LABEL=$1

# Docker image
DOCKER_IMAGE_NAME=voltdb-runner
DOCKER_IMAGE_VERSION=1.0
DOCKER_TAG=${DOCKER_IMAGE_NAME}_${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}:${DOCKER_IMAGE_VERSION}

# Create Docker bridge network if network does not already exist
CURRENT_NETWORK=`sudo docker network ls -q --filter 'name=voltLocalCluster'`
if [ -z ${CURRENT_NETWORK} ]; then
	sudo docker network create -d bridge voltLocalCluster
fi

# Run Docker container
HOSTCOUNT=3 DOCKER_IMAGE=${DOCKER_TAG} ${VOLTDB_SRC}/tools/docker/local-host-cluster.sh
