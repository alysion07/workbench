/**
 * Dashboard Component
 * 프로젝트 목록을 표시하고 관리하는 메인 대시보드
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Snackbar,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { ProjectService } from '@/services/projectService';
import { useProjectStore } from '@/stores/projectStore';
import AppLayout from '@/components/common/AppLayout';
import type { SidebarItem } from '@/components/common/Sidebar';
import {
  Home as HomeIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import ProjectCard from './ProjectCard';
import UploadModal from './UploadModal';
import StatsChart from './StatsChart';
import RecentFiles from './RecentFiles';

interface ProjectInfo {
  id: string;
  name: string;
  count: number;
}

interface DashboardProps {
  userId: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userId, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Sidebar items
  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: '홈',
      icon: <HomeIcon />,
      type: 'navigation',
      path: '/dashboard',
      selected: location.pathname === '/dashboard',
    },
    {
      id: 'vsmr-sim-web',
      label: 'vSMR 시뮬레이션 플랫폼 웹 UI',
      icon: <FolderIcon />,
      type: 'navigation',
      path: '/workspace',
      selected: location.pathname === '/workspace',
    },
    {
      id: 'control-system',
      label: '제어 계통',
      icon: <FolderIcon />,
      type: 'navigation',
      path: '/power-system',
      selected: location.pathname === '/power-system',
      disabled: true, // 차후 구현
    },
    {
      id: 'divider-1',
      label: '',
      icon: <></>,
      type: 'divider',
    },
    {
      id: 'settings',
      label: '설정',
      icon: <SettingsIcon />,
      type: 'action',
      onClick: () => {
        // 차후 구현
        console.log('Settings clicked');
      },
      disabled: true,
    },
  ];

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  // 검색 필터링
  const [searchQuery, setSearchQuery] = useState('');
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    return projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      await useProjectStore.getState().fetchProjects();
      const storedProjects = useProjectStore.getState().projects;
      const projectIdByName = new Map(
        storedProjects.map((project) => [project.name, project.id])
      );

      const projectNames = await ProjectService.listProjects(userId);
      
      // 각 프로젝트의 파일 수 계산
      const projectMap = new Map<string, { id: string; count: number }>();
      
      for (const projectName of projectNames) {
        const projectId = projectIdByName.get(projectName);
        if (!projectId) {
          continue;
        }

        try {
          const files = await ProjectService.listProjectFiles(userId, projectName);
          projectMap.set(projectName, { id: projectId, count: files.length });
        } catch (err) {
          console.error(`Failed to get files for ${projectName}:`, err);
          projectMap.set(projectName, { id: projectId, count: 0 });
        }
      }
      
      const projectList: ProjectInfo[] = Array.from(projectMap.entries()).map(([name, info]) => ({
        id: info.id,
        name,
        count: info.count,
      }));
      
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로젝트 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = () => {
    setNewProjectName('');
    setNewProjectDialogOpen(true);
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    
    if (!trimmedName) {
      setSnackbar({
        open: true,
        message: '프로젝트 이름을 입력해주세요.',
        severity: 'error',
      });
      return;
    }

    try {
      const existing = await ProjectService.listProjects(userId);
      if (existing.includes(trimmedName)) {
        setSnackbar({
          open: true,
          message: '이미 존재하는 프로젝트 이름입니다.',
          severity: 'error',
        });
        return;
      }

      // 에디터로 연결 (새 프로젝트) - 같은 앱의 /editor 경로 사용
      navigate(`/editor?userId=${encodeURIComponent(userId)}&projectName=${encodeURIComponent(trimmedName)}&new=true`);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '프로젝트 생성에 실패했습니다.',
        severity: 'error',
      });
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`프로젝트 "${projectName}"을(를) 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await ProjectService.deleteProject(projectId);
      await fetchProjects();
      if (selectedProject === projectName) {
        setSelectedProject(null);
      }
      setSnackbar({
        open: true,
        message: '프로젝트가 삭제되었습니다.',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '프로젝트 삭제에 실패했습니다.',
        severity: 'error',
      });
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const baseName = file.name.replace(/\.json$/i, '');
      await ProjectService.uploadProjectJson(userId, baseName, file);
      await fetchProjects();
      setSnackbar({
        open: true,
        message: '프로젝트가 업로드되었습니다.',
        severity: 'success',
      });
    } catch (err) {
      throw err;
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 진행률 계산 (더미 데이터)
  const totalTasks = projects.length > 0 ? projects.length * 10 : 10; // 임시 계산
  const completedTasks = totalTasks > 0 ? Math.floor(totalTasks * 0.85) : 0;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Update sidebar items with navigation handlers
  const sidebarItemsWithHandlers: SidebarItem[] = sidebarItems.map((item) => {
    if (item.type === 'navigation' && item.path) {
      return {
        ...item,
        onClick: () => navigate(item.path!),
      };
    }
    return item;
  });

  return (
    <>
      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={() => setSidebarExpanded(!sidebarExpanded)}
        sidebarItems={sidebarItemsWithHandlers}
        activeSidebarItemId={sidebarItems.find((item) => item.selected)?.id}
        onLogout={onLogout}
        showUserProfile={true}
        showCollapseButton={true}
        contentHeader={
          <DashboardHeader 
            onNewProject={handleNewProject}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        }
      >
        {/* Main Content */}
        <Box sx={{ p: 3 }}>
          {/* Welcome Banner */}
          <Paper
            sx={{
              p: 4,
              mb: 3,
              background: 'linear-gradient(160deg, #0F2B4C 0%, #162d50 30%, #2563EB 100%)',
              color: 'white',
              borderRadius: 2,
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
                  Hey, {userId}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
                  You Still Have Work To Do
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {totalTasks} Tasks
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {progressPercentage}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: { xs: 'none', md: 'block' } }}>
                {/* 일러스트 영역 (추후 이미지 추가 가능) */}
                <Box sx={{ textAlign: 'right', opacity: 0.8 }}>
                  <Typography variant="h2">📊</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Projects Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Projects
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleNewProject}
                >
                  새 프로젝트
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadIcon />}
                  onClick={() => setUploadOpen(true)}
                >
                  업로드
                </Button>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : filteredProjects.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 프로젝트가 없습니다.'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  새 프로젝트를 생성하거나 업로드해주세요.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ overflowX: 'auto', pb: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
                  {filteredProjects.map((project) => (
                    <Box key={project.id} sx={{ minWidth: 240, maxWidth: 240 }}>
                      <ProjectCard
                        name={project.name}
                        count={project.count}
                        onClick={() => setSelectedProject(project.name)}
                        onDelete={() => handleDeleteProject(project.id, project.name)}
                        onEdit={() => {
                          navigate(`/editor?userId=${encodeURIComponent(userId)}&projectName=${encodeURIComponent(project.name)}`);
                        }}
                        selected={selectedProject === project.name}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* Bottom Section: Stats Chart + Project Files */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <StatsChart projectName={selectedProject} />
            </Grid>
            <Grid item xs={12} md={4}>
              <RecentFiles userId={userId} projectName={selectedProject} />
            </Grid>
          </Grid>
        </Box>
      </AppLayout>

      {/* New Project Dialog */}
        <Dialog open={newProjectDialogOpen} onClose={() => setNewProjectDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>새 프로젝트 생성</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              새 프로젝트 이름을 입력하세요. 프로젝트가 생성되면 에디터가 열립니다.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              label="프로젝트 이름"
              variant="outlined"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateProject();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewProjectDialogOpen(false)}>취소</Button>
            <Button onClick={handleCreateProject} variant="contained">
              생성
            </Button>
          </DialogActions>
        </Dialog>

        {/* Upload Modal */}
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ top: '80px !important' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
    </>
  );
};

export default Dashboard;

