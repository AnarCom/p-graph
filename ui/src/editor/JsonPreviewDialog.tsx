import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';

interface JsonPreviewDialogProps {
  open: boolean;
  json: string;
  onClose: () => void;
  onCopied: () => void;
}

export function JsonPreviewDialog({
  open,
  json,
  onClose,
  onCopied,
}: JsonPreviewDialogProps) {
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    onCopied();
  };

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pipeline-definition.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Backend JSON</DialogTitle>
      <DialogContent>
        <TextField
          value={json}
          multiline
          fullWidth
          minRows={18}
          maxRows={26}
          slotProps={{
            input: {
              readOnly: true,
              sx: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
              },
            },
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ width: '100%', px: 1 }}>
          <Button
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => void copy()}
          >
            Копировать
          </Button>
          <Button startIcon={<DownloadRoundedIcon />} onClick={download}>
            Скачать
          </Button>
          <Button onClick={onClose} sx={{ ml: 'auto !important' }}>
            Закрыть
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

