namespace PGraph.Scheduler {
  union RunStatus {
    "Pending",
    "Scheduled",
    "Running",
    "Succeeded",
    "Failed",
    "Cancelled",
  }

  model Run {
    runId: string;
    pipelineId: string;
    revision: int32;
    status: RunStatus;
  }

  model RunPipelineRequest {
    pipelineId: string;
    revision: int32;
  }
}
