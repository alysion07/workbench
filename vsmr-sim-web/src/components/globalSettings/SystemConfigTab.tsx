/**np
 * System Configuration Tab
 * Cards 120-129: System definitions
 */

import { useState, useEffect, useMemo } from 'react';
import { NumericTextField } from '@/components/common/NumericTextField';
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
import { SystemConfig, VolumeReference } from '@/types/mars';
import { validateSystemReferences } from '@/utils/globalSettingsValidation';
import { useStore } from '@/stores/useStore';
import { NodeIdResolver } from '@/utils/nodeIdResolver';

interface VolumeIdOption {
  ref: VolumeReference;        // VolumeReference object
  volumeId: string;
  label: string;
  componentName: string;
}

interface SystemConfigTabProps {
  systems: SystemConfig[];
  availableVolumeIds: VolumeIdOption[]; // List of available Volume IDs (9 digits)
  onChange: (systems: SystemConfig[]) => void;
  isRestart?: boolean; // RESTART 모드 시 전체 비활성화
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  system: SystemConfig;
}

const emptySystem: SystemConfig = {
  systemNumber: 1,
  referenceVolume: { nodeId: '', volumeNum: 1, face: 0 },
  referenceElevation: 0.0,
  fluid: 'h2o',
  systemName: ''
};

