/**
 * ModelCardList Component
 * MAIN-001: 프로젝트 내 모델 카드 그리드 표시
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import type { Model, SystemScope } from '@/types/supabase';

interface ModelCardListProps {
  models: Model[];
  onEdit: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onViewDetails?: (modelId: string) => void;
  selectedModelId?: string | null;
  onSelect?: (modelId: string | null) => void;
}

// Analysis Code별 색상
const analysisCodeColors: Record<string, string> = {
  MARS: '#1976d2',
  SPHINCS: '#9c27b0',
  Modelica: '#009688',
};

// Scope 라벨
const scopeLabels: Record<SystemScope, string> = {
  primary: 'Primary Loop',
  secondary: 'Secondary Loop',
  bop: 'BOP',
};

// Scope별 색상 정의
const scopeColors: Record<SystemScope, { bg: string; color: string; border: string }> = {
  primary: { bg: '#ffebee', color: '#c62828', border: '#c62828' },    // Red
  secondary: { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0' },  // Blue
  bop: { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32' },        // Green
};

// 모델 상태 계산
const getModelStatus = (model: Model): { label: string; color: 'default' | 'warning' | 'info' | 'success' } => {
  const nodeCount = model.nodes?.length || 0;
  if (nodeCount === 0) return { label: '비어있음', color: 'default' };
  if (nodeCount < 5) return { label: '초안', color: 'warning' };
  return { label: '작업 중', color: 'info' };
};

const ModelCardList: React.FC<ModelCardListProps> = ({
  models,
  onEdit,
  onDelete,
  onViewDetails,
  selectedModelId,
  onSelect,
}) => {
  // 더보기 메뉴 상태
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement | null; modelId: string | null }>({
    el: null,
    modelId: null,
  });

  // 날짜 포맷 (간결한 형식: 2026.01.19)
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, '');
  };

  // 메뉴 핸들러
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, modelId: string) => {
    event.stopPropagation();
    setMenuAnchor({ el: event.currentTarget, modelId });
  };

  const handleMenuClose = () => {
    setMenuAnchor({ el: null, modelId: null });
  };

  const handleDeleteFromMenu = () => {
    if (menuAnchor.modelId) {
      onDelete(menuAnchor.modelId);
    }
    handleMenuClose();
  };

  if (models.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          bgcolor: 'grey.50',
          borderRadius: 2,
          border: '2px dashed',
          borderColor: 'grey.300',
          p: 3,
        }}
      >
        <Typography variant="body1" color="text.secondary" gutterBottom>
          아직 모델이 없습니다
        </Typography>
        <Typography variant="caption" color="text.secondary">
          상단의 "새 모델" 버튼을 클릭하여 첫 모델을 생성하세요
        </Typography>
      </Box>
    );
  }

  // 카드 클릭 핸들러 (선택/해제)
  const handleCardClick = (modelId: string) => {
    if (onSelect) {
      onSelect(selectedModelId === modelId ? null : modelId);
    }
  };

  return (
    <>
      <Grid container spacing={2} alignItems="stretch">
        {models.map((model) => {
          const isSelected = selectedModelId === model.id;
          const status = getModelStatus(model);
          return (
          <Grid item xs={12} key={model.id} sx={{ display: 'flex' }}>
            <Card
              onClick={() => handleCardClick(model.id)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                position: 'relative',
                transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderLeft: isSelected ? '4px solid' : '1px solid',
                borderLeftColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'primary.50' : 'background.paper',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                  borderColor: isSelected ? 'primary.main' : 'primary.light',
                },
              }}
            >
              {/* 선택 표시 아이콘 */}
              {isSelected && (
                <CheckCircleIcon
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: 'primary.main',
                    fontSize: 20,
                  }}
                />
              )}

              <CardContent sx={{ py: 1.5, px: 2, flex: 1 }}>
                {/* 상단: 모델 이름 + Analysis Code + 상태 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pr: isSelected ? 3 : 0 }}>
                  <Typography
                    variant="subtitle1"
                    component="h3"
                    sx={{ fontWeight: 600, flexShrink: 0 }}
                  >
                    {model.name}
                  </Typography>
                  {model.analysisCodes.map((code) => (
                    <Chip
                      key={code}
                      label={code}
                      size="small"
                      sx={{
                        bgcolor: analysisCodeColors[code] || 'grey.500',
                        color: 'white',
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        height: 20,
                      }}
                    />
                  ))}
                  <Chip
                    label={status.label}
                    color={status.color}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 'auto', fontSize: '0.65rem', height: 20 }}
                  />
                </Box>

                {/* Description */}
                {model.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      fontSize: '0.8rem',
                    }}
                  >
                    {model.description}
                  </Typography>
                )}

                {/* Scope - Colored Chips */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    영역:
                  </Typography>
                  {model.scope?.systems?.map((scope) => {
                    const color = scopeColors[scope];
                    return (
                      <Chip
                        key={scope}
                        label={scopeLabels[scope] || scope}
                        size="small"
                        sx={{
                          bgcolor: color.bg,
                          color: color.color,
                          borderColor: color.border,
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    );
                  })}
                  {(!model.scope?.systems || model.scope.systems.length === 0) && (
                    <Typography variant="caption" color="text.secondary">
                      -
                    </Typography>
                  )}
                </Box>

                {/* Node Count + Updated At (한 줄로) */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {model.nodes?.length || 0}개 노드, {model.edges?.length || 0}개 연결
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(model.updated_at)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>

              <CardActions sx={{ justifyContent: 'flex-end', px: 1.5, py: 1, gap: 0.5 }}>
                <Tooltip title="더보기">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, model.id)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {onViewDetails && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(model.id);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    DETAILS
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(model.id);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  EDIT
                </Button>
              </CardActions>
            </Card>
          </Grid>
          );
        })}
      </Grid>

      {/* 더보기 메뉴 */}
      <Menu
        anchorEl={menuAnchor.el}
        open={Boolean(menuAnchor.el)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>삭제</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ModelCardList;
