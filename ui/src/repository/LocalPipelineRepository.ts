import { demoRunId, mockNodeLogs } from '../mocks/nodeLogs';
import type { PipelineDraft } from '../domain/pipeline';
import { validateDefinition } from '../editor/validation';
import { migrateDefinition } from '../editor/migrateDefinition';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import { controlFlowDraft } from '../mocks/controlFlowDraft';
import type { PipelineRepository } from './PipelineRepository';

const storageKey = (pipelineId: string) =>
  `p-graph:mock-draft:${pipelineId}:v1`;

function cloneDraft(draft: PipelineDraft): PipelineDraft {
  return structuredClone(draft);
}

function initialDraft(pipelineId: string): PipelineDraft {
  return cloneDraft(
    pipelineId === controlFlowDraft.pipelineId ? controlFlowDraft : sampleDraft,
  );
}

export class LocalPipelineRepository implements PipelineRepository {
  async getNodeLogs(runId: string, nodeId: string) {
    if (runId !== demoRunId) return null;
    return structuredClone(
      Object.hasOwn(mockNodeLogs, nodeId)
        ? (mockNodeLogs[nodeId] ?? null)
        : null,
    );
  }

  async getNodeCatalog(version?: string) {
    if (version && version !== mockNodeCatalog.catalogVersion) {
      throw new Error(`Mock-каталог версии ${version} не найден`);
    }

    return structuredClone(mockNodeCatalog);
  }

  async getDraft(pipelineId: string) {
    const stored = localStorage.getItem(storageKey(pipelineId));

    if (!stored) return initialDraft(pipelineId);

    let draft: PipelineDraft;
    try {
      draft = JSON.parse(stored) as PipelineDraft;
    } catch {
      localStorage.removeItem(storageKey(pipelineId));
      return initialDraft(pipelineId);
    }

    if (
      draft.definition.schemaVersion === '0.1' &&
      draft.definition.nodeCatalogVersion === '0.1'
    ) {
      const migrated = {
        ...draft,
        definition: migrateDefinition(draft.definition),
      };
      const backupKey = `${storageKey(pipelineId)}:backup:0.1`;
      if (localStorage.getItem(backupKey) === null) {
        localStorage.setItem(backupKey, stored);
      }
      localStorage.setItem(storageKey(pipelineId), JSON.stringify(migrated));
      return migrated;
    }

    return draft;
  }

  async saveDraft(draft: PipelineDraft) {
    localStorage.setItem(storageKey(draft.pipelineId), JSON.stringify(draft));
  }

  async resetDraft(pipelineId: string) {
    localStorage.removeItem(storageKey(pipelineId));
    return initialDraft(pipelineId);
  }

  async validateDraft(draft: PipelineDraft) {
    return validateDefinition(draft.definition, mockNodeCatalog);
  }
}

export const localPipelineRepository = new LocalPipelineRepository();
