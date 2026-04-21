/**
 * PIPE Parameter Form - Tabbed Spread Format
 * Uses MARS "Sequential Expansion Format" with organized tabs
 */

import { useState, useEffect, useRef } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentPaste as ContentPasteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import { useStore } from '@/stores/useStore';
import { useShallow } from 'zustand/react/shallow';
import { MARSNodeData, PipeParameters } from '@/types/mars';
import { numberInputProps } from '@/utils/inputHelpers';
import ComponentIdField from './ComponentIdField';
import {
  validateGenericSpreadRows,
  validateGeometryRow,
  compressArraysToGeometryRows,
  compressArraysToJunctionRows,
  compressArraysToAngleRows,
  compressArraysToWallRows,
  compressArraysToInitialRows,
  compressArraysToCcflRows,
} from '@/utils/pipeSpreadHelpers';
import { MarsCardImportDialog } from './MarsCardImportDialog';
import type { ParsedInitialCondition } from '@/utils/marsCardParser';

// Validation Schemas
const geometryRowSchema = z.object({
  id: z.string(),
  endCell: z.number().int().positive(),
  xArea: z.number().min(0),      // 0 allowed for auto-calculation
  xLength: z.number().min(0),    // 0 allowed for auto-calculation
  volume: z.number().min(0),     // 0 allowed for auto-calculation
});

const angleRowSchema = z.object({
  id: z.string(),
  endCell: z.number().int().positive(),
  azAngle: z.number().min(-360).max(360),
  vertAngle: z.number().min(-90).max(90),
  xElev: z.number().optional(),
});

const wallRowSchema = z.object({
  id: z.string(),
  endCell: z.number().int().positive(),
  wallRoughness: z.number().nonnegative(),  // 0 allowed for auto-calculation
  hydraulicDiameter: z.number().nonnegative(),  // 0 allowed: MARS auto-calculates from area (assumes circular pipe)
  volumeFlags: z.string().regex(/^[0-9]{7}$/),
});

const initialConditionRowSchema = z.object({
  id: z.string(),
  endCell: z.number().int().positive(),
  ebt: z.enum(['001', '002', '003', '004', '005']),
  pressure: z.number().positive(),
  temperature: z.number().positive().optional(),
  quality: z.number().min(0).max(1).optional(),
});

const junctionRowSchema = z.object({
  id: z.string(),
  endJunction: z.number().int().positive(),
  junctionArea: z.union([z.number().min(0), z.literal('auto')]),
  fwdLoss: z.number().min(0),
  revLoss: z.number().min(0),
  junctionFlags: z.string().regex(/^[0-9]{8}$/),
});

const junctionInitialConditionSchema = z.object({
  id: z.string(),
  endJunction: z.number().int().positive(),
  liquidVelOrFlow: z.number(),
  vaporVelOrFlow: z.number(),
  interfaceVel: z.number(),
});

const ccflRowSchema = z.object({
  id: z.string(),
  endJunction: z.number().int().positive(),
  diameter: z.number().min(0),       // 0 = auto-calculate from area
  beta: z.number().min(0).max(1),    // 0=Wallis, 1=Kutateladze
  gasIntercept: z.number().positive(), // default 1.0
  slope: z.number().positive(),       // default 1.0
});

const pipeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20, 'Name too long'),
  componentId: z.string().regex(/^\d{7}$/, 'Component ID must be 7 digits'),  // Track componentId in form
  ncells: z.number().int().min(1, 'Must be at least 1').max(999, 'Max 999 cells'),
  geometryRows: z.array(geometryRowSchema).min(1),
  angleRows: z.array(angleRowSchema).min(1),
  wallRows: z.array(wallRowSchema).min(1),
  initialRows: z.array(initialConditionRowSchema).min(1),
  junctionRows: z.array(junctionRowSchema).optional(),
  junctionControlWord: z.union([z.literal(0), z.literal(1)]).optional(),
  junctionInitialConditions: z.array(junctionInitialConditionSchema).optional(),
  ccflRows: z.array(ccflRowSchema).optional(),
});

type FormData = z.infer<typeof pipeFormSchema>;

interface PipeFormSpreadProps {
  nodeId: string;
  data: MARSNodeData;
}

