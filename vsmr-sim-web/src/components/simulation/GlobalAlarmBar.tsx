/**
 * GlobalAlarmBar
 * simulationHeader 바로 아래 — 모든 탭에서 알람 상태를 표시하는 전역 바
 * 알람 없으면 숨김, Warning이면 주황, Danger이면 빨간 blink
 */

import { memo, useMemo, useState } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography, Collapse } from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  NotificationsActive as AlarmIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import type { ScenarioAlarmResult } from '@/types/interactive';

interface GlobalAlarmBarProps {
  scenarioResults: ScenarioAlarmResult[];
  onNavigateToAlarm?: (scenarioId: string) => void;
  onOpenAlarmSettings?: () => void;
}

const OPERATOR_DISPLAY: Record<string, string> = {
  '>': '>', '>=': '\u2265', '<': '<', '<=': '\u2264', '==': '=', '!=': '\u2260',
};

const GlobalAlarmBar: React.FC<GlobalAlarmBarProps> = ({
  scenarioResults,
  onNavigateToAlarm,
  onOpenAlarmSettings,
}) => {
  const [expanded, setExpanded] = useState(false);

  const dangerCount = useMemo(
    () => scenarioResults.filter((r) => r.level === 'danger').length,
    [scenarioResults],
  );
  const warningCount = useMemo(
    () => scenarioResults.filter((r) => r.level === 'warning').length,
    [scenarioResults],
  );

  // 중복 시나리오 제거, danger 우선 정렬
  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    return scenarioResults
      .filter((r) => {
        if (seen.has(r.scenarioId)) return false;
        seen.add(r.scenarioId);
        return true;
      })
      .sort((a, b) => (a.level === 'danger' ? -1 : 1) - (b.level === 'danger' ? -1 : 1));
  }, [scenarioResults]);

  // 알람 없으면 렌더링 안 함
  if (scenarioResults.length === 0) return null;

  const hasDanger = dangerCount > 0;

  return (
    <Box
      sx={{
        borderBottom: `2px solid ${hasDanger ? '#d32f2f' : '#f57c00'}`,
        backgroundColor: hasDanger ? '#fbe9e7' : '#fff8e1',
        ...(hasDanger && {
          '@keyframes alarmBarPulse': {
            '0%, 100%': { borderBottomColor: '#d32f2f' },
            '50%': { borderBottomColor: '#ff8a80' },
          },
          animation: 'alarmBarPulse 1.5s ease-in-out infinite',
        }),
      }}
    >
      {/* 메인 바 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 0.75,
          minHeight: 40,
        }}
      >
        {/* 알람 아이콘 + 카운트 그룹 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
          }}
        >
          <AlarmIcon
            sx={{
              fontSize: 20,
              color: hasDanger ? '#d32f2f' : '#f57c00',
              ...(hasDanger && {
                '@keyframes iconShake': {
                  '0%, 100%': { transform: 'rotate(0deg)' },
                  '15%': { transform: 'rotate(-12deg)' },
                  '30%': { transform: 'rotate(10deg)' },
                  '45%': { transform: 'rotate(-8deg)' },
                  '60%': { transform: 'rotate(0deg)' },
                },
                animation: 'iconShake 2s ease-in-out infinite',
              }),
            }}
          />

          {/* 카운트 뱃지 */}
          {dangerCount > 0 && (
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 14 }} />}
              label={dangerCount}
              size="small"
              sx={{
                height: 24,
                minWidth: 52,
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: '#d32f2f',
                color: '#fff',
                '& .MuiChip-icon': { color: '#fff' },
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {warningCount > 0 && (
            <Chip
              icon={<WarningIcon sx={{ fontSize: 14 }} />}
              label={warningCount}
              size="small"
              sx={{
                height: 24,
                minWidth: 52,
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: '#f57c00',
                color: '#fff',
                '& .MuiChip-icon': { color: '#fff' },
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>

        {/* 구분선 */}
        <Box sx={{ width: 1, height: 24, backgroundColor: hasDanger ? '#ef9a9a' : '#ffcc80', flexShrink: 0 }} />

        {/* 시나리오 칩 */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            flex: 1,
            overflow: 'hidden',
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
          {uniqueResults.map((r) => {
            const isDanger = r.level === 'danger';
            const nodeCount = new Set(r.triggeredConditions.map((tc) => tc.nodeId)).size;
            const Icon = isDanger ? ErrorIcon : WarningIcon;

            return (
              <Chip
                key={r.scenarioId}
                icon={<Icon sx={{ fontSize: 13 }} />}
                label={`${r.scenarioNameKo ?? r.scenarioName}${nodeCount > 1 ? ` (${nodeCount})` : ''}`}
                size="small"
                onClick={() => onNavigateToAlarm?.(r.scenarioId)}
                sx={{
                  height: 26,
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  cursor: 'pointer',
                  borderWidth: 1.5,
                  borderStyle: 'solid',
                  borderColor: isDanger ? '#e57373' : '#ffb74d',
                  backgroundColor: isDanger ? '#ffebee' : '#fff3e0',
                  color: isDanger ? '#b71c1c' : '#e65100',
                  '& .MuiChip-icon': { color: isDanger ? '#c62828' : '#ef6c00' },
                  '&:hover': {
                    backgroundColor: isDanger ? '#ffcdd2' : '#ffe0b2',
                    borderColor: isDanger ? '#ef5350' : '#ffa726',
                    transform: 'translateY(-1px)',
                    boxShadow: isDanger
                      ? '0 2px 8px rgba(211,47,47,0.3)'
                      : '0 2px 8px rgba(245,124,0,0.3)',
                  },
                  transition: 'all 0.15s ease',
                }}
              />
            );
          })}
        </Box>

        {/* 상세 토글 */}
        <Tooltip title={expanded ? '접기' : '상세 보기'}>
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            sx={{ flexShrink: 0, color: hasDanger ? '#c62828' : '#e65100' }}
          >
            {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* 알람 설정 버튼 */}
        {onOpenAlarmSettings && (
          <Tooltip title="알람 설정">
            <IconButton
              size="small"
              onClick={onOpenAlarmSettings}
              sx={{
                flexShrink: 0,
                color: hasDanger ? '#c62828' : '#e65100',
                opacity: 0.7,
                '&:hover': { opacity: 1 },
              }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 확장 영역: 트리거된 조건 상세 */}
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 2,
            pb: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 1,
          }}
        >
          {uniqueResults.map((r) => {
            const isDanger = r.level === 'danger';
            return (
              <Box
                key={r.scenarioId}
                onClick={() => onNavigateToAlarm?.(r.scenarioId)}
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  backgroundColor: isDanger ? 'rgba(211,47,47,0.06)' : 'rgba(245,124,0,0.06)',
                  border: `1px solid ${isDanger ? '#ffcdd2' : '#ffe0b2'}`,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: isDanger ? 'rgba(211,47,47,0.12)' : 'rgba(245,124,0,0.12)',
                  },
                  transition: 'background-color 0.15s',
                }}
              >
                {/* 시나리오 헤더 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                  {isDanger
                    ? <ErrorIcon sx={{ fontSize: 15, color: '#d32f2f' }} />
                    : <WarningIcon sx={{ fontSize: 15, color: '#f57c00' }} />
                  }
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem', color: isDanger ? '#b71c1c' : '#e65100' }}>
                    {r.scenarioNameKo ?? r.scenarioName}
                  </Typography>
                  <Chip
                    label={r.level.toUpperCase()}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      ml: 'auto',
                      backgroundColor: isDanger ? '#d32f2f' : '#f57c00',
                      color: '#fff',
                    }}
                  />
                </Box>

                {/* 트리거 조건 목록 */}
                {r.triggeredConditions.map((tc, idx) => (
                  <Box
                    key={`${tc.conditionId}-${tc.nodeId}-${idx}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      pl: 1,
                      py: 0.25,
                      borderLeft: `2px solid ${isDanger ? '#ef9a9a' : '#ffcc80'}`,
                      mb: 0.25,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#555', minWidth: 70 }}>
                      {tc.nodeName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#888', flex: 1 }}>
                      {tc.dataKey}:
                      <Box component="span" sx={{ fontWeight: 700, color: isDanger ? '#c62828' : '#e65100', mx: 0.5, fontFamily: 'monospace' }}>
                        {tc.currentValue.toFixed(2)}
                      </Box>
                      {OPERATOR_DISPLAY[tc.operator] ?? tc.operator}
                      <Box component="span" sx={{ fontFamily: 'monospace', ml: 0.5 }}>
                        {tc.thresholdValue}
                      </Box>
                      {tc.unit && <Box component="span" sx={{ ml: 0.25, color: '#aaa' }}>{tc.unit}</Box>}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default memo(GlobalAlarmBar);
