CREATE TYPE execution_status AS ENUM (
    'Pending',
    'Scheduled',
    'Running',
    'Succeeded',
    'Failed',
    'Cancelled'
);

CREATE TABLE pipelines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    graph       JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id  UUID        NOT NULL REFERENCES pipelines (id) ON DELETE CASCADE,
    status       execution_status NOT NULL DEFAULT 'Pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ
);

CREATE INDEX idx_runs_pipeline_id ON runs (pipeline_id);

CREATE TABLE operations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    node_id     UUID        NOT NULL,
    status      execution_status NOT NULL DEFAULT 'Pending',
    attempt     INTEGER     NOT NULL DEFAULT 1,
    exit_code   INTEGER,
    log_key     TEXT,
    artifacts   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    UNIQUE (run_id, node_id)
);

CREATE INDEX idx_operations_run_id ON operations (run_id);
