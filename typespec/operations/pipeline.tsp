import "@typespec/openapi";

import "../models/node-catalog.tsp";
import "../models/pipeline.tsp";
import "../models/validation.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace PGraph.Apiserver {
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

  @operationId("getNodeCatalog")
  @tag("apiserver")
  @route("/node-catalog")
  @get
  op getNodeCatalog(
    @query version?: string;
  ): NodeCatalog | NodeCatalogNotFound;

  @operationId("getDraft")
  @tag("apiserver")
  @route("/pipelines/{pipelineId}/draft")
  @get
  op getDraft(
    @path pipelineId: string;
  ): PipelineDraft | PipelineNotFound;

  @operationId("saveDraft")
  @tag("apiserver")
  @route("/pipelines/{pipelineId}/draft")
  @put
  op saveDraft(
    @path pipelineId: string;
    @body draft: PipelineDraft;
  ): void | PipelineNotFound | DraftConflict;

  @operationId("resetDraft")
  @tag("apiserver")
  @route("/pipelines/{pipelineId}/draft")
  @delete
  op resetDraft(
    @path pipelineId: string;
  ): PipelineDraft | PipelineNotFound;

  @operationId("validateDraft")
  @tag("apiserver")
  @route("/pipelines/{pipelineId}/validate")
  @post
  op validateDraft(
    @path pipelineId: string;
    @body definition: PipelineDefinition;
  ): ValidationResult | PipelineNotFound;
}
