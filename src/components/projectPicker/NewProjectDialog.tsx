/**
 * NewProjectDialog Component
 * PRJ-001-NP: 새 프로젝트 생성 다이얼로그 (개편)
 *
 * - Category 제거
 * - Project Scope: 전체 설계 범위 설정
 * - Project Partition: 모델별 설정 (PartitionCard)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { ReactorSystemSVG, ReactorComponentId } from './index';
import PartitionCard from './PartitionCard';
import type {
  SystemScope,
  PartitionFormData,
  NewProjectFormData,
} from '@/types/supabase';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
  loading?: boolean;
  error?: string | null;
  onCreate: (data: NewProjectFormData) => Promise<string | null>;
}

// UUID 생성 헬퍼
const generateId = (): string =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// 초기 파티션 생성
const createInitialPartition = (scope: SystemScope[]): PartitionFormData => ({
  id: generateId(),
  name: '',
  analysisCode: 'MARS',
  description: '',
  scope,
});

const INITIAL_FORM_DATA: NewProjectFormData = {
  title: '',
  description: '',
  tags: [],
  scope: ['primary', 'secondary', 'bop'],
  partitions: [],
};

// Scope 라벨
const SCOPE_LABELS: Record<SystemScope, string> = {
  primary: 'Primary Loop',
  secondary: 'Second Loop',
  bop: 'BOP',
};

// 스코프별 색상 정의
const SCOPE_COLORS: Record<SystemScope, { bg: string; color: string; border: string }> = {
  primary: { bg: '#ffebee', color: '#c62828', border: '#c62828' },    // Red
  secondary: { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0' },  // Blue
  bop: { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32' },        // Green
};

const ALL_SCOPES: SystemScope[] = ['primary', 'secondary', 'bop'];

// Scope를 ReactorComponentId로 매핑
const scopeToComponents: Record<SystemScope, ReactorComponentId[]> = {
  primary: ['reactor', 'steamGenerator'],
  secondary: ['turbine', 'condenser', 'feedwaterPump'],
  bop: ['coolingTower'],
};

const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  open,
  onClose,
  onCreated,
  loading = false,
  error,
  onCreate,
}) => {
  const [formData, setFormData] = useState<NewProjectFormData>(INITIAL_FORM_DATA);
  const [tagInput, setTagInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Scope에 따른 하이라이트 컴포넌트
  const highlightedComponents = useMemo(() => {
    const components: ReactorComponentId[] = [];
    formData.scope.forEach((s) => {
      components.push(...scopeToComponents[s]);
    });
    return components;
  }, [formData.scope]);

  // 파티션에서 사용 중인 스코프 계산
  const usedScopes = useMemo(() => {
    const used = new Set<SystemScope>();
    formData.partitions.forEach((p) => {
      p.scope.forEach((s) => used.add(s));
    });
    return used;
  }, [formData.partitions]);

  // 특정 파티션이 선택 가능한 스코프 (자신의 스코프 + 미사용 스코프)
  const getAvailableScopesForPartition = useCallback(
    (partitionId: string): SystemScope[] => {
      const otherUsedScopes = new Set<SystemScope>();
      formData.partitions.forEach((p) => {
        if (p.id !== partitionId) {
          p.scope.forEach((s) => otherUsedScopes.add(s));
        }
      });

      return formData.scope.filter((s) => !otherUsedScopes.has(s));
    },
    [formData.partitions, formData.scope]
  );

  // 미할당 스코프 계산
  const unassignedScopes = useMemo(() => {
    return formData.scope.filter((s) => !usedScopes.has(s));
  }, [formData.scope, usedScopes]);

  // Project Scope 토글
  const handleScopeToggle = (scope: SystemScope) => {
    const isSelected = formData.scope.includes(scope);
    let newScope: SystemScope[];

    if (isSelected) {
      // 제거 시: 파티션에서 해당 스코프도 제거
      newScope = formData.scope.filter((s) => s !== scope);
      const updatedPartitions = formData.partitions.map((p) => ({
        ...p,
        scope: p.scope.filter((s) => s !== scope),
      }));
      setFormData({ ...formData, scope: newScope, partitions: updatedPartitions });
    } else {
      // 추가
      newScope = [...formData.scope, scope];
      setFormData({ ...formData, scope: newScope });
    }

    setLocalError(null);
  };

  // 태그 추가
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  // 태그 삭제
  const handleDeleteTag = (tagToDelete: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tagToDelete),
    });
  };

  // 파티션 추가
  const handleAddPartition = () => {
    const newPartition = createInitialPartition(unassignedScopes);
    setFormData({
      ...formData,
      partitions: [...formData.partitions, newPartition],
    });
  };

  // 파티션 수정
  const handleUpdatePartition = (updated: PartitionFormData) => {
    setFormData({
      ...formData,
      partitions: formData.partitions.map((p) =>
        p.id === updated.id ? updated : p
      ),
    });
    setLocalError(null);
  };

  // 파티션 삭제
  const handleDeletePartition = (partitionId: string) => {
    setFormData({
      ...formData,
      partitions: formData.partitions.filter((p) => p.id !== partitionId),
    });
  };

  // 유효성 검사
  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return '프로젝트 이름을 입력해주세요.';
    }

    if (formData.scope.length === 0) {
      return 'Project Scope를 최소 1개 이상 선택해주세요.';
    }

    if (formData.partitions.length === 0) {
      return 'Project Partition을 최소 1개 이상 추가해주세요.';
    }

    // 파티션 유효성 검사
    for (const partition of formData.partitions) {
      if (!partition.name.trim()) {
        return '모든 파티션의 이름을 입력해주세요.';
      }
      if (partition.scope.length === 0) {
        return `"${partition.name}" 파티션의 Model Scope를 선택해주세요.`;
      }
    }

    // 스코프 커버리지 검사
    if (unassignedScopes.length > 0) {
      const unassignedLabels = unassignedScopes.map((s) => SCOPE_LABELS[s]).join(', ');
      return `다음 스코프가 파티션에 할당되지 않았습니다: ${unassignedLabels}`;
    }

    return null;
  };

  // 생성 처리
  const handleCreate = async () => {
    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      const projectId = await onCreate(formData);
      if (projectId) {
        onCreated?.(projectId);
        handleClose();
      }
    } catch (err) {
      setLocalError('프로젝트 생성에 실패했습니다.');
    }
  };

  // 다이얼로그 닫기
  const handleClose = () => {
    setFormData(INITIAL_FORM_DATA);
    setTagInput('');
    setLocalError(null);
    onClose();
  };

  const displayError = localError || error;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '90vh' },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>New Project</DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto' }}>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* 좌측: Component Viewer */}
          <Box
            sx={{
              flex: '0 0 40%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              bgcolor: 'grey.50',
              borderRadius: 2,
              p: 2,
              minHeight: 400,
              position: 'sticky',
              top: 0,
            }}
          >
            <ReactorSystemSVG
              highlightedComponents={highlightedComponents}
              width="100%"
              height={350}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              선택한 Scope에 따라 하이라이트됩니다
            </Typography>
          </Box>

          {/* 우측: 폼 필드 */}
          <Box sx={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {displayError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {displayError}
              </Alert>
            )}

            {/* Title */}
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
              placeholder="VSMR-SMART"
              size="small"
            />

            {/* Description */}
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="프로젝트 설명을 입력하세요"
              size="small"
            />

            {/* Tags */}
            <Box>
              <TextField
                label="Tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="태그 입력 후 Enter"
                size="small"
                sx={{ width: '100%' }}
              />
              {formData.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {formData.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleDeleteTag(tag)}
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Project Scope */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Project Scope
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {ALL_SCOPES.map((scope) => {
                  const isSelected = formData.scope.includes(scope);
                  const scopeColor = SCOPE_COLORS[scope];
                  return (
                    <Chip
                      key={scope}
                      label={SCOPE_LABELS[scope]}
                      onClick={() => handleScopeToggle(scope)}
                      onDelete={isSelected ? () => handleScopeToggle(scope) : undefined}
                      variant={isSelected ? 'filled' : 'outlined'}
                      size="small"
                      sx={{
                        ...(isSelected
                          ? {
                              bgcolor: scopeColor.bg,
                              color: scopeColor.color,
                              borderColor: scopeColor.border,
                              '& .MuiChip-deleteIcon': {
                                color: scopeColor.color,
                                '&:hover': {
                                  color: scopeColor.border,
                                },
                              },
                            }
                          : {
                              borderColor: scopeColor.border,
                              color: scopeColor.color,
                              '&:hover': {
                                bgcolor: `${scopeColor.bg}80`,
                              },
                            }),
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Project Partition */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Project Partition
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleAddPartition}
                  disabled={unassignedScopes.length === 0 && formData.partitions.length > 0}
                  color="primary"
                >
                  <AddIcon />
                </IconButton>
              </Box>

              {formData.partitions.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    파티션(모델)을 추가하세요
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddPartition}
                    sx={{ mt: 1 }}
                  >
                    파티션 추가
                  </Button>
                </Box>
              ) : (
                formData.partitions.map((partition) => (
                  <PartitionCard
                    key={partition.id}
                    partition={partition}
                    availableScopes={getAvailableScopesForPartition(partition.id)}
                    onChange={handleUpdatePartition}
                    onDelete={() => handleDeletePartition(partition.id)}
                    canDelete={formData.partitions.length > 1}
                  />
                ))
              )}

              {/* 미할당 스코프 경고 */}
              {unassignedScopes.length > 0 && formData.partitions.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  미할당 스코프: {unassignedScopes.map((s) => SCOPE_LABELS[s]).join(', ')}
                </Alert>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          CANCEL
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={loading || !formData.title.trim() || formData.partitions.length === 0}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          CREATE
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewProjectDialog;
