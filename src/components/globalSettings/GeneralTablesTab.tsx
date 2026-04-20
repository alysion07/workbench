/**
 * General Tables Tab
 * Cards 202TTTNN: General Tables (x-y lookup tables)
 * Referenced by FUNCTION-type Control Variables (w3 field) and Reactor Kinetics
 * Table 12.1-1: POWER, HTRNRATE, HTC-T, HTC-TEMP, TEMP, REAC-T, NORMAREA
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Alert,
  Grid,
  Tooltip,
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AddCircleOutline as AddRowIcon,
  RemoveCircleOutline as RemoveRowIcon,
} from '@mui/icons-material';
import type { GeneralTable, GeneralTableType, GeneralTableDataPoint, VariableTrip, LogicTrip } from '@/types/mars';
import { NumericTextField } from '@/components/common/NumericTextField';

// ─── 타입별 메타데이터 ───────────────────────────────────────────────

interface TableTypeMeta {
  label: string;
  description: string;
  defaultLabelX: string;
  defaultLabelY: string;
  /** 시간 기반: 'time', 온도 기반: 'temp', NORMAREA: 'norm' */
  factorGroup: 'time' | 'temp' | 'norm';
}

const TABLE_TYPE_META: Record<GeneralTableType, TableTypeMeta> = {
  'power':    { label: 'POWER',    description: '출력 vs 시간',            defaultLabelX: 'Time (s)',            defaultLabelY: 'Power (W)',           factorGroup: 'time' },
  'htrnrate': { label: 'HTRNRATE', description: '열유속 vs 시간',          defaultLabelX: 'Time (s)',            defaultLabelY: 'Heat Flux (W/m²)',    factorGroup: 'time' },
  'htc-t':    { label: 'HTC-T',    description: '열전달계수 vs 시간',      defaultLabelX: 'Time (s)',            defaultLabelY: 'HTC (W/m²·K)',       factorGroup: 'time' },
  'htc-temp': { label: 'HTC-TEMP', description: '열전달계수 vs 온도',      defaultLabelX: 'Temperature (K)',     defaultLabelY: 'HTC (W/m²·K)',       factorGroup: 'temp' },
  'temp':     { label: 'TEMP',     description: '온도 vs 시간',            defaultLabelX: 'Time (s)',            defaultLabelY: 'Temperature (K)',     factorGroup: 'temp' },
  'reac-t':   { label: 'REAC-T',   description: '범용 lookup (단위변환 방지)', defaultLabelX: 'X',               defaultLabelY: 'Y',                   factorGroup: 'time' },
  'normarea': { label: 'NORMAREA', description: '정규화 면적 vs stem 위치', defaultLabelX: 'Stem Position (0~1)', defaultLabelY: 'Norm. Area (0~1)',    factorGroup: 'norm' },
};

// ─── 컴포넌트 ─────────────────────────────────────────────────────────

interface TripOption {
  cardNumber: number;
  label: string;
  type: 'variable' | 'logic';
}

interface GeneralTablesTabProps {
  generalTables: GeneralTable[];
  variableTrips: VariableTrip[];
  logicTrips: LogicTrip[];
  onChange: (tables: GeneralTable[]) => void;
}

const DEFAULT_TABLE: GeneralTable = {
  tableNumber: 100,
  name: '',
  type: 'reac-t',
  dataPoints: [{ x: 0, y: 0 }],
};

