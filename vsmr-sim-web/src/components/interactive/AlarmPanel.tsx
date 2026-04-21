/**
 * AlarmPanel (Alarm Bar)
 * 상단 고정 바: 시나리오 단위 간결 칩. 클릭 시 SidePanel에 상세 표시.
 */

import { memo, useMemo } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  CheckCircleOutline as OkIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { ScenarioAlarmResult } from '@/types/interactive';

interface AlarmPanelProps {
  scenarioResults: ScenarioAlarmResult[];
  selectedScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
}

const AlarmPanel: React.FC<AlarmPanelProps> = ({ scenarioResults, selectedScenarioId, onSelectScenario }) => {
  const dangerCount = scenarioResults.filter((r) => r.level === 'danger').length;
  const warningCount = scenarioResults.filter((r) => r.level === 'warning').length;

  // 같은 시나리오명 중복 제거 (시나리오 ID 기준)
  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    return scenarioResults.filter((r) => {
      if (seen.has(r.scenarioId)) return false;
      seen.add(r.scenarioId);
      return true;
    });
  }, [scenarioResults]);

  if (scenarioResults.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          py: 0.25,
          minHeight: 28,
          backgroundColor: '#e8f5e9',
          borderBottom: '1px solid #c8e6c9',
        }}
      >
        <OkIcon sx={{ fontSize: 14, color: '#4caf50' }} />
        <Typography variant="caption" sx={{ color: '#2e7d32', fontSize: '0.72rem', fontWeight: 500 }}>
          No active alarms
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.25,
        minHeight: 28,
        backgroundColor: dangerCount > 0 ? '#ffebee' : '#fff8e1',
        borderBottom: `1px solid ${dangerCount > 0 ? '#ffcdd2' : '#ffe082'}`,
        overflowX: 'auto',
        '&::-webkit-scrollbar': { height: 3 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: 2 },
      }}
    >
      {/* 요약 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {dangerCount > 0 && (
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 12 }} />}
            label={dangerCount}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: '#f44336', color: '#fff',
              '& .MuiChip-icon': { color: '#fff' },
            }}
          />
        )}
        {warningCount > 0 && (
          <Chip
            icon={<WarningIcon sx={{ fontSize: 12 }} />}
            label={warningCount}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: '#ffc107', color: '#333',
              '& .MuiChip-icon': { color: '#333' },
            }}
          />
        )}
      </Box>

      <Box sx={{ width: '1px', height: 16, backgroundColor: '#ccc', flexShrink: 0 }} />

      {/* 시나리오 칩 (간결) */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', flexShrink: 0 }}>
        {uniqueResults.map((r) => {
          const isDanger = r.level === 'danger';
          const isSelected = selectedScenarioId === r.scenarioId;
          const nodeCount = new Set(r.triggeredConditions.map((tc) => tc.nodeId)).size;

          return (
            <Chip
              key={r.scenarioId}
              label={`${r.scenarioName}${nodeCount > 1 ? ` (${nodeCount})` : ''}`}
              size="small"
              onClick={() => onSelectScenario(isSelected ? null : r.scenarioId)}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                borderWidth: isSelected ? 2 : 1,
                borderStyle: 'solid',
                borderColor: isDanger ? '#f44336' : '#ffa000',
                backgroundColor: isSelected
                  ? (isDanger ? '#f44336' : '#ffa000')
                  : (isDanger ? '#fff5f5' : '#fffdf0'),
                color: isSelected ? '#fff' : (isDanger ? '#c62828' : '#e65100'),
                '&:hover': {
                  backgroundColor: isDanger ? '#ffcdd2' : '#ffe082',
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default memo(AlarmPanel);
