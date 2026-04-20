/**
 * ChartCustomLegend
 * 차트 라인 보이기/숨기기, 강조, 스타일 설정을 위한 커스텀 Legend 컴포넌트
 *
 * - 클릭: 해당 라인 강조 (다른 라인 투명)
 * - 더블클릭: 해당 라인 숨기기/보이기
 * - 설정 아이콘: LineStylePopover 열기
 */

import { useCallback, useRef } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import type { LineStylePreset } from '@/types/simulation';

const CLICK_DELAY = 300;

export interface LegendDataKey {
  key: string;
  label: string;
  color: string;
}

interface ChartCustomLegendProps {
  dataKeys: LegendDataKey[];
  hiddenKeys: Set<string>;
  highlightedKeys: Set<string>;
  lineStyles: Record<string, { color?: string; stylePreset?: LineStylePreset }>;
  onToggleVisibility: (dataKey: string) => void;
  onToggleHighlight: (dataKey: string) => void;
  onOpenStylePopover: (el: HTMLElement, dataKey: string) => void;
  /** compact: 축약 스타일 (가로 스크롤, 작은 폰트, 설정 아이콘 숨김) */
  compact?: boolean;
}

export default function ChartCustomLegend({
  dataKeys,
  hiddenKeys,
  highlightedKeys,
  lineStyles,
  onToggleVisibility,
  onToggleHighlight,
  onOpenStylePopover,
  compact = false,
}: ChartCustomLegendProps) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent, dataKey: string) => {
      e.stopPropagation();
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        onToggleVisibility(dataKey);
      } else {
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null;
          onToggleHighlight(dataKey);
        }, CLICK_DELAY);
      }
    },
    [onToggleVisibility, onToggleHighlight],
  );

  const handleSettingsClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, dataKey: string) => {
      e.stopPropagation();
      onOpenStylePopover(e.currentTarget, dataKey);
    },
    [onOpenStylePopover],
  );

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        flexWrap: compact ? 'nowrap' : 'wrap',
        justifyContent: 'center',
        gap: compact ? 0.25 : 0.5,
        px: compact ? 0.5 : 1,
        py: compact ? 0.25 : 0.5,
        fontSize: compact ? '0.6rem' : '0.75rem',
        ...(compact && { overflowX: 'auto', overflowY: 'hidden', maxHeight: 28 }),
      }}
    >
      {dataKeys.map((dk) => {
        const isHidden = hiddenKeys.has(dk.key);
        const isHighlighted = highlightedKeys.has(dk.key);
        const style = lineStyles[dk.key];
        const color = style?.color || dk.color;
        const borderStyle = isHidden
          ? 'dashed'
          : style?.stylePreset === 'dotted'
            ? 'dotted'
            : style?.stylePreset === 'dashed'
              ? 'dashed'
              : 'solid';

        return (
          <Tooltip key={dk.key} title={dk.label} placement="top" enterDelay={400}>
            <Box
              onClick={(e) => handleClick(e, dk.key)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                userSelect: 'none',
                opacity: isHidden ? 0.4 : 1,
                '&:hover': { backgroundColor: 'action.hover' },
                '&:hover .legend-settings-btn': { opacity: 1 },
              }}
            >
              {/* 색상 라인 미리보기 */}
              <Box
                sx={{
                  width: compact ? 12 : 16,
                  height: 0,
                  borderBottom: `${isHighlighted ? 3 : 2}px ${borderStyle} ${isHidden ? '#999' : color}`,
                  flexShrink: 0,
                }}
              />
              {/* 라벨 */}
              <Typography
                variant="caption"
                sx={{
                  fontSize: compact ? '0.6rem' : '0.7rem',
                  fontWeight: isHighlighted ? 700 : 400,
                  textDecoration: isHidden ? 'line-through' : 'none',
                  color: isHidden ? 'text.disabled' : 'text.primary',
                  lineHeight: 1.2,
                  maxWidth: compact ? 140 : 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {dk.label}
              </Typography>
              {/* 설정 아이콘 — compact 모드에서는 숨김 */}
              {!compact && (
                <IconButton
                  className="legend-settings-btn"
                  size="small"
                  onClick={(e) => handleSettingsClick(e, dk.key)}
                  sx={{
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    p: 0.25,
                    ml: -0.25,
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                </IconButton>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
