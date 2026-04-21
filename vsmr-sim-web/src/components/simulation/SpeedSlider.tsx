/**
 * SpeedSlider
 * 시뮬레이션 배속 컨트롤 — 로그(구간 선형) 슬라이더.
 * fill = actual (실시간 변동, 매 스텝 업데이트)
 * thumb = target (사용자 드래그)
 * 우측에 TARGET / ACTUAL readout (RO1 2x2 grid)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

/* -- 스케일 유틸 --
 * tick position(0..1) 은 등간격 (0, 0.2, 0.4, 0.6, 0.8, 1.0)
 * tick speed 는 0.25 / 0.5 / 1 / 2 / 5 / 10
 * 구간 내부는 선형 보간 — 사용자 체감상 "6개 프리셋이 균등 간격" 을 유지.
 */
const TICK_POSITIONS = [0, 0.2, 0.4, 0.6, 0.8, 1.0] as const;
const TICK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;
const MIN_SPEED = TICK_SPEEDS[0];
const MAX_SPEED = TICK_SPEEDS[TICK_SPEEDS.length - 1];

export function positionToSpeed(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  for (let i = 0; i < TICK_POSITIONS.length - 1; i++) {
    const p0 = TICK_POSITIONS[i];
    const p1 = TICK_POSITIONS[i + 1];
    if (clamped >= p0 && clamped <= p1) {
      const t = (clamped - p0) / (p1 - p0);
      return TICK_SPEEDS[i] + t * (TICK_SPEEDS[i + 1] - TICK_SPEEDS[i]);
    }
  }
  return MAX_SPEED;
}

export function speedToPosition(s: number): number {
  if (s <= MIN_SPEED) return 0;
  if (s >= MAX_SPEED) return 1;
  for (let i = 0; i < TICK_SPEEDS.length - 1; i++) {
    const s0 = TICK_SPEEDS[i];
    const s1 = TICK_SPEEDS[i + 1];
    if (s >= s0 && s <= s1) {
      const t = (s - s0) / (s1 - s0);
      return TICK_POSITIONS[i] + t * (TICK_POSITIONS[i + 1] - TICK_POSITIONS[i]);
    }
  }
  return 1;
}

export interface SpeedSliderProps {
  target: number;
  actual: number | undefined;
  maxSpeed: number | undefined;
  disabled?: boolean;
  onChange: (speed: number) => void;
}

