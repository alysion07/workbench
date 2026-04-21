/**
 * Project Card Component
 * SimScale 스타일의 컴팩트한 프로젝트 카드
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  IconButton,
  Box,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  AccountTree as ModelIcon,
  Hub as NodeIcon,
  PlayCircleOutline as SimIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';

// Analysis Code별 색상
const CODE_COLORS: Record<string, string> = {
  MARS: '#1976d2',      // Blue
  SPHINCS: '#9c27b0',   // Purple
  Modelica: '#2e7d32',  // Green
};

interface ProjectCardProps {
  name: string;
  count: number;
  onClick: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  description?: string;
  updatedAt?: string;
  variant?: 'default' | 'picker';
  // 추가 메타데이터
  modelCount?: number;
  simulationCount?: number;
  analysisCodes?: string[];
}

// 날짜 포맷팅
const formatDate = (dateString?: string): string => {
  if (!dateString) {
    return new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const ProjectCard: React.FC<ProjectCardProps> = ({
  name,
  count,
  onClick,
  onDelete,
  onSelect,
  selected = false,
  description,
  updatedAt,
  variant = 'default',
  modelCount = 0,
  simulationCount = 0,
  analysisCodes = [],
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget as HTMLElement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setAnchorEl(null);
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect();
    } else {
      onClick();
    }
  };

  // PRJ-001 Picker 스타일 (SimScale 스타일)
  if (variant === 'picker') {
    return (
      <>
        <Card
          sx={{
            transition: 'all 0.2s ease',
            border: selected ? 2 : 1,
            borderColor: selected ? 'primary.main' : 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
            '&:hover': {
              borderColor: 'primary.light',
              boxShadow: 3,
              '& .card-actions': {
                opacity: 1,
              },
            },
          }}
        >
          <CardActionArea onClick={handleCardClick}>
            {/* 썸네일 영역 - 비율 기반 (더 크게) */}
            <Box
              sx={{
                aspectRatio: '5 / 3',
                bgcolor: 'grey.50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <FolderIcon sx={{ fontSize: '3rem', color: 'primary.light', opacity: 0.7 }} />
            </Box>

            <CardContent sx={{ pb: 1, pt: 1.5, minHeight: 100 }}>
              {/* 제목 */}
              <Typography
                variant="subtitle2"
                fontWeight={600}
                noWrap
                sx={{ mb: 0.5, lineHeight: 1.3 }}
              >
                {name}
              </Typography>

              {/* 설명 (한 줄) - 항상 공간 차지 */}
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', mb: 1, minHeight: 18 }}
              >
                {description || '\u00A0'}
              </Typography>

              {/* Analysis Code 칩 */}
              {analysisCodes.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                  {analysisCodes.slice(0, 3).map((code) => (
                    <Chip
                      key={code}
                      label={code}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        bgcolor: CODE_COLORS[code] || '#757575',
                        color: 'white',
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* 수정일 */}
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                {formatDate(updatedAt)}
              </Typography>
            </CardContent>

            {/* 메트릭 바 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50',
              }}
            >
              <Tooltip title="Models" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ModelIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {modelCount}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Nodes" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <NodeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {count}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Simulations" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SimIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {simulationCount}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          </CardActionArea>

          {/* 호버 시 나타나는 액션 버튼 */}
          <Box
            className="card-actions"
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <IconButton
              size="small"
              onClick={handleMenuClick}
              sx={{
                bgcolor: 'rgba(255,255,255,0.9)',
                boxShadow: 1,
                '&:hover': { bgcolor: 'white' },
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Card>

        {/* Context Menu */}
        <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontSize: '0.875rem' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </Menu>
      </>
    );
  }

  // Default 스타일 (기존 유지)
  return (
    <>
      <Card
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: selected ? 2 : 1,
          borderColor: selected ? 'primary.main' : 'divider',
          borderRadius: 2,
          '&:hover': {
            borderColor: 'primary.light',
            boxShadow: 3,
          },
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600} noWrap>
            {name}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1 }}>
              {description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {count} nodes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(updatedAt)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose}>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          삭제
        </MenuItem>
      </Menu>
    </>
  );
};

export default ProjectCard;
