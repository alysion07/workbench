/**
 * SecuritySection Component
 * 계정 설정 페이지 - 비밀번호 변경
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Button,
  TextField,
  Collapse,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

interface SecuritySectionProps {
  onUpdatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const SecuritySection: React.FC<SecuritySectionProps> = ({ onUpdatePassword }) => {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
  };

  const isNewPasswordValid = newPassword.length >= 6;
  const isConfirmMatch = newPassword === confirmPassword;
  const isFormValid =
    currentPassword.length > 0 &&
    isNewPasswordValid &&
    confirmPassword.length > 0 &&
    isConfirmMatch;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setLoading(true);
    setError(null);

    try {
      await onUpdatePassword(currentPassword, newPassword);
      toast.success('비밀번호가 변경되었습니다');
      resetForm();
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid && !loading) handleSubmit();
    if (e.key === 'Escape') handleCancel();
  };

  const VisibilityToggle = ({
    show,
    onToggle,
  }: {
    show: boolean;
    onToggle: () => void;
  }) => (
    <InputAdornment position="end">
      <IconButton onClick={onToggle} edge="end" size="small" tabIndex={-1}>
        {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LockIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography variant="h6">보안</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {/* 비밀번호 행 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
          비밀번호
        </Typography>
        <Typography variant="body1" sx={{ flexGrow: 1 }}>
          ••••••••
        </Typography>
        {!open && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setOpen(true)}
          >
            변경
          </Button>
        )}
      </Box>

      {/* 비밀번호 변경 폼 */}
      <Collapse in={open}>
        <Box
          sx={{
            mt: 2,
            p: 2.5,
            bgcolor: 'grey.50',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            비밀번호 변경
          </Typography>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            label="현재 비밀번호"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            autoFocus
            disabled={loading}
            InputProps={{
              endAdornment: (
                <VisibilityToggle
                  show={showCurrentPassword}
                  onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                />
              ),
            }}
          />

          <TextField
            label="새 비밀번호"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            disabled={loading}
            helperText={
              newPassword.length > 0 && !isNewPasswordValid
                ? '최소 6자 이상이어야 합니다'
                : '최소 6자 이상, 공백 불가'
            }
            error={newPassword.length > 0 && !isNewPasswordValid}
            InputProps={{
              endAdornment: (
                <VisibilityToggle
                  show={showNewPassword}
                  onToggle={() => setShowNewPassword(!showNewPassword)}
                />
              ),
            }}
          />

          <TextField
            label="새 비밀번호 확인"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            disabled={loading}
            helperText={
              confirmPassword.length > 0 && !isConfirmMatch
                ? '비밀번호가 일치하지 않습니다'
                : undefined
            }
            error={confirmPassword.length > 0 && !isConfirmMatch}
            InputProps={{
              endAdornment: (
                <VisibilityToggle
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              ),
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button variant="outlined" size="small" onClick={handleCancel} disabled={loading}>
              취소
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : '비밀번호 변경'}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SecuritySection;
