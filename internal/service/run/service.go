package runSvc

import (
	"context"
	_ "embed"
	"encoding/json"
	"strconv"

	"gopkg.in/yaml.v3"

	"github.com/AnarCom/p-graph/internal/model"
)

//go:embed fixtures/workflow.yaml
var workflowFixture []byte

type WorkflowSubmitter interface {
	SubmitWorkflow(ctx context.Context, workflow json.RawMessage) (string, error)
}

type RunService struct {
	argo WorkflowSubmitter
}

func NewRunService(argo WorkflowSubmitter) *RunService {
	return &RunService{argo: argo}
}

func (s *RunService) RunPipeline(ctx context.Context, pipelineID string, revision int32) (model.Run, error) {
	workflow, err := buildWorkflow(pipelineID, revision)
	if err != nil {
		return model.Run{}, err
	}

	name, err := s.argo.SubmitWorkflow(ctx, workflow)
	if err != nil {
		return model.Run{}, err
	}

	return model.Run{
		RunID:      name,
		PipelineID: pipelineID,
		Revision:   revision,
		Status:     model.RunStatusScheduled,
	}, nil
}

func buildWorkflow(pipelineID string, revision int32) (json.RawMessage, error) {
	var wf map[string]any
	if err := yaml.Unmarshal(workflowFixture, &wf); err != nil {
		return nil, err
	}

	meta, _ := wf["metadata"].(map[string]any)
	if meta == nil {
		meta = map[string]any{}
		wf["metadata"] = meta
	}
	labels, _ := meta["labels"].(map[string]any)
	if labels == nil {
		labels = map[string]any{}
		meta["labels"] = labels
	}
	labels["pipeline-id"] = pipelineID
	labels["revision"] = strconv.Itoa(int(revision))

	return json.Marshal(wf)
}
