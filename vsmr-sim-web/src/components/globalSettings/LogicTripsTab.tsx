/**
 * Logic Trips Tab
 * Cards 601-799: Logical trip definitions (AND/OR combinations of variable/logic trips)
 * Mars Input Manual p.64-65, Section 5.4
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
import { LogicTrip, LogicTripOperator, VariableTrip } from '@/types/mars';
import { formatNumber } from '@/utils/formatNumber';

interface LogicTripsTabProps {
  logicTrips: LogicTrip[];
  variableTrips: VariableTrip[];
  onChange: (logicTrips: LogicTrip[]) => void;
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  trip: LogicTrip;
}

interface TripOption {
  tripNumber: number;
  label: string;
  type: 'variable' | 'logic';
  summary: string;
}

const emptyLogicTrip: LogicTrip = {
  cardNumber: 601,
  trip1: 401,
  operator: 'and',
  trip2: 401,
  latch: 'n',
  timeof: -1.0,
  comment: '',
  isTripMessage: false
};

/**
 * Format variable trip condition for display
 */
const formatVariableTripCondition = (vt: VariableTrip): string => {
  const left = `${vt.leftVar}(${vt.leftParam})`;
  const right = vt.rightVar === 'null'
    ? formatNumber(vt.actionValue)
    : `${vt.rightVar}(${vt.rightParam})`;
  return `${left} ${vt.relation} ${right}`;
};

