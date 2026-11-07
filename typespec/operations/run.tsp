import "@typespec/openapi";

import "../models/run.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace PGraph.Scheduler {
  @error
  model InvalidRunRequest {
    @statusCode code: 400;
    message: string;
  }

  @operationId("runPipeline")
  @tag("scheduler")
  @route("/pipeline/run")
  @post
  op runPipeline(
    @body request: RunPipelineRequest;
  ): Run | InvalidRunRequest;
}
