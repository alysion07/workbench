/**
 * Admin Page
 *
 * 관리자 전용 사용자 승인 대시보드
 * - 모든 사용자 목록 조회
 * - 승인/거부 기능
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserProfile } from '@/stores/authStore';

// 승인 상태별 칩 색상
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

// 탭 인터페이스
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { fetchAllUsers, approveUser, rejectUser, profile } = useAuthStore();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // 사용자 목록 로드
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      setError('사용자 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchAllUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 승인 처리
  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      await loadUsers();
    } catch (err) {
      setError('승인 처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 거부 처리
  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      await loadUsers();
    } catch (err) {
      setError('거부 처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 탭별 필터링
  const pendingUsers = users.filter((u) => u.approval_status === 'pending');
  const approvedUsers = users.filter((u) => u.approval_status === 'approved');
  const rejectedUsers = users.filter((u) => u.approval_status === 'rejected');

  // 사용자 테이블 렌더링
  const renderUserTable = (userList: UserProfile[], showActions: boolean = true) => {
    if (userList.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          해당하는 사용자가 없습니다.
        </Alert>
      );
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이메일</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>관리자</TableCell>
              <TableCell>가입일</TableCell>
              {showActions && <TableCell align="center">작업</TableCell>}
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
                {showActions && (
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
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: 3 }}>
          {/* 헤더 */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/home')}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" component="h1" fontWeight={600}>
                사용자 관리
              </Typography>
            </Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadUsers}
              disabled={loading}
            >
              새로고침
            </Button>
          </Box>

          {/* 현재 관리자 정보 */}
          {profile && (
            <Alert severity="info" sx={{ mb: 3 }}>
              관리자: {profile.email} ({profile.display_name})
            </Alert>
          )}

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* 로딩 */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* 탭 */}
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
                        <Chip
                          label={pendingUsers.length}
                          color="warning"
                          size="small"
                        />
                      )}
                    </Box>
                  }
                />
                <Tab label={`승인됨 (${approvedUsers.length})`} />
                <Tab label={`거부됨 (${rejectedUsers.length})`} />
              </Tabs>

              {/* 탭 내용 */}
              <TabPanel value={tabValue} index={0}>
                {renderUserTable(pendingUsers, true)}
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                {renderUserTable(approvedUsers, true)}
              </TabPanel>
              <TabPanel value={tabValue} index={2}>
                {renderUserTable(rejectedUsers, true)}
              </TabPanel>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default AdminPage;
