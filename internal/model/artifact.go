package model

import "time"

type Artifact struct {
	ArtifactID  string
	Filename    string
	ContentType string
	Size        int64
	S3Key       string
	CreatedAt   time.Time
}
