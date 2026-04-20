/**
 * Heat Structure Parameter Form
 * Phase 1: General structures only (no fuel rods, gap models)
 */

import { useEffect, useState, useMemo } from 'react';
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
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Paper,
  Grid,
  Autocomplete,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { NodeIdResolver } from '@/utils/nodeIdResolver';
import { VolumeReference } from '@/types/mars';

// ============================================================================
// Material Options - SMART reference defaults + Special materials
// ============================================================================

// SMART 참조 파일 기반 기본 재료 목록 (Thermal Properties 미정의 시 fallback)
const DEFAULT_MATERIAL_OPTIONS = [
  { value: 1, label: '1 - MDF A508 C3 (RV Base Metal)' },
  { value: 2, label: '2 - Austenite SS (RV Cladding)' },
  { value: 3, label: '3 - 304 SS (Internal Structure)' },
  { value: 4, label: '4 - UO2 (Fuel Pellet)' },
  { value: 5, label: '5 - Fuel Gap (Gas)' },
  { value: 6, label: '6 - Zircaloy (Clad)' },
  { value: 7, label: '7 - 321 SS (MCP)' },
  { value: 8, label: '8 - Inconel 690 (SG)' },
  { value: 9, label: '9 - Wet Insulator (PZR)' },
] as const;

// 특수 재료 (연료봉 Gap 모델)
const SPECIAL_MATERIAL_OPTIONS = [
  { value: -5, label: '-5 - Gap Model (Fuel)' },
  { value: -6, label: '-6 - Gap Model (Clad)' },
] as const;
import {
  MARSNodeData,
  HeatStructureParameters,
  HsGapConductance,
  HsMetalWaterReaction,
  HsCladdingDeformation,
  HsGapDeformation,
} from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import ComponentIdField from './ComponentIdField';

// ============================================================================
// Zod Validation Schema
// ============================================================================

const meshIntervalSchema = z.object({
  intervals: z.number().int().min(1).max(99),
  rightCoord: z.number(),
});

const materialCompositionSchema = z.object({
  materialNumber: z.number().int(),
  interval: z.number().int().min(1),
});

const sourceDistributionSchema = z.object({
  sourceValue: z.number(),
  interval: z.number().int().min(1),
});

const initialTemperatureSchema = z.object({
  temperature: z.number().positive(),
  meshPoint: z.number().int().min(1),
});

const boundaryConditionSchema = z.object({
  boundaryVolume: z.any().nullable().default(null), // VolumeReference or null (required but nullable)
  increment: z.number().int().default(0),
  bcType: z.number().int(),  // 0=Insulated, 1nn=Convective, 1000=SurfTemp, etc.
  surfaceAreaCode: z.union([z.literal(0), z.literal(1)]),
  surfaceArea: z.number().nonnegative(), // 0 for insulated is valid
  hsNumber: z.number().int().min(1),
});

const sourceDataSchema = z.object({
  sourceType: z.number().int(),
  multiplier: z.number(),
  dmhl: z.number(),
  dmhr: z.number(),
  hsNumber: z.number().int().min(1),
});

const additionalBoundarySchema = z.object({
  heatTransferDiameter: z.number().min(0),
  heatedLengthForward: z.number().positive(),
  heatedLengthReverse: z.number().positive(),
  gridSpacerLengthFwd: z.number().min(0),
  gridSpacerLengthRev: z.number().min(0),
  gridLossCoeffFwd: z.number().min(0),
  gridLossCoeffRev: z.number().min(0),
  localBoilingFactor: z.number().positive(),
  // 12-word format fields (optional, for Additional BC Option = 1)
  naturalCirculationLength: z.number().min(0).optional(),
  pitchToDiameterRatio: z.number().min(0).optional(),
  foulingFactor: z.number().min(0).optional(),
  hsNumber: z.number().int().min(1),
});

// Phase 2: Gap Conductance Schema (Card 1CCCG001)
const gapConductanceSchema = z.object({
  initialGapPressure: z.number().positive(),
  referenceVolume: z.any(),  // VolumeReference (required)
  conductanceMultiplier: z.number().positive().optional(),  // Optional, default 1.0
});

// Phase 2: Metal-Water Reaction Schema (Card 1CCCG003)
const metalWaterReactionSchema = z.object({
  initialOxideThickness: z.number().min(0),
});

// Phase 2: Cladding Deformation Schema (Card 1CCCG004)
const claddingDeformationSchema = z.object({
  formLossFlag: z.union([z.literal(0), z.literal(1)]),
});

// Phase 2: Gap Deformation Schema (Cards 1CCCG011-099)
const gapDeformationSchema = z.object({
  fuelSurfaceRoughness: z.number().positive(),
  cladSurfaceRoughness: z.number().positive(),
  fuelSwelling: z.number(),
  cladCreepdown: z.number(),
  hsNumber: z.number().int().min(1),
});

const heatStructureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Basic parameters
  nh: z.number().int().min(1).max(99),
  np: z.number().int().min(2).max(99),
  geometryType: z.union([z.literal(1), z.literal(2)]),
  ssInitFlag: z.union([z.literal(0), z.literal(1)]),
  leftBoundaryCoord: z.number(),

  // Mesh flags
  meshLocationFlag: z.literal(0),
  meshFormatFlag: z.union([z.literal(1), z.literal(2)]),

  // Arrays
  meshIntervals: z.array(meshIntervalSchema).min(1),
  materialCompositions: z.array(materialCompositionSchema).min(1),
  sourceDistributions: z.array(sourceDistributionSchema).min(1),
  initialTemperatures: z.array(initialTemperatureSchema).min(1),
  leftBoundaryConditions: z.array(boundaryConditionSchema),
  rightBoundaryConditions: z.array(boundaryConditionSchema),
  sourceData: z.array(sourceDataSchema),

  // Additional boundary (always output 800/900 option cards per SMART format)
  leftAdditionalOption: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(0),
  leftAdditionalBoundary: z.array(additionalBoundarySchema).optional(),
  rightAdditionalOption: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(0),
  rightAdditionalBoundary: z.array(additionalBoundarySchema).optional(),

  // === Phase 2: Fuel Rod Options ===
  isFuelRod: z.boolean().optional().default(false),

  // Reflood Options (Card 1CCCG000 Words 6-8) - visible when isFuelRod=true
  refloodFlag: z.number().int().min(0).optional().default(0),
  boundaryVolumeIndicator: z.union([z.literal(0), z.literal(1)]).optional().default(0),
  maxAxialIntervals: z.number().int().optional().default(2),

  // Fuel Rod Cards (visible when isFuelRod=true)
  gapConductance: gapConductanceSchema.optional(),
  metalWaterReaction: metalWaterReactionSchema.optional(),
  claddingDeformation: claddingDeformationSchema.optional(),
  gapDeformationData: z.array(gapDeformationSchema).optional(),
});

