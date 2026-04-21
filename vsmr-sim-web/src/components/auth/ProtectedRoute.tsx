/**
 * Protected Route Component
 *
 * 인증이 필요한 라우트를 보호하는 래퍼 컴포넌트
 * - 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
 * - 승인되지 않은 사용자(pending/rejected)는 접근 차단
 * - 로딩 중에는 스피너 표시
 */

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Paper, Container, Button, Alert } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import BlockIcon from '@mui/icons-material/Block';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, profile, loading, initialized, fetchProfile, signOut } = useAuthStore();
  const location = useLocation();

  // 사용자가 있으면 프로필 로드
  useEffect(() => {
    if (user && !profile) {
      fetchProfile();
    }
  }, [user, profile, fetchProfile]);

  // 초기화 중이거나 로딩 중일 때 스피너 표시
  if (!initialized || loading) {
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
          인증 확인 중...
        </Typography>
      </Box>
    );
  }

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 프로필 로딩 중
  if (!profile) {
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
          프로필 확인 중...
        </Typography>
      </Box>
    );
  }

  // 승인 대기 중인 경우
  if (profile.approval_status === 'pending') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0F2B4C 0%, #162d50 30%, #2563EB 100%)',
        }}
      >
        <Container maxWidth="sm">
          <Paper elevation={8} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
            <HourglassEmptyIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              승인 대기 중
            </Typography>
            <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                회원가입이 완료되었습니다.
                <br />
                <strong>관리자 승인 후</strong> 서비스를 이용하실 수 있습니다.
                <br />
                승인까지 다소 시간이 걸릴 수 있습니다.
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              계정: {profile.email}
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => signOut()}
              sx={{ py: 1.5 }}
            >
              로그아웃
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // 거부된 경우
  if (profile.approval_status === 'rejected') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0F2B4C 0%, #162d50 30%, #2563EB 100%)',
        }}
      >
        <Container maxWidth="sm">
          <Paper elevation={8} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
            <BlockIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              접근이 거부되었습니다
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                관리자에 의해 접근이 거부되었습니다.
                <br />
                문의사항이 있으시면 관리자에게 연락해주세요.
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              계정: {profile.email}
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => signOut()}
              sx={{ py: 1.5 }}
            >
              로그아웃
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // 승인된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
};

export default ProtectedRoute;
