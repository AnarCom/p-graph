import { create } from 'zustand';
import type {
  NodeCatalog,
  NodeTypeDefinition,
  PipelineDefinition,
  ValidationIssue,
  Viewport,
} from '../domain/pipeline';

interface EditorStore {
  definition: PipelineDefinition | null;
  catalog: NodeCatalog | null;
  selectedNodeId: string | null;
  issues: ValidationIssue[];
  dirty: boolean;
  hydrate: (definition: PipelineDefinition, catalog: NodeCatalog) => void;
  addNode: (
    nodeType: NodeTypeDefinition,
    position?: { x: number; y: number },
  ) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  updateNodeTitle: (nodeId: string, title: string) => void;
  updateNodeConfig: (nodeId: string, name: string, value: unknown) => void;
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
  issues: [],
  dirty: false,

  hydrate: (definition, catalog) =>
    set({
      definition: structuredClone(definition),
      catalog: structuredClone(catalog),
      selectedNodeId: null,
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
        dirty: true,
        issues: [],
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

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

  connect: (sourceNodeId, sourcePort, targetNodeId, targetPort) =>
    set((state) => {
      if (!state.definition) return state;

      const duplicate = state.definition.edges.some(
        (edge) =>
          edge.source.nodeId === sourceNodeId &&
          edge.source.port === sourcePort &&
          edge.target.nodeId === targetNodeId &&
          edge.target.port === targetPort,
      );
      if (duplicate) return state;

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

