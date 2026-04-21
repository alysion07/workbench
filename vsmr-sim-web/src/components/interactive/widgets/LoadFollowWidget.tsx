/**
 * LoadFollowWidget
 * 하드코딩 캔버스 위젯: Trip 404 (load-follow) 제어 패널
 * SidePanel의 TripInputCard 기반, 캔버스 줌 보정 + 리사이즈 지원
 */

import { memo, useCallback } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useViewport } from 'reactflow';
import type { TripICVEntry } from '@/hooks/useICVPolling';
import { ControlMode } from '@/stubs/mars/mars_service_mod06_pb';

interface LoadFollowWidgetProps {
  tripEntry: TripICVEntry | null;
  simulationActive: boolean;
  onSetTripMode: (objectId: number, cmode: ControlMode) => Promise<void>;
}

const CMODE_LABELS: Record<number, string> = {
  [ControlMode.CONTROL_MODE_UNSPECIFIED]: '---',
  [ControlMode.AUTOMATIC]: 'AUTO',
  [ControlMode.MANUAL_TRUE]: 'MAN (T)',
  [ControlMode.MANUAL_FALSE]: 'MAN (F)',
};

const MODE_BUTTONS = [
  { key: 'auto', label: 'AUTO', cmode: ControlMode.AUTOMATIC, color: '#1565c0', bg: '#e3f2fd' },
  { key: 'manual_true', label: 'T', cmode: ControlMode.MANUAL_TRUE, color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'manual_false', label: 'F', cmode: ControlMode.MANUAL_FALSE, color: '#e65100', bg: '#fff3e0' },
] as const;

const LoadFollowWidget: React.FC<LoadFollowWidgetProps> = ({
  tripEntry,
  simulationActive,
  onSetTripMode,
}) => {
  const { zoom } = useViewport();
  const fs = Math.min(1 / Math.max(zoom, 0.1), 2.5);

  const isLive = simulationActive && tripEntry !== null;
  const cmode = tripEntry?.cmode ?? ControlMode.CONTROL_MODE_UNSPECIFIED;

  const handleModeClick = useCallback(
    (targetMode: ControlMode) => {
      if (!isLive || !tripEntry) return;
      if (targetMode !== tripEntry.cmode) {
        void onSetTripMode(tripEntry.objectId, targetMode);
      }
    },
    [isLive, tripEntry, onSetTripMode],
  );

  // 현재 모드 색상
  const activeMode = MODE_BUTTONS.find((m) => m.cmode === cmode);

  return (
    <Box
      className="nodrag nopan"
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(248, 250, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '6px',
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: '3px solid #FF5722',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        pointerEvents: 'auto',
        boxSizing: 'border-box',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.1)' },
      }}
    >
      {/* Header: 이름 + Trip 번호 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: `${0.8 * fs}rem`,
            color: '#333',
            lineHeight: 1.2,
          }}
        >
          Load Follow
        </Typography>
        <Chip
          label="#404"
          size="small"
          sx={{
            height: 18,
            fontSize: `${0.5 * fs}rem`,
            fontWeight: 600,
            backgroundColor: '#f5f5f5',
          }}
        />
      </Box>

      {/* 상태 표시: 모드 칩 + 값 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Chip
          label={isLive ? CMODE_LABELS[cmode] ?? '---' : '대기'}
          size="small"
          sx={{
            height: 22,
            fontSize: `${0.6 * fs}rem`,
            fontWeight: 700,
            backgroundColor: isLive && activeMode ? activeMode.bg : '#f5f5f5',
            color: isLive && activeMode ? activeMode.color : '#999',
          }}
        />
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: `${0.75 * fs}rem`,
            color: isLive ? '#333' : '#ccc',
          }}
        >
          {isLive ? tripEntry!.asis.toFixed(4) : '--'}
        </Typography>
      </Box>

      {/* 비활성 안내 */}
      {!simulationActive && (
        <Typography sx={{ fontSize: `${0.55 * fs}rem`, color: '#999' }}>
          시뮬레이션 실행 시 활성화
        </Typography>
      )}

      {/* 3-way 토글 버튼 */}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 'auto' }}>
        {MODE_BUTTONS.map((mode) => {
          const isActive = isLive && cmode === mode.cmode;
          return (
            <Box
              key={mode.key}
              onClick={() => handleModeClick(mode.cmode)}
              sx={{
                flex: 1,
                py: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${0.6 * fs}rem`,
                fontWeight: 700,
                borderRadius: '4px',
                cursor: isLive ? 'pointer' : 'default',
                border: isActive ? `2px solid ${mode.color}` : '1px solid #ddd',
                backgroundColor: isActive ? mode.bg : '#fff',
                color: isActive ? mode.color : isLive ? '#666' : '#ccc',
                opacity: isLive ? 1 : 0.5,
                transition: 'all 0.15s',
                userSelect: 'none',
                ...(isLive && !isActive && {
                  '&:hover': {
                    borderColor: mode.color,
                    backgroundColor: mode.bg,
                    color: mode.color,
                  },
                }),
              }}
            >
              {mode.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default memo(LoadFollowWidget);
