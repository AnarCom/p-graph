package pipelineSvc

import (
	"context"
	"errors"

	"github.com/AnarCom/p-graph/internal/model"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
)

type Store interface {
	GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error)
	GetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, bool, error)
	GetLatestRevision(ctx context.Context, pipelineID string) (model.PipelineDraft, bool, error)
	UpsertDraft(ctx context.Context, pipelineID string, draft model.PipelineDraft) error
	DeleteDraft(ctx context.Context, pipelineID string) error
	PipelineExists(ctx context.Context, pipelineID string) (bool, error)
}

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error) {
	catalog, err := s.store.GetNodeCatalog(ctx, version)
	if err != nil {
		return model.NodeCatalog{}, fromStoreError(err)
	}
	return catalog, nil
}

func (s *Service) GetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error) {
	draft, ok, err := s.store.GetDraft(ctx, pipelineID)
	if err != nil {
		return model.PipelineDraft{}, fromStoreError(err)
	}
	if ok {
		return draft, nil
	}

	latest, ok, err := s.store.GetLatestRevision(ctx, pipelineID)
	if err != nil {
		return model.PipelineDraft{}, fromStoreError(err)
	}
	if ok {
		return latest, nil
	}

	return model.PipelineDraft{}, ErrPipelineNotFound
}

func (s *Service) SaveDraft(ctx context.Context, pipelineID string, draft model.PipelineDraft) error {
	current, ok, err := s.store.GetDraft(ctx, pipelineID)
	if err != nil {
		return fromStoreError(err)
	}
	if ok && draft.BaseRevision != nil && !sameBaseRevision(current.BaseRevision, draft.BaseRevision) {
		return ErrDraftConflict
	}

	if err := s.store.UpsertDraft(ctx, pipelineID, draft); err != nil {
		return fromStoreError(err)
	}
	return nil
}

func (s *Service) ResetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error) {
	latest, ok, err := s.store.GetLatestRevision(ctx, pipelineID)
	if err != nil {
		return model.PipelineDraft{}, fromStoreError(err)
	}
	if !ok {
		return model.PipelineDraft{}, ErrPipelineNotFound
	}

	if err := s.store.DeleteDraft(ctx, pipelineID); err != nil {
		return model.PipelineDraft{}, fromStoreError(err)
	}
	return latest, nil
}

func (s *Service) ValidateDraft(ctx context.Context, pipelineID string, _ model.PipelineDefinition) (model.ValidationResult, error) {
	exists, err := s.store.PipelineExists(ctx, pipelineID)
	if err != nil {
		return model.ValidationResult{}, fromStoreError(err)
	}
	if !exists {
		return model.ValidationResult{}, ErrPipelineNotFound
	}

	return model.ValidationResult{Valid: true}, nil
}

func fromStoreError(err error) error {
	switch {
	case errors.Is(err, pipelineStorage.ErrPipelineNotFound):
		return ErrPipelineNotFound
	case errors.Is(err, pipelineStorage.ErrNodeCatalogNotFound):
		return ErrNodeCatalogNotFound
	default:
		return err
	}
}

func sameBaseRevision(current, incoming *int64) bool {
	return current != nil && *current == *incoming
}
