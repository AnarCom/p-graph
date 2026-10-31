package pipelineStorage

import "errors"

var (
	ErrPipelineNotFound    = errors.New("pipeline not found")
	ErrNodeCatalogNotFound = errors.New("node catalog not found")
)
