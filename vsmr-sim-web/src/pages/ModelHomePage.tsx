/**
 * ModelHomePage
 * MDH-001: 모델 홈 페이지
 *
 * URL: /projects/:projectId/models/:modelId
 * - 모델 정보, 다이어그램 미리보기, 히스토리 테이블 표시
 * - EDIT 버튼으로 에디터 이동
 * - BACK 버튼으로 프로젝트 홈 이동
 */

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Notifications as NotificationsIcon,
  Mail as MailIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/common/AppLayout';
import type { SidebarItem } from '@/components/common/Sidebar';
import {
  ModelInfoCard,
  ModelPreview,
  ModelHistoryTables,
} from '@/components/modelHome';
import { useProjectStore } from '@/stores/projectStore';
import { useStore } from '@/stores/useStore';
import { useAuthStore } from '@/stores/authStore';
import type { Model } from '@/types/supabase';

const ModelHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, modelId } = useParams<{
    projectId: string;
    modelId: string;
  }>();

  // Stores
  const {
    currentProject,
    loading,
    error,
    fetchProject,
    getModel,
    setCurrentModel,
  } = useProjectStore();
  const { sidebarExpanded, toggleSidebar } = useStore();
  const { signOut } = useAuthStore();

  // Local state
  const [model, setModel] = useState<Model | null>(null);

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
      selected: false,
    },
  ];

  // 사이드바 아이템 클릭 핸들러
  const sidebarItemsWithHandlers: SidebarItem[] = sidebarItems.map((item) => ({
    ...item,
    onClick: () => item.path && navigate(item.path),
  }));

  // 프로젝트 및 모델 로드
  useEffect(() => {
    const loadData = async () => {
      if (!projectId || !modelId) return;

      // 프로젝트 로드
      const project = await fetchProject(projectId);
      if (project) {
        // 모델 가져오기
        const foundModel = getModel(projectId, modelId);
        if (foundModel) {
          setModel(foundModel);
          setCurrentModel(foundModel);
        }
      }
    };

    loadData();
  }, [projectId, modelId, fetchProject, getModel, setCurrentModel]);

  // EDIT 버튼 핸들러
  const handleEdit = useCallback(() => {
    if (projectId && modelId) {
      navigate(`/editor?projectId=${projectId}&modelId=${modelId}`);
    }
  }, [navigate, projectId, modelId]);

  // SIMULATION 버튼 핸들러
  const handleSimulation = useCallback(() => {
    if (projectId && modelId) {
      navigate(`/simulation?projectId=${projectId}&modelId=${modelId}`);
    }
  }, [navigate, projectId, modelId]);

  // SETTING 버튼 핸들러 (Global Settings 다이얼로그)
  const handleSettings = useCallback(() => {
    // TODO: Global Settings 다이얼로그 열기 또는 설정 페이지로 이동
    // 현재는 에디터의 설정 페이지로 이동
    if (projectId && modelId) {
      navigate(`/editor?projectId=${projectId}&modelId=${modelId}&openSettings=true`);
    }
  }, [navigate, projectId, modelId]);

  // 시뮬레이션 히스토리 상세 보기 핸들러
  const handleViewSimulation = useCallback(
    (simulationId: string) => {
      // ANA-001 페이지로 이동 (아직 미구현이면 SimulationPage로)
      navigate(`/simulation?projectId=${projectId}&simulationId=${simulationId}`);
    },
    [navigate, projectId]
  );

  // BACK 버튼 핸들러
  const handleBack = useCallback(() => {
    if (projectId) {
      navigate(`/projects/${projectId}`);
    } else {
      navigate('/projects');
    }
  }, [navigate, projectId]);

  // 시뮬레이션 히스토리
  const simulationHistory = useMemo(
    () => currentProject?.data?.simulationHistory ?? [],
    [currentProject]
  );

  // 현재 날짜 포맷
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // 로딩 상태
  if (loading) {
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
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={toggleSidebar}
        sidebarItems={sidebarItemsWithHandlers}
        onLogout={handleLogout}
        onAccountSettings={() => navigate('/settings')}
      >
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" startIcon={<BackIcon />} onClick={handleBack}>
            Back to Projects
          </Button>
        </Box>
      </AppLayout>
    );
  }

  // 모델이 없는 경우
  if (!model || !currentProject) {
    return (
      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={toggleSidebar}
        sidebarItems={sidebarItemsWithHandlers}
        onLogout={handleLogout}
        onAccountSettings={() => navigate('/settings')}
      >
        <Box sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Model not found
          </Alert>
          <Button variant="outlined" startIcon={<BackIcon />} onClick={handleBack}>
            Back to Projects
          </Button>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItemsWithHandlers}
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
          {/* 좌측: BACK 버튼 + 브레드크럼 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={handleBack}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              BACK
            </Button>

            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              aria-label="breadcrumb"
            >
              <Link
                component="button"
                variant="body2"
                underline="hover"
                color="inherit"
                onClick={() => navigate('/projects')}
                sx={{ cursor: 'pointer' }}
              >
                Projects
              </Link>
              <Link
                component="button"
                variant="body2"
                underline="hover"
                color="inherit"
                onClick={() => navigate(`/projects/${projectId}`)}
                sx={{ cursor: 'pointer' }}
              >
                {currentProject.name}
              </Link>
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                {model.name}
              </Typography>
            </Breadcrumbs>
          </Box>

          {/* 우측: 날짜 및 아이콘 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

        {/* 메인 콘텐츠: 2열 레이아웃 */}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gridTemplateRows: { xs: 'auto auto auto', md: '1fr 1fr' },
            gap: 3,
            overflow: 'hidden',
          }}
        >
          {/* 좌측: ModelPreview (2행 차지) */}
          <Box
            sx={{
              gridColumn: { xs: '1', md: '1' },
              gridRow: { xs: '1', md: '1 / 3' },
              minHeight: { xs: 400, md: 'auto' },
            }}
          >
            <ModelPreview
              nodes={model.nodes || []}
              edges={model.edges || []}
              title="Nodalization Diagram"
              updatedAt={model.updated_at}
            />
          </Box>

          {/* 우측 상단: ModelInfoCard */}
          <Box
            sx={{
              gridColumn: { xs: '1', md: '2' },
              gridRow: { xs: '2', md: '1' },
              minHeight: { xs: 'auto', md: 200 },
            }}
          >
            <ModelInfoCard
              model={model}
              onEdit={handleEdit}
              onSimulation={handleSimulation}
              onSettings={handleSettings}
            />
          </Box>

          {/* 우측 하단: ModelHistoryTables */}
          <Box
            sx={{
              gridColumn: { xs: '1', md: '2' },
              gridRow: { xs: '3', md: '2' },
              minHeight: { xs: 300, md: 'auto' },
              overflow: 'hidden',
            }}
          >
            <ModelHistoryTables
              modelId={model.id}
              updateHistory={model.updateHistory || []}
              simulationHistory={simulationHistory}
              onViewSimulation={handleViewSimulation}
            />
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
};

export default ModelHomePage;
