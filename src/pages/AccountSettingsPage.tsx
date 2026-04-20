/**
 * Account Settings Page
 *
 * 계정 설정 페이지 (AppLayout 내부)
 * - 프로필 정보 표시 및 수정
 * - 비밀번호 변경
 * - 관리자: 사용자 관리
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Alert,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AppLayout from '@/components/common/AppLayout';
import type { SidebarItem } from '@/components/common/Sidebar';
import ProfileSection from '@/components/settings/ProfileSection';
import SecuritySection from '@/components/settings/SecuritySection';
import UserManagementSection from '@/components/settings/UserManagementSection';
import { useAuthStore } from '@/stores/authStore';
import { useStore } from '@/stores/useStore';

const AccountSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    profile,
    error,
    fetchProfile,
    clearError,
    signOut,
    updatePassword,
    updateDisplayName,
    fetchAllUsers,
    approveUser,
    rejectUser,
  } = useAuthStore();
  const { sidebarExpanded, toggleSidebar } = useStore();

  // 프로필 로드
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // 로그아웃 핸들러
  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  // 사이드바 아이템 (settings 항목 없음 - Popover에서 접근)
  const sidebarItems: SidebarItem[] = [
    {
      id: 'projects',
      label: 'Projects',
      icon: <HomeIcon />,
      type: 'navigation',
      path: '/projects',
      selected: false,
      onClick: () => navigate('/projects'),
    },
  ];

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItems}
      onLogout={handleLogout}
      onAccountSettings={() => {/* 현재 페이지 */}}
    >
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* 페이지 타이틀 */}
        <Typography variant="h5" component="h1" fontWeight={600} sx={{ mb: 3 }}>
          계정 설정
        </Typography>

        {/* 에러 알림 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
            {error}
          </Alert>
        )}

        {/* 프로필 섹션 */}
        {user && profile && (
          <ProfileSection
            user={user}
            profile={profile}
            onUpdateDisplayName={updateDisplayName}
          />
        )}

        {/* 보안 섹션 */}
        <SecuritySection onUpdatePassword={updatePassword} />

        {/* 관리자 전용: 사용자 관리 섹션 */}
        {profile?.is_admin && (
          <UserManagementSection
            fetchAllUsers={fetchAllUsers}
            approveUser={approveUser}
            rejectUser={rejectUser}
          />
        )}
      </Container>
    </AppLayout>
  );
};

export default AccountSettingsPage;
