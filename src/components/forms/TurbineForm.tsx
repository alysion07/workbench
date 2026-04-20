/**
 * TURBINE Parameter Form
 * Specialized Branch component with 1-2 junctions + turbine-specific data
 * (shaft geometry, performance data, gas turbine data)
 * VolumeReference-based connection (syncs with componentId changes)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useFieldArray, SubmitHandler } from 'react-hook-form';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import {
  Info as InfoIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AccountTree as AccountTreeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import {
  MARSNodeData,
  TurbineParameters,
  TurbineType,
  BranchJunction,
  VolumeReference,
  CrossflowDialogInitialValues,
  FaceType,
} from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NumericTextField } from '@/components/common/NumericTextField';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

/**
 * Validate Branch geometry according to MARS rules:
 * - At least 2 of {area, length, volume} must be non-zero
 * - If all 3 non-zero, check consistency: V ~ A x L
 */
function validateBranchGeometry(
  area: number | undefined,
  length: number | undefined,
  volume: number
): { valid: boolean; error?: string; calculated?: { field: 'area' | 'length' | 'volume'; value: number } } {
  const areaVal = area ?? 0;
  const lengthVal = length ?? 0;
  const volumeVal = volume;

  const zeroCount = [areaVal, lengthVal, volumeVal].filter(v => v === 0).length;

  if (zeroCount === 3) {
    return { valid: false, error: 'All values cannot be zero' };
  }

  if (zeroCount >= 2) {
    return { valid: false, error: 'At least two values must be non-zero' };
  }

  if (zeroCount === 1) {
    if (areaVal === 0) {
      if (lengthVal === 0 || volumeVal === 0) {
        return { valid: false, error: 'Cannot calculate Area: Length or Volume is zero' };
      }
      const calculatedArea = volumeVal / lengthVal;
      return { valid: true, calculated: { field: 'area', value: calculatedArea } };
    }

    if (lengthVal === 0) {
      if (areaVal === 0 || volumeVal === 0) {
        return { valid: false, error: 'Cannot calculate Length: Area or Volume is zero' };
      }
      const calculatedLength = volumeVal / areaVal;
      return { valid: true, calculated: { field: 'length', value: calculatedLength } };
    }

    if (volumeVal === 0) {
      if (areaVal === 0 || lengthVal === 0) {
        return { valid: false, error: 'Cannot calculate Volume: Area or Length is zero' };
      }
      const calculatedVolume = areaVal * lengthVal;
      return { valid: true, calculated: { field: 'volume', value: calculatedVolume } };
    }
  }

  const calculatedVolume = areaVal * lengthVal;
  const relativeError = Math.abs(calculatedVolume - volumeVal) / volumeVal;

  if (relativeError > 1e-6) {
    return {
      valid: false,
      error: `Inconsistent: A*L=${calculatedVolume.toExponential(3)} != V=${volumeVal.toExponential(3)} (error=${(relativeError * 100).toFixed(4)}%)`,
    };
  }

  return { valid: true };
}

// VolumeReference custom validator
const volumeRefValidator = z.custom<VolumeReference | null>((val) => {
  if (val === null || val === undefined) return true;
  if (typeof val === 'object' && 'nodeId' in val && 'volumeNum' in val && 'face' in val) return true;
  return false;
}).nullable();

// Junction schema (reuses BranchJunction structure)
const junctionSchema = z.object({
  junctionNumber: z.number().int().min(1).max(9),
  direction: z.enum(['inlet', 'outlet']),
  branchFace: z.number().int().min(1).max(6),
  from: volumeRefValidator,
  to: volumeRefValidator,
  area: z.number().min(0, 'Area must be non-negative (0 = auto)'),
  fwdLoss: z.number().min(0),
  revLoss: z.number().min(0),
  jefvcahs: z.string().regex(/^[0-9]{1,8}$/, 'Must be 1-8 digits').transform(v => v.padStart(8, '0')).optional(),
  dischargeCoefficient: z.number().positive().optional(),
  thermalConstant: z.number().positive().optional(),
  initialLiquidFlow: z.number().optional(),
  initialVaporFlow: z.number().optional(),
});

// Crossflow volume data schema (CCC0181/CCC0191)
const crossflowDataSchema = z.object({
  area: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),
  length: z.number().min(0, 'Must be non-negative'),
  roughness: z.number().min(0, 'Must be non-negative'),
  hydraulicDiameter: z.number().min(0, 'Must be non-negative'),
  controlFlags: z.string().regex(/^[0-9]{7}$/, 'Must be 7 digits'),
  dz: z.number(),
});

// Performance pair schema for gas turbine data
const perfPairSchema = z.object({
  pressureRatio: z.number().min(1, 'Pressure ratio must be >= 1.0'),
  value: z.number(),
});

