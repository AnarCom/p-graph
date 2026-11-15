import type { NodeCatalog } from '../domain/pipeline';

const schema = 'https://json-schema.org/draft/2020-12/schema';

export const mockNodeCatalog: NodeCatalog = {
  catalogVersion: '0.2',
  nodeTypes: [
    {
      type: 'builtin.file-input',
      version: 1,
      title: 'Загруженный файл',
      description: 'Получить файловый артефакт из входов запуска',
      category: 'files',
      status: 'active',
      inputs: [],
      outputs: [
        {
          name: 'file',
          title: 'Файл',
          dataType: 'artifact.file',
        },
      ],
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {
          inputName: {
            type: 'string',
            title: 'Имя входа',
            default: 'sourceFile',
          },
        },
        required: ['inputName'],
        additionalProperties: false,
      },
    },
    {
      type: 'builtin.python',
      version: 1,
      title: 'Python кубик',
      description: 'Создать свой кубик: Python-код, входы и выходы',
      category: 'code',
      status: 'active',
      editablePorts: true,
      inputs: [
        {
          name: 'text',
          title: 'Текст',
          dataType: 'text',
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
        code: 'def run(inputs):\n    text = inputs["text"]\n    print(text)\n    return {"result": text}\n',
      },
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'builtin.console-print',
      version: 2,
      title: 'Вывести в консоль',
      description: 'Записать строку в журнал запуска',
      category: 'text',
      status: 'active',
      inputs: [
        {
          name: 'text',
          title: 'Текст',
          dataType: 'text',
          minConnections: 1,
          maxConnections: null,
        },
      ],
      outputs: [
        {
          name: 'done',
          title: 'Готово',
          dataType: 'control',
        },
      ],
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            title: 'Префикс',
            default: '',
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: 'builtin.return',
      version: 1,
      title: 'return',
      description: 'Вернуть результаты pipeline через настраиваемые параметры',
      category: 'flow',
      editablePorts: true,
      status: 'active',
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
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ],
};
