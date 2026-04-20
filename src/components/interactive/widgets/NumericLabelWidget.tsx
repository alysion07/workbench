/**
 * NumericLabelWidget
 * 수치값 표시 위젯 (P: 15.50 MPa, T: 583.15 K)
 * — F1.1~F1.6: 색상 코딩 + 폰트 강화 + 알람 우선
 * — 인라인 핀/잠금 아이콘
 */

import { memo } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useViewport } from 'reactflow';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { NodeWidgetConfig, AlarmLevel } from '@/types/interactive';
import { getWidgetColorByDataKey } from '@/utils/widgetColors';

interface NumericLabelWidgetProps {
  config: NodeWidgetConfig;
  value: number | string | undefined;
  alarmLevel?: AlarmLevel;
  pinned?: boolean;
  onPinToggle?: () => void;
  locked?: boolean;
  onLockToggle?: () => void;
}

function formatValue(
  raw: number | string | undefined,
  unit: string | undefined,
  precision: number,
): string {
  if (raw === undefined || raw === null) return '--';
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (isNaN(num)) return '--';

  if (unit === 'MPa') return (num / 1e6).toFixed(precision);
  if (unit === '°C') return (num - 273.15).toFixed(precision);

  return num.toFixed(precision);
}

const alarmBorderColors = {
  warning: '#ffc107',
  danger: '#f44336',
} as const;

const NumericLabelWidget: React.FC<NumericLabelWidgetProps> = ({ config, value, alarmLevel, pinned, onPinToggle, locked, onLockToggle }) => {
  const { label, unit, precision = 2, dataKey } = config;
  const { zoom } = useViewport();
  // 줌 보정: 1/zoom 으로 화면상 크기 일정 유지, 최대 3배
  // 줌 보정: LOD threshold(0.3) 수준까지 가독성 유지 — 상한 3.5
  const fs = Math.min(1 / Math.max(zoom, 0.1), 2.5);
  const displayValue = formatValue(value, unit, precision);

  const borderColor = alarmLevel && alarmLevel !== 'normal'
    ? alarmBorderColors[alarmLevel]
    : getWidgetColorByDataKey(dataKey);

  const nameText = [config.nodeName, config.nodeDisplayId].filter(Boolean).join(' \u00b7 ');

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        px: 1,
        py: 0.5,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '6px',
        minWidth: 120,
        whiteSpace: 'nowrap',
        backgroundColor: 'rgba(248, 250, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `2.5px solid ${borderColor}`,
        transition: 'background-color 0.3s, border-top-color 0.3s, box-shadow 0.2s',
        ...(alarmLevel === 'warning' && { backgroundColor: 'rgba(255, 248, 225, 0.95)', borderTop: `2.5px solid ${alarmBorderColors.warning}` }),
        ...(alarmLevel === 'danger' && {
          backgroundColor: 'rgba(255, 235, 238, 0.95)',
          borderTop: `2.5px solid ${alarmBorderColors.danger}`,
          boxShadow: '0 4px 12px rgba(244,67,54,0.2), 0 1px 3px rgba(0,0,0,0.08)',
          '@keyframes alarmPulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
          },
          animation: 'alarmPulse 1.5s ease-in-out infinite',
        }),
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)' },
        // hover 시 핀/잠금 아이콘 표시
        '&:hover .pin-toggle': { opacity: 1 },
        '&:hover .lock-btn': { opacity: 1 },
      }}
    >
      {/* 우상단 핀/잠금 아이콘 그룹 */}
      <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: '2px' }}>
        <Box
          className="nodrag nopan pin-toggle"
          onClick={(e) => { e.stopPropagation(); onPinToggle?.(); }}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            display: 'flex', alignItems: 'center', cursor: 'pointer',
            opacity: pinned ? 0.8 : 0, transition: 'opacity 0.15s',
            p: 0.25, borderRadius: 0.5,
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' },
          }}
          title={pinned ? 'Unpin (줌아웃 시 축소)' : 'Pin (줌아웃 시 유지)'}
        >
          {pinned
            ? <PushPinIcon sx={{ fontSize: 12 * fs, color: '#1976d2' }} />
            : <PushPinOutlinedIcon sx={{ fontSize: 12 * fs, color: '#bbb' }} />
          }
        </Box>
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
      {/* 컨텐츠 행: P 15.50 MPa */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 500, color: '#999', fontSize: `${0.65 * fs}rem` }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: `${1.0 * fs}rem`, color: '#333', lineHeight: 1.2 }}>
          {displayValue}
        </Typography>
        {unit && (
          <Typography variant="caption" sx={{ color: '#888', fontSize: `${0.65 * fs}rem` }}>
            {unit}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default memo(NumericLabelWidget);
