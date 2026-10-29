import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type {
  ConfigPropertySchema,
  NodeTypeDefinition,
  PipelineNode,
  ValidationIssue,
} from '../domain/pipeline';

interface NodeInspectorProps {
  mode: InspectorMode;
  node?: PipelineNode;
  nodeType?: NodeTypeDefinition;
  issues: ValidationIssue[];
  allIssues: ValidationIssue[];
  onTitleChange: (title: string) => void;
  onConfigChange: (name: string, value: unknown) => void;
  onDelete: () => void;
  onModeChange: (mode: InspectorMode) => void;
  onIssueClick: (issue: ValidationIssue) => void;
}

export type InspectorMode = 'settings' | 'issues';

function fieldValue(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return '';
}

function ConfigField({
  name,
  schema,
  value,
  error,
  onChange,
}: {
  name: string;
  schema: ConfigPropertySchema;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const label = schema.title ?? name;

  if (schema.type === 'boolean') {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={value === true}
            onChange={(_, checked) => onChange(checked)}
          />
        }
        label={label}
      />
    );
  }

  if (schema.enum) {
    return (
      <TextField
        select
        size="small"
        fullWidth
        label={label}
        value={fieldValue(value)}
        error={Boolean(error)}
        helperText={error ?? schema.description}
        onChange={(event) => onChange(event.target.value)}
      >
        {schema.enum.map((option) => (
          <MenuItem key={String(option)} value={fieldValue(option)}>
            {String(option)}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const numeric = schema.type === 'number' || schema.type === 'integer';

  return (
    <TextField
      size="small"
      fullWidth
      type={numeric ? 'number' : 'text'}
      label={label}
      value={fieldValue(value)}
      error={Boolean(error)}
      helperText={error ?? schema.description}
      onChange={(event) => {
        const next = event.target.value;
        onChange(numeric && next !== '' ? Number(next) : next);
      }}
    />
  );
}

export function NodeInspector({
  mode,
  node,
  nodeType,
  issues,
  allIssues,
  onTitleChange,
  onConfigChange,
  onDelete,
  onModeChange,
  onIssueClick,
}: NodeInspectorProps) {
  const locationLabel = (current: ValidationIssue) => {
    if (current.location.nodeId) return `Узел: ${current.location.nodeId}`;
    if (current.location.edgeId) return `Связь: ${current.location.edgeId}`;
    return 'Весь граф';
  };

  return (
    <Box
      component="aside"
      sx={{
        width: 320,
        minWidth: 320,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowY: 'auto',
      }}
    >
      <Tabs
        value={mode}
        onChange={(_, value: InspectorMode) => onModeChange(value)}
        variant="fullWidth"
        sx={{ minHeight: 56 }}
      >
        <Tab value="settings" label="Настройки" />
        <Tab
          value="issues"
          label={`Проблемы${allIssues.length ? ` · ${allIssues.length}` : ''}`}
        />
      </Tabs>
      <Divider />

      {mode === 'issues' ? (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          {allIssues.length === 0 ? (
            <Alert severity="success" variant="outlined">
              После последней проверки проблем не найдено.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Нажмите на проблему, чтобы выбрать связанный элемент графа.
              </Typography>
              {allIssues.map((current, index) => (
                <ButtonBase
                  key={`${current.code}-${index}`}
                  onClick={() => onIssueClick(current)}
                  sx={{
                    display: 'block',
                    width: '100%',
                    p: 1.25,
                    textAlign: 'left',
                    border: '1px solid',
                    borderColor: 'rgba(251, 113, 133, 0.42)',
                    borderRadius: 1.5,
                    bgcolor: 'rgba(251, 113, 133, 0.06)',
                    '&:hover': {
                      bgcolor: 'rgba(251, 113, 133, 0.12)',
                      borderColor: 'error.main',
                    },
                  }}
                >
                  <Stack spacing={0.75}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', gap: 1 }}
                    >
                      <Chip
                        size="small"
                        color="error"
                        variant="outlined"
                        label={current.code}
                        sx={{ height: 22, maxWidth: 190 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {locationLabel(current)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2">
                      {current.message}
                    </Typography>
                  </Stack>
                </ButtonBase>
              ))}
            </>
          )}
        </Stack>
      ) : !node ? (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Alert severity="info" variant="outlined">
            Выберите узел на canvas, чтобы изменить его параметры.
          </Alert>
          {allIssues.length > 0 && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => onModeChange('issues')}
            >
              Открыть проблемы ({allIssues.length})
            </Button>
          )}
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            size="small"
            fullWidth
            label="Название блока"
            value={node.title ?? ''}
            onChange={(event) => onTitleChange(event.target.value)}
          />

          <Box>
            <Typography variant="caption" color="text.secondary">
              Тип
            </Typography>
            <Typography variant="body2">
              {node.type}@{node.typeVersion}
            </Typography>
          </Box>

          {nodeType &&
            Object.entries(nodeType.configSchema.properties).map(
              ([name, schema]) => {
                const fieldIssue = issues.find(
                  (current) =>
                    current.location.configPath === `/${name}`,
                );
                return (
                  <ConfigField
                    key={name}
                    name={name}
                    schema={schema}
                    value={node.config[name]}
                    error={fieldIssue?.message}
                    onChange={(value) => onConfigChange(name, value)}
                  />
                );
              },
            )}

          {issues.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                Ошибки узла
              </Typography>
              {issues.map((current, index) => (
                <Alert
                  key={`${current.code}-${index}`}
                  severity="error"
                  variant="outlined"
                >
                  {current.message}
                </Alert>
              ))}
            </Stack>
          )}

          <Divider />
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={onDelete}
          >
            Удалить узел
          </Button>
        </Stack>
      )}
    </Box>
  );
}

