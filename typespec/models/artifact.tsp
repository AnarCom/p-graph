namespace PGraph {
  model Artifact {
    artifactId: string;
    filename: string;
    contentType: string;
    size: int64;
    createdAt: utcDateTime;
  }
}
