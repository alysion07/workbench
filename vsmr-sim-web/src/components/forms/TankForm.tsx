/**
 * TANK Parameter Form
 * Branch variant with liquid level tracking (CCC0400, CCC0401-0499)
 * VolumeReference-based connection (syncs with componentId changes)
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Divider,
  Alert,
  Chip,
  Grid,
  IconButton,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, TankParameters, BranchJunction, VolumeLevelPair } from '@/types/mars';
import { handleNumberChange, handleNumberBlur } from '@/utils/inputHelpers';
import { NumericTextField } from '@/components/common/NumericTextField';
import ComponentIdField from './ComponentIdField';

/**
 * Validate Branch/Tank geometry according to MARS rules:
 * - At least 2 of {area, length, volume} must be non-zero
 * - If all 3 non-zero, check consistency: V ≈ A×L
 */
function validateTankGeometry(
  area: number | undefined,
  length: number | undefined,
  volume: number | undefined
): { valid: boolean; message: string } {
  const a = area ?? 0;
  const l = length ?? 0;
  const v = volume ?? 0;
  const nonZero = [a, l, v].filter(x => x > 0).length;
  if (nonZero < 2) {
    return { valid: false, message: 'At least 2 of area/length/volume must be non-zero' };
  }
  if (nonZero === 3) {
    const computed = a * l;
    const relError = Math.abs(computed - v) / Math.max(v, 1e-10);
    if (relError > 0.001) {
      return { valid: false, message: `Volume ≠ Area × Length (${v.toFixed(4)} ≠ ${computed.toFixed(4)})` };
    }
  }
  return { valid: true, message: '' };
}

// ============================================================================
// Zod Schema
// ============================================================================

const volumeRefSchema = z.object({
  nodeId: z.string(),
  volumeNum: z.number(),
  face: z.number(),
}).nullable().optional();

const junctionSchema = z.object({
  junctionNumber: z.number().min(1).max(9),
  direction: z.enum(['inlet', 'outlet']),
  branchFace: z.number().min(1).max(6),
  from: volumeRefSchema,
  to: volumeRefSchema,
  area: z.number().min(0),
  fwdLoss: z.number().min(0),
  revLoss: z.number().min(0),
  jefvcahs: z.string().optional(),
  dischargeCoefficient: z.number().optional(),
  thermalConstant: z.number().optional(),
  initialLiquidFlow: z.number().optional(),
  initialVaporFlow: z.number().optional(),
});

const volumeLevelPairSchema = z.object({
  volume: z.number().min(0, 'Volume must be ≥ 0'),
  level: z.number().min(0, 'Level must be ≥ 0'),
});

const tankSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Max 20 chars'),
  componentId: z.string().regex(/^\d{7}$/, 'Must be 7 digits'),

  // Geometry
  njuns: z.number().min(0).max(9),
  initialConditionControl: z.number().optional(),
  area: z.number().min(0).optional(),
  length: z.number().min(0),
  volume: z.number().min(0),
  azAngle: z.number().optional(),
  incAngle: z.number(),
  dz: z.number(),
  wallRoughness: z.number().min(0).optional(),
  hydraulicDiameter: z.number().min(0),
  tlpvbfe: z.string().optional(),

  // Initial Conditions
  ebt: z.enum(['001', '002', '003', '004', '005']),
  pressure: z.number().nonnegative('Must be non-negative').optional(),
  temperature: z.number().positive().optional(),
  quality: z.number().min(0).max(1).optional(),

  // Junctions
  junctions: z.array(junctionSchema),

  // Tank-specific
  initialLiquidLevel: z.number().min(0, 'Must be ≥ 0'),
  volumeLevelCurve: z.array(volumeLevelPairSchema).min(2, 'At least 2 pairs required'),
}).refine((data) => {
  return data.njuns === data.junctions.length;
}, {
  message: 'Number of junctions (njuns) must match actual junction count',
  path: ['njuns'],
});

type FormData = z.infer<typeof tankSchema>;

// ============================================================================
// Component
// ============================================================================

interface TankFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const TankForm: React.FC<TankFormProps> = ({ nodeId, data }) => {
  const {
    updateNodeData,
    setPropertyFormState,
    setFormSubmitHandler,
  } = useStore(useShallow(state => ({
    updateNodeData: state.updateNodeData,
    setPropertyFormState: state.setPropertyFormState,
    setFormSubmitHandler: state.setFormSubmitHandler,
  })));

