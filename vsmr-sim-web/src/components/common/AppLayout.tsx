/**
 * AppLayout Component
 * 공통 레이아웃: 사이드바 + 컨텐츠 영역
 * 컨텐츠 영역의 헤더는 props로 받아 동적으로 구성
 */

import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import type { SidebarItem } from './Sidebar';

interface AppLayoutProps {
  // 사이드바 관련
  sidebarExpanded?: boolean;
  onSidebarToggle?: () => void;
  sidebarItems: SidebarItem[];
  activeSidebarItemId?: string;
  onLogout?: () => void;
  onAccountSettings?: () => void; // 계정 설정 핸들러
  showUserProfile?: boolean;
  showCollapseButton?: boolean;

  // 컨텐츠 영역
  contentHeader?: React.ReactNode; // 컨텐츠 영역 상단 헤더 (동적)
  contentFooter?: React.ReactNode; // 컨텐츠 영역 하단 푸터 (고정)
  children: React.ReactNode; // 메인 컨텐츠
}

const AppLayout: React.FC<AppLayoutProps> = ({
  sidebarExpanded = false,
  onSidebarToggle,
  sidebarItems,
  activeSidebarItemId,
  onLogout,
  onAccountSettings,
  showUserProfile = true,
  showCollapseButton = true,
  contentHeader,
  contentFooter,
  children,
}) => {
  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* 좌측 사이드바 */}
      <Sidebar
        expanded={sidebarExpanded}
        onToggleExpand={onSidebarToggle}
        items={sidebarItems}
        activeItemId={activeSidebarItemId}
        onLogout={onLogout}
        onAccountSettings={onAccountSettings}
        showUserProfile={showUserProfile}
        showCollapseButton={showCollapseButton}
      />

      {/* 우측 컨텐츠 영역 */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' }}>
        {/* 컨텐츠 상단 헤더 (동적) */}
        {contentHeader}

        {/* 메인 컨텐츠 */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', height: 0 }}>
          {children}
        </Box>

        {/* 컨텐츠 하단 푸터 (고정) */}
        {contentFooter}
      </Box>
    </Box>
  );
};

export default AppLayout;

