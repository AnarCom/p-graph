package runSvc

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/AnarCom/p-graph/internal/model"
)

const (
	nodeTypeFileInput    = "builtin.file-input"
	nodeTypeConsolePrint = "builtin.console-print"
)

type workflow struct {
	APIVersion string           `json:"apiVersion"`
	Kind       string           `json:"kind"`
	Metadata   workflowMetadata `json:"metadata"`
	Spec       workflowSpec     `json:"spec"`
}

type workflowMetadata struct {
	GenerateName string            `json:"generateName"`
	Labels       map[string]string `json:"labels"`
}

const stubInputData = "Hello from p-graph!"

type workflowSpec struct {
	ServiceAccountName string             `json:"serviceAccountName"`
	Entrypoint         string             `json:"entrypoint,omitempty"`
	Arguments          workflowArguments  `json:"arguments"`
	Templates          []workflowTemplate `json:"templates"`
}

type workflowArguments struct {
	Artifacts []workflowArtifact `json:"artifacts,omitempty"`
}

type workflowArtifact struct {
	Name string       `json:"name"`
	Raw  *rawArtifact `json:"raw,omitempty"`
	Path string       `json:"path,omitempty"`
}

type rawArtifact struct {
	Data string `json:"data"`
}

type workflowTemplate struct {
	Name      string         `json:"name"`
	Inputs    *templateIO    `json:"inputs,omitempty"`
	Container *containerSpec `json:"container"`
}

type templateIO struct {
	Artifacts []workflowArtifact `json:"artifacts"`
}

type containerSpec struct {
	Image   string   `json:"image"`
	Command []string `json:"command"`
	Args    []string `json:"args"`
}

var taskNameRe = regexp.MustCompile(`[^a-zA-Z0-9-]`)

func taskName(nodeID string) string {
	return taskNameRe.ReplaceAllString(nodeID, "-")
}

func buildWorkflow(def model.PipelineDefinition, pipelineID string, revision int32) (json.RawMessage, error) {
	var templates []workflowTemplate
	var argumentNames []string

	for _, node := range def.Nodes {
		switch node.Type {
		case nodeTypeFileInput:
		case nodeTypeConsolePrint:
			inputName, err := consolePrintInputName(def, node)
			if err != nil {
				return nil, err
			}
			templates = append(templates, consolePrintTemplate(taskName(node.ID), inputName))
			argumentNames = append(argumentNames, inputName)
		default:
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedNodeType, node.Type)
		}
	}

	arguments := workflowArguments{Artifacts: make([]workflowArtifact, 0, len(argumentNames))}
	for _, name := range argumentNames {
		arguments.Artifacts = append(arguments.Artifacts, workflowArtifact{
			Name: name,
			Raw:  &rawArtifact{Data: stubInputData},
		})
	}

	entrypoint := ""
	if len(templates) > 0 {
		entrypoint = templates[0].Name
	}

	wf := workflow{
		APIVersion: "argoproj.io/v1alpha1",
		Kind:       "Workflow",
		Metadata: workflowMetadata{
			GenerateName: "pgraph-run-",
			Labels: map[string]string{
				"pipeline-id": pipelineID,
				"revision":    fmt.Sprintf("%d", revision),
			},
		},
		Spec: workflowSpec{
			ServiceAccountName: "argo",
			Entrypoint:         entrypoint,
			Arguments:          arguments,
			Templates:          templates,
		},
	}

	return json.Marshal(wf)
}

func consolePrintInputName(def model.PipelineDefinition, node model.PipelineNode) (string, error) {
	for _, edge := range def.Edges {
		if edge.Target.NodeID != node.ID {
			continue
		}
		source := findNode(def, edge.Source.NodeID)
		if source == nil {
			return "", fmt.Errorf("edge %q references unknown node %q", edge.ID, edge.Source.NodeID)
		}
		if source.Type != nodeTypeFileInput {
			continue
		}
		inputName, ok := source.Config["inputName"].(string)
		if !ok {
			return "", fmt.Errorf("node %q has no inputName config", source.ID)
		}
		return inputName, nil
	}
	return "", fmt.Errorf("node %q has no incoming artifact", node.ID)
}

func consolePrintTemplate(name, inputName string) workflowTemplate {
	return workflowTemplate{
		Name: name,
		Inputs: &templateIO{Artifacts: []workflowArtifact{
			{Name: inputName, Path: "/tmp/file.txt"},
		}},
		Container: &containerSpec{
			Image:   "alpine:3.18",
			Command: []string{"sh", "-c"},
			Args:    []string{"cat /tmp/file.txt"},
		},
	}
}

func findNode(def model.PipelineDefinition, nodeID string) *model.PipelineNode {
	for i := range def.Nodes {
		if def.Nodes[i].ID == nodeID {
			return &def.Nodes[i]
		}
	}
	return nil
}
