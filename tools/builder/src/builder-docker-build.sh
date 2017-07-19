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

# Get VoltDB version
VOLTDB_VERSION=$1
VOLTDB_VERSION_LABEL=voltdb-${VOLTDB_VERSION}

# Get OS version
OS_VERSION_LABEL=$2

# Layout Docker image source
mkdir -p ${BUILD_DIR}
cp ${PROJECT_DIR}/env/${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}/Dockerfile ${BUILD_DIR}

# Docker image
DOCKER_IMAGE_NAME=voltdb-builder
DOCKER_IMAGE_VERSION=1.0
DOCKER_TAG=${DOCKER_IMAGE_NAME}_${VOLTDB_VERSION_LABEL}_${OS_VERSION_LABEL}:${DOCKER_IMAGE_VERSION}

# Docker image build context path
DOCKER_BUILD_CONTEXT=${BUILD_DIR}

# APT proxy (replace with your own proxy address)
APT_PROXY_ADDR=10.0.0.3:3142

# Build a Docker image for building
sudo docker build \
	--build-arg APT_HTTP_PROXY=http://${APT_PROXY_ADDR} \
	--build-arg APT_HTTPS_PROXY=https://${APT_PROXY_ADDR} \
	--build-arg APT_FTP_PROXY=ftp://${APT_PROXY_ADDR} \
	--tag ${DOCKER_TAG} \
	${DOCKER_BUILD_CONTEXT}
