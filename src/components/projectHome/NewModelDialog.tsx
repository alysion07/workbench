/**
 * NewModelDialog Component
 * MAIN-001: 새 모델 생성 다이얼로그
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  FormLabel,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ReactorSystemSVG, ReactorComponentId } from '../projectPicker';
import type { AnalysisCode, ModelInsert, SystemScope, ModelScope } from '@/types/supabase';

export interface NewModelFormData {
  name: string;
  analysisCodes: AnalysisCode[];
  description: string;
  scope: ModelScope;
}

interface NewModelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: ModelInsert) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  existingScopes?: SystemScope[];  // 이미 다른 모델에서 사용 중인 스코프
}

// 초기 폼 데이터
const INITIAL_FORM_DATA: NewModelFormData = {
  name: '',
  analysisCodes: ['MARS'],
  description: '',
  scope: {
    systems: ['primary'],
    components: [],
  },
};

// Analysis Code 옵션
const ANALYSIS_CODE_OPTIONS: { value: AnalysisCode; label: string; color: string }[] = [
  { value: 'MARS', label: 'MARS', color: '#1976d2' },
  { value: 'SPHINCS', label: 'SPHINCS', color: '#9c27b0' },
  { value: 'Modelica', label: 'Modelica', color: '#009688' },
];

// Scope 옵션
const SCOPE_OPTIONS: { value: SystemScope; label: string; color: string }[] = [
  { value: 'primary', label: 'Primary Loop', color: '#3f51b5' },
  { value: 'secondary', label: 'Secondary Loop', color: '#9c27b0' },
  { value: 'bop', label: 'BOP', color: '#009688' },
];

// Scope를 ReactorComponentId로 매핑
const scopeToComponents: Record<SystemScope, ReactorComponentId[]> = {
  primary: ['reactor', 'steamGenerator'],
  secondary: ['turbine', 'condenser', 'feedwaterPump'],
  bop: ['coolingTower'],
};

const NewModelDialog: React.FC<NewModelDialogProps> = ({
  open,
  onClose,
  onCreate,
  loading = false,
  error,
  existingScopes = [],
}) => {
  const [formData, setFormData] = useState<NewModelFormData>(INITIAL_FORM_DATA);
  const [localError, setLocalError] = useState<string | null>(null);

  // Scope에 따른 하이라이트 컴포넌트
  const highlightedComponents = useMemo(() => {
    const components: ReactorComponentId[] = [];
    formData.scope.systems.forEach((s) => {
      components.push(...scopeToComponents[s]);
    });
    return components;
  }, [formData.scope.systems]);

  // 폼 필드 변경
  const handleChange = (field: keyof NewModelFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
  };

  // Analysis Code 토글
  const handleAnalysisCodeToggle = (code: AnalysisCode) => {
    const current = formData.analysisCodes;
    if (current.includes(code)) {
      // 최소 1개는 선택해야 함
      if (current.length > 1) {
        handleChange(
          'analysisCodes',
          current.filter((c) => c !== code)
        );
      }
    } else {
      handleChange('analysisCodes', [...current, code]);
    }
  };

  // Scope 토글
  const handleScopeToggle = (scopeValue: SystemScope) => {
    const currentSystems = formData.scope.systems;

    // 이미 다른 모델에서 사용 중인 스코프인지 확인
    if (!currentSystems.includes(scopeValue) && existingScopes.includes(scopeValue)) {
      setLocalError(`"${SCOPE_OPTIONS.find(o => o.value === scopeValue)?.label}" 스코프는 이미 다른 모델에서 사용 중입니다.`);
      return;
    }

    if (currentSystems.includes(scopeValue)) {
      handleChange('scope', {
        ...formData.scope,
        systems: currentSystems.filter((s) => s !== scopeValue),
      });
    } else {
      handleChange('scope', {
        ...formData.scope,
        systems: [...currentSystems, scopeValue],
      });
    }
  };

  // 생성 처리
  const handleCreate = async () => {
    // 유효성 검사
    if (!formData.name.trim()) {
      setLocalError('모델 이름을 입력해주세요.');
      return;
    }

    if (formData.analysisCodes.length === 0) {
      setLocalError('최소 하나의 Analysis Code를 선택해주세요.');
      return;
    }

    if (formData.scope.systems.length === 0) {
      setLocalError('최소 하나의 Scope를 선택해주세요.');
      return;
    }

    try {
      await onCreate({
        name: formData.name,
        analysisCodes: formData.analysisCodes,
        description: formData.description || null,
        scope: formData.scope,
      });
      handleClose();
    } catch (err) {
      setLocalError('모델 생성에 실패했습니다.');
    }
  };

  // 다이얼로그 닫기
  const handleClose = () => {
    setFormData(INITIAL_FORM_DATA);
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
        sx: { minHeight: '60vh' },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>New Model</DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* 좌측: Component Viewer */}
          <Box
            sx={{
              flex: '0 0 45%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.50',
              borderRadius: 2,
              p: 2,
              minHeight: 350,
            }}
          >
            <ReactorSystemSVG
              highlightedComponents={highlightedComponents}
              width="100%"
              height={300}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              선택한 Scope에 따라 하이라이트됩니다
            </Typography>
          </Box>

          {/* 우측: 폼 필드 */}
          <Box sx={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {displayError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {displayError}
              </Alert>
            )}

            {/* Name */}
            <TextField
              label="Model Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              fullWidth
              required
              placeholder="모델 이름을 입력하세요"
              size="small"
            />

            {/* Description */}
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="모델 설명을 입력하세요"
              size="small"
            />

            {/* Analysis Codes */}
            <FormControl component="fieldset">
              <FormLabel
                component="legend"
                sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}
              >
                Analysis Codes (복수 선택 가능)
              </FormLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {ANALYSIS_CODE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    onClick={() => handleAnalysisCodeToggle(option.value)}
                    onDelete={
                      formData.analysisCodes.includes(option.value) &&
                      formData.analysisCodes.length > 1
                        ? () => handleAnalysisCodeToggle(option.value)
                        : undefined
                    }
                    sx={{
                      bgcolor: formData.analysisCodes.includes(option.value)
                        ? option.color
                        : 'grey.200',
                      color: formData.analysisCodes.includes(option.value)
                        ? 'white'
                        : 'text.primary',
                      fontWeight: 500,
                      '&:hover': {
                        bgcolor: formData.analysisCodes.includes(option.value)
                          ? option.color
                          : 'grey.300',
                      },
                      '& .MuiChip-deleteIcon': {
                        color: 'rgba(255,255,255,0.7)',
                        '&:hover': {
                          color: 'white',
                        },
                      },
                    }}
                  />
                ))}
              </Box>
            </FormControl>

            {/* Model Scope */}
            <FormControl component="fieldset">
              <FormLabel
                component="legend"
                sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}
              >
                Model Scope (담당 계통)
              </FormLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {SCOPE_OPTIONS.map((option) => {
                  const isSelected = formData.scope.systems.includes(option.value);
                  const isDisabled = !isSelected && existingScopes.includes(option.value);

                  return (
                    <Chip
                      key={option.value}
                      label={option.label}
                      onClick={() => !isDisabled && handleScopeToggle(option.value)}
                      onDelete={
                        isSelected ? () => handleScopeToggle(option.value) : undefined
                      }
                      disabled={isDisabled}
                      sx={{
                        bgcolor: isSelected
                          ? option.color
                          : isDisabled
                          ? 'grey.100'
                          : 'grey.200',
                        color: isSelected
                          ? 'white'
                          : isDisabled
                          ? 'text.disabled'
                          : 'text.primary',
                        fontWeight: 500,
                        '&:hover': {
                          bgcolor: isSelected
                            ? option.color
                            : isDisabled
                            ? 'grey.100'
                            : 'grey.300',
                        },
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(255,255,255,0.7)',
                          '&:hover': {
                            color: 'white',
                          },
                        },
                        opacity: isDisabled ? 0.6 : 1,
                      }}
                    />
                  );
                })}
              </Box>
              {existingScopes.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  * 비활성화된 스코프는 이미 다른 모델에서 사용 중입니다.
                </Typography>
              )}
            </FormControl>
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
          disabled={loading || !formData.name.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          CREATE
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewModelDialog;
