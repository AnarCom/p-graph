import type { PipelineDraft } from '../domain/pipeline';

export const sampleDraft: PipelineDraft = {
  pipelineId: 'pipeline-print-file',
  baseRevision: null,
  definition: {
    schemaVersion: '0.2',
    nodeCatalogVersion: '0.2',
    inputs: {
      sourceFile: {
        type: 'artifact.file',
        title: 'Исходный файл',
        required: true,
      },
    },
    nodes: [
      {
        id: 'input-file',
        type: 'builtin.file-input',
        typeVersion: 1,
        title: 'Загруженный файл',
        config: {
          inputName: 'sourceFile',
        },
        ui: {
          position: { x: 80, y: 180 },
        },
      },
      {
        id: 'python-read',
        type: 'builtin.python',
        typeVersion: 1,
        title: 'Обработать файл',
        config: {},
        inputs: [
          {
            name: 'file',
            title: 'Файл',
            dataType: 'artifact.file',
            minConnections: 1,
            maxConnections: 1,
          },
        ],
        outputs: [{ name: 'text', title: 'Текст', dataType: 'text' }],
        implementation: {
          language: 'python',
          entrypoint: 'run',
          pythonVersion: '3.12',
          requirements: [],
          code: 'def run(inputs):\n    # Runner передаст artifact.file как локальный путь\n    with open(inputs["file"], encoding="utf-8") as source:\n        text = source.read()\n    print(f"Прочитано символов: {len(text)}")\n    return {"text": text}\n',
        },
        ui: {
          position: { x: 380, y: 180 },
        },
      },
      {
        id: 'print-text',
        type: 'builtin.console-print',
        typeVersion: 2,
        title: 'Вывести в консоль',
        config: {
          prefix: '',
        },
        ui: {
          position: { x: 680, y: 180 },
        },
      },
      {
        id: 'return',
        type: 'builtin.return',
        typeVersion: 1,
        title: 'return',
        config: {},
        inputs: [
          {
            name: 'in',
            title: 'Вход',
            dataType: 'any',
            minConnections: 1,
            maxConnections: null,
          },
        ],
        outputs: [
          {
            name: 'result',
            title: 'Результат',
            dataType: 'any',
            sourcePort: 'in',
          },
        ],
        ui: {
          position: { x: 980, y: 180 },
        },
      },
    ],
    edges: [
      {
        id: 'edge-input-read',
        source: { nodeId: 'input-file', port: 'file' },
        target: { nodeId: 'python-read', port: 'file' },
      },
      {
        id: 'edge-read-print',
        source: { nodeId: 'python-read', port: 'text' },
        target: { nodeId: 'print-text', port: 'text' },
      },
      {
        id: 'edge-print-end',
        source: { nodeId: 'print-text', port: 'done' },
        target: { nodeId: 'return', port: 'in' },
      },
    ],
    ui: {
      viewport: { x: 0, y: 0, zoom: 0.82 },
    },
  },
};
