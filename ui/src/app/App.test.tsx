import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { appTheme } from './theme';
import { App } from './App';
import { useEditorStore } from '../editor/store';
import { EditorView } from '@codemirror/view';
import { LocalPipelineRepository } from '../repository/LocalPipelineRepository';
import { sampleDraft } from '../mocks/sampleDraft';
import { mockNodeCatalog } from '../mocks/nodeCatalog';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?mock=true');
  });

  it('loads the mock pipeline editor', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>,
    );

    expect(await screen.findByText('Mock backend')).toBeInTheDocument();
    expect(screen.getAllByText('Загруженный файл').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'Пример control' }),
    ).toHaveAttribute('href', '?example=control');
  });

  it('keeps HTTP API as the default mode after integration with main', async () => {
    window.history.replaceState({}, '', '/');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        return new Response(
          JSON.stringify(
            url.includes('/node-catalog')
              ? mockNodeCatalog
              : {
                  ...sampleDraft,
                  pipelineId: '20000000-0000-4000-8000-000000000000',
                },
          ),
        );
      });
    try {
      render(
        <ThemeProvider theme={appTheme}>
          <App />
        </ThemeProvider>,
      );
      await screen.findByText('HTTP API');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://apiserver.local/pipelines/20000000-0000-4000-8000-000000000000/draft',
        expect.anything(),
      );
      expect(
        screen.getByRole('link', { name: 'Локальный редактор' }),
      ).toHaveAttribute('href', '?mock=true');
      act(() =>
        useEditorStore.getState().updateNodeTitle('python-read', 'HTTP edit'),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await screen.findByText('Черновик сохранён на сервере');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://apiserver.local/pipelines/20000000-0000-4000-8000-000000000000/draft',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(
        localStorage.getItem('p-graph:mock-draft:pipeline-print-file:v1'),
      ).toBeNull();
    } finally {
      fetchMock.mockRestore();
      window.history.replaceState({}, '', '/?mock=true');
    }
  });

  it('opens and saves the control example separately from the main draft', async () => {
    const key = 'p-graph:mock-draft:pipeline-print-file:v1';
    const original = JSON.stringify(sampleDraft);
    localStorage.setItem(key, original);
    window.history.replaceState({}, '', '/?example=control');
    try {
      render(
        <ThemeProvider theme={appTheme}>
          <App />
        </ThemeProvider>,
      );
      await screen.findByText('Пример: сигнал control');
      expect(
        useEditorStore
          .getState()
          .definition?.nodes.some((node) => node.id === 'control-after'),
      ).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
      await screen.findByText('Граф готов к запуску');
      act(() =>
        useEditorStore
          .getState()
          .updateNodeTitle('control-prepare', 'Мой пример'),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await screen.findByText('Черновик сохранён в localStorage');
      expect(localStorage.getItem(key)).toBe(original);
      const restored = await new LocalPipelineRepository().getDraft(
        'pipeline-control-example',
      );
      expect(
        restored.definition.nodes.find((node) => node.id === 'control-prepare')
          ?.title,
      ).toBe('Мой пример');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('opens the issues panel after failed validation', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>,
    );

    await screen.findByText('Mock backend');
    act(() => {
      useEditorStore.getState().removeEdge('edge-input-read');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Проблемы/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(
      screen.getByRole('button', { name: 'Показать' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Вход «Файл» требует связей: 1'));
    expect(useEditorStore.getState().selectedNodeId).toBe('python-read');
  });

  it('keeps the restored draft clean after reset', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>,
    );

    await screen.findByText('Mock backend');
    act(() => {
      useEditorStore.getState().removeEdge('edge-input-read');
    });
    expect(useEditorStore.getState().dirty).toBe(true);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Вернуть исходный демонстрационный граф',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    await waitFor(() => {
      expect(useEditorStore.getState().dirty).toBe(false);
    });
    expect(screen.getByText('Демо-граф восстановлен')).toBeInTheDocument();
  });

  it('edits Python code and ports and saves both in the local draft', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <App />
      </ThemeProvider>,
    );
    await screen.findByText('Mock backend');
    act(() => useEditorStore.getState().selectNode('python-read'));
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Версия Python' }),
    );
    fireEvent.click(screen.getByRole('option', { name: '3.13' }));
    fireEvent.change(screen.getByLabelText('Зависимости Python'), {
      target: { value: 'requests==2.32.5\n\nnumpy==2.2.0\n' },
    });
    expect(screen.getByLabelText('Зависимости Python')).toHaveValue(
      'requests==2.32.5\n\nnumpy==2.2.0\n',
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Редактировать выходы/ }),
    );
    fireEvent.change(screen.getByLabelText('Имя порта 1'), {
      target: { value: 'content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));
    expect(
      useEditorStore
        .getState()
        .definition?.edges.find((edge) => edge.id === 'edge-read-print')?.source
        .port,
    ).toBe('content');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Редактировать Python-код' }),
    );
    const content = await screen.findByRole('textbox', { name: 'Python-код' });
    const editor = EditorView.findFromDOM(content)!;
    const code = 'def run(inputs):\n    return {"content": "updated"}\n';
    act(() =>
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: code },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Черновик сохранён в localStorage');
    const draft = await new LocalPipelineRepository().getDraft(
      'pipeline-print-file',
    );
    const restored = draft.definition.nodes.find(
      (node) => node.id === 'python-read',
    )!;
    expect(restored.implementation?.code).toBe(code);
    expect(restored.implementation?.pythonVersion).toBe('3.13');
    expect(restored.implementation?.requirements).toEqual([
      'requests==2.32.5',
      'numpy==2.2.0',
    ]);
    expect(restored.outputs?.[0]?.name).toBe('content');
  });

  it('shows selected cube logs and the empty state for a new cube', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <App />
      </ThemeProvider>,
    );
    await screen.findByText('Mock backend');
    act(() => useEditorStore.getState().selectNode('python-read'));
    fireEvent.click(screen.getByRole('tab', { name: 'Логи' }));
    expect(
      await screen.findByText('Прочитано символов: 18'),
    ).toBeInTheDocument();
    act(() => {
      const type = useEditorStore
        .getState()
        .catalog!.nodeTypes.find((type) => type.type === 'builtin.python')!;
      useEditorStore.getState().addNode(type);
    });
    expect(
      await screen.findByText('Для этого кубика логов пока нет.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Прочитано символов: 18'),
    ).not.toBeInTheDocument();
  });
});
