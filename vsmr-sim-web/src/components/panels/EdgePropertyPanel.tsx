/**
 * Edge Property Panel Component
 * Panel for editing side connection edge properties
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  TextField,
  Button,
  Grid,
  Chip,
  Alert,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { useStore } from '@/stores/useStore';
import { MARSEdgeData } from '@/types/mars';
import { formatSideEdgeLabel } from '@/utils/edgeLabelHelpers';

interface EdgePropertyPanelProps {
  edgeId: string;
}

const EdgePropertyPanel: React.FC<EdgePropertyPanelProps> = ({ edgeId }) => {
  const { edges, nodes, setEdges, setSelectedEdgeId } = useStore();
  const edge = edges.find(e => e.id === edgeId);
  
  if (!edge || !edge.data) {
    return (
      <Box p={2}>
        <Alert severity="error">Edge not found</Alert>
      </Box>
    );
  }
  
  const edgeData = edge.data as MARSEdgeData;
  // 다중 셀 연결 확인 (구 'side' 연결 타입 대체)
  const isMultiCellConnection = edgeData.isMultiCellConnection === true;
  
  // State for editing
  const [fromFace, setFromFace] = useState<number>(edgeData.fromFace || 1);
  const [toFace, setToFace] = useState<number>(edgeData.toFace || 1);
  const [cells, setCells] = useState<number[]>(edgeData.cells || []);
  const [area, setArea] = useState<number>(edgeData.area || 0.5);
  const [fwdLoss, setFwdLoss] = useState<number>(edgeData.fwdLoss || 0.5);
  const [revLoss, setRevLoss] = useState<number>(edgeData.revLoss || 0.5);
  
  // Get source and target nodes
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  // Get max cells from source node
  const maxCells = sourceNode?.data.componentType === 'pipe' 
    ? (sourceNode.data.parameters as any)?.ncells || 1 
    : 1;
  
  useEffect(() => {
    if (edgeData.fromFace) setFromFace(edgeData.fromFace);
    if (edgeData.toFace) setToFace(edgeData.toFace);
    if (edgeData.cells) setCells(edgeData.cells);
    if (edgeData.area !== undefined) setArea(edgeData.area);
    if (edgeData.fwdLoss !== undefined) setFwdLoss(edgeData.fwdLoss);
    if (edgeData.revLoss !== undefined) setRevLoss(edgeData.revLoss);
  }, [edgeId, edgeData]);
  
  const handleSave = () => {
    const updatedEdges = edges.map(e => {
      if (e.id === edgeId) {
        const updatedData: MARSEdgeData = {
          // Spread rest of data
          ...e.data,
          fromVolume: e.data?.fromVolume ?? { nodeId: '', volumeNum: 1, face: 1 },
          toVolume: e.data?.toVolume ?? { nodeId: '', volumeNum: 1, face: 1 },
          connectionType: e.data?.connectionType || 'axial',
          // Update side connection specific fields
          fromFace: fromFace as 1|2|3|4|5|6,
          toFace: toFace as 1|2|3|4|5|6,
          cells: cells.sort((a, b) => a - b),
          area,
          fwdLoss,
          revLoss,
          label: isMultiCellConnection ? formatSideEdgeLabel({
            fromNodeId: edge.source,
            toNodeId: edge.target,
            fromFace: fromFace as 1|2|3|4|5|6,
            toFace: toFace as 1|2|3|4|5|6,
            cells: cells.sort((a, b) => a - b),
          }) : e.data?.label,
          isMultiJunction: cells.length > 1,
        };
        
        return {
          ...e,
          sourceHandle: `f${fromFace}`,
          targetHandle: `f${toFace}`,
          data: updatedData,
        };
      }
      return e;
    });
    
    setEdges(updatedEdges);
  };
  
  const handleDelete = () => {
    const updatedEdges = edges.filter(e => e.id !== edgeId);
    setEdges(updatedEdges);
    setSelectedEdgeId(null);
  };
  
  const handleRemoveCell = (cellToRemove: number) => {
    if (cells.length <= 1) {
      // If only one cell, delete the entire edge
      handleDelete();
      return;
    }
    setCells(cells.filter(c => c !== cellToRemove));
  };
  
  const handleAddCell = () => {
    // Find next available cell
    for (let i = 1; i <= maxCells; i++) {
      if (!cells.includes(i)) {
        setCells([...cells, i].sort((a, b) => a - b));
        return;
      }
    }
  };
  
  if (!isMultiCellConnection) {
    return (
      <Box p={2}>
        <Alert severity="info">
          This edge does not support editing. Only multi-cell connections can be edited.
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        height: '100%',
        borderLeft: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" fontWeight="600">
            Edge Properties
          </Typography>
          <IconButton size="small" onClick={handleDelete} color="error">
            <DeleteIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Side Connection
        </Typography>
      </Paper>
      
      <Box p={2}>
        {/* Connection Info */}
        <Paper elevation={1} sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
          <Typography variant="subtitle2" fontWeight="600" gutterBottom>
            Connection
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                From Node
              </Typography>
              <Typography variant="body1" fontWeight="600">
                {sourceNode?.data.componentName || 'Unknown'} ({sourceNode?.data.componentId.slice(0, 3) || 'N/A'})
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                To Node
              </Typography>
              <Typography variant="body1" fontWeight="600">
                {targetNode?.data.componentName || 'Unknown'} ({targetNode?.data.componentId.slice(0, 3) || 'N/A'})
              </Typography>
            </Grid>
          </Grid>
        </Paper>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Face Pair */}
        <Box mb={2}>
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
                SelectProps={{
                  native: true,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <option key={face} value={face}>
                    Face {face} {face === 1 ? '(Inlet)' : face === 2 ? '(Outlet)' : ''}
                  </option>
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
                SelectProps={{
                  native: true,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <option key={face} value={face}>
                    Face {face} {face === 1 ? '(Inlet)' : face === 2 ? '(Outlet)' : ''}
                  </option>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Cells */}
        <Box mb={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2" fontWeight="600">
              Cells ({cells.length})
            </Typography>
            <Button size="small" onClick={handleAddCell} disabled={cells.length >= maxCells}>
              Add Cell
            </Button>
          </Box>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {cells.map((cell) => (
              <Chip
                key={cell}
                label={`v${cell.toString().padStart(2, '0')}`}
                onDelete={() => handleRemoveCell(cell)}
                color="primary"
                size="small"
              />
            ))}
          </Box>
          {cells.length === 0 && (
            <Alert severity="warning">
              No cells selected. This edge will be deleted.
            </Alert>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Parameters */}
        <Box mb={2}>
          <Typography variant="subtitle2" fontWeight="600" gutterBottom>
            Parameters
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
        
        {/* Preview */}
        <Paper elevation={1} sx={{ p: 2, mb: 2, backgroundColor: '#e3f2fd' }}>
          <Typography variant="subtitle2" fontWeight="600" gutterBottom>
            Preview
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Label: {formatSideEdgeLabel({
              fromNodeId: edge.source,
              toNodeId: edge.target,
              fromFace: fromFace as 1|2|3|4|5|6,
              toFace: toFace as 1|2|3|4|5|6,
              cells: cells.sort((a, b) => a - b),
            })}
          </Typography>
        </Paper>
        
        {/* Actions */}
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default EdgePropertyPanel;