// Validation schema
const turbineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),
  njuns: z.union([z.literal(1), z.literal(2)]),
  initialConditionControl: z.union([z.literal(0), z.literal(1)]).optional(),

  // Geometry
  area: z.number().optional(),
  length: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),
  volume: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),

  // Angles
  azAngle: z.number().refine(val => val === undefined || Math.abs(val) <= 360, {
    message: 'Azimuthal angle must be |angle| <= 360',
  }).optional(),
  incAngle: z.number().refine(val => Math.abs(val) <= 90, {
    message: 'Inclination angle must be |angle| <= 90',
  }),
  dz: z.number(),

  // Wall
  wallRoughness: z.number().min(0).optional(),
  hydraulicDiameter: z.number().min(0, 'Must be non-negative'),
  tlpvbfe: z.string().regex(/^[0-9]{7}$/).optional(),

  // Initial conditions
  ebt: z.enum(['001', '002', '003', '004', '005']),
  pressure: z.number().positive('Must be positive'),
  temperature: z.number().positive('Must be positive').optional(),
  quality: z.number().min(0).max(1).optional(),

  // Junctions
  junctions: z.array(junctionSchema).min(1, 'At least 1 junction required').max(2, 'Maximum 2 junctions'),

  // Shaft Geometry (CCC0300)
  shaftSpeed: z.number().min(0, 'Must be non-negative'),
  stageInertia: z.number().min(0, 'Must be non-negative'),
  shaftFriction: z.number().min(0, 'Must be non-negative'),
  shaftComponentNumber: z.number().int().min(0),
  disconnectTrip: z.number().int().min(0),
  drainFlag: z.number().int().optional(),

  // Performance Data (CCC0400)
  turbineType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  efficiency: z.number().min(0).max(1, 'Efficiency must be 0-1'),
  reactionFraction: z.number().min(0).max(1, 'Reaction fraction must be 0-1'),
  meanStageRadius: z.number().positive('Must be positive'),

  // Crossflow Volume Data (optional)
  enableYCrossflow: z.boolean().optional(),
  enableZCrossflow: z.boolean().optional(),
  yCrossflowData: crossflowDataSchema.optional(),
  zCrossflowData: crossflowDataSchema.optional(),

  // Gas Turbine Data (type=3 only)
  efficiencyData: z.array(perfPairSchema).optional(),
  massFlowRateData: z.array(perfPairSchema).optional(),
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
      numbers.every(n => n >= 1 && n <= 9);
  }, {
    message: 'Junction numbers must be unique and between 1-9',
    path: ['junctions'],
  })
  .refine((data) => {
    return data.junctions.every(j => j.branchFace >= 1 && j.branchFace <= 6);
  }, {
    message: 'Branch face must be between 1-6',
    path: ['junctions'],
  })
  .refine((data) => {
    return Math.abs(data.dz) <= data.length;
  }, {
    message: 'Elevation change (|dz|) must not exceed length',
    path: ['dz'],
  })
  .refine((data) => {
    if (data.wallRoughness && data.wallRoughness > 0 && data.hydraulicDiameter > 0) {
      return data.wallRoughness < data.hydraulicDiameter / 2;
    }
    return true;
  }, {
    message: 'Wall roughness must be less than hydraulicDiameter / 2',
    path: ['wallRoughness'],
  })
  .refine((data) => {
    if (data.ebt === '003') {
      return data.temperature !== undefined && data.temperature > 0;
    }
    return true;
  }, {
    message: 'Temperature is required when ebt=003',
    path: ['temperature'],
  })
  .refine((data) => {
    if (data.ebt === '002') {
      return data.quality !== undefined;
    }
    return true;
  }, {
    message: 'Quality is required when ebt=002',
    path: ['quality'],
  })
  .refine((data) => {
    if (data.turbineType === 3) {
      return data.efficiencyData && data.efficiencyData.length > 0;
    }
    return true;
  }, {
    message: 'Efficiency data is required for Gas Turbine (type=3)',
    path: ['efficiencyData'],
  })
  .refine((data) => {
    if (data.turbineType === 3) {
      return data.massFlowRateData && data.massFlowRateData.length > 0;
    }
    return true;
  }, {
    message: 'Mass flow rate data is required for Gas Turbine (type=3)',
    path: ['massFlowRateData'],
  });

type FormData = z.infer<typeof turbineSchema>;

interface TurbineFormProps {
  nodeId: string;
  data: MARSNodeData;
}

// Helper: compare two VolumeReferences
const volumeRefsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
};

const TURBINE_TYPE_LABELS: Record<TurbineType, string> = {
  0: '0: Two-row impulse stage group',
  1: '1: General impulse-reaction stage group',
  2: '2: Constant efficiency stage group',
  3: '3: Gas turbine',
};

