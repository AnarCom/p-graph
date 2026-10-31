package pipelineHandler

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	genapi "github.com/AnarCom/p-graph/internal/api/gen"
)

//go:embed fixtures/node_catalog.json
var nodeCatalogFixture []byte

//go:embed fixtures/sample_draft.json
var sampleDraftFixture []byte

//go:embed fixtures/validation_result.json
var validationResultFixture []byte

type StubHandler struct {
	nodeCatalog      genapi.NodeCatalog
	sampleDraft      genapi.PipelineDraft
	validationResult genapi.ValidationResult
}

func NewStubHandler() (*StubHandler, error) {
	var catalog genapi.NodeCatalog
	if err := json.Unmarshal(nodeCatalogFixture, &catalog); err != nil {
		return nil, fmt.Errorf("unmarshal node catalog fixture: %w", err)
	}

	var draft genapi.PipelineDraft
	if err := json.Unmarshal(sampleDraftFixture, &draft); err != nil {
		return nil, fmt.Errorf("unmarshal sample draft fixture: %w", err)
	}

	var result genapi.ValidationResult
	if err := json.Unmarshal(validationResultFixture, &result); err != nil {
		return nil, fmt.Errorf("unmarshal validation result fixture: %w", err)
	}

	return &StubHandler{
		nodeCatalog:      catalog,
		sampleDraft:      draft,
		validationResult: result,
	}, nil
}

func (h *StubHandler) Health(context.Context, genapi.HealthRequestObject) (genapi.HealthResponseObject, error) {
	return genapi.Health200JSONResponse{Status: "ok"}, nil
}

func (h *StubHandler) GetNodeCatalog(context.Context, genapi.GetNodeCatalogRequestObject) (genapi.GetNodeCatalogResponseObject, error) {
	return genapi.GetNodeCatalog200JSONResponse(h.nodeCatalog), nil
}

func (h *StubHandler) GetDraft(context.Context, genapi.GetDraftRequestObject) (genapi.GetDraftResponseObject, error) {
	return genapi.GetDraft200JSONResponse(h.sampleDraft), nil
}

func (h *StubHandler) SaveDraft(context.Context, genapi.SaveDraftRequestObject) (genapi.SaveDraftResponseObject, error) {
	return genapi.SaveDraft204Response{}, nil
}

func (h *StubHandler) ResetDraft(context.Context, genapi.ResetDraftRequestObject) (genapi.ResetDraftResponseObject, error) {
	return genapi.ResetDraft200JSONResponse(h.sampleDraft), nil
}

func (h *StubHandler) ValidateDraft(context.Context, genapi.ValidateDraftRequestObject) (genapi.ValidateDraftResponseObject, error) {
	return genapi.ValidateDraft200JSONResponse(h.validationResult), nil
}

var _ genapi.StrictServerInterface = (*StubHandler)(nil)
