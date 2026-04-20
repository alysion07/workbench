/**
 * Chart Summary Card Component
 * 요약 정보 카드 (현재값, 최댓값, 최솟값 + 스파크라인)
 */

import { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useSimulationStore } from '@/stores/simulationStore';
import type { ChartConfig, ChartSummary } from '@/types/simulation';

interface ChartSummaryCardProps {
  config: ChartConfig;
  summary: ChartSummary;
  onNavigate?: (chartId: string) => void;
}

export const ChartSummaryCard: React.FC<ChartSummaryCardProps> = ({
  config,
  summary,
  onNavigate,
}) => {
  const { favoriteChartIds, toggleFavorite } = useSimulationStore();
  const isFavorite = favoriteChartIds.has(config.id);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(config.id);
  };

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(config.id);
    }
  };

  // 스파크라인 데이터 포맷팅 (summary.sparklineData는 이미 각 dataKey를 포함하는 객체 배열)
  const sparklineData = useMemo(() => {
    return summary.sparklineData;
  }, [summary.sparklineData]);

  // 값 포맷팅
  const formatValue = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
    return value.toFixed(2);
  };

  // 현재값 계산 (마지막 데이터 포인트의 평균 또는 첫 번째 dataKey 값)
  const currentValue = summary.currentValue ?? null;
  const displayValue = currentValue !== null ? formatValue(currentValue) : 'N/A';

  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onNavigate ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onNavigate
          ? {
              boxShadow: 4,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
      onClick={handleClick}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
          {config.title}
        </Typography>
        <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <IconButton
            size="small"
            onClick={handleToggleFavorite}
            sx={{ p: 0.5 }}
          >
            {isFavorite ? (
              <StarIcon fontSize="small" color="warning" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Current Value */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {displayValue}
          {config.unit && (
            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
              {config.unit}
            </Typography>
          )}
        </Typography>
      </Box>

      {/* Min/Max Values */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Min
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {formatValue(summary.minValue)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Max
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {formatValue(summary.maxValue)}
          </Typography>
        </Box>
      </Box>

      {/* Sparkline Chart */}
      <Box sx={{ flex: 1, minHeight: 60, mt: 1 }}>
        {sparklineData.length > 0 && config.dataKeys && config.dataKeys.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              {/* 모든 dataKey를 개별 라인으로 표시 */}
              {config.dataKeys.map((dataKey) => (
                <Line
                  key={dataKey.key}
                  type="monotone"
                  dataKey={dataKey.key}
                  stroke={dataKey.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              <RechartsTooltip
                formatter={(value: any, name: string) => {
                  const dataKey = config.dataKeys?.find((dk) => dk.key === name);
                  return [formatValue(value), dataKey?.label || name];
                }}
                labelFormatter={(value) => `Simulation Time: ${Number(value).toFixed(2)}s`}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : sparklineData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.dataKeys?.[0]?.color || '#2196F3'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <RechartsTooltip
                formatter={(value: any) => formatValue(value)}
                labelFormatter={(value) => `Simulation Time: ${Number(value).toFixed(2)}s`}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <Typography variant="caption">No data</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ChartSummaryCard;