type FormData = z.infer<typeof heatStructureSchema>;

// ============================================================================
// Tab Panel Component
// ============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// ============================================================================
// Default Values Generator
// ============================================================================

function getDefaultFormValues(data: MARSNodeData): FormData {
  const params = data.parameters as Partial<HeatStructureParameters>;

  return {
    name: data.componentName || '',
    componentId: data.componentId,
    nh: params?.nh ?? 1,
    np: params?.np ?? 3,
    geometryType: params?.geometryType ?? 1,
    ssInitFlag: params?.ssInitFlag ?? 1,
    leftBoundaryCoord: params?.leftBoundaryCoord ?? 0,
    meshLocationFlag: 0,
    meshFormatFlag: params?.meshFormatFlag ?? 1,
    meshIntervals: params?.meshIntervals ?? [{ intervals: 2, rightCoord: 0.1 }],
    materialCompositions: params?.materialCompositions ?? [{ materialNumber: 1, interval: 2 }],
    sourceDistributions: params?.sourceDistributions ?? [{ sourceValue: 0, interval: 2 }],
    initialTemperatures: params?.initialTemperatures ?? [{ temperature: 560, meshPoint: 3 }],
    leftBoundaryConditions: params?.leftBoundaryConditions ?? [
      {
        boundaryVolume: null,
        increment: 0,
        bcType: 0,
        surfaceAreaCode: 0,
        surfaceArea: 1.0,
        hsNumber: 1,
      },
    ],
    rightBoundaryConditions: params?.rightBoundaryConditions ?? [
      {
        boundaryVolume: null,
        increment: 0,
        bcType: 0,
        surfaceAreaCode: 0,
        surfaceArea: 1.0,
        hsNumber: 1,
      },
    ],
    sourceData: params?.sourceData ?? [
      {
        sourceType: 0,
        multiplier: 0,
        dmhl: 0,
        dmhr: 0,
        hsNumber: 1,
      },
    ],
    leftAdditionalOption: (params?.leftAdditionalOption ?? 0) as 0 | 1 | 2 | 3 | 4,
    leftAdditionalBoundary: params?.leftAdditionalBoundary,
    rightAdditionalOption: (params?.rightAdditionalOption ?? 0) as 0 | 1 | 2 | 3 | 4,
    rightAdditionalBoundary: params?.rightAdditionalBoundary,

    // Phase 2: Fuel Rod Options
    isFuelRod: params?.isFuelRod ?? false,
    refloodFlag: params?.refloodFlag ?? 0,
    boundaryVolumeIndicator: params?.boundaryVolumeIndicator ?? 0,
    maxAxialIntervals: params?.maxAxialIntervals ?? 2,
    gapConductance: params?.gapConductance,
    metalWaterReaction: params?.metalWaterReaction,
    claddingDeformation: params?.claddingDeformation,
    gapDeformationData: params?.gapDeformationData,
  };
}

// ============================================================================
// Main Form Component
// ============================================================================

