package artifactHandler

import (
	"context"
	"errors"
	"mime/multipart"

	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
	"github.com/AnarCom/p-graph/internal/model"
	artifactSvc "github.com/AnarCom/p-graph/internal/service/artifact"
)

type ArtifactService interface {
	Upload(ctx context.Context, fh *multipart.FileHeader) (model.Artifact, error)
	List(ctx context.Context) ([]model.Artifact, error)
	Get(ctx context.Context, artifactID string) (model.Artifact, error)
	Delete(ctx context.Context, artifactID string) error
}

type ArtifactHandler struct {
	artifactSvc ArtifactService
}

func NewArtifactHandler(artifacts ArtifactService) *ArtifactHandler {
	return &ArtifactHandler{artifactSvc: artifacts}
}

const maxMultipartMemory = 32 << 20

func (h *ArtifactHandler) UploadArtifact(ctx context.Context, req gen.UploadArtifactRequestObject) (gen.UploadArtifactResponseObject, error) {
	if req.Body == nil {
		return gen.UploadArtifact400JSONResponse{Message: "missing request body"}, nil
	}

	form, err := req.Body.ReadForm(maxMultipartMemory)
	if err != nil {
		return gen.UploadArtifact400JSONResponse{Message: "invalid multipart form"}, nil
	}
	defer form.RemoveAll()

	files := form.File["file"]
	if len(files) == 0 {
		return gen.UploadArtifact400JSONResponse{Message: "file part is required"}, nil
	}

	artifact, err := h.artifactSvc.Upload(ctx, files[0])
	switch {
	case errors.Is(err, artifactSvc.ErrInvalidArtifact):
		return gen.UploadArtifact400JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return gen.UploadArtifact200JSONResponse(artifactToGen(artifact)), nil
}

func (h *ArtifactHandler) ListArtifacts(ctx context.Context, _ gen.ListArtifactsRequestObject) (gen.ListArtifactsResponseObject, error) {
	artifacts, err := h.artifactSvc.List(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]gen.Artifact, 0, len(artifacts))
	for _, artifact := range artifacts {
		out = append(out, artifactToGen(artifact))
	}
	return gen.ListArtifacts200JSONResponse(out), nil
}

func (h *ArtifactHandler) GetArtifact(ctx context.Context, req gen.GetArtifactRequestObject) (gen.GetArtifactResponseObject, error) {
	artifact, err := h.artifactSvc.Get(ctx, req.ArtifactId)
	switch {
	case errors.Is(err, artifactSvc.ErrArtifactNotFound):
		return gen.GetArtifact404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return gen.GetArtifact200JSONResponse(artifactToGen(artifact)), nil
}

func (h *ArtifactHandler) DeleteArtifact(ctx context.Context, req gen.DeleteArtifactRequestObject) (gen.DeleteArtifactResponseObject, error) {
	err := h.artifactSvc.Delete(ctx, req.ArtifactId)
	switch {
	case errors.Is(err, artifactSvc.ErrArtifactNotFound):
		return gen.DeleteArtifact404JSONResponse{Message: err.Error()}, nil
	case err != nil:
		return nil, err
	}

	return gen.DeleteArtifact204Response{}, nil
}
