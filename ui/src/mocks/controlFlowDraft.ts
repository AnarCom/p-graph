import type { PipelineDraft } from '../domain/pipeline';

export const controlFlowDraft: PipelineDraft = {
  pipelineId: 'pipeline-control-example',
  baseRevision: null,
  definition: {
    schemaVersion: '0.2',
    nodeCatalogVersion: '0.2',
    inputs: {},
    nodes: [
      {
        id: 'control-prepare',
        type: 'builtin.python',
        typeVersion: 1,
        title: 'Подготовить текст',
        config: {},
        inputs: [],
        outputs: [{ name: 'text', title: 'Текст', dataType: 'text' }],
        implementation: {
          language: 'python',
          entrypoint: 'run',
          pythonVersion: '3.12',
          requirements: [],
          code: 'def run(inputs):\n    print("Подготовлен текст")\n    return {"text": "Пример сигнала control"}\n',
        },
        ui: { position: { x: 40, y: 160 } },
      },
      {
        id: 'control-print',
        type: 'builtin.console-print',
        typeVersion: 2,
        title: 'Напечатать текст',
        config: { prefix: '[control] ' },
        ui: { position: { x: 340, y: 160 } },
      },
      {
        id: 'control-after',
        type: 'builtin.python',
        typeVersion: 1,
        title: 'После вывода в консоль',
        config: {},
        inputs: [
          {
            name: 'printed',
            title: 'Печать завершена',
            dataType: 'control',
            minConnections: 1,
            maxConnections: 1,
          },
        ],
        outputs: [{ name: 'result', title: 'Результат', dataType: 'text' }],
        implementation: {
          language: 'python',
          entrypoint: 'run',
          pythonVersion: '3.12',
          requirements: [],
          code: 'def run(inputs):\n    # Вход printed — сигнал готовности, пользовательских данных в нём нет.\n    # Этот шаг начинается только после успешного вывода в консоль.\n    print("Вывод в консоль завершён, выполняю следующий шаг")\n    return {"result": "Готово после печати"}\n',
        },
        ui: { position: { x: 640, y: 160 } },
      },
      {
        id: 'control-return',
        type: 'builtin.return',
        typeVersion: 1,
        title: 'return',
        config: {},
        inputs: [
          {
            name: 'result',
            title: 'Результат',
            dataType: 'text',
            minConnections: 1,
            maxConnections: 1,
          },
        ],
        outputs: [
          {
            name: 'result',
            title: 'Результат',
            dataType: 'text',
            sourcePort: 'result',
          },
        ],
        ui: { position: { x: 940, y: 160 } },
      },
    ],
    edges: [
      {
        id: 'control-text-to-print',
        source: { nodeId: 'control-prepare', port: 'text' },
        target: { nodeId: 'control-print', port: 'text' },
      },
      {
        id: 'control-print-to-after',
        source: { nodeId: 'control-print', port: 'done' },
        target: { nodeId: 'control-after', port: 'printed' },
      },
      {
        id: 'control-after-to-return',
        source: { nodeId: 'control-after', port: 'result' },
        target: { nodeId: 'control-return', port: 'result' },
      },
    ],
    ui: { viewport: { x: 0, y: 0, zoom: 0.82 } },
  },
};
