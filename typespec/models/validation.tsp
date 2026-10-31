namespace PGraph {
  union ValidationLocationKind {
    "graph",
    "node",
    "port",
    "edge",
    "config",
  }

  model ValidationLocation {
    kind: ValidationLocationKind;
    nodeId?: string;
    edgeId?: string;
    port?: string;
    configPath?: string;
  }

  model ValidationIssue {
    code: string;
    message: string;
    location: ValidationLocation;
  }

  model ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
  }
}
