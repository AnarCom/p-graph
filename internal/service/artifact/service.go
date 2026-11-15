package artifactSvc

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"

	"github.com/google/uuid"

	"github.com/AnarCom/p-graph/internal/model"
)

const maxUploadSize = 100 << 20

type ArtifactStore interface {
	Create(ctx context.Context, id uuid.UUID, a model.Artifact) (model.Artifact, error)
	GetArtifact(ctx context.Context, id uuid.UUID) (model.Artifact, bool, error)
	List(ctx context.Context) ([]model.Artifact, error)
	Delete(ctx context.Context, id uuid.UUID) (bool, error)
}

type Transactor interface {
	Do(ctx context.Context, fn func(ctx context.Context) error) error
}

type ObjectStorage interface {
	Put(ctx context.Context, key, contentType string, r io.Reader, size int64) error
	Remove(ctx context.Context, key string) error
}

type ArtifactService struct {
	store ArtifactStore
	tx    Transactor
	s3    ObjectStorage
}

func NewArtifactService(store ArtifactStore, tx Transactor, s3 ObjectStorage) *ArtifactService {
	return &ArtifactService{store: store, tx: tx, s3: s3}
}

func (s *ArtifactService) Upload(ctx context.Context, fh *multipart.FileHeader) (model.Artifact, error) {
	if fh.Size > maxUploadSize {
		return model.Artifact{}, ErrInvalidArtifact
	}

	id := uuid.New()
	filename := filepath.Base(fh.Filename)
	contentType := fh.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	key := fmt.Sprintf("%s/%s", id, filename)

	f, err := fh.Open()
	if err != nil {
		return model.Artifact{}, fmt.Errorf("open uploaded file: %w", err)
	}
	defer f.Close()

	if err := s.s3.Put(ctx, key, contentType, f, fh.Size); err != nil {
		return model.Artifact{}, err
	}

	artifact := model.Artifact{
		ArtifactID:  id.String(),
		Filename:    filename,
		ContentType: contentType,
		Size:        fh.Size,
		S3Key:       key,
	}

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		saved, err := s.store.Create(ctx, id, artifact)
		if err != nil {
			return err
		}
		artifact = saved
		return nil
	})
	if err != nil {
		_ = s.s3.Remove(ctx, key)
		return model.Artifact{}, err
	}

	return artifact, nil
}

func (s *ArtifactService) List(ctx context.Context) ([]model.Artifact, error) {
	var artifacts []model.Artifact

	err := s.tx.Do(ctx, func(ctx context.Context) error {
		var err error
		artifacts, err = s.store.List(ctx)
		return err
	})
	if err != nil {
		return nil, err
	}
	return artifacts, nil
}

func (s *ArtifactService) Get(ctx context.Context, artifactID string) (model.Artifact, error) {
	id, err := uuid.Parse(artifactID)
	if err != nil {
		return model.Artifact{}, ErrArtifactNotFound
	}

	var artifact model.Artifact
	var found bool

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		var err error
		artifact, found, err = s.store.GetArtifact(ctx, id)
		return err
	})
	if err != nil {
		return model.Artifact{}, err
	}
	if !found {
		return model.Artifact{}, ErrArtifactNotFound
	}
	return artifact, nil
}

func (s *ArtifactService) Delete(ctx context.Context, artifactID string) error {
	id, err := uuid.Parse(artifactID)
	if err != nil {
		return ErrArtifactNotFound
	}

	var found bool
	var s3Key string

	err = s.tx.Do(ctx, func(ctx context.Context) error {
		artifact, ok, err := s.store.GetArtifact(ctx, id)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		found = true
		s3Key = artifact.S3Key
		if _, err := s.store.Delete(ctx, id); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	if !found {
		return ErrArtifactNotFound
	}

	return s.s3.Remove(ctx, s3Key)
}
