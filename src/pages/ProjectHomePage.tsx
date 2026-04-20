/**
 * ProjectHomePage
 * MAIN-001: 프로젝트 홈 페이지 - 모델 관리 및 히스토리 표시
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import '../styles/resizePanels.css';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Breadcrumbs,
  Link,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Notifications as NotificationsIcon,
  Mail as MailIcon,
  ArrowBack as ArrowBackIcon,
  Folder as FolderIcon,
  FolderOpen as ProjectIcon,
  PlayArrow as PlayArrowIcon,
  CalendarToday as CalendarIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import AppLayout from '../components/common/AppLayout';
import type { SidebarItem } from '../components/common/Sidebar';
import { ReactorSystemSVG, ReactorComponentId } from '../components/projectPicker';
import { ModelCardList, NewModelDialog, HistoryTables } from '../components/projectHome';
import { listSimulationHistoriesByProject } from '../services/pm/projectManagerService';
import { useProjectStore } from '../stores/projectStore';
import { useStore } from '../stores/useStore';
import { useAuthStore } from '../stores/authStore';
import type { ModelInsert, Project, SimulationEntry, SystemScope } from '../types/supabase';

const QUICKRUN_PROJECT_ID = '_quickrun';

// Scope를 ReactorComponentId로 매핑
const scopeToComponents: Record<SystemScope, ReactorComponentId[]> = {
  primary: ['reactor', 'steamGenerator'],
  secondary: ['turbine', 'condenser', 'feedwaterPump'],
  bop: ['coolingTower'],
};

const ProjectHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const isQuickRunProject = projectId === QUICKRUN_PROJECT_ID;

  // Stores
  const {
    currentProject,
    loading,
    saving,
    error,
    fetchProject,
    createModel,
    deleteModel,
  } = useProjectStore();
  const { sidebarExpanded, toggleSidebar } = useStore();
  const { signOut } = useAuthStore();

  // Local State
  const [newModelDialogOpen, setNewModelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [projectSimulationHistory, setProjectSimulationHistory] = useState<SimulationEntry[]>([]);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // 프로젝트 로드
  useEffect(() => {
    if (projectId && !isQuickRunProject) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject, isQuickRunProject]);

  // 선택 프로젝트의 시뮬레이션 기록 로드 (ProjectManager RPC)
  useEffect(() => {
    let cancelled = false;

    async function loadSimulationHistory(): Promise<void> {
      if (!projectId) {
        if (!cancelled) {
          setProjectSimulationHistory([]);
        }
        return;
      }

      try {
        const queryProjectId = isQuickRunProject ? QUICKRUN_PROJECT_ID : projectId;
        const histories = await listSimulationHistoriesByProject(queryProjectId);
        if (!cancelled) {
          setProjectSimulationHistory(histories);
          setHistoryLoadFailed(false);
        }
      } catch (err) {
        console.warn('[ProjectHomePage] Failed to load simulation history', err);
        if (!cancelled) {
          setProjectSimulationHistory([]);
          setHistoryLoadFailed(true);
          setSnackbar({
            open: true,
            message: '시뮬레이션 기록 조회에 실패하여 로컬 기록을 표시합니다.',
            severity: 'error',
          });
        }
      }
    }

    void loadSimulationHistory();

    return () => {
      cancelled = true;
    };
  }, [projectId, isQuickRunProject]);

  const quickRunVirtualProject = useMemo<Project>(() => {
    const now = new Date().toISOString();
    return {
      id: QUICKRUN_PROJECT_ID,
      user_id: 'system',
      name: '퀵 시뮬레이션',
      description: 'Quick Run 전용 시뮬레이션 기록',
      data: {
        models: [],
        updateHistory: [],
        simulationHistory: [],
      },
      created_at: now,
      updated_at: now,
    };
  }, []);

  const effectiveProject = isQuickRunProject ? quickRunVirtualProject : currentProject;
  const models = effectiveProject?.data?.models || [];

  // 로그아웃 핸들러
  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  // 사이드바 아이템
  const category = effectiveProject?.category || 'nuclear';
  const sidebarItems: SidebarItem[] = [
    {
      id: 'projects',
      label: 'Project Home',
      icon: <ProjectIcon />,
      type: 'navigation',
      path: '/projects',
      selected: true,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      type: 'navigation',
      path: `/dashboard/${category}`,
    },
  ];

  // 사이드바 아이템 클릭 핸들러
  const sidebarItemsWithHandlers: SidebarItem[] = sidebarItems.map((item) => ({
    ...item,
    onClick: () => item.path && navigate(item.path),
  }));

  // 모델들의 모든 스코프 수집
  const existingScopes = useMemo(() => {
    const scopes: SystemScope[] = [];
    effectiveProject?.data?.models?.forEach((model) => {
      model.scope?.systems?.forEach((s) => {
        if (!scopes.includes(s)) {
          scopes.push(s);
        }
      });
    });
    return scopes;
  }, [effectiveProject?.data?.models]);

  // 선택된 모델 찾기
  const selectedModel = useMemo(() => {
    if (!selectedModelId || !effectiveProject?.data?.models) return null;
    return effectiveProject.data.models.find((m) => m.id === selectedModelId) || null;
  }, [selectedModelId, effectiveProject?.data?.models]);

  // 하이라이트할 컴포넌트 계산 (선택된 모델이 있으면 해당 모델만, 없으면 전체)
  const highlightedComponents = useMemo(() => {
    const components: ReactorComponentId[] = [];

    if (selectedModel) {
      // 선택된 모델의 스코프만 하이라이트
      selectedModel.scope?.systems?.forEach((s) => {
        components.push(...scopeToComponents[s]);
      });
    } else {
      // 선택된 모델이 없으면 모든 모델의 스코프 하이라이트
      existingScopes.forEach((s) => {
        components.push(...scopeToComponents[s]);
      });
    }

    return components;
  }, [selectedModel, existingScopes]);

  // 모델 편집 (에디터로 이동)
  const handleEditModel = useCallback(
    (modelId: string) => {
      navigate(`/editor?projectId=${projectId}&modelId=${modelId}`);
    },
    [navigate, projectId]
  );

  // 모델 삭제 확인
  const handleDeleteClick = useCallback((modelId: string) => {
    setModelToDelete(modelId);
    setDeleteDialogOpen(true);
  }, []);

  // 모델 삭제 실행
  const handleDeleteConfirm = useCallback(async () => {
    if (isQuickRunProject) return;
    if (!projectId || !modelToDelete) return;

    const success = await deleteModel(projectId, modelToDelete);
    if (success) {
      setSnackbar({
        open: true,
        message: '모델이 삭제되었습니다.',
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: '모델 삭제에 실패했습니다.',
        severity: 'error',
      });
    }
    setDeleteDialogOpen(false);
    setModelToDelete(null);
  }, [projectId, modelToDelete, deleteModel, isQuickRunProject]);

  // 새 모델 생성
  const handleCreateModel = useCallback(
    async (data: ModelInsert) => {
      if (isQuickRunProject) return;
      if (!projectId) return;

      const newModel = await createModel(projectId, data);
      if (newModel) {
        setSnackbar({
          open: true,
          message: `모델 "${data.name}"이 생성되었습니다.`,
          severity: 'success',
        });
        setNewModelDialogOpen(false);
      } else {
        setSnackbar({
          open: true,
          message: '모델 생성에 실패했습니다.',
          severity: 'error',
        });
      }
    },
    [projectId, createModel, isQuickRunProject]
  );

  // 시뮬레이션 상세 보기
  const handleViewSimulation = useCallback(
    async (simulation: SimulationEntry) => {
      if (!projectId) {
        return;
      }

      if (simulation.status === 'Failed') {
        return;
      }

      const simulationIdForAnalysis = simulation.simId || simulation.id;
      const historyViewUrl = `/simulation?projectId=${projectId}&simulationId=${simulationIdForAnalysis}&view=history`;

      // QUICK RUN/일반 시뮬레이션 모두 이동만 수행하고,
      // 실제 결과 로드는 SimulationPage(AnalysisView)가 simulationId로 처리한다.
      navigate(historyViewUrl);
    },
    [navigate, projectId]
  );

  // 모델 상세 보기 (ModelHomePage로 이동)
  const handleViewDetails = useCallback(
    (modelId: string) => {
      navigate(`/projects/${projectId}/models/${modelId}`);
    },
    [navigate, projectId]
  );

  // 현재 날짜 포맷
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // 프로젝트 생성일 포맷
  const formatCreatedDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '');
  };

  // 로딩 중
  if (loading && !effectiveProject) {
    return (
      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={toggleSidebar}
        sidebarItems={sidebarItemsWithHandlers}
        onLogout={handleLogout}
        onAccountSettings={() => navigate('/settings')}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  // 프로젝트 없음
  if (!effectiveProject) {
    return (
      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={toggleSidebar}
        sidebarItems={sidebarItemsWithHandlers}
        onLogout={handleLogout}
        onAccountSettings={() => navigate('/settings')}
      >
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            프로젝트를 찾을 수 없습니다. ID: {projectId}
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/projects')}
            sx={{ mt: 2 }}
          >
            프로젝트 목록으로 돌아가기
          </Button>
        </Box>
      </AppLayout>
    );
  }

  const updateHistory = effectiveProject.data?.updateHistory || [];
  const localSimulationHistory = effectiveProject.data?.simulationHistory || [];
  const simulationHistory = historyLoadFailed
    ? localSimulationHistory
    : (projectSimulationHistory.length > 0 ? projectSimulationHistory : localSimulationHistory);

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItemsWithHandlers}
      activeSidebarItemId="projects"
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
          {/* 좌측: Breadcrumbs + 타이틀 + 통계 */}
          <Box>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/projects')}
                sx={{ cursor: 'pointer' }}
                underline="hover"
                color="inherit"
              >
                프로젝트
              </Link>
              <Typography variant="body2" color="text.primary">
                {effectiveProject.name}
              </Typography>
            </Breadcrumbs>
            <Typography variant="h5" fontWeight={600}>
              {effectiveProject.name}
            </Typography>
            {effectiveProject.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {effectiveProject.description}
              </Typography>
            )}
            {/* 프로젝트 통계 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
              <Chip
                icon={<FolderIcon sx={{ fontSize: 16 }} />}
                label={`모델 ${models.length}개`}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                label={`시뮬레이션 ${simulationHistory.length}회`}
                size="small"
                variant="outlined"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  생성일: {formatCreatedDate(effectiveProject.created_at)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* 우측: 버튼들 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate(`/simulation?projectId=${projectId}`)}
              disabled={models.length === 0}
              sx={{ textTransform: 'none' }}
            >
              SIMULATION
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewModelDialogOpen(true)}
              disabled={isQuickRunProject}
              sx={{ textTransform: 'none' }}
            >
              NEW MODEL
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

        {/* 메인 콘텐츠 - 상단(Overview+Models) + 하단(History) 리사이즈 가능 레이아웃 */}
        <PanelGroup
          direction="vertical"
          style={{ flex: 1, overflow: 'hidden' }}
        >
          {/* 상단 패널: System Overview + Model Cards (기본 70%) */}
          <Panel defaultSize={70} minSize={40}>
            <Box
              sx={{
                height: '100%',
                minHeight: 0, // grid child shrink 허용
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' },
                gap: 2,
                overflow: 'hidden',
              }}
            >
              {/* 좌측: Reactor System SVG (넓게, 50% 이상) */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '50%',
                  minHeight: 0, // flex child shrink 허용
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    시스템 개요
                  </Typography>
                  {selectedModel && (
                    <Chip
                      label={`${selectedModel.name} 영역 표시 중`}
                      size="small"
                      color="primary"
                      onDelete={() => setSelectedModelId(null)}
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    minHeight: 0, // flex child shrink 허용
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ReactorSystemSVG
                      highlightedComponents={highlightedComponents}
                      width="100%"
                      height="100%"
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, flexShrink: 0 }}>
                    {selectedModel
                      ? `🔵 "${selectedModel.name}" 모델이 담당하는 영역입니다`
                      : '💡 우측 모델을 클릭하면 담당 영역이 표시됩니다'}
                  </Typography>
                </Box>
              </Box>

              {/* 우측: Model Card List (수직 배치) */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, flexShrink: 0 }}>
                  모델 ({models.length})
                </Typography>
                <Box sx={{ overflow: 'auto', flex: 1 }}>
                  <ModelCardList
                    models={models}
                    onEdit={handleEditModel}
                    onDelete={handleDeleteClick}
                    onViewDetails={handleViewDetails}
                    selectedModelId={selectedModelId}
                    onSelect={setSelectedModelId}
                  />
                </Box>
              </Box>
            </Box>
          </Panel>

          {/* 리사이즈 핸들 */}
          <PanelResizeHandle
            style={{
              height: 4,
              backgroundColor: '#e0e0e0',
              cursor: 'row-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '2px 0',
              borderRadius: 2,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 2,
                backgroundColor: '#bdbdbd',
                borderRadius: 1,
              }}
            />
          </PanelResizeHandle>

          {/* 하단 패널: History Tables (기본 40%) */}
          <Panel defaultSize={25} minSize={15}>
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              <HistoryTables
                updateHistory={updateHistory}
                simulationHistory={simulationHistory}
                onViewSimulation={handleViewSimulation}
              />
            </Box>
          </Panel>
        </PanelGroup>
      </Box>

      {/* 새 모델 다이얼로그 */}
      <NewModelDialog
        open={newModelDialogOpen}
        onClose={() => setNewModelDialogOpen(false)}
        onCreate={handleCreateModel}
        loading={saving}
        error={error}
        existingScopes={existingScopes}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>모델 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 모델을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

export default ProjectHomePage;
