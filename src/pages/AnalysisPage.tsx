/**
 * Analysis Page (ANA-001)
 * 시뮬레이션 결과 데이터(plotfl) 시계열 분석 페이지
 * Layout: Sidebar(변수 탐색기) + Main(다중 차트 패널 + 타임슬라이더)
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Timeline as TimelineIcon,
  Home as HomeIcon,
  PlayArrow as SimIcon,
  Assessment as AnalysisIcon,
  DeleteOutline as ClearIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/common/AppLayout';
import PlotFileDropZone from '@/components/analysis/PlotFileDropZone';
import VariableExplorer from '@/components/analysis/VariableExplorer';
import ChartPanelGrid from '@/components/analysis/ChartPanelGrid';
import PowerSummaryCard from '@/components/analysis/PowerSummaryCard';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useStore } from '@/stores/useStore';
import type { SidebarItem } from '@/components/common/Sidebar';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const parsedFile = useAnalysisStore((s) => s.parsedFile);
  const fileName = useAnalysisStore((s) => s.fileName);
  const clearFile = useAnalysisStore((s) => s.clearFile);
  const { sidebarExpanded, toggleSidebar } = useStore();

  const sidebarItems: SidebarItem[] = useMemo(
    () => [
      {
        id: 'home',
        label: '홈',
        icon: <HomeIcon />,
        type: 'navigation' as const,
        onClick: () => navigate('/projects'),
      },
      {
        id: 'simulation',
        label: '시뮬레이션',
        icon: <SimIcon />,
        type: 'navigation' as const,
        onClick: () => navigate('/simulation'),
      },
      {
        id: 'analysis',
        label: '결과 분석',
        icon: <AnalysisIcon />,
        type: 'navigation' as const,
        selected: true,
      },
    ],
    [navigate],
  );

  const contentHeader = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <TimelineIcon color="primary" />
      <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
        결과 분석
      </Typography>
      {fileName && (
        <>
          <Typography variant="body2" color="text.secondary">
            {fileName}
          </Typography>
          <Tooltip title="파일 닫기">
            <IconButton size="small" onClick={clearFile}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItems}
      activeSidebarItemId="analysis"
      onAccountSettings={() => navigate('/settings')}
      contentHeader={contentHeader}
    >
      {!parsedFile ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            p: 4,
          }}
        >
          <Box sx={{ maxWidth: 600, width: '100%' }}>
            <PlotFileDropZone />
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* 좌측: 변수 탐색기 */}
          <Box
            sx={{
              width: 280,
              minWidth: 280,
              borderRight: 1,
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <VariableExplorer />
          </Box>

          {/* 우측: Summary + 차트 패널 + 타임슬라이더 */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Summary Card */}
            <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
              <PowerSummaryCard />
            </Box>

            {/* Chart Panel Grid */}
            <Box sx={{ flex: 1, p: 1.5, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
              <ChartPanelGrid />
            </Box>

          </Box>
        </Box>
      )}
    </AppLayout>
  );
}
