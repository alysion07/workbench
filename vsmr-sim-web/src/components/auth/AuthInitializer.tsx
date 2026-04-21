/**
 * Auth Initializer Component
 *
 * 앱 시작 시 Supabase Auth 세션을 초기화하는 컴포넌트
 * - localStorage에서 기존 세션 복원
 * - 세션 변경 리스너 등록
 * - 초기화 완료 전 로딩 표시
 */

import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '@/stores/authStore';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const { initialized, initialize } = useAuthStore();

  useEffect(() => {
    // 앱 시작 시 Supabase Auth 세션 초기화
    initialize();
  }, [initialize]);

  // 초기화 중일 때 로딩 표시
  if (!initialized) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
          background: 'linear-gradient(160deg, #0F2B4C 0%, #162d50 30%, #2563EB 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 장식용 배경 glow */}
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(147, 197, 253, 0.1)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -120,
            left: -80,
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'rgba(37, 99, 235, 0.15)',
            pointerEvents: 'none',
          }}
        />
        <CircularProgress size={48} sx={{ color: 'white', zIndex: 1 }} />
        <Typography variant="body1" sx={{ color: 'white', zIndex: 1 }}>
          VSMR Editor 초기화 중...
        </Typography>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            bottom: 32,
            display: 'inline-block',
            background: 'rgba(147,197,253,0.15)',
            color: '#93C5FD',
            fontSize: '0.7rem',
            fontWeight: 600,
            px: 1.5,
            py: 0.5,
            borderRadius: 3,
          }}
        >
          VSMR Simulation Platform
        </Box>
      </Box>
    );
  }

  // 초기화 완료 후 자식 컴포넌트 렌더링
  return <>{children}</>;
};

export default AuthInitializer;
