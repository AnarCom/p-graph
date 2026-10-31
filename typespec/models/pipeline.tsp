namespace PGraph {
  model PipelineInput {
    type: string;
    title: string;
    required: boolean;
  }

  model Position {
    x: float64;
    y: float64;
  }

  model Viewport extends Position {
    zoom: float64;
  }

  model NodeUi extends Record<unknown> {
    position?: Position;
  }

  model GraphUi extends Record<unknown> {
    viewport?: Viewport;
  }

  model PipelineNode {
    id: string;
    type: string;
    typeVersion: int32;
    title?: string;
    config: Record<unknown>;
    ui?: NodeUi;
  }

  model EdgeEndpoint {
    nodeId: string;
    port: string;
  }

  model PipelineEdge {
    id: string;
    source: EdgeEndpoint;
    target: EdgeEndpoint;
  }

  model PipelineDefinition {
    schemaVersion: string;
    nodeCatalogVersion: string;
    inputs: Record<PipelineInput>;
    nodes: PipelineNode[];
    edges: PipelineEdge[];
    ui?: GraphUi;
  }

  model PipelineDraft {
    pipelineId: string;
    baseRevision: int64 | null;
    definition: PipelineDefinition;
  }
}
