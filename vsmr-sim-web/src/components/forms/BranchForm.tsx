/**
 * BRANCH Parameter Form
 * Branch component with multiple junctions (2-9)
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
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, BranchParameters, BranchJunction, VolumeReference, CrossflowDialogInitialValues, FaceType } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NumericTextField } from '@/components/common/NumericTextField';
import { JunctionControlFlagsField } from '@/components/common/JunctionControlFlagsField';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

/**
 * Validate Branch geometry according to MARS rules:
 * - At least 2 of {area, length, volume} must be non-zero
 * - If all 3 non-zero, check consistency: V ≈ A×L
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
      error: `Inconsistent: A×L=${calculatedVolume.toExponential(3)} ≠ V=${volumeVal.toExponential(3)} (error=${(relativeError * 100).toFixed(4)}%)`,
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

// Crossflow volume data schema (CCC0181/CCC0191)
const crossflowDataSchema = z.object({
  area: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),
  length: z.number().min(0, 'Must be non-negative'),
  roughness: z.number().min(0, 'Must be non-negative'),
  hydraulicDiameter: z.number().min(0, 'Must be non-negative'),
  controlFlags: z.string().regex(/^[0-9]{7}$/, 'Must be 7 digits'),
  dz: z.number(),
});

// Junction schema
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
  junctionDiameter: z.number().min(0).optional(),
  ccflBeta: z.number().min(0).max(1).optional(),
  ccflGasIntercept: z.number().positive().optional(),
  ccflSlope: z.number().positive().optional(),
  initialLiquidFlow: z.number().optional(),
  initialVaporFlow: z.number().optional(),
});

// Validation schema
const branchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),
  njuns: z.number().int().min(1, 'Min 1 junction').max(9, 'Max 9 junctions'),
  initialConditionControl: z.union([z.literal(0), z.literal(1)]).optional(),

  // Geometry
  area: z.number().optional(),
  length: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),
  volume: z.number().min(0, 'Must be non-negative (0 = auto-calculate)'),

  // Angles
  azAngle: z.number().refine(val => val === undefined || Math.abs(val) <= 360, {
    message: 'Azimuthal angle must be |angle| ≤ 360°',
  }).optional(),
  incAngle: z.number().refine(val => Math.abs(val) <= 90, {
    message: 'Inclination angle must be |angle| ≤ 90°',
  }),
  dz: z.number(),

  // Wall
  wallRoughness: z.number().positive().optional(),
  hydraulicDiameter: z.number().positive('Must be positive'),
  tlpvbfe: z.string().regex(/^[0-9]{7}$/).optional(),

  // Initial conditions
  ebt: z.enum(['001', '002', '003', '004', '005']),
  pressure: z.number().nonnegative('Must be non-negative').optional(),
  temperature: z.number().positive('Must be positive').optional(),
  quality: z.number().min(0).max(1).optional(),

  // Junctions
  junctions: z.array(junctionSchema).min(1, 'At least 1 junction required').max(9, 'Maximum 9 junctions'),

  // Crossflow Volume Data (optional)
  enableYCrossflow: z.boolean().optional(),
  enableZCrossflow: z.boolean().optional(),
  yCrossflowData: crossflowDataSchema.optional(),
  zCrossflowData: crossflowDataSchema.optional(),
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
  .refine((_data) => {
    return true;
  }, {
    message: 'TMDPVOL connections must use face 1 or 2',
    path: ['junctions'],
  })
  .refine((data) => {
    return Math.abs(data.dz) <= data.length;
  }, {
    message: 'Elevation change (|dz|) must not exceed length',
    path: ['dz'],
  })
  .refine((data) => {
    if (data.wallRoughness && data.wallRoughness > 0) {
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
  });

type FormData = z.infer<typeof branchSchema>;

interface BranchFormProps {
  nodeId: string;
  data: MARSNodeData;
}

// Helper: compare two VolumeReferences
const volumeRefsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
};

const BranchForm: React.FC<BranchFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, nodes, edges, setPropertyFormState, setFormSubmitHandler, openCrossflowDialog } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, nodes: state.nodes, edges: state.edges, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, openCrossflowDialog: state.openCrossflowDialog })));
  const [activeJunctionTab, setActiveJunctionTab] = useState(0);

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  // (not on selection, position drag, or other unrelated node changes)
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Create resolver for ID operations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Helper: parse legacy string or VolumeReference to VolumeReference | null
  const parseJunctionRef = (ref: VolumeReference | string | null | undefined): VolumeReference | null => {
    if (!ref) return null;
    if (typeof ref === 'object' && 'nodeId' in ref) {
      return ref.nodeId ? ref : null; // Return null if nodeId is empty
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
    const branchCompId = data.componentId.slice(0, 3);
    const branchName = data.componentName || 'Branch';

    // Add Branch's own junction face IDs (for cross-references)
    const currentNjuns = (data.parameters as Partial<BranchParameters>)?.njuns || 2;
    for (let i = 1; i <= Math.min(currentNjuns, 6); i++) {
      const ref: VolumeReference = { nodeId, volumeNum: 1, face: i };
      const volumeId = resolver.getVolumeIdFromReference(ref) || '';
      options.push({
        ref, volumeId,
        label: `${branchName} - Face ${i}`,
        componentName: branchName,
        componentType: 'branch',
      });
    }

    nodes.forEach(node => {
      const compName = node.data.componentName || 'Unnamed';
      const compType = node.data.componentType;
      const shortId = node.data.componentId.slice(0, 3);

      // Skip self
      if (shortId === branchCompId) return;

      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch') {
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
        // First cell inlet and last cell outlet (simplified for branch)
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
              // Skip already-added first cell inlet and last cell outlet
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

  const params = data.parameters as Partial<BranchParameters>;
  const defaultNjuns = params?.njuns || 2;

  // Convert BranchJunction[] to form-compatible format
  const defaultJunctions = params?.junctions
    ? params.junctions.map(j => ({
      junctionNumber: j.junctionNumber,
      direction: j.direction ?? (j.branchFace === 1 ? 'inlet' : 'outlet'),
      branchFace: j.branchFace,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
      area: j.area,
      fwdLoss: j.fwdLoss,
      revLoss: j.revLoss,
      jefvcahs: j.jefvcahs,
      dischargeCoefficient: j.dischargeCoefficient,
      thermalConstant: j.thermalConstant,
      junctionDiameter: j.junctionDiameter,
      ccflBeta: j.ccflBeta,
      ccflGasIntercept: j.ccflGasIntercept,
      ccflSlope: j.ccflSlope,
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
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: defaultNjuns,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 0.18,
      volume: params?.volume ?? 0.52348,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 90,
      dz: params?.dz ?? 0.18,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.18815,
      tlpvbfe: params?.tlpvbfe ?? '0000000',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 15.074e6,
      temperature: params?.temperature ?? 594.05,
      quality: params?.quality,
      junctions: defaultJunctions,

      // Crossflow Volume Data
      enableYCrossflow: !!params?.yCrossflowData,
      enableZCrossflow: !!params?.zCrossflowData,
      yCrossflowData: params?.yCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },
      zCrossflowData: params?.zCrossflowData ?? { area: 0.0, length: 1.0, roughness: 0.0, hydraulicDiameter: 0.0, controlFlags: '0000010', dz: 0.0 },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'junctions',
  });

  const ebt = watch('ebt');
  const area = watch('area');
  const length = watch('length');
  const volume = watch('volume');
  const junctions = watch('junctions');
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
    const existingNumbers = currentJunctions.map(j => j.junctionNumber);

    let nextNumber = 1;
    while (existingNumbers.includes(nextNumber) && nextNumber <= 9) {
      nextNumber++;
    }

    if (nextNumber > 9) {
      alert('Maximum 9 junctions allowed');
      return;
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

    setValue('njuns', currentJunctions.length + 1);
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
      alert('Branch must have at least 1 junction');
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
    setValue('njuns', currentJunctions.length - 1);
  };

  // Sync junctions with edges (auto-fill VolumeReferences from connections)
  useEffect(() => {
    const branchEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
    const currentJunctions = watch('junctions');

    if (branchEdges.length > 0 && currentJunctions) {
      let hasChanges = false;

      currentJunctions.forEach((junction, idx) => {
        const edge = branchEdges.find(e => {
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
    const params = data.parameters as Partial<BranchParameters>;
    const currentJunctions = params?.junctions || defaultJunctions;

    const formJunctions = currentJunctions.map(j => ({
      ...j,
      from: parseJunctionRef(j.from),
      to: parseJunctionRef(j.to),
    }));

    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: currentJunctions.length,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 0.18,
      volume: params?.volume ?? 0.52348,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 90,
      dz: params?.dz ?? 0.18,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.18815,
      tlpvbfe: params?.tlpvbfe ?? '0000000',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 15.074e6,
      temperature: params?.temperature ?? 594.05,
      quality: params?.quality,
      junctions: formJunctions as any,
    });
  }, [nodeId, data, reset]);

  // Update temperature/quality fields based on ebt
  useEffect(() => {
    if (ebt === '002' && !watch('quality')) {
      setValue('quality', 0.0, { shouldDirty: false });
    } else if (ebt === '003' && !watch('temperature')) {
      setValue('temperature', 594.05, { shouldDirty: false });
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
      junctionDiameter: j.junctionDiameter,
      ccflBeta: j.ccflBeta,
      ccflGasIntercept: j.ccflGasIntercept,
      ccflSlope: j.ccflSlope,
      initialLiquidFlow: j.initialLiquidFlow,
      initialVaporFlow: j.initialVaporFlow,
    } as BranchJunction));

    const { enableYCrossflow: _ey, enableZCrossflow: _ez, ...restFormData } = formData;
    const parameters: Partial<BranchParameters> = {
      ...restFormData,
      junctions: convertedJunctions,
      njuns: formData.junctions.length,
      yCrossflowData: formData.enableYCrossflow ? formData.yCrossflowData : undefined,
      zCrossflowData: formData.enableZCrossflow ? formData.zCrossflowData : undefined,
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
    if (formData.ebt !== '001' && (formData.pressure === undefined || formData.pressure <= 0)) validationErrors.push({ level: 'error', message: 'Pressure must be positive' });

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
      isValid: isValid && geometryValidation.valid,
    });
  }, [isDirty, isValid, geometryValidation.valid, setPropertyFormState]);

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
              inputProps={{ min: 1, max: 9, readOnly: true }}
              disabled
              value={fields.length}
              error={!!errors.njuns}
              helperText={errors.njuns?.message || 'Auto-calculated from junction list'}
            />
          )}
        />

        <Divider />

        {/* Geometry */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Volume Geometry (A × L = V Rule)
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
                    endAdornment: <InputAdornment position="end">m²</InputAdornment>,
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
                    endAdornment: <InputAdornment position="end">m³</InputAdornment>,
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

        <Divider />

        {/* Angles */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Angles
        </Typography>

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
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  error={!!errors.azAngle}
                  helperText={errors.azAngle?.message || '|angle| ≤ 360°'}
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
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  error={!!errors.incAngle}
                  helperText={errors.incAngle?.message || '0°=horizontal, 90°=vertical'}
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
                  helperText={errors.dz?.message || '|dz| ≤ length'}
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
                  helperText={errors.wallRoughness?.message || 'Default: 3.048e-5'}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 3.048e-5)}
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
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.hydraulicDiameter}
                  helperText={errors.hydraulicDiameter?.message}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
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
              placeholder="0000000"
              error={!!errors.tlpvbfe}
              helperText={errors.tlpvbfe?.message || '7-digit flags'}
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
              <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
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
              <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
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

        {/* Initial Conditions */}
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
              label="Equilibrium Option (εbt)"
              size="small"
              fullWidth
              required
              error={!!errors.ebt}
              helperText={errors.ebt?.message}
            >
              <MenuItem value="001">001: [T, xs] - Temperature & Quality</MenuItem>
              <MenuItem value="002">002: [P, xs] - Pressure & Quality</MenuItem>
              <MenuItem value="003">003: [P, T] - Pressure & Temperature</MenuItem>
              <MenuItem value="004">004: [P, T, xs] - Two components</MenuItem>
              <MenuItem value="005">005: [T, xs, xn] - Two components</MenuItem>
            </TextField>
          )}
        />

        <Grid container spacing={1}>
          {ebt !== '001' && (
          <Grid item xs={12} sm={6}>
            <Controller
              name="pressure"
              control={control}
              render={({ field }) => (
                <NumericTextField
                  label="Pressure"
                  value={field.value ?? 15.074e6}
                  onChange={(num) => field.onChange(isNaN(num) ? 15.074e6 : num)}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
                  }}
                  error={!!errors.pressure}
                  helperText={errors.pressure?.message || 'Example: 15.074e6 or 15074000'}
                />
              )}
            />
          </Grid>
          )}
          {(ebt === '001' || ebt === '003') && (
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
          {(ebt === '001' || ebt === '002') && (
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

        {/* Junctions */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
            Junctions ({fields.length})
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleAddJunction('inlet')}
              disabled={fields.length >= 9}
            >
              Add Inlet
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleAddJunction('outlet')}
              disabled={fields.length >= 9}
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
                  <Box mb={1.5}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
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
                  <Box mb={1.5}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
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
                      <Tooltip title="연결 Wizard 열기">
                        <IconButton size="small" onClick={() => openCrossflowWizardForJunction(index)} color="primary">
                          <AccountTreeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Chip
                        label={(watch(`junctions.${index}.direction`) ?? 'inlet').toUpperCase()}
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
                          endAdornment: <InputAdornment position="end">m²</InputAdornment>,
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
                      <JunctionControlFlagsField
                        value={field.value ?? '00000000'}
                        onChange={field.onChange}
                        preset="branch"
                        error={!!errors.junctions?.[index]?.jefvcahs}
                        helperText={errors.junctions?.[index]?.jefvcahs?.message}
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
                    Junction Diameter & CCFL (Card CCCN110)
                  </Typography>

                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.junctionDiameter`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="Junction Diameter (D_j)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="0.0"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">m</InputAdornment>,
                            }}
                            error={!!errors.junctions?.[index]?.junctionDiameter}
                            helperText={errors.junctions?.[index]?.junctionDiameter?.message || '0 = auto from area'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.ccflBeta`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="CCFL β (correlation form)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="0.0"
                            error={!!errors.junctions?.[index]?.ccflBeta}
                            helperText={errors.junctions?.[index]?.ccflBeta?.message || '0=Wallis, 1=Kutateladze'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.0)}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.ccflGasIntercept`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="CCFL Gas Intercept (c)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="1.0"
                            error={!!errors.junctions?.[index]?.ccflGasIntercept}
                            helperText={errors.junctions?.[index]?.ccflGasIntercept?.message || 'Default: 1.0'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`junctions.${index}.ccflSlope`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            label="CCFL Slope (m)"
                            type="number"
                            inputProps={numberInputProps}
                            size="small"
                            fullWidth
                            placeholder="1.0"
                            error={!!errors.junctions?.[index]?.ccflSlope}
                            helperText={errors.junctions?.[index]?.ccflSlope?.message || 'Default: 1.0'}
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
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
      </Box>
    </form>
  );
};

export default BranchForm;
