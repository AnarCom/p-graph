import { describe, expect, it } from 'vitest';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import { controlFlowDraft } from '../mocks/controlFlowDraft';
import { resolveNodeType } from './nodePorts';
import { validateDefinition } from './validation';

describe('mock pipeline validation', () => {
  it('accepts the control example with an explicit control output and input', () => {
    const definition = controlFlowDraft.definition;
    expect(validateDefinition(definition, mockNodeCatalog)).toEqual({
      valid: true,
      issues: [],
    });
    const edge = definition.edges.find(
      (edge) => edge.id === 'control-print-to-after',
    )!;
    const source = resolveNodeType(
      mockNodeCatalog,
      definition.nodes.find((node) => node.id === edge.source.nodeId)!,
    )!;
    const target = resolveNodeType(
      mockNodeCatalog,
      definition.nodes.find((node) => node.id === edge.target.nodeId)!,
    )!;
    expect(
      source.outputs.find((port) => port.name === edge.source.port)?.dataType,
    ).toBe('control');
    expect(
      target.inputs.find((port) => port.name === edge.target.port)?.dataType,
    ).toBe('control');
  });

  it('accepts the contract example', () => {
    const result = validateDefinition(sampleDraft.definition, mockNodeCatalog);

    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('reports a missing required connection', () => {
    const definition = structuredClone(sampleDraft.definition);
    definition.edges = definition.edges.filter(
      (edge) => edge.target.nodeId !== 'python-read',
    );

    const result = validateDefinition(definition, mockNodeCatalog);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_CONNECTION',
          location: expect.objectContaining({
            nodeId: 'python-read',
            port: 'file',
          }),
        }),
      ]),
    );
  });

  it('checks file-input references against pipeline inputs', () => {
    const definition = structuredClone(sampleDraft.definition);
    const inputNode = definition.nodes.find(
      (node) => node.type === 'builtin.file-input',
    );
    if (!inputNode) throw new Error('Fixture has no file-input node');
    inputNode.config.inputName = 'missingInput';

    const result = validateDefinition(definition, mockNodeCatalog);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNKNOWN_PIPELINE_INPUT' }),
      ]),
    );
  });

  it('allows any output type to connect directly to the end node', () => {
    const definition = structuredClone(sampleDraft.definition);
    definition.nodes = definition.nodes.filter(
      (node) => node.id !== 'print-text',
    );
    definition.edges = [
      definition.edges.find((edge) => edge.id === 'edge-input-read')!,
      {
        id: 'edge-read-end',
        source: { nodeId: 'python-read', port: 'text' },
        target: { nodeId: 'return', port: 'in' },
      },
    ];

    expect(validateDefinition(definition, mockNodeCatalog)).toEqual({
      valid: true,
      issues: [],
    });
  });
});
