package pipelineHandler

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
)

//go:embed fixtures/node_catalog.json
var nodeCatalogFixture []byte

//go:embed fixtures/sample_draft.json
var sampleDraftFixture []byte

//go:embed fixtures/validation_result.json
var validationResultFixture []byte

type StubPipelineHandler struct {
	nodeCatalog      gen.NodeCatalog
	sampleDraft      gen.PipelineDraft
	validationResult gen.ValidationResult
}

func NewStubPipelineHandler() (*StubPipelineHandler, error) {
	var catalog gen.NodeCatalog
	if err := json.Unmarshal(nodeCatalogFixture, &catalog); err != nil {
		return nil, fmt.Errorf("unmarshal node catalog fixture: %w", err)
	}

	var draft gen.PipelineDraft
	if err := json.Unmarshal(sampleDraftFixture, &draft); err != nil {
		return nil, fmt.Errorf("unmarshal sample draft fixture: %w", err)
	}

	var result gen.ValidationResult
	if err := json.Unmarshal(validationResultFixture, &result); err != nil {
		return nil, fmt.Errorf("unmarshal validation result fixture: %w", err)
	}

	return &StubPipelineHandler{
		nodeCatalog:      catalog,
		sampleDraft:      draft,
		validationResult: result,
	}, nil
}

func (h *StubPipelineHandler) Health(context.Context, gen.HealthRequestObject) (gen.HealthResponseObject, error) {
	return gen.Health200JSONResponse{Status: "ok"}, nil
}

func (h *StubPipelineHandler) GetNodeCatalog(context.Context, gen.GetNodeCatalogRequestObject) (gen.GetNodeCatalogResponseObject, error) {
	return gen.GetNodeCatalog200JSONResponse(h.nodeCatalog), nil
}

func (h *StubPipelineHandler) GetDraft(context.Context, gen.GetDraftRequestObject) (gen.GetDraftResponseObject, error) {
	return gen.GetDraft200JSONResponse(h.sampleDraft), nil
}

func (h *StubPipelineHandler) SaveDraft(context.Context, gen.SaveDraftRequestObject) (gen.SaveDraftResponseObject, error) {
	return gen.SaveDraft204Response{}, nil
}

func (h *StubPipelineHandler) ResetDraft(context.Context, gen.ResetDraftRequestObject) (gen.ResetDraftResponseObject, error) {
	return gen.ResetDraft200JSONResponse(h.sampleDraft), nil
}

func (h *StubPipelineHandler) ValidateDraft(context.Context, gen.ValidateDraftRequestObject) (gen.ValidateDraftResponseObject, error) {
	return gen.ValidateDraft200JSONResponse(h.validationResult), nil
}

var _ gen.StrictServerInterface = (*StubPipelineHandler)(nil)