const PipeFormSpread: React.FC<PipeFormSpreadProps> = ({ nodeId, data }) => {
  const { updateNodeData, setPropertyFormState, setFormSubmitHandler } = useStore(useShallow(state => ({ updateNodeData: state.updateNodeData, setPropertyFormState: state.setPropertyFormState, setFormSubmitHandler: state.setFormSubmitHandler })));
  const [activeTab, setActiveTab] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const initialLoadDone = useRef<string | null>(null);  // Track which nodeId was loaded
  
  // Initialize default rows
  const initializeRows = () => {
    const params = data.parameters as Partial<PipeParameters>;
    const ncells = params?.ncells ?? 3;
    
    return {
      geometryRows: [{
        id: 'geo-1',
        endCell: ncells,
        xArea: 0.5,
        xLength: 1.0,
        volume: 0,  // Will be auto-calculated as A×L = 0.5
      }],
      angleRows: [{
        id: 'ang-1',
        endCell: ncells,
        azAngle: 0.0,
        vertAngle: 90.0,
      }],
      wallRows: [{
        id: 'wall-1',
        endCell: ncells,
        wallRoughness: 3.048e-5,
        hydraulicDiameter: 0.1,
        volumeFlags: '0000000',
      }],
      initialRows: [{
        id: 'init-1',
        endCell: ncells,
        ebt: '003' as const,
        pressure: 15.5e6,
        temperature: 560.0,
      }],
      junctionRows: ncells > 1 ? [{
        id: 'jun-1',
        endJunction: ncells - 1,
        junctionArea: 'auto' as const,
        fwdLoss: 0.0,
        revLoss: 0.0,
        junctionFlags: '00000000',
      }] : [],
      junctionControlWord: 1 as 0 | 1,
      junctionInitialConditions: ncells > 1 ? [{
        id: 'junInit-1',
        endJunction: ncells - 1,
        liquidVelOrFlow: 0.0,
        vaporVelOrFlow: 0.0,
        interfaceVel: 0.0,
      }] : [],
      ccflRows: ncells > 1 ? [{
        id: 'ccfl-1',
        endJunction: ncells - 1,
        diameter: 0.0,
        beta: 0.0,
        gasIntercept: 1.0,
        slope: 1.0,
      }] : [],
    };
  };
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, isValid },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(pipeFormSchema),
    defaultValues: {
      name: data.componentName || '',
      componentId: data.componentId || '1000000',
      ncells: 3,
      ...initializeRows(),
    },
  });
  
  // Load saved parameters - only on initial mount or when nodeId changes
  useEffect(() => {
    // Skip if already loaded for this nodeId (prevents isDirty reset on re-renders)
    if (initialLoadDone.current === nodeId) {
      return;
    }
    
    const params = data.parameters as Partial<PipeParameters>;
    if (params && Object.keys(params).length > 0) {
      console.log('🔄 PipeFormSpread - Loading saved parameters:', params);
      initialLoadDone.current = nodeId;  // Mark as loaded
      
      const ncells = params.ncells ?? 3;
      
      // Convert arrays back to spread rows using compression
      const geometryRows = params.xArea && Array.isArray(params.xArea) && params.xLength && params.volume && Array.isArray(params.volume)
        ? compressArraysToGeometryRows(params.xArea, params.xLength, params.volume)
        : [{ id: 'geo-1', endCell: ncells, xArea: 0.5, xLength: 1.0, volume: 0 }];
      
      const angleRows = params.azAngle !== undefined && params.vertAngle !== undefined
        ? compressArraysToAngleRows(
            params.azAngle,
            params.vertAngle,
            params.xElev,
            ncells
          )
        : [{ id: 'ang-1', endCell: ncells, azAngle: 0.0, vertAngle: 90.0 }];
      
      const wallRows = params.wallRoughness !== undefined && params.hydraulicDiameter !== undefined
        ? compressArraysToWallRows(
            params.wallRoughness,
            params.hydraulicDiameter,
            params.volumeFlags ?? '0000000',
            ncells
          )
        : [{ 
            id: 'wall-1', 
            endCell: ncells, 
            wallRoughness: 3.048e-5,
            hydraulicDiameter: 0.1,
            volumeFlags: '0000000'
          }];
      
      const initialRows = params.initialConditions && params.initialConditions.length > 0
        ? compressArraysToInitialRows(params.initialConditions)
        : [{ id: 'init-1', endCell: ncells, ebt: '003' as const, pressure: 15.5e6, temperature: 560.0 }];
      
      const junctionRows = ncells > 1 && params.fwdLoss !== undefined && params.revLoss !== undefined
        ? compressArraysToJunctionRows(
            params.junctionArea,
            params.fwdLoss,
            params.revLoss,
            params.junctionFlags ?? '00000000',
            ncells - 1
          )
        : (ncells > 1 ? [{
            id: 'jun-1',
            endJunction: ncells - 1,
            junctionArea: 'auto' as const,
            fwdLoss: 0.0,
            revLoss: 0.0,
            junctionFlags: '00000000'
          }] : []);
      
      // Load Junction Initial Conditions (Cards 1300-13XX)
      // Compress to spread row format (end junction style)
      let junctionInitialConditions: Array<{
        id: string;
        endJunction: number;
        liquidVelOrFlow: number;
        vaporVelOrFlow: number;
        interfaceVel: number;
      }> = [];
      
      if (params.junctionControl?.conditions && params.junctionControl.conditions.length > 0) {
        const conditions = params.junctionControl.conditions;
        let currentLiquid = conditions[0].liquidVelOrFlow;
        let currentVapor = conditions[0].vaporVelOrFlow;
        let currentInterface = conditions[0].interfaceVel;
        
        for (let i = 0; i < conditions.length; i++) {
          const cond = conditions[i];
          const isLast = i === conditions.length - 1;
          const valueChanged = !isLast && (
            conditions[i + 1].liquidVelOrFlow !== currentLiquid ||
            conditions[i + 1].vaporVelOrFlow !== currentVapor ||
            conditions[i + 1].interfaceVel !== currentInterface
          );
          
          if (valueChanged || isLast) {
            junctionInitialConditions.push({
              id: `junInit-${junctionInitialConditions.length + 1}`,
              endJunction: cond.junctionId,
              liquidVelOrFlow: currentLiquid,
              vaporVelOrFlow: currentVapor,
              interfaceVel: currentInterface,
            });
            
            if (!isLast) {
              currentLiquid = conditions[i + 1].liquidVelOrFlow;
              currentVapor = conditions[i + 1].vaporVelOrFlow;
              currentInterface = conditions[i + 1].interfaceVel;
            }
          }
        }
      } else if (ncells > 1) {
        // If no junction control data, provide default (all zeros)
        junctionInitialConditions = [{
          id: 'junInit-1',
          endJunction: ncells - 1,
          liquidVelOrFlow: 0.0,
          vaporVelOrFlow: 0.0,
          interfaceVel: 0.0,
        }];
      }

      // Load CCFL Data (Cards CCC1401-14XX)
      const ccflRows = ncells > 1 && params.ccflData
        ? compressArraysToCcflRows(
            params.ccflData.junctionDiameter,
            params.ccflData.beta,
            params.ccflData.gasIntercept,
            params.ccflData.slope,
            ncells - 1
          )
        : (ncells > 1 ? [{
            id: 'ccfl-1',
            endJunction: ncells - 1,
            diameter: 0.0,
            beta: 0.0,
            gasIntercept: 1.0,
            slope: 1.0,
          }] : []);

      reset({
        name: data.componentName || '',
        componentId: data.componentId || '1000000',
        ncells,
        geometryRows,
        angleRows,
        wallRows,
        initialRows,
        junctionRows,
        junctionControlWord: params.junctionControl?.controlWord ?? 0,
        junctionInitialConditions,
        ccflRows,
      });
    } else {
      // No saved params, but still mark as loaded to prevent future resets
      initialLoadDone.current = nodeId;
    }
  }, [nodeId, data.parameters, data.componentName, reset]);
  
  const { fields: geometryFields, append: appendGeometry, remove: removeGeometry } = useFieldArray({
    control,
    name: 'geometryRows',
  });
  
  const { fields: angleFields, append: appendAngle, remove: removeAngle } = useFieldArray({
    control,
    name: 'angleRows',
  });
  
  const { fields: wallFields, append: appendWall, remove: removeWall } = useFieldArray({
    control,
    name: 'wallRows',
  });
  
  const { fields: initialFields, append: appendInitial, remove: removeInitial } = useFieldArray({
    control,
    name: 'initialRows',
  });
  
  const { fields: junctionFields, append: appendJunction, remove: removeJunction } = useFieldArray({
    control,
    name: 'junctionRows',
  });
  
  const { fields: junctionInitFields, append: appendJunctionInit, remove: removeJunctionInit } = useFieldArray({
    control,
    name: 'junctionInitialConditions',
  });

  const { fields: ccflFields, append: appendCcfl, remove: removeCcfl } = useFieldArray({
    control,
    name: 'ccflRows',
  });
  
  const ncells = watch('ncells');
  const geometryRows = watch('geometryRows');
  const angleRows = watch('angleRows');
  const wallRows = watch('wallRows');
  const initialRows = watch('initialRows');
  const junctionRows = watch('junctionRows') || [];
  const junctionInitialConditions = watch('junctionInitialConditions') || [];
  const ccflRows = watch('ccflRows') || [];

  // Detect f-flag (CCFL) from junction flags: 0ef0cahs, index 2 = 'f'
  const hasCcflFlag = junctionRows.some(row => row.junctionFlags?.[2] === '1');
  
  // Validate tabs - REQUIRED vs OPTIONAL
  // REQUIRED: Geometry, Initial (must be valid to save)
  const geometryRangeErrors = validateGenericSpreadRows(geometryRows, ncells, 'Geometry');
  
  
  // Also validate A, L, V values for each geometry row
  const geometryValueErrors: string[] = [];
  geometryRows.forEach((row, idx) => {
    const validation = validateGeometryRow(row.xArea, row.xLength, row.volume);
    if (!validation.valid && validation.error) {
      geometryValueErrors.push(`Geometry Row ${idx + 1}: ${validation.error}`);
    }
  });
  
  const geometryErrors = [...geometryRangeErrors, ...geometryValueErrors];
  const initialErrors = validateGenericSpreadRows(initialRows, ncells, 'Initial');
  
  
  // OPTIONAL: Angles, Walls, Advanced (warnings only, can save with default values)
  const angleWarnings = validateGenericSpreadRows(angleRows, ncells, 'Angles');
  const wallWarnings = validateGenericSpreadRows(wallRows, ncells, 'Walls');
  const junctionWarnings = junctionRows.length > 0
    ? validateGenericSpreadRows(junctionRows.map(j => ({ ...j, endCell: j.endJunction })), ncells - 1, 'Junctions')
    : [];
  const junctionInitWarnings = junctionInitialConditions.length > 0
    ? validateGenericSpreadRows(junctionInitialConditions.map(j => ({ ...j, endCell: j.endJunction })), ncells - 1, 'Junction Initial Conditions')
    : [];
  
  // Note: requiredErrors and optionalWarnings are calculated fresh inside onSubmit
  // to avoid stale closure issues. See comment in onSubmit for details.

  // Save form data
  const onSubmit: SubmitHandler<FormData> = (formData) => {
    console.log('📝 PipeFormSpread onSubmit:', formData);
    
    // CRITICAL FIX: Recalculate validation errors using formData (not stale closure values)
    // Previously, requiredErrors/optionalWarnings were captured from render-time, causing stale data issues
    const freshGeometryRangeErrors = validateGenericSpreadRows(formData.geometryRows, formData.ncells, 'Geometry');
    const freshGeometryValueErrors: string[] = [];
    formData.geometryRows.forEach((row, idx) => {
      const validation = validateGeometryRow(row.xArea, row.xLength, row.volume);
      if (!validation.valid && validation.error) {
        freshGeometryValueErrors.push(`Geometry Row ${idx + 1}: ${validation.error}`);
      }
    });
    const freshGeometryErrors = [...freshGeometryRangeErrors, ...freshGeometryValueErrors];
    const freshInitialErrors = validateGenericSpreadRows(formData.initialRows, formData.ncells, 'Initial');
    
    const freshAngleWarnings = validateGenericSpreadRows(formData.angleRows, formData.ncells, 'Angles');
    const freshWallWarnings = validateGenericSpreadRows(formData.wallRows, formData.ncells, 'Walls');
    const freshJunctionRows = formData.junctionRows || [];
    const freshJunctionWarnings = freshJunctionRows.length > 0
      ? validateGenericSpreadRows(freshJunctionRows.map(j => ({ ...j, endCell: j.endJunction })), formData.ncells - 1, 'Junctions')
      : [];
    const freshJunctionInitConditions = formData.junctionInitialConditions || [];
    const freshJunctionInitWarnings = freshJunctionInitConditions.length > 0
      ? validateGenericSpreadRows(freshJunctionInitConditions.map(j => ({ ...j, endCell: j.endJunction })), formData.ncells - 1, 'Junction Initial Conditions')
      : [];
    
    const freshRequiredErrors = [...freshGeometryErrors, ...freshInitialErrors];
    const freshOptionalWarnings = [...freshAngleWarnings, ...freshWallWarnings, ...freshJunctionWarnings, ...freshJunctionInitWarnings];
    
    
    // Validate geometry for each row (but don't modify the data)
    const validationErrors: Array<{ level: 'error' | 'warning'; message: string }> = [];
    
    // Expand rows to arrays - save user input as-is (keep 0 values)
    const xAreaArray = expandToArray(formData.geometryRows, 'xArea', formData.ncells);
    const xLengthArray = expandToArray(formData.geometryRows, 'xLength', formData.ncells);
    const volumeArray = expandToArray(formData.geometryRows, 'volume', formData.ncells);
    
    const azAngleArray = expandToArray(formData.angleRows, 'azAngle', formData.ncells);
    const vertAngleArray = expandToArray(formData.angleRows, 'vertAngle', formData.ncells);
    const xElevArray = expandToArray(formData.angleRows, 'xElev', formData.ncells, true);
    
    const wallRoughnessArray = expandToArray(formData.wallRows, 'wallRoughness', formData.ncells);
    const hydraulicDiameterArray = expandToArray(formData.wallRows, 'hydraulicDiameter', formData.ncells);
    const volumeFlagsArray = expandToArray(formData.wallRows, 'volumeFlags', formData.ncells);
    
    const ebtArray = expandToArray(formData.initialRows, 'ebt', formData.ncells);
    const pressureArray = expandToArray(formData.initialRows, 'pressure', formData.ncells);
    const temperatureArray = expandToArray(formData.initialRows, 'temperature', formData.ncells);
    const qualityArray = expandToArray(formData.initialRows, 'quality', formData.ncells);
    
    // Expand junction rows to arrays (ncells-1 junctions)
    const numJunctions = formData.ncells - 1;
    const junctionRowsMapped = formData.junctionRows 
      ? formData.junctionRows.map(row => ({ ...row, endCell: row.endJunction }))
      : [];
    const junctionAreaArray = junctionRowsMapped.length > 0
      ? expandToArray(junctionRowsMapped, 'junctionArea', numJunctions)
      : Array(numJunctions).fill('auto');
    const fwdLossArray = junctionRowsMapped.length > 0
      ? expandToArray(junctionRowsMapped, 'fwdLoss', numJunctions)
      : Array(numJunctions).fill(0);
    const revLossArray = junctionRowsMapped.length > 0
      ? expandToArray(junctionRowsMapped, 'revLoss', numJunctions)
      : Array(numJunctions).fill(0);
    const junctionFlagsArray = junctionRowsMapped.length > 0
      ? expandToArray(junctionRowsMapped, 'junctionFlags', numJunctions)
      : Array(numJunctions).fill('00000000');
    
    const vertAngle = allSame(vertAngleArray as number[]) ? vertAngleArray[0] : vertAngleArray;
    
    // Process xElev - only include if at least one value is defined
    const hasElevation = xElevArray.some(v => v !== undefined);
    const finalXElev = hasElevation 
      ? xElevArray.map(v => v ?? 0) as number[]
      : undefined;
    
    // Save geometry as-is (keep 0 values for auto-calculation)
    const pipeParams: PipeParameters = {
      name: formData.name,
      ncells: formData.ncells,
      xArea: xAreaArray as number[],     // Keep 0 if user entered 0
      xLength: xLengthArray as number[], // Keep 0 if user entered 0
      volume: volumeArray as number[],   // Keep 0 if user entered 0
      azAngle: allSame(azAngleArray as number[]) ? (azAngleArray[0] as number) : (azAngleArray as number[]),
      vertAngle: vertAngle as number | number[],
      xElev: finalXElev,
      wallRoughness: allSame(wallRoughnessArray as number[]) ? (wallRoughnessArray[0] as number) : (wallRoughnessArray as number[]),
      hydraulicDiameter: allSame(hydraulicDiameterArray as number[]) ? (hydraulicDiameterArray[0] as number) : (hydraulicDiameterArray as number[]),
      volumeFlags: allSame(volumeFlagsArray as string[]) ? (volumeFlagsArray[0] as string) : (volumeFlagsArray as string[]),
      // Junction area: convert 'auto' to undefined for each element, only save if not all auto
      junctionArea: (() => {
        const hasNonAuto = junctionAreaArray.some(v => v !== 'auto');
        if (!hasNonAuto) return undefined;
        const numericArray = junctionAreaArray.map(v => v === 'auto' ? 0 : (v as number));
        return allSame(numericArray) ? numericArray[0] : numericArray;
      })(),
      fwdLoss: allSame(fwdLossArray) ? (fwdLossArray[0] as number) : (fwdLossArray as number[]),
      revLoss: allSame(revLossArray) ? (revLossArray[0] as number) : (revLossArray as number[]),
      junctionFlags: allSame(junctionFlagsArray) ? (junctionFlagsArray[0] as string) : (junctionFlagsArray as string[]),
      initialConditions: ebtArray.map((ebt, idx) => {
        const ebtValue = ebt as '001' | '002' | '003' | '004' | '005';
        // EBT 002: use quality, others: use temperature
        if (ebtValue === '002') {
          return {
            ebt: ebtValue,
            pressure: pressureArray[idx] as number,
            temperature: undefined,
            quality: qualityArray[idx] as number,
            boronConcentration: 0,
          };
    } else {
          return {
            ebt: ebtValue,
            pressure: pressureArray[idx] as number,
            temperature: temperatureArray[idx] as number,
            quality: undefined,
            boronConcentration: 0,
          };
        }
      }),
      // Junction Initial Conditions (Cards 1300-13XX)
      junctionControl: formData.junctionInitialConditions && formData.junctionInitialConditions.length > 0
        ? (() => {
            // Expand junction initial conditions using Sequential Expansion Format
            const junctionInitRowsMapped = formData.junctionInitialConditions.map(row => ({
              ...row,
              endCell: row.endJunction  // Map endJunction to endCell for expandToArray
            }));
            
            const liquidArray = expandToArray(junctionInitRowsMapped, 'liquidVelOrFlow', numJunctions);
            const vaporArray = expandToArray(junctionInitRowsMapped, 'vaporVelOrFlow', numJunctions);
            const interfaceArray = expandToArray(junctionInitRowsMapped, 'interfaceVel', numJunctions);
            
            return {
              controlWord: formData.junctionControlWord ?? 0,
              conditions: liquidArray.map((liquid, idx) => ({
                liquidVelOrFlow: liquid as number,
                vaporVelOrFlow: vaporArray[idx] as number,
                interfaceVel: interfaceArray[idx] as number,
                junctionId: idx + 1,
              }))
            };
          })()
        : undefined,
      // CCFL Data (Cards CCC1401-14XX)
      // Save only when f-flag is set and user has CCFL rows
      ccflData: (() => {
        // Check if any junction has f-flag=1
        const fFlagActive = junctionFlagsArray.some(f => (f as string)?.[2] === '1');
        const ccflRowsData = formData.ccflRows;
        if (fFlagActive && ccflRowsData && ccflRowsData.length > 0) {
          const ccflMapped = ccflRowsData.map(row => ({ ...row, endCell: row.endJunction }));
          const diameterArray = expandToArray(ccflMapped, 'diameter', numJunctions);
          const betaArray = expandToArray(ccflMapped, 'beta', numJunctions);
          const gasInterceptArray = expandToArray(ccflMapped, 'gasIntercept', numJunctions);
          const slopeArray = expandToArray(ccflMapped, 'slope', numJunctions);
          return {
            junctionDiameter: allSame(diameterArray as number[]) ? (diameterArray[0] as number) : (diameterArray as number[]),
            beta: allSame(betaArray as number[]) ? (betaArray[0] as number) : (betaArray as number[]),
            gasIntercept: allSame(gasInterceptArray as number[]) ? (gasInterceptArray[0] as number) : (gasInterceptArray as number[]),
            slope: allSame(slopeArray as number[]) ? (slopeArray[0] as number) : (slopeArray as number[]),
          };
        }
        return undefined;  // File generator will output defaults
      })(),
    };

    console.log('💾 Saving PIPE Parameters:', pipeParams);
    
    // Combine validation errors and warnings using FRESH values (not stale closure)
    freshRequiredErrors.forEach(err => validationErrors.push({ level: 'error', message: err }));
    freshOptionalWarnings.forEach(warn => validationErrors.push({ level: 'warning', message: `[Optional] ${warn}` }));
    
    const hasErrors = freshRequiredErrors.length > 0;
    const status = hasErrors ? 'error' : (freshOptionalWarnings.length > 0 ? 'incomplete' : 'valid');
    
    
    // Separate errors and warnings for proper display
    const errorsOnly = validationErrors.filter(e => e.level === 'error');
    const warningsOnly = validationErrors.filter(e => e.level === 'warning');
    
    updateNodeData(nodeId, {
      componentName: formData.name,
      componentId: formData.componentId,  // Use form's componentId (may be updated by user)
      parameters: pipeParams,
      status,
      errors: errorsOnly,
      warnings: warningsOnly,
    });
    

    console.log('✅ Parameters saved successfully!');
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
  }, [handleSubmit, setFormSubmitHandler, getValues, isDirty, isValid, errors]);

  useEffect(() => {
    setPropertyFormState({
      isDirty,
      isValid,
    });
  }, [isDirty, isValid, setPropertyFormState]);
  
  // Helper functions
  function expandToArray<T extends { endCell: number }, K extends keyof T>(
    rows: T[],
    key: K,
    totalCells: number,
    optional = false
  ): Array<T[K] | undefined> {
    const result: Array<T[K] | undefined> = [];
    let currentRowIdx = 0;
    
    for (let cell = 1; cell <= totalCells; cell++) {
      while (currentRowIdx < rows.length && rows[currentRowIdx].endCell < cell) {
        currentRowIdx++;
      }
      
      if (currentRowIdx < rows.length && rows[currentRowIdx].endCell >= cell) {
        result.push(rows[currentRowIdx][key]);
    } else {
        result.push(optional ? undefined : (rows[0] && rows[0][key]));
      }
    }
    
    return result;
  }
  
  function allSame<T>(arr: T[]): boolean {
    if (arr.length === 0) return true;
    return arr.every(v => v === arr[0]);
  }
  
  const getCellRange = (endCell: number, index: number, rows: Array<{ endCell?: number; endJunction?: number }>): string => {
    const actualEndCell = endCell || (rows[index] as any).endJunction;
    const prevEndCell = index === 0 ? 0 : ((rows[index - 1] as any).endCell || (rows[index - 1] as any).endJunction || 0);
    const startCell = prevEndCell + 1;
    return startCell === actualEndCell ? `${startCell}` : `${startCell}-${actualEndCell}`;
  };
  
  return (
    <Box>
      <form onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}>
      {/* Basic Information */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1, display: 'block', letterSpacing: '0.08em' }}>
          Basic Information
        </Typography>

        <Box display="flex" flexDirection="column" gap={1}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Component Name"
              size="small"
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
          )}
        />
        
        <ComponentIdField
          nodeId={nodeId}
          currentComponentId={watch('componentId')}
          componentType="pipe"
          onComponentIdChange={(newId) => {
            // Update the form's componentId field when changed
            setValue('componentId', newId, { shouldDirty: true, shouldValidate: true });
          }}
        />
        
        <Controller
          name="ncells"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              type="number"
              label="Number of Cells"
              size="small"
              error={!!errors.ncells}
              helperText={errors.ncells?.message}
              fullWidth
              inputProps={{ min: 1, max: 999 }}
              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
            />
          )}
        />
        </Box>
      </Box>
      
      <Divider sx={{ my: 1 }} />

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Geometry {geometryErrors.length > 0 ? <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} /> : <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />} *</Box>} />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Angles {angleWarnings.length > 0 ? <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} /> : <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}</Box>} />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Walls {wallWarnings.length > 0 ? <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} /> : <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}</Box>} />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Initial {initialErrors.length > 0 ? <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} /> : <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />} *</Box>} />
          <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>Advanced {junctionWarnings.length > 0 ? <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} /> : <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}</Box>} />
        </Tabs>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          * Required tabs (must be valid to save) | <WarningIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /> Optional (warnings only, defaults will be used)
        </Typography>
      </Box>
        
      {/* Tab Panels */}
      <Box sx={{ minHeight: 400 }}>
        {/* Tab 0: Geometry */}
        {activeTab === 0 && (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Geometry Parameters</Typography>
              
              <Chip
                label={`${geometryRows[geometryRows.length - 1]?.endCell || 0}/${ncells} cells`}
                color={geometryRows[geometryRows.length - 1]?.endCell === ncells ? 'success' : 'error'}
            size="small"
              />
              
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  const lastEnd = geometryRows[geometryRows.length - 1]?.endCell || 0;
                  appendGeometry({
                    id: `geo-${Date.now()}`,
                    endCell: Math.min(lastEnd + 1, ncells),
                    xArea: 0.5,
                    xLength: 1.0,
                    volume: 0,  // 0 = auto-calculate
                  });
                }}
                variant="outlined"
                size="small"
              >
                Add Row
              </Button>
        </Box>
        
            <Alert severity="info" sx={{ mb: 1 }}>
              <strong>MARS Rule:</strong> Exactly one of Area, Length, or Volume can be 0 (auto-calculated). 
              If all three are non-zero, they must satisfy V ≈ A×L (relative error ≤ 1e-6).
          </Alert>
        
            {geometryErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {geometryErrors.map((err, idx) => (
                  <div key={idx}>{err}</div>
                ))}
          </Alert>
        )}
        
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cells</TableCell>
                    <TableCell>End Cell</TableCell>
                    <TableCell>Area (m²)</TableCell>
                    <TableCell>Length (m)</TableCell>
                    <TableCell>Volume (m³)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geometryFields.map((field, index) => {
                    const row = geometryRows[index];
                    const validation = validateGeometryRow(row.xArea, row.xLength, row.volume);
                    
                    return (
                    <TableRow key={field.id} sx={{ bgcolor: validation.valid ? 'inherit' : 'error.light' }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {getCellRange(geometryRows[index].endCell, index, geometryRows)}
                        </Typography>
                      </TableCell>
                      <TableCell>
          <Controller
                          name={`geometryRows.${index}.endCell`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                size="small"
                              fullWidth
                              inputProps={{ min: 1, max: ncells }}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
              />
            )}
          />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Controller
                            name={`geometryRows.${index}.xArea`}
            control={control}
            render={({ field }) => (
              <TextField
                type="number"
                size="small"
                                fullWidth
                                value={field.value === 0 ? '0' : (field.value ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  // Allow intermediate decimal input
                                  if (val === '' || val === '0' || val === '0.') {
                                    field.onChange(0);
                                  } else if (val.match(/^\d*\.?\d*$/)) {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 0 : parsed);
                                  }
                                }}
                                inputProps={numberInputProps}
              />
            )}
          />
                          {row.xArea === 0 && validation.calculated?.field === 'xArea' && (
                            <Tooltip title={`Auto: ${validation.calculated.value.toExponential(3)}`}>
                              <Chip label="A" size="small" color="success" />
                            </Tooltip>
                          )}
        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Controller
                            name={`geometryRows.${index}.xLength`}
            control={control}
            render={({ field }) => (
              <TextField
                type="number"
                size="small"
                                fullWidth
                                value={field.value === 0 ? '0' : (field.value ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  // Allow intermediate decimal input
                                  if (val === '' || val === '0' || val === '0.') {
                                    field.onChange(0);
                                  } else if (val.match(/^\d*\.?\d*$/)) {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 0 : parsed);
                                  }
                                }}
                inputProps={numberInputProps}
              />
            )}
          />
                          {row.xLength === 0 && validation.calculated?.field === 'xLength' && (
                            <Tooltip title={`Auto: ${validation.calculated.value.toExponential(3)}`}>
                              <Chip label="L" size="small" color="success" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Controller
                            name={`geometryRows.${index}.volume`}
            control={control}
            render={({ field }) => (
              <TextField
                type="number"
                size="small"
                                fullWidth
                                value={field.value === 0 ? '0' : (field.value ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  // Allow intermediate decimal input
                                  if (val === '' || val === '0' || val === '0.') {
                                    field.onChange(0);
                                  } else if (val.match(/^\d*\.?\d*$/)) {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 0 : parsed);
                                  }
                                }}
                inputProps={numberInputProps}
              />
            )}
          />
                          {row.volume === 0 && validation.calculated?.field === 'volume' && (
                            <Tooltip title={`Auto: ${validation.calculated.value.toExponential(3)}`}>
                              <Chip label="V" size="small" color="success" />
                            </Tooltip>
                          )}
        </Box>
                      </TableCell>
                      <TableCell>
                        {validation.valid ? (
                          validation.calculated ? (
                            <Chip label={`Auto-${validation.calculated.field[0].toUpperCase()}`} color="info" size="small" />
                          ) : (
                            <Chip label="✓ Consistent" color="success" size="small" />
                          )
                        ) : (
                          <Tooltip title={validation.error}>
                            <Chip label="✗ Error" color="error" size="small" />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
              size="small"
                          onClick={() => removeGeometry(index)}
                          disabled={geometryFields.length === 1}
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
          </Box>
        )}
        
        {/* Tab 1: Angles */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Angle Parameters</Typography>
              <Chip
                label={`${angleRows[angleRows.length - 1]?.endCell || 0}/${ncells} cells`}
                color={angleRows[angleRows.length - 1]?.endCell === ncells ? 'success' : 'error'}
              size="small"
              />
              <Button
                startIcon={<AddIcon />}
              onClick={() => {
                  const lastEnd = angleRows[angleRows.length - 1]?.endCell || 0;
                  appendAngle({
                    id: `ang-${Date.now()}`,
                    endCell: Math.min(lastEnd + 1, ncells),
                    azAngle: 0.0,
                    vertAngle: 90.0,
                });
              }}
                variant="outlined"
                size="small"
            >
                Add Row
              </Button>
        </Box>
        
            {angleWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <strong>Optional Tab:</strong> These are warnings only. Default values will be used if incomplete.
                {angleWarnings.map((warn, idx) => (
                  <div key={idx}>{warn}</div>
                ))}
          </Alert>
        )}
        
            <TableContainer component={Paper}>
              <Table size="small">
            <TableHead>
              <TableRow>
                    <TableCell>Cells</TableCell>
                    <TableCell>End Cell</TableCell>
                    <TableCell>Azimuthal (°)</TableCell>
                    <TableCell>Vertical (°)</TableCell>
                    <TableCell>Elevation (m)</TableCell>
                    <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
                  {angleFields.map((field, index) => (
                  <TableRow key={field.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {getCellRange(angleRows[index].endCell, index, angleRows)}
                        </Typography>
                      </TableCell>
                    <TableCell>
          <Controller
                          name={`angleRows.${index}.endCell`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="number"
                size="small"
                              fullWidth
                              inputProps={{ min: 1, max: ncells }}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                          name={`angleRows.${index}.azAngle`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            type="number"
                            size="small"
                              fullWidth
                              value={field.value ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(0.0);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 0.0 : parsed);
                                }
                            }}
                inputProps={numberInputProps}
              />
            )}
          />
                    </TableCell>
                    <TableCell>
          <Controller
                          name={`angleRows.${index}.vertAngle`}
            control={control}
            render={({ field }) => (
              <TextField
                            type="number"
                            size="small"
                              fullWidth
                value={field.value ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(90.0);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 90.0 : parsed);
                                }
                            }}
                            inputProps={numberInputProps}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                        <Controller
                          name={`angleRows.${index}.xElev`}
                          control={control}
                          render={({ field }) => (
                              <TextField
                type="number"
                size="small"
                              fullWidth
                              value={field.value ?? ''}
                              placeholder="Optional"
                                onChange={(e) => {
                                  const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                  } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                  }
                                }}
                                onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? undefined : parsed);
                                  }
                                }}
                inputProps={numberInputProps}
              />
            )}
          />
                      </TableCell>
                      <TableCell>
                            <IconButton
                              size="small"
                          onClick={() => removeAngle(index)}
                          disabled={angleFields.length === 1}
                            >
                          <DeleteIcon fontSize="small" />
                            </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
        </Box>
        )}
        
        {/* Tab 2: Walls */}
        {activeTab === 2 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Wall Parameters</Typography>
            <Chip
                label={`${wallRows[wallRows.length - 1]?.endCell || 0}/${ncells} cells`}
                color={wallRows[wallRows.length - 1]?.endCell === ncells ? 'success' : 'error'}
              size="small"
              />
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  const lastEnd = wallRows[wallRows.length - 1]?.endCell || 0;
                  appendWall({
                    id: `wall-${Date.now()}`,
                    endCell: Math.min(lastEnd + 1, ncells),
                    wallRoughness: 3.048e-5,
                    hydraulicDiameter: 0.1,
                    volumeFlags: '0000000',
                  });
                }}
                variant="outlined"
                size="small"
              >
                Add Row
              </Button>
          </Box>
          
            {wallWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <strong>Optional Tab:</strong> These are warnings only. Default values will be used if incomplete.
                {wallWarnings.map((warn, idx) => (
                  <div key={idx}>{warn}</div>
                ))}
              </Alert>
            )}
            
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cells</TableCell>
                    <TableCell>End Cell</TableCell>
                    <TableCell>Wall Roughness (m)</TableCell>
                    <TableCell>Hydraulic Dia. (m)</TableCell>
                    <TableCell>Volume Flags</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wallFields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {getCellRange(wallRows[index].endCell, index, wallRows)}
                        </Typography>
                      </TableCell>
                    <TableCell>
                      <Controller
                          name={`wallRows.${index}.endCell`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                              fullWidth
                              inputProps={{ min: 1, max: ncells }}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`wallRows.${index}.wallRoughness`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              type="number"
                              size="small"
                              fullWidth
                            value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(3.048e-5);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 3.048e-5 : parsed);
                                }
                              }}
                              inputProps={numberInputProps}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`wallRows.${index}.hydraulicDiameter`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                            type="number"
                            size="small"
                              fullWidth
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(0.1);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 0.1 : parsed);
                                }
                              }}
                            inputProps={numberInputProps}
                          />
                        )}
                      />
                    </TableCell>
                      <TableCell>
                        <Controller
                          name={`wallRows.${index}.volumeFlags`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              size="small"
                              fullWidth
                              inputProps={{ maxLength: 7 }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
            <IconButton
              size="small"
                          onClick={() => removeWall(index)}
                          disabled={wallFields.length === 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        
        {/* Tab 3: Initial Conditions */}
        {activeTab === 3 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Initial Conditions</Typography>
              <Chip
                label={`${initialRows[initialRows.length - 1]?.endCell || 0}/${ncells} cells`}
                color={initialRows[initialRows.length - 1]?.endCell === ncells ? 'success' : 'error'}
                size="small"
              />
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  const lastEnd = initialRows[initialRows.length - 1]?.endCell || 0;
                  appendInitial({
                    id: `init-${Date.now()}`,
                    endCell: Math.min(lastEnd + 1, ncells),
                  ebt: '003',
                    pressure: 15.5e6,
                    temperature: 560.0,
                });
              }}
                variant="outlined"
                size="small"
            >
                Add Row
              </Button>
              <Button
                startIcon={<ContentPasteIcon />}
                onClick={() => setImportDialogOpen(true)}
                variant="outlined"
                size="small"
              >
                Import
              </Button>
        </Box>
        
            {initialErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {initialErrors.map((err, idx) => (
                  <div key={idx}>{err}</div>
                ))}
          </Alert>
        )}
        
            <TableContainer component={Paper}>
              <Table size="small">
            <TableHead>
              <TableRow>
                    <TableCell>Cells</TableCell>
                    <TableCell>End Cell</TableCell>
                    <TableCell>EBT</TableCell>
                    <TableCell>Pressure (Pa)</TableCell>
                    <TableCell>Temp (K) / Quality</TableCell>
                    <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
                  {initialFields.map((field, index) => (
                  <TableRow key={field.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {getCellRange(initialRows[index].endCell, index, initialRows)}
                        </Typography>
                      </TableCell>
                    <TableCell>
                      <Controller
                          name={`initialRows.${index}.endCell`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                              fullWidth
                              inputProps={{ min: 1, max: ncells }}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                          name={`initialRows.${index}.ebt`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            select
                            size="small"
                              fullWidth
                          >
                            <MenuItem value="001">001</MenuItem>
                            <MenuItem value="002">002</MenuItem>
                            <MenuItem value="003">003</MenuItem>
                            <MenuItem value="004">004</MenuItem>
                            <MenuItem value="005">005</MenuItem>
                          </TextField>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                        <Controller
                          name={`initialRows.${index}.pressure`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                            type="number"
                            size="small"
                              fullWidth
                              value={field.value ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(15.5e6);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 15.5e6 : parsed);
                                }
                            }}
                            inputProps={numberInputProps}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      {initialRows[index]?.ebt === '002' ? (
                        // EBT 002: Quality input (0~1)
                      <Controller
                          name={`initialRows.${index}.quality`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                              type="number"
                              size="small"
                              fullWidth
                            value={field.value ?? ''}
                              label="Quality"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(0.0);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 0.0 : Math.max(0, Math.min(1, parsed)));
                                }
                              }}
                              inputProps={{ ...numberInputProps, min: 0, max: 1, step: 0.1 }}
                            />
                          )}
                        />
                      ) : (
                        // EBT 001, 003, 004, 005: Temperature input
                        <Controller
                          name={`initialRows.${index}.temperature`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                            type="number"
                            size="small"
                              fullWidth
                              value={field.value ?? ''}
                              label="Temp (K)"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(undefined);
                                } else {
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '-' || val === '.') {
                                  field.onChange(560.0);
                                } else {
                                  const parsed = parseFloat(val);
                                  field.onChange(isNaN(parsed) ? 560.0 : parsed);
                                }
                            }}
                            inputProps={numberInputProps}
                          />
                        )}
                      />
                      )}
                    </TableCell>
                      <TableCell>
                          <IconButton
                            size="small"
                          onClick={() => removeInitial(index)}
                          disabled={initialFields.length === 1}
                          >
                          <DeleteIcon fontSize="small" />
                          </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <MarsCardImportDialog
              open={importDialogOpen}
              onClose={() => setImportDialogOpen(false)}
              onApply={(parsed: ParsedInitialCondition[]) => {
                // 기존 initialRows 전체 교체
                const newRows = parsed.map((row, idx) => ({
                  id: `init-import-${Date.now()}-${idx}`,
                  endCell: row.endCell,
                  ebt: row.ebt,
                  pressure: row.pressure,
                  ...(row.temperature !== undefined && { temperature: row.temperature }),
                  ...(row.quality !== undefined && { quality: row.quality }),
                }));
                // remove all → setValue로 한 번에 교체
                setValue('initialRows', newRows, { shouldDirty: true, shouldValidate: true });
              }}
              title="Initial Conditions (CCC1201)"
            />
          </Box>
        )}

        {/* Tab 4: Advanced (Junctions) */}
        {activeTab === 4 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Junction Parameters</Typography>
              <Chip
                label={`${junctionRows[junctionRows.length - 1]?.endJunction || 0}/${ncells - 1} junctions`}
                color={(junctionRows[junctionRows.length - 1]?.endJunction || 0) === ncells - 1 ? 'success' : 'warning'}
                size="small"
              />
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  const lastEnd = junctionRows[junctionRows.length - 1]?.endJunction || 0;
                  appendJunction({
                    id: `jun-${Date.now()}`,
                    endJunction: Math.min(lastEnd + 1, ncells - 1),
                    junctionArea: 'auto',
                    fwdLoss: 0.0,
                    revLoss: 0.0,
                    junctionFlags: '00000000',
                  });
                }}
                variant="outlined"
                size="small"
                disabled={ncells < 2}
              >
                Add Row
              </Button>
            </Box>
            
            {junctionWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <strong>Optional Tab:</strong> These are warnings only. Default values will be used if incomplete.
                {junctionWarnings.map((warn, idx) => (
                  <div key={idx}>{warn}</div>
                ))}
              </Alert>
            )}
            
            {ncells < 2 ? (
              <Alert severity="info">
                Junctions require at least 2 cells. Current cells: {ncells}
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Junctions</TableCell>
                      <TableCell>End Junction</TableCell>
                      <TableCell>Area (m²)</TableCell>
                      <TableCell>Fwd Loss</TableCell>
                      <TableCell>Rev Loss</TableCell>
                      <TableCell>Flags</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {junctionFields.map((field, index) => (
                      <TableRow key={field.id}>
                    <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {getCellRange(0, index, junctionRows)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                        <Controller
                            name={`junctionRows.${index}.endJunction`}
                          control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                type="number"
                                size="small"
                                fullWidth
                                inputProps={{ min: 1, max: ncells - 1 }}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`junctionRows.${index}.junctionArea`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={field.value === 'auto' ? '' : (field.value ?? '')}
                                placeholder="auto"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    field.onChange('auto');
                                  } else if (val === '-' || val === '.') {
                                    // Allow intermediate input
                                    return;
                                  } else {
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed)) {
                                      field.onChange(parsed);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '.') {
                                    field.onChange('auto');
                                  } else {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 'auto' : parsed);
                                  }
                                }}
                                inputProps={numberInputProps}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`junctionRows.${index}.fwdLoss`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '.') {
                                    field.onChange(undefined);
                                  } else {
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed)) {
                                      field.onChange(parsed);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '.') {
                                    field.onChange(0.0);
                                  } else {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 0.0 : parsed);
                                  }
                                }}
                                inputProps={numberInputProps}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`junctionRows.${index}.revLoss`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                type="number"
                                size="small"
                                fullWidth
                                value={field.value ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '.') {
                                    field.onChange(undefined);
                                  } else {
                                    const parsed = parseFloat(val);
                                    if (!isNaN(parsed)) {
                                      field.onChange(parsed);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '.') {
                                    field.onChange(0.0);
                                  } else {
                                    const parsed = parseFloat(val);
                                    field.onChange(isNaN(parsed) ? 0.0 : parsed);
                                  }
                                }}
                                inputProps={numberInputProps}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`junctionRows.${index}.junctionFlags`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                size="small"
                                fullWidth
                                inputProps={{ maxLength: 8 }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                            <IconButton
                              size="small"
                            onClick={() => removeJunction(index)}
                            disabled={junctionFields.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                    </TableCell>
                  </TableRow>
                    ))}
            </TableBody>
          </Table>
        </TableContainer>
            )}
            
            {/* Junction Initial Conditions (Cards 1300-13XX) */}
            <Divider sx={{ my: 1.5 }} />
            
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>Junction Initial Conditions (Cards 1300-13XX)</Typography>
                {junctionInitialConditions.length > 0 && (
                  <Chip
                    label={`${junctionInitialConditions[junctionInitialConditions.length - 1]?.endJunction || 0}/${ncells - 1} junctions`}
                    color={(junctionInitialConditions[junctionInitialConditions.length - 1]?.endJunction || 0) === ncells - 1 ? 'success' : 'warning'}
                    size="small"
                  />
                )}
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const lastEnd = junctionInitFields.length > 0 
                      ? (junctionInitFields[junctionInitFields.length - 1] as any).endJunction 
                      : 0;
                    appendJunctionInit({
                      id: `junInit-${Date.now()}`,
                      endJunction: Math.min(lastEnd + 1, ncells - 1),
                      liquidVelOrFlow: 0.0,
                      vaporVelOrFlow: 0.0,
                      interfaceVel: 0.0,
                    });
                  }}
                  variant="outlined"
                  size="small"
                  disabled={ncells < 2}
                >
                  Add Row
                </Button>
                            </Box>
              
              {/* Control Word (Card 1300) */}
              <Box sx={{ mb: 1 }}>
                <Controller
                  name="junctionControlWord"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Control Word (Card 1300)"
                      size="small"
                      fullWidth
                      helperText="0: Velocity (m/s), 1: Mass Flow (kg/s)"
                    >
                      <MenuItem value={0}>0 - Velocity (m/s)</MenuItem>
                      <MenuItem value={1}>1 - Mass Flow (kg/s)</MenuItem>
                    </TextField>
                  )}
                />
                      </Box>
              
              {junctionInitWarnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {junctionInitWarnings.map((warn, idx) => (
                    <div key={idx}>{warn}</div>
                  ))}
                </Alert>
              )}
              
              <Alert severity="info" sx={{ mb: 1 }}>
                <strong>Note:</strong> For single-phase problems using velocity, enter the same value for both liquid and vapor. 
                For mass flow, enter the value only for the relevant phase and use 0 for the other phase.
              </Alert>
              
              {ncells < 2 ? (
                <Alert severity="info">
                  Junction initial conditions require at least 2 cells. Current cells: {ncells}
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Junctions</TableCell>
                        <TableCell>End Junction</TableCell>
                        <TableCell>Liquid (W1)</TableCell>
                        <TableCell>Vapor (W2)</TableCell>
                        <TableCell>Interface (W3)</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {junctionInitFields.map((field, index) => {
                        const junctionInitConditions = watch('junctionInitialConditions') || [];
                        const row = junctionInitConditions[index];
                        
                        return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {getCellRange(row?.endJunction || 1, index, junctionInitConditions)}
                            </Typography>
                          </TableCell>
                    <TableCell>
                      <Controller
                              name={`junctionInitialConditions.${index}.endJunction`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                                  fullWidth
                                  inputProps={{ min: 1, max: ncells - 1 }}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              name={`junctionInitialConditions.${index}.liquidVelOrFlow`}
                              control={control}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  type="number"
                                  size="small"
                                  fullWidth
                            inputProps={numberInputProps}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                              name={`junctionInitialConditions.${index}.vaporVelOrFlow`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                                  fullWidth
                            inputProps={numberInputProps}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                              name={`junctionInitialConditions.${index}.interfaceVel`}
                        control={control}
                        render={({ field }) => (
                          <Tooltip title="Not implemented in MARS, always 0" placement="top">
                            <TextField
                              {...field}
                              type="number"
                              size="small"
                              fullWidth
                              disabled
                              inputProps={numberInputProps}
                              value={0}
                            />
                          </Tooltip>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                          <IconButton
                            size="small"
                              onClick={() => removeJunctionInit(index)}
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
              )}
            </Box>

            {/* CCFL Data (Cards CCC1401-14XX) — shown only when f-flag=1 */}
            {hasCcflFlag && (
            <Box sx={{ mt: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>CCFL Data (Cards CCC1401-14XX)</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => appendCcfl({
                    id: `ccfl-${Date.now()}`,
                    endJunction: ncells - 1,
                    diameter: 0.0,
                    beta: 0.0,
                    gasIntercept: 1.0,
                    slope: 1.0,
                  })}
                >
                  Add Row
                </Button>
              </Box>
              <Alert severity="info" sx={{ mb: 1 }}>
                f-flag=1 detected. Configure CCFL correlation parameters per junction.
                Diameter=0 means auto-calculate from junction area.
              </Alert>
              {ncells < 2 ? (
                <Alert severity="warning">Need at least 2 cells for junctions</Alert>
              ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Junctions</TableCell>
                <TableCell>
                  <Tooltip title="End junction number for this row's values">
                    <span>End Jun</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title="Junction diameter (m). 0 = auto-calculate from area">
                    <span>Diameter (m)</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title="Flooding correlation form: 0=Wallis, 1=Kutateladze, 0~1=Bankoff interpolation">
                    <span>β (form)</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title="Gas intercept c (default 1.0, must > 0)">
                    <span>c (intercept)</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title="Slope m (default 1.0, must > 0)">
                    <span>m (slope)</span>
                  </Tooltip>
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ccflFields.map((field, index) => {
                const ccflRowsWatched = ccflRows;
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Chip
                        label={getCellRange(ccflRowsWatched[index]?.endJunction || 1, index,
                          ccflRowsWatched.map(r => ({ endJunction: r.endJunction })))}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`ccflRows.${index}.endJunction`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ min: 1, max: ncells - 1 }}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`ccflRows.${index}.diameter`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={numberInputProps}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`ccflRows.${index}.beta`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ ...numberInputProps, min: 0, max: 1, step: 0.1 }}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`ccflRows.${index}.gasIntercept`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ ...numberInputProps, min: 0.001, step: 0.1 }}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Controller
                        name={`ccflRows.${index}.slope`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ ...numberInputProps, min: 0.001, step: 0.1 }}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeCcfl(index)}
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
              )}
            </Box>
            )}
          </Box>
        )}
      </Box>
      </form>
    </Box>
  );
};

export default PipeFormSpread;
