import { beforeEach, describe, expect, it } from 'vitest';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import { useEditorStore } from './store';
import { validateDefinition } from './validation';
import { resolveNodeType } from './nodePorts';
import { canConnect } from './connections';
import { migrateDefinition } from './migrateDefinition';
import { serializeDefinition } from './serialization';
import { LocalPipelineRepository } from '../repository/LocalPipelineRepository';
import { demoRunId } from '../mocks/nodeLogs';

const currentDefinition = () => useEditorStore.getState().definition!;

describe('custom nodes and connections', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().hydrate(sampleDraft.definition, mockNodeCatalog);
  });

  it('fans one uploaded file out to parallel Python nodes and persists both branches', async () => {
    const original = currentDefinition().nodes.find(
      (node) => node.id === 'python-read',
    )!;
    const branch = {
      ...structuredClone(original),
      id: 'parallel-python',
      title: 'Параллельная обработка',
    };
    useEditorStore.getState().hydrate(
      {
        ...currentDefinition(),
        nodes: [...currentDefinition().nodes, branch],
      },
      mockNodeCatalog,
    );

    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'input-file',
        'file',
        branch.id,
        'file',
      ),
    ).toBe(true);
    useEditorStore.getState().connect('input-file', 'file', branch.id, 'file');
    useEditorStore.getState().connect(branch.id, 'text', 'return', 'in');

    const branches = currentDefinition().edges.filter(
      (edge) =>
        edge.source.nodeId === 'input-file' && edge.source.port === 'file',
    );
    expect(branches.map((edge) => edge.target.nodeId)).toEqual([
      'python-read',
      branch.id,
    ]);
    expect(
      currentDefinition().edges.some(
        (edge) =>
          (edge.source.nodeId === 'python-read' &&
            edge.target.nodeId === branch.id) ||
          (edge.source.nodeId === branch.id &&
            edge.target.nodeId === 'python-read'),
      ),
    ).toBe(false);
    expect(validateDefinition(currentDefinition(), mockNodeCatalog)).toEqual({
      valid: true,
      issues: [],
    });

    const repository = new LocalPipelineRepository();
    await repository.saveDraft({
      ...sampleDraft,
      definition: serializeDefinition(currentDefinition()),
    });
    const restored = await repository.getDraft(sampleDraft.pipelineId);
    expect(restored.definition).toEqual(currentDefinition());
    useEditorStore.getState().removeEdge(branches[1]!.id);
    expect(currentDefinition().edges).toContainEqual(branches[0]);
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'input-file',
        'file',
        branch.id,
        'file',
      ),
    ).toBe(true);
  });

  it('fans one output out to distinct scalar inputs on the same cube', () => {
    const fileInput = currentDefinition().nodes.find(
      (node) => node.id === 'python-read',
    )!.inputs![0]!;
    useEditorStore
      .getState()
      .updateNodePorts('python-read', 'inputs', [
        fileInput,
        { ...fileInput, name: 'copy', title: 'Второй вход' },
      ]);
    useEditorStore
      .getState()
      .connect('input-file', 'file', 'python-read', 'copy');
    expect(
      currentDefinition().edges.filter(
        (edge) => edge.source.nodeId === 'input-file',
      ),
    ).toHaveLength(2);
    expect(validateDefinition(currentDefinition(), mockNodeCatalog).valid).toBe(
      true,
    );
    // The exact same connection remains a duplicate, even when fan-out is allowed.
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'input-file',
        'file',
        'python-read',
        'copy',
      ),
    ).toBe(false);
  });

  it('accepts several sources on one return input and preserves them on save', async () => {
    useEditorStore.getState().connect('python-read', 'text', 'return', 'in');
    useEditorStore.getState().connect('input-file', 'file', 'return', 'in');
    expect(
      currentDefinition().edges.filter(
        (edge) => edge.target.nodeId === 'return',
      ),
    ).toHaveLength(3);
    expect(validateDefinition(currentDefinition(), mockNodeCatalog).valid).toBe(
      true,
    );
    const repository = new LocalPipelineRepository();
    await repository.saveDraft({
      ...sampleDraft,
      definition: serializeDefinition(currentDefinition()),
    });
    expect(
      (await repository.getDraft(sampleDraft.pipelineId)).definition,
    ).toEqual(currentDefinition());
  });

  it('enforces scalar port capacity, duplicates, direction and cycles', () => {
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'python-read',
        'text',
        'return',
        'in',
      ),
    ).toBe(true);
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'input-file',
        'file',
        'python-read',
        'file',
      ),
    ).toBe(false);
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'print-text',
        'done',
        'return',
        'in',
      ),
    ).toBe(false);
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'return',
        'result',
        'print-text',
        'text',
      ),
    ).toBe(false);
    useEditorStore.getState().updateNodePorts('python-read', 'inputs', [
      {
        name: 'back',
        title: 'Back',
        dataType: 'control',
        minConnections: 0,
        maxConnections: null,
      },
    ]);
    expect(
      canConnect(
        currentDefinition(),
        mockNodeCatalog,
        'print-text',
        'done',
        'python-read',
        'back',
      ),
    ).toBe(false);
  });

  it('accepts multiple inputs on a Python node and validates declared capacity', () => {
    useEditorStore.getState().updateNodePorts('python-read', 'inputs', [
      {
        name: 'file',
        title: 'Файл',
        dataType: 'artifact.file',
        minConnections: 1,
        maxConnections: null,
      },
    ]);
    const sourceType = mockNodeCatalog.nodeTypes[0]!;
    useEditorStore.getState().addNode(sourceType);
    const added = currentDefinition().nodes.at(-1)!;
    useEditorStore.getState().connect(added.id, 'file', 'python-read', 'file');
    expect(validateDefinition(currentDefinition(), mockNodeCatalog).valid).toBe(
      true,
    );
    useEditorStore.getState().updateNodePorts('python-read', 'inputs', [
      {
        name: 'file',
        title: 'Файл',
        dataType: 'artifact.file',
        minConnections: 1,
        maxConnections: 1,
      },
    ]);
    expect(
      validateDefinition(currentDefinition(), mockNodeCatalog).issues.some(
        (issue) => issue.code === 'TOO_MANY_CONNECTIONS',
      ),
    ).toBe(true);
  });

  it('keeps incoming and outgoing connections when ports are renamed', () => {
    useEditorStore.getState().updateNodePorts(
      'python-read',
      'inputs',
      [
        {
          name: 'source',
          title: 'Source',
          dataType: 'artifact.file',
          minConnections: 1,
          maxConnections: 1,
        },
      ],
      { file: 'source' },
    );
    useEditorStore
      .getState()
      .updateNodePorts(
        'python-read',
        'outputs',
        [{ name: 'result', title: 'Result', dataType: 'text' }],
        { text: 'result' },
      );
    expect(
      currentDefinition().edges.find((edge) => edge.id === 'edge-input-read')
        ?.target.port,
    ).toBe('source');
    expect(
      currentDefinition().edges.find((edge) => edge.id === 'edge-read-print')
        ?.source.port,
    ).toBe('result');
    expect(validateDefinition(currentDefinition(), mockNodeCatalog).valid).toBe(
      true,
    );
  });

  it('removes only connections to deleted ports', () => {
    useEditorStore.getState().updateNodePorts('python-read', 'outputs', []);
    expect(currentDefinition().edges.map((edge) => edge.id)).toEqual([
      'edge-input-read',
      'edge-print-end',
    ]);
  });

  it('updates return result mappings when its input is renamed', () => {
    useEditorStore.getState().updateNodePorts(
      'return',
      'inputs',
      [
        {
          name: 'value',
          title: 'Value',
          dataType: 'any',
          minConnections: 1,
          maxConnections: null,
        },
      ],
      { in: 'value' },
    );
    expect(
      currentDefinition().nodes.find((node) => node.id === 'return')
        ?.outputs?.[0]?.sourcePort,
    ).toBe('value');
    expect(validateDefinition(currentDefinition(), mockNodeCatalog).valid).toBe(
      true,
    );
    useEditorStore.getState().updateNodePorts('return', 'inputs', []);
    expect(
      validateDefinition(currentDefinition(), mockNodeCatalog).issues.some(
        (issue) => issue.code === 'INVALID_RETURN_OUTPUT',
      ),
    ).toBe(true);
  });

  it('creates independent Python cubes with editable ports and code', async () => {
    const type = mockNodeCatalog.nodeTypes.find(
      (type) => type.type === 'builtin.python',
    )!;
    useEditorStore.getState().addNode(type);
    const node = currentDefinition().nodes.at(-1)!;
    const code = 'def run(inputs):\n    return {"answer": 42}\n';
    useEditorStore.getState().updateNodeCode(node.id, code);
    useEditorStore
      .getState()
      .updateNodePorts(node.id, 'outputs', [
        { name: 'answer', title: 'Ответ', dataType: 'number' },
      ]);
    const repository = new LocalPipelineRepository();
    await repository.saveDraft({
      ...sampleDraft,
      definition: serializeDefinition(currentDefinition()),
    });
    const restored = (
      await repository.getDraft(sampleDraft.pipelineId)
    ).definition.nodes.at(-1)!;
    expect(restored.implementation?.code).toBe(code);
    expect(resolveNodeType(mockNodeCatalog, restored)?.outputs[0]?.name).toBe(
      'answer',
    );
    expect(type.outputs[0]?.name).toBe('result');
    expect(restored.inputs).toEqual(type.inputs);
  });

  it('validates code, duplicate port names and return outgoing edges', () => {
    useEditorStore.getState().updateNodeCode('python-read', '   ');
    useEditorStore.getState().updateNodePorts('python-read', 'outputs', [
      { name: 'text', title: 'Text', dataType: 'text' },
      { name: 'text', title: 'Duplicate', dataType: 'text' },
    ]);
    const definition = structuredClone(currentDefinition());
    definition.edges.push({
      id: 'invalid-outgoing',
      source: { nodeId: 'return', port: 'result' },
      target: { nodeId: 'python-read', port: 'file' },
    });
    const codes = validateDefinition(definition, mockNodeCatalog).issues.map(
      (issue) => issue.code,
    );
    expect(codes).toContain('MISSING_PYTHON_CODE');
    expect(codes).toContain('INVALID_PORT_DEFINITION');
    expect(codes).toContain('RETURN_OUTGOING_EDGE');
  });

  it('provides isolated run logs and empty state for new nodes', async () => {
    const repository = new LocalPipelineRepository();
    const logs = await repository.getNodeLogs(demoRunId, 'python-read');
    expect(logs?.entries[0]?.stream).toBe('stdout');
    logs!.entries[0]!.message = 'changed';
    expect(
      (await repository.getNodeLogs(demoRunId, 'python-read'))?.entries[0]
        ?.message,
    ).not.toBe('changed');
    expect(await repository.getNodeLogs(demoRunId, 'new-node')).toBeNull();
    expect(await repository.getNodeLogs('other-run', 'python-read')).toBeNull();
  });

  it('explicitly migrates 0.1 while preserving graph identity and the original', () => {
    const legacy = structuredClone(sampleDraft.definition);
    legacy.schemaVersion = legacy.nodeCatalogVersion = '0.1';
    legacy.nodes = legacy.nodes.map((node) => {
      if (node.type === 'builtin.return')
        return {
          ...node,
          type: 'builtin.end',
          title: 'Конец',
          inputs: undefined,
          outputs: undefined,
        };
      if (node.type === 'builtin.python')
        return {
          ...node,
          type: 'builtin.read-file',
          config: { encoding: 'utf-8' },
          inputs: undefined,
          outputs: undefined,
          implementation: undefined,
        };
      if (node.type === 'builtin.console-print')
        return { ...node, typeVersion: 1 };
      return node;
    });
    const migrated = migrateDefinition(legacy);
    expect(legacy.schemaVersion).toBe('0.1');
    expect(migrated.edges).toEqual(legacy.edges);
    expect(migrated.nodes.map((node) => node.id)).toEqual(
      legacy.nodes.map((node) => node.id),
    );
    expect(validateDefinition(migrated, mockNodeCatalog)).toEqual({
      valid: true,
      issues: [],
    });
    expect(() => migrateDefinition(migrated)).toThrow();
    expect(
      mockNodeCatalog.nodeTypes.some(
        (node) => node.type === 'builtin.read-file',
      ),
    ).toBe(false);
  });
});
