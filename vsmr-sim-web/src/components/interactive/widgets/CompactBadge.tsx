/**
 * CompactBadge
 * LOD 줌아웃 시 표시되는 초소형 위젯 — 값+단위만 표시
 * F2.2, F2.3, F2.4: 라벨 생략, 색상 코딩 테두리 유지
 */

import { memo } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { NodeWidgetConfig, AlarmLevel, TimeSeriesPoint } from '@/types/interactive';
import { getWidgetColorByDataKey } from '@/utils/widgetColors';

interface CompactBadgeProps {
  config: NodeWidgetConfig;
  value: number | string | TimeSeriesPoint[] | undefined;
  alarmLevel?: AlarmLevel;
  locked?: boolean;
  onLockToggle?: () => void;
}

const alarmBorderColors = {
  warning: '#ffc107',
  danger: '#f44336',
} as const;

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

const CompactBadge: React.FC<CompactBadgeProps> = ({ config, value, alarmLevel, locked, onLockToggle }) => {
  const { unit, precision = 2, dataKey } = config;

  // 시계열이면 최신값 추출
  const rawValue = Array.isArray(value)
    ? (value.length > 0 ? value[value.length - 1].value : undefined)
    : value;

  const displayValue = formatValue(
    rawValue as number | string | undefined,
    unit,
    precision,
  );

  const borderColor = alarmLevel && alarmLevel !== 'normal'
    ? alarmBorderColors[alarmLevel]
    : getWidgetColorByDataKey(dataKey);

  // F2.6: 줌 보정은 DraggableWidget의 pinScale로 컨테이너 레벨에서 처리됨
  // → CompactBadge 내부에서는 transform 불필요 (핸들 위치 불일치 방지)

  return (
    <Paper
      elevation={0}
      sx={{
        px: 0.75,
        py: 0.25,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        backgroundColor: 'rgba(248, 250, 255, 0.90)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `2px solid ${borderColor}`,
        // 알람 배경
        ...(alarmLevel === 'warning' && { backgroundColor: 'rgba(255, 248, 225, 0.95)', borderTop: `2px solid ${alarmBorderColors.warning}` }),
        ...(alarmLevel === 'danger' && {
          backgroundColor: 'rgba(255, 235, 238, 0.95)',
          borderTop: `2px solid ${alarmBorderColors.danger}`,
          '@keyframes alarmPulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
          },
          animation: 'alarmPulse 1.5s ease-in-out infinite',
        }),
        // hover 시 잠금 아이콘 표시
        '&:hover .lock-btn': { opacity: 1 },
      }}
    >
      {/* R3: 컴포넌트 이름표 */}
      {config.nodeName && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: '0.6rem',
            color: '#666',
            lineHeight: 1,
            mr: 0.25,
          }}
        >
          {config.nodeName}
        </Typography>
      )}
      {/* 우상단 잠금 아이콘 */}
      <Box sx={{ position: 'absolute', top: -2, right: -2 }}>
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
          title={locked ? '잠금 해제' : '잠금'}
        >
          {locked
            ? <LockIcon sx={{ fontSize: 10, color: '#f44336' }} />
            : <LockOpenIcon sx={{ fontSize: 10, color: '#bbb' }} />
          }
        </Box>
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: '#333',
          lineHeight: 1,
        }}
      >
        {displayValue}
      </Typography>
      {unit && (
        <Typography
          variant="caption"
          sx={{
            color: '#888',
            fontSize: '0.6rem',
            lineHeight: 1,
          }}
        >
          {unit}
        </Typography>
      )}
    </Paper>
  );
};

export default memo(CompactBadge);
