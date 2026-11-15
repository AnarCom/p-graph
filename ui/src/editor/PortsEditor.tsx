import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import type { PortDefinition } from '../domain/pipeline';
import { validPortDefinitions } from './nodePorts';

const portDataTypes = [
  'text',
  'number',
  'boolean',
  'json',
  'artifact.file',
  'control',
  'any',
];

interface Props {
  direction: 'inputs' | 'outputs';
  ports: PortDefinition[];
  returnInputs?: PortDefinition[];
  onSave: (ports: PortDefinition[], renamed: Record<string, string>) => void;
}

export function PortsEditor({ direction, ports, returnInputs, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<
    { original?: string; port: PortDefinition }[]
  >([]);
  const input = direction === 'inputs';
  const update = (index: number, patch: Partial<PortDefinition>) =>
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, port: { ...row.port, ...patch } } : row,
      ),
    );
  const valid =
    validPortDefinitions(
      rows.map((row) => row.port),
      input,
    ) &&
    (!returnInputs ||
      rows.every(({ port }) =>
        returnInputs.some((source) => source.name === port.sourcePort),
      ));
  return (
    <>
      <Button
        variant="outlined"
        onClick={() => {
          setRows(
            ports.map((port) => ({
              original: port.name,
              port: structuredClone(port),
            })),
          );
          setOpen(true);
        }}
      >
        {input ? 'Редактировать входы' : 'Редактировать выходы'} ({ports.length}
        )
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {input ? 'Входные параметры' : 'Выходные параметры'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Имена: латинские буквы, цифры и _. Удаление порта удалит его
              связи. Переименование сохранит связи.
              {input &&
                ' Для нескольких стрелок оставьте максимум пустым; значение передаётся списком.'}
              {returnInputs &&
                ' Выходы return возвращают значения выбранных входов как результаты pipeline.'}
            </Alert>
            {rows.map(({ port }, index) => (
              <Stack
                key={index}
                spacing={1}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1.5,
                  borderRadius: 1,
                }}
              >
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Имя порта ${index + 1}`}
                    value={port.name}
                    onChange={(event) =>
                      update(index, { name: event.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Название"
                    value={port.title}
                    onChange={(event) =>
                      update(index, { title: event.target.value })
                    }
                  />
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Тип данных"
                    value={port.dataType}
                    disabled={Boolean(returnInputs)}
                    helperText={
                      returnInputs
                        ? 'Наследуется от входа-источника'
                        : undefined
                    }
                    onChange={(event) =>
                      update(index, { dataType: event.target.value })
                    }
                  >
                    {portDataTypes
                      .filter(
                        (type) =>
                          type !== 'any' ||
                          input ||
                          Boolean(returnInputs) ||
                          port.dataType === 'any',
                      )
                      .map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    {!portDataTypes.includes(port.dataType) && (
                      <MenuItem value={port.dataType}>{port.dataType}</MenuItem>
                    )}
                  </TextField>
                </Stack>
                {input && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      type="number"
                      label="Минимум связей"
                      value={port.minConnections ?? 0}
                      onChange={(event) =>
                        update(index, {
                          minConnections: Number(event.target.value),
                        })
                      }
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Максимум связей"
                      value={port.maxConnections ?? ''}
                      helperText="Пусто — без ограничения"
                      onChange={(event) =>
                        update(index, {
                          maxConnections:
                            event.target.value === ''
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Stack>
                )}
                {returnInputs && (
                  <TextField
                    select
                    size="small"
                    label="Вход-источник результата"
                    value={
                      returnInputs.some(
                        (source) => source.name === port.sourcePort,
                      )
                        ? port.sourcePort
                        : ''
                    }
                    onChange={(event) =>
                      update(index, {
                        sourcePort: event.target.value,
                        dataType: returnInputs.find(
                          (source) => source.name === event.target.value,
                        )!.dataType,
                      })
                    }
                  >
                    {returnInputs.map((source) => (
                      <MenuItem key={source.name} value={source.name}>
                        {source.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Button
                  color="error"
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Удалить порт {port.name}
                </Button>
              </Stack>
            ))}
            {!valid && (
              <Alert severity="error">
                Проверьте уникальность имён, типы и границы количества связей.
                Для выхода return выберите существующий вход.
              </Alert>
            )}
            <Button
              onClick={() => {
                let number = rows.length + 1;
                while (rows.some(({ port }) => port.name === `port_${number}`))
                  number++;
                const source = returnInputs?.[0];
                setRows((current) => [
                  ...current,
                  {
                    port: {
                      name: `port_${number}`,
                      title: `Параметр ${number}`,
                      dataType: source?.dataType ?? 'text',
                      ...(input
                        ? { minConnections: 1, maxConnections: null }
                        : {}),
                      ...(source ? { sourcePort: source.name } : {}),
                    },
                  },
                ]);
              }}
            >
              Добавить порт
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={!valid}
            onClick={() => {
              onSave(
                rows.map((row) => row.port),
                Object.fromEntries(
                  rows
                    .filter(
                      (row) => row.original && row.original !== row.port.name,
                    )
                    .map((row) => [row.original!, row.port.name]),
                ),
              );
              setOpen(false);
            }}
          >
            Применить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
