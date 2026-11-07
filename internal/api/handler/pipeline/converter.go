package pipelineHandler

import (
	"fmt"

	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
	"github.com/AnarCom/p-graph/internal/model"
)

func nodeCatalogToGen(c model.NodeCatalog) (gen.NodeCatalog, error) {
	types := make([]gen.NodeTypeDefinition, 0, len(c.NodeTypes))
	for _, nt := range c.NodeTypes {
		converted, err := nodeTypeToGen(nt)
		if err != nil {
			return gen.NodeCatalog{}, err
		}
		types = append(types, converted)
	}
	return gen.NodeCatalog{CatalogVersion: c.CatalogVersion, NodeTypes: types}, nil
}

func nodeTypeToGen(nt model.NodeTypeDefinition) (gen.NodeTypeDefinition, error) {
	inputs := make([]gen.InputPortDefinition, 0, len(nt.Inputs))
	for _, p := range nt.Inputs {
		inputs = append(inputs, gen.InputPortDefinition{
			Name:           p.Name,
			Title:          p.Title,
			DataType:       p.DataType,
			MinConnections: p.MinConnections,
			MaxConnections: p.MaxConnections,
		})
	}
	outputs := make([]gen.OutputPortDefinition, 0, len(nt.Outputs))
	for _, p := range nt.Outputs {
		outputs = append(outputs, gen.OutputPortDefinition{
			Name:     p.Name,
			Title:    p.Title,
			DataType: p.DataType,
		})
	}
	configSchema, err := configSchemaToGen(nt.ConfigSchema)
	if err != nil {
		return gen.NodeTypeDefinition{}, err
	}
	return gen.NodeTypeDefinition{
		Type:         nt.Type,
		Version:      nt.Version,
		Title:        nt.Title,
		Description:  nt.Description,
		Category:     nt.Category,
		Status:       gen.NodeTypeStatus(nt.Status),
		Inputs:       inputs,
		Outputs:      outputs,
		ConfigSchema: configSchema,
	}, nil
}

func configSchemaToGen(cs model.ConfigSchema) (gen.ConfigSchema, error) {
	properties := make(map[string]gen.ConfigPropertySchema, len(cs.Properties))
	for name, p := range cs.Properties {
		converted, err := configPropertyToGen(p)
		if err != nil {
			return gen.ConfigSchema{}, fmt.Errorf("property %q: %w", name, err)
		}
		properties[name] = converted
	}
	return gen.ConfigSchema{
		Schema:               cs.Schema,
		Type:                 gen.ConfigSchemaType(cs.Type),
		Properties:           properties,
		Required:             stringSliceToGen(cs.Required),
		AdditionalProperties: cs.AdditionalProperties,
	}, nil
}

func stringSliceToGen(s []string) *[]string {
	if s == nil {
		return nil
	}
	out := make([]string, len(s))
	copy(out, s)
	return &out
}

func configPropertyToGen(p model.ConfigPropertySchema) (gen.ConfigPropertySchema, error) {
	var def *gen.ConfigPropertySchema_Default
	if p.Default != nil {
		v, err := configValueToGen(p.Default)
		if err != nil {
			return gen.ConfigPropertySchema{}, fmt.Errorf("default: %w", err)
		}
		def = &v
	}
	var enum *[]gen.ConfigPropertySchema_Enum_Item
	if p.Enum != nil {
		items := make([]gen.ConfigPropertySchema_Enum_Item, 0, len(p.Enum))
		for _, e := range p.Enum {
			item, err := configEnumItemToGen(e)
			if err != nil {
				return gen.ConfigPropertySchema{}, fmt.Errorf("enum: %w", err)
			}
			items = append(items, item)
		}
		enum = &items
	}
	return gen.ConfigPropertySchema{
		Type:        gen.ConfigValueType(p.Type),
		Title:       p.Title,
		Description: p.Description,
		Default:     def,
		Enum:        enum,
	}, nil
}

func configValueToGen(v any) (gen.ConfigPropertySchema_Default, error) {
	var u gen.ConfigPropertySchema_Default
	switch t := v.(type) {
	case string:
		return u, u.FromConfigPropertySchemaDefault0(t)
	case float64:
		return u, u.FromConfigPropertySchemaDefault1(float32(t))
	case float32:
		return u, u.FromConfigPropertySchemaDefault1(t)
	case int:
		return u, u.FromConfigPropertySchemaDefault1(float32(t))
	case bool:
		return u, u.FromConfigPropertySchemaDefault2(t)
	default:
		return u, fmt.Errorf("unsupported value type %T", v)
	}
}

func configEnumItemToGen(v any) (gen.ConfigPropertySchema_Enum_Item, error) {
	var u gen.ConfigPropertySchema_Enum_Item
	switch t := v.(type) {
	case string:
		return u, u.FromConfigPropertySchemaEnum0(t)
	case float64:
		return u, u.FromConfigPropertySchemaEnum1(float32(t))
	case float32:
		return u, u.FromConfigPropertySchemaEnum1(t)
	case int:
		return u, u.FromConfigPropertySchemaEnum1(float32(t))
	case bool:
		return u, u.FromConfigPropertySchemaEnum2(t)
	default:
		return u, fmt.Errorf("unsupported value type %T", v)
	}
}

func pipelineDraftToGen(d model.PipelineDraft) (gen.PipelineDraft, error) {
	definition, err := pipelineDefinitionToGen(d.Definition)
	if err != nil {
		return gen.PipelineDraft{}, err
	}
	return gen.PipelineDraft{
		PipelineId:   d.PipelineID,
		BaseRevision: d.BaseRevision,
		Definition:   definition,
	}, nil
}

