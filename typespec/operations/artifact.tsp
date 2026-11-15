import "@typespec/openapi";

import "../models/artifact.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace PGraph.Apiserver {
  @error
  model ArtifactNotFound {
    @statusCode code: 404;
    message: string;
  }

  @error
  model InvalidArtifactRequest {
    @statusCode code: 400;
    message: string;
  }

  @operationId("uploadArtifact")
  @tag("apiserver")
  @route("/artifacts")
  @post
  op uploadArtifact(
    @header `content-type`: "multipart/form-data",
    @multipartBody body: { file: HttpPart<File>; },
  ): Artifact | InvalidArtifactRequest;

  @operationId("listArtifacts")
  @tag("apiserver")
  @route("/artifacts")
  @get
  op listArtifacts(): Artifact[];

  @operationId("getArtifact")
  @tag("apiserver")
  @route("/artifacts/{artifactId}")
  @get
  op getArtifact(
    @path artifactId: string;
  ): Artifact | ArtifactNotFound;

  @operationId("deleteArtifact")
  @tag("apiserver")
  @route("/artifacts/{artifactId}")
  @delete
  op deleteArtifact(
    @path artifactId: string;
  ): void | ArtifactNotFound;
}
