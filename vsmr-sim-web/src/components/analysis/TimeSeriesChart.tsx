/**
 * TimeSeriesChart
 * 단일 차트 패널 - 해당 패널의 변수들을 Recharts LineChart로 표시
 * 브러시 줌 지원 + 라인 보이기/숨기기, 강조, 스타일 커스터마이징
 */

import { useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Chip, Stack, IconButton, Tooltip } from '@mui/material';
import {
  Close as CloseIcon,
  DeleteSweep as ClearIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { useAnalysisStore } from '@/stores/analysisStore';
import ChartCustomLegend from '@/components/common/ChartCustomLegend';
import LineStylePopover from '@/components/simulation/LineStylePopover';
import type { ChartPanel } from '@/types/analysis';
import type { LineStylePreset, LineWidthPreset } from '@/types/simulation';

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

// 비교 오버레이용 색상 팔레트 (메인 차트 팔레트와 시각적으로 구분되는 톤)
const COMPARE_COLORS = [
  '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#009688',
  '#ff5722', '#795548', '#607d8b', '#00bcd4', '#ffc107',
];

interface TimeSeriesChartProps {
  panel: ChartPanel;
  data: Array<Record<string, number>>;
  isActive: boolean;
  onActivate: () => void;
}

/** 시간 포맷 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

/** Y축 값 포맷 - 유효숫자 기반으로 범위에 맞게 정밀도 조절 */
function formatYValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toPrecision(4)}G`;
  if (abs >= 1e6) return `${(value / 1e6).toPrecision(4)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toPrecision(4)}k`;
  if (abs >= 1) return value.toPrecision(4);
  if (abs === 0) return '0';
  return value.toPrecision(3);
}

/** 툴팁 값 포맷 */
function formatTooltipValue(value: number): string {
  return value.toExponential(4);
}

export default function TimeSeriesChart({ panel, data, isActive, onActivate }: TimeSeriesChartProps) {
  const removePanel = useAnalysisStore((s) => s.removePanel);
  const removeVariableFromPanel = useAnalysisStore((s) => s.removeVariableFromPanel);
  const clearPanelVariables = useAnalysisStore((s) => s.clearPanelVariables);
  const panelCount = useAnalysisStore((s) => s.panels.length);
  const syncZoom = useAnalysisStore((s) => s.syncZoom);
  const zoomDomain = useAnalysisStore((s) => s.zoomDomain);
  const setZoomDomain = useAnalysisStore((s) => s.setZoomDomain);
  const comparedFiles = useAnalysisStore((s) => s.comparedFiles);
  const chartLineStyles = useAnalysisStore((s) => s.chartLineStyles);
  const setLineStyle = useAnalysisStore((s) => s.setLineStyle);

  const lineStyles = chartLineStyles[panel.id] || {};

  // 브러시 줌 상태
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  // 라인 커스터마이징 로컬 상태
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const [popoverAnchor, setPopoverAnchor] = useState<{ el: HTMLElement; dataKey: string } | null>(null);

  const handleMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e?.activeLabel) {
      const val = Number(e.activeLabel);
      if (!isNaN(val)) {
        setBrushStart(val);
        setBrushEnd(null);
        isDraggingRef.current = true;
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (isDraggingRef.current && e?.activeLabel) {
      const val = Number(e.activeLabel);
      if (!isNaN(val)) setBrushEnd(val);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (brushStart !== null && brushEnd !== null && brushStart !== brushEnd) {
      const lo = Math.min(brushStart, brushEnd);
      const hi = Math.max(brushStart, brushEnd);
      if (syncZoom) {
        setZoomDomain([lo, hi]);
      }
    }
    setBrushStart(null);
    setBrushEnd(null);
    isDraggingRef.current = false;
  }, [brushStart, brushEnd, syncZoom, setZoomDomain]);

  // 더블 클릭으로 줌 리셋
  const handleDoubleClick = useCallback(() => {
    if (syncZoom) setZoomDomain(null);
  }, [syncZoom, setZoomDomain]);

  // 다운샘플링
  const chartData = useMemo(() => {
    const MAX_POINTS = 2000;
    if (data.length <= MAX_POINTS) return data;

    const step = Math.ceil(data.length / MAX_POINTS);
    const sampled: typeof data = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    return sampled;
  }, [data]);

  const { variables } = panel;

  // 표시할 변수 (숨김 필터 적용)
  const visibleVariables = useMemo(() => {
    return variables.filter((v) => !hiddenKeys.has(v.dataKey));
  }, [variables, hiddenKeys]);

  // 비교 파일 오버레이
  const comparedOverlayLines = useMemo(() => {
    if (comparedFiles.length === 0 || variables.length === 0) return [];

    const lines: Array<{
      dataKey: string;
      label: string;
      color: string;
      data: Array<Record<string, number>>;
    }> = [];

    // 현재 변수들이 쓰는 색은 비교 오버레이에서 제외 → 원본과 시각적으로 구분
    const usedVarColors = new Set(variables.map((v) => v.color.toLowerCase()));
    const palette = COMPARE_COLORS.filter((c) => !usedVarColors.has(c.toLowerCase()));
    const cyclePalette = palette.length > 0 ? palette : COMPARE_COLORS;

    let overlayIdx = 0;
    for (const cf of comparedFiles) {
      for (const v of variables) {
        // Co-Sim 기준: v.dataKey는 "<modelId>::<originalKey>" 네임스페이스 키이므로
        // 비교 파일(단일)과 매칭할 때는 originalKey로 조회한다.
        const lookupKey = v.originalKey ?? v.dataKey;
        const matchVar = cf.parsed.variables.find((cv) => cv.dataKey === lookupKey);
        if (!matchVar) continue;

        const overlayKey = `cmp_${cf.id}_${v.dataKey}`;
        // 해당 변수의 현재 색과도 다른지 추가 방어 (팔레트 내에서 v.color와 같은 톤은 스킵)
        let cidx = overlayIdx;
        while (cyclePalette[cidx % cyclePalette.length].toLowerCase() === v.color.toLowerCase()) {
          cidx += 1;
          if (cidx > overlayIdx + cyclePalette.length) break;
        }
        const color = cyclePalette[cidx % cyclePalette.length];
        overlayIdx += 1;
        lines.push({
          dataKey: overlayKey,
          label: `${v.label} [${cf.label}]`,
          color,
          data: cf.parsed.data.map((row) => ({
            time: row.time,
            [overlayKey]: row[lookupKey],
          })),
        });
      }
    }

    return lines;
  }, [comparedFiles, variables]);

  // Legend용 dataKeys 변환 (비교 오버레이 포함)
  const legendDataKeys = useMemo(() => {
    return [
      ...variables.map((v) => ({
        key: v.dataKey,
        label: v.label,
        color: v.color,
      })),
      ...comparedOverlayLines.map((ol) => ({
        key: ol.dataKey,
        label: ol.label,
        color: ol.color,
      })),
    ];
  }, [variables, comparedOverlayLines]);

  // 비교 데이터 병합
  const mergedData = useMemo(() => {
    if (comparedOverlayLines.length === 0) return chartData;

    const timeMap = new Map<number, Record<string, number>>();

    for (const row of chartData) {
      timeMap.set(row.time, { ...row });
    }

    for (const overlay of comparedOverlayLines) {
      for (const row of overlay.data) {
        const existing = timeMap.get(row.time);
        if (existing) {
          Object.assign(existing, row);
        } else {
          timeMap.set(row.time, { time: row.time, ...row });
        }
      }
    }

    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }, [chartData, comparedOverlayLines]);

  // Y축 도메인: 표시 중인 변수 + 표시 중인 비교 오버레이 모두 대상
  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (visibleVariables.length === 0) return undefined;

    let min = Infinity;
    let max = -Infinity;

    for (const row of chartData) {
      for (const v of visibleVariables) {
        const val = row[v.dataKey];
        if (val !== undefined && isFinite(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }

    // 비교 오버레이 값도 범위에 포함 (숨김된 오버레이는 제외)
    for (const ol of comparedOverlayLines) {
      if (hiddenKeys.has(ol.dataKey)) continue;
      for (const row of ol.data) {
        const val = row[ol.dataKey];
        if (val !== undefined && isFinite(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }

    if (!isFinite(min) || !isFinite(max)) return undefined;

    const range = max - min;
    if (range === 0) {
      const pad = Math.abs(max) * 0.05 || 1;
      return [min - pad, max + pad];
    }

    const pad = range * 0.1;
    return [min - pad, max + pad];
  }, [chartData, visibleVariables, comparedOverlayLines, hiddenKeys]);

  // --- 라인 커스터마이징 핸들러 ---

  const handleToggleVisibility = useCallback((dataKey: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      const visibleCount = variables.length - next.size;

      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else if (visibleCount > 1) {
        next.add(dataKey);
      }
      return next;
    });
  }, [variables.length]);

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
      setLineStyle(panel.id, popoverAnchor.dataKey, { color });
    }
  }, [popoverAnchor, panel.id, setLineStyle]);

  const handleStylePresetChange = useCallback((stylePreset: LineStylePreset) => {
    if (popoverAnchor) {
      setLineStyle(panel.id, popoverAnchor.dataKey, { stylePreset });
    }
  }, [popoverAnchor, panel.id, setLineStyle]);

  const handleWidthPresetChange = useCallback((widthPreset: LineWidthPreset) => {
    if (popoverAnchor) {
      setLineStyle(panel.id, popoverAnchor.dataKey, { widthPreset });
    }
  }, [popoverAnchor, panel.id, setLineStyle]);

  const popoverDataKey = popoverAnchor?.dataKey;
  const popoverCurrentStyle = popoverDataKey ? lineStyles[popoverDataKey] : undefined;
  const popoverDefaultColor = popoverDataKey
    ? variables.find((v) => v.dataKey === popoverDataKey)?.color || '#000000'
    : '#000000';

  return (
    <Paper
      onClick={onActivate}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: 1.5,
        cursor: 'pointer',
        border: 2,
        borderColor: isActive ? 'primary.main' : 'transparent',
        transition: 'border-color 0.15s',
      }}
    >
      {/* 패널 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          {panel.title}
        </Typography>
        {variables.length > 0 && (
          <Tooltip title="변수 전체 해제">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); clearPanelVariables(panel.id); }}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {panelCount > 1 && (
          <Tooltip title="패널 삭제">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); removePanel(panel.id); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 선택된 변수 칩 + 비교 오버레이 칩 */}
      {(variables.length > 0 || comparedOverlayLines.length > 0) && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
          {variables.map((v) => {
            const style = lineStyles[v.dataKey];
            const chipColor = style?.color || v.color;
            return (
              <Chip
                key={v.dataKey}
                label={v.label}
                size="small"
                onDelete={() => removeVariableFromPanel(panel.id, v.dataKey)}
                sx={{
                  borderLeft: `3px solid ${chipColor}`,
                  opacity: hiddenKeys.has(v.dataKey) ? 0.4 : 1,
                  '& .MuiChip-label': { fontSize: '0.7rem' },
                }}
              />
            );
          })}
          {comparedOverlayLines.map((ol) => {
            const style = lineStyles[ol.dataKey];
            const chipColor = style?.color || ol.color;
            return (
              <Chip
                key={ol.dataKey}
                label={ol.label}
                size="small"
                variant="outlined"
                sx={{
                  borderLeft: `3px solid ${chipColor}`,
                  opacity: hiddenKeys.has(ol.dataKey) ? 0.4 : 1,
                  '& .MuiChip-label': { fontSize: '0.7rem', fontStyle: 'italic' },
                }}
              />
            );
          })}
        </Stack>
      )}

      {/* 차트 영역 */}
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        {variables.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              {isActive ? '좌측에서 변수를 선택하세요' : '클릭하여 활성화 후 변수 추가'}
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={mergedData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                type="number"
                domain={
                  syncZoom && zoomDomain
                    ? zoomDomain
                    : ['dataMin', 'dataMax']
                }
                fontSize={11}
                allowDataOverflow
              />
              <YAxis
                tickFormatter={formatYValue}
                width={65}
                fontSize={11}
                domain={yDomain}
                allowDataOverflow
              />
              <RechartsTooltip
                formatter={(value: number, name: string) => [formatTooltipValue(value), name]}
                labelFormatter={(label: number) => `Time: ${formatTime(label)}`}
              />
              {/* Legend는 recharts 외부에서 렌더링 (이벤트 전파 방지) */}
              {visibleVariables.map((v) => {
                const style = lineStyles[v.dataKey];
                const color = style?.color || v.color;
                const baseWidth = LINE_WIDTH_MAP[style?.widthPreset || 'normal'];
                const hasHighlight = highlightedKeys.size > 0;
                const isThisHighlighted = highlightedKeys.has(v.dataKey);

                return (
                  <Line
                    key={v.dataKey}
                    type="monotone"
                    dataKey={v.dataKey}
                    name={v.label}
                    stroke={color}
                    dot={false}
                    strokeWidth={isThisHighlighted ? baseWidth * 2 : baseWidth}
                    strokeDasharray={LINE_STYLE_MAP[style?.stylePreset || 'solid']}
                    strokeOpacity={hasHighlight && !isThisHighlighted ? 0.2 : 1}
                    isAnimationActive={false}
                    connectNulls
                  />
                );
              })}
              {/* 비교 오버레이 라인 (별도 색상, 실선) */}
              {comparedOverlayLines
                .filter((ol) => !hiddenKeys.has(ol.dataKey))
                .map((ol) => {
                  const style = lineStyles[ol.dataKey];
                  const color = style?.color || ol.color;
                  const baseWidth = LINE_WIDTH_MAP[style?.widthPreset || 'normal'];
                  const hasHighlight = highlightedKeys.size > 0;
                  const isThisHighlighted = highlightedKeys.has(ol.dataKey);
                  return (
                    <Line
                      key={ol.dataKey}
                      type="monotone"
                      dataKey={ol.dataKey}
                      name={ol.label}
                      stroke={color}
                      dot={false}
                      strokeWidth={isThisHighlighted ? baseWidth * 2 : baseWidth}
                      strokeDasharray={LINE_STYLE_MAP[style?.stylePreset || 'solid']}
                      strokeOpacity={hasHighlight && !isThisHighlighted ? 0.2 : 1}
                      isAnimationActive={false}
                      connectNulls
                    />
                  );
                })}
              {/* 브러시 줌 선택 영역 */}
              {brushStart !== null && brushEnd !== null && (
                <ReferenceArea
                  x1={brushStart}
                  x2={brushEnd}
                  strokeOpacity={0.3}
                  fill="#1976d2"
                  fillOpacity={0.15}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>

      {/* Custom Legend — recharts 외부에 렌더링하여 이벤트 전파 차단 */}
      {legendDataKeys.length > 0 && (
        <ChartCustomLegend
          dataKeys={legendDataKeys}
          hiddenKeys={hiddenKeys}
          highlightedKeys={highlightedKeys}
          lineStyles={lineStyles}
          onToggleVisibility={handleToggleVisibility}
          onToggleHighlight={handleToggleHighlight}
          onOpenStylePopover={handleOpenStylePopover}
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
}
