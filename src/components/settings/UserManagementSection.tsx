/**
 * UserManagementSection Component
 * 계정 설정 페이지 - 관리자 전용 사용자 관리
 * AdminPage 로직을 추출하여 섹션 컴포넌트로 재구성
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import type { UserProfile } from '@/stores/authStore';

interface UserManagementSectionProps {
  fetchAllUsers: () => Promise<UserProfile[]>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
}

const getStatusChip = (status: string) => {
  switch (status) {
    case 'approved':
      return <Chip label="승인됨" color="success" size="small" />;
    case 'rejected':
      return <Chip label="거부됨" color="error" size="small" />;
    case 'pending':
    default:
      return <Chip label="대기중" color="warning" size="small" />;
  }
};

const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  fetchAllUsers,
  approveUser,
  rejectUser,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch {
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [fetchAllUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      await loadUsers();
    } catch {
      setError('승인 처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      await loadUsers();
    } catch {
      setError('거부 처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingUsers = users.filter((u) => u.approval_status === 'pending');
  const approvedUsers = users.filter((u) => u.approval_status === 'approved');
  const rejectedUsers = users.filter((u) => u.approval_status === 'rejected');

  const renderUserTable = (userList: UserProfile[]) => {
    if (userList.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          해당하는 사용자가 없습니다.
        </Alert>
      );
    }

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>이메일</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>관리자</TableCell>
              <TableCell>가입일</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userList.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.display_name || '-'}</TableCell>
                <TableCell>{getStatusChip(user.approval_status)}</TableCell>
                <TableCell>
                  {user.is_admin ? (
                    <Chip label="관리자" color="primary" size="small" />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell align="center">
                  {actionLoading === user.id ? (
                    <CircularProgress size={24} />
                  ) : (
                    <>
                      {user.approval_status !== 'approved' && (
                        <Tooltip title="승인">
                          <IconButton
                            color="success"
                            onClick={() => handleApprove(user.id)}
                            size="small"
                          >
                            <CheckCircleIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {user.approval_status !== 'rejected' && (
                        <Tooltip title="거부">
                          <IconButton
                            color="error"
                            onClick={() => handleReject(user.id)}
                            size="small"
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="h6">사용자 관리</Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadUsers}
          disabled={loading}
          size="small"
        >
          새로고침
        </Button>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  승인 대기
                  {pendingUsers.length > 0 && (
                    <Chip label={pendingUsers.length} color="warning" size="small" />
                  )}
                </Box>
              }
            />
            <Tab label={`승인됨 (${approvedUsers.length})`} />
            <Tab label={`거부됨 (${rejectedUsers.length})`} />
          </Tabs>

          <Box sx={{ pt: 2 }}>
            {tabValue === 0 && renderUserTable(pendingUsers)}
            {tabValue === 1 && renderUserTable(approvedUsers)}
            {tabValue === 2 && renderUserTable(rejectedUsers)}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default UserManagementSection;
