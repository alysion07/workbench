/**
 * Variable Trips Tab
 * Cards 401-599: Variable trip definitions
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
  Chip,
  Grid,
  Checkbox,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { VariableTrip, TripVariableType, ControlVariable } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import { formatNumber } from '@/utils/formatNumber';

interface VariableTripsTabProps {
  variableTrips: VariableTrip[];
  logicTripNumbers?: number[];  // Logic Trip numbers (601-799) for timeof references
  controlVariables?: ControlVariable[];  // Control Variables for cntrlvar dropdown
  onChange: (variableTrips: VariableTrip[]) => void;
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  trip: VariableTrip;
}

const emptyVariableTrip: VariableTrip = {
  cardNumber: 401,
  leftVar: 'time',
  leftParam: '0',
  relation: 'gt',
  rightVar: 'null',
  rightParam: '0',
  actionValue: 1.0e6,
  latch: 'l',
  timeout: -1.0,
  comment: '',
  isTripMessage: false
};

/**
 * Format action value for display
 * Shows scientific notation for large/small numbers, regular format otherwise
 */
const formatActionValue = (value: number): string => {
  return formatNumber(value);
};

export const VariableTripsTab: React.FC<VariableTripsTabProps> = ({
  variableTrips,
  logicTripNumbers,
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
      const shortId = compId.slice(0, 3);
      
      if (compType === 'snglvol' || compType === 'tmdpvol') {
        const volumeId = `${shortId}010000`;
        volumeIds.push({
          volumeId,
          label: `${volumeId} (${compName}, Volume 01, Center)`,
          componentName: compName
        });
      } else if (compType === 'pipe') {
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells; i++) {
            const volNum = i.toString().padStart(2, '0');
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
        const inletId = `${shortId}010001`;
        const outletId = `${shortId}010002`;
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
        const inletId = `${shortId}010001`;
        const outletId = `${shortId}010002`;
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
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells + 1; i++) {
            const junctionNum = Math.min(i, 6);
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
    trip: { ...emptyVariableTrip }
  });
  
  const [leftParamError, setLeftParamError] = useState<string>('');
  const [rightParamError, setRightParamError] = useState<string>('');
  const [actionValueInput, setActionValueInput] = useState<string>('');
  const [timeoutInput, setTimeoutInput] = useState<string>('');
  
  // Get available trip numbers (for timeof references) - includes both Variable and Logic Trips
  const availableTripNumbers = useMemo(() => {
    const varNums = variableTrips.map(t => t.cardNumber);
    const logicNums = logicTripNumbers || [];
    return [...varNums, ...logicNums].sort((a, b) => a - b);
  }, [variableTrips, logicTripNumbers]);
  
  // Memoized sets for quick lookup
  const availableVolumeIdsSet = useMemo(
    () => new Set(availableVolumeIds.map(v => v.volumeId)),
    [availableVolumeIds]
  );
  
  const availableJunctionIdsSet = useMemo(
    () => new Set(availableJunctionIds.map(j => j.junctionId)),
    [availableJunctionIds]
  );
  
  // Sync input values when dialog opens
  useEffect(() => {
    if (dialog.open) {
      const actionFormatted = formatActionValue(dialog.trip.actionValue);
      const timeoutVal = dialog.trip.timeout ?? -1.0;
      const timeoutFormatted = timeoutVal === -1.0 ? '-1.0' : timeoutVal.toString();
      setActionValueInput(actionFormatted);
      setTimeoutInput(timeoutFormatted);
    } else {
      setActionValueInput('');
      setTimeoutInput('');
    }
  }, [dialog.open]);
  
  // Validate left parameter based on variable type
  useEffect(() => {
    const paramStr = dialog.trip.leftParam.toString().trim();
    const varType = dialog.trip.leftVar;
    
    if (!paramStr && varType !== 'time') {
      setLeftParamError('Parameter is required');
      return;
    }
    
    if (varType === 'time') {
      if (paramStr !== '0') {
        setLeftParamError('time parameter should be 0');
      } else {
        setLeftParamError('');
      }
    } else if (varType === 'cntrlvar') {
      const num = parseInt(paramStr, 10);
      if (isNaN(num)) {
        setLeftParamError('Control variable number must be numeric');
      } else if (controlVariables.length > 0 && !controlVariables.some(cv => cv.number === num)) {
        setLeftParamError(`Control variable ${num} does not exist in the project`);
      } else {
        setLeftParamError('');
      }
    } else if (varType === 'p' || varType === 'tempf' || varType === 'voidf') {
      if (!/^\d{9}$/.test(paramStr)) {
        setLeftParamError('Volume ID must be 9 digits (Format: CCCVV0000)');
      } else if (!availableVolumeIdsSet.has(paramStr)) {
        setLeftParamError(`Volume ID "${paramStr}" does not exist in the project`);
      } else {
        setLeftParamError('');
      }
    } else if (varType === 'mflowj') {
      if (!/^\d{9}$/.test(paramStr)) {
        setLeftParamError('Junction ID must be 9 digits (Format: CCCVV000N)');
      } else if (!availableJunctionIdsSet.has(paramStr)) {
        setLeftParamError(`Junction ID "${paramStr}" does not exist in the project`);
      } else {
        setLeftParamError('');
      }
    } else if (varType === 'timeof') {
      const tripNum = parseInt(paramStr, 10);
      if (isNaN(tripNum)) {
        setLeftParamError('Trip number must be numeric');
      } else if (!availableTripNumbers.includes(tripNum)) {
        setLeftParamError(`Trip ${tripNum} does not exist in the project`);
      } else {
        setLeftParamError('');
      }
    }
  }, [dialog.trip.leftVar, dialog.trip.leftParam, availableVolumeIdsSet, availableJunctionIdsSet, availableTripNumbers, controlVariables]);

  // Validate right parameter based on variable type
  useEffect(() => {
    if (dialog.trip.rightVar === 'null') {
      const paramStr = dialog.trip.rightParam.toString().trim();
      if (paramStr !== '0') {
        setRightParamError('rightParam should be 0 when rightVar is null');
      } else {
        setRightParamError('');
      }
      return;
    }
    
    const paramStr = dialog.trip.rightParam.toString().trim();
    const varType = dialog.trip.rightVar;
    
    if (!paramStr && varType !== 'time') {
      setRightParamError('Parameter is required');
      return;
    }
    
    if (varType === 'time') {
      if (paramStr !== '0') {
        setRightParamError('time parameter should be 0');
      } else {
        setRightParamError('');
      }
    } else if (varType === 'cntrlvar') {
      const num = parseInt(paramStr, 10);
      if (isNaN(num)) {
        setRightParamError('Control variable number must be numeric');
      } else if (controlVariables.length > 0 && !controlVariables.some(cv => cv.number === num)) {
        setRightParamError(`Control variable ${num} does not exist in the project`);
      } else {
        setRightParamError('');
      }
    } else if (varType === 'p' || varType === 'tempf' || varType === 'voidf') {
      if (!/^\d{9}$/.test(paramStr)) {
        setRightParamError('Volume ID must be 9 digits (Format: CCCVV0000)');
      } else if (!availableVolumeIdsSet.has(paramStr)) {
        setRightParamError(`Volume ID "${paramStr}" does not exist in the project`);
      } else {
        setRightParamError('');
      }
    } else if (varType === 'mflowj') {
      if (!/^\d{9}$/.test(paramStr)) {
        setRightParamError('Junction ID must be 9 digits (Format: CCCVV000N)');
      } else if (!availableJunctionIdsSet.has(paramStr)) {
        setRightParamError(`Junction ID "${paramStr}" does not exist in the project`);
      } else {
        setRightParamError('');
      }
    } else if (varType === 'timeof') {
      const tripNum = parseInt(paramStr, 10);
      if (isNaN(tripNum)) {
        setRightParamError('Trip number must be numeric');
      } else if (!availableTripNumbers.includes(tripNum)) {
        setRightParamError(`Trip ${tripNum} does not exist in the project`);
      } else {
        setRightParamError('');
      }
    }
  }, [dialog.trip.rightVar, dialog.trip.rightParam, availableVolumeIdsSet, availableJunctionIdsSet, availableTripNumbers, controlVariables]);
  
  const handleAddTrip = () => {
    const usedNumbers = variableTrips.map(t => t.cardNumber);
    let nextNumber = 401;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 599) {
      nextNumber++;
    }
    
    if (nextNumber > 599) {
      alert('Maximum 199 variable trips allowed (Card 401-599)');
      return;
    }
    
    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      trip: { ...emptyVariableTrip, cardNumber: nextNumber }
    });
    setLeftParamError('');
    setRightParamError('');
  };
  
  const handleEditTrip = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      trip: { ...variableTrips[index] }
    });
  };
  
  const handleDeleteTrip = (index: number) => {
    const newTrips = variableTrips.filter((_, idx) => idx !== index);
    onChange(newTrips);
  };

  const handleCopyTrip = (index: number) => {
    const original = variableTrips[index];
    const usedNumbers = variableTrips.map(t => t.cardNumber);
    let nextNumber = original.cardNumber + 1;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 599) {
      nextNumber++;
    }
    if (nextNumber > 599) {
      nextNumber = 401;
      while (usedNumbers.includes(nextNumber) && nextNumber <= 599) {
        nextNumber++;
      }
    }
    if (nextNumber > 599) {
      alert('Maximum 199 variable trips allowed (Card 401-599)');
      return;
    }

    const copied: VariableTrip = JSON.parse(JSON.stringify(original));
    copied.cardNumber = nextNumber;
    if (copied.comment) {
      copied.comment = `${copied.comment}_cp`.slice(0, 24);
    }

    const newTrips = [...variableTrips, copied].sort((a, b) => a.cardNumber - b.cardNumber);
    onChange(newTrips);
  };
  
  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
    setLeftParamError('');
    setRightParamError('');
  };
  
  const handleDialogChange = (field: keyof VariableTrip, value: any) => {
    setDialog({
      ...dialog,
      trip: { ...dialog.trip, [field]: value }
    });
    
    // Reset parameters when variable type changes
    if (field === 'leftVar') {
      const newVarType = value as TripVariableType;
      if (newVarType === 'time') {
        setDialog({
          ...dialog,
          trip: { ...dialog.trip, leftVar: newVarType, leftParam: '0' }
        });
      } else {
        setDialog({
          ...dialog,
          trip: { ...dialog.trip, leftVar: newVarType, leftParam: '' }
        });
      }
    } else if (field === 'rightVar') {
      const newVarType = value as TripVariableType | 'null';
      if (newVarType === 'null' || newVarType === 'time') {
        setDialog({
          ...dialog,
          trip: { ...dialog.trip, rightVar: newVarType, rightParam: '0' }
        });
      } else {
        setDialog({
          ...dialog,
          trip: { ...dialog.trip, rightVar: newVarType, rightParam: '' }
        });
      }
    }
  };
  
  const handleSave = () => {
    // Validate card number
    if (dialog.trip.cardNumber < 401 || dialog.trip.cardNumber > 599) {
      alert('Card number must be between 401 and 599');
      return;
    }
    
    // Check for duplicate card numbers
    const duplicateIndex = variableTrips.findIndex(
      (t, idx) => t.cardNumber === dialog.trip.cardNumber && (dialog.mode === 'add' || idx !== dialog.index)
    );
    if (duplicateIndex !== -1) {
      alert(`Card number ${dialog.trip.cardNumber} is already used`);
      return;
    }
    
    if (leftParamError || rightParamError) {
      alert('Please fix parameter errors before saving');
      return;
    }
    
    const newTrips = [...variableTrips];
    if (dialog.mode === 'add') {
      newTrips.push(dialog.trip);
    } else {
      newTrips[dialog.index] = dialog.trip;
    }
    
    // Sort by card number
    newTrips.sort((a, b) => a.cardNumber - b.cardNumber);
    
    onChange(newTrips);
    handleDialogClose();
  };
  
  // Render parameter input based on variable type
  const renderParameterInput = (side: 'left' | 'right') => {
    const varType = side === 'left' ? dialog.trip.leftVar : dialog.trip.rightVar;
    const paramValue = side === 'left' ? dialog.trip.leftParam : dialog.trip.rightParam;
    const error = side === 'left' ? leftParamError : rightParamError;
    const handleChange = (value: string | number) => {
      handleDialogChange(side === 'left' ? 'leftParam' : 'rightParam', value);
    };
    
    if (varType === 'time') {
      return (
        <TextField
          label={`${side === 'left' ? 'Left' : 'Right'} Parameter`}
          value={paramValue}
          onChange={(e) => handleChange(e.target.value)}
          fullWidth
          disabled
          helperText="time parameter is always 0"
        />
      );
    } else if (varType === 'null') {
      return (
        <TextField
          label="Right Parameter"
          value={paramValue}
          onChange={(e) => handleChange(e.target.value)}
          fullWidth
          disabled
          helperText="rightParam should be 0 when rightVar is null"
        />
      );
    } else if (varType === 'cntrlvar') {
      return (
        <FormControl fullWidth error={!!error}>
          <InputLabel>{side === 'left' ? 'Left' : 'Right'} Parameter (Control Variable)</InputLabel>
          <Select
            value={paramValue.toString()}
            label={`${side === 'left' ? 'Left' : 'Right'} Parameter (Control Variable)`}
            onChange={(e) => handleChange(e.target.value)}
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
          {(error || controlVariables.length === 0) && (
            <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.75 }}>
              {error || 'No control variables available. Add them in the "Control Variables" tab.'}
            </Typography>
          )}
          {!error && controlVariables.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              Select a control variable (CCC number)
            </Typography>
          )}
        </FormControl>
      );
    } else if (varType === 'p' || varType === 'tempf' || varType === 'voidf') {
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
            value={paramValue.toString()}
            inputValue={paramValue.toString()}
            onInputChange={(_event, newInputValue) => handleChange(newInputValue)}
            onChange={(_, newValue) => {
              let volumeId = '';
              if (newValue && typeof newValue === 'object' && 'volumeId' in newValue) {
                volumeId = newValue.volumeId;
              } else if (typeof newValue === 'string') {
                volumeId = newValue;
              }
              handleChange(volumeId);
            }}
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label={`${side === 'left' ? 'Left' : 'Right'} Parameter (Volume ID)`}
                placeholder="Select or type Volume ID (9 digits)"
                error={!!error}
                helperText={
                  error ||
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
          {paramValue && availableVolumeIds.length > 0 && (() => {
            const selectedOption = availableVolumeIds.find(v => v.volumeId === paramValue.toString());
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
    } else if (varType === 'mflowj') {
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
            value={paramValue.toString()}
            inputValue={paramValue.toString()}
            onInputChange={(_event, newInputValue) => handleChange(newInputValue)}
            onChange={(_, newValue) => {
              let junctionId = '';
              if (newValue && typeof newValue === 'object' && 'junctionId' in newValue) {
                junctionId = newValue.junctionId;
              } else if (typeof newValue === 'string') {
                junctionId = newValue;
              }
              handleChange(junctionId);
            }}
            freeSolo
            renderInput={(params) => (
              <TextField
                {...params}
                label={`${side === 'left' ? 'Left' : 'Right'} Parameter (Junction ID)`}
                placeholder="Select or type Junction ID (9 digits)"
                error={!!error}
                helperText={
                  error ||
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
          {paramValue && availableJunctionIds.length > 0 && (() => {
            const selectedOption = availableJunctionIds.find(j => j.junctionId === paramValue.toString());
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
    } else if (varType === 'timeof') {
      return (
        <FormControl fullWidth>
          <InputLabel>{side === 'left' ? 'Left' : 'Right'} Parameter (Trip Number)</InputLabel>
          <Select
            value={paramValue.toString()}
            label={`${side === 'left' ? 'Left' : 'Right'} Parameter (Trip Number)`}
            onChange={(e) => handleChange(e.target.value)}
            error={!!error}
          >
            {availableTripNumbers.map(tripNum => (
              <MenuItem key={tripNum} value={tripNum.toString()}>
                Trip {tripNum}
              </MenuItem>
            ))}
          </Select>
          {error && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
              {error}
            </Typography>
          )}
        </FormControl>
      );
    }
    
    return null;
  };
  
  // Format trip for display in table
  const formatTripDisplay = (trip: VariableTrip): string => {
    const left = `${trip.leftVar}(${trip.leftParam})`;
    const right = trip.rightVar === 'null' ? 'null' : `${trip.rightVar}(${trip.rightParam})`;
    return `${left} ${trip.relation} ${right}`;
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Variable Trips (Cards 401-599)</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddTrip}
          disabled={variableTrips.length >= 199}
        >
          Add Variable Trip
        </Button>
      </Box>
      
      {variableTrips.length === 0 ? (
        <Alert severity="info">
          No variable trips defined. Click "Add Variable Trip" to create one.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Card</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>Action Value</TableCell>
                <TableCell>Latch</TableCell>
                <TableCell>Timeout</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variableTrips.map((trip, index) => (
                <TableRow key={trip.cardNumber}>
                  <TableCell>{trip.cardNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {formatTripDisplay(trip)}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatNumber(trip.actionValue)}</TableCell>
                  <TableCell>{trip.latch === 'l' ? 'Latch' : 'No Latch'}</TableCell>
                  <TableCell>{(trip.timeout ?? -1.0) === -1.0 ? 'No timeout' : trip.timeout!.toString()}</TableCell>
                  <TableCell>{trip.comment || '-'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditTrip(index)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={() => handleCopyTrip(index)}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteTrip(index)}>
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
      <Dialog open={dialog.open} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>{dialog.mode === 'add' ? 'Add Variable Trip' : 'Edit Variable Trip'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Card Number"
              type="number"
              value={dialog.trip.cardNumber}
              onChange={(e) => handleDialogChange('cardNumber', parseInt(e.target.value, 10))}
              fullWidth
              inputProps={{ min: 401, max: 599 }}
              helperText="Card number must be between 401 and 599"
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Left Variable</InputLabel>
                  <Select
                    value={dialog.trip.leftVar}
                    label="Left Variable"
                    onChange={(e) => handleDialogChange('leftVar', e.target.value)}
                  >
                    <MenuItem value="time">time (Time)</MenuItem>
                    <MenuItem value="p">p (Pressure)</MenuItem>
                    <MenuItem value="tempf">tempf (Fluid Temperature)</MenuItem>
                    <MenuItem value="mflowj">mflowj (Junction Mass Flow)</MenuItem>
                    <MenuItem value="voidf">voidf (Void Fraction)</MenuItem>
                    <MenuItem value="cntrlvar">cntrlvar (Control Variable)</MenuItem>
                    <MenuItem value="timeof">timeof (Time of Trip)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {renderParameterInput('left')}
              </Grid>
              
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Relation</InputLabel>
                  <Select
                    value={dialog.trip.relation}
                    label="Relation"
                    onChange={(e) => handleDialogChange('relation', e.target.value)}
                  >
                    <MenuItem value="gt">gt (Greater Than)</MenuItem>
                    <MenuItem value="ge">ge (Greater Than or Equal)</MenuItem>
                    <MenuItem value="lt">lt (Less Than)</MenuItem>
                    <MenuItem value="le">le (Less Than or Equal)</MenuItem>
                    <MenuItem value="eq">eq (Equal)</MenuItem>
                    <MenuItem value="ne">ne (Not Equal)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Right Variable</InputLabel>
                  <Select
                    value={dialog.trip.rightVar}
                    label="Right Variable"
                    onChange={(e) => handleDialogChange('rightVar', e.target.value)}
                  >
                    <MenuItem value="null">null (Constant)</MenuItem>
                    <MenuItem value="time">time (Time)</MenuItem>
                    <MenuItem value="p">p (Pressure)</MenuItem>
                    <MenuItem value="tempf">tempf (Fluid Temperature)</MenuItem>
                    <MenuItem value="mflowj">mflowj (Junction Mass Flow)</MenuItem>
                    <MenuItem value="voidf">voidf (Void Fraction)</MenuItem>
                    <MenuItem value="cntrlvar">cntrlvar (Control Variable)</MenuItem>
                    <MenuItem value="timeof">timeof (Time of Trip)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={4}>
                {renderParameterInput('right')}
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Action Value"
                  value={actionValueInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActionValueInput(val);
                    const trimmed = val.trim();
                    if (trimmed && trimmed !== '-' && trimmed !== '.' && trimmed !== 'e' && trimmed !== 'E' && !trimmed.match(/^-?\.?e?$/i)) {
                      const parsed = parseFloat(trimmed);
                      if (!isNaN(parsed)) {
                        handleDialogChange('actionValue', parsed);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '' || val === '-' || val === '.' || val === 'e' || val === 'E') {
                      handleDialogChange('actionValue', 1.0e6);
                      setActionValueInput('1.0e6');
                      return;
                    }
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) {
                      handleDialogChange('actionValue', parsed);
                      setActionValueInput(val);
                    } else {
                      const lastValid = dialog.trip.actionValue;
                      setActionValueInput(formatActionValue(lastValid));
                    }
                  }}
                  fullWidth
                  helperText="Threshold value for trip activation (supports scientific notation, e.g., 1.0e6, 6.50e6)"
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Latch</InputLabel>
                  <Select
                    value={dialog.trip.latch}
                    label="Latch"
                    onChange={(e) => handleDialogChange('latch', e.target.value)}
                  >
                    <MenuItem value="l">l (Latch)</MenuItem>
                    <MenuItem value="n">n (No Latch)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <TextField
                  label="Timeout"
                  value={timeoutInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimeoutInput(val);
                    const trimmed = val.trim();
                    if (trimmed && trimmed !== '-' && trimmed !== '.' && trimmed !== 'e' && trimmed !== 'E' && !trimmed.match(/^-?\.?e?$/i)) {
                      const parsed = parseFloat(trimmed);
                      if (!isNaN(parsed)) {
                        handleDialogChange('timeout', parsed);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '' || val === '-' || val === '.' || val === 'e' || val === 'E') {
                      handleDialogChange('timeout', -1.0);
                      setTimeoutInput('-1.0');
                      return;
                    }
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) {
                      handleDialogChange('timeout', parsed);
                      setTimeoutInput(val);
                    } else {
                      const lastValid = dialog.trip.timeout ?? -1.0;
                      setTimeoutInput(lastValid === -1.0 ? '-1.0' : lastValid.toString());
                    }
                  }}
                  fullWidth
                  helperText="-1.0 = no timeout"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <TextField
                    label={dialog.trip.isTripMessage ? 'Trip Message (W9)' : 'Comment (Optional)'}
                    value={dialog.trip.comment || ''}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 24);
                      handleDialogChange('comment', val);
                    }}
                    fullWidth
                    multiline
                    rows={2}
                    helperText={
                      dialog.trip.isTripMessage
                        ? `${(dialog.trip.comment || '').length}/24 chars - MARS displays on trip`
                        : `${(dialog.trip.comment || '').length}/24 chars - inline note`
                    }
                    inputProps={{ maxLength: 24 }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={!!dialog.trip.isTripMessage}
                        onChange={(e) => handleDialogChange('isTripMessage', e.target.checked)}
                      />
                    }
                    label={<Typography variant="caption">Trip Message (MARS output)</Typography>}
                    sx={{ mt: -0.5 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!!leftParamError || !!rightParamError}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


