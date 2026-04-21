/**
 * ResultFileBrowser
 * MinIO run/ 폴더에서 시뮬레이션 결과 파일을 조회하고 다운로드하는 다이얼로그
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { ProjectService } from '@/services/projectService';

interface ResultFileBrowserProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  projectName: string;
}

const ResultFileBrowser: React.FC<ResultFileBrowserProps> = ({
  open,
  onClose,
  userId,
  projectName,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const loadResultFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allFiles = await ProjectService.listProjectFiles(userId, projectName);
      const prefix = `${userId}/${projectName}/`;
      const resultFiles = allFiles
        .map((f) => f.replace(prefix, ''))
        .filter((f) => f.startsWith('run/'))
        .map((f) => f.replace('run/', ''));

      setFiles(resultFiles);
    } catch (err) {
      setError('결과 파일 목록을 불러오는데 실패했습니다');
      console.error('[ResultFileBrowser] Failed to load result files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, projectName]);

  useEffect(() => {
    if (open) {
      loadResultFiles();
    }
  }, [open, loadResultFiles]);

  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const objectKey = `${userId}/${projectName}/run/${fileName}`;
      await ProjectService.downloadObjectToBrowser(objectKey, fileName);
    } catch (err) {
      console.error('[ResultFileBrowser] Download failed:', err);
    } finally {
      setDownloadingFile(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, height: '60vh' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderOpenIcon color="warning" />
          <Typography variant="h6">결과 파일 다운로드</Typography>
        </Box>
        <Box>
          <IconButton onClick={loadResultFiles} size="small" sx={{ mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {/* 프로젝트 경로 표시 */}
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            {projectName} / run /
          </Typography>
        </Box>

        {/* 파일 목록 */}
        <Box sx={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : files.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                결과 파일이 없습니다
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                시뮬레이션 완료 후 결과 파일이 생성됩니다
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {files.map((fileName) => (
                <ListItemButton
                  key={fileName}
                  onClick={() => handleDownload(fileName)}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <FileIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={fileName}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  {downloadingFile === fileName ? (
                    <CircularProgress size={18} />
                  ) : (
                    <Paper
                      sx={{
                        px: 1,
                        py: 0.25,
                        backgroundColor: 'success.light',
                        color: 'success.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <DownloadIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption">다운로드</Typography>
                    </Paper>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ResultFileBrowser;
