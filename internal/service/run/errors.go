package runSvc

import "errors"

var (
	ErrPipelineNotFound    = errors.New("pipeline not found")
	ErrUnsupportedNodeType = errors.New("unsupported node type")
	ErrArtifactNotFound    = errors.New("artifact not found")
	ErrMissingInput        = errors.New("missing input")
	ErrInvalidInput        = errors.New("invalid input")
)
