/**
 * Step4MarsConfig Component
 * Step 4: MARS 파티션별 Problem Type/Option 및 RESTART 소스 설정
 */

import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { WizardFormData } from './types';
import type { PartitionFormData } from '@/types/supabase';
import MarsPartitionConfig from './MarsPartitionConfig';

interface Step4MarsConfigProps {
  data: WizardFormData;
  onChange: (data: Partial<WizardFormData>) => void;
}

const Step4MarsConfig: React.FC<Step4MarsConfigProps> = ({ data, onChange }) => {
  const marsPartitions = useMemo(() => {
    return data.partitions.filter((p) => p.analysisCode === 'MARS');
  }, [data.partitions]);

  const handlePartitionChange = (updated: PartitionFormData) => {
    onChange({
      partitions: data.partitions.map((p) => (p.id === updated.id ? updated : p)),
    });
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
        MARS Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        각 MARS 파티션의 해석 유형과 옵션을 설정합니다.
      </Typography>

      {marsPartitions.map((partition) => (
        <MarsPartitionConfig
          key={partition.id}
          partition={partition}
          onChange={handlePartitionChange}
        />
      ))}
    </Box>
  );
};

export default Step4MarsConfig;
