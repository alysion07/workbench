/**
 * Control Variables Tab
 * Cards 205CCCNN: Control System
 * Supports 21 control variable types including PUMPCTL/STEAMCTL/FEEDCTL
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Alert,
  Grid,
  Divider,
  Tooltip,
  Chip,
  Autocomplete,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import {
  ControlVariable,
  ControlComponentType,
  ConstantControlVariable,
  NonConstantControlVariable,
  SumData,
  TripUnitData,
  TripDelayData,
  MultData,
  DivData,
  SingleVariableData,
  FunctionData,
  StdFunctionData,
  PropIntData,
  LagData,
  LeadLagData,
  PowerIData,
  PowerRData,
  PowerXData,
  DelayData,
  DigitalData,
  PumpctlData,
  SteamctlData,
  FeedctlData,
  ShaftData,
  ShaftAttachedComponent,
  ShaftGeneratorData,
  VariableRef,
  GeneralTable,
  isConstantControlVariable,
  isNonConstantControlVariable
} from '@/types/mars';
import { useStore } from '@/stores/useStore';
import { NumericTextField } from '@/components/common/NumericTextField';
import { formatNumber } from '@/utils/formatNumber';

interface ControlVariablesTabProps {
  controlVariables: ControlVariable[];
  onChange: (controlVariables: ControlVariable[]) => void;
}

// MARS variable name classification for dynamic parameter input
const VOLUME_VARIABLES = ['p', 'tempf', 'tempg', 'voidf', 'voidg', 'rhof', 'rhog', 'sattemp', 'boron', 'quals', 'q'];
const JUNCTION_VARIABLES = ['mflowj'];
const ALL_VARIABLE_NAMES = ['time', 'cntrlvar', ...VOLUME_VARIABLES, ...JUNCTION_VARIABLES];

type ParamInputType = 'time' | 'cntrlvar' | 'volume' | 'junction' | 'number';

const getParamInputType = (variableName: string): ParamInputType => {
  if (variableName === 'time') return 'time';
  if (variableName === 'cntrlvar') return 'cntrlvar';
  if (VOLUME_VARIABLES.includes(variableName)) return 'volume';
  if (JUNCTION_VARIABLES.includes(variableName)) return 'junction';
  return 'number';
};

// Supported types (ordered by usage frequency in SMART.i)
const SUPPORTED_TYPES: ControlComponentType[] = [
  'CONSTANT', 'SUM', 'FUNCTION', 'TRIPUNIT', 'TRIPDLAY',
  'MULT', 'PROP-INT', 'INTEGRAL', 'STDFNCTN',
  'DIV', 'DIFFRENI', 'DIFFREND', 'DELAY', 'DIGITAL',
  'POWERI', 'POWERR', 'POWERX', 'LAG', 'LEAD-LAG',
  'PUMPCTL', 'STEAMCTL', 'FEEDCTL', 'SHAFT'
];

// Standard function names for STDFNCTN type
const STD_FUNCTION_NAMES = ['ABS', 'SQRT', 'EXP', 'LOG', 'SIN', 'COS', 'TAN', 'ATAN', 'MIN', 'MAX'] as const;

// Empty variable reference
const emptyVarRef: VariableRef = { variableName: '', parameterCode: 0 };

// Empty templates
const emptyConstant: ConstantControlVariable = {
  number: 101,
  name: '',
  componentType: 'CONSTANT',
  scalingFactor: 0.0
};

const getDefaultData = (type: Exclude<ControlComponentType, 'CONSTANT'>): any => {
  switch (type) {
    case 'SUM':
      return { constant: 0.0, terms: [{ coefficient: 1.0, variable: { ...emptyVarRef } }] } as SumData;
    case 'TRIPUNIT':
      return { tripNumber: 401 } as TripUnitData;
    case 'TRIPDLAY':
      return { tripNumber: 401 } as TripDelayData;
    case 'FUNCTION':
      return { variable: { ...emptyVarRef }, tableNumber: 0 } as FunctionData;
    case 'STDFNCTN':
      return { functionName: 'ABS', arguments: [{ ...emptyVarRef }] } as StdFunctionData;
    case 'MULT':
      return { factors: [{ ...emptyVarRef }, { ...emptyVarRef }] } as MultData;
    case 'DIV':
      return { denominator: { ...emptyVarRef } } as DivData;
    case 'INTEGRAL':
    case 'DIFFRENI':
    case 'DIFFREND':
      return { variable: { ...emptyVarRef } } as SingleVariableData;
    case 'PROP-INT':
      return { proportionalGain: 1.0, integralGain: 0.001, variable: { ...emptyVarRef } } as PropIntData;
    case 'LAG':
      return { lagTime: 1.0, variable: { ...emptyVarRef } } as LagData;
    case 'LEAD-LAG':
      return { leadTime: 1.0, lagTime: 1.0, variable: { ...emptyVarRef } } as LeadLagData;
    case 'POWERI':
      return { variable: { ...emptyVarRef }, integerPower: 2 } as PowerIData;
    case 'POWERR':
      return { variable: { ...emptyVarRef }, realPower: 2.0 } as PowerRData;
    case 'POWERX':
      return { base: { ...emptyVarRef }, exponent: { ...emptyVarRef } } as PowerXData;
    case 'DELAY':
      return { variable: { ...emptyVarRef }, delayTime: 1.0, holdPositions: 10 } as DelayData;
    case 'DIGITAL':
      return { variable: { ...emptyVarRef }, samplingTime: 0.1, delayTime: 0.0 } as DigitalData;
    case 'PUMPCTL':
      return {
        setpointVariable: { ...emptyVarRef }, sensedVariable: { ...emptyVarRef },
        scaleFactor: 1.0, integralTime: 10.0, proportionalTime: 5.0
      } as PumpctlData;
    case 'STEAMCTL':
      return {
        setpointVariable: { ...emptyVarRef }, sensedVariable: { ...emptyVarRef },
        scaleFactor: 1.0, integralTime: 10.0, proportionalTime: 5.0
      } as SteamctlData;
    case 'FEEDCTL':
      return {
        setpointVariable1: { ...emptyVarRef }, sensedVariable1: { ...emptyVarRef }, scaleFactor1: 1.0,
        setpointVariable2: { ...emptyVarRef }, sensedVariable2: { ...emptyVarRef }, scaleFactor2: 1.0,
        integralTime: 40.0, proportionalTime: 20.0
      } as FeedctlData;
    case 'SHAFT':
      return {
        torqueControlVariable: 0,
        momentOfInertia: 5000.0,
        frictionFactor: 1.0e-5,
        attachedComponents: [{ type: 'TURBINE', componentNumber: 0 }]
      } as ShaftData;
    default:
      return { constant: 0.0, terms: [{ coefficient: 1.0, variable: { ...emptyVarRef } }] } as SumData;
  }
};

const createEmptyNonConstant = (type: Exclude<ControlComponentType, 'CONSTANT'>): NonConstantControlVariable => {
  const base = {
    number: 101,
    name: '',
    scalingFactor: 1.0,
    initialValue: 0.0,
    initialValueFlag: 1 as const,
    limiterControl: 0 as const
  };

  return { ...base, componentType: type, data: getDefaultData(type) } as NonConstantControlVariable;
};

interface EditDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index: number;
  cv: ControlVariable;
}

/**
 * Generate formula preview for display
 */
