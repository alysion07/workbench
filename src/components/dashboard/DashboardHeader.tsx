/**
 * Dashboard Header Component
 * 상단 헤더 (Dashboard 타이틀 + 검색 + 액션 버튼)
 */

import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Chat as ChatIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface DashboardHeaderProps {
  onNewProject: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// 날짜를 "MMM D" 형식으로 포맷팅 (예: "Feb 1")
const formatDate = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  onNewProject: _onNewProject, 
  searchQuery = '', 
  onSearchChange 
}) => {
  const currentDate = formatDate(new Date());

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar 
        sx={{ 
          justifyContent: 'space-between', 
          px: 3,
          height: 63,
        }}
      >
        {/* Left: Dashboard Title */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              fontSize: '1.25rem',
              color: 'text.primary',
            }}
          >
            Dashboard
          </Typography>
        </Box>

        {/* Center: Search */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center', px: 3 }}>
          <TextField
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            size="small"
            sx={{
              width: '100%',
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'grey.100',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: 'transparent',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'transparent',
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Right: Date + Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Date Button */}
          <Button
            variant="outlined"
            startIcon={<CalendarIcon fontSize="small" />}
            sx={{
              bgcolor: 'grey.100',
              borderColor: 'transparent',
              borderRadius: 2,
              color: 'text.primary',
              textTransform: 'none',
              px: 2,
              py: 0.75,
              '&:hover': {
                bgcolor: 'grey.200',
                borderColor: 'transparent',
              },
            }}
          >
            {currentDate}
          </Button>
          
          {/* Action 1: Notifications */}
          <IconButton
            sx={{
              bgcolor: 'grey.100',
              color: 'text.primary',
              width: 40,
              height: 40,
              '&:hover': {
                bgcolor: 'grey.200',
              },
            }}
          >
            <NotificationsIcon fontSize="small" />
          </IconButton>
          
          {/* Action 2: Chat */}
          <IconButton
            sx={{
              bgcolor: 'grey.100',
              color: 'text.primary',
              width: 40,
              height: 40,
              '&:hover': {
                bgcolor: 'grey.200',
              },
            }}
          >
            <ChatIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default DashboardHeader;

