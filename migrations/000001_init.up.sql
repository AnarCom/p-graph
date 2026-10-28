CREATE TYPE execution_status AS ENUM (
    'Pending',
    'Scheduled',
    'Running',
    'Succeeded',
    'Failed',
    'Cancelled'
);

CREATE TABLE folders (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id  UUID        REFERENCES folders (id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_folders_parent_id ON folders (parent_id);

CREATE TABLE pipelines (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id  UUID        NOT NULL REFERENCES folders (id),
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipelines_folder_id ON pipelines (folder_id);

CREATE TABLE pipeline_revisions (
    pipeline_id UUID        NOT NULL REFERENCES pipelines (id) ON DELETE CASCADE,
    revision    INTEGER     NOT NULL CHECK (revision > 0),
    definition  JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (pipeline_id, revision)
);

CREATE TABLE pipeline_drafts (
    pipeline_id   UUID        PRIMARY KEY REFERENCES pipelines (id) ON DELETE CASCADE,
    base_revision INTEGER,
    definition    JSONB       NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catalog_versions (
    version     TEXT        PRIMARY KEY,
    released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO catalog_versions (version) VALUES ('0.1');

CREATE TABLE node_types (
    type          TEXT        NOT NULL,
    version       INTEGER     NOT NULL CHECK (version > 0),
    title         TEXT        NOT NULL,
    description   TEXT        NOT NULL DEFAULT '',
    category      TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'deprecated', 'disabled')),
    inputs        JSONB       NOT NULL,
    outputs       JSONB       NOT NULL,
    config_schema JSONB       NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (type, version)
);
INSERT INTO node_types (type, version, title, description, category, status, inputs, outputs, config_schema) VALUES
(
    'builtin.file-input', 1,
    'Загруженный файл', 'Получить файловый артефакт из входов запуска', 'files', 'active',
    '[]'::jsonb,
    '[{"name": "file", "title": "Файл", "dataType": "artifact.file"}]'::jsonb,
    '{
        "type": "object",
        "properties": {
            "inputName": {"type": "string", "title": "Имя входа"}
        },
        "required": ["inputName"],
        "additionalProperties": false
    }'::jsonb
),
(
    'builtin.read-file', 1,
    'Прочитать файл', 'Прочитать файловый артефакт и вернуть содержимое как строку', 'files', 'active',
    '[{"name": "file", "title": "Файл", "dataType": "artifact.file", "minConnections": 1, "maxConnections": 1}]'::jsonb,
    '[{"name": "text", "title": "Текст", "dataType": "text"}]'::jsonb,
    '{
        "type": "object",
        "properties": {
            "encoding": {"type": "string", "title": "Кодировка", "default": "utf-8", "enum": ["utf-8"]}
        },
        "additionalProperties": false
    }'::jsonb
),
(
    'builtin.console-print', 1,
    'Вывести в консоль', 'Записать строку в журнал запуска', 'text', 'active',
    '[{"name": "text", "title": "Текст", "dataType": "text", "minConnections": 1, "maxConnections": 1}]'::jsonb,
    '[{"name": "done", "title": "Завершено", "dataType": "control"}]'::jsonb,
    '{
        "type": "object",
        "properties": {
            "prefix": {"type": "string", "title": "Префикс", "default": ""}
        },
        "additionalProperties": false
    }'::jsonb
),
(
    'builtin.end', 1,
    'Конец', 'Явно обозначить успешное завершение пайплайна', 'flow', 'active',
    '[{"name": "in", "title": "Вход", "dataType": "control", "minConnections": 1, "maxConnections": 1}]'::jsonb,
    '[]'::jsonb,
    '{"type": "object", "properties": {}, "additionalProperties": false}'::jsonb
);

CREATE TABLE catalog_version_types (
    catalog_version   TEXT    NOT NULL REFERENCES catalog_versions (version) ON DELETE CASCADE,
    node_type         TEXT    NOT NULL,
    node_type_version INTEGER NOT NULL,

    PRIMARY KEY (catalog_version, node_type, node_type_version),
    FOREIGN KEY (node_type, node_type_version) REFERENCES node_types (type, version)
);
INSERT INTO catalog_version_types (catalog_version, node_type, node_type_version) VALUES
    ('0.1', 'builtin.file-input', 1),
    ('0.1', 'builtin.read-file', 1),
    ('0.1', 'builtin.console-print', 1),
    ('0.1', 'builtin.end', 1);

CREATE TABLE artifacts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    filename     TEXT        NOT NULL,
    content_type TEXT        NOT NULL DEFAULT 'application/octet-stream',
    size_bytes   BIGINT      NOT NULL,
    storage_key  TEXT        NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runs (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID             NOT NULL,
    revision    INTEGER          NOT NULL,
    status      execution_status NOT NULL DEFAULT 'Pending',
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    FOREIGN KEY (pipeline_id, revision)
        REFERENCES pipeline_revisions (pipeline_id, revision) ON DELETE CASCADE
);
CREATE INDEX idx_runs_pipeline_id ON runs (pipeline_id);

CREATE TABLE operations (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID             NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    node_id     TEXT             NOT NULL,
    status      execution_status NOT NULL DEFAULT 'Pending',
    attempt     INTEGER          NOT NULL DEFAULT 1,
    exit_code   INTEGER,
    log_key     TEXT,
    artifacts   JSONB,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    UNIQUE (run_id, node_id)
);
CREATE INDEX idx_operations_run_id ON operations (run_id);