interface HeatStructureFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const HeatStructureForm: React.FC<HeatStructureFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, setPropertyFormState, setFormSubmitHandler, nodes, edges, deleteHeatStructureEdge, createHeatStructureEdge, metadata } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler, nodes: state.nodes, edges: state.edges, deleteHeatStructureEdge: state.deleteHeatStructureEdge, createHeatStructureEdge: state.createHeatStructureEdge, metadata: state.metadata })));
  const [tabIndex, setTabIndex] = useState(0);

  // Stable digest: only recompute resolver/volumes when volume-relevant data changes
  const nodesDigest = useMemo(() =>
    nodes.map(n => `${n.id}:${n.data.componentId}:${n.data.componentType}:${n.data.componentName}:${(n.data.parameters as any)?.ncells || ''}`).join(','),
    [nodes]);

  // Create resolver for volume ID lookup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

  // Generate material options: Thermal Properties (우선) + 기본값 (충돌 없는 것만) + 특수 재료
  const materialOptions = useMemo(() => {
    const thermalProps = metadata.globalSettings?.thermalProperties || [];

    // Thermal Properties에서 정의된 재료 번호 Set
    const definedNumbers = new Set(thermalProps.map((tp) => tp.materialNumber));

    // Thermal Properties에서 옵션 생성 (우선순위 1)
    const thermalOptions = thermalProps.map((tp) => ({
      value: tp.materialNumber,
      label: `${tp.materialNumber} - ${tp.name}${tp.materialType !== 'TBL/FCTN' ? ` (${tp.materialType})` : ''}`,
    }));

    // 기본 재료 중 충돌하지 않는 것만 추가 (우선순위 2)
    const defaultOptions = DEFAULT_MATERIAL_OPTIONS
      .filter((opt) => !definedNumbers.has(opt.value))
      .map((opt) => ({ value: opt.value, label: `${opt.label} [기본값]` }));

    // 모든 옵션 병합 후 번호순 정렬
    const allOptions = [...thermalOptions, ...defaultOptions];
    allOptions.sort((a, b) => a.value - b.value);

    // 최종: 정렬된 재료 + 특수 재료 (-5, -6) + Custom
    return [
      ...allOptions,
      ...SPECIAL_MATERIAL_OPTIONS,
      { value: 'custom' as const, label: 'Other (Custom)' },
    ];
  }, [metadata.globalSettings?.thermalProperties]);

  // Detect connected edges for this Heat Structure (Phase 1.5)
  const connectedEdges = useMemo(() => {
    return edges.filter(
      (e) => e.data?.heatStructureNodeId === nodeId
    );
  }, [edges, nodeId]);

  // Check if left/right boundaries are connected via edge
  const { leftEdgeConnected, rightEdgeConnected, leftConnectedVolume, rightConnectedVolume } = useMemo(() => {
    let leftConnected = false;
    let rightConnected = false;
    let leftVolume: string | null = null;
    let rightVolume: string | null = null;

    for (const edge of connectedEdges) {
      if (edge.data?.heatStructureSide === 'left') {
        leftConnected = true;
        // Find the connected volume node
        const volumeNodeId = edge.source === nodeId ? edge.target : edge.source;
        const volumeNode = nodes.find(n => n.id === volumeNodeId);
        if (volumeNode) {
          leftVolume = volumeNode.data.componentName || volumeNode.data.componentId;
        }
      }
      if (edge.data?.heatStructureSide === 'right') {
        rightConnected = true;
        const volumeNodeId = edge.source === nodeId ? edge.target : edge.source;
        const volumeNode = nodes.find(n => n.id === volumeNodeId);
        if (volumeNode) {
          rightVolume = volumeNode.data.componentName || volumeNode.data.componentId;
        }
      }
    }

    return {
      leftEdgeConnected: leftConnected,
      rightEdgeConnected: rightConnected,
      leftConnectedVolume: leftVolume,
      rightConnectedVolume: rightVolume,
    };
  }, [connectedEdges, nodeId, nodes]);

  // Generate available volume references for boundary conditions
  const availableVolumes = useMemo(() => {
    const options: Array<{
      ref: VolumeReference;
      volumeId: string;
      label: string;
      componentName: string;
    }> = [];

    nodes.forEach((node) => {
      const compName = node.data.componentName || 'Unnamed';
      const compType = node.data.componentType;

      if (compType === 'snglvol' || compType === 'tmdpvol' || compType === 'branch') {
        // Single volume - use face 1 or 2 for heat structure BC
        for (const face of [1, 2] as const) {
          const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face };
          const volumeId = resolver.getVolumeIdFromReference(ref) || '';
          options.push({
            ref,
            volumeId,
            label: `${compName} (${volumeId})`,
            componentName: compName,
          });
        }
      } else if (compType === 'pipe') {
        const params = node.data.parameters as any;
        const ncells = params?.ncells || 1;

        for (let i = 1; i <= ncells; i++) {
          for (const face of [1, 2] as const) {
            const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face };
            const volumeId = resolver.getVolumeIdFromReference(ref) || '';
            options.push({
              ref,
              volumeId,
              label: `${compName} Cell ${i} (${volumeId})`,
              componentName: compName,
            });
          }
        }
      }
    });

    return options.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesDigest, resolver]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(heatStructureSchema),
    defaultValues: getDefaultFormValues(data),
  });

  // Field arrays for dynamic tables
  const {
    fields: meshFields,
    append: appendMesh,
    remove: removeMesh,
  } = useFieldArray({ control, name: 'meshIntervals' });

  const {
    fields: materialFields,
    append: appendMaterial,
    remove: removeMaterial,
  } = useFieldArray({ control, name: 'materialCompositions' });

  const {
    fields: sourceDistFields,
    append: appendSourceDist,
    remove: removeSourceDist,
  } = useFieldArray({ control, name: 'sourceDistributions' });

  const {
    fields: tempFields,
    append: appendTemp,
    remove: removeTemp,
  } = useFieldArray({ control, name: 'initialTemperatures' });

  const {
    fields: leftBcFields,
    append: appendLeftBc,
    remove: removeLeftBc,
  } = useFieldArray({ control, name: 'leftBoundaryConditions' });

  const {
    fields: rightBcFields,
    append: appendRightBc,
    remove: removeRightBc,
  } = useFieldArray({ control, name: 'rightBoundaryConditions' });

  const {
    fields: sourceDataFields,
    append: appendSourceData,
    remove: removeSourceData,
  } = useFieldArray({ control, name: 'sourceData' });

  const {
    fields: leftAddBcFields,
    append: appendLeftAddBc,
    remove: removeLeftAddBc,
  } = useFieldArray({ control, name: 'leftAdditionalBoundary' });

  const {
    fields: rightAddBcFields,
    append: appendRightAddBc,
    remove: removeRightAddBc,
  } = useFieldArray({ control, name: 'rightAdditionalBoundary' });

  // Phase 2: Gap Deformation Data
  const {
    fields: gapDeformationFields,
    append: appendGapDeformation,
    remove: removeGapDeformation,
  } = useFieldArray({ control, name: 'gapDeformationData' });

  const nh = watch('nh');
  const np = watch('np');
  const isFuelRod = watch('isFuelRod');

  // Reset form when node data changes
  useEffect(() => {
    reset(getDefaultFormValues(data));
  }, [nodeId, data, reset]);

  // Auto-sync last hsNumber to nh when nh changes (sequential expansion format)
  useEffect(() => {
    if (nh < 1) return;
    // Update last entry's hsNumber for each sequential expansion array
    const syncLastHsNumber = (fieldName: 'leftBoundaryConditions' | 'rightBoundaryConditions' | 'sourceData' | 'leftAdditionalBoundary' | 'rightAdditionalBoundary' | 'gapDeformationData') => {
      const values = getValues(fieldName) as Array<{ hsNumber: number }> | undefined;
      if (values && values.length > 0) {
        const lastIdx = values.length - 1;
        if (values[lastIdx].hsNumber < nh) {
          setValue(`${fieldName}.${lastIdx}.hsNumber` as any, nh, { shouldDirty: true });
        }
      }
    };
    syncLastHsNumber('leftBoundaryConditions');
    syncLastHsNumber('rightBoundaryConditions');
    syncLastHsNumber('sourceData');
    syncLastHsNumber('leftAdditionalBoundary');
    syncLastHsNumber('rightAdditionalBoundary');
    syncLastHsNumber('gapDeformationData');
  }, [nh, getValues, setValue]);

  // Submit handler
  const onSubmit = (formData: FormData) => {
    // Ensure boundaryVolume is always present (required but nullable)
    const leftBC = formData.leftBoundaryConditions.map((bc) => ({
      ...bc,
      boundaryVolume: bc.boundaryVolume ?? null,
    }));
    const rightBC = formData.rightBoundaryConditions.map((bc) => ({
      ...bc,
      boundaryVolume: bc.boundaryVolume ?? null,
    }));

    // Phase 1.5.1: BC 변경 감지 및 엣지 동기화
    const leftBoundaryVolume = formData.leftBoundaryConditions[0]?.boundaryVolume;
    const rightBoundaryVolume = formData.rightBoundaryConditions[0]?.boundaryVolume;

    // Left BC: boundaryVolume이 null이고 엣지가 연결된 경우 삭제
    if (leftEdgeConnected && leftBoundaryVolume === null) {
      deleteHeatStructureEdge(nodeId, 'left');
    }
    // Left BC: boundaryVolume이 추가되고 엣지가 없는 경우 생성
    if (!leftEdgeConnected && leftBoundaryVolume !== null) {
      createHeatStructureEdge(nodeId, 'left', leftBoundaryVolume);
    }

    // Right BC: 동일한 로직
    if (rightEdgeConnected && rightBoundaryVolume === null) {
      deleteHeatStructureEdge(nodeId, 'right');
    }
    if (!rightEdgeConnected && rightBoundaryVolume !== null) {
      createHeatStructureEdge(nodeId, 'right', rightBoundaryVolume);
    }

    const parameters: HeatStructureParameters = {
      name: formData.name,
      nh: formData.nh,
      np: formData.np,
      geometryType: formData.geometryType,
      ssInitFlag: formData.ssInitFlag,
      leftBoundaryCoord: formData.leftBoundaryCoord,
      meshLocationFlag: 0,
      meshFormatFlag: formData.meshFormatFlag,
      meshIntervals: formData.meshIntervals,
      materialCompositions: formData.materialCompositions,
      sourceDistributions: formData.sourceDistributions,
      initialTemperatures: formData.initialTemperatures,
      leftBoundaryConditions: leftBC,
      rightBoundaryConditions: rightBC,
      sourceData: formData.sourceData,
      leftAdditionalOption: formData.leftAdditionalOption,
      leftAdditionalBoundary: formData.leftAdditionalBoundary,
      rightAdditionalOption: formData.rightAdditionalOption,
      rightAdditionalBoundary: formData.rightAdditionalBoundary,

      // Phase 2: Fuel Rod Options
      isFuelRod: formData.isFuelRod,
      refloodFlag: formData.refloodFlag,
      boundaryVolumeIndicator: formData.boundaryVolumeIndicator,
      maxAxialIntervals: formData.maxAxialIntervals,
      gapConductance: formData.gapConductance as HsGapConductance | undefined,
      metalWaterReaction: formData.metalWaterReaction as HsMetalWaterReaction | undefined,
      claddingDeformation: formData.claddingDeformation as HsCladdingDeformation | undefined,
      gapDeformationData: formData.gapDeformationData as HsGapDeformation[] | undefined,
    };

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      parameters,
      status: 'valid',
      errors: [],
      warnings: [],
    });
  };

  // Register form submit handler
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
    <Box component="form" onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Heat Structure Parameters
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Configure thermal structure properties
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab label="Basic" />
        <Tab label="Mesh" />
        <Tab label="Materials" />
        <Tab label="Source Dist" />
        <Tab label="Temperature" />
        <Tab label="Left BC" />
        <Tab label="Right BC" />
        <Tab label="Source Data" />
        <Tab label="Left Add BC" />
        <Tab label="Right Add BC" />
        <Tab label="Fuel Rod" disabled={!isFuelRod} />
      </Tabs>

      {/* Tab 0: Basic */}
      <TabPanel value={tabIndex} index={0}>
        <Grid container spacing={1}>
          {/* Name */}
          <Grid item xs={12}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  fullWidth
                  size="small"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />
          </Grid>

          {/* Component ID */}
          <Grid item xs={12}>
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
          </Grid>

          {/* nh - Number of axial heat structures */}
          <Grid item xs={6}>
            <Controller
              name="nh"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="nh (Axial nodes)"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1, max: 99 }}
                  error={!!errors.nh}
                  helperText={errors.nh?.message || '1-99'}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                />
              )}
            />
          </Grid>

          {/* np - Number of radial mesh points */}
          <Grid item xs={6}>
            <Controller
              name="np"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="np (Radial points)"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 2, max: 99 }}
                  error={!!errors.np}
                  helperText={errors.np?.message || '2-99'}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                />
              )}
            />
          </Grid>

          {/* Geometry Type */}
          <Grid item xs={6}>
            <Controller
              name="geometryType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Geometry Type"
                  select
                  fullWidth
                  size="small"
                >
                  <MenuItem value={1}>Rectangular</MenuItem>
                  <MenuItem value={2}>Cylindrical</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          {/* SS Init Flag */}
          <Grid item xs={6}>
            <Controller
              name="ssInitFlag"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="SS Init Flag"
                  select
                  fullWidth
                  size="small"
                >
                  <MenuItem value={0}>Use input temps</MenuItem>
                  <MenuItem value={1}>Calculate SS temps</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          {/* Left Boundary Coordinate */}
          <Grid item xs={12}>
            <Controller
              name="leftBoundaryCoord"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Left Boundary Coordinate"
                  fullWidth
                  size="small"
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                  inputProps={numberInputProps}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
          <Typography variant="caption">
            Total mesh intervals must equal np-1 = {np - 1}
          </Typography>
        </Alert>

        <Divider sx={{ my: 1 }} />

        {/* Phase 2: Fuel Rod Options */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Phase 2: Fuel Rod Options
        </Typography>

        {/* Fuel Rod Toggle */}
        <Controller
          name="isFuelRod"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label="Fuel Rod Mode (연료봉 모드)"
            />
          )}
        />

        {/* Reflood Options - visible when isFuelRod=true */}
        {isFuelRod && (
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 1 }}>
                <Typography variant="caption">
                  Fuel Rod Mode enables Reflood calculation and Gap/MWR/Cladding models.
                  Configure fuel rod specific data in the "Fuel Rod" tab.
                </Typography>
              </Alert>
            </Grid>

            {/* Reflood Flag (W6) */}
            <Grid item xs={4}>
              <Controller
                name="refloodFlag"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Reflood Flag (W6)"
                    fullWidth
                    size="small"
                    type="number"
                    helperText="0=none, 1/2=auto, trip#"
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                )}
              />
            </Grid>

            {/* Boundary Volume Indicator (W7) */}
            <Grid item xs={4}>
              <Controller
                name="boundaryVolumeIndicator"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Boundary Vol Ind (W7)"
                    select
                    fullWidth
                    size="small"
                    helperText="0=left, 1=right"
                  >
                    <MenuItem value={0}>0 - Left</MenuItem>
                    <MenuItem value={1}>1 - Right</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            {/* Max Axial Intervals (W8) */}
            <Grid item xs={4}>
              <Controller
                name="maxAxialIntervals"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Max Axial Intervals (W8)"
                    select
                    fullWidth
                    size="small"
                    helperText="Reflood subdivision"
                  >
                    <MenuItem value={2}>2</MenuItem>
                    <MenuItem value={4}>4</MenuItem>
                    <MenuItem value={8}>8</MenuItem>
                    <MenuItem value={16}>16</MenuItem>
                    <MenuItem value={32}>32</MenuItem>
                    <MenuItem value={64}>64</MenuItem>
                    <MenuItem value={128}>128</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Tab 1: Mesh */}
      <TabPanel value={tabIndex} index={1}>
        {/* Card 1CCCG100: Mesh Location and Format Flags */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Mesh Flags (Card 1CCCG100)
        </Typography>
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid item xs={6}>
            <Controller
              name="meshFormatFlag"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  size="small"
                  label="Mesh Format"
                  helperText="W2: Mesh coordinate format"
                >
                  <MenuItem value={1}>1 - Intervals + Right Coordinate</MenuItem>
                  <MenuItem value={2}>2 - Sequential Expansion</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              value={0}
              disabled
              fullWidth
              size="small"
              label="Mesh Location Flag"
              helperText="W1: Always 0 (geometry in this input)"
            />
          </Grid>
        </Grid>

        {/* Cards 1CCCG101-199: Mesh Intervals */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Mesh Intervals (Cards 1CCCG101-199)
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Intervals</TableCell>
                <TableCell>Right Coord (m)</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meshFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`meshIntervals.${index}.intervals`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: 99 }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`meshIntervals.${index}.rightCoord`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 120 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeMesh(index)}
                      disabled={meshFields.length <= 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => appendMesh({ intervals: 1, rightCoord: 0 })}
        >
          Add Interval
        </Button>
      </TabPanel>

      {/* Tab 2: Materials */}
      <TabPanel value={tabIndex} index={2}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Material Compositions (Cards 1CCCG201-299)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            Select predefined materials from SMART reference or enter custom material numbers.
            Positive numbers: general materials, Negative numbers: Gap models (Phase 2).
          </Typography>
        </Alert>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Material</TableCell>
                <TableCell>Interval (1~{np - 1})</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materialFields.map((field, index) => {
                const currentValue = watch(`materialCompositions.${index}.materialNumber`);
                const isPresetMaterial = materialOptions.some(
                  (opt) => opt.value !== 'custom' && opt.value === currentValue
                );
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                        name={`materialCompositions.${index}.materialNumber`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              select
                              size="small"
                              value={isPresetMaterial ? controllerField.value : 'custom'}
                              onChange={(e) => {
                                const selected = e.target.value;
                                if (selected === 'custom') {
                                  controllerField.onChange(100);
                                } else {
                                  controllerField.onChange(Number(selected));
                                }
                              }}
                              sx={{ width: 220 }}
                            >
                              {materialOptions.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            {!isPresetMaterial && (
                              <TextField
                                size="small"
                                type="number"
                                value={controllerField.value}
                                onChange={(e) =>
                                  controllerField.onChange(parseInt(e.target.value) || 1)
                                }
                                placeholder="Material #"
                                sx={{ width: 100 }}
                              />
                            )}
                          </Box>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`materialCompositions.${index}.interval`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            inputProps={{ min: 1, max: np - 1 }}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            sx={{ width: 80 }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeMaterial(index)}
                        disabled={materialFields.length <= 1}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => appendMaterial({ materialNumber: 3, interval: np - 1 })}
        >
          Add Material
        </Button>
      </TabPanel>

      {/* Tab 3: Source Distribution */}
      <TabPanel value={tabIndex} index={3}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Source Distribution (Cards 1CCCG301-399)
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source Value</TableCell>
                <TableCell>Interval</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sourceDistFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`sourceDistributions.${index}.sourceValue`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 100 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`sourceDistributions.${index}.interval`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1 }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeSourceDist(index)}
                      disabled={sourceDistFields.length <= 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => appendSourceDist({ sourceValue: 0, interval: np - 1 })}
        >
          Add Source
        </Button>
      </TabPanel>

      {/* Tab 4: Initial Temperature */}
      <TabPanel value={tabIndex} index={4}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Initial Temperatures (Cards 1CCCG401-499)
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Temperature (K)</TableCell>
                <TableCell>Mesh Point</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tempFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`initialTemperatures.${index}.temperature`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 120 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`initialTemperatures.${index}.meshPoint`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: np }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeTemp(index)}
                      disabled={tempFields.length <= 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => appendTemp({ temperature: 560, meshPoint: np })}
        >
          Add Temperature
        </Button>
      </TabPanel>

      {/* Tab 5: Left BC */}
      <TabPanel value={tabIndex} index={5}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Left Boundary Conditions (Cards 1CCCG501-599)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            {nh} heat structure{nh > 1 ? 's' : ''} require boundary conditions.
            For Convective BC (101), select a boundary volume.
          </Typography>
        </Alert>
        {leftEdgeConnected && (
          <Alert severity="success" sx={{ mb: 1 }}>
            <Typography variant="caption">
              엣지로 연결됨: <strong>{leftConnectedVolume}</strong>. 첫 번째 BC가 자동 설정되었습니다.
            </Typography>
          </Alert>
        )}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS #</TableCell>
                <TableCell>BC Type</TableCell>
                <TableCell>Boundary Volume</TableCell>
                <TableCell>Increment</TableCell>
                <TableCell>Area Code</TableCell>
                <TableCell>Surface Area</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leftBcFields.map((field, index) => {
                const bcType = watch(`leftBoundaryConditions.${index}.bcType`);
                const currentVolRef = watch(`leftBoundaryConditions.${index}.boundaryVolume`);
                const selectedOption = availableVolumes.find(
                  (opt) =>
                    currentVolRef &&
                    opt.ref.nodeId === currentVolRef.nodeId &&
                    opt.ref.volumeNum === currentVolRef.volumeNum &&
                    opt.ref.face === currentVolRef.face
                );
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.hsNumber`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            inputProps={{ min: 1, max: nh }}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            sx={{ width: 60 }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.bcType`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" select sx={{ width: 150 }}>
                            <MenuItem value={0}>0 - Insulated</MenuItem>
                            <MenuItem value={101}>101 - Convective</MenuItem>
                            <MenuItem value={110}>110 - Vert Bundle</MenuItem>
                            <MenuItem value={111}>111 - Vert Bundle+XF</MenuItem>
                            <MenuItem value={114}>114 - Helical SG Tube</MenuItem>
                            <MenuItem value={130}>130 - Flat Plate</MenuItem>
                            <MenuItem value={134}>134 - Horiz Bundle</MenuItem>
                            <MenuItem value={135}>135 - Helical SG Shell</MenuItem>
                            <MenuItem value={160}>160 - Zukauskas Stag</MenuItem>
                            <MenuItem value={1000}>1000 - Surf Temp</MenuItem>
                          </TextField>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.boundaryVolume`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <Autocomplete
                            size="small"
                            options={availableVolumes}
                            getOptionLabel={(opt) => opt.label}
                            value={selectedOption || null}
                            onChange={(_, newValue) => {
                              controllerField.onChange(newValue ? newValue.ref : null);
                            }}
                            disabled={bcType === 0}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder={bcType === 0 ? 'N/A' : 'Select volume'}
                                size="small"
                              />
                            )}
                            sx={{ width: 180 }}
                            isOptionEqualToValue={(option, value) =>
                              option.ref.nodeId === value.ref.nodeId &&
                              option.ref.volumeNum === value.ref.volumeNum &&
                              option.ref.face === value.ref.face
                            }
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.increment`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            sx={{ width: 80 }}
                            helperText="±10000"
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.surfaceAreaCode`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" select sx={{ width: 80 }}>
                            <MenuItem value={0}>Direct</MenuItem>
                            <MenuItem value={1}>Factor</MenuItem>
                          </TextField>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`leftBoundaryConditions.${index}.surfaceArea`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                            inputProps={numberInputProps}
                            sx={{ width: 100 }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeLeftBc(index)}
                        disabled={leftBcFields.length <= 1}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendLeftBc({
              boundaryVolume: null,
              increment: 0,
              bcType: 0,
              surfaceAreaCode: 0,
              surfaceArea: 1.0,
              hsNumber: leftBcFields.length + 1,
            })
          }
        >
          Add Left BC
        </Button>
      </TabPanel>

      {/* Tab 6: Right BC */}
      <TabPanel value={tabIndex} index={6}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Right Boundary Conditions (Cards 1CCCG601-699)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            {nh} heat structure{nh > 1 ? 's' : ''} require boundary conditions.
            For Convective BC (101), select a boundary volume.
          </Typography>
        </Alert>
        {rightEdgeConnected && (
          <Alert severity="success" sx={{ mb: 1 }}>
            <Typography variant="caption">
              엣지로 연결됨: <strong>{rightConnectedVolume}</strong>. 첫 번째 BC가 자동 설정되었습니다.
            </Typography>
          </Alert>
        )}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS #</TableCell>
                <TableCell>BC Type</TableCell>
                <TableCell>Boundary Volume</TableCell>
                <TableCell>Increment</TableCell>
                <TableCell>Area Code</TableCell>
                <TableCell>Surface Area</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rightBcFields.map((field, index) => {
                const bcType = watch(`rightBoundaryConditions.${index}.bcType`);
                const currentVolRef = watch(`rightBoundaryConditions.${index}.boundaryVolume`);
                const selectedOption = availableVolumes.find(
                  (opt) =>
                    currentVolRef &&
                    opt.ref.nodeId === currentVolRef.nodeId &&
                    opt.ref.volumeNum === currentVolRef.volumeNum &&
                    opt.ref.face === currentVolRef.face
                );
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.hsNumber`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            inputProps={{ min: 1, max: nh }}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            sx={{ width: 60 }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.bcType`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" select sx={{ width: 150 }}>
                            <MenuItem value={0}>0 - Insulated</MenuItem>
                            <MenuItem value={101}>101 - Convective</MenuItem>
                            <MenuItem value={110}>110 - Vert Bundle</MenuItem>
                            <MenuItem value={111}>111 - Vert Bundle+XF</MenuItem>
                            <MenuItem value={114}>114 - Helical SG Tube</MenuItem>
                            <MenuItem value={130}>130 - Flat Plate</MenuItem>
                            <MenuItem value={134}>134 - Horiz Bundle</MenuItem>
                            <MenuItem value={135}>135 - Helical SG Shell</MenuItem>
                            <MenuItem value={160}>160 - Zukauskas Stag</MenuItem>
                            <MenuItem value={1000}>1000 - Surf Temp</MenuItem>
                          </TextField>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.boundaryVolume`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <Autocomplete
                            size="small"
                            options={availableVolumes}
                            getOptionLabel={(opt) => opt.label}
                            value={selectedOption || null}
                            onChange={(_, newValue) => {
                              controllerField.onChange(newValue ? newValue.ref : null);
                            }}
                            disabled={bcType === 0}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder={bcType === 0 ? 'N/A' : 'Select volume'}
                                size="small"
                              />
                            )}
                            sx={{ width: 180 }}
                            isOptionEqualToValue={(option, value) =>
                              option.ref.nodeId === value.ref.nodeId &&
                              option.ref.volumeNum === value.ref.volumeNum &&
                              option.ref.face === value.ref.face
                            }
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.increment`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            sx={{ width: 80 }}
                            helperText="±10000"
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.surfaceAreaCode`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" select sx={{ width: 80 }}>
                            <MenuItem value={0}>Direct</MenuItem>
                            <MenuItem value={1}>Factor</MenuItem>
                          </TextField>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`rightBoundaryConditions.${index}.surfaceArea`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            size="small"
                            type="number"
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                            inputProps={numberInputProps}
                            sx={{ width: 100 }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeRightBc(index)}
                        disabled={rightBcFields.length <= 1}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendRightBc({
              boundaryVolume: null,
              increment: 0,
              bcType: 0,
              surfaceAreaCode: 0,
              surfaceArea: 1.0,
              hsNumber: rightBcFields.length + 1,
            })
          }
        >
          Add Right BC
        </Button>
      </TabPanel>

      {/* Tab 7: Source Data */}
      <TabPanel value={tabIndex} index={7}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Source Data (Cards 1CCCG701-799)
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS #</TableCell>
                <TableCell>Source Type</TableCell>
                <TableCell>Multiplier</TableCell>
                <TableCell>DMHL</TableCell>
                <TableCell>DMHR</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sourceDataFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`sourceData.${index}.hsNumber`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: nh }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`sourceData.${index}.sourceType`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          sx={{ width: 80 }}
                          helperText="0=none"
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`sourceData.${index}.multiplier`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`sourceData.${index}.dmhl`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`sourceData.${index}.dmhr`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeSourceData(index)}
                      disabled={sourceDataFields.length <= 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendSourceData({
              sourceType: 0,
              multiplier: 0,
              dmhl: 0,
              dmhr: 0,
              hsNumber: sourceDataFields.length + 1,
            })
          }
        >
          Add Source Data
        </Button>
      </TabPanel>

      {/* Tab 8: Left Additional BC (12-word format) */}
      <TabPanel value={tabIndex} index={8}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Additional Left Boundary (Cards 1CCCG800-899)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            12-word format for CHF correlation data. Includes NC length, P/D ratio, and fouling factor.
          </Typography>
        </Alert>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS#</TableCell>
                <TableCell>HTHD (m)</TableCell>
                <TableCell>HLF (m)</TableCell>
                <TableCell>HLR (m)</TableCell>
                <TableCell>GSLF (m)</TableCell>
                <TableCell>GSLR (m)</TableCell>
                <TableCell>GLCF</TableCell>
                <TableCell>GLCR</TableCell>
                <TableCell>LBF</TableCell>
                <TableCell>NC Len</TableCell>
                <TableCell>P/D</TableCell>
                <TableCell>Foul</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leftAddBcFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.hsNumber`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: nh }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.heatTransferDiameter`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.heatedLengthForward`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.heatedLengthReverse`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.gridSpacerLengthFwd`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.gridSpacerLengthRev`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.gridLossCoeffFwd`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.gridLossCoeffRev`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.localBoilingFactor`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.naturalCirculationLength`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.pitchToDiameterRatio`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`leftAdditionalBoundary.${index}.foulingFactor`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeLeftAddBc(index)}
                      disabled={leftAddBcFields.length <= 0}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendLeftAddBc({
              heatTransferDiameter: 0.0,
              heatedLengthForward: 10.0,
              heatedLengthReverse: 10.0,
              gridSpacerLengthFwd: 0.0,
              gridSpacerLengthRev: 0.0,
              gridLossCoeffFwd: 0.0,
              gridLossCoeffRev: 0.0,
              localBoilingFactor: 1.0,
              naturalCirculationLength: 0.0,
              pitchToDiameterRatio: 0.0,
              foulingFactor: 0.0,
              hsNumber: leftAddBcFields.length + 1,
            })
          }
        >
          Add Left Additional BC
        </Button>
      </TabPanel>

      {/* Tab 9: Right Additional BC (12-word format) */}
      <TabPanel value={tabIndex} index={9}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Additional Right Boundary (Cards 1CCCG900-999)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            12-word format for CHF correlation data. Includes NC length, P/D ratio, and fouling factor.
          </Typography>
        </Alert>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS#</TableCell>
                <TableCell>HTHD (m)</TableCell>
                <TableCell>HLF (m)</TableCell>
                <TableCell>HLR (m)</TableCell>
                <TableCell>GSLF (m)</TableCell>
                <TableCell>GSLR (m)</TableCell>
                <TableCell>GLCF</TableCell>
                <TableCell>GLCR</TableCell>
                <TableCell>LBF</TableCell>
                <TableCell>NC Len</TableCell>
                <TableCell>P/D</TableCell>
                <TableCell>Foul</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rightAddBcFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.hsNumber`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: nh }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.heatTransferDiameter`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.heatedLengthForward`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.heatedLengthReverse`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 80 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.gridSpacerLengthFwd`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.gridSpacerLengthRev`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.gridLossCoeffFwd`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.gridLossCoeffRev`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.localBoilingFactor`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.naturalCirculationLength`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 70 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.pitchToDiameterRatio`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`rightAdditionalBoundary.${index}.foulingFactor`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? 0}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeRightAddBc(index)}
                      disabled={rightAddBcFields.length <= 0}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendRightAddBc({
              heatTransferDiameter: 0.0,
              heatedLengthForward: 10.0,
              heatedLengthReverse: 10.0,
              gridSpacerLengthFwd: 0.0,
              gridSpacerLengthRev: 0.0,
              gridLossCoeffFwd: 0.0,
              gridLossCoeffRev: 0.0,
              localBoilingFactor: 1.0,
              naturalCirculationLength: 0.0,
              pitchToDiameterRatio: 0.0,
              foulingFactor: 0.0,
              hsNumber: rightAddBcFields.length + 1,
            })
          }
        >
          Add Right Additional BC
        </Button>
      </TabPanel>

      {/* Tab 10: Fuel Rod (Phase 2) */}
      <TabPanel value={tabIndex} index={10}>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            Fuel Rod specific data. Enable "Fuel Rod Mode" in Basic tab to use these options.
          </Typography>
        </Alert>

        {/* Card 1CCCG001: Gap Conductance */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Gap Conductance (Card 1CCCG001)
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <Controller
                name="gapConductance.initialGapPressure"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Initial Gap Pressure"
                    fullWidth
                    size="small"
                    type="number"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
                    }}
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                    inputProps={numberInputProps}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="gapConductance.referenceVolume"
                control={control}
                render={({ field: controllerField }) => {
                  const currentVolRef = controllerField.value;
                  const selectedOption = availableVolumes.find(
                    (opt) =>
                      currentVolRef &&
                      opt.ref.nodeId === currentVolRef.nodeId &&
                      opt.ref.volumeNum === currentVolRef.volumeNum &&
                      opt.ref.face === currentVolRef.face
                  );
                  return (
                    <Autocomplete
                      size="small"
                      options={availableVolumes}
                      getOptionLabel={(opt) => opt.label}
                      value={selectedOption || null}
                      onChange={(_, newValue) => {
                        controllerField.onChange(newValue ? newValue.ref : null);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Reference Volume"
                          placeholder="Select volume"
                          size="small"
                        />
                      )}
                      isOptionEqualToValue={(option, value) =>
                        option.ref.nodeId === value.ref.nodeId &&
                        option.ref.volumeNum === value.ref.volumeNum &&
                        option.ref.face === value.ref.face
                      }
                    />
                  );
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="gapConductance.conductanceMultiplier"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 1.0}
                    label="Conductance Multiplier"
                    fullWidth
                    size="small"
                    type="number"
                    helperText="Default: 1.0"
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                    inputProps={numberInputProps}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Card 1CCCG003: Metal-Water Reaction */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Metal-Water Reaction (Card 1CCCG003)
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Controller
                name="metalWaterReaction.initialOxideThickness"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 0}
                    label="Initial Oxide Thickness"
                    fullWidth
                    size="small"
                    type="number"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">m</InputAdornment>,
                    }}
                    helperText="Cladding outer surface"
                    onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                    onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                    inputProps={numberInputProps}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Card 1CCCG004: Cladding Deformation */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Cladding Deformation (Card 1CCCG004)
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Controller
                name="claddingDeformation.formLossFlag"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? 0}
                    label="Form Loss Flag"
                    select
                    fullWidth
                    size="small"
                    helperText="Form loss calculation"
                  >
                    <MenuItem value={0}>0 - No calculation</MenuItem>
                    <MenuItem value={1}>1 - Calculate form loss</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Cards 1CCCG011-099: Gap Deformation Data */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Gap Deformation Data (Cards 1CCCG011-099)
        </Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="caption">
            One entry per axial node (nh = {nh}). Contains fuel/cladding surface properties.
          </Typography>
        </Alert>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>HS#</TableCell>
                <TableCell>Fuel Roughness (m)</TableCell>
                <TableCell>Clad Roughness (m)</TableCell>
                <TableCell>Fuel Swelling (m)</TableCell>
                <TableCell>Clad Creepdown (m)</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gapDeformationFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`gapDeformationData.${index}.hsNumber`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          inputProps={{ min: 1, max: nh }}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          sx={{ width: 60 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`gapDeformationData.${index}.fuelSurfaceRoughness`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 100 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`gapDeformationData.${index}.cladSurfaceRoughness`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 100 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`gapDeformationData.${index}.fuelSwelling`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 100 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`gapDeformationData.${index}.cladCreepdown`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          type="number"
                          onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                          onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
                          inputProps={numberInputProps}
                          sx={{ width: 100 }}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeGapDeformation(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            appendGapDeformation({
              fuelSurfaceRoughness: 1e-6,
              cladSurfaceRoughness: 2e-6,
              fuelSwelling: 0,
              cladCreepdown: 0,
              hsNumber: gapDeformationFields.length + 1,
            })
          }
        >
          Add Gap Deformation
        </Button>
      </TabPanel>

    </Box>
  );
};

export default HeatStructureForm;
