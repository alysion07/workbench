/**
 * SideInfoPanel Component
 * PRJ-001: Notice + Tutorial 섹션 (우측 패널)
 */

import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Campaign as NoticeIcon,
  School as TutorialIcon,
  OpenInNew as OpenInNewIcon,
  ChevronRight as ExpandIcon,
} from '@mui/icons-material';

// 정적 데이터 (추후 Supabase 연동)
const NOTICES = [
  {
    id: '1',
    title: 'System Maintenance',
    description: 'Scheduled maintenance on Jan 25',
    date: 'Jan 20',
    priority: 'high' as const,
  },
  {
    id: '2',
    title: 'New Feature Released',
    description: 'Model export functionality added',
    date: 'Jan 18',
    priority: 'medium' as const,
  },
  {
    id: '3',
    title: 'Documentation Update',
    description: 'MARS manual v2.0 available',
    date: 'Jan 15',
    priority: 'low' as const,
  },
];

const TUTORIALS = [
  {
    id: '1',
    title: 'Getting Started',
    description: 'Create your first project',
    url: '#',
  },
  {
    id: '2',
    title: 'Nodalization Basics',
    description: 'Learn node connections',
    url: '#',
  },
  {
    id: '3',
    title: 'Running Simulations',
    description: 'Execute and monitor runs',
    url: '#',
  },
];

interface SideInfoPanelProps {
  onNoticeClick?: (noticeId: string) => void;
  onTutorialClick?: (tutorialId: string) => void;
  onToggle?: () => void;
}

const SideInfoPanel: React.FC<SideInfoPanelProps> = ({
  onNoticeClick,
  onTutorialClick,
  onToggle,
}) => {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
      {/* Notice 섹션 */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', maxWidth: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 패널 접기 버튼 */}
            {onToggle && (
              <Tooltip title="패널 접기" placement="bottom">
                <IconButton
                  onClick={onToggle}
                  size="small"
                  sx={{
                    p: 0.5,
                    mr: 0.5,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ExpandIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
            <Typography variant="subtitle1" fontWeight={600}>
              Notice
            </Typography>
            <Chip
              label={NOTICES.length}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
        <List dense sx={{ py: 0 }}>
          {NOTICES.map((notice, index) => (
            <React.Fragment key={notice.id}>
              <ListItem
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  py: 1,
                  pr: 1,
                  minWidth: 0,
                }}
                onClick={() => onNoticeClick?.(notice.id)}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <NoticeIcon
                    fontSize="small"
                    color={
                      notice.priority === 'high'
                        ? 'error'
                        : notice.priority === 'medium'
                        ? 'warning'
                        : 'action'
                    }
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {notice.title}
                      </Typography>
                      {notice.date && (
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                          {notice.date}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={notice.description}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: { color: 'text.secondary' },
                    noWrap: true,
                  }}
                  sx={{ my: 0, minWidth: 0 }}
                />
                <OpenInNewIcon fontSize="small" sx={{ color: 'action.active', flexShrink: 0, ml: 1 }} />
              </ListItem>
              {index < NOTICES.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Tutorial 섹션 */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', maxWidth: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Tutorial
            </Typography>
            <Chip
              label={TUTORIALS.length}
              size="small"
              color="secondary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
        <List dense sx={{ py: 0 }}>
          {TUTORIALS.map((tutorial, index) => (
            <React.Fragment key={tutorial.id}>
              <ListItem
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  py: 1,
                  pr: 1,
                  minWidth: 0,
                }}
                onClick={() => onTutorialClick?.(tutorial.id)}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TutorialIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={tutorial.title}
                  secondary={tutorial.description}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: { color: 'text.secondary' },
                    noWrap: true,
                  }}
                  sx={{ my: 0, minWidth: 0 }}
                />
                <OpenInNewIcon fontSize="small" sx={{ color: 'action.active', flexShrink: 0, ml: 1 }} />
              </ListItem>
              {index < TUTORIALS.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default SideInfoPanel;
