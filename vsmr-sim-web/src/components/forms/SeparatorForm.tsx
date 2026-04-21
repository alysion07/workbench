/**
 * SEPARATOR Parameter Form
 * Specialized Branch with exactly 3 fixed junctions:
 *   N=1: Vapor Outlet (branchFace=2)
 *   N=2: Liquid Fall Back (branchFace=1)
 *   N=3: Separator Inlet (branchFace=1)
 * VolumeReference-based connection (syncs with componentId changes)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Divider,
  InputAdornment,
  Alert,
  Chip,
  Grid,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, SeparatorParameters, SeparatorJunction, VolumeReference } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import { NumericTextField } from '@/components/common/NumericTextField';
import { JunctionControlFlagsField } from '@/components/common/JunctionControlFlagsField';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import ComponentIdField from './ComponentIdField';

/**
 * Validate geometry: A × L = V rule (same as Branch)
 */
function validateGeometry(
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
      if (lengthVal === 0 || volumeVal === 0) return { valid: false, error: 'Cannot calculate Area: Length or Volume is zero' };
      return { valid: true, calculated: { field: 'area', value: volumeVal / lengthVal } };
    }
    if (lengthVal === 0) {
      if (areaVal === 0 || volumeVal === 0) return { valid: false, error: 'Cannot calculate Length: Area or Volume is zero' };
      return { valid: true, calculated: { field: 'length', value: volumeVal / areaVal } };
    }
    if (volumeVal === 0) {
      if (areaVal === 0 || lengthVal === 0) return { valid: false, error: 'Cannot calculate Volume: Area or Length is zero' };
      return { valid: true, calculated: { field: 'volume', value: areaVal * lengthVal } };
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

// Junction schema for Separator (includes voidFractionLimit)
const separatorJunctionSchema = z.object({
  junctionNumber: z.number().int().min(1).max(3),
  direction: z.enum(['inlet', 'outlet']),
  branchFace: z.number().int().min(1).max(2),
  from: volumeRefValidator,
  to: volumeRefValidator,
  area: z.number().min(0, 'Area must be non-negative (0 = auto)'),
  fwdLoss: z.number().min(0),
  revLoss: z.number().min(0),
  jefvcahs: z.string().regex(/^[0-9]{1,8}$/, 'Must be 1-8 digits').transform(v => v.padStart(8, '0')).optional(),
  voidFractionLimit: z.number().min(0).max(1).optional(),
  junctionDiameter: z.number().min(0).optional(),
  ccflBeta: z.number().min(0).max(1).optional(),
  ccflGasIntercept: z.number().positive().optional(),
  ccflSlope: z.number().positive().optional(),
  initialLiquidFlow: z.number().optional(),
  initialVaporFlow: z.number().optional(),
});

// Validation schema
const separatorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),
  separatorOption: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  initialConditionControl: z.union([z.literal(0), z.literal(1)]).optional(),

  // Geometry
  area: z.number().optional(),
  length: z.number().min(0, 'Must be non-negative'),
  volume: z.number().min(0, 'Must be non-negative'),

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
  volumeControlFlags: z.string().optional(),

  // Initial conditions
  ebt: z.enum(['001', '002', '003', '004', '005']),
  pressure: z.number().nonnegative('Must be non-negative').optional(),
  temperature: z.number().positive('Must be positive').optional(),
  quality: z.number().min(0).max(1).optional(),

  // 3 fixed junctions
  junctions: z.array(separatorJunctionSchema).length(3, 'Separator must have exactly 3 junctions'),
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
    if (data.ebt === '001' || data.ebt === '003') {
      return data.temperature !== undefined && data.temperature > 0;
    }
    return true;
  }, {
    message: 'Temperature is required when ebt=001 or ebt=003',
    path: ['temperature'],
  })
  .refine((data) => {
    if (data.ebt === '001' || data.ebt === '002') {
      return data.quality !== undefined;
    }
    return true;
  }, {
    message: 'Quality is required when ebt=001 or ebt=002',
    path: ['quality'],
  });

type FormData = z.infer<typeof separatorSchema>;

