/**
 * MarsPartitionConfig Component
 * 개별 MARS 파티션의 Problem Type / Problem Option / Restart Source 설정
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { PartitionFormData, MARSConfig, MARSProblemType, MARSProblemOption } from '@/types/supabase';
import RestartSourceSelector from './RestartSourceSelector';

interface MarsPartitionConfigProps {
  partition: PartitionFormData;
  onChange: (updated: PartitionFormData) => void;
}

const DEFAULT_MARS_CONFIG: MARSConfig = {
  problemType: 'NEW',
  problemOption: 'TRANSNT',
};

const SCOPE_LABELS: Record<string, string> = {
  primary: 'Primary Loop',
  secondary: 'Second Loop',
  bop: 'BOP',
};

const SCOPE_COLORS: Record<string, string> = {
  primary: '#c62828',
  secondary: '#1565c0',
  bop: '#2e7d32',
};

const MarsPartitionConfig: React.FC<MarsPartitionConfigProps> = ({ partition, onChange }) => {
  const config = partition.marsConfig ?? DEFAULT_MARS_CONFIG;
  const isRestart = config.problemType === 'RESTART';

  const updateConfig = (updates: Partial<MARSConfig>) => {
    const newConfig: MARSConfig = { ...config, ...updates };

    if (updates.problemType === 'NEW') {
      delete newConfig.restartSource;
    }

    onChange({ ...partition, marsConfig: newConfig });
  };

  const handleProblemTypeChange = (_: React.MouseEvent, value: MARSProblemType | null) => {
    if (value && value !== config.problemType) updateConfig({ problemType: value });
  };

  const handleProblemOptionChange = (_: React.MouseEvent, value: MARSProblemOption | null) => {
    if (value && value !== config.problemOption) updateConfig({ problemOption: value });
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
        {/* 헤더: 파티션명 + 스코프 텍스트 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {partition.name || 'Unnamed Partition'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {partition.scope.map((s) => (
              <Typography
                key={s}
                variant="caption"
                sx={{
                  color: SCOPE_COLORS[s] ?? '#616161',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: SCOPE_COLORS[s] ?? '#9e9e9e',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {SCOPE_LABELS[s] ?? s}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Problem Type + Problem Option */}
        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
              Problem Type
            </Typography>
            <ToggleButtonGroup
              value={config.problemType}
              exclusive
              onChange={handleProblemTypeChange}
              size="small"
            >
              <ToggleButton value="NEW" sx={{ px: 2, textTransform: 'none' }}>
                NEW
              </ToggleButton>
              <ToggleButton value="RESTART" sx={{ px: 2, textTransform: 'none' }}>
                RESTART
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
              Problem Option
            </Typography>
            <ToggleButtonGroup
              value={config.problemOption}
              exclusive
              onChange={handleProblemOptionChange}
              size="small"
            >
              <ToggleButton value="STDY-ST" sx={{ px: 2, textTransform: 'none' }}>
                STDY-ST
              </ToggleButton>
              <ToggleButton value="TRANSNT" sx={{ px: 2, textTransform: 'none' }}>
                TRANSNT
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* RESTART Source (조건부 표시) */}
        <Collapse in={isRestart}>
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Restart Source
            </Typography>
            <RestartSourceSelector
              value={config.restartSource}
              onChange={(source) => updateConfig({ restartSource: source })}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              RESTART 모드에서는 비응축가스 종류/질량분율, 수력학적 시스템 설정을 에디터에서 변경할 수 없습니다.
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default MarsPartitionConfig;
