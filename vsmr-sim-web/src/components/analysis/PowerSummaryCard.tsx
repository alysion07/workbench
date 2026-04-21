/**
 * PowerSummaryCard
 * 원자로 출력(rktpow) 요약 카드
 */

import { useMemo } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { BoltOutlined as PowerIcon } from '@mui/icons-material';
import { useFilteredData } from '@/stores/analysisStore';
import { useAnalysisStore } from '@/stores/analysisStore';

function formatPower(watts: number): string {
  if (watts >= 1e9) return `${(watts / 1e9).toFixed(2)} GW`;
  if (watts >= 1e6) return `${(watts / 1e6).toFixed(2)} MW`;
  if (watts >= 1e3) return `${(watts / 1e3).toFixed(2)} kW`;
  return `${watts.toFixed(2)} W`;
}

export default function PowerSummaryCard() {
  const parsedVariables = useAnalysisStore((s) => s.parsedFile?.variables);
  const modelResults = useAnalysisStore((s) => s.modelResults);
  const data = useFilteredData();

  // rktpow 조회 키 결정:
  // - 단일 파일: parsedFile.variables의 rktpow dataKey
  // - Co-Sim: 첫 모델의 rktpow를 "<modelId>::<dataKey>"로 네임스페이스화
  const { rktpowKey, modelLabel } = useMemo(() => {
    if (parsedVariables) {
      const v = parsedVariables.find((x) => x.type === 'rktpow');
      return { rktpowKey: v?.dataKey, modelLabel: undefined as string | undefined };
    }
    if (modelResults) {
      for (const [modelId, r] of Object.entries(modelResults)) {
        const v = r.parsed.variables.find((x) => x.type === 'rktpow');
        if (v) return { rktpowKey: `${modelId}::${v.dataKey}`, modelLabel: r.label };
      }
    }
    return { rktpowKey: undefined, modelLabel: undefined };
  }, [parsedVariables, modelResults]);

  const { current, min, max } = useMemo(() => {
    if (!rktpowKey || data.length === 0) {
      return { current: null, min: null, max: null };
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    let lastVal = 0;

    for (const row of data) {
      const v = row[rktpowKey];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
      lastVal = v;
    }

    return { current: lastVal, min: minVal, max: maxVal };
  }, [data, rktpowKey]);

  if (!rktpowKey || current === null) return null;

  return (
    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 1.5,
          backgroundColor: 'warning.light',
          color: 'warning.contrastText',
        }}
      >
        <PowerIcon />
      </Box>

      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {modelLabel ? `원자로 출력 · ${modelLabel}` : '원자로 출력'}
        </Typography>
        <Typography variant="h6" fontWeight={700} color="primary.main">
          {formatPower(current)}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Min: {formatPower(min!)}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Max: {formatPower(max!)}
        </Typography>
      </Box>
    </Paper>
  );
}
