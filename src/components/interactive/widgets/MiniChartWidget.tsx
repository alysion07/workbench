/**
 * MiniChartWidget
 * 미니 라인차트 위젯: 현재값 텍스트 + 트렌드 라인 + 축 + hover Tooltip
 * — F1.1~F1.6: 색상 코딩 + 폰트 강화 + 알람 우선
 */

import { memo, useMemo } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useViewport } from 'reactflow';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import type { NodeWidgetConfig, TimeSeriesPoint, AlarmLevel } from '@/types/interactive';
import { getWidgetColorByDataKey } from '@/utils/widgetColors';

interface MiniChartWidgetProps {
  config: NodeWidgetConfig;
  value: number | string | TimeSeriesPoint[] | undefined;
  alarmLevel?: AlarmLevel;
  customWidth?: number;
  customHeight?: number;
  pinned?: boolean;
  onPinToggle?: () => void;
  locked?: boolean;
  onLockToggle?: () => void;
}

/** Convert raw value for display based on unit */
function convertValue(raw: number, unit: string | undefined): number {
  if (unit === 'MPa') return raw / 1e6;
  if (unit === '°C') return raw - 273.15;
  return raw;
}

function formatValue(
  raw: number | string | undefined,
  unit: string | undefined,
  precision: number,
): string {
  if (raw === undefined || raw === null) return '--';
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (isNaN(num)) return '--';
  return convertValue(num, unit).toFixed(precision);
}

