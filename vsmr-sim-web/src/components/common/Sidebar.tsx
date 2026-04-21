/**
 * Common Sidebar Component
 * 범용 사이드바 컴포넌트 - 접기/확장 기능 및 동적 아이템 렌더링 지원
 * 하단 프로필 영역에 인라인 확장 메뉴 (계정 설정, 로그아웃)
 */

import { useState } from 'react';
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
  IconButton,
  Tooltip,
  Collapse,
  ButtonBase,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  type?: 'navigation' | 'action' | 'divider';
  onClick?: () => void; // action 타입일 때
  path?: string; // navigation 타입일 때
  selected?: boolean; // 선택 상태
  disabled?: boolean; // 비활성화 상태
  badge?: React.ReactNode; // 뱃지/알림 표시
}

interface SidebarProps {
  expanded?: boolean; // 확장 상태
  onToggleExpand?: () => void; // 확장/축소 핸들러
  items: SidebarItem[]; // 아이템 목록
  activeItemId?: string; // 현재 활성 아이템
  onLogout?: () => void; // 로그아웃 핸들러
  onAccountSettings?: () => void; // 계정 설정 핸들러
  showUserProfile?: boolean; // 사용자 프로필 표시 여부
  showCollapseButton?: boolean; // 접기/확장 버튼 표시 여부
}

