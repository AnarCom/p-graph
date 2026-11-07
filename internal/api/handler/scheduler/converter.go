package schedulerHandler

import (
	gen "github.com/AnarCom/p-graph/internal/api/gen/scheduler"
	"github.com/AnarCom/p-graph/internal/model"
)

func runToGen(run model.Run) gen.SchedulerRun {
	return gen.SchedulerRun{
		RunId:      run.RunID,
		PipelineId: run.PipelineID,
		Revision:   run.Revision,
		Status:     gen.SchedulerRunStatus(run.Status),
	}
}