/** Format Y-axis tick: compact number */
function formatYTick(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}k`;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

const alarmBorderColors = {
  warning: '#ffc107',
  danger: '#f44336',
} as const;

const DEFAULT_CHART_HEIGHT = 48;

/** 차트 표시용 최대 포인트 수 */
const MAX_DISPLAY_POINTS = 200;

/**
 * Min-Max 버킷 다운샘플링 (프로그레시브 해상도)
 * - 최근 40% 예산: 원본 해상도 유지
 * - 과거 60% 예산: 버킷별 min/max 보존 → 피크/밸리 시각적 유지
 */
function downsampleForDisplay(
  series: TimeSeriesPoint[],
  maxPoints: number = MAX_DISPLAY_POINTS,
): TimeSeriesPoint[] {
  if (series.length <= maxPoints) return series;

  const recentBudget = Math.floor(maxPoints * 0.4);
  const olderBudget = maxPoints - recentBudget;
  const splitIdx = series.length - recentBudget;

  // 과거 구간: min-max 버킷 압축
  const bucketCount = Math.floor(olderBudget / 2);
  if (bucketCount <= 0) return series.slice(-maxPoints);

  const bucketSize = Math.ceil(splitIdx / bucketCount);
  const compressed: TimeSeriesPoint[] = [];

  for (let i = 0; i < splitIdx; i += bucketSize) {
    const end = Math.min(i + bucketSize, splitIdx);
    let minPt = series[i];
    let maxPt = series[i];
    for (let j = i + 1; j < end; j++) {
      if (series[j].value < minPt.value) minPt = series[j];
      if (series[j].value > maxPt.value) maxPt = series[j];
    }
    if (minPt.time <= maxPt.time) {
      compressed.push(minPt);
      if (minPt !== maxPt) compressed.push(maxPt);
    } else {
      compressed.push(maxPt);
      if (minPt !== maxPt) compressed.push(minPt);
    }
  }

  return [...compressed, ...series.slice(splitIdx)];
}

const MiniChartWidget: React.FC<MiniChartWidgetProps> = ({ config, value, alarmLevel, customWidth, customHeight, pinned, onPinToggle, locked, onLockToggle }) => {
  const { label, unit, precision = 2, chartColor = '#2196F3', dataKey } = config;
  const { zoom } = useViewport();
  // 줌 보정: LOD threshold(0.3) 수준까지 가독성 유지 — 상한 3.5
  const fs = Math.min(1 / Math.max(zoom, 0.1), 2.5);

  const isTimeSeries = Array.isArray(value);
  const rawData: TimeSeriesPoint[] = isTimeSeries ? value : [];

  // 다운샘플링 → 단위 변환 → 차트 데이터
  const displayData = useMemo(() => {
    if (rawData.length === 0) return [];
    const sampled = downsampleForDisplay(rawData);
    return sampled.map((pt) => ({
      time: pt.time,
      value: convertValue(pt.value, unit),
    }));
  }, [rawData, unit]);

  const currentRawValue = isTimeSeries
    ? rawData.length > 0 ? rawData[rawData.length - 1].value : undefined
    : (typeof value === 'number' || typeof value === 'string' ? value : undefined);

  const displayValue = formatValue(
    currentRawValue as number | string | undefined,
    unit,
    precision,
  );

  // 차트 영역 높이 결정
  const hasExplicitSize = customWidth !== undefined || customHeight !== undefined;

  // F1.6: 알람 활성 시 알람 색상 우선, 아니면 dataKey 기반 색상 코딩
  const borderColor = alarmLevel && alarmLevel !== 'normal'
    ? alarmBorderColors[alarmLevel]
    : getWidgetColorByDataKey(dataKey);

  const nameText = [config.nodeName, config.nodeDisplayId].filter(Boolean).join(' \u00b7 ');

  return (
    <Paper
      elevation={0}
      className="nodrag nopan"
      sx={{
        position: 'relative',
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
        minWidth: 200,
        // 명시적 크기(리사이즈됨)가 있으면 부모 컨테이너를 채움
        // 없으면 자연 크기 사용 (fit-content 부모와 100% 순환 의존 방지)
        ...(hasExplicitSize && { width: '100%', height: '100%' }),
        boxSizing: 'border-box',
        // F1.1: 색상 코딩 상단 테두리 + 전체 경계선
        border: '1px solid rgba(0,0,0,0.10)',
        borderTop: `2.5px solid ${borderColor}`,
        transition: 'background-color 0.3s, border-top-color 0.3s, box-shadow 0.2s',
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)' },
        // hover 시 핀/잠금 아이콘 표시
        '&:hover .pin-toggle': { opacity: 1 },
        '&:hover .lock-btn': { opacity: 1 },
        // 알람 배경 + 펄스 애니메이션
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
      }}
    >
      {/* 우상단 핀/잠금 아이콘 그룹 */}
      <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: '2px', zIndex: 1 }}>
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
      {/* 컨텐츠 행 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minHeight: 0 }}>
        {/* Label + Current Value */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 48 }}>
          <Typography variant="caption" sx={{ fontWeight: 500, color: '#999', fontSize: `${0.65 * fs}rem`, lineHeight: 1.2 }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            {/* F1.3: 값 폰트 강화 */}
            <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: `${1.0 * fs}rem`, color: '#333', lineHeight: 1.2 }}>
              {displayValue}
            </Typography>
            {unit && (
              <Typography variant="caption" sx={{ color: '#888', fontSize: `${0.6 * fs}rem`, lineHeight: 1.2 }}>
                {unit}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Mini LineChart with axes */}
        {displayData.length > 1 && (
          <Box sx={{ flex: 1, minWidth: 80, height: hasExplicitSize ? '100%' : DEFAULT_CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} margin={{ top: 2, right: 4, left: -12, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickCount={3}
                  tick={{ fontSize: 8 * fs, fill: '#999' }}
                  tickFormatter={(t) => `${Number(t).toFixed(0)}s`}
                  axisLine={{ stroke: '#ddd' }}
                  tickLine={false}
                  height={12 * fs}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickCount={3}
                  tick={{ fontSize: 8 * fs, fill: '#999' }}
                  tickFormatter={formatYTick}
                  axisLine={false}
                  tickLine={false}
                  width={28 * fs}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    fontSize: `${0.65 * fs}rem`,
                    padding: '4px 8px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    border: 'none',
                  }}
                  formatter={(v: any) => [Number(v).toFixed(precision), `${label} (${unit ?? ''})`]}
                  labelFormatter={(t) => `t=${Number(t).toFixed(1)}s`}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default memo(MiniChartWidget);