export const SystemConfigTab: React.FC<SystemConfigTabProps> = ({
  systems,
  availableVolumeIds,
  onChange,
  isRestart = false
}) => {
  const { nodes } = useStore();
  const [dialog, setDialog] = useState<EditDialogState>({
    open: false,
    mode: 'add',
    index: -1,
    system: { ...emptySystem }
  });

  // Create resolver for ID operations
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodes]);

  // Validate referenceVolume in real-time
  const [volumeIdError, setVolumeIdError] = useState<string>('');

  // Generate available Volume IDs set for quick lookup (memoized)
  const availableVolumeIdsSet = useMemo(
    () => new Set(availableVolumeIds.map(v => v.volumeId)),
    [availableVolumeIds]
  );

  // Validate referenceVolume whenever it changes
  useEffect(() => {
    const volumeId = dialog.system.referenceVolume?.nodeId
      ? resolver.getVolumeIdFromReference(dialog.system.referenceVolume) || ''
      : '';

    if (!volumeId) {
      setVolumeIdError('');
      return;
    }

    // Check format first
    if (!/^\d{9}$/.test(volumeId)) {
      setVolumeIdError('Volume ID must be 9 digits (Format: CCCVV0000, e.g., 100010000)');
      return;
    }

    // Check if Volume ID exists in project
    if (!availableVolumeIdsSet.has(volumeId)) {
      setVolumeIdError(`Volume ID "${volumeId}" does not exist in the project`);
      return;
    }

    // Valid
    setVolumeIdError('');
  }, [dialog.system.referenceVolume, availableVolumeIdsSet, resolver]);
  
  // Handle manual input changes (freeSolo mode) - REMOVED
  // Now using VolumeReference objects, no longer support manual string input

  const handleAddSystem = () => {
    // Find next available system number
    const usedNumbers = systems.map(s => s.systemNumber);
    let nextNumber = 0;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 9) {
      nextNumber++;
    }

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      system: { ...emptySystem, systemNumber: nextNumber }
    });
    setVolumeIdError(''); // Reset error when opening dialog
  };

  const handleEditSystem = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      system: { ...systems[index] }
    });
    // Error will be set by useEffect when dialog.system.referenceVolume changes
  };

  const handleDeleteSystem = (index: number) => {
    const newSystems = systems.filter((_, idx) => idx !== index);
    onChange(newSystems);
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
    setVolumeIdError('');
  };

  const handleDialogSave = () => {
    // Validate before saving
    const tempSystems = [...systems];
    if (dialog.mode === 'add') {
      tempSystems.push(dialog.system);
    } else {
      tempSystems[dialog.index] = dialog.system;
    }
    
    const validation = validateSystemReferences(tempSystems, nodes);
    
    if (!validation.valid) {
      // Show first error for referenceVolume
      const volumeError = validation.errors.find(e => e.field === 'referenceVolume');
      if (volumeError) {
        setVolumeIdError(volumeError.message);
      }
      return; // Don't save if validation fails
    }
    
    onChange(tempSystems);
    setVolumeIdError('');
    handleDialogClose();
  };

  const handleDialogChange = (field: keyof SystemConfig, value: any) => {
    setDialog({
      ...dialog,
      system: {
        ...dialog.system,
        [field]: value
      }
    });
  };

  const canAddSystem = systems.length < 10;
  const isSystemNumberUnique = dialog.mode === 'add'
    ? !systems.some(s => s.systemNumber === dialog.system.systemNumber)
    : !systems.some((s, idx) => idx !== dialog.index && s.systemNumber === dialog.system.systemNumber);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          System Configuration (Cards 120-129)
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSystem}
          disabled={!canAddSystem || isRestart}
        >
          Add System
        </Button>
      </Box>

      {isRestart && (
        <Alert severity="info">
          RESTART 모드에서는 수력학적 시스템 설정을 변경할 수 없습니다. (MARS 매뉴얼 Card 120-129)
        </Alert>
      )}

      {!canAddSystem && !isRestart && (
        <Alert severity="warning">
          Maximum 10 systems allowed
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary">
        Define reference conditions for each system (primary, secondary, etc.)
      </Typography>

      {systems.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No systems defined. Click "Add System" to create one.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>System #</TableCell>
                <TableCell>Card #</TableCell>
                <TableCell>Reference Volume</TableCell>
                <TableCell>Ref Elevation (m)</TableCell>
                <TableCell>Fluid</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {systems.map((system, idx) => (
                <TableRow key={idx}>
                  <TableCell>{system.systemNumber}</TableCell>
                  <TableCell>{120 + system.systemNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {system.referenceVolume?.nodeId
                        ? resolver.getVolumeIdFromReference(system.referenceVolume)
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{system.referenceElevation}</TableCell>
                  <TableCell>{system.fluid.toUpperCase()}</TableCell>
                  <TableCell>{system.systemName}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditSystem(idx)}
                      color="primary"
                      disabled={isRestart}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteSystem(idx)}
                      color="error"
                      disabled={isRestart}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit/Add Dialog */}
      <Dialog
        open={dialog.open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialog.mode === 'add' ? 'Add System' : 'Edit System'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="System Number"
              type="number"
              value={dialog.system.systemNumber}
              onChange={(e) => handleDialogChange('systemNumber', parseInt(e.target.value))}
              inputProps={{ min: 0, max: 9 }}
              fullWidth
              error={!isSystemNumberUnique}
              helperText={!isSystemNumberUnique ? 'System number must be unique' : 'Card 12X (0=Card 120, 1=Card 121, ...)'}
            />

            <Autocomplete
              options={availableVolumeIds}
              getOptionLabel={(option) => option.volumeId}
              isOptionEqualToValue={(option, value) => {
                return option.ref.nodeId === value.ref.nodeId &&
                       option.ref.volumeNum === value.ref.volumeNum &&
                       option.ref.face === value.ref.face;
              }}
              value={
                dialog.system.referenceVolume?.nodeId
                  ? availableVolumeIds.find(opt =>
                      opt.ref.nodeId === dialog.system.referenceVolume.nodeId &&
                      opt.ref.volumeNum === dialog.system.referenceVolume.volumeNum &&
                      opt.ref.face === dialog.system.referenceVolume.face
                    ) || null
                  : null
              }
              onChange={(_, newValue) => {
                if (newValue && typeof newValue === 'object' && 'ref' in newValue) {
                  handleDialogChange('referenceVolume', newValue.ref);
                } else {
                  handleDialogChange('referenceVolume', { nodeId: '', volumeNum: 1, face: 0 });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Reference Volume (Volume ID)"
                  placeholder="Select or type Volume ID (9 digits)"
                  error={!!volumeIdError}
                  helperText={
                    volumeIdError
                      ? volumeIdError
                      : availableVolumeIds.length === 0
                        ? 'No volumes available. Add volume components first.'
                        : 'Select from list or enter manually (Format: CCCVV0000)'
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
            
            {/* Display selected volume info as a separate, more visible label */}
            {dialog.system.referenceVolume?.nodeId && availableVolumeIds.length > 0 && (() => {
              const selectedOption = availableVolumeIds.find(v =>
                v.ref.nodeId === dialog.system.referenceVolume.nodeId &&
                v.ref.volumeNum === dialog.system.referenceVolume.volumeNum &&
                v.ref.face === dialog.system.referenceVolume.face
              );
              if (selectedOption) {
                // Extract info from label: "100010000 (CompName, Volume 01, Center)"
                const labelParts = selectedOption.label.match(/\(([^)]+)\)/);
                const infoText = labelParts ? labelParts[1] : '';

                return (
                  <Box
                    sx={{
                      mt: -0.5,
                      mb: 0.5,
                      p: 1,
                      backgroundColor: (theme) => theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.08)' // Light blue background
                        : 'rgba(25, 118, 210, 0.15)',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.23)' // Light blue border
                        : 'rgba(25, 118, 210, 0.3)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label="Selected"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 600
                        }}
                      />
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.875rem'
                        }}
                      >
                        {infoText}
                      </Typography>
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}
            
            <NumericTextField
              label="Reference Elevation (m)"
              value={dialog.system.referenceElevation}
              onChange={(num) => handleDialogChange('referenceElevation', num)}
              fullWidth
              helperText="Reference elevation for pressure calculation"
            />

            <FormControl fullWidth>
              <InputLabel>Fluid</InputLabel>
              <Select
                value={dialog.system.fluid}
                label="Fluid"
                onChange={(e) => handleDialogChange('fluid', e.target.value)}
              >
                <MenuItem value="h2o">H₂O (Water)</MenuItem>
                <MenuItem value="d2o">D₂O (Heavy Water)</MenuItem>
                <MenuItem value="air">AIR</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="System Name"
              value={dialog.system.systemName}
              onChange={(e) => handleDialogChange('systemName', e.target.value)}
              fullWidth
              placeholder="e.g., pri-sys, sec-sys"
              helperText="Descriptive name for this system"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleDialogSave}
            variant="contained"
            disabled={!isSystemNumberUnique || !dialog.system.referenceVolume?.nodeId || !!volumeIdError}
          >
            {dialog.mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};



