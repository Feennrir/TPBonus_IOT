-- ===============================
-- SMARTPOSTURE DATABASE INIT
-- ===============================

-- Extension Timescale (si installée)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ===============================
-- TABLE POSTURE (Time-Series)
-- ===============================

CREATE TABLE IF NOT EXISTS posture_raw (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator_id TEXT NOT NULL,
    sensor_name TEXT NOT NULL,
    ax DOUBLE PRECISION,
    ay DOUBLE PRECISION,
    az DOUBLE PRECISION,
    gx DOUBLE PRECISION,
    gy DOUBLE PRECISION,
    gz DOUBLE PRECISION
);

-- Transforme en hypertable
SELECT create_hypertable('posture_raw', 'time', if_not_exists => TRUE);

-- ===============================
-- TABLE TEMPERATURE (Time-Series)
-- ===============================

CREATE TABLE IF NOT EXISTS temperature_raw (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator_id TEXT NOT NULL,
    temperature DOUBLE PRECISION
);

SELECT create_hypertable('temperature_raw', 'time', if_not_exists => TRUE);

-- ===============================
-- TABLE STATUS
-- ===============================

CREATE TABLE IF NOT EXISTS status_log (
    time        TIMESTAMPTZ DEFAULT NOW(),
    operator_id TEXT,
    status      TEXT
);

-- ===============================
-- INDEX OPTIMISÉS
-- ===============================

CREATE INDEX IF NOT EXISTS idx_posture_operator_time
ON posture_raw (operator_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_posture_sensor
ON posture_raw (sensor_name);

CREATE INDEX IF NOT EXISTS idx_temperature_operator_time
ON temperature_raw (operator_id, time DESC);

-- ===============================
-- AGRÉGATION 5 MINUTES
-- ===============================

CREATE MATERIALIZED VIEW IF NOT EXISTS posture_5min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    operator_id,
    sensor_name,
    AVG(ax) AS ax_avg,
    AVG(ay) AS ay_avg,
    AVG(az) AS az_avg,
    AVG(gx) AS gx_avg,
    AVG(gy) AS gy_avg,
    AVG(gz) AS gz_avg
FROM posture_raw
GROUP BY bucket, operator_id, sensor_name;

-- Rafraîchissement automatique
SELECT add_continuous_aggregate_policy(
    'posture_5min',
    start_offset => INTERVAL '10 minutes',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- ===============================
-- RÉTENTION 10 MINUTES
-- ===============================

SELECT add_retention_policy(
    'posture_raw',
    INTERVAL '10 minutes'
);

SELECT add_retention_policy(
    'temperature_raw',
    INTERVAL '10 minutes'
);