const getFormulaPreview = (cv: ControlVariable): string => {
  if (isConstantControlVariable(cv)) {
    return `Y = ${formatNumber(cv.scalingFactor)}`;
  }

  const S = cv.scalingFactor;
  switch (cv.componentType) {
    case 'SUM': {
      const data = cv.data as SumData;
      const terms = data.terms.slice(0, 2).map(t =>
        `${formatNumber(t.coefficient)}*${t.variable.variableName}`
      ).join(' + ');
      const suffix = data.terms.length > 2 ? ' + ...' : '';
      return `Y = ${formatNumber(S)}*(${formatNumber(data.constant)} + ${terms}${suffix})`;
    }
    case 'TRIPUNIT': {
      const data = cv.data as TripUnitData;
      return `Y = ${formatNumber(S)} * U(T${data.tripNumber})`;
    }
    case 'TRIPDLAY': {
      const data = cv.data as TripDelayData;
      return `Y = ${formatNumber(S)} * TripTime(T${data.tripNumber})`;
    }
    case 'FUNCTION': {
      const data = cv.data as FunctionData;
      const vn = data.variable?.variableName || '?';
      return `Y = ${formatNumber(S)} * TBL${data.tableNumber}(${vn})`;
    }
    case 'STDFNCTN': {
      const data = cv.data as StdFunctionData;
      const args = data.arguments?.slice(0, 2).map(a => a.variableName || '?').join(', ') || '?';
      const suffix = (data.arguments?.length || 0) > 2 ? ', ...' : '';
      return `Y = ${formatNumber(S)} * ${data.functionName}(${args}${suffix})`;
    }
    case 'MULT': {
      const data = cv.data as MultData;
      const factors = data.factors?.slice(0, 3).map(f => f.variableName || '?').join(' * ') || '?';
      const suffix = (data.factors?.length || 0) > 3 ? ' * ...' : '';
      return `Y = ${formatNumber(S)} * ${factors}${suffix}`;
    }
    case 'DIV': {
      const data = cv.data as DivData;
      const denom = data.denominator?.variableName || '?';
      if (data.numerator) {
        return `Y = ${formatNumber(S)} * ${data.numerator.variableName || '?'} / ${denom}`;
      }
      return `Y = ${formatNumber(S)} / ${denom}`;
    }
    case 'INTEGRAL':
    case 'DIFFRENI':
    case 'DIFFREND': {
      const data = cv.data as SingleVariableData;
      const vn = data.variable?.variableName || '?';
      const op = cv.componentType === 'INTEGRAL' ? '∫' : 'd/dt';
      return `Y = ${formatNumber(S)} * ${op}(${vn})`;
    }
    case 'PROP-INT': {
      const data = cv.data as PropIntData;
      const vn = data.variable?.variableName || '?';
      return `Y = ${formatNumber(S)} * (${formatNumber(data.proportionalGain)}*${vn} + ${formatNumber(data.integralGain)}*∫${vn})`;
    }
    case 'LAG': {
      const data = cv.data as LagData;
      return `Y = ${formatNumber(S)} * Lag(${data.variable?.variableName || '?'}, ${formatNumber(data.lagTime)})`;
    }
    case 'LEAD-LAG': {
      const data = cv.data as LeadLagData;
      return `Y = ${formatNumber(S)} * LL(${data.variable?.variableName || '?'})`;
    }
    case 'POWERI': {
      const data = cv.data as PowerIData;
      return `Y = ${formatNumber(S)} * ${data.variable?.variableName || '?'}^${data.integerPower}`;
    }
    case 'POWERR': {
      const data = cv.data as PowerRData;
      return `Y = ${formatNumber(S)} * ${data.variable?.variableName || '?'}^${formatNumber(data.realPower)}`;
    }
    case 'POWERX': {
      const data = cv.data as PowerXData;
      return `Y = ${formatNumber(S)} * ${data.base?.variableName || '?'}^${data.exponent?.variableName || '?'}`;
    }
    case 'DELAY': {
      const data = cv.data as DelayData;
      return `Y = ${formatNumber(S)} * ${data.variable?.variableName || '?'}(t-${formatNumber(data.delayTime)})`;
    }
    case 'DIGITAL': {
      const data = cv.data as DigitalData;
      return `Y = ${formatNumber(S)} * Sample(${data.variable?.variableName || '?'})`;
    }
    case 'PUMPCTL': {
      const data = cv.data as PumpctlData;
      const sp = data.setpointVariable?.variableName || '?';
      const sn = data.sensedVariable?.variableName || '?';
      return `Y = G * PI(${sp} - ${sn}, T2=${formatNumber(data.integralTime)}, T1=${formatNumber(data.proportionalTime)})`;
    }
    case 'STEAMCTL': {
      const data = cv.data as SteamctlData;
      const sp = data.setpointVariable?.variableName || '?';
      const sn = data.sensedVariable?.variableName || '?';
      return `Y = G * PI(${sp} - ${sn}, T4=${formatNumber(data.integralTime)}, T3=${formatNumber(data.proportionalTime)})`;
    }
    case 'FEEDCTL': {
      const data = cv.data as FeedctlData;
      const sp1 = data.setpointVariable1?.variableName || '?';
      const sn1 = data.sensedVariable1?.variableName || '?';
      const sp2 = data.setpointVariable2?.variableName || '?';
      const sn2 = data.sensedVariable2?.variableName || '?';
      return `Y = G * PI(${sp1}-${sn1}, ${sp2}-${sn2})`;
    }
    case 'SHAFT': {
      const data = cv.data as ShaftData;
      const comps = data.attachedComponents.map(c => `${c.type}(${c.componentNumber})`).join(', ');
      return `SHAFT: I·dω/dt = Στ [${comps}]`;
    }
    default:
      return 'Y = ...';
  }
};

