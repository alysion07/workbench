/**
 * SNGLVOL Parameter Form
 */

import { useEffect, useMemo } from 'react';
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
  Alert,
  Chip,
  Grid,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, SnglvolParameters } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import ComponentIdField from './ComponentIdField';

/**
 * Validate SNGLVOL geometry according to MARS rules:
 * - Exactly one of A, L, V can be 0 (for auto-calculation)
 * - If all three are non-zero, check consistency: V ≈ A×L
 */
function validateSnglvolGeometry(
  xArea: number | undefined,
  xLength: number | undefined,
  volume: number
): { valid: boolean; error?: string; calculated?: { field: 'xArea' | 'xLength' | 'volume'; value: number } } {
  const areaVal = xArea ?? 0;
  const lengthVal = xLength ?? 0;
  const volumeVal = volume;
  
  const zeroCount = [areaVal, lengthVal, volumeVal].filter(v => v === 0).length;
  
  // All zero
  if (zeroCount === 3) {
    return { valid: false, error: 'All values cannot be zero' };
  }
  
  // Two or more zeros
  if (zeroCount >= 2) {
    return { valid: false, error: 'At least two values must be non-zero' };
  }
  
  // Exactly one zero - auto-calculate it
  if (zeroCount === 1) {
    if (areaVal === 0) {
      if (lengthVal === 0 || volumeVal === 0) {
        return { valid: false, error: 'Cannot calculate Area: Length or Volume is zero' };
      }
      const calculatedArea = volumeVal / lengthVal;
      return { valid: true, calculated: { field: 'xArea', value: calculatedArea } };
    }
    
    if (lengthVal === 0) {
      if (areaVal === 0 || volumeVal === 0) {
        return { valid: false, error: 'Cannot calculate Length: Area or Volume is zero' };
      }
      const calculatedLength = volumeVal / areaVal;
      return { valid: true, calculated: { field: 'xLength', value: calculatedLength } };
    }
    
    if (volumeVal === 0) {
      if (areaVal === 0 || lengthVal === 0) {
        return { valid: false, error: 'Cannot calculate Volume: Area or Length is zero' };
      }
      const calculatedVolume = areaVal * lengthVal;
      return { valid: true, calculated: { field: 'volume', value: calculatedVolume } };
    }
  }
  
  // All three are non-zero - check consistency
  const calculatedVolume = areaVal * lengthVal;
  const relativeError = Math.abs(calculatedVolume - volumeVal) / volumeVal;
  
  if (relativeError > 1e-6) {
    return { 
      valid: false, 
      error: `Inconsistent: A×L=${calculatedVolume.toExponential(3)} ≠ V=${volumeVal.toExponential(3)} (error=${(relativeError*100).toFixed(4)}%)` 
    };
  }
  
  return { valid: true };
}

// Validation schema
const snglvolSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Geometry
  xArea: z.number().optional(),
  xLength: z.number().positive('Must be positive'),
  volume: z.number().positive('Must be positive'),
  
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
});

type FormData = z.infer<typeof snglvolSchema>;

