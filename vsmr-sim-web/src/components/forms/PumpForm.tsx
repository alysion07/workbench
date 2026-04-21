import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  Autocomplete,
  Chip,
  InputAdornment,
  MenuItem,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { PumpParameters, VolumeReference, MARSNodeData, PumpCurve, PumpSpeedControl, PipeParameters } from '@/types/mars';
import ComponentIdField from './ComponentIdField';
import { HomologousCurveDialog } from '../pump/HomologousCurveDialog';
import { SpeedControlDialog } from '../pump/SpeedControlDialog';
import { getDefaultHomologousCurves } from '@/utils/pumpDefaults';
import { NodeIdResolver } from '@/utils/nodeIdResolver';

// Validation Schema
const pumpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Geometry
  area: z.number().nonnegative('Must be non-negative'),
  length: z.number().nonnegative('Must be non-negative'),
  volume: z.number().positive('Volume must be positive'),
  azAngle: z.number(),
  incAngle: z.number(),
  dz: z.number(),

  // Junction areas
  inletArea: z.number().nonnegative('Must be non-negative'),
  outletArea: z.number().nonnegative('Must be non-negative'),
  inletFwdLoss: z.number().nonnegative('Must be non-negative'),
  inletRevLoss: z.number().nonnegative('Must be non-negative'),
  outletFwdLoss: z.number().nonnegative('Must be non-negative'),
  outletRevLoss: z.number().nonnegative('Must be non-negative'),

  // Initial Conditions
  pressure: z.number().positive('Pressure must be positive'),
  temperature: z.number().positive('Temperature must be positive'),
  inletLiquidFlow: z.number(),
  inletVaporFlow: z.number(),
  outletLiquidFlow: z.number(),
  outletVaporFlow: z.number(),

  // Pump Characteristics
  ratedSpeed: z.number().positive('Rated speed must be positive'),
  initialSpeedRatio: z.number().positive('Speed ratio must be positive'),
  ratedFlow: z.number().positive('Rated flow must be positive'),
  ratedHead: z.number().positive('Rated head must be positive'),
  ratedTorque: z.number().nonnegative('Must be non-negative'),
  momentOfInertia: z.number().positive('Moment of inertia must be positive'),
  ratedDensity: z.number().nonnegative('Must be non-negative'),
  ratedMotorTorque: z.number().nonnegative('Must be non-negative'),

  // Friction coefficients
  frictionTF0: z.number(),
  frictionTF1: z.number(),
  frictionTF2: z.number(),
  frictionTF3: z.number(),

  // Options
  tbli: z.number(),
  twophase: z.number(),
  tdiff: z.number(),
  mtorq: z.number(),
  tdvel: z.number(),
  ptrip: z.number(),
  rev: z.number(),
});

type FormData = z.infer<typeof pumpSchema>;