export const GeneralTablesTab: React.FC<GeneralTablesTabProps> = ({
  generalTables,
  variableTrips,
  logicTrips,
  onChange,
}) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GeneralTable | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [error, setError] = useState<string>('');

  // Build trip options from Variable Trips + Logic Trips
  const tripOptions: TripOption[] = [
    ...variableTrips.map((t) => ({
      cardNumber: t.cardNumber,
      label: `${t.cardNumber} - ${t.comment || `${t.leftVar} ${t.relation} ${t.rightVar}`}`,
      type: 'variable' as const,
    })),
    ...logicTrips.map((t) => ({
      cardNumber: t.cardNumber,
      label: `${t.cardNumber} - Logic (${t.trip1} ${t.operator} ${t.trip2})`,
      type: 'logic' as const,
    })),
  ].sort((a, b) => a.cardNumber - b.cardNumber);

  // ─── Handlers ──────────────────────────────────

  const handleAdd = () => {
    const usedNumbers = new Set(generalTables.map(t => t.tableNumber));
    let nextNumber = 100;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }
    setEditingTable({ ...DEFAULT_TABLE, tableNumber: nextNumber });
    setEditingIndex(-1);
    setError('');
    setEditDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    const table = generalTables[index];
    setEditingTable({ ...table, dataPoints: table.dataPoints.map(dp => ({ ...dp })) });
    setEditingIndex(index);
    setError('');
    setEditDialogOpen(true);
  };

  const handleDelete = (index: number) => {
    const updated = generalTables.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleTypeChange = (newType: GeneralTableType) => {
    if (!editingTable) return;
    const meta = TABLE_TYPE_META[newType];
    const prevMeta = TABLE_TYPE_META[editingTable.type];
    // 타입 변경 시: 사용자가 기존 기본값을 수정하지 않았으면 새 기본값으로 교체
    const labelX = (!editingTable.labelX || editingTable.labelX === prevMeta.defaultLabelX)
      ? meta.defaultLabelX : editingTable.labelX;
    const labelY = (!editingTable.labelY || editingTable.labelY === prevMeta.defaultLabelY)
      ? meta.defaultLabelY : editingTable.labelY;
    setEditingTable({
      ...editingTable,
      type: newType,
      labelX,
      labelY,
      // factor group이 달라지면 factor 초기화
      ...(meta.factorGroup !== prevMeta.factorGroup
        ? { scaleX: undefined, scaleY: undefined, factor3: undefined }
        : {}),
    });
  };

  const handleDialogSave = () => {
    if (!editingTable) return;

    if (editingTable.tableNumber < 1 || editingTable.tableNumber > 999) {
      setError('테이블 번호는 1~999 범위여야 합니다.');
      return;
    }

    const isDuplicate = generalTables.some(
      (t, i) => t.tableNumber === editingTable.tableNumber && i !== editingIndex
    );
    if (isDuplicate) {
      setError(`테이블 번호 ${editingTable.tableNumber}이(가) 이미 존재합니다.`);
      return;
    }

    if (editingTable.dataPoints.length === 0) {
      setError('최소 1개의 데이터 포인트가 필요합니다.');
      return;
    }

    if (!editingTable.name.trim()) {
      setError('테이블 이름을 입력하세요.');
      return;
    }

    // power type requires trip number
    if (editingTable.type === 'power' && !editingTable.tripNumber) {
      setError('POWER 타입은 Trip 번호가 필수입니다.');
      return;
    }

    // NORMAREA validation: x,y must be 0~1
    if (editingTable.type === 'normarea') {
      const outOfRange = editingTable.dataPoints.some(
        dp => dp.x < 0 || dp.x > 1 || dp.y < 0 || dp.y > 1
      );
      if (outOfRange) {
        setError('NORMAREA 타입: X(stem position)와 Y(area) 값은 0~1 범위여야 합니다.');
        return;
      }
    }

    const updated = [...generalTables];
    if (editingIndex >= 0) {
      updated[editingIndex] = editingTable;
    } else {
      updated.push(editingTable);
    }

    updated.sort((a, b) => a.tableNumber - b.tableNumber);
    onChange(updated);
    setEditDialogOpen(false);
  };

  const handleDialogCancel = () => {
    setEditDialogOpen(false);
    setEditingTable(null);
  };

  // Data point operations
  const handleAddDataPoint = () => {
    if (!editingTable) return;
    const lastPoint = editingTable.dataPoints[editingTable.dataPoints.length - 1];
    setEditingTable({
      ...editingTable,
      dataPoints: [
        ...editingTable.dataPoints,
        { x: lastPoint ? lastPoint.x + 1 : 0, y: 0 },
      ],
    });
  };

  const handleRemoveDataPoint = (dpIndex: number) => {
    if (!editingTable || editingTable.dataPoints.length <= 1) return;
    setEditingTable({
      ...editingTable,
      dataPoints: editingTable.dataPoints.filter((_, i) => i !== dpIndex),
    });
  };

  const handleDataPointChange = (dpIndex: number, field: keyof GeneralTableDataPoint, value: number) => {
    if (!editingTable) return;
    const updated = editingTable.dataPoints.map((dp, i) =>
      i === dpIndex ? { ...dp, [field]: isNaN(value) ? dp[field] : value } : dp
    );
    setEditingTable({ ...editingTable, dataPoints: updated });
  };

  // Display helpers
  const getTripLabel = (tripNum: number | undefined) => {
    if (!tripNum) return '';
    return `Trip ${tripNum}`;
  };

  const getDisplayLabelX = (table: GeneralTable) =>
    table.labelX || TABLE_TYPE_META[table.type].defaultLabelX;

  const getDisplayLabelY = (table: GeneralTable) =>
    table.labelY || TABLE_TYPE_META[table.type].defaultLabelY;

  // ─── Factor UI 분기 렌더링 ─────────────────────

  const renderFactorFields = () => {
    if (!editingTable) return null;
    const meta = TABLE_TYPE_META[editingTable.type];

    switch (meta.factorGroup) {
      case 'time':
        // 시간 기반: W3 = time/argument factor
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <NumericTextField
                label="W3: Argument Factor"
                size="small"
                fullWidth
                value={editingTable.scaleX ?? 0}
                onChange={(num) =>
                  setEditingTable({ ...editingTable, scaleX: isNaN(num) ? undefined : num })
                }
                helperText="시간/argument 스케일 인수"
              />
            </Grid>
            <Grid item xs={6}>
              <NumericTextField
                label="W4: Function Factor"
                size="small"
                fullWidth
                value={editingTable.scaleY ?? 0}
                onChange={(num) =>
                  setEditingTable({ ...editingTable, scaleY: isNaN(num) ? undefined : num })
                }
                helperText="function 스케일 인수"
              />
            </Grid>
          </Grid>
        );

      case 'temp':
        // 온도 기반: W3=M(multiplier), W4=C(constant) for T=M·TX+C, W5=function factor
        return (
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <NumericTextField
                label="W3: Multiplier (M)"
                size="small"
                fullWidth
                value={editingTable.scaleX ?? 0}
                onChange={(num) =>
                  setEditingTable({ ...editingTable, scaleX: isNaN(num) ? undefined : num })
                }
                helperText="T = M·TX + C"
              />
            </Grid>
            <Grid item xs={4}>
              <NumericTextField
                label="W4: Constant (C)"
                size="small"
                fullWidth
                value={editingTable.scaleY ?? 0}
                onChange={(num) =>
                  setEditingTable({ ...editingTable, scaleY: isNaN(num) ? undefined : num })
                }
                helperText="온도 변환 상수"
              />
            </Grid>
            <Grid item xs={4}>
              <NumericTextField
                label="W5: Function Factor"
                size="small"
                fullWidth
                value={editingTable.factor3 ?? 0}
                onChange={(num) =>
                  setEditingTable({ ...editingTable, factor3: isNaN(num) ? undefined : num })
                }
                helperText="function 스케일 인수"
              />
            </Grid>
          </Grid>
        );

      case 'norm':
        // NORMAREA: W3-W5 factors (결과 0≤v≤1.0)
        return (
          <>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <NumericTextField
                  label="W3: Factor 1"
                  size="small"
                  fullWidth
                  value={editingTable.scaleX ?? 0}
                  onChange={(num) =>
                    setEditingTable({ ...editingTable, scaleX: isNaN(num) ? undefined : num })
                  }
                />
              </Grid>
              <Grid item xs={4}>
                <NumericTextField
                  label="W4: Factor 2"
                  size="small"
                  fullWidth
                  value={editingTable.scaleY ?? 0}
                  onChange={(num) =>
                    setEditingTable({ ...editingTable, scaleY: isNaN(num) ? undefined : num })
                  }
                />
              </Grid>
              <Grid item xs={4}>
                <NumericTextField
                  label="W5: Factor 3"
                  size="small"
                  fullWidth
                  value={editingTable.factor3 ?? 0}
                  onChange={(num) =>
                    setEditingTable({ ...editingTable, factor3: isNaN(num) ? undefined : num })
                  }
                />
              </Grid>
            </Grid>
            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              NORMAREA: factor 적용 후 normalized length와 area 결과값은 0 ≤ v ≤ 1.0이어야 합니다.
            </Alert>
          </>
        );

      default:
        return null;
    }
  };

  // ─── Render ────────────────────────────────────

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">General Tables (202TTTNN)</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} size="small">
          Add Table
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        x-y lookup 테이블. Control Variable (FUNCTION 타입)의 w3 필드 및 Reactor Kinetics에서 참조합니다.
      </Typography>

      {generalTables.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">등록된 General Table이 없습니다.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>GT #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>이름</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>타입</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Trip</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">데이터 포인트</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {generalTables.map((table, index) => (
                <TableRow key={`${table.tableNumber}-${index}`} hover>
                  <TableCell>
                    <Chip label={`GT${table.tableNumber}`} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{table.name || '-'}</TableCell>
                  <TableCell>
                    <Chip label={TABLE_TYPE_META[table.type]?.label ?? table.type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {table.tripNumber ? (
                      <Chip label={getTripLabel(table.tripNumber)} size="small" variant="outlined" color="secondary" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{table.dataPoints.length}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="편집">
                      <IconButton size="small" onClick={() => handleEdit(index)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제">
                      <IconButton size="small" color="error" onClick={() => handleDelete(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleDialogCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex >= 0 ? `General Table GT${editingTable?.tableNumber} 편집` : 'General Table 추가'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {editingTable && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {/* Basic info */}
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <TextField
                    label="테이블 번호 (TTT)"
                    type="number"
                    size="small"
                    fullWidth
                    value={editingTable.tableNumber}
                    onChange={(e) =>
                      setEditingTable({ ...editingTable, tableNumber: parseInt(e.target.value) || 0 })
                    }
                    inputProps={{ min: 1, max: 999 }}
                  />
                </Grid>
                <Grid item xs={8}>
                  <TextField
                    label="테이블 이름"
                    size="small"
                    fullWidth
                    value={editingTable.name}
                    onChange={(e) =>
                      setEditingTable({ ...editingTable, name: e.target.value })
                    }
                    placeholder="예: hot side liquid volume vs. Water Level"
                  />
                </Grid>
              </Grid>

              {/* Type + Trip */}
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>타입</InputLabel>
                    <Select
                      label="타입"
                      value={editingTable.type}
                      onChange={(e) => handleTypeChange(e.target.value as GeneralTableType)}
                    >
                      {(Object.entries(TABLE_TYPE_META) as [GeneralTableType, TableTypeMeta][]).map(
                        ([type, meta]) => (
                          <MenuItem key={type} value={type}>
                            {meta.label} ({meta.description})
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={8}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={tripOptions}
                    value={tripOptions.find(t => t.cardNumber === editingTable.tripNumber) ?? null}
                    onChange={(_, newValue) => {
                      if (newValue === null) {
                        setEditingTable({ ...editingTable, tripNumber: undefined });
                      } else if (typeof newValue === 'string') {
                        const num = parseInt(newValue);
                        setEditingTable({ ...editingTable, tripNumber: isNaN(num) ? undefined : num });
                      } else {
                        setEditingTable({ ...editingTable, tripNumber: newValue.cardNumber });
                      }
                    }}
                    onInputChange={(_, inputValue, reason) => {
                      if (reason === 'input') {
                        const num = parseInt(inputValue);
                        if (!isNaN(num)) {
                          setEditingTable({ ...editingTable, tripNumber: num });
                        } else if (inputValue === '') {
                          setEditingTable({ ...editingTable, tripNumber: undefined });
                        }
                      }
                    }}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      return option.label;
                    }}
                    renderOption={(props, option) => (
                      <li {...props} key={typeof option === 'string' ? option : option.cardNumber}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {typeof option === 'string' ? option : option.cardNumber}
                          </Typography>
                          {typeof option !== 'string' && (
                            <Typography variant="caption" color="text.secondary">
                              {option.type === 'variable' ? 'Variable' : 'Logic'}: {option.label.split(' - ')[1]}
                            </Typography>
                          )}
                        </Box>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={`Trip # ${editingTable.type === 'power' ? '(필수)' : '(선택)'}`}
                        required={editingTable.type === 'power'}
                        helperText={
                          tripOptions.length === 0
                            ? 'Variable/Logic Trip을 먼저 정의하세요'
                            : `${tripOptions.length}개 Trip 사용 가능 (401-799)`
                        }
                      />
                    )}
                    isOptionEqualToValue={(option, value) => {
                      if (typeof option === 'string' || typeof value === 'string') return false;
                      return option.cardNumber === value.cardNumber;
                    }}
                  />
                </Grid>
              </Grid>

              {/* Factor fields (타입별 분기) */}
              {renderFactorFields()}

              {/* X/Y Label (사용자 편집 가능) */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="X축 라벨 (주석용)"
                    size="small"
                    fullWidth
                    value={editingTable.labelX ?? TABLE_TYPE_META[editingTable.type].defaultLabelX}
                    onChange={(e) =>
                      setEditingTable({ ...editingTable, labelX: e.target.value })
                    }
                    placeholder={TABLE_TYPE_META[editingTable.type].defaultLabelX}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Y축 라벨 (주석용)"
                    size="small"
                    fullWidth
                    value={editingTable.labelY ?? TABLE_TYPE_META[editingTable.type].defaultLabelY}
                    onChange={(e) =>
                      setEditingTable({ ...editingTable, labelY: e.target.value })
                    }
                    placeholder={TABLE_TYPE_META[editingTable.type].defaultLabelY}
                  />
                </Grid>
              </Grid>

              {/* Data points */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">
                    데이터 포인트 ({editingTable.dataPoints.length}개)
                  </Typography>
                  <Button size="small" startIcon={<AddRowIcon />} onClick={handleAddDataPoint}>
                    행 추가
                  </Button>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 50, fontWeight: 'bold' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{getDisplayLabelX(editingTable)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>{getDisplayLabelY(editingTable)}</TableCell>
                        <TableCell sx={{ width: 50 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editingTable.dataPoints.map((dp, dpIdx) => (
                        <TableRow key={dpIdx}>
                          <TableCell>{dpIdx + 1}</TableCell>
                          <TableCell>
                            <NumericTextField
                              size="small"
                              value={dp.x}
                              onChange={(num) => handleDataPointChange(dpIdx, 'x', num)}
                              variant="standard"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <NumericTextField
                              size="small"
                              value={dp.y}
                              onChange={(num) => handleDataPointChange(dpIdx, 'y', num)}
                              variant="standard"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveDataPoint(dpIdx)}
                              disabled={editingTable.dataPoints.length <= 1}
                            >
                              <RemoveRowIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogCancel}>취소</Button>
          <Button onClick={handleDialogSave} variant="contained">
            {editingIndex >= 0 ? '저장' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
