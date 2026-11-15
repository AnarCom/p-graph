import { beforeEach, describe, expect, it } from 'vitest';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { sampleDraft } from '../mocks/sampleDraft';
import { useEditorStore } from './store';

describe('editor store', () => {
  beforeEach(() => {
    useEditorStore.getState().hydrate(sampleDraft.definition, mockNodeCatalog);
  });

  it('does not mark the draft dirty for an unchanged viewport', () => {
    const viewport = sampleDraft.definition.ui?.viewport;
    if (!viewport) throw new Error('Fixture has no viewport');

    useEditorStore.getState().updateViewport({ ...viewport });

    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('does not mark the draft dirty when the camera moves', () => {
    const viewport = sampleDraft.definition.ui?.viewport;
    if (!viewport) throw new Error('Fixture has no viewport');

    useEditorStore.getState().updateViewport({
      ...viewport,
      x: viewport.x + 24,
    });

    expect(useEditorStore.getState().definition?.ui?.viewport).toEqual({
      ...viewport,
      x: viewport.x + 24,
    });
    expect(useEditorStore.getState().dirty).toBe(false);
  });

  it('adds a dragged node at the requested canvas position', () => {
    const nodeType = mockNodeCatalog.nodeTypes[0];
    if (!nodeType) throw new Error('Fixture has no node types');

    useEditorStore.getState().addNode(nodeType, { x: 512, y: 256 });

    const addedNode = useEditorStore.getState().definition?.nodes.at(-1);
    expect(addedNode?.ui?.position).toEqual({ x: 512, y: 256 });
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('selects and removes only the chosen edge without deleting its nodes', () => {
    useEditorStore.getState().selectNode('python-read');
    useEditorStore.getState().selectEdge('edge-input-read');
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
    expect(useEditorStore.getState().dirty).toBe(false);

    useEditorStore.getState().removeEdge('edge-input-read');
    const state = useEditorStore.getState();
    expect(state.selectedEdgeId).toBeNull();
    expect(state.definition?.nodes).toEqual(sampleDraft.definition.nodes);
    expect(state.definition?.edges).toEqual(
      sampleDraft.definition.edges.filter(
        (edge) => edge.id !== 'edge-input-read',
      ),
    );
    expect(state.dirty).toBe(true);
  });

  it('clears edge selection when selecting a node or loading a draft', () => {
    useEditorStore.getState().selectEdge('edge-input-read');
    useEditorStore.getState().selectNode('python-read');
    expect(useEditorStore.getState().selectedEdgeId).toBeNull();
    useEditorStore.getState().selectEdge('edge-input-read');
    useEditorStore.getState().hydrate(sampleDraft.definition, mockNodeCatalog);
    expect(useEditorStore.getState().selectedEdgeId).toBeNull();
  });
});
