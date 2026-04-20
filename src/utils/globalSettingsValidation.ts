/**
 * Global Settings Validation
 * Validates MARS global control cards (independent cards only)
 */

import { GlobalSettings, SystemConfig, MinorEdit, VariableTrip, LogicTrip, InteractiveInput, ControlVariable, isConstantControlVariable, isNonConstantControlVariable, SumData, TripUnitData } from '@/types/mars';
import { Node } from 'reactflow';
import { MARSNodeData } from '@/types/mars';
import { NodeIdResolver } from './nodeIdResolver';

export interface GlobalValidationError {
  card: string;
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface GlobalValidationResult {
  valid: boolean;
  errors: GlobalValidationError[];
  warnings: GlobalValidationError[];
}

/**
 * Validates global settings (independent cards)
 * Does NOT validate references to components (that's done separately)
 */
export function validateGlobalSettings(settings: GlobalSettings): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  // Card 100: Problem Type (Required)
  if (!settings.card100) {
    errors.push({
      card: '100',
      field: 'all',
      message: 'Card 100 (Problem Type) is required',
      level: 'error'
    });
  }

  // Card 101: Run Option (Required)
  if (!settings.card101) {
    errors.push({
      card: '101',
      field: 'all',
      message: 'Card 101 (Run Option) is required',
      level: 'error'
    });
  }

  // Card 102: Units (Required)
  if (!settings.card102) {
    errors.push({
      card: '102',
      field: 'all',
      message: 'Card 102 (Units) is required',
      level: 'error'
    });
  }

  // Determine if restart mode (Card 110/115/120-129 validation skipped)
  const isRestart = settings.card100?.problemType === 'restart';

