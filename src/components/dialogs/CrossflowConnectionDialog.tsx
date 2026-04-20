/**
 * Crossflow Connection Dialog Component
 * Wizard dialog for creating crossflow connections through Junction components
 *
 * Architecture: Volume (From) → Junction (SNGLJUN/MTPLJUN/TMDPJUN/PUMP/VALVE) → Volume (To)
 * MARS Manual: CrossFlow connections REQUIRE junction components (Face 3-6)
 */

import { useState, useMemo, useEffect } from 'react';
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
  Divider,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { Node } from 'reactflow';
import { MARSNodeData, PipeParameters, MtpljunParameters, BranchParameters, TurbineParameters, ConnectionConfig, FaceType, CrossflowDialogInitialValues } from '@/types/mars';

interface CrossflowConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: ConnectionConfig) => void;
  onApply?: ((config: ConnectionConfig) => void) | null;
  initialValues?: CrossflowDialogInitialValues | null;
  sourceNodeId?: string | null;
  nodes: Node<MARSNodeData>[];
}

const CrossflowConnectionDialog: React.FC<CrossflowConnectionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  onApply,
  initialValues,
  sourceNodeId: _sourceNodeId,
  nodes,
}) => {
  // Filter junction nodes (standalone junctions + components with internal junctions)
  const junctionNodes = useMemo(() => {
    return nodes.filter(n =>
      n.data.componentType === 'sngljun' ||
      n.data.componentType === 'mtpljun' ||
      n.data.componentType === 'tmdpjun' ||
      n.data.componentType === 'pump' ||
      n.data.componentType === 'valve' ||
      n.data.componentType === 'branch' ||
      n.data.componentType === 'turbine'
    );
  }, [nodes]);

  // Filter volume nodes (PIPE, SNGLVOL, TMDPVOL, BRANCH, TURBINE)
  const volumeNodes = useMemo(() => {
    return nodes.filter(n =>
      n.data.componentType === 'pipe' ||
      n.data.componentType === 'snglvol' ||
      n.data.componentType === 'tmdpvol' ||
      n.data.componentType === 'branch' ||
      n.data.componentType === 'turbine'
    );
  }, [nodes]);

  // State - Step 1: Junction Selection
  const [selectedJunctionNodeId, setSelectedJunctionNodeId] = useState<string>('');
  const [junctionNumber, setJunctionNumber] = useState<number>(1);

  // State - Step 2: From Volume
  const [fromVolumeNodeId, setFromVolumeNodeId] = useState<string>('');
  const [fromCell, setFromCell] = useState<number>(1);
  const [fromFace, setFromFace] = useState<FaceType>(1);

  // State - Step 3: To Volume
  const [toVolumeNodeId, setToVolumeNodeId] = useState<string>('');
  const [toCell, setToCell] = useState<number>(1);
  const [toFace, setToFace] = useState<FaceType>(1);

  // State - Optional Parameters
  const [area, setArea] = useState<number>(0);
  const [fwdLoss, setFwdLoss] = useState<number>(0.5);
  const [revLoss, setRevLoss] = useState<number>(0.5);
  const [jefvcahs, setJefvcahs] = useState<string>('00000000');

  // Get selected nodes
  const selectedJunction = useMemo(() => {
    return junctionNodes.find(n => n.id === selectedJunctionNodeId);
  }, [junctionNodes, selectedJunctionNodeId]);

  const fromVolumeNode = useMemo(() => {
    return volumeNodes.find(n => n.id === fromVolumeNodeId);
  }, [volumeNodes, fromVolumeNodeId]);

  const toVolumeNode = useMemo(() => {
    return volumeNodes.find(n => n.id === toVolumeNodeId);
  }, [volumeNodes, toVolumeNodeId]);

  // Get njuns for multi-junction components (MTPLJUN, BRANCH, TURBINE)
  const isMultiJunction = selectedJunction && (
    selectedJunction.data.componentType === 'mtpljun' ||
    selectedJunction.data.componentType === 'branch' ||
    selectedJunction.data.componentType === 'turbine'
  );
  const njuns = useMemo(() => {
    if (!selectedJunction) return 1;
    const ct = selectedJunction.data.componentType;
    if (ct === 'mtpljun') {
      return (selectedJunction.data.parameters as Partial<MtpljunParameters>)?.njuns || 1;
    }
    if (ct === 'branch') {
      return (selectedJunction.data.parameters as Partial<BranchParameters>)?.njuns || 1;
    }
    if (ct === 'turbine') {
      return (selectedJunction.data.parameters as Partial<TurbineParameters>)?.njuns || 1;
    }
    return 1;
  }, [selectedJunction]);

  // Get ncells for From Volume
  const fromNcells = useMemo(() => {
    if (!fromVolumeNode) return 1;
    if (fromVolumeNode.data.componentType === 'pipe') {
      const params = fromVolumeNode.data.parameters as Partial<PipeParameters>;
      return params?.ncells || 1;
    }
    return 1;
  }, [fromVolumeNode]);

  // Get ncells for To Volume
  const toNcells = useMemo(() => {
    if (!toVolumeNode) return 1;
    if (toVolumeNode.data.componentType === 'pipe') {
      const params = toVolumeNode.data.parameters as Partial<PipeParameters>;
      return params?.ncells || 1;
    }
    return 1;
  }, [toVolumeNode]);

  // Apply initial values when dialog opens
  useEffect(() => {
    if (open && initialValues) {
      if (initialValues.junctionNodeId) {
        setSelectedJunctionNodeId(initialValues.junctionNodeId);
      }
      if (initialValues.fromVolumeNodeId) {
        setFromVolumeNodeId(initialValues.fromVolumeNodeId);
      }
      if (initialValues.fromCell !== undefined) {
        setFromCell(initialValues.fromCell);
      }
      if (initialValues.fromFace !== undefined) {
        setFromFace(initialValues.fromFace);
      }
      if (initialValues.toVolumeNodeId) {
        setToVolumeNodeId(initialValues.toVolumeNodeId);
      }
      if (initialValues.toCell !== undefined) {
        setToCell(initialValues.toCell);
      }
      if (initialValues.toFace !== undefined) {
        setToFace(initialValues.toFace);
      }
    }
  }, [open, initialValues]);

  // Validation — at least one side (From or To) must be valid
  // Face 0 (old format): cell 0=inlet side, cell 1=outlet side are both valid
  const hasValidFrom = !!(fromVolumeNodeId && (
    (fromFace === 0 && (fromCell === 0 || fromCell === 1)) ||
    (fromFace >= 1 && fromFace <= 6 && fromCell >= 1 && fromCell <= fromNcells)
  ));
  const hasValidTo = !!(toVolumeNodeId && (
    (toFace === 0 && (toCell === 0 || toCell === 1)) ||
    (toFace >= 1 && toFace <= 6 && toCell >= 1 && toCell <= toNcells)
  ));
  const isPartial = hasValidFrom !== hasValidTo; // exactly one side set

  const canConfirm = useMemo(() => {
    return !!(selectedJunctionNodeId && (hasValidFrom || hasValidTo));
  }, [selectedJunctionNodeId, hasValidFrom, hasValidTo]);

  const handleConfirm = () => {
    if (!canConfirm) return;

    const config: ConnectionConfig = {
      type: 'crossflow',
      // Junction 정보
      junctionNodeId: selectedJunctionNodeId,
      junctionNumber: isMultiJunction ? junctionNumber : undefined,
      // From Volume (empty string signals "not set" to the consumer)
      sourceNodeId: hasValidFrom ? fromVolumeNodeId : '',
      sourceCell: hasValidFrom ? fromCell : 0,
      sourceFace: hasValidFrom ? fromFace : 0 as FaceType,
      // To Volume
      targetNodeId: hasValidTo ? toVolumeNodeId : '',
      targetCell: hasValidTo ? toCell : 0,
      targetFace: hasValidTo ? toFace : 0 as FaceType,
      // Junction 파라미터
      area,
      fwdLoss,
      revLoss,
      jefvcahs,
    };

    // If onApply callback exists, call it (for form updates)
    // Otherwise, call onConfirm (for edge creation)
    if (onApply) {
      onApply(config);
    } else {
      onConfirm(config);
    }
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setSelectedJunctionNodeId('');
    setJunctionNumber(1);
    setFromVolumeNodeId('');
    setFromCell(1);
    setFromFace(1);
    setToVolumeNodeId('');
    setToCell(1);
    setToFace(1);
    setArea(0);
    setFwdLoss(0.5);
    setRevLoss(0.5);
    setJefvcahs('00000000');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6" component="span">
            CrossFlow 연결 생성
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3} pt={2}>
          {/* Info Alert */}
          <Alert severity="info">
            <strong>연결 구조:</strong> From Volume → Junction → To Volume
            <br />
            Junction 컴포넌트를 통해 Volume 간 연결을 생성합니다.
            <br />
            Face 0 (Old Format), Face 1-2 (Axial), Face 3-6 (CrossFlow)
          </Alert>

          {/* No junction nodes warning */}
          {junctionNodes.length === 0 && (
            <Alert severity="error">
              Junction 컴포넌트가 없습니다. SNGLJUN, MTPLJUN, TMDPJUN, PUMP, VALVE, BRANCH 또는 TURBINE을 먼저 추가하세요.
            </Alert>
          )}

          {/* No volume nodes warning */}
          {volumeNodes.length < 2 && (
            <Alert severity="warning">
              CrossFlow 연결을 생성하려면 최소 2개의 Volume 컴포넌트가 필요합니다. (현재: {volumeNodes.length}개)
            </Alert>
          )}

          {/* Step 1: Junction 선택 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              1. Junction 컴포넌트 선택 (필수)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Junction Component</InputLabel>
              <Select
                value={selectedJunctionNodeId}
                label="Junction Component"
                onChange={(e) => setSelectedJunctionNodeId(e.target.value)}
                disabled={junctionNodes.length === 0}
              >
                {junctionNodes.map(node => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.data.componentName || node.data.componentId} ({node.data.componentId}) [{node.data.componentType.toUpperCase()}]
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              캔버스에 있는 Junction/Pump/Valve/Branch/Turbine 컴포넌트를 선택하세요
            </Typography>
          </Box>

          {/* Step 2: Junction Number (MTPLJUN/BRANCH/TURBINE) */}
          {isMultiJunction && (
            <Box>
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                2. Junction 번호 선택 ({selectedJunction?.data.componentType.toUpperCase()})
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Junction Number</InputLabel>
                <Select
                  value={junctionNumber}
                  label="Junction Number"
                  onChange={(e) => setJunctionNumber(Number(e.target.value))}
                >
                  {Array.from({ length: njuns }, (_, i) => i + 1).map(jNum => (
                    <MenuItem key={jNum} value={jNum}>
                      Junction {jNum.toString().padStart(2, '0')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {selectedJunction?.data.componentType.toUpperCase()}의 {njuns}개 Junction 중 선택
              </Typography>
            </Box>
          )}

          <Divider />

          {/* Step 3: From Volume 선택 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              3. From Volume (원본 Volume)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>From Volume</InputLabel>
              <Select
                value={fromVolumeNodeId}
                label="From Volume"
                onChange={(e) => setFromVolumeNodeId(e.target.value)}
                disabled={volumeNodes.length === 0}
              >
                {volumeNodes.map(node => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.data.componentName || node.data.componentId} ({node.data.componentId}) [{node.data.componentType.toUpperCase()}]
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* From Cell and Face */}
          {fromVolumeNodeId && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                {fromFace === 0 ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>From Side</InputLabel>
                    <Select
                      value={fromCell}
                      label="From Side"
                      onChange={(e) => setFromCell(Number(e.target.value))}
                    >
                      <MenuItem value={0}>Inlet Side (CCC000000)</MenuItem>
                      <MenuItem value={1}>Outlet Side (CCC010000)</MenuItem>
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    label="From Cell/Volume"
                    type="number"
                    size="small"
                    fullWidth
                    value={fromCell}
                    onChange={(e) => setFromCell(Math.max(1, Math.min(fromNcells, parseInt(e.target.value) || 1)))}
                    inputProps={{ min: 1, max: fromNcells }}
                    helperText={`1 ~ ${fromNcells}`}
                  />
                )}
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>From Face</InputLabel>
                  <Select
                    value={fromFace}
                    label="From Face"
                    onChange={(e) => {
                      const newFace = e.target.value as FaceType;
                      setFromFace(newFace);
                      if (newFace === 0) setFromCell(0);
                      else if (fromFace === 0) setFromCell(1);
                    }}
                  >
                    <MenuItem value={0}>Face 0 (Auto - Old Format)</MenuItem>
                    <MenuItem value={1}>Face 1 (Inlet, Axial)</MenuItem>
                    <MenuItem value={2}>Face 2 (Outlet, Axial)</MenuItem>
                    <MenuItem value={3}>Face 3 (y−, CrossFlow)</MenuItem>
                    <MenuItem value={4}>Face 4 (y+, CrossFlow)</MenuItem>
                    <MenuItem value={5}>Face 5 (z−, CrossFlow)</MenuItem>
                    <MenuItem value={6}>Face 6 (z+, CrossFlow)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          <Divider />

          {/* Step 4: To Volume 선택 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              4. To Volume (대상 Volume)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>To Volume</InputLabel>
              <Select
                value={toVolumeNodeId}
                label="To Volume"
                onChange={(e) => setToVolumeNodeId(e.target.value)}
                disabled={volumeNodes.length === 0}
              >
                {volumeNodes.map(node => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.data.componentName || node.data.componentId} ({node.data.componentId}) [{node.data.componentType.toUpperCase()}]
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* To Cell and Face */}
          {toVolumeNodeId && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                {toFace === 0 ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>To Side</InputLabel>
                    <Select
                      value={toCell}
                      label="To Side"
                      onChange={(e) => setToCell(Number(e.target.value))}
                    >
                      <MenuItem value={0}>Inlet Side (CCC000000)</MenuItem>
                      <MenuItem value={1}>Outlet Side (CCC010000)</MenuItem>
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    label="To Cell/Volume"
                    type="number"
                    size="small"
                    fullWidth
                    value={toCell}
                    onChange={(e) => setToCell(Math.max(1, Math.min(toNcells, parseInt(e.target.value) || 1)))}
                    inputProps={{ min: 1, max: toNcells }}
                    helperText={`1 ~ ${toNcells}`}
                  />
                )}
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>To Face</InputLabel>
                  <Select
                    value={toFace}
                    label="To Face"
                    onChange={(e) => {
                      const newFace = e.target.value as FaceType;
                      setToFace(newFace);
                      if (newFace === 0) setToCell(0);
                      else if (toFace === 0) setToCell(1);
                    }}
                  >
                    <MenuItem value={0}>Face 0 (Auto - Old Format)</MenuItem>
                    <MenuItem value={1}>Face 1 (Inlet, Axial)</MenuItem>
                    <MenuItem value={2}>Face 2 (Outlet, Axial)</MenuItem>
                    <MenuItem value={3}>Face 3 (y−, CrossFlow)</MenuItem>
                    <MenuItem value={4}>Face 4 (y+, CrossFlow)</MenuItem>
                    <MenuItem value={5}>Face 5 (z−, CrossFlow)</MenuItem>
                    <MenuItem value={6}>Face 6 (z+, CrossFlow)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          <Divider />

          {/* Junction Parameters */}
          <Box>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Junction 파라미터
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Junction Area"
                  type="number"
                  size="small"
                  fullWidth
                  value={area}
                  onChange={(e) => setArea(parseFloat(e.target.value) || 0)}
                  helperText="0 = Auto (자동 계산)"
                  InputProps={{ endAdornment: <Box component="span" sx={{ color: 'text.secondary' }}>m²</Box> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="jefvcahs Flags"
                  size="small"
                  fullWidth
                  value={jefvcahs}
                  onChange={(e) => setJefvcahs(e.target.value)}
                  inputProps={{ maxLength: 8 }}
                  helperText="8-digit flags"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Forward Loss Coefficient"
                  type="number"
                  size="small"
                  fullWidth
                  value={fwdLoss}
                  onChange={(e) => setFwdLoss(parseFloat(e.target.value) || 0)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Reverse Loss Coefficient"
                  type="number"
                  size="small"
                  fullWidth
                  value={revLoss}
                  onChange={(e) => setRevLoss(parseFloat(e.target.value) || 0)}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Summary */}
          {canConfirm && (
            <Alert severity={isPartial ? 'info' : 'success'}>
              <Typography variant="body2">
                <strong>{isPartial ? '부분 연결 설정:' : '연결 요약:'}</strong>
                <br />
                {hasValidFrom
                  ? <>From: {fromVolumeNode?.data.componentName} Cell {fromCell} Face {fromFace}</>
                  : <>From: <em>미설정</em></>}
                <br />
                Junction: {selectedJunction?.data.componentName}
                {isMultiJunction && ` (J${junctionNumber})`}
                <br />
                {hasValidTo
                  ? <>To: {toVolumeNode?.data.componentName} Cell {toCell} Face {toFace}</>
                  : <>To: <em>미설정</em></>}
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          취소
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!canConfirm}
        >
          연결 생성
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CrossflowConnectionDialog;
