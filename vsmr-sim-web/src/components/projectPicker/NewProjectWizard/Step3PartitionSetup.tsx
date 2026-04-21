/**
 * Step3PartitionSetup Component
 * Step 3: Partition 설정 (카드 리스트 + SVG with 색상/호버)
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { ReactorSystemSVG, ReactorComponentId } from '../index';
import PartitionCard from '../PartitionCard';
import type { SystemScope, PartitionFormData } from '@/types/supabase';
import type { WizardFormData } from './types';
import { SCOPE_LABELS, PARTITION_COLORS } from './types';

interface Step3PartitionSetupProps {
  data: WizardFormData;
  onChange: (data: Partial<WizardFormData>) => void;
}

// Scope를 ReactorComponentId로 매핑
const scopeToComponents: Record<SystemScope, ReactorComponentId[]> = {
  primary: ['reactor', 'steamGenerator'],
  secondary: ['turbine', 'condenser', 'feedwaterPump'],
  bop: ['coolingTower'],
};

// UUID 생성 헬퍼
const generateId = (): string =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// 초기 파티션 생성 (빈 scope로 시작)
const createInitialPartition = (): PartitionFormData => ({
  id: generateId(),
  name: '',
  analysisCode: 'MARS',
  description: '',
  scope: [],
});

const Step3PartitionSetup: React.FC<Step3PartitionSetupProps> = ({ data, onChange }) => {
  const [hoveredPartitionId, setHoveredPartitionId] = useState<string | null>(null);

  // 파티션에서 사용 중인 스코프 계산
  const usedScopes = useMemo(() => {
    const used = new Set<SystemScope>();
    data.partitions.forEach((p) => {
      p.scope.forEach((s) => used.add(s));
    });
    return used;
  }, [data.partitions]);

  // 미할당 스코프 계산
  const unassignedScopes = useMemo(() => {
    return data.scope.filter((s) => !usedScopes.has(s));
  }, [data.scope, usedScopes]);

  // 특정 파티션이 선택 가능한 스코프
  const getAvailableScopesForPartition = useCallback(
    (partitionId: string): SystemScope[] => {
      const otherUsedScopes = new Set<SystemScope>();
      data.partitions.forEach((p) => {
        if (p.id !== partitionId) {
          p.scope.forEach((s) => otherUsedScopes.add(s));
        }
      });
      return data.scope.filter((s) => !otherUsedScopes.has(s));
    },
    [data.partitions, data.scope]
  );

  // SVG 하이라이트 컴포넌트 계산 (호버 또는 전체)
  const highlightedComponents = useMemo(() => {
    const components: ReactorComponentId[] = [];

    if (hoveredPartitionId) {
      // 호버된 파티션의 스코프만 하이라이트
      const hoveredPartition = data.partitions.find((p) => p.id === hoveredPartitionId);
      if (hoveredPartition) {
        hoveredPartition.scope.forEach((s) => {
          components.push(...scopeToComponents[s]);
        });
      }
    } else {
      // 모든 파티션의 스코프 하이라이트
      data.partitions.forEach((p) => {
        p.scope.forEach((s) => {
          components.push(...scopeToComponents[s]);
        });
      });
    }

    return components;
  }, [data.partitions, hoveredPartitionId]);

  // 파티션 추가
  const handleAddPartition = () => {
    const newPartition = createInitialPartition();
    onChange({ partitions: [...data.partitions, newPartition] });
  };

  // 파티션 수정
  const handleUpdatePartition = (updated: PartitionFormData) => {
    onChange({
      partitions: data.partitions.map((p) => (p.id === updated.id ? updated : p)),
    });
  };

  // 파티션 삭제
  const handleDeletePartition = (partitionId: string) => {
    onChange({
      partitions: data.partitions.filter((p) => p.id !== partitionId),
    });
  };

  // Partition 색상 가져오기
  const getPartitionColor = (index: number) => {
    return PARTITION_COLORS[index % PARTITION_COLORS.length];
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
          justifyContent: 'flex-start',
          bgcolor: 'grey.50',
          borderRadius: 2,
          p: 1.5,
        }}
      >
        <ReactorSystemSVG
          highlightedComponents={highlightedComponents}
          width="100%"
          height={220}
        />

        {/* Partition 범례 */}
        {data.partitions.length > 0 && (
          <Box sx={{ mt: 2, width: '100%' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Partition 범례
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {data.partitions.map((partition, index) => {
                const color = getPartitionColor(index);
                return (
                  <Box
                    key={partition.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: hoveredPartitionId === partition.id ? color.bg : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={() => setHoveredPartitionId(partition.id)}
                    onMouseLeave={() => setHoveredPartitionId(null)}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: 0.5,
                        bgcolor: color.color,
                      }}
                    />
                    <Typography variant="caption">
                      {partition.name || `Partition ${index + 1}`}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          Partition 카드에 마우스를 올리면 해당 영역이 하이라이트됩니다
        </Typography>
      </Box>

      {/* 우측: Partition 설정 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 1,
          overflow: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Project Partition
          </Typography>
          <Button
            size="small"
            onClick={handleAddPartition}
            startIcon={<AddIcon />}
            variant="outlined"
          >
            추가
          </Button>
        </Box>

        {/* Partition 카드 목록 */}
        {data.partitions.length === 0 ? (
          <Box
            sx={{
              p: 4,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Partition(모델)을 추가하세요
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              각 Partition은 선택한 Scope의 일부를 담당합니다
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddPartition}>
              Partition 추가
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data.partitions.map((partition, index) => (
              <Box
                key={partition.id}
                onMouseEnter={() => setHoveredPartitionId(partition.id)}
                onMouseLeave={() => setHoveredPartitionId(null)}
                sx={{
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: -8,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    borderRadius: 1,
                    bgcolor: getPartitionColor(index).color,
                  },
                }}
              >
                <PartitionCard
                  partition={partition}
                  availableScopes={getAvailableScopesForPartition(partition.id)}
                  onChange={handleUpdatePartition}
                  onDelete={() => handleDeletePartition(partition.id)}
                  canDelete={data.partitions.length > 1}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* 미할당 스코프 경고 */}
        {unassignedScopes.length > 0 && data.partitions.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            미할당 Scope: {unassignedScopes.map((s) => SCOPE_LABELS[s]).join(', ')}
          </Alert>
        )}

        {/* 파티션 없음 경고 */}
        {data.partitions.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            최소 1개 이상의 Partition을 추가해주세요.
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default Step3PartitionSetup;