interface PumpFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const PumpForm: React.FC<PumpFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, nodes, setPropertyFormState, setFormSubmitHandler, getGlobalSettings, openGlobalSettingsDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, nodes: state.nodes, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, getGlobalSettings: state.getGlobalSettings, openGlobalSettingsDialog: state.openGlobalSettingsDialog })));

  // Get available Variable Trips from Global Settings
  const availableTrips = useMemo(() => {
    const settings = getGlobalSettings();
    const variableTrips = settings?.variableTrips || [];
    const logicTrips = settings?.logicTrips || [];
    return { variableTrips, logicTrips, all: [...variableTrips, ...logicTrips] };
  }, [getGlobalSettings]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(pumpSchema),
    defaultValues: {
      name: '',
      area: 4.0,
      length: 0.0,
      volume: 0.236,
      azAngle: 0,
      incAngle: 0,
      dz: 0,
      inletArea: 0.36,
      outletArea: 0.36,
      inletFwdLoss: 1.173,
      inletRevLoss: 4.408,
      outletFwdLoss: 1.173,
      outletRevLoss: 4.408,
      pressure: 15.15e6,
      temperature: 596.15,
      inletLiquidFlow: 2507.0,
      inletVaporFlow: 0.0,
      outletLiquidFlow: 2507.0,
      outletVaporFlow: 0.0,
      ratedSpeed: 123.5693,
      initialSpeedRatio: 1.0,
      ratedFlow: 1.0667,
      ratedHead: 30.3,
      ratedTorque: 2654.0,
      momentOfInertia: 16.0,
      ratedDensity: 676.0,
      ratedMotorTorque: 0.0,
      frictionTF0: 0.0,
      frictionTF1: 0.0,
      frictionTF2: 0.0,
      frictionTF3: 0.0,
      tbli: 0,
      twophase: -1,
      tdiff: -3,
      mtorq: -1,
      tdvel: -1,
      ptrip: 0,
      rev: 0,
    },
  });

  // Homologous Curves state (별도 관리)
  const [homologousCurves, setHomologousCurves] = useState<PumpCurve[]>(
    getDefaultHomologousCurves()
  );
  const [curveDialogOpen, setCurveDialogOpen] = useState(false);

  // Speed Control state (별도 관리)
  const [speedControl, setSpeedControl] = useState<PumpSpeedControl | undefined>(undefined);
  const [speedControlDialogOpen, setSpeedControlDialogOpen] = useState(false);
  const initialSpeedControlRef = useRef<string | undefined>(undefined);

  // Reset form when nodeId changes
  useEffect(() => {
    const params = data.parameters as Partial<PumpParameters>;
    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      area: params?.area ?? 4.0,
      length: params?.length ?? 0.0,
      volume: params?.volume ?? 0.236,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 0,
      dz: params?.dz ?? 0,
      inletArea: params?.inletArea ?? 0.36,
      outletArea: params?.outletArea ?? 0.36,
      inletFwdLoss: params?.inletFwdLoss ?? 1.173,
      inletRevLoss: params?.inletRevLoss ?? 4.408,
      outletFwdLoss: params?.outletFwdLoss ?? 1.173,
      outletRevLoss: params?.outletRevLoss ?? 4.408,
      pressure: params?.pressure ?? 15.15e6,
      temperature: params?.temperature ?? 596.15,
      inletLiquidFlow: params?.inletLiquidFlow ?? 2507.0,
      inletVaporFlow: params?.inletVaporFlow ?? 0.0,
      outletLiquidFlow: params?.outletLiquidFlow ?? 2507.0,
      outletVaporFlow: params?.outletVaporFlow ?? 0.0,
      ratedSpeed: params?.ratedSpeed ?? 123.5693,
      initialSpeedRatio: params?.initialSpeedRatio ?? 1.0,
      ratedFlow: params?.ratedFlow ?? 1.0667,
      ratedHead: params?.ratedHead ?? 30.3,
      ratedTorque: params?.ratedTorque ?? 2654.0,
      momentOfInertia: params?.momentOfInertia ?? 16.0,
      ratedDensity: params?.ratedDensity ?? 676.0,
      ratedMotorTorque: params?.ratedMotorTorque ?? 0.0,
      frictionTF0: params?.frictionTF0 ?? 0.0,
      frictionTF1: params?.frictionTF1 ?? 0.0,
      frictionTF2: params?.frictionTF2 ?? 0.0,
      frictionTF3: params?.frictionTF3 ?? 0.0,
      tbli: params?.tbli ?? 0,
      twophase: params?.twophase ?? -1,
      tdiff: params?.tdiff ?? -3,
      mtorq: params?.mtorq ?? -1,
      tdvel: params?.tdvel ?? -1,
      ptrip: params?.ptrip ?? 0,
      rev: params?.rev ?? 0,
    });

    // Homologous Curves 초기화
    setHomologousCurves(
      params?.homologousCurves ?? getDefaultHomologousCurves()
    );

    // Speed Control 초기화
    const initialSC = params?.speedControl ?? undefined;
    setSpeedControl(initialSC);
    initialSpeedControlRef.current = JSON.stringify(initialSC);
  }, [nodeId, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Available volumes for connection
  const availableVolumes = useMemo(() => {
    const options: Array<{
      ref: VolumeReference;
      volumeId: string;
      label: string;
      componentName: string;
    }> = [];

    nodes.forEach((node) => {
      const compId = node.data.componentId.slice(0, 3);

      if (node.data.componentType === 'pipe') {
        // PIPE: 모든 셀에 대해 옵션 생성
        const params = node.data.parameters as Partial<PipeParameters>;
        const ncells = params?.ncells || 1;

        for (let cellNum = 1; cellNum <= ncells; cellNum++) {
          const cellStr = cellNum.toString().padStart(2, '0');

          // Outlet (Face 2) for inlet connection
          options.push({
            ref: { nodeId: node.id, volumeNum: cellNum, face: 2 },
            volumeId: `${compId}${cellStr}0002`,
            label: `${node.data.componentName || 'Unnamed'} - Cell ${cellStr} Outlet`,
            componentName: node.data.componentName || 'Unnamed',
          });

          // Inlet (Face 1) for outlet connection
          options.push({
            ref: { nodeId: node.id, volumeNum: cellNum, face: 1 },
            volumeId: `${compId}${cellStr}0001`,
            label: `${node.data.componentName || 'Unnamed'} - Cell ${cellStr} Inlet`,
            componentName: node.data.componentName || 'Unnamed',
          });
        }
      } else if (['snglvol', 'tmdpvol', 'branch'].includes(node.data.componentType)) {
        // 단일 볼륨 컴포넌트: 기존 로직 유지
        // Outlet for inlet connection
        options.push({
          ref: { nodeId: node.id, volumeNum: 1, face: 2 },
          volumeId: `${compId}010002`,
          label: `${node.data.componentName || 'Unnamed'} - Outlet`,
          componentName: node.data.componentName || 'Unnamed',
        });

        // Inlet for outlet connection
        options.push({
          ref: { nodeId: node.id, volumeNum: 1, face: 1 },
          volumeId: `${compId}010001`,
          label: `${node.data.componentName || 'Unnamed'} - Inlet`,
          componentName: node.data.componentName || 'Unnamed',
        });
      }
    });

    return options;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest]);

  // Resolver for volume ID generation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Helper: Build a crossflow display option for face 3-6 refs not in availableVolumes
  const crossflowFaceLabels: Record<number, string> = { 3: 'y-', 4: 'y+', 5: 'z-', 6: 'z+' };
  const buildCrossflowOption = (ref: VolumeReference | null | undefined) => {
    if (!ref || !ref.nodeId || !ref.face || ref.face < 3) return null;
    const node = nodes.find(n => n.id === ref.nodeId);
    if (!node) return null;
    const compName = node.data.componentName || 'Unknown';
    const volumeId = resolver.getVolumeIdFromReference(ref) || '';
    const faceLabel = crossflowFaceLabels[ref.face] || `Face ${ref.face}`;
    return {
      ref,
      volumeId,
      label: `${compName} - ${faceLabel} CrossFlow`,
      componentName: compName,
    };
  };

  // Helper: Build an Old Format display option for face=0 refs
  const buildOldFormatOption = (ref: VolumeReference | null | undefined) => {
    if (!ref || !ref.nodeId || ref.face !== 0) return null;
    const node = nodes.find(n => n.id === ref.nodeId);
    if (!node) return null;
    const compName = node.data.componentName || 'Unknown';
    const volumeId = resolver.getVolumeIdFromReference(ref) || '';
    const side = ref.volumeNum === 0 ? 'Inlet Side' : 'Outlet Side';
    return {
      ref,
      volumeId,
      label: `${compName} - Old Format (${side})`,
      componentName: compName,
    };
  };

  const refsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
  };

  const onSubmit = (formData: FormData) => {
    const params = data.parameters as Partial<PumpParameters>;

    // Validation
    const validationErrors: string[] = [];
    if (!params.inletConnection) validationErrors.push('Inlet connection required');
    if (!params.outletConnection) validationErrors.push('Outlet connection required');

    const status = validationErrors.length === 0 ? 'valid' : 'error';

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      parameters: {
        ...params,
        name: formData.name,
        area: formData.area,
        length: formData.length,
        volume: formData.volume,
        azAngle: formData.azAngle,
        incAngle: formData.incAngle,
        dz: formData.dz,
        tlpvbfe: params?.tlpvbfe || '0000000',
        inletArea: formData.inletArea,
        outletArea: formData.outletArea,
        inletFwdLoss: formData.inletFwdLoss,
        inletRevLoss: formData.inletRevLoss,
        outletFwdLoss: formData.outletFwdLoss,
        outletRevLoss: formData.outletRevLoss,
        inletJefvcahs: params?.inletJefvcahs || '00000000',
        outletJefvcahs: params?.outletJefvcahs || '00000000',
        ebt: params?.ebt || '003',
        pressure: formData.pressure,
        temperature: formData.temperature,
        inletFlowMode: params?.inletFlowMode ?? 1,
        inletLiquidFlow: formData.inletLiquidFlow,
        inletVaporFlow: formData.inletVaporFlow,
        outletFlowMode: params?.outletFlowMode ?? 1,
        outletLiquidFlow: formData.outletLiquidFlow,
        outletVaporFlow: formData.outletVaporFlow,
        tbli: formData.tbli,
        twophase: formData.twophase,
        tdiff: formData.tdiff,
        mtorq: formData.mtorq,
        tdvel: formData.tdvel,
        ptrip: formData.ptrip,
        rev: formData.rev,
        ratedSpeed: formData.ratedSpeed,
        initialSpeedRatio: formData.initialSpeedRatio,
        ratedFlow: formData.ratedFlow,
        ratedHead: formData.ratedHead,
        ratedTorque: formData.ratedTorque,
        momentOfInertia: formData.momentOfInertia,
        ratedDensity: formData.ratedDensity,
        ratedMotorTorque: formData.ratedMotorTorque,
        frictionTF0: formData.frictionTF0,
        frictionTF1: formData.frictionTF1,
        frictionTF2: formData.frictionTF2,
        frictionTF3: formData.frictionTF3,
        // Homologous Curves
        homologousCurves,
        // Speed Control
        speedControl,
      },
      status,
      errors: validationErrors.map((msg) => ({ level: 'error' as const, message: msg })),
    });
  };

  // Register form submit handler
  // speedControl, homologousCurves는 react-hook-form 외부 state이므로
  // deps에 포함하여 클로저가 최신 값을 캡쳐하도록 함
  useEffect(() => {
    const handler = () => {
      handleSubmit(onSubmit, () => onSubmit(getValues()))();
    };
    setFormSubmitHandler(handler);
    return () => {
      setFormSubmitHandler(null);
    };
  }, [handleSubmit, setFormSubmitHandler, getValues, speedControl, homologousCurves]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSpeedControlDirty = JSON.stringify(speedControl) !== initialSpeedControlRef.current;

  useEffect(() => {
    setPropertyFormState({
      isDirty: isDirty || isSpeedControlDirty,
      isValid,
    });
  }, [isDirty, isSpeedControlDirty, isValid, setPropertyFormState]);

  const params = data.parameters as Partial<PumpParameters>;

  return (
    <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
      <Box px={1}>
        {/* Basic Information */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Basic Information
        </Typography>

        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Component Name"
              size="small"
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={{ mb: 1 }}
            />
          )}
        />

        <Controller
          name="componentId"
          control={control}
          render={({ field }) => (
            <ComponentIdField
              nodeId={nodeId}
              currentComponentId={data.componentId}
              componentType={data.componentType}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Divider sx={{ my: 1 }} />

        {/* Connection */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Connection
        </Typography>

        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Connect pump inlet to upstream volume outlet, and pump outlet to downstream volume inlet
        </Typography>

        <Grid container spacing={1}>
          {/* Inlet Connection */}
          <Grid item xs={12} sm={6}>
            {(() => {
              const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, params.inletConnection))
                || buildCrossflowOption(params.inletConnection)
                || buildOldFormatOption(params.inletConnection)
                || null;
              const inletOptions = selectedOption && !availableVolumes.find(opt => refsEqual(opt.ref, params.inletConnection))
                ? [...availableVolumes, selectedOption]
                : availableVolumes;
              return (
                <Autocomplete
                  options={inletOptions}
                  getOptionLabel={(opt) => opt.volumeId}
                  value={selectedOption}
                  onChange={(_, newValue) => {
                    updateNodeData(nodeId, {
                      parameters: {
                        ...params,
                        inletConnection: newValue?.ref || null,
                      },
                    });
                  }}
                  groupBy={(opt) => opt.componentName}
                  renderInput={(inputParams) => (
                    <TextField
                      {...inputParams}
                      label="Inlet Connection (from)"
                      size="small"
                      placeholder="Select upstream volume"
                      helperText="Connect to upstream volume outlet (face 2)"
                    />
                  )}
                />
              );
            })()}
          </Grid>

          {/* Outlet Connection */}
          <Grid item xs={12} sm={6}>
            {(() => {
              const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, params.outletConnection))
                || buildCrossflowOption(params.outletConnection)
                || buildOldFormatOption(params.outletConnection)
                || null;
              const outletOptions = selectedOption && !availableVolumes.find(opt => refsEqual(opt.ref, params.outletConnection))
                ? [...availableVolumes, selectedOption]
                : availableVolumes;
              return (
                <Autocomplete
                  options={outletOptions}
                  getOptionLabel={(opt) => opt.volumeId}
                  value={selectedOption}
                  onChange={(_, newValue) => {
                    updateNodeData(nodeId, {
                      parameters: {
                        ...params,
                        outletConnection: newValue?.ref || null,
                      },
                    });
                  }}
                  groupBy={(opt) => opt.componentName}
                  renderInput={(inputParams) => (
                    <TextField
                      {...inputParams}
                      label="Outlet Connection (to)"
                      size="small"
                      placeholder="Select downstream volume"
                      helperText="Connect to downstream volume inlet (face 1)"
                    />
                  )}
                />
              );
            })()}
          </Grid>
        </Grid>

        <Divider sx={{ my: 1 }} />

        {/* Geometry */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Geometry
        </Typography>

        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Pump volume geometry (A × L = V, at least 2 must be non-zero)
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="area"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Area"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m²</InputAdornment>,
                  }}
                  helperText="0 = auto from V/L"
                  error={!!errors.area}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="length"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Length"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.length}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="volume"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Volume"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m³</InputAdornment>,
                  }}
                  error={!!errors.volume}
                  helperText={errors.volume?.message}
                />
              )}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="azAngle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Azimuth Angle"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="incAngle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inclination Angle"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  helperText="0=horizontal, 90=vertical"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="dz"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Elevation Change"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em', mt: 1.5 }}>
          Junction Areas & Loss Coefficients
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="inletArea"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inlet Junction Area"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m²</InputAdornment>,
                  }}
                  helperText="0 = auto from adjacent volumes"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="outletArea"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Outlet Junction Area"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m²</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="inletFwdLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inlet Forward Loss"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="inletRevLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inlet Reverse Loss"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="outletFwdLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Outlet Forward Loss"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="outletRevLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Outlet Reverse Loss"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1 }} />

        {/* Initial Conditions */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Initial Conditions
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="pressure"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Pressure"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
                  }}
                  helperText="Example: 15.15e6 Pa"
                  error={!!errors.pressure}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Temperature"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">K</InputAdornment>,
                  }}
                  helperText="Example: 596.15 K"
                  error={!!errors.temperature}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="inletLiquidFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inlet Liquid Flow"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="inletVaporFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Inlet Vapor Flow"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="outletLiquidFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Outlet Liquid Flow"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="outletVaporFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Outlet Vapor Flow"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1 }} />

        {/* Pump Characteristics */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Pump Characteristics
        </Typography>


        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedSpeed"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Speed"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">rad/s</InputAdornment>,
                  }}
                  error={!!errors.ratedSpeed}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="initialSpeedRatio"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Initial / Rated Speed Ratio"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  helperText="1.0 = initial speed equals rated speed"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Flow"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m³/s</InputAdornment>,
                  }}
                  error={!!errors.ratedFlow}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedHead"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Head"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.ratedHead}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedTorque"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Torque"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">N·m</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="momentOfInertia"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Moment of Inertia"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg·m²</InputAdornment>,
                  }}
                  error={!!errors.momentOfInertia}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedDensity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Density"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
                  }}
                  helperText="0 = use initial density"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ratedMotorTorque"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="Rated Motor Torque"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">N·m</InputAdornment>,
                  }}
                  helperText="0 = auto-calculate from curves"
                />
              )}
            />
          </Grid>
        </Grid>

        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em', mt: 1.5 }}>
          Friction Torque Coefficients
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="frictionTF0"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="TF0 (Constant)"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="frictionTF1"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="TF1 (Speed¹)"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="frictionTF2"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="TF2 (Speed²)"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="frictionTF3"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  label="TF3 (Speed³)"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 'any' }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1 }} />

        {/* Options */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Options & Control
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="tbli"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Homologous Curve Index"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={0}>0 - Internal (this component)</MenuItem>
                  <MenuItem value={-1}>-1 - Built-in (Bingham)</MenuItem>
                  <MenuItem value={-2}>-2 - Built-in (Westinghouse)</MenuItem>
                  <MenuItem value={-3}>-3 - Built-in (Wolsong)</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="ptrip"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  size="small"
                  options={[0, ...availableTrips.variableTrips.map(t => t.cardNumber), ...availableTrips.logicTrips.map(t => t.cardNumber)]}
                  value={field.value ?? 0}
                  onChange={(_, newValue) => {
                    field.onChange(typeof newValue === 'string' ? parseInt(newValue) || 0 : newValue ?? 0);
                  }}
                  onInputChange={(_, inputValue, reason) => {
                    if (reason === 'input') {
                      const num = parseInt(inputValue);
                      if (!isNaN(num)) field.onChange(num);
                    }
                  }}
                  getOptionLabel={(option) => {
                    if (option === 0) return '0 - No Trip';
                    const vTrip = availableTrips.variableTrips.find(t => t.cardNumber === option);
                    if (vTrip) return `${option} - ${vTrip.comment || vTrip.leftVar}`;
                    const lTrip = availableTrips.logicTrips.find(t => t.cardNumber === option);
                    if (lTrip) return `${option} - ${lTrip.comment || 'Logic Trip'}`;
                    return String(option);
                  }}
                  renderOption={(props, option) => {
                    if (option === 0) {
                      return (
                        <li {...props} key={option}>
                          <Typography variant="body2">0 - No Trip (전원 항상 ON)</Typography>
                        </li>
                      );
                    }
                    const vTrip = availableTrips.variableTrips.find(t => t.cardNumber === option);
                    const lTrip = availableTrips.logicTrips.find(t => t.cardNumber === option);
                    return (
                      <li {...props} key={option}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {option} {lTrip ? '[Logic]' : '[Variable]'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {vTrip ? (vTrip.comment || `${vTrip.leftVar} ${vTrip.relation} ${vTrip.rightVar}`)
                                   : (lTrip?.comment || `Trip${lTrip?.trip1} ${lTrip?.operator} Trip${lTrip?.trip2}`)}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Power Trip Number"
                      helperText="Trip OFF = power on, Trip ON = power cut"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            <InputAdornment position="end">
                              <Tooltip title="Variable Trips 설정">
                                <IconButton size="small" onClick={() => openGlobalSettingsDialog(4)} edge="end">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          </>
                        ),
                      }}
                    />
                  )}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="twophase"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Two-Phase Multiplier"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={-1}>-1 - Not used</MenuItem>
                  <MenuItem value={0}>0 - Internal</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="tdiff"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Two-Phase Difference"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={-3}>-3 - Not needed</MenuItem>
                  <MenuItem value={0}>0 - Internal</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="mtorq"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Motor Torque Table"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={-1}>-1 - Not used</MenuItem>
                  <MenuItem value={0}>0 - Internal</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="tdvel"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Speed Table"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={-1}>-1 - Not used (torque-inertia)</MenuItem>
                  <MenuItem value={0}>0 - Internal (speed control)</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="rev"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  label="Rotation Direction"
                  type="number"
                  size="small"
                  fullWidth
                  select
                >
                  <MenuItem value={0}>0 - Forward</MenuItem>
                  <MenuItem value={1}>1 - Reverse</MenuItem>
                </TextField>
              )}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Homologous Curves Section */}
      <Box px={1} mt={1.5}>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Homologous Curves
        </Typography>

        {/* 활성화 개수 표시 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            펌프 성능 특성을 정의하는 16개 상사곡선 세트 (Head/Torque, 8개 Regime)
          </Typography>
          {(() => {
            const enabledCurves = homologousCurves.filter(c => c.enabled);
            const enabledCount = enabledCurves.length;
            return enabledCount > 0 ? (
              <Chip
                label={`${enabledCount}개 활성화`}
                color="success"
                size="small"
              />
            ) : null;
          })()}
        </Box>

        {/* 활성화된 곡선 목록 */}
        {(() => {
          const enabledCurves = homologousCurves.filter(c => c.enabled);
          return enabledCurves.length > 0 ? (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                활성화된 곡선:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {enabledCurves.map(curve => (
                  <Tooltip
                    key={curve.name}
                    title={`Regime ${curve.regime} • ${curve.type === 1 ? 'Head' : 'Torque'} • ${curve.points.length} points`}
                  >
                    <Chip
                      label={curve.name.toUpperCase()}
                      size="small"
                      variant="outlined"
                      color={curve.type === 1 ? 'primary' : 'secondary'}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          ) : null;
        })()}

        <Button
          variant="outlined"
          color="primary"
          onClick={() => setCurveDialogOpen(true)}
          sx={{ mt: 1 }}
        >
          Edit Homologous Curves
        </Button>

        {/* Homologous Curve Dialog */}
        <HomologousCurveDialog
          open={curveDialogOpen}
          onClose={() => setCurveDialogOpen(false)}
          curves={homologousCurves}
          onChange={setHomologousCurves}
        />
      </Box>

      {/* Speed Control Section */}
      <Box px={1} mt={1.5} mb={1}>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Speed Control (속도 제어)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            시간 의존 펌프 속도 제어 테이블 (CCC6100~6199)
          </Typography>
          {speedControl && (
            <Chip
              label="활성화됨"
              color="success"
              size="small"
            />
          )}
        </Box>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setSpeedControlDialogOpen(true)}
          sx={{ mt: 1 }}
        >
          {speedControl ? 'Edit Speed Control' : 'Enable Speed Control'}
        </Button>

        {/* Speed Control Dialog */}
        <SpeedControlDialog
          open={speedControlDialogOpen}
          onClose={() => setSpeedControlDialogOpen(false)}
          speedControl={speedControl}
          onChange={setSpeedControl}
        />
      </Box>
    </form>
  );
};

export default PumpForm;