export const LogicTripsTab: React.FC<LogicTripsTabProps> = ({
  logicTrips,
  variableTrips,
  onChange
}) => {
  const [dialog, setDialog] = useState<EditDialogState>({
    open: false,
    mode: 'add',
    index: -1,
    trip: { ...emptyLogicTrip }
  });

  const [timeofInput, setTimeofInput] = useState<string>('-1.0');

  // Build trip options for Autocomplete (Variable + Logic combined)
  const allTripOptions = useMemo((): TripOption[] => {
    const options: TripOption[] = [];

    variableTrips.forEach(vt => {
      const summary = formatVariableTripCondition(vt);
      options.push({
        tripNumber: vt.cardNumber,
        label: `${vt.cardNumber} - ${summary}${vt.comment ? ' "' + vt.comment + '"' : ''}`,
        type: 'variable',
        summary
      });
    });

    logicTrips.forEach(lt => {
      const summary = `Trip ${lt.trip1} ${lt.operator.toUpperCase()} Trip ${lt.trip2}`;
      options.push({
        tripNumber: lt.cardNumber,
        label: `${lt.cardNumber} - ${summary}${lt.comment ? ' "' + lt.comment + '"' : ''}`,
        type: 'logic',
        summary
      });
    });

    return options.sort((a, b) => a.tripNumber - b.tripNumber);
  }, [variableTrips, logicTrips]);

  // All available trip numbers (for validation display)
  const allTripNumbers = useMemo(() => {
    return new Set([
      ...variableTrips.map(t => t.cardNumber),
      ...logicTrips.map(t => t.cardNumber)
    ]);
  }, [variableTrips, logicTrips]);

  // Trip options excluding current card being edited (to avoid self-reference display issues)
  const trip1Options = useMemo(() => {
    return allTripOptions.filter(opt => opt.tripNumber !== dialog.trip.cardNumber);
  }, [allTripOptions, dialog.trip.cardNumber]);

  const trip2Options = useMemo(() => {
    return allTripOptions.filter(opt => opt.tripNumber !== dialog.trip.cardNumber);
  }, [allTripOptions, dialog.trip.cardNumber]);

  // Sync timeof input when dialog opens
  useEffect(() => {
    if (dialog.open) {
      const timeofVal = dialog.trip.timeof ?? -1.0;
      setTimeofInput(timeofVal === -1.0 ? '-1.0' : timeofVal.toString());
    } else {
      setTimeofInput('-1.0');
    }
  }, [dialog.open]);

  const handleAddTrip = () => {
    const usedNumbers = logicTrips.map(t => t.cardNumber);
    let nextNumber = 601;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 799) {
      nextNumber++;
    }

    if (nextNumber > 799) {
      alert('Maximum 199 logic trips allowed (Card 601-799)');
      return;
    }

    // Default trip1 to the first available variable trip
    const defaultTrip1 = variableTrips.length > 0 ? variableTrips[0].cardNumber : 401;

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      trip: { ...emptyLogicTrip, cardNumber: nextNumber, trip1: defaultTrip1, trip2: defaultTrip1 }
    });
  };

  const handleEditTrip = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      trip: { ...logicTrips[index] }
    });
  };

  const handleDeleteTrip = (index: number) => {
    const newTrips = logicTrips.filter((_, idx) => idx !== index);
    onChange(newTrips);
  };

  const handleCopyTrip = (index: number) => {
    const original = logicTrips[index];
    const usedNumbers = logicTrips.map(t => t.cardNumber);
    let nextNumber = original.cardNumber + 1;
    while (usedNumbers.includes(nextNumber) && nextNumber <= 799) {
      nextNumber++;
    }
    if (nextNumber > 799) {
      nextNumber = 601;
      while (usedNumbers.includes(nextNumber) && nextNumber <= 799) {
        nextNumber++;
      }
    }
    if (nextNumber > 799) {
      alert('Maximum 199 logic trips allowed (Card 601-799)');
      return;
    }

    const copied: LogicTrip = JSON.parse(JSON.stringify(original));
    copied.cardNumber = nextNumber;
    if (copied.comment) {
      copied.comment = `${copied.comment}_cp`.slice(0, 24);
    }

    const newTrips = [...logicTrips, copied].sort((a, b) => a.cardNumber - b.cardNumber);
    onChange(newTrips);
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
  };

  const handleDialogChange = (field: keyof LogicTrip, value: any) => {
    // Guard against NaN for numeric fields
    if (field === 'cardNumber' || field === 'trip1' || field === 'trip2') {
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      if (isNaN(num)) return; // Ignore NaN values
      setDialog({
        ...dialog,
        trip: { ...dialog.trip, [field]: num }
      });
      return;
    }
    setDialog({
      ...dialog,
      trip: { ...dialog.trip, [field]: value }
    });
  };

  const handleSave = () => {
    const { cardNumber, trip1, trip2 } = dialog.trip;

    // Guard against NaN
    if (isNaN(cardNumber) || isNaN(trip1) || isNaN(trip2)) {
      alert('Card number, Trip 1, and Trip 2 must be valid numbers');
      return;
    }

    // Validate card number range
    if (cardNumber < 601 || cardNumber > 799) {
      alert('Card number must be between 601 and 799');
      return;
    }

    // Check duplicate card numbers
    const duplicateIndex = logicTrips.findIndex(
      (t, idx) => t.cardNumber === cardNumber && (dialog.mode === 'add' || idx !== dialog.index)
    );
    if (duplicateIndex !== -1) {
      alert(`Card number ${cardNumber} is already used`);
      return;
    }

    // Validate trip1 and trip2 are valid numbers
    if (trip1 < 401 || trip1 > 799) {
      alert('Trip 1 must be between 401 and 799');
      return;
    }
    if (trip2 < 401 || trip2 > 799) {
      alert('Trip 2 must be between 401 and 799');
      return;
    }

    const newTrips = [...logicTrips];
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

  // Find trip option label for display
  const getTripLabel = (tripNumber: number): string => {
    const option = allTripOptions.find(opt => opt.tripNumber === tripNumber);
    if (option) {
      return option.summary;
    }
    return `Trip ${tripNumber}`;
  };

  // Check if a trip reference exists
  const tripExists = (tripNumber: number): boolean => {
    return allTripNumbers.has(tripNumber);
  };

  // Render trip autocomplete field (freeSolo: allows typing trip numbers not yet created)
  const renderTripAutocomplete = (side: 'trip1' | 'trip2') => {
    const value = side === 'trip1' ? dialog.trip.trip1 : dialog.trip.trip2;
    const options = side === 'trip1' ? trip1Options : trip2Options;
    const selectedOption = options.find(opt => opt.tripNumber === value) || null;
    const exists = tripExists(value);
    const inRange = value >= 401 && value <= 799;

    return (
      <Autocomplete
        freeSolo
        options={options}
        groupBy={(option) => {
          if (typeof option === 'string') return '';
          return option.type === 'variable' ? 'Variable Trips (401-599)' : 'Logic Trips (601-799)';
        }}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option.label;
        }}
        isOptionEqualToValue={(option, val) => {
          if (typeof option === 'string' || typeof val === 'string') return false;
          if (typeof val === 'number') return option.tripNumber === val;
          return option.tripNumber === val.tripNumber;
        }}
        value={selectedOption}
        onChange={(_, newValue) => {
          if (newValue && typeof newValue === 'object' && 'tripNumber' in newValue) {
            handleDialogChange(side, newValue.tripNumber);
          }
        }}
        onInputChange={(_, inputValue, reason) => {
          if (reason === 'input') {
            const num = parseInt(inputValue, 10);
            if (!isNaN(num)) {
              handleDialogChange(side, num);
            }
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={side === 'trip1' ? 'Trip 1 (W1)' : 'Trip 2 (W3)'}
            placeholder="Select or type trip number"
            error={!inRange}
            helperText={
              !inRange
                ? `Trip number must be between 401 and 799`
                : !exists
                  ? `Trip ${value} not yet defined (forward reference OK)`
                  : `Trip number (401-799)`
            }
            sx={!inRange ? {} : !exists ? {
              '& .MuiFormHelperText-root': { color: 'warning.main' }
            } : {}}
          />
        )}
        renderGroup={(params) => (
          <li key={params.key}>
            <Box sx={{
              position: 'sticky',
              top: -8,
              px: 1.5,
              py: 0.5,
              backgroundColor: (theme) => theme.palette.mode === 'light' ? '#f5f5f5' : '#333',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {params.group}
            </Box>
            <ul style={{ padding: 0 }}>{params.children}</ul>
          </li>
        )}
        renderOption={(props, option) => {
          if (typeof option === 'string') return null;
          const { key, ...restProps } = props as any;
          return (
            <li key={key} {...restProps}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Chip
                  label={option.tripNumber}
                  size="small"
                  color={option.type === 'variable' ? 'primary' : 'secondary'}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600, minWidth: 45 }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }} noWrap>
                  {option.summary}
                </Typography>
                {option.type === 'logic' && (
                  <Chip label="Logic" size="small" sx={{ height: 18, fontSize: '0.65rem', ml: 'auto' }} />
                )}
              </Box>
            </li>
          );
        }}
        filterOptions={(opts, { inputValue }) => {
          if (!inputValue) return opts;
          const input = inputValue.toLowerCase();
          return opts.filter(
            (opt) =>
              typeof opt !== 'string' && (
                opt.tripNumber.toString().includes(inputValue) ||
                opt.label.toLowerCase().includes(input) ||
                opt.summary.toLowerCase().includes(input)
              )
          );
        }}
      />
    );
  };

  // Format logic trip for table display
  const formatLogicTripDisplay = (trip: LogicTrip): React.ReactNode => {
    const trip1Label = getTripLabel(trip.trip1);
    const trip2Label = getTripLabel(trip.trip2);
    const trip1Missing = !tripExists(trip.trip1);
    const trip2Missing = !tripExists(trip.trip2);

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip
          label={trip.trip1}
          size="small"
          color={trip1Missing ? 'warning' : 'default'}
          variant="outlined"
          sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
          title={trip1Missing ? `Trip ${trip.trip1} (not yet defined)` : trip1Label}
        />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: trip.operator === 'and' ? 'primary.main' : 'secondary.main',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            px: 0.5
          }}
        >
          {trip.operator}
        </Typography>
        <Chip
          label={trip.trip2}
          size="small"
          color={trip2Missing ? 'warning' : 'default'}
          variant="outlined"
          sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
          title={trip2Missing ? `Trip ${trip.trip2} (not yet defined)` : trip2Label}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Logic Trips (Cards 601-799)</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddTrip}
          disabled={logicTrips.length >= 199}
        >
          Add Logic Trip
        </Button>
      </Box>

      {variableTrips.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No variable trips defined. Logic trips require at least one variable trip (401-599) to reference.
          Define variable trips first in the "Variable Trips" tab.
        </Alert>
      )}

      {logicTrips.length === 0 ? (
        <Alert severity="info">
          No logic trips defined. Click "Add Logic Trip" to create one.
          Logic trips combine two trips using AND/OR operators.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Card</TableCell>
                <TableCell>Condition (Trip1 OP Trip2)</TableCell>
                <TableCell>Latch</TableCell>
                <TableCell>Timeof</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logicTrips.map((trip, index) => (
                <TableRow key={trip.cardNumber}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{trip.cardNumber}</Typography>
                  </TableCell>
                  <TableCell>{formatLogicTripDisplay(trip)}</TableCell>
                  <TableCell>{trip.latch === 'l' ? 'Latch' : 'No Latch'}</TableCell>
                  <TableCell>{(trip.timeof ?? -1.0) === -1.0 ? '-1.0' : trip.timeof!.toString()}</TableCell>
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
        <DialogTitle>{dialog.mode === 'add' ? 'Add Logic Trip' : 'Edit Logic Trip'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Card Number"
              type="number"
              value={dialog.trip.cardNumber}
              onChange={(e) => handleDialogChange('cardNumber', parseInt(e.target.value, 10))}
              fullWidth
              inputProps={{ min: 601, max: 799 }}
              helperText="Card number must be between 601 and 799"
            />

            <Alert severity="info" sx={{ py: 0.5 }}>
              Logic Trip: CONDITION(Trip1) OPERATOR CONDITION(Trip2)
            </Alert>

            <Grid container spacing={2}>
              {/* Trip 1 */}
              <Grid item xs={12} md={5}>
                {renderTripAutocomplete('trip1')}
              </Grid>

              {/* Operator */}
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Operator (W2)</InputLabel>
                  <Select
                    value={dialog.trip.operator}
                    label="Operator (W2)"
                    onChange={(e) => handleDialogChange('operator', e.target.value as LogicTripOperator)}
                  >
                    <MenuItem value="and">AND</MenuItem>
                    <MenuItem value="or">OR</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Trip 2 */}
              <Grid item xs={12} md={5}>
                {renderTripAutocomplete('trip2')}
              </Grid>

              {/* Latch */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Latch (W4)</InputLabel>
                  <Select
                    value={dialog.trip.latch}
                    label="Latch (W4)"
                    onChange={(e) => handleDialogChange('latch', e.target.value)}
                  >
                    <MenuItem value="n">N (No Latch - test each time)</MenuItem>
                    <MenuItem value="l">L (Latch - once true stays true)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Timeof */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Timeof (W5)"
                  value={timeofInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimeofInput(val);
                    const trimmed = val.trim();
                    if (trimmed && trimmed !== '-' && trimmed !== '.' && !trimmed.match(/^-?\.?$/)) {
                      const parsed = parseFloat(trimmed);
                      if (!isNaN(parsed)) {
                        handleDialogChange('timeof', parsed);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val === '' || val === '-' || val === '.') {
                      handleDialogChange('timeof', -1.0);
                      setTimeofInput('-1.0');
                      return;
                    }
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) {
                      handleDialogChange('timeof', parsed);
                      setTimeofInput(val);
                    } else {
                      const lastValid = dialog.trip.timeof ?? -1.0;
                      setTimeofInput(lastValid === -1.0 ? '-1.0' : lastValid.toString());
                    }
                  }}
                  fullWidth
                  helperText="-1.0 = initialized as false"
                />
              </Grid>

              {/* Comment / Trip Message */}
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <TextField
                    label={dialog.trip.isTripMessage ? 'Trip Message (W6)' : 'Comment (Optional)'}
                    value={dialog.trip.comment || ''}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 24);
                      handleDialogChange('comment', val);
                    }}
                    fullWidth
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
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
