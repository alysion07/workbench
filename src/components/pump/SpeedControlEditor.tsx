/**
 * Speed Control Editor
 * PUMP 속도 제어 편집 컴포넌트
 *
 * MARS CCC6100 카드 구조:
 * - W1(I): Trip number (항상 트립 번호)
 * - W2(A): 검색변수 키워드 (optional, e.g., "cntrlvar", "time")
 * - W3(I): 검색변수 파라미터 (optional, default 0)
 * CCC6101~6199: (searchVariable, pumpSpeed) 테이블
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tooltip,
  Grid,
  Autocomplete,
  InputAdornment,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SortIcon from '@mui/icons-material/Sort';
import type { PumpSpeedControl } from '../../types/mars';
import { useStore } from '@/stores/useStore';

interface SpeedControlEditorProps {
  speedControl: PumpSpeedControl | undefined;
  onChange: (speedControl: PumpSpeedControl | undefined) => void;
}

/** 편집 중에는 로컬 문자열, blur 시 숫자 변환 */
function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const handleBlur = () => {
    setFocused(false);
    const num = parseFloat(text);
    if (!isNaN(num)) {
      onChange(num);
      setText(String(num));
    } else {
      setText(String(value));
    }
  };

  return (
    <TextField
      variant="standard"
      size="small"
      fullWidth
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      inputProps={{ style: { textAlign: 'right', fontSize: '0.875rem' } }}
      InputProps={{ disableUnderline: true }}
    />
  );
}