func pipelineDefinitionToGen(d model.PipelineDefinition) (gen.PipelineDefinition, error) {
	inputs := make(map[string]gen.PipelineInput, len(d.Inputs))
	for name, in := range d.Inputs {
		inputs[name] = gen.PipelineInput{Type: in.Type, Title: in.Title, Required: in.Required}
	}
	nodes := make([]gen.PipelineNode, 0, len(d.Nodes))
	for _, n := range d.Nodes {
		nodes = append(nodes, pipelineNodeToGen(n))
	}
	edges := make([]gen.PipelineEdge, 0, len(d.Edges))
	for _, e := range d.Edges {
		edges = append(edges, gen.PipelineEdge{
			Id:     e.ID,
			Source: gen.EdgeEndpoint{NodeId: e.Source.NodeID, Port: e.Source.Port},
			Target: gen.EdgeEndpoint{NodeId: e.Target.NodeID, Port: e.Target.Port},
		})
	}
	var ui *gen.GraphUi
	if d.UI != nil {
		ui = &gen.GraphUi{Viewport: viewportToGen(d.UI.Viewport), AdditionalProperties: copyMap(d.UI.Extra)}
	}
	return gen.PipelineDefinition{
		SchemaVersion:      d.SchemaVersion,
		NodeCatalogVersion: d.NodeCatalogVersion,
		Inputs:             inputs,
		Nodes:              nodes,
		Edges:              edges,
		Ui:                 ui,
	}, nil
}

func pipelineNodeToGen(n model.PipelineNode) gen.PipelineNode {
	var ui *gen.NodeUi
	if n.UI != nil {
		ui = &gen.NodeUi{Position: positionToGen(n.UI.Position), AdditionalProperties: copyMap(n.UI.Extra)}
	}
	return gen.PipelineNode{
		Id:          n.ID,
		Type:        n.Type,
		TypeVersion: n.TypeVersion,
		Title:       n.Title,
		Config:      copyMap(n.Config),
		Ui:          ui,
	}
}

func viewportToGen(v *model.Viewport) *gen.Viewport {
	if v == nil {
		return nil
	}
	return &gen.Viewport{X: v.X, Y: v.Y, Zoom: v.Zoom}
}

func positionToGen(p *model.Position) *gen.Position {
	if p == nil {
		return nil
	}
	return &gen.Position{X: p.X, Y: p.Y}
}

func validationResultToGen(r model.ValidationResult) gen.ValidationResult {
	issues := make([]gen.ValidationIssue, 0, len(r.Issues))
	for _, i := range r.Issues {
		issues = append(issues, gen.ValidationIssue{
			Code:    i.Code,
			Message: i.Message,
			Location: gen.ValidationLocation{
				Kind:       gen.ValidationLocationKind(i.Location.Kind),
				NodeId:     i.Location.NodeID,
				EdgeId:     i.Location.EdgeID,
				Port:       i.Location.Port,
				ConfigPath: i.Location.ConfigPath,
			},
		})
	}
	return gen.ValidationResult{Valid: r.Valid, Issues: issues}
}

func pipelineDraftFromGen(d gen.PipelineDraft) (model.PipelineDraft, error) {
	definition, err := pipelineDefinitionFromGen(d.Definition)
	if err != nil {
		return model.PipelineDraft{}, err
	}
	return model.PipelineDraft{
		PipelineID:   d.PipelineId,
		BaseRevision: d.BaseRevision,
		Definition:   definition,
	}, nil
}

func pipelineDefinitionFromGen(d gen.PipelineDefinition) (model.PipelineDefinition, error) {
	inputs := make(map[string]model.PipelineInput, len(d.Inputs))
	for name, in := range d.Inputs {
		inputs[name] = model.PipelineInput{Type: in.Type, Title: in.Title, Required: in.Required}
	}
	nodes := make([]model.PipelineNode, 0, len(d.Nodes))
	for _, n := range d.Nodes {
		nodes = append(nodes, pipelineNodeFromGen(n))
	}
	edges := make([]model.PipelineEdge, 0, len(d.Edges))
	for _, e := range d.Edges {
		edges = append(edges, model.PipelineEdge{
			ID:     e.Id,
			Source: model.EdgeEndpoint{NodeID: e.Source.NodeId, Port: e.Source.Port},
			Target: model.EdgeEndpoint{NodeID: e.Target.NodeId, Port: e.Target.Port},
		})
	}
	var ui *model.GraphUI
	if d.Ui != nil {
		ui = &model.GraphUI{Viewport: viewportFromGen(d.Ui.Viewport), Extra: copyMap(d.Ui.AdditionalProperties)}
	}
	return model.PipelineDefinition{
		SchemaVersion:      d.SchemaVersion,
		NodeCatalogVersion: d.NodeCatalogVersion,
		Inputs:             inputs,
		Nodes:              nodes,
		Edges:              edges,
		UI:                 ui,
	}, nil
}

func pipelineNodeFromGen(n gen.PipelineNode) model.PipelineNode {
	var ui *model.NodeUI
	if n.Ui != nil {
		ui = &model.NodeUI{Position: positionFromGen(n.Ui.Position), Extra: copyMap(n.Ui.AdditionalProperties)}
	}
	return model.PipelineNode{
		ID:          n.Id,
		Type:        n.Type,
		TypeVersion: n.TypeVersion,
		Title:       n.Title,
		Config:      copyMap(n.Config),
		UI:          ui,
	}
}

func viewportFromGen(v *gen.Viewport) *model.Viewport {
	if v == nil {
		return nil
	}
	return &model.Viewport{X: v.X, Y: v.Y, Zoom: v.Zoom}
}

func positionFromGen(p *gen.Position) *model.Position {
	if p == nil {
		return nil
	}
	return &model.Position{X: p.X, Y: p.Y}
}

func copyMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
