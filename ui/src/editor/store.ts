import { create } from 'zustand';
import { resolveNodeType } from './nodePorts';
import { canConnect } from './connections';
import type {
  NodeCatalog,
  NodeTypeDefinition,
  PipelineDefinition,
  PythonImplementation,
  PortDefinition,
  ValidationIssue,
  Viewport,
} from '../domain/pipeline';

interface EditorStore {
  definition: PipelineDefinition | null;
  catalog: NodeCatalog | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  issues: ValidationIssue[];
  dirty: boolean;
  hydrate: (definition: PipelineDefinition, catalog: NodeCatalog) => void;
  addNode: (
    nodeType: NodeTypeDefinition,
    position?: { x: number; y: number },
  ) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  updateNodeTitle: (nodeId: string, title: string) => void;
  updateNodeConfig: (nodeId: string, name: string, value: unknown) => void;
  updateNodePorts: (
    nodeId: string,
    direction: 'inputs' | 'outputs',
    ports: PortDefinition[],
    renamed?: Record<string, string>,
  ) => void;
  updateNodeCode: (nodeId: string, code: string) => void;
  updateNodeEnvironment: (
    nodeId: string,
    patch: Pick<PythonImplementation, 'pythonVersion' | 'requirements'>,
  ) => void;
  connect: (
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string,
  ) => void;
  removeEdge: (edgeId: string) => void;
  updateViewport: (viewport: Viewport) => void;
  setIssues: (issues: ValidationIssue[]) => void;
  markSaved: () => void;
}

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function initialConfig(nodeType: NodeTypeDefinition): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(nodeType.configSchema.properties)
      .filter(([, property]) => property.default !== undefined)
      .map(([name, property]) => [name, property.default]),
  );
}