export function SpeedControlEditor({ speedControl, onChange }: SpeedControlEditorProps) {
  const { getGlobalSettings, openGlobalSettingsDialog } = useStore();
  const [enabled, setEnabled] = useState<boolean>(!!speedControl);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    !!(speedControl?.keyword)
  );

  // W1은 항상 트립 번호 → 항상 트립 목록을 보여줌
  const tripOptions = useMemo(() => {
    const settings = getGlobalSettings();
    const variableTrips = settings?.variableTrips || [];
    const logicTrips = settings?.logicTrips || [];
    return [
      { value: 0, label: '0 - No Trip (항상 속도 테이블 사용)', group: '' },
      ...variableTrips.map(t => ({
        value: t.cardNumber,
        label: `${t.cardNumber} - ${t.comment || t.leftVar}`,
        group: 'Variable Trip',
      })),
      ...logicTrips.map(t => ({
        value: t.cardNumber,
        label: `${t.cardNumber} - ${t.comment || 'Logic Trip'}`,
        group: 'Logic Trip',
      })),
    ];
  }, [getGlobalSettings]);

  // Enable/Disable 토글
  const handleToggleEnabled = () => {
    if (enabled) {
      setEnabled(false);
      onChange(undefined);
    } else {
      const defaultControl: PumpSpeedControl = {
        tripOrControl: 0,
        speedTable: [
          { searchVariable: 0.0, pumpSpeed: 0.0 },
          { searchVariable: 100.0, pumpSpeed: 0.0 },
        ],
      };
      setEnabled(true);
      onChange(defaultControl);
    }
  };

  // CCC6100 필드 업데이트
  const handleFieldChange = (field: keyof Omit<PumpSpeedControl, 'speedTable'>, value: any) => {
    if (!speedControl) return;

    onChange({
      ...speedControl,
      [field]: value,
    });
  };

  // 고급 검색변수 설정 제거
  const handleClearAdvanced = () => {
    if (!speedControl) return;
    const { keyword: _, parameter: __, ...rest } = speedControl;
    onChange({ ...rest, speedTable: speedControl.speedTable });
    setShowAdvanced(false);
  };

  // 테이블 셀 값 변경 (NumberCell의 onBlur에서 호출, 항상 유효한 숫자)
  const handleCellChange = (rowIdx: number, field: 'searchVariable' | 'pumpSpeed', value: number) => {
    if (!speedControl) return;
    const updatedTable = [...speedControl.speedTable];
    updatedTable[rowIdx] = { ...updatedTable[rowIdx], [field]: value };
    onChange({ ...speedControl, speedTable: updatedTable });
  };

  // Row 추가
  const handleAddRow = () => {
    if (!speedControl) return;
    const updatedTable = [...speedControl.speedTable, { searchVariable: 0.0, pumpSpeed: 0.0 }];
    onChange({ ...speedControl, speedTable: updatedTable });
  };

  // Row 삭제 (마지막 행 삭제)
  const handleDeleteRows = () => {
    if (!speedControl || speedControl.speedTable.length === 0) return;
    const updatedTable = speedControl.speedTable.slice(0, -1);
    onChange({
      ...speedControl,
      speedTable: updatedTable.length > 0 ? updatedTable : [{ searchVariable: 0.0, pumpSpeed: 0.0 }],
    });
  };

  // searchVariable 오름차순 정렬
  const handleSort = () => {
    if (!speedControl) return;
    const sortedTable = [...speedControl.speedTable].sort(
      (a, b) => a.searchVariable - b.searchVariable
    );
    onChange({ ...speedControl, speedTable: sortedTable });
  };

  // 컬럼 헤더 라벨
  const searchVarLabel = speedControl?.keyword
    ? `Search Variable (${speedControl.keyword}${speedControl.parameter ? ` ${speedControl.parameter}` : ''})`
    : 'Search Variable (time)';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Enable/Disable 버튼 */}
      <Box>
        <Button
          variant={enabled ? 'contained' : 'outlined'}
          color={enabled ? 'success' : 'primary'}
          onClick={handleToggleEnabled}
        >
          {enabled ? '속도 제어 활성화됨' : '속도 제어 활성화'}
        </Button>
      </Box>

      {enabled && speedControl && (
        <>
          {/* CCC6100: 제어 설정 */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                CCC6100 - 속도 제어 설정
              </Typography>
              <Grid container spacing={2}>
                {/* W1: Trip Number - 항상 트립 목록 */}
                <Grid item xs={12}>
                  <Autocomplete
                    freeSolo
                    fullWidth
                    options={tripOptions.map(o => o.value)}
                    value={speedControl.tripOrControl}
                    onChange={(_, newValue) => {
                      handleFieldChange('tripOrControl', typeof newValue === 'string' ? parseInt(newValue) || 0 : newValue ?? 0);
                    }}
                    onInputChange={(_, inputValue, reason) => {
                      if (reason === 'input') {
                        const num = parseInt(inputValue);
                        if (!isNaN(num)) handleFieldChange('tripOrControl', num);
                      }
                    }}
                    getOptionLabel={(option) => {
                      const found = tripOptions.find(o => o.value === option);
                      return found ? found.label : String(option);
                    }}
                    groupBy={(option) => {
                      const found = tripOptions.find(o => o.value === option);
                      return found?.group || '';
                    }}
                    renderOption={(props, option) => {
                      const found = tripOptions.find(o => o.value === option);
                      return (
                        <li {...props} key={option}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">{option}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {found ? found.label : String(option)}
                            </Typography>
                          </Box>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Trip Number (W1)"
                        helperText="0=항상 속도 테이블 사용, 비0=Trip ON일 때만 속도 테이블 사용"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {params.InputProps.endAdornment}
                              <InputAdornment position="end">
                                <Tooltip title="Variable Trips 설정">
                                  <IconButton size="small" onClick={() => openGlobalSettingsDialog(4)} edge="end">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* W2/W3: 검색변수 지정 (Optional, 고급 설정) */}
                <Grid item xs={12}>
                  <Button
                    size="small"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ mb: 1 }}
                  >
                    검색변수 지정 (고급)
                    {speedControl.keyword && (
                      <Typography variant="caption" sx={{ ml: 1, color: 'info.main' }}>
                        ({speedControl.keyword} {speedControl.parameter ?? 0})
                      </Typography>
                    )}
                  </Button>
                  <Collapse in={showAdvanced}>
                    <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        미설정 시 기본 검색변수 = time - trip time
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Keyword (W2)</InputLabel>
                            <Select
                              value={speedControl.keyword || ''}
                              label="Keyword (W2)"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  handleFieldChange('keyword', val);
                                } else {
                                  handleClearAdvanced();
                                }
                              }}
                            >
                              <MenuItem value="">
                                <em>(미사용 - 기본: time)</em>
                              </MenuItem>
                              <MenuItem value="time">time</MenuItem>
                              <MenuItem value="cntrlvar">cntrlvar</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            label="Parameter (W3)"
                            type="number"
                            size="small"
                            fullWidth
                            value={speedControl.parameter ?? 0}
                            onChange={(e) =>
                              handleFieldChange('parameter', Number(e.target.value))
                            }
                            disabled={!speedControl.keyword}
                            helperText={speedControl.keyword === 'cntrlvar' ? '제어변수 번호' : '변수 요청 코드 번호'}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* CCC6101~6199: 속도 테이블 */}
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                CCC6101~6199 - 시간 의존 펌프 속도 테이블
              </Typography>

              {/* 툴바 */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Tooltip title="행 추가">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddRow}
                  >
                    행 추가
                  </Button>
                </Tooltip>

                <Tooltip title="마지막 행 삭제">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDeleteRows}
                      disabled={!speedControl || speedControl.speedTable.length === 0}
                    >
                      마지막 행 삭제
                    </Button>
                  </span>
                </Tooltip>

                <Tooltip title="Search Variable 오름차순 정렬">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SortIcon />}
                    onClick={handleSort}
                  >
                    정렬
                  </Button>
                </Tooltip>
              </Box>

              {/* 테이블 */}
              <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" sx={{ width: 50, fontWeight: 'bold', bgcolor: 'grey.100', borderRight: 1, borderColor: 'divider' }}>#</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100', borderRight: 1, borderColor: 'divider' }}>{searchVarLabel}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Pump Speed (rad/s)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {speedControl.speedTable.map((row, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell align="center" sx={{ color: 'text.secondary', borderRight: 1, borderColor: 'divider' }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell align="right" sx={{ p: 0.5, borderRight: 1, borderColor: 'divider' }}>
                          <NumberCell
                            value={row.searchVariable}
                            onChange={(v) => handleCellChange(idx, 'searchVariable', v)}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ p: 0.5 }}>
                          <NumberCell
                            value={row.pumpSpeed}
                            onChange={(v) => handleCellChange(idx, 'pumpSpeed', v)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {!enabled && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          속도 제어가 비활성화되었습니다. 위 버튼을 클릭하여 활성화하세요.
        </Typography>
      )}
    </Box>
  );
}
