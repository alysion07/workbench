/**
 * LineStylePopover
 * 개별 라인의 색상, 선 스타일, 선 굵기를 설정하는 팝오버
 * 색상: react-colorful HexColorPicker + hex 직접 입력
 */

import { useState, useEffect } from 'react';
import {
  Popover,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Tooltip,
} from '@mui/material';
import { HexColorPicker } from 'react-colorful';
import type { LineStylePreset, LineWidthPreset } from '@/types/simulation';

interface LineStylePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  currentColor: string;
  currentStyle: LineStylePreset;
  currentWidth: LineWidthPreset;
  onColorChange: (color: string) => void;
  onStyleChange: (style: LineStylePreset) => void;
  onWidthChange: (width: LineWidthPreset) => void;
  onClose: () => void;
}

const LineStylePopover: React.FC<LineStylePopoverProps> = ({
  anchorEl,
  open,
  currentColor,
  currentStyle,
  currentWidth,
  onColorChange,
  onStyleChange,
  onWidthChange,
  onClose,
}) => {
  const [hexInput, setHexInput] = useState(currentColor);

  useEffect(() => {
    setHexInput(currentColor);
  }, [currentColor]);

  const handleHexSubmit = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      onColorChange(hexInput);
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: { p: 1.5, width: 230 },
          onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
          onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
          onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
        },
      }}
    >
      {/* Color Picker */}
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
        Color
      </Typography>
      <Box
        sx={{
          mb: 1,
          '& .react-colorful': { width: '100%', height: 120 },
          '& .react-colorful__saturation': { borderRadius: '4px 4px 0 0' },
          '& .react-colorful__hue': { height: 12, borderRadius: '0 0 4px 4px' },
          '& .react-colorful__pointer': { width: 16, height: 16 },
        }}
      >
        <HexColorPicker color={currentColor} onChange={onColorChange} />
      </Box>
      <TextField
        size="small"
        value={hexInput}
        onChange={(e) => setHexInput(e.target.value)}
        onBlur={handleHexSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
        sx={{ mb: 1.5, '& input': { fontSize: '0.7rem', py: 0.5, px: 1, fontFamily: 'monospace' } }}
        fullWidth
        placeholder="#000000"
        InputProps={{
          startAdornment: (
            <Box
              sx={{
                width: 14, height: 14, borderRadius: '50%',
                backgroundColor: currentColor, border: '1px solid #ccc',
                mr: 0.75, flexShrink: 0,
              }}
            />
          ),
        }}
      />

      {/* Line Style */}
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
        Style
      </Typography>
      <ToggleButtonGroup
        value={currentStyle}
        exclusive
        onChange={(_, v) => { if (v) onStyleChange(v); }}
        size="small"
        fullWidth
        sx={{ mb: 1.5, '& .MuiToggleButton-root': { py: 0.25, fontSize: '0.65rem' } }}
      >
        <ToggleButton value="solid">
          <Tooltip title="Solid"><Box sx={{ width: 24, borderBottom: '2px solid currentColor' }} /></Tooltip>
        </ToggleButton>
        <ToggleButton value="dashed">
          <Tooltip title="Dashed"><Box sx={{ width: 24, borderBottom: '2px dashed currentColor' }} /></Tooltip>
        </ToggleButton>
        <ToggleButton value="dotted">
          <Tooltip title="Dotted"><Box sx={{ width: 24, borderBottom: '2px dotted currentColor' }} /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Line Width */}
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
        Width
      </Typography>
      <ToggleButtonGroup
        value={currentWidth}
        exclusive
        onChange={(_, v) => { if (v) onWidthChange(v); }}
        size="small"
        fullWidth
        sx={{ '& .MuiToggleButton-root': { py: 0.25, fontSize: '0.65rem' } }}
      >
        <ToggleButton value="thin">Thin</ToggleButton>
        <ToggleButton value="normal">Normal</ToggleButton>
        <ToggleButton value="bold">Bold</ToggleButton>
      </ToggleButtonGroup>
    </Popover>
  );
};

export default LineStylePopover;
