package pipelineHandler

import (
	"fmt"

	genapi "github.com/AnarCom/p-graph/internal/api/gen"
	"github.com/AnarCom/p-graph/internal/model"
)

func nodeCatalogToGen(c model.NodeCatalog) (genapi.NodeCatalog, error) {
	types := make([]genapi.NodeTypeDefinition, 0, len(c.NodeTypes))
	for _, nt := range c.NodeTypes {
		converted, err := nodeTypeToGen(nt)
		if err != nil {
			return genapi.NodeCatalog{}, err
		}
		types = append(types, converted)
	}
	return genapi.NodeCatalog{CatalogVersion: c.CatalogVersion, NodeTypes: types}, nil
}

func nodeTypeToGen(nt model.NodeTypeDefinition) (genapi.NodeTypeDefinition, error) {
	inputs := make([]genapi.InputPortDefinition, 0, len(nt.Inputs))
	for _, p := range nt.Inputs {
		inputs = append(inputs, genapi.InputPortDefinition{
			Name:           p.Name,
			Title:          p.Title,
			DataType:       p.DataType,
			MinConnections: p.MinConnections,
			MaxConnections: p.MaxConnections,
		})
	}
	outputs := make([]genapi.OutputPortDefinition, 0, len(nt.Outputs))
	for _, p := range nt.Outputs {
		outputs = append(outputs, genapi.OutputPortDefinition{
			Name:     p.Name,
			Title:    p.Title,
			DataType: p.DataType,
		})
	}
	configSchema, err := configSchemaToGen(nt.ConfigSchema)
	if err != nil {
		return genapi.NodeTypeDefinition{}, err
	}
	return genapi.NodeTypeDefinition{
		Type:         nt.Type,
		Version:      nt.Version,
		Title:        nt.Title,
		Description:  nt.Description,
		Category:     nt.Category,
		Status:       genapi.NodeTypeStatus(nt.Status),
		Inputs:       inputs,
		Outputs:      outputs,
		ConfigSchema: configSchema,
	}, nil
}

