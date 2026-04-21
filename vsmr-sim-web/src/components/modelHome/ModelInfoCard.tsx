/**
 * ModelInfoCard Component
 * MDH-001: 모델 정보를 표시하는 카드 컴포넌트
 *
 * - 모델명, 분석코드(칩), 설명, 스코프, 생성/수정 일시 표시
 * - EDIT 버튼으로 에디터 이동
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  Update as UpdateIcon,
  Category as CategoryIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { Model, AnalysisCode, SystemScope } from '@/types/supabase';

interface ModelInfoCardProps {
  model: Model;
  onEdit: () => void;
  onSimulation?: () => void;
  onSettings?: () => void;
}

// 분석 코드별 색상
const analysisCodeColors: Record<AnalysisCode, { bg: string; color: string }> = {
  MARS: { bg: '#e3f2fd', color: '#1565c0' },
  SPHINCS: { bg: '#f3e5f5', color: '#7b1fa2' },
  Modelica: { bg: '#e8f5e9', color: '#2e7d32' },
};

// Scope별 라벨 및 색상 정의
const scopeConfig: Record<SystemScope, { label: string; bg: string; color: string }> = {
  primary: { label: 'Primary Loop', bg: '#ffebee', color: '#c62828' },
  secondary: { label: 'Secondary Loop', bg: '#e3f2fd', color: '#1565c0' },
  bop: { label: 'BOP', bg: '#e8f5e9', color: '#2e7d32' },
};

// 날짜 포맷팅
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ModelInfoCard: React.FC<ModelInfoCardProps> = ({
  model,
  onEdit,
  onSimulation,
  onSettings,
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        boxShadow: 2,
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 헤더: 모델명 + EDIT 버튼 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Typography variant="h5" fontWeight={600} sx={{ flex: 1, pr: 2 }}>
            {model.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={onSimulation}
              size="small"
              disabled={!onSimulation}
              sx={{ textTransform: 'none' }}
            >
              SIMULATION
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onEdit}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              EDIT
            </Button>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={onSettings}
              size="small"
              disabled={!onSettings}
              sx={{ textTransform: 'none', minWidth: 'auto', px: 1 }}
            >
              SETTING
            </Button>
          </Box>
        </Box>

        {/* 분석 코드 칩 */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5, display: 'block' }}
          >
            Analysis Codes
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {model.analysisCodes.map((code) => (
              <Chip
                key={code}
                label={code}
                size="small"
                sx={{
                  bgcolor: analysisCodeColors[code]?.bg || '#f5f5f5',
                  color: analysisCodeColors[code]?.color || '#666',
                  fontWeight: 500,
                }}
              />
            ))}
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 설명 */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5, display: 'block' }}
          >
            Description
          </Typography>
          <Typography variant="body2" color="text.primary">
            {model.description || 'No description provided.'}
          </Typography>
        </Box>

        {/* 스코프 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CategoryIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Scope
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {model.scope?.systems?.map((scope) => {
              const config = scopeConfig[scope];
              return (
                <Chip
                  key={scope}
                  label={config?.label || scope}
                  size="small"
                  sx={{
                    bgcolor: config?.bg || '#f5f5f5',
                    color: config?.color || '#666',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              );
            })}
            {(!model.scope?.systems || model.scope.systems.length === 0) && (
              <Typography variant="body2" color="text.secondary">
                Not specified
              </Typography>
            )}
          </Stack>
        </Box>

        {/* 하단: 생성/수정 일시 */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Created: {formatDateTime(model.created_at)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <UpdateIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Updated: {formatDateTime(model.updated_at)}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ModelInfoCard;