export default function SpeedSlider({
  target,
  actual,
  maxSpeed,
  disabled = false,
  onChange,
}: SpeedSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // 드래그 중 임시 타겟 — onChange 는 mouseup 에서 한 번만 emit. drag 중엔 thumb 만 이동.
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);

  const displayTarget = pendingTarget ?? target;
  const targetPos = useMemo(() => speedToPosition(displayTarget), [displayTarget]);
  const actualPos = useMemo(() => speedToPosition(actual ?? 0), [actual]);
  const maxPos = useMemo(
    () => (typeof maxSpeed === 'number' && maxSpeed > 0 ? speedToPosition(maxSpeed) : 1),
    [maxSpeed],
  );

  const computeSpeedFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return MIN_SPEED;
      const rect = el.getBoundingClientRect();
      const p = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(maxPos, p));
      return positionToSpeed(clamped);
    },
    [maxPos],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      draggingRef.current = true;
      setPendingTarget(computeSpeedFromClientX(e.clientX));
      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        setPendingTarget(computeSpeedFromClientX(ev.clientX));
      };
      const onUp = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        // 1자리 반올림으로 emit — 토스트/서버 입장에서 깔끔한 값 유지.
        const finalSpeed = Math.round(computeSpeedFromClientX(ev.clientX) * 10) / 10;
        setPendingTarget(null);
        onChange(finalSpeed);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [disabled, computeSpeedFromClientX, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const idx = TICK_SPEEDS.findIndex((s) => Math.abs(s - target) < 1e-6);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        const next = Math.min(TICK_SPEEDS.length - 1, (idx < 0 ? 0 : idx) + 1);
        onChange(TICK_SPEEDS[next]);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        const next = Math.max(0, (idx < 0 ? 0 : idx) - 1);
        onChange(TICK_SPEEDS[next]);
        e.preventDefault();
      }
    },
    [disabled, target, onChange],
  );

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2.5, py: 0.75, opacity: disabled ? 0.5 : 1 }}>
      {/* Slider */}
      <Box sx={{ position: 'relative', width: 280, height: 42, pt: '10px' }}>
        {/* Track */}
        <Box
          ref={trackRef}
          role="slider"
          aria-valuemin={MIN_SPEED}
          aria-valuemax={MAX_SPEED}
          aria-valuenow={displayTarget}
          aria-valuetext={`${displayTarget.toFixed(2)}x`}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          sx={{
            position: 'absolute',
            left: 0, right: 0, top: '50%',
            height: 4,
            transform: 'translateY(-50%)',
            bgcolor: 'grey.200',
            borderRadius: '2px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            '&:focus-visible': { boxShadow: '0 0 0 2px rgba(25,118,210,0.4)' },
          }}
        >
          {/* Fill = actual */}
          <Box
            sx={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${actualPos * 100}%`,
              background: 'linear-gradient(90deg, #64b5f6, #1976d2)',
              borderRadius: '2px',
              transition: 'width 0.2s ease-out',
            }}
          />
          {/* Disabled region beyond maxSpeed */}
          {maxPos < 1 && (
            <Box
              sx={{
                position: 'absolute',
                left: `${maxPos * 100}%`,
                right: 0, top: 0, bottom: 0,
                bgcolor: 'grey.300',
                opacity: 0.5,
              }}
            />
          )}
        </Box>

        {/* Ticks */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          {TICK_POSITIONS.map((p, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                left: `${p * 100}%`,
                top: '-3px',
                width: '1px',
                height: 10,
                bgcolor: 'rgba(0,0,0,0.2)',
                transform: 'translateX(-50%)',
              }}
            />
          ))}
        </Box>

        {/* Tick labels */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 22, height: 14, pointerEvents: 'none' }}>
          {TICK_POSITIONS.map((p, i) => (
            <Typography
              key={i}
              component="span"
              sx={{
                position: 'absolute',
                left: `${p * 100}%`,
                transform: 'translateX(-50%)',
                fontFamily: 'Roboto Mono, monospace',
                fontSize: 9,
                color: 'text.disabled',
              }}
            >
              {TICK_SPEEDS[i]}×
            </Typography>
          ))}
        </Box>

        {/* Target thumb */}
        <Box
          sx={{
            position: 'absolute',
            left: `${targetPos * 100}%`,
            top: '50%',
            width: 14,
            height: 14,
            bgcolor: '#fff',
            border: '2px solid',
            borderColor: 'info.dark',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            cursor: disabled ? 'not-allowed' : 'grab',
            zIndex: 2,
            pointerEvents: 'none',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 3,
              borderRadius: '50%',
              bgcolor: 'info.dark',
            },
          }}
        />
      </Box>

      {/* RO1 readout */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          columnGap: 1.25,
          rowGap: '2px',
          alignItems: 'baseline',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Typography component="span" sx={{ fontSize: 9, letterSpacing: '0.12em', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
          Target
        </Typography>
        <Typography component="span" sx={{ fontFamily: 'Roboto Mono, monospace', textAlign: 'right', fontSize: 15, fontWeight: 600, color: 'info.dark', lineHeight: 1 }}>
          {displayTarget.toFixed(displayTarget < 1 ? 2 : 1)}×
        </Typography>

        <Typography component="span" sx={{ fontSize: 9, letterSpacing: '0.12em', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
          Actual
        </Typography>
        <Typography component="span" sx={{ fontFamily: 'Roboto Mono, monospace', textAlign: 'right', fontSize: 12, color: 'text.secondary', lineHeight: 1 }}>
          {typeof actual === 'number' ? `${actual.toFixed(2)}×` : '--'}
        </Typography>
      </Box>
    </Box>
  );
}
