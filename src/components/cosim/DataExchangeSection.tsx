/**
 * DataExchangeSection — Tab 2: 데이터 교환 설정
 * Model 1 write/read_data_name 드롭다운 → Model 2 자동 반전
 */

import {
  Box, Typography, TextField, MenuItem, Divider,
} from '@mui/material';
import { SwapVert as SwapIcon } from '@mui/icons-material';
import { useCoSimConfigStore, getWriteVariable } from '@/stores/coSimConfigStore';
import { PRECICE_DATA_OPTIONS } from '@/types/cosim';
import type { PreciceDataName } from '@/types/cosim';

export default function DataExchangeSection() {
  const { config, setModel1DataNames, setModel1InitWdata, setModel2InitWdata } = useCoSimConfigStore();
  const { model1, model2 } = config.nml;

  const handleWriteChange = (write: PreciceDataName) => {
    const read: PreciceDataName = write === 'T_WALL' ? 'Q_WALL' : 'T_WALL';
    setModel1DataNames(write, read);
  };

  const handleReadChange = (read: PreciceDataName) => {
    const write: PreciceDataName = read === 'T_WALL' ? 'Q_WALL' : 'T_WALL';
    setModel1DataNames(write, read);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2 }}>
      {/* Model 1 */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Model 1</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            select
            label="write_data_name"
            size="small"
            fullWidth
            value={model1.writeDataName}
            onChange={(e) => handleWriteChange(e.target.value as PreciceDataName)}
          >
            {PRECICE_DATA_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="read_data_name"
            size="small"
            fullWidth
            value={model1.readDataName}
            onChange={(e) => handleReadChange(e.target.value as PreciceDataName)}
          >
            {PRECICE_DATA_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          {model1.writeDataName && (
            <Typography variant="caption" color="text.secondary">
              → write_variable: <strong>{getWriteVariable(model1.writeDataName)}</strong> (자동)
            </Typography>
          )}
          <TextField
            label="init_wdata (선택)"
            size="small"
            fullWidth
            value={model1.initWdata ?? ''}
            onChange={(e) => setModel1InitWdata(e.target.value || undefined)}
            placeholder="예: 560.d0"
          />
        </Box>
      </Box>

      {/* 반전 표시 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Divider sx={{ flex: 1 }} />
        <SwapIcon color="action" fontSize="small" />
        <Typography variant="caption" color="text.secondary">자동 반전</Typography>
        <Divider sx={{ flex: 1 }} />
      </Box>

      {/* Model 2 */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Model 2</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="write_data_name"
            size="small"
            fullWidth
            value={model2.writeDataName}
            disabled
            helperText="Model 1 설정에서 자동 결정"
          />
          <TextField
            label="read_data_name"
            size="small"
            fullWidth
            value={model2.readDataName}
            disabled
            helperText="Model 1 설정에서 자동 결정"
          />
          {model2.writeDataName && (
            <Typography variant="caption" color="text.secondary">
              → write_variable: <strong>{getWriteVariable(model2.writeDataName)}</strong> (자동)
            </Typography>
          )}
          <TextField
            label="init_wdata (선택)"
            size="small"
            fullWidth
            value={model2.initWdata ?? ''}
            onChange={(e) => setModel2InitWdata(e.target.value || undefined)}
            placeholder="예: 560.d0"
          />
        </Box>
      </Box>
    </Box>
  );
}
