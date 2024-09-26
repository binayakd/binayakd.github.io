---
title: Exploring Apache Iceberg
date: 2024-08-30
---

## Introduction

With the recent [buzz around Apache Iceberg Tables](https://thenewstack.io/snowflake-databricks-and-the-fight-for-apache-iceberg-tables/), I am cashing in on the this buzz to explore what Apache Iceberg is all about, exploring the iceberg that is Apache Iceberg, if you will.

The way I see it, Iceberg provides improvements over the Hive table format, which itself has been used to bring relational database table like interface on top of "unstructured" data, in distributed storage. It is better because, not only does it have some additional features (Schema evolution, hidden partitioning, snapshots, improved performance, etc.), but also the fact that it is an open standard, with multiple implementations, allowing us to move away from Hadoop/Hive dependencies. 

In this post, we will be exploring Apache Iceberg, by building a small datalake in out laptops, using Docker/Podman Compose, and taking an introductory look at setting up multiple Iceberg catalogs, and using them. we will be using Minio object storage to hold the data files, Jupyter lab as our development environment to run our query engines, and some other stuff that is required to setup Iceberg catalogs. 

All the code and details on how to setup the environment and run them can be found in [this repo](https://github.com/binayakd/exploring-apache-iceberg). 

### Engines of Exploration

Iceberg is supported using multiple querying engines. In the middle of working on this article, Kevin Liu published his own article on working with multiple Iceberg catalogs using PyIceberg, which is basically the Python client for Iceberg. Do check it out here: [A Tour of Iceberg Catalogs with PyIceberg](https://kevinjqliu.substack.com/p/a-tour-of-iceberg-catalogs-with-pyiceberg).

Here I would be focusing on using Spark and Trino. Spark, because thats the main query engine, and currently the most feature rich engine to work with Iceberg. We will use it to actually load our data into our Iceberg datalake. Trino because it allows us to run SQL queries in a simple by powerful way on top of our data in our Iceberg based datalake. We will be using Trino to query back the data we loaded into the data lake.

### Catalog of Catalogs

From the Iceberg Java source code, as of August 2024, the list of built-in catalogs supported are:

1. Hadoop Catalog
3. Glue Catalog
2. Hive Catalog
4. Nessie Catalog
5. JDBC Catalog
6. REST Catalog

Hadoop catalog is also known as the 'file-system' catalog, which stores all metadata in file systems (local or distributed). This also means that this might not be fully ACID compliant, and is generally not recommended for production usage. 

Glue Catalog is a AWS managed service, which comes with its conveniences, but will incur costs, and is not suitable for on-prem setups. 

[Nessie catalog](https://projectnessie.org/) is a more unique catalog, which provide 'git-like' version control over the data. Although there is a dedicated connector to the Nessie catalog, Nessie is also moving towards supporting the [REST catalog interface](https://projectnessie.org/guides/try-nessie/). 

For those reasons I would only be focusing on Hive, JDBC and REST catalogs. 

Hive catalog is the original, using the Hive Metastore to track table metadata. As Iceberg is an improvement on the Hive Table format, the Hive Metastore was naturally used as first catalog with Iceberg. A more detailed history can be found [here](https://www.dremio.com/resources/guides/apache-iceberg-an-architectural-look-under-the-covers/).

JDBC (or SQL) catalog, is the most basic catalog, where the table metadata is stored directly in a relational database, and does not require any separate catalog or metastore instance. Interestingly, almost all other catalog, do still use a relational database to store metadata, but offer extra features on top. 

And finally we have the REST catalog, which is not really a catalog, but is actually a [REST Open API specification](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml). This allows the development of language independent catalogs, that implements the specifications, with additional features. Here I will be using the [Python REST Catalog by Kevin Liu](https://github.com/kevinjqliu/iceberg-rest-catalog), which uses PyIceberg under the hood.

## Setup

### Environment Setup

All the required image builds and container startups are defined in this [docker-compose file](https://github.com/binayakd/exploring-apache-iceberg/blob/main/docker-compose.yaml). 

This will build the following Images:

1. `jupyter-spark`: this is the Jupyter Lab based development environment with all the client dependencies installed
2. `hive-metastore`: this will be used as the Iceberg Hive Catalog
3. `iceberg-rest-catalog`: this is a python Iceberg REST catalog by [Kevin Liu](https://github.com/kevinjqliu/iceberg-rest-catalog), which I have forked, and added to this repo as a submodule

On top of the 3 images mentioned above, this will also start the following images:

1. `minio`: this will be our local S3 alternative, the object storage holding the data
2. `mc`: this is the Minio client image, which is started to automatically create the initial bucker in Minio, then shutdown.
3. `postgres`: this is the Postgres that will be used by the catalogs. An init script in the `postgres-init` folder is used to create the required databases in the postgres instances on first startup.
4. `trino`: this is the Trino server, running as a single node cluster, with all the configs in the `trino-config`folder

With call those started, the Jupyter lab instance can be accessed at: http://localhost:8888,  with data created when running the notebooks will be saved under the `local-data` folder.

The following sections are based on this Jupyter Notebook: [`00-setup.ipynb`](https://github.com/binayakd/exploring-apache-iceberg/blob/main/workspace/00-setup.ipynb)

### Download test data
The test data we will be using is the classic NYC taxi trip dataset, available here [here](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page). Specifically we are downloading the yellow taxi trip data, for January and February 2024, and adding it as partitions to our table.

```python
!curl https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet -o ./downloaded-data/yellow_tripdata_2024-01.parquet

```

      % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                     Dload  Upload   Total   Spent    Left  Speed
    100 47.6M  100 47.6M    0     0  11.4M      0  0:00:04  0:00:04 --:--:-- 11.4M

```python
!curl https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-02.parquet -o ./downloaded-data/yellow_tripdata_2024-02.parquet
```

      % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                     Dload  Upload   Total   Spent    Left  Speed
    100 48.0M  100 48.0M    0     0  11.8M      0  0:00:04  0:00:04 --:--:-- 11.8M


### Exploring the test data
As a start, we can use Pandas to explore the data downloaded.


```python
import pandas as pd

df = pd.read_parquet("./downloaded-data/yellow_tripdata_2024-01.parquet")
df
```
|         | VendorID | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | RatecodeID | store_and_fwd_flag | PULocationID | DOLocationID | payment_type | fare_amount | extra | mta_tax | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | Airport_fee |
|---------|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|-------|---------|------------|--------------|-----------------------|--------------|----------------------|-------------|
| 0       | 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1.0             | 1.72          | 1.0        | N                  | 186          | 79           | 2            | 17.70       | 1.00  | 0.5     | 0.00       | 0.00         | 1.0                   | 22.70        | 2.5                  | 0.0         |
| 1       | 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1.0             | 1.80          | 1.0        | N                  | 140          | 236          | 1            | 10.00       | 3.50  | 0.5     | 3.75       | 0.00         | 1.0                   | 18.75        | 2.5                  | 0.0         |
| 2       | 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1.0             | 4.70          | 1.0        | N                  | 236          | 79           | 1            | 23.30       | 3.50  | 0.5     | 3.00       | 0.00         | 1.0                   | 31.30        | 2.5                  | 0.0         |
| 3       | 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1.0             | 1.40          | 1.0        | N                  | 79           | 211          | 1            | 10.00       | 3.50  | 0.5     | 2.00       | 0.00         | 1.0                   | 17.00        | 2.5                  | 0.0         |
| 4       | 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1.0             | 0.80          | 1.0        | N                  | 211          | 148          | 1            | 7.90        | 3.50  | 0.5     | 3.20       | 0.00         | 1.0                   | 16.10        | 2.5                  | 0.0         |
| ...     | ...      | ...                  | ...                   | ...             | ...           | ...        | ...                | ...          | ...          | ...          | ...         | ...   | ...     | ...        | ...          | ...                   | ...          | ...                  | ...         |
| 2964619 | 2        | 2024-01-31 23:45:59  | 2024-01-31 23:54:36   | NaN             | 3.18          | NaN        | None               | 107          | 263          | 0            | 15.77       | 0.00  | 0.5     | 2.00       | 0.00         | 1.0                   | 21.77        | NaN                  | NaN         |
| 2964620 | 1        | 2024-01-31 23:13:07  | 2024-01-31 23:27:52   | NaN             | 4.00          | NaN        | None               | 114          | 236          | 0            | 18.40       | 1.00  | 0.5     | 2.34       | 0.00         | 1.0                   | 25.74        | NaN                  | NaN         |
| 2964621 | 2        | 2024-01-31 23:19:00  | 2024-01-31 23:38:00   | NaN             | 3.33          | NaN        | None               | 211          | 25           | 0            | 19.97       | 0.00  | 0.5     | 0.00       | 0.00         | 1.0                   | 23.97        | NaN                  | NaN         |
| 2964622 | 2        | 2024-01-31 23:07:23  | 2024-01-31 23:25:14   | NaN             | 3.06          | NaN        | None               | 107          | 13           | 0            | 23.88       | 0.00  | 0.5     | 5.58       | 0.00         | 1.0                   | 33.46        | NaN                  | NaN         |
| 2964623 | 1        | 2024-01-31 23:58:25  | 2024-02-01 00:13:30   | NaN             | 8.10          | NaN        | None               | 138          | 75           | 0            | 32.40       | 7.75  | 0.5     | 7.29       | 6.94         | 1.0                   | 55.88        | NaN                  | NaN         |


Getting a more detailed view of the schema:
```python
df.info(verbose=True)
```

    <class 'pandas.core.frame.DataFrame'>
    RangeIndex: 2964624 entries, 0 to 2964623
    Data columns (total 19 columns):
     #   Column                 Dtype         
    ---  ------                 -----         
     0   VendorID               int32         
     1   tpep_pickup_datetime   datetime64[us]
     2   tpep_dropoff_datetime  datetime64[us]
     3   passenger_count        float64       
     4   trip_distance          float64       
     5   RatecodeID             float64       
     6   store_and_fwd_flag     object        
     7   PULocationID           int32         
     8   DOLocationID           int32         
     9   payment_type           int64         
     10  fare_amount            float64       
     11  extra                  float64       
     12  mta_tax                float64       
     13  tip_amount             float64       
     14  tolls_amount           float64       
     15  improvement_surcharge  float64       
     16  total_amount           float64       
     17  congestion_surcharge   float64       
     18  Airport_fee            float64       
    dtypes: datetime64[us](2), float64(12), int32(3), int64(1), object(1)
    memory usage: 395.8+ MB


### Setup Minio client
Here we setup the local Minio client to connect to the Minio deployments. We will use this to explore the data being saved to Minio, when we save data using the iceberg catalogs. 


```python
!mc config host add minio http://minio:9000 ${AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY}
```

    Configuration written to `/home/iceberg/.mc/config.json`. Please update your access credentials.
    Successfully created `/home/iceberg/.mc/share`.
    Initialized share uploads `/home/iceberg/.mc/share/uploads.json` file.
    Initialized share downloads `/home/iceberg/.mc/share/downloads.json` file.
    Added `minio` successfully.


For now, we can check if the we can check if the bucket `warehouse` exists, which was created by the `mc` container setup in the docker compose file.


```python
!mc ls minio
```

    [2024-09-08 09:46:06 UTC]     0B warehouse/


## Hive Catalog
So first we test out the Hive Catalog, which is basically using the Hive Metastore as the Iceberg catalog. The Dockerfile and the configurations used to setup the Hive metastore can be found in th `hive-metastore` folder and the Docker Compose file in the repo. This Hive Metastore also connecting to the `hive` database in the postgres instance we have setup.

This part is based on the Jupyter notebook: [`01-iceberg-hive.ipynb`](https://github.com/binayakd/exploring-apache-iceberg/blob/main/workspace/01-iceberg-hive.ipynb)


### Importing Required Libraries
We will be importing `SparkSession` for, well, the Spark session. We also import the Postgress driver `psycopg`, Trino connection libraries, and pandas, to explore the data that we will be writing with Spark.

We also set some styling to display tables better.


```python
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
import psycopg
from trino.dbapi import connect
import pandas as pd

# this is to better display pyspark dataframes
from IPython.core.display import HTML
display(HTML("<style>pre { white-space: pre !important; }</style>"))
```

### Setting up Spark Session
We set up Spark Session with the configs required to connect to the Hive Metastore. 

It is a single node local spark sessions, setting the driver and executor memories to 4GB, to provide it sufficient memory to load all of the data.
We are setting up `iceberg` as the iceberg catalog, and setting up all the required configs to connect to the Hive Metastore catalog ([details here](https://iceberg.apache.org/docs/latest/configuration/#catalog-properties)).

To connect to our local instance of Minio, we need to set `s3.endpoint` and `s3.path-style-access` configs, and set our warehouse location to be in the folder `iceberg-hive` under the bucket `warehouse` that was created on startup.


```python
iceberg_catalog_name = "iceberg"
spark = SparkSession.builder \
  .appName("iceberg-hive") \
  .config("spark.driver.memory", "4g") \
  .config("spark.executor.memory", "4g") \
  .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
  .config("spark.jars", "/opt/extra-jars/iceberg-spark-runtime.jar,/opt/extra-jars/iceberg-aws-bundle.jar") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}", "org.apache.iceberg.spark.SparkCatalog") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.type", "hive") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.uri", "thrift://hive-metastore:9083") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.warehouse", "s3://warehouse/iceberg/") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.s3.endpoint", "http://minio:9000") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.s3.path-style-access", "true") \
  .getOrCreate()

```

    24/09/09 15:36:11 WARN NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
    Setting default log level to "WARN".
    To adjust logging level use sc.setLogLevel(newLevel). For SparkR, use setLogLevel(newLevel).


### Loading Test Data
Now we load the 2 parquet files downloaded previously, into the Spark memory.


```python
df_2024_01 = spark.read.parquet("file:///home/iceberg/workspace/downloaded-data/yellow_tripdata_2024-01.parquet")
df_2024_02 = spark.read.parquet("file:///home/iceberg/workspace/downloaded-data/yellow_tripdata_2024-02.parquet")
```

                                                                                
Now we check the data to get an idea of the size, structure and the actual data.


```python
print("file: yellow_tripdata_2024-01.parquet")
print(f"Number of rows: {df_2024_01.count()}")
print("Schema:")
df_2024_01.printSchema()
print("Data:")
df_2024_01.show(5)
```

    file: yellow_tripdata_2024-01.parquet
    Number of rows: 2964624
    Schema:
    root
     |-- VendorID: integer (nullable = true)
     |-- tpep_pickup_datetime: timestamp_ntz (nullable = true)
     |-- tpep_dropoff_datetime: timestamp_ntz (nullable = true)
     |-- passenger_count: long (nullable = true)
     |-- trip_distance: double (nullable = true)
     |-- RatecodeID: long (nullable = true)
     |-- store_and_fwd_flag: string (nullable = true)
     |-- PULocationID: integer (nullable = true)
     |-- DOLocationID: integer (nullable = true)
     |-- payment_type: long (nullable = true)
     |-- fare_amount: double (nullable = true)
     |-- extra: double (nullable = true)
     |-- mta_tax: double (nullable = true)
     |-- tip_amount: double (nullable = true)
     |-- tolls_amount: double (nullable = true)
     |-- improvement_surcharge: double (nullable = true)
     |-- total_amount: double (nullable = true)
     |-- congestion_surcharge: double (nullable = true)
     |-- Airport_fee: double (nullable = true)
    
    Data:
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    |VendorID|tpep_pickup_datetime|tpep_dropoff_datetime|passenger_count|trip_distance|RatecodeID|store_and_fwd_flag|PULocationID|DOLocationID|payment_type|fare_amount|extra|mta_tax|tip_amount|tolls_amount|improvement_surcharge|total_amount|congestion_surcharge|Airport_fee|
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    |       2| 2024-01-01 00:57:55|  2024-01-01 01:17:43|              1|         1.72|         1|                 N|         186|          79|           2|       17.7|  1.0|    0.5|       0.0|         0.0|                  1.0|        22.7|                 2.5|        0.0|
    |       1| 2024-01-01 00:03:00|  2024-01-01 00:09:36|              1|          1.8|         1|                 N|         140|         236|           1|       10.0|  3.5|    0.5|      3.75|         0.0|                  1.0|       18.75|                 2.5|        0.0|
    |       1| 2024-01-01 00:17:06|  2024-01-01 00:35:01|              1|          4.7|         1|                 N|         236|          79|           1|       23.3|  3.5|    0.5|       3.0|         0.0|                  1.0|        31.3|                 2.5|        0.0|
    |       1| 2024-01-01 00:36:38|  2024-01-01 00:44:56|              1|          1.4|         1|                 N|          79|         211|           1|       10.0|  3.5|    0.5|       2.0|         0.0|                  1.0|        17.0|                 2.5|        0.0|
    |       1| 2024-01-01 00:46:51|  2024-01-01 00:52:57|              1|          0.8|         1|                 N|         211|         148|           1|        7.9|  3.5|    0.5|       3.2|         0.0|                  1.0|        16.1|                 2.5|        0.0|
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    only showing top 5 rows
    

```python
print("file: yellow_tripdata_2024-02.parquet")
print(f"Number of rows: {df_2024_02.count()}")
print("Schema:")
df_2024_02.printSchema()
print("Data:")
df_2024_02.show(5)
```

    file: yellow_tripdata_2024-02.parquet
    Number of rows: 3007526
    Schema:
    root
     |-- VendorID: integer (nullable = true)
     |-- tpep_pickup_datetime: timestamp_ntz (nullable = true)
     |-- tpep_dropoff_datetime: timestamp_ntz (nullable = true)
     |-- passenger_count: long (nullable = true)
     |-- trip_distance: double (nullable = true)
     |-- RatecodeID: long (nullable = true)
     |-- store_and_fwd_flag: string (nullable = true)
     |-- PULocationID: integer (nullable = true)
     |-- DOLocationID: integer (nullable = true)
     |-- payment_type: long (nullable = true)
     |-- fare_amount: double (nullable = true)
     |-- extra: double (nullable = true)
     |-- mta_tax: double (nullable = true)
     |-- tip_amount: double (nullable = true)
     |-- tolls_amount: double (nullable = true)
     |-- improvement_surcharge: double (nullable = true)
     |-- total_amount: double (nullable = true)
     |-- congestion_surcharge: double (nullable = true)
     |-- Airport_fee: double (nullable = true)
    
    Data:
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    |VendorID|tpep_pickup_datetime|tpep_dropoff_datetime|passenger_count|trip_distance|RatecodeID|store_and_fwd_flag|PULocationID|DOLocationID|payment_type|fare_amount|extra|mta_tax|tip_amount|tolls_amount|improvement_surcharge|total_amount|congestion_surcharge|Airport_fee|
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    |       2| 2024-02-01 00:04:45|  2024-02-01 00:19:58|              1|         4.39|         1|                 N|          68|         236|           1|       20.5|  1.0|    0.5|      1.28|         0.0|                  1.0|       26.78|                 2.5|        0.0|
    |       2| 2024-02-01 00:56:31|  2024-02-01 01:10:53|              1|         7.71|         1|                 N|          48|         243|           1|       31.0|  1.0|    0.5|       9.0|         0.0|                  1.0|        45.0|                 2.5|        0.0|
    |       2| 2024-02-01 00:07:50|  2024-02-01 00:43:12|              2|        28.69|         2|                 N|         132|         261|           2|       70.0|  0.0|    0.5|       0.0|        6.94|                  1.0|       82.69|                 2.5|       1.75|
    |       1| 2024-02-01 00:01:49|  2024-02-01 00:10:47|              1|          1.1|         1|                 N|         161|         163|           1|        9.3|  3.5|    0.5|      2.85|         0.0|                  1.0|       17.15|                 2.5|        0.0|
    |       1| 2024-02-01 00:37:35|  2024-02-01 00:51:15|              1|          2.6|         1|                 N|         246|          79|           2|       15.6|  3.5|    0.5|       0.0|         0.0|                  1.0|        20.6|                 2.5|        0.0|
    +--------+--------------------+---------------------+---------------+-------------+----------+------------------+------------+------------+------------+-----------+-----+-------+----------+------------+---------------------+------------+--------------------+-----------+
    only showing top 5 rows
    
    24/09/09 15:36:27 WARN GarbageCollectionMetrics: To enable non-built-in garbage collector(s) List(G1 Concurrent GC), users should configure it(them) to spark.eventLog.gcMetrics.youngGenerationGarbageCollectors or spark.eventLog.gcMetrics.oldGenerationGarbageCollectors


Data look good, so now on to actually writing it to our Iceberg catalog.

### Creating Iceberg namespace under the catalog
First, we need to create a new namespace (schema) under the iceberg catalog. Here we create the namespace `hive` under the catalog, and assign a location in Minio.


```python
spark.sql("CREATE NAMESPACE IF NOT EXISTS iceberg.hive LOCATION 's3://warehouse/iceberg/hive'")
```

    DataFrame[]


### Writing the data to Iceberg Table
We want to create this table first, based on 2024-01 data, partitioned by the month. We can get the month from the `tpep_pickup_datetime` column.

```python
df_2024_01.writeTo("iceberg.hive.yellow_tripdata").partitionedBy(
    F.months("tpep_pickup_datetime")
).create()
```

We then check how the data is saved to Minio. 


```python
!mc ls --recursive minio/warehouse/
```

    [2024-09-09 15:36:46 UTC]     0B STANDARD iceberg/hive/
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2002-12/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00003.parquet
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00004.parquet
    [2024-09-09 15:49:23 UTC] 6.3KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2023-12/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00001.parquet
    [2024-09-09 15:49:23 UTC]  44MiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00002.parquet
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00005.parquet
    [2024-09-09 15:49:23 UTC] 3.8KiB STANDARD iceberg/hive/yellow_tripdata/metadata/00000-eb2ed37f-f7f9-4bf5-89c0-572f46d18b36.metadata.json
    [2024-09-09 15:49:23 UTC] 9.0KiB STANDARD iceberg/hive/yellow_tripdata/metadata/f588d9e8-11ba-4a52-928a-2d002b5b42db-m0.avro
    [2024-09-09 15:49:23 UTC] 4.2KiB STANDARD iceberg/hive/yellow_tripdata/metadata/snap-8347670030789304497-1-f588d9e8-11ba-4a52-928a-2d002b5b42db.avro


There something interesting here. We are expecting this file to only have data for the month of 2024-01, but there seems to be some data from some other months. Although looking at the size of the partitions, we can see the expected partition month is the biggest, and the rest of the partitions could have some bad data. 

We also check what metadata has been written to the Hive Metastore's attached database. Using the `psycopg` and `pandas` library, can get the data from specific table that the HIve metastore wrote to.


```python
conn = psycopg.connect("postgresql://postgres:postgres@postgres:5432/hive")
```

The first table is the `DBS` table, which shows that there is a default database with the location pointing to the local file system. This explains why we need to create a new namespace with the location set to our object storage, which is the second row.


```python
pd.read_sql_query('select * from "DBS"', conn)
```

|   | DB_ID | DESC                  | DB_LOCATION_URI             | NAME    | OWNER_NAME | OWNER_TYPE | CTLG_NAME | CREATE_TIME | DB_MANAGED_LOCATION_URI | TYPE   | DATACONNECTOR_NAME | REMOTE_DBNAME |
|---|-------|-----------------------|-----------------------------|---------|------------|------------|-----------|-------------|-------------------------|--------|--------------------|---------------|
| 0 | 1     | Default Hive database | file:/user/hive/warehouse   | default | public     | ROLE       | hive      | 1725788794  | None                    | NATIVE | None               | None          |
| 1 | 2     | None                  | s3://warehouse/iceberg/hive | hive    | iceberg    | USER       | hive      | 1725896204  | None                    | NATIVE | None               | None          |


Next we can look at the `TBLS` table, which shows the record of our recently created Iceberg table.


```python
pd.read_sql_query('select * from "TBLS"', conn)
```

|   | TBL_ID | CREATE_TIME | DB_ID | LAST_ACCESS_TIME | OWNER   | OWNER_TYPE | RETENTION  | SD_ID | TBL_NAME        | TBL_TYPE       | VIEW_EXPANDED_TEXT | VIEW_ORIGINAL_TEXT | IS_REWRITE_ENABLED | WRITE_ID |
|---|--------|-------------|-------|------------------|---------|------------|------------|-------|-----------------|----------------|--------------------|--------------------|--------------------|----------|
| 0 | 1      | 1725896964  | 2     | -679888          | iceberg | USER       | 2147483647 | 1     | yellow_tripdata | EXTERNAL_TABLE | None               | None               | False              | 0        |

Finally we look at the `TABLE_PARAMS` table, which has the more information about the created Iceberg table, such as the table statistics, the current snapshot summary and schema, and the location of the Iceberg table metadata in Minio

```python
pd.read_sql_query('select * from "TABLE_PARAMS"', conn)
```

|    | TBL_ID | PARAM_KEY                       | PARAM_VALUE                                       |
|----|--------|---------------------------------|---------------------------------------------------|
| 0  | 1      | default-partition-spec          | {"spec-id":0,"fields":[{"name":"tpep_pickup_da... |
| 1  | 1      | current-schema                  | {"type":"struct","schema-id":0,"fields":[{"id"... |
| 2  | 1      | uuid                            | c5c14cb9-a698-4d6f-b2d8-a03c1f83953b              |
| 3  | 1      | transient_lastDdlTime           | 1725896964                                        |
| 4  | 1      | write.parquet.compression-codec | zstd                                              |
| 5  | 1      | owner                           | iceberg                                           |
| 6  | 1      | table_type                      | ICEBERG                                           |
| 7  | 1      | numFilesErasureCoded            | 0                                                 |
| 8  | 1      | EXTERNAL                        | TRUE                                              |
| 9  | 1      | numRows                         | 5972150                                           |
| 10 | 1      | numFiles                        | 10                                                |
| 11 | 1      | previous_metadata_location      | s3://warehouse/iceberg/hive/yellow_tripdata/me... |
| 12 | 1      | current-snapshot-id             | 8346019809249799834                               |
| 13 | 1      | totalSize                       | 93238954                                          |
| 14 | 1      | current-snapshot-timestamp-ms   | 1725982446355                                     |
| 15 | 1      | metadata_location               | s3://warehouse/iceberg/hive/yellow_tripdata/me... |
| 16 | 1      | snapshot-count                  | 2                                                 |
| 17 | 1      | current-snapshot-summary        | {"spark.app.id":"local-1725896172891","added-d... |


There are other tables that get updated, but these are the main one. 

### Adding New partition to the table
Now, we will add the file for the month of 2024-02 as a new partition to the table we just created. we can do that by using the `append` option of the write command.

```python
df_2024_02.writeTo("iceberg.hive.yellow_tripdata").append()
```

And we check the data in Minio again, to see if the new partition has been created.

```python
!mc ls --recursive minio/warehouse/
```

    [2024-09-09 15:36:46 UTC]     0m STANDARD iceberg/hive/
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2002-12/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00003.parquet
    [2024-09-10 15:34:06 UTC] 5.3KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2008-12/00000-47-81691b34-dddc-4409-ad0f-982b7862cc59-0-00003.parquet
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00004.parquet
    [2024-09-10 15:34:06 UTC] 5.3KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-47-81691b34-dddc-4409-ad0f-982b7862cc59-0-00004.parquet
    [2024-09-09 15:49:23 UTC] 6.3KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2023-12/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00001.parquet
    [2024-09-09 15:49:23 UTC]  44MiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00002.parquet
    [2024-09-10 15:34:05 UTC] 6.3KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-47-81691b34-dddc-4409-ad0f-982b7862cc59-0-00001.parquet
    [2024-09-09 15:49:23 UTC] 5.9KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-38-67af578d-850f-4bd2-8503-844b0f3192ba-0-00005.parquet
    [2024-09-10 15:34:06 UTC]  44MiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-47-81691b34-dddc-4409-ad0f-982b7862cc59-0-00002.parquet
    [2024-09-10 15:34:06 UTC] 5.8KiB STANDARD iceberg/hive/yellow_tripdata/data/tpep_pickup_datetime_month=2024-03/00000-47-81691b34-dddc-4409-ad0f-982b7862cc59-0-00005.parquet
    [2024-09-09 15:49:23 UTC] 3.8KiB STANDARD iceberg/hive/yellow_tripdata/metadata/00000-eb2ed37f-f7f9-4bf5-89c0-572f46d18b36.metadata.json
    [2024-09-10 15:34:06 UTC] 4.9KiB STANDARD iceberg/hive/yellow_tripdata/metadata/00001-9d6e0414-9de9-45d9-8f4f-1f06255d3369.metadata.json
    [2024-09-10 15:34:06 UTC] 8.9KiB STANDARD iceberg/hive/yellow_tripdata/metadata/e6f7021b-7822-4c96-9e6d-61f4c42c2e44-m0.avro
    [2024-09-09 15:49:23 UTC] 9.0KiB STANDARD iceberg/hive/yellow_tripdata/metadata/f588d9e8-11ba-4a52-928a-2d002b5b42db-m0.avro
    [2024-09-10 15:34:06 UTC] 4.2KiB STANDARD iceberg/hive/yellow_tripdata/metadata/snap-8346019809249799834-1-e6f7021b-7822-4c96-9e6d-61f4c42c2e44.avro iceberg/hive/yellow_tripdata/metadata/snap-8347670030789304497-1-f588d9e8-11ba-4a52-928a-2d002b5b42db.avro


Again we see the expected partition created, and some extra partitions with stray data. We also see an new setup of metadata files being created. 

Querying the snapshots for this table, we can see there are 2, one for the creation of the table, and one for addition of the next partition. 


```python
spark.sql("select * from iceberg.hive.yellow_tripdata.snapshots").show()
```

    +--------------------+-------------------+-------------------+---------+--------------------+--------------------+
    |        committed_at|        snapshot_id|          parent_id|operation|       manifest_list|             summary|
    +--------------------+-------------------+-------------------+---------+--------------------+--------------------+
    |2024-09-09 15:49:...|8347670030789304497|               NULL|   append|s3://warehouse/ic...|{spark.app.id -> ...|
    |2024-09-10 15:34:...|8346019809249799834|8347670030789304497|   append|s3://warehouse/ic...|{spark.app.id -> ...|
    +--------------------+-------------------+-------------------+---------+--------------------+--------------------+
    

We can also run a query to check the stats for all the partitions in the table.


```python
spark.sql("select * from iceberg.hive.yellow_tripdata.partitions").show()
```

    +---------+-------+------------+----------+-----------------------------+----------------------------+--------------------------+----------------------------+--------------------------+--------------------+------------------------+
    |partition|spec_id|record_count|file_count|total_data_file_size_in_bytes|position_delete_record_count|position_delete_file_count|equality_delete_record_count|equality_delete_file_count|     last_updated_at|last_updated_snapshot_id|
    +---------+-------+------------+----------+-----------------------------+----------------------------+--------------------------+----------------------------+--------------------------+--------------------+------------------------+
    |    {648}|      0|     2964617|         2|                     46495595|                           0|                         0|                           0|                         0|2024-09-10 15:34:...|     8346019809249799834|
    |    {649}|      0|     3007514|         2|                     46708043|                           0|                         0|                           0|                         0|2024-09-10 15:34:...|     8346019809249799834|
    |    {647}|      0|          10|         1|                         6418|                           0|                         0|                           0|                         0|2024-09-09 15:49:...|     8347670030789304497|
    |    {650}|      0|           2|         1|                         5908|                           0|                         0|                           0|                         0|2024-09-10 15:34:...|     8346019809249799834|
    |    {395}|      0|           2|         1|                         6043|                           0|                         0|                           0|                         0|2024-09-09 15:49:...|     8347670030789304497|
    |    {468}|      0|           4|         2|                        11514|                           0|                         0|                           0|                         0|2024-09-10 15:34:...|     8346019809249799834|
    |    {467}|      0|           1|         1|                         5433|                           0|                         0|                           0|                         0|2024-09-10 15:34:...|     8346019809249799834|
    +---------+-------+------------+----------+-----------------------------+----------------------------+--------------------------+----------------------------+--------------------------+--------------------+------------------------+
    

### Querying with Trino
To start querying the data with Trino, we first need to configure Trino to connect to the [Hive catalog](https://trino.io/docs/current/object-storage/metastores.html#hive-thrift-metastore) using the following catalog properties (which has already been setup in the Trino configuration folder):

```
connector.name=iceberg
iceberg.catalog.type=hive_metastore
hive.metastore.uri=thrift://hive-metastore:9083
fs.native-s3.enabled=true
s3.endpoint=http://minio:9000
s3.path-style-access=true
s3.aws-access-key=${ENV:AWS_ACCESS_KEY_ID}
s3.aws-secret-key=${ENV:AWS_SECRET_ACCESS_KEY}
s3.region=${ENV:AWS_REGION}
```

We then use the Trino python client, together with pandas to ready the data back. First we setup the connection:

```python
trino_conn = connect(
    host="trino",
    port=8080,
    user="user"
)
```

Then we read the data into a pandas dataframe

```python
pd.read_sql_query('select * from "iceberg-hive".hive.yellow_tripdata limit 10', trino_conn)
```

|   | vendorid | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | ratecodeid | store_and_fwd_flag | pulocationid | dolocationid | payment_type | fare_amount | extra | mta_tax | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | airport_fee |
|---|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|-------|---------|------------|--------------|-----------------------|--------------|----------------------|-------------|
| 0 | 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1               | 1.72          | 1          | N                  | 186          | 79           | 2            | 17.7        | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 22.70        | 2.5                  | 0.00        |
| 1 | 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1               | 1.40          | 1          | N                  | 79           | 211          | 1            | 10.0        | 3.5   | 0.5     | 2.00       | 0.0          | 1.0                   | 17.00        | 2.5                  | 0.00        |
| 2 | 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1               | 0.80          | 1          | N                  | 211          | 148          | 1            | 7.9         | 3.5   | 0.5     | 3.20       | 0.0          | 1.0                   | 16.10        | 2.5                  | 0.00        |
| 3 | 1        | 2024-01-01 00:54:08  | 2024-01-01 01:26:31   | 1               | 4.70          | 1          | N                  | 148          | 141          | 1            | 29.6        | 3.5   | 0.5     | 6.90       | 0.0          | 1.0                   | 41.50        | 2.5                  | 0.00        |
| 4 | 2        | 2024-01-01 00:49:44  | 2024-01-01 01:15:47   | 2               | 10.82         | 1          | N                  | 138          | 181          | 1            | 45.7        | 6.0   | 0.5     | 10.00      | 0.0          | 1.0                   | 64.95        | 0.0                  | 1.75        |
| 5 | 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1               | 1.80          | 1          | N                  | 140          | 236          | 1            | 10.0        | 3.5   | 0.5     | 3.75       | 0.0          | 1.0                   | 18.75        | 2.5                  | 0.00        |
| 6 | 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1               | 4.70          | 1          | N                  | 236          | 79           | 1            | 23.3        | 3.5   | 0.5     | 3.00       | 0.0          | 1.0                   | 31.30        | 2.5                  | 0.00        |
| 7 | 1        | 2024-01-01 00:30:40  | 2024-01-01 00:58:40   | 0               | 3.00          | 1          | N                  | 246          | 231          | 2            | 25.4        | 3.5   | 0.5     | 0.00       | 0.0          | 1.0                   | 30.40        | 2.5                  | 0.00        |
| 8 | 2        | 2024-01-01 00:26:01  | 2024-01-01 00:54:12   | 1               | 5.44          | 1          | N                  | 161          | 261          | 2            | 31.0        | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 36.00        | 2.5                  | 0.00        |
| 9 | 2        | 2024-01-01 00:28:08  | 2024-01-01 00:29:16   | 1               | 0.04          | 1          | N                  | 113          | 113          | 2            | 3.0         | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 8.00         | 2.5                  | 0.00        |


We can also use Trino to query the Iceberg metadata, with a slightly different syntax.

```python
pd.read_sql_query('select * from "iceberg-hive".hive."yellow_tripdata$snapshots"', trino_conn)
```

|   | committed_at                     | snapshot_id         | parent_id    | operation | manifest_list                                     | summary                                           |
|---|----------------------------------|---------------------|--------------|-----------|---------------------------------------------------|---------------------------------------------------|
| 0 | 2024-09-09 15:49:23.822000+00:00 | 8347670030789304497 | NaN          | append    | s3://warehouse/iceberg/hive/yellow_tripdata/me... | {'spark.app.id': 'local-1725896172891', 'chang... |
| 1 | 2024-09-10 15:34:06.355000+00:00 | 8346019809249799834 | 8.347670e+18 | append    | s3://warehouse/iceberg/hive/yellow_tripdata/me... | {'spark.app.id': 'local-1725896172891', 'chang... |


```python
pd.read_sql_query('select * from "iceberg-hive".hive."yellow_tripdata$partitions"', trino_conn)
```
|   | partition                         | record_count | file_count | total_size | data                                              |
|---|-----------------------------------|--------------|------------|------------|---------------------------------------------------|
| 0 | (tpep_pickup_datetime_month: 467) | 1            | 1          | 5433       | (VendorID: (min: 2, max: 2, null_count: 0, nan... |
| 1 | (tpep_pickup_datetime_month: 468) | 4            | 2          | 11514      | (VendorID: (min: 2, max: 2, null_count: 0, nan... |
| 2 | (tpep_pickup_datetime_month: 647) | 10           | 1          | 6418       | (VendorID: (min: 2, max: 2, null_count: 0, nan... |
| 3 | (tpep_pickup_datetime_month: 648) | 2964617      | 2          | 46495595   | (VendorID: (min: 1, max: 6, null_count: 0, nan... |
| 4 | (tpep_pickup_datetime_month: 395) | 2            | 1          | 6043       | (VendorID: (min: 2, max: 2, null_count: 0, nan... |
| 5 | (tpep_pickup_datetime_month: 649) | 3007514      | 2          | 46708043   | (VendorID: (min: 1, max: 2, null_count: 0, nan... |
| 6 | (tpep_pickup_datetime_month: 650) | 2            | 1          | 5908       | (VendorID: (min: 2, max: 2, null_count: 0, nan... |


## JDBC/SQL Catalog
Now we are setting up and testing the JDBC/SQL Catalog. Here we only need the postgres instance that we have already setup, and have used with our Hive Metastore. Just that we are connecting to a separate `iceberg` database in that instance.

This part is based on the Jupyter notebook: [`02-iceberg-jdbc.ipynb`](https://github.com/binayakd/exploring-apache-iceberg/blob/main/workspace/02-iceberg-jdbc.ipynb)

### Importing Required Libraries
As before we will be importing `SparkSession` for, well, the Spark session, and the Postgress driver `psycopg`, Trino connection libraries, and pandas, to explore the data that we will be writing with Spark.


```python
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
import psycopg
from trino.dbapi import connect
import pandas as pd

# this is to better display pyspark and pandas dataframes
from IPython.core.display import HTML
display(HTML("<style>pre { white-space: pre !important; }</style>"))

pd.set_option('display.max_colwidth', None)
```

### Setting up Spark Session

We now setup the Spark session with the configs required to connect to the postgres database, to act as the catalog. This involves adding the postgres JDBC driver that we installed in the docker image in the location `/opt/extra-jars/postgresql.jar` to be added to the `spark.jars` config, in addition to the already added Iceberg related jars. We also have all the needed JDBC connection configs ([details here](https://iceberg.apache.org/docs/1.5.0/jdbc/)) under the catalog `iceberg`. This name will become important as we will see later.

Again, to connect to our local instance of Minio, we need to set `s3.endpoint` and `s3.path-style-access` configs, and set our warehouse location to be in the folder `iceberg` under the bucket `warehouse` that was created on startup.


```python
iceberg_catalog_name = "iceberg"
spark = SparkSession.builder \
  .appName("iceberg-jdbc") \
  .config("spark.driver.memory", "4g") \
  .config("spark.executor.memory", "4g") \
  .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
  .config("spark.jars", "/opt/extra-jars/iceberg-spark-runtime.jar,/opt/extra-jars/iceberg-aws-bundle.jar,/opt/extra-jars/postgresql.jar") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}", "org.apache.iceberg.spark.SparkCatalog") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.type", "jdbc") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.uri", "jdbc:postgresql://postgres:5432/iceberg") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.jdbc.user", "postgres") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.jdbc.password", "postgres") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.warehouse", "s3://warehouse/iceberg/") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.s3.endpoint", "http://minio:9000") \
  .config(f"spark.sql.catalog.{iceberg_catalog_name}.s3.path-style-access", "true") \
  .getOrCreate()
```

### Loading Test Data
Now we load the 2 parquet files downloaded previously, into the Spark memory.

```python
df_2024_01 = spark.read.parquet("file:///home/iceberg/workspace/downloaded-data/yellow_tripdata_2024-01.parquet")
df_2024_02 = spark.read.parquet("file:///home/iceberg/workspace/downloaded-data/yellow_tripdata_2024-02.parquet")
```

### Creating namespace under the catalog
Now we created the namespace`jdbc`. We won't set any location, as we have already set a default warehouse location for this catalog when creating the Spark session. So it should create a folder under that.

```python
spark.sql("CREATE NAMESPACE IF NOT EXISTS iceberg.jdbc")
```

### Writing the data to Iceberg Table
Again as before, we crate the table first, based on 2024-01 data, partitioned by the month, deriving it from the `tpep_pickup_datetime` column.

```python
df_2024_01.writeTo("iceberg.jdbc.yellow_tripdata").partitionedBy(
    F.months("tpep_pickup_datetime")
).create()
```

Checking the data saved to Minio, where we expect it to be, under `iceberg/jdbc`.

```python
!mc ls --recursive minio/warehouse/iceberg/jdbc
```

    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2002-12/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00003.parquet
    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00004.parquet
    [2024-09-11 16:10:05 UTC] 6.3KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2023-12/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00001.parquet
    [2024-09-11 16:10:05 UTC]  44MiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00002.parquet
    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00005.parquet
    [2024-09-11 16:10:06 UTC] 3.8KiB STANDARD yellow_tripdata/metadata/00000-fdb3dbc7-7f1c-419f-8062-f592a05e7e98.metadata.json
    [2024-09-11 16:10:06 UTC] 9.0KiB STANDARD yellow_tripdata/metadata/fe6f97c1-805d-46b3-b83a-80a882c19029-m0.avro
    [2024-09-11 16:10:06 UTC] 4.1KiB STANDARD yellow_tripdata/metadata/snap-4307659518017302486-1-fe6f97c1-805d-46b3-b83a-80a882c19029.avro

And, as expected, we do see the same data in partitions, and the metadata file. 

Now we also check what metadata has been written database. Using the `psycopg` and `pandas` library, can get the data from specific tables in the Postgres database.

```python
conn = psycopg.connect("postgresql://postgres:postgres@postgres:5432/iceberg")
```

There are actually only 2 tables that were created and written to: `iceberg_namespace_properties` and `iceberg_tables`. First we check the `iceberg_namespace_properties` table.

```python
pd.read_sql_query('select * from iceberg_namespace_properties', conn)
```
|   | catalog_name | namespace | property_key | property_value |
|---|--------------|-----------|--------------|----------------|
| 0 | iceberg      | jdbc      | owner        | iceberg        |
| 1 | iceberg      | jdbc      | exists       | true           |

We see 2 properties for the `iceberg` catalog and `jdbc` namespace. The name `iceberg` is gotten from the catalog name we set when creating the Spark session. 

Now we check the table `iceberg_tables`

```python
pd.read_sql_query('select * from iceberg_tables', conn)
```
|   | catalog_name | table_namespace | table_name      | metadata_location                                 | previous_metadata_location | iceberg_type |
|---|--------------|-----------------|-----------------|---------------------------------------------------|----------------------------|--------------|
| 0 | iceberg      | jdbc            | yellow_tripdata | s3://warehouse/iceberg/jdbc/yellow_tripdata/me... | None                       | TABLE        |


Here we see a single entry, giving information about the metadata file location in Minio, for the table we just created. Compared to the information in the Hive catalog, this is a lot more bare bone, acting more like a pointer to the actual location of the metadata.

### Adding New partition to the table
Now, as before, we will add the file for the month of 2024-02 as a new partition to the table.

```python
df_2024_02.writeTo("iceberg.jdbc.yellow_tripdata").append()
```

Checking on the data in Minio, we see the new partitions, and metadata files.

```python
!mc ls --recursive minio/warehouse/iceberg/jdbc
```

    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2002-12/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00003.parquet
    [2024-09-13 16:02:22 UTC] 5.3KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2008-12/00000-10-193c7271-9ebc-4616-a74d-dd220caf32a5-0-00003.parquet
    [2024-09-13 16:02:22 UTC] 5.3KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-10-193c7271-9ebc-4616-a74d-dd220caf32a5-0-00004.parquet
    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2009-01/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00004.parquet
    [2024-09-11 16:10:05 UTC] 6.3KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2023-12/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00001.parquet
    [2024-09-13 16:02:21 UTC] 6.3KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-10-193c7271-9ebc-4616-a74d-dd220caf32a5-0-00001.parquet
    [2024-09-11 16:10:05 UTC]  44MiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00002.parquet
    [2024-09-13 16:02:22 UTC]  44MiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-10-193c7271-9ebc-4616-a74d-dd220caf32a5-0-00002.parquet
    [2024-09-11 16:10:05 UTC] 5.9KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-02/00000-10-c34f04bf-cde6-4327-a36b-fc50f8b957b9-0-00005.parquet
    [2024-09-13 16:02:22 UTC] 5.8KiB STANDARD yellow_tripdata/data/tpep_pickup_datetime_month=2024-03/00000-10-193c7271-9ebc-4616-a74d-dd220caf32a5-0-00005.parquet
    [2024-09-11 16:10:06 UTC] 3.8KiB STANDARD yellow_tripdata/metadata/00000-fdb3dbc7-7f1c-419f-8062-f592a05e7e98.metadata.json
    [2024-09-13 16:02:23 UTC] 4.9KiB STANDARD yellow_tripdata/metadata/00001-983875cf-5160-4cfe-a73e-f8d34495bb74.metadata.json
    [2024-09-13 16:02:23 UTC] 8.9KiB STANDARD yellow_tripdata/metadata/23ab986b-8d26-4cf7-8908-266922ec7e65-m0.avro
    [2024-09-11 16:10:06 UTC] 9.0KiB STANDARD yellow_tripdata/metadata/fe6f97c1-805d-46b3-b83a-80a882c19029-m0.avro
    [2024-09-13 16:02:23 UTC] 4.2KiB STANDARD yellow_tripdata/metadata/snap-2752971245912516800-1-23ab986b-8d26-4cf7-8908-266922ec7e65.avro
    [2024-09-11 16:10:06 UTC] 4.1KiB STANDARD yellow_tripdata/metadata/snap-4307659518017302486-1-fe6f97c1-805d-46b3-b83a-80a882c19029.avro

As before, we see the expected partition created, and some extra partitions with stray data. We also see an new setup of metadata files being created.

Checking the `iceberg_table` table in postgres, we see the `metadata_location` is updated to point to the new json file, and the  `previous_metadata_location` has been set.

```python
pd.read_sql_query('select * from iceberg_tables', conn)
```

|   | catalog_name | table_namespace | table_name      | metadata_location                                                                                             | previous_metadata_location                                                                                    | iceberg_type |
|---|--------------|-----------------|-----------------|---------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|--------------|
| 0 | iceberg      | jdbc            | yellow_tripdata | s3://warehouse/iceberg/jdbc/yellow_tripdata/metadata/00001-983875cf-5160-4cfe-a73e-f8d34495bb74.metadata.json | s3://warehouse/iceberg/jdbc/yellow_tripdata/metadata/00000-fdb3dbc7-7f1c-419f-8062-f592a05e7e98.metadata.json | TABLE        |

### Querying with Trino
The configurations required to enable Trino queryring would be the [JDBC Catalog configs](https://trino.io/docs/current/object-storage/metastores.html#iceberg-jdbc-catalog), which have been setup in our Trino deployment:

```
connector.name=iceberg
iceberg.catalog.type=jdbc
iceberg.jdbc-catalog.catalog-name=iceberg
iceberg.jdbc-catalog.driver-class=org.postgresql.Driver
iceberg.jdbc-catalog.connection-url=jdbc:postgresql://postgres:5432/iceberg
iceberg.jdbc-catalog.connection-user=postgres
iceberg.jdbc-catalog.connection-password=postgres
iceberg.jdbc-catalog.default-warehouse-dir=s3://warehouse/iceberg-jdbc/
fs.native-s3.enabled=true
s3.endpoint=http://minio:9000
s3.path-style-access=true
s3.aws-access-key=${ENV:AWS_ACCESS_KEY_ID}
s3.aws-secret-key=${ENV:AWS_SECRET_ACCESS_KEY}
s3.region=${ENV:AWS_REGION}
```

As before, we setup the Trino python client and run the queries, and load them into a pandas dataframe.

```python
trino_conn = connect(
    host="trino",
    port=8080,
    user="user"
)
```

```python
pd.read_sql_query('select * from "iceberg-jdbc".jdbc.yellow_tripdata limit 10', trino_conn)
```
|   | vendorid | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | ratecodeid | store_and_fwd_flag | pulocationid | dolocationid | payment_type | fare_amount | extra | mta_tax | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | airport_fee |
|---|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|-------|---------|------------|--------------|-----------------------|--------------|----------------------|-------------|
| 0 | 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1               | 1.72          | 1          | N                  | 186          | 79           | 2            | 17.7        | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 22.70        | 2.5                  | 0.00        |
| 1 | 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1               | 1.80          | 1          | N                  | 140          | 236          | 1            | 10.0        | 3.5   | 0.5     | 3.75       | 0.0          | 1.0                   | 18.75        | 2.5                  | 0.00        |
| 2 | 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1               | 4.70          | 1          | N                  | 236          | 79           | 1            | 23.3        | 3.5   | 0.5     | 3.00       | 0.0          | 1.0                   | 31.30        | 2.5                  | 0.00        |
| 3 | 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1               | 1.40          | 1          | N                  | 79           | 211          | 1            | 10.0        | 3.5   | 0.5     | 2.00       | 0.0          | 1.0                   | 17.00        | 2.5                  | 0.00        |
| 4 | 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1               | 0.80          | 1          | N                  | 211          | 148          | 1            | 7.9         | 3.5   | 0.5     | 3.20       | 0.0          | 1.0                   | 16.10        | 2.5                  | 0.00        |
| 5 | 1        | 2024-01-01 00:54:08  | 2024-01-01 01:26:31   | 1               | 4.70          | 1          | N                  | 148          | 141          | 1            | 29.6        | 3.5   | 0.5     | 6.90       | 0.0          | 1.0                   | 41.50        | 2.5                  | 0.00        |
| 6 | 2        | 2024-01-01 00:49:44  | 2024-01-01 01:15:47   | 2               | 10.82         | 1          | N                  | 138          | 181          | 1            | 45.7        | 6.0   | 0.5     | 10.00      | 0.0          | 1.0                   | 64.95        | 0.0                  | 1.75        |
| 7 | 1        | 2024-01-01 00:30:40  | 2024-01-01 00:58:40   | 0               | 3.00          | 1          | N                  | 246          | 231          | 2            | 25.4        | 3.5   | 0.5     | 0.00       | 0.0          | 1.0                   | 30.40        | 2.5                  | 0.00        |
| 8 | 2        | 2024-01-01 00:26:01  | 2024-01-01 00:54:12   | 1               | 5.44          | 1          | N                  | 161          | 261          | 2            | 31.0        | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 36.00        | 2.5                  | 0.00        |
| 9 | 2        | 2024-01-01 00:28:08  | 2024-01-01 00:29:16   | 1               | 0.04          | 1          | N                  | 113          | 113          | 2            | 3.0         | 1.0   | 0.5     | 0.00       | 0.0          | 1.0                   | 8.00         | 2.5                  | 0.00        |

And as with the Hive Catalog, we can also query the Iceberg metadata (snapshots and partitions)

```python
pd.set_option('display.max_colwidth', 100)
pd.read_sql_query('select * from "iceberg-jdbc".jdbc."yellow_tripdata$snapshots"', trino_conn)
```

|   | committed_at                     | snapshot_id         | parent_id    | operation | manifest_list                                                                                       | summary                                                                                             |
|---|----------------------------------|---------------------|--------------|-----------|-----------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| 0 | 2024-09-11 16:10:06.293000+00:00 | 4307659518017302486 | NaN          | append    | s3://warehouse/iceberg/jdbc/yellow_tripdata/metadata/snap-4307659518017302486-1-fe6f97c1-805d-46... | {'spark.app.id': 'local-1726070250816', 'changed-partition-count': '5', 'added-data-files': '5',... |
| 1 | 2024-09-13 16:02:23.872000+00:00 | 2752971245912516800 | 4.307660e+18 | append    | s3://warehouse/iceberg/jdbc/yellow_tripdata/metadata/snap-2752971245912516800-1-23ab986b-8d26-4c... | {'spark.app.id': 'local-1726241458394', 'changed-partition-count': '5', 'added-data-files': '5',... |


```python
pd.read_sql_query('select * from "iceberg-jdbc".jdbc."yellow_tripdata$partitions"', trino_conn)
```

|   | partition                         | record_count | file_count | total_size | data                                                                                                |
|---|-----------------------------------|--------------|------------|------------|-----------------------------------------------------------------------------------------------------|
| 0 | (tpep_pickup_datetime_month: 467) | 1            | 1          | 5433       | (VendorID: (min: 2, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 1 | (tpep_pickup_datetime_month: 468) | 4            | 2          | 11514      | (VendorID: (min: 2, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 2 | (tpep_pickup_datetime_month: 647) | 10           | 1          | 6418       | (VendorID: (min: 2, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 3 | (tpep_pickup_datetime_month: 648) | 2964617      | 2          | 46495595   | (VendorID: (min: 1, max: 6, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 4 | (tpep_pickup_datetime_month: 395) | 2            | 1          | 6043       | (VendorID: (min: 2, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 5 | (tpep_pickup_datetime_month: 649) | 3007514      | 2          | 46708043   | (VendorID: (min: 1, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
| 6 | (tpep_pickup_datetime_month: 650) | 2            | 1          | 5908       | (VendorID: (min: 2, max: 2, null_count: 0, nan_count: None), tpep_pickup_datetime: (min: datetim... |
