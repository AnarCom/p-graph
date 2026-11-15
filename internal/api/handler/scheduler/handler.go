package schedulerHandler

import (
	"context"

	gen "github.com/AnarCom/p-graph/internal/api/gen/scheduler"
	"github.com/AnarCom/p-graph/internal/model"
)

type SchedulerService interface {
	RunPipeline(ctx context.Context, pipelineID string, revision int32, inputs map[string]string) (model.Run, error)
}

type SchedulerHandler struct {
	runSvc SchedulerService
}

func NewSchedulerHandler(runs SchedulerService) *SchedulerHandler {
	return &SchedulerHandler{runSvc: runs}
}

func (h *SchedulerHandler) Health(_ context.Context, _ gen.HealthRequestObject) (gen.HealthResponseObject, error) {
	return gen.Health200JSONResponse{Status: "ok"}, nil
}

func (h *SchedulerHandler) RunPipeline(ctx context.Context, req gen.RunPipelineRequestObject) (gen.RunPipelineResponseObject, error) {
	if req.Body == nil {
		return gen.RunPipeline400JSONResponse{Message: "missing request body"}, nil
	}

	inputs := map[string]string{}
	if req.Body.Inputs != nil {
		inputs = *req.Body.Inputs
	}

	run, err := h.runSvc.RunPipeline(ctx, req.Body.PipelineId, req.Body.Revision, inputs)
	if err != nil {
		return gen.RunPipeline400JSONResponse{Message: err.Error()}, nil
	}

	return gen.RunPipeline200JSONResponse(runToGen(run)), nil
}

var _ gen.StrictServerInterface = (*SchedulerHandler)(nil)
