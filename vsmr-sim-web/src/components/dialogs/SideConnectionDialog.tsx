/**
 * Side Connection Dialog Component
 * Dialog for configuring side connections between PIPE nodes
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  MenuItem,
  Alert,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import { Node } from 'reactflow';
import { MARSNodeData, SideConnectionSpec, PipeParameters } from '@/types/mars';
import { formatSideEdgeLabel } from '@/utils/edgeLabelHelpers';

interface SideConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (spec: SideConnectionSpec) => void;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandleId: string;  // "f3"
  targetHandleId: string;  // "f4"
  nodes: Node<MARSNodeData>[];
}

type CellMode = 'single' | 'range' | 'step';

const SideConnectionDialog: React.FC<SideConnectionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sourceNodeId,
  targetNodeId,
  sourceHandleId,
  targetHandleId,
  nodes,
}) => {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  const targetNode = nodes.find(n => n.id === targetNodeId);
  
  // Extract face numbers from handle IDs (f3 -> 3)
  const getFaceFromHandle = (handleId: string): number => {
    const match = handleId.match(/^f(\d)$/);
    return match ? parseInt(match[1], 10) : 1;
  };
  
  const [fromFace, setFromFace] = useState<number>(getFaceFromHandle(sourceHandleId));
  const [toFace, setToFace] = useState<number>(getFaceFromHandle(targetHandleId));
  const [cellMode, setCellMode] = useState<CellMode>('single');
  
  // Single mode
  const [singleCell, setSingleCell] = useState<number>(1);
  
  // Range mode
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(1);
  
  // Step mode
  const [stepStart, setStepStart] = useState<number>(1);
  const [stepIncrement, setStepIncrement] = useState<number>(1);
  const [stepCount, setStepCount] = useState<number>(1);
  
  // Optional parameters
  const [area, setArea] = useState<number>(0.5);
  const [fwdLoss, setFwdLoss] = useState<number>(0.5);
  const [revLoss, setRevLoss] = useState<number>(0.5);
  
  // Get max cells from source node (both nodes should have same ncells for side connections)
  const maxCells = useMemo(() => {
    if (!sourceNode) return 1;
    const params = sourceNode.data.parameters as Partial<PipeParameters>;
    return params?.ncells || 1;
  }, [sourceNode]);
  
  // Calculate cells array based on mode
  const calculatedCells = useMemo(() => {
    const cells: number[] = [];
    
    switch (cellMode) {
      case 'single':
        if (singleCell >= 1 && singleCell <= maxCells) {
          cells.push(singleCell);
        }
        break;
        
      case 'range':
        const start = Math.min(rangeStart, rangeEnd);
        const end = Math.max(rangeStart, rangeEnd);
        for (let i = start; i <= end && i <= maxCells; i++) {
          if (i >= 1) cells.push(i);
        }
        break;
        
      case 'step':
        let current = stepStart;
        let count = 0;
        while (count < stepCount && current >= 1 && current <= maxCells) {
          cells.push(current);
          current += stepIncrement;
          count++;
        }
        break;
    }
    
    // Sort and remove duplicates
    return Array.from(new Set(cells)).sort((a, b) => a - b);
  }, [cellMode, singleCell, rangeStart, rangeEnd, stepStart, stepIncrement, stepCount, maxCells]);
  
  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (!sourceNode || !targetNode) {
      errors.push('Source or target node not found');
      return errors;
    }
    
    if (sourceNode.data.componentType !== 'pipe' || targetNode.data.componentType !== 'pipe') {
      errors.push('Side connections are only supported between PIPE nodes');
    }
    
    if (fromFace < 1 || fromFace > 6) {
      errors.push('From face must be between 1 and 6');
    }
    
    if (toFace < 1 || toFace > 6) {
      errors.push('To face must be between 1 and 6');
    }
    
    if (calculatedCells.length === 0) {
      errors.push('At least one cell must be selected');
    }
    
    return errors;
  }, [sourceNode, targetNode, fromFace, toFace, calculatedCells]);
  
  const hasOrthogonalWarning = useMemo(() => {
    return (fromFace === 3 && toFace === 5) || (fromFace === 4 && toFace === 6) ||
           (fromFace === 5 && toFace === 3) || (fromFace === 6 && toFace === 4);
  }, [fromFace, toFace]);
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFromFace(getFaceFromHandle(sourceHandleId));
      setToFace(getFaceFromHandle(targetHandleId));
      setCellMode('single');
      setSingleCell(1);
      setRangeStart(1);
      setRangeEnd(1);
      setStepStart(1);
      setStepIncrement(1);
      setStepCount(1);
    }
  }, [open, sourceHandleId, targetHandleId]);
  
  const handleConfirm = () => {
    if (validationErrors.length > 0 || calculatedCells.length === 0) {
      return;
    }
    
    const spec: SideConnectionSpec = {
      fromNodeId: sourceNodeId,
      toNodeId: targetNodeId,
      fromFace: fromFace as 1|2|3|4|5|6,
      toFace: toFace as 1|2|3|4|5|6,
      cells: calculatedCells,
      area,
      fwdLoss,
      revLoss,
      jefvcahs: '00000000',
    };
    
    onConfirm(spec);
    onClose();
  };
  
  if (!sourceNode || !targetNode) {
    return null;
  }
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Configure Side Connection
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          {/* Connection Info */}
          <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Connection
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  From Node
                </Typography>
                <Typography variant="body1" fontWeight="600">
                  {sourceNode.data.componentName} ({sourceNode.data.componentId.slice(0, 3)})
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  To Node
                </Typography>
                <Typography variant="body1" fontWeight="600">
                  {targetNode.data.componentName} ({targetNode.data.componentId.slice(0, 3)})
                </Typography>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Face Selection */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Face Pair
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="From Face"
                  value={fromFace}
                  onChange={(e) => setFromFace(parseInt(e.target.value, 10))}
                  fullWidth
                  size="small"
                >
                  {[1, 2, 3, 4, 5, 6].map((face) => (
                    <MenuItem key={face} value={face}>
                      Face {face} {face === 1 ? '(Inlet)' : face === 2 ? '(Outlet)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="To Face"
                  value={toFace}
                  onChange={(e) => setToFace(parseInt(e.target.value, 10))}
                  fullWidth
                  size="small"
                >
                  {[1, 2, 3, 4, 5, 6].map((face) => (
                    <MenuItem key={face} value={face}>
                      Face {face} {face === 1 ? '(Inlet)' : face === 2 ? '(Outlet)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            {hasOrthogonalWarning && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Orthogonal face connection detected. Please review loss coefficients.
              </Alert>
            )}
          </Box>
          
          <Divider />
          
          {/* Cell Selection Mode */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Cell Selection
            </Typography>
            <TextField
              select
              label="Selection Mode"
              value={cellMode}
              onChange={(e) => setCellMode(e.target.value as CellMode)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            >
              <MenuItem value="single">Single Cell</MenuItem>
              <MenuItem value="range">Range (Start - End)</MenuItem>
              <MenuItem value="step">Step (Start, Increment, Count)</MenuItem>
            </TextField>
            
            {/* Single Mode */}
            {cellMode === 'single' && (
              <TextField
                type="number"
                label="Cell Number"
                value={singleCell}
                onChange={(e) => setSingleCell(Math.max(1, Math.min(maxCells, parseInt(e.target.value, 10) || 1)))}
                fullWidth
                size="small"
                inputProps={{ min: 1, max: maxCells }}
                helperText={`Select cell 1-${maxCells}`}
              />
            )}
            
            {/* Range Mode */}
            {cellMode === 'range' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Start Cell"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(Math.max(1, Math.min(maxCells, parseInt(e.target.value, 10) || 1)))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: maxCells }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="End Cell"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(Math.max(1, Math.min(maxCells, parseInt(e.target.value, 10) || 1)))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: maxCells }}
                  />
                </Grid>
              </Grid>
            )}
            
            {/* Step Mode */}
            {cellMode === 'step' && (
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Start Cell"
                    value={stepStart}
                    onChange={(e) => setStepStart(Math.max(1, Math.min(maxCells, parseInt(e.target.value, 10) || 1)))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: maxCells }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Increment"
                    value={stepIncrement}
                    onChange={(e) => setStepIncrement(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Count"
                    value={stepCount}
                    onChange={(e) => setStepCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              </Grid>
            )}
          </Box>
          
          {/* Preview */}
          <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Preview
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
              {calculatedCells.length > 0 ? (
                calculatedCells.map((cell) => (
                  <Chip
                    key={cell}
                    label={`v${cell.toString().padStart(2, '0')}`}
                    size="small"
                    color="primary"
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No cells selected
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Label: {formatSideEdgeLabel({
                fromNodeId: sourceNodeId,
                toNodeId: targetNodeId,
                fromFace: fromFace as 1|2|3|4|5|6,
                toFace: toFace as 1|2|3|4|5|6,
                cells: calculatedCells,
              })}
            </Typography>
          </Paper>
          
          {/* Optional Parameters */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Optional Parameters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  type="number"
                  label="Area (m²)"
                  value={area}
                  onChange={(e) => setArea(parseFloat(e.target.value) || 0.5)}
                  fullWidth
                  size="small"
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  type="number"
                  label="Forward Loss"
                  value={fwdLoss}
                  onChange={(e) => setFwdLoss(parseFloat(e.target.value) || 0.5)}
                  fullWidth
                  size="small"
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  type="number"
                  label="Reverse Loss"
                  value={revLoss}
                  onChange={(e) => setRevLoss(parseFloat(e.target.value) || 0.5)}
                  fullWidth
                  size="small"
                  inputProps={{ step: 0.1, min: 0 }}
                />
              </Grid>
            </Grid>
          </Box>
          
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error">
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                Validation Errors
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationErrors.map((error, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">{error}</Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={validationErrors.length > 0 || calculatedCells.length === 0}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SideConnectionDialog;

