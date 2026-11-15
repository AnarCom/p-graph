import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

function PythonCodeField({
  code,
  onChange,
}: {
  code: string;
  onChange: (code: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const currentOnChange = useRef(onChange);
  useEffect(() => {
    currentOnChange.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      parent: container.current,
      doc: code,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        indentUnit.of('    '),
        keymap.of([indentWithTab]),
        EditorView.contentAttributes.of({ 'aria-label': 'Python-код' }),
        EditorView.theme({
          '&': { height: '400px' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '14px',
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            currentOnChange.current(update.state.doc.toString());
        }),
      ],
    });
    editor.current = view;
    return () => {
      editor.current = null;
      view.destroy();
    };
    // The editor is created once; subsequent document changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== code) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    }
  }, [code]);
  return (
    <Box
      ref={container}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    />
  );
}

export function PythonEditor({
  code,
  onChange,
}: {
  code: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Редактировать Python-код
      </Button>
      <Typography variant="caption" color="text.secondary">
        Python · run(inputs) · {code.split('\n').length} строк
      </Typography>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Python-код кубика</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">
              Опишите def run(inputs): входы доступны по имени в словаре inputs.
              Верните словарь с именами выходов. print() пишет в stdout.
              Множественный вход передаётся списком. Код сохраняется в
              черновике; выполнение появится при подключении backend.
            </Alert>
            {open && <PythonCodeField code={code} onChange={onChange} />}
            <Typography variant="caption" color="text.secondary">
              Tab — отступ · Shift+Tab — убрать отступ · Ctrl/Cmd+Z — отмена ·
              Esc, затем Tab — выйти из редактора с клавиатуры
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Готово</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
