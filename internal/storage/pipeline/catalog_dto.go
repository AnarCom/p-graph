package pipelineStorage

import (
	"encoding/json"
	"fmt"

	"github.com/AnarCom/p-graph/internal/model"
)

type inputPortDTO struct {
	Name           string `json:"name"`
	Title          string `json:"title"`
	DataType       string `json:"dataType"`
	MinConnections *int32 `json:"minConnections"`
	MaxConnections *int32 `json:"maxConnections"`
}

type outputPortDTO struct {
	Name     string `json:"name"`
	Title    string `json:"title"`
	DataType string `json:"dataType"`
}

type configPropertyDTO struct {
	Type        string   `json:"type"`
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Default     any      `json:"default"`
	Enum        []any    `json:"enum"`
}

type configSchemaDTO struct {
	Schema               *string                      `json:"$schema"`
	Type                 string                       `json:"type"`
	Properties           map[string]configPropertyDTO `json:"properties"`
	Required             []string                     `json:"required"`
	AdditionalProperties *bool                        `json:"additionalProperties"`
}

type nodeTypeRow struct {
	Type        string
	Version     int32
	Title       string
	Description string
	Category    string
	Status      string
	Inputs      []byte
	Outputs     []byte
	Config      []byte
}

func (r nodeTypeRow) toModel() (model.NodeTypeDefinition, error) {
	var inputs []inputPortDTO
	if err := json.Unmarshal(r.Inputs, &inputs); err != nil {
		return model.NodeTypeDefinition{}, fmt.Errorf("unmarshal inputs: %w", err)
	}
	var outputs []outputPortDTO
	if err := json.Unmarshal(r.Outputs, &outputs); err != nil {
		return model.NodeTypeDefinition{}, fmt.Errorf("unmarshal outputs: %w", err)
	}
	var config configSchemaDTO
	if err := json.Unmarshal(r.Config, &config); err != nil {
		return model.NodeTypeDefinition{}, fmt.Errorf("unmarshal config schema: %w", err)
	}

	inputPorts := make([]model.InputPortDefinition, 0, len(inputs))
	for _, p := range inputs {
		inputPorts = append(inputPorts, p.toModel())
	}
	outputPorts := make([]model.OutputPortDefinition, 0, len(outputs))
	for _, p := range outputs {
		outputPorts = append(outputPorts, p.toModel())
	}

	var description *string
	if r.Description != "" {
		description = &r.Description
	}

	return model.NodeTypeDefinition{
		Type:         r.Type,
		Version:      r.Version,
		Title:        r.Title,
		Description:  description,
		Category:     r.Category,
		Status:       model.NodeTypeStatus(r.Status),
		Inputs:       inputPorts,
		Outputs:      outputPorts,
		ConfigSchema: config.toModel(),
	}, nil
}

func (p inputPortDTO) toModel() model.InputPortDefinition {
	return model.InputPortDefinition{
		Name:           p.Name,
		Title:          p.Title,
		DataType:       p.DataType,
		MinConnections: p.MinConnections,
		MaxConnections: p.MaxConnections,
	}
}

func (p outputPortDTO) toModel() model.OutputPortDefinition {
	return model.OutputPortDefinition{
		Name:     p.Name,
		Title:    p.Title,
		DataType: p.DataType,
	}
}

func (c configSchemaDTO) toModel() model.ConfigSchema {
	properties := make(map[string]model.ConfigPropertySchema, len(c.Properties))
	for name, p := range c.Properties {
		properties[name] = p.toModel()
	}
	return model.ConfigSchema{
		Schema:               c.Schema,
		Type:                 c.Type,
		Properties:           properties,
		Required:             c.Required,
		AdditionalProperties: c.AdditionalProperties,
	}
}

func (c configPropertyDTO) toModel() model.ConfigPropertySchema {
	return model.ConfigPropertySchema{
		Type:        model.ConfigValueType(c.Type),
		Title:       c.Title,
		Description: c.Description,
		Default:     c.Default,
		Enum:        c.Enum,
	}
}
