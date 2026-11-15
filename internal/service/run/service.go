package runSvc

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/AnarCom/p-graph/internal/model"
)

type RunStore interface {
	GetRevision(ctx context.Context, pipelineID uuid.UUID, revision int32) (model.PipelineDraft, bool, error)
}

type ArtifactStore interface {
	GetArtifact(ctx context.Context, id uuid.UUID) (model.Artifact, bool, error)
}

type Transactor interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}

type RunService struct {
	store     RunStore
	artifacts ArtifactStore
	tx        Transactor
	argo      WorkflowSubmitter
	s3        S3Source
}

func NewRunService(store RunStore, artifacts ArtifactStore, tx Transactor, argo WorkflowSubmitter, s3 S3Source) *RunService {
	return &RunService{store: store, artifacts: artifacts, tx: tx, argo: argo, s3: s3}
}

func (s *RunService) RunPipeline(ctx context.Context, pipelineID string, revision int32, inputs map[string]string) (model.Run, error) {
	id, err := uuid.Parse(pipelineID)
	if err != nil {
		return model.Run{}, ErrPipelineNotFound
	}

	var definition model.PipelineDefinition
	var resolved map[string]model.Artifact

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		draft, ok, err := s.store.GetRevision(ctx, id, revision)
		if err != nil {
			return err
		}
		if !ok {
			return ErrPipelineNotFound
		}
		definition = draft.Definition

		names, err := inputNames(definition)
		if err != nil {
			return err
		}

		resolved = make(map[string]model.Artifact, len(names))
		for _, name := range names {
			raw, ok := inputs[name]
			if !ok {
				return fmt.Errorf("%w: %s", ErrMissingInput, name)
			}
			artifactID, err := uuid.Parse(raw)
			if err != nil {
				return fmt.Errorf("%w: %s", ErrInvalidInput, name)
			}
			artifact, ok, err := s.artifacts.GetArtifact(ctx, artifactID)
			if err != nil {
				return err
			}
			if !ok {
				return fmt.Errorf("%w: %s", ErrArtifactNotFound, raw)
			}
			resolved[name] = artifact
		}
		return nil
	})
	if err != nil {
		return model.Run{}, err
	}

	workflow, err := buildWorkflow(definition, pipelineID, revision, resolved, s.s3)
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
