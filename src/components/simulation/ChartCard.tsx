/**
 * Chart Card Component
 * Individual chart with Y-axis toggle, line visibility toggle,
 * highlight, and per-line style customization
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useSimulationStore } from '@/stores/simulationStore';
import ChartCustomLegend from '@/components/common/ChartCustomLegend';
import LineStylePopover from './LineStylePopover';
import type { ChartConfig, LineStylePreset, LineWidthPreset } from '@/types/simulation';

// --- 상수 ---

const LINE_STYLE_MAP: Record<LineStylePreset, string | undefined> = {
  solid: undefined,
  dotted: '2 2',
  dashed: '6 3',
};

const LINE_WIDTH_MAP: Record<LineWidthPreset, number> = {
  thin: 1,
  normal: 2,
  bold: 3,
};

// --- ChartCard 메인 컴포넌트 ---

interface ChartCardProps {
  config: ChartConfig;
  data: Array<Record<string, any>>;
  height?: number | string;
  showYAxisToggle?: boolean;
  /** compact: 범례를 1줄 수평 스크롤로 축약, 헤더 최소화 */
  compact?: boolean;
}

export const ChartCard: React.FC<ChartCardProps> = ({ config, data, height = 350, showYAxisToggle: _showYAxisToggle = true, compact = false }) => {
  const { chartYAxisModes, chartLineStyles, setLineStyle } = useSimulationStore();

  // ResizeObserver로 차트 영역의 실제 크기 측정
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      setChartSize((prev) =>
        prev.width === Math.floor(width) && prev.height === Math.floor(h)
          ? prev
          : { width: Math.floor(width), height: Math.floor(h) }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 로컬 상태
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const [popoverAnchor, setPopoverAnchor] = useState<{ el: HTMLElement; dataKey: string } | null>(null);

  const lineStyles = chartLineStyles[config.id] || {};

  const cardNumber = config.minorEditCardNumber;
  const currentMode = cardNumber
    ? (chartYAxisModes[cardNumber] || config.yAxisMode || 'auto')
    : (config.yAxisMode || 'auto');

  const visibleDataKeys = useMemo(() => {
    return config.dataKeys?.filter((dk) => !hiddenKeys.has(dk.key)) || [];
  }, [config.dataKeys, hiddenKeys]);

  const yAxisDomain = useMemo(() => {
    if (currentMode === 'fixed' && config.yAxisFixed) {
      const [fixedMin, fixedMax] = config.yAxisFixed;

      if (visibleDataKeys.length === 0 || data.length === 0) {
        return [fixedMin, fixedMax] as [number, number];
      }

      const values = visibleDataKeys.flatMap((dataKey) =>
        data
          .map((d) => d[dataKey.key])
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      );

      if (values.length === 0) {
        return [fixedMin, fixedMax] as [number, number];
      }

      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);

      const nextMin = Math.min(fixedMin, dataMin);
      const nextMax = Math.max(fixedMax, dataMax);

      if (nextMin === nextMax) {
        const delta = Math.abs(nextMin) * 0.01 || 1;
        return [nextMin - delta, nextMax + delta] as [number, number];
      }

      return [nextMin, nextMax] as [number, number];
    }
    return ['auto', 'auto'] as const;
  }, [currentMode, config.yAxisFixed, visibleDataKeys, data]);

  const formatYAxisValue = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return value.toFixed(1);
  };

  const formatTooltipValue = (value: any) => {
    if (typeof value === 'number') {
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
      return value.toFixed(2);
    }
    return value;
  };

  // --- 이벤트 핸들러 ---

  const handleToggleVisibility = useCallback((dataKey: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      const totalKeys = config.dataKeys?.length || 0;
      const visibleCount = totalKeys - next.size;

      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else if (visibleCount > 1) {
        next.add(dataKey);
      }
      return next;
    });
  }, [config.dataKeys?.length]);

  const handleToggleHighlight = useCallback((dataKey: string) => {
    setHighlightedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  const handleOpenStylePopover = useCallback((el: HTMLElement, dataKey: string) => {
    setPopoverAnchor({ el, dataKey });
  }, []);

  const handleClosePopover = useCallback(() => {
    setPopoverAnchor(null);
  }, []);

  const handleColorChange = useCallback((color: string) => {
    if (popoverAnchor) {
      setLineStyle(config.id, popoverAnchor.dataKey, { color });
    }
  }, [popoverAnchor, config.id, setLineStyle]);

  const handleStylePresetChange = useCallback((stylePreset: LineStylePreset) => {
    if (popoverAnchor) {
      setLineStyle(config.id, popoverAnchor.dataKey, { stylePreset });
    }
  }, [popoverAnchor, config.id, setLineStyle]);

  const handleWidthPresetChange = useCallback((widthPreset: LineWidthPreset) => {
    if (popoverAnchor) {
      setLineStyle(config.id, popoverAnchor.dataKey, { widthPreset });
    }
  }, [popoverAnchor, config.id, setLineStyle]);

  const popoverDataKey = popoverAnchor?.dataKey;
  const popoverCurrentStyle = popoverDataKey ? lineStyles[popoverDataKey] : undefined;
  const popoverDefaultColor = popoverDataKey
    ? config.dataKeys?.find((dk) => dk.key === popoverDataKey)?.color || '#000000'
    : '#000000';

  if (!config.dataKeys || config.dataKeys.length === 0) {
    return null;
  }

  return (
    <Paper
      sx={{
        p: compact ? 1 : 2,
        height: height,
        display: 'flex',
        flexDirection: 'column',
        '&:focus': { outline: 'none' },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: compact ? 0.25 : 1 }}>
        <Typography
          variant={compact ? 'caption' : 'subtitle2'}
          sx={{ fontWeight: 600, flex: 1, fontSize: compact ? '0.72rem' : undefined }}
        >
          {config.title}
          {compact && config.unit ? ` (${config.unit})` : ''}
        </Typography>
        {compact && config.dataKeys && config.dataKeys.length > 1 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', flexShrink: 0 }}>
            {config.dataKeys.length} lines
          </Typography>
        )}
      </Box>

      {/* Chart */}
      <Box ref={chartContainerRef} sx={{ flex: 1, minHeight: 0 }}>
        {chartSize.width > 0 && chartSize.height > 0 && (
          <LineChart width={chartSize.width} height={chartSize.height} data={data} margin={compact ? { top: 2, right: 8, left: 0, bottom: 0 } : { top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              label={compact ? undefined : { value: 'Simulation Time (s)', position: 'insideBottom', offset: -5 }}
              tickFormatter={(value) => value.toFixed(1)}
              tick={{ fontSize: compact ? 10 : 12 }}
              height={compact ? 20 : 30}
            />
            <YAxis
              label={compact ? undefined : { value: config.unit || '', angle: -90, position: 'insideLeft' }}
              domain={yAxisDomain}
              tickFormatter={formatYAxisValue}
              tick={{ fontSize: compact ? 10 : 12 }}
              width={compact ? 40 : 60}
            />
            <RechartsTooltip
              formatter={formatTooltipValue}
              labelFormatter={(value) => `Time: ${Number(value).toFixed(2)}s`}
            />
            {config.dataKeys
              .filter((dk) => !hiddenKeys.has(dk.key))
              .map((dataKey) => {
                const style = lineStyles[dataKey.key];
                const color = style?.color || dataKey.color;
                const baseWidth = LINE_WIDTH_MAP[style?.widthPreset || 'normal'];
                const hasHighlight = highlightedKeys.size > 0;
                const isThisHighlighted = highlightedKeys.has(dataKey.key);

                return (
                  <Line
                    key={dataKey.key}
                    type="monotone"
                    dataKey={dataKey.key}
                    name={dataKey.label}
                    stroke={color}
                    dot={false}
                    strokeWidth={isThisHighlighted ? baseWidth * 2 : baseWidth}
                    strokeDasharray={LINE_STYLE_MAP[style?.stylePreset || 'solid']}
                    strokeOpacity={hasHighlight && !isThisHighlighted ? 0.2 : 1}
                    isAnimationActive={false}
                  />
                );
              })}
          </LineChart>
        )}
      </Box>

      {/* Custom Legend — recharts 외부에 렌더링하여 이벤트 전파 차단 */}
      {config.dataKeys && config.dataKeys.length > 0 && (
        <ChartCustomLegend
          dataKeys={config.dataKeys}
          hiddenKeys={hiddenKeys}
          highlightedKeys={highlightedKeys}
          lineStyles={lineStyles}
          onToggleVisibility={handleToggleVisibility}
          onToggleHighlight={handleToggleHighlight}
          onOpenStylePopover={handleOpenStylePopover}
          compact={compact}
        />
      )}

      {/* Line Style Popover */}
      <LineStylePopover
        anchorEl={popoverAnchor?.el || null}
        open={popoverAnchor !== null}
        currentColor={popoverCurrentStyle?.color || popoverDefaultColor}
        currentStyle={popoverCurrentStyle?.stylePreset || 'solid'}
        currentWidth={popoverCurrentStyle?.widthPreset || 'normal'}
        onColorChange={handleColorChange}
        onStyleChange={handleStylePresetChange}
        onWidthChange={handleWidthPresetChange}
        onClose={handleClosePopover}
      />
    </Paper>
  );
};

export default ChartCard;
