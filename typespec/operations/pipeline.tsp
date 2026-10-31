import "../models/node-catalog.tsp";
import "../models/pipeline.tsp";
import "../models/validation.tsp";

using TypeSpec.Http;

namespace PGraph {
  @error
  model NodeCatalogNotFound {
    @statusCode code: 404;
    message: string;
  }

  @error
  model PipelineNotFound {
    @statusCode code: 404;
    message: string;
  }

  @error
  model DraftConflict {
    @statusCode code: 409;
    message: string;
  }

  // getNodeCatalog(version?: string)
  @route("/node-catalog")
  @get
  op getNodeCatalog(
    @query version?: string;
  ): NodeCatalog | NodeCatalogNotFound;

  // getDraft(pipelineId: string)
  @route("/pipelines/{pipelineId}/draft")
  @get
  op getDraft(
    @path pipelineId: string;
  ): PipelineDraft | PipelineNotFound;

  // saveDraft(draft: PipelineDraft)
  @route("/pipelines/{pipelineId}/draft")
  @put
  op saveDraft(
    @path pipelineId: string;
    @body draft: PipelineDraft;
  ): void | PipelineNotFound | DraftConflict;

  // resetDraft(pipelineId: string): PipelineDraft
  @route("/pipelines/{pipelineId}/draft")
  @delete
  op resetDraft(
    @path pipelineId: string;
  ): PipelineDraft | PipelineNotFound;

  // validateDraft(draft: PipelineDraft): ValidationResult
  @route("/pipelines/{pipelineId}/validate")
  @post
  op validateDraft(
    @path pipelineId: string;
    @body definition: PipelineDefinition;
  ): ValidationResult | PipelineNotFound;
}
