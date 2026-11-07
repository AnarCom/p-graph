import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

import "./operations/pipeline.tsp";
import "./operations/run.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{
  title: "p-graph API",
})
@server(
  "http://apiserver.local"
)
namespace PGraph {
  model HealthResponse {
    status: string;
  }

  @operationId("health")
  @tag("apiserver")
  @tag("scheduler")
  @route("/health")
  @get
  op health(): HealthResponse;
}
