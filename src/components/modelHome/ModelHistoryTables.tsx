/**
 * ModelHistoryTables Component
 * MDH-001: 모델 업데이트 히스토리 및 시뮬레이션 히스토리 테이블
 *
 * - Update History: 모델 버전 변경 이력
 * - Simulation History: 해당 모델로 실행된 시뮬레이션 이력 (modelId 필터링)
 * - 2열 그리드 레이아웃 (나란히 배치)
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  History as HistoryIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import type { VersionEntry, SimulationEntry } from '@/types/supabase';

interface ModelHistoryTablesProps {
  modelId: string;
  updateHistory: VersionEntry[];
  simulationHistory: SimulationEntry[];
  onViewSimulation?: (simulationId: string) => void;
}

// 시뮬레이션 상태별 색상
const statusColors: Record<
  SimulationEntry['status'],
  'success' | 'error' | 'warning' | 'info'
> = {
  Running: 'info',
  Success: 'success',
  Failed: 'error',
  Stopped: 'warning',
};

// 시뮬레이션 상태별 아이콘
const StatusIcon: React.FC<{ status: SimulationEntry['status'] }> = ({ status }) => {
  switch (status) {
    case 'Running':
      return <PlayIcon fontSize="small" sx={{ color: 'info.main' }} />;
    case 'Success':
      return <PlayIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'Failed':
      return <StopIcon fontSize="small" sx={{ color: 'error.main' }} />;
    case 'Stopped':
      return <StopIcon fontSize="small" sx={{ color: 'warning.main' }} />;
    default:
      return null;
  }
};

// 날짜 포맷팅 (간결한 형식)
const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const dateStr = date
    .toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\. /g, '.')
    .replace(/\.$/, '');
  const timeStr = date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
};

const ModelHistoryTables: React.FC<ModelHistoryTablesProps> = ({
  modelId,
  updateHistory,
  simulationHistory,
  onViewSimulation,
}) => {
  // 해당 모델의 시뮬레이션만 필터링
  const filteredSimulations = useMemo(
    () => simulationHistory.filter((sim) => sim.modelId === modelId),
    [simulationHistory, modelId]
  );

  // 최신순 정렬
  const sortedUpdateHistory = useMemo(
    () =>
      [...updateHistory].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [updateHistory]
  );

  const sortedSimulations = useMemo(
    () =>
      [...filteredSimulations].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [filteredSimulations]
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
        width: '100%',
      }}
    >
      {/* Update History */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HistoryIcon fontSize="small" />
          Update History ({sortedUpdateHistory.length})
        </Typography>
        {sortedUpdateHistory.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 120,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              py: 3,
            }}
          >
            <HistoryIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              No update history available
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 300, overflow: 'auto' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Version</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Author</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedUpdateHistory.map((entry, index) => (
                  <TableRow
                    key={`${entry.version}-${index}`}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={`v${entry.version}`}
                        size="small"
                        sx={{
                          bgcolor: '#e3f2fd',
                          color: '#1565c0',
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={entry.description}
                      >
                        {entry.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entry.author}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(entry.timestamp)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Simulation History */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PlayCircleOutlineIcon fontSize="small" />
          Simulation History ({sortedSimulations.length})
        </Typography>
        {sortedSimulations.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 120,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              py: 3,
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              No simulation history for this model
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 300, overflow: 'auto' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100', width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSimulations.map((sim) => (
                  <TableRow
                    key={sim.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      cursor: onViewSimulation ? 'pointer' : 'default',
                    }}
                    onClick={() => onViewSimulation?.(sim.id)}
                  >
                    <TableCell>
                      <Chip
                        icon={<StatusIcon status={sim.status} />}
                        label={sim.status}
                        size="small"
                        color={statusColors[sim.status]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={sim.name}
                      >
                        {sim.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{sim.duration}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(sim.timestamp)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewSimulation?.(sim.id);
                          }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default ModelHistoryTables;
