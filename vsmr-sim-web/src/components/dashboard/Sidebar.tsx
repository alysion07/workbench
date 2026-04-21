/**
 * Sidebar Component
 * 확장 가능한 왼쪽 사이드바 네비게이션
 */

import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface SidebarProps {
  onLogout?: () => void;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'vsmr-sim-web',
    label: 'vSMR 시뮬레이션 플랫폼 웹 UI',
    icon: <FolderIcon />,
    path: '/workspace',
  },
    // 추후 전력 계통 등 추가 예정
  {
    id: 'control-system',
    label: '제어 계통 ',
    icon: < FolderIcon />,
    path: '/power-system',
  },
  // 추후 전력 계통 등 추가 예정
  // {
  //   id: 'power-system',
  //   label: '전력 계통',
  //   icon: <PowerIcon />,
  //   path: '/power-system',
  // },
];

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // 사용자 표시명 결정: GitHub 닉네임 > 이메일 > 기본값
  const displayName = user?.user_metadata?.user_name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Box
      sx={{
        width: 260,
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem',
          }}
        >
          M
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          MARS
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flexGrow: 1, pt: 2 }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={location.pathname === '/dashboard'}
            onClick={() => handleNavigation('/dashboard')}
            sx={{
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                color: location.pathname === '/dashboard' ? 'white' : 'inherit',
              }}
            >
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="홈" />
          </ListItemButton>
        </ListItem>

        {sidebarItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'white' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}

        <ListItem disablePadding sx={{ mt: 2 }}>
          <ListItemButton>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="설정" />
          </ListItemButton>
        </ListItem>
      </List>

      <Divider />

      {/* User Profile */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            {avatarLetter}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email || 'Stay Focused'}
            </Typography>
          </Box>
        </Box>
        {onLogout && (
          <ListItemButton
            onClick={onLogout}
            sx={{
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="로그아웃" primaryTypographyProps={{ variant: 'body2' }} />
          </ListItemButton>
        )}
      </Box>
    </Box>
  );
};

export default Sidebar;

