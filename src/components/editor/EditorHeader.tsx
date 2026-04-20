/**
 * EditorHeader Component
 * EditorPage용 컨텐츠 상단 헤더
 */

import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Box,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  FolderOpen as OpenIcon,
  SaveOutlined as SaveOutlinedIcon,
  Save as SaveFilledIcon,
  Download as DownloadIcon,
  PlayArrow as RunIcon,
  Description as MarsFileIcon,
  DataObject as JsonIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Close as CloseIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';

interface EditorHeaderProps {
  projectName?: string;
  saving?: boolean;
  onOpenClick: () => void;
  onSave: () => void;
  onSaveAll?: () => void;
  saveAllVisible?: boolean;
  savingAll?: boolean;
  onExport: () => void;
  onExportProjectJson?: () => void;
  onRunSimulation?: () => void;
  saveDisabled?: boolean;
  fullCodeViewOpen?: boolean;
  onToggleFullCodeView?: () => void;
  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchResultCount?: number;
  searchActiveIndex?: number;
  onSearchNext?: () => void;
  onSearchPrev?: () => void;
  onSearchClear?: () => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  saving = false,
  onOpenClick,
  onSave,
  onSaveAll,
  saveAllVisible = false,
  savingAll = false,
  onExport,
  onExportProjectJson,
  onRunSimulation,
  saveDisabled = false,
  fullCodeViewOpen = false,
  onToggleFullCodeView,
  searchQuery = '',
  onSearchChange,
  searchResultCount = 0,
  searchActiveIndex = -1,
  onSearchNext,
  onSearchPrev,
  onSearchClear,
}) => {
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const hasSearch = searchQuery.length > 0;

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
        {/* Left: Editor Title */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              fontSize: '1.25rem',
              color: 'text.primary',
            }}
          >
            VSMR Editor{projectName && ` - ${projectName}`}
          </Typography>
        </Box>

        {/* Center: Search */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center', px: 3 }}>
          <TextField
            placeholder="Search (ID or Name)"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  onSearchPrev?.();
                } else {
                  onSearchNext?.();
                }
              } else if (e.key === 'Escape') {
                onSearchClear?.();
              }
            }}
            size="small"
            sx={{
              width: '100%',
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'grey.100',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: hasSearch && searchResultCount === 0 ? 'error.main' : 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: hasSearch && searchResultCount === 0 ? 'error.main' : 'transparent',
                },
                '&.Mui-focused fieldset': {
                  borderColor: hasSearch && searchResultCount === 0 ? 'error.main' : 'primary.main',
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" sx={{ gap: 0 }}>
                  {hasSearch ? (
                    <>
                      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', mr: 0.5 }}>
                        {searchResultCount > 0 ? `${searchActiveIndex + 1}/${searchResultCount}` : '0'}
                      </Typography>
                      <IconButton size="small" onClick={onSearchPrev} disabled={searchResultCount === 0} sx={{ p: 0.25 }}>
                        <PrevIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={onSearchNext} disabled={searchResultCount === 0} sx={{ p: 0.25 }}>
                        <NextIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={onSearchClear} sx={{ p: 0.25 }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : (
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  )}
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Right: Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Open Button */}
          <Tooltip title="Open">
            <IconButton
              onClick={onOpenClick}
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
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          {/* Save Current Tab Button */}
          <Tooltip title={saving && !savingAll ? '저장 중...' : '현재 탭 저장'}>
            <span>
              <IconButton
                onClick={onSave}
                disabled={saving || saveDisabled}
                sx={{
                  bgcolor: saving && !savingAll ? 'primary.light' : 'grey.100',
                  color: saving && !savingAll ? 'primary.main' : 'text.primary',
                  width: 40,
                  height: 40,
                  '&:hover': {
                    bgcolor: saving && !savingAll ? 'primary.light' : 'grey.200',
                  },
                  '&:disabled': {
                    bgcolor: saving && !savingAll ? 'primary.light' : 'grey.50',
                    color: saving && !savingAll ? 'primary.main' : 'text.disabled',
                  },
                }}
              >
                {saving && !savingAll ? (
                  <CircularProgress size={20} color="primary" />
                ) : (
                  <SaveOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>

          {/* Save All Models Button (멀티모델 프로젝트에서만 노출) */}
          {saveAllVisible && onSaveAll && (
            <Tooltip title={savingAll ? '전체 저장 중...' : '전체 모델 저장'}>
              <span>
                <IconButton
                  onClick={onSaveAll}
                  disabled={saving || saveDisabled}
                  sx={{
                    bgcolor: savingAll ? 'primary.light' : 'grey.100',
                    color: savingAll ? 'primary.main' : 'text.primary',
                    width: 40,
                    height: 40,
                    '&:hover': { bgcolor: savingAll ? 'primary.light' : 'grey.200' },
                    '&:disabled': { bgcolor: savingAll ? 'primary.light' : 'grey.50', color: savingAll ? 'primary.main' : 'text.disabled' },
                  }}
                >
                  {savingAll ? (
                    <CircularProgress size={20} color="primary" />
                  ) : (
                    <SaveFilledIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}

          {/* Text Code Preview Toggle */}
          {onToggleFullCodeView && (
            <Tooltip title={fullCodeViewOpen ? 'Close Text Code Preview' : 'Text Code Preview'}>
              <IconButton
                onClick={onToggleFullCodeView}
                sx={{
                  bgcolor: fullCodeViewOpen ? 'primary.main' : 'grey.100',
                  color: fullCodeViewOpen ? 'white' : 'text.primary',
                  width: 40,
                  height: 40,
                  '&:hover': {
                    bgcolor: fullCodeViewOpen ? 'primary.dark' : 'grey.200',
                  },
                }}
              >
                <CodeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Export Dropdown Button */}
          <Tooltip title="Export">
            <IconButton
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              sx={{
                bgcolor: exportMenuAnchor ? 'grey.200' : 'grey.100',
                color: 'text.primary',
                width: 40,
                height: 40,
                '&:hover': {
                  bgcolor: 'grey.200',
                },
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { onExport(); setExportMenuAnchor(null); }}>
              <ListItemIcon><MarsFileIcon fontSize="small" /></ListItemIcon>
              <ListItemText>MARS 입력파일 (.i)</ListItemText>
            </MenuItem>
            {onExportProjectJson && (
              <MenuItem onClick={() => { onExportProjectJson(); setExportMenuAnchor(null); }}>
                <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
                <ListItemText>프로젝트 JSON</ListItemText>
              </MenuItem>
            )}
          </Menu>

          {/* Run Simulation Button */}
          {onRunSimulation && (
            <Tooltip title="Run Simulation">
              <IconButton
                onClick={onRunSimulation}
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  width: 40,
                  height: 40,
                  '&:hover': {
                    bgcolor: 'success.main',
                    color: 'white',
                  },
                }}
              >
                <RunIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default EditorHeader;

