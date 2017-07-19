###############################################################################
#
# Creates a build environment for building VoltDB 7.4 for Ubuntu 14.04 
# from source.
#
# Allows the necessary OS distribution and packages to be explicitly set for
# building a particular distribution.
#
###############################################################################

FROM ubuntu:14.04

# exit on error
RUN set -e

ARG APT_HTTP_PROXY
ARG APT_HTTPS_PROXY
ARG APT_FTP_PROXY

# Set up apt proxy (Seems to be the only way to get Docker to use an apt proxy)
RUN if [ -n "${APT_HTTP_PROXY}" ]; then \
        echo "Acquire::http::Proxy \"${APT_HTTP_PROXY}\";" >> /etc/apt/apt.conf.d/30proxy; \
    fi; \
    if [ -n "${APT_HTTPS_PROXY}" ]; then \
        echo "Acquire::https::Proxy \"${APT_HTTPS_PROXY}\";" >> /etc/apt/apt.conf.d/30proxy; \
    fi; \
    if [ -n "${APT_FTP_PROXY}" ]; then \
        echo "Acquire::ftp::Proxy \"${APT_FTP_PROXY}\";" >> /etc/apt/apt.conf.d/30proxy; \
    fi

# Remove the gzip indexes configuration so apt-show-versions will work in the ubuntu docker image
RUN rm /etc/apt/apt.conf.d/docker-gzip-indexes

# update repo - Trusty does not seem to have add-repo command by default
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
                                   apt-get upgrade -y && \
                                   apt-get -y  --no-install-recommends --no-install-suggests install python-software-properties && \
                                   apt-get -y  --no-install-recommends --no-install-suggests install software-properties-common

# Add JDK8 repository
RUN add-apt-repository -y  ppa:openjdk-r/ppa && \
    apt-get update

# Install VoltDB build requirements
RUN apt-get install -y  --no-install-recommends --no-install-suggests \
    ant build-essential ant-optional openjdk-8-jdk wget python cmake \
    valgrind ntp ccache git-arch git-completion git-core git-svn git-doc \
    git-email python-httplib2 python-setuptools python-dev apt-show-versions

# Make sure JDK 8 is used over 7
RUN sudo update-java-alternatives -s /usr/lib/jvm/java-1.8.0-openjdk-amd64

# Create a directory to hold source
RUN mkdir "/src"

# Set workdir
WORKDIR "/src"
