package usecase

import "errors"

var (
	ErrNodeCatalogNotFound = errors.New("node catalog not found")
	ErrPipelineNotFound    = errors.New("pipeline not found")
	ErrDraftConflict       = errors.New("draft conflict")
)
