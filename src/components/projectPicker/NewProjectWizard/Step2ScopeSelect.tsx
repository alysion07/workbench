/**
 * Step2ScopeSelect Component
 * Step 2: Project Scope 선택 (토글 Chip + SVG Preview)
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { ReactorSystemSVG, ReactorComponentId } from '../index';
import type { SystemScope } from '@/types/supabase';
import type { WizardFormData } from './types';
import { ALL_SCOPES, SCOPE_LABELS, SCOPE_COLORS } from './types';

interface Step2ScopeSelectProps {
  data: WizardFormData;
  onChange: (data: Partial<WizardFormData>) => void;
}

// Scope를 ReactorComponentId로 매핑
const scopeToComponents: Record<SystemScope, ReactorComponentId[]> = {
  primary: ['reactor', 'steamGenerator'],
  secondary: ['turbine', 'condenser', 'feedwaterPump'],
  bop: ['coolingTower'],
};

const Step2ScopeSelect: React.FC<Step2ScopeSelectProps> = ({ data, onChange }) => {
  // Scope에 따른 하이라이트 컴포넌트
  const highlightedComponents = useMemo(() => {
    const components: ReactorComponentId[] = [];
    data.scope.forEach((s) => {
      components.push(...scopeToComponents[s]);
    });
    return components;
  }, [data.scope]);

  // Scope 토글
  const handleScopeToggle = (scope: SystemScope) => {
    const isSelected = data.scope.includes(scope);
    let newScope: SystemScope[];

    if (isSelected) {
      // 제거 시: 파티션에서 해당 스코프도 제거
      newScope = data.scope.filter((s) => s !== scope);
      const updatedPartitions = data.partitions.map((p) => ({
        ...p,
        scope: p.scope.filter((s) => s !== scope),
      }));
      onChange({ scope: newScope, partitions: updatedPartitions });
    } else {
      // 추가
      newScope = [...data.scope, scope];
      onChange({ scope: newScope });
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        height: '100%',
        minHeight: 320,
      }}
    >
      {/* 좌측: SVG Preview */}
      <Box
        sx={{
          flex: '0 0 40%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          borderRadius: 2,
          p: 1.5,
        }}
      >
        <ReactorSystemSVG
          highlightedComponents={highlightedComponents}
          width="100%"
          height={240}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          선택한 Scope가 하이라이트됩니다
        </Typography>
      </Box>

      {/* 우측: Scope 선택 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Project Scope
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          프로젝트에서 다룰 시스템 범위를 선택하세요.
          <br />
          선택한 Scope 내에서 Partition을 구성할 수 있습니다.
        </Typography>

        {/* Scope 토글 Chips */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ALL_SCOPES.map((scope) => {
            const isSelected = data.scope.includes(scope);
            const scopeColor = SCOPE_COLORS[scope];

            return (
              <Chip
                key={scope}
                label={SCOPE_LABELS[scope]}
                onClick={() => handleScopeToggle(scope)}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  height: 48,
                  fontSize: '1rem',
                  fontWeight: 500,
                  justifyContent: 'flex-start',
                  px: 2,
                  transition: 'all 0.2s ease',
                  ...(isSelected
                    ? {
                        bgcolor: scopeColor.bg,
                        color: scopeColor.color,
                        borderColor: scopeColor.border,
                        border: `2px solid ${scopeColor.border}`,
                        '&:hover': {
                          bgcolor: scopeColor.bg,
                          filter: 'brightness(0.95)',
                        },
                      }
                    : {
                        borderColor: 'grey.300',
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: scopeColor.border,
                          bgcolor: `${scopeColor.bg}40`,
                        },
                      }),
                }}
              />
            );
          })}
        </Box>

        {/* 선택된 Scope 요약 */}
        {data.scope.length > 0 && (
          <Box sx={{ mt: 'auto', pt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              선택된 Scope: {data.scope.map((s) => SCOPE_LABELS[s]).join(', ')}
            </Typography>
          </Box>
        )}

        {data.scope.length === 0 && (
          <Box sx={{ mt: 'auto', pt: 3 }}>
            <Typography variant="caption" color="warning.main">
              최소 1개 이상의 Scope를 선택해주세요.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Step2ScopeSelect;