const Sidebar: React.FC<SidebarProps> = ({
  expanded = false,
  onToggleExpand,
  items,
  activeItemId,
  onLogout,
  onAccountSettings,
  showUserProfile = true,
  showCollapseButton = true,
}) => {
  const { user, profile } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // 사용자 표시 이름 결정 (우선순위: display_name > name > email > 'User')
  const displayName = profile?.display_name
    || user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'User';

  const collapsedWidth = 72;
  const expandedWidth = 260;

  const handleProfileClick = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleAccountSettings = () => {
    setMenuOpen(false);
    onAccountSettings?.();
  };

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout?.();
  };

  const renderSidebarItem = (item: SidebarItem) => {
    if (item.type === 'divider') {
      return <Divider key={item.id} sx={{ my: expanded ? 1 : 0.5 }} />;
    }

    const isSelected = item.selected || activeItemId === item.id;

    if (expanded) {
      return (
        <ListItem
          key={item.id}
          disablePadding
          sx={{
            width: '100%',
          }}
        >
          <ListItemButton
            selected={isSelected}
            disabled={item.disabled}
            onClick={item.onClick}
            sx={{
              minHeight: 48,
              px: 2,
              bgcolor: isSelected ? 'primary.main' : 'transparent',
              color: isSelected ? 'white' : 'inherit',
              '&:hover': {
                bgcolor: isSelected ? 'primary.dark' : 'action.hover',
              },
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
              '&.Mui-disabled': {
                opacity: 0.5,
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: 'inherit',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                variant: 'body2',
              }}
            />
            {item.badge && <Box sx={{ ml: 1 }}>{item.badge}</Box>}
          </ListItemButton>
        </ListItem>
      );
    } else {
      return (
        <ListItem key={item.id} disablePadding>
          <Tooltip title={item.disabled ? '' : item.label} placement="right">
            <ListItemButton
              selected={isSelected}
              disabled={item.disabled}
              onClick={item.onClick}
              sx={{
                justifyContent: 'center',
                minHeight: 48,
                bgcolor: isSelected ? 'primary.main' : 'transparent',
                color: isSelected ? 'white' : 'inherit',
                '&:hover': {
                  bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                },
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
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  justifyContent: 'center',
                  color: 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>
      );
    }
  };

  return (
    <Box
      sx={{
        width: expanded ? expandedWidth : collapsedWidth,
        minWidth: expanded ? expandedWidth : collapsedWidth,
        maxWidth: expanded ? expandedWidth : collapsedWidth,
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Logo and Expand Button - Height matches AppBar Toolbar (64px) */}
      <Box
        sx={{
          height: 64,
          px: expanded ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'relative',
        }}
      >
        {expanded ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                VSMR
              </Typography>
            </Box>
            {showCollapseButton && onToggleExpand && (
              <Tooltip title="사이드바 축소" placement="right">
                <IconButton
                  onClick={onToggleExpand}
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ChevronLeftIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        ) : (
          <Tooltip title="사이드바 확장" placement="right">
            <Box
              onClick={showCollapseButton && onToggleExpand ? onToggleExpand : undefined}
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.8rem',
                boxShadow: 1,
                cursor: showCollapseButton && onToggleExpand ? 'pointer' : 'default',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  boxShadow: 2,
                  transform: 'scale(1.05)',
                  '& .logo-text': {
                    opacity: 0,
                    transform: 'scale(0.8)',
                  },
                  '& .expand-icon': {
                    opacity: 1,
                    transform: 'scale(1)',
                  },
                },
              }}
            >
              {/* Logo Text - M */}
              <Box
                component="span"
                className="logo-text"
                sx={{
                  position: 'absolute',
                  opacity: 1,
                  transform: 'scale(1)',
                  transition: 'all 0.3s ease',
                }}
              >
                M
              </Box>
              {/* Expand Icon - Shows on hover */}
              <Box
                component="span"
                className="expand-icon"
                sx={{
                  position: 'absolute',
                  opacity: 0,
                  transform: 'scale(0.8)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronRightIcon sx={{ fontSize: '2rem' }} />
              </Box>
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Navigation Items */}
      <List
        sx={{
          flexGrow: 1,
          pt: 2,
          width: '100%',
          '& .MuiListItem-root': {
            width: '100%',
          },
          '& .MuiListItemButton-root': {
            width: '100%',
          },
        }}
      >
        {items.map(renderSidebarItem)}
      </List>

      {/* Bottom Section - User Profile with Inline Expand Menu */}
      {(showUserProfile || onLogout) && (
        <>
          <Divider />

          {/* 인라인 확장 메뉴 (프로필 위로 펼쳐짐) */}
          <Collapse in={menuOpen} timeout={200}>
            <Box
              sx={{
                bgcolor: 'grey.50',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {/* 계정 설정 */}
              {onAccountSettings && (
                <ListItemButton
                  onClick={handleAccountSettings}
                  sx={{
                    minHeight: expanded ? 44 : 48,
                    px: expanded ? 2 : 1,
                    justifyContent: expanded ? 'flex-start' : 'center',
                    gap: 1.5,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {expanded ? (
                    <>
                      <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                        <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="계정 설정"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </>
                  ) : (
                    <Tooltip title="계정 설정" placement="right">
                      <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </Tooltip>
                  )}
                </ListItemButton>
              )}

              {/* 로그아웃 */}
              {onLogout && (
                <ListItemButton
                  onClick={handleLogout}
                  sx={{
                    minHeight: expanded ? 44 : 48,
                    px: expanded ? 2 : 1,
                    justifyContent: expanded ? 'flex-start' : 'center',
                    gap: 1.5,
                    color: 'error.main',
                    '&:hover': { bgcolor: 'error.50', },
                  }}
                >
                  {expanded ? (
                    <>
                      <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="로그아웃"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </>
                  ) : (
                    <Tooltip title="로그아웃" placement="right">
                      <LogoutIcon fontSize="small" />
                    </Tooltip>
                  )}
                </ListItemButton>
              )}
            </Box>
          </Collapse>

          {/* 프로필 영역 (클릭하면 위 메뉴 토글) */}
          {expanded ? (
            <ButtonBase
              onClick={handleProfileClick}
              sx={{
                p: 2,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                textAlign: 'left',
                borderRadius: 0,
                transition: 'background-color 0.15s ease',
                ...(menuOpen && {
                  bgcolor: 'action.selected',
                }),
                '&:hover': {
                  bgcolor: menuOpen ? 'action.selected' : 'action.hover',
                  '& .profile-expand-icon': {
                    opacity: 1,
                    color: 'text.primary',
                  },
                },
              }}
            >
              {showUserProfile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 0 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, flexShrink: 0 }}>
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                      {displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ lineHeight: 1.2 }}>
                      {user?.email || 'Stay Focused'}
                    </Typography>
                  </Box>
                  <UnfoldMoreIcon
                    className="profile-expand-icon"
                    sx={{
                      fontSize: 18,
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                      transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: menuOpen ? 'text.primary' : 'text.disabled',
                      opacity: menuOpen ? 1 : 0.6,
                    }}
                  />
                </Box>
              )}
            </ButtonBase>
          ) : (
            <Box sx={{ p: 1 }}>
              <Tooltip title="계정 메뉴" placement="right">
                <span style={{ width: '100%' }}>
                  <ListItemButton
                    onClick={handleProfileClick}
                    sx={{
                      justifyContent: 'center',
                      minHeight: 48,
                      borderRadius: 1,
                      transition: 'background-color 0.15s ease',
                      ...(menuOpen && {
                        bgcolor: 'action.selected',
                      }),
                      '&:hover': {
                        bgcolor: menuOpen ? 'action.selected' : 'action.hover',
                      },
                    }}
                  >
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemButton>
                </span>
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Sidebar;
