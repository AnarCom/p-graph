INSERT INTO catalog_versions (version) VALUES ('0.1');

INSERT INTO node_types (type, version, title, description, category, status, inputs, outputs, config_schema) VALUES
(
    'builtin.file-input', 1,
    'Загруженный файл', 'Получить файловый артефакт из входов запуска', 'files', 'active',
    '[]'::jsonb,
    '[{"name": "file", "title": "Файл", "dataType": "artifact.file"}]'::jsonb,
    '{
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "inputName": {"type": "string", "title": "Имя входа", "default": "sourceFile"}
        },
        "required": ["inputName"],
        "additionalProperties": false
    }'::jsonb
),
(
    'builtin.console-print', 1,
    'Вывести в консоль', 'Записать строку в журнал запуска', 'text', 'active',
    '[{"name": "text", "title": "Текст", "dataType": "text", "minConnections": 1, "maxConnections": 1}]'::jsonb,
    '[{"name": "done", "title": "Завершено", "dataType": "control"}]'::jsonb,
    '{
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "prefix": {"type": "string", "title": "Префикс", "default": ""}
        },
        "additionalProperties": false
    }'::jsonb
);

INSERT INTO catalog_version_types (catalog_version, node_type, node_type_version) VALUES
    ('0.1', 'builtin.file-input', 1),
    ('0.1', 'builtin.console-print', 1);

INSERT INTO folders (id, name)
VALUES ('10000000-0000-4000-8000-000000000000', 'Демо');

INSERT INTO pipelines (id, folder_id, name)
VALUES ('20000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000000', 'Печать файла');

INSERT INTO pipeline_revisions (pipeline_id, revision, definition)
VALUES (
    '20000000-0000-4000-8000-000000000000',
    1,
    '{
        "schemaVersion": "0.1",
        "nodeCatalogVersion": "0.1",
        "inputs": {
            "sourceFile": {"type": "artifact.file", "title": "Исходный файл", "required": true}
        },
        "nodes": [
            {
                "id": "input-file",
                "type": "builtin.file-input",
                "typeVersion": 1,
                "title": "Загруженный файл",
                "config": {"inputName": "sourceFile"},
                "ui": {"position": {"x": 80, "y": 180}}
            },
            {
                "id": "print-text",
                "type": "builtin.console-print",
                "typeVersion": 1,
                "title": "Вывести в консоль",
                "config": {"prefix": ""},
                "ui": {"position": {"x": 680, "y": 180}}
            }
        ],
        "edges": [
            {"id": "edge-input-print", "source": {"nodeId": "input-file", "port": "file"}, "target": {"nodeId": "print-text", "port": "text"}}
        ],
        "ui": {"viewport": {"x": 0, "y": 0, "zoom": 0.82}}
    }'::jsonb
);
