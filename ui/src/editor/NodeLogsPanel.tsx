import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { NodeLogs } from '../domain/pipeline';
import type { PipelineRepository } from '../repository/PipelineRepository';
import { demoRunId } from '../mocks/nodeLogs';

export function NodeLogsPanel({
  nodeId,
  repository,
}: {
  nodeId: string;
  repository: PipelineRepository;
}) {
  const [logs, setLogs] = useState<NodeLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLogs(null);
    setError(false);
    repository
      .getNodeLogs(demoRunId, nodeId)
      .then((result) => {
        if (active) setLogs(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nodeId, repository, refresh]);

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Alert severity="info">
        Демонстрационные логи запуска {demoRunId}. Изменение кода не запускает
        кубик.
      </Alert>
      <Button onClick={() => setRefresh((value) => value + 1)}>
        Обновить логи
      </Button>
      {loading ? (
        <CircularProgress size={24} aria-label="Загрузка логов" />
      ) : error ? (
        <Alert severity="error">
          Не удалось загрузить логи. Попробуйте обновить.
        </Alert>
      ) : !logs || !logs.entries.length ? (
        <Alert severity="info">Для этого кубика логов пока нет.</Alert>
      ) : (
        <>
          <Typography variant="caption">
            {logs.status} · попытка {logs.attempt}
          </Typography>
          <Box
            role="log"
            aria-label="Логи кубика"
            sx={{
              bgcolor: '#090e1a',
              borderRadius: 1,
              p: 1.5,
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {logs.entries.map((entry, index) => (
              <Box
                key={index}
                sx={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  color:
                    entry.stream === 'stderr' ? 'error.light' : 'text.primary',
                  mb: 1,
                }}
              >
                <Box sx={{ color: 'text.secondary' }}>
                  {entry.timestamp} [{entry.stream}]
                </Box>
                {entry.message}
              </Box>
            ))}
          </Box>
        </>
      )}
    </Stack>
  );
}
