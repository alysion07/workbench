/**
 * TMDPJUN Parameter Form
 * Time-Dependent Junction with time-varying flow
 * VolumeReference-based connection (syncs with componentId changes)
 */

import { useEffect, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Divider,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Autocomplete,
  Grid,
  Chip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountTree as AccountTreeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, TmdpjunParameters, VolumeReference, CrossflowDialogInitialValues, FaceType, TmdpSearchVariableType, TMDP_SEARCH_VARIABLE_LABELS } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

// Validation schema
const timePointSchema = z.object({
  time: z.number().min(0, 'Time must be non-negative'),
  mfl: z.number(),
  mfv: z.number(),
});

const tmdpjunSchema = z.object({
  name: z.string().max(20, 'Name too long').optional().or(z.literal('')),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Connection (VolumeReference-based)
  from: z.custom<VolumeReference | null>((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && 'nodeId' in val && 'volumeNum' in val && 'face' in val) return true;
    return false;
  }).nullable(),
  to: z.custom<VolumeReference | null>((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && 'nodeId' in val && 'volumeNum' in val && 'face' in val) return true;
    return false;
  }).nullable(),
  area: z.number().nonnegative('Must be non-negative'),

  // Control flag: e-flag only (Modified PV term)
  useModifiedPvTerm: z.boolean(),

  // Boundary condition type
  conditionType: z.enum(['0', '1']),

  // Search variable control (Card CCC0200 W2-W4)
  tripNumber: z.number().int().optional(),
  variableType: z.string().optional(),
  variableCode: z.number().int().optional(),

  // Time table
  timeTable: z.array(timePointSchema).min(2, 'At least 2 time points required'),
});

type FormData = z.infer<typeof tmdpjunSchema>;