interface SnglvolFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const SnglvolForm: React.FC<SnglvolFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, setPropertyFormState, setFormSubmitHandler } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler })));

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(snglvolSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId,
      xArea: 0,
      xLength: 1.0,
      volume: 1.0,
      azAngle: 0,
      incAngle: 90,
      dz: 1.0,
      wallRoughness: 3.048e-5,
      hydraulicDiameter: 0.1,
      tlpvbfe: '0000000',
      ebt: '003',
      pressure: 15.5e6,
      temperature: 560.0,
      ...(data.parameters as Partial<SnglvolParameters>),
    },
  });
  
  const ebt = watch('ebt');
  
  // Watch geometry values for validation
  const xArea = watch('xArea');
  const xLength = watch('xLength');
  const volume = watch('volume');
  
  // Geometry validation
  const geometryValidation = useMemo(() => {
    return validateSnglvolGeometry(xArea, xLength, volume);
  }, [xArea, xLength, volume]);
  
  // Reset form when node data changes (when user selects a different node or same node again)
  useEffect(() => {
    const params = data.parameters as Partial<SnglvolParameters>;
    console.log('🔄 Form Reset Debug:', {
      nodeId,
      componentName: data.componentName,
      temperature: params?.temperature,
      ebt: params?.ebt,
      hasParameters: !!params,
    });
    
    reset({
      name: data.componentName || '',
      componentId: data.componentId,
      xArea: params?.xArea ?? 0,
      xLength: params?.xLength ?? 1.0,
      volume: params?.volume ?? 1.0,
      azAngle: params?.azAngle ?? 0,
      incAngle: params?.incAngle ?? 90,
      dz: params?.dz ?? 1.0,
      wallRoughness: params?.wallRoughness ?? 3.048e-5,
      hydraulicDiameter: params?.hydraulicDiameter ?? 0.1,
      tlpvbfe: params?.tlpvbfe ?? '0000000',
      ebt: params?.ebt ?? '003',
      pressure: params?.pressure ?? 15.5e6,
      temperature: params?.temperature ?? 560.0,
      quality: params?.quality ?? 0.0,
    });
  }, [nodeId, reset]);
  
  // Update temperature/quality fields based on ebt (only for initial setup, not when loading saved data)
  useEffect(() => {
    const params = data.parameters as Partial<SnglvolParameters>;
    // Don't override if there's already a saved value
    if (params?.temperature !== undefined || params?.quality !== undefined) {
      return;
    }

    if (ebt === '001') {
      setValue('temperature', 358.0);
      setValue('quality', 0.0);
    } else if (ebt === '002') {
      setValue('quality', 0.0);
    } else if (ebt === '003') {
      setValue('temperature', 560.0);
    }
  }, [ebt, setValue, data.parameters]);

  const onSubmit = (formData: FormData) => {
    console.log('[SnglvolForm] onSubmit called with formData:', formData);

    // Debug: Log temperature value to verify decimal preservation
    if (formData.temperature !== undefined) {
      console.log('📊 Temperature Input Debug:', {
        displayValue: formData.temperature,
        type: typeof formData.temperature,
        asString: formData.temperature.toString(),
        isDecimal: formData.temperature % 1 !== 0,
        rawValue: formData.temperature,
      });
    }

    // Extract componentId separately (it's not a parameter)
    const { componentId, ...rest } = formData;
    const parameters: Partial<SnglvolParameters> = rest;
    
    // Validate
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

    if (!formData.name) validationErrors.push({ level: 'error', message: 'Name is required' });
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
    
    const status = validationErrors.length === 0 ? 'valid' : 'error';
    
    console.log('[SnglvolForm] Calling updateNodeData with:', {
      nodeId,
      componentName: formData.name,
      componentId,
      parameters,
      status,
      errors: validationErrors,
      warnings: validationWarnings,
    });

    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId,
      parameters,
      status,
      errors: validationErrors,
      warnings: validationWarnings,
    });

    console.log('[SnglvolForm] updateNodeData called');
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
        
        <Divider />
        
        {/* Geometry */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Geometry (A × L = V Rule)
        </Typography>
        
        {!geometryValidation.valid && (
          <Alert severity="error" icon={<InfoIcon />}>
            <strong>Geometry Error:</strong> {geometryValidation.error}
          </Alert>
        )}
        
        {geometryValidation.valid && geometryValidation.calculated && (
          <Alert severity="info" icon={<InfoIcon />}>
            <strong>Auto-calculated:</strong> {geometryValidation.calculated.field === 'xArea' ? 'Area' : geometryValidation.calculated.field === 'xLength' ? 'Length' : 'Volume'} = {geometryValidation.calculated.value.toExponential(3)}
          </Alert>
        )}
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
            <Controller
              name="xArea"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Area"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        m²
                        {xArea === 0 && geometryValidation.calculated?.field === 'xArea' && (
                          <Chip label="Auto" size="small" color="success" sx={{ ml: 1 }} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                  helperText="0 = auto from V/L"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Controller
              name="xLength"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Length"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        m
                        {xLength === 0 && geometryValidation.calculated?.field === 'xLength' && (
                          <Chip label="Auto" size="small" color="success" sx={{ ml: 1 }} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                  helperText="0 = auto from V/A"
                  error={!!errors.xLength}
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
                  size="small"
                  fullWidth
                  required
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 1.0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        m³
                        {volume === 0 && geometryValidation.calculated?.field === 'volume' && (
                          <Chip label="Auto" size="small" color="success" sx={{ ml: 1 }} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                  helperText="0 = auto from A×L"
                  error={!!errors.volume}
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Divider />
        
        {/* Angles */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Orientation
        </Typography>
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="azAngle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Azimuth Angle"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  helperText="|angle| ≤ 360°"
                  error={!!errors.azAngle}
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Controller
              name="incAngle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Inclination Angle"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 90)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  helperText="|angle| ≤ 90° (0°=horiz)"
                  error={!!errors.incAngle}
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="dz"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Elevation Change"
                  type="number"
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  helperText="Vertical height change"
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
                  size="small"
                  fullWidth
                  required
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.1)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  error={!!errors.hydraulicDiameter}
                  helperText={errors.hydraulicDiameter?.message || 'Example: 0.15'}
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
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 3.048e-5)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  helperText="Default: 3.048e-5 m"
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Controller
              name="tlpvbfe"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Volume Flags (tlpvbfe)"
                  size="small"
                  fullWidth
                  placeholder="0000000"
                  helperText="7-digit control flags"
                  inputProps={{
                    maxLength: 7,
                    pattern: '[0-9]{7}',
                  }}
                  error={!!errors.tlpvbfe}
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
        
        <Controller
          name="ebt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Equilibrium Option"
              select
              size="small"
              fullWidth
            >
              <MenuItem value="003">003 - Pressure & Temperature [P, T]</MenuItem>
              <MenuItem value="002">002 - Pressure & Quality [P, xs]</MenuItem>
              <MenuItem value="001">001 - Temperature & Quality [T, xs]</MenuItem>
            </TextField>
          )}
        />
        
        {ebt !== '001' && (
        <Controller
          name="pressure"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              label="Pressure"
              type="number"
              size="small"
              fullWidth
              required
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
              inputProps={numberInputProps}
              InputProps={{
                endAdornment: <InputAdornment position="end">Pa</InputAdornment>,
              }}
              helperText="Example: 15.5e6 = 15.5 MPa"
              error={!!errors.pressure}
            />
          )}
        />
        )}

        {(ebt === '001' || ebt === '003') && (
        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              label="Temperature"
              type="number"
              size="small"
              fullWidth
              required
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange)}
              inputProps={numberInputProps}
              InputProps={{
                endAdornment: <InputAdornment position="end">K</InputAdornment>,
              }}
              helperText="Example: 560.15 K"
              error={!!errors.temperature}
            />
          )}
        />
        )}

        {(ebt === '001' || ebt === '002') && (
          <Controller
            name="quality"
            control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              label="Quality"
              type="number"
              size="small"
              fullWidth
              required
              onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
              onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
              inputProps={numberInputProps}
              helperText="0 = liquid, 1 = vapor (e.g., 0.5)"
              error={!!errors.quality}
              />
            )}
          />
        )}
      </Box>
    </form>
  );
};

export default SnglvolForm;

