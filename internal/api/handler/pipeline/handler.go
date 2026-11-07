package pipelineHandler

import (
	"context"
	"errors"

	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
	"github.com/AnarCom/p-graph/internal/model"
	pipelineSvc "github.com/AnarCom/p-graph/internal/service/pipeline"
)

type PipelineService interface {
	GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error)
	GetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error)
	SaveDraft(ctx context.Context, pipelineID string, draft model.PipelineDraft) error
	ResetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error)
	ValidateDraft(ctx context.Context, pipelineID string, definition model.PipelineDefinition) (model.ValidationResult, error)
}

type PipelineHandler struct {
	pipelineSvc PipelineService
}

func NewPipelineHandler(pipelines PipelineService) *PipelineHandler {
	return &PipelineHandler{pipelineSvc: pipelines}
}

func (h *PipelineHandler) Health(_ context.Context, _ gen.HealthRequestObject) (gen.HealthResponseObject, error) {
	return gen.Health200JSONResponse{Status: "ok"}, nil
}

func (h *PipelineHandler) GetNodeCatalog(ctx context.Context, req gen.GetNodeCatalogRequestObject) (gen.GetNodeCatalogResponseObject, error) {
	catalog, err := h.pipelineSvc.GetNodeCatalog(ctx, req.Params.Version)
	switch {
	case errors.Is(err, pipelineSvc.ErrNodeCatalogNotFound):
		return gen.GetNodeCatalog404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := nodeCatalogToGen(catalog)
	if err != nil {
		return nil, err
	}
	return gen.GetNodeCatalog200JSONResponse(out), nil
}

func (h *PipelineHandler) GetDraft(ctx context.Context, req gen.GetDraftRequestObject) (gen.GetDraftResponseObject, error) {
	draft, err := h.pipelineSvc.GetDraft(ctx, req.PipelineId)
	switch {
	case errors.Is(err, pipelineSvc.ErrPipelineNotFound):
		return gen.GetDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := pipelineDraftToGen(draft)
	if err != nil {
		return nil, err
	}
	return gen.GetDraft200JSONResponse(out), nil
}

func (h *PipelineHandler) SaveDraft(ctx context.Context, req gen.SaveDraftRequestObject) (gen.SaveDraftResponseObject, error) {
	if req.Body == nil {
		return nil, errors.New("missing request body")
	}

	draft, err := pipelineDraftFromGen(*req.Body)
	if err != nil {
		return nil, err
	}

	err = h.pipelineSvc.SaveDraft(ctx, req.PipelineId, draft)
	switch {
	case errors.Is(err, pipelineSvc.ErrPipelineNotFound):
		return gen.SaveDraft404JSONResponse{Message: err.Error()}, nil
	case errors.Is(err, pipelineSvc.ErrDraftConflict):
		return gen.SaveDraft409JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return gen.SaveDraft204Response{}, nil
}

func (h *PipelineHandler) ResetDraft(ctx context.Context, req gen.ResetDraftRequestObject) (gen.ResetDraftResponseObject, error) {
	draft, err := h.pipelineSvc.ResetDraft(ctx, req.PipelineId)
	switch {
	case errors.Is(err, pipelineSvc.ErrPipelineNotFound):
		return gen.ResetDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := pipelineDraftToGen(draft)
	if err != nil {
		return nil, err
	}
	return gen.ResetDraft200JSONResponse(out), nil
}

func (h *PipelineHandler) ValidateDraft(ctx context.Context, req gen.ValidateDraftRequestObject) (gen.ValidateDraftResponseObject, error) {
	if req.Body == nil {
		return nil, errors.New("missing request body")
	}

	definition, err := pipelineDefinitionFromGen(*req.Body)
	if err != nil {
		return nil, err
	}

	result, err := h.pipelineSvc.ValidateDraft(ctx, req.PipelineId, definition)
	switch {
	case errors.Is(err, pipelineSvc.ErrPipelineNotFound):
		return gen.ValidateDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return gen.ValidateDraft200JSONResponse(validationResultToGen(result)), nil
}

var _ gen.StrictServerInterface = (*PipelineHandler)(nil)
