/**
 * ProfileSection Component
 * 계정 설정 페이지 - 프로필 정보 표시 및 수정
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Chip,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/stores/authStore';

interface ProfileSectionProps {
  user: User;
  profile: UserProfile;
  onUpdateDisplayName: (name: string) => Promise<void>;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  profile,
  onUpdateDisplayName,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(
    profile.display_name || user.user_metadata?.name || user.user_metadata?.full_name || ''
  );
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await onUpdateDisplayName(trimmed);
      toast.success('이름이 변경되었습니다');
      setEditingName(false);
    } catch (err) {
      toast.error('이름 변경에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNameValue(
      profile.display_name || user.user_metadata?.name || user.user_metadata?.full_name || ''
    );
    setEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') handleCancelEdit();
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        프로필 정보
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 이메일 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
            이메일
          </Typography>
          <Typography variant="body1">{user.email || '-'}</Typography>
        </Box>

        {/* 이름 (편집 가능) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
            이름
          </Typography>
          {editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
              <TextField
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={handleKeyDown}
                size="small"
                autoFocus
                disabled={saving}
                sx={{ flexGrow: 1, maxWidth: 300 }}
              />
              <Tooltip title="저장">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleSaveName}
                  disabled={saving || !nameValue.trim()}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="취소">
                <IconButton size="small" onClick={handleCancelEdit} disabled={saving}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body1">
                {profile.display_name || user.user_metadata?.name || user.user_metadata?.full_name || '-'}
              </Typography>
              <Tooltip title="이름 수정">
                <IconButton size="small" onClick={() => setEditingName(true)}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* 가입 방식 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
            가입 방식
          </Typography>
          <Chip
            icon={<EmailIcon />}
            label="Email"
            size="small"
            color="primary"
          />
        </Box>

        {/* 승인 상태 */}
        {profile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
              승인 상태
            </Typography>
            <Chip
              label={
                profile.approval_status === 'approved'
                  ? '승인됨'
                  : profile.approval_status === 'pending'
                    ? '대기중'
                    : '거절됨'
              }
              size="small"
              color={
                profile.approval_status === 'approved'
                  ? 'success'
                  : profile.approval_status === 'pending'
                    ? 'warning'
                    : 'error'
              }
            />
            {profile.is_admin && (
              <Chip label="관리자" size="small" color="info" />
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ProfileSection;
