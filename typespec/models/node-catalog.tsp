namespace PGraph {
  union NodeTypeStatus {
    "active",
    "deprecated",
    "disabled",
  }

  model InputPortDefinition {
    name: string;
    title: string;
    dataType: string;
    minConnections?: int32;
    maxConnections?: int32 | null;
  }

  model OutputPortDefinition {
    name: string;
    title: string;
    dataType: string;
  }

  union ConfigValueType {
    "string",
    "number",
    "integer",
    "boolean",
  }

  model ConfigPropertySchema {
    type: ConfigValueType;
    title?: string;
    description?: string;
    default?: string | numeric | boolean;
    "enum"?: (string | numeric | boolean)[];
  }

  model ConfigSchema {
    "$schema"?: string;
    type: "object";
    properties: Record<ConfigPropertySchema>;
    required?: string[];
    additionalProperties?: boolean;
  }

  model NodeTypeDefinition {
    type: string;
    version: int32;
    title: string;
    description?: string;
    category: string;
    status: NodeTypeStatus;
    inputs: InputPortDefinition[];
    outputs: OutputPortDefinition[];
    configSchema: ConfigSchema;
  }

  model NodeCatalog {
    catalogVersion: string;
    nodeTypes: NodeTypeDefinition[];
  }
}
