/**
 * XmlConfigSection — Tab 3: 프로젝트 설정 (XML)
 * Coupling scheme, max-time, time-window-size, mapping
 * NML 완료 시에만 활성화
 */

import {
  Box, TextField, MenuItem, Alert,
} from '@mui/material';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import { COUPLING_SCHEME_OPTIONS, MAPPING_TYPE_OPTIONS } from '@/types/cosim';
import type { CouplingSchemeType, MappingType } from '@/types/cosim';

export default function XmlConfigSection() {
  const { config, setSchemeType, setMaxTime, setTimeWindowSize, setMappingType, getValidation } = useCoSimConfigStore();
  const { isNmlComplete } = getValidation();
  const { xml } = config;

  if (!isNmlComplete) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          커플링 경계면과 데이터 교환 설정을 먼저 완료해주세요.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <TextField
        select
        label="Coupling Scheme"
        size="small"
        fullWidth
        value={xml.schemeType}
        onChange={(e) => setSchemeType(e.target.value as CouplingSchemeType)}
      >
        {COUPLING_SCHEME_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      <TextField
        label="max-time"
        size="small"
        fullWidth
        type="number"
        value={xml.maxTime}
        onChange={(e) => setMaxTime(parseFloat(e.target.value) || 0)}
        inputProps={{ min: 0, step: 1 }}
        helperText="전체 시뮬레이션 시간"
      />

      <TextField
        label="time-window-size"
        size="small"
        fullWidth
        type="number"
        value={xml.timeWindowSize}
        onChange={(e) => setTimeWindowSize(parseFloat(e.target.value) || 0)}
        inputProps={{ min: 0, step: 0.1 }}
        helperText="커플링 교환 주기"
      />

      <TextField
        select
        label="Mapping 방식"
        size="small"
        fullWidth
        value={xml.mappingType}
        onChange={(e) => setMappingType(e.target.value as MappingType)}
      >
        {MAPPING_TYPE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>

      {xml.schemeType.includes('implicit') && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Implicit scheme: max-iterations=100, convergence=relative 1e-4 (고정)
        </Alert>
      )}
    </Box>
  );
}
