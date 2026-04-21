/**
 * Login Page
 *
 * Supabase Auth를 사용한 로그인 페이지
 * - 이메일/비밀번호 로그인
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { useAuthStore } from '@/stores/authStore';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, error, signInWithEmail, clearError, resetLoading } = useAuthStore();

  // 이메일 로그인 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 로그인 후 돌아갈 페이지 (기본값: /home)
  const from = (location.state as { from?: Location })?.from?.pathname || '/home';

  // 컴포넌트 마운트 시 로딩 상태 리셋
  useEffect(() => {
    resetLoading();
  }, [resetLoading]);

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  // 이메일 로그인 핸들러
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      return;
    }

    try {
      await signInWithEmail(email, password);
      // 로그인 성공 시 useEffect에서 리다이렉트 처리
    } catch (err) {
      // 에러는 스토어에서 처리
    }
  };

  // Enter 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEmailLogin();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        {/* 화이트톤 글래스 카드 */}
        <Box
          sx={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: 4,
            p: 5,
            boxShadow: '0 8px 32px rgba(15, 43, 76, 0.25)',
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              textAlign: 'center',
              mb: 0.5,
              color: '#0F2B4C',
              letterSpacing: '-0.5px',
            }}
          >
            VSMR Editor
          </Typography>

          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              mb: 4,
              color: '#6B7F99',
              fontSize: '0.875rem',
            }}
          >
            계정으로 로그인하세요
          </Typography>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          {/* 이메일 입력 */}
          <TextField
            fullWidth
            label="이메일"
            type="email"
            variant="outlined"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value.replace(/\s/g, ''));
              clearError();
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#9AAFCA' },
                '&:hover fieldset': { borderColor: '#2563EB' },
                '&.Mui-focused fieldset': { borderColor: '#2563EB' },
              },
            }}
            autoFocus
          />

          {/* 비밀번호 입력 */}
          <TextField
            fullWidth
            label="비밀번호"
            type="password"
            variant="outlined"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value.replace(/\s/g, ''));
              clearError();
            }}
            onKeyDown={handleKeyDown}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#9AAFCA' },
                '&:hover fieldset': { borderColor: '#2563EB' },
                '&.Mui-focused fieldset': { borderColor: '#2563EB' },
              },
            }}
          />

          {/* 로그인 버튼 */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleEmailLogin}
            disabled={loading || !email.trim() || !password.trim()}
            sx={{
              py: 1.5,
              mb: 3,
              background: '#2563EB',
              fontWeight: 700,
              fontSize: '0.95rem',
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
              '&:hover': {
                background: '#1d4ed8',
              },
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
          </Button>

          {/* 회원가입 링크 */}
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', color: '#6B7F99' }}
          >
            계정이 없으신가요?{' '}
            <Link
              component={RouterLink}
              to="/signup"
              underline="hover"
              sx={{ color: '#2563EB', fontWeight: 600 }}
            >
              회원가입
            </Link>
          </Typography>
        </Box>

        {/* 하단 태그 */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Box
            component="span"
            sx={{
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
      </Container>
    </Box>
  );
};

export default LoginPage;
