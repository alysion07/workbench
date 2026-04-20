/**
 * SNGLJUN Parameter Form
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
  Chip,
  Grid,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, SngljunParameters, VolumeReference, CrossflowDialogInitialValues, FaceType } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

// Validation schema
const sngljunSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Connection (at least one required, validated in form)
  from: z.custom<VolumeReference | null>((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && 'nodeId' in val && 'volumeNum' in val && 'face' in val) {
      return true;
    }
    return false;
  }).nullable(),
  to: z.custom<VolumeReference | null>((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && 'nodeId' in val && 'volumeNum' in val && 'face' in val) {
      return true;
    }
    return false;
  }).nullable(),
  area: z.number().min(0, 'Must be non-negative'),
  
  // Loss Coefficients
  fwdLoss: z.number().min(0, 'Must be non-negative'),
  revLoss: z.number().min(0, 'Must be non-negative'),
  jefvcahs: z.string().regex(/^[0-9]{1,8}$/, 'Must be 1-8 digits').transform(v => v.padStart(8, '0')).optional(),
  
  // Initial Flow (optional)
  flowDirection: z.enum(['1', '-1', '0']).optional(),
  mfl: z.number().optional(),
  mfv: z.number().optional(),
});

type FormData = z.infer<typeof sngljunSchema>;

interface SngljunFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const SngljunForm: React.FC<SngljunFormProps> = ({ nodeId, data }) => {
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
      
      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch') {
        // Single volume: default faces only (1=Inlet, 2=Outlet)
        const faceLabels: Record<number, string> = {
          1: 'Inlet',
          2: 'Outlet',
        };

        for (let face = 1; face <= 2; face++) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face: face as 1|2 };
          const volumeId = resolver.getVolumeIdFromReference(ref) || '';
          options.push({
            ref,
            volumeId,
            label: `${compName} - ${faceLabels[face]}`,
            componentName: compName,
            componentType: compType,
          });
        }
      } else if (compType === 'pipe') {
        const params = node.data.parameters as any;
        const ncells = params?.ncells || 1;

        // PIPE: each cell has default faces only (1=Inlet, 2=Outlet)
        const faceLabels: Record<number, string> = {
          1: 'Inlet',
          2: 'Outlet',
        };

        for (let i = 1; i <= ncells; i++) {
          for (let face = 1; face <= 2; face++) {
            const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face: face as 1|2 };
            const volumeId = resolver.getVolumeIdFromReference(ref) || '';
            options.push({
              ref,
              volumeId,
              label: `${compName} - Cell ${i} ${faceLabels[face]}`,
              componentName: compName,
              componentType: compType,
            });
          }
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

  // Real-time validation helper (now works with VolumeReference)
  const validateVolumeConnection = (
    ref: VolumeReference | null,
    isFrom: boolean
  ): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!ref) {
      return { valid: true, errors: [], warnings: ['Not connected'] };
    }

    // Validate reference structure
    if (!resolver.validateVolumeReference(ref)) {
      errors.push('Invalid volume reference');
      return { valid: false, errors, warnings };
    }

    const targetNode = resolver.getNode(ref.nodeId);
    if (!targetNode) {
      errors.push('Referenced node not found');
      return { valid: false, errors, warnings };
    }

    const componentType = targetNode.data.componentType;

    // face=0 is legacy/old format (CCCVV0000) - always valid
    if (ref.face !== 0) {
      if (componentType === 'pipe') {
        const params = targetNode.data.parameters as any;
        const ncells = params?.ncells || 1;

        if (ref.volumeNum < 1 || ref.volumeNum > ncells) {
          errors.push(`Invalid cell number (1-${ncells} allowed)`);
        }

        // PIPE supports faces 1-6 (1-2: axial, 3-6: crossflow)
        if (ref.face < 1 || ref.face > 6) {
          errors.push('PIPE face must be between 1-6');
        }

        // For "from": typically outlet (face 2)
        if (isFrom && ref.face !== 2 && ref.face < 3) {
          warnings.push('From connection should typically use outlet (face 2)');
        }

        // For "to": typically inlet (face 1)
        if (!isFrom && ref.face !== 1 && ref.face < 3) {
          warnings.push('To connection should typically use inlet (face 1)');
        }
      } else if (componentType === 'snglvol' || componentType === 'tmdpvol') {
        // Volume components support faces 1-6 (1-2: axial, 3-6: crossflow)
        if (ref.face < 1 || ref.face > 6) {
          errors.push('Volume components face must be between 1-6');
        }

        // For "from": typically outlet (face 2)
        if (isFrom && ref.face !== 2 && ref.face < 3) {
          warnings.push('From connection should typically use outlet (face 2)');
        }

        // For "to": typically inlet (face 1)
        if (!isFrom && ref.face !== 1 && ref.face < 3) {
          warnings.push('To connection should typically use inlet (face 1)');
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
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
    resolver: zodResolver(sngljunSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      from: (data.parameters as Partial<SngljunParameters>)?.from || autoFrom || null,
      to: (data.parameters as Partial<SngljunParameters>)?.to || autoTo || null,
      area: 0.5,
      fwdLoss: 0.5,
      revLoss: 0.5,
      jefvcahs: '00000000',
      mfl: 0.0,
      mfv: 0.0,
      ...(data.parameters as Partial<SngljunParameters>),
      flowDirection: String((data.parameters as Partial<SngljunParameters>)?.flowDirection ?? '1') as '1' | '-1' | '0',
    },
  });
  
  // Reset form when node data changes (when user selects a different node or same node again)
  // Use ref to track loaded nodeId and parameters to prevent unnecessary resets
  const loadedNodeIdRef = useRef<string | null>(null);
  const loadedParamsRef = useRef<string>('');
  
  useEffect(() => {
    const params = data.parameters as Partial<SngljunParameters>;
    const fromValue: VolumeReference | null = params?.from || autoFrom || null;
    const toValue: VolumeReference | null = params?.to || autoTo || null;
    
    // Create a key to track parameter changes
    const paramsKey = JSON.stringify({ from: fromValue, to: toValue, componentId: data.componentId });
    
    // Only reset if nodeId changed or parameters actually changed
    if (loadedNodeIdRef.current === nodeId && loadedParamsRef.current === paramsKey) {
      return; // Skip reset if same node and same parameters
    }
    
    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      from: fromValue,
      to: toValue,
      area: params?.area ?? 0.5,
      fwdLoss: params?.fwdLoss ?? 0.5,
      revLoss: params?.revLoss ?? 0.5,
      jefvcahs: params?.jefvcahs ?? '00000000',
      flowDirection: params?.flowDirection ? params.flowDirection.toString() as '1' | '-1' | '0' : '1',
      mfl: params?.mfl ?? 0.0,
      mfv: params?.mfv ?? 0.0,
    });
    
    loadedNodeIdRef.current = nodeId;
    loadedParamsRef.current = paramsKey;
  }, [nodeId, reset, data.parameters, data.componentName, data.componentId, resolver, autoFrom, autoTo]);
  
  const onSubmit = (formData: FormData) => {
    const parameters: Partial<SngljunParameters> = {
      ...formData,
      from: formData.from ?? undefined,
      to: formData.to ?? undefined,
      flowDirection: formData.flowDirection ? parseInt(formData.flowDirection) as (1 | -1 | 0) : undefined,
    };

    // Validate
    const validationErrors = [];
    const validationWarnings = [];

    if (!formData.name) {
      validationErrors.push({ level: 'error' as const, message: 'Name is required' });
    }
    if (formData.area < 0) {
      validationErrors.push({ level: 'error' as const, message: 'Area must be non-negative' });
    }

    // Check from/to (now VolumeReference)
    const hasFrom = formData.from !== null && formData.from !== undefined;
    const hasTo = formData.to !== null && formData.to !== undefined;

    if (!hasFrom && !hasTo) {
      validationErrors.push({ level: 'error' as const, message: 'At least one connection (From or To) is required' });
    } else {
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
      handleSubmit(onSubmit, () => onSubmit(getValues()))();
    };
    setFormSubmitHandler(handler);
    return () => {
      setFormSubmitHandler(null);
    };
  }, [handleSubmit, setFormSubmitHandler, getValues]);

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
        // Only update the side(s) that were actually set in the dialog
        if (config.sourceNodeId) {
          const newFrom: VolumeReference = {
            nodeId: config.sourceNodeId,
            volumeNum: config.sourceCell,
            face: config.sourceFace,
          };
          setValue('from', newFrom, { shouldDirty: true, shouldValidate: true });
        }
        if (config.targetNodeId) {
          const newTo: VolumeReference = {
            nodeId: config.targetNodeId,
            volumeNum: config.targetCell,
            face: config.targetFace,
          };
          setValue('to', newTo, { shouldDirty: true, shouldValidate: true });
        }

        setTimeout(() => {
          handleSubmit(onSubmit, () => onSubmit(getValues()))();
        }, 0);
      },
    });
  };

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
              label="Junction Name"
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
        
        {/* Connection */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Connection
          </Typography>
          <Tooltip title="연결 Wizard 열기">
            <IconButton size="small" onClick={openCrossflowWizard} color="primary">
              <AccountTreeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Connection Status Alert */}
        {(() => {
          const fromValue = watch('from') as VolumeReference | null;
          const toValue = watch('to') as VolumeReference | null;
          const hasFrom = !!fromValue;
          const hasTo = !!toValue;
          const connected = hasFrom && hasTo;
          
          const fromValidation = validateVolumeConnection(fromValue, true);
          const toValidation = validateVolumeConnection(toValue, false);
          const allErrors = [...fromValidation.errors, ...toValidation.errors];
          const allWarnings = [...fromValidation.warnings, ...toValidation.warnings];
          
          if (allErrors.length > 0) {
            return (
              <Alert severity="error" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                  Validation Errors
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {allErrors.map((error, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{error}</Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            );
          }
          
          if (allWarnings.length > 0 && connected) {
            return (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                  Warnings
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {allWarnings.map((warning, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{warning}</Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            );
          }
          
          if (!connected) {
            return (
              <Alert severity="info" sx={{ mb: 1 }}>
                {!hasFrom && !hasTo
                  ? 'Connect From and To volumes to complete the junction'
                  : !hasFrom
                  ? 'Connect From volume to complete the junction'
                  : 'Connect To volume to complete the junction'}
              </Alert>
            );
          }
          
          return (
            <Alert severity="success" sx={{ mb: 1 }}>
              ✓ Junction is properly connected
            </Alert>
          );
        })()}
        
        {/* Connection Inputs */}
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
                  const fromRef = field.value as VolumeReference | null;
                  const fromValidation = validateVolumeConnection(fromRef, true);

                  return (
                    <Box>
                      <Box display="flex" gap={1} alignItems="flex-start">
                        <Autocomplete
                          options={fromOptions}
                          getOptionLabel={(option) => option.volumeId}
                          value={selectedOption}
                          onChange={(_, newValue) => {
                            field.onChange(newValue ? newValue.ref : null);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="From Volume"
                              size="small"
                              fullWidth
                              placeholder="Select volume"
                              error={!!errors.from || !fromValidation.valid}
                              helperText={
                                fromValidation.errors.length > 0
                                  ? fromValidation.errors[0]
                                  : selectedOption
                                  ? selectedOption.componentName
                                  : errors.from?.message || 'Select from list'
                              }
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <Box component="li" key={key} {...otherProps}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.volumeId}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.componentName}
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
                        {fromRef && (
                          <Chip
                            label={fromValidation.valid ? '✓' : '✗'}
                            size="small"
                            color={fromValidation.valid ? 'success' : 'error'}
                            sx={{ mt: 0.5, minWidth: 32 }}
                          />
                        )}
                      </Box>
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
                  const toRef = field.value as VolumeReference | null;
                  const toValidation = validateVolumeConnection(toRef, false);

                  return (
                    <Box>
                      <Box display="flex" gap={1} alignItems="flex-start">
                        <Autocomplete
                          options={toOptions}
                          getOptionLabel={(option) => option.volumeId}
                          value={selectedOption}
                          onChange={(_, newValue) => {
                            field.onChange(newValue ? newValue.ref : null);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="To Volume"
                              size="small"
                              fullWidth
                              placeholder="Select volume"
                              error={!!errors.to || !toValidation.valid}
                              helperText={
                                toValidation.errors.length > 0
                                  ? toValidation.errors[0]
                                  : selectedOption
                                  ? selectedOption.componentName
                                  : errors.to?.message || 'Select from list'
                              }
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <Box component="li" key={key} {...otherProps}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.volumeId}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.componentName}
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
                        {toRef && (
                          <Chip
                            label={toValidation.valid ? '✓' : '✗'}
                            size="small"
                            color={toValidation.valid ? 'success' : 'error'}
                            sx={{ mt: 0.5, minWidth: 32 }}
                          />
                        )}
                      </Box>
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
              required
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.5)}
              inputProps={numberInputProps}
              InputProps={{
                endAdornment: <InputAdornment position="end">m²</InputAdornment>,
              }}
              error={!!errors.area}
              helperText={errors.area?.message || 'Example: 0.5'}
            />
          )}
        />
        
        <Divider />
        
        {/* Loss Coefficients */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Pressure Loss Coefficients
        </Typography>
        
        <Controller
          name="fwdLoss"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Forward Loss Coefficient"
              type="number"
              size="small"
              fullWidth
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.5)}
              inputProps={numberInputProps}
              error={!!errors.fwdLoss}
              helperText={errors.fwdLoss?.message || 'Pressure loss in forward direction (e.g., 0.5)'}
            />
          )}
        />
        
        <Controller
          name="revLoss"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Reverse Loss Coefficient"
              type="number"
              size="small"
              fullWidth
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.5)}
              inputProps={numberInputProps}
              error={!!errors.revLoss}
              helperText={errors.revLoss?.message || 'Pressure loss in reverse direction (e.g., 0.5)'}
            />
          )}
        />
        
        <Controller
          name="jefvcahs"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Control Flags (jefvcahs)"
              size="small"
              fullWidth
              error={!!errors.jefvcahs}
              helperText={errors.jefvcahs?.message || '8-digit control flags (default: 00000000)'}
              placeholder="00000000"
            />
          )}
        />
        
        <Divider />
        
        {/* Initial Flow Conditions (Optional) */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Initial Flow Conditions (Optional)
        </Typography>
        
        <Controller
          name="flowDirection"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Flow Direction"
              select
              size="small"
              fullWidth
            >
              <MenuItem value="1">1 - Forward (from → to)</MenuItem>
              <MenuItem value="-1">-1 - Reverse (to → from)</MenuItem>
              <MenuItem value="0">0 - Stagnant (no flow)</MenuItem>
            </TextField>
          )}
        />
        
        <Controller
          name="mfl"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Initial Liquid Flow Rate"
              type="number"
              size="small"
              fullWidth
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
              }}
              helperText="Liquid mass flow rate"
            />
          )}
        />
        
        <Controller
          name="mfv"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Initial Vapor Flow Rate"
              type="number"
              size="small"
              fullWidth
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
              }}
              helperText="Vapor mass flow rate"
            />
          )}
        />
      </Box>
    </form>
  );
};

export default SngljunForm;

