/**
 * Simulation Control Tab
 * Cards 104, 105, 200, 201-299: Time and run control
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { Card104, Card105, Card200, TimePhase } from '@/types/mars';
import { NumericTextField } from '@/components/common/NumericTextField';
import { formatNumber } from '@/utils/formatNumber';

interface SimulationControlTabProps {
  card104: Card104;
  card105: Card105;
  card200: Card200;
  timePhases: TimePhase[];
  onChange: (updates: {
    card104?: Partial<Card104>;
    card105?: Partial<Card105>;
    card200?: Partial<Card200>;
    timePhases?: TimePhase[];
  }) => void;
}

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  phase: TimePhase;
}

const emptyPhase: TimePhase = {
  endTime: 100.0,
  minDt: 1.0e-8,
  maxDt: 0.001,
  controlOption: '00019',
  minorEditFreq: 1000,
  majorEditFreq: 10000,
  restartFreq: 100000
};

export const SimulationControlTab: React.FC<SimulationControlTabProps> = ({
  card104,
  card105,
  card200,
  timePhases,
  onChange
}) => {
  const [dialog, setDialog] = useState<EditDialogState>({
    open: false,
    mode: 'add',
    index: -1,
    phase: { ...emptyPhase }
  });

  const handleAddPhase = () => {
    // Set end time to be after the last phase
    const lastEndTime = timePhases.length > 0
      ? timePhases[timePhases.length - 1].endTime
      : card200.initialTime;

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      phase: { ...emptyPhase, endTime: lastEndTime + 100.0 }
    });
  };

  const handleEditPhase = (index: number) => {
    setDialog({
      open: true,
      mode: 'edit',
      index,
      phase: { ...timePhases[index] }
    });
  };

  const handleDeletePhase = (index: number) => {
    const newPhases = timePhases.filter((_, idx) => idx !== index);
    onChange({ timePhases: newPhases });
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
  };

  const handleDialogSave = () => {
    const newPhases = [...timePhases];

    if (dialog.mode === 'add') {
      newPhases.push(dialog.phase);
    } else {
      newPhases[dialog.index] = dialog.phase;
    }

    // Sort by end time
    newPhases.sort((a, b) => a.endTime - b.endTime);

    onChange({ timePhases: newPhases });
    handleDialogClose();
  };

  const handleDialogChange = (field: keyof TimePhase, value: any) => {
    setDialog({
      ...dialog,
      phase: {
        ...dialog.phase,
        [field]: value
      }
    });
  };

  // Validation for dialog
  // Calculate previousEndTime based on sorted order after the change
  const calculatePreviousEndTime = (): number => {
    if (dialog.mode === 'add') {
      // For new phases, previous is the last phase's endTime or initialTime
      if (timePhases.length === 0) {
        return card200.initialTime;
      }
      // Find the maximum endTime (last phase in sorted order)
      return Math.max(...timePhases.map(p => p.endTime));
    } else {
      // For editing, we need to find what would come before this phase 
      // in the sorted order after the change
      // Create a temporary array excluding the phase being edited
      const otherPhases = timePhases.filter((_, idx) => idx !== dialog.index);
      
      // Find all phases that would come before the edited phase in sorted order
      // (i.e., phases with endTime < edited phase's endTime)
      const phasesBefore = otherPhases.filter(p => p.endTime < dialog.phase.endTime);
      
      if (phasesBefore.length === 0) {
        // No phases before this one, so previous is initialTime
        return card200.initialTime;
      } else {
        // Return the maximum endTime among phases that come before
        return Math.max(...phasesBefore.map(p => p.endTime));
      }
    }
  };

  const previousEndTime = calculatePreviousEndTime();
  const isEndTimeValid = dialog.phase.endTime > previousEndTime;
  const isDtValid = dialog.phase.minDt > 0 && dialog.phase.maxDt > 0 && dialog.phase.minDt < dialog.phase.maxDt;
  const isControlOptionValid = /^\d{5}$/.test(dialog.phase.controlOption);

  const canSave = isEndTimeValid && isDtValid && isControlOptionValid &&
    dialog.phase.minorEditFreq > 0 &&
    dialog.phase.majorEditFreq > 0 &&
    dialog.phase.restartFreq > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Card 200: Initial Time */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 200: Initial Time
        </Typography>
        <NumericTextField
          label="Initial Time (s)"
          value={card200.initialTime}
          onChange={(num) => onChange({ card200: { initialTime: num } })}
          fullWidth
          helperText="Starting time for the simulation (typically 0.0)"
        />
      </Paper>

      {/* Card 201-299: Time Phases */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Time Phases (Cards 201-299)
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddPhase}
          >
            Add Phase
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Define time progression phases with different time step controls and output frequencies
        </Typography>

        {timePhases.length === 0 ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            At least one time phase is required. Click "Add Phase" to create one.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {timePhases.map((phase, idx) => {
              const startTime = (idx === 0 ? card200.initialTime : timePhases[idx - 1].endTime) ?? 0;
              const duration = (phase.endTime ?? 0) - startTime;

              return (
                <Card key={idx} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Phase {idx + 1} (Card {201 + idx})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {startTime.toPrecision(4)} → {(phase.endTime ?? 0).toPrecision(4)} s
                        ({duration.toPrecision(4)} s)
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          End Time
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {phase.endTime} s
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Min dt
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(phase.minDt)} s
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Max dt
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatNumber(phase.maxDt)} s
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Control Option
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {phase.controlOption}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Minor Edit
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {phase.minorEditFreq} steps
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Major Edit
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {phase.majorEditFreq} steps
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditPhase(idx)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePhase(idx)}
                      color="error"
                      disabled={timePhases.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Card 104: Restart-Plot File Control (Optional) */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Card 104: Restart-Plot File Control
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={card104.enabled}
                onChange={(e) => onChange({ card104: { enabled: e.target.checked } })}
                size="small"
              />
            }
            label={card104.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Controls restart and plot file behavior
        </Typography>
        {card104.enabled && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              label="Action"
              value={card104.action}
              onChange={(e) => onChange({ card104: { action: e.target.value } })}
              size="small"
              sx={{ width: 200 }}
              helperText="e.g., ncmpress"
            />
            <TextField
              label="Restart File Name"
              value={card104.fileName}
              onChange={(e) => onChange({ card104: { fileName: e.target.value } })}
              size="small"
              fullWidth
              helperText="e.g., model_name.r"
            />
          </Box>
        )}
      </Paper>

      {/* Card 105: CPU Time Limits (Optional) */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Card 105: CPU Time &amp; Diagnostic Edit
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={card105.enabled}
                onChange={(e) => onChange({ card105: { enabled: e.target.checked } })}
                size="small"
              />
            }
            label={card105.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          CPU time remaining limits and diagnostic editing control
        </Typography>
        {card105.enabled && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <NumericTextField
              label="Limit 1 (s)"
              value={card105.limit1}
              onChange={(num) => onChange({ card105: { limit1: num } })}
              size="small"
              helperText="CPU time limit 1"
            />
            <NumericTextField
              label="Limit 2 (s)"
              value={card105.limit2}
              onChange={(num) => onChange({ card105: { limit2: num } })}
              size="small"
              helperText="CPU time limit 2 (diagnostic)"
            />
          </Box>
        )}
      </Paper>

      {/* Edit/Add Dialog */}
      <Dialog
        open={dialog.open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialog.mode === 'add' ? 'Add Time Phase' : `Edit Phase ${dialog.index + 1}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <NumericTextField
              label="End Time (s)"
              value={dialog.phase.endTime}
              onChange={(num) => handleDialogChange('endTime', num)}
              fullWidth
              error={!isEndTimeValid}
              helperText={
                !isEndTimeValid
                  ? `Must be greater than ${previousEndTime}`
                  : `Phase will run from ${previousEndTime} to ${dialog.phase.endTime} s`
              }
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <NumericTextField
                label="Min dt (s)"
                value={dialog.phase.minDt}
                onChange={(num) => handleDialogChange('minDt', num)}
                fullWidth
                helperText="Minimum time step (e.g., 1e-8)"
              />

              <NumericTextField
                label="Max dt (s)"
                value={dialog.phase.maxDt}
                onChange={(num) => handleDialogChange('maxDt', num)}
                fullWidth
                error={!isDtValid && dialog.phase.maxDt > 0}
                helperText={
                  !isDtValid && dialog.phase.maxDt > 0
                    ? 'Must be > Min dt'
                    : 'Maximum time step (e.g., 0.001)'
                }
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                label="Control Option"
                value={dialog.phase.controlOption}
                onChange={(e) => handleDialogChange('controlOption', e.target.value)}
                fullWidth
                error={!isControlOptionValid}
                helperText={!isControlOptionValid ? 'Must be 5 digits (e.g., 00019)' : 'Format: ssdtt'}
                inputProps={{ maxLength: 5 }}
              />
              <Tooltip title="Format: ssdtt. ss=Major edit control (0-15), d=Output every dt (0-7), tt=Numerical method (19 recommended: Mass error + Nearly-implicit)">
                <IconButton size="small">
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <TextField
              label="Minor Edit Frequency (steps)"
              type="number"
              value={dialog.phase.minorEditFreq}
              onChange={(e) => handleDialogChange('minorEditFreq', parseInt(e.target.value))}
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              helperText="How often to write minor edit data"
            />

            <TextField
              label="Major Edit Frequency (steps)"
              type="number"
              value={dialog.phase.majorEditFreq}
              onChange={(e) => handleDialogChange('majorEditFreq', parseInt(e.target.value))}
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              helperText="How often to write major edit data"
            />

            <TextField
              label="Restart Frequency (steps)"
              type="number"
              value={dialog.phase.restartFreq}
              onChange={(e) => handleDialogChange('restartFreq', parseInt(e.target.value))}
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              helperText="How often to save restart files"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleDialogSave}
            variant="contained"
            disabled={!canSave}
          >
            {dialog.mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};



