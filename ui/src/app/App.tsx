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
import {
  GraphCanvas,
  type NodeFocusRequest,
} from '../editor/GraphCanvas';
import { JsonPreviewDialog } from '../editor/JsonPreviewDialog';
import {
  NodeInspector,
  type InspectorMode,
} from '../editor/NodeInspector';
import { NodePalette } from '../editor/NodePalette';
import { serializeDefinition, toBackendJson } from '../editor/serialization';
import { useEditorStore } from '../editor/store';
import { localPipelineRepository } from '../repository/LocalPipelineRepository';

const pipelineId = 'pipeline-print-file';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ToastState {
  message: string;
  opensIssues?: boolean;
}

export function App() {
  const definition = useEditorStore((state) => state.definition);
  const catalog = useEditorStore((state) => state.catalog);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const issues = useEditorStore((state) => state.issues);
  const dirty = useEditorStore((state) => state.dirty);
  const hydrate = useEditorStore((state) => state.hydrate);
  const addNode = useEditorStore((state) => state.addNode);
  const updateNodeTitle = useEditorStore((state) => state.updateNodeTitle);
  const updateNodeConfig = useEditorStore((state) => state.updateNodeConfig);
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
  const [inspectorMode, setInspectorMode] =
    useState<InspectorMode>('settings');
  const [focusRequest, setFocusRequest] =
    useState<NodeFocusRequest | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      localPipelineRepository.getDraft(pipelineId),
      localPipelineRepository.getNodeCatalog(),
    ])
      .then(([draft, nextCatalog]) => {
        if (active) hydrate(draft.definition, nextCatalog);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить mock',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (dirty) setSaveStatus('idle');
  }, [dirty]);

  const selectedNode = definition?.nodes.find(
    (node) => node.id === selectedNodeId,
  );
  const selectedNodeType = catalog?.nodeTypes.find(
    (nodeType) =>
      nodeType.type === selectedNode?.type &&
      nodeType.version === selectedNode.typeVersion,
  );
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
      await localPipelineRepository.saveDraft({
        pipelineId,
        baseRevision: null,
        definition: serializeDefinition(definition),
      });
      markSaved();
      setSaveStatus('saved');
      setToast({ message: 'Черновик сохранён в localStorage' });
    } catch {
      setSaveStatus('error');
      setToast({ message: 'Не удалось сохранить черновик' });
    }
  }, [definition, markSaved]);

  const validate = useCallback(async () => {
    if (!definition) return;

    const result = await localPipelineRepository.validateDraft({
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
  }, [definition, setIssues]);

  const reset = useCallback(async () => {
    const [draft, nextCatalog] = await Promise.all([
      localPipelineRepository.resetDraft(pipelineId),
      localPipelineRepository.getNodeCatalog(),
    ]);
    hydrate(draft.definition, nextCatalog);
    setResetOpen(false);
    setSaveStatus('idle');
    setInspectorMode('settings');
    setFocusRequest(null);
    setToast({ message: 'Демо-граф восстановлен' });
  }, [hydrate]);

  if (loading) {
    return (
      <Box className="center-screen">
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress />
          <Typography color="text.secondary">
            Загружаем mock pipeline…
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (loadError || !definition || !catalog) {
    return (
      <Box className="center-screen">
        <Alert severity="error">{loadError ?? 'Нет данных редактора'}</Alert>
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
              Прочитать и напечатать файл
            </Typography>
          </Box>

          <Chip
            icon={<ScienceRoundedIcon />}
            label="Mock backend"
            size="small"
            color="secondary"
            variant="outlined"
            sx={{ ml: 1 }}
          />

          <Box sx={{ flex: 1 }} />

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
                    ? 'Сохранено локально'
                    : 'Черновик загружен'
            }
          />

          <Tooltip title="Вернуть исходный демонстрационный граф">
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
        <DialogTitle>Сбросить локальный черновик?</DialogTitle>
        <DialogContent>
          Текущие изменения будут удалены из localStorage, после чего откроется
          исходный демонстрационный pipeline.
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
        onClose={() => setToast(null)}
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

