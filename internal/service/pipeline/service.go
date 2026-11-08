package pipelineSvc

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/AnarCom/p-graph/internal/model"
	pipelineStorage "github.com/AnarCom/p-graph/internal/storage/pipeline"
)

type PipelineStore interface {
	GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error)
	GetDraft(ctx context.Context, pipelineID uuid.UUID) (model.PipelineDraft, bool, error)
	GetLatestRevision(ctx context.Context, pipelineID uuid.UUID) (model.PipelineDraft, bool, error)
	UpsertDraft(ctx context.Context, pipelineID uuid.UUID, draft model.PipelineDraft) error
	DeleteDraft(ctx context.Context, pipelineID uuid.UUID) error
	PipelineExists(ctx context.Context, pipelineID uuid.UUID) (bool, error)
}

type Transactor interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}

type PipelineService struct {
	store PipelineStore
	tx    Transactor
}

func NewPipelineService(store PipelineStore, tx Transactor) *PipelineService {
	return &PipelineService{store: store, tx: tx}
}

func (s *PipelineService) GetNodeCatalog(ctx context.Context, version *string) (model.NodeCatalog, error) {
	var catalog model.NodeCatalog

	err := s.tx.Do(ctx, func(ctx context.Context) error {
		var err error
		catalog, err = s.store.GetNodeCatalog(ctx, version)
		if err != nil {
			return fromStoreError(err)
		}
		return nil
	})
	if err != nil {
		return model.NodeCatalog{}, err
	}

	return catalog, nil
}

func (s *PipelineService) GetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error) {
	id, err := parsePipelineID(pipelineID)
	if err != nil {
		return model.PipelineDraft{}, err
	}

	var draft model.PipelineDraft

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		current, ok, err := s.store.GetDraft(ctx, id)
		if err != nil {
			return fromStoreError(err)
		}
		if ok {
			draft = current
			return nil
		}

		latest, ok, err := s.store.GetLatestRevision(ctx, id)
		if err != nil {
			return fromStoreError(err)
		}
		if ok {
			draft = latest
			return nil
		}

		return ErrPipelineNotFound
	})
	if err != nil {
		return model.PipelineDraft{}, err
	}

	return draft, nil
}

func (s *PipelineService) SaveDraft(ctx context.Context, pipelineID string, draft model.PipelineDraft) error {
	id, err := parsePipelineID(pipelineID)
	if err != nil {
		return err
	}

	return s.tx.Do(ctx, func(ctx context.Context) error {
		current, ok, err := s.store.GetDraft(ctx, id)
		if err != nil {
			return fromStoreError(err)
		}
		if ok && draft.BaseRevision != nil && !sameBaseRevision(current.BaseRevision, draft.BaseRevision) {
			return ErrDraftConflict
		}

		if err := s.store.UpsertDraft(ctx, id, draft); err != nil {
			return fromStoreError(err)
		}
		return nil
	})
}

func (s *PipelineService) ResetDraft(ctx context.Context, pipelineID string) (model.PipelineDraft, error) {
	id, err := parsePipelineID(pipelineID)
	if err != nil {
		return model.PipelineDraft{}, err
	}

	var latest model.PipelineDraft

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		var ok bool
		var err error
		latest, ok, err = s.store.GetLatestRevision(ctx, id)
		if err != nil {
			return fromStoreError(err)
		}
		if !ok {
			return ErrPipelineNotFound
		}

		if err := s.store.DeleteDraft(ctx, id); err != nil {
			return fromStoreError(err)
		}
		return nil
	})
	if err != nil {
		return model.PipelineDraft{}, err
	}

	return latest, nil
}

func (s *PipelineService) ValidateDraft(ctx context.Context, pipelineID string, _ model.PipelineDefinition) (model.ValidationResult, error) {
	id, err := parsePipelineID(pipelineID)
	if err != nil {
		return model.ValidationResult{}, err
	}

	var result model.ValidationResult

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		exists, err := s.store.PipelineExists(ctx, id)
		if err != nil {
			return fromStoreError(err)
		}
		if !exists {
			return ErrPipelineNotFound
		}

		result = model.ValidationResult{Valid: true}
		return nil
	})
	if err != nil {
		return model.ValidationResult{}, err
	}

	return result, nil
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

func parsePipelineID(pipelineID string) (uuid.UUID, error) {
	id, err := uuid.Parse(pipelineID)
	if err != nil {
		return uuid.UUID{}, ErrPipelineNotFound
	}
	return id, nil
}
