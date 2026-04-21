/**
 * PartitionCard Component
 * 프로젝트 생성 시 개별 파티션(모델) 설정 카드
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { PartitionFormData, SystemScope, AnalysisCode } from '@/types/supabase';

interface PartitionCardProps {
  partition: PartitionFormData;
  availableScopes: SystemScope[];  // 선택 가능한 스코프 (다른 파티션에서 사용 중이지 않은)
  onChange: (updated: PartitionFormData) => void;
  onDelete: () => void;
  canDelete: boolean;  // 삭제 가능 여부 (최소 1개는 유지)
}

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

const ANALYSIS_CODES: AnalysisCode[] = ['MARS', 'SPHINCS', 'Modelica'];

const PartitionCard: React.FC<PartitionCardProps> = ({
  partition,
  availableScopes,
  onChange,
  onDelete,
  canDelete,
}) => {
  // 현재 선택된 스코프 + 다른 곳에서 사용 가능한 스코프
  const selectableScopes = [...new Set([...partition.scope, ...availableScopes])];

  const handleScopeToggle = (scope: SystemScope) => {
    const newScope = partition.scope.includes(scope)
      ? partition.scope.filter((s) => s !== scope)
      : [...partition.scope, scope];

    onChange({ ...partition, scope: newScope });
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: 'divider',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        {/* 상단: Name + Analysis Code + Delete */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          {/* Name */}
          <TextField
            label="NAME"
            value={partition.name}
            onChange={(e) => onChange({ ...partition, name: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
            required
          />

          {/* Analysis Code */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Analysis Code</InputLabel>
            <Select
              value={partition.analysisCode}
              label="Analysis Code"
              onChange={(e) =>
                onChange({ ...partition, analysisCode: e.target.value as AnalysisCode })
              }
            >
              {ANALYSIS_CODES.map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Delete Button */}
          <IconButton
            onClick={onDelete}
            disabled={!canDelete}
            size="small"
            color="error"
            sx={{ mt: 0.5 }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>

        {/* Description */}
        <TextField
          label="Description"
          value={partition.description || ''}
          onChange={(e) => onChange({ ...partition, description: e.target.value })}
          size="small"
          fullWidth
          placeholder="Placeholder"
          sx={{ mb: 2 }}
        />

        {/* Model Scope */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Model Scope
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {selectableScopes.map((scope) => {
              const isSelected = partition.scope.includes(scope);
              const isAvailable = availableScopes.includes(scope) || isSelected;

              const scopeColor = SCOPE_COLORS[scope];
              return (
                <Chip
                  key={scope}
                  label={SCOPE_LABELS[scope]}
                  onClick={() => isAvailable && handleScopeToggle(scope)}
                  onDelete={isSelected ? () => handleScopeToggle(scope) : undefined}
                  variant={isSelected ? 'filled' : 'outlined'}
                  size="small"
                  disabled={!isAvailable}
                  sx={{
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
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
      </CardContent>
    </Card>
  );
};

export default PartitionCard;
