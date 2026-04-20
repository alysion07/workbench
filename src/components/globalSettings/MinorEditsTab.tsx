/**
 * Minor Edits Tab
 * Cards 301-399 (단축형), 20800001+ (확장형): Minor edit definitions
 * 사용자는 변수만 추가하면 카드번호가 자동 할당됨
 */

import { useState, useEffect, useMemo } from 'react';
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
  Autocomplete,
  Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { MinorEdit, MinorEditVariableType, ControlVariable } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import { formatNumber } from '@/utils/formatNumber';

interface MinorEditsTabProps {
  minorEdits: MinorEdit[];
  controlVariables?: ControlVariable[];
  onChange: (minorEdits: MinorEdit[]) => void;
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  edit: MinorEdit;
}

const emptyMinorEdit: MinorEdit = {
  cardNumber: 301,
  variableType: 'p',
  parameter: '0',
  lowerLimit: 0.0,
  upperLimit: 1.0e6,
  editGroup: 1,
  editPriority: 1,
  comment: ''
};

/**
 * Format limit value for display
 * Shows scientific notation for large/small numbers, regular format otherwise
 */
const formatLimitValue = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) return '';
  // Use scientific notation for very large or very small numbers
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-3 && value !== 0)) {
    return formatNumber(value);
  }
  // For regular numbers, show as-is
  return value.toString();
};