export const ControlVariablesTab: React.FC<ControlVariablesTabProps> = ({
  controlVariables,
  onChange
}) => {
  const { metadata, nodes } = useStore();
  const variableTrips = metadata.globalSettings?.variableTrips || [];
  const logicTrips = metadata.globalSettings?.logicTrips || [];
  const generalTables: GeneralTable[] = metadata.globalSettings?.generalTables || [];

  // Available trip numbers for TRIPUNIT/TRIPDLAY (both Variable Trips 401-599 and Logic Trips 601-799)
  const availableTripNumbers = useMemo(() => {
    const varNums = variableTrips.map(t => t.cardNumber);
    const logicNums = logicTrips.map(t => t.cardNumber);
    return [...varNums, ...logicNums].sort((a, b) => a - b);
  }, [variableTrips, logicTrips]);

  // Available general tables for FUNCTION type
  const availableGeneralTables = useMemo(() => {
    return [...generalTables].sort((a, b) => a.tableNumber - b.tableNumber);
  }, [generalTables]);

  // Available Volume IDs from canvas nodes
  const availableVolumeIds = useMemo(() => {
    const volumeIds: Array<{ volumeId: string; label: string; componentName: string }> = [];
    nodes.forEach(node => {
      const compId = node.data.componentId;
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;
      const shortId = compId.slice(0, 3);
      if (compType === 'snglvol' || compType === 'tmdpvol') {
        const volumeId = `${shortId}010000`;
        volumeIds.push({ volumeId, label: `${volumeId} (${compName}, Volume 01)`, componentName: compName });
      } else if (compType === 'pipe') {
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells; i++) {
            const volNum = i.toString().padStart(2, '0');
            const volumeId = `${shortId}${volNum}0000`;
            volumeIds.push({ volumeId, label: `${volumeId} (${compName}, Volume ${volNum})`, componentName: compName });
          }
        }
      }
    });
    return volumeIds;
  }, [nodes]);

  // Available Junction IDs from canvas nodes
  const availableJunctionIds = useMemo(() => {
    const junctionIds: Array<{ junctionId: string; label: string; componentName: string }> = [];
    nodes.forEach(node => {
      const compId = node.data.componentId;
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;
      const shortId = compId.slice(0, 3);
      if (compType === 'sngljun' || compType === 'tmdpjun') {
        junctionIds.push({ junctionId: `${shortId}010001`, label: `${shortId}010001 (${compName}, Inlet)`, componentName: compName });
        junctionIds.push({ junctionId: `${shortId}010002`, label: `${shortId}010002 (${compName}, Outlet)`, componentName: compName });
      } else if (compType === 'pipe') {
        const params = node.data.parameters;
        if ('ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells + 1; i++) {
            const junctionNum = Math.min(i, 6);
            const volNum = i <= ncells ? i.toString().padStart(2, '0') : ncells.toString().padStart(2, '0');
            const junctionId = `${shortId}${volNum}000${junctionNum}`;
            junctionIds.push({ junctionId, label: `${junctionId} (${compName}, Junction ${junctionNum})`, componentName: compName });
          }
        }
      }
    });
    return junctionIds;
  }, [nodes]);

  // Available Turbine/Pump nodes for SHAFT attached component dropdown
  const availableTurbineNodes = useMemo(() => {
    return nodes
      .filter(n => n.data.componentType === 'turbine')
      .map(n => ({
        ccc: Number(n.data.componentId.slice(0, 3)),
        label: `${n.data.componentId.slice(0, 3)} - ${n.data.componentName || 'unnamed'}`
      }))
      .sort((a, b) => a.ccc - b.ccc);
  }, [nodes]);

  const availablePumpNodes = useMemo(() => {
    return nodes
      .filter(n => n.data.componentType === 'pump')
      .map(n => ({
        ccc: Number(n.data.componentId.slice(0, 3)),
        label: `${n.data.componentId.slice(0, 3)} - ${n.data.componentName || 'unnamed'}`
      }))
      .sort((a, b) => a.ccc - b.ccc);
  }, [nodes]);

  const [dialog, setDialog] = useState<EditDialogState>({
    open: false,
    mode: 'add',
    index: -1,
    cv: { ...emptyConstant }
  });

  const [validationError, setValidationError] = useState<string>('');

  // Get next available CV number
  const getNextNumber = (): number => {
    const usedNumbers = controlVariables.map(cv => cv.number);
    let next = 101;
    while (usedNumbers.includes(next) && next <= 999) {
      next++;
    }
    return next;
  };

  const handleAddCV = () => {
    const nextNum = getNextNumber();
    if (nextNum > 999) {
      alert('Maximum 999 control variables allowed');
      return;
    }

    setDialog({
      open: true,
      mode: 'add',
      index: -1,
      cv: { ...emptyConstant, number: nextNum }
    });
    setValidationError('');
  };

  const handleEditCV = (index: number) => {
    // Deep clone to avoid mutation
    const cv = JSON.parse(JSON.stringify(controlVariables[index]));
    setDialog({
      open: true,
      mode: 'edit',
      index,
      cv
    });
    setValidationError('');
  };

  const handleDeleteCV = (index: number) => {
    const newCVs = controlVariables.filter((_, idx) => idx !== index);
    onChange(newCVs);
  };

  const handleCopyCV = (index: number) => {
    const original = controlVariables[index];
    const nextNum = getNextNumber();
    if (nextNum > 999) {
      alert('Maximum 999 control variables allowed');
      return;
    }

    const copied: ControlVariable = JSON.parse(JSON.stringify(original));
    copied.number = nextNum;
    copied.name = `${original.name}_copy`.slice(0, 8);

    const newCVs = [...controlVariables, copied].sort((a, b) => a.number - b.number);
    onChange(newCVs);
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
    setValidationError('');
  };

  const handleTypeChange = (newType: ControlComponentType) => {
    const currentNumber = dialog.cv.number;
    const currentName = dialog.cv.name;
    const currentComment = dialog.cv.comment;

    if (newType === 'CONSTANT') {
      setDialog({
        ...dialog,
        cv: {
          ...emptyConstant,
          number: currentNumber,
          name: currentName,
          comment: currentComment
        }
      });
    } else {
      const newCV = createEmptyNonConstant(newType as Exclude<ControlComponentType, 'CONSTANT'>);
      newCV.number = currentNumber;
      newCV.name = currentName;
      newCV.comment = currentComment;
      if (newType === 'SHAFT') {
        newCV.scalingFactor = 1.0;
      }
      setDialog({ ...dialog, cv: newCV });
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setDialog({
      ...dialog,
      cv: { ...dialog.cv, [field]: value }
    });
  };

  // Handle SUM data changes
  const handleSumDataChange = (field: string, value: any) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SUM') return;

    const newData = { ...dialog.cv.data, [field]: value };
    setDialog({
      ...dialog,
      cv: { ...dialog.cv, data: newData } as NonConstantControlVariable
    });
  };

  const handleSumTermChange = (termIndex: number, field: string, value: any) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SUM') return;

    const newTerms = [...dialog.cv.data.terms];
    if (field === 'coefficient') {
      newTerms[termIndex] = { ...newTerms[termIndex], coefficient: value };
    } else if (field === 'variableName' || field === 'parameterCode') {
      newTerms[termIndex] = {
        ...newTerms[termIndex],
        variable: { ...newTerms[termIndex].variable, [field]: value }
      };
    }

    handleSumDataChange('terms', newTerms);
  };

  const handleAddSumTerm = () => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SUM') return;

    const newTerms = [
      ...dialog.cv.data.terms,
      { coefficient: 1.0, variable: { variableName: 'q', parameterCode: 0 } }
    ];
    handleSumDataChange('terms', newTerms);
  };

  const handleRemoveSumTerm = (termIndex: number) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SUM') return;
    if (dialog.cv.data.terms.length <= 1) return; // Keep at least one term

    const newTerms = dialog.cv.data.terms.filter((_, idx) => idx !== termIndex);
    handleSumDataChange('terms', newTerms);
  };

  // Generic data change handler for any non-constant type
  const handleGenericDataChange = (field: string, value: any) => {
    if (!isNonConstantControlVariable(dialog.cv)) return;

    const newData = { ...(dialog.cv.data as any), [field]: value };
    setDialog({
      ...dialog,
      cv: { ...dialog.cv, data: newData } as NonConstantControlVariable
    });
  };

  // Handle variable reference change within data
  const handleVarRefChange = (dataField: string, refField: 'variableName' | 'parameterCode', value: any) => {
    if (!isNonConstantControlVariable(dialog.cv)) return;

    const currentData = dialog.cv.data as any;
    const currentRef = currentData[dataField] || { ...emptyVarRef };
    const newRef = { ...currentRef, [refField]: value };
    handleGenericDataChange(dataField, newRef);
  };

  // Handle MULT factors list change
  const handleMultFactorChange = (index: number, field: 'variableName' | 'parameterCode', value: any) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'MULT') return;
    const data = dialog.cv.data as MultData;
    const newFactors = [...data.factors];
    newFactors[index] = { ...newFactors[index], [field]: value };
    handleGenericDataChange('factors', newFactors);
  };

  const handleAddMultFactor = () => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'MULT') return;
    const data = dialog.cv.data as MultData;
    handleGenericDataChange('factors', [...data.factors, { ...emptyVarRef }]);
  };

  const handleRemoveMultFactor = (index: number) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'MULT') return;
    const data = dialog.cv.data as MultData;
    if (data.factors.length <= 2) return;
    handleGenericDataChange('factors', data.factors.filter((_, i) => i !== index));
  };

  // Handle STDFNCTN arguments list change
  const handleStdFuncArgChange = (index: number, field: 'variableName' | 'parameterCode', value: any) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'STDFNCTN') return;
    const data = dialog.cv.data as StdFunctionData;
    const newArgs = [...data.arguments];
    newArgs[index] = { ...newArgs[index], [field]: value };
    handleGenericDataChange('arguments', newArgs);
  };

  const handleAddStdFuncArg = () => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'STDFNCTN') return;
    const data = dialog.cv.data as StdFunctionData;
    handleGenericDataChange('arguments', [...data.arguments, { ...emptyVarRef }]);
  };

  const handleRemoveStdFuncArg = (index: number) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'STDFNCTN') return;
    const data = dialog.cv.data as StdFunctionData;
    if (data.arguments.length <= 1) return;
    handleGenericDataChange('arguments', data.arguments.filter((_, i) => i !== index));
  };

  // SHAFT attached component handlers
  const handleShaftComponentChange = (index: number, field: keyof ShaftAttachedComponent, value: any) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SHAFT') return;
    const data = dialog.cv.data as ShaftData;
    const newComps = [...data.attachedComponents];
    newComps[index] = { ...newComps[index], [field]: value };
    handleGenericDataChange('attachedComponents', newComps);
  };

  const handleAddShaftComponent = () => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SHAFT') return;
    const data = dialog.cv.data as ShaftData;
    if (data.attachedComponents.length >= 10) return;
    handleGenericDataChange('attachedComponents', [
      ...data.attachedComponents,
      { type: 'TURBINE' as const, componentNumber: 0 }
    ]);
  };

  const handleRemoveShaftComponent = (index: number) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SHAFT') return;
    const data = dialog.cv.data as ShaftData;
    if (data.attachedComponents.length <= 1) return;
    handleGenericDataChange('attachedComponents', data.attachedComponents.filter((_, i) => i !== index));
  };

  const handleShaftGeneratorToggle = (enabled: boolean) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SHAFT') return;
    if (enabled) {
      handleGenericDataChange('generatorData', {
        initialVelocity: 377.0,
        synchronousVelocity: 377.0,
        momentOfInertia: 5000.0,
        frictionFactor: 0.05,
        tripNumber1: 0,
        tripNumber2: 0
      } as ShaftGeneratorData);
    } else {
      handleGenericDataChange('generatorData', undefined);
    }
  };

  const handleShaftGeneratorChange = (field: keyof ShaftGeneratorData, value: number) => {
    if (!isNonConstantControlVariable(dialog.cv) || dialog.cv.componentType !== 'SHAFT') return;
    const data = dialog.cv.data as ShaftData;
    if (!data.generatorData) return;
    handleGenericDataChange('generatorData', { ...data.generatorData, [field]: value });
  };

  const validateCV = (): boolean => {
    const cv = dialog.cv;

    // Common validations
    if (cv.number < 1 || cv.number > 999) {
      setValidationError('Control variable number must be between 1 and 999');
      return false;
    }

    if (!cv.name || cv.name.trim() === '') {
      setValidationError('Name is required');
      return false;
    }

    if (cv.name.length > 8) {
      setValidationError('Name must be at most 8 characters');
      return false;
    }

    // Check duplicate number
    const duplicateIndex = controlVariables.findIndex(
      (c, idx) => c.number === cv.number && (dialog.mode === 'add' || idx !== dialog.index)
    );
    if (duplicateIndex !== -1) {
      setValidationError(`Control variable number ${cv.number} is already used`);
      return false;
    }

    // Type-specific validations
    if (isNonConstantControlVariable(cv)) {
      if (cv.componentType === 'SUM') {
        const data = cv.data as SumData;
        if (data.terms.length === 0) {
          setValidationError('SUM type requires at least one term');
          return false;
        }
        if (data.terms.length > 20) {
          setValidationError('SUM type allows maximum 20 terms');
          return false;
        }
      } else if (cv.componentType === 'TRIPUNIT' || cv.componentType === 'TRIPDLAY') {
        const data = cv.data as TripUnitData;
        if (!data.tripNumber) {
          setValidationError('Trip number is required');
          return false;
        }
      } else if (cv.componentType === 'MULT') {
        const data = cv.data as MultData;
        if (!data.factors || data.factors.length < 2) {
          setValidationError('MULT type requires at least 2 factors');
          return false;
        }
      } else if (cv.componentType === 'STDFNCTN') {
        const data = cv.data as StdFunctionData;
        if (!data.functionName) {
          setValidationError('Standard function name is required');
          return false;
        }
        if (!data.arguments || data.arguments.length === 0) {
          setValidationError('STDFNCTN requires at least one argument');
          return false;
        }
      } else if (cv.componentType === 'PUMPCTL' || cv.componentType === 'STEAMCTL') {
        const data = cv.data as PumpctlData;
        if (data.scaleFactor === 0) {
          setValidationError(`${cv.componentType}: Scale factor must be nonzero`);
          return false;
        }
      } else if (cv.componentType === 'FEEDCTL') {
        const data = cv.data as FeedctlData;
        if (data.scaleFactor1 === 0) {
          setValidationError('FEEDCTL: First scale factor (S_k) must be nonzero');
          return false;
        }
        if (data.scaleFactor2 === 0) {
          setValidationError('FEEDCTL: Second scale factor (S_m) must be nonzero');
          return false;
        }
      } else if (cv.componentType === 'SHAFT') {
        const data = cv.data as ShaftData;
        if (cv.scalingFactor !== 1.0) {
          setValidationError('SHAFT: Scaling factor must be 1.0');
          return false;
        }
        if (data.momentOfInertia <= 0) {
          setValidationError('SHAFT: Moment of inertia must be > 0');
          return false;
        }
        if (!data.attachedComponents || data.attachedComponents.length === 0) {
          setValidationError('SHAFT: At least one attached component is required');
          return false;
        }
        if (data.attachedComponents.length > 10) {
          setValidationError('SHAFT: Maximum 10 attached components allowed');
          return false;
        }
        for (let i = 0; i < data.attachedComponents.length; i++) {
          if (data.attachedComponents[i].componentNumber <= 0) {
            setValidationError(`SHAFT: Attached component #${i + 1} number must be > 0`);
            return false;
          }
        }
      }
    }

    setValidationError('');
    return true;
  };

  const handleSave = () => {
    if (!validateCV()) return;

    const newCVs = [...controlVariables];
    if (dialog.mode === 'add') {
      newCVs.push(dialog.cv);
    } else {
      newCVs[dialog.index] = dialog.cv;
    }

    // Sort by number
    newCVs.sort((a, b) => a.number - b.number);
    onChange(newCVs);
    handleDialogClose();
  };

  // Reusable: common non-constant header fields (Scaling Factor, Initial Value, Init Flag)
  const renderCommonFields = () => {
    const cv = dialog.cv as NonConstantControlVariable;
    const isShaft = cv.componentType === 'SHAFT';
    return (
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <NumericTextField
            label="Scaling Factor (S)"
            value={isShaft ? 1.0 : cv.scalingFactor}
            onChange={(num) => handleFieldChange('scalingFactor', num)}
            fullWidth
            size="small"
            disabled={isShaft}
          />
        </Grid>
        <Grid item xs={4}>
          <NumericTextField
            label="Initial Value"
            value={cv.initialValue}
            onChange={(num) => handleFieldChange('initialValue', num)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Init Flag</InputLabel>
            <Select
              value={cv.initialValueFlag}
              label="Init Flag"
              onChange={(e) => handleFieldChange('initialValueFlag', e.target.value as 0 | 1)}
            >
              <MenuItem value={0}>0 - Use Initial Value</MenuItem>
              <MenuItem value={1}>1 - Compute</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    );
  };

  // Filter control variables excluding self (prevent circular reference)
  const availableCVsForRef = useMemo(() => {
    const currentNum = dialog.cv.number;
    return controlVariables.filter(cv => cv.number !== currentNum);
  }, [controlVariables, dialog.cv.number]);

  // Smart parameter input based on variable name
  const renderSmartParamInput = (
    label: string,
    variableName: string,
    parameterCode: number,
    onParamCodeChange: (val: number) => void,
    sx?: object
  ) => {
    const paramType = getParamInputType(variableName);

    switch (paramType) {
      case 'time':
        return (
          <TextField
            label={`${label} Parameter`}
            value={0}
            disabled
            sx={sx || { flex: 1 }}
            size="small"
            helperText="time = 0"
          />
        );

      case 'cntrlvar':
        return (
          <FormControl sx={sx || { flex: 1 }} size="small">
            <InputLabel>{label} Parameter (CV)</InputLabel>
            <Select
              value={parameterCode.toString()}
              label={`${label} Parameter (CV)`}
              onChange={(e) => onParamCodeChange(parseInt(e.target.value) || 0)}
            >
              {availableCVsForRef.length === 0 ? (
                <MenuItem disabled>No other control variables defined</MenuItem>
              ) : (
                availableCVsForRef.map(cv => (
                  <MenuItem key={cv.number} value={cv.number.toString()}>
                    {cv.number} - {cv.name} ({cv.componentType})
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        );

      case 'volume':
        return (
          <Autocomplete
            options={availableVolumeIds}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.label;
            }}
            isOptionEqualToValue={(option, value) => {
              if (typeof value === 'string') return option.volumeId === value;
              return option.volumeId === value.volumeId;
            }}
            value={parameterCode.toString()}
            inputValue={parameterCode.toString()}
            onInputChange={(_event, newInputValue) => {
              const parsed = parseInt(newInputValue) || 0;
              onParamCodeChange(parsed);
            }}
            onChange={(_, newValue) => {
              if (newValue && typeof newValue === 'object' && 'volumeId' in newValue) {
                onParamCodeChange(parseInt(newValue.volumeId) || 0);
              } else if (typeof newValue === 'string') {
                onParamCodeChange(parseInt(newValue) || 0);
              }
            }}
            freeSolo
            sx={sx || { flex: 1 }}
            size="small"
            renderInput={(params) => (
              <TextField
                {...params}
                label={`${label} Parameter (Volume)`}
                placeholder="CCCVV0000"
                size="small"
              />
            )}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const input = inputValue.toLowerCase();
              return options.filter(opt =>
                opt.volumeId.includes(inputValue) ||
                opt.label.toLowerCase().includes(input) ||
                opt.componentName.toLowerCase().includes(input)
              );
            }}
          />
        );

      case 'junction':
        return (
          <Autocomplete
            options={availableJunctionIds}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.label;
            }}
            isOptionEqualToValue={(option, value) => {
              if (typeof value === 'string') return option.junctionId === value;
              return option.junctionId === value.junctionId;
            }}
            value={parameterCode.toString()}
            inputValue={parameterCode.toString()}
            onInputChange={(_event, newInputValue) => {
              const parsed = parseInt(newInputValue) || 0;
              onParamCodeChange(parsed);
            }}
            onChange={(_, newValue) => {
              if (newValue && typeof newValue === 'object' && 'junctionId' in newValue) {
                onParamCodeChange(parseInt(newValue.junctionId) || 0);
              } else if (typeof newValue === 'string') {
                onParamCodeChange(parseInt(newValue) || 0);
              }
            }}
            freeSolo
            sx={sx || { flex: 1 }}
            size="small"
            renderInput={(params) => (
              <TextField
                {...params}
                label={`${label} Parameter (Junction)`}
                placeholder="CCCVV000N"
                size="small"
              />
            )}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const input = inputValue.toLowerCase();
              return options.filter(opt =>
                opt.junctionId.includes(inputValue) ||
                opt.label.toLowerCase().includes(input) ||
                opt.componentName.toLowerCase().includes(input)
              );
            }}
          />
        );

      default:
        return (
          <TextField
            label={`${label} Parameter`}
            type="number"
            value={parameterCode}
            onChange={(e) => onParamCodeChange(parseInt(e.target.value) || 0)}
            sx={sx || { flex: 1 }}
            size="small"
            placeholder="CCCVV0000 or CCC"
          />
        );
    }
  };

  // Reusable: variable name autocomplete input
  const renderVarNameAutocomplete = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    sx?: object
  ) => (
    <Autocomplete
      options={ALL_VARIABLE_NAMES}
      value={value || ''}
      onChange={(_, newValue) => onChange(newValue || '')}
      onInputChange={(_, newInputValue) => onChange(newInputValue)}
      freeSolo
      sx={sx || { width: 160 }}
      size="small"
      renderInput={(params) => (
        <TextField
          {...params}
          label={`${label} Variable`}
          placeholder="p, cntrlvar, ..."
          size="small"
        />
      )}
    />
  );

  // Reusable: variable reference input (variableName + parameterCode)
  const renderVarRefInput = (
    label: string,
    varRef: VariableRef | undefined,
    onVarNameChange: (val: string) => void,
    onParamCodeChange: (val: number) => void
  ) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {renderVarNameAutocomplete(label, varRef?.variableName || '', onVarNameChange)}
      {renderSmartParamInput(label, varRef?.variableName || '', varRef?.parameterCode ?? 0, onParamCodeChange)}
    </Box>
  );

  // Render type-specific form fields
  const renderTypeSpecificFields = () => {
    const cv = dialog.cv;

    if (isConstantControlVariable(cv)) {
      return (
        <NumericTextField
          label="Constant Value"
          value={cv.scalingFactor}
          onChange={(num) => handleFieldChange('scalingFactor', num)}
          fullWidth
          helperText="This value becomes the constant output (Y = value)"
        />
      );
    }

    if (!isNonConstantControlVariable(cv)) return null;

    switch (cv.componentType) {
      case 'SUM':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * (A0 + A1*V1 + A2*V2 + ...)
            </Typography>

            <NumericTextField
              label="Constant (A0)"
              value={(cv.data as SumData).constant}
              onChange={(num) => handleSumDataChange('constant', num)}
              fullWidth
              size="small"
            />

            <Typography variant="subtitle2">Terms:</Typography>

            {(cv.data as SumData).terms.map((term, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <NumericTextField
                  label={`A${idx + 1}`}
                  value={term.coefficient}
                  onChange={(num) => handleSumTermChange(idx, 'coefficient', num)}
                  sx={{ width: 100 }}
                  size="small"
                />
                {renderVarNameAutocomplete(
                  `V${idx + 1}`,
                  term.variable.variableName,
                  (val) => handleSumTermChange(idx, 'variableName', val),
                  { width: 140 }
                )}
                {renderSmartParamInput(
                  `V${idx + 1}`,
                  term.variable.variableName,
                  term.variable.parameterCode,
                  (val) => handleSumTermChange(idx, 'parameterCode', val)
                )}
                <IconButton
                  size="small"
                  onClick={() => handleRemoveSumTerm(idx)}
                  disabled={(cv.data as SumData).terms.length <= 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddSumTerm}
              disabled={(cv.data as SumData).terms.length >= 20}
            >
              Add Term
            </Button>
          </Box>
        );

      case 'TRIPUNIT':
      case 'TRIPDLAY': {
        const isTripUnit = cv.componentType === 'TRIPUNIT';
        const tripData = cv.data as (TripUnitData | TripDelayData);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              {isTripUnit
                ? 'Formula: Y = S * U(Trip) where U=0 (false) or 1 (true)'
                : 'Formula: Y = S * TripTime(Trip) - time since trip occurred'}
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Trip Number</InputLabel>
              <Select
                value={tripData.tripNumber || ''}
                label="Trip Number"
                onChange={(e) => handleGenericDataChange('tripNumber', e.target.value)}
              >
                {availableTripNumbers.length === 0 ? (
                  <MenuItem disabled>No trips defined. Add trips in Variable Trips tab first.</MenuItem>
                ) : (
                  availableTripNumbers.map(num => (
                    <MenuItem key={num} value={num}>
                      Trip {num} ({num >= 601 ? 'Logic' : 'Variable'})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {availableTripNumbers.length === 0 && (
              <Alert severity="warning">
                No Variable Trips defined. Please add trips in the "Variable Trips" tab first.
              </Alert>
            )}
          </Box>
        );
      }

      case 'FUNCTION': {
        const funcData = cv.data as FunctionData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * TABLE(V1) - General Table lookup
            </Typography>
            {renderVarRefInput('Input',
              funcData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
            <FormControl fullWidth size="small">
              <InputLabel>General Table Number</InputLabel>
              <Select
                value={funcData.tableNumber || ''}
                label="General Table Number"
                onChange={(e) => handleGenericDataChange('tableNumber', typeof e.target.value === 'number' ? e.target.value : parseInt(e.target.value as string) || 0)}
              >
                {availableGeneralTables.length === 0 ? (
                  <MenuItem disabled>No general tables defined. Add in "General Tables" tab first.</MenuItem>
                ) : (
                  availableGeneralTables.map(gt => (
                    <MenuItem key={gt.tableNumber} value={gt.tableNumber}>
                      {gt.tableNumber} - {gt.name || '(unnamed)'} ({gt.type}, {gt.dataPoints.length} points)
                    </MenuItem>
                  ))
                )}
              </Select>
              {availableGeneralTables.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  No general tables available. Add them in the "General Tables" tab.
                </Typography>
              )}
            </FormControl>
          </Box>
        );
      }

      case 'STDFNCTN': {
        const stdData = cv.data as StdFunctionData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * f(V1, V2, ...)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Standard Function</InputLabel>
              <Select
                value={stdData.functionName || 'ABS'}
                label="Standard Function"
                onChange={(e) => handleGenericDataChange('functionName', e.target.value)}
              >
                {STD_FUNCTION_NAMES.map(fn => (
                  <MenuItem key={fn} value={fn}>{fn}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="subtitle2">Arguments:</Typography>
            {stdData.arguments?.map((arg, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {renderVarNameAutocomplete(
                  `V${idx + 1}`,
                  arg.variableName,
                  (val) => handleStdFuncArgChange(idx, 'variableName', val),
                  { width: 160 }
                )}
                {renderSmartParamInput(
                  `V${idx + 1}`,
                  arg.variableName,
                  arg.parameterCode,
                  (val) => handleStdFuncArgChange(idx, 'parameterCode', val)
                )}
                <IconButton
                  size="small"
                  onClick={() => handleRemoveStdFuncArg(idx)}
                  disabled={stdData.arguments.length <= 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddStdFuncArg}
              disabled={(stdData.arguments?.length || 0) >= 20}
            >
              Add Argument
            </Button>
          </Box>
        );
      }

      case 'MULT': {
        const multData = cv.data as MultData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1 * V2 * ... * Vj
            </Typography>
            <Typography variant="subtitle2">Factors (min 2):</Typography>
            {multData.factors?.map((factor, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {renderVarNameAutocomplete(
                  `V${idx + 1}`,
                  factor.variableName,
                  (val) => handleMultFactorChange(idx, 'variableName', val),
                  { width: 160 }
                )}
                {renderSmartParamInput(
                  `V${idx + 1}`,
                  factor.variableName,
                  factor.parameterCode,
                  (val) => handleMultFactorChange(idx, 'parameterCode', val)
                )}
                <IconButton
                  size="small"
                  onClick={() => handleRemoveMultFactor(idx)}
                  disabled={multData.factors.length <= 2}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddMultFactor}
              disabled={(multData.factors?.length || 0) >= 20}
            >
              Add Factor
            </Button>
          </Box>
        );
      }

      case 'DIV': {
        const divData = cv.data as DivData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S / V1 or Y = S * V2 / V1
            </Typography>
            {renderVarRefInput('Denominator (V1)',
              divData.denominator,
              (val) => handleVarRefChange('denominator', 'variableName', val),
              (val) => handleVarRefChange('denominator', 'parameterCode', val)
            )}
            <Typography variant="caption" color="text.secondary">
              Numerator (V2) is optional. If omitted, Y = S / V1.
            </Typography>
            {renderVarRefInput('Numerator (V2)',
              divData.numerator || { variableName: '', parameterCode: 0 },
              (val) => handleVarRefChange('numerator', 'variableName', val),
              (val) => handleVarRefChange('numerator', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'INTEGRAL':
      case 'DIFFRENI':
      case 'DIFFREND': {
        const singleData = cv.data as SingleVariableData;
        const formulaMap: Record<string, string> = {
          'INTEGRAL': 'Y = S * ∫V1 dt',
          'DIFFRENI': 'Y = S * dV1/dt (non-recommended)',
          'DIFFREND': 'Y = S * dV1/dt (difference approximation)'
        };
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: {formulaMap[cv.componentType]}
            </Typography>
            {renderVarRefInput('Input',
              singleData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'PROP-INT': {
        const piData = cv.data as PropIntData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * (A1*V1 + A2*∫V1 dt) - PI Controller
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label="Proportional Gain (A1)"
                  value={piData.proportionalGain}
                  onChange={(num) => handleGenericDataChange('proportionalGain', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <NumericTextField
                  label="Integral Gain (A2)"
                  value={piData.integralGain}
                  onChange={(num) => handleGenericDataChange('integralGain', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
            {renderVarRefInput('Input',
              piData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'LAG': {
        const lagData = cv.data as LagData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * ∫(V1-Y)/A1 dt - First-order Lag
            </Typography>
            <NumericTextField
              label="Lag Time A1 (seconds)"
              value={lagData.lagTime}
              onChange={(num) => handleGenericDataChange('lagTime', num)}
              fullWidth
              size="small"
            />
            {renderVarRefInput('Input',
              lagData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'LEAD-LAG': {
        const llData = cv.data as LeadLagData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Transfer function (1+A1s)/(1+A2s) - Lead-Lag
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label="Lead Time A1 (seconds)"
                  value={llData.leadTime}
                  onChange={(num) => handleGenericDataChange('leadTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <NumericTextField
                  label="Lag Time A2 (seconds)"
                  value={llData.lagTime}
                  onChange={(num) => handleGenericDataChange('lagTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
            {renderVarRefInput('Input',
              llData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'POWERI': {
        const piData = cv.data as PowerIData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1^I (Integer Power)
            </Typography>
            {renderVarRefInput('Base',
              piData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
            <TextField
              label="Integer Power"
              type="number"
              value={piData.integerPower}
              onChange={(e) => handleGenericDataChange('integerPower', parseInt(e.target.value) || 0)}
              fullWidth
              size="small"
              inputProps={{ step: 1 }}
            />
          </Box>
        );
      }

      case 'POWERR': {
        const prData = cv.data as PowerRData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1^R (Real Power)
            </Typography>
            {renderVarRefInput('Base',
              prData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
            <NumericTextField
              label="Real Power"
              value={prData.realPower}
              onChange={(num) => handleGenericDataChange('realPower', num)}
              fullWidth
              size="small"
            />
          </Box>
        );
      }

      case 'POWERX': {
        const pxData = cv.data as PowerXData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1^V2 (Variable Power)
            </Typography>
            {renderVarRefInput('Base (V1)',
              pxData.base,
              (val) => handleVarRefChange('base', 'variableName', val),
              (val) => handleVarRefChange('base', 'parameterCode', val)
            )}
            {renderVarRefInput('Exponent (V2)',
              pxData.exponent,
              (val) => handleVarRefChange('exponent', 'variableName', val),
              (val) => handleVarRefChange('exponent', 'parameterCode', val)
            )}
          </Box>
        );
      }

      case 'DELAY': {
        const delayData = cv.data as DelayData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1(t - td) - Time Delay
            </Typography>
            {renderVarRefInput('Input',
              delayData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label="Delay Time td (seconds)"
                  value={delayData.delayTime}
                  onChange={(num) => handleGenericDataChange('delayTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Hold Positions"
                  type="number"
                  value={delayData.holdPositions}
                  onChange={(e) => handleGenericDataChange('holdPositions', parseInt(e.target.value) || 1)}
                  fullWidth
                  size="small"
                  inputProps={{ min: 1 }}
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      case 'DIGITAL': {
        const digData = cv.data as DigitalData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              Formula: Y = S * V1_sampled(t - td) - Digital Sampling
            </Typography>
            {renderVarRefInput('Input',
              digData.variable,
              (val) => handleVarRefChange('variable', 'variableName', val),
              (val) => handleVarRefChange('variable', 'parameterCode', val)
            )}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label="Sampling Time ts (seconds)"
                  value={digData.samplingTime}
                  onChange={(num) => handleGenericDataChange('samplingTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <NumericTextField
                  label="Delay Time td (seconds)"
                  value={digData.delayTime}
                  onChange={(num) => handleGenericDataChange('delayTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      case 'PUMPCTL':
      case 'STEAMCTL': {
        const isPump = cv.componentType === 'PUMPCTL';
        const ctlData = cv.data as PumpctlData | SteamctlData;
        const tiLabel = isPump ? 'Integral Time T2' : 'Integral Time T4';
        const tpLabel = isPump ? 'Proportional Time T1' : 'Proportional Time T3';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              {isPump
                ? 'PUMPCTL: PI controller for pump flow control'
                : 'STEAMCTL: PI controller for steam flow control'}
            </Typography>
            <Alert severity="info" sx={{ py: 0 }}>
              W3 (Scaling Factor) = Gain multiplier (G) for output signal
            </Alert>

            <Typography variant="subtitle2">Setpoint Variable (desired value):</Typography>
            {renderVarRefInput('Setpoint',
              ctlData.setpointVariable,
              (val) => handleVarRefChange('setpointVariable', 'variableName', val),
              (val) => handleVarRefChange('setpointVariable', 'parameterCode', val)
            )}

            <Typography variant="subtitle2">Sensed Variable (measured value):</Typography>
            {renderVarRefInput('Sensed',
              ctlData.sensedVariable,
              (val) => handleVarRefChange('sensedVariable', 'variableName', val),
              (val) => handleVarRefChange('sensedVariable', 'parameterCode', val)
            )}

            <NumericTextField
              label="Scale Factor (S)"
              value={ctlData.scaleFactor}
              onChange={(num) => handleGenericDataChange('scaleFactor', num)}
              fullWidth
              size="small"
              helperText="Applied to sensed and setpoint values. Must be nonzero."
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label={`${tiLabel} (seconds)`}
                  value={ctlData.integralTime}
                  onChange={(num) => handleGenericDataChange('integralTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <NumericTextField
                  label={`${tpLabel} (seconds)`}
                  value={ctlData.proportionalTime}
                  onChange={(num) => handleGenericDataChange('proportionalTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      case 'FEEDCTL': {
        const feedData = cv.data as FeedctlData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Divider />
            <Typography variant="subtitle2">
              FEEDCTL: PI controller for feedwater flow control (2 setpoint-sensed pairs)
            </Typography>
            <Alert severity="info" sx={{ py: 0 }}>
              W3 (Scaling Factor) = Gain multiplier (G) for output signal
            </Alert>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>1st Setpoint-Sensed Pair:</Typography>
            {renderVarRefInput('Setpoint 1',
              feedData.setpointVariable1,
              (val) => handleVarRefChange('setpointVariable1', 'variableName', val),
              (val) => handleVarRefChange('setpointVariable1', 'parameterCode', val)
            )}
            {renderVarRefInput('Sensed 1',
              feedData.sensedVariable1,
              (val) => handleVarRefChange('sensedVariable1', 'variableName', val),
              (val) => handleVarRefChange('sensedVariable1', 'parameterCode', val)
            )}
            <NumericTextField
              label="Scale Factor 1 (S_k)"
              value={feedData.scaleFactor1}
              onChange={(num) => handleGenericDataChange('scaleFactor1', num)}
              fullWidth
              size="small"
              helperText="Applied to 1st setpoint-sensed pair. Must be nonzero."
            />

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2">2nd Setpoint-Sensed Pair:</Typography>
            {renderVarRefInput('Setpoint 2',
              feedData.setpointVariable2,
              (val) => handleVarRefChange('setpointVariable2', 'variableName', val),
              (val) => handleVarRefChange('setpointVariable2', 'parameterCode', val)
            )}
            {renderVarRefInput('Sensed 2',
              feedData.sensedVariable2,
              (val) => handleVarRefChange('sensedVariable2', 'variableName', val),
              (val) => handleVarRefChange('sensedVariable2', 'parameterCode', val)
            )}
            <NumericTextField
              label="Scale Factor 2 (S_m)"
              value={feedData.scaleFactor2}
              onChange={(num) => handleGenericDataChange('scaleFactor2', num)}
              fullWidth
              size="small"
              helperText="Applied to 2nd setpoint-sensed pair. Must be nonzero."
            />

            <Divider sx={{ my: 1 }} />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <NumericTextField
                  label="Integral Time T6 (seconds)"
                  value={feedData.integralTime}
                  onChange={(num) => handleGenericDataChange('integralTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <NumericTextField
                  label="Proportional Time T5 (seconds)"
                  value={feedData.proportionalTime}
                  onChange={(num) => handleGenericDataChange('proportionalTime', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        );
      }

      case 'SHAFT': {
        const shaftData = cv.data as ShaftData;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderCommonFields()}
            <Alert severity="info" sx={{ py: 0 }}>
              SHAFT: Scaling factor must be 1.0. Connects turbines, pumps, and generators via rotational velocity equation.
            </Alert>

            <Divider />
            <Typography variant="subtitle2">Shaft Description (Card 205CCC01)</Typography>

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <NumericTextField
                  label="Torque Control Variable No."
                  value={shaftData.torqueControlVariable}
                  onChange={(num) => handleGenericDataChange('torqueControlVariable', num)}
                  fullWidth
                  size="small"
                  helperText="0 = none"
                />
              </Grid>
              <Grid item xs={4}>
                <NumericTextField
                  label="Moment of Inertia (kg·m²)"
                  value={shaftData.momentOfInertia}
                  onChange={(num) => handleGenericDataChange('momentOfInertia', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <NumericTextField
                  label="Friction Factor"
                  value={shaftData.frictionFactor}
                  onChange={(num) => handleGenericDataChange('frictionFactor', num)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">
                Attached Components (Cards 205CCC02~05, max 4 pairs/card)
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddShaftComponent}
                disabled={shaftData.attachedComponents.length >= 10}
              >
                Add
              </Button>
            </Box>

            {shaftData.attachedComponents.map((comp, idx) => {
              const nodeOptions = comp.type === 'TURBINE' ? availableTurbineNodes
                : comp.type === 'PUMP' ? availablePumpNodes
                : null;
              return (
                <Grid container spacing={1} key={idx} alignItems="center">
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={comp.type}
                        label="Type"
                        onChange={(e) => {
                          handleShaftComponentChange(idx, 'type', e.target.value);
                          handleShaftComponentChange(idx, 'componentNumber', 0);
                        }}
                      >
                        <MenuItem value="TURBINE">TURBINE</MenuItem>
                        <MenuItem value="PUMP">PUMP</MenuItem>
                        <MenuItem value="GENERATR">GENERATR</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={5}>
                    {nodeOptions ? (
                      <TextField
                        select
                        label="Component"
                        value={comp.componentNumber}
                        onChange={(e) => handleShaftComponentChange(idx, 'componentNumber', Number(e.target.value))}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value={0}>0 - None</MenuItem>
                        {nodeOptions.map(opt => (
                          <MenuItem key={opt.ccc} value={opt.ccc}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <NumericTextField
                        label="Component No."
                        value={comp.componentNumber}
                        onChange={(num) => handleShaftComponentChange(idx, 'componentNumber', num)}
                        fullWidth
                        size="small"
                      />
                    )}
                  </Grid>
                  <Grid item xs={3}>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveShaftComponent(idx)}
                      disabled={shaftData.attachedComponents.length <= 1}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              );
            })}

            <Divider />
            <FormControlLabel
              control={
                <Switch
                  checked={!!shaftData.generatorData}
                  onChange={(e) => handleShaftGeneratorToggle(e.target.checked)}
                />
              }
              label="Generator Description (Card 205CCC06)"
            />

            {shaftData.generatorData && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Initial Velocity (rad/s)"
                      value={shaftData.generatorData.initialVelocity}
                      onChange={(num) => handleShaftGeneratorChange('initialVelocity', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Synchronous Velocity (rad/s)"
                      value={shaftData.generatorData.synchronousVelocity}
                      onChange={(num) => handleShaftGeneratorChange('synchronousVelocity', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Moment of Inertia (kg·m²)"
                      value={shaftData.generatorData.momentOfInertia}
                      onChange={(num) => handleShaftGeneratorChange('momentOfInertia', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Friction Factor"
                      value={shaftData.generatorData.frictionFactor}
                      onChange={(num) => handleShaftGeneratorChange('frictionFactor', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Trip Number 1 (0 = none)"
                      value={shaftData.generatorData.tripNumber1}
                      onChange={(num) => handleShaftGeneratorChange('tripNumber1', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <NumericTextField
                      label="Trip Number 2 (0 = none)"
                      value={shaftData.generatorData.tripNumber2}
                      onChange={(num) => handleShaftGeneratorChange('tripNumber2', num)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        );
      }

      default:
        return (
          <Alert severity="info">
            This control variable type is not yet supported.
          </Alert>
        );
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Control Variables (Cards 205CCCNN)</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddCV}
          disabled={controlVariables.length >= 999}
        >
          Add Control Variable
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Supports 21 control variable types including PUMPCTL, STEAMCTL, FEEDCTL. SMART.i primary types: CONSTANT, SUM, FUNCTION, TRIPUNIT, TRIPDLAY, MULT, PROP-INT, INTEGRAL, STDFNCTN.
      </Alert>

      {controlVariables.length === 0 ? (
        <Alert severity="info">
          No control variables defined. Click "Add Control Variable" to create one.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Formula Preview</TableCell>
                <TableCell>Comment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {controlVariables.map((cv, index) => (
                <TableRow key={cv.number}>
                  <TableCell>{cv.number}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {cv.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cv.componentType}
                      size="small"
                      color={cv.componentType === 'CONSTANT' ? 'default' : 'primary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>
                      {getFormulaPreview(cv)}
                    </Typography>
                  </TableCell>
                  <TableCell>{cv.comment || '-'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditCV(index)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={() => handleCopyCV(index)}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteCV(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialog.open} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialog.mode === 'add' ? 'Add Control Variable' : 'Edit Control Variable'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {validationError && (
              <Alert severity="error">{validationError}</Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={3}>
                <TextField
                  label="Number (CCC)"
                  type="number"
                  value={dialog.cv.number}
                  onChange={(e) => handleFieldChange('number', parseInt(e.target.value) || 1)}
                  fullWidth
                  inputProps={{ min: 1, max: 999 }}
                  helperText="1-999"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Name"
                  value={dialog.cv.name}
                  onChange={(e) => handleFieldChange('name', e.target.value.slice(0, 8))}
                  fullWidth
                  inputProps={{ maxLength: 8 }}
                  helperText="Max 8 characters"
                />
              </Grid>
              <Grid item xs={5}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={dialog.cv.componentType}
                    label="Type"
                    onChange={(e) => handleTypeChange(e.target.value as ControlComponentType)}
                  >
                    {SUPPORTED_TYPES.map(type => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider />

            {renderTypeSpecificFields()}

            <Divider />

            <TextField
              label="Comment (Optional)"
              value={dialog.cv.comment || ''}
              onChange={(e) => handleFieldChange('comment', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ControlVariablesTab;
