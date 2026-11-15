import { resolveNodeType } from '../editor/nodePorts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { GraphCanvas, type NodeFocusRequest } from '../editor/GraphCanvas';
import { JsonPreviewDialog } from '../editor/JsonPreviewDialog';
import { NodeInspector, type InspectorMode } from '../editor/NodeInspector';
import { NodePalette } from '../editor/NodePalette';
import { serializeDefinition, toBackendJson } from '../editor/serialization';
import { useEditorStore } from '../editor/store';
import { localPipelineRepository } from '../repository/LocalPipelineRepository';
import { httpPipelineRepository } from '../repository/HttpPipelineRepository';
import { controlFlowDraft } from '../mocks/controlFlowDraft';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ToastState {
  message: string;
  opensIssues?: boolean;
}

export function App() {
  const isControlExample =
    new URLSearchParams(window.location.search).get('example') === 'control';
  const isMock =
    isControlExample ||
    new URLSearchParams(window.location.search).get('mock') === 'true';
  const repository = isMock ? localPipelineRepository : httpPipelineRepository;
  const pipelineId = isControlExample
    ? controlFlowDraft.pipelineId
    : isMock
      ? 'pipeline-print-file'
      : '20000000-0000-4000-8000-000000000000';
  const definition = useEditorStore((state) => state.definition);
  const catalog = useEditorStore((state) => state.catalog);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const issues = useEditorStore((state) => state.issues);
  const dirty = useEditorStore((state) => state.dirty);
  const hydrate = useEditorStore((state) => state.hydrate);
  const addNode = useEditorStore((state) => state.addNode);
  const updateNodeTitle = useEditorStore((state) => state.updateNodeTitle);
  const updateNodeConfig = useEditorStore((state) => state.updateNodeConfig);
  const updateNodePorts = useEditorStore((state) => state.updateNodePorts);
  const updateNodeEnvironment = useEditorStore(
    (state) => state.updateNodeEnvironment,
  );
  const updateNodeCode = useEditorStore((state) => state.updateNodeCode);
  const removeNode = useEditorStore((state) => state.removeNode);
  const setIssues = useEditorStore((state) => state.setIssues);
  const markSaved = useEditorStore((state) => state.markSaved);
  const selectNode = useEditorStore((state) => state.selectNode);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('settings');
  const [focusRequest, setFocusRequest] = useState<NodeFocusRequest | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    Promise.all([repository.getDraft(pipelineId), repository.getNodeCatalog()])
      .then(([draft, nextCatalog]) => {
        if (active) hydrate(draft.definition, nextCatalog);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить pipeline',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hydrate, pipelineId, repository]);

  useEffect(() => {
    if (dirty) setSaveStatus('idle');
  }, [dirty]);

  const selectedNode = definition?.nodes.find(
    (node) => node.id === selectedNodeId,
  );
  const selectedNodeType =
    catalog && selectedNode
      ? resolveNodeType(catalog, selectedNode)
      : undefined;
  const selectedIssues = issues.filter(
    (current) => current.location.nodeId === selectedNodeId,
  );

  const json = useMemo(
    () => (definition ? toBackendJson(definition) : ''),
    [definition],
  );

  const save = useCallback(async () => {
    if (!definition) return;
    setSaveStatus('saving');

    try {
      await repository.saveDraft({
        pipelineId,
        baseRevision: null,
        definition: serializeDefinition(definition),
      });
      markSaved();
      setSaveStatus('saved');
      setToast({
        message: isMock
          ? 'Черновик сохранён в localStorage'
          : 'Черновик сохранён на сервере',
      });
    } catch {
      setSaveStatus('error');
      setToast({ message: 'Не удалось сохранить черновик' });
    }
  }, [definition, markSaved, pipelineId, repository, isMock]);

  const validate = useCallback(async () => {
    if (!definition) return;

    const result = await repository.validateDraft({
      pipelineId,
      baseRevision: null,
      definition,
    });
    setIssues(result.issues);
    if (!result.valid) setInspectorMode('issues');
    setToast({
      message: result.valid
        ? 'Граф готов к запуску'
        : `Найдено проблем: ${result.issues.length}`,
      opensIssues: !result.valid,
    });
  }, [definition, setIssues, pipelineId, repository]);

  const reset = useCallback(async () => {
    const [draft, nextCatalog] = await Promise.all([
      repository.resetDraft(pipelineId),
      repository.getNodeCatalog(),
    ]);
    hydrate(draft.definition, nextCatalog);
    setResetOpen(false);
    setSaveStatus('idle');
    setInspectorMode('settings');
    setFocusRequest(null);
    setToast({
      message: isMock ? 'Демо-граф восстановлен' : 'Черновик сброшен',
    });
  }, [hydrate, pipelineId, repository, isMock]);

  if (loading) {
    return (
      <Box className="center-screen">
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress />
          <Typography color="text.secondary">Загружаем pipeline…</Typography>
        </Stack>
      </Box>
    );
  }

  if (loadError || !definition || !catalog) {
    return (
      <Box className="center-screen">
        <Stack spacing={2}>
          <Alert severity="error">{loadError ?? 'Нет данных редактора'}</Alert>
          {!isMock && (
            <Button variant="outlined" component="a" href="?mock=true">
              Открыть локальный редактор
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box className="app-shell">
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(8, 11, 20, 0.92)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important', gap: 1.5 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)',
            }}
          >
            <AccountTreeRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
              p-graph
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isControlExample
                ? 'Пример: сигнал control'
                : 'Редактор pipeline'}
            </Typography>
          </Box>

          <Chip
            icon={<ScienceRoundedIcon />}
            label={isMock ? 'Mock backend' : 'HTTP API'}
            size="small"
            color="secondary"
            variant="outlined"
            sx={{ ml: 1 }}
          />

          <Box sx={{ flex: 1 }} />

          {!isMock && (
            <Button
              color="inherit"
              component="a"
              href="?mock=true"
              target="_blank"
              rel="noopener"
            >
              Локальный редактор
            </Button>
          )}
          {!isControlExample && (
            <Button
              color="inherit"
              component="a"
              href="?example=control"
              target="_blank"
              rel="noopener"
            >
              Пример control
            </Button>
          )}

          <Chip
            size="small"
            variant="outlined"
            color={dirty ? 'warning' : 'success'}
            icon={!dirty ? <CheckCircleOutlineRoundedIcon /> : undefined}
            label={
              saveStatus === 'saving'
                ? 'Сохранение…'
                : dirty
                  ? 'Есть изменения'
                  : saveStatus === 'saved'
                    ? isMock
                      ? 'Сохранено локально'
                      : 'Сохранено на сервере'
                    : 'Черновик загружен'
            }
          />

          <Tooltip
            title={
              isMock
                ? 'Вернуть исходный демонстрационный граф'
                : 'Сбросить черновик на сервере'
            }
          >
            <Button
              color="inherit"
              startIcon={<RestartAltRoundedIcon />}
              onClick={() => setResetOpen(true)}
            >
              Сбросить
            </Button>
          </Tooltip>
          <Button
            color="inherit"
            startIcon={<CodeRoundedIcon />}
            onClick={() => setJsonOpen(true)}
          >
            JSON
          </Button>
          <Button
            variant="outlined"
            startIcon={<CheckCircleOutlineRoundedIcon />}
            onClick={() => void validate()}
          >
            Проверить
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveRoundedIcon />}
            disabled={!dirty || saveStatus === 'saving'}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </Toolbar>
      </AppBar>

      {!isMock && definition.schemaVersion !== '0.2' && (
        <Alert severity="info">
          Для Python-кубиков и редактируемых портов формата 0.2 откройте
          «Локальный редактор». Текущий граф сервера сохраняет свой формат.
        </Alert>
      )}
      {isControlExample && (
        <Alert severity="info">
          Пример control: «Напечатать текст» отправляет сигнал done → printed.
          Кубик «После вывода в консоль» зависит от завершения печати, без
          передачи текста по этой стрелке. Пример сохраняется отдельно от
          основного графа; выполнение и логи пока демонстрационные.
        </Alert>
      )}

      <Box className="editor-layout">
        <NodePalette
          nodeTypes={catalog.nodeTypes}
          onAdd={(nodeType) => {
            addNode(nodeType);
            setInspectorMode('settings');
          }}
        />

        <Box component="main" className="canvas-wrap">
          <GraphCanvas
            focusRequest={focusRequest}
            onInvalidConnection={() =>
              setToast({ message: 'Эти порты нельзя соединить' })
            }
            onOpenSettings={() => setInspectorMode('settings')}
          />
          {issues.length > 0 && (
            <Chip
              color="error"
              label={`Проблемы: ${issues.length}`}
              onClick={() => setInspectorMode('issues')}
              sx={{ position: 'absolute', left: 18, top: 18 }}
            />
          )}
        </Box>

        <NodeInspector
          repository={repository}
          logsAvailable={isMock}
          onEnvironmentChange={(patch) => {
            if (selectedNodeId) updateNodeEnvironment(selectedNodeId, patch);
          }}
          onCodeChange={(code) => {
            if (selectedNodeId) updateNodeCode(selectedNodeId, code);
          }}
          onPortsChange={(direction, ports, renamed) => {
            if (selectedNodeId)
              updateNodePorts(selectedNodeId, direction, ports, renamed);
          }}
          mode={inspectorMode}
          node={selectedNode}
          nodeType={selectedNodeType}
          issues={selectedIssues}
          allIssues={issues}
          onTitleChange={(title) => {
            if (selectedNodeId) updateNodeTitle(selectedNodeId, title);
          }}
          onConfigChange={(name, value) => {
            if (selectedNodeId) {
              updateNodeConfig(selectedNodeId, name, value);
            }
          }}
          onDelete={() => {
            if (selectedNodeId) removeNode(selectedNodeId);
          }}
          onModeChange={setInspectorMode}
          onIssueClick={(current) => {
            const edge = current.location.edgeId
              ? definition.edges.find(
                  (candidate) => candidate.id === current.location.edgeId,
                )
              : undefined;
            const nodeId = current.location.nodeId ?? edge?.target.nodeId;

            if (nodeId) {
              selectNode(nodeId);
              setFocusRequest((previous) => ({
                nodeId,
                requestId: (previous?.requestId ?? 0) + 1,
              }));
            }
            setInspectorMode('issues');
          }}
        />
      </Box>

      <JsonPreviewDialog
        open={jsonOpen}
        json={json}
        onClose={() => setJsonOpen(false)}
        onCopied={() => setToast({ message: 'JSON скопирован' })}
      />

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>
          {isMock
            ? 'Сбросить локальный черновик?'
            : 'Сбросить черновик на сервере?'}
        </DialogTitle>
        <DialogContent>
          {isMock
            ? 'Текущие изменения будут удалены из localStorage, после чего откроется исходный демонстрационный pipeline.'
            : 'Черновик на сервере будет сброшен. Текущие изменения будут потеряны.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Отмена</Button>
          <Button color="error" onClick={() => void reset()}>
            Сбросить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3200}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setToast(null);
        }}
        message={toast?.message}
        onClick={() => {
          if (toast?.opensIssues) setInspectorMode('issues');
        }}
        action={
          toast?.opensIssues ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => setInspectorMode('issues')}
            >
              Показать
            </Button>
          ) : undefined
        }
        sx={{ cursor: toast?.opensIssues ? 'pointer' : 'default' }}
      />
    </Box>
  );
}
