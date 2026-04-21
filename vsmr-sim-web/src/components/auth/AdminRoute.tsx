/**
 * Admin Route Component
 *
 * 관리자 전용 라우트를 보호하는 래퍼 컴포넌트
 * - ProtectedRoute 기능 포함 (인증 필요)
 * - 추가로 is_admin 체크
 * - 비관리자는 홈으로 리다이렉트
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuthStore } from '@/stores/authStore';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, profile, loading, initialized, fetchProfile } = useAuthStore();
  const location = useLocation();
  const [profileLoading, setProfileLoading] = useState(true);

  // 프로필 로드
  useEffect(() => {
    const loadProfile = async () => {
      if (!initialized || loading) {
        return; // 아직 초기화 중
      }

      if (!user) {
        setProfileLoading(false); // 로그인 안 됨 → 로딩 종료
        return;
      }

      await fetchProfile();
      setProfileLoading(false);
    };

    loadProfile();
  }, [user, initialized, loading, fetchProfile]);

  // 초기화 중이거나 로딩 중일 때 스피너 표시
  if (!initialized || loading || profileLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">
          권한 확인 중...
        </Typography>
      </Box>
    );
  }

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 관리자가 아닌 경우 홈으로 리다이렉트
  if (!profile?.is_admin) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>
            접근 권한이 없습니다
          </Typography>
          <Typography variant="body2">
            이 페이지는 관리자만 접근할 수 있습니다.
          </Typography>
        </Alert>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ cursor: 'pointer' }}
          onClick={() => window.location.href = '/home'}
        >
          홈으로 돌아가기
        </Typography>
      </Box>
    );
  }

  // 관리자인 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
};

export default AdminRoute;
