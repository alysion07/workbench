/**
 * HistoryTables Component
 * MAIN-001: Update History 및 Simulation History 테이블 (나란히 배치)
 */

import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Visibility as ViewIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  History as HistoryIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { VersionEntry, SimulationEntry } from '@/types/supabase';

interface HistoryTablesProps {
  updateHistory: VersionEntry[];
  simulationHistory: SimulationEntry[];
  onViewSimulation?: (simulation: SimulationEntry) => void;
}

// 시뮬레이션 상태별 색상
const statusColors: Record<SimulationEntry['status'], 'success' | 'error' | 'warning' | 'info'> = {
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

const HistoryTables: React.FC<HistoryTablesProps> = ({
  updateHistory,
  simulationHistory,
  onViewSimulation,
}) => {
  // 날짜 포맷 (간결한 형식: 2026.01.19 19:05)
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const dateStr = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '');
    const timeStr = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateStr} ${timeStr}`;
  };

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
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          업데이트 기록 ({updateHistory.length})
        </Typography>
        {updateHistory.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 100,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              py: 2,
            }}
          >
            <HistoryIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              프로젝트 변경 기록이 여기에 표시됩니다
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 400, overflow: 'auto' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>버전</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>설명</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>작성자</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>날짜</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {updateHistory.map((entry, index) => (
                  <TableRow
                    key={`${entry.version}-${index}`}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={`v${entry.version}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.description}
                    </TableCell>
                    <TableCell>{entry.author}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.timestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Simulation History */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          시뮬레이션 기록 ({simulationHistory.length})
        </Typography>
        {simulationHistory.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 100,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              py: 2,
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              아직 시뮬레이션 기록이 없습니다
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              모델을 완성하고 첫 시뮬레이션을 실행해보세요
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<InfoIcon />}
              onClick={() => window.open('https://github.com/etri-vsmr/mars-editor#simulation', '_blank')}
            >
              시뮬레이션 가이드 보기
            </Button>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 400, overflow: 'auto' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>상태</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>이름</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>소요시간</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>날짜</TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulationHistory.map((entry) => (
                  <TableRow
                    key={entry.id}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <TableCell>
                      <Chip
                        icon={<StatusIcon status={entry.status} />}
                        label={entry.status}
                        size="small"
                        color={statusColors[entry.status]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.status !== 'Failed' ? (
                        <Button
                          variant="text"
                          size="small"
                          sx={{ px: 0, minWidth: 0, textTransform: 'none' }}
                          onClick={() => onViewSimulation?.(entry)}
                        >
                          {entry.name}
                        </Button>
                      ) : (
                        entry.name
                      )}
                    </TableCell>
                    <TableCell>{entry.duration}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.timestamp)}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => onViewSimulation?.(entry)}
                          disabled={entry.status === 'Failed'}
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

export default HistoryTables;
