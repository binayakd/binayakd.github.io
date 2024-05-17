---
title: Trino on AWS EKS with IAM/IRSA
date: '2024-04-25'
---

#### Table of Contents

- [Introduction](#introduction)
- [Container Images](#container-images)
- [Center](#center)
- [Color](#color)

---

# Introduction {#introduction}

The problem statement is to be able run SQL queries on parquet data in AWS S3. And given we have an AWS EKS cluster running, we can setup a Trino cluster and hive standalone metastore, which has been [well documented](https://trino.io/blog/2020/10/20/intro-to-hive-connector.html).

The what is less well documented is how to adhere to security best practices when establishing the connection between Trino and S3. On way to do this is to use [IAM Roles for Service Accounts (IRSA)](https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/). This allows us to use a kubernetes service account (used by Trino) to get read/write access to specific S3 buckets, though an IAM policy setup. 

In this post, I will walkthrough the setup process, using mostly Terraform (or Tofu if you prefer). I have takeing heavy inspiration from [here](https://shipit.dev/posts/setting-up-eks-with-irsa-using-terraform.html).

The full code can found in [Github](https://github.com/binayakd/trino-on-eks/tree/main).

---

# Container Images {#container-images}

The Trino team provides official [container images](https://hub.docker.com/r/trinodb/trino) and [Helm chart](https://trino.io/docs/current/installation/kubernetes.html) we can use, so we are covered there (we will be using them later), but there is no official Hive Standalone Metastore images. The most updated one I could fined was in this [EMR on EKS](https://github.com/aws-samples/hive-emr-on-eks/tree/main/docker) example. 

As of April 2024, the version 4.0.0 of Hive has been release, so we shall uses that (together with Hadoop v3.4.0) to make the image a bit more future prove, and take advantage of [Hadoop upgrades to use AWS SDK v2](https://hadoop.apache.org/docs/stable/hadoop-aws/tools/hadoop-aws/aws_sdk_upgrade.html)

I have chosen to use the Red Hat UBI Image as the base image, which is also what the [official Trino official Image uses](https://github.com/trinodb/trino/blob/master/core/docker/Dockerfile#L30):

```dockerfile
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest
```

Then we add build args to set the non-root user:
```dockerfile
# user and group IDs to run image as
ARG RUN_AS_USER=1000
ARG RUN_AS_GROUP=1000
```
and setup up the version to use:
```dockerfile
# Versions
ARG HSM_VERSION=4.0.0
ARG HADOOP_VERSION=3.4.0
ARG POSTGRES_DRIVER_VERSION=42.7.3
```

The dependence now have to install are:

1. `shadow-utils` to create the non-root user and group
2. `java-17-openjdk-headless` for the JVM runtime
3. `tar` and `gzip` to extract the Hive and Hadoop packages
4. `gettext` to do environment variable substitution in the config files

```dockerfile
# update and install java and dependencies
RUN microdnf update -y \
  && microdnf --nodocs install shadow-utils java-17-openjdk-headless tar gzip gettext -y \
  && microdnf clean all -y
````

Then we setup the non-root user and modifying the ownership of the `/opt` directory to the non-root user (`hsm`)

```dockerfile
# set up non root user
RUN groupadd -g ${RUN_AS_GROUP} hsm && \
  useradd -u ${RUN_AS_USER} -g hsm hsm

# setup opt dir for hsm user
RUN chown -R hsm:hsm /opt

USER hsm
```
Setting all the relevant environment variable:

```dockerfile
# Set Hadoop/HiveMetastore Classpath
ENV JAVA_HOME=/usr/lib/jvm/jre-17
ENV HADOOP_HOME="/opt/hadoop"
ENV METASTORE_HOME="/opt/hive-metastore"
ENV HIVE_HOME="/opt/hive-metastore"
ENV HADOOP_CLASSPATH="${HADOOP_HOME}/share/hadoop/tools/lib/*:${HADOOP_HOME}/share/hadoop/common/lib/*"
```

Installing Hadoop to the `/opt` directory:

```dockerfile
# Download Hadoop
RUN curl https://dlcdn.apache.org/hadoop/common/hadoop-$HADOOP_VERSION/hadoop-$HADOOP_VERSION.tar.gz \
    | tar xz -C /opt/  \
    && ln -s ${HADOOP_HOME}-$HADOOP_VERSION ${HADOOP_HOME} \
    && rm -r ${HADOOP_HOME}/share/doc
```

Installing Hive Standalone 