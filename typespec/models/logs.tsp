namespace PGraph {
model LogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}

model NodeLogs {
  runId: string;
  nodeId: string;
  attempt: int32;
  status: "Succeeded" | "Failed" | "Running";
  entries: LogEntry[];
}

}
