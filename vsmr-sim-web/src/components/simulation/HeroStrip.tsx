/**
 * HeroStrip
 * SimulationControlBar 상단 히어로 스트립 — 시뮬레이션 실행 중 핵심 상태(RUNNING, probTime, progress) 를 강조 표시.
 */

import { Box, LinearProgress, Typography } from '@mui/material';
import type { SimStatus } from '@/types/simulation';

export interface HeroStripProps {
  status: SimStatus;
  statusBg: string;
  statusFg: string;
  isActive: boolean;
  probTimeSeconds: string;          // e.g. "1234.5" or "--"
  progressValue: number | null;      // 0..100, null 이면 bar 숨김
  elapsedText: string;               // "12m 30s"
}

export default function HeroStrip({
  status,
  statusBg,
  statusFg,
  isActive,
  probTimeSeconds,
  progressValue,
  elapsedText,
}: HeroStripProps) {
  return (
    <Box
      sx={{
        background: 'linear-gradient(90deg, rgba(76,175,80,0.06), rgba(25,118,210,0.04))',
        borderBottom: '1px dashed',
        borderColor: 'divider',
        px: 2.5,
        py: 1.75,
        display: 'flex',
        alignItems: 'center',
        gap: 2.25,
        minHeight: 56,
      }}
    >
      {/* Left cluster: status + probTime */}
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2.25 }}>
        {/* Status badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.75,
            py: 0.75,
            borderRadius: 1,
            bgcolor: statusBg,
            color: statusFg,
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
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
          {status.toUpperCase()}
        </Box>

        {/* probTime */}
        <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            component="span"
            sx={{
              fontSize: 11,
              color: 'text.secondary',
              letterSpacing: '0.06em',
            }}
          >
            probTime
          </Typography>
          <Typography
            component="span"
            sx={{
              fontFamily: 'Roboto Mono, ui-monospace, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 22,
              fontWeight: 500,
              color: 'info.dark',
              lineHeight: 1,
            }}
          >
            {probTimeSeconds}
          </Typography>
          <Typography
            component="span"
            sx={{ fontSize: 13, color: 'text.secondary' }}
          >
            s
          </Typography>
        </Box>
      </Box>

      {/* Right cluster: progress + elapsed + pct */}
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, width: 340, ml: 'auto' }}>
        <LinearProgress
          variant="determinate"
          value={progressValue ?? 0}
          sx={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              bgcolor: status === 'completed' ? 'info.main' : 'primary.main',
            },
            visibility: progressValue !== null ? 'visible' : 'hidden',
          }}
        />
        <Typography
          component="span"
          sx={{
            fontFamily: 'Roboto Mono, ui-monospace, monospace',
            fontSize: 11,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          }}
        >
          {elapsedText}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontFamily: 'Roboto Mono, ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 13,
            fontWeight: 500,
            minWidth: 42,
            textAlign: 'right',
            color: 'text.primary',
          }}
        >
          {progressValue !== null ? `${Math.round(progressValue)}%` : '--'}
        </Typography>
      </Box>
    </Box>
  );
}
