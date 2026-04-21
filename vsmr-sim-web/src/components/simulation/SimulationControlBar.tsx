/**
 * SimulationControlBar
 * 화면 최하단 고정 컨트롤 바 — Monitoring / Interactive Control 탭 공통
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import HeroStrip from './HeroStrip';
import SpeedSlider from './SpeedSlider';
import {
  PauseOutlined as PauseIcon,
  PlayArrowOutlined as ResumeIcon,
  StopOutlined as StopIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
} from '@mui/icons-material';
import type { ModelSimData, SimStatus } from '@/types/simulation';

// --- Speed options -----------------------------------------------------------

interface SpeedOption {
  ratio: number;
  label: string;
}

const SPEED_OPTIONS: SpeedOption[] = [
  { ratio: 0.25, label: '0.25x' },
  { ratio: 0.5, label: '0.5x' },
  { ratio: 1, label: '1x' },
  { ratio: 2, label: '2x' },
  { ratio: 4, label: '4x' },
  { ratio: 0, label: 'Max' },
];

// --- Helpers -----------------------------------------------------------------

const STORAGE_KEY = 'sim-control-bar:mode';

type BarMode = 'compact' | 'expanded';

function loadBarMode(): BarMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'compact' ? 'compact' : 'expanded';
  } catch {
    return 'expanded';
  }
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimehy(timehy: number | undefined): string {
  if (typeof timehy !== 'number' || Number.isNaN(timehy)) return '--';
  return (timehy / 1000).toFixed(1);
}

function formatSpeed(speed: number | undefined): string {
  if (typeof speed !== 'number' || Number.isNaN(speed)) return '--';
  if (speed === 0) return 'MAX';
  return `${speed.toFixed(3)}x`;
}

// --- Status badge ------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  building: { bg: 'grey.200', fg: 'grey.600' },
  running: { bg: 'success.light', fg: 'success.dark' },
  paused: { bg: 'warning.light', fg: 'warning.dark' },
  completed: { bg: 'info.light', fg: 'info.dark' },
  stopped: { bg: 'grey.300', fg: 'grey.700' },
  failed: { bg: 'error.light', fg: 'error.dark' },
};

// --- Component ---------------------------------------------------------------

export interface SimulationControlBarProps {
  activeModel: ModelSimData | null;
  sessionStatus: SimStatus | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (ratio: number) => void;
  maxTime?: number;
}

export default function SimulationControlBar({
  activeModel,
  sessionStatus,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
  maxTime,
}: SimulationControlBarProps) {
  const [mode, setMode] = useState<BarMode>(loadBarMode);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isActive = sessionStatus === 'running' || sessionStatus === 'paused';

  // Elapsed timer
  useEffect(() => {
    if (!activeModel || !isActive) {
      setElapsedSeconds(
        activeModel
          ? Math.floor(((activeModel.endTime ?? activeModel.startTime) - activeModel.startTime) / 1000)
          : 0,
      );
      return;
    }

    const tick = () => setElapsedSeconds(Math.floor((Date.now() - activeModel.startTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeModel, isActive]);

  // Mode toggle
  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'compact' ? 'expanded' : 'compact';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      return next;
    });
  }, []);

  // Speed handler
  const handleSpeedChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newValue: number | null) => {
      if (newValue === null) return;
      onSpeedChange(newValue);
    },
    [onSpeedChange],
  );

  const targetSpeedRaw = activeModel?.lastSimState?.target_speed;
  const selectedSpeed =
    typeof targetSpeedRaw === 'number'
      ? (targetSpeedRaw === 0 ? 10 : targetSpeedRaw)
      : 1;
  const compactSelectedSpeed =
    typeof targetSpeedRaw === 'number' ? targetSpeedRaw : 1;

  const compact = mode === 'compact';
  const simState = activeModel?.lastSimState;
  const maxSpeed = simState?.max_speed;
  const hasMaxSpeed = typeof maxSpeed === 'number' && maxSpeed > 0;
  const status = sessionStatus ?? 'building';
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.building;

  // Button enablement
  const canPause = status === 'running';
  const canResume = status === 'paused';
  const canStop = status === 'running' || status === 'paused';
  const canChangeSpeed = isActive;

  return (
    <Box
      sx={{
        position: 'relative',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 2,
        py: compact ? 0.5 : 1,
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Mode toggle */}
      <Tooltip title={compact ? '확장' : '축소'}>
        <IconButton
          size="small"
          onClick={toggleMode}
          sx={{ position: 'absolute', right: 4, top: compact ? 6 : 10, opacity: 0.5, '&:hover': { opacity: 1 } }}
        >
          {compact ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {!compact && activeModel && (() => {
        let progressValue: number | null = null;
        if (activeModel.progress != null && activeModel.progress >= 0) {
          progressValue = activeModel.progress;
        } else if (simState?.timehy != null && maxTime && maxTime > 0) {
          progressValue = Math.min((simState.timehy / 1000 / maxTime) * 100, 100);
        }

        return (
          <HeroStrip
            status={status}
            statusBg={colors.bg}
            statusFg={colors.fg}
            isActive={isActive}
            probTimeSeconds={formatTimehy(simState?.timehy)}
            progressValue={progressValue}
            elapsedText={formatElapsed(elapsedSeconds)}
          />
        );
      })()}
      {/* Row 1 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: compact ? 36 : 48 }}>
        {/* Playback — 슬라이더 톤에 맞춰 중성 아웃라인 아이콘 + 은은한 hover accent */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 0.25,
            bgcolor: 'background.default',
          }}
        >
          {[
            { title: '일시중지', icon: <PauseIcon fontSize="small" />, onClick: onPause, disabled: !canPause, hoverColor: 'warning.main' },
            { title: '재개', icon: <ResumeIcon fontSize="small" />, onClick: onResume, disabled: !canResume, hoverColor: 'info.dark' },
            { title: '중지', icon: <StopIcon fontSize="small" />, onClick: onStop, disabled: !canStop, hoverColor: 'error.main' },
          ].map(({ title, icon, onClick, disabled, hoverColor }) => (
            <Tooltip key={title} title={title}>
              <span>
                <IconButton
                  size="small"
                  onClick={onClick}
                  disabled={disabled}
                  sx={{
                    color: 'text.secondary',
                    borderRadius: '4px',
                    transition: 'color 0.15s, background-color 0.15s',
                    '&:hover': { color: hoverColor, bgcolor: 'action.hover' },
                    '&.Mui-disabled': { opacity: 0.3 },
                  }}
                >
                  {icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 2.5 }} />

        {compact ? (
          <>
            {/* Speed ToggleButtonGroup — compact 전용 */}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={compactSelectedSpeed}
              onChange={handleSpeedChange}
              disabled={!canChangeSpeed}
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.25,
                  py: 0.25,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  lineHeight: 1.4,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                },
              }}
            >
              {SPEED_OPTIONS.map((opt) => {
                const exceedsMax = hasMaxSpeed && opt.ratio > 0 && opt.ratio > maxSpeed!;
                return (
                  <Tooltip key={opt.ratio} title={exceedsMax ? `서버 최대 ${formatSpeed(maxSpeed)}` : ''} arrow>
                    <ToggleButton
                      value={opt.ratio}
                      sx={exceedsMax ? { opacity: 0.5, fontStyle: 'italic' } : undefined}
                    >
                      {opt.label}
                    </ToggleButton>
                  </Tooltip>
                );
              })}
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 2.5 }} />

            {/* Speed actual feedback — compact 전용 caption */}
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 64 }}>
              {simState ? `→${formatSpeed(simState.actual_speed)}` : '--'}
            </Typography>

            <Divider orientation="vertical" flexItem sx={{ mx: 2.5 }} />
          </>
        ) : (
          <>
            {/* SpeedSlider — expanded 전용, 내부에 Target/Actual readout 포함 */}
            <SpeedSlider
              target={selectedSpeed}
              actual={simState?.actual_speed}
              maxSpeed={maxSpeed}
              disabled={!canChangeSpeed}
              onChange={onSpeedChange}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 2.5 }} />
          </>
        )}

        {/* Sim info */}
        {compact ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontFamily: 'inherit' }}>T:</Typography>
            <Typography variant="caption" sx={{ minWidth: 48, textAlign: 'right', fontFamily: 'inherit', fontVariantNumeric: 'inherit', whiteSpace: 'nowrap' }}>{formatTimehy(simState?.timehy)} s</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontFamily: 'inherit' }}>#</Typography>
            <Typography variant="caption" sx={{ minWidth: 56, textAlign: 'right', fontFamily: 'inherit', fontVariantNumeric: 'inherit', whiteSpace: 'nowrap' }}>{simState?.iteration_count?.toLocaleString() ?? '--'}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5, fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {simState?.iteration_count?.toLocaleString() ?? '--'}
            </Box>
            <Box component="span" sx={{ color: 'text.disabled' }}>steps</Box>
          </Box>
        )}

        {compact && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 2.5 }} />
            {/* Status + elapsed — compact 모드에서만 표시. expanded 는 HeroStrip 에 위임 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: activeModel ? colors.bg : 'grey.100',
                  color: activeModel ? colors.fg : 'grey.400',
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'currentColor',
                    ...(isActive && {
                      animation: 'pulse-dot 1.4s ease-in-out infinite',
                      '@keyframes pulse-dot': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                      },
                    }),
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', lineHeight: 1 }}>
                  {activeModel ? status : 'IDLE'}
                </Typography>
              </Box>
              {activeModel && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {formatElapsed(elapsedSeconds)}
                </Typography>
              )}
            </Box>
          </>
        )}

      </Box>

    </Box>
  );
}
