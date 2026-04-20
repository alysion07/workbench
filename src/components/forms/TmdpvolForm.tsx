/**
 * TMDPVOL Parameter Form - Enhanced Version
 * Supports full εbt format with 7 thermodynamic options
 * Similar UX to PIPE form for consistency
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
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
  Alert,
  Chip,
  FormControl,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, TmdpvolParameters, TmdpvolEbtFormat, TmdpvolTimePoint, TmdpSearchVariableType, TMDP_SEARCH_VARIABLE_LABELS } from '@/types/mars';
import { handleNumberChange, handleNumberBlur, numberInputProps } from '@/utils/inputHelpers';
import ComponentIdField from './ComponentIdField';
import {
  validateTmdpvolGeometry,
  parseEbtFormat,
  getThermoOptionFields,
  validateQualityRange,
  validateAngles,
  validateElevation,
  getFluidTypeName,
  getThermoOptionDescription,
} from '@/utils/tmdpvolHelpers';

// Validation schema - dynamic based on εbt
const tmdpvolSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),

  // Geometry
  area: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  volume: z.number().min(0),
  
  // Angles
  azAngle: z.number().optional(),
  incAngle: z.number().refine(val => Math.abs(val) <= 90, {
    message: 'Inclination angle must be |angle| ≤ 90°',
  }),
  dz: z.number(),
  
  // Wall
  wallRoughness: z.number().nonnegative().optional(),
  hydraulicDiameter: z.number().nonnegative().optional(),
  
  // Boundary condition - εbt format
  conditionType: z.string(), // Will validate as TmdpvolEbtFormat
  
  // Time table (max 5000 entries)
  timeTable: z.array(z.any()).min(2, 'At least 2 time points required').max(5000, 'Maximum 5000 time points'),
  
  // Optional
  tripNumber: z.number().int().optional(),
  variableType: z.string().optional(),
  variableCode: z.number().int().optional(),
});

type FormData = z.infer<typeof tmdpvolSchema>;

interface TmdpvolFormProps {
  nodeId: string;
  data: MARSNodeData;
}

const TmdpvolForm: React.FC<TmdpvolFormProps> = ({ nodeId, data }) => {
  const { updateNodeData, setPropertyFormState, setFormSubmitHandler } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler })));
  
  // Local state for εbt selection
  const [thermoOption, setThermoOption] = useState<number>(3); // Default: t=3 (P, T)
  const [includeBoron, setIncludeBoron] = useState<boolean>(false);
  const [useDeuterium, setUseDeuterium] = useState<boolean>(false);
  
  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(tmdpvolSchema),
    defaultValues: {
      name: data.componentName || '',
      area: 0,
      length: 1.0,
      volume: 1.0,
      azAngle: 0,
      incAngle: 90,
      dz: 1.0,
      wallRoughness: 0.0,
      hydraulicDiameter: 0.0,
      conditionType: '003', // Default: H₂O, no boron, P-T
      timeTable: [
        { time: 0.0, pressure: 15.5e6, temperature: 560.0 },
        { time: 1000.0, pressure: 15.5e6, temperature: 560.0 },
      ],
    },
  });
  
  // Auto-calculate εbt from selections
  useEffect(() => {
    const epsilon = useDeuterium ? 1 : 0; // 0=H2O, 1=D2O (ε=2는 "고급설정"에서만)
    const b = includeBoron ? 1 : 0;
    const t = thermoOption;
    const ebt = `${epsilon}${b}${t}` as TmdpvolEbtFormat;
    setValue('conditionType', ebt, { shouldDirty: true });
  }, [thermoOption, includeBoron, useDeuterium, setValue]);
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'timeTable',
  });
  
  // Watch values for dynamic form generation and validation
  const conditionType = watch('conditionType');
  const area = watch('area');
  const length = watch('length');
  const volume = watch('volume');
  const dz = watch('dz');
  const azAngle = watch('azAngle');
  const incAngle = watch('incAngle');
  
  // Parse εbt format
  const ebtInfo = useMemo(() => {
    try {
      return parseEbtFormat(conditionType);
    } catch {
      return { fluidType: 0, boronFlag: false, thermoOption: 3 };
    }
  }, [conditionType]);
  
  // Get required fields for current thermodynamic option
  const thermoFields = useMemo(() => {
    return getThermoOptionFields(ebtInfo.thermoOption);
  }, [ebtInfo.thermoOption]);
  
  // Geometry validation
  const geometryValidation = useMemo(() => {
    return validateTmdpvolGeometry(area, length, volume);
  }, [area, length, volume]);
  
  // Angle validation
  const angleValidation = useMemo(() => {
    return validateAngles(azAngle, incAngle);
  }, [azAngle, incAngle]);
  
  // Elevation validation
  const elevationValidation = useMemo(() => {
    return validateElevation(dz, length);
  }, [dz, length]);
  
  // Reset form when node data changes
  useEffect(() => {
    const params = data.parameters as Partial<TmdpvolParameters>;
    if (params && Object.keys(params).length > 0) {
      // Parse conditionType first to know which fields are required
      let currentThermoOption = 3;
      if (params.conditionType) {
        try {
          const parsed = parseEbtFormat(params.conditionType);
          currentThermoOption = parsed.thermoOption;
        } catch {
          // Use default
        }
      }
      
      // Get required fields for current thermo option
      const requiredFields = getThermoOptionFields(currentThermoOption).required;
      
      // Normalize timeTable: ensure all required fields have default values
      const normalizedTimeTable = (params.timeTable ?? [
        { time: 0.0, pressure: 15.5e6, temperature: 560.0 },
        { time: 1000.0, pressure: 15.5e6, temperature: 560.0 },
      ]).map((point: any) => {
        const normalized: any = { ...point };
        
        // Fill in missing required fields with defaults
        requiredFields.forEach(fieldName => {
          if (normalized[fieldName] === undefined || normalized[fieldName] === null) {
            if (fieldName === 'quality') {
              normalized[fieldName] = 0.0;
            } else if (fieldName === 'pressure') {
              normalized[fieldName] = 15.5e6;
            } else if (fieldName === 'temperature') {
              normalized[fieldName] = 560.0;
            } else if (fieldName === 'noncondensableQuality') {
              normalized[fieldName] = 0.0;
            } else if (fieldName === 'internalEnergyLiquid') {
              normalized[fieldName] = 1000000;
            } else if (fieldName === 'internalEnergyVapor') {
              normalized[fieldName] = 2500000;
            } else if (fieldName === 'voidFraction') {
              normalized[fieldName] = 0.5;
            } else if (fieldName === 'temperatureLiquid' || fieldName === 'temperatureVapor') {
              normalized[fieldName] = 560.0;
            } else if (fieldName === 'relativeHumidity') {
              normalized[fieldName] = 0.5;
            } else {
              normalized[fieldName] = 0.0;
            }
          }
        });
        
        return normalized;
      });
      
      reset({
        name: data.componentName || '',
        componentId: data.componentId,
        area: params.area ?? 0,
        length: params.length ?? 1.0,
        volume: params.volume ?? 1.0,
        azAngle: params.azAngle ?? 0,
        incAngle: params.incAngle ?? 90,
        dz: params.dz ?? 1.0,
        wallRoughness: params.wallRoughness ?? 0.0,
        hydraulicDiameter: params.hydraulicDiameter ?? 0.0,
        conditionType: params.conditionType ?? '003',
        timeTable: normalizedTimeTable,
        tripNumber: params.tripNumber,
        variableType: params.variableType ?? 'time',
        variableCode: params.variableCode,
      });
      
      // Parse conditionType and update local state
      if (params.conditionType) {
        try {
          const parsed = parseEbtFormat(params.conditionType);
          setThermoOption(parsed.thermoOption);
          setIncludeBoron(parsed.boronFlag);
          setUseDeuterium(parsed.fluidType === 1);
        } catch {
          // Use defaults
          setThermoOption(3);
          setIncludeBoron(false);
          setUseDeuterium(false);
        }
      }
    }
  }, [nodeId, reset]);
  
  const onSubmit = useCallback((formData: FormData) => {
    const parameters: Partial<TmdpvolParameters> = {
      ...formData,
      conditionType: formData.conditionType as TmdpvolEbtFormat,
      variableType: (formData.variableType || 'time') as TmdpSearchVariableType,
      timeTable: formData.timeTable as TmdpvolTimePoint[],
      tlpvbfe: '0000000', // TMDPVOL must always use 0000000
    };
    
    // Validate
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    const validationWarnings: Array<{ level: 'warning'; message: string }> = [];
    
    if (!formData.name) {
      validationErrors.push({ level: 'error', message: 'Name is required' });
    }
    
    // Geometry validation
    if (!geometryValidation.valid) {
      validationErrors.push({ level: 'error', message: geometryValidation.error! });
    }
    
    // Angle validation
    if (!angleValidation.valid) {
      angleValidation.errors.forEach(err => {
        validationErrors.push({ level: 'error', message: err });
      });
    }
    
    // Elevation validation
    if (!elevationValidation.valid) {
      validationErrors.push({ level: 'error', message: elevationValidation.error! });
    }
    
    // Time table validation
    if (formData.timeTable.length < 2) {
      validationErrors.push({ level: 'error', message: 'At least 2 time points required' });
    }
    
    if (formData.timeTable.length > 5000) {
      validationErrors.push({ level: 'error', message: 'Maximum 5000 time points allowed' });
    }
    
    // Check time monotonic increasing
    for (let i = 1; i < formData.timeTable.length; i++) {
      const prev = formData.timeTable[i - 1] as any;
      const curr = formData.timeTable[i] as any;
      if (curr.time < prev.time) {
        validationErrors.push({ 
          level: 'error', 
          message: `Time must be monotonically increasing (row ${i + 1}: ${curr.time} < row ${i}: ${prev.time})` 
        });
        break;
      }
    }
    
    // Quality range validation for two-phase conditions
    formData.timeTable.forEach((point: any, idx) => {
      if (point.quality !== undefined) {
        const qualityValidation = validateQualityRange(point.quality);
        if (!qualityValidation.valid) {
          validationErrors.push({ 
            level: 'error', 
            message: `Row ${idx + 1}: ${qualityValidation.error}` 
          });
        }
      }
    });
    
    const allErrors = [...validationErrors, ...validationWarnings];
    const status = validationErrors.length === 0 ? (validationWarnings.length > 0 ? 'incomplete' : 'valid') : 'error';
    
    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,
      parameters,
      status,
      errors: allErrors,
    });
  }, [geometryValidation, angleValidation, elevationValidation, updateNodeData, nodeId]);

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
      isValid: isValid && geometryValidation.valid && angleValidation.valid && elevationValidation.valid,
    });
  }, [isDirty, isValid, geometryValidation.valid, angleValidation.valid, elevationValidation.valid, setPropertyFormState]);

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
            <strong>Auto-calculated:</strong> {geometryValidation.calculated.field} = {geometryValidation.calculated.value.toExponential(3)}
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
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        m²
                        {area === 0 && geometryValidation.calculated?.field === 'area' && (
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
              name="length"
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
                        {length === 0 && geometryValidation.calculated?.field === 'length' && (
                          <Chip label="Auto" size="small" color="success" sx={{ ml: 1 }} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                  helperText="0 = auto from V/A"
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
        
        {!angleValidation.valid && (
          <Alert severity="error">
            {angleValidation.errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </Alert>
        )}
        
        <Grid container spacing={1}>
          <Grid item xs={12} sm={4}>
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
                  size="small"
                  fullWidth
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 90)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°</InputAdornment>,
                  }}
                  helperText="|angle| ≤ 90° (0°=horiz)"
                  error={!!errors.incAngle || (!angleValidation.valid && angleValidation.errors.some(e => e.includes('Inclination')))}
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
                  helperText={`|dz| ≤ Length${length ? ` (${length.toFixed(2)}m)` : ''}`}
                  error={!elevationValidation.valid}
                />
              )}
            />
          </Grid>
        </Grid>
        
        {!elevationValidation.valid && (
          <Alert severity="error">{elevationValidation.error}</Alert>
        )}
        
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
                  onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                  onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0.1)}
                  inputProps={numberInputProps}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                  
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Divider />
        
        {/* Boundary Condition - εbt Format */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          🎯 Initial Condition Type
        </Typography>
        
        <Alert severity="info" icon={<InfoIcon />}>
          Select the thermodynamic input method for your boundary condition
        </Alert>
        
        {/* Thermodynamic Option Selection (t value) */}
        <FormControl component="fieldset">
          <Typography variant="body2" fontWeight="500" gutterBottom>
            입력 방식 선택:
          </Typography>
          <RadioGroup
            value={thermoOption.toString()}
            onChange={(e) => setThermoOption(parseInt(e.target.value))}
          >
            <FormControlLabel 
              value="3" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    [P, T] 압력 + 온도
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                   εbt = x0x3
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel 
              value="2" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    [P, xs] 압력 + 건도 (2상 경계 조건)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    εbt = x0x2
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel 
              value="1" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body2">
                    [T, xs] 온도 + 건도
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    εbt = x0x1
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel 
              value="4" 
              control={<Radio />} 
              label={
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    [P, T, xs] 비응축성 기체 포함 (2상 + 공기)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    압력 + 온도 + 건도 • εbt = x0x4
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              value="0"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">
                    [P, Uf, Ug, αg] 비평형 (고급)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    압력 + 액체/증기 내부에너지 + 기공율 • εbt = x0x0
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="5"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">
                    [T, xs, xn] 온도 + 건도 + 비응축성 (고급)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    εbt = x0x5
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="6"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">
                    [P, Uf, Ug, αg, xn] 비평형 + 비응축성 (고급)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    εbt = x0x6
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="7"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight="500">
                    [P, Tf, Tg, αg] TRACE 호환 (액체/증기 온도 분리)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    압력 + 액체온도 + 증기온도 + 기공율 • εbt = x0x7
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="8"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">
                    [P, T, xs, RH] 상대습도 포함
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    압력 + 온도 + 건도 + 상대습도 • εbt = x0x8
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
        
        <Divider sx={{ my: 1 }} />
        
        {/* Additional Options (Checkboxes) */}
        <Typography variant="body2" fontWeight="500" gutterBottom>
          추가 옵션:
        </Typography>
        
        <Box display="flex" flexDirection="column" gap={0.5}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={includeBoron} 
                onChange={(e) => setIncludeBoron(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                붕소 농도 포함 (b=1) • Primary system
              </Typography>
            }
          />
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={useDeuterium} 
                onChange={(e) => setUseDeuterium(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                중수 D₂O 사용 (ε=1) • 기본: 경수 H₂O
              </Typography>
            }
          />
        </Box>
        
        <Divider sx={{ my: 1 }} />
        
        {/* Generated εbt Code Display */}
        <Box 
          sx={{
            p: 1.5,
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="subtitle2" fontWeight="600">
            생성된 εbt 코드:
          </Typography>
          <Chip 
            label={conditionType} 
            sx={{ 
              bgcolor: 'white', 
              color: 'primary.main',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}
          />
        </Box>
        
        {/* εbt Breakdown */}
        <Box display="flex" gap={1} flexWrap="wrap">
          <Chip 
            label={`ε=${ebtInfo.fluidType}: ${getFluidTypeName(ebtInfo.fluidType)}`} 
            color="primary" 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={`b=${ebtInfo.boronFlag ? 1 : 0}: ${ebtInfo.boronFlag ? 'With Boron' : 'No Boron'}`} 
            color={ebtInfo.boronFlag ? 'success' : 'default'} 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={`t=${ebtInfo.thermoOption}: ${getThermoOptionDescription(ebtInfo.thermoOption)}`} 
            color="secondary" 
            size="small" 
            variant="outlined"
          />
        </Box>
        
        <Divider />
        
        {/* Optional: Trip and Variable Control (Card 0200 W2-W4) */}
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Search Variable Control (Optional)
        </Typography>
        
        <Alert severity="info" icon={<InfoIcon />}>
          By default, time is used as the search variable. Optionally, you can use trips or other variables (e.g., pressure, flow rate).
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
            Time-Dependent Data ({fields.length} points, max 5000)
          </Typography>
          <Tooltip title="Add Time Point">
            <IconButton
              size="small"
              onClick={() => {
                const lastPoint = fields[fields.length - 1] as any;
                const newPoint: any = {
                  time: lastPoint ? lastPoint.time + 100 : 0,
                };
                
                // Add fields based on current thermodynamic option
                thermoFields.required.forEach(fieldName => {
                  if (fieldName === 'pressure') newPoint.pressure = lastPoint?.pressure || 15.5e6;
                  if (fieldName === 'temperature') newPoint.temperature = lastPoint?.temperature || 560.0;
                  if (fieldName === 'quality') newPoint.quality = lastPoint?.quality || 0.5;
                  if (fieldName === 'internalEnergyLiquid') newPoint.internalEnergyLiquid = lastPoint?.internalEnergyLiquid || 1000000;
                  if (fieldName === 'internalEnergyVapor') newPoint.internalEnergyVapor = lastPoint?.internalEnergyVapor || 2500000;
                  if (fieldName === 'voidFraction') newPoint.voidFraction = lastPoint?.voidFraction || 0.5;
                  if (fieldName === 'noncondensableQuality') newPoint.noncondensableQuality = lastPoint?.noncondensableQuality || 0.0;
                  if (fieldName === 'temperatureLiquid') newPoint.temperatureLiquid = lastPoint?.temperatureLiquid || 560.0;
                  if (fieldName === 'temperatureVapor') newPoint.temperatureVapor = lastPoint?.temperatureVapor || 560.0;
                  if (fieldName === 'relativeHumidity') newPoint.relativeHumidity = lastPoint?.relativeHumidity || 0.5;
                });
                
                if (ebtInfo.boronFlag) {
                  newPoint.boronConcentration = lastPoint?.boronConcentration || 0;
                }
                
                append(newPoint);
              }}
              color="primary"
              disabled={fields.length >= 5000}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Alert severity="info">
          <strong>Required fields for t={ebtInfo.thermoOption}:</strong>{' '}
          {thermoFields.required.map(f => thermoFields.labels[f]).join(', ')}
        </Alert>
        
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
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
                {thermoFields.required.map(fieldName => (
                  <TableCell key={fieldName} sx={{ fontWeight: 600, minWidth: 100 }}>
                    {thermoFields.labels[fieldName]}
                  </TableCell>
                ))}
                {ebtInfo.boronFlag && (
                  <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Boron (ppm)</TableCell>
                )}
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
                  
                  {/* Dynamic fields based on thermodynamic option */}
                  {thermoFields.required.map(fieldName => {
                    // Determine default value based on field type
                    let defaultValue: number;
                    if (fieldName === 'quality') {
                      defaultValue = 0.0;
                    } else if (fieldName === 'pressure') {
                      defaultValue = 15.5e6;
                    } else if (fieldName === 'temperature' || fieldName === 'temperatureLiquid' || fieldName === 'temperatureVapor') {
                      defaultValue = 560.0;
                    } else if (fieldName === 'noncondensableQuality') {
                      defaultValue = 0.0;
                    } else if (fieldName === 'internalEnergyLiquid') {
                      defaultValue = 1000000;
                    } else if (fieldName === 'internalEnergyVapor') {
                      defaultValue = 2500000;
                    } else if (fieldName === 'voidFraction' || fieldName === 'relativeHumidity') {
                      defaultValue = 0.5;
                    } else {
                      defaultValue = 0.0;
                    }
                    
                    return (
                      <TableCell key={fieldName}>
                        <Controller
                          name={`timeTable.${index}.${fieldName}` as any}
                          control={control}
                          defaultValue={defaultValue}
                          render={({ field }) => {
                            // Ensure value is never undefined or null to prevent uncontrolled input warning
                            // For number inputs, use empty string when undefined/null, but ensure form state has a number
                            const displayValue = field.value !== undefined && field.value !== null 
                              ? String(field.value) 
                              : '';
                            
                            return (
                              <TextField
                                {...field}
                                value={displayValue}
                                type="number"
                                size="small"
                                fullWidth
                                onChange={(e) => {
                                  handleNumberChange(e.target.value, field.onChange);
                                }}
                                onBlur={(e) => {
                                  handleNumberBlur(e.target.value, field.onChange, defaultValue);
                                }}
                                inputProps={numberInputProps}
                                sx={{ minWidth: 100 }}
                              />
                            );
                          }}
                        />
                      </TableCell>
                    );
                  })}
                  
                  {/* Boron field if enabled */}
                  {ebtInfo.boronFlag && (
                    <TableCell>
                      <Controller
                        name={`timeTable.${index}.boronConcentration` as any}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
                            onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, 0)}
                            inputProps={numberInputProps}
                            sx={{ minWidth: 100 }}
                          />
                        )}
                      />
                    </TableCell>
                  )}
                  
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
          <Alert severity="error">{errors.timeTable.message}</Alert>
        )}
      </Box>
    </form>
  );
};

export default TmdpvolForm;
