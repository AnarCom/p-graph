import type {
  GraphUi,
  NodeUi,
  PipelineDefinition,
  PipelineEdge,
  PipelineNode,
} from '../domain/pipeline';

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return structuredClone(value);
}

function serializeNode(node: PipelineNode): PipelineNode {
  return {
    id: node.id,
    type: node.type,
    typeVersion: node.typeVersion,
    ...(node.title === undefined ? {} : { title: node.title }),
    config: cloneRecord(node.config),
    ...(node.ui === undefined
      ? {}
      : { ui: cloneRecord(node.ui) as NodeUi }),
  };
}

function serializeEdge(edge: PipelineEdge): PipelineEdge {
  return {
    id: edge.id,
    source: {
      nodeId: edge.source.nodeId,
      port: edge.source.port,
    },
    target: {
      nodeId: edge.target.nodeId,
      port: edge.target.port,
    },
  };
}

export function serializeDefinition(
  definition: PipelineDefinition,
): PipelineDefinition {
  return {
    schemaVersion: definition.schemaVersion,
    nodeCatalogVersion: definition.nodeCatalogVersion,
    inputs: structuredClone(definition.inputs),
    nodes: definition.nodes.map(serializeNode),
    edges: definition.edges.map(serializeEdge),
    ...(definition.ui === undefined
      ? {}
      : { ui: cloneRecord(definition.ui) as GraphUi }),
  };
}

export function toBackendJson(definition: PipelineDefinition): string {
  return JSON.stringify(serializeDefinition(definition), null, 2);
}

