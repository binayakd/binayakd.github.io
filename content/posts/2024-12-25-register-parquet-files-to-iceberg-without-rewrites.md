---
title: Registering Parquet Files Into Iceberg Tables Without Rewrites Using Pyiceberg
date: 2024-12-25
---

## Introduction

In my [last post](https://binayakd.tech/posts/2024-08-30-exploring-iceberg/), I explored the fundamentals of how to create Apache Iceberg tables, using various catalogs, and how to use Spark and Trino to write and read data into and from these Iceberg tables. That involved using Spark as the the Iceberg client to write data into Iceberg table. 

However, in the case that data is already in object storage, following this process to create Iceberg tables, would involve a full migration (read, write, delete) of the data, which can prove time consuming and costly for large datasets. 

What we need is a workflow similar to [Hive's External tables](https://cwiki.apache.org/confluence/display/Hive/Managed+vs.+External+Tables), where writing and updating of the data is managed by an external process (or managed by a preexisting pipeline), and the Iceberg tables is the metadata layer, allowing querying of the data. 

This very problem has been addressed before in [this article](https://medium.com/inquery-data/registering-s3-files-into-apache-iceberg-tables-without-the-rewrites-3c087cb01658). However, that article used the Iceberg Java APIs, and is over one year old as of writing this, and proved to be somewhat cumbersome. 

Fortunately Pyiceberg, has come to the rescue to provide a more straightforward way to achieve this. Specifically, we can use the [`add_files`](https://py.iceberg.apache.org/api/#add-fields) method to register parquet files to a Iceberg table without rewrites. 

In this post, I will be essentially be following the Pyiceberg [Getting started tutorial](https://py.iceberg.apache.org/) with the difference being, I will being using Minio as the object storage, and using the `add_files` function, instead of appending (writing) the data.

For this we need to setup Minio, and and Postgres as the backend for the Iceberg SQL catalog, which we can conveniently setup using a Docker compose file (found in this repo). You can of courses also just use files in local file system, and SQLite backed catalog, but that does not properly show the benefits of this workflow, which is to be able to migrate existing data in object storage to Iceberg format, without doing expensive rewrites. 

All the code and configuration needed to follow along can be found [here](https://github.com/binayakd/pyiceberg-file-registration).

## Prerequisites

To work though this Notebook demo, you would need the following installed:

1. Docker/Podman Compose
2. Python 3.12 or higher
3. uv Python project manager (optional)
2. Minio client (optional)

There is a docker compose file in this repo, that will start the Postgres and Minio instances, and also run an Minio client container to create the `warehouse` bucket in the Minio instance. Here I will be using Podman:
```bash
podman compose up
```

The actual data for Minio and Postgres will be stored in the `local-data` folder, in the respective folders.

Python 3.12 and uv package manage was used for this demo. So the dependencies are setup in the `pyproject.toml` and `uv.lock` file. To get started using uv, first create the python virtual environment and install the required dependencies (has to be run outside this notebook):

```bash
uv sync
```
Then start the Jupyter Lab server using this virtual environment:

```bash
uv run --with jupyter jupyter lab
```

## Test Data Setup
We will be using the classic NYC Taxi datasets for these tests. So we download the set for January 2024, save it to our local filesystem, in the test-data folder.


```python
!curl https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet -o ./local-data/test-data/yellow_tripdata_2024-01.parquet
```

      % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                     Dload  Upload   Total   Spent    Left  Speed
    100 47.6M  100 47.6M    0     0  4217k      0  0:00:11  0:00:11 --:--:-- 5225k


Then we will simulate a data generation process, such as ELT pipeline to upload our Minio instance. In this demo, we also need to do some modifications to the raw data, for the the `add_files` functions to work. We will use Polars to do this here, but we can just as easily be using something like Spark or Pandas. 

First read the file from local file system into a polars dataframe:

```python
import polars as pl
pl.Config.set_fmt_str_lengths(900)
pl.Config.set_tbl_width_chars(900)

df = pl.read_parquet("./local-data/test-data/yellow_tripdata_2024-01.parquet")
```

We now need to convert downcast the nanosecond timestamp columns into microsecond, as PyIceberg only supports down to microseconds. There is a mechanism for PyIceberg to help us to do the casting automatically using a [configurations or environment variable](https://py.iceberg.apache.org/configuration/#nanoseconds-support), however this only works if we are writing to the Iceberg table directly, instead of adding existing files. 

Thus this has to be done manually. We first check which columns need casting by getting the schema:

```python
df.schema
```

    Schema([('VendorID', Int32),
            ('tpep_pickup_datetime', Datetime(time_unit='ns', time_zone=None)),
            ('tpep_dropoff_datetime', Datetime(time_unit='ns', time_zone=None)),
            ('passenger_count', Int64),
            ('trip_distance', Float64),
            ('RatecodeID', Int64),
            ('store_and_fwd_flag', String),
            ('PULocationID', Int32),
            ('DOLocationID', Int32),
            ('payment_type', Int64),
            ('fare_amount', Float64),
            ('extra', Float64),
            ('mta_tax', Float64),
            ('tip_amount', Float64),
            ('tolls_amount', Float64),
            ('improvement_surcharge', Float64),
            ('total_amount', Float64),
            ('congestion_surcharge', Float64),
            ('Airport_fee', Float64)])


From here we see that columns `tpep_pickup_datetime` and `tpep_dropoff_datetime` are of type `Datatime` with time unit "ns". So those are what needs to be casted.


```python
df = df.with_columns(pl.col("tpep_pickup_datetime").dt.cast_time_unit("ms"))
df = df.with_columns(pl.col("tpep_dropoff_datetime").dt.cast_time_unit("ms"))
```

We check the schema again:


```python
df.schema
```

    Schema([('VendorID', Int32),
            ('tpep_pickup_datetime', Datetime(time_unit='ms', time_zone=None)),
            ('tpep_dropoff_datetime', Datetime(time_unit='ms', time_zone=None)),
            ('passenger_count', Int64),
            ('trip_distance', Float64),
            ('RatecodeID', Int64),
            ('store_and_fwd_flag', String),
            ('PULocationID', Int32),
            ('DOLocationID', Int32),
            ('payment_type', Int64),
            ('fare_amount', Float64),
            ('extra', Float64),
            ('mta_tax', Float64),
            ('tip_amount', Float64),
            ('tolls_amount', Float64),
            ('improvement_surcharge', Float64),
            ('total_amount', Float64),
            ('congestion_surcharge', Float64),
            ('Airport_fee', Float64)])



There is one more update we need to do to the data. In my [previous post](https://binayakd.tech/posts/2024-08-30-exploring-iceberg/#writing-the-data-to-iceberg-table), we found out that although this file is marked for 2024-01, it actually has some stray data from some other months. We need to remove those extra month's data, as this will cause issues when we try to add this file to the Iceberg table partitioned by month. 

This is because, since adding files does not modify the actual files, the process will not be able to split the files into the different partitioned parquet files, and also can't add a single file to multiple partitions.

So we can use polars to do this filtering:


```python
df = df.filter(
    (pl.col("tpep_pickup_datetime").dt.year() == 2024) & (pl.col("tpep_pickup_datetime").dt.month() == 1)
)
```

And we check if the filtering worked:


```python
(df
 .with_columns(pl.col("tpep_pickup_datetime").dt.year().alias("year"))
 .with_columns(pl.col("tpep_pickup_datetime").dt.month().alias("month"))
 .unique(subset=["year", "month"])
 .select(['year', 'month'])
)
```
`shape: (1, 2)`

| year | month |
|------|-------|
| i32  | i8    |
| 2024 | 1     |


We can now write it into Minio. For that, we first setup the storage options for Minio:


```python
import s3fs

conn_data = { 
    'key': 'admin', 
    'secret': 'password', 
    'client_kwargs': { 
        'endpoint_url': 'http://localhost:9000' 
        }
}
s3_fs = s3fs.S3FileSystem(**conn_data)

```

And finally write it to our desired bucket and location, with statistics enabled:


```python
s3_path = "s3://warehouse/data/yellow_tripdata_2024-01.parquet"

with s3_fs.open(s3_path, "wb") as f:
    df.write_parquet(f, statistics=True)
```

## Creating an SQL Catalog
As mentioned, we will be creating an SQL catalog, using the Postgres instance as the DB backend. We also include the Minio connection details for the Warehouse location. This should correspond to the object storage instance that contains the preexisting files we want to add to the Iceberg tables.


```python
from pyiceberg.catalog.sql import SqlCatalog

catalog = SqlCatalog(
    "default",
    **{
        "uri": "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres",
        "warehouse": "s3://warehouse/iceberg",
        "s3.endpoint": "http://localhost:9000",
        "s3.access-key-id": "admin",
        "s3.secret-access-key": "password"
    }
)
```

## Creating the Iceberg Table

Now that we have our catalog setup, we need to first create the table, with a defined schema. 
This schema can be gotten from the Parquet file directly, using PyArrow. 

First we create a filesystem object to let Pyarrow know how to connect to Minio:

```python
import pyarrow.parquet as pq
from pyarrow import fs


minio = fs.S3FileSystem(
    endpoint_override='localhost:9000',
    access_key="admin",
    secret_key="password",
    scheme="http"
)

```

Then we read the file as a PyArrow table from the specific bucket and path, and the Minio filesystem:

```python
df = pq.read_table(
    "warehouse/data/yellow_tripdata_2024-01.parquet",
    filesystem=minio
)
```

We can check what the schema actually looks like, to ensure its matches to what we wrote before:

```python
df.schema
```

    VendorID: int32
    tpep_pickup_datetime: timestamp[ms]
    tpep_dropoff_datetime: timestamp[ms]
    passenger_count: int64
    trip_distance: double
    RatecodeID: int64
    store_and_fwd_flag: large_string
    PULocationID: int32
    DOLocationID: int32
    payment_type: int64
    fare_amount: double
    extra: double
    mta_tax: double
    tip_amount: double
    tolls_amount: double
    improvement_surcharge: double
    total_amount: double
    congestion_surcharge: double
    Airport_fee: double



We now have enough setup to create the namespace and table.

Creating the namespace:


```python
catalog.create_namespace("nyc_taxi_data")
```

And then the table:


```python
table = catalog.create_table(
    "nyc_taxi_data.yellow_tripdata",
    schema=df.schema
)
```

Now we add the partition field (column) by using `MonthTransform` on the `tpep_pickup_datetime` column, to have the data partitioned by month.


```python
from pyiceberg.transforms import MonthTransform

with table.update_spec() as update_spec:
    update_spec.add_field(
        source_column_name="tpep_pickup_datetime",
        transform=MonthTransform(),
        partition_field_name="tpep_pickup_datetime_month"
    )


```

## Adding Parquet File to Table

Now that we have created the table, with the partition fields, we can finally add the parquet file to the table. First we reload the table reference by the table name, just in case we need to re-run this, as `create_table` method cannot be run multiple time.


```python
table = catalog.load_table("nyc_taxi_data.yellow_tripdata")
```

Now we use the `add_files` method to add the file. Since this method takes in a list, we have to setup the list with our one file:


```python
table.add_files(["s3://warehouse/data/yellow_tripdata_2024-01.parquet"])
```

Now we can try and query it back using polars:

```python
df = pl.scan_iceberg(table).collect()
df
```
`shape: (2_964_606, 19)`
| VendorID | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | RatecodeID | store_and_fwd_flag | PULocationID | DOLocationID | payment_type | fare_amount | extra    | mta_tax  | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | Airport_fee |
|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|----------|----------|------------|--------------|-----------------------|--------------|----------------------|-------------|
| i32      | datetime[μs]         | datetime[μs]          | i64             | f64           | i64        | str                | i32          | i32          | i64          | f64         | f64      | f64      | f64        | f64          | f64                   | f64          | f64                  | f64         |
| 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1               | 1.72          | 1          | &quot;N&quot;      | 186          | 79           | 2            | 17.7        | 1.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 22.7         | 2.5                  | 0.0         |
| 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1               | 1.8           | 1          | &quot;N&quot;      | 140          | 236          | 1            | 10.0        | 3.5      | 0.5      | 3.75       | 0.0          | 1.0                   | 18.75        | 2.5                  | 0.0         |
| 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1               | 4.7           | 1          | &quot;N&quot;      | 236          | 79           | 1            | 23.3        | 3.5      | 0.5      | 3.0        | 0.0          | 1.0                   | 31.3         | 2.5                  | 0.0         |
| 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1               | 1.4           | 1          | &quot;N&quot;      | 79           | 211          | 1            | 10.0        | 3.5      | 0.5      | 2.0        | 0.0          | 1.0                   | 17.0         | 2.5                  | 0.0         |
| 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1               | 0.8           | 1          | &quot;N&quot;      | 211          | 148          | 1            | 7.9         | 3.5      | 0.5      | 3.2        | 0.0          | 1.0                   | 16.1         | 2.5                  | 0.0         |
| &hellip; | &hellip;             | &hellip;              | &hellip;        | &hellip;      | &hellip;   | &hellip;           | &hellip;     | &hellip;     | &hellip;     | &hellip;    | &hellip; | &hellip; | &hellip;   | &hellip;     | &hellip;              | &hellip;     | &hellip;             | &hellip;    |
| 2        | 2024-01-31 23:45:59  | 2024-01-31 23:54:36   | null            | 3.18          | null       | null               | 107          | 263          | 0            | 15.77       | 0.0      | 0.5      | 2.0        | 0.0          | 1.0                   | 21.77        | null                 | null        |
| 1        | 2024-01-31 23:13:07  | 2024-01-31 23:27:52   | null            | 4.0           | null       | null               | 114          | 236          | 0            | 18.4        | 1.0      | 0.5      | 2.34       | 0.0          | 1.0                   | 25.74        | null                 | null        |
| 2        | 2024-01-31 23:19:00  | 2024-01-31 23:38:00   | null            | 3.33          | null       | null               | 211          | 25           | 0            | 19.97       | 0.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 23.97        | null                 | null        |
| 2        | 2024-01-31 23:07:23  | 2024-01-31 23:25:14   | null            | 3.06          | null       | null               | 107          | 13           | 0            | 23.88       | 0.0      | 0.5      | 5.58       | 0.0          | 1.0                   | 33.46        | null                 | null        |
| 1        | 2024-01-31 23:58:25  | 2024-02-01 00:13:30   | null            | 8.1           | null       | null               | 138          | 75           | 0            | 32.4        | 7.75     | 0.5      | 7.29       | 6.94         | 1.0                   | 55.88        | null                 | null        |




Taking a look at the data in Minio, we can see 3 metadata log entries being created, the first for creating the table, the second for adding the partition filed, and the third for actually using `add_files` to append the data files to the table.

```python
pl.from_arrow(table.inspect.metadata_log_entries())
```
`shape: (3, 5)`

| timestamp               | file                                                                                                                                  | latest_snapshot_id  | latest_schema_id | latest_sequence_number |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------|---------------------|------------------|------------------------|
| datetime[ms]            | str                                                                                                                                   | i64                 | i32              | i64                    |
| 2024-12-19 05:48:20.761 | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/00000-8ee1e9ab-902e-426d-aa60-e7cf1a5a40ed.metadata.json&quot; | null                | null             | null                   |
| 2024-12-19 05:48:24.354 | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/00001-c79b1499-524e-4cea-b46a-fb793ab14b78.metadata.json&quot; | null                | null             | null                   |
| 2024-12-19 05:48:35.092 | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/00002-02dfa0f2-6d50-4275-85b3-5fa601ba6d37.metadata.json&quot; | 1266899188045554572 | 0                | 1                      |


Taking a look at the snapshots, we see the one created when the `add_files` operation is performed.


```python
pl.from_arrow(table.inspect.snapshots())
```

`shape: (1, 6)`
| committed_at            | snapshot_id         | parent_id | operation          | manifest_list                                                                                                                                     | summary                                                                                                                                                   |
|-------------------------|---------------------|-----------|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| datetime[ms]            | i64                 | i64       | str                | str                                                                                                                                               | list[struct[2]]                                                                                                                                           |
| 2024-12-19 05:48:35.092 | 1266899188045554572 | null      | &quot;append&quot; | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/snap-1266899188045554572-0-f40953b3-d76b-490e-8e14-3341ef82477c.avro&quot; | [{&quot;added-files-size&quot;,&quot;55387088&quot;}, {&quot;added-data-files&quot;,&quot;1&quot;}, … {&quot;total-equality-deletes&quot;,&quot;0&quot;}] |

Taking a look at the list of files for this table, we can see the file we added is listed, from the path we wrote directly, with no rewrites.

```python
pl.from_arrow(table.inspect.files()).select("file_path")
```

`shape: (1, 1)`

| file_path                                                       |
|-----------------------------------------------------------------|
| str                                                             |
| &quot;s3://warehouse/data/yellow_tripdata_2024-01.parquet&quot; |



Now lets what happens if we do try to update the existing data though Iceberg. Following the PyIceberg ["Getting Started"](https://py.iceberg.apache.org/) tutorial, we compute and tip-per-mile. First we use polars to compute this column:


```python
df = df.with_columns(
    (pl.col("tip_amount")/pl.col("trip_distance")).alias("tip_per_mile")
)
df
```
`shape: (2_964_606, 20)`

| VendorID | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | RatecodeID | store_and_fwd_flag | PULocationID | DOLocationID | payment_type | fare_amount | extra    | mta_tax  | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | Airport_fee | tip_per_mile |
|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|----------|----------|------------|--------------|-----------------------|--------------|----------------------|-------------|--------------|
| i32      | datetime[μs]         | datetime[μs]          | i64             | f64           | i64        | str                | i32          | i32          | i64          | f64         | f64      | f64      | f64        | f64          | f64                   | f64          | f64                  | f64         | f64          |
| 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1               | 1.72          | 1          | &quot;N&quot;      | 186          | 79           | 2            | 17.7        | 1.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 22.7         | 2.5                  | 0.0         | 0.0          |
| 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1               | 1.8           | 1          | &quot;N&quot;      | 140          | 236          | 1            | 10.0        | 3.5      | 0.5      | 3.75       | 0.0          | 1.0                   | 18.75        | 2.5                  | 0.0         | 2.083333     |
| 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1               | 4.7           | 1          | &quot;N&quot;      | 236          | 79           | 1            | 23.3        | 3.5      | 0.5      | 3.0        | 0.0          | 1.0                   | 31.3         | 2.5                  | 0.0         | 0.638298     |
| 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1               | 1.4           | 1          | &quot;N&quot;      | 79           | 211          | 1            | 10.0        | 3.5      | 0.5      | 2.0        | 0.0          | 1.0                   | 17.0         | 2.5                  | 0.0         | 1.428571     |
| 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1               | 0.8           | 1          | &quot;N&quot;      | 211          | 148          | 1            | 7.9         | 3.5      | 0.5      | 3.2        | 0.0          | 1.0                   | 16.1         | 2.5                  | 0.0         | 4.0          |
| &hellip; | &hellip;             | &hellip;              | &hellip;        | &hellip;      | &hellip;   | &hellip;           | &hellip;     | &hellip;     | &hellip;     | &hellip;    | &hellip; | &hellip; | &hellip;   | &hellip;     | &hellip;              | &hellip;     | &hellip;             | &hellip;    | &hellip;     |
| 2        | 2024-01-31 23:45:59  | 2024-01-31 23:54:36   | null            | 3.18          | null       | null               | 107          | 263          | 0            | 15.77       | 0.0      | 0.5      | 2.0        | 0.0          | 1.0                   | 21.77        | null                 | null        | 0.628931     |
| 1        | 2024-01-31 23:13:07  | 2024-01-31 23:27:52   | null            | 4.0           | null       | null               | 114          | 236          | 0            | 18.4        | 1.0      | 0.5      | 2.34       | 0.0          | 1.0                   | 25.74        | null                 | null        | 0.585        |
| 2        | 2024-01-31 23:19:00  | 2024-01-31 23:38:00   | null            | 3.33          | null       | null               | 211          | 25           | 0            | 19.97       | 0.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 23.97        | null                 | null        | 0.0          |
| 2        | 2024-01-31 23:07:23  | 2024-01-31 23:25:14   | null            | 3.06          | null       | null               | 107          | 13           | 0            | 23.88       | 0.0      | 0.5      | 5.58       | 0.0          | 1.0                   | 33.46        | null                 | null        | 1.823529     |
| 1        | 2024-01-31 23:58:25  | 2024-02-01 00:13:30   | null            | 8.1           | null       | null               | 138          | 75           | 0            | 32.4        | 7.75     | 0.5      | 7.29       | 6.94         | 1.0                   | 55.88        | null                 | null        | 0.9          |


Convert the dataframe to an Arrow dataframe:

```python
df_arrow = df.to_arrow()
```

We then evolve the schema, to include this new column:

```python
with table.update_schema() as update_schema:
    update_schema.union_by_name(df_arrow.schema)
```

Then finally overwrite the Iceberg table with the new dataframe:


```python
table.overwrite(df_arrow)
```

Now checking on the table again, we should see the new column:


```python
pl.scan_iceberg(table).collect()
```

`shape: (2_964_606, 20)`

| VendorID | tpep_pickup_datetime | tpep_dropoff_datetime | passenger_count | trip_distance | RatecodeID | store_and_fwd_flag | PULocationID | DOLocationID | payment_type | fare_amount | extra    | mta_tax  | tip_amount | tolls_amount | improvement_surcharge | total_amount | congestion_surcharge | Airport_fee | tip_per_mile |
|----------|----------------------|-----------------------|-----------------|---------------|------------|--------------------|--------------|--------------|--------------|-------------|----------|----------|------------|--------------|-----------------------|--------------|----------------------|-------------|--------------|
| i32      | datetime[μs]         | datetime[μs]          | i64             | f64           | i64        | str                | i32          | i32          | i64          | f64         | f64      | f64      | f64        | f64          | f64                   | f64          | f64                  | f64         | f64          |
| 2        | 2024-01-01 00:57:55  | 2024-01-01 01:17:43   | 1               | 1.72          | 1          | &quot;N&quot;      | 186          | 79           | 2            | 17.7        | 1.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 22.7         | 2.5                  | 0.0         | 0.0          |
| 1        | 2024-01-01 00:03:00  | 2024-01-01 00:09:36   | 1               | 1.8           | 1          | &quot;N&quot;      | 140          | 236          | 1            | 10.0        | 3.5      | 0.5      | 3.75       | 0.0          | 1.0                   | 18.75        | 2.5                  | 0.0         | 2.083333     |
| 1        | 2024-01-01 00:17:06  | 2024-01-01 00:35:01   | 1               | 4.7           | 1          | &quot;N&quot;      | 236          | 79           | 1            | 23.3        | 3.5      | 0.5      | 3.0        | 0.0          | 1.0                   | 31.3         | 2.5                  | 0.0         | 0.638298     |
| 1        | 2024-01-01 00:36:38  | 2024-01-01 00:44:56   | 1               | 1.4           | 1          | &quot;N&quot;      | 79           | 211          | 1            | 10.0        | 3.5      | 0.5      | 2.0        | 0.0          | 1.0                   | 17.0         | 2.5                  | 0.0         | 1.428571     |
| 1        | 2024-01-01 00:46:51  | 2024-01-01 00:52:57   | 1               | 0.8           | 1          | &quot;N&quot;      | 211          | 148          | 1            | 7.9         | 3.5      | 0.5      | 3.2        | 0.0          | 1.0                   | 16.1         | 2.5                  | 0.0         | 4.0          |
| &hellip; | &hellip;             | &hellip;              | &hellip;        | &hellip;      | &hellip;   | &hellip;           | &hellip;     | &hellip;     | &hellip;     | &hellip;    | &hellip; | &hellip; | &hellip;   | &hellip;     | &hellip;              | &hellip;     | &hellip;             | &hellip;    | &hellip;     |
| 2        | 2024-01-31 23:45:59  | 2024-01-31 23:54:36   | null            | 3.18          | null       | null               | 107          | 263          | 0            | 15.77       | 0.0      | 0.5      | 2.0        | 0.0          | 1.0                   | 21.77        | null                 | null        | 0.628931     |
| 1        | 2024-01-31 23:13:07  | 2024-01-31 23:27:52   | null            | 4.0           | null       | null               | 114          | 236          | 0            | 18.4        | 1.0      | 0.5      | 2.34       | 0.0          | 1.0                   | 25.74        | null                 | null        | 0.585        |
| 2        | 2024-01-31 23:19:00  | 2024-01-31 23:38:00   | null            | 3.33          | null       | null               | 211          | 25           | 0            | 19.97       | 0.0      | 0.5      | 0.0        | 0.0          | 1.0                   | 23.97        | null                 | null        | 0.0          |
| 2        | 2024-01-31 23:07:23  | 2024-01-31 23:25:14   | null            | 3.06          | null       | null               | 107          | 13           | 0            | 23.88       | 0.0      | 0.5      | 5.58       | 0.0          | 1.0                   | 33.46        | null                 | null        | 1.823529     |
| 1        | 2024-01-31 23:58:25  | 2024-02-01 00:13:30   | null            | 8.1           | null       | null               | 138          | 75           | 0            | 32.4        | 7.75     | 0.5      | 7.29       | 6.94         | 1.0                   | 55.88        | null                 | null        | 0.9          |


Looking at the snapshots now, we see that the overwrite operation create 2 more snapshot, one for deleting the existing data, another for appending the new data:

```python
pl.from_arrow(table.inspect.snapshots())
```
`shape: (3, 6)`

| committed_at            | snapshot_id         | parent_id           | operation          | manifest_list                                                                                                                                     | summary                                                                                                                                                       |
|-------------------------|---------------------|---------------------|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| datetime[ms]            | i64                 | i64                 | str                | str                                                                                                                                               | list[struct[2]]                                                                                                                                               |
| 2024-12-19 05:48:35.092 | 1266899188045554572 | null                | &quot;append&quot; | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/snap-1266899188045554572-0-f40953b3-d76b-490e-8e14-3341ef82477c.avro&quot; | [{&quot;added-files-size&quot;,&quot;55387088&quot;}, {&quot;added-data-files&quot;,&quot;1&quot;}, … {&quot;total-equality-deletes&quot;,&quot;0&quot;}]     |
| 2024-12-19 05:55:41.703 | 4850976834413867788 | 1266899188045554572 | &quot;delete&quot; | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/snap-4850976834413867788-0-0a71ec8f-2671-42b8-8bce-ba6a14f5819e.avro&quot; | [{&quot;removed-files-size&quot;,&quot;55387088&quot;}, {&quot;deleted-data-files&quot;,&quot;1&quot;}, … {&quot;total-equality-deletes&quot;,&quot;0&quot;}] |
| 2024-12-19 05:55:47.655 | 4394398071311520382 | 4850976834413867788 | &quot;append&quot; | &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/metadata/snap-4394398071311520382-0-06a928c7-7e7b-4a8e-9b96-44269a1546ef.avro&quot; | [{&quot;added-files-size&quot;,&quot;59614012&quot;}, {&quot;added-data-files&quot;,&quot;1&quot;}, … {&quot;total-equality-deletes&quot;,&quot;0&quot;}]     |


Looking at the files for this table now, we see that a ne file has been created, in the started location that Iceberg will keep the data file, with the partitioning in the path:


```python
pl.from_arrow(table.inspect.files()).select(["file_path"])
```

`shape: (1, 1)`

| file_path                                                                                                                                                        |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| str                                                                                                                                                              |
| &quot;s3://warehouse/iceberg/nyc_taxi_data.db/yellow_tripdata/data/tpep_pickup_datetime_month=2024-01/00000-0-06a928c7-7e7b-4a8e-9b96-44269a1546ef.parquet&quot; |




As the previous snapshots are still present, the original file we wrote to Minio is still present, just not attached to the current active snapshot. If were to run snapshot expiration operation (which is currently not supported though Pyiceberg), that original file would be deleted. In this way this workflow is different from the Hive external tables setup, where manipulation of the external tables in Hive does not affect the underlying files. 

## Conclusion

Here we show how to register parquet files to an iceberg table without having to rewrite it. This workflow can be useful in creating an Iceberg catalog layer on top of preexisting data, without costly rewrites. This could also go some way to addressing [Iceberg's portability problem](https://medium.com/@kkgsanjeewac77/curious-engineering-facts-icebergs-portability-get-rid-of-tokens-january-release-5-25-080325e6cd95), as we can use the `add_files` method to recreate the iceberg catalog, onces the files have been migrated to a new object storage, with the caveat that old snapshots are not migrated.
