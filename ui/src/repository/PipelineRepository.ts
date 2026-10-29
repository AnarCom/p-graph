import type {
  NodeCatalog,
  PipelineDraft,
  ValidationResult,
} from '../domain/pipeline';

export interface PipelineRepository {
  getNodeCatalog(version?: string): Promise<NodeCatalog>;
  getDraft(pipelineId: string): Promise<PipelineDraft>;
  saveDraft(draft: PipelineDraft): Promise<void>;
  resetDraft(pipelineId: string): Promise<PipelineDraft>;
  validateDraft(draft: PipelineDraft): Promise<ValidationResult>;
}

