import type { PipelineDefinition } from '../domain/pipeline';
import { mockNodeCatalog } from '../mocks/nodeCatalog';

// Pure conversion; the repository persists the result when loading a 0.1 draft.
export function migrateDefinition(
  definition: PipelineDefinition,
): PipelineDefinition {
  if (
    definition.schemaVersion !== '0.1' ||
    definition.nodeCatalogVersion !== '0.1'
  ) {
    throw new Error('Поддерживается только обновление 0.1 → 0.2');
  }
  const result = structuredClone(definition);
  result.schemaVersion = '0.2';
  result.nodeCatalogVersion = '0.2';
  result.nodes = result.nodes.map((node) => {
    if (node.type === 'builtin.end' && node.typeVersion === 1) {
      const type = mockNodeCatalog.nodeTypes.find(
        (type) => type.type === 'builtin.return',
      )!;
      return {
        ...node,
        type: type.type,
        title: node.title === 'Конец' ? 'return' : node.title,
        inputs: structuredClone(type.inputs),
        outputs: structuredClone(type.outputs),
      };
    }
    if (node.type === 'builtin.read-file' && node.typeVersion === 1) {
      const encoding =
        typeof node.config.encoding === 'string'
          ? node.config.encoding
          : 'utf-8';
      return {
        ...node,
        type: 'builtin.python',
        title: node.title === 'Прочитать файл' ? 'Python кубик' : node.title,
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
          code: `def run(inputs):\n    with open(inputs["file"], encoding=${JSON.stringify(encoding)}) as source:\n        text = source.read()\n    print(f"Прочитано символов: {len(text)}")\n    return {"text": text}\n`,
        },
      };
    }
    if (node.type === 'builtin.console-print' && node.typeVersion === 1)
      return { ...node, typeVersion: 2 };
    return node;
  });
  return result;
}
