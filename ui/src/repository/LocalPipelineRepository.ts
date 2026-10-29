import type { PipelineDraft } from '../domain/pipeline';
import { validateDefinition } from '../editor/validation';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import type { PipelineRepository } from './PipelineRepository';

const storageKey = (pipelineId: string) =>
  `p-graph:mock-draft:${pipelineId}:v1`;

function cloneDraft(draft: PipelineDraft): PipelineDraft {
  return structuredClone(draft);
}

export class LocalPipelineRepository implements PipelineRepository {
  async getNodeCatalog(version?: string) {
    if (version && version !== mockNodeCatalog.catalogVersion) {
      throw new Error(`Mock-каталог версии ${version} не найден`);
    }

    return structuredClone(mockNodeCatalog);
  }

  async getDraft(pipelineId: string) {
    const stored = localStorage.getItem(storageKey(pipelineId));

    if (!stored) return cloneDraft(sampleDraft);

    try {
      return JSON.parse(stored) as PipelineDraft;
    } catch {
      localStorage.removeItem(storageKey(pipelineId));
      return cloneDraft(sampleDraft);
    }
  }

  async saveDraft(draft: PipelineDraft) {
    localStorage.setItem(storageKey(draft.pipelineId), JSON.stringify(draft));
  }

  async resetDraft(pipelineId: string) {
    localStorage.removeItem(storageKey(pipelineId));
    return cloneDraft(sampleDraft);
  }

  async validateDraft(draft: PipelineDraft) {
    return validateDefinition(draft.definition, mockNodeCatalog);
  }
}

export const localPipelineRepository = new LocalPipelineRepository();

