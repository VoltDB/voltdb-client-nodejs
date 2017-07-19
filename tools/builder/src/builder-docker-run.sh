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
PROJECT_DIR=${ROOT_PROJECT_DIR}/tools/builder
BUILD_DIR=${PROJECT_DIR}/build

# VoltDB_SRC
VOLTDB_SRC=${ROOT_PROJECT_DIR}/../voltdb

# VoltDB version
VOLTDB_VERSION=`cat ${VOLTDB_SRC}/version.txt`
VOLTDB_VERSION_LABEL=voltdb-${VOLTDB_VERSION}

# Get OS version
OS_VERSION_LABEL=$1

# Docker image
DOCKER_IMAGE_NAME=voltdb-builder
DOCKER_IMAGE_VERSION=1.0
DOCKER_TAG=${DOCKER_IMAGE_NAME}_${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}:${DOCKER_IMAGE_VERSION}

# Where the VoltDB build puts the distribution
VOLTDB_DIST_SRC=${VOLTDB_SRC}/obj/release/voltdb-${VOLTDB_VERSION}.tar.gz

# Dist path
DIST_PATH=${BUILD_DIR}/dist
DIST_NAME=${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}.tar.gz

# Run a container for building
sudo docker run \
	--volume ${VOLTDB_SRC}:/src \
	${DOCKER_TAG} \
	ant clean dist

# Copy the built Volt distribution and append the OS label (so we can create multiple builds if needed)
mkdir -p ${DIST_PATH}
cp ${VOLTDB_DIST_SRC} -T ${DIST_PATH}/${DIST_NAME}
