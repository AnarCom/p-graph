package runSvc

import "errors"

var (
	ErrPipelineNotFound    = errors.New("pipeline not found")
	ErrUnsupportedNodeType = errors.New("unsupported node type")
)
