package artifactHandler

import (
	"github.com/AnarCom/p-graph/internal/model"

	gen "github.com/AnarCom/p-graph/internal/api/gen/apiserver"
)

func artifactToGen(a model.Artifact) gen.Artifact {
	return gen.Artifact{
		ArtifactId:  a.ArtifactID,
		Filename:    a.Filename,
		ContentType: a.ContentType,
		Size:        a.Size,
		CreatedAt:   a.CreatedAt,
	}
}
