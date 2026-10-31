import "@typespec/http";
import "@typespec/openapi3";

import "./operations/pipeline.tsp";

using TypeSpec.Http;

@service(#{
  title: "p-graph API",
})
namespace PGraph {
  model HealthResponse {
    status: string;
  }

  @route("/health")
  @get
  op health(): HealthResponse;
}
