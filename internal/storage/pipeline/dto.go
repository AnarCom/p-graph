package pipelineStorage

import (
	"encoding/json"
	"fmt"
	"slices"

	"github.com/AnarCom/p-graph/internal/model"
)

type definitionDTO struct {
	SchemaVersion      string              `json:"schemaVersion"`
	NodeCatalogVersion string              `json:"nodeCatalogVersion"`
	Inputs             map[string]inputDTO `json:"inputs"`
	Nodes              []nodeDTO           `json:"nodes"`
	Edges              []edgeDTO           `json:"edges"`
	UI                 *graphUIDTO         `json:"ui,omitempty"`
}

type inputDTO struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Required bool   `json:"required"`
}

type nodeDTO struct {
	ID          string         `json:"id"`
	Type        string         `json:"type"`
	TypeVersion int32          `json:"typeVersion"`
	Title       *string        `json:"title,omitempty"`
	Config      map[string]any `json:"config"`
	UI          *nodeUIDTO     `json:"ui,omitempty"`
}

type edgeDTO struct {
	ID     string      `json:"id"`
	Source endpointDTO `json:"source"`
	Target endpointDTO `json:"target"`
}

type endpointDTO struct {
	NodeID string `json:"nodeId"`
	Port   string `json:"port"`
}

type nodeUIDTO struct {
	Position *positionDTO
	Extra    map[string]any
}

type graphUIDTO struct {
	Viewport *viewportDTO
	Extra    map[string]any
}

type positionDTO struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type viewportDTO struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

func (u *nodeUIDTO) UnmarshalJSON(data []byte) error {
	var known struct {
		Position *positionDTO `json:"position"`
	}
	if err := json.Unmarshal(data, &known); err != nil {
		return err
	}
	extra, err := extraKeys(data, "position")
	if err != nil {
		return err
	}
	u.Position = known.Position
	u.Extra = extra
	return nil
}

func (u nodeUIDTO) MarshalJSON() ([]byte, error) {
	out := make(map[string]any, len(u.Extra)+1)
	for k, v := range u.Extra {
		out[k] = v
	}
	if u.Position != nil {
		out["position"] = u.Position
	}
	return json.Marshal(out)
}

func (u *graphUIDTO) UnmarshalJSON(data []byte) error {
	var known struct {
		Viewport *viewportDTO `json:"viewport"`
	}
	if err := json.Unmarshal(data, &known); err != nil {
		return err
	}
	extra, err := extraKeys(data, "viewport")
	if err != nil {
		return err
	}
	u.Viewport = known.Viewport
	u.Extra = extra
	return nil
}

func (u graphUIDTO) MarshalJSON() ([]byte, error) {
	out := make(map[string]any, len(u.Extra)+1)
	for k, v := range u.Extra {
		out[k] = v
	}
	if u.Viewport != nil {
		out["viewport"] = u.Viewport
	}
	return json.Marshal(out)
}

func extraKeys(data []byte, known ...string) (map[string]any, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	extra := make(map[string]any, len(raw))
	for key, value := range raw {
		if slices.Contains(known, key) {
			continue
		}
		var decoded any
		if err := json.Unmarshal(value, &decoded); err != nil {
			return nil, err
		}
		extra[key] = decoded
	}
	return extra, nil
}

func draftFromJSON(pipelineID string, baseRevision *int64, data []byte) (model.PipelineDraft, error) {
	var dto definitionDTO
	if err := json.Unmarshal(data, &dto); err != nil {
		return model.PipelineDraft{}, fmt.Errorf("unmarshal definition: %w", err)
	}
	return model.PipelineDraft{
		PipelineID:   pipelineID,
		BaseRevision: baseRevision,
		Definition:   dto.toModel(),
	}, nil
}