interface TmdpjunFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const TmdpjunForm: React.FC<TmdpjunFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, edges, nodes, setPropertyFormState, setFormSubmitHandler, openCrossflowDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, edges: state.edges, nodes: state.nodes, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, openCrossflowDialog: state.openCrossflowDialog })));

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Create resolver for ID operations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Find connected edges to auto-populate from/to
  const connectedEdges = edges.filter(
    e => e.source === nodeId || e.target === nodeId
  );

  // Extract from/to from connected nodes (VolumeReference-based)
  let autoFrom: VolumeReference | null = null;
  let autoTo: VolumeReference | null = null;

  for (const edge of connectedEdges) {
    const isJunctionSource = edge.source === nodeId;
    const connectedNodeId = isJunctionSource ? edge.target : edge.source;
    const connectedNode = nodes.find(n => n.id === connectedNodeId);

    if (connectedNode) {
      if (isJunctionSource) {
        // Junction -> Volume (inlet)
        autoTo = { nodeId: connectedNodeId, volumeNum: 1, face: 1 };
      } else {
        // Volume -> Junction (outlet)
        autoFrom = { nodeId: connectedNodeId, volumeNum: 1, face: 2 };
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

  // Helper: parse legacy string to VolumeReference
  const parseFromParam = (param: VolumeReference | string | undefined, fallback: VolumeReference | null): VolumeReference | null => {
    if (!param) return fallback;
    if (typeof param === 'object' && 'nodeId' in param) return param;
    // Legacy string format: try to parse via resolver
    if (typeof param === 'string' && /^\d{9}$/.test(param)) {
      const parsed = resolver.parseVolumeId(param);
      return parsed || fallback;
    }
    return fallback;
  };

  const {
    control,
    handleSubmit: handleSubmitForm,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(tmdpjunSchema),
    defaultValues: (() => {
      const params = data.parameters as Partial<TmdpjunParameters>;
      return {
        name: data.componentName || '',
        componentId: data.componentId,
        from: parseFromParam(params?.from, autoFrom),
        to: parseFromParam(params?.to, autoTo),
        area: params?.area ?? 0.0,
        useModifiedPvTerm: params?.useModifiedPvTerm ?? false,
        conditionType: String(params?.conditionType ?? 1) as '0' | '1',
        tripNumber: params?.tripNumber,
        variableType: params?.variableType ?? 'time',
        variableCode: params?.variableCode,
        timeTable: params?.timeTable ?? [
          { time: 0.0, mfl: 0.0, mfv: 0.0 },
          { time: 1000.0, mfl: 0.0, mfv: 0.0 },
        ],
      };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'timeTable',
  });

  // Reset form when node data changes
  useEffect(() => {
    const params = data.parameters as Partial<TmdpjunParameters>;

    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      from: parseFromParam(params?.from, autoFrom),
      to: parseFromParam(params?.to, autoTo),
      area: params?.area ?? 0.0,
      useModifiedPvTerm: params?.useModifiedPvTerm ?? false,
      conditionType: params?.conditionType !== undefined ? String(params.conditionType) as '0' | '1' : '1',
      tripNumber: params?.tripNumber,
      variableType: params?.variableType ?? 'time',
      variableCode: params?.variableCode,
      timeTable: params?.timeTable ?? [
        { time: 0.0, mfl: 0.0, mfv: 0.0 },
        { time: 1000.0, mfl: 0.0, mfv: 0.0 },
      ],
    });
  }, [nodeId, reset]);

  const onSubmit = (formData: FormData) => {
    const parameters = {
      ...formData,
      from: formData.from ?? undefined,
      to: formData.to ?? undefined,
      conditionType: parseInt(formData.conditionType) as (0 | 1),
      variableType: (formData.variableType || 'time') as TmdpSearchVariableType,
      jefvcahs: formData.useModifiedPvTerm ? '01000000' : '00000000',
    } as Partial<TmdpjunParameters>;

    // Validate
    const validationErrors = [];
    const validationWarnings = [];

    if (!formData.name || formData.name.trim() === '') {
      validationWarnings.push({ level: 'warning' as const, message: 'Junction name is not set' });
    }
    if (formData.area < 0) {
      validationErrors.push({ level: 'error' as const, message: 'Area must be non-negative' });
    }

    // Check from/to (VolumeReference-based)
    const hasFrom = formData.from !== null && formData.from !== undefined;
    const hasTo = formData.to !== null && formData.to !== undefined;

    if (!hasFrom) {
      validationWarnings.push({ level: 'warning' as const, message: 'From Volume is not connected' });
    } else if (formData.from && !resolver.validateVolumeReference(formData.from)) {
      validationErrors.push({ level: 'error' as const, message: 'Invalid From Volume reference' });
    }

    if (!hasTo) {
      validationWarnings.push({ level: 'warning' as const, message: 'To Volume is not connected' });
    } else if (formData.to && !resolver.validateVolumeReference(formData.to)) {
      validationErrors.push({ level: 'error' as const, message: 'Invalid To Volume reference' });
    }

    if (!hasFrom && !hasTo) {
      validationWarnings.push({ level: 'warning' as const, message: 'Junction is not connected to any volume. Connect or select Volume IDs.' });
    }

    if (formData.timeTable.length < 2) {
      validationErrors.push({ level: 'error' as const, message: 'At least 2 time points required' });
    }

    // Check time is monotonically increasing
    for (let i = 1; i < formData.timeTable.length; i++) {
      if (formData.timeTable[i].time <= formData.timeTable[i - 1].time) {
        validationErrors.push({ level: 'error' as const, message: 'Time must be monotonically increasing' });
        break;
      }
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
  };

  // Register form submit handler on mount
  // onError: Zod 검증 실패 시에도 현재 값으로 저장 (status: 'error')
  useEffect(() => {
    const handler = () => {
      handleSubmitForm(onSubmit, () => onSubmit(getValues()))();
    };
    setFormSubmitHandler(handler);
    return () => {
      setFormSubmitHandler(null);
    };
  }, [handleSubmitForm, setFormSubmitHandler, getValues]);

  useEffect(() => {
    setPropertyFormState({
      isDirty,
      isValid,
    });
  }, [isDirty, isValid, setPropertyFormState]);

  // Open Crossflow Wizard
  const openCrossflowWizard = () => {
    const currentFrom = watch('from') as VolumeReference | null;
    const currentTo = watch('to') as VolumeReference | null;

    const initialValues: CrossflowDialogInitialValues = {
      junctionNodeId: nodeId,
      fromVolumeNodeId: currentFrom?.nodeId,
      fromCell: currentFrom?.volumeNum,
      fromFace: currentFrom?.face as FaceType,
      toVolumeNodeId: currentTo?.nodeId,
      toCell: currentTo?.volumeNum,
      toFace: currentTo?.face as FaceType,
    };

    openCrossflowDialog({
      initialValues,
      onApply: (config) => {
        if (config.sourceNodeId) {
          const newFrom: VolumeReference = {
            nodeId: config.sourceNodeId,
            volumeNum: config.sourceCell,
            face: config.sourceFace,
          };
          setValue('from', newFrom, { shouldDirty: true });
        }
        if (config.targetNodeId) {
          const newTo: VolumeReference = {
            nodeId: config.targetNodeId,
            volumeNum: config.targetCell,
            face: config.targetFace,
          };
          setValue('to', newTo, { shouldDirty: true });
        }

        setTimeout(() => {
          handleSubmitForm(onSubmit, () => onSubmit(getValues()))();
        }, 0);
      },
    });
  };

  return (
    <form onSubmit={handleSubmitForm(onSubmit, () => onSubmit(getValues()))}>
      <Box display="flex" flexDirection="column" gap={1} px={1}>
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
              label="Junction Name"
              size="small"
              fullWidth
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

        {/* Connection */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Connection
          </Typography>
          <Tooltip title="연결 Wizard 열기">
            <IconButton size="small" onClick={openCrossflowWizard} color="primary">
              <AccountTreeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

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
                const hasValue = field.value !== null && field.value !== undefined;

                return (
                  <Box display="flex" gap={1} alignItems="flex-start">
                    <Autocomplete
                      options={fromOptions}
                      getOptionLabel={(option) => option.volumeId}
                      value={selectedOption}
                      onChange={(_, newValue) => {
                        if (newValue) {
                          field.onChange(newValue.ref);
                        } else {
                          field.onChange(null);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="From Volume"
                          size="small"
                          fullWidth
                          placeholder="Select volume"
                          error={!!errors.from}
                          helperText={
                            selectedOption
                              ? `${selectedOption.label}`
                              : (autoFrom ? '✓ Auto-filled from connection' : 'Select from list')
                          }
                        />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <Box component="li" key={key} {...otherProps}>
                            <Box>
                              <Typography variant="body2">{option.volumeId}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.label}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
                      groupBy={(option) => option.componentName}
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
                      sx={{ flex: 1 }}
                    />
                    {hasValue && (
                      <Chip
                        label={selectedOption ? '✓' : '?'}
                        size="small"
                        color={selectedOption ? 'success' : 'warning'}
                        sx={{ mt: 0.5, minWidth: 32 }}
                      />
                    )}
                  </Box>
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
                const hasValue = field.value !== null && field.value !== undefined;

                return (
                  <Box display="flex" gap={1} alignItems="flex-start">
                    <Autocomplete
                      options={toOptions}
                      getOptionLabel={(option) => option.volumeId}
                      value={selectedOption}
                      onChange={(_, newValue) => {
                        if (newValue) {
                          field.onChange(newValue.ref);
                        } else {
                          field.onChange(null);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="To Volume"
                          size="small"
                          fullWidth
                          placeholder="Select volume"
                          error={!!errors.to}
                          helperText={
                            selectedOption
                              ? `${selectedOption.label}`
                              : (autoTo ? '✓ Auto-filled from connection' : 'Select from list')
                          }
                        />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <Box component="li" key={key} {...otherProps}>
                            <Box>
                              <Typography variant="body2">{option.volumeId}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.label}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
                      groupBy={(option) => option.componentName}
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
                      sx={{ flex: 1 }}
                    />
                    {hasValue && (
                      <Chip
                        label={selectedOption ? '✓' : '?'}
                        size="small"
                        color={selectedOption ? 'success' : 'warning'}
                        sx={{ mt: 0.5, minWidth: 32 }}
                      />
                    )}
                  </Box>
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
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
              inputProps={numberInputProps}
              InputProps={{
                endAdornment: <InputAdornment position="end">m²</InputAdornment>,
              }}
              error={!!errors.area}
              helperText={errors.area?.message || '0 = Auto (minimum adjacent volume flow area)'}
            />
          )}
        />

        <Controller
          name="useModifiedPvTerm"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Modified PV term (e-flag)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {field.value ? 'jefvcahs = 01000000' : 'jefvcahs = 00000000 (default)'}
                  </Typography>
                </Box>
              }
            />
          )}
        />

        <Divider />

        {/* Boundary Condition Type */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Flow Type
        </Typography>

        <Controller
          name="conditionType"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Condition Type"
              select
              size="small"
              fullWidth
            >
              <MenuItem value="1">1 - Mass Flow Rate (kg/s)</MenuItem>
              <MenuItem value="0">0 - Velocity (m/s)</MenuItem>
            </TextField>
          )}
        />

        <Divider />

        {/* Search Variable Control (Card 0200 W2-W4) */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Search Variable Control (Optional)
        </Typography>

        <Alert severity="info" icon={<InfoIcon />}>
          By default, time is used as the search variable. Optionally, you can use trips or other variables.
        </Alert>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="tripNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Trip Number (W2)"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Optional: Trip to control table lookup"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="variableType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? 'time'}
                  label="Variable Type (W3)"
                  select
                  size="small"
                  fullWidth
                  helperText="Search variable for time table lookup"
                >
                  {Object.entries(TMDP_SEARCH_VARIABLE_LABELS).map(([key, info]) => (
                    <MenuItem key={key} value={key}>
                      {info.label}{info.unit ? ` (${info.unit})` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          {watch('variableType') && watch('variableType') !== 'time' && (
            <Grid item xs={12} sm={4}>
              <Controller
                name="variableCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label={`Variable Code (W4) - ${TMDP_SEARCH_VARIABLE_LABELS[(watch('variableType') || 'time') as TmdpSearchVariableType]?.paramLabel || ''}`}
                    type="number"
                    size="small"
                    fullWidth
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    inputProps={{ min: 0, step: 1 }}
                    helperText="Component/Variable ID for search variable"
                  />
                )}
              />
            </Grid>
          )}
        </Grid>

        <Divider />

        {/* Time Table */}
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Time-Dependent Flow ({fields.length} points)
          </Typography>
          <Tooltip title="Add Time Point">
            <IconButton
              size="small"
              onClick={() => {
                const lastPoint = fields[fields.length - 1];
                append({
                  time: lastPoint ? lastPoint.time + 100 : 0,
                  mfl: lastPoint?.mfl || 0.0,
                  mfv: lastPoint?.mfv || 0.0,
                });
              }}
              color="primary"
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>
                  {(() => {
                    const vt = (watch('variableType') || 'time') as TmdpSearchVariableType;
                    const info = TMDP_SEARCH_VARIABLE_LABELS[vt];
                    return `${info.label}${info.unit ? ` (${info.unit})` : ''}`;
                  })()}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Liquid (kg/s)</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Vapor (kg/s)</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 60 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`timeTable.${index}.time`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          size="small"
                          fullWidth
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ minWidth: 80 }}
                        />
                      )}
                    />
                  </TableCell>

                  <TableCell>
                    <Controller
                      name={`timeTable.${index}.mfl`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          size="small"
                          fullWidth
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ minWidth: 100 }}
                        />
                      )}
                    />
                  </TableCell>

                  <TableCell>
                    <Controller
                      name={`timeTable.${index}.mfv`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          size="small"
                          fullWidth
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ minWidth: 100 }}
                        />
                      )}
                    />
                  </TableCell>

                  <TableCell>
                    {fields.length > 2 && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => remove(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {errors.timeTable && (
          <Typography variant="caption" color="error">
            {errors.timeTable.message}
          </Typography>
        )}
      </Box>
    </form>
  );
};

export default TmdpjunForm;
