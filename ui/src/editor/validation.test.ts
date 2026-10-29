import { describe, expect, it } from 'vitest';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import { validateDefinition } from './validation';

describe('mock pipeline validation', () => {
  it('accepts the contract example', () => {
    const result = validateDefinition(
      sampleDraft.definition,
      mockNodeCatalog,
    );

    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('reports a missing required connection', () => {
    const definition = structuredClone(sampleDraft.definition);
    definition.edges = definition.edges.filter(
      (edge) => edge.target.nodeId !== 'read-file',
    );

    const result = validateDefinition(definition, mockNodeCatalog);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_CONNECTION',
          location: expect.objectContaining({
            nodeId: 'read-file',
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
        source: { nodeId: 'read-file', port: 'text' },
        target: { nodeId: 'end', port: 'in' },
      },
    ];

    expect(validateDefinition(definition, mockNodeCatalog)).toEqual({
      valid: true,
      issues: [],
    });
  });
});

