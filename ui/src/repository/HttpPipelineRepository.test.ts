import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpPipelineRepository } from './HttpPipelineRepository';
import { sampleDraft } from '../mocks/sampleDraft';

describe('HTTP repository compatibility', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves Python code, ports and environment in the existing draft endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new HttpPipelineRepository({
      baseUrl: 'http://example.test',
    });
    const draft = structuredClone(sampleDraft);
    draft.pipelineId = '20000000-0000-4000-8000-000000000000';
    draft.definition.nodes.find(
      (node) => node.type === 'builtin.python',
    )!.implementation!.requirements = ['requests==2.32.5'];
    await repository.saveDraft(draft);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://example.test/pipelines/${draft.pipelineId}/draft`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(draft) }),
    );
  });

  it('retains catalog version queries and does not invent a logs endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ catalogVersion: '0.2', nodeTypes: [] })),
      );
    vi.stubGlobal('fetch', fetchMock);
    const repository = new HttpPipelineRepository({
      baseUrl: 'http://example.test',
    });
    await repository.getNodeCatalog('0.2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.test/node-catalog?version=0.2',
      expect.anything(),
    );
    await expect(repository.getNodeLogs('run', 'node')).rejects.toThrow(
      'ещё не подключено',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
