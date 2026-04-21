/**
 * Recent Files Component
 * 선택된 프로젝트의 파일 리스트 컴포넌트
 */

import { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { ProjectService } from '@/services/projectService';

interface RecentFilesProps {
  userId: string;
  projectName: string | null;
}

const ITEMS_PER_PAGE = 10;

const RecentFiles: React.FC<RecentFilesProps> = ({ userId, projectName }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadFiles = async () => {
      if (!userId || !projectName) {
        setFiles([]);
        return;
      }

      setLoading(true);
      setError('');
      setPage(1); // 프로젝트 변경 시 첫 페이지로 리셋
      try {
        const prefix = `${userId}/${projectName}/`;
        const allFiles = await ProjectService.listProjectFiles(userId, projectName);
        const filtered = allFiles
          .filter((p) => !p.endsWith('.json'))
          .map((p) => p.replace(prefix, ''));
        setFiles(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : '파일 목록을 불러오는데 실패했습니다.');
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [userId, projectName]);

  const handleDownload = async (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    if (!userId || !projectName) return;

    try {
      const key = `${userId}/${projectName}/${fileName}`;
      await ProjectService.downloadObjectToBrowser(key, fileName);
    } catch (err) {
      console.error('Download failed:', err);
      setError('파일 다운로드에 실패했습니다.');
    }
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFiles = files.slice(startIndex, endIndex);

  // 프로젝트가 선택되지 않았을 때
  if (!projectName) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          파일 목록
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <Typography variant="body2" color="text.secondary">
            프로젝트를 선택하면 파일 목록이 표시됩니다.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {projectName} 파일 목록
        </Typography>
        <Typography variant="caption" color="text.secondary">
          총 {files.length}개
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress />
        </Box>
      ) : files.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary">
            파일이 없습니다.
          </Typography>
        </Box>
      ) : (
        <>
          <List sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
            {paginatedFiles.map((file, index) => (
              <ListItem
                key={`${file}-${index}`}
                sx={{
                  px: 0,
                  py: 1,
                  borderBottom: index < paginatedFiles.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={(e) => handleDownload(e, file)}
                    size="small"
                    title="다운로드"
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                }
              >
                <Box sx={{ mr: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                  <FileIcon fontSize="small" />
                </Box>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {file}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 'auto' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                size="small"
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default RecentFiles;

