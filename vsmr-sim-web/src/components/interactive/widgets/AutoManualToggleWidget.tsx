/**
 * AutoManualToggleWidget
 * Trip Valve용 Auto/Manual 전환 + Open/Closed 상태 표시
 * — F1.1, F1.5: 색상 코딩 (밸브 주황) + 배경 대비 향상
 */

import { memo, useCallback } from 'react';
import { Paper, ToggleButton, ToggleButtonGroup, Chip, Box, Typography } from '@mui/material';
import { useViewport } from 'reactflow';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { NodeWidgetConfig } from '@/types/interactive';
import { getWidgetColorByDataKey } from '@/utils/widgetColors';

interface AutoManualToggleWidgetProps {
  config: NodeWidgetConfig;
  value: number | string | undefined;
  onValueChange?: (dataKey: string, newValue: string) => void;
  /** valveState for this node: "open" | "closed" */
  extraValues?: Record<string, number | string | undefined>;
  locked?: boolean;
  onLockToggle?: () => void;
}

const AutoManualToggleWidget: React.FC<AutoManualToggleWidgetProps> = ({
  config,
  value,
  onValueChange,
  extraValues,
  locked,
  onLockToggle,
}) => {
  const { zoom } = useViewport();
  // 줌 보정: LOD threshold(0.3) 수준까지 가독성 유지 — 상한 3.5
  const fs = Math.min(1 / Math.max(zoom, 0.1), 2.5);
  const mode = (value as string) || 'auto';
  const valveState = (extraValues?.valveState as string) || 'closed';
  const borderColor = getWidgetColorByDataKey(config.dataKey);

  const handleModeChange = useCallback(
    (_: React.MouseEvent, newMode: string | null) => {
      if (newMode && onValueChange) {
        onValueChange(config.dataKey, newMode);
      }
    },
    [config.dataKey, onValueChange],
  );

  const handleStateToggle = useCallback(() => {
    if (mode === 'manual' && onValueChange) {
      onValueChange('valveState', valveState === 'open' ? 'closed' : 'open');
    }
  }, [mode, valveState, onValueChange]);

  const nameText = [config.nodeName, config.nodeDisplayId].filter(Boolean).join(' \u00b7 ');

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.5,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '6px',
        // F1.5: 배경 대비 향상 — frosted glass
        backgroundColor: 'rgba(248, 250, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
        // F1.1: 색상 코딩 상단 테두리 + 전체 경계선
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `2.5px solid ${borderColor}`,
        position: 'relative',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)' },
        // hover 시 잠금 아이콘 표시
        '&:hover .lock-btn': { opacity: 1 },
      }}
    >
      {/* 우상단 잠금 아이콘 */}
      <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: '2px' }}>
        <Box
          className="nodrag nopan lock-btn"
          onClick={(e) => { e.stopPropagation(); onLockToggle?.(); }}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            display: 'flex', alignItems: 'center', cursor: 'pointer',
            opacity: locked ? 0.8 : 0, transition: 'opacity 0.15s',
            p: 0.25, borderRadius: 0.5,
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' },
          }}
          title={locked ? '잠금 해제 (이동/리사이즈 허용)' : '잠금 (이동/리사이즈 방지)'}
        >
          {locked
            ? <LockIcon sx={{ fontSize: 11 * fs, color: '#f44336' }} />
            : <LockOpenIcon sx={{ fontSize: 11 * fs, color: '#bbb' }} />
          }
        </Box>
      </Box>
      {/* R3: 이름표 — 수치 바로 위 */}
      {nameText && (
        <Typography variant="caption" sx={{ fontSize: `${0.7 * fs}rem`, fontWeight: 700, color: '#444', lineHeight: 1.2, mb: 0.25 }}>
          {nameText}
        </Typography>
      )}
      {/* 컨텐츠 행 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        className="nodrag nopan"
        sx={{ height: 24 }}
      >
        <ToggleButton
          value="auto"
          sx={{
            px: 1, py: 0, fontSize: `${0.75 * fs}rem`, fontWeight: 600,
            '&.Mui-selected': { backgroundColor: '#e3f2fd', color: '#1565c0' },
          }}
        >
          AUTO
        </ToggleButton>
        <ToggleButton
          value="manual"
          sx={{
            px: 1, py: 0, fontSize: `${0.75 * fs}rem`, fontWeight: 600,
            '&.Mui-selected': { backgroundColor: '#fff3e0', color: '#e65100' },
          }}
        >
          MAN
        </ToggleButton>
      </ToggleButtonGroup>

      <Box className="nodrag nopan" onClick={handleStateToggle} sx={{ cursor: mode === 'manual' ? 'pointer' : 'default' }}>
        <Chip
          label={valveState === 'open' ? 'Open' : 'Closed'}
          size="small"
          color={valveState === 'open' ? 'success' : 'default'}
          variant={valveState === 'open' ? 'filled' : 'outlined'}
          sx={{
            height: 22,
            fontSize: `${0.75 * fs}rem`,
            fontWeight: 600,
            opacity: mode === 'manual' ? 1 : 0.7,
          }}
        />
      </Box>
      </Box>
    </Paper>
  );
};

export default memo(AutoManualToggleWidget);