const TurbineForm: React.FC<TurbineFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, nodes, edges, metadata, setPropertyFormState, setFormSubmitHandler, openCrossflowDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, nodes: state.nodes, edges: state.edges, metadata: state.metadata, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, openCrossflowDialog: state.openCrossflowDialog })));
  const [activeJunctionTab, setActiveJunctionTab] = useState(0);

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Create resolver for ID operations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Available SHAFT control variables for dropdown
  const availableShaftCVs = useMemo(() => {
    return (metadata.globalSettings?.controlVariables || [])
      .filter(cv => cv.componentType === 'SHAFT')
      .sort((a, b) => a.number - b.number);
  }, [metadata.globalSettings?.controlVariables]);

  // Helper: parse legacy string or VolumeReference to VolumeReference | null
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

  // Generate available volume references for Autocomplete
  const availableVolumes = useMemo(() => {
    type VolumeOption = { ref: VolumeReference; volumeId: string; label: string; componentName: string; componentType: string };
    const options: VolumeOption[] = [];
    const turbineCompId = data.componentId.slice(0, 3);
    const turbineName = data.componentName || 'Turbine';

    // Add Turbine's own junction face IDs (for cross-references)
    const currentNjuns = (data.parameters as Partial<TurbineParameters>)?.njuns || 1;
    for (let i = 1; i <= Math.min(currentNjuns, 6); i++) {
      const ref: VolumeReference = { nodeId, volumeNum: 1, face: i };
      const volumeId = resolver.getVolumeIdFromReference(ref) || '';
      options.push({
        ref, volumeId,
        label: `${turbineName} - Face ${i}`,
        componentName: turbineName,
        componentType: 'turbine',
      });
    }

    nodes.forEach(node => {
      const compName = node.data.componentName || 'Unnamed';
      const compType = node.data.componentType;
      const shortId = node.data.componentId.slice(0, 3);

      // Skip self
      if (shortId === turbineCompId) return;

      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch' || compType === 'turbine') {
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
        // First cell inlet and last cell outlet
        const ref1: VolumeReference = { nodeId: node.id, volumeNum: 1, face: 1 };
        const volumeId1 = resolver.getVolumeIdFromReference(ref1) || '';
        options.push({
          ref: ref1, volumeId: volumeId1,
          label: `${compName} - Cell 1 Inlet`,
          componentName: compName, componentType: compType,
        });

        const refLast: VolumeReference = { nodeId: node.id, volumeNum: ncells, face: 2 };
        const volumeIdLast = resolver.getVolumeIdFromReference(refLast) || '';
        options.push({
          ref: refLast, volumeId: volumeIdLast,
          label: `${compName} - Cell ${ncells} Outlet`,
          componentName: compName, componentType: compType,
        });

        // Add intermediate cells if PIPE has multiple cells
        if (ncells > 1) {
          for (let i = 1; i <= ncells; i++) {
            for (let face = 1; face <= 2; face++) {
              if (i === 1 && face === 1) continue;
              if (i === ncells && face === 2) continue;
              const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face };
              const volumeId = resolver.getVolumeIdFromReference(ref) || '';
              const faceLabel = face === 1 ? 'Inlet' : 'Outlet';
              options.push({
                ref, volumeId,
                label: `${compName} - Cell ${i} ${faceLabel}`,
                componentName: compName, componentType: compType,
              });
            }
          }
        }
      } else if (compType === 'pump') {
        // Pump has inlet (face 1) and outlet (face 2)
        for (let face = 1; face <= 2; face++) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face };
          const volumeId = resolver.getVolumeIdFromReference(ref) || '';
          const faceLabel = face === 1 ? 'Inlet' : 'Outlet';
          options.push({
            ref, volumeId,
            label: `${compName} - ${faceLabel}`,
            componentName: compName, componentType: compType,
          });
        }
      }
    });

    return options.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest, data.componentId, data.componentName, data.parameters, nodeId, resolver]);

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

  const params = data.parameters as Partial<TurbineParameters>;
  const defaultNjuns = params?.njuns || 1;

  // Convert BranchJunction[] to form-compatible format
  const defaultJunctions = params?.junctions
    ? params.junctions.map(j => ({
      junctionNumber: j.junctionNumber,
      direction: j.direction,
      branchFace: j.branchFace,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
      area: j.area,
      fwdLoss: j.fwdLoss,
      revLoss: j.revLoss,
      jefvcahs: j.jefvcahs,
      dischargeCoefficient: j.dischargeCoefficient,
      thermalConstant: j.thermalConstant,
      initialLiquidFlow: j.initialLiquidFlow,
      initialVaporFlow: j.initialVaporFlow,
    }))
    : Array.from({ length: defaultNjuns }, (_, i) => ({
      junctionNumber: i + 1,
      direction: (i === 0 ? 'inlet' : 'outlet') as 'inlet' | 'outlet',
      branchFace: i === 0 ? 1 : 2,
      from: null as VolumeReference | null,
      to: null as VolumeReference | null,
      area: 0,
      fwdLoss: 0,
      revLoss: 0,
      jefvcahs: '00000000',
      initialLiquidFlow: 0.0,
      initialVaporFlow: 0.0,
    }));

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(turbineSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: (defaultNjuns === 1 || defaultNjuns === 2 ? defaultNjuns : 1) as 1 | 2,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 1.0,
      volume: params?.volume ?? 1.0,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 0,
      dz: params?.dz ?? 0,
      wallRoughness: params?.wallRoughness ?? 0.0,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.0,
      tlpvbfe: params?.tlpvbfe ?? '0000010',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 6.0e6,
      temperature: params?.temperature ?? 550.0,
      quality: params?.quality,
      junctions: defaultJunctions,

      // Shaft Geometry
      shaftSpeed: params?.shaftSpeed ?? 0,
      stageInertia: params?.stageInertia ?? 0,
      shaftFriction: params?.shaftFriction ?? 0,
      shaftComponentNumber: params?.shaftComponentNumber ?? 0,
      disconnectTrip: params?.disconnectTrip ?? 0,
      drainFlag: params?.drainFlag ?? 0,

      // Performance Data
      turbineType: params?.turbineType ?? 0,
      efficiency: params?.efficiency ?? 0.85,
      reactionFraction: params?.reactionFraction ?? 0.5,
      meanStageRadius: params?.meanStageRadius ?? 0.5,

      // Crossflow Volume Data
      enableYCrossflow: !!params?.yCrossflowData,
      enableZCrossflow: !!params?.zCrossflowData,
      yCrossflowData: params?.yCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },
      zCrossflowData: params?.zCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },

      // Gas Turbine Data
      efficiencyData: params?.efficiencyData ?? [],
      massFlowRateData: params?.massFlowRateData ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'junctions',
  });

  // useFieldArray for gas turbine efficiency data
  const {
    fields: effFields,
    append: effAppend,
    remove: effRemove,
  } = useFieldArray({
    control,
    name: 'efficiencyData',
  });

  // useFieldArray for gas turbine mass flow rate data
  const {
    fields: mfrFields,
    append: mfrAppend,
    remove: mfrRemove,
  } = useFieldArray({
    control,
    name: 'massFlowRateData',
  });

  const ebt = watch('ebt');
  const area = watch('area');
  const length = watch('length');
  const volume = watch('volume');
  const junctions = watch('junctions');
  const turbineType = watch('turbineType');
  const enableYCrossflow = watch('enableYCrossflow');
  const enableZCrossflow = watch('enableZCrossflow');

  // Track if we just added a junction to move to new tab
  const [justAddedJunction, setJustAddedJunction] = useState(false);

  // Check junction connection status
  const getJunctionStatus = (index: number): { connected: boolean; hasFrom: boolean; hasTo: boolean } => {
    const junction = junctions[index];
    if (!junction) return { connected: false, hasFrom: false, hasTo: false };

    const hasFrom = junction.from !== null && junction.from !== undefined;
    const hasTo = junction.to !== null && junction.to !== undefined;
    const connected = hasFrom && hasTo;

    return { connected, hasFrom, hasTo };
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

  // Geometry validation
  const geometryValidation = useMemo(() => {
    return validateBranchGeometry(area, length, volume);
  }, [area, length, volume]);

  // Handle Add Junction
  const handleAddJunction = (direction: 'inlet' | 'outlet') => {
    const currentJunctions = watch('junctions');

    if (currentJunctions.length >= 2) {
      alert('Turbine allows maximum 2 junctions');
      return;
    }

    const existingNumbers = currentJunctions.map(j => j.junctionNumber);
    let nextNumber = 1;
    while (existingNumbers.includes(nextNumber) && nextNumber <= 9) {
      nextNumber++;
    }

    append({
      junctionNumber: nextNumber,
      direction,
      branchFace: direction === 'inlet' ? 1 : 2,
      from: null,
      to: null,
      area: 0,
      fwdLoss: 0,
      revLoss: 0,
      jefvcahs: '00000000',
      initialLiquidFlow: 0.0,
      initialVaporFlow: 0.0,
    });

    setValue('njuns', (currentJunctions.length + 1) as 1 | 2);
    setJustAddedJunction(true);
  };

  // Open Crossflow Wizard for specific junction
  const openCrossflowWizardForJunction = (junctionIndex: number) => {
    const junction = watch(`junctions.${junctionIndex}`);
    const currentFrom = junction.from as VolumeReference | null;
    const currentTo = junction.to as VolumeReference | null;

    const initialValues: CrossflowDialogInitialValues = {
      junctionNodeId: nodeId,
      junctionNumber: junction.junctionNumber,
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

  // Handle Remove Junction
  const handleRemoveJunction = (index: number) => {
    const currentJunctions = watch('junctions');

    if (currentJunctions.length <= 1) {
      alert('Turbine must have at least 1 junction');
      return;
    }

    const junctionToRemove = currentJunctions[index];

    // Check connected edges
    const connectedEdges = edges.filter(e => {
      if (e.source === nodeId || e.target === nodeId) {
        const handleId = e.source === nodeId ? e.sourceHandle : e.targetHandle;
        const match = handleId?.match(/j(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          return num === junctionToRemove.junctionNumber;
        }
      }
      return false;
    });

    if (connectedEdges.length > 0) {
      const confirmed = window.confirm(
        `Junction ${junctionToRemove.junctionNumber} has ${connectedEdges.length} connection(s). ` +
        `Connections will be removed. Continue?`
      );
      if (!confirmed) return;
    }

    remove(index);
    setValue('njuns', (currentJunctions.length - 1) as 1 | 2);
  };

  // Sync junctions with edges (auto-fill VolumeReferences from connections)
  useEffect(() => {
    const turbineEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
    const currentJunctions = watch('junctions');

    if (turbineEdges.length > 0 && currentJunctions) {
      let hasChanges = false;

      currentJunctions.forEach((junction, idx) => {
        const edge = turbineEdges.find(e => {
          const handleId = e.source === nodeId ? e.sourceHandle : e.targetHandle;
          const match = handleId?.match(/j(\d+)/);
          const edgeJunctionNum = match ? parseInt(match[1]) : 0;
          return edgeJunctionNum === junction.junctionNumber;
        });

        if (edge && edge.data) {
          const edgeFromRef = edge.data.fromVolume as VolumeReference | undefined;
          const edgeToRef = edge.data.toVolume as VolumeReference | undefined;

          if (edgeFromRef && !volumeRefsEqual(edgeFromRef, junction.from)) {
            setValue(`junctions.${idx}.from`, edgeFromRef, { shouldDirty: false });
            hasChanges = true;
          }
          if (edgeToRef && !volumeRefsEqual(edgeToRef, junction.to)) {
            setValue(`junctions.${idx}.to`, edgeToRef, { shouldDirty: false });
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        // Edge sync triggered form value updates
      }
    }
  }, [edges, nodeId, watch, setValue]);

  // Reset form when node data changes
  useEffect(() => {
    const params = data.parameters as Partial<TurbineParameters>;
    const currentJunctions = params?.junctions || defaultJunctions;

    const formJunctions = currentJunctions.map(j => ({
      ...j,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
    }));

    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: (currentJunctions.length === 1 || currentJunctions.length === 2 ? currentJunctions.length : 1) as 1 | 2,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 1.0,
      volume: params?.volume ?? 1.0,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 0,
      dz: params?.dz ?? 0,
      wallRoughness: params?.wallRoughness ?? 0.0,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.0,
      tlpvbfe: params?.tlpvbfe ?? '0000010',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 6.0e6,
      temperature: params?.temperature ?? 550.0,
      quality: params?.quality,
      junctions: formJunctions as any,

      // Shaft Geometry
      shaftSpeed: params?.shaftSpeed ?? 0,
      stageInertia: params?.stageInertia ?? 0,
      shaftFriction: params?.shaftFriction ?? 0,
      shaftComponentNumber: params?.shaftComponentNumber ?? 0,
      disconnectTrip: params?.disconnectTrip ?? 0,
      drainFlag: params?.drainFlag ?? 0,

      // Performance Data
      turbineType: params?.turbineType ?? 0,
      efficiency: params?.efficiency ?? 0.85,
      reactionFraction: params?.reactionFraction ?? 0.5,
      meanStageRadius: params?.meanStageRadius ?? 0.5,

      // Gas Turbine Data
      efficiencyData: params?.efficiencyData ?? [],
      massFlowRateData: params?.massFlowRateData ?? [],

      // Crossflow Volume Data
      enableYCrossflow: !!params?.yCrossflowData,
      enableZCrossflow: !!params?.zCrossflowData,
      yCrossflowData: params?.yCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },
      zCrossflowData: params?.zCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },
    });
  }, [nodeId, data, reset]);

  // Update temperature/quality fields based on ebt
  useEffect(() => {
    if (ebt === '002' && !watch('quality')) {
      setValue('quality', 0.0, { shouldDirty: false });
    } else if (ebt === '003' && !watch('temperature')) {
      setValue('temperature', 550.0, { shouldDirty: false });
    }
  }, [ebt, setValue, watch]);

  const onSubmit: SubmitHandler<FormData> = (formData) => {
    // Convert form junctions to BranchJunction (VolumeReference-based)
    const convertedJunctions: BranchJunction[] = formData.junctions.map(j => ({
      junctionNumber: j.junctionNumber,
      direction: j.direction,
      branchFace: j.branchFace as 1 | 2 | 3 | 4 | 5 | 6,
      from: j.from || { nodeId: '', volumeNum: 1, face: 1 },
      to: j.to || { nodeId: '', volumeNum: 1, face: 1 },
      area: j.area,
      fwdLoss: j.fwdLoss,
      revLoss: j.revLoss,
      jefvcahs: j.jefvcahs,
      dischargeCoefficient: j.dischargeCoefficient,
      thermalConstant: j.thermalConstant,
      initialLiquidFlow: j.initialLiquidFlow,
      initialVaporFlow: j.initialVaporFlow,
    } as BranchJunction));

    // Build TurbineParameters
    const parameters: Partial<TurbineParameters> = {
      name: formData.name,
      njuns: formData.njuns,
      initialConditionControl: formData.initialConditionControl,
      area: formData.area,
      length: formData.length,
      volume: formData.volume,
      azAngle: formData.azAngle,
      incAngle: formData.incAngle,
      dz: formData.dz,
      wallRoughness: formData.wallRoughness,
      hydraulicDiameter: formData.hydraulicDiameter,
      tlpvbfe: formData.tlpvbfe,
      ebt: formData.ebt,
      pressure: formData.pressure,
      temperature: formData.temperature,
      quality: formData.quality,
      junctions: convertedJunctions,

      // Shaft Geometry
      shaftSpeed: formData.shaftSpeed,
      stageInertia: formData.stageInertia,
      shaftFriction: formData.shaftFriction,
      shaftComponentNumber: formData.shaftComponentNumber,
      disconnectTrip: formData.disconnectTrip,
      drainFlag: formData.drainFlag,

      // Performance Data
      turbineType: formData.turbineType,
      efficiency: formData.efficiency,
      reactionFraction: formData.reactionFraction,
      meanStageRadius: formData.meanStageRadius,

      // Crossflow Volume Data
      yCrossflowData: formData.enableYCrossflow ? formData.yCrossflowData : undefined,
      zCrossflowData: formData.enableZCrossflow ? formData.zCrossflowData : undefined,

      // Gas Turbine Data (only for type=3)
      efficiencyData: formData.turbineType === 3 ? formData.efficiencyData : undefined,
      massFlowRateData: formData.turbineType === 3 ? formData.massFlowRateData : undefined,
    };

    // Validate
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

    if (!formData.name) validationErrors.push({ level: 'error', message: 'Name is required' });
    if (formData.length <= 0) validationErrors.push({ level: 'error', message: 'Length must be positive' });
    // Volume=0 is allowed when auto-calculated from A×L
    const effectiveVolume = formData.volume > 0
      ? formData.volume
      : (geometryValidation.calculated?.field === 'volume' ? geometryValidation.calculated.value : 0);
    if (effectiveVolume <= 0) validationWarnings.push({ level: 'warning', message: 'Volume is 0 (will be auto-calculated from A×L)' });
    if (formData.pressure <= 0) validationErrors.push({ level: 'error', message: 'Pressure must be positive' });

    // Geometry validation
    if (!geometryValidation.valid) {
      validationErrors.push({ level: 'error', message: geometryValidation.error! });
    }

    // Junction validation
    formData.junctions.forEach((junction) => {
      const hasFrom = junction.from !== null && junction.from !== undefined;
      const hasTo = junction.to !== null && junction.to !== undefined;

      if (hasFrom && junction.from && !resolver.validateVolumeReference(junction.from)) {
        validationErrors.push({
          level: 'error',
          message: `Junction ${junction.junctionNumber}: Invalid 'from' Volume reference`,
        });
      }
      if (hasTo && junction.to && !resolver.validateVolumeReference(junction.to)) {
        validationErrors.push({
          level: 'error',
          message: `Junction ${junction.junctionNumber}: Invalid 'to' Volume reference`,
        });
      }
      if (!hasFrom && !hasTo) {
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

    // Edge sync is handled by updateNodeData → syncEdgesFromParameters (connectionSync.ts)
    // No manual edge sync needed here
  };

  // Register form submit handler on mount
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
      isValid: isValid && geometryValidation.valid,
    });
  }, [isDirty, isValid, geometryValidation.valid, setPropertyFormState]);

  return (
    <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
      <Box display="flex" flexDirection="column" gap={1} px={1}>
        {/* ================================================================ */}
        {/* Section 1: Basic Information */}
        {/* ================================================================ */}
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

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
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
                  inputProps={{ min: 1, max: 2, readOnly: true }}
                  disabled
                  value={fields.length}
                  error={!!errors.njuns}
                  helperText={errors.njuns?.message || '1: Main flow only, 2: Main + Bleed'}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="initialConditionControl"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Initial Condition Control"
                  size="small"
                  fullWidth
                  value={field.value ?? 0}
                  error={!!errors.initialConditionControl}
                  helperText={errors.initialConditionControl?.message}
                >
                  <MenuItem value={0}>0: Velocity (m/s)</MenuItem>
                  <MenuItem value={1}>1: Mass flow (kg/s)</MenuItem>
                </TextField>
              )}
            />
          </Grid>
        </Grid>

        <Divider />

        {/* ================================================================ */}
        {/* Section 2: Volume Geometry */}
        {/* ================================================================ */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Volume Geometry (A x L = V Rule)
        </Typography>

        {!geometryValidation.valid && (
          <Alert severity="error" icon={<InfoIcon />}>
            <strong>Geometry Error:</strong> {geometryValidation.error}
          </Alert>
        )}

        {geometryValidation.valid && geometryValidation.calculated && (
          <Alert severity="info" icon={<InfoIcon />}>
            <strong>Auto-calculated:</strong> {geometryValidation.calculated.field === 'area' ? 'Area' : geometryValidation.calculated.field === 'length' ? 'Length' : 'Volume'} = {geometryValidation.calculated.value.toExponential(3)}
          </Alert>
        )}

        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="area"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Area"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m2</InputAdornment>,
                  }}
                  helperText="0 = auto-calculate"
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
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
                  label="Length"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.length}
                  helperText={errors.length?.message}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
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
                  label="Volume"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m3</InputAdornment>,
                  }}
                  error={!!errors.volume}
                  helperText={errors.volume?.message}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                />
              )}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="azAngle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Azimuthal Angle"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">deg</InputAdornment>,
                  }}
                  error={!!errors.azAngle}
                  helperText={errors.azAngle?.message || '|angle| <= 360'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
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
                  label="Inclination Angle"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">deg</InputAdornment>,
                  }}
                  error={!!errors.incAngle}
                  helperText={errors.incAngle?.message || '0=horizontal, 90=vertical'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
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
                  label="Elevation Change (dz)"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.dz}
                  helperText={errors.dz?.message || '|dz| <= length'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider />

        {/* Wall Properties */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Wall Properties
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="wallRoughness"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Wall Roughness"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.wallRoughness}
                  helperText={errors.wallRoughness?.message || 'Default: 0.0'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="hydraulicDiameter"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Hydraulic Diameter"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.hydraulicDiameter}
                  helperText={errors.hydraulicDiameter?.message || '0 = auto-calculate'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                />
              )}
            />
          </Grid>
        </Grid>

        <Controller
          name="tlpvbfe"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Volume Control Flags"
              size="small"
              fullWidth
              placeholder="0000010"
              error={!!errors.tlpvbfe}
              helperText={errors.tlpvbfe?.message || '7-digit flags (turbine: "000001e" format, e-flag only variable)'}
              inputProps={{ maxLength: 7 }}
            />
          )}
        />

        <Divider />

        {/* Y/Z Crossflow Volume Data */}
        <Box>
          <FormControlLabel
            control={
              <Controller
                name="enableYCrossflow"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    size="small"
                  />
                )}
              />
            }
            label={
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                Y-Direction Crossflow Data (CCC0181)
              </Typography>
            }
          />
          <Collapse in={!!enableYCrossflow}>
            <Box sx={{ pl: 2, pt: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.area"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Area"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                        helperText="0 = auto"
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.length"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Length"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.roughness"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Roughness"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.hydraulicDiameter"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Hyd. Diameter"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.controlFlags"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Control Flags"
                        size="small"
                        fullWidth
                        placeholder="0000010"
                        helperText="Format: 00000f0"
                        inputProps={{ maxLength: 7 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="yCrossflowData.dz"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Z-Position Change"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Controller
                name="enableZCrossflow"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    size="small"
                  />
                )}
              />
            }
            label={
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                Z-Direction Crossflow Data (CCC0191)
              </Typography>
            }
          />
          <Collapse in={!!enableZCrossflow}>
            <Box sx={{ pl: 2, pt: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.area"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Area"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                        helperText="0 = auto"
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.length"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Length"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.roughness"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Roughness"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.hydraulicDiameter"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Hyd. Diameter"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.controlFlags"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Control Flags"
                        size="small"
                        fullWidth
                        placeholder="0000010"
                        helperText="Format: 00000f0"
                        inputProps={{ maxLength: 7 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Controller
                    name="zCrossflowData.dz"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Z-Position Change"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Box>

        <Divider />

        {/* ================================================================ */}
        {/* Section 3: Initial Conditions */}
        {/* ================================================================ */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Initial Conditions
        </Typography>

        <Controller
          name="ebt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Equilibrium Option (ebt)"
              size="small"
              fullWidth
              required
              error={!!errors.ebt}
              helperText={errors.ebt?.message}
            >
              <MenuItem value="001">001: [P, Uf, Ug, ag]</MenuItem>
              <MenuItem value="002">002: [P, xs] - Pressure & Quality</MenuItem>
              <MenuItem value="003">003: [P, T] - Pressure & Temperature</MenuItem>
              <MenuItem value="004">004: [P, T, xs] - Two components</MenuItem>
              <MenuItem value="005">005: [T, xs, xn] - Two components</MenuItem>
            </TextField>
          )}
        />

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="pressure"
              control={control}
              render={({ field }) => (
                <NumericTextField
                  label="Pressure"
                  value={field.value ?? 6.0e6}
                  onChange={(num) => field.onChange(isNaN(num) ? 6.0e6 : num)}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
                  }}
                  error={!!errors.pressure}
                  helperText={errors.pressure?.message || 'Example: 6.0e6 or 6000000'}
                />
              )}
            />
          </Grid>
          {ebt === '003' && (
            <Grid item xs={12} sm={6}>
              <Controller
                name="temperature"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Temperature"
                    type="number"
                    inputProps={numberInputProps}
                    size="small"
                    fullWidth
                    required
                    InputProps={{
                      endAdornment: <InputAdornment position="end">K</InputAdornment>,
                    }}
                    error={!!errors.temperature}
                    helperText={errors.temperature?.message}
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                  />
                )}
              />
            </Grid>
          )}
          {ebt === '002' && (
            <Grid item xs={12} sm={6}>
              <Controller
                name="quality"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Quality"
                    type="number"
                    inputProps={numberInputProps}
                    size="small"
                    fullWidth
                    required
                    InputProps={{
                      endAdornment: <InputAdornment position="end">0-1</InputAdornment>,
                    }}
                    error={!!errors.quality}
                    helperText={errors.quality?.message || 'Static quality (0-1)'}
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  />
                )}
              />
            </Grid>
          )}
        </Grid>

        <Divider />

        {/* ================================================================ */}
        {/* Section 4: Junctions */}
        {/* ================================================================ */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Junctions ({fields.length})
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleAddJunction('inlet')}
              disabled={fields.length >= 2}
            >
              Add Inlet
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleAddJunction('outlet')}
              disabled={fields.length >= 2}
            >
              Add Outlet
            </Button>
          </Box>
        </Box>

        {/* Junction Buttons Grid - Inlet/Outlet */}
        {fields.length > 0 && (
          <>
            {/* Inlet Junctions */}
            {(() => {
              const inletJunctions = fields
                .map((field, index) => ({ field, index, direction: watch(`junctions.${index}.direction`) }))
                .filter(({ direction }) => direction === 'inlet');

              if (inletJunctions.length > 0) {
                return (
                  <Box mb={1}>
                    <Typography variant="overline" sx={{ color: 'primary.main', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                      Inlet Junctions
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {inletJunctions.map(({ field, index }) => {
                        const status = getJunctionStatus(index);
                        const junctionNum = watch(`junctions.${index}.junctionNumber`);
                        const isSelected = index === activeJunctionTab;

                        return (
                          <Button
                            key={field.id}
                            variant="outlined"
                            onClick={() => setActiveJunctionTab(index)}
                            startIcon={
                              status.connected ? (
                                <CheckCircleIcon fontSize="small" color="success" />
                              ) : (
                                <RadioButtonUncheckedIcon fontSize="small" />
                              )
                            }
                            sx={{
                              minWidth: 100,
                              textTransform: 'none',
                              borderWidth: isSelected ? 2 : 1,
                              borderColor: '#2196F3',
                              color: isSelected ? '#2196F3' : '#2196F3',
                              backgroundColor: isSelected ? '#E3F2FD' : 'white',
                              '&:hover': {
                                backgroundColor: isSelected ? '#BBDEFB' : '#F5F5F5',
                                borderColor: '#1976D2',
                              },
                            }}
                          >
                            J{junctionNum}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}

            {/* Outlet Junctions */}
            {(() => {
              const outletJunctions = fields
                .map((field, index) => ({ field, index, direction: watch(`junctions.${index}.direction`) }))
                .filter(({ direction }) => direction === 'outlet');

              if (outletJunctions.length > 0) {
                return (
                  <Box mb={1}>
                    <Typography variant="overline" sx={{ color: '#FF9800', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                      Outlet Junctions
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {outletJunctions.map(({ field, index }) => {
                        const status = getJunctionStatus(index);
                        const junctionNum = watch(`junctions.${index}.junctionNumber`);
                        const isSelected = index === activeJunctionTab;

                        return (
                          <Button
                            key={field.id}
                            variant="outlined"
                            onClick={() => setActiveJunctionTab(index)}
                            startIcon={
                              status.connected ? (
                                <CheckCircleIcon fontSize="small" color="success" />
                              ) : (
                                <RadioButtonUncheckedIcon fontSize="small" />
                              )
                            }
                            sx={{
                              minWidth: 100,
                              textTransform: 'none',
                              borderWidth: isSelected ? 2 : 1,
                              borderColor: '#FF9800',
                              color: '#FF9800',
                              backgroundColor: isSelected ? '#FFF3E0' : 'white',
                              '&:hover': {
                                backgroundColor: isSelected ? '#FFE0B2' : '#FFF8E1',
                                borderColor: '#F57C00',
                              },
                            }}
                          >
                            J{junctionNum}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}

            <Divider sx={{ my: 1 }} />

            {/* Active Junction Form */}
            {fields.map((field, index) => {
              if (index !== activeJunctionTab) return null;

              return (
                <Box key={field.id} display="flex" flexDirection="column" gap={1}>
                  {/* Junction Header with Delete Button */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                      Junction {watch(`junctions.${index}.junctionNumber`)} Details
                    </Typography>
                    <Box display="flex" gap={1}>
                      <Tooltip title="Connection Wizard">
                        <IconButton size="small" onClick={() => openCrossflowWizardForJunction(index)} color="primary">
                          <AccountTreeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Chip
                        label={watch(`junctions.${index}.direction`).toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: watch(`junctions.${index}.direction`) === 'inlet' ? '#2196F3' : '#FF9800',
                          color: 'white',
                        }}
                      />
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
                  </Box>

                  {/* Connection Status Alert */}
                  {(() => {
                    const status = getJunctionStatus(index);
                    if (!status.connected) {
                      return (
                        <Alert severity="info" icon={<InfoIcon />}>
                          {!status.hasFrom && !status.hasTo
                            ? 'Not connected: Set From and To volumes'
                            : !status.hasFrom
                              ? 'Incomplete: Set From volume'
                              : 'Incomplete: Set To volume'}
                        </Alert>
                      );
                    }
                    return null;
                  })()}

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
                            inputProps={{ min: 1, max: 9 }}
                            error={!!errors.junctions?.[index]?.junctionNumber}
                            helperText={errors.junctions?.[index]?.junctionNumber?.message || '1-9'}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              field.onChange(Math.max(1, Math.min(9, value)));
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Controller
                        name={`junctions.${index}.direction`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            label="Direction"
                            size="small"
                            fullWidth
                            error={!!errors.junctions?.[index]?.direction}
                            helperText={errors.junctions?.[index]?.direction?.message || 'UI only (for layout)'}
                          >
                            <MenuItem value="inlet">Inlet</MenuItem>
                            <MenuItem value="outlet">Outlet</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Controller
                        name={`junctions.${index}.branchFace`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            label="Branch Face"
                            size="small"
                            fullWidth
                            required
                            error={!!errors.junctions?.[index]?.branchFace}
                            helperText={errors.junctions?.[index]?.branchFace?.message || '1-2: Main axis, 3-6: Crossflow'}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6;
                              field.onChange(value);
                            }}
                          >
                            <MenuItem value={1}>F1 (Main axis inlet)</MenuItem>
                            <MenuItem value={2}>F2 (Main axis outlet)</MenuItem>
                            <MenuItem value={3}>F3 (Crossflow Y-inlet)</MenuItem>
                            <MenuItem value={4}>F4 (Crossflow Y-outlet)</MenuItem>
                            <MenuItem value={5}>F5 (Crossflow Z-inlet)</MenuItem>
                            <MenuItem value={6}>F6 (Crossflow Z-outlet)</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.from`}
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
                                  error={!!errors.junctions?.[index]?.from}
                                  helperText={
                                    selectedOption
                                      ? selectedOption.label
                                      : errors.junctions?.[index]?.from?.message || 'Select from list'
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
                            />
                          );
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.to`}
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
                                  error={!!errors.junctions?.[index]?.to}
                                  helperText={
                                    selectedOption
                                      ? selectedOption.label
                                      : errors.junctions?.[index]?.to?.message || 'Select from list'
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
                            />
                          );
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Controller
                    name={`junctions.${index}.area`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ''}
                        label="Junction Area"
                        type="number"
                        inputProps={numberInputProps}
                        size="small"
                        fullWidth
                        InputProps={{
                          endAdornment: <InputAdornment position="end">m2</InputAdornment>,
                        }}
                        error={!!errors.junctions?.[index]?.area}
                        helperText={errors.junctions?.[index]?.area?.message || '0 = auto (minimum adjacent volume)'}
                        onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                        onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                      />
                    )}
                  />

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.fwdLoss`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="Forward Loss Coefficient"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            error={!!errors.junctions?.[index]?.fwdLoss}
                            helperText={errors.junctions?.[index]?.fwdLoss?.message}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
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
                            value={field.value ?? ''}
                            label="Reverse Loss Coefficient"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            error={!!errors.junctions?.[index]?.revLoss}
                            helperText={errors.junctions?.[index]?.revLoss?.message}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
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
                        helperText={errors.junctions?.[index]?.jefvcahs?.message || '8-digit flags'}
                        inputProps={{ maxLength: 8 }}
                      />
                    )}
                  />

                  <Typography variant="caption" color="text.secondary">
                    Optional Fields (Advanced)
                  </Typography>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.dischargeCoefficient`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="Discharge Coefficient"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="1.0"
                            error={!!errors.junctions?.[index]?.dischargeCoefficient}
                            helperText={errors.junctions?.[index]?.dischargeCoefficient?.message || 'Default: 1.0'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
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
                            value={field.value ?? ''}
                            label="Thermal Constant"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="0.14"
                            error={!!errors.junctions?.[index]?.thermalConstant}
                            helperText={errors.junctions?.[index]?.thermalConstant?.message || 'Default: 0.14'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.14)}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="caption" color="text.secondary">
                    Initial Flow (Card CCCN201)
                  </Typography>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.initialLiquidFlow`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="Initial Liquid Flow (mfl)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="0.0"
                            error={!!errors.junctions?.[index]?.initialLiquidFlow}
                            helperText={errors.junctions?.[index]?.initialLiquidFlow?.message || 'kg/s or m/s (default: 0.0)'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
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
                            value={field.value ?? ''}
                            label="Initial Vapor Flow (mfv)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="0.0"
                            error={!!errors.junctions?.[index]?.initialVaporFlow}
                            helperText={errors.junctions?.[index]?.initialVaporFlow?.message || 'kg/s or m/s (default: 0.0)'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
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

        <Divider />

        {/* ================================================================ */}
        {/* Section 5: Shaft Geometry (CCC0300) */}
        {/* ================================================================ */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Shaft Geometry (Card CCC0300)
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="shaftSpeed"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Shaft Speed"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">rad/s</InputAdornment>,
                  }}
                  error={!!errors.shaftSpeed}
                  helperText={errors.shaftSpeed?.message || 'Shaft rotational speed'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="stageInertia"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Stage Inertia"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg*m2</InputAdornment>,
                  }}
                  error={!!errors.stageInertia}
                  helperText={errors.stageInertia?.message || 'Rotating stage inertia'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                />
              )}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="shaftFriction"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Shaft Friction"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">N*m*s</InputAdornment>,
                  }}
                  error={!!errors.shaftFriction}
                  helperText={errors.shaftFriction?.message || 'Shaft friction coefficient'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="shaftComponentNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  value={field.value ?? 0}
                  label="Shaft Component Number"
                  size="small"
                  fullWidth
                  required
                  error={!!errors.shaftComponentNumber}
                  helperText={errors.shaftComponentNumber?.message || 'Select SHAFT control variable (Global Settings)'}
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                  }}
                >
                  <MenuItem value={0}>0 - None</MenuItem>
                  {availableShaftCVs.map(cv => (
                    <MenuItem key={cv.number} value={cv.number}>
                      {cv.number} - {cv.name || 'unnamed'}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
        </Grid>

        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="disconnectTrip"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Disconnect Trip"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0 }}
                  error={!!errors.disconnectTrip}
                  helperText={errors.disconnectTrip?.message || '0 = always connected, nonzero = trip number'}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    field.onChange(Math.max(0, value));
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="drainFlag"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Drain Flag"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0 }}
                  error={!!errors.drainFlag}
                  helperText={errors.drainFlag?.message || '0 = not used'}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    field.onChange(Math.max(0, value));
                  }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider />

        {/* ================================================================ */}
        {/* Section 6: Performance Data (CCC0400) */}
        {/* ================================================================ */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Performance Data (Card CCC0400)
        </Typography>

        <Controller
          name="turbineType"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Turbine Type"
              size="small"
              fullWidth
              required
              error={!!errors.turbineType}
              helperText={errors.turbineType?.message}
              onChange={(e) => {
                const value = parseInt(e.target.value) as TurbineType;
                field.onChange(value);
              }}
            >
              {([0, 1, 2, 3] as TurbineType[]).map(t => (
                <MenuItem key={t} value={t}>{TURBINE_TYPE_LABELS[t]}</MenuItem>
              ))}
            </TextField>
          )}
        />

        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="efficiency"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Efficiency (h0)"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  error={!!errors.efficiency}
                  helperText={errors.efficiency?.message || 'Design point actual efficiency (0-1)'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.85)}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="reactionFraction"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Reaction Fraction (r)"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  error={!!errors.reactionFraction}
                  helperText={errors.reactionFraction?.message || 'Design reaction fraction (0-1)'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.5)}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="meanStageRadius"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Mean Stage Radius"
                  type="number"
                  inputProps={numberInputProps}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.meanStageRadius}
                  helperText={errors.meanStageRadius?.message || 'Average stage radius'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.5)}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* ================================================================ */}
        {/* Section 7: Gas Turbine Data (conditional turbineType=3) */}
        {/* ================================================================ */}
        {turbineType === 3 && (
          <>
            <Divider />

            <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
              Gas Turbine Data
            </Typography>

            {/* Efficiency Data Table (CCC0401-0450) */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle2">
                    Efficiency Data (CCC0401-0450)
                  </Typography>
                  <Chip label={`${effFields.length} pairs`} size="small" variant="outlined" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" flexDirection="column" gap={1}>
                  {errors.efficiencyData && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {typeof errors.efficiencyData === 'object' && 'message' in errors.efficiencyData
                        ? (errors.efficiencyData as any).message
                        : 'Efficiency data is required for Gas Turbine'}
                    </Alert>
                  )}

                  {/* Table Header */}
                  {effFields.length > 0 && (
                    <Grid container spacing={1} sx={{ mb: 0.5 }}>
                      <Grid item xs={5}>
                        <Typography variant="caption" fontWeight="600">{'Pressure Ratio (>= 1.0)'}</Typography>
                      </Grid>
                      <Grid item xs={5}>
                        <Typography variant="caption" fontWeight="600">Efficiency</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="caption" fontWeight="600">Action</Typography>
                      </Grid>
                    </Grid>
                  )}

                  {effFields.map((field, index) => (
                    <Grid container spacing={1} key={field.id} alignItems="center">
                      <Grid item xs={5}>
                        <Controller
                          name={`efficiencyData.${index}.pressureRatio`}
                          control={control}
                          render={({ field: f }) => (
                            <TextField
                              {...f}
                              value={f.value ?? ''}
                              type="number"
                              inputProps={numberInputProps}
                              size="small"
                              fullWidth
                              placeholder="1.0"
                              error={!!errors.efficiencyData?.[index]?.pressureRatio}
                              onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                              onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 1.0)}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <Controller
                          name={`efficiencyData.${index}.value`}
                          control={control}
                          render={({ field: f }) => (
                            <TextField
                              {...f}
                              value={f.value ?? ''}
                              type="number"
                              inputProps={numberInputProps}
                              size="small"
                              fullWidth
                              placeholder="0.0"
                              error={!!errors.efficiencyData?.[index]?.value}
                              onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                              onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 0)}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <IconButton
                          size="small"
                          onClick={() => effRemove(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => effAppend({ pressureRatio: 1.0, value: 0 })}
                    disabled={effFields.length >= 20}
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                  >
                    Add Efficiency Pair
                  </Button>
                  {effFields.length >= 20 && (
                    <Typography variant="caption" color="text.secondary">
                      Maximum 20 pairs allowed
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Mass Flow Rate Data Table (CCC0451-0499) */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle2">
                    Mass Flow Rate Data (CCC0451-0499)
                  </Typography>
                  <Chip label={`${mfrFields.length} pairs`} size="small" variant="outlined" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" flexDirection="column" gap={1}>
                  {errors.massFlowRateData && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {typeof errors.massFlowRateData === 'object' && 'message' in errors.massFlowRateData
                        ? (errors.massFlowRateData as any).message
                        : 'Mass flow rate data is required for Gas Turbine'}
                    </Alert>
                  )}

                  {/* Table Header */}
                  {mfrFields.length > 0 && (
                    <Grid container spacing={1} sx={{ mb: 0.5 }}>
                      <Grid item xs={5}>
                        <Typography variant="caption" fontWeight="600">{'Pressure Ratio (>= 1.0)'}</Typography>
                      </Grid>
                      <Grid item xs={5}>
                        <Typography variant="caption" fontWeight="600">Corrected Mass Flow Rate</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="caption" fontWeight="600">Action</Typography>
                      </Grid>
                    </Grid>
                  )}

                  {mfrFields.map((field, index) => (
                    <Grid container spacing={1} key={field.id} alignItems="center">
                      <Grid item xs={5}>
                        <Controller
                          name={`massFlowRateData.${index}.pressureRatio`}
                          control={control}
                          render={({ field: f }) => (
                            <TextField
                              {...f}
                              value={f.value ?? ''}
                              type="number"
                              inputProps={numberInputProps}
                              size="small"
                              fullWidth
                              placeholder="1.0"
                              error={!!errors.massFlowRateData?.[index]?.pressureRatio}
                              onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                              onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 1.0)}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <Controller
                          name={`massFlowRateData.${index}.value`}
                          control={control}
                          render={({ field: f }) => (
                            <TextField
                              {...f}
                              value={f.value ?? ''}
                              type="number"
                              inputProps={numberInputProps}
                              size="small"
                              fullWidth
                              placeholder="0.0"
                              error={!!errors.massFlowRateData?.[index]?.value}
                              onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                              onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 0)}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <IconButton
                          size="small"
                          onClick={() => mfrRemove(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => mfrAppend({ pressureRatio: 1.0, value: 0 })}
                    disabled={mfrFields.length >= 20}
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                  >
                    Add Mass Flow Rate Pair
                  </Button>
                  {mfrFields.length >= 20 && (
                    <Typography variant="caption" color="text.secondary">
                      Maximum 20 pairs allowed
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          </>
        )}
      </Box>
    </form>
  );
};

export default TurbineForm;
