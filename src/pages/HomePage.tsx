/**
 * Home Page
 * 계통별 빠른 접근 카드를 제공하는 홈 화면
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import {
  Home as HomeIcon,
  Bolt as PowerIcon,
  Science as NuclearIcon,
  Settings as ControlIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/common/AppLayout';
import type { SidebarItem } from '@/components/common/Sidebar';
import { useStore } from '@/stores/useStore';
import { useAuthStore } from '@/stores/authStore';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ title, description, icon, onClick }) => {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        height: '100%',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Box sx={{ mb: 2, color: 'primary.main' }}>
          {icon}
        </Box>
        <Typography variant="h5" component="h3" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarExpanded, toggleSidebar } = useStore();
  const { signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleCategoryClick = (category: 'power' | 'nuclear' | 'control') => {
    navigate(`/dashboard/${category}`);
  };

  // Sidebar items
  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: '홈',
      icon: <HomeIcon />,
      type: 'navigation',
      path: '/home',
      selected: location.pathname === '/home',
    },
    {
      id: 'nuclear',
      label: '원자력 계통',
      icon: <NuclearIcon />,
      type: 'navigation',
      path: '/dashboard/nuclear',
      selected: location.pathname === '/dashboard/nuclear',
    },
    {
      id: 'power',
      label: '전력 계통',
      icon: <PowerIcon />,
      type: 'navigation',
      path: '/dashboard/power',
      selected: location.pathname === '/dashboard/power',
    },
    {
      id: 'control',
      label: '제어 계통',
      icon: <ControlIcon />,
      type: 'navigation',
      path: '/dashboard/control',
      selected: location.pathname === '/dashboard/control',
    },
  ];

  // Update sidebar items with navigation handlers
  const sidebarItemsWithHandlers: SidebarItem[] = sidebarItems.map((item) => {
    if (item.type === 'navigation' && item.path) {
      return {
        ...item,
        onClick: () => navigate(item.path!),
      };
    }
    return item;
  });

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={sidebarItemsWithHandlers}
      activeSidebarItemId={sidebarItems.find((item) => item.selected)?.id}
      onLogout={handleLogout}
      onAccountSettings={() => navigate('/settings')}
      showUserProfile={true}
      showCollapseButton={true}
    >
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          VSMR Editor
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          계통을 선택하여 프로젝트를 관리하세요
        </Typography>

        <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
            <CategoryCard
              title="원자력 계통"
              description="원자력 계통 프로젝트를 관리하고 편집합니다"
              icon={<NuclearIcon sx={{ fontSize: 64 }} />}
              onClick={() => handleCategoryClick('nuclear')}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CategoryCard
              title="전력 계통"
              description="전력 계통 프로젝트를 관리하고 편집합니다"
              icon={<PowerIcon sx={{ fontSize: 64 }} />}
              onClick={() => handleCategoryClick('power')}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CategoryCard
              title="제어 계통"
              description="제어 계통 프로젝트를 관리하고 편집합니다"
              icon={<ControlIcon sx={{ fontSize: 64 }} />}
              onClick={() => handleCategoryClick('control')}
            />
          </Grid>
        </Grid>
      </Box>
    </AppLayout>
  );
};

export default HomePage;
