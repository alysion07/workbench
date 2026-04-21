/**
 * Project File List Component
 * 프로젝트의 파일 목록을 표시하는 컴포넌트
 */

import { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Box,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ProjectService } from '@/services/projectService';

interface ProjectFileListProps {
  userId: string;
  projectName: string;
  onReadyToEdit?: (params: { userId: string; projectName: string }) => void;
}

const ProjectFileList: React.FC<ProjectFileListProps> = ({
  userId,
  projectName,
  onReadyToEdit,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      setError('');
      try {
        const prefix = `${userId}/${projectName}/`;
        const all = await ProjectService.listProjectFiles(userId, projectName);
        const filtered = all
          .filter((p) => !p.endsWith('.json'))
          .map((p) => p.replace(prefix, ''));
        setFiles(filtered);
        setHasRun(filtered.some((f) => f.startsWith('run/')));
      } catch (err) {
        setError(err instanceof Error ? err.message : '파일 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (userId && projectName) {
      loadFiles();
    }
  }, [userId, projectName]);

  const inputs = files.filter((f) => !f.startsWith('run/'));
  const outputs = files.filter((f) => f.startsWith('run/'));

  const handleDownload = async (e: React.MouseEvent, fileName: string, isOutput: boolean) => {
    e.stopPropagation();
    try {
      const path = isOutput ? `run/${fileName}` : fileName;
      const key = `${userId}/${projectName}/${path}`;
      await ProjectService.downloadObjectToBrowser(key, fileName);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const renderFileItem = (fileName: string, isOutput: boolean) => {
    const path = isOutput ? `run/${fileName}` : fileName;
    const isSelected = selected === path;

    return (
      <ListItem
        key={path}
        onClick={() => setSelected(path)}
        sx={{
          cursor: 'pointer',
          backgroundColor: isSelected ? 'primary.main' : 'transparent',
          color: isSelected ? 'primary.contrastText' : 'text.primary',
          borderRadius: 1,
          mb: 0.5,
          '&:hover': {
            backgroundColor: isSelected ? 'primary.dark' : 'action.hover',
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: isOutput ? 'success.main' : 'primary.main',
            minWidth: 40,
          }}
        >
          <FileIcon />
        </ListItemIcon>
        <ListItemText primary={fileName} />
        {isOutput && (
          <IconButton
            onClick={(e) => handleDownload(e, fileName, true)}
            size="small"
            sx={{
              color: isSelected ? 'inherit' : 'text.secondary',
            }}
            title="다운로드"
          >
            <DownloadIcon />
          </IconButton>
        )}
      </ListItem>
    );
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          파일 목록을 불러오는 중...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
        📁 {projectName} 파일 목록
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {inputs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            입력 파일
          </Typography>
          <List dense>
            {inputs.map((f) => renderFileItem(f, false))}
          </List>
        </Box>
      )}

      {hasRun && outputs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            출력 파일 (run/)
          </Typography>
          <List dense>
            {outputs.map((f) => renderFileItem(f.replace('run/', ''), true))}
          </List>
        </Box>
      )}

      {files.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          파일이 없습니다.
        </Typography>
      )}

      {onReadyToEdit && (
        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              onReadyToEdit({
                userId,
                projectName,
              });
            }}
          >
            편집 시작
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default ProjectFileList;

