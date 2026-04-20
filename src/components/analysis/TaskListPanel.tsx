/**
 * TaskListPanel
 * 우측 접이식 패널 - 과거 시뮬레이션 해석 목록 표시 + 로컬 파일 업로드
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ChevronRight as CollapseIcon,
  ChevronLeft as ExpandIcon,
  Refresh as RefreshIcon,
  FileUpload as UploadIcon,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
  StopCircle,
  CompareArrows as CompareIcon,
  Close as RemoveCompareIcon,
} from '@mui/icons-material';
import { listSimulationHistoriesByProject } from '@/services/pm/projectManagerService';
import type { SimulationEntry } from '@/types/supabase';

const HISTORY_CACHE_TTL_MS = 5000;

const historyCache = new Map<string, {
  fetchedAt: number;
  items: SimulationEntry[];
}>();

const historyInFlight = new Map<string, Promise<SimulationEntry[]>>();

interface TaskListPanelProps {
  projectId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLoadResult: (entry: SimulationEntry) => Promise<void>;
  onOpenLocalFile: () => void;
  loadingId: string | null;
  activeResultId: string | null;
  /** 비교 추가 핸들러 */
  onCompareResult?: (entry: SimulationEntry) => Promise<void>;
  /** 비교 해제 핸들러 */
  onRemoveCompare?: (id: string) => void;
  /** 현재 비교 중인 결과 ID 목록 */
  comparedIds?: string[];
  /** 비교 추가 중인 ID */
  comparingId?: string | null;
}

function getStatusIcon(status: SimulationEntry['status']) {
  switch (status) {
    case 'Running':
      return <PlayArrow fontSize="small" sx={{ color: 'success.main' }} />;
    case 'Success':
      return <CheckCircle fontSize="small" sx={{ color: 'info.main' }} />;
    case 'Failed':
      return <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />;
    case 'Stopped':
      return <StopCircle fontSize="small" sx={{ color: 'grey.600' }} />;
    default:
      return null;
  }
}

function getStatusColor(status: SimulationEntry['status']): 'success' | 'info' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'Running':
      return 'success';
    case 'Success':
      return 'info';
    case 'Failed':
      return 'error';
    case 'Stopped':
      return 'warning';
    default:
      return 'default';
  }
}

export default function TaskListPanel({
  projectId,
  collapsed,
  onToggleCollapse,
  onLoadResult,
  onOpenLocalFile,
  loadingId,
  activeResultId,
  onCompareResult,
  onRemoveCompare,
  comparedIds = [],
  comparingId,
}: TaskListPanelProps) {
  const [histories, setHistories] = useState<SimulationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistories = useCallback(async (force = false) => {
    if (!projectId) {
      setHistories([]);
      return;
    }

    if (!force) {
      const cached = historyCache.get(projectId);
      if (cached && (Date.now() - cached.fetchedAt) < HISTORY_CACHE_TTL_MS) {
        setHistories(cached.items);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const existingRequest = historyInFlight.get(projectId);
      const request = existingRequest ?? listSimulationHistoriesByProject(projectId);

      if (!existingRequest) {
        historyInFlight.set(projectId, request);
      }

      const items = await request;

      if (!existingRequest) {
        historyInFlight.delete(projectId);
      }

      historyCache.set(projectId, {
        fetchedAt: Date.now(),
        items,
      });
      setHistories(items);
    } catch (err) {
      historyInFlight.delete(projectId);
      console.warn('[TaskListPanel] Failed to load histories:', err);
      setHistories([]);
      setError('이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadHistories();
  }, [loadHistories]);

  // 접힌 상태: 아이콘 버튼만
  if (collapsed) {
    return (
      <Box
        sx={{
          width: 48,
          minWidth: 48,
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
          backgroundColor: 'background.paper',
        }}
      >
        <Tooltip title="해석 목록 열기" placement="left">
          <IconButton size="small" onClick={onToggleCollapse}>
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 280,
        minWidth: 280,
        borderLeft: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          backgroundColor: 'grey.50',
        }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
          해석 목록
        </Typography>
        <Tooltip title="새로고침">
          <IconButton size="small" onClick={() => void loadHistories(true)} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="접기">
          <IconButton size="small" onClick={onToggleCollapse}>
            <CollapseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 로컬 파일 업로드 버튼 */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<UploadIcon />}
          onClick={onOpenLocalFile}
        >
          로컬 파일 열기
        </Button>
      </Box>

      {/* 목록 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && !loading && (
          <Alert severity="error" sx={{ mx: 1, mt: 1 }}>
            {error}
          </Alert>
        )}

        {!projectId && !loading && (
          <Alert severity="warning" sx={{ mx: 1, mt: 1 }}>
            프로젝트 정보가 없습니다.
          </Alert>
        )}

        {projectId && !loading && !error && (
          <List dense disablePadding>
            {histories.map((entry) => {
              const isActive = activeResultId === entry.id;
              const isLoading = loadingId === entry.id;
              const isFailed = entry.status === 'Failed';
              const isCompared = comparedIds.includes(entry.id);
              const isComparing = comparingId === entry.id;
              const canCompare = onCompareResult && !isActive && !isFailed && !isCompared && comparedIds.length < 2;

              return (
                <ListItemButton
                  key={entry.id}
                  disabled={isFailed || isLoading}
                  selected={isActive}
                  onClick={() => { void onLoadResult(entry); }}
                  sx={{
                    py: 1,
                    px: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.50',
                      borderLeft: '3px solid',
                      borderLeftColor: 'primary.main',
                    },
                    ...(isCompared && {
                      backgroundColor: 'action.hover',
                      borderLeft: '3px solid',
                      borderLeftColor: 'secondary.main',
                    }),
                  }}
                >
                  <ListItemText
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getStatusIcon(entry.status)}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isActive ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {entry.name || 'Unnamed'}
                        </Typography>
                        {isLoading && <CircularProgress size={14} />}
                        {isComparing && <CircularProgress size={14} />}
                        {isCompared && (
                          <Tooltip title="비교 해제">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); onRemoveCompare?.(entry.id); }}
                              sx={{ p: 0.5 }}
                            >
                              <RemoveCompareIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canCompare && (
                          <Tooltip title="비교 추가">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); void onCompareResult(entry); }}
                              sx={{ p: 0.5 }}
                            >
                              <CompareIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {isCompared ? (
                          <Chip
                            label="비교"
                            size="small"
                            color="secondary"
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                        ) : (
                          <Chip
                            label={entry.status}
                            size="small"
                            color={getStatusColor(entry.status)}
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.6rem' }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {entry.duration}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {new Date(entry.timestamp).toLocaleDateString('ko-KR')}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              );
            })}
            {histories.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  해석 이력이 없습니다.
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Box>

      {/* 하단 요약 */}
      <Box sx={{ px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {histories.length}개 해석
        </Typography>
      </Box>
    </Box>
  );
}
