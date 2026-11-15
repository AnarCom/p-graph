package runSvc

import (
	"context"

	"github.com/google/uuid"

	"github.com/AnarCom/p-graph/internal/model"
)

type RunStore interface {
	GetRevision(ctx context.Context, pipelineID uuid.UUID, revision int32) (model.PipelineDraft, bool, error)
}

type Transactor interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}

type RunService struct {
	store RunStore
	tx    Transactor
	argo  WorkflowSubmitter
}

func NewRunService(store RunStore, tx Transactor, argo WorkflowSubmitter) *RunService {
	return &RunService{store: store, tx: tx, argo: argo}
}

func (s *RunService) RunPipeline(ctx context.Context, pipelineID string, revision int32) (model.Run, error) {
	id, err := uuid.Parse(pipelineID)
	if err != nil {
		return model.Run{}, ErrPipelineNotFound
	}

	var definition model.PipelineDefinition

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		draft, ok, err := s.store.GetRevision(ctx, id, revision)
		if err != nil {
			return err
		}
		if !ok {
			return ErrPipelineNotFound
		}
		definition = draft.Definition
		return nil
	})
	if err != nil {
		return model.Run{}, err
	}

	workflow, err := buildWorkflow(definition, pipelineID, revision)
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
