/**
 * Control Dashboard Page
 * 제어 계통 대시보드를 래핑하는 페이지 컴포넌트
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import ControlDashboard from '@/components/dashboard/ControlDashboard';

const ControlDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // ProtectedRoute에서 인증을 보장하므로 user는 항상 존재
  // user.id는 Supabase Auth UUID
  return <ControlDashboard userId={user!.id} onLogout={handleLogout} />;
};

export default ControlDashboardPage;
