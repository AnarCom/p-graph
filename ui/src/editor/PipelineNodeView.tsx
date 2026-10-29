import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Handle,
  Position as HandlePosition,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type {
  NodeTypeDefinition,
  PipelineNode,
  ValidationIssue,
} from '../domain/pipeline';

export interface PipelineNodeData extends Record<string, unknown> {
  node: PipelineNode;
  nodeType?: NodeTypeDefinition;
  issues: ValidationIssue[];
}

export type PipelineFlowNode = Node<PipelineNodeData, 'pipeline'>;

const categoryColors: Record<string, string> = {
  files: '#38bdf8',
  text: '#a78bfa',
  flow: '#34d399',
};

function dataTypeLabel(dataType: string) {
  if (dataType === 'artifact.file') return 'file';
  return dataType;
}

export function PipelineNodeView({
  data,
  selected,
}: NodeProps<PipelineFlowNode>) {
  const { node, nodeType, issues } = data;
  const color = categoryColors[nodeType?.category ?? ''] ?? '#94a3b8';
  const hasError = issues.length > 0;

  return (
    <Paper
      elevation={selected ? 12 : 4}
      sx={{
        width: 232,
        overflow: 'visible',
        border: '1px solid',
        borderColor: hasError
          ? 'error.main'
          : selected
            ? 'primary.light'
            : 'divider',
        boxShadow: selected
          ? '0 0 0 2px rgba(139, 92, 246, 0.18), 0 18px 42px rgba(0, 0, 0, 0.38)'
          : '0 12px 30px rgba(0, 0, 0, 0.24)',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
    >
      <Box sx={{ height: 4, bgcolor: color, borderRadius: '12px 12px 0 0' }} />
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', gap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ fontWeight: 750, lineHeight: 1.3 }}
            >
              {node.title || nodeType?.title || node.type}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', mt: 0.25 }}
            >
              {node.type}@{node.typeVersion}
            </Typography>
          </Box>
          {hasError && (
            <Tooltip title={issues[0]?.message ?? 'Ошибка'}>
              <Chip
                label={issues.length}
                color="error"
                size="small"
                sx={{ minWidth: 28, height: 22 }}
              />
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Divider />

      {!nodeType ? (
        <Typography
          variant="caption"
          color="warning.main"
          sx={{ display: 'block', px: 1.5, py: 1.25 }}
        >
          Тип отсутствует в каталоге
        </Typography>
      ) : (
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', p: 1.25 }}
        >
          <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
            {nodeType.inputs.map((port, index) => (
              <Box key={port.name}>
                <Handle
                  id={`input:${port.name}`}
                  type="target"
                  position={HandlePosition.Left}
                  style={{
                    top: 78 + index * 28,
                    width: 10,
                    height: 10,
                    border: '2px solid #0b1020',
                    background: color,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {port.title}
                  <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>
                    {dataTypeLabel(port.dataType)}
                  </Box>
                </Typography>
              </Box>
            ))}
          </Stack>

          <Stack spacing={0.75} sx={{ alignItems: 'flex-end' }}>
            {nodeType.outputs.map((port, index) => (
              <Box key={port.name}>
                <Handle
                  id={`output:${port.name}`}
                  type="source"
                  position={HandlePosition.Right}
                  style={{
                    top: 78 + index * 28,
                    width: 10,
                    height: 10,
                    border: '2px solid #0b1020',
                    background: color,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  <Box component="span" sx={{ mr: 0.5, opacity: 0.6 }}>
                    {dataTypeLabel(port.dataType)}
                  </Box>
                  {port.title}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}

