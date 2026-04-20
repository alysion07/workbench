/**
 * Control Dashboard Component
 * 제어 계통 프로젝트 목록을 표시하고 관리하는 대시보드
 * Supabase DB 연동
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Home as HomeIcon,
  Science as NuclearIcon,
  Bolt as PowerIcon,
  Settings as ControlIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/common/AppLayout';
import type { SidebarItem } from '@/components/common/Sidebar';
import { useStore } from '@/stores/useStore';
import { useProjectStore } from '@/stores/projectStore';
import DashboardHeader from './DashboardHeader';
import ProjectCard from './ProjectCard';
import StatsChart from './StatsChart';

interface ControlDashboardProps {
  userId: string;
  onLogout: () => void;
}

const ControlDashboard: React.FC<ControlDashboardProps> = ({ userId: _userId, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarExpanded, toggleSidebar } = useStore();

  // Supabase Project Store
  const {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    deleteProject,
    clearError,
  } = useProjectStore();

  // Local state
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
      path: '/home',
      selected: location.pathname === '/home',
    },
    {
      id: 'nuclear',
      label: '원자력 계통',
      icon: <NuclearIcon />,
      type: 'navigation',
      path: '/dashboard/nuclear',
      selected: location.pathname === '/dashboard/nuclear',
    },
    {
      id: 'power',
      label: '전력 계통',
      icon: <PowerIcon />,
      type: 'navigation',
      path: '/dashboard/power',
      selected: location.pathname === '/dashboard/power',
    },
    {
      id: 'control',
      label: '제어 계통',
      icon: <ControlIcon />,
      type: 'navigation',
      path: '/dashboard/control',
      selected: location.pathname === '/dashboard/control',
    },
  ];

  // 컴포넌트 마운트 시 프로젝트 목록 로드
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 검색 필터링
  const filteredProjects = searchQuery.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  // 새 프로젝트 생성
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

    const newProject = await createProject({
      name: trimmedName,
      category: 'control',
      description: null,
      data: { nodes: [], edges: [], globalSettings: {} },
    });

    if (newProject) {
      setNewProjectDialogOpen(false);
      setNewProjectName('');
      setSnackbar({
        open: true,
        message: '프로젝트가 생성되었습니다.',
        severity: 'success',
      });
      navigate(`/editor?projectId=${newProject.id}`);
    } else {
      setSnackbar({
        open: true,
        message: useProjectStore.getState().error || '프로젝트 생성에 실패했습니다.',
        severity: 'error',
      });
    }
  };

  // 프로젝트 삭제
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`프로젝트 "${projectName}"을(를) 정말 삭제하시겠습니까?`)) {
      return;
    }

    const success = await deleteProject(projectId);

    if (success) {
      if (selectedProject === projectId) {
        setSelectedProject(null);
      }
      setSnackbar({
        open: true,
        message: '프로젝트가 삭제되었습니다.',
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: useProjectStore.getState().error || '프로젝트 삭제에 실패했습니다.',
        severity: 'error',
      });
    }
  };

  const handleEditProject = (projectId: string) => {
    navigate(`/editor?projectId=${projectId}`);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

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
        onSidebarToggle={toggleSidebar}
        sidebarItems={sidebarItemsWithHandlers}
        activeSidebarItemId={sidebarItems.find((item) => item.selected)?.id}
        onLogout={onLogout}
        showUserProfile={true}
        showCollapseButton={true}
        contentHeader={
          <DashboardHeader
            onNewProject={() => {
              setNewProjectName('');
              setNewProjectDialogOpen(true);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        }
      >
        <Box sx={{ p: 3 }}>
          {/* Welcome Banner */}
          <Paper
            sx={{
              p: 4,
              mb: 3,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              borderRadius: 2,
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
                  제어 계통 대시보드
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
                  제어 계통 프로젝트 관리
                </Typography>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {filteredProjects.length} Projects
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: { xs: 'none', md: 'block' } }}>
                <Box sx={{ textAlign: 'right', opacity: 0.8 }}>
                  <ControlIcon sx={{ fontSize: 64 }} />
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Projects
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setNewProjectName('');
                  setNewProjectDialogOpen(true);
                }}
              >
                새 프로젝트
              </Button>
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
                  새 프로젝트를 생성해주세요.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ overflowX: 'auto', pb: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
                  {filteredProjects.map((project) => (
                    <Box key={project.id} sx={{ minWidth: 240, maxWidth: 240 }}>
                      <ProjectCard
                        name={project.name}
                        count={project.data?.nodes?.length || 0}
                        onClick={() => setSelectedProject(project.id)}
                        onDelete={() => handleDeleteProject(project.id, project.name)}
                        onEdit={() => handleEditProject(project.id)}
                        selected={selectedProject === project.id}
                        description={project.description || undefined}
                        updatedAt={project.updated_at}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <StatsChart projectName={projects.find(p => p.id === selectedProject)?.name || null} />
            </Grid>
          </Grid>
        </Box>
      </AppLayout>

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
          <Button onClick={handleCreateProject} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : '생성'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ControlDashboard;
