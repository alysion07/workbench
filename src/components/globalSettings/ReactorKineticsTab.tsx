/**
 * Reactor Kinetics Tab
 * Cards 30000000 series: Point Reactor Kinetics
 * Supports: point + separable/non-separable feedback
 */

import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AddCircleOutline as AddRowIcon,
  RemoveCircleOutline as RemoveRowIcon,
} from '@mui/icons-material';
import { NumericTextField } from '@/components/common/NumericTextField';
import type { Node } from 'reactflow';
import type { PointReactorKinetics, ReactivityDataPoint, WeightingFactor, GeneralTable, MARSNodeData } from '@/types/mars';

interface ReactorKineticsTabProps {
  kinetics: PointReactorKinetics;
  onChange: (kinetics: PointReactorKinetics) => void;
  generalTables: GeneralTable[];
  nodes: Node<MARSNodeData>[];
}

// Helper: get hydrodynamic volume component IDs from nodes
function getVolumeOptions(nodes: Node<MARSNodeData>[]): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  const hydroTypes = ['snglvol', 'pipe', 'branch', 'tmdpvol'];
  nodes.forEach(node => {
    if (hydroTypes.includes(node.data.componentType) && node.data.componentId) {
      const cid = node.data.componentId;
      const name = node.data.componentName || cid;
      // Volume reference format: CCC0V0000 (PIPE: each cell), CCC010000 (single vol)
      if (node.data.componentType === 'pipe') {
        const params = node.data.parameters;
        if (params && 'ncells' in params && typeof params.ncells === 'number') {
          for (let i = 1; i <= params.ncells; i++) {
            const volNum = i.toString().padStart(2, '0');
            const volId = `${cid.slice(0, 3)}${volNum}0000`;
            options.push({ id: volId, label: `${volId} (${name}, Vol ${volNum})` });
          }
        }
      } else {
        const volId = `${cid.slice(0, 3)}010000`;
        options.push({ id: volId, label: `${volId} (${name})` });
      }
    }
  });
  return options;
}

// Helper: get heat structure IDs from nodes
function getHeatStructureOptions(nodes: Node<MARSNodeData>[]): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  nodes.forEach(node => {
    if (node.data.componentType === 'htstr' && node.data.componentId) {
      const cid = node.data.componentId;
      const name = node.data.componentName || cid;
      // Heat Structure ID format: CCCG0NN (7 digits)
      const shortId = cid.slice(0, 4); // first 4 digits
      const params = node.data.parameters;
      if (params && 'numAxialNodes' in params && typeof params.numAxialNodes === 'number') {
        for (let i = 1; i <= params.numAxialNodes; i++) {
          const nodeNum = i.toString().padStart(3, '0');
          const hsId = `${shortId}${nodeNum}`;
          options.push({ id: hsId, label: `${hsId} (${name}, Node ${i})` });
        }
      } else {
        const hsId = `${shortId}001`;
        options.push({ id: hsId, label: `${hsId} (${name})` });
      }
    }
  });
  return options;
}

