/**
 * MTPLJUN Parameter Form
 * Multiple Junction component with multiple junctions (1-99)
 * Phase 1: SMART.i 사용 항목만 구현
 */

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Button,
  Divider,
  InputAdornment,
  Alert,
  Chip,
  Grid,
  IconButton,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Info as InfoIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, MtpljunParameters, MtpljunJunction, VolumeReference, CrossflowDialogInitialValues, FaceType } from '@/types/mars';
import { handleNumberChange, handleNumberBlur } from '@/utils/inputHelpers';
import ComponentIdField from './ComponentIdField';

import { NodeIdResolver } from '@/utils/nodeIdResolver';

// Validation schema
const volumeRefValidator = z.custom<VolumeReference | null>((val) => {
  if (val === null || val === undefined) return true;
  if (typeof val === 'object' && val !== null && 'nodeId' in val && 'volumeNum' in val && 'face' in val) return true;
  return false;
}, { message: 'Invalid volume reference' }).nullable();

const junctionSchema = z.object({
  junctionNumber: z.number().int().min(1).max(99),
  from: volumeRefValidator,
  to: volumeRefValidator,
  area: z.number().min(0),
  fwdLoss: z.number().min(0),
  revLoss: z.number().min(0),
  jefvcahs: z.string().regex(/^[0-9]{1,8}$/, 'Must be 1-8 digits').transform(v => v.padStart(8, '0')).optional(),
  dischargeCoeff: z.number().positive().optional(),  // Henry-Fauske W7 (default: 1.0)
  thermalConstant: z.number().min(0).optional(),     // Henry-Fauske W8 (default: 0.14)
  subDc: z.number().positive().optional(),            // RELAP5 W7
  twoDc: z.number().positive().optional(),            // RELAP5 W8
  supDc: z.number().positive().optional(),            // RELAP5 W9
  fIncre: z.number().int().optional(),
  tIncre: z.number().int().optional(),
  initialLiquidFlow: z.number().optional(),
  initialVaporFlow: z.number().optional(),
});

const mtpljunSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),
  njuns: z.number().int().min(1, 'Min 1 junction').max(99, 'Max 99 junctions'),
  icond: z.union([z.literal(0), z.literal(1)]),
  junctions: z.array(junctionSchema).min(1, 'At least 1 junction required').max(99, 'Maximum 99 junctions'),
})
.refine((data) => {
  return data.njuns === data.junctions.length;
}, {
  message: 'Number of junctions (njuns) must match actual junction count',
  path: ['njuns'],
})
.refine((data) => {
  const numbers = data.junctions.map(j => j.junctionNumber);
  const uniqueNumbers = new Set(numbers);
  return numbers.length === uniqueNumbers.size && 
         numbers.every(n => n >= 1 && n <= 99);
}, {
  message: 'Junction numbers must be unique and between 1-99',
  path: ['junctions'],
});

type FormData = z.infer<typeof mtpljunSchema>;

