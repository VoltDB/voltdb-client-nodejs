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

# VoltDB Version
VOLTDB_VERSION=`cat ${VOLTDB_SRC}/version.txt`
VOLTDB_VERSION_LABEL=voltdb-${VOLTDB_VERSION}

# Get OS version
OS_VERSION_LABEL=$1

# VoltDB distribution
VOLTDB_DISTRIBUTION_NAME=${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}.tar.gz
VOLTDB_DISTRIBUTION_DIR=${ROOT_PROJECT_DIR}/tools/builder/build/dist/
VOLTDB_DISTRIBUTION_PATH=${VOLTDB_DISTRIBUTION_DIR}/${VOLTDB_DISTRIBUTION_NAME}

# Layout Docker image source
mkdir -p ${BUILD_DIR}
cp ${VOLTDB_DISTRIBUTION_PATH} -T ${BUILD_DIR}/voltdb-${VOLTDB_VERSION}.tar.gz
cp ${PROJECT_DIR}/env/${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}/Dockerfile ${BUILD_DIR}
cp ${VOLTDB_SRC}/tools/docker/deployment.xml ${BUILD_DIR}
cp ${VOLTDB_SRC}/tools/docker/docker-entrypoint.sh ${BUILD_DIR}

# Docker image
DOCKER_IMAGE_NAME=voltdb-runner
DOCKER_IMAGE_VERSION=1.0
DOCKER_TAG=${DOCKER_IMAGE_NAME}_${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}:${DOCKER_IMAGE_VERSION}

# Docker image build context path
DOCKER_BUILD_CONTEXT=${BUILD_DIR}

# APT proxy (replace with your own proxy address)
APT_PROXY_ADDR=10.0.0.3:3142

# Build a Docker image for running
sudo docker build \
	--build-arg APT_HTTP_PROXY=http://${APT_PROXY_ADDR} \
	--build-arg APT_HTTPS_PROXY=https://${APT_PROXY_ADDR} \
	--build-arg APT_FTP_PROXY=ftp://${APT_PROXY_ADDR} \
	--build-arg VOLT_KIT_VERSION=${VOLTDB_VERSION} \
	--tag ${DOCKER_TAG} \
	${DOCKER_BUILD_CONTEXT}
