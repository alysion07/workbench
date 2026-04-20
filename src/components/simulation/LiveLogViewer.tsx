/**
 * Live Log Viewer
 * 실시간 로그를 표시하는 컴포넌트 (자동 스크롤)
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { Box, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, LinearProgress } from '@mui/material';
import {
  Download as DownloadIcon,
  Clear as ClearIcon,
  PauseCircle as PauseIcon,
  PlayCircle as PlayIcon,
} from '@mui/icons-material';
import { useSimulationStore, useScreenLogs, useActiveModel } from '@/stores/simulationStore';
import { isMockMode } from '@/services/sm';
import { usePlotData } from '@/stores/simulationStore';
import type { MinorEdit } from '@/types/mars';

interface LiveLogViewerProps {
  taskId: string;
  minorEdits?: MinorEdit[];
  /** Co-Sim All 탭: 특정 모델의 데이터를 직접 지정 */
  modelId?: string;
}

const LiveLogViewer: React.FC<LiveLogViewerProps> = ({ taskId, minorEdits = [], modelId }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { autoScroll, setAutoScroll, clearAllModelData } = useSimulationStore();
  const screenLogs = useScreenLogs(modelId);
  const plotData = usePlotData(modelId);
  const [logType, setLogType] = useState<'screen' | 'plot'>('screen');
  const activeModel = useActiveModel();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);

  // useLiveData는 SimulationPage 레벨에서 호출됨 (탭 전환 시에도 스트림 유지)

  // Mock 모드에서 진행률 계산 (60초 기준)
  const mockMode = isMockMode();
  
  useEffect(() => {
    if (!activeModel || activeModel.status !== 'running' || !mockMode) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - activeModel.startTime) / 1000; // seconds
      setElapsedTime(elapsed);
      
      // 60초 기준 진행률 계산
      const progressPercent = Math.min((elapsed / 60) * 100, 100);
      setProgress(progressPercent);
    }, 100);

    return () => clearInterval(interval);
  }, [activeModel, mockMode]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [screenLogs, plotData, logType, autoScroll]);

  const plotLogs = useMemo(
    () => formatPlotLines(plotData, minorEdits),
    [plotData, minorEdits]
  );
  const visibleLogs = logType === 'screen' ? screenLogs : plotLogs;

  const handleDownload = () => {
    const content = visibleLogs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-log-${taskId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (window.confirm('로그를 모두 삭제하시겠습니까?')) {
      clearAllModelData();
    }
  };

  const handleScroll = () => {
    if (!logContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: 'grey.50',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            실시간 로그
          </Typography>

          <ToggleButtonGroup
            value={logType}
            exclusive
            onChange={(_, value) => value && setLogType(value)}
            size="small"
          >
            <ToggleButton value="screen">Screen</ToggleButton>
            <ToggleButton value="plot">Plot</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            {visibleLogs.length} lines
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={autoScroll ? '자동 스크롤 끄기' : '자동 스크롤 켜기'}>
            <IconButton size="small" onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="로그 다운로드">
            <span>
              <IconButton size="small" onClick={handleDownload} disabled={visibleLogs.length === 0}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="로그 지우기">
            <span>
              <IconButton size="small" onClick={handleClear} disabled={visibleLogs.length === 0}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Log Content */}
      <Box
        ref={logContainerRef}
        onScroll={handleScroll}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          p: 2,
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
        }}
      >
        {visibleLogs.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'grey.500', mt: 4 }}>
            <Typography variant="body2">로그가 없습니다</Typography>
            <Typography variant="caption">시뮬레이션을 시작하면 로그가 표시됩니다</Typography>
          </Box>
        ) : (
          visibleLogs.map((log, index) => (
            <Box
              key={index}
              sx={{
                mb: 0.5,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <span style={{ color: '#858585', marginRight: '12px' }}>
                {String(index + 1).padStart(4, ' ')}
              </span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {log}
              </span>
            </Box>
          ))
        )}
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: 'grey.50',
        }}
      >
        {/* Progress Bar (Mock mode only, running status) */}
        {mockMode && activeModel?.status === 'running' && (
          <Box sx={{ px: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                진행률: {progress.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                경과 시간: {Math.floor(elapsedTime)}초 / 예상 완료: {Math.max(0, 60 - Math.floor(elapsedTime))}초 남음
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)',
                },
              }}
            />
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Task: {taskId.substring(0, 8)}...
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {activeModel?.status === 'completed' && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                ✓ 완료됨
              </Typography>
            )}
            {activeModel?.status === 'running' && (
              <>
                <Typography variant="caption" color="text.secondary">
                  마지막 업데이트: {new Date().toLocaleTimeString()}
                </Typography>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'success.main',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LiveLogViewer;

function formatPlotLines(
  plotData: Record<string, unknown>[],
  minorEdits: MinorEdit[]
): string[] {
  if (plotData.length === 0) {
    return [];
  }

  if (!minorEdits || minorEdits.length === 0) {
    return plotData.map((point) => formatPlotPointLine(point));
  }

  // Keep the configured order and map values by v-index only.
  const orderedEdits = [...minorEdits];
  const columnWidth = 12;

  const formatCell = (value: string, width = columnWidth) => value.padEnd(width, ' ');
  const formatHeaderCell = (value: string, width = columnWidth) => value.padEnd(width, ' ');
  const variableHeader = ['time', ...orderedEdits.map((edit) => String(edit.variableType))]
    .map((value) => formatHeaderCell(value))
    .join(' ');
  const parameterHeader = ['0', ...orderedEdits.map((edit) => String(edit.parameter))]
    .map((value) => formatHeaderCell(value))
    .join(' ');

  const valueLines = plotData.map((point) => {
    const values: string[] = [];

    const time = typeof point.time === 'number' && Number.isFinite(point.time)
      ? point.time.toFixed(5)
      : '0.00000';
    values.push(formatCell(time));

    orderedEdits.forEach((_, idx) => {
      const keyByCardOrder = `v${idx}`;
      const raw = point[keyByCardOrder];

      if (typeof raw === 'number' && Number.isFinite(raw)) {
        values.push(formatCell(formatNumericValue(raw)));
      } else {
        values.push(formatCell(''));
      }
    });

    return values.join(' ');
  });

  return [variableHeader, parameterHeader, '', ...valueLines];
}

function formatPlotPointLine(point: Record<string, unknown>): string {
  const timeRaw = point.time;
  const time = typeof timeRaw === 'number' && Number.isFinite(timeRaw)
    ? timeRaw.toFixed(3)
    : 'N/A';

  const valueParts = Object.keys(point)
    .filter((key) => key !== 'time')
    .sort((a, b) => {
      const ai = extractVIndex(a);
      const bi = extractVIndex(b);
      return ai - bi;
    })
    .map((key) => {
      const value = point[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `${key}=${value.toFixed(6)}`;
      }
      return `${key}=${String(value)}`;
    });

  return `${time} ${valueParts.join(' ')}`.trim();
}

function formatNumericValue(value: number): string {
  const abs = Math.abs(value);
  if (value === 0) {
    return '0.00000E+00';
  }
  if (abs >= 1e5 || abs < 1e-3) {
    return value.toExponential(5).replace('e', 'E');
  }
  return value.toFixed(4);
}

function extractVIndex(key: string): number {
  const m = key.match(/^v(\d+)$/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(m[1], 10);
}
