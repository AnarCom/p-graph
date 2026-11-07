package model

type RunStatus string

const (
	RunStatusPending   RunStatus = "Pending"
	RunStatusScheduled RunStatus = "Scheduled"
	RunStatusRunning   RunStatus = "Running"
	RunStatusSucceeded RunStatus = "Succeeded"
	RunStatusFailed    RunStatus = "Failed"
	RunStatusCancelled RunStatus = "Cancelled"
)

type Run struct {
	RunID      string
	PipelineID string
	Revision   int32
	Status     RunStatus
}