interface MtpljunFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const MtpljunForm: React.FC<MtpljunFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, nodes, setPropertyFormState, setFormSubmitHandler, openCrossflowDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, nodes: state.nodes, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, openCrossflowDialog: state.openCrossflowDialog })));
  const [activeJunctionTab, setActiveJunctionTab] = useState(0);


  const [validationResults, setValidationResults] = useState<Map<number, {
    fromValid: boolean;
    toValid: boolean;
    fromErrors: string[];
    toErrors: string[];
    warnings: string[];
  }>>(new Map());

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Initialize NodeIdResolver
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Helper: Parse legacy string or VolumeReference to VolumeReference | null
  const parseJunctionRef = (ref: VolumeReference | string | null | undefined): VolumeReference | null => {
    if (!ref) return null;
    if (typeof ref === 'object' && 'nodeId' in ref) {
      return ref.nodeId ? ref : null;
    }
    if (typeof ref === 'string' && /^\d{9}$/.test(ref)) {
      return resolver.parseVolumeId(ref) || null;
    }
    return null;
  };

  // Helper: Compare two VolumeReferences for equality
  const volumeRefsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
  };

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
      label: `${volumeId} (${compName}, ${faceLabel} CrossFlow)`,
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

  // Real-time validation helper
  const validateVolumeConnection = (
    ref: VolumeReference | null,
    _isFrom: boolean,
    currentJunctionIndex: number
  ): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Null check
    if (!ref) {
      return { valid: true, errors: [], warnings: ['Not connected'] };
    }

    // 2. Resolve to volume ID for validation
    const isValidRef = resolver.validateVolumeReference(ref);
    if (!isValidRef) {
      errors.push('Invalid volume reference (target not found)');
      return { valid: false, errors, warnings };
    }

    const targetNode = resolver.getNode(ref.nodeId);
    if (!targetNode) {
      errors.push('Referenced component not found');
      return { valid: false, errors, warnings };
    }

    // 3. Component type and face validation
    const componentType = targetNode.data.componentType;

    // face=0 is legacy/old format (CCCVV0000) - always valid
    if (ref.face !== 0) {
      if (componentType === 'pipe') {
        const params = targetNode.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells;
          if (ref.volumeNum < 1 || ref.volumeNum > ncells) {
            errors.push(`Invalid cell number (1-${ncells} allowed)`);
          }
          if (ref.face < 1 || ref.face > 6) {
            errors.push('PIPE face must be between 1-6');
          }
        }
      } else if (componentType === 'snglvol' || componentType === 'tmdpvol' || componentType === 'branch') {
        if (ref.volumeNum !== 1) {
          errors.push('Single volume component must use volume 01');
        }
        if (ref.face < 1 || ref.face > 6) {
          errors.push('Face number must be 1-6');
        }
      }
    }

    // 4. Duplicate connection detection
    const currentJunctions = watch('junctions');
    const duplicates = currentJunctions.filter((junction, idx) => {
      if (idx === currentJunctionIndex) return false;
      return volumeRefsEqual(junction.from, ref) || volumeRefsEqual(junction.to, ref);
    });

    if (duplicates.length > 0) {
      warnings.push(`Volume already used in ${duplicates.length} other junction(s)`);
    }

    // 5. Self-connection check
    const currentFrom = watch(`junctions.${currentJunctionIndex}.from`);
    const currentTo = watch(`junctions.${currentJunctionIndex}.to`);

    if (currentFrom && currentTo && volumeRefsEqual(currentFrom, currentTo)) {
      errors.push('Cannot connect volume to itself');
    }

    return { valid: errors.length === 0, errors, warnings };
  };

  // Generate available volume references for Autocomplete
  const availableVolumes = useMemo(() => {
    type VolumeOption = { ref: VolumeReference; volumeId: string; label: string; componentName: string; componentType: string };
    const options: VolumeOption[] = [];

    nodes.forEach(node => {
      if (node.id === nodeId) return; // Skip self
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;

      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch') {
        for (let face = 1; face <= 2; face++) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face };
          const volumeId = resolver.getVolumeIdFromReference(ref);
          if (volumeId) {
            options.push({
              ref,
              volumeId,
              label: `${volumeId} (${compName}, ${face === 1 ? 'Inlet' : 'Outlet'})`,
              componentName: compName,
              componentType: compType,
            });
          }
        }
      } else if (compType === 'pipe') {
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells; i++) {
            for (let face = 1; face <= 2; face++) {
              const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face };
              const volumeId = resolver.getVolumeIdFromReference(ref);
              if (volumeId) {
                options.push({
                  ref,
                  volumeId,
                  label: `${volumeId} (${compName}, Cell ${i}, ${face === 1 ? 'Inlet' : 'Outlet'})`,
                  componentName: compName,
                  componentType: compType,
                });
              }
            }
          }
        }
      }
    });

    return options;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest, nodeId, resolver]);
  
  const params = data.parameters as Partial<MtpljunParameters>;
  const defaultNjuns = params?.njuns || 1;

  // Default junctions - memoized to prevent infinite loop
  const defaultJunctions = useMemo(() => {
    const rawDefaultJunctions = params?.junctions || [{
      junctionNumber: 1,
      from: null as VolumeReference | null,
      to: null as VolumeReference | null,
      area: 0,
      fwdLoss: 0,
      revLoss: 0,
      jefvcahs: '00000000',
      dischargeCoeff: 1.0,
      thermalConstant: 0.14,
      subDc: 1.0,
      twoDc: 1.0,
      supDc: 1.0,
      fIncre: 10000,
      tIncre: 10000,
      initialLiquidFlow: 0.0,
      initialVaporFlow: 0.0,
    }];

    // Convert legacy string references to VolumeReference
    return rawDefaultJunctions.map(j => ({
      ...j,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.junctions, resolver]);
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(mtpljunSchema),
    defaultValues: {
      name: data.componentName || '',
      njuns: defaultNjuns,
      icond: params?.icond ?? 1,
      junctions: defaultJunctions,
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'junctions',
  });

  const icond = watch('icond');
  // Note: njuns is auto-calculated from junctions.length
  const junctions = watch('junctions');
  
  // Track if we just added a junction to move to new tab
  const [justAddedJunction, setJustAddedJunction] = useState(false);

  // Real-time validation effect - triggers when junction connections change
  useEffect(() => {
    const newValidationResults = new Map();

    junctions.forEach((junction, index) => {
      const fromValidation = validateVolumeConnection(junction.from, true, index);
      const toValidation = validateVolumeConnection(junction.to, false, index);

      // Combine warnings
      const allWarnings = [...fromValidation.warnings, ...toValidation.warnings];

      newValidationResults.set(index, {
        fromValid: fromValidation.valid,
        toValid: toValidation.valid,
        fromErrors: fromValidation.errors,
        toErrors: toValidation.errors,
        warnings: allWarnings,
      });
    });

    setValidationResults(newValidationResults);
  }, [junctions, nodes]);

  // Check junction connection status - ENHANCED with real-time validation
  const getJunctionStatus = (index: number): {
    connected: boolean;
    hasFrom: boolean;
    hasTo: boolean;
    valid: boolean;
    errors: string[];
    warnings: string[];
  } => {
    const junction = junctions[index];
    if (!junction) return {
      connected: false,
      hasFrom: false,
      hasTo: false,
      valid: false,
      errors: [],
      warnings: [],
    };

    const hasFrom = junction.from !== null && junction.from !== undefined;
    const hasTo = junction.to !== null && junction.to !== undefined;
    const connected = hasFrom && hasTo;

    const validation = validationResults.get(index);
    const valid = validation ? validation.fromValid && validation.toValid : false;
    const errors = validation
      ? [...validation.fromErrors, ...validation.toErrors]
      : [];
    const warnings = validation?.warnings || [];

    return { connected, hasFrom, hasTo, valid, errors, warnings };
  };
  
  // When adding/removing junctions, adjust active tab
  useEffect(() => {
    if (justAddedJunction && fields.length > 0) {
      setActiveJunctionTab(fields.length - 1);
      setJustAddedJunction(false);
    } else if (activeJunctionTab >= fields.length && fields.length > 0) {
      setActiveJunctionTab(Math.max(0, fields.length - 1));
    }
  }, [fields.length, activeJunctionTab, justAddedJunction]);
  
  // Handle Add Junction
  const handleAddJunction = () => {
    const currentJunctions = watch('junctions');
    const existingNumbers = currentJunctions.map(j => j.junctionNumber);
    
    // Find next available junction number (1-99)
    let nextNumber = 1;
    while (existingNumbers.includes(nextNumber) && nextNumber <= 99) {
      nextNumber++;
    }
    
    if (nextNumber > 99) {
      alert('Maximum 99 junctions allowed');
      return;
    }
    
    append({
      junctionNumber: nextNumber,
      from: null,
      to: null,
      area: 0,
      fwdLoss: 0,
      revLoss: 0,
      jefvcahs: '00000000',
      dischargeCoeff: 1.0,
      thermalConstant: 0.14,
      subDc: 1.0,
      twoDc: 1.0,
      supDc: 1.0,
      fIncre: 10000,
      tIncre: 10000,
      initialLiquidFlow: 0.0,
      initialVaporFlow: 0.0,
    });

    setValue('njuns', currentJunctions.length + 1);
    setJustAddedJunction(true);
  };
  
  // Handle Remove Junction
  const handleRemoveJunction = (index: number) => {
    const currentJunctions = watch('junctions');
    
    if (currentJunctions.length <= 1) {
      alert('MTPLJUN must have at least 1 junction');
      return;
    }
    
    remove(index);
    setValue('njuns', currentJunctions.length - 1);
  };

  // Open Crossflow Wizard for specific junction
  const openCrossflowWizardForJunction = (junctionIndex: number) => {
    const junction = watch(`junctions.${junctionIndex}`);
    const fromRef = junction.from;
    const toRef = junction.to;

    const initialValues: CrossflowDialogInitialValues = {
      junctionNodeId: nodeId,
      junctionNumber: junction.junctionNumber,
      fromVolumeNodeId: fromRef?.nodeId,
      fromCell: fromRef?.volumeNum,
      fromFace: fromRef?.face as FaceType,
      toVolumeNodeId: toRef?.nodeId,
      toCell: toRef?.volumeNum,
      toFace: toRef?.face as FaceType,
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
          setValue(`junctions.${junctionIndex}.from`, newFrom, { shouldDirty: true });
        }
        if (config.targetNodeId) {
          const newTo: VolumeReference = {
            nodeId: config.targetNodeId,
            volumeNum: config.targetCell,
            face: config.targetFace,
          };
          setValue(`junctions.${junctionIndex}.to`, newTo, { shouldDirty: true });
        }

        setTimeout(() => {
          handleSubmit(onSubmit)();
        }, 0);
      },
    });
  };
  
  // Reset form when node data changes
  useEffect(() => {
    const params = data.parameters as Partial<MtpljunParameters>;
    const currentJunctions = params?.junctions || defaultJunctions;

    // Convert legacy string references to VolumeReference
    const formJunctions = currentJunctions.map(j => ({
      ...j,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
    }));

    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: currentJunctions.length,
      icond: params?.icond ?? 1,
      junctions: formJunctions,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, data, reset, defaultJunctions, resolver]);
  
  const onSubmit = (formData: FormData) => {
    // Build normalized junctions with VolumeReference
    const normalizedJunctions: MtpljunJunction[] = formData.junctions.map(j => ({
      junctionNumber: j.junctionNumber,
      from: j.from || { nodeId: '', volumeNum: 1, face: 1 },
      to: j.to || { nodeId: '', volumeNum: 1, face: 1 },
      area: j.area ?? 0,
      fwdLoss: j.fwdLoss ?? 0,
      revLoss: j.revLoss ?? 0,
      jefvcahs: j.jefvcahs || '00000000',
      dischargeCoeff: j.dischargeCoeff ?? 1.0,
      thermalConstant: j.thermalConstant ?? 0.14,
      subDc: j.subDc ?? 1.0,
      twoDc: j.twoDc ?? 1.0,
      supDc: j.supDc ?? 1.0,
      fIncre: j.fIncre ?? 10000,
      tIncre: j.tIncre ?? 10000,
      initialLiquidFlow: j.initialLiquidFlow ?? 0.0,
      initialVaporFlow: j.initialVaporFlow ?? 0.0,
    }));

    const parameters: Partial<MtpljunParameters> = {
      njuns: normalizedJunctions.length,
      icond: formData.icond,
      junctions: normalizedJunctions,
    };

    // Validate
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

    if (!formData.name) validationErrors.push({ level: 'error', message: 'Name is required' });

    // Junction validation
    formData.junctions.forEach((junction) => {
      if (junction.from && !resolver.validateVolumeReference(junction.from)) {
        validationErrors.push({
          level: 'error',
          message: `Junction ${junction.junctionNumber}: Invalid 'from' volume reference`,
        });
      }
      if (junction.to && !resolver.validateVolumeReference(junction.to)) {
        validationErrors.push({
          level: 'error',
          message: `Junction ${junction.junctionNumber}: Invalid 'to' volume reference`,
        });
      }
      if (!junction.from && !junction.to) {
        validationWarnings.push({
          level: 'warning',
          message: `Junction ${junction.junctionNumber}: Not connected to any volume`,
        });
      }
    });

    const status = validationErrors.length === 0 ? 'valid' : 'error';

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

  return (
    <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
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
              label="Component Name"
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
        
        <Controller
          name="njuns"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Number of Junctions"
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 1, max: 99, readOnly: true }}
              disabled
              value={fields.length}
              error={!!errors.njuns}
              helperText={errors.njuns?.message || 'Auto-calculated from junction list'}
            />
          )}
        />
        
        <Controller
          name="icond"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Initial Condition Control"
              size="small"
              fullWidth
              required
              error={!!errors.icond}
              helperText={errors.icond?.message || '0: velocities (m/s), 1: mass flows (kg/s)'}
            >
              <MenuItem value={0}>0: Velocities (m/s)</MenuItem>
              <MenuItem value={1}>1: Mass Flows (kg/s)</MenuItem>
            </TextField>
          )}
        />
        
        <Divider />
        
        {/* Junctions */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Junctions ({fields.length})
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddJunction}
            disabled={fields.length >= 99}
          >
            Add Junction
          </Button>
        </Box>
        
        {/* Junction Buttons Grid */}
        {fields.length > 0 && (
          <>
            <Box mb={1}>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {fields.map((field, index) => {
                  const status = getJunctionStatus(index);
                  const junctionNum = watch(`junctions.${index}.junctionNumber`);
                  const isSelected = index === activeJunctionTab;

                  // Determine button color based on validation status
                  let buttonColor = '#795548'; // Default brown
                  let bgColor = isSelected ? '#EFEBE9' : 'white';
                  let iconColor: 'error' | 'warning' | 'success' | 'disabled' = 'disabled';

                  if (status.errors.length > 0) {
                    buttonColor = '#d32f2f'; // Red for errors
                    bgColor = isSelected ? '#ffebee' : 'white';
                    iconColor = 'error';
                  } else if (status.warnings.length > 0 && status.connected) {
                    buttonColor = '#f57c00'; // Orange for warnings
                    bgColor = isSelected ? '#fff3e0' : 'white';
                    iconColor = 'warning';
                  } else if (status.connected && status.valid) {
                    buttonColor = '#2e7d32'; // Green for valid
                    bgColor = isSelected ? '#e8f5e9' : 'white';
                    iconColor = 'success';
                  }

                  return (
                    <Button
                      key={field.id}
                      variant="outlined"
                      onClick={() => setActiveJunctionTab(index)}
                      startIcon={
                        status.connected ? (
                          <CheckCircleIcon fontSize="small" color={iconColor} />
                        ) : (
                          <RadioButtonUncheckedIcon fontSize="small" />
                        )
                      }
                      sx={{
                        minWidth: 100,
                        textTransform: 'none',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: buttonColor,
                        color: buttonColor,
                        backgroundColor: bgColor,
                        '&:hover': {
                          backgroundColor: isSelected ? bgColor : '#F5F5F5',
                          borderColor: buttonColor,
                          opacity: 0.8,
                        },
                      }}
                    >
                      J{junctionNum}
                    </Button>
                  );
                })}
              </Box>
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            {/* Active Junction Form */}
            {fields.map((field, index) => {
              if (index !== activeJunctionTab) return null;
              
              return (
                <Box key={field.id} display="flex" flexDirection="column" gap={1}>
                  {/* Junction Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                      Junction {watch(`junctions.${index}.junctionNumber`)} Details
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        handleRemoveJunction(index);
                        if (activeJunctionTab > 0) {
                          setActiveJunctionTab(activeJunctionTab - 1);
                        } else if (fields.length > 1) {
                          setActiveJunctionTab(0);
                        }
                      }}
                      disabled={fields.length <= 1}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {/* Connection Status Alert - ENHANCED with real-time validation */}
                  {(() => {
                    const status = getJunctionStatus(index);

                    // Show errors with highest priority
                    if (status.errors.length > 0) {
                      return (
                        <Alert severity="error">
                          <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                            Validation Errors
                          </Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2 }}>
                            {status.errors.map((error, idx) => (
                              <li key={idx}>
                                <Typography variant="body2">{error}</Typography>
                              </li>
                            ))}
                          </Box>
                        </Alert>
                      );
                    }

                    // Show warnings
                    if (status.warnings.length > 0 && status.connected) {
                      return (
                        <Alert severity="warning">
                          <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                            Warnings
                          </Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2 }}>
                            {status.warnings.map((warning, idx) => (
                              <li key={idx}>
                                <Typography variant="body2">{warning}</Typography>
                              </li>
                            ))}
                          </Box>
                        </Alert>
                      );
                    }

                    // Show connection status
                    if (!status.connected) {
                      return (
                        <Alert severity="info" icon={<InfoIcon />}>
                          {!status.hasFrom && !status.hasTo
                            ? 'Not connected: Set From and To Volume IDs'
                            : !status.hasFrom
                            ? 'Incomplete: Set From Volume ID'
                            : 'Incomplete: Set To Volume ID'}
                        </Alert>
                      );
                    }

                    // Show success when fully connected and valid
                    if (status.connected && status.valid) {
                      return (
                        <Alert severity="success">
                          Connection valid and ready
                        </Alert>
                      );
                    }

                    return null;
                  })()}
                  
                  {/* Connection Information */}
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                      Connection Information
                    </Typography>
                    <Tooltip title="연결 Wizard 열기">
                      <IconButton size="small" onClick={() => openCrossflowWizardForJunction(index)} color="primary">
                        <AccountTreeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={4}>
                      <Controller
                        name={`junctions.${index}.junctionNumber`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Junction Number"
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ min: 1, max: 99 }}
                            error={!!errors.junctions?.[index]?.junctionNumber}
                            helperText={errors.junctions?.[index]?.junctionNumber?.message || '1-99'}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              field.onChange(Math.max(1, Math.min(99, value)));
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* FROM Volume Selection */}
                    <Grid item xs={12} sm={4}>
                      <Controller
                        name={`junctions.${index}.from`}
                        control={control}
                        render={({ field }) => {
                          const selectedOption = availableVolumes.find(opt => volumeRefsEqual(opt.ref, field.value))
                            || buildCrossflowOption(field.value)
                            || buildOldFormatOption(field.value)
                            || null;
                          const fromOptions = selectedOption && !availableVolumes.find(opt => volumeRefsEqual(opt.ref, field.value))
                            ? [...availableVolumes, selectedOption]
                            : availableVolumes;
                          const fromValidation = validateVolumeConnection(field.value, true, index);
                          const displayValue = field.value ? (resolver.getVolumeIdFromReference(field.value) || '') : '';

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
                                  isOptionEqualToValue={(option, value) => volumeRefsEqual(option.ref, value.ref)}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="From Volume"
                                      size="small"
                                      fullWidth
                                      placeholder="Select volume"
                                      error={!!errors.junctions?.[index]?.from || !fromValidation.valid}
                                      helperText={
                                        fromValidation.errors.length > 0
                                          ? fromValidation.errors[0]
                                          : errors.junctions?.[index]?.from?.message ||
                                            (displayValue ? displayValue : 'Select from list')
                                      }
                                    />
                                  )}
                                  renderOption={(props, option) => (
                                    <Box component="li" {...props}>
                                      <Box>
                                        <Typography variant="body2">{option.volumeId}</Typography>
                                        <Typography variant="caption" color="text.secondary">{option.label}</Typography>
                                      </Box>
                                    </Box>
                                  )}
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
                                {field.value && (
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

                    {/* TO Volume Selection */}
                    <Grid item xs={12} sm={4}>
                      <Controller
                        name={`junctions.${index}.to`}
                        control={control}
                        render={({ field }) => {
                          const selectedOption = availableVolumes.find(opt => volumeRefsEqual(opt.ref, field.value))
                            || buildCrossflowOption(field.value)
                            || buildOldFormatOption(field.value)
                            || null;
                          const toOptions = selectedOption && !availableVolumes.find(opt => volumeRefsEqual(opt.ref, field.value))
                            ? [...availableVolumes, selectedOption]
                            : availableVolumes;
                          const toValidation = validateVolumeConnection(field.value, false, index);
                          const displayValue = field.value ? (resolver.getVolumeIdFromReference(field.value) || '') : '';

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
                                  isOptionEqualToValue={(option, value) => volumeRefsEqual(option.ref, value.ref)}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="To Volume"
                                      size="small"
                                      fullWidth
                                      placeholder="Select volume"
                                      error={!!errors.junctions?.[index]?.to || !toValidation.valid}
                                      helperText={
                                        toValidation.errors.length > 0
                                          ? toValidation.errors[0]
                                          : errors.junctions?.[index]?.to?.message ||
                                            (displayValue ? displayValue : 'Select from list')
                                      }
                                    />
                                  )}
                                  renderOption={(props, option) => (
                                    <Box component="li" {...props}>
                                      <Box>
                                        <Typography variant="body2">{option.volumeId}</Typography>
                                        <Typography variant="caption" color="text.secondary">{option.label}</Typography>
                                      </Box>
                                    </Box>
                                  )}
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
                                {field.value && (
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



                  <Divider sx={{ my: 1 }} />

                  <Controller
                    name={`junctions.${index}.area`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value !== undefined 
                          ? (Math.abs(field.value) >= 1e6 || (Math.abs(field.value) < 1e-3 && field.value !== 0)
                            ? field.value.toExponential(6)
                            : field.value.toString())
                          : ''}
                        label="Area"
                        type="text"
                        size="small"
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m²</InputAdornment>,
                        }}
                        error={!!errors.junctions?.[index]?.area}
                        helperText={errors.junctions?.[index]?.area?.message || '0 = auto (minimum adjoining volume area)'}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-' || val === '.') {
                            field.onChange(undefined);
                            return;
                          }
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) {
                            field.onChange(parsed);
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-' || val === '.') {
                            field.onChange(0);
                            return;
                          }
                          const parsed = parseFloat(val);
                          field.onChange(isNaN(parsed) ? 0 : parsed);
                        }}
                      />
                    )}
                  />
                  
                  <Divider />
                  
                  {/* Pressure Loss */}
                  <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                    Pressure Loss
                  </Typography>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.fwdLoss`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value !== undefined 
                              ? (Math.abs(field.value) >= 1e6 || (Math.abs(field.value) < 1e-3 && field.value !== 0)
                                ? field.value.toExponential(6)
                                : field.value.toString())
                              : ''}
                            label="Forward Loss Coefficient"
                            type="text"
                            size="small"
                            fullWidth
                            error={!!errors.junctions?.[index]?.fwdLoss}
                            helperText={errors.junctions?.[index]?.fwdLoss?.message}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(undefined);
                                return;
                              }
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                field.onChange(parsed);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(0);
                                return;
                              }
                              const parsed = parseFloat(val);
                              field.onChange(isNaN(parsed) ? 0 : parsed);
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.revLoss`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value !== undefined 
                              ? (Math.abs(field.value) >= 1e6 || (Math.abs(field.value) < 1e-3 && field.value !== 0)
                                ? field.value.toExponential(6)
                                : field.value.toString())
                              : ''}
                            label="Reverse Loss Coefficient"
                            type="text"
                            size="small"
                            fullWidth
                            error={!!errors.junctions?.[index]?.revLoss}
                            helperText={errors.junctions?.[index]?.revLoss?.message}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(undefined);
                                return;
                              }
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                field.onChange(parsed);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(0);
                                return;
                              }
                              const parsed = parseFloat(val);
                              field.onChange(isNaN(parsed) ? 0 : parsed);
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                  
                  <Controller
                    name={`junctions.${index}.jefvcahs`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Junction Control Flags"
                        size="small"
                        fullWidth
                        placeholder="00000000"
                        error={!!errors.junctions?.[index]?.jefvcahs}
                        helperText={errors.junctions?.[index]?.jefvcahs?.message || '8-digit flags (format: 0ef0cahs)'}
                        inputProps={{ maxLength: 8 }}
                      />
                    )}
                  />
                  
                  <Divider />
                  
                  {/* Discharge Coefficients - depends on c-flag in jefvcahs */}
                  {(() => {
                    const flags = watch(`junctions.${index}.jefvcahs`) || '00000000';
                    const cFlag = flags.length >= 5 ? parseInt(flags[4], 10) : 0;
                    const isRelap5 = cFlag === 1;
                    return (
                      <>
                        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                          {isRelap5 ? 'Discharge Coefficients (RELAP5 Critical Flow)' : 'Discharge Coefficient (Henry-Fauske)'}
                        </Typography>

                        {isRelap5 ? (
                          <Grid container spacing={1}>
                            <Grid item xs={12} sm={4}>
                              <Controller
                                name={`junctions.${index}.subDc`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value !== undefined ? field.value.toString() : ''}
                                    label="Subcooled (sub_dc)"
                                    type="text"
                                    size="small"
                                    fullWidth
                                    placeholder="1.0"
                                    error={!!errors.junctions?.[index]?.subDc}
                                    helperText={errors.junctions?.[index]?.subDc?.message || 'Default: 1.0'}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(undefined); return; }
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) field.onChange(parsed);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(1.0); return; }
                                      const parsed = parseFloat(val);
                                      field.onChange(isNaN(parsed) ? 1.0 : parsed);
                                    }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Controller
                                name={`junctions.${index}.twoDc`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value !== undefined ? field.value.toString() : ''}
                                    label="Two-phase (two_dc)"
                                    type="text"
                                    size="small"
                                    fullWidth
                                    placeholder="1.0"
                                    error={!!errors.junctions?.[index]?.twoDc}
                                    helperText={errors.junctions?.[index]?.twoDc?.message || 'Default: 1.0'}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(undefined); return; }
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) field.onChange(parsed);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(1.0); return; }
                                      const parsed = parseFloat(val);
                                      field.onChange(isNaN(parsed) ? 1.0 : parsed);
                                    }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Controller
                                name={`junctions.${index}.supDc`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value !== undefined ? field.value.toString() : ''}
                                    label="Superheated (sup_dc)"
                                    type="text"
                                    size="small"
                                    fullWidth
                                    placeholder="1.0"
                                    error={!!errors.junctions?.[index]?.supDc}
                                    helperText={errors.junctions?.[index]?.supDc?.message || 'Default: 1.0'}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(undefined); return; }
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) field.onChange(parsed);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(1.0); return; }
                                      const parsed = parseFloat(val);
                                      field.onChange(isNaN(parsed) ? 1.0 : parsed);
                                    }}
                                  />
                                )}
                              />
                            </Grid>
                          </Grid>
                        ) : (
                          <Grid container spacing={1}>
                            <Grid item xs={12} sm={6}>
                              <Controller
                                name={`junctions.${index}.dischargeCoeff`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value !== undefined ? field.value.toString() : ''}
                                    label="Discharge Coefficient"
                                    type="text"
                                    size="small"
                                    fullWidth
                                    placeholder="1.0"
                                    error={!!errors.junctions?.[index]?.dischargeCoeff}
                                    helperText={errors.junctions?.[index]?.dischargeCoeff?.message || 'Default: 1.0'}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(undefined); return; }
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) field.onChange(parsed);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(1.0); return; }
                                      const parsed = parseFloat(val);
                                      field.onChange(isNaN(parsed) ? 1.0 : parsed);
                                    }}
                                  />
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Controller
                                name={`junctions.${index}.thermalConstant`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value !== undefined ? field.value.toString() : ''}
                                    label="Thermal Nonequil. Constant"
                                    type="text"
                                    size="small"
                                    fullWidth
                                    placeholder="0.14"
                                    error={!!errors.junctions?.[index]?.thermalConstant}
                                    helperText={errors.junctions?.[index]?.thermalConstant?.message || 'Default: 0.14'}
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(undefined); return; }
                                      const parsed = parseFloat(val);
                                      if (!isNaN(parsed)) field.onChange(parsed);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val === '' || val === '-' || val === '.') { field.onChange(0.14); return; }
                                      const parsed = parseFloat(val);
                                      field.onChange(isNaN(parsed) ? 0.14 : parsed);
                                    }}
                                  />
                                )}
                              />
                            </Grid>
                          </Grid>
                        )}
                      </>
                    );
                  })()}
                  
                  <Divider />
                  
                  {/* Sequential Expansion */}
                  <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                    Sequential Expansion
                  </Typography>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.fIncre`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="From Volume Increment"
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ step: 1 }}
                            error={!!errors.junctions?.[index]?.fIncre}
                            helperText={errors.junctions?.[index]?.fIncre?.message || 'Default: 10000'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 10000)}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.tIncre`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="To Volume Increment"
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ step: 1 }}
                            error={!!errors.junctions?.[index]?.tIncre}
                            helperText={errors.junctions?.[index]?.tIncre?.message || 'Default: 10000'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 10000)}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                  
                  <Divider />
                  
                  {/* Initial Conditions */}
                  <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                    Initial Conditions
                  </Typography>
                  
                  <Alert severity="info" icon={<InfoIcon />}>
                    {icond === 0 
                      ? 'Initial conditions are velocities (m/s)'
                      : 'Initial conditions are mass flows (kg/s)'}
                  </Alert>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.initialLiquidFlow`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value !== undefined 
                              ? (Math.abs(field.value) >= 1e6 || (Math.abs(field.value) < 1e-3 && field.value !== 0)
                                ? field.value.toExponential(6)
                                : field.value.toString())
                              : ''}
                            label={`Initial Liquid ${icond === 0 ? 'Velocity' : 'Flow'}`}
                            type="text"
                            size="small"
                            fullWidth
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{icond === 0 ? 'm/s' : 'kg/s'}</InputAdornment>,
                            }}
                            placeholder="0.0"
                            error={!!errors.junctions?.[index]?.initialLiquidFlow}
                            helperText={errors.junctions?.[index]?.initialLiquidFlow?.message || `Default: 0.0 ${icond === 0 ? 'm/s' : 'kg/s'}`}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(undefined);
                                return;
                              }
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                field.onChange(parsed);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(0.0);
                                return;
                              }
                              const parsed = parseFloat(val);
                              field.onChange(isNaN(parsed) ? 0.0 : parsed);
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.initialVaporFlow`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value !== undefined 
                              ? (Math.abs(field.value) >= 1e6 || (Math.abs(field.value) < 1e-3 && field.value !== 0)
                                ? field.value.toExponential(6)
                                : field.value.toString())
                              : ''}
                            label={`Initial Vapor ${icond === 0 ? 'Velocity' : 'Flow'}`}
                            type="text"
                            size="small"
                            fullWidth
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{icond === 0 ? 'm/s' : 'kg/s'}</InputAdornment>,
                            }}
                            placeholder="0.0"
                            error={!!errors.junctions?.[index]?.initialVaporFlow}
                            helperText={errors.junctions?.[index]?.initialVaporFlow?.message || `Default: 0.0 ${icond === 0 ? 'm/s' : 'kg/s'}`}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(undefined);
                                return;
                              }
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) {
                                field.onChange(parsed);
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val === '' || val === '-' || val === '.') {
                                field.onChange(0.0);
                                return;
                              }
                              const parsed = parseFloat(val);
                              field.onChange(isNaN(parsed) ? 0.0 : parsed);
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              );
            })}
          </>
        )}
      </Box>
    </form>
  );
};

export default MtpljunForm;














