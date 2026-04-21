/**
 * VALVE Parameter Form
 * Supports: mtrvlv (Motor), trpvlv (Trip), srvvlv (Servo), chkvlv (Check)
 */

import { useEffect, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Divider,
  InputAdornment,
  Autocomplete,
  Grid,
  Alert,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Paper,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import { Edit as EditIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, ValveParameters, VolumeReference, ValveSubType } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

// Validation schema
const valveSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Connection
  from: z.custom<VolumeReference | null>().nullable(),
  to: z.custom<VolumeReference | null>().nullable(),
  area: z.number().min(0, 'Must be non-negative'),
  
  // Loss Coefficients
  fwdLoss: z.number().min(0, 'Must be non-negative'),
  revLoss: z.number().min(0, 'Must be non-negative'),
  jefvcahs: z.string().regex(/^[0-9]{1,8}$/, 'Must be 1-8 digits').transform(v => v.padStart(8, '0')).optional(),

  // Discharge/Thermal Coefficients (CCC0102 - optional for all valve types)
  enableDischargeCoeffs: z.boolean().optional(),
  dischargeCoeff: z.number().min(0).optional(),
  thermalCoeff: z.number().min(0).optional(),
  
  // Initial Conditions
  initialConditionType: z.enum(['0', '1']),
  initialLiquidFlow: z.number(),
  initialVaporFlow: z.number(),
  initialX: z.number().optional(),

  // Valve Type
  valveSubType: z.enum(['mtrvlv', 'trpvlv', 'srvvlv', 'chkvlv']),

  // Motor Valve (mtrvlv)
  openTripNumber: z.number().int().optional(),
  closeTripNumber: z.number().int().optional(),
  valveRate: z.number().positive().optional(),
  initialPosition: z.number().min(0).max(1).optional(),

  // Trip Valve (trpvlv) - 401-799 range (Variable Trips 401-599 + Logic Trips 601-799)
  tripNumber: z.number().int().min(401, 'Trip number must be >= 401').max(799, 'Trip number must be <= 799').optional(),

  // Servo Valve (srvvlv)
  controlVariable: z.number().int().optional(),
  valveTableNumber: z.number().int().optional(),

  // Check Valve (chkvlv) - Section 8.15.6
  checkValveType: z.number().int().min(-1).max(1).optional(),       // +1, 0, -1
  checkInitialPosition: z.number().int().min(0).max(1).optional(),  // 0=open, 1=closed
  closingBackPressure: z.number().min(0).optional(),                // Pa
  leakRatio: z.number().min(0).max(1).optional(),                   // fraction
});

type FormData = z.infer<typeof valveSchema>;

