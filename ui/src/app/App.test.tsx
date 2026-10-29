import { beforeEach, describe, expect, it } from 'vitest';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { appTheme } from './theme';
import { App } from './App';
import { useEditorStore } from '../editor/store';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
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
    expect(screen.getByRole('button', { name: 'Показать' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByText('Вход «Файл» требует связей: 1'),
    );
    expect(useEditorStore.getState().selectedNodeId).toBe('read-file');
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
});

