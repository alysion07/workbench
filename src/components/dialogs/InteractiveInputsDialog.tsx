/**
 * Interactive Inputs Dialog
 * Cards 801-999: Real-time control variables for NPA simulation
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
  Snackbar,
  InputAdornment
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import { InteractiveInput, InteractiveInputControlType, VariableTrip } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import { validateInteractiveInputs } from '@/utils/globalSettingsValidation';

interface InteractiveInputsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  input: InteractiveInput;
}

const emptyInteractiveInput: InteractiveInput = {
  cardNumber: 801,
  controlType: 'trip',
  parameter: '',
  comment: ''
};

const controlTypeLabels: Record<InteractiveInputControlType, string> = {
  trip: 'Trip Control',
  vlvarea: 'Valve Area Control',
  mflowfj: 'Liquid Flow Control',
  mflowgj: 'Vapor Flow Control',
  power: 'Heater Power Control'
};

const controlTypeDescriptions: Record<InteractiveInputControlType, string> = {
  trip: 'Control trip activation (parameter: trip number 400-799)',
  vlvarea: 'Control servo valve area (parameter: component number 100-999)',
  mflowfj: 'Control liquid flow rate (parameter: junction ID)',
  mflowgj: 'Control vapor flow rate (parameter: junction ID)',
  power: 'Control heater power (parameter: table number)'
};

export const InteractiveInputsDialog: React.FC<InteractiveInputsDialogProps> = ({
  open,
  onClose
}) => {
  const { nodes, metadata, updateGlobalSettings, openGlobalSettingsDialog } = useStore();

  // Local state for interactive inputs
  const [localInputs, setLocalInputs] = useState<InteractiveInput[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load from global settings when dialog opens
  useEffect(() => {
    if (open) {
      setLocalInputs(metadata.globalSettings?.interactiveInputs || []);
    }
  }, [open, metadata.globalSettings?.interactiveInputs]);

  // Get available variable trips for trip type selection
  const availableTrips: VariableTrip[] = useMemo(() => {
    return metadata.globalSettings?.variableTrips || [];
  }, [metadata.globalSettings?.variableTrips]);

  // Get available valve components from canvas
  const availableValves = useMemo(() => {
    return nodes
      .filter(node => node.data.componentType === 'valve')
      .map(node => ({
        componentNumber: node.data.componentId.slice(0, 3),
        componentName: node.data.componentName || 'Unknown',
      }));
  }, [nodes]);

  // Generate available junction IDs
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
        junctionIds.push(
          { junctionId: inletId, label: `${inletId} (${compName}, Inlet)`, componentName: compName },
          { junctionId: outletId, label: `${outletId} (${compName}, Outlet)`, componentName: compName }
        );
      } else if (compType === 'tmdpjun') {
        const inletId = `${shortId}010001`;
        const outletId = `${shortId}010002`;
        junctionIds.push(
          { junctionId: inletId, label: `${inletId} (${compName}, Inlet)`, componentName: compName },
          { junctionId: outletId, label: `${outletId} (${compName}, Outlet)`, componentName: compName }
        );
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
    input: { ...emptyInteractiveInput }
  });

  const [paramError, setParamError] = useState<string>('');

  // Validate parameter based on control type
  useEffect(() => {
    const paramStr = dialog.input.parameter.toString().trim();
    const controlType = dialog.input.controlType;

    if (!paramStr) {
      setParamError('Parameter is required');
      return;
    }

    switch (controlType) {
      case 'trip':
        const tripNum = parseInt(paramStr, 10);
        if (isNaN(tripNum) || tripNum < 400 || tripNum > 799) {
          setParamError('Trip number must be between 400 and 799');
        } else if (availableTrips.length > 0 && !availableTrips.some(t => t.cardNumber === tripNum)) {
          setParamError(`Trip ${tripNum} is not defined (warning only)`);
        } else {
          setParamError('');
        }
        break;

      case 'vlvarea':
        const compNum = parseInt(paramStr, 10);
        if (isNaN(compNum) || compNum < 100 || compNum > 999) {
          setParamError('Component number must be 3 digits (100-999)');
        } else {
          setParamError('');
        }
        break;

      case 'mflowfj':
      case 'mflowgj':
        if (!/^\d{9}$/.test(paramStr)) {
          setParamError('Junction ID must be 9 digits (Format: CCCVV000N)');
        } else {
          setParamError('');
        }
        break;

      case 'power':
        const tableNum = parseInt(paramStr, 10);
        if (isNaN(tableNum) || tableNum <= 0) {
          setParamError('Heater table number must be a positive integer');
        } else {
          setParamError('');
        }
        break;
    }
  }, [dialog.input.controlType, dialog.input.parameter, availableTrips]);

  const handleAddInput = () => {
    const usedNumbers = localInputs.map(i => i.cardNumber);
    let nextNumber = 801;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 999) {
      nextNumber++;
    }

    if (nextNumber > 999) {
      alert('Maximum 199 interactive inputs allowed (Card 801-999)');
      return;
    }

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      input: { ...emptyInteractiveInput, cardNumber: nextNumber }
    });
    setParamError('');
  };

  const handleEditInput = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      input: { ...localInputs[index] }
    });
  };

  const handleDeleteInput = (index: number) => {
    const newInputs = localInputs.filter((_, idx) => idx !== index);
    setLocalInputs(newInputs);
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
    setParamError('');
  };

  const handleDialogChange = (field: keyof InteractiveInput, value: any) => {
    setDialog({
      ...dialog,
      input: { ...dialog.input, [field]: value }
    });

    // Reset parameter when control type changes
    if (field === 'controlType') {
      setDialog({
        ...dialog,
        input: { ...dialog.input, controlType: value as InteractiveInputControlType, parameter: '' }
      });
    }
  };

  const handleDialogSave = () => {
    // Validate card number
    if (dialog.input.cardNumber < 801 || dialog.input.cardNumber > 999) {
      alert('Card number must be between 801 and 999');
      return;
    }

    // Check for duplicate card numbers
    const duplicateIndex = localInputs.findIndex(
      (i, idx) => i.cardNumber === dialog.input.cardNumber && (dialog.mode === 'add' || idx !== dialog.index)
    );
    if (duplicateIndex !== -1) {
      alert(`Card number ${dialog.input.cardNumber} is already used`);
      return;
    }

    // Check comment length
    if (dialog.input.comment && dialog.input.comment.length > 32) {
      alert('Comment must be 32 characters or less');
      return;
    }

    if (paramError && !paramError.includes('warning')) {
      alert('Please fix parameter errors before saving');
      return;
    }

    const newInputs = [...localInputs];
    if (dialog.mode === 'add') {
      newInputs.push(dialog.input);
    } else {
      newInputs[dialog.index] = dialog.input;
    }

    // Sort by card number
    newInputs.sort((a, b) => a.cardNumber - b.cardNumber);

    setLocalInputs(newInputs);
    handleDialogClose();
  };

  const handleSave = () => {
    // Validate all inputs
    const validation = validateInteractiveInputs(localInputs, nodes, availableTrips);

    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `Card ${e.card}: ${e.message}`).join('\n');
      setSnackbar({
        open: true,
        message: `Validation errors:\n${errorMessages}`,
        severity: 'error'
      });
      return;
    }

    // Save to global settings
    updateGlobalSettings({ interactiveInputs: localInputs });

    setSnackbar({
      open: true,
      message: 'Interactive inputs saved successfully!',
      severity: 'success'
    });

    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleCancel = () => {
    setLocalInputs(metadata.globalSettings?.interactiveInputs || []);
    onClose();
  };

  // Render parameter input based on control type
  const renderParameterInput = () => {
    const controlType = dialog.input.controlType;
    const paramValue = dialog.input.parameter;

    switch (controlType) {
      case 'trip': {
        const handleOpenVariableTrips = () => {
          handleDialogClose();
          onClose();
          setTimeout(() => openGlobalSettingsDialog(4), 300);
        };

        if (availableTrips.length === 0) {
          return (
            <FormControl fullWidth>
              <InputLabel>Trip Number</InputLabel>
              <Select
                value=""
                label="Trip Number"
                disabled
                endAdornment={
                  <InputAdornment position="end" sx={{ mr: 2.5 }}>
                    <Tooltip title="Variable Trips 설정">
                      <IconButton size="small" onClick={handleOpenVariableTrips}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                }
              >
                <MenuItem value="" disabled>No variable trips defined</MenuItem>
              </Select>
              <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, ml: 1.75 }}>
                Global Settings &gt; Variable Trips 에서 먼저 Trip을 정의하세요.
              </Typography>
            </FormControl>
          );
        }
        return (
          <FormControl fullWidth error={!!paramError}>
            <InputLabel>Trip Number</InputLabel>
            <Select
              value={paramValue.toString()}
              label="Trip Number"
              onChange={(e) => handleDialogChange('parameter', e.target.value)}
              endAdornment={
                <InputAdornment position="end" sx={{ mr: 2.5 }}>
                  <Tooltip title="Variable Trips 설정">
                    <IconButton size="small" onMouseDown={(e) => e.stopPropagation()} onClick={handleOpenVariableTrips}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              }
            >
              {availableTrips.map(trip => (
                <MenuItem key={trip.cardNumber} value={trip.cardNumber.toString()}>
                  Trip {trip.cardNumber} {trip.comment ? `- ${trip.comment}` : ''}
                </MenuItem>
              ))}
            </Select>
            {paramError && (
              <Typography variant="caption" color={paramError.includes('warning') ? 'warning.main' : 'error'} sx={{ mt: 0.5, ml: 1.75 }}>
                {paramError}
              </Typography>
            )}
          </FormControl>
        );
      }

      case 'vlvarea': {
        if (availableValves.length === 0) {
          return (
            <FormControl fullWidth>
              <InputLabel>Component Number</InputLabel>
              <Select
                value=""
                label="Component Number"
                disabled
              >
                <MenuItem value="" disabled>No valve components defined</MenuItem>
              </Select>
              <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, ml: 1.75 }}>
                캔버스에 Valve 컴포넌트를 먼저 추가하세요.
              </Typography>
            </FormControl>
          );
        }
        return (
          <FormControl fullWidth error={!!paramError && !paramError.includes('warning')}>
            <InputLabel>Component Number</InputLabel>
            <Select
              value={paramValue.toString()}
              label="Component Number"
              onChange={(e) => handleDialogChange('parameter', e.target.value)}
            >
              {availableValves.map(valve => (
                <MenuItem key={valve.componentNumber} value={valve.componentNumber}>
                  {valve.componentNumber} - {valve.componentName}
                </MenuItem>
              ))}
            </Select>
            {paramError && (
              <Typography variant="caption" color={paramError.includes('warning') ? 'warning.main' : 'error'} sx={{ mt: 0.5, ml: 1.75 }}>
                {paramError}
              </Typography>
            )}
          </FormControl>
        );
      }

      case 'mflowfj':
      case 'mflowgj':
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
              onInputChange={(_event, newInputValue) => handleDialogChange('parameter', newInputValue)}
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
                  error={!!paramError && !paramError.includes('warning')}
                  helperText={
                    paramError ||
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
                      mt: 1,
                      p: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip label="Selected" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{infoText}</Typography>
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}
          </>
        );

      case 'power':
        return (
          <TextField
            label="Heater Table Number"
            type="number"
            value={paramValue}
            onChange={(e) => handleDialogChange('parameter', e.target.value)}
            fullWidth
            error={!!paramError && !paramError.includes('warning')}
            helperText={paramError || 'Enter heater power table number'}
            inputProps={{ min: 1 }}
          />
        );
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleCancel} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Interactive Inputs (Cards 801-999)</Typography>
            <Chip label="Real-time Control" size="small" color="primary" />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Interactive Inputs define control variables that can be modified during simulation runtime in NPA (Nuclear Plant Analyzer) mode.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddInput}
                disabled={localInputs.length >= 199}
              >
                Add Interactive Input
              </Button>
            </Box>

            {localInputs.length === 0 ? (
              <Alert severity="info">
                No interactive inputs defined. Click "Add Interactive Input" to create one.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Card</TableCell>
                      <TableCell>Control Type</TableCell>
                      <TableCell>Parameter</TableCell>
                      <TableCell>Comment</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {localInputs.map((input, index) => (
                      <TableRow key={input.cardNumber}>
                        <TableCell>{input.cardNumber}</TableCell>
                        <TableCell>
                          <Chip
                            label={controlTypeLabels[input.controlType]}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {input.parameter}
                          </Typography>
                        </TableCell>
                        <TableCell>{input.comment || '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEditInput(index)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteInput(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialog.open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.mode === 'add' ? 'Add Interactive Input' : 'Edit Interactive Input'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Card Number"
              type="number"
              value={dialog.input.cardNumber}
              onChange={(e) => handleDialogChange('cardNumber', parseInt(e.target.value, 10))}
              fullWidth
              inputProps={{ min: 801, max: 999 }}
              helperText="Card number must be between 801 and 999"
            />

            <FormControl fullWidth>
              <InputLabel>Control Type</InputLabel>
              <Select
                value={dialog.input.controlType}
                label="Control Type"
                onChange={(e) => handleDialogChange('controlType', e.target.value)}
              >
                <MenuItem value="trip">trip - Trip Control</MenuItem>
                <MenuItem value="vlvarea">vlvarea - Servo Valve Area Control</MenuItem>
                <MenuItem value="mflowfj">mflowfj - Liquid Flow Control</MenuItem>
                <MenuItem value="mflowgj">mflowgj - Vapor Flow Control</MenuItem>
                <MenuItem value="power">power - Heater Power Control</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                {controlTypeDescriptions[dialog.input.controlType]}
              </Typography>
            </FormControl>

            {renderParameterInput()}

            <TextField
              label="Comment (Optional)"
              value={dialog.input.comment || ''}
              onChange={(e) => handleDialogChange('comment', e.target.value)}
              fullWidth
              inputProps={{ maxLength: 32 }}
              helperText={`${(dialog.input.comment || '').length}/32 characters - Displayed in Interactive Control Window`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleDialogSave}
            variant="contained"
            disabled={(!!paramError && !paramError.includes('warning')) || (dialog.input.controlType === 'trip' && availableTrips.length === 0) || (dialog.input.controlType === 'vlvarea' && availableValves.length === 0)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default InteractiveInputsDialog;