export const ReactorKineticsTab: React.FC<ReactorKineticsTabProps> = ({
  kinetics,
  onChange,
  generalTables,
  nodes,
}) => {
  const volumeOptions = getVolumeOptions(nodes);
  const hsOptions = getHeatStructureOptions(nodes);

  const update = (partial: Partial<PointReactorKinetics>) => {
    onChange({ ...kinetics, ...partial });
  };

  // Reactivity data point operations
  const updateReactivityTable = (
    field: 'moderatorDensityReactivity' | 'dopplerReactivity',
    points: ReactivityDataPoint[]
  ) => {
    update({ [field]: points });
  };

  const addReactivityPoint = (field: 'moderatorDensityReactivity' | 'dopplerReactivity') => {
    const current = kinetics[field];
    const last = current[current.length - 1];
    update({ [field]: [...current, { value: last ? last.value + 100 : 0, reactivity: 0 }] });
  };

  const removeReactivityPoint = (field: 'moderatorDensityReactivity' | 'dopplerReactivity', idx: number) => {
    const current = kinetics[field];
    if (current.length <= 1) return;
    update({ [field]: current.filter((_, i) => i !== idx) });
  };

  // Weighting factor operations
  const updateWeightingFactors = (
    field: 'densityWeightingFactors' | 'dopplerWeightingFactors',
    factors: WeightingFactor[]
  ) => {
    update({ [field]: factors });
  };

  const addWeightingFactor = (field: 'densityWeightingFactors' | 'dopplerWeightingFactors') => {
    const current = kinetics[field];
    update({
      [field]: [...current, { componentId: '', increment: 0, factor: 0, coefficient: 0 }],
    });
  };

  const removeWeightingFactor = (field: 'densityWeightingFactors' | 'dopplerWeightingFactors', idx: number) => {
    update({ [field]: kinetics[field].filter((_, i) => i !== idx) });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Point Reactor Kinetics (30000000)</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={kinetics.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
          }
          label="활성화"
        />
      </Box>

      {!kinetics.enabled ? (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            Reactor Kinetics가 비활성화 상태입니다. 활성화하면 30000000 시리즈 카드가 생성됩니다.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 30000000 - Basic Settings */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">기본 설정 (30000000)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Kinetics Type" size="small" fullWidth value="point" disabled />
                </Grid>
                <Grid item xs={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Feedback Type</InputLabel>
                    <Select
                      label="Feedback Type"
                      value={kinetics.feedbackType}
                      onChange={(e) => update({ feedbackType: e.target.value as PointReactorKinetics['feedbackType'] })}
                    >
                      <MenuItem value="separabl">separabl (분리형)</MenuItem>
                      <MenuItem value="nonseparabl">nonseparabl (비분리형)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* 30000001 - Neutron Physics */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">중성자 물리 (30000001)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Decay Type" size="small" fullWidth value="gamma-ac" disabled />
                </Grid>
                <Grid item xs={6}>
                  <NumericTextField
                    label="초기 출력 (W)"
                    size="small"
                    fullWidth
                    value={kinetics.power}
                    onChange={(num) => update({ power: num })}
                  />
                </Grid>
                <Grid item xs={4}>
                  <NumericTextField
                    label="초기 반응도 ($)"
                    size="small"
                    fullWidth
                    value={kinetics.reactivity}
                    onChange={(num) => update({ reactivity: num })}
                  />
                </Grid>
                <Grid item xs={4}>
                  <NumericTextField
                    label="1/Λ (1/s)"
                    size="small"
                    fullWidth
                    value={kinetics.inverseLambda}
                    onChange={(num) => update({ inverseLambda: num })}
                    helperText="Λ = 평균 중성자 수명"
                  />
                </Grid>
                <Grid item xs={4}>
                  <NumericTextField
                    label="FPYF"
                    size="small"
                    fullWidth
                    value={kinetics.fpyf}
                    onChange={(num) => update({ fpyf: num })}
                    helperText="Fission product yield fraction"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* 30000002 - Decay Heat */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">붕괴열 (30000002)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="ANS Standard" size="small" fullWidth value="ans79-1" disabled />
                </Grid>
                <Grid item xs={6}>
                  <NumericTextField
                    label="추가 붕괴열 (W)"
                    size="small"
                    fullWidth
                    value={kinetics.additionalDecayHeat}
                    onChange={(num) => update({ additionalDecayHeat: num })}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* 30000011 - External Reactivity */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">외부 반응도 (30000011)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl size="small" fullWidth>
                <InputLabel>General Table 참조</InputLabel>
                <Select
                  label="General Table 참조"
                  value={kinetics.externalReactivityTableNumber ?? ''}
                  onChange={(e) =>
                    update({
                      externalReactivityTableNumber: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                >
                  <MenuItem value="">
                    <em>없음</em>
                  </MenuItem>
                  {generalTables.map((gt) => (
                    <MenuItem key={gt.tableNumber} value={gt.tableNumber}>
                      GT{gt.tableNumber} - {gt.name || '(이름 없음)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </AccordionDetails>
          </Accordion>

          {/* 3000050N - Moderator Density Reactivity */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                감속재 밀도 반응도 (3000050N) — {kinetics.moderatorDensityReactivity.length}개 포인트
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button size="small" startIcon={<AddRowIcon />} onClick={() => addReactivityPoint('moderatorDensityReactivity')}>
                  행 추가
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 50 }}>#</TableCell>
                      <TableCell>밀도 (kg/m³)</TableCell>
                      <TableCell>반응도 ($)</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kinetics.moderatorDensityReactivity.map((dp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <NumericTextField
                            size="small" variant="standard" fullWidth
                            value={dp.value}
                            onChange={(num) => {
                              const updated = [...kinetics.moderatorDensityReactivity];
                              updated[idx] = { ...dp, value: num };
                              updateReactivityTable('moderatorDensityReactivity', updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <NumericTextField
                            size="small" variant="standard" fullWidth
                            value={dp.reactivity}
                            onChange={(num) => {
                              const updated = [...kinetics.moderatorDensityReactivity];
                              updated[idx] = { ...dp, reactivity: num };
                              updateReactivityTable('moderatorDensityReactivity', updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeReactivityPoint('moderatorDensityReactivity', idx)}
                            disabled={kinetics.moderatorDensityReactivity.length <= 1}>
                            <RemoveRowIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          {/* 3000060N - Doppler Reactivity */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                도플러 반응도 (3000060N) — {kinetics.dopplerReactivity.length}개 포인트
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button size="small" startIcon={<AddRowIcon />} onClick={() => addReactivityPoint('dopplerReactivity')}>
                  행 추가
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 50 }}>#</TableCell>
                      <TableCell>온도 (K)</TableCell>
                      <TableCell>반응도 ($)</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kinetics.dopplerReactivity.map((dp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <NumericTextField
                            size="small" variant="standard" fullWidth
                            value={dp.value}
                            onChange={(num) => {
                              const updated = [...kinetics.dopplerReactivity];
                              updated[idx] = { ...dp, value: num };
                              updateReactivityTable('dopplerReactivity', updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <NumericTextField
                            size="small" variant="standard" fullWidth
                            value={dp.reactivity}
                            onChange={(num) => {
                              const updated = [...kinetics.dopplerReactivity];
                              updated[idx] = { ...dp, reactivity: num };
                              updateReactivityTable('dopplerReactivity', updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeReactivityPoint('dopplerReactivity', idx)}
                            disabled={kinetics.dopplerReactivity.length <= 1}>
                            <RemoveRowIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          {/* 3000070N - Density Weighting Factors */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                밀도 가중치 인수 (3000070N) — {kinetics.densityWeightingFactors.length}개
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button size="small" startIcon={<AddRowIcon />} onClick={() => addWeightingFactor('densityWeightingFactors')}>
                  행 추가
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 50 }}>#</TableCell>
                      <TableCell>Volume</TableCell>
                      <TableCell sx={{ width: 80 }}>증분</TableCell>
                      <TableCell sx={{ width: 100 }}>인수</TableCell>
                      <TableCell sx={{ width: 100 }}>계수</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kinetics.densityWeightingFactors.map((wf, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={volumeOptions}
                            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
                            value={volumeOptions.find(o => o.id === wf.componentId) || null}
                            onChange={(_, newVal) => {
                              const updated = [...kinetics.densityWeightingFactors];
                              updated[idx] = { ...wf, componentId: typeof newVal === 'string' ? newVal : newVal?.id || '' };
                              updateWeightingFactors('densityWeightingFactors', updated);
                            }}
                            freeSolo
                            renderInput={(params) => <TextField {...params} variant="standard" placeholder="Volume ID" />}
                            onInputChange={(_, value) => {
                              if (!volumeOptions.find(o => o.id === value)) {
                                const updated = [...kinetics.densityWeightingFactors];
                                updated[idx] = { ...wf, componentId: value };
                                updateWeightingFactors('densityWeightingFactors', updated);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" variant="standard" fullWidth value={wf.increment}
                            onChange={(e) => {
                              const updated = [...kinetics.densityWeightingFactors];
                              updated[idx] = { ...wf, increment: parseInt(e.target.value) || 0 };
                              updateWeightingFactors('densityWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumericTextField size="small" variant="standard" fullWidth value={wf.factor}
                            onChange={(num) => {
                              const updated = [...kinetics.densityWeightingFactors];
                              updated[idx] = { ...wf, factor: num };
                              updateWeightingFactors('densityWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumericTextField size="small" variant="standard" fullWidth value={wf.coefficient}
                            onChange={(num) => {
                              const updated = [...kinetics.densityWeightingFactors];
                              updated[idx] = { ...wf, coefficient: num };
                              updateWeightingFactors('densityWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeWeightingFactor('densityWeightingFactors', idx)}>
                            <RemoveRowIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          {/* 3000080N - Doppler Weighting Factors */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                도플러 가중치 인수 (3000080N) — {kinetics.dopplerWeightingFactors.length}개
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button size="small" startIcon={<AddRowIcon />} onClick={() => addWeightingFactor('dopplerWeightingFactors')}>
                  행 추가
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 50 }}>#</TableCell>
                      <TableCell>Heat Structure</TableCell>
                      <TableCell sx={{ width: 80 }}>증분</TableCell>
                      <TableCell sx={{ width: 100 }}>인수</TableCell>
                      <TableCell sx={{ width: 100 }}>계수</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kinetics.dopplerWeightingFactors.map((wf, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={hsOptions}
                            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
                            value={hsOptions.find(o => o.id === wf.componentId) || null}
                            onChange={(_, newVal) => {
                              const updated = [...kinetics.dopplerWeightingFactors];
                              updated[idx] = { ...wf, componentId: typeof newVal === 'string' ? newVal : newVal?.id || '' };
                              updateWeightingFactors('dopplerWeightingFactors', updated);
                            }}
                            freeSolo
                            renderInput={(params) => <TextField {...params} variant="standard" placeholder="HS ID" />}
                            onInputChange={(_, value) => {
                              if (!hsOptions.find(o => o.id === value)) {
                                const updated = [...kinetics.dopplerWeightingFactors];
                                updated[idx] = { ...wf, componentId: value };
                                updateWeightingFactors('dopplerWeightingFactors', updated);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" variant="standard" fullWidth value={wf.increment}
                            onChange={(e) => {
                              const updated = [...kinetics.dopplerWeightingFactors];
                              updated[idx] = { ...wf, increment: parseInt(e.target.value) || 0 };
                              updateWeightingFactors('dopplerWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumericTextField size="small" variant="standard" fullWidth value={wf.factor}
                            onChange={(num) => {
                              const updated = [...kinetics.dopplerWeightingFactors];
                              updated[idx] = { ...wf, factor: num };
                              updateWeightingFactors('dopplerWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <NumericTextField size="small" variant="standard" fullWidth value={wf.coefficient}
                            onChange={(num) => {
                              const updated = [...kinetics.dopplerWeightingFactors];
                              updated[idx] = { ...wf, coefficient: num };
                              updateWeightingFactors('dopplerWeightingFactors', updated);
                            }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeWeightingFactor('dopplerWeightingFactors', idx)}>
                            <RemoveRowIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
};
