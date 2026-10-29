import type { NodeCatalog } from '../domain/pipeline';

const schema = 'https://json-schema.org/draft/2020-12/schema';

export const mockNodeCatalog: NodeCatalog = {
  catalogVersion: '0.1',
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
      type: 'builtin.read-file',
      version: 1,
      title: 'Прочитать файл',
      description: 'Прочитать файл и вернуть его содержимое как строку',
      category: 'files',
      status: 'active',
      inputs: [
        {
          name: 'file',
          title: 'Файл',
          dataType: 'artifact.file',
          minConnections: 1,
          maxConnections: 1,
        },
      ],
      outputs: [
        {
          name: 'text',
          title: 'Текст',
          dataType: 'text',
        },
      ],
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {
          encoding: {
            type: 'string',
            title: 'Кодировка',
            default: 'utf-8',
            enum: ['utf-8'],
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: 'builtin.console-print',
      version: 1,
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
          maxConnections: 1,
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
      type: 'builtin.end',
      version: 1,
      title: 'Конец',
      description: 'Явно обозначить успешное завершение pipeline',
      category: 'flow',
      status: 'active',
      inputs: [
        {
          name: 'in',
          title: 'Вход',
          dataType: 'any',
          minConnections: 1,
          maxConnections: 1,
        },
      ],
      outputs: [],
      configSchema: {
        $schema: schema,
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ],
};

