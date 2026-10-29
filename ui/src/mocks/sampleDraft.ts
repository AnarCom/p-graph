import type { PipelineDraft } from '../domain/pipeline';

export const sampleDraft: PipelineDraft = {
  pipelineId: 'pipeline-print-file',
  baseRevision: null,
  definition: {
    schemaVersion: '0.1',
    nodeCatalogVersion: '0.1',
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
        id: 'read-file',
        type: 'builtin.read-file',
        typeVersion: 1,
        title: 'Прочитать файл',
        config: {
          encoding: 'utf-8',
        },
        ui: {
          position: { x: 380, y: 180 },
        },
      },
      {
        id: 'print-text',
        type: 'builtin.console-print',
        typeVersion: 1,
        title: 'Вывести в консоль',
        config: {
          prefix: '',
        },
        ui: {
          position: { x: 680, y: 180 },
        },
      },
      {
        id: 'end',
        type: 'builtin.end',
        typeVersion: 1,
        title: 'Конец',
        config: {},
        ui: {
          position: { x: 980, y: 180 },
        },
      },
    ],
    edges: [
      {
        id: 'edge-input-read',
        source: { nodeId: 'input-file', port: 'file' },
        target: { nodeId: 'read-file', port: 'file' },
      },
      {
        id: 'edge-read-print',
        source: { nodeId: 'read-file', port: 'text' },
        target: { nodeId: 'print-text', port: 'text' },
      },
      {
        id: 'edge-print-end',
        source: { nodeId: 'print-text', port: 'done' },
        target: { nodeId: 'end', port: 'in' },
      },
    ],
    ui: {
      viewport: { x: 0, y: 0, zoom: 0.82 },
    },
  },
};

