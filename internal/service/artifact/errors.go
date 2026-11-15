package artifactSvc

import "errors"

var (
	ErrArtifactNotFound = errors.New("artifact not found")
	ErrInvalidArtifact  = errors.New("invalid artifact")
)