  const params = data.parameters as Partial<TankParameters>;

  const defaultJunctions: z.infer<typeof junctionSchema>[] = params?.junctions?.length
    ? params.junctions.map(j => ({
        junctionNumber: j.junctionNumber,
        direction: j.direction,
        branchFace: j.branchFace ?? 1,
        from: j.from ?? null,
        to: j.to ?? null,
        area: j.area ?? 0,
        fwdLoss: j.fwdLoss ?? 0,
        revLoss: j.revLoss ?? 0,
        jefvcahs: j.jefvcahs ?? '00000000',
        dischargeCoefficient: j.dischargeCoefficient,
        thermalConstant: j.thermalConstant,
        initialLiquidFlow: j.initialLiquidFlow ?? 0,
        initialVaporFlow: j.initialVaporFlow ?? 0,
      }))
    : [
        { junctionNumber: 1, direction: 'inlet' as const, branchFace: 1 as number, from: null, to: null, area: 0, fwdLoss: 0, revLoss: 0, jefvcahs: '00000000', initialLiquidFlow: 0, initialVaporFlow: 0 },
        { junctionNumber: 2, direction: 'outlet' as const, branchFace: 2 as number, from: null, to: null, area: 0, fwdLoss: 0, revLoss: 0, jefvcahs: '00000000', initialLiquidFlow: 0, initialVaporFlow: 0 },
      ];

