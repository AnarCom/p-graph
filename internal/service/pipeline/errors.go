package pipelineSvc

import "errors"

var (
	ErrPipelineNotFound    = errors.New("pipeline not found")
	ErrNodeCatalogNotFound = errors.New("node catalog not found")
	ErrDraftConflict       = errors.New("draft conflict")
)
