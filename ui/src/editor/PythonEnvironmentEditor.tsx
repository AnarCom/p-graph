import { useState } from 'react';
import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { PythonImplementation } from '../domain/pipeline';
import {
  defaultPythonVersion,
  parseRequirementsText,
  pythonEnvironmentIssues,
  suggestedPythonVersions,
} from './pythonEnvironment';

type Environment = Pick<PythonImplementation, 'pythonVersion' | 'requirements'>;

export function PythonEnvironmentEditor({
  implementation,
  onChange,
}: {
  implementation?: PythonImplementation;
  onChange: (patch: Environment) => void;
}) {
  const [requirementsText, setRequirementsText] = useState(
    () => implementation?.requirements?.join('\n') ?? '',
  );
  const version = implementation?.pythonVersion ?? defaultPythonVersion;
  const errors = pythonEnvironmentIssues(implementation);
  const requirementsErrors = errors.filter(
    (issue) => issue.code !== 'INVALID_PYTHON_VERSION',
  );
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Окружение Python</Typography>
      <TextField
        select
        fullWidth
        size="small"
        label="Версия Python"
        value={version}
        error={errors.some((issue) => issue.code === 'INVALID_PYTHON_VERSION')}
        helperText="Запрашиваемая версия окружения для будущего запуска"
        onChange={(event) => onChange({ pythonVersion: event.target.value })}
      >
        {suggestedPythonVersions.map((item) => (
          <MenuItem key={item} value={item}>
            {item}
          </MenuItem>
        ))}
        {!suggestedPythonVersions.includes(version) && (
          <MenuItem value={version}>{version}</MenuItem>
        )}
      </TextField>
      <TextField
        multiline
        fullWidth
        minRows={3}
        size="small"
        label="Зависимости Python"
        value={requirementsText}
        placeholder="requests==2.32.5"
        error={requirementsErrors.length > 0}
        helperText={
          requirementsErrors.length
            ? requirementsErrors.map((issue) => issue.message).join('. ')
            : 'По одному пакету==версия в строке. Для стандартной библиотеки оставьте пустым.'
        }
        onChange={(event) => {
          setRequirementsText(event.target.value);
          onChange({ requirements: parseRequirementsText(event.target.value) });
        }}
        sx={{ '& textarea': { fontFamily: 'monospace' } }}
      />
      <Typography variant="caption" color="text.secondary">
        Настройки сохраняются в JSON. Установка пакетов и выполнение кода пока
        не подключены.
      </Typography>
    </Stack>
  );
}