interface ValveFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const ValveForm: React.FC<ValveFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, edges, nodes, setPropertyFormState, setFormSubmitHandler, getGlobalSettings, openGlobalSettingsDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, edges: state.edges, nodes: state.nodes, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, getGlobalSettings: state.getGlobalSettings, openGlobalSettingsDialog: state.openGlobalSettingsDialog })));

  // Get available Variable Trips (400번대 cards) from Global Settings
  const availableTrips = useMemo(() => {
    const settings = getGlobalSettings();
    return settings?.variableTrips || [];
  }, [getGlobalSettings]);

  // Get available Control Variables from Global Settings
  const availableControlVariables = useMemo(() => {
    const settings = getGlobalSettings();
    return settings?.controlVariables || [];
  }, [getGlobalSettings]);

  // Get available General Tables from Global Settings (for servo valve table number)
  const availableGeneralTables = useMemo(() => {
    const settings = getGlobalSettings();
    return settings?.generalTables || [];
  }, [getGlobalSettings]);

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Find connected edges to auto-populate from/to
  const connectedEdges = edges.filter(
    e => e.source === nodeId || e.target === nodeId
  );

  // Extract from/to from connected edges (using VolumeReference)
  let autoFrom: VolumeReference | null = null;
  let autoTo: VolumeReference | null = null;

  for (const edge of connectedEdges) {
    const isJunctionSource = edge.source === nodeId;
    const connectedNodeId = isJunctionSource ? edge.target : edge.source;
    const connectedNode = nodes.find(n => n.id === connectedNodeId);

    if (connectedNode) {
      if (isJunctionSource) {
        // Junction -> Volume
        autoTo = { nodeId: connectedNodeId, volumeNum: 1, face: 1 }; // inlet
      } else {
        // Volume -> Junction
        autoFrom = { nodeId: connectedNodeId, volumeNum: 1, face: 2 }; // outlet
      }
    }
  }

  // Generate available volume references for Autocomplete
  const availableVolumes = useMemo(() => {
    const options: Array<{ ref: VolumeReference; volumeId: string; label: string; componentName: string; componentType: string }> = [];
    
    nodes.forEach(node => {
      const compName = node.data.componentName || 'Unnamed';
      const compType = node.data.componentType;
      
      if (compType === 'snglvol' || compType === 'tmdpvol') {
        const faceLabels: Record<number, string> = { 1: 'Inlet', 2: 'Outlet' };
        for (let face = 1; face <= 2; face++) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face };
          const volumeId = resolver.getVolumeIdFromReference(ref) || '';
          options.push({
            ref, volumeId,
            label: `${compName} - ${faceLabels[face]}`,
            componentName: compName, componentType: compType,
          });
        }
      } else if (compType === 'pipe') {
        const params = node.data.parameters as any;
        const ncells = params?.ncells || 1;
        const faceLabels: Record<number, string> = { 1: 'Inlet', 2: 'Outlet' };
        for (let i = 1; i <= ncells; i++) {
          for (let face = 1; face <= 2; face++) {
            const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face };
            const volumeId = resolver.getVolumeIdFromReference(ref) || '';
            options.push({
              ref, volumeId,
              label: `${compName} - Cell ${i} ${faceLabels[face]}`,
              componentName: compName, componentType: compType,
            });
          }
        }
      } else if (compType === 'branch') {
        const faceLabels: Record<number, string> = { 1: 'Inlet', 2: 'Outlet' };
        for (let face = 1; face <= 2; face++) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face };
          const volumeId = resolver.getVolumeIdFromReference(ref) || '';
          options.push({
            ref, volumeId,
            label: `${compName} - ${faceLabels[face]}`,
            componentName: compName, componentType: compType,
          });
        }
      }
    });
    
    return options.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest, resolver]);

  // Helper: Build a crossflow display option for face 3-6 refs not in availableVolumes
  const crossflowFaceLabels: Record<number, string> = { 3: 'y-', 4: 'y+', 5: 'z-', 6: 'z+' };
  const buildCrossflowOption = (ref: VolumeReference | null | undefined) => {
    if (!ref || !ref.nodeId || !ref.face || ref.face < 3) return null;
    const node = nodes.find(n => n.id === ref.nodeId);
    if (!node) return null;
    const compName = node.data.componentName || 'Unknown';
    const compType = node.data.componentType;
    const volumeId = resolver.getVolumeIdFromReference(ref) || '';
    const faceLabel = crossflowFaceLabels[ref.face] || `Face ${ref.face}`;
    return {
      ref,
      volumeId,
      label: `${compName} - ${faceLabel} CrossFlow`,
      componentName: compName,
      componentType: compType,
    };
  };

  // Helper: Build an Old Format display option for face=0 refs
  const buildOldFormatOption = (ref: VolumeReference | null | undefined) => {
    if (!ref || !ref.nodeId || ref.face !== 0) return null;
    const node = nodes.find(n => n.id === ref.nodeId);
    if (!node) return null;
    const compName = node.data.componentName || 'Unknown';
    const compType = node.data.componentType;
    const volumeId = resolver.getVolumeIdFromReference(ref) || '';
    const side = ref.volumeNum === 0 ? 'Inlet Side' : 'Outlet Side';
    return {
      ref,
      volumeId,
      label: `${compName} - Old Format (${side})`,
      componentName: compName,
      componentType: compType,
    };
  };

  const refsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
  };

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(valveSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      from: (data.parameters as Partial<ValveParameters>)?.from || autoFrom || null,
      to: (data.parameters as Partial<ValveParameters>)?.to || autoTo || null,
      area: 0.01,
      fwdLoss: 1.0,
      revLoss: 1.0,
      jefvcahs: '00000000',
      enableDischargeCoeffs: false,
      dischargeCoeff: 1.0,
      thermalCoeff: 0.14,
      initialLiquidFlow: 0.0,
      initialVaporFlow: 0.0,
      initialX: 0.0,
      valveSubType: 'trpvlv',
      openTripNumber: undefined,
      closeTripNumber: undefined,
      valveRate: 0.2,
      initialPosition: 0.0,
      tripNumber: undefined,
      controlVariable: undefined,
      valveTableNumber: undefined,
      checkValveType: 0,
      checkInitialPosition: 0,
      closingBackPressure: 0.0,
      leakRatio: 0.0,
      ...(data.parameters as Partial<ValveParameters>),
      initialConditionType: String((data.parameters as Partial<ValveParameters>)?.initialConditionType ?? '1') as '0' | '1',
    },
  });

  const valveSubType = watch('valveSubType');
  
  // Reset form when node changes
  const loadedNodeIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (loadedNodeIdRef.current === nodeId) return;
    
    const params = data.parameters as Partial<ValveParameters>;
    
    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      from: params?.from || autoFrom || null,
      to: params?.to || autoTo || null,
      area: params?.area ?? 0.01,
      fwdLoss: params?.fwdLoss ?? 1.0,
      revLoss: params?.revLoss ?? 1.0,
      jefvcahs: params?.jefvcahs ?? '00000000',
      enableDischargeCoeffs: params?.enableDischargeCoeffs ?? false,
      dischargeCoeff: params?.dischargeCoeff ?? 1.0,
      thermalCoeff: params?.thermalCoeff ?? 0.14,
      initialConditionType: String(params?.initialConditionType ?? 1) as '0' | '1',
      initialLiquidFlow: params?.initialLiquidFlow ?? 0.0,
      initialVaporFlow: params?.initialVaporFlow ?? 0.0,
      initialX: params?.initialX ?? 0.0,
      valveSubType: params?.valveSubType ?? 'trpvlv',
      openTripNumber: params?.openTripNumber,
      closeTripNumber: params?.closeTripNumber,
      valveRate: params?.valveRate ?? 0.2,
      initialPosition: params?.initialPosition ?? 0.0,
      tripNumber: params?.tripNumber,
      controlVariable: params?.controlVariable,
      valveTableNumber: params?.valveTableNumber,
      checkValveType: params?.checkValveType ?? 0,
      checkInitialPosition: params?.checkInitialPosition ?? 0,
      closingBackPressure: params?.closingBackPressure ?? 0.0,
      leakRatio: params?.leakRatio ?? 0.0,
    });

    loadedNodeIdRef.current = nodeId;
  }, [nodeId, reset, data.parameters, data.componentName, data.componentId]);

  // Update from/to when edges change (Edge -> Form sync)
  const prevAutoFromRef = useRef<string | null>(null);
  const prevAutoToRef = useRef<string | null>(null);

  useEffect(() => {
    const currentAutoFromStr = autoFrom ? JSON.stringify(autoFrom) : null;
    const currentAutoToStr = autoTo ? JSON.stringify(autoTo) : null;

    // Update from field if autoFrom changed and form doesn't have a value
    if (currentAutoFromStr !== prevAutoFromRef.current) {
      prevAutoFromRef.current = currentAutoFromStr;
      const currentFrom = watch('from');
      if (!currentFrom && autoFrom) {
        setValue('from', autoFrom, { shouldDirty: true });
      }
    }

    // Update to field if autoTo changed and form doesn't have a value
    if (currentAutoToStr !== prevAutoToRef.current) {
      prevAutoToRef.current = currentAutoToStr;
      const currentTo = watch('to');
      if (!currentTo && autoTo) {
        setValue('to', autoTo, { shouldDirty: true });
      }
    }
  }, [autoFrom, autoTo, setValue, watch]);

  const onSubmit = (formData: FormData) => {
    const parameters: Partial<ValveParameters> = {
      name: formData.name,
      from: formData.from ?? undefined,
      to: formData.to ?? undefined,
      area: formData.area,
      fwdLoss: formData.fwdLoss,
      revLoss: formData.revLoss,
      jefvcahs: formData.jefvcahs || '00000000',
      // Discharge/Thermal Coefficients (CCC0102)
      enableDischargeCoeffs: formData.enableDischargeCoeffs,
      dischargeCoeff: formData.dischargeCoeff,
      thermalCoeff: formData.thermalCoeff,
      initialConditionType: parseInt(formData.initialConditionType) as 0 | 1,
      initialLiquidFlow: formData.initialLiquidFlow,
      initialVaporFlow: formData.initialVaporFlow,
      initialX: formData.initialX,
      valveSubType: formData.valveSubType as ValveSubType,
    };

    // Add type-specific parameters
    if (formData.valveSubType === 'mtrvlv') {
      parameters.openTripNumber = formData.openTripNumber;
      parameters.closeTripNumber = formData.closeTripNumber;
      parameters.valveRate = formData.valveRate;
      parameters.initialPosition = formData.initialPosition;
    } else if (formData.valveSubType === 'trpvlv') {
      parameters.tripNumber = formData.tripNumber;
    } else if (formData.valveSubType === 'srvvlv') {
      parameters.controlVariable = formData.controlVariable;
      parameters.valveTableNumber = formData.valveTableNumber;
    } else if (formData.valveSubType === 'chkvlv') {
      parameters.checkValveType = formData.checkValveType as -1 | 0 | 1;
      parameters.checkInitialPosition = formData.checkInitialPosition as 0 | 1;
      parameters.closingBackPressure = formData.closingBackPressure;
      parameters.leakRatio = formData.leakRatio;
    }

    // Validation
    const validationErrors = [];
    const validationWarnings = [];

    if (!formData.name) {
      validationErrors.push({ level: 'error' as const, message: 'Name is required' });
    }
    if (formData.area < 0) {
      validationErrors.push({ level: 'error' as const, message: 'Area must be non-negative' });
    }

    // Check from/to
    const hasFrom = formData.from !== null;
    const hasTo = formData.to !== null;

    if (!hasFrom && !hasTo) {
      validationErrors.push({ level: 'error' as const, message: 'At least one connection required' });
    } else {
      if (!hasFrom) validationWarnings.push({ level: 'warning' as const, message: 'From Volume not connected' });
      if (!hasTo) validationWarnings.push({ level: 'warning' as const, message: 'To Volume not connected' });
    }

    // Type-specific validation
    if (formData.valveSubType === 'mtrvlv') {
      if (formData.openTripNumber == null) validationErrors.push({ level: 'error' as const, message: 'Open Trip required for Motor Valve' });
      if (formData.closeTripNumber == null) validationErrors.push({ level: 'error' as const, message: 'Close Trip required for Motor Valve' });
      if (!formData.valveRate || formData.valveRate <= 0) validationErrors.push({ level: 'error' as const, message: 'Valve Rate must be positive' });
    } else if (formData.valveSubType === 'trpvlv') {
      if (formData.tripNumber == null) validationErrors.push({ level: 'error' as const, message: 'Trip Number required for Trip Valve' });
    } else if (formData.valveSubType === 'srvvlv') {
      if (formData.controlVariable == null) validationErrors.push({ level: 'error' as const, message: 'Control Variable required for Servo Valve' });
    } else if (formData.valveSubType === 'chkvlv') {
      // Check valve has no required fields beyond defaults
    }

    const status = validationErrors.length === 0 ? (validationWarnings.length > 0 ? 'incomplete' : 'valid') : 'error';

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      parameters,
      status,
      errors: validationErrors,
      warnings: validationWarnings,
    });

    // Reset form with current values to clear isDirty state
    reset(formData);
  };

  // Register form submit handler
  // onError: Zod 검증 실패 시에도 현재 값으로 저장 (status: 'error')
  useEffect(() => {
    const handler = () => handleSubmit(onSubmit, () => onSubmit(getValues()))();
    setFormSubmitHandler(handler);
    return () => setFormSubmitHandler(null);
  }, [handleSubmit, setFormSubmitHandler, getValues]);

  useEffect(() => {
    setPropertyFormState({ isDirty, isValid });
  }, [isDirty, isValid, setPropertyFormState]);

  return (
    <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
      <Box display="flex" flexDirection="column" gap={1}>
        {/* Basic Info */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Basic Information
        </Typography>
        
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Valve Name"
              size="small"
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name?.message}
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
        
        <Divider />
        
        {/* Valve Type Selection */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Valve Type
        </Typography>
        
        <Controller
          name="valveSubType"
          control={control}
          render={({ field }) => (
            <FormControl component="fieldset">
              <RadioGroup
                row
                {...field}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <FormControlLabel value="trpvlv" control={<Radio size="small" />} label="Trip Valve" />
                <FormControlLabel value="srvvlv" control={<Radio size="small" />} label="Servo Valve" />
                <FormControlLabel value="mtrvlv" control={<Radio size="small" />} label="Motor Valve" />
                <FormControlLabel value="chkvlv" control={<Radio size="small" />} label="Check Valve" />
              </RadioGroup>
            </FormControl>
          )}
        />

        {/* Type-specific description */}
        <Alert severity="info" sx={{ py: 0.5 }}>
          {valveSubType === 'trpvlv' && 'Trip Valve: Opens/closes instantly based on trip status'}
          {valveSubType === 'srvvlv' && 'Servo Valve: Position controlled by control variable (0-1)'}
          {valveSubType === 'mtrvlv' && 'Motor Valve: Opens/closes at specified rate based on trips'}
          {valveSubType === 'chkvlv' && 'Check Valve: Pressure/flow-controlled, opens on forward ΔP, closes on reverse flow'}
        </Alert>
        
        <Divider />
        
        {/* Connection */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Junction Geometry
        </Typography>
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="from"
              control={control}
              render={({ field }) => {
                const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, field.value))
                  || buildCrossflowOption(field.value)
                  || buildOldFormatOption(field.value)
                  || null;
                const fromOptions = selectedOption && !availableVolumes.find(opt => refsEqual(opt.ref, field.value))
                  ? [...availableVolumes, selectedOption]
                  : availableVolumes;

                return (
                  <Autocomplete
                    options={fromOptions}
                    getOptionLabel={(option) => option.volumeId}
                    value={selectedOption}
                    onChange={(_, newValue) => field.onChange(newValue?.ref || null)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="From Volume"
                        size="small"
                        fullWidth
                        error={!!errors.from}
                        helperText={selectedOption?.componentName || 'Select volume'}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box>
                            <Typography variant="body2">{option.volumeId}</Typography>
                            <Typography variant="caption" color="text.secondary">{option.componentName}</Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    groupBy={(option) => option.componentName}
                  />
                );
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Controller
              name="to"
              control={control}
              render={({ field }) => {
                const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, field.value))
                  || buildCrossflowOption(field.value)
                  || buildOldFormatOption(field.value)
                  || null;
                const toOptions = selectedOption && !availableVolumes.find(opt => refsEqual(opt.ref, field.value))
                  ? [...availableVolumes, selectedOption]
                  : availableVolumes;

                return (
                  <Autocomplete
                    options={toOptions}
                    getOptionLabel={(option) => option.volumeId}
                    value={selectedOption}
                    onChange={(_, newValue) => field.onChange(newValue?.ref || null)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="To Volume"
                        size="small"
                        fullWidth
                        error={!!errors.to}
                        helperText={selectedOption?.componentName || 'Select volume'}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props;
                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box>
                            <Typography variant="body2">{option.volumeId}</Typography>
                            <Typography variant="caption" color="text.secondary">{option.componentName}</Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    groupBy={(option) => option.componentName}
                  />
                );
              }}
            />
          </Grid>
        </Grid>
        
        <Controller
          name="area"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Junction Area"
              type="number"
              size="small"
              fullWidth
              required
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.01)}
              inputProps={numberInputProps}
              InputProps={{
                endAdornment: <InputAdornment position="end">m²</InputAdornment>,
              }}
              error={!!errors.area}
              helperText={errors.area?.message || 'Valve flow area'}
            />
          )}
        />
        
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Controller
              name="fwdLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Forward Loss (K)"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  inputProps={numberInputProps}
                  error={!!errors.fwdLoss}
                />
              )}
            />
          </Grid>
          <Grid item xs={6}>
            <Controller
              name="revLoss"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Reverse Loss (K)"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  inputProps={numberInputProps}
                  error={!!errors.revLoss}
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Controller
          name="jefvcahs"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Control Flags (jefvcahs)"
              size="small"
              fullWidth
              placeholder="00000000"
              helperText="8-digit junction flags"
            />
          )}
        />

        {/* Discharge/Thermal Coefficients (optional) */}
        <Accordion 
          sx={{ 
            mt: 1, 
            '&:before': { display: 'none' },
            boxShadow: 'none',
            border: '1px solid',
            borderColor: watch('enableDischargeCoeffs') ? 'primary.main' : 'divider',
            borderRadius: 1,
          }}
        >
          <AccordionSummary 
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0 } }}
          >
            <Typography variant="body2" color="text.secondary">
              Discharge/Thermal Coefficients (optional)
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Controller
              name="enableDischargeCoeffs"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Enable CCC0102 card output"
                  sx={{ mb: 1 }}
                />
              )}
            />
            <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
              Henry-Fauske subcooled choking model coefficients. If unchecked, MARS uses default values.
            </Alert>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Controller
                  name="dischargeCoeff"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Discharge Coefficient"
                      type="number"
                      size="small"
                      fullWidth
                      disabled={!watch('enableDischargeCoeffs')}
                      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                      inputProps={numberInputProps}
                      helperText="Default: 1.0"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6}>
                <Controller
                  name="thermalCoeff"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Thermal Nonequilibrium"
                      type="number"
                      size="small"
                      fullWidth
                      disabled={!watch('enableDischargeCoeffs')}
                      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                      inputProps={numberInputProps}
                      helperText="Default: 0.14"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
        
        <Divider />
        
        {/* Initial Conditions */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Initial Conditions
        </Typography>
        
        <Controller
          name="initialConditionType"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Initial Condition Type"
              select
              size="small"
              fullWidth
            >
              <MenuItem value="0">0 - Velocity (m/s)</MenuItem>
              <MenuItem value="1">1 - Mass Flow (kg/s)</MenuItem>
            </TextField>
          )}
        />
        
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Controller
              name="initialLiquidFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Liquid Flow"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{watch('initialConditionType') === '1' ? 'kg/s' : 'm/s'}</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={6}>
            <Controller
              name="initialVaporFlow"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Vapor Flow"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{watch('initialConditionType') === '1' ? 'kg/s' : 'm/s'}</InputAdornment>,
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Divider />
        
        {/* Valve Control - Type Specific */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Valve Control
        </Typography>
        
        {/* Trip Valve */}
        {valveSubType === 'trpvlv' && (
          <Paper elevation={0} sx={{ p: 2, borderLeft: '4px solid #9c27b0', bgcolor: 'rgba(156,39,176,0.04)' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Chip label="Trip Valve" size="small" sx={{ bgcolor: '#9c27b0', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }} />
              <Tooltip title="Variable Trips 설정">
                <IconButton size="small" onClick={() => openGlobalSettingsDialog(4)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Opens when trip is TRUE, closes when FALSE
            </Typography>
            <Controller
              name="tripNumber"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  size="small"
                  options={availableTrips.map(t => t.cardNumber)}
                  value={field.value ?? null}
                  onChange={(_, newValue) => {
                    field.onChange(typeof newValue === 'string' ? parseInt(newValue) || undefined : newValue);
                  }}
                  onInputChange={(_, inputValue, reason) => {
                    if (reason === 'input') {
                      const num = parseInt(inputValue);
                      if (!isNaN(num)) field.onChange(num);
                    }
                  }}
                  getOptionLabel={(option) => {
                    const trip = availableTrips.find(t => t.cardNumber === option);
                    return trip ? `${option} - ${trip.comment || trip.leftVar}` : String(option);
                  }}
                  renderOption={(props, option) => {
                    const trip = availableTrips.find(t => t.cardNumber === option);
                    return (
                      <li {...props} key={option}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{option}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {trip?.comment || `${trip?.leftVar} ${trip?.relation} ${trip?.rightVar}`}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Trip Number"
                      required
                      error={!!errors.tripNumber}
                      helperText={availableTrips.length === 0
                        ? 'Global Settings에서 Variable Trip을 먼저 정의하세요'
                        : `${availableTrips.length}개 Trip 사용 가능 (401-599)`}
                    />
                  )}
                />
              )}
            />
          </Paper>
        )}
        
        {/* Check Valve (Section 8.15.6) */}
        {valveSubType === 'chkvlv' && (
          <Paper elevation={0} sx={{ p: 2, borderLeft: '4px solid #e65100', bgcolor: 'rgba(230,81,0,0.04)' }}>
            <Chip label="Check Valve" size="small" sx={{ bgcolor: '#e65100', color: '#fff', fontWeight: 600, fontSize: '0.75rem', mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              압력/유량 기반 개폐. 순방향 ΔP 시 열림, 역방향 시 닫힘
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Controller
                name="checkValveType"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    label="Check Valve Type"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    helperText="히스테리시스 효과 및 제어 방식"
                  >
                    <MenuItem value={0}>0: Static pressure/flow (hysteresis) - 권장</MenuItem>
                    <MenuItem value={1}>+1: Static pressure (no hysteresis)</MenuItem>
                    <MenuItem value={-1}>-1: Static/dynamic pressure (hysteresis)</MenuItem>
                  </TextField>
                )}
              />
              <Controller
                name="checkInitialPosition"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    size="small"
                    label="Initial Position"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  >
                    <MenuItem value={0}>0: Initially Open</MenuItem>
                    <MenuItem value={1}>1: Initially Closed</MenuItem>
                  </TextField>
                )}
              />
              <Controller
                name="closingBackPressure"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    type="number"
                    label="Closing Back Pressure (Pa)"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    helperText="스프링 밸브 모델링용 닫힘 배압 (ΔP에 가산)"
                  />
                )}
              />
              <Controller
                name="leakRatio"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    type="number"
                    label="Leak Ratio"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    inputProps={{ min: 0, max: 1, step: 0.001 }}
                    helperText="밸브 닫힘 시 누설 면적 비율 (0 = 누설 없음)"
                  />
                )}
              />
            </Box>
          </Paper>
        )}

        {/* Servo Valve */}
        {valveSubType === 'srvvlv' && (
          <Paper elevation={0} sx={{ p: 2, borderLeft: '4px solid #2e7d32', bgcolor: 'rgba(46,125,50,0.04)' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Chip label="Servo Valve" size="small" sx={{ bgcolor: '#2e7d32', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }} />
              <Tooltip title="Control Variables 설정">
                <IconButton size="small" onClick={() => openGlobalSettingsDialog(5)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Position = Control Variable value (0.0 ~ 1.0)
            </Typography>
            <Controller
              name="controlVariable"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  size="small"
                  options={availableControlVariables.map(cv => cv.number)}
                  value={field.value ?? null}
                  onChange={(_, newValue) => {
                    field.onChange(typeof newValue === 'string' ? parseInt(newValue) || undefined : newValue);
                  }}
                  onInputChange={(_, inputValue, reason) => {
                    if (reason === 'input') {
                      const num = parseInt(inputValue);
                      if (!isNaN(num)) field.onChange(num);
                    }
                  }}
                  getOptionLabel={(option) => {
                    const cv = availableControlVariables.find(c => c.number === option);
                    return cv ? `${option} - ${cv.name} (${cv.componentType})` : String(option);
                  }}
                  renderOption={(props, option) => {
                    const cv = availableControlVariables.find(c => c.number === option);
                    return (
                      <li {...props} key={option}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{option}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cv ? `${cv.name} (${cv.componentType})` : ''}
                          </Typography>
                        </Box>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Control Variable"
                      required
                      error={!!errors.controlVariable}
                      helperText={availableControlVariables.length === 0
                        ? 'Global Settings에서 Control Variable을 먼저 정의하세요'
                        : `${availableControlVariables.length}개 CV 사용 가능`}
                    />
                  )}
                />
              )}
            />
            <Box mt={2}>
              <Controller
                name="valveTableNumber"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={availableGeneralTables.map(gt => gt.tableNumber)}
                    value={field.value ?? null}
                    onChange={(_, newValue) => {
                      field.onChange(typeof newValue === 'string' ? parseInt(newValue) || undefined : newValue);
                    }}
                    onInputChange={(_, inputValue, reason) => {
                      if (reason === 'input') {
                        const num = parseInt(inputValue);
                        if (!isNaN(num)) field.onChange(num);
                        else if (inputValue === '') field.onChange(undefined);
                      }
                    }}
                    getOptionLabel={(option) => {
                      const gt = availableGeneralTables.find(t => t.tableNumber === option);
                      return gt ? `${option} - ${gt.name} (${gt.type})` : String(option);
                    }}
                    renderOption={(props, option) => {
                      const gt = availableGeneralTables.find(t => t.tableNumber === option);
                      return (
                        <li {...props} key={option}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">{option}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {gt ? `${gt.name} (${gt.type})` : ''}
                            </Typography>
                          </Box>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Valve Table Number (Optional)"
                        helperText={field.value
                          ? 'CV = 정규화 스템위치, 테이블로 면적 변환'
                          : '미입력 시 CV = 정규화 유동면적 (직접 제어)'}
                      />
                    )}
                  />
                )}
              />
            </Box>
          </Paper>
        )}

        {/* Motor Valve */}
        {valveSubType === 'mtrvlv' && (
          <Paper elevation={0} sx={{ p: 2, borderLeft: '4px solid #1565c0', bgcolor: 'rgba(21,101,192,0.04)' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Chip label="Motor Valve" size="small" sx={{ bgcolor: '#1565c0', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }} />
              <Tooltip title="Variable Trips 설정">
                <IconButton size="small" onClick={() => openGlobalSettingsDialog(4)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Opens/closes at rate when trips are TRUE
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Controller
                  name="openTripNumber"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={availableTrips.map(t => t.cardNumber)}
                      value={field.value ?? null}
                      onChange={(_, newValue) => {
                        field.onChange(typeof newValue === 'string' ? parseInt(newValue) || undefined : newValue);
                      }}
                      onInputChange={(_, inputValue, reason) => {
                        if (reason === 'input') {
                          const num = parseInt(inputValue);
                          if (!isNaN(num)) field.onChange(num);
                        }
                      }}
                      getOptionLabel={(option) => {
                        const trip = availableTrips.find(t => t.cardNumber === option);
                        return trip ? `${option} - ${trip.comment || trip.leftVar}` : String(option);
                      }}
                      renderOption={(props, option) => {
                        const trip = availableTrips.find(t => t.cardNumber === option);
                        return (
                          <li {...props} key={option}>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{option}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {trip?.comment || `${trip?.leftVar} ${trip?.relation} ${trip?.rightVar}`}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Open Trip"
                          required
                          error={!!errors.openTripNumber}
                          helperText={availableTrips.length === 0
                            ? 'Variable Trip을 먼저 정의하세요'
                            : 'Trip to open valve'}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6}>
                <Controller
                  name="closeTripNumber"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={availableTrips.map(t => t.cardNumber)}
                      value={field.value ?? null}
                      onChange={(_, newValue) => {
                        field.onChange(typeof newValue === 'string' ? parseInt(newValue) || undefined : newValue);
                      }}
                      onInputChange={(_, inputValue, reason) => {
                        if (reason === 'input') {
                          const num = parseInt(inputValue);
                          if (!isNaN(num)) field.onChange(num);
                        }
                      }}
                      getOptionLabel={(option) => {
                        const trip = availableTrips.find(t => t.cardNumber === option);
                        return trip ? `${option} - ${trip.comment || trip.leftVar}` : String(option);
                      }}
                      renderOption={(props, option) => {
                        const trip = availableTrips.find(t => t.cardNumber === option);
                        return (
                          <li {...props} key={option}>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{option}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {trip?.comment || `${trip?.leftVar} ${trip?.relation} ${trip?.rightVar}`}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Close Trip"
                          required
                          error={!!errors.closeTripNumber}
                          helperText={availableTrips.length === 0
                            ? 'Variable Trip을 먼저 정의하세요'
                            : 'Trip to close valve'}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6}>
                <Controller
                  name="valveRate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Valve Rate"
                      type="number"
                      size="small"
                      fullWidth
                      required
                      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                      inputProps={numberInputProps}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">s⁻¹</InputAdornment>,
                      }}
                      error={!!errors.valveRate}
                      helperText="0.2 = 5s stroke time"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6}>
                <Controller
                  name="initialPosition"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Initial Position"
                      type="number"
                      size="small"
                      fullWidth
                      required
                      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                      inputProps={{ ...numberInputProps, min: 0, max: 1, step: 0.1 }}
                      error={!!errors.initialPosition}
                      helperText="0.0=closed, 1.0=open"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>
        )}
      </Box>
    </form>
  );
};

export default ValveForm;
