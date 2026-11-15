import type {
  NodeCatalog,
  PipelineNode,
  PortDefinition,
} from '../domain/pipeline';

// One resolver for canvas, inspector, validation and connection commands.
export function resolveNodeType(catalog: NodeCatalog, node: PipelineNode) {
  const type = catalog.nodeTypes.find(
    (candidate) =>
      candidate.type === node.type && candidate.version === node.typeVersion,
  );
  if (!type) return undefined;
  return {
    ...type,
    inputs: type.editablePorts ? (node.inputs ?? type.inputs) : type.inputs,
    outputs: type.editablePorts ? (node.outputs ?? type.outputs) : type.outputs,
  };
}

export function validPortDefinitions(ports: PortDefinition[], input: boolean) {
  const names = new Set<string>();
  return ports.every((port) => {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(port.name) ||
      names.has(port.name) ||
      !port.title.trim() ||
      !port.dataType.trim()
    )
      return false;
    names.add(port.name);
    if (!input) return true;
    const min = port.minConnections ?? 0;
    const max = port.maxConnections;
    return (
      Number.isInteger(min) &&
      min >= 0 &&
      (max == null || (Number.isInteger(max) && max >= min))
    );
  });
}