  // Card 110 & 115: Gas configuration validation (skip in restart mode — MARS Manual Card 110/115)
  if (!isRestart && settings.card110 && settings.card110.gases.length > 0) {
    // If gases are specified, Card 115 (fractions) is required
    if (!settings.card115 || settings.card115.fractions.length === 0) {
      errors.push({
        card: '115',
        field: 'fractions',
        message: 'Gas mass fractions (Card 115) required when non-condensable gases are specified',
        level: 'error'
      });
    } else {
      // Check that number of fractions matches number of gases
      if (settings.card115.fractions.length !== settings.card110.gases.length) {
        errors.push({
          card: '115',
          field: 'fractions',
          message: `Number of fractions (${settings.card115.fractions.length}) must match number of gases (${settings.card110.gases.length})`,
          level: 'error'
        });
      }

      // Check that fractions sum to 1.0
      const sum = settings.card115.fractions.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push({
          card: '115',
          field: 'fractions',
          message: `Gas fractions must sum to 1.0 (current: ${sum.toFixed(4)})`,
          level: 'error'
        });
      }

      // Check that all fractions are between 0 and 1
      settings.card115.fractions.forEach((frac, idx) => {
        if (frac < 0 || frac > 1) {
          errors.push({
            card: '115',
            field: `fractions[${idx}]`,
            message: `Gas fraction must be between 0 and 1 (current: ${frac})`,
            level: 'error'
          });
        }
      });
    }
  }

  // Card 120-129: System Configuration (skip in restart mode — MARS Manual Card 120-129)
  if (!isRestart && settings.systems && settings.systems.length > 0) {
    // Check max 10 systems
    if (settings.systems.length > 10) {
      errors.push({
        card: '120-129',
        field: 'systems',
        message: `Maximum 10 systems allowed (current: ${settings.systems.length})`,
        level: 'error'
      });
    }

    // Check unique system numbers
    const systemNumbers = settings.systems.map(s => s.systemNumber);
    const uniqueNumbers = new Set(systemNumbers);
    if (uniqueNumbers.size !== systemNumbers.length) {
      errors.push({
        card: '120-129',
        field: 'systemNumber',
        message: 'System numbers must be unique',
        level: 'error'
      });
    }

    // Validate each system
    settings.systems.forEach((sys) => {
      // System number must be 0-9 (Card 12X, X=systemNumber)
      if (sys.systemNumber < 0 || sys.systemNumber > 9) {
        errors.push({
          card: `${120 + sys.systemNumber}`,
          field: 'systemNumber',
          message: `System number must be between 0 and 9 (current: ${sys.systemNumber})`,
          level: 'error'
        });
      }

      // Reference volume must be provided (VolumeReference object)
      if (!sys.referenceVolume || !sys.referenceVolume.nodeId) {
        errors.push({
          card: `${120 + sys.systemNumber}`,
          field: 'referenceVolume',
          message: 'Reference volume is required',
          level: 'error'
        });
      }

      // System name must be provided
      if (!sys.systemName || sys.systemName.trim() === '') {
        warnings.push({
          card: `${120 + sys.systemNumber}`,
          field: 'systemName',
          message: 'System name is recommended for clarity',
          level: 'warning'
        });
      }
    });
  }

  // Card 200: Initial Time (Required)
  if (settings.card200 === undefined) {
    errors.push({
      card: '200',
      field: 'initialTime',
      message: 'Card 200 (Initial Time) is required',
      level: 'error'
    });
  } else if (settings.card200.initialTime < 0) {
    errors.push({
      card: '200',
      field: 'initialTime',
      message: 'Initial time cannot be negative',
      level: 'error'
    });
  }

  // Card 201-299: Time Phases (At least 1 required)
  if (!settings.timePhases || settings.timePhases.length === 0) {
    errors.push({
      card: '201',
      field: 'timePhases',
      message: 'At least one time phase is required',
      level: 'error'
    });
  } else {
    // Check that end times are increasing
    for (let i = 1; i < settings.timePhases.length; i++) {
      if (settings.timePhases[i].endTime <= settings.timePhases[i - 1].endTime) {
        errors.push({
          card: `20${i + 1}`,
          field: 'endTime',
          message: `Time phases must have increasing end times (Phase ${i + 1}: ${settings.timePhases[i].endTime} <= Phase ${i}: ${settings.timePhases[i - 1].endTime})`,
          level: 'error'
        });
      }
    }

    // Validate each time phase
    settings.timePhases.forEach((phase, idx) => {
      const cardNum = `20${idx + 1}`;

      // End time must be positive
      if (phase.endTime <= 0) {
        errors.push({
          card: cardNum,
          field: 'endTime',
          message: `End time must be positive (current: ${phase.endTime})`,
          level: 'error'
        });
      }

      // Min dt must be positive
      if (phase.minDt <= 0) {
        errors.push({
          card: cardNum,
          field: 'minDt',
          message: `Minimum dt must be positive (current: ${phase.minDt})`,
          level: 'error'
        });
      }

      // Max dt must be positive
      if (phase.maxDt <= 0) {
        errors.push({
          card: cardNum,
          field: 'maxDt',
          message: `Maximum dt must be positive (current: ${phase.maxDt})`,
          level: 'error'
        });
      }

      // Min dt < Max dt
      if (phase.minDt >= phase.maxDt) {
        errors.push({
          card: cardNum,
          field: 'dt',
          message: `Min dt (${phase.minDt}) must be less than Max dt (${phase.maxDt})`,
          level: 'error'
        });
      }

      // Control option must be 5 digits
      if (!/^\d{5}$/.test(phase.controlOption)) {
        errors.push({
          card: cardNum,
          field: 'controlOption',
          message: `Control option must be 5 digits (e.g., 00019), current: "${phase.controlOption}"`,
          level: 'error'
        });
      }

      // Frequencies must be positive integers
      if (phase.minorEditFreq <= 0 || !Number.isInteger(phase.minorEditFreq)) {
        errors.push({
          card: cardNum,
          field: 'minorEditFreq',
          message: `Minor edit frequency must be a positive integer (current: ${phase.minorEditFreq})`,
          level: 'error'
        });
      }

      if (phase.majorEditFreq <= 0 || !Number.isInteger(phase.majorEditFreq)) {
        errors.push({
          card: cardNum,
          field: 'majorEditFreq',
          message: `Major edit frequency must be a positive integer (current: ${phase.majorEditFreq})`,
          level: 'error'
        });
      }

      if (phase.restartFreq <= 0 || !Number.isInteger(phase.restartFreq)) {
        errors.push({
          card: cardNum,
          field: 'restartFreq',
          message: `Restart frequency must be a positive integer (current: ${phase.restartFreq})`,
          level: 'error'
        });
      }

      // First phase should start from initial time
      if (idx === 0 && settings.card200) {
        const initialTime = settings.card200.initialTime;
        if (phase.endTime <= initialTime) {
          warnings.push({
            card: cardNum,
            field: 'endTime',
            message: `First phase end time (${phase.endTime}) should be greater than initial time (${initialTime})`,
            level: 'warning'
          });
        }
      }
    });
  }

  // General Tables (Cards 202TTTNN)
  if (settings.generalTables && settings.generalTables.length > 0) {
    const tableNumbers = new Set<number>();
    settings.generalTables.forEach((table) => {
      const cardLabel = `202${table.tableNumber}00`;

      // Duplicate table number check
      if (tableNumbers.has(table.tableNumber)) {
        errors.push({
          card: cardLabel,
          field: 'tableNumber',
          message: `Duplicate table number: ${table.tableNumber}`,
          level: 'error'
        });
      }
      tableNumbers.add(table.tableNumber);

      // Table number range: 1~999
      if (table.tableNumber < 1 || table.tableNumber > 999) {
        errors.push({
          card: cardLabel,
          field: 'tableNumber',
          message: `Table number must be 1~999 (current: ${table.tableNumber})`,
          level: 'error'
        });
      }

      // Data points: max 99
      if (table.dataPoints.length > 99) {
        errors.push({
          card: cardLabel,
          field: 'dataPoints',
          message: `Maximum 99 data points per table (current: ${table.dataPoints.length})`,
          level: 'error'
        });
      }

      // POWER type requires trip
      if (table.type === 'power' && !table.tripNumber) {
        errors.push({
          card: cardLabel,
          field: 'tripNumber',
          message: 'POWER type requires a trip number',
          level: 'error'
        });
      }

      // NORMAREA: x,y values must be 0~1
      if (table.type === 'normarea') {
        table.dataPoints.forEach((dp, dpIdx) => {
          if (dp.x < 0 || dp.x > 1) {
            errors.push({
              card: `202${table.tableNumber}${(dpIdx + 1).toString().padStart(2, '0')}`,
              field: 'x',
              message: `NORMAREA X (stem position) must be 0~1 (row ${dpIdx + 1}: ${dp.x})`,
              level: 'error'
            });
          }
          if (dp.y < 0 || dp.y > 1) {
            errors.push({
              card: `202${table.tableNumber}${(dpIdx + 1).toString().padStart(2, '0')}`,
              field: 'y',
              message: `NORMAREA Y (area) must be 0~1 (row ${dpIdx + 1}: ${dp.y})`,
              level: 'error'
            });
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate list of available Volume IDs from project nodes
 * Volume ID format: VVVCCNNNN (9 digits)
 * VVV: Component number (3 digits)
 * CC: Volume number (2 digits, 01-99)
 * NNNN: Face (4 digits, 0000=center)
 */
export function generateAvailableVolumeIds(nodes: Node<MARSNodeData>[]): string[] {
  const volumeIds: string[] = [];

  nodes.forEach(node => {
    const compId = node.data.componentId;
    const compType = node.data.componentType;
    const shortId = compId.slice(0, 3); // Extract first 3 digits (e.g., "100" from "1000000")

    if (compType === 'snglvol' || compType === 'tmdpvol') {
      // Single volume components: Volume 01, Center (0000)
      const volumeId = `${shortId}010000`;
      volumeIds.push(volumeId);
    } else if (compType === 'pipe') {
      // PIPE components: generate volume IDs for all cells
      const params = node.data.parameters;
      if ('ncells' in params && typeof params.ncells === 'number') {
        const ncells = params.ncells || 1;
        for (let i = 1; i <= ncells; i++) {
          const volNum = i.toString().padStart(2, '0'); // "01", "02", ...
          const volumeId = `${shortId}${volNum}0000`;
          volumeIds.push(volumeId);
        }
      }
    }
  });

  return volumeIds;
}

/**
 * Validate system references against actual components
 * Checks if referenceVolume IDs exist in the project
 */
export function validateSystemReferences(
  systems: SystemConfig[],
  nodes: Node<MARSNodeData>[]
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!systems || systems.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Generate available Volume IDs from nodes
  const availableVolumeIds = generateAvailableVolumeIds(nodes);
  const availableVolumeIdsSet = new Set(availableVolumeIds);

  // Create NodeIdResolver for VolumeReference conversion
  const resolver = new NodeIdResolver(nodes);

  // Validate each system's referenceVolume
  systems.forEach((sys) => {
    const cardNum = 120 + sys.systemNumber - 1;

    // Check if VolumeReference object exists
    if (!sys.referenceVolume || !sys.referenceVolume.nodeId) {
      errors.push({
        card: `${cardNum}`,
        field: 'referenceVolume',
        message: 'Reference volume is required',
        level: 'error'
      });
      return;
    }

    // Convert VolumeReference to volumeId string
    const volumeId = resolver.getVolumeIdFromReference(sys.referenceVolume);

    if (!volumeId) {
      errors.push({
        card: `${cardNum}`,
        field: 'referenceVolume',
        message: 'Invalid volume reference',
        level: 'error'
      });
      return;
    }

    // Check format (9 digits)
    if (!/^\d{9}$/.test(volumeId)) {
      errors.push({
        card: `${cardNum}`,
        field: 'referenceVolume',
        message: `Volume ID must be 9 digits (Format: CCCVV0000, e.g., 100010000). Current: "${volumeId}"`,
        level: 'error'
      });
      return;
    }

    // Check if Volume ID exists in project
    if (!availableVolumeIdsSet.has(volumeId)) {
      errors.push({
        card: `${cardNum}`,
        field: 'referenceVolume',
        message: `Volume ID "${volumeId}" does not exist in the project. Available Volume IDs: ${availableVolumeIds.length > 0 ? availableVolumeIds.slice(0, 5).join(', ') : 'none'}${availableVolumeIds.length > 5 ? '...' : ''}`,
        level: 'error'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate list of available Junction IDs from project nodes
 * Junction ID format: VVVCCNNNN (9 digits)
 * For SNGLJUN/TMDPJUN: CCCVV000N format where N=1 (inlet) or 2 (outlet)
 * For PIPE junctions: CCCVV000N format where N=1-6 (junction number)
 */
export function generateAvailableJunctionIds(nodes: Node<MARSNodeData>[]): string[] {
  const junctionIds: string[] = [];

  nodes.forEach(node => {
    const compId = node.data.componentId;
    const compType = node.data.componentType;
    const shortId = compId.slice(0, 3); // Extract first 3 digits

    if (compType === 'sngljun') {
      // SNGLJUN: two junctions (inlet=1, outlet=2)
      const inletId = `${shortId}010001`;  // CCCVV0001
      const outletId = `${shortId}010002`;  // CCCVV0002
      junctionIds.push(inletId, outletId);
    } else if (compType === 'tmdpjun') {
      // TMDPJUN: similar to SNGLJUN
      const inletId = `${shortId}010001`;  // CCCVV0001
      const outletId = `${shortId}010002`;  // CCCVV0002
      junctionIds.push(inletId, outletId);
    } else if (compType === 'pipe') {
      // PIPE: generate junction IDs for all junctions
      // Junction number = cell number (1 to ncells)
      const params = node.data.parameters;
      if ('ncells' in params && typeof params.ncells === 'number') {
        const ncells = params.ncells || 1;
        // PIPE has ncells+1 junctions
        for (let i = 1; i <= ncells + 1; i++) {
          const junctionNum = Math.min(i, 6); // Junction number capped at 6
          const volNum = i <= ncells ? i.toString().padStart(2, '0') : ncells.toString().padStart(2, '0');
          const junctionId = `${shortId}${volNum}000${junctionNum}`;
          junctionIds.push(junctionId);
        }
      }
    }
  });

  return junctionIds;
}

/**
 * Validate minor edits against actual components and control variables
 * Checks if referenced Volume IDs, Junction IDs, and Control Variable numbers exist
 */
export function validateMinorEdits(
  minorEdits: MinorEdit[],
  nodes: Node<MARSNodeData>[],
  controlVariableNumbers?: number[] // Available control variable numbers (Card 205xxxxx)
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!minorEdits || minorEdits.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Generate available IDs
  const availableVolumeIds = generateAvailableVolumeIds(nodes);
  const availableJunctionIds = generateAvailableJunctionIds(nodes);
  const availableVolumeIdsSet = new Set(availableVolumeIds);
  const availableJunctionIdsSet = new Set(availableJunctionIds);
  const availableControlVarSet = controlVariableNumbers ? new Set(controlVariableNumbers) : new Set<number>();

  // Track used card numbers
  const usedCardNumbers = new Set<number>();

  // Validate each minor edit
  minorEdits.forEach((edit) => {
    const cardNum = edit.cardNumber;

    // Check card number range (301-399)
    if (cardNum < 301 || cardNum > 399) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Card number must be between 301 and 399 (current: ${cardNum})`,
        level: 'error'
      });
    }

    // Check for duplicate card numbers
    if (usedCardNumbers.has(cardNum)) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Duplicate card number: ${cardNum}`,
        level: 'error'
      });
    }
    usedCardNumbers.add(cardNum);

    // Validate parameter based on variable type
    const paramStr = edit.parameter.toString().trim();

    if (edit.variableType === 'rktpow' || edit.variableType === 'time') {
      // Parameter should be 0
      if (paramStr !== '0') {
        warnings.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `${edit.variableType} parameter should be 0 (current: ${paramStr})`,
          level: 'warning'
        });
      }
    } else if (edit.variableType === 'cntrlvar') {
      // Parameter should be a control variable number
      const controlVarNum = parseInt(paramStr, 10);
      if (isNaN(controlVarNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Control variable number must be numeric (current: ${paramStr})`,
          level: 'error'
        });
      } else if (controlVariableNumbers && !availableControlVarSet.has(controlVarNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Control variable ${controlVarNum} does not exist in the project`,
          level: 'error'
        });
      }
    } else if (edit.variableType === 'p' || edit.variableType === 'tempf' || edit.variableType === 'voidf') {
      // Parameter should be a Volume ID (9 digits)
      if (!/^\d{9}$/.test(paramStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Volume ID must be 9 digits (Format: CCCVV0000, e.g., 100010000). Current: "${paramStr}"`,
          level: 'error'
        });
      } else if (!availableVolumeIdsSet.has(paramStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Volume ID "${paramStr}" does not exist in the project`,
          level: 'error'
        });
      }
    } else if (edit.variableType === 'mflowj') {
      // Parameter should be a Junction ID (9 digits, format CCCVV000N)
      if (!/^\d{9}$/.test(paramStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Junction ID must be 9 digits (Format: CCCVV000N, e.g., 100010001). Current: "${paramStr}"`,
          level: 'error'
        });
      } else if (!availableJunctionIdsSet.has(paramStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'parameter',
          message: `Junction ID "${paramStr}" does not exist in the project`,
          level: 'error'
        });
      }
    }

    // Validate limits
    if (edit.lowerLimit >= edit.upperLimit) {
      errors.push({
        card: `${cardNum}`,
        field: 'limits',
        message: `Lower limit (${edit.lowerLimit}) must be less than upper limit (${edit.upperLimit})`,
        level: 'error'
      });
    }

    // Validate edit group (1-999)
    if (edit.editGroup < 1 || edit.editGroup > 999) {
      errors.push({
        card: `${cardNum}`,
        field: 'editGroup',
        message: `Edit group must be between 1 and 999 (current: ${edit.editGroup})`,
        level: 'error'
      });
    }

    // Validate edit priority (should be positive integer)
    if (edit.editPriority < 1 || !Number.isInteger(edit.editPriority)) {
      errors.push({
        card: `${cardNum}`,
        field: 'editPriority',
        message: `Edit priority must be a positive integer (current: ${edit.editPriority})`,
        level: 'error'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default global settings based on SMART example
 */
export function getDefaultGlobalSettings(): GlobalSettings {
  return {
    card001: { enabled: false, values: [] },
    card104: { enabled: false, action: 'ncmpress', fileName: '' },
    card105: { enabled: false, limit1: 10.0, limit2: 20.0 },
    card100: { problemType: 'new', calculationType: 'transnt' },
    card101: { runOption: 'run' },
    card102: { inputUnits: 'si', outputUnits: 'si' },
    card110: { gases: ['nitrogen'] },
    card115: { fractions: [1.0] },
    systems: [],
    card200: { initialTime: 0.0 },
    timePhases: [
      {
        endTime: 100.0,
        minDt: 1.0e-8,
        maxDt: 0.001,
        controlOption: '00019',
        minorEditFreq: 1000,
        majorEditFreq: 10000,
        restartFreq: 100000
      }
    ],
    minorEdits: [],
    variableTrips: [],
    logicTrips: [],
    controlVariables: [],
    interactiveInputs: [],
    generalTables: [],
    reactorKinetics: {
      enabled: false,
      kineticsType: 'point',
      feedbackType: 'separabl',
      decayType: 'gamma-ac',
      power: 0,
      reactivity: 0,
      inverseLambda: 0,
      fpyf: 1.0,
      ansStandard: 'ans79-1',
      additionalDecayHeat: 0,
      moderatorDensityReactivity: [],
      dopplerReactivity: [],
      densityWeightingFactors: [],
      dopplerWeightingFactors: [],
    },
  };
}

/**
 * Validate logic trips (Card 601-799)
 * Checks card number range, duplicate cards, operator validity, and trip references
 */
export function validateLogicTrips(
  logicTrips: LogicTrip[],
  variableTripNumbers?: number[],
  logicTripNumbers?: number[]
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!logicTrips || logicTrips.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // All available trip numbers (Variable + Logic)
  const allTripNumbers = new Set<number>([
    ...(variableTripNumbers || []),
    ...(logicTripNumbers || [])
  ]);

  const usedCardNumbers = new Set<number>();

  logicTrips.forEach((trip) => {
    const cardNum = trip.cardNumber;

    // 1. Card number range (601-799)
    if (cardNum < 601 || cardNum > 799) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Logic trip card number must be between 601 and 799 (got ${cardNum})`,
        level: 'error'
      });
    }

    // 2. Duplicate check
    if (usedCardNumbers.has(cardNum)) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Duplicate logic trip card number: ${cardNum}`,
        level: 'error'
      });
    }
    usedCardNumbers.add(cardNum);

    // 3. Trip1 reference validation
    if (trip.trip1 < 401 || trip.trip1 > 799) {
      errors.push({
        card: `${cardNum}`,
        field: 'trip1',
        message: `Trip 1 number must be between 401 and 799 (got ${trip.trip1})`,
        level: 'error'
      });
    } else if (allTripNumbers.size > 0 && !allTripNumbers.has(trip.trip1)) {
      warnings.push({
        card: `${cardNum}`,
        field: 'trip1',
        message: `Trip ${trip.trip1} referenced in trip1 does not exist`,
        level: 'warning'
      });
    }

    // 4. Trip2 reference validation
    if (trip.trip2 < 401 || trip.trip2 > 799) {
      errors.push({
        card: `${cardNum}`,
        field: 'trip2',
        message: `Trip 2 number must be between 401 and 799 (got ${trip.trip2})`,
        level: 'error'
      });
    } else if (allTripNumbers.size > 0 && !allTripNumbers.has(trip.trip2)) {
      warnings.push({
        card: `${cardNum}`,
        field: 'trip2',
        message: `Trip ${trip.trip2} referenced in trip2 does not exist`,
        level: 'warning'
      });
    }

    // 5. Operator validation
    if (trip.operator !== 'and' && trip.operator !== 'or') {
      errors.push({
        card: `${cardNum}`,
        field: 'operator',
        message: `Operator must be "and" or "or" (got "${trip.operator}")`,
        level: 'error'
      });
    }

    // 6. Comment length validation
    if (trip.comment && trip.comment.length > 24) {
      warnings.push({
        card: `${cardNum}`,
        field: 'comment',
        message: `Comment exceeds 24 characters (${trip.comment.length} chars)`,
        level: 'warning'
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate variable trips against actual components, control variables, and other trips
 * Checks if referenced Volume IDs, Junction IDs, Control Variable numbers, and Trip numbers exist
 */
export function validateVariableTrips(
  variableTrips: VariableTrip[],
  nodes: Node<MARSNodeData>[],
  controlVariableNumbers?: number[], // Available control variable numbers (Card 205xxxxx)
  tripNumbers?: number[] // Available trip numbers (for timeof references)
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!variableTrips || variableTrips.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Generate available IDs
  const availableVolumeIds = generateAvailableVolumeIds(nodes);
  const availableJunctionIds = generateAvailableJunctionIds(nodes);
  const availableVolumeIdsSet = new Set(availableVolumeIds);
  const availableJunctionIdsSet = new Set(availableJunctionIds);
  const availableControlVarSet = controlVariableNumbers ? new Set(controlVariableNumbers) : new Set<number>();
  const availableTripSet = tripNumbers ? new Set(tripNumbers) : new Set<number>();

  // Track used card numbers
  const usedCardNumbers = new Set<number>();

  // Validate each variable trip
  variableTrips.forEach((trip) => {
    const cardNum = trip.cardNumber;

    // Check card number range (401-599)
    if (cardNum < 401 || cardNum > 599) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Card number must be between 401 and 599 (current: ${cardNum})`,
        level: 'error'
      });
    }

    // Check for duplicate card numbers
    if (usedCardNumbers.has(cardNum)) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Duplicate card number: ${cardNum}`,
        level: 'error'
      });
    }
    usedCardNumbers.add(cardNum);

    // Validate left variable and parameter
    const leftParamStr = trip.leftParam.toString().trim();

    if (trip.leftVar === 'time') {
      // Parameter should be 0
      if (leftParamStr !== '0') {
        warnings.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `time parameter should be 0 (current: ${leftParamStr})`,
          level: 'warning'
        });
      }
    } else if (trip.leftVar === 'cntrlvar') {
      // Parameter should be a control variable number
      const controlVarNum = parseInt(leftParamStr, 10);
      if (isNaN(controlVarNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Control variable number must be numeric (current: ${leftParamStr})`,
          level: 'error'
        });
      } else if (controlVariableNumbers && !availableControlVarSet.has(controlVarNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Control variable ${controlVarNum} does not exist in the project`,
          level: 'error'
        });
      }
    } else if (trip.leftVar === 'p' || trip.leftVar === 'tempf' || trip.leftVar === 'voidf') {
      // Parameter should be a Volume ID (9 digits)
      if (!/^\d{9}$/.test(leftParamStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Volume ID must be 9 digits (Format: CCCVV0000, e.g., 100010000). Current: "${leftParamStr}"`,
          level: 'error'
        });
      } else if (!availableVolumeIdsSet.has(leftParamStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Volume ID "${leftParamStr}" does not exist in the project`,
          level: 'error'
        });
      }
    } else if (trip.leftVar === 'mflowj') {
      // Parameter should be a Junction ID (9 digits, format CCCVV000N)
      if (!/^\d{9}$/.test(leftParamStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Junction ID must be 9 digits (Format: CCCVV000N, e.g., 100010001). Current: "${leftParamStr}"`,
          level: 'error'
        });
      } else if (!availableJunctionIdsSet.has(leftParamStr)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Junction ID "${leftParamStr}" does not exist in the project`,
          level: 'error'
        });
      }
    } else if (trip.leftVar === 'timeof') {
      // Parameter should be a Trip number
      const tripNum = parseInt(leftParamStr, 10);
      if (isNaN(tripNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Trip number must be numeric (current: ${leftParamStr})`,
          level: 'error'
        });
      } else if (tripNumbers && !availableTripSet.has(tripNum)) {
        errors.push({
          card: `${cardNum}`,
          field: 'leftParam',
          message: `Trip ${tripNum} does not exist in the project`,
          level: 'error'
        });
      }
    }

    // Validate right variable and parameter
    if (trip.rightVar === 'null') {
      // Right parameter should be 0 when rightVar is null
      const rightParamStr = trip.rightParam.toString().trim();
      if (rightParamStr !== '0') {
        warnings.push({
          card: `${cardNum}`,
          field: 'rightParam',
          message: `rightParam should be 0 when rightVar is null (current: ${rightParamStr})`,
          level: 'warning'
        });
      }
    } else {
      // Validate right variable parameter (similar to left variable)
      const rightParamStr = trip.rightParam.toString().trim();

      if (trip.rightVar === 'time') {
        if (rightParamStr !== '0') {
          warnings.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `time parameter should be 0 (current: ${rightParamStr})`,
            level: 'warning'
          });
        }
      } else if (trip.rightVar === 'cntrlvar') {
        const controlVarNum = parseInt(rightParamStr, 10);
        if (isNaN(controlVarNum)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Control variable number must be numeric (current: ${rightParamStr})`,
            level: 'error'
          });
        } else if (controlVariableNumbers && !availableControlVarSet.has(controlVarNum)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Control variable ${controlVarNum} does not exist in the project`,
            level: 'error'
          });
        }
      } else if (trip.rightVar === 'p' || trip.rightVar === 'tempf' || trip.rightVar === 'voidf') {
        if (!/^\d{9}$/.test(rightParamStr)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Volume ID must be 9 digits (Format: CCCVV0000). Current: "${rightParamStr}"`,
            level: 'error'
          });
        } else if (!availableVolumeIdsSet.has(rightParamStr)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Volume ID "${rightParamStr}" does not exist in the project`,
            level: 'error'
          });
        }
      } else if (trip.rightVar === 'mflowj') {
        if (!/^\d{9}$/.test(rightParamStr)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Junction ID must be 9 digits (Format: CCCVV000N). Current: "${rightParamStr}"`,
            level: 'error'
          });
        } else if (!availableJunctionIdsSet.has(rightParamStr)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Junction ID "${rightParamStr}" does not exist in the project`,
            level: 'error'
          });
        }
      } else if (trip.rightVar === 'timeof') {
        const tripNum = parseInt(rightParamStr, 10);
        if (isNaN(tripNum)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Trip number must be numeric (current: ${rightParamStr})`,
            level: 'error'
          });
        } else if (tripNumbers && !availableTripSet.has(tripNum)) {
          errors.push({
            card: `${cardNum}`,
            field: 'rightParam',
            message: `Trip ${tripNum} does not exist in the project`,
            level: 'error'
          });
        }
      }
    }

    // Validate latch value
    if (trip.latch !== 'l' && trip.latch !== 'n') {
      errors.push({
        card: `${cardNum}`,
        field: 'latch',
        message: `Latch must be 'l' (latch) or 'n' (no latch) (current: ${trip.latch})`,
        level: 'error'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate interactive inputs against actual components, trips, and junctions
 * Checks if referenced Trip numbers, Component IDs, Junction IDs, and Table numbers exist
 */
export function validateInteractiveInputs(
  interactiveInputs: InteractiveInput[],
  nodes: Node<MARSNodeData>[],
  variableTrips?: VariableTrip[]
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!interactiveInputs || interactiveInputs.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Generate available IDs
  const availableJunctionIds = generateAvailableJunctionIds(nodes);
  const availableJunctionIdsSet = new Set(availableJunctionIds);
  const availableTripNumbers = variableTrips
    ? new Set(variableTrips.map(t => t.cardNumber))
    : new Set<number>();

  // Track used card numbers
  const usedCardNumbers = new Set<number>();

  // Validate each interactive input
  interactiveInputs.forEach((input) => {
    const cardNum = input.cardNumber;

    // 1. Card number range check (801-999)
    if (cardNum < 801 || cardNum > 999) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Card number must be between 801 and 999 (current: ${cardNum})`,
        level: 'error'
      });
    }

    // 2. Duplicate card number check
    if (usedCardNumbers.has(cardNum)) {
      errors.push({
        card: `${cardNum}`,
        field: 'cardNumber',
        message: `Duplicate card number: ${cardNum}`,
        level: 'error'
      });
    }
    usedCardNumbers.add(cardNum);

    // 3. Parameter validation by control type
    const paramStr = input.parameter.toString().trim();

    switch (input.controlType) {
      case 'trip':
        // Trip number must be 400-799
        const tripNum = parseInt(paramStr, 10);
        if (isNaN(tripNum) || tripNum < 400 || tripNum > 799) {
          errors.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Trip number must be between 400 and 799 (current: ${paramStr})`,
            level: 'error'
          });
        } else if (variableTrips && variableTrips.length > 0 && !availableTripNumbers.has(tripNum)) {
          warnings.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Trip ${tripNum} is not defined in Variable Trips`,
            level: 'warning'
          });
        }
        break;

      case 'vlvarea':
        // Component number (3 digits, 100-999)
        const compNum = parseInt(paramStr, 10);
        if (isNaN(compNum) || compNum < 100 || compNum > 999) {
          errors.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Component number must be 3 digits (100-999), current: ${paramStr}`,
            level: 'error'
          });
        }
        break;

      case 'mflowfj':
      case 'mflowgj':
        // Junction ID (9 digits, CCCVV000N format)
        if (!/^\d{9}$/.test(paramStr)) {
          errors.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Junction ID must be 9 digits (Format: CCCVV000N), current: "${paramStr}"`,
            level: 'error'
          });
        } else if (!availableJunctionIdsSet.has(paramStr)) {
          warnings.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Junction ID "${paramStr}" does not exist in the project`,
            level: 'warning'
          });
        }
        break;

      case 'power':
        // Heater table number (positive integer)
        const tableNum = parseInt(paramStr, 10);
        if (isNaN(tableNum) || tableNum <= 0) {
          errors.push({
            card: `${cardNum}`,
            field: 'parameter',
            message: `Heater table number must be a positive integer (current: ${paramStr})`,
            level: 'error'
          });
        }
        break;
    }

    // 4. Comment length check (max 32 characters)
    if (input.comment && input.comment.length > 32) {
      errors.push({
        card: `${cardNum}`,
        field: 'comment',
        message: `Comment must be 32 characters or less (current: ${input.comment.length})`,
        level: 'error'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate Control Variables (Cards 205CCCNN)
 * Phase 1: CONSTANT, SUM, TRIPUNIT types only
 */
export function validateControlVariables(
  controlVariables: ControlVariable[],
  tripNumbers?: number[] // Available trip numbers for TRIPUNIT validation
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];

  if (!controlVariables || controlVariables.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  const usedNumbers = new Set<number>();
  const availableTripSet = tripNumbers ? new Set(tripNumbers) : new Set<number>();
  const controlVarNumbers = new Set(controlVariables.map(cv => cv.number));

  controlVariables.forEach((cv) => {
    const cardPrefix = `205${cv.number.toString().padStart(3, '0')}`;

    // 1. Number range check (001-999)
    if (cv.number < 1 || cv.number > 999) {
      errors.push({
        card: cardPrefix,
        field: 'number',
        message: `Control variable number must be between 001 and 999 (current: ${cv.number})`,
        level: 'error'
      });
    }

    // 2. Duplicate number check
    if (usedNumbers.has(cv.number)) {
      errors.push({
        card: cardPrefix,
        field: 'number',
        message: `Duplicate control variable number: ${cv.number}`,
        level: 'error'
      });
    }
    usedNumbers.add(cv.number);

    // 3. Name validation (alphanumeric, max 8 chars for MARS)
    if (cv.name && cv.name.length > 8) {
      warnings.push({
        card: cardPrefix,
        field: 'name',
        message: `Name exceeds 8 characters, may be truncated in MARS output: "${cv.name}"`,
        level: 'warning'
      });
    }

    // 4. Type-specific validation
    if (isConstantControlVariable(cv)) {
      // CONSTANT: scalingFactor is the constant value, no additional checks needed
      if (cv.scalingFactor === undefined || cv.scalingFactor === null) {
        errors.push({
          card: cardPrefix,
          field: 'scalingFactor',
          message: 'Constant value is required',
          level: 'error'
        });
      }
    } else if (isNonConstantControlVariable(cv)) {
      // Non-constant types: validate common fields
      if (cv.scalingFactor === 0) {
        warnings.push({
          card: cardPrefix,
          field: 'scalingFactor',
          message: 'Scale factor is 0, output will always be 0',
          level: 'warning'
        });
      }

      // Min/Max range check
      if (cv.minValue !== undefined && cv.maxValue !== undefined && cv.minValue > cv.maxValue) {
        errors.push({
          card: cardPrefix,
          field: 'minValue/maxValue',
          message: `Min value (${cv.minValue}) is greater than max value (${cv.maxValue})`,
          level: 'error'
        });
      }

      // Type-specific data validation
      if (cv.componentType === 'SUM') {
        const sumData = cv.data as SumData;
        if (!sumData.terms || sumData.terms.length === 0) {
          errors.push({
            card: cardPrefix,
            field: 'data.terms',
            message: 'SUM type requires at least one term',
            level: 'error'
          });
        } else {
          // Validate each term's variable reference
          sumData.terms.forEach((term, idx) => {
            if (!term.variable || !term.variable.variableName) {
              errors.push({
                card: `${cardPrefix}${(idx + 1).toString().padStart(2, '0')}`,
                field: `terms[${idx}].variable`,
                message: `Term ${idx + 1}: Variable name is required`,
                level: 'error'
              });
            }
            // Check if referencing another control variable that exists
            if (term.variable?.variableName === 'cntrlvar') {
              const refNum = term.variable.parameterCode;
              if (refNum && !controlVarNumbers.has(refNum)) {
                warnings.push({
                  card: `${cardPrefix}${(idx + 1).toString().padStart(2, '0')}`,
                  field: `terms[${idx}].variable`,
                  message: `Term ${idx + 1}: References control variable ${refNum} which is not defined`,
                  level: 'warning'
                });
              }
            }
          });
        }
      } else if (cv.componentType === 'TRIPUNIT') {
        const tripData = cv.data as TripUnitData;
        const tripNum = Math.abs(tripData.tripNumber);

        if (!tripData.tripNumber) {
          errors.push({
            card: cardPrefix,
            field: 'data.tripNumber',
            message: 'TRIPUNIT type requires a trip number',
            level: 'error'
          });
        } else if (tripNum < 400 || tripNum > 799) {
          errors.push({
            card: cardPrefix,
            field: 'data.tripNumber',
            message: `Trip number must be between 400 and 799 (current: ${tripNum})`,
            level: 'error'
          });
        } else if (tripNumbers && tripNumbers.length > 0 && !availableTripSet.has(tripNum)) {
          warnings.push({
            card: cardPrefix,
            field: 'data.tripNumber',
            message: `Trip ${tripNum} is not defined in Variable Trips`,
            level: 'warning'
          });
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

