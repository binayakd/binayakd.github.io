---
title: Trino on AWS EKS with IAM/IRSA
date: 2024-04-25
---

## Introduction

The problem statement is to be able run SQL queries on parquet data in AWS S3. And given we have an AWS EKS cluster running, we can setup a Trino cluster and hive standalone metastore, which has been [well documented](https://trino.io/blog/2020/10/20/intro-to-hive-connector.html).

The what is less well documented is how to adhere to security best practices when establishing the connection between Trino and S3. On way to do this is to use [IAM Roles for Service Accounts (IRSA)](https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/). This allows us to use a kubernetes service account (used by Trino) to get read/write access to specific S3 buckets, though an IAM policy setup. 

In this post, I will walkthrough the setup process, using mostly Terraform (or OpenTofu if you prefer). I have takeing heavy inspiration from [here](https://shipit.dev/posts/setting-up-eks-with-irsa-using-terraform.html).

The full code can found in [Github](https://github.com/binayakd/trino-on-eks/tree/main).

## Hive Metastore Container Image

The Trino team provides official [container images](https://hub.docker.com/r/trinodb/trino) and [Helm chart](https://trino.io/docs/current/installation/kubernetes.html) we can use, so we are covered there (we will be using them later), but there is no official Hive Standalone Metastore container images. The most updated one I could fined was in this [EMR on EKS](https://github.com/aws-samples/hive-emr-on-eks/tree/main/docker) example. 

So lets go though the process of creating the container image for the Hive Metastore we can use. In the repo the Dockerfile and the entry point script is in the folder: `metastore/image`

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

```dockerfile
# update and install java and dependencies
RUN microdnf update -y \
  && microdnf --nodocs install shadow-utils java-17-openjdk-headless tar gzip -y \
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

Installing Hive Standalone Metastore:
```dockerfile
RUN curl https://repo1.maven.org/maven2/org/apache/hive/hive-standalone-metastore-server/${METASTORE_VERSION}/hive-standalone-metastore-server-${METASTORE_VERSION}-bin.tar.gz \
    | tar xz -C /opt/ \
    && ln -s /opt/apache-hive-metastore-${METASTORE_VERSION}-bin ${METASTORE_HOME} \
    # fix for schemaTool script
    && sed -i -e 's/org.apache.hadoop.hive.metastore.tools.MetastoreSchemaTool/org.apache.hadoop.hive.metastore.tools.schematool.MetastoreSchemaTool/g' ${METASTORE_HOME}/bin/ext/schemaTool.sh
```

> NOTE: As of Hive 4.0.0, there seems to be a bug in the `schemaTool.sh` script [here](https://github.com/apache/hive/blob/183f8cb41d3dbed961ffd27999876468ff06690c/standalone-metastore/metastore-server/src/main/scripts/ext/schemaTool.sh#L21C3-L21C67), where the Java class is not correct. Hence the `sed` command to fix it to the correct class.

Download and setup Postgres JDBC driver for connection to the :
```dockerfile
RUN curl https://repo1.maven.org/maven2/org/postgresql/postgresql/${POSTGRES_DRIVER_VERSION}/postgresql-${POSTGRES_DRIVER_VERSION}.jar \
    -o ${METASTORE_HOME}/lib/postgresql-${POSTGRES_DRIVER_VERSION}.jar
```

Finally we switch to the `METASTORE_HOME` directory, copy in the entrypoint script and setup `CMD` to run the entrypoint script
```dockerfile
WORKDIR ${METASTORE_HOME}
COPY --chown=hsm:hsm --chmod=775 entrypoint.sh bin/entrypoint.sh
CMD ["bash", "-c", "bin/entrypoint.sh"]
```
For the `entrypoint.sh` script, we setup 2 functions, a logging function, taken from [here](https://github.com/aws-samples/hive-emr-on-eks/blob/cbc4de1e7e922e7719df78b4b2704d34237eb84f/docker/entrypoint.sh#L3):
```bash
function log () {
    level=$1
    message=$2
    echo $(date  '+%d-%m-%Y %H:%M:%S') [${level}]  ${message}
}
```
And an `initSchema` function:
```bash
function initSchema () {
  log "INFO" "checking DB schemas"
  if ${METASTORE_HOME}/bin/schematool -info -dbType postgres
  then
    log "INFO" "scheme found in DB"
  else
    log "INFO" "schema not found DB, running initSchema"
    ${METASTORE_HOME}/bin/schematool -initSchema -dbType postgres
  fi
}
```
this function uses the `schemaTool` script provided in the Hive Standalone Metastore package, to check if the DB schema and tables are present, and if not, create them. 

Finally, we call `initSchema` and then actually start the Metastore, with some error handling

```bash
if initSchema 
then 
  log "INFO" "starting metastore"
  ${METASTORE_HOME}/bin/start-metastore
else 
  log "ERROR" "error checking schema or running initSchema"
  exit 1
fi
```

## AWS Resources

The the AWS resources that we need are:

1. S3 bucket, and associated IAM polices for access. 
2. The VPC to hold all the resources
3. EKS cluster with IAM Role to assume to access the S3 bucket from the EKS cluster
4. RDS for the hive metastore

We will create all of these using Terraform (or OpenTofu if you prefer, as I did). In the repo the Terraform file can be found in the folder: `terraform/aws-resources`. 

First we need to setup the provider versions (AWS), in `versions.tf`:
```terraform
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.43.0"
    }
  }
}
```

And set up the input variables in `variables.tf` (with descriptions):
```terraform
variable "enable_eks" {
  type    = bool
  default = true
  description = "Turn on or off the EKS resources"
}

variable "enable_rds" {
  type    = bool
  default = true
  description = "Turn on or off the RDS resources"
}

variable "cluster_endpoint_public_access_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks which can access the Amazon EKS public API server endpoint"
}

variable "kubeconfig_location" {
  type = string
  description = "Location to save the Kubeconfig file to"
}
```
The 

### S3 bucket

