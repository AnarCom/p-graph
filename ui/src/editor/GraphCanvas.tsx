import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { NodeTypeDefinition } from '../domain/pipeline';
import { useEditorStore } from './store';
import {
  PipelineNodeView,
  type PipelineFlowNode,
} from './PipelineNodeView';
import { decodeNodeTypeDrag, nodeTypeDragMime } from './paletteDrag';
import { arePortTypesCompatible } from './portCompatibility';

const nodeTypes = {
  pipeline: PipelineNodeView,
};

function handlePort(handleId: string | null | undefined): string | null {
  if (!handleId) return null;
  return handleId.split(':').slice(1).join(':') || null;
}

function findNodeType(
  catalog: ReturnType<typeof useEditorStore.getState>['catalog'],
  type: string,
  version: number,
): NodeTypeDefinition | undefined {
  return catalog?.nodeTypes.find(
    (candidate) => candidate.type === type && candidate.version === version,
  );
}

interface GraphCanvasProps {
  onInvalidConnection: () => void;
  onOpenSettings: () => void;
  focusRequest: NodeFocusRequest | null;
}

export interface NodeFocusRequest {
  nodeId: string;
  requestId: number;
}

export function GraphCanvas({
  onInvalidConnection,
  onOpenSettings,
  focusRequest,
}: GraphCanvasProps) {
  const [instance, setInstance] = useState<
    ReactFlowInstance<PipelineFlowNode, Edge> | undefined
  >();
  const definition = useEditorStore((state) => state.definition);
  const catalog = useEditorStore((state) => state.catalog);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const issues = useEditorStore((state) => state.issues);
  const selectNode = useEditorStore((state) => state.selectNode);
  const addNode = useEditorStore((state) => state.addNode);
  const updateNodePosition = useEditorStore(
    (state) => state.updateNodePosition,
  );
  const removeNode = useEditorStore((state) => state.removeNode);
  const connect = useEditorStore((state) => state.connect);
  const removeEdge = useEditorStore((state) => state.removeEdge);
  const updateViewport = useEditorStore((state) => state.updateViewport);

  useEffect(() => {
    if (!instance || !focusRequest) return;

    const node = definition?.nodes.find(
      (candidate) => candidate.id === focusRequest.nodeId,
    );
    const position = node?.ui?.position;
    if (!position) return;

    void instance.setCenter(position.x + 116, position.y + 52, {
      zoom: 1.1,
      duration: 450,
    });
  }, [definition?.nodes, focusRequest, instance]);

  const nodes = useMemo<PipelineFlowNode[]>(
    () =>
      (definition?.nodes ?? []).map((node) => ({
        id: node.id,
        type: 'pipeline',
        position: node.ui?.position ?? { x: 80, y: 80 },
        selected: selectedNodeId === node.id,
        data: {
          node,
          nodeType: findNodeType(catalog, node.type, node.typeVersion),
          issues: issues.filter(
            (current) => current.location.nodeId === node.id,
          ),
        },
      })),
    [catalog, definition?.nodes, issues, selectedNodeId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      (definition?.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.source.nodeId,
        sourceHandle: `output:${edge.source.port}`,
        target: edge.target.nodeId,
        targetHandle: `input:${edge.target.port}`,
        type: 'smoothstep',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: '#8b5cf6',
        },
        style: {
          stroke: issues.some(
            (current) => current.location.edgeId === edge.id,
          )
            ? '#fb7185'
            : '#8b5cf6',
          strokeWidth: 2,
        },
      })),
    [definition?.edges, issues],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      if (!definition || !catalog) return false;
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = definition.nodes.find(
        (node) => node.id === connection.source,
      );
      const targetNode = definition.nodes.find(
        (node) => node.id === connection.target,
      );
      if (!sourceNode || !targetNode) return false;

      const sourceType = findNodeType(
        catalog,
        sourceNode.type,
        sourceNode.typeVersion,
      );
      const targetType = findNodeType(
        catalog,
        targetNode.type,
        targetNode.typeVersion,
      );
      const sourcePortName = handlePort(connection.sourceHandle);
      const targetPortName = handlePort(connection.targetHandle);
      const sourcePort = sourceType?.outputs.find(
        (port) => port.name === sourcePortName,
      );
      const targetPort = targetType?.inputs.find(
        (port) => port.name === targetPortName,
      );
      if (!sourcePort || !targetPort) return false;
      if (!arePortTypesCompatible(sourcePort.dataType, targetPort.dataType)) {
        return false;
      }

      const incomingCount = definition.edges.filter(
        (edge) =>
          edge.target.nodeId === connection.target &&
          edge.target.port === targetPortName,
      ).length;

      return (
        targetPort.maxConnections === null ||
        targetPort.maxConnections === undefined ||
        incomingCount < targetPort.maxConnections
      );
    },
    [catalog, definition],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) {
        onInvalidConnection();
        return;
      }

      const sourcePort = handlePort(connection.sourceHandle);
      const targetPort = handlePort(connection.targetHandle);
      if (
        connection.source &&
        connection.target &&
        sourcePort &&
        targetPort
      ) {
        connect(
          connection.source,
          sourcePort,
          connection.target,
          targetPort,
        );
      }
    },
    [connect, isValidConnection, onInvalidConnection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<PipelineFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateNodePosition(change.id, change.position);
        }
        if (change.type === 'remove') removeNode(change.id);
        if (change.type === 'select' && change.selected) selectNode(change.id);
      }
    },
    [removeNode, selectNode, updateNodePosition],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') removeEdge(change.id);
      }
    },
    [removeEdge],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(nodeTypeDragMime)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!instance || !catalog) return;

      const payload = decodeNodeTypeDrag(
        event.dataTransfer.getData(nodeTypeDragMime),
      );
      if (!payload) return;

      const nodeType = catalog.nodeTypes.find(
        (candidate) =>
          candidate.type === payload.type &&
          candidate.version === payload.version &&
          candidate.status !== 'disabled',
      );
      if (!nodeType) return;

      const dropPoint = instance.screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: true },
      );
      const position = {
        x: dropPoint.x - 116,
        y: dropPoint.y - 40,
      };
      addNode(nodeType, position);
      onOpenSettings();
    },
    [addNode, catalog, instance, onOpenSettings],
  );

  if (!definition) return null;

  return (
    <div
      className="graph-drop-zone"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<PipelineFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => {
          selectNode(node.id);
          onOpenSettings();
        }}
        onPaneClick={() => selectNode(null)}
        onMoveEnd={(event, viewport) => {
          if (event) updateViewport(viewport);
        }}
        defaultViewport={definition.ui?.viewport}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.25}
        maxZoom={1.8}
        snapToGrid
        snapGrid={[16, 16]}
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.35}
          color="rgba(148, 163, 184, 0.24)"
        />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor="#8b5cf6"
          maskColor="rgba(5, 8, 16, 0.72)"
        />
      </ReactFlow>
    </div>
  );
}

