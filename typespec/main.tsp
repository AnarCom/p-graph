import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{
  title: "p-graph API",
})
namespace PGraph;

model HealthResponse {
  status: string;
}

@route("/health")
@get
op health(): HealthResponse;
