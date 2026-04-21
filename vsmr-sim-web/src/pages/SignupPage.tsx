/**
 * Signup Page
 *
 * 이메일 회원가입 페이지
 * - 이메일/비밀번호 입력
 * - 회원가입 후 관리자 승인 대기 안내
 */

import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useAuthStore } from '@/stores/authStore';

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { loading, error, signUpWithEmail, clearError } = useAuthStore();

  // 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // 회원가입 성공 상태
  const [signupSuccess, setSignupSuccess] = useState(false);

  // 유효성 검증
  const validateForm = (): boolean => {
    if (!email.trim()) {
      setLocalError('이메일을 입력해주세요.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('올바른 이메일 형식을 입력해주세요.');
      return false;
    }

    if (password.length < 6) {
      setLocalError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    setLocalError(null);
    return true;
  };

  // 회원가입 핸들러
  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await signUpWithEmail(email, password);
      setSignupSuccess(true);
    } catch (err) {
      // 에러는 스토어에서 처리
    }
  };

  // Enter 키 핸들러
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSignup();
    }
  };

  // 에러 초기화
  const handleClearError = () => {
    setLocalError(null);
    clearError();
  };

  // 회원가입 성공 화면
  if (signupSuccess) {
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
          <Paper
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <CheckCircleOutlineIcon
              sx={{ fontSize: 64, color: 'success.main', mb: 2 }}
            />

            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              회원가입 완료
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                회원가입이 완료되었습니다.
                <br />
                <strong>관리자 승인 후</strong> 로그인이 가능합니다.
                <br />
                승인까지 다소 시간이 걸릴 수 있습니다.
              </Typography>
            </Alert>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{ py: 1.5 }}
            >
              로그인 페이지로 이동
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // 회원가입 폼
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
        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 600,
              textAlign: 'center',
              mb: 1,
            }}
          >
            회원가입
          </Typography>

          <Typography
            variant="body1"
            sx={{
              textAlign: 'center',
              mb: 4,
              color: 'text.secondary',
            }}
          >
            VSMR Editor 계정을 생성하세요
          </Typography>

          {/* 에러 메시지 */}
          {(error || localError) && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={handleClearError}>
              {localError || error}
            </Alert>
          )}

          {/* 안내 메시지 */}
          <Alert severity="info" sx={{ mb: 3 }}>
            이메일 회원가입 후 <strong>관리자 승인</strong>이 필요합니다.
          </Alert>

          {/* 이메일 입력 */}
          <TextField
            fullWidth
            label="이메일"
            type="email"
            variant="outlined"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value.replace(/\s/g, ''));
              handleClearError();
            }}
            sx={{ mb: 2 }}
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
              handleClearError();
            }}
            helperText="최소 6자 이상, 공백 불가"
            sx={{ mb: 2 }}
          />

          {/* 비밀번호 확인 */}
          <TextField
            fullWidth
            label="비밀번호 확인"
            type="password"
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value.replace(/\s/g, ''));
              handleClearError();
            }}
            onKeyPress={handleKeyPress}
            sx={{ mb: 3 }}
          />

          {/* 회원가입 버튼 */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSignup}
            disabled={loading || !email.trim() || !password.trim() || !confirmPassword.trim()}
            sx={{ py: 1.5, mb: 2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '회원가입'}
          </Button>

          {/* 로그인 링크 */}
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', color: 'text.secondary' }}
          >
            이미 계정이 있으신가요?{' '}
            <Link component={RouterLink} to="/login" underline="hover">
              로그인
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default SignupPage;
