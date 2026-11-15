import type { NodeCatalog, PipelineDefinition } from '../domain/pipeline';
import { resolveNodeType } from './nodePorts';
import { arePortTypesCompatible } from './portCompatibility';

export function canConnect(
  definition: PipelineDefinition,
  catalog: NodeCatalog,
  sourceId: string,
  sourceName: string,
  targetId: string,
  targetName: string,
) {
  const source = definition.nodes.find((node) => node.id === sourceId);
  const target = definition.nodes.find((node) => node.id === targetId);
  if (
    !source ||
    !target ||
    sourceId === targetId ||
    source.type === 'builtin.return'
  )
    return false;
  const output = resolveNodeType(catalog, source)?.outputs.find(
    (port) => port.name === sourceName,
  );
  const input = resolveNodeType(catalog, target)?.inputs.find(
    (port) => port.name === targetName,
  );
  if (
    !output ||
    !input ||
    !arePortTypesCompatible(output.dataType, input.dataType)
  )
    return false;
  if (
    definition.edges.some(
      (edge) =>
        edge.source.nodeId === sourceId &&
        edge.source.port === sourceName &&
        edge.target.nodeId === targetId &&
        edge.target.port === targetName,
    )
  )
    return false;
  // Capacity belongs to the target input; a source output can feed many inputs.
  const count = definition.edges.filter(
    (edge) =>
      edge.target.nodeId === targetId && edge.target.port === targetName,
  ).length;
  if (input.maxConnections != null && count >= input.maxConnections)
    return false;
  const pending = [targetId];
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === sourceId) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(
      ...definition.edges
        .filter((edge) => edge.source.nodeId === id)
        .map((edge) => edge.target.nodeId),
    );
  }
  return true;
}
