package pipelineHandler

import (
	"context"
	"errors"

	genapi "github.com/AnarCom/p-graph/internal/api/gen"
	"github.com/AnarCom/p-graph/internal/model"
	"github.com/AnarCom/p-graph/internal/usecase"
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

func (h *PipelineHandler) Health(_ context.Context, _ genapi.HealthRequestObject) (genapi.HealthResponseObject, error) {
	return genapi.Health200JSONResponse{Status: "ok"}, nil
}

func (h *PipelineHandler) GetNodeCatalog(ctx context.Context, req genapi.GetNodeCatalogRequestObject) (genapi.GetNodeCatalogResponseObject, error) {
	catalog, err := h.pipelineSvc.GetNodeCatalog(ctx, req.Params.Version)
	switch {
	case errors.Is(err, usecase.ErrNodeCatalogNotFound):
		return genapi.GetNodeCatalog404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := nodeCatalogToGen(catalog)
	if err != nil {
		return nil, err
	}
	return genapi.GetNodeCatalog200JSONResponse(out), nil
}

func (h *PipelineHandler) GetDraft(ctx context.Context, req genapi.GetDraftRequestObject) (genapi.GetDraftResponseObject, error) {
	draft, err := h.pipelineSvc.GetDraft(ctx, req.PipelineId)
	switch {
	case errors.Is(err, usecase.ErrPipelineNotFound):
		return genapi.GetDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := pipelineDraftToGen(draft)
	if err != nil {
		return nil, err
	}
	return genapi.GetDraft200JSONResponse(out), nil
}

func (h *PipelineHandler) SaveDraft(ctx context.Context, req genapi.SaveDraftRequestObject) (genapi.SaveDraftResponseObject, error) {
	if req.Body == nil {
		return nil, errors.New("missing request body")
	}

	draft, err := pipelineDraftFromGen(*req.Body)
	if err != nil {
		return nil, err
	}

	err = h.pipelineSvc.SaveDraft(ctx, req.PipelineId, draft)
	switch {
	case errors.Is(err, usecase.ErrPipelineNotFound):
		return genapi.SaveDraft404JSONResponse{Message: err.Error()}, nil
	case errors.Is(err, usecase.ErrDraftConflict):
		return genapi.SaveDraft409JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return genapi.SaveDraft204Response{}, nil
}

func (h *PipelineHandler) ResetDraft(ctx context.Context, req genapi.ResetDraftRequestObject) (genapi.ResetDraftResponseObject, error) {
	draft, err := h.pipelineSvc.ResetDraft(ctx, req.PipelineId)
	switch {
	case errors.Is(err, usecase.ErrPipelineNotFound):
		return genapi.ResetDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	out, err := pipelineDraftToGen(draft)
	if err != nil {
		return nil, err
	}
	return genapi.ResetDraft200JSONResponse(out), nil
}

func (h *PipelineHandler) ValidateDraft(ctx context.Context, req genapi.ValidateDraftRequestObject) (genapi.ValidateDraftResponseObject, error) {
	if req.Body == nil {
		return nil, errors.New("missing request body")
	}

	definition, err := pipelineDefinitionFromGen(*req.Body)
	if err != nil {
		return nil, err
	}

	result, err := h.pipelineSvc.ValidateDraft(ctx, req.PipelineId, definition)
	switch {
	case errors.Is(err, usecase.ErrPipelineNotFound):
		return genapi.ValidateDraft404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return genapi.ValidateDraft200JSONResponse(validationResultToGen(result)), nil
}

var _ genapi.StrictServerInterface = (*PipelineHandler)(nil)