  const defaultVolumeLevelCurve = params?.volumeLevelCurve?.length
    ? params.volumeLevelCurve
    : [{ volume: 0, level: 0 }, { volume: 1, level: 1 }];

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(tankSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: params?.njuns ?? 2,
      initialConditionControl: params?.initialConditionControl ?? 0,
      area: params?.area ?? 0,
      length: params?.length ?? 1.0,
      volume: params?.volume ?? 1.0,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 0,
      dz: params?.dz ?? 0,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.1,
      tlpvbfe: params?.tlpvbfe ?? '0000000',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 15.074e6,
      temperature: params?.temperature ?? 594.05,
      quality: params?.quality,
      junctions: defaultJunctions,
      initialLiquidLevel: params?.initialLiquidLevel ?? 0.5,
      volumeLevelCurve: defaultVolumeLevelCurve,
    },
  });

  const { fields: junctionFields, append: appendJunction, remove: removeJunction } = useFieldArray({
    control,
    name: 'junctions',
  });

  const { fields: curveFields, append: appendCurve, remove: removeCurve } = useFieldArray({
    control,
    name: 'volumeLevelCurve',
  });

  const watchedEbt = watch('ebt');
  const watchedArea = watch('area');
  const watchedLength = watch('length');
  const watchedVolume = watch('volume');
  // Geometry validation
  const geoCheck = useMemo(
    () => validateTankGeometry(watchedArea, watchedLength, watchedVolume),
    [watchedArea, watchedLength, watchedVolume],
  );

  // ============================================================================
  // onSubmit
  // ============================================================================

  const onSubmit: SubmitHandler<FormData> = (formData) => {
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

    if (!formData.name) validationErrors.push({ level: 'error', message: 'Name is required' });
    if (formData.ebt !== '001' && (formData.pressure === undefined || formData.pressure <= 0)) validationErrors.push({ level: 'error', message: 'Pressure must be positive' });
    if (!geoCheck.valid) validationErrors.push({ level: 'error', message: geoCheck.message });

    // Tank-specific validation
    if (formData.initialLiquidLevel < 0) {
      validationErrors.push({ level: 'error', message: 'Initial liquid level must be ≥ 0' });
    }
    if (formData.volumeLevelCurve.length < 2) {
      validationErrors.push({ level: 'error', message: 'At least 2 volume-level pairs required' });
    } else {
      // Check ascending level
      for (let i = 1; i < formData.volumeLevelCurve.length; i++) {
        if (formData.volumeLevelCurve[i].level <= formData.volumeLevelCurve[i - 1].level) {
          validationWarnings.push({ level: 'warning', message: 'Volume-level curve should be in ascending level order' });
          break;
        }
      }
      // Check level range
      const levels = formData.volumeLevelCurve.map(p => p.level);
      const maxLevel = Math.max(...levels);
      const minLevel = Math.min(...levels);
      if (formData.initialLiquidLevel > maxLevel) {
        validationWarnings.push({ level: 'warning', message: 'Initial level exceeds max level in curve' });
      }
      if (formData.initialLiquidLevel < minLevel) {
        validationWarnings.push({ level: 'warning', message: 'Initial level below min level in curve' });
      }
    }

    const status = validationErrors.length > 0 ? 'error' : validationWarnings.length > 0 ? 'incomplete' : 'valid';

    const parameters: Partial<TankParameters> = {
      name: formData.name,
      njuns: formData.junctions.length,
      initialConditionControl: formData.initialConditionControl as 0 | 1,
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
      junctions: formData.junctions as BranchJunction[],
      initialLiquidLevel: formData.initialLiquidLevel,
      volumeLevelCurve: formData.volumeLevelCurve as VolumeLevelPair[],
    };

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      parameters,
      status,
      errors: validationErrors,
      warnings: validationWarnings,
    });

    // Edge sync is handled by updateNodeData → syncEdgesFromParameters (connectionSync.ts)
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

  // Update form state in store
  useEffect(() => {
    setPropertyFormState({ isDirty, isValid });
  }, [isDirty, isValid, setPropertyFormState]);

  // Reset form when node changes
  useEffect(() => {
    const p = data.parameters as Partial<TankParameters>;
    const djuns = p?.junctions?.length
      ? p.junctions.map(j => ({
          junctionNumber: j.junctionNumber,
          direction: j.direction,
          branchFace: j.branchFace ?? 1,
          from: j.from ?? null,
          to: j.to ?? null,
          area: j.area ?? 0,
          fwdLoss: j.fwdLoss ?? 0,
          revLoss: j.revLoss ?? 0,
          jefvcahs: j.jefvcahs ?? '00000000',
          dischargeCoefficient: j.dischargeCoefficient,
          thermalConstant: j.thermalConstant,
          initialLiquidFlow: j.initialLiquidFlow ?? 0,
          initialVaporFlow: j.initialVaporFlow ?? 0,
        }))
      : defaultJunctions;
    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      njuns: p?.njuns ?? 2,
      initialConditionControl: p?.initialConditionControl ?? 0,
      area: p?.area ?? 0,
      length: p?.length ?? 1.0,
      volume: p?.volume ?? 1.0,
      azAngle: p?.azAngle ?? 0,
      incAngle: p?.incAngle ?? 0,
      dz: p?.dz ?? 0,
      wallRoughness: p?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: p?.hydraulicDiameter ?? 0.1,
      tlpvbfe: p?.tlpvbfe ?? '0000000',
      ebt: p?.ebt ?? '003',
      pressure: p?.pressure ?? 15.074e6,
      temperature: p?.temperature ?? 594.05,
      quality: p?.quality,
      junctions: djuns,
      initialLiquidLevel: p?.initialLiquidLevel ?? 0.5,
      volumeLevelCurve: p?.volumeLevelCurve?.length ? p.volumeLevelCurve : [{ volume: 0, level: 0 }, { volume: 1, level: 1 }],
    });
  }, [nodeId, data, reset]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
      {/* ===== Basic Information ===== */}
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
        <Grid item xs={6}>
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
                inputProps={{ min: 0, max: 9, readOnly: true }}
                disabled
                value={junctionFields.length}
                error={!!errors.njuns}
                helperText={errors.njuns?.message || 'Auto-calculated from junction list'}
              />
            )}
          />
        </Grid>
        <Grid item xs={6}>
          <Controller
            name="initialConditionControl"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Initial Cond. Control"
                size="small"
                fullWidth
                value={field.value ?? 0}
              >
                <MenuItem value={0}>Velocity</MenuItem>
                <MenuItem value={1}>Mass Flow</MenuItem>
              </TextField>
            )}
          />
        </Grid>
      </Grid>

      <Divider />

      {/* ===== Volume Geometry ===== */}
      <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
        Volume Geometry (A × L = V)
      </Typography>

      {!geoCheck.valid && (
        <Alert severity="warning" sx={{ py: 0 }}>{geoCheck.message}</Alert>
      )}

      <Grid container spacing={1}>
        <Grid item xs={4}>
          <Controller
            name="area"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value ?? 0}
                onChange={field.onChange}
                label="Area (m²)"
                size="small"
                fullWidth
                error={!!errors.area}
                helperText={errors.area?.message}
              />
            )}
          />
        </Grid>
        <Grid item xs={4}>
          <Controller
            name="length"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value}
                onChange={field.onChange}
                label="Length (m)"
                size="small"
                fullWidth
                error={!!errors.length}
                helperText={errors.length?.message}
              />
            )}
          />
        </Grid>
        <Grid item xs={4}>
          <Controller
            name="volume"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value}
                onChange={field.onChange}
                label="Volume (m³)"
                size="small"
                fullWidth
                error={!!errors.volume}
                helperText={errors.volume?.message}
              />
            )}
          />
        </Grid>
      </Grid>

      <Grid container spacing={1}>
        <Grid item xs={4}>
          <Controller
            name="incAngle"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value}
                onChange={field.onChange}
                label="Inc. Angle (deg)"
                size="small"
                fullWidth
              />
            )}
          />
        </Grid>
        <Grid item xs={4}>
          <Controller
            name="dz"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value}
                onChange={field.onChange}
                label="Elev. Change (m)"
                size="small"
                fullWidth
              />
            )}
          />
        </Grid>
        <Grid item xs={4}>
          <Controller
            name="hydraulicDiameter"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value}
                onChange={field.onChange}
                label="Hyd. Diameter (m)"
                size="small"
                fullWidth
                error={!!errors.hydraulicDiameter}
                helperText={errors.hydraulicDiameter?.message}
              />
            )}
          />
        </Grid>
      </Grid>

      <Divider />

      {/* ===== Initial Conditions ===== */}
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
            label="Thermodynamic Option (ebt)"
            size="small"
            fullWidth
          >
            <MenuItem value="001">001 - T, xs (Equilibrium)</MenuItem>
            <MenuItem value="002">002 - P, xs (Equilibrium)</MenuItem>
            <MenuItem value="003">003 - P, T (Equilibrium)</MenuItem>
            <MenuItem value="004">004 - P, T, xs (Two-comp)</MenuItem>
            <MenuItem value="005">005 - T, xs, xn (Two-comp)</MenuItem>
          </TextField>
        )}
      />

      <Grid container spacing={1}>
        {watchedEbt !== '001' && (
        <Grid item xs={watchedEbt === '003' || watchedEbt === '004' ? 6 : 12}>
          <Controller
            name="pressure"
            control={control}
            render={({ field }) => (
              <NumericTextField
                value={field.value ?? 15.074e6}
                onChange={field.onChange}
                label="Pressure (Pa)"
                size="small"
                fullWidth
                required
                error={!!errors.pressure}
                helperText={errors.pressure?.message}
              />
            )}
          />
        </Grid>
        )}
        {(watchedEbt === '001' || watchedEbt === '003' || watchedEbt === '004') && (
          <Grid item xs={6}>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <NumericTextField
                  value={field.value ?? 594.05}
                  onChange={field.onChange}
                  label="Temperature (K)"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
        )}
        {(watchedEbt === '001' || watchedEbt === '002' || watchedEbt === '004' || watchedEbt === '005') && (
          <Grid item xs={6}>
            <Controller
              name="quality"
              control={control}
              render={({ field }) => (
                <NumericTextField
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  label="Quality (0~1)"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
        )}
      </Grid>

      <Divider />

      {/* ===== Tank Level (Tank-specific) ===== */}
      <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
        Tank Level Data
      </Typography>

      <Controller
        name="initialLiquidLevel"
        control={control}
        render={({ field }) => (
          <NumericTextField
            value={field.value}
            onChange={field.onChange}
            label="Initial Liquid Level (m)"
            size="small"
            fullWidth
            required
            error={!!errors.initialLiquidLevel}
            helperText={errors.initialLiquidLevel?.message || 'Height of liquid from tank bottom'}
          />
        )}
      />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Volume vs Level Curve
            <Chip label={`${curveFields.length} pairs`} size="small" sx={{ ml: 1 }} />
          </Typography>
          <IconButton
            size="small"
            color="primary"
            onClick={() => appendCurve({ volume: 0, level: 0 })}
            disabled={curveFields.length >= 99}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {errors.volumeLevelCurve && typeof errors.volumeLevelCurve === 'object' && 'message' in errors.volumeLevelCurve && (
          <Alert severity="error" sx={{ py: 0, mb: 1 }}>
            {(errors.volumeLevelCurve as any).message}
          </Alert>
        )}

        <Box sx={{ maxHeight: 250, overflow: 'auto' }}>
          {curveFields.map((field, index) => (
            <Grid container spacing={1} key={field.id} sx={{ mb: 0.5, alignItems: 'center' }}>
              <Grid item xs={1}>
                <Typography variant="caption" color="text.secondary">{index + 1}</Typography>
              </Grid>
              <Grid item xs={4.5}>
                <Controller
                  name={`volumeLevelCurve.${index}.volume`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField
                      value={f.value ?? 0}
                      onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                      onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 0)}
                      label="Vol (m³)"
                      type="number"
                      size="small"
                      fullWidth
                      inputProps={{ step: 'any' }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={4.5}>
                <Controller
                  name={`volumeLevelCurve.${index}.level`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField
                      value={f.value ?? 0}
                      onChange={(e) => handleNumberChange(e.target.value, f.onChange)}
                      onBlur={(e) => handleNumberBlur(e.target.value, f.onChange, 0)}
                      label="Level (m)"
                      type="number"
                      size="small"
                      fullWidth
                      inputProps={{ step: 'any' }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={2}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeCurve(index)}
                  disabled={curveFields.length <= 2}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
        </Box>
      </Box>

      <Divider />

      {/* ===== Junctions ===== */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Junctions
          <Chip label={`${junctionFields.length}`} size="small" sx={{ ml: 1 }} />
        </Typography>
        <IconButton
          size="small"
          color="primary"
          onClick={() => {
            const nextNum = junctionFields.length > 0
              ? Math.max(...junctionFields.map((_, i) => getValues(`junctions.${i}.junctionNumber`))) + 1
              : 1;
            if (nextNum <= 9) {
              appendJunction({
                junctionNumber: nextNum,
                direction: 'outlet',
                branchFace: 2,
                from: null,
                to: null,
                area: 0,
                fwdLoss: 0,
                revLoss: 0,
                jefvcahs: '00000000',
                initialLiquidFlow: 0,
                initialVaporFlow: 0,
              });
              setValue('njuns', junctionFields.length + 1);
            }
          }}
          disabled={junctionFields.length >= 9}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {junctionFields.map((field, index) => (
        <Box key={field.id} sx={{ p: 1, border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              Junction #{getValues(`junctions.${index}.junctionNumber`)}
            </Typography>
            <Box>
              <Controller
                name={`junctions.${index}.direction`}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    {...f}
                    select
                    size="small"
                    sx={{ width: 100, mr: 1 }}
                  >
                    <MenuItem value="inlet">Inlet</MenuItem>
                    <MenuItem value="outlet">Outlet</MenuItem>
                  </TextField>
                )}
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  removeJunction(index);
                  setValue('njuns', junctionFields.length - 1);
                }}
                disabled={junctionFields.length <= 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={4}>
              <Controller
                name={`junctions.${index}.area`}
                control={control}
                render={({ field: f }) => (
                  <NumericTextField
                    value={f.value}
                    onChange={f.onChange}
                    label="Area (m²)"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name={`junctions.${index}.fwdLoss`}
                control={control}
                render={({ field: f }) => (
                  <NumericTextField
                    value={f.value}
                    onChange={f.onChange}
                    label="Fwd Loss"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name={`junctions.${index}.revLoss`}
                control={control}
                render={({ field: f }) => (
                  <NumericTextField
                    value={f.value}
                    onChange={f.onChange}
                    label="Rev Loss"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
          </Grid>

          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <Controller
                name={`junctions.${index}.initialLiquidFlow`}
                control={control}
                render={({ field: f }) => (
                  <NumericTextField
                    value={f.value ?? 0}
                    onChange={f.onChange}
                    label="Liquid Flow (kg/s)"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name={`junctions.${index}.initialVaporFlow`}
                control={control}
                render={({ field: f }) => (
                  <NumericTextField
                    value={f.value ?? 0}
                    onChange={f.onChange}
                    label="Vapor Flow (kg/s)"
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Grid>
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default TankForm;
