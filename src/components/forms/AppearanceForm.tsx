/**
 * AppearanceForm - Node Appearance Editor
 * Allows users to edit visual properties of nodes: size, color, shape, and custom SVG.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  ListSubheader,
  SelectChangeEvent,
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  RestartAlt as RestartAltIcon,
  Collections as LibraryIcon,
} from '@mui/icons-material';

import { MARSNodeData, NodeAppearance, NodeRotation, NodeShape } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import {
  resolveAppearance,
  getDefaultAppearance,
  COLOR_PRESETS,
  AVAILABLE_SHAPES,
  AVAILABLE_ROTATIONS,
  NODE_SIZE_LIMITS,
} from '@/utils/nodeAppearance';
import SvgLibraryDialog from '@/components/dialogs/SvgLibraryDialog';

// ============================================================================
// Props
// ============================================================================

interface AppearanceFormProps {
  nodeId: string;
  data: MARSNodeData;
}

// ============================================================================
// Constants
// ============================================================================

const LABEL_SX = { fontSize: '0.8rem', color: 'text.secondary', mb: 0.5 };

const SECTION_SX = { mb: 2 };

const COLOR_SQUARE_SIZE = 16;
const COLOR_GRID_GAP = '4px';
const COLOR_GRID_COLUMNS = 8;

// ============================================================================
// Component
// ============================================================================

export default function AppearanceForm({ nodeId, data }: AppearanceFormProps) {
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const svgLibrary = useStore((s) => s.svgLibrary);
  const appearance = resolveAppearance(data.appearance, data.componentType);

  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const aspectRatio = appearance.width / appearance.height;

  // Local draft state — allows free typing without immediate clamping
  const [draftWidth, setDraftWidth] = useState(String(appearance.width));
  const [draftHeight, setDraftHeight] = useState(String(appearance.height));

  // SVG Library Dialog state
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);

  // Sync drafts when appearance changes externally (e.g. reset, NodeResizer)
  useEffect(() => { setDraftWidth(String(appearance.width)); }, [appearance.width]);
  useEffect(() => { setDraftHeight(String(appearance.height)); }, [appearance.height]);

  // --------------------------------------------------------------------------
  // Size handlers (local draft + commit on blur/Enter)
  // --------------------------------------------------------------------------

  const clampWidth = (v: number) => Math.max(NODE_SIZE_LIMITS.minWidth, v);
  const clampHeight = (v: number) => Math.max(NODE_SIZE_LIMITS.minHeight, v);

  const commitWidth = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) {
        setDraftWidth(String(appearance.width));
        return;
      }
      const width = clampWidth(parsed);
      setDraftWidth(String(width));

      const update: Partial<NodeAppearance> = { width };
      if (lockAspectRatio) {
        const height = clampHeight(Math.round(width / aspectRatio));
        update.height = height;
        setDraftHeight(String(height));
      }
      updateNodeAppearance(nodeId, update);
    },
    [nodeId, updateNodeAppearance, lockAspectRatio, aspectRatio, appearance.width],
  );

  const commitHeight = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) {
        setDraftHeight(String(appearance.height));
        return;
      }
      const height = clampHeight(parsed);
      setDraftHeight(String(height));

      const update: Partial<NodeAppearance> = { height };
      if (lockAspectRatio) {
        const width = clampWidth(Math.round(height * aspectRatio));
        update.width = width;
        setDraftWidth(String(width));
      }
      updateNodeAppearance(nodeId, update);
    },
    [nodeId, updateNodeAppearance, lockAspectRatio, aspectRatio, appearance.height],
  );

  const handleSizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, commit: (v: string) => void) => {
      if (e.key === 'Enter') {
        commit((e.target as HTMLInputElement).value);
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Color handler
  // --------------------------------------------------------------------------

  const handleColorSelect = useCallback(
    (color: string) => {
      updateNodeAppearance(nodeId, { backgroundColor: color });
    },
    [nodeId, updateNodeAppearance],
  );

  // --------------------------------------------------------------------------
  // Shape handler
  // --------------------------------------------------------------------------

  const handleShapeChange = useCallback(
    (e: SelectChangeEvent) => {
      const newShape = e.target.value as NodeShape;
      const update: Partial<NodeAppearance> = { shape: newShape };
      // custom 이외로 변경 시 svgLibraryId 초기화
      if (newShape !== 'custom') {
        update.svgLibraryId = undefined;
      }
      updateNodeAppearance(nodeId, update);
    },
    [nodeId, updateNodeAppearance],
  );

  // --------------------------------------------------------------------------
  // SVG Library selection handler
  // --------------------------------------------------------------------------

  const handleSvgLibrarySelect = useCallback(
    (e: SelectChangeEvent) => {
      const svgId = e.target.value;
      updateNodeAppearance(nodeId, {
        shape: 'custom',
        svgLibraryId: svgId || undefined,
      });
    },
    [nodeId, updateNodeAppearance],
  );

  // --------------------------------------------------------------------------
  // Rotation handler
  // --------------------------------------------------------------------------

  const handleRotationChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newRotation: number | null) => {
      if (newRotation === null) return;
      updateNodeAppearance(nodeId, { rotation: newRotation as NodeRotation });
    },
    [nodeId, updateNodeAppearance],
  );

  // --------------------------------------------------------------------------
  // Reset handler
  // --------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    const defaults = getDefaultAppearance(data.componentType);
    updateNodeAppearance(nodeId, { ...defaults, svgLibraryId: undefined });
  }, [nodeId, data.componentType, updateNodeAppearance]);

  // --------------------------------------------------------------------------
  // Custom SVG 여부 판별
  // --------------------------------------------------------------------------

  const isCustomSvg = appearance.shape === 'custom';
  const selectedSvgItem = isCustomSvg && appearance.svgLibraryId
    ? svgLibrary.find(s => s.id === appearance.svgLibraryId)
    : undefined;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <Box sx={{ px: 1, py: 1 }}>
      {/* ================================================================== */}
      {/* Size Section                                                       */}
      {/* ================================================================== */}
      <Box sx={SECTION_SX}>
        <Typography sx={LABEL_SX} component="div">
          Size
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            label="W"
            size="small"
            value={draftWidth}
            onChange={(e) => setDraftWidth(e.target.value)}
            onBlur={(e) => commitWidth(e.target.value)}
            onKeyDown={(e) => handleSizeKeyDown(e as React.KeyboardEvent<HTMLInputElement>, commitWidth)}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            inputProps={{ 'aria-label': 'Node width' }}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
          />

          <Tooltip
            title={
              lockAspectRatio
                ? 'Aspect ratio locked'
                : 'Lock aspect ratio'
            }
          >
            <IconButton
              size="small"
              onClick={() => setLockAspectRatio((prev) => !prev)}
              aria-label={
                lockAspectRatio
                  ? 'Unlock aspect ratio'
                  : 'Lock aspect ratio'
              }
              sx={{ color: lockAspectRatio ? 'primary.main' : 'text.secondary' }}
            >
              {lockAspectRatio ? (
                <LockIcon fontSize="small" />
              ) : (
                <LockOpenIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          <TextField
            label="H"
            size="small"
            value={draftHeight}
            onChange={(e) => setDraftHeight(e.target.value)}
            onBlur={(e) => commitHeight(e.target.value)}
            onKeyDown={(e) => handleSizeKeyDown(e as React.KeyboardEvent<HTMLInputElement>, commitHeight)}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            inputProps={{ 'aria-label': 'Node height' }}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
          />
        </Box>
      </Box>

      {/* ================================================================== */}
      {/* Background Color Section (Custom SVG일 때 숨김)                     */}
      {/* ================================================================== */}
      {!isCustomSvg && (
        <Box sx={SECTION_SX}>
          <Typography sx={LABEL_SX} component="div">
            Background Color
          </Typography>

          {/* Current color preview */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              border: '2px solid',
              borderColor: 'divider',
              backgroundColor: appearance.backgroundColor,
              mb: 1,
            }}
            aria-label={`Current color: ${appearance.backgroundColor}`}
            role="img"
          />

          {/* Color preset grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLOR_GRID_COLUMNS}, ${COLOR_SQUARE_SIZE}px)`,
              gap: COLOR_GRID_GAP,
            }}
            role="radiogroup"
            aria-label="Color presets"
          >
            {COLOR_PRESETS.map((color) => {
              const isSelected =
                appearance.backgroundColor.toLowerCase() === color.toLowerCase();
              return (
                <Box
                  key={color}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Color ${color}`}
                  tabIndex={0}
                  onClick={() => handleColorSelect(color)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleColorSelect(color);
                    }
                  }}
                  sx={{
                    width: COLOR_SQUARE_SIZE,
                    height: COLOR_SQUARE_SIZE,
                    backgroundColor: color,
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid' : '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': {
                      transform: 'scale(1.2)',
                      borderColor: 'primary.light',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 1,
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* ================================================================== */}
      {/* Shape Section                                                      */}
      {/* ================================================================== */}
      <Box sx={SECTION_SX}>
        <Typography sx={LABEL_SX} component="div">
          Shape
        </Typography>

        <FormControl size="small" fullWidth>
          <InputLabel id={`shape-select-label-${nodeId}`} sx={{ fontSize: '0.8rem' }}>
            Shape
          </InputLabel>
          <Select
            labelId={`shape-select-label-${nodeId}`}
            value={appearance.shape}
            label="Shape"
            onChange={handleShapeChange}
            sx={{ fontSize: '0.8rem' }}
            aria-label="Node shape"
          >
            <ListSubheader sx={{ fontSize: '0.7rem', lineHeight: '28px' }}>Basic</ListSubheader>
            {AVAILABLE_SHAPES.filter((s) => s.group === 'Basic').map(({ value, label }) => (
              <MenuItem key={value} value={value} sx={{ fontSize: '0.8rem', pl: 3 }}>
                {label}
              </MenuItem>
            ))}
            <ListSubheader sx={{ fontSize: '0.7rem', lineHeight: '28px' }}>P&ID Symbols</ListSubheader>
            {AVAILABLE_SHAPES.filter((s) => s.group === 'P&ID').map(({ value, label }) => (
              <MenuItem key={value} value={value} sx={{ fontSize: '0.8rem', pl: 3 }}>
                {label}
              </MenuItem>
            ))}
            <ListSubheader sx={{ fontSize: '0.7rem', lineHeight: '28px' }}>Custom</ListSubheader>
            {AVAILABLE_SHAPES.filter((s) => s.group === 'Custom').map(({ value, label }) => (
              <MenuItem key={value} value={value} sx={{ fontSize: '0.8rem', pl: 3 }}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Custom SVG: 라이브러리에서 선택 */}
        {isCustomSvg && (
          <Box sx={{ mt: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8rem' }}>라이브러리에서 선택</InputLabel>
              <Select
                value={appearance.svgLibraryId ?? ''}
                label="라이브러리에서 선택"
                onChange={handleSvgLibrarySelect}
                sx={{ fontSize: '0.8rem' }}
              >
                <MenuItem value="" sx={{ fontSize: '0.8rem' }}>
                  <em>선택 안함</em>
                </MenuItem>
                {svgLibrary.map((item) => (
                  <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 라이브러리 관리 버튼 */}
            <Button
              variant="text"
              size="small"
              startIcon={<LibraryIcon fontSize="small" />}
              onClick={() => setLibraryDialogOpen(true)}
              fullWidth
              sx={{ mt: 0.5, fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
            >
              라이브러리 관리...
            </Button>

            {/* SVG 미리보기 */}
            {selectedSvgItem && (
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 80,
                  '& svg': {
                    maxWidth: '100%',
                    maxHeight: 80,
                    display: 'block',
                  },
                }}
                dangerouslySetInnerHTML={{ __html: selectedSvgItem.svgMarkup }}
              />
            )}
          </Box>
        )}
      </Box>

      {/* ================================================================== */}
      {/* Rotation Section                                                   */}
      {/* ================================================================== */}
      <Box sx={SECTION_SX}>
        <Typography sx={LABEL_SX} component="div">
          Rotation
        </Typography>

        <ToggleButtonGroup
          value={appearance.rotation}
          exclusive
          onChange={handleRotationChange}
          size="small"
          fullWidth
          aria-label="Node rotation"
        >
          {AVAILABLE_ROTATIONS.map(({ value, label }) => (
            <ToggleButton
              key={value}
              value={value}
              sx={{ fontSize: '0.75rem', py: 0.5, textTransform: 'none' }}
              aria-label={`Rotate ${label}`}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* ================================================================== */}
      {/* Reset Button                                                       */}
      {/* ================================================================== */}
      <Box sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={handleReset}
          fullWidth
          sx={{ fontSize: '0.8rem', textTransform: 'none' }}
          aria-label="Reset appearance to default values"
        >
          Reset to Default
        </Button>
      </Box>

      {/* SVG Library Dialog */}
      <SvgLibraryDialog
        open={libraryDialogOpen}
        onClose={() => setLibraryDialogOpen(false)}
      />
    </Box>
  );
}
