/**
 * ProjectPickerPage
 * PRJ-001: 프로젝트 선택/생성 통합 페이지
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
  Mail as MailIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import AppLayout from '../components/common/AppLayout';
import type { SidebarItem } from '../components/common/Sidebar';
import {
  ProjectPickerContent,
  NewProjectWizard,
  NewProjectFormData,
} from '../components/projectPicker';
import { useProjectStore } from '../stores/projectStore';
import { useStore } from '../stores/useStore';
import { useAuthStore } from '../stores/authStore';
import type { Project } from '../types/supabase';

const QUICKRUN_PROJECT_ID = '_quickrun';

const ProjectPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Stores
  const { projects, loading, error, fetchProjects, createProject, deleteProject } =
    useProjectStore();
  const { sidebarExpanded, toggleSidebar } = useStore();
  const { signOut } = useAuthStore();

  // 로그아웃 핸들러
  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  // 사이드바 아이템
  const sidebarItems: SidebarItem[] = [
    {
      id: 'projects',
      label: 'Projects',
      icon: <HomeIcon />,
      type: 'navigation',
      path: '/projects',
      selected: location.pathname === '/' || location.pathname === '/projects',
    },
  ];

  // 사이드바 아이템 클릭 핸들러 추가
  const sidebarItemsWithHandlers: SidebarItem[] = sidebarItems.map((item) => ({
    ...item,
    onClick: () => item.path && navigate(item.path),
  }));

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // 프로젝트 목록 로드
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const displayProjects = useMemo<Project[]>(() => {
    if (projects.some((project) => project.id === QUICKRUN_PROJECT_ID)) {
      return projects;
    }

    const now = new Date().toISOString();
    const quickRunProject: Project = {
      id: QUICKRUN_PROJECT_ID,
      user_id: 'system',
      name: '퀵 시뮬레이션',
      description: 'Quick Run 이력 전용 기본 프로젝트',
      data: {
        models: [],
        updateHistory: [],
        simulationHistory: [],
      },
      created_at: now,
      updated_at: now,
    };

    return [quickRunProject, ...projects];
  }, [projects]);

  // 프로젝트 선택 (Project Home으로 이동)
  const handleSelectProject = useCallback(
    (projectId: string) => {
      const selectedProject = displayProjects.find((project) => project.id === projectId);

      if (selectedProject) {
        console.log(
          `[ProjectPickerPage] Selected project data (${selectedProject.name}):`,
          JSON.stringify(selectedProject.data ?? {}, null, 2)
        );
      }

      navigate(`/projects/${projectId}`);
    },
    [navigate, displayProjects]
  );

  // 새 프로젝트 생성 (partitions → models 변환)
  const handleCreateProject = useCallback(
    async (formData: NewProjectFormData): Promise<string | null> => {
      try {
        // partitions를 models로 변환
        const now = new Date().toISOString();
        const models = await Promise.all(formData.partitions.map(async (partition) => {
          let nodes: any[] = [];
          let edges: any[] = [];
          let settings: any = {};

          // RESTART인 경우 소스 모델에서 nodes/edges 복사
          if (
            partition.analysisCode === 'MARS' &&
            partition.marsConfig?.problemType === 'RESTART' &&
            partition.marsConfig?.restartSource?.projectId &&
            partition.marsConfig?.restartSource?.modelId
          ) {
            const source = partition.marsConfig.restartSource;
            // 이미 로드된 projects에서 찾거나 개별 fetch
            let sourceProject = projects.find((p) => p.id === source.projectId);
            if (!sourceProject) {
              const { data: fetched } = await import('@/lib/supabase').then(({ supabase }) =>
                supabase.from('projects').select('*').eq('id', source.projectId).single()
              );
              sourceProject = fetched ?? undefined;
            }
            const sourceModel = sourceProject?.data?.models?.find(
              (m: any) => m.id === source.modelId
            );
            if (sourceModel) {
              nodes = structuredClone(sourceModel.nodes ?? []);
              edges = structuredClone(sourceModel.edges ?? []);
              settings = structuredClone(sourceModel.settings ?? {});
            }
          }

          // MARS 설정을 model.settings에 저장
          if (partition.analysisCode === 'MARS' && partition.marsConfig) {
            settings = { ...settings, marsConfig: partition.marsConfig };
            // card100에 problemType/calculationType을 소문자로 동기화
            // (위저드: 대문자 'NEW'|'RESTART', 에디터: 소문자 'new'|'restart')
            settings.card100 = {
              ...settings.card100,
              problemType: partition.marsConfig.problemType.toLowerCase() as 'new' | 'restart',
              calculationType: settings.card100?.calculationType
                || (partition.marsConfig.problemOption?.toLowerCase() as 'transnt' | 'stdy-st')
                || 'transnt',
            };
            // RESTART 모드일 때 Card 103 기본값 설정
            if (partition.marsConfig.problemType === 'RESTART' && partition.marsConfig.restartSource) {
              settings.card103 = {
                restartNumber: partition.marsConfig.restartSource.restartNumber ?? -1,
                rstpltFileName: 'rstplt',
              };
            }
          }

          return {
            id: partition.id,
            name: partition.name,
            analysisCodes: [partition.analysisCode],  // 단일 → 배열
            description: partition.description || null,
            scope: {
              systems: partition.scope,
              components: [],
            },
            nodes,
            edges,
            settings,
            updateHistory: [],
            created_at: now,
            updated_at: now,
          };
        }));

        const newProject = await createProject({
          name: formData.title,
          description: formData.description || null,
          // TODO: DB 스키마에서 category 컬럼 제거 후 이 줄 삭제
          data: {
            totalScope: {
              systems: formData.scope,
              components: [],
            },
            models,
            updateHistory: [{
              version: '1.0',
              timestamp: now,
              author: 'System',
              description: '프로젝트 생성',
            }],
            simulationHistory: [],
            metadata: {
              tags: formData.tags,
              // RESTART 정보: 첫 번째 RESTART partition에서 추출
              ...((() => {
                const rp = formData.partitions.find(
                  (p) => p.analysisCode === 'MARS' && p.marsConfig?.problemType === 'RESTART'
                );
                if (!rp?.marsConfig) return {};
                const src = rp.marsConfig.restartSource;
                return {
                  taskMode: 'restart' as const,
                  restartProjectId: src?.projectId ?? '',
                  restartSourceTaskId: src?.simulationId ?? '',
                  restartSimulationId: src?.simulationId,
                };
              })()),
            },
          },
        });

        if (newProject) {
          setSnackbar({
            open: true,
            message: `프로젝트 "${formData.title}"가 생성되었습니다.`,
            severity: 'success',
          });
          return newProject.id;
        }

        // createProject가 null을 반환한 경우 (store 내부에서 에러 처리됨)
        const storeError = useProjectStore.getState().error;
        setSnackbar({
          open: true,
          message: storeError || '프로젝트 생성에 실패했습니다.',
          severity: 'error',
        });
        return null;
      } catch (err) {
        console.error('[ProjectPickerPage] handleCreateProject error:', err);
        setSnackbar({
          open: true,
          message: `프로젝트 생성에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'error',
        });
        return null;
      }
    },
    [createProject, projects]
  );

  // 프로젝트 생성 완료 후 Project Home으로 이동
  const handleProjectCreated = useCallback(
    (projectId: string) => {
      navigate(`/projects/${projectId}`);
    },
    [navigate]
  );

  // 프로젝트 삭제 확인
  const handleDeleteClick = useCallback((projectId: string) => {
    if (projectId === QUICKRUN_PROJECT_ID) {
      setSnackbar({
        open: true,
        message: '기본 프로젝트는 삭제할 수 없습니다.',
        severity: 'error',
      });
      return;
    }

    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  }, []);

  // 프로젝트 삭제 실행
  const handleDeleteConfirm = useCallback(async () => {
    if (!projectToDelete) return;

    const success = await deleteProject(projectToDelete);
    if (success) {
      setSnackbar({
        open: true,
        message: '프로젝트가 삭제되었습니다.',
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: '프로젝트 삭제에 실패했습니다.',
        severity: 'error',
      });
    }
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  }, [projectToDelete, deleteProject]);

  // 현재 날짜 포맷
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItemsWithHandlers}
      activeSidebarItemId={sidebarItems.find((item) => item.selected)?.id}
      onLogout={handleLogout}
      onAccountSettings={() => navigate('/settings')}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
        {/* 헤더 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {/* 좌측: 타이틀 */}
          <Typography variant="h5" fontWeight={600}>
            Projects
          </Typography>

          {/* 중앙: 검색 */}
          <TextField
            placeholder="Search fields"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 300,
              bgcolor: 'grey.100',
              borderRadius: 1,
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />

          {/* 우측: 버튼들 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewProjectDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              NEW PROJECT
            </Button>
            <Button
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderColor: 'divider',
                color: 'text.primary',
              }}
            >
              {currentDate}
            </Button>
            <IconButton>
              <NotificationsIcon />
            </IconButton>
            <IconButton>
              <MailIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 메인 콘텐츠 */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <ProjectPickerContent
            projects={displayProjects}
            loading={loading}
            error={error}
            searchQuery={searchQuery}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteClick}
          />
        </Box>
      </Box>

      {/* 새 프로젝트 위저드 */}
      <NewProjectWizard
        open={newProjectDialogOpen}
        onClose={() => setNewProjectDialogOpen(false)}
        onCreated={handleProjectCreated}
        loading={loading}
        error={error}
        onCreate={handleCreateProject}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>프로젝트 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AppLayout>
  );
};

export default ProjectPickerPage;