func configSchemaToGen(cs model.ConfigSchema) (genapi.ConfigSchema, error) {
	properties := make(map[string]genapi.ConfigPropertySchema, len(cs.Properties))
	for name, p := range cs.Properties {
		converted, err := configPropertyToGen(p)
		if err != nil {
			return genapi.ConfigSchema{}, fmt.Errorf("property %q: %w", name, err)
		}
		properties[name] = converted
	}
	return genapi.ConfigSchema{
		Schema:               cs.Schema,
		Type:                 genapi.ConfigSchemaType(cs.Type),
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

func configPropertyToGen(p model.ConfigPropertySchema) (genapi.ConfigPropertySchema, error) {
	var def *genapi.ConfigPropertySchema_Default
	if p.Default != nil {
		v, err := configValueToGen(p.Default)
		if err != nil {
			return genapi.ConfigPropertySchema{}, fmt.Errorf("default: %w", err)
		}
		def = &v
	}
	var enum *[]genapi.ConfigPropertySchema_Enum_Item
	if p.Enum != nil {
		items := make([]genapi.ConfigPropertySchema_Enum_Item, 0, len(p.Enum))
		for _, e := range p.Enum {
			item, err := configEnumItemToGen(e)
			if err != nil {
				return genapi.ConfigPropertySchema{}, fmt.Errorf("enum: %w", err)
			}
			items = append(items, item)
		}
		enum = &items
	}
	return genapi.ConfigPropertySchema{
		Type:        genapi.ConfigValueType(p.Type),
		Title:       p.Title,
		Description: p.Description,
		Default:     def,
		Enum:        enum,
	}, nil
}

func configValueToGen(v any) (genapi.ConfigPropertySchema_Default, error) {
	var u genapi.ConfigPropertySchema_Default
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

func configEnumItemToGen(v any) (genapi.ConfigPropertySchema_Enum_Item, error) {
	var u genapi.ConfigPropertySchema_Enum_Item
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

func pipelineDraftToGen(d model.PipelineDraft) (genapi.PipelineDraft, error) {
	definition, err := pipelineDefinitionToGen(d.Definition)
	if err != nil {
		return genapi.PipelineDraft{}, err
	}
	return genapi.PipelineDraft{
		PipelineId:   d.PipelineID,
		BaseRevision: d.BaseRevision,
		Definition:   definition,
	}, nil
}

func pipelineDefinitionToGen(d model.PipelineDefinition) (genapi.PipelineDefinition, error) {
	inputs := make(map[string]genapi.PipelineInput, len(d.Inputs))
	for name, in := range d.Inputs {
		inputs[name] = genapi.PipelineInput{Type: in.Type, Title: in.Title, Required: in.Required}
	}
	nodes := make([]genapi.PipelineNode, 0, len(d.Nodes))
	for _, n := range d.Nodes {
		nodes = append(nodes, pipelineNodeToGen(n))
	}
	edges := make([]genapi.PipelineEdge, 0, len(d.Edges))
	for _, e := range d.Edges {
		edges = append(edges, genapi.PipelineEdge{
			Id:     e.ID,
			Source: genapi.EdgeEndpoint{NodeId: e.Source.NodeID, Port: e.Source.Port},
			Target: genapi.EdgeEndpoint{NodeId: e.Target.NodeID, Port: e.Target.Port},
		})
	}
	var ui *genapi.GraphUi
	if d.UI != nil {
		ui = &genapi.GraphUi{Viewport: viewportToGen(d.UI.Viewport), AdditionalProperties: copyMap(d.UI.Extra)}
	}
	return genapi.PipelineDefinition{
		SchemaVersion:      d.SchemaVersion,
		NodeCatalogVersion: d.NodeCatalogVersion,
		Inputs:             inputs,
		Nodes:              nodes,
		Edges:              edges,
		Ui:                 ui,
	}, nil
}

func pipelineNodeToGen(n model.PipelineNode) genapi.PipelineNode {
	var ui *genapi.NodeUi
	if n.UI != nil {
		ui = &genapi.NodeUi{Position: positionToGen(n.UI.Position), AdditionalProperties: copyMap(n.UI.Extra)}
	}
	return genapi.PipelineNode{
		Id:          n.ID,
		Type:        n.Type,
		TypeVersion: n.TypeVersion,
		Title:       n.Title,
		Config:      copyMap(n.Config),
		Ui:          ui,
	}
}

func viewportToGen(v *model.Viewport) *genapi.Viewport {
	if v == nil {
		return nil
	}
	return &genapi.Viewport{X: v.X, Y: v.Y, Zoom: v.Zoom}
}

func positionToGen(p *model.Position) *genapi.Position {
	if p == nil {
		return nil
	}
	return &genapi.Position{X: p.X, Y: p.Y}
}

func validationResultToGen(r model.ValidationResult) genapi.ValidationResult {
	issues := make([]genapi.ValidationIssue, 0, len(r.Issues))
	for _, i := range r.Issues {
		issues = append(issues, genapi.ValidationIssue{
			Code:    i.Code,
			Message: i.Message,
			Location: genapi.ValidationLocation{
				Kind:       genapi.ValidationLocationKind(i.Location.Kind),
				NodeId:     i.Location.NodeID,
				EdgeId:     i.Location.EdgeID,
				Port:       i.Location.Port,
				ConfigPath: i.Location.ConfigPath,
			},
		})
	}
	return genapi.ValidationResult{Valid: r.Valid, Issues: issues}
}

func pipelineDraftFromGen(d genapi.PipelineDraft) (model.PipelineDraft, error) {
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

func pipelineDefinitionFromGen(d genapi.PipelineDefinition) (model.PipelineDefinition, error) {
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

func pipelineNodeFromGen(n genapi.PipelineNode) model.PipelineNode {
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

func viewportFromGen(v *genapi.Viewport) *model.Viewport {
	if v == nil {
		return nil
	}
	return &model.Viewport{X: v.X, Y: v.Y, Zoom: v.Zoom}
}

func positionFromGen(p *genapi.Position) *model.Position {
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