export const useEditorStore = create<EditorStore>((set) => ({
  definition: null,
  catalog: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  issues: [],
  dirty: false,

  hydrate: (definition, catalog) =>
    set({
      definition: structuredClone(definition),
      catalog: structuredClone(catalog),
      selectedNodeId: null,
      selectedEdgeId: null,
      issues: [],
      dirty: false,
    }),

  addNode: (nodeType, position) =>
    set((state) => {
      if (!state.definition) return state;

      const index = state.definition.nodes.length;
      const id = randomId(nodeType.type.split('.').at(-1) ?? 'node');

      return {
        definition: {
          ...state.definition,
          nodes: [
            ...state.definition.nodes,
            {
              id,
              type: nodeType.type,
              typeVersion: nodeType.version,
              title: nodeType.title,
              config: initialConfig(nodeType),
              ...(nodeType.editablePorts
                ? {
                    inputs: structuredClone(nodeType.inputs),
                    outputs: structuredClone(nodeType.outputs),
                  }
                : {}),
              ...(nodeType.implementation
                ? { implementation: structuredClone(nodeType.implementation) }
                : {}),
              ui: {
                position: position ?? {
                  x: 160 + (index % 3) * 280,
                  y: 120 + Math.floor(index / 3) * 200,
                },
              },
            },
          ],
        },
        selectedNodeId: id,
        selectedEdgeId: null,
        dirty: true,
        issues: [],
      };
    }),

  removeNode: (nodeId) =>
    set((state) => {
      if (!state.definition) return state;

      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.filter((node) => node.id !== nodeId),
          edges: state.definition.edges.filter(
            (edge) =>
              edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId,
          ),
        },
        selectedNodeId:
          state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId: state.definition.edges.some(
          (edge) =>
            edge.id === state.selectedEdgeId &&
            (edge.source.nodeId === nodeId || edge.target.nodeId === nodeId),
        )
          ? null
          : state.selectedEdgeId,
        dirty: true,
        issues: [],
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  updateNodePosition: (nodeId, position) =>
    set((state) => {
      if (!state.definition) return state;

      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, ui: { ...node.ui, position } }
              : node,
          ),
        },
        dirty: true,
      };
    }),

  updateNodeTitle: (nodeId, title) =>
    set((state) => {
      if (!state.definition) return state;

      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.map((node) =>
            node.id === nodeId ? { ...node, title } : node,
          ),
        },
        dirty: true,
      };
    }),

  updateNodeConfig: (nodeId, name, value) =>
    set((state) => {
      if (!state.definition) return state;

      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, config: { ...node.config, [name]: value } }
              : node,
          ),
        },
        dirty: true,
        issues: state.issues.filter(
          (current) =>
            current.location.nodeId !== nodeId ||
            current.location.configPath !== `/${name}`,
        ),
      };
    }),

  updateNodeCode: (nodeId, code) =>
    set((state) => {
      if (!state.definition) return state;
      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.map((node) =>
            node.id === nodeId && node.type === 'builtin.python'
              ? {
                  ...node,
                  implementation: {
                    ...node.implementation,
                    language: 'python',
                    entrypoint: 'run',
                    code,
                  },
                }
              : node,
          ),
        },
        dirty: true,
        issues: [],
      };
    }),

  updateNodeEnvironment: (nodeId, patch) =>
    set((state) => {
      if (!state.definition) return state;
      return {
        definition: {
          ...state.definition,
          nodes: state.definition.nodes.map((node) =>
            node.id === nodeId && node.type === 'builtin.python'
              ? {
                  ...node,
                  implementation: {
                    language: 'python',
                    entrypoint: 'run',
                    code: '',
                    ...node.implementation,
                    ...structuredClone(patch),
                  },
                }
              : node,
          ),
        },
        dirty: true,
        issues: [],
      };
    }),

  updateNodePorts: (nodeId, direction, ports, renamed) =>
    set((state) => {
      if (!state.definition || !state.catalog) return state;
      const node = state.definition.nodes.find(
        (candidate) => candidate.id === nodeId,
      );
      if (!node || !resolveNodeType(state.catalog, node)?.editablePorts)
        return state;
      const endpoint = direction === 'inputs' ? 'target' : 'source';
      const renames = new Map(Object.entries(renamed ?? {}));
      const names = new Set(ports.map((port) => port.name));
      const edges = state.definition.edges
        .map((edge) => {
          if (
            renames.get(edge[endpoint].port) &&
            edge[endpoint].nodeId === nodeId
          ) {
            return {
              ...edge,
              [endpoint]: { nodeId, port: renames.get(edge[endpoint].port)! },
            };
          }
          return edge;
        })
        .filter(
          (edge) =>
            edge[endpoint].nodeId !== nodeId || names.has(edge[endpoint].port),
        );
      return {
        definition: {
          ...state.definition,
          edges,
          nodes: state.definition.nodes.map((candidate) =>
            candidate.id === nodeId
              ? {
                  ...candidate,
                  [direction]: structuredClone(ports),
                  ...(direction === 'inputs' &&
                  candidate.type === 'builtin.return'
                    ? {
                        outputs: (
                          resolveNodeType(state.catalog!, candidate)?.outputs ??
                          []
                        ).map((output) => {
                          const sourcePort =
                            renames.get(output.sourcePort ?? output.name) ??
                            output.sourcePort ??
                            output.name;
                          const input = ports.find(
                            (port) => port.name === sourcePort,
                          );
                          return {
                            ...output,
                            sourcePort,
                            ...(input ? { dataType: input.dataType } : {}),
                          };
                        }),
                      }
                    : {}),
                }
              : candidate,
          ),
        },
        dirty: true,
        issues: [],
      };
    }),

  connect: (sourceNodeId, sourcePort, targetNodeId, targetPort) =>
    set((state) => {
      if (!state.definition) return state;

      if (
        !state.catalog ||
        !canConnect(
          state.definition,
          state.catalog,
          sourceNodeId,
          sourcePort,
          targetNodeId,
          targetPort,
        )
      )
        return state;

      return {
        definition: {
          ...state.definition,
          edges: [
            ...state.definition.edges,
            {
              id: randomId('edge'),
              source: { nodeId: sourceNodeId, port: sourcePort },
              target: { nodeId: targetNodeId, port: targetPort },
            },
          ],
        },
        dirty: true,
        issues: [],
      };
    }),

  removeEdge: (edgeId) =>
    set((state) => {
      if (!state.definition) return state;
      return {
        definition: {
          ...state.definition,
          edges: state.definition.edges.filter((edge) => edge.id !== edgeId),
        },
        selectedEdgeId:
          state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
        dirty: true,
        issues: [],
      };
    }),

  updateViewport: (viewport) =>
    set((state) => {
      if (!state.definition) return state;

      const current = state.definition.ui?.viewport ?? {
        x: 0,
        y: 0,
        zoom: 1,
      };
      const unchanged =
        Math.abs(current.x - viewport.x) < 0.001 &&
        Math.abs(current.y - viewport.y) < 0.001 &&
        Math.abs(current.zoom - viewport.zoom) < 0.001;

      if (unchanged) return state;

      return {
        definition: {
          ...state.definition,
          ui: { ...state.definition.ui, viewport },
        },
      };
    }),

  setIssues: (issues) => set({ issues }),
  markSaved: () => set({ dirty: false }),
}));
