import type {
  NodeCatalog,
  NodeLogs,
  PipelineDraft,
  ValidationResult,
} from '../domain/pipeline';

export interface PipelineRepository {
  getNodeLogs(runId: string, nodeId: string): Promise<NodeLogs | null>;
  getNodeCatalog(version?: string): Promise<NodeCatalog>;
  getDraft(pipelineId: string): Promise<PipelineDraft>;
  saveDraft(draft: PipelineDraft): Promise<void>;
  resetDraft(pipelineId: string): Promise<PipelineDraft>;
  validateDraft(draft: PipelineDraft): Promise<ValidationResult>;
}
