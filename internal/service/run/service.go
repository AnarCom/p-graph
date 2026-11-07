package runSvc

import (
	"context"

	"github.com/google/uuid"

	"github.com/AnarCom/p-graph/internal/model"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) RunPipeline(_ context.Context, pipelineID string, revision int32) (model.Run, error) {
	return model.Run{
		RunID:      uuid.NewString(),
		PipelineID: pipelineID,
		Revision:   revision,
		Status:     model.RunStatusPending,
	}, nil
}