func definitionFromModel(d model.PipelineDefinition) definitionDTO {
	inputs := make(map[string]inputDTO, len(d.Inputs))
	for name, in := range d.Inputs {
		inputs[name] = inputDTO{Type: in.Type, Title: in.Title, Required: in.Required}
	}
	nodes := make([]nodeDTO, 0, len(d.Nodes))
	for _, n := range d.Nodes {
		nodes = append(nodes, nodeFromModel(n))
	}
	edges := make([]edgeDTO, 0, len(d.Edges))
	for _, e := range d.Edges {
		edges = append(edges, edgeDTO{
			ID:     e.ID,
			Source: endpointDTO{NodeID: e.Source.NodeID, Port: e.Source.Port},
			Target: endpointDTO{NodeID: e.Target.NodeID, Port: e.Target.Port},
		})
	}
	var ui *graphUIDTO
	if d.UI != nil {
		ui = &graphUIDTO{Viewport: viewportFromModel(d.UI.Viewport), Extra: d.UI.Extra}
	}
	return definitionDTO{
		SchemaVersion:      d.SchemaVersion,
		NodeCatalogVersion: d.NodeCatalogVersion,
		Inputs:             inputs,
		Nodes:              nodes,
		Edges:              edges,
		UI:                 ui,
	}
}

func (d definitionDTO) toModel() model.PipelineDefinition {
	inputs := make(map[string]model.PipelineInput, len(d.Inputs))
	for name, in := range d.Inputs {
		inputs[name] = model.PipelineInput{Type: in.Type, Title: in.Title, Required: in.Required}
	}
	nodes := make([]model.PipelineNode, 0, len(d.Nodes))
	for _, n := range d.Nodes {
		nodes = append(nodes, n.toModel())
	}
	edges := make([]model.PipelineEdge, 0, len(d.Edges))
	for _, e := range d.Edges {
		edges = append(edges, model.PipelineEdge{
			ID:     e.ID,
			Source: model.EdgeEndpoint{NodeID: e.Source.NodeID, Port: e.Source.Port},
			Target: model.EdgeEndpoint{NodeID: e.Target.NodeID, Port: e.Target.Port},
		})
	}
	var ui *model.GraphUI
	if d.UI != nil {
		ui = &model.GraphUI{Viewport: d.UI.Viewport.toModel(), Extra: d.UI.Extra}
	}
	return model.PipelineDefinition{
		SchemaVersion:      d.SchemaVersion,
		NodeCatalogVersion: d.NodeCatalogVersion,
		Inputs:             inputs,
		Nodes:              nodes,
		Edges:              edges,
		UI:                 ui,
	}
}

func nodeFromModel(n model.PipelineNode) nodeDTO {
	var ui *nodeUIDTO
	if n.UI != nil {
		ui = &nodeUIDTO{Position: positionFromModel(n.UI.Position), Extra: n.UI.Extra}
	}
	return nodeDTO{
		ID:          n.ID,
		Type:        n.Type,
		TypeVersion: n.TypeVersion,
		Title:       n.Title,
		Config:      n.Config,
		UI:          ui,
	}
}

func (n nodeDTO) toModel() model.PipelineNode {
	var ui *model.NodeUI
	if n.UI != nil {
		ui = &model.NodeUI{Position: n.UI.Position.toModel(), Extra: n.UI.Extra}
	}
	return model.PipelineNode{
		ID:          n.ID,
		Type:        n.Type,
		TypeVersion: n.TypeVersion,
		Title:       n.Title,
		Config:      n.Config,
		UI:          ui,
	}
}

func positionFromModel(p *model.Position) *positionDTO {
	if p == nil {
		return nil
	}
	return &positionDTO{X: p.X, Y: p.Y}
}

func (p *positionDTO) toModel() *model.Position {
	if p == nil {
		return nil
	}
	return &model.Position{X: p.X, Y: p.Y}
}

func viewportFromModel(v *model.Viewport) *viewportDTO {
	if v == nil {
		return nil
	}
	return &viewportDTO{X: v.X, Y: v.Y, Zoom: v.Zoom}
}

func (v *viewportDTO) toModel() *model.Viewport {
	if v == nil {
		return nil
	}
	return &model.Viewport{X: v.X, Y: v.Y, Zoom: v.Zoom}
}
