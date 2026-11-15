import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleDraft } from '../mocks/sampleDraft';
import { LocalPipelineRepository } from './LocalPipelineRepository';
import { validateDefinition } from '../editor/validation';
import { mockNodeCatalog } from '../mocks/nodeCatalog';

const key = `p-graph:mock-draft:${sampleDraft.pipelineId}:v1`;
const backupKey = `${key}:backup:0.1`;

function legacyDraft() {
  const draft = structuredClone(sampleDraft);
  draft.baseRevision = 7;
  draft.definition.schemaVersion = draft.definition.nodeCatalogVersion = '0.1';
  draft.definition.nodes = draft.definition.nodes.map((node) => {
    if (node.type === 'builtin.return')
      return {
        ...node,
        type: 'builtin.end',
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
  return draft;
}

describe('automatic draft migration', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('migrates and persists an old draft while preserving its original JSON', async () => {
    const legacy = legacyDraft();
    const original = JSON.stringify(legacy);
    localStorage.setItem(key, original);
    const repository = new LocalPipelineRepository();
    const migrated = await repository.getDraft(sampleDraft.pipelineId);

    expect(migrated.definition.schemaVersion).toBe('0.2');
    expect(migrated.baseRevision).toBe(7);
    expect(migrated.definition.edges).toEqual(legacy.definition.edges);
    expect(migrated.definition.nodes.map((node) => node.id)).toEqual(
      legacy.definition.nodes.map((node) => node.id),
    );
    expect(validateDefinition(migrated.definition, mockNodeCatalog).valid).toBe(
      true,
    );
    expect(localStorage.getItem(backupKey)).toBe(original);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(migrated);

    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(await repository.getDraft(sampleDraft.pipelineId)).toEqual(migrated);
    expect(writes).not.toHaveBeenCalled();
  });

  it('keeps the original draft if writing the migrated version fails', async () => {
    const original = JSON.stringify(legacyDraft());
    localStorage.setItem(key, original);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      name,
      value,
    ) {
      if (name === key) throw new Error('Storage quota exceeded');
      setItem.call(this, name, value);
    });

    await expect(
      new LocalPipelineRepository().getDraft(sampleDraft.pipelineId),
    ).rejects.toThrow('Storage quota exceeded');
    expect(localStorage.getItem(key)).toBe(original);
    expect(localStorage.getItem(backupKey)).toBe(original);
  });

  it('preserves an existing backup and does not migrate unknown versions', async () => {
    localStorage.setItem(backupKey, 'previous backup');
    localStorage.setItem(key, JSON.stringify(legacyDraft()));
    const repository = new LocalPipelineRepository();
    await repository.getDraft(sampleDraft.pipelineId);
    expect(localStorage.getItem(backupKey)).toBe('previous backup');

    const unknown = structuredClone(sampleDraft);
    unknown.definition.schemaVersion = '9.0';
    const original = JSON.stringify(unknown);
    localStorage.setItem(key, original);
    expect(await repository.getDraft(sampleDraft.pipelineId)).toEqual(unknown);
    expect(localStorage.getItem(key)).toBe(original);
  });
});
