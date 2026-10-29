import {
  Box,
  ButtonBase,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import type { NodeTypeDefinition } from '../domain/pipeline';
import {
  encodeNodeTypeDrag,
  nodeTypeDragMime,
} from './paletteDrag';

const categoryNames: Record<string, string> = {
  files: 'Файлы',
  text: 'Текст',
  flow: 'Управление',
};

interface NodePaletteProps {
  nodeTypes: NodeTypeDefinition[];
  onAdd: (nodeType: NodeTypeDefinition) => void;
}

export function NodePalette({ nodeTypes, onAdd }: NodePaletteProps) {
  const categories = Array.from(
    new Set(nodeTypes.map((nodeType) => nodeType.category)),
  );

  return (
    <Box
      component="aside"
      sx={{
        width: 256,
        minWidth: 256,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowY: 'auto',
      }}
    >
      <Box sx={{ px: 2, py: 1.75 }}>
        <Typography variant="overline" color="text.secondary">
          Каталог узлов
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25 }}>
          Кликните или перетащите на canvas
        </Typography>
      </Box>
      <Divider />

      <Stack spacing={2.25} sx={{ p: 1.5 }}>
        {categories.map((category) => (
          <Stack key={category} spacing={0.75}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 0.5, fontWeight: 700 }}
            >
              {categoryNames[category] ?? category}
            </Typography>
            {nodeTypes
              .filter((nodeType) => nodeType.category === category)
              .map((nodeType) => (
                <ButtonBase
                  key={`${nodeType.type}@${nodeType.version}`}
                  onClick={() => onAdd(nodeType)}
                  draggable={nodeType.status !== 'disabled'}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData(
                      nodeTypeDragMime,
                      encodeNodeTypeDrag({
                        type: nodeType.type,
                        version: nodeType.version,
                      }),
                    );
                  }}
                  disabled={nodeType.status === 'disabled'}
                  sx={{
                    display: 'block',
                    width: '100%',
                    p: 1.25,
                    textAlign: 'left',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    transition: '120ms ease',
                    cursor: 'grab',
                    '&:active': {
                      cursor: 'grabbing',
                    },
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(139, 92, 246, 0.08)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{ gap: 1, alignItems: 'flex-start' }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 1,
                        bgcolor: 'rgba(139, 92, 246, 0.13)',
                        color: 'primary.light',
                      }}
                    >
                      <AddRoundedIcon fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {nodeType.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}
                      >
                        {nodeType.description}
                      </Typography>
                    </Box>
                  </Stack>
                  {nodeType.status !== 'active' && (
                    <Chip
                      size="small"
                      label={nodeType.status}
                      sx={{ mt: 1, height: 20 }}
                    />
                  )}
                </ButtonBase>
              ))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

