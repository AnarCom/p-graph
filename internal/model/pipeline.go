package model

type NodeTypeStatus string

const (
	NodeTypeStatusActive     NodeTypeStatus = "active"
	NodeTypeStatusDeprecated NodeTypeStatus = "deprecated"
	NodeTypeStatusDisabled   NodeTypeStatus = "disabled"
)

type ConfigValueType string

const (
	ConfigValueTypeString  ConfigValueType = "string"
	ConfigValueTypeNumber  ConfigValueType = "number"
	ConfigValueTypeInteger ConfigValueType = "integer"
	ConfigValueTypeBoolean ConfigValueType = "boolean"
)

type ValidationLocationKind string

const (
	ValidationLocationGraph  ValidationLocationKind = "graph"
	ValidationLocationNode   ValidationLocationKind = "node"
	ValidationLocationPort   ValidationLocationKind = "port"
	ValidationLocationEdge   ValidationLocationKind = "edge"
	ValidationLocationConfig ValidationLocationKind = "config"
)

type NodeCatalog struct {
	CatalogVersion string
	NodeTypes      []NodeTypeDefinition
}

type NodeTypeDefinition struct {
	Type         string
	Version      int32
	Title        string
	Description  *string
	Category     string
	Status       NodeTypeStatus
	Inputs       []InputPortDefinition
	Outputs      []OutputPortDefinition
	ConfigSchema ConfigSchema
}

type InputPortDefinition struct {
	Name           string
	Title          string
	DataType       string
	MinConnections *int32
	MaxConnections *int32
}

type OutputPortDefinition struct {
	Name     string
	Title    string
	DataType string
}

type ConfigSchema struct {
	Schema               *string
	Type                 string
	Properties           map[string]ConfigPropertySchema
	Required             []string
	AdditionalProperties *bool
}

type ConfigPropertySchema struct {
	Type        ConfigValueType
	Title       *string
	Description *string
	Default     any
	Enum        []any
}

type PipelineDraft struct {
	PipelineID   string
	BaseRevision *int64
	Definition   PipelineDefinition
}

type PipelineDefinition struct {
	SchemaVersion      string
	NodeCatalogVersion string
	Inputs             map[string]PipelineInput
	Nodes              []PipelineNode
	Edges              []PipelineEdge
	UI                 *GraphUI
}

type PipelineInput struct {
	Type     string
	Title    string
	Required bool
}

type PipelineNode struct {
	ID          string
	Type        string
	TypeVersion int32
	Title       *string
	Config      map[string]any
	UI          *NodeUI
}

type EdgeEndpoint struct {
	NodeID string
	Port   string
}

type PipelineEdge struct {
	ID     string
	Source EdgeEndpoint
	Target EdgeEndpoint
}

type Position struct {
	X float64
	Y float64
}

type Viewport struct {
	X    float64
	Y    float64
	Zoom float64
}

type NodeUI struct {
	Position *Position
	Extra    map[string]any
}

type GraphUI struct {
	Viewport *Viewport
	Extra    map[string]any
}

type ValidationResult struct {
	Valid  bool
	Issues []ValidationIssue
}

type ValidationIssue struct {
	Code     string
	Message  string
	Location ValidationLocation
}

type ValidationLocation struct {
	Kind       ValidationLocationKind
	NodeID     *string
	EdgeID     *string
	Port       *string
	ConfigPath *string
}