export const MinorEditsTab: React.FC<MinorEditsTabProps> = ({
  minorEdits,
  controlVariables = [],
  onChange
}) => {
  const { nodes } = useStore();
  
  // Generate available IDs (same format as SystemConfigTab)
  const availableVolumeIds = useMemo(() => {
    const volumeIds: Array<{ volumeId: string; label: string; componentName: string }> = [];
    
    nodes.forEach(node => {
      const compId = node.data.componentId;
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;
      const shortId = compId.slice(0, 3); // Extract first 3 digits (e.g., "100" from "1000000")
      
      if (compType === 'snglvol' || compType === 'tmdpvol') {
        // Single volume components: Volume 01, Center (0000)
        const volumeId = `${shortId}010000`;
        volumeIds.push({
          volumeId,
          label: `${volumeId} (${compName}, Volume 01, Center)`,
          componentName: compName
        });
      } else if (compType === 'pipe') {
        // PIPE components: generate volume IDs for all cells
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells; i++) {
            const volNum = i.toString().padStart(2, '0'); // "01", "02", ...
            const volumeId = `${shortId}${volNum}0000`;
            volumeIds.push({
              volumeId,
              label: `${volumeId} (${compName}, Volume ${volNum}, Center)`,
              componentName: compName
            });
          }
        }
      }
    });
    
    return volumeIds;
  }, [nodes]);
  
  const availableJunctionIds = useMemo(() => {
    const junctionIds: Array<{ junctionId: string; label: string; componentName: string }> = [];
    
    nodes.forEach(node => {
      const compId = node.data.componentId;
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;
      const shortId = compId.slice(0, 3);
      
      if (compType === 'sngljun') {
        // SNGLJUN: two junctions (inlet=1, outlet=2)
        const inletId = `${shortId}010001`;  // CCCVV0001
        const outletId = `${shortId}010002`;  // CCCVV0002
        junctionIds.push({
          junctionId: inletId,
          label: `${inletId} (${compName}, Inlet)`,
          componentName: compName
        });
        junctionIds.push({
          junctionId: outletId,
          label: `${outletId} (${compName}, Outlet)`,
          componentName: compName
        });
      } else if (compType === 'tmdpjun') {
        // TMDPJUN: similar to SNGLJUN
        const inletId = `${shortId}010001`;  // CCCVV0001
        const outletId = `${shortId}010002`;  // CCCVV0002
        junctionIds.push({
          junctionId: inletId,
          label: `${inletId} (${compName}, Inlet)`,
          componentName: compName
        });
        junctionIds.push({
          junctionId: outletId,
          label: `${outletId} (${compName}, Outlet)`,
          componentName: compName
        });
      } else if (compType === 'pipe') {
        // PIPE: generate junction IDs for all junctions
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          // PIPE has ncells+1 junctions
          for (let i = 1; i <= ncells + 1; i++) {
            const junctionNum = Math.min(i, 6); // Junction number capped at 6
            const volNum = i <= ncells ? i.toString().padStart(2, '0') : ncells.toString().padStart(2, '0');
            const junctionId = `${shortId}${volNum}000${junctionNum}`;
            junctionIds.push({
              junctionId,
              label: `${junctionId} (${compName}, Junction ${junctionNum})`,
              componentName: compName
            });
          }
        }
      }
    });
    
    return junctionIds;
  }, [nodes]);
  
  const [dialog, setDialog] = useState<EditDialogState>({
    open: false,
    mode: 'add',
    index: -1,
    edit: { ...emptyMinorEdit }
  });
  
  const [parameterError, setParameterError] = useState<string>('');
  const [lowerLimitInput, setLowerLimitInput] = useState<string>('');
  const [upperLimitInput, setUpperLimitInput] = useState<string>('');
  
  // Sync input values when dialog opens (only on open, not on value changes)
  useEffect(() => {
    if (dialog.open) {
      // Only set initial values when dialog first opens
      // Use a ref to track if we've already initialized
      const lowerVal = dialog.edit.lowerLimit ?? 0;
      const upperVal = dialog.edit.upperLimit ?? 1e6;
      const lowerStr = lowerVal.toString();
      const upperStr = upperVal.toString();

      // Check if values are large enough to use scientific notation
      const lowerFormatted = (Math.abs(lowerVal) >= 1e6 || (Math.abs(lowerVal) < 1e-3 && lowerVal !== 0))
        ? formatNumber(lowerVal)
        : lowerStr;
      const upperFormatted = (Math.abs(upperVal) >= 1e6 || (Math.abs(upperVal) < 1e-3 && upperVal !== 0))
        ? formatNumber(upperVal)
        : upperStr;
      
      setLowerLimitInput(lowerFormatted);
      setUpperLimitInput(upperFormatted);
    } else {
      // Reset when dialog closes
      setLowerLimitInput('');
      setUpperLimitInput('');
    }
  }, [dialog.open]); // Only depend on dialog.open, not on the limit values
  
  // Memoized sets for quick lookup
  const availableVolumeIdsSet = useMemo(
    () => new Set(availableVolumeIds.map(v => v.volumeId)),
    [availableVolumeIds]
  );
  
  const availableJunctionIdsSet = useMemo(
    () => new Set(availableJunctionIds.map(j => j.junctionId)),
    [availableJunctionIds]
  );
  
  // Validate parameter based on variable type
  useEffect(() => {
    const paramStr = (dialog.edit.parameter ?? '').toString().trim();
    const varType = dialog.edit.variableType;
    
    // parameter=0인 변수 타입들
    const zeroParamTypes: MinorEditVariableType[] = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];
    // Volume ID를 파라미터로 사용하는 변수 타입들
    const volumeParamTypes: MinorEditVariableType[] = ['p', 'tempf', 'tempg', 'voidf', 'flenth'];
    // Junction ID를 파라미터로 사용하는 변수 타입들
    const junctionParamTypes: MinorEditVariableType[] = ['mflowj', 'mflowfj', 'mflowgj'];

    if (!paramStr && !zeroParamTypes.includes(varType)) {
      setParameterError('Parameter is required');
      return;
    }

    if (zeroParamTypes.includes(varType)) {
      if (paramStr !== '0') {
        setParameterError(`${varType} parameter should be 0`);
      } else {
        setParameterError('');
      }
    } else if (varType === 'cntrlvar') {
      const num = parseInt(paramStr, 10);
      if (isNaN(num)) {
        setParameterError('Control variable number must be numeric');
      } else if (controlVariables.length > 0 && !controlVariables.some(cv => cv.number === num)) {
        setParameterError(`Control variable ${num} does not exist in the project`);
      } else {
        setParameterError('');
      }
    } else if (varType === 'turpow') {
      // turpow: 터빈 컴포넌트 ID (3자리 숫자)
      if (!/^\d{3}$/.test(paramStr)) {
        setParameterError('Turbine ID must be 3 digits (e.g., 610)');
      } else {
        setParameterError('');
      }
    } else if (volumeParamTypes.includes(varType)) {
      if (!/^\d{9}$/.test(paramStr)) {
        setParameterError('Volume ID must be 9 digits (Format: CCCVV0000)');
      } else if (!availableVolumeIdsSet.has(paramStr)) {
        setParameterError(`Volume ID "${paramStr}" does not exist in the project`);
      } else {
        setParameterError('');
      }
    } else if (junctionParamTypes.includes(varType)) {
      if (!/^\d{9}$/.test(paramStr)) {
        setParameterError('Junction ID must be 9 digits (Format: CCCVV000N)');
      } else if (!availableJunctionIdsSet.has(paramStr)) {
        setParameterError(`Junction ID "${paramStr}" does not exist in the project`);
      } else {
        setParameterError('');
      }
    }
  }, [dialog.edit.parameter, dialog.edit.variableType, availableVolumeIdsSet, availableJunctionIdsSet]);
  
  /**
   * 다음 사용 가능한 카드 번호를 자동 할당
   * 301-399 (단축형) → 20800001+ (확장형) 순서로 할당
   */
  const getNextCardNumber = (): number => {
    const usedNumbers = new Set(minorEdits.map(e => e.cardNumber));

    // 먼저 301-399 범위에서 빈 번호 찾기
    for (let n = 301; n <= 399; n++) {
      if (!usedNumbers.has(n)) return n;
    }

    // 301-399가 모두 사용 중이면 20800001+ 범위로 확장
    let extNumber = 20800001;
    while (usedNumbers.has(extNumber) && extNumber <= 20899999) {
      extNumber++;
    }
    return extNumber;
  };

  const handleAddEdit = () => {
    const nextNumber = getNextCardNumber();

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      edit: { ...emptyMinorEdit, cardNumber: nextNumber }
    });
    setParameterError('');
  };
  
  const handleEditEdit = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      edit: { ...emptyMinorEdit, ...minorEdits[index] }
    });
  };
  
  const handleDeleteEdit = (index: number) => {
    const newEdits = minorEdits.filter((_, idx) => idx !== index);
    onChange(newEdits);
  };
  
  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
    setParameterError('');
  };
  
  const handleDialogChange = (field: keyof MinorEdit, value: any) => {
    setDialog({
      ...dialog,
      edit: { ...dialog.edit, [field]: value }
    });
    
    // Reset parameter when variable type changes
    if (field === 'variableType') {
      const newVarType = value as MinorEditVariableType;
      const zeroTypes: MinorEditVariableType[] = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];
      if (zeroTypes.includes(newVarType)) {
        setDialog({
          ...dialog,
          edit: { ...dialog.edit, variableType: newVarType, parameter: '0' }
        });
      } else {
        setDialog({
          ...dialog,
          edit: { ...dialog.edit, variableType: newVarType, parameter: '' }
        });
      }
    }
  };
  
  const handleInputChange = (_event: React.SyntheticEvent, newInputValue: string) => {
    handleDialogChange('parameter', newInputValue);
  };
  
  const handleSave = () => {
    // Validate limits
    if (dialog.edit.lowerLimit >= dialog.edit.upperLimit) {
      alert('Lower limit must be less than upper limit');
      return;
    }
    
    // Validate card number (301-399 단축형 또는 20800001-20899999 확장형)
    const cn = dialog.edit.cardNumber;
    const isShortRange = cn >= 301 && cn <= 399;
    const isExtRange = cn >= 20800001 && cn <= 20899999;
    if (!isShortRange && !isExtRange) {
      alert('카드 번호는 301-399 또는 20800001-20899999 범위여야 합니다');
      return;
    }
    
    // Check for duplicate card numbers (excluding current edit in edit mode)
    const duplicateIndex = minorEdits.findIndex(
      (e, idx) => e.cardNumber === dialog.edit.cardNumber && (dialog.mode === 'add' || idx !== dialog.index)
    );
    if (duplicateIndex !== -1) {
      alert(`Card number ${dialog.edit.cardNumber} is already used`);
      return;
    }
    
    if (parameterError) {
      alert('Please fix parameter errors before saving');
      return;
    }
    
    const newEdits = [...minorEdits];
    if (dialog.mode === 'add') {
      newEdits.push(dialog.edit);
    } else {
      newEdits[dialog.index] = dialog.edit;
    }
    
    // Sort by card number
    newEdits.sort((a, b) => a.cardNumber - b.cardNumber);
    
    onChange(newEdits);
    handleDialogClose();
  };
  
  // Render parameter input based on variable type
  const renderParameterInput = () => {
    const varType = dialog.edit.variableType;
    
    const zeroTypes: MinorEditVariableType[] = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];
    const volumeTypes: MinorEditVariableType[] = ['p', 'tempf', 'tempg', 'voidf', 'flenth'];
    const junctionTypes: MinorEditVariableType[] = ['mflowj', 'mflowfj', 'mflowgj'];

    if (zeroTypes.includes(varType)) {
      return (
        <TextField
          label="Parameter"
          value={dialog.edit.parameter}
          onChange={(e) => handleDialogChange('parameter', e.target.value)}
          fullWidth
          disabled
          helperText={`${varType} parameter is always 0`}
        />
      );
    } else if (varType === 'turpow') {
      return (
        <TextField
          label="Turbine ID"
          value={dialog.edit.parameter}
          onChange={(e) => handleDialogChange('parameter', e.target.value)}
          fullWidth
          placeholder="e.g., 610"
          error={!!parameterError}
          helperText={parameterError || 'Turbine component ID (3 digits)'}
        />
      );
    } else if (varType === 'cntrlvar') {
      return (
        <FormControl fullWidth error={!!parameterError}>
          <InputLabel>Control Variable Number</InputLabel>
          <Select
            value={dialog.edit.parameter.toString()}
            label="Control Variable Number"
            onChange={(e) => handleDialogChange('parameter', e.target.value)}
          >
            {controlVariables.length === 0 ? (
              <MenuItem disabled>
                No control variables defined. Add in "Control Variables" tab first.
              </MenuItem>
            ) : (
              controlVariables.map(cv => (
                <MenuItem key={cv.number} value={cv.number.toString()}>
                  {cv.number} - {cv.name} ({cv.componentType})
                </MenuItem>
              ))
            )}
          </Select>
          {(parameterError || controlVariables.length === 0) && (
            <Typography variant="caption" color={parameterError ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
              {parameterError || 'No control variables available. Add them in the "Control Variables" tab.'}
            </Typography>
          )}
          {!parameterError && controlVariables.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              Select a control variable (CCC number)
            </Typography>
          )}
        </FormControl>
      );
    } else if (volumeTypes.includes(varType)) {
      return (
        <>
          <Autocomplete
            options={availableVolumeIds}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.label;
            }}
            isOptionEqualToValue={(option, value) => {
              if (typeof value === 'string') return option.volumeId === value;
              return option.volumeId === value.volumeId;
            }}
            value={dialog.edit.parameter.toString()}
            inputValue={dialog.edit.parameter.toString()}
            onInputChange={handleInputChange}
            onChange={(_, newValue) => {
              let volumeId = '';
              if (newValue && typeof newValue === 'object' && 'volumeId' in newValue) {
                volumeId = newValue.volumeId;
              } else if (typeof newValue === 'string') {
                volumeId = newValue;
              }
              handleDialogChange('parameter', volumeId);
            }}
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label="Volume ID"
                placeholder="Select or type Volume ID (9 digits)"
                error={!!parameterError}
                helperText={
                  parameterError ||
                  (availableVolumeIds.length === 0
                    ? 'No volumes available. Add volume components first.'
                    : 'Select from list or enter manually (Format: CCCVV0000)')
                }
                fullWidth
              />
            )}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const input = inputValue.toLowerCase();
              return options.filter(
                (opt) =>
                  opt.volumeId.includes(inputValue) ||
                  opt.label.toLowerCase().includes(input) ||
                  opt.componentName.toLowerCase().includes(input)
              );
            }}
          />
          {dialog.edit.parameter && availableVolumeIds.length > 0 && (() => {
            const selectedOption = availableVolumeIds.find(v => v.volumeId === dialog.edit.parameter.toString());
            if (selectedOption) {
              const labelParts = selectedOption.label.match(/\(([^)]+)\)/);
              const infoText = labelParts ? labelParts[1] : '';
              return (
                <Box
                  sx={{
                    mt: -0.5,
                    mb: 0.5,
                    p: 1,
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.08)'
                        : 'rgba(25, 118, 210, 0.15)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.23)'
                        : 'rgba(25, 118, 210, 0.3)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label="Selected"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {infoText}
                    </Typography>
                  </Box>
                </Box>
              );
            }
            return null;
          })()}
        </>
      );
    } else if (junctionTypes.includes(varType)) {
      return (
        <>
          <Autocomplete
            options={availableJunctionIds}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.label;
            }}
            isOptionEqualToValue={(option, value) => {
              if (typeof value === 'string') return option.junctionId === value;
              return option.junctionId === value.junctionId;
            }}
            value={dialog.edit.parameter.toString()}
            inputValue={dialog.edit.parameter.toString()}
            onInputChange={handleInputChange}
            onChange={(_, newValue) => {
              let junctionId = '';
              if (newValue && typeof newValue === 'object' && 'junctionId' in newValue) {
                junctionId = newValue.junctionId;
              } else if (typeof newValue === 'string') {
                junctionId = newValue;
              }
              handleDialogChange('parameter', junctionId);
            }}
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label="Junction ID"
                placeholder="Select or type Junction ID (9 digits)"
                error={!!parameterError}
                helperText={
                  parameterError ||
                  (availableJunctionIds.length === 0
                    ? 'No junctions available. Add junction components first.'
                    : 'Select from list or enter manually (Format: CCCVV000N)')
                }
                fullWidth
              />
            )}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const input = inputValue.toLowerCase();
              return options.filter(
                (opt) =>
                  opt.junctionId.includes(inputValue) ||
                  opt.label.toLowerCase().includes(input) ||
                  opt.componentName.toLowerCase().includes(input)
              );
            }}
          />
          {dialog.edit.parameter && availableJunctionIds.length > 0 && (() => {
            const selectedOption = availableJunctionIds.find(j => j.junctionId === dialog.edit.parameter.toString());
            if (selectedOption) {
              const labelParts = selectedOption.label.match(/\(([^)]+)\)/);
              const infoText = labelParts ? labelParts[1] : '';
              return (
                <Box
                  sx={{
                    mt: -0.5,
                    mb: 0.5,
                    p: 1,
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.08)'
                        : 'rgba(25, 118, 210, 0.15)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.23)'
                        : 'rgba(25, 118, 210, 0.3)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label="Selected"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {infoText}
                    </Typography>
                  </Box>
                </Box>
              );
            }
            return null;
          })()}
        </>
      );
    }
    
    return null;
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Minor Edits</Typography>
          <Typography variant="caption" color="text.secondary">
            {minorEdits.length}개 등록 · 카드 번호 자동 할당 (301-399, 초과 시 20800001+)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEdit}
        >
          Add Minor Edit
        </Button>
      </Box>
      
      {minorEdits.length === 0 ? (
        <Alert severity="info">
          No minor edits defined. Click "Add Minor Edit" to create one.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Card</TableCell>
                <TableCell>Variable Type</TableCell>
                <TableCell>Parameter</TableCell>
                <TableCell>Lower Limit</TableCell>
                <TableCell>Upper Limit</TableCell>
                <TableCell>Edit Group</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {minorEdits.map((edit, index) => (
                <TableRow key={edit.cardNumber}>
                  <TableCell>{edit.cardNumber}</TableCell>
                  <TableCell>{edit.variableType}</TableCell>
                  <TableCell>{edit.parameter}</TableCell>
                  <TableCell>{formatNumber(edit.lowerLimit)}</TableCell>
                  <TableCell>{formatNumber(edit.upperLimit)}</TableCell>
                  <TableCell>{edit.editGroup}</TableCell>
                  <TableCell>{edit.editPriority}</TableCell>
                  <TableCell>{edit.comment || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditEdit(index)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteEdit(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={dialog.open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.mode === 'add' ? 'Add Minor Edit' : 'Edit Minor Edit'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Card Number (자동 할당)"
              value={dialog.edit.cardNumber}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={
                dialog.edit.cardNumber >= 20800001
                  ? `확장형 카드 (20800001+) — 결과 조회 시 이 번호로 참조됩니다`
                  : `단축형 카드 (301-399) — 결과 조회 시 이 번호로 참조됩니다`
              }
            />
            
            <FormControl fullWidth>
              <InputLabel>Variable Type</InputLabel>
              <Select
                value={dialog.edit.variableType}
                label="Variable Type"
                onChange={(e) => handleDialogChange('variableType', e.target.value)}
              >
                <MenuItem value="rktpow">rktpow (Reactor Power)</MenuItem>
                <MenuItem value="rkmodd">rkmodd (Moderator Density Reactivity)</MenuItem>
                <MenuItem value="rkscram">rkscram (Scram Reactivity)</MenuItem>
                <MenuItem value="rkdopp">rkdopp (Doppler Reactivity)</MenuItem>
                <MenuItem value="rkreac">rkreac (Total Reactivity)</MenuItem>
                <MenuItem value="cntrlvar">cntrlvar (Control Variable)</MenuItem>
                <MenuItem value="p">p (Pressure)</MenuItem>
                <MenuItem value="tempf">tempf (Liquid Temperature)</MenuItem>
                <MenuItem value="tempg">tempg (Vapor Temperature)</MenuItem>
                <MenuItem value="mflowj">mflowj (Junction Total Mass Flow)</MenuItem>
                <MenuItem value="mflowfj">mflowfj (Junction Liquid Mass Flow)</MenuItem>
                <MenuItem value="mflowgj">mflowgj (Junction Vapor Mass Flow)</MenuItem>
                <MenuItem value="voidf">voidf (Void Fraction)</MenuItem>
                <MenuItem value="flenth">flenth (Fluid Enthalpy)</MenuItem>
                <MenuItem value="turpow">turpow (Turbine Power)</MenuItem>
                <MenuItem value="time">time (Time)</MenuItem>
              </Select>
            </FormControl>
            
            {renderParameterInput()}
            
            <TextField
              label="Lower Limit"
              value={lowerLimitInput}
              onChange={(e) => {
                const val = e.target.value;
                setLowerLimitInput(val); // Allow free typing including scientific notation
                
                // Try to parse for real-time validation (but don't update state yet)
                const trimmed = val.trim();
                if (trimmed && trimmed !== '-' && trimmed !== '.' && trimmed !== 'e' && trimmed !== 'E' && !trimmed.match(/^-?\.?e?$/i)) {
                  const parsed = parseFloat(trimmed);
                  if (!isNaN(parsed)) {
                    handleDialogChange('lowerLimit', parsed);
                  }
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val === '' || val === '-' || val === '.' || val === 'e' || val === 'E') {
                  handleDialogChange('lowerLimit', 0.0);
                  setLowerLimitInput('0');
                  return;
                }
                const parsed = parseFloat(val);
                if (!isNaN(parsed)) {
                  handleDialogChange('lowerLimit', parsed);
                  // Keep user's input format (scientific notation or regular number)
                  setLowerLimitInput(val);
                } else {
                  // Invalid input, revert to last valid value with original format
                  const lastValid = dialog.edit.lowerLimit;
                  setLowerLimitInput(formatLimitValue(lastValid));
                }
              }}
              fullWidth
              helperText="Lower bound for the variable (supports scientific notation, e.g., 1.0e6, 300.0e6, 13.e6)"
            />
            
            <TextField
              label="Upper Limit"
              value={upperLimitInput}
              onChange={(e) => {
                const val = e.target.value;
                setUpperLimitInput(val); // Allow free typing including scientific notation
                
                // Try to parse for real-time validation (but don't update state yet)
                const trimmed = val.trim();
                if (trimmed && trimmed !== '-' && trimmed !== '.' && trimmed !== 'e' && trimmed !== 'E' && !trimmed.match(/^-?\.?e?$/i)) {
                  const parsed = parseFloat(trimmed);
                  if (!isNaN(parsed)) {
                    handleDialogChange('upperLimit', parsed);
                  }
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val === '' || val === '-' || val === '.' || val === 'e' || val === 'E') {
                  handleDialogChange('upperLimit', 1.0e6);
                  setUpperLimitInput('1.0e6');
                  return;
                }
                const parsed = parseFloat(val);
                if (!isNaN(parsed)) {
                  handleDialogChange('upperLimit', parsed);
                  // Keep user's input format (scientific notation or regular number)
                  setUpperLimitInput(val);
                } else {
                  // Invalid input, revert to last valid value with original format
                  const lastValid = dialog.edit.upperLimit;
                  setUpperLimitInput(formatLimitValue(lastValid));
                }
              }}
              fullWidth
              helperText="Upper bound for the variable (supports scientific notation, e.g., 1.0e6, 400.0e6, 17.e6)"
            />
            
            <TextField
              label="Edit Group"
              type="number"
              value={dialog.edit.editGroup}
              onChange={(e) => handleDialogChange('editGroup', parseInt(e.target.value, 10))}
              fullWidth
              inputProps={{ min: 1, max: 999 }}
              helperText="Edit group number (1-999)"
            />
            
            <TextField
              label="Color (Priority)"
              type="number"
              value={dialog.edit.editPriority}
              onChange={(e) => handleDialogChange('editPriority', parseInt(e.target.value, 10))}
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Color/Priority field (1-999). According to SMART.i format comment '* var par min max id color', this is the 'color' field used for visualization/grouping in output plots. Same edit group (id) can have different color values for display purposes."
            />
            
            <TextField
              label="Comment (Optional)"
              value={dialog.edit.comment || ''}
              onChange={(e) => handleDialogChange('comment', e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Optional comment for this minor edit"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!!parameterError}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