interface SeparatorFormProps {
  nodeId: string;
  data: MARSNodeData;
}

// Helper: compare two VolumeReferences
const volumeRefsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
};

// Junction labels
const JUNCTION_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Vapor Outlet', description: 'N=1: Vapor exits upward (Face 2)' },
  2: { label: 'Liquid Fall Back', description: 'N=2: Liquid falls back (Face 1)' },
  3: { label: 'Separator Inlet', description: 'N=3: Mixed flow enters (Face 1)' },
};

const SeparatorForm: React.FC<SeparatorFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, nodes, edges, setPropertyFormState, setFormSubmitHandler } = useStore(useShallow(state => ({
    updateNodeData: state.updateNodeData,
    nodes: state.nodes,
    edges: state.edges,
    setPropertyFormState: state.setPropertyFormState,
    setFormSubmitHandler: state.setFormSubmitHandler,
  })));
  const [activeJunctionTab, setActiveJunctionTab] = useState(0);

  // Stable digest for resolver
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

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
    const sepCompId = data.componentId.slice(0, 3);
    const sepName = data.componentName || 'Separator';

    // Add Separator's own face IDs (for cross-references between its junctions)
    // Face 0 (legacy): volumeNum=0 (Inlet Side), volumeNum=1 (Outlet Side)
    for (const vn of [0, 1]) {
      const ref0: VolumeReference = { nodeId, volumeNum: vn, face: 0 };
      const volumeId0 = resolver.getVolumeIdFromReference(ref0) || '';
      const sideLabel = vn === 0 ? 'Inlet Side' : 'Outlet Side';
      options.push({
        ref: ref0, volumeId: volumeId0,
        label: `${sepName} - ${sideLabel}`,
        componentName: sepName,
        componentType: 'separatr',
      });
    }
    // Face 1, 2 (expanded format)
    for (let i = 1; i <= 2; i++) {
      const ref: VolumeReference = { nodeId, volumeNum: 1, face: i };
      const volumeId = resolver.getVolumeIdFromReference(ref) || '';
      options.push({
        ref, volumeId,
        label: `${sepName} - Face ${i}`,
        componentName: sepName,
        componentType: 'separatr',
      });
    }

    nodes.forEach(node => {
      const compName = node.data.componentName || 'Unnamed';
      const compType = node.data.componentType;
      const shortId = node.data.componentId.slice(0, 3);

      // Skip self
      if (shortId === sepCompId) return;

      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch' || compType === 'separatr' || compType === 'turbine' || compType === 'tank') {
        // Face 0 (legacy CCCVV0000 format): volumeNum=0 (Inlet Side), volumeNum=1 (Outlet Side)
        for (const vn of [0, 1]) {
          const ref0: VolumeReference = { nodeId: node.id, volumeNum: vn, face: 0 };
          const volumeId0 = resolver.getVolumeIdFromReference(ref0) || '';
          const sideLabel = vn === 0 ? 'Inlet Side' : 'Outlet Side';
          options.push({
            ref: ref0, volumeId: volumeId0,
            label: `${compName} - ${sideLabel}`,
            componentName: compName, componentType: compType,
          });
        }
        // Face 1, 2 (expanded format)
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

        // Face 0 (legacy): volumeNum=0 (Inlet Side of pipe)
        const ref0Inlet: VolumeReference = { nodeId: node.id, volumeNum: 0, face: 0 };
        const volumeId0Inlet = resolver.getVolumeIdFromReference(ref0Inlet) || '';
        options.push({
          ref: ref0Inlet, volumeId: volumeId0Inlet,
          label: `${compName} - Inlet Side`,
          componentName: compName, componentType: compType,
        });
        // Face 0 (legacy): volumeNum=1 (Cell 1 / Outlet Side)
        const ref0First: VolumeReference = { nodeId: node.id, volumeNum: 1, face: 0 };
        const volumeId0First = resolver.getVolumeIdFromReference(ref0First) || '';
        options.push({
          ref: ref0First, volumeId: volumeId0First,
          label: `${compName} - Cell 1 Center`,
          componentName: compName, componentType: compType,
        });

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

        if (ncells > 1) {
          for (let i = 2; i <= ncells; i++) {
            // Face 0 (legacy) for each cell
            const ref0Cell: VolumeReference = { nodeId: node.id, volumeNum: i, face: 0 };
            const volumeId0Cell = resolver.getVolumeIdFromReference(ref0Cell) || '';
            options.push({
              ref: ref0Cell, volumeId: volumeId0Cell,
              label: `${compName} - Cell ${i} Center`,
              componentName: compName, componentType: compType,
            });
          }

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
      }
    });

    return options.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest, data.componentId, data.componentName, data.parameters, nodeId, resolver]);

  const refsEqual = (a: VolumeReference | null | undefined, b: VolumeReference | null | undefined): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.nodeId === b.nodeId && a.volumeNum === b.volumeNum && a.face === b.face;
  };

  const params = data.parameters as Partial<SeparatorParameters>;

  // Build self-reference for auto-locked from fields
  // 기본값은 확장 포맷(face=2/1)이지만, 기존 저장된 from이 face=0(레거시)이면 보존
  const getSelfRef = (junctionIndex: number, savedFrom: any): VolumeReference => {
    const parsed = parseJunctionRef(savedFrom);
    // 저장된 from이 자기 자신(nodeId 일치)이고 face=0이면 레거시 포맷 보존
    if (parsed && parsed.nodeId === nodeId && parsed.face === 0) {
      return parsed;
    }
    // 기본: 확장 포맷
    return junctionIndex === 0
      ? { nodeId, volumeNum: 1, face: 2 }  // J1: outlet face
      : { nodeId, volumeNum: 1, face: 1 }; // J2: inlet face
  };

  // Convert SeparatorJunction[] to form-compatible format
  const buildDefaultJunctions = (): [any, any, any] => {
    if (params?.junctions && params.junctions.length === 3) {
      return params.junctions.map((j, i) => ({
        junctionNumber: j.junctionNumber,
        direction: j.direction ?? (i === 2 ? 'inlet' : 'outlet'),
        branchFace: j.branchFace,
        from: i === 0 ? getSelfRef(0, j.from) : i === 1 ? getSelfRef(1, j.from) : parseJunctionRef(j.from),
        to: parseJunctionRef(j.to),
        area: j.area,
        fwdLoss: j.fwdLoss,
        revLoss: j.revLoss,
        jefvcahs: j.jefvcahs,
        voidFractionLimit: j.voidFractionLimit,
        junctionDiameter: j.junctionDiameter,
        ccflBeta: j.ccflBeta,
        ccflGasIntercept: j.ccflGasIntercept,
        ccflSlope: j.ccflSlope,
        initialLiquidFlow: j.initialLiquidFlow,
        initialVaporFlow: j.initialVaporFlow,
      })) as [any, any, any];
    }
    return [
      {
        junctionNumber: 1,
        direction: 'outlet' as const,
        branchFace: 2,
        from: { nodeId, volumeNum: 1, face: 2 } as VolumeReference,
        to: null as VolumeReference | null,
        area: 0,
        fwdLoss: 0,
        revLoss: 0,
        jefvcahs: '00001000',
        voidFractionLimit: 0.5,
        initialLiquidFlow: 0.0,
        initialVaporFlow: 0.0,
      },
      {
        junctionNumber: 2,
        direction: 'outlet' as const,
        branchFace: 1,
        from: { nodeId, volumeNum: 1, face: 1 } as VolumeReference,
        to: null as VolumeReference | null,
        area: 0,
        fwdLoss: 0,
        revLoss: 0,
        jefvcahs: '00001000',
        voidFractionLimit: 0.15,
        initialLiquidFlow: 0.0,
        initialVaporFlow: 0.0,
      },
      {
        junctionNumber: 3,
        direction: 'inlet' as const,
        branchFace: 1,
        from: null as VolumeReference | null,
        to: null as VolumeReference | null,
        area: 0,
        fwdLoss: 0,
        revLoss: 0,
        jefvcahs: '00001000',
        voidFractionLimit: undefined,
        initialLiquidFlow: 0.0,
        initialVaporFlow: 0.0,
      },
    ];
  };

  const defaultJunctions = buildDefaultJunctions();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(separatorSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      separatorOption: (params?.separatorOption ?? 0) as 0 | 1 | 2 | 3,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 1.0,
      volume: params?.volume ?? 0.1,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 90,
      dz: params?.dz ?? 1.0,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.1,
      volumeControlFlags: params?.volumeControlFlags ?? '0',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 7.0e6,
      temperature: params?.temperature ?? 558.0,
      quality: params?.quality,
      junctions: defaultJunctions,
    },
  });

  const ebt = watch('ebt');
  const area = watch('area');
  const length = watch('length');
  const volume = watch('volume');
  const junctions = watch('junctions');

  // Check junction connection status
  const getJunctionStatus = (index: number): { connected: boolean; hasFrom: boolean; hasTo: boolean } => {
    const junction = junctions[index];
    if (!junction) return { connected: false, hasFrom: false, hasTo: false };

    const hasFrom = junction.from !== null && junction.from !== undefined;
    const hasTo = junction.to !== null && junction.to !== undefined;
    const connected = hasFrom && hasTo;

    return { connected, hasFrom, hasTo };
  };

  // Geometry validation
  const geometryValidation = useMemo(() => {
    return validateGeometry(area, length, volume);
  }, [area, length, volume]);

  // Sync junctions with edges (auto-fill VolumeReferences from connections)
  useEffect(() => {
    const sepEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
    const currentJunctions = watch('junctions');

    if (sepEdges.length > 0 && currentJunctions) {
      let hasChanges = false;

      currentJunctions.forEach((junction, idx) => {
        const edge = sepEdges.find(e => {
          const handleId = e.source === nodeId ? e.sourceHandle : e.targetHandle;
          const match = handleId?.match(/j(\d+)/);
          const edgeJunctionNum = match ? parseInt(match[1]) : 0;
          return edgeJunctionNum === junction.junctionNumber;
        });

        if (edge && edge.data) {
          const edgeFromRef = edge.data.fromVolume as VolumeReference | undefined;
          const edgeToRef = edge.data.toVolume as VolumeReference | undefined;

          // N=1 and N=2 have auto-locked from, so only sync to
          if (idx === 0 || idx === 1) {
            if (edgeToRef && !volumeRefsEqual(edgeToRef, junction.to)) {
              setValue(`junctions.${idx}.to`, edgeToRef, { shouldDirty: false });
              hasChanges = true;
            }
          } else {
            // N=3: both from and to are user-selectable
            if (edgeFromRef && !volumeRefsEqual(edgeFromRef, junction.from)) {
              setValue(`junctions.${idx}.from`, edgeFromRef, { shouldDirty: false });
              hasChanges = true;
            }
            if (edgeToRef && !volumeRefsEqual(edgeToRef, junction.to)) {
              setValue(`junctions.${idx}.to`, edgeToRef, { shouldDirty: false });
              hasChanges = true;
            }
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
    const params = data.parameters as Partial<SeparatorParameters>;
    const currentJunctions = buildDefaultJunctions();

    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      separatorOption: (params?.separatorOption ?? 0) as 0 | 1 | 2 | 3,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 1.0,
      volume: params?.volume ?? 0.1,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 90,
      dz: params?.dz ?? 1.0,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.1,
      volumeControlFlags: params?.volumeControlFlags ?? '0',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 7.0e6,
      temperature: params?.temperature ?? 558.0,
      quality: params?.quality,
      junctions: currentJunctions,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, data, reset]);

  // Update temperature/quality fields based on ebt
  useEffect(() => {
    if (ebt === '001') {
      if (!watch('temperature')) setValue('temperature', 558.0, { shouldDirty: false });
      if (watch('quality') === undefined) setValue('quality', 0.0, { shouldDirty: false });
    } else if (ebt === '002' && !watch('quality')) {
      setValue('quality', 0.0, { shouldDirty: false });
    } else if (ebt === '003' && !watch('temperature')) {
      setValue('temperature', 558.0, { shouldDirty: false });
    }
  }, [ebt, setValue, watch]);

  const onSubmit: SubmitHandler<FormData> = (formData) => {
    // Convert form junctions to SeparatorJunction
    const convertedJunctions: [SeparatorJunction, SeparatorJunction, SeparatorJunction] = formData.junctions.map((j, idx) => ({
      junctionNumber: j.junctionNumber,
      direction: j.direction,
      branchFace: j.branchFace as 1 | 2,
      // N=1, N=2: 저장된 from 보존 (face=0 레거시 or face=1/2 확장), 없으면 확장 포맷 기본값
      from: idx === 0 ? getSelfRef(0, j.from) : idx === 1 ? getSelfRef(1, j.from) : (j.from || { nodeId: '', volumeNum: 1, face: 1 }),
      to: j.to || { nodeId: '', volumeNum: 1, face: 1 },
      area: j.area,
      fwdLoss: j.fwdLoss,
      revLoss: j.revLoss,
      jefvcahs: j.jefvcahs,
      voidFractionLimit: j.voidFractionLimit,
      junctionDiameter: j.junctionDiameter,
      ccflBeta: j.ccflBeta,
      ccflGasIntercept: j.ccflGasIntercept,
      ccflSlope: j.ccflSlope,
      initialLiquidFlow: j.initialLiquidFlow,
      initialVaporFlow: j.initialVaporFlow,
    } as SeparatorJunction)) as [SeparatorJunction, SeparatorJunction, SeparatorJunction];

    const parameters: Partial<SeparatorParameters> = {
      name: formData.name,
      separatorOption: formData.separatorOption,
      initialConditionControl: formData.initialConditionControl,
      area: formData.area,
      length: formData.length,
      volume: formData.volume,
      azAngle: formData.azAngle,
      incAngle: formData.incAngle,
      dz: formData.dz,
      wallRoughness: formData.wallRoughness,
      hydraulicDiameter: formData.hydraulicDiameter,
      volumeControlFlags: formData.volumeControlFlags,
      ebt: formData.ebt,
      pressure: formData.pressure,
      temperature: formData.temperature,
      quality: formData.quality,
      junctions: convertedJunctions,
    };

    // Validate
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

    if (!formData.name) validationErrors.push({ level: 'error', message: 'Name is required' });
    if (formData.length <= 0) validationErrors.push({ level: 'error', message: 'Length must be positive' });

    const effectiveVolume = formData.volume > 0
      ? formData.volume
      : (geometryValidation.calculated?.field === 'volume' ? geometryValidation.calculated.value : 0);
    if (effectiveVolume <= 0) validationWarnings.push({ level: 'warning', message: 'Volume is 0 (will be auto-calculated from A×L)' });
    if (formData.ebt !== '001' && (formData.pressure === undefined || formData.pressure <= 0)) validationErrors.push({ level: 'error', message: 'Pressure must be positive' });

    if (!geometryValidation.valid) {
      validationErrors.push({ level: 'error', message: geometryValidation.error! });
    }

    // Junction validation
    formData.junctions.forEach((junction, idx) => {
      const hasFrom = junction.from !== null && junction.from !== undefined;
      const hasTo = junction.to !== null && junction.to !== undefined;

      // N=1 and N=2 always have from (auto-locked), so only check to
      if (idx === 0 || idx === 1) {
        if (!hasTo) {
          validationWarnings.push({
            level: 'warning',
            message: `Junction ${junction.junctionNumber} (${JUNCTION_LABELS[junction.junctionNumber].label}): Not connected to target volume`,
          });
        }
      } else {
        // N=3: check both
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
            message: `Junction ${junction.junctionNumber} (${JUNCTION_LABELS[junction.junctionNumber].label}): Not connected to any volume`,
          });
        }
      }
    });

    const status = validationErrors.length === 0 ? 'valid' : 'error';

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      componentType: 'separatr',
      parameters,
      status,
      errors: validationErrors,
      warnings: validationWarnings,
    });
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

  // Helper: get display string for auto-locked from ref
  const getLockedRefDisplay = (ref: VolumeReference): string => {
    const option = availableVolumes.find(opt => refsEqual(opt.ref, ref));
    if (option) return `${option.volumeId} (${option.label})`;
    const volumeId = resolver.getVolumeIdFromReference(ref);
    return volumeId || `Self - Face ${ref.face}`;
  };

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
          name="separatorOption"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Separator Option (ISEPST)"
              size="small"
              fullWidth
              error={!!errors.separatorOption}
              helperText={errors.separatorOption?.message}
              onChange={(e) => field.onChange(parseInt(e.target.value))}
            >
              <MenuItem value={0}>0: Simple separator (RELAP5 default)</MenuItem>
              <MenuItem value={1}>1: GE dryer model</MenuItem>
              <MenuItem value={2}>2: GE two-stage separator</MenuItem>
              <MenuItem value={3}>3: GE three-stage separator</MenuItem>
            </TextField>
          )}
        />

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
              onChange={(e) => field.onChange(parseInt(e.target.value))}
            >
              <MenuItem value={0}>0: Velocity (m/s)</MenuItem>
              <MenuItem value={1}>1: Mass flow rate (kg/s)</MenuItem>
            </TextField>
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
          name="volumeControlFlags"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Volume Control Flags"
              size="small"
              fullWidth
              placeholder="0"
              error={!!errors.volumeControlFlags}
              helperText={errors.volumeControlFlags?.message || 'Format: 000001e (only last digit e editable)'}
              inputProps={{ maxLength: 7 }}
            />
          )}
        />

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
              label="Equilibrium Option (ebt)"
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
                  value={field.value ?? 7.0e6}
                  onChange={(num) => field.onChange(isNaN(num) ? 7.0e6 : num)}
                  size="small"
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
                  }}
                  error={!!errors.pressure}
                  helperText={errors.pressure?.message || 'Example: 7.0e6 or 7000000'}
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
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Junctions (3 Fixed)
        </Typography>

        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 1 }}>
          Separator has exactly 3 fixed junctions: Vapor Outlet (N=1), Liquid Fall Back (N=2), Separator Inlet (N=3)
        </Alert>

        {/* Junction Tab Buttons */}
        <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
          {[0, 1, 2].map((idx) => {
            const status = getJunctionStatus(idx);
            const junctionNum = idx + 1;
            const jLabel = JUNCTION_LABELS[junctionNum];
            const isSelected = idx === activeJunctionTab;
            const isInlet = idx === 2;

            return (
              <Tooltip key={idx} title={jLabel.description}>
                <Chip
                  icon={
                    status.connected ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <RadioButtonUncheckedIcon fontSize="small" />
                    )
                  }
                  label={`J${junctionNum}: ${jLabel.label}`}
                  onClick={() => setActiveJunctionTab(idx)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  sx={{
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isInlet ? '#2196F3' : '#FF9800',
                    color: isSelected ? 'white' : (isInlet ? '#2196F3' : '#FF9800'),
                    backgroundColor: isSelected ? (isInlet ? '#2196F3' : '#FF9800') : 'white',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? (isInlet ? '#1976D2' : '#F57C00')
                        : (isInlet ? '#E3F2FD' : '#FFF3E0'),
                    },
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Active Junction Form */}
        {[0, 1, 2].map((index) => {
          if (index !== activeJunctionTab) return null;
          const junctionNum = index + 1;
          const jLabel = JUNCTION_LABELS[junctionNum];
          const isFromLocked = index === 0 || index === 1;
          const lockedFromRef = watch(`junctions.${index}.from`) as VolumeReference;
          const hasVoidFractionLimit = index === 0 || index === 1;

          return (
            <Box key={index} display="flex" flexDirection="column" gap={1}>
              {/* Junction Header */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
                  J{junctionNum}: {jLabel.label}
                </Typography>
                <Chip
                  label={watch(`junctions.${index}.direction`).toUpperCase()}
                  size="small"
                  sx={{
                    backgroundColor: watch(`junctions.${index}.direction`) === 'inlet' ? '#2196F3' : '#FF9800',
                    color: 'white',
                  }}
                />
              </Box>

              {/* Connection Status Alert */}
              {(() => {
                const status = getJunctionStatus(index);
                if (!status.connected) {
                  return (
                    <Alert severity="info" icon={<InfoIcon />}>
                      {isFromLocked
                        ? (!status.hasTo ? 'Set To volume to complete connection' : 'Connected')
                        : (!status.hasFrom && !status.hasTo
                          ? 'Not connected: Set From and To volumes'
                          : !status.hasFrom
                            ? 'Incomplete: Set From volume'
                            : 'Incomplete: Set To volume')}
                    </Alert>
                  );
                }
                return null;
              })()}

              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name={`junctions.${index}.direction`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Direction"
                        size="small"
                        fullWidth
                        disabled
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="disabled" /></InputAdornment>,
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name={`junctions.${index}.branchFace`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Branch Face"
                        size="small"
                        fullWidth
                        disabled
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="disabled" /></InputAdornment>,
                        }}
                        helperText={`Face ${field.value}: ${field.value === 1 ? 'Inlet side' : 'Outlet side'}`}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  {isFromLocked ? (
                    <TextField
                      label="From Volume"
                      size="small"
                      fullWidth
                      disabled
                      value={getLockedRefDisplay(lockedFromRef)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="disabled" /></InputAdornment>,
                      }}
                      helperText="Auto-locked to self"
                    />
                  ) : (
                    <Controller
                      name={`junctions.${index}.from`}
                      control={control}
                      render={({ field }) => {
                        const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, field.value)) || null;

                        return (
                          <Autocomplete
                            options={availableVolumes}
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
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name={`junctions.${index}.to`}
                    control={control}
                    render={({ field }) => {
                      const selectedOption = availableVolumes.find(opt => refsEqual(opt.ref, field.value)) || null;

                      return (
                        <Autocomplete
                          options={availableVolumes}
                          getOptionLabel={(option) => option.volumeId}
                          value={selectedOption}
                          onChange={(_, newValue) => {
                            field.onChange(newValue ? newValue.ref : null);
                            // J1, J2: To의 face 포맷에 맞춰 auto-locked From도 동기화
                            // To가 face=0(레거시)이면 From도 face=0, 아니면 확장 포맷 복원
                            if ((index === 0 || index === 1) && newValue?.ref) {
                              const isLegacy = newValue.ref.face === 0;
                              // J1(VAPOR OUTLET): from=자신의 outlet → 레거시 VV=01, 확장 face=2
                              // J2(LIQUID FALL BACK): from=자신의 inlet → 레거시 VV=00, 확장 face=1
                              const newFrom: VolumeReference = isLegacy
                                ? { nodeId, volumeNum: index === 0 ? 1 : 0, face: 0 }
                                : { nodeId, volumeNum: 1, face: index === 0 ? 2 : 1 };
                              setValue(`junctions.${index}.from` as any, newFrom, { shouldDirty: true });
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
                    value={field.value ?? '00001000'}
                    onChange={field.onChange}
                    preset="separator"
                    error={!!errors.junctions?.[index]?.jefvcahs}
                    helperText={errors.junctions?.[index]?.jefvcahs?.message}
                  />
                )}
              />

              {/* Void Fraction Limit (N=1 and N=2 only) */}
              {hasVoidFractionLimit && (
                <Controller
                  name={`junctions.${index}.voidFractionLimit`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label={index === 0 ? 'VOVER (Void Fraction Limit)' : 'VUNDER (Void Fraction Limit)'}
                      type="number"
                      inputProps={numberInputProps}
                      size="small"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">0-1</InputAdornment>,
                      }}
                      error={!!errors.junctions?.[index]?.voidFractionLimit}
                      helperText={
                        errors.junctions?.[index]?.voidFractionLimit?.message ||
                        (index === 0
                          ? 'Vapor carryover limit (default: 0.5)'
                          : 'Liquid carryunder limit (default: 0.15)')
                      }
                      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                      onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, index === 0 ? 0.5 : 0.15)}
                    />
                  )}
                />
              )}

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
      </Box>
    </form>
  );
};

export default SeparatorForm;
