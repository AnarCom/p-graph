import { describe, expect, it } from 'vitest';
import { sampleDraft } from '../mocks/sampleDraft';
import { serializeDefinition, toBackendJson } from './serialization';

describe('pipeline serialization', () => {
  it('round-trips the contract fixture without data loss', () => {
    const serialized = serializeDefinition(sampleDraft.definition);

    expect(serialized).toEqual(sampleDraft.definition);
    expect(serialized).not.toBe(sampleDraft.definition);
    expect(serialized.nodes[0]).not.toBe(sampleDraft.definition.nodes[0]);
  });

  it('emits only canonical backend fields', () => {
    const json = JSON.parse(
      toBackendJson(sampleDraft.definition),
    ) as Record<string, unknown>;

    expect(Object.keys(json)).toEqual([
      'schemaVersion',
      'nodeCatalogVersion',
      'inputs',
      'nodes',
      'edges',
      'ui',
    ]);
    expect(JSON.stringify(json)).not.toContain('sourceHandle');
    expect(JSON.stringify(json)).not.toContain('selected');
    expect(JSON.stringify(json)).not.toContain('measured');
  });
});

