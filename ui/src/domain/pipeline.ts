export type NodeTypeStatus = 'active' | 'deprecated' | 'disabled';

export interface PipelineInput {
  type: string;
  title: string;
  required: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Viewport extends Position {
  zoom: number;
}

export interface NodeUi extends Record<string, unknown> {
  position?: Position;
}

export interface GraphUi extends Record<string, unknown> {
  viewport?: Viewport;
}

export interface PipelineNode {
  id: string;
  type: string;
  typeVersion: number;
  title?: string;
  config: Record<string, unknown>;
  ui?: NodeUi;
}

export interface EdgeEndpoint {
  nodeId: string;
  port: string;
}

export interface PipelineEdge {
  id: string;
  source: EdgeEndpoint;
  target: EdgeEndpoint;
}

export interface PipelineDefinition {
  schemaVersion: string;
  nodeCatalogVersion: string;
  inputs: Record<string, PipelineInput>;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  ui?: GraphUi;
}

export interface PipelineDraft {
  pipelineId: string;
  baseRevision: number | null;
  definition: PipelineDefinition;
}

export interface PortDefinition {
  name: string;
  title: string;
  dataType: string;
  minConnections?: number;
  maxConnections?: number | null;
}

export type ConfigValueType = 'string' | 'number' | 'integer' | 'boolean';

export interface ConfigPropertySchema {
  type: ConfigValueType;
  title?: string;
  description?: string;
  default?: string | number | boolean;
  enum?: Array<string | number | boolean>;
}

export interface ConfigSchema {
  $schema?: string;
  type: 'object';
  properties: Record<string, ConfigPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface NodeTypeDefinition {
  type: string;
  version: number;
  title: string;
  description?: string;
  category: string;
  status: NodeTypeStatus;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  configSchema: ConfigSchema;
}

export interface NodeCatalog {
  catalogVersion: string;
  nodeTypes: NodeTypeDefinition[];
}

export type ValidationLocationKind =
  | 'graph'
  | 'node'
  | 'port'
  | 'edge'
  | 'config';

export interface ValidationLocation {
  kind: ValidationLocationKind;
  nodeId?: string;
  edgeId?: string;
  port?: string;
  configPath?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  location: ValidationLocation;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

