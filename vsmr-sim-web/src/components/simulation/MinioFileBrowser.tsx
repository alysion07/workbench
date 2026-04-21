/**
 * MinioFileBrowser
 * MinIO에서 .i 파일을 선택하는 서브 다이얼로그 (테이블 뷰)
 *
 * Issue #58: 폴더 트리 → 테이블 뷰 전환
 * - 프로젝트명, 생성일시, 입력파일, 파일 저장일시를 한 눈에 비교
 * - 입력파일 저장일시 최신순 정렬 (파일 없는 프로젝트 하단)
 * - 프로젝트 홈 링크로 기존 프로젝트 탭 연계
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { ProjectService } from '@/services/projectService';
import { useProjectStore } from '@/stores/projectStore';
import type { SelectedFile } from '@/hooks/useCoSimQuickRun';

interface MinioFileBrowserProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onFileSelect: (file: SelectedFile) => void;
}

interface FileInfo {
  fileName: string;
  objectKey: string;
  size: number;
  lastModified: string;
}

interface ProjectFileRow {
  projectId: string;
  projectName: string;
  projectCreatedAt: string;
  inputFile: FileInfo | null;
  fileLoading: boolean;
  fileError: boolean;
}

// 날짜 포맷 (HistoryTables 패턴 준수: 2026.03.25 14:30)
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '-';
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
}

function sortRows(rows: ProjectFileRow[]): ProjectFileRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.inputFile?.lastModified;
    const bTime = b.inputFile?.lastModified;

    // 파일 있는 것이 상위
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;

    // 둘 다 파일 있으면 lastModified 최신순
    if (aTime && bTime) {
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    }

    // 둘 다 파일 없으면 프로젝트 생성일 최신순
    return new Date(b.projectCreatedAt).getTime() - new Date(a.projectCreatedAt).getTime();
  });
}

const MinioFileBrowser: React.FC<MinioFileBrowserProps> = ({
  open,
  onClose,
  userId,
  onFileSelect,
}) => {
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const [rows, setRows] = useState<ProjectFileRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 프로젝트 목록 + 입력파일 병렬 로드
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRows([]);

    try {
      await fetchProjects();
      const projects = useProjectStore.getState().projects;

      // Step 1: 프로젝트 목록 즉시 표시 (fileLoading: true)
      const initialRows: ProjectFileRow[] = projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectCreatedAt: p.created_at,
        inputFile: null,
        fileLoading: true,
        fileError: false,
      }));
      setRows(initialRows);
      setIsLoading(false);

      // Step 2: 모든 프로젝트의 첫 번째 모델 입력파일 정보 병렬 조회
      const results = await Promise.allSettled(
        projects.map((p) => {
          const firstModelId = p.data?.models?.[0]?.id;
          if (!firstModelId) return Promise.reject(new Error('no model'));
          return ProjectService.getModelInputFiles(p.id, firstModelId);
        }),
      );

      setRows((prev) =>
        prev.map((row, idx) => {
          const result = results[idx];
          if (result.status === 'fulfilled' && result.value?.inputFile) {
            const fi = result.value.inputFile;
            return {
              ...row,
              inputFile: {
                fileName: fi.fileName,
                objectKey: fi.objectKey,
                size: Number(fi.size ?? 0),
                lastModified: fi.lastModified ?? '',
              },
              fileLoading: false,
            };
          }
          return {
            ...row,
            inputFile: null,
            fileLoading: false,
            fileError: result.status === 'rejected',
          };
        }),
      );
    } catch (err) {
      setError('프로젝트 목록을 불러오는데 실패했습니다');
      console.error('[MinioFileBrowser] Failed to load projects:', err);
      setIsLoading(false);
    }
  }, [fetchProjects]);

  // 다이얼로그 열릴 때 로드
  useEffect(() => {
    if (open) {
      loadAll();
    }
  }, [open, loadAll]);

  // 검색 필터링 + 정렬
  const displayRows = useMemo(() => {
    const filtered = searchQuery
      ? rows.filter((r) => r.projectName.toLowerCase().includes(searchQuery.toLowerCase()))
      : rows;
    return sortRows(filtered);
  }, [rows, searchQuery]);

  // 파일 선택
  const handleFileSelect = (row: ProjectFileRow) => {
    if (!row.inputFile) return;
    onFileSelect({
      type: 'minio',
      name: row.inputFile.fileName,
      path: row.inputFile.objectKey || `${userId}/${row.projectId}/${row.inputFile.fileName}`,
      projectName: row.projectName,
    });
    onClose();
  };


  const allFilesLoaded = rows.length > 0 && rows.every((r) => !r.fileLoading);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, height: '70vh' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">다른 프로젝트에서 선택</Typography>
        <Box>
          <IconButton onClick={loadAll} size="small" disabled={isLoading} sx={{ mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 검색 필드 */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="프로젝트 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* 테이블 */}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : displayRows.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchQuery ? '검색 결과가 없습니다' : '프로젝트가 없습니다'}
              </Typography>
            </Box>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', minWidth: 160 }}>
                    프로젝트
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', minWidth: 130 }}>
                    프로젝트 생성일시
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', minWidth: 160 }}>
                    입력파일
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50', minWidth: 130 }}>
                    파일 저장일시
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRows.map((row) => {
                  const hasFile = !!row.inputFile;
                  const isDisabled = !hasFile && !row.fileLoading;

                  return (
                    <TableRow
                      key={row.projectId}
                      hover={hasFile}
                      sx={{
                        cursor: hasFile ? 'pointer' : 'default',
                        opacity: isDisabled ? 0.5 : 1,
                        '&:hover': hasFile
                          ? { backgroundColor: 'action.hover' }
                          : undefined,
                      }}
                      onClick={() => hasFile && handleFileSelect(row)}
                    >
                      {/* 프로젝트명 */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 140,
                            }}
                          >
                            {row.projectName}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* 프로젝트 생성일시 */}
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {formatDate(row.projectCreatedAt)}
                        </Typography>
                      </TableCell>

                      {/* 입력파일 */}
                      <TableCell>
                        {row.fileLoading ? (
                          <Skeleton width={100} height={28} />
                        ) : row.fileError ? (
                          <Typography variant="caption" color="error">
                            조회 실패
                          </Typography>
                        ) : row.inputFile ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileSelect(row);
                              }}
                              sx={{
                                textTransform: 'none',
                                minWidth: 0,
                                px: 1,
                                py: 0.25,
                                fontSize: '0.75rem',
                                lineHeight: 1.5,
                              }}
                            >
                              선택
                            </Button>
                            <Tooltip title={row.inputFile.fileName}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <FileIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    maxWidth: 80,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {row.inputFile.fileName}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>

                      {/* 파일 저장일시 */}
                      <TableCell>
                        {row.fileLoading ? (
                          <Skeleton width={110} height={20} />
                        ) : row.inputFile?.lastModified ? (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {formatDate(row.inputFile.lastModified)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* 하단 상태 바 */}
        {rows.length > 0 && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {displayRows.length}개 프로젝트
              {searchQuery && ` (검색: "${searchQuery}")`}
            </Typography>
            {!allFilesLoaded && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CircularProgress size={12} />
                <Typography variant="caption" color="text.secondary">
                  파일 정보 로딩 중...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MinioFileBrowser;
