/**
 * Component Validation Utilities
 * Shared validation logic for automatic status calculation
 */

import { SngljunParameters, MARSNodeData, HeatStructureParameters, isHeatStructureParameters, ThermalProperty, ValveParameters, isValveParameters, TankParameters, SeparatorParameters, isSeparatorParameters } from '@/types/mars';
import { NodeIdResolver } from './nodeIdResolver';
import { Node } from 'reactflow';

interface ValidationResult {
  status: 'valid' | 'incomplete' | 'error';
  errors: Array<{ level: 'error'; message: string }>;
  warnings: Array<{ level: 'warning'; message: string }>;
}

/**
 * Validate SNGLJUN component
 */
export function validateSngljun(
  data: MARSNodeData,
  nodes: Node<MARSNodeData>[]
): ValidationResult {
  console.log('[validateSngljun] Starting validation for:', data.componentId);
  const params = data.parameters as Partial<SngljunParameters>;
  console.log('[validateSngljun] Parameters:', params);
  const validationErrors: Array<{ level: 'error'; message: string }> = [];
  const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

  // Create resolver for validation
  const resolver = new NodeIdResolver(nodes);

  // Check name
  if (!data.componentName) {
    validationErrors.push({ level: 'error', message: 'Name is required' });
  }

  // Check area
  if (!params.area || params.area <= 0) {
    validationErrors.push({ level: 'error', message: 'Area must be positive' });
  }

  // Check from/to connections (warnings only - allow saving without connections)
  const hasFrom = params.from !== null && params.from !== undefined;
  const hasTo = params.to !== null && params.to !== undefined;
  console.log('[validateSngljun] hasFrom:', hasFrom, ', hasTo:', hasTo);
  console.log('[validateSngljun] params.from:', params.from);
  console.log('[validateSngljun] params.to:', params.to);

  if (!hasFrom && !hasTo) {
    validationWarnings.push({ level: 'warning', message: 'No connections defined (From/To)' });
  } else {
    if (!hasFrom) {
      validationWarnings.push({ level: 'warning', message: 'From Volume is not connected' });
    } else if (params.from && !resolver.validateVolumeReference(params.from)) {
      validationWarnings.push({ level: 'warning', message: 'Invalid From Volume reference' });
    }

    if (!hasTo) {
      validationWarnings.push({ level: 'warning', message: 'To Volume is not connected' });
    } else if (params.to && !resolver.validateVolumeReference(params.to)) {
      validationWarnings.push({ level: 'warning', message: 'Invalid To Volume reference' });
    }
  }

  // Calculate status
  const status = validationErrors.length === 0
    ? (validationWarnings.length > 0 ? 'incomplete' : 'valid')
    : 'error';

  console.log('[validateSngljun] Validation complete:');
  console.log('[validateSngljun]   - errors:', validationErrors.length);
  console.log('[validateSngljun]   - warnings:', validationWarnings.length);
  console.log('[validateSngljun]   - status:', status);

  return {
    status,
    errors: validationErrors,
    warnings: validationWarnings,
  };
}

/**
 * Validate VALVE component
 * Supports: trpvlv (Trip), srvvlv (Servo), mtrvlv (Motor)
 */
export function validateValve(
  data: MARSNodeData,
  nodes: Node<MARSNodeData>[]
): ValidationResult {
  console.log('[validateValve] Starting validation for:', data.componentId);
  const validationErrors: Array<{ level: 'error'; message: string }> = [];
  const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

  if (!isValveParameters(data.parameters)) {
    validationErrors.push({ level: 'error', message: 'Invalid Valve parameters' });
    return { status: 'error', errors: validationErrors, warnings: validationWarnings };
  }

  const params = data.parameters as ValveParameters;
  const resolver = new NodeIdResolver(nodes);

  // Check name
  if (!data.componentName) {
    validationErrors.push({ level: 'error', message: 'Name is required' });
  }

  // Check area
  if (!params.area || params.area <= 0) {
    validationErrors.push({ level: 'error', message: 'Area must be positive' });
  }

  // Check from/to connections (warnings only - allow saving without connections)
  const hasFrom = params.from !== null && params.from !== undefined;
  const hasTo = params.to !== null && params.to !== undefined;

  if (!hasFrom && !hasTo) {
    validationWarnings.push({ level: 'warning', message: 'No connections defined (From/To)' });
  } else {
    if (!hasFrom) {
      validationWarnings.push({ level: 'warning', message: 'From Volume is not connected' });
    } else if (params.from && !resolver.validateVolumeReference(params.from)) {
      validationWarnings.push({ level: 'warning', message: 'Invalid From Volume reference' });
    }

    if (!hasTo) {
      validationWarnings.push({ level: 'warning', message: 'To Volume is not connected' });
    } else if (params.to && !resolver.validateVolumeReference(params.to)) {
      validationWarnings.push({ level: 'warning', message: 'Invalid To Volume reference' });
    }
  }

  // Validate valve-type specific parameters
  const valveSubType = params.valveSubType;

  if (valveSubType === 'trpvlv') {
    // Trip Valve: tripNumber must be 401-799 (Variable Trips 401-599 + Logic Trips 601-799)
    if (params.tripNumber === undefined || params.tripNumber === null) {
      validationErrors.push({ level: 'error', message: 'Trip Number is required for Trip Valve' });
    } else if (params.tripNumber < 401 || params.tripNumber > 799) {
      validationErrors.push({ level: 'error', message: 'Trip Number must be between 401-799' });
    }
  } else if (valveSubType === 'srvvlv') {
    // Servo Valve: controlVariable is required
    if (params.controlVariable === undefined || params.controlVariable === null) {
      validationErrors.push({ level: 'error', message: 'Control Variable is required for Servo Valve' });
    }
  } else if (valveSubType === 'mtrvlv') {
    // Motor Valve: openTrip, closeTrip, valveRate are required
    if (params.openTripNumber === undefined || params.openTripNumber === null) {
      validationErrors.push({ level: 'error', message: 'Open Trip Number is required for Motor Valve' });
    }
    if (params.closeTripNumber === undefined || params.closeTripNumber === null) {
      validationErrors.push({ level: 'error', message: 'Close Trip Number is required for Motor Valve' });
    }
    if (!params.valveRate || params.valveRate <= 0) {
      validationErrors.push({ level: 'error', message: 'Valve Rate must be positive for Motor Valve' });
    }
    if (params.initialPosition !== undefined && (params.initialPosition < 0 || params.initialPosition > 1)) {
      validationErrors.push({ level: 'error', message: 'Initial Position must be between 0 and 1' });
    }
    if (params.dischargeCoeff !== undefined && params.dischargeCoeff < 0) {
      validationErrors.push({ level: 'error', message: 'Discharge Coefficient must be non-negative' });
    }
    if (params.thermalCoeff !== undefined && params.thermalCoeff < 0) {
      validationErrors.push({ level: 'error', message: 'Thermal Coefficient must be non-negative' });
    }
  }

  // Calculate status
  const status = validationErrors.length === 0
    ? (validationWarnings.length > 0 ? 'incomplete' : 'valid')
    : 'error';

  console.log('[validateValve] Validation complete:', { errors: validationErrors.length, warnings: validationWarnings.length, status });

  return {
    status,
    errors: validationErrors,
    warnings: validationWarnings,
  };
}

/**
 * Validate HTSTR (Heat Structure) component
 */
export function validateHeatStructure(
  data: MARSNodeData,
  _nodes: Node<MARSNodeData>[]
): ValidationResult {
  console.log('[validateHeatStructure] Starting validation for:', data.componentId);
  const validationErrors: Array<{ level: 'error'; message: string }> = [];
  const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

  if (!isHeatStructureParameters(data.parameters)) {
    validationErrors.push({ level: 'error', message: 'Invalid Heat Structure parameters' });
    return { status: 'error', errors: validationErrors, warnings: validationWarnings };
  }

  const params = data.parameters as HeatStructureParameters;

  // Check name
  if (!data.componentName) {
    validationErrors.push({ level: 'error', message: 'Name is required' });
  }

  // Validate nh (axial nodes)
  if (params.nh < 1 || params.nh > 99) {
    validationErrors.push({ level: 'error', message: 'nh (axial nodes) must be 1-99' });
  }

  // Validate np (radial mesh points)
  if (params.np < 2 || params.np > 99) {
    validationErrors.push({ level: 'error', message: 'np (radial mesh points) must be 2-99' });
  }

  // Validate mesh intervals sum = np - 1
  const totalIntervals = params.meshIntervals.reduce((sum, m) => sum + m.intervals, 0);
  if (totalIntervals !== params.np - 1) {
    validationErrors.push({
      level: 'error',
      message: `Total mesh intervals (${totalIntervals}) must equal np-1 (${params.np - 1})`
    });
  }

  // Validate material compositions
  if (params.materialCompositions.length === 0) {
    validationErrors.push({ level: 'error', message: 'At least one material composition is required' });
  } else {
    const maxInterval = Math.max(...params.materialCompositions.map(m => m.interval));
    if (maxInterval > params.np - 1) {
      validationErrors.push({
        level: 'error',
        message: `Material interval (${maxInterval}) exceeds np-1 (${params.np - 1})`
      });
    }
  }

  // Validate initial temperatures
  if (params.initialTemperatures.length === 0) {
    validationErrors.push({ level: 'error', message: 'At least one initial temperature is required' });
  } else {
    const maxMeshPoint = Math.max(...params.initialTemperatures.map(t => t.meshPoint));
    if (maxMeshPoint > params.np) {
      validationErrors.push({
        level: 'error',
        message: `Temperature mesh point (${maxMeshPoint}) exceeds np (${params.np})`
      });
    }
  }

  // Validate left boundary conditions cover nh (sequential expansion: last hsNumber >= nh)
  if (params.leftBoundaryConditions.length > 0) {
    const lastLeftHs = params.leftBoundaryConditions[params.leftBoundaryConditions.length - 1].hsNumber;
    if (lastLeftHs < params.nh) {
      validationWarnings.push({
        level: 'warning',
        message: `Left BC last hsNumber (${lastLeftHs}) should be >= nh (${params.nh}) for sequential expansion`
      });
    }
  }

  // Validate right boundary conditions cover nh (sequential expansion: last hsNumber >= nh)
  if (params.rightBoundaryConditions.length > 0) {
    const lastRightHs = params.rightBoundaryConditions[params.rightBoundaryConditions.length - 1].hsNumber;
    if (lastRightHs < params.nh) {
      validationWarnings.push({
        level: 'warning',
        message: `Right BC last hsNumber (${lastRightHs}) should be >= nh (${params.nh}) for sequential expansion`
      });
    }
  }

  // Validate source data covers nh (sequential expansion: last hsNumber >= nh)
  if (params.sourceData.length > 0) {
    const lastSrcHs = params.sourceData[params.sourceData.length - 1].hsNumber;
    if (lastSrcHs < params.nh) {
      validationWarnings.push({
        level: 'warning',
        message: `Source data last hsNumber (${lastSrcHs}) should be >= nh (${params.nh}) for sequential expansion`
      });
    }
  }

  // Validate convective BC has boundary volume (any non-zero bcType needs a volume)
  params.leftBoundaryConditions.forEach((bc, idx) => {
    if (bc.bcType !== 0 && !bc.boundaryVolume) {
      validationWarnings.push({
        level: 'warning',
        message: `Left BC #${idx + 1}: BC type ${bc.bcType} should have a boundary volume`
      });
    }
  });

  params.rightBoundaryConditions.forEach((bc, idx) => {
    if (bc.bcType !== 0 && !bc.boundaryVolume) {
      validationWarnings.push({
        level: 'warning',
        message: `Right BC #${idx + 1}: BC type ${bc.bcType} should have a boundary volume`
      });
    }
  });

  // ============ Phase 2: Fuel Rod Validation ============
  if (params.isFuelRod) {
    // Validate Reflood options when fuel rod mode is enabled
    if (params.refloodFlag !== undefined && params.refloodFlag !== 0) {
      // When reflood is enabled, maxAxialIntervals should be valid (2,4,8,16,32,64,128)
      const validMAI = [2, 4, 8, 16, 32, 64, 128];
      if (params.maxAxialIntervals !== undefined && !validMAI.includes(params.maxAxialIntervals)) {
        validationErrors.push({
          level: 'error',
          message: `Max Axial Intervals must be one of: ${validMAI.join(', ')}`
        });
      }
    }

    // Gap Conductance validation
    if (params.gapConductance) {
      // Gap Conductance requires Gap Deformation data
      if (!params.gapDeformationData || params.gapDeformationData.length === 0) {
        validationErrors.push({
          level: 'error',
          message: 'Gap Deformation data required when Gap Conductance is set'
        });
      }

      // Initial gap pressure should be positive
      if (params.gapConductance.initialGapPressure <= 0) {
        validationWarnings.push({
          level: 'warning',
          message: 'Initial Gap Pressure should be positive'
        });
      }

      // Reference volume should be set
      if (!params.gapConductance.referenceVolume) {
        validationWarnings.push({
          level: 'warning',
          message: 'Gap Conductance: Reference Volume should be set'
        });
      }
    }

    // Metal-Water Reaction validation
    if (params.metalWaterReaction) {
      // Initial oxide thickness should be non-negative
      if (params.metalWaterReaction.initialOxideThickness < 0) {
        validationErrors.push({
          level: 'error',
          message: 'Initial Oxide Thickness cannot be negative'
        });
      }
    }

    // Cladding Deformation validation
    if (params.claddingDeformation) {
      // Cladding Deformation requires Gap Conductance
      if (!params.gapConductance) {
        validationErrors.push({
          level: 'error',
          message: 'Gap Conductance required when Cladding Deformation is set'
        });
      }
    }

    // Gap Deformation data validation
    if (params.gapDeformationData && params.gapDeformationData.length > 0) {
      // Gap Deformation count should equal nh
      if (params.gapDeformationData.length !== params.nh) {
        validationWarnings.push({
          level: 'warning',
          message: `Gap Deformation count (${params.gapDeformationData.length}) should equal nh (${params.nh})`
        });
      }

      // Validate each Gap Deformation entry
      params.gapDeformationData.forEach((gap, idx) => {
        // Surface roughness should be positive
        if (gap.fuelSurfaceRoughness <= 0) {
          validationWarnings.push({
            level: 'warning',
            message: `Gap Deformation #${idx + 1}: Fuel Surface Roughness should be positive`
          });
        }
        if (gap.cladSurfaceRoughness <= 0) {
          validationWarnings.push({
            level: 'warning',
            message: `Gap Deformation #${idx + 1}: Clad Surface Roughness should be positive`
          });
        }

        // HS Number should match index + 1
        if (gap.hsNumber !== idx + 1) {
          validationWarnings.push({
            level: 'warning',
            message: `Gap Deformation #${idx + 1}: HS Number (${gap.hsNumber}) should be ${idx + 1}`
          });
        }
      });
    }
  }

  // Calculate status
  const status = validationErrors.length === 0
    ? (validationWarnings.length > 0 ? 'incomplete' : 'valid')
    : 'error';

  console.log('[validateHeatStructure] Validation complete:');
  console.log('[validateHeatStructure]   - errors:', validationErrors.length);
  console.log('[validateHeatStructure]   - warnings:', validationWarnings.length);
  console.log('[validateHeatStructure]   - status:', status);

  return {
    status,
    errors: validationErrors,
    warnings: validationWarnings,
  };
}

/**
 * Validation result for Thermal Properties
 */
export interface ThermalPropertyValidationResult {
  valid: boolean;
  errors: Array<{ materialNumber: number; message: string }>;
  warnings: Array<{ materialNumber: number; message: string }>;
}

/**
 * Validate Thermal Properties (201MMMNN Cards)
 */
export function validateThermalProperties(
  properties: ThermalProperty[]
): ThermalPropertyValidationResult {
  const errors: Array<{ materialNumber: number; message: string }> = [];
  const warnings: Array<{ materialNumber: number; message: string }> = [];

  // Check for duplicate material numbers
  const materialNumbers = new Set<number>();
  for (const prop of properties) {
    if (materialNumbers.has(prop.materialNumber)) {
      errors.push({
        materialNumber: prop.materialNumber,
        message: `Duplicate material number: ${prop.materialNumber}`
      });
    }
    materialNumbers.add(prop.materialNumber);
  }

  // Validate each property
  for (const prop of properties) {
    const mmm = prop.materialNumber;

    // Material number range (1-999)
    if (mmm < 1 || mmm > 999) {
      errors.push({
        materialNumber: mmm,
        message: 'Material number must be between 1 and 999'
      });
    }

    // Skip further validation for built-in materials
    if (prop.materialType !== 'TBL/FCTN') {
      continue;
    }

    const w2 = prop.conductivityFormat ?? 1;

    // Validate conductivity table (W2=1)
    if (w2 === 1 && !prop.isConstantConductivity) {
      const table = prop.conductivityTable || [];

      // Check table size
      if (table.length === 0) {
        errors.push({
          materialNumber: mmm,
          message: 'Conductivity table is empty'
        });
      } else if (table.length > 100) {
        errors.push({
          materialNumber: mmm,
          message: 'Conductivity table exceeds maximum of 100 entries'
        });
      }

      // Check temperature order (must be increasing)
      for (let i = 1; i < table.length; i++) {
        if (table[i].temperature <= table[i - 1].temperature) {
          errors.push({
            materialNumber: mmm,
            message: `Conductivity table: temperatures must be in increasing order (entry ${i + 1})`
          });
          break;
        }
      }
    }

    // Validate capacity table/values (W2=1, W3=-1 or 1)
    if (w2 === 1 && !prop.isConstantCapacity) {
      const capacityFormat = prop.capacityFormat ?? 1;

      if (capacityFormat === -1) {
        // W3=-1: Values only, count must match conductivity table
        const values = prop.capacityValues || [];
        const condTable = prop.conductivityTable || [];

        if (values.length !== condTable.length) {
          errors.push({
            materialNumber: mmm,
            message: `Capacity values count (${values.length}) must match conductivity table (${condTable.length})`
          });
        }
      } else if (capacityFormat === 1) {
        // W3=1: Separate table
        const table = prop.capacityTable || [];

        if (table.length === 0) {
          errors.push({
            materialNumber: mmm,
            message: 'Capacity table is empty'
          });
        } else if (table.length > 100) {
          errors.push({
            materialNumber: mmm,
            message: 'Capacity table exceeds maximum of 100 entries'
          });
        }

        // Check temperature order
        for (let i = 1; i < table.length; i++) {
          if (table[i].temperature <= table[i - 1].temperature) {
            errors.push({
              materialNumber: mmm,
              message: `Capacity table: temperatures must be in increasing order (entry ${i + 1})`
            });
            break;
          }
        }
      }
    }

    // Validate gap gas composition (W2=3)
    if (w2 === 3) {
      const gases = prop.gapGasComposition || [];

      if (gases.length === 0) {
        errors.push({
          materialNumber: mmm,
          message: 'Gap gas composition is empty'
        });
      } else {
        // Check mole fraction sum
        const total = gases.reduce((sum, g) => sum + g.moleFraction, 0);
        if (Math.abs(total - 1.0) > 0.001) {
          warnings.push({
            materialNumber: mmm,
            message: `Gas mole fraction sum is ${total.toFixed(4)} (should be 1.0)`
          });
        }

        // Check for zero mole fractions
        gases.forEach((gas) => {
          if (gas.moleFraction === 0) {
            warnings.push({
              materialNumber: mmm,
              message: `Gas ${gas.gasName} has zero mole fraction (consider removing)`
            });
          }
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate Heat Structure material references
 * Checks if all referenced materials exist in thermalProperties
 */
export function validateHeatStructureMaterialReferences(
  nodes: Node<MARSNodeData>[],
  thermalProperties: ThermalProperty[]
): Array<{ nodeId: string; componentName: string; materialNumber: number; message: string }> {
  const warnings: Array<{ nodeId: string; componentName: string; materialNumber: number; message: string }> = [];

  const definedMaterials = new Set(thermalProperties.map(p => p.materialNumber));

  for (const node of nodes) {
    if (node.data.componentType !== 'htstr') continue;
    if (!isHeatStructureParameters(node.data.parameters)) continue;

    const params = node.data.parameters as HeatStructureParameters;
    const compositions = params.materialCompositions || [];

    for (const comp of compositions) {
      // Skip negative material numbers (special models like -5, -6)
      if (comp.materialNumber < 0) continue;

      if (!definedMaterials.has(comp.materialNumber)) {
        warnings.push({
          nodeId: node.id,
          componentName: node.data.componentName,
          materialNumber: comp.materialNumber,
          message: `Material ${comp.materialNumber} is not defined in Thermal Properties`
        });
      }
    }
  }

  return warnings;
}

/**
 * Auto-validate and update node status
 * Call this after updating node parameters
 */
export function autoValidateNode(
  nodeId: string,
  nodes: Node<MARSNodeData>[]
): Partial<MARSNodeData> | null {
  console.log('[autoValidateNode] Called for nodeId:', nodeId);
  console.log('[autoValidateNode] Total nodes:', nodes.length);

  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    console.warn('[autoValidateNode] Node not found:', nodeId);
    return null;
  }

  console.log('[autoValidateNode] Node found, componentType:', node.data.componentType);
  console.log('[autoValidateNode] Node parameters:', node.data.parameters);

  const { componentType } = node.data;

  // Validate based on component type
  let validationResult: ValidationResult | null = null;

  switch (componentType) {
    case 'sngljun':
      console.log('[autoValidateNode] Calling validateSngljun...');
      validationResult = validateSngljun(node.data, nodes);
      console.log('[autoValidateNode] validateSngljun result:', validationResult);
      break;
    case 'tmdpjun':
      // TODO: Add TMDPJUN validation
      break;
    case 'mtpljun':
      // TODO: Add MTPLJUN validation
      break;
    case 'htstr':
      console.log('[autoValidateNode] Calling validateHeatStructure...');
      validationResult = validateHeatStructure(node.data, nodes);
      console.log('[autoValidateNode] validateHeatStructure result:', validationResult);
      break;
    case 'valve':
      console.log('[autoValidateNode] Calling validateValve...');
      validationResult = validateValve(node.data, nodes);
      console.log('[autoValidateNode] validateValve result:', validationResult);
      break;
    case 'tank':
      validationResult = validateTank(node.data, nodes);
      break;
    case 'separatr':
      validationResult = validateSeparator(node.data, nodes);
      break;
    default:
      // No auto-validation for this component type
      return null;
  }

  if (!validationResult) {
    return null;
  }

  console.log('[autoValidateNode] Auto-validation result for', nodeId, ':', validationResult.status);

  return {
    status: validationResult.status,
    errors: validationResult.errors,
    warnings: validationResult.warnings,
  };
}

/**
 * Validate SEPARATR component
 * Specialized branch with exactly 3 fixed junctions
 */
export function validateSeparator(
  data: MARSNodeData,
  _nodes: Node<MARSNodeData>[]
): ValidationResult {
  const validationErrors: Array<{ level: 'error'; message: string }> = [];
  const validationWarnings: Array<{ level: 'warning'; message: string }> = [];

  if (!isSeparatorParameters(data.parameters)) {
    validationErrors.push({ level: 'error', message: 'Invalid Separator parameters' });
    return { status: 'error', errors: validationErrors, warnings: validationWarnings };
  }

  const params = data.parameters as SeparatorParameters;

  // Name
  if (!data.componentName) {
    validationErrors.push({ level: 'error', message: 'Name is required' });
  }

  // Geometry: at least 2 of {area, length, volume} must be non-zero
  const area = params.area ?? 0;
  const length = params.length ?? 0;
  const volume = params.volume ?? 0;
  const nonZeroCount = [area, length, volume].filter(v => v > 0).length;
  if (nonZeroCount < 2) {
    validationErrors.push({ level: 'error', message: 'At least 2 of area/length/volume must be non-zero' });
  }

  // Hydraulic diameter
  if (!params.hydraulicDiameter || params.hydraulicDiameter <= 0) {
    validationErrors.push({ level: 'error', message: 'Hydraulic diameter must be positive' });
  }

  // Pressure
  if (!params.pressure || params.pressure <= 0) {
    validationErrors.push({ level: 'error', message: 'Pressure must be positive' });
  }

  // ISEPST range
  if (params.separatorOption < 0 || params.separatorOption > 3) {
    validationErrors.push({ level: 'error', message: 'Separator option (ISEPST) must be 0-3' });
  }

  // Junction count must be exactly 3
  if (!params.junctions || params.junctions.length !== 3) {
    validationErrors.push({ level: 'error', message: 'Separator must have exactly 3 junctions' });
  } else {
    // Junction connection warnings
    params.junctions.forEach((j, idx) => {
      const jNum = idx + 1;
      if (!j.from?.nodeId && !j.to?.nodeId) {
        const labels = ['Vapor Outlet', 'Liquid Fall Back', 'Inlet'];
        validationWarnings.push({ level: 'warning', message: `Junction ${jNum} (${labels[idx]}): no connections` });
      }

      // VOVER (N=1) range check
      if (jNum === 1 && j.voidFractionLimit !== undefined) {
        if (j.voidFractionLimit < 0 || j.voidFractionLimit > 1) {
          validationErrors.push({ level: 'error', message: 'VOVER (J1 void fraction limit) must be 0-1' });
        }
      }

      // VUNDER (N=2) range check
      if (jNum === 2 && j.voidFractionLimit !== undefined) {
        if (j.voidFractionLimit < 0 || j.voidFractionLimit > 1) {
          validationErrors.push({ level: 'error', message: 'VUNDER (J2 void fraction limit) must be 0-1' });
        }
      }
    });
  }

  const status = validationErrors.length > 0 ? 'error' : validationWarnings.length > 0 ? 'incomplete' : 'valid';
  return { status, errors: validationErrors, warnings: validationWarnings };
}

/**
 * Validate TANK component
 * Branch + Tank-specific fields (initialLiquidLevel, volumeLevelCurve)
 */
export function validateTank(
  data: MARSNodeData,
  _nodes: Node<MARSNodeData>[]
): ValidationResult {
  const params = data.parameters as Partial<TankParameters>;
  const errors: Array<{ level: 'error'; message: string }> = [];
  const warnings: Array<{ level: 'warning'; message: string }> = [];

  // Name
  if (!data.componentName) {
    errors.push({ level: 'error', message: 'Name is required' });
  }

  // Geometry: at least 2 of {area, length, volume} must be non-zero
  const area = params.area ?? 0;
  const length = params.length ?? 0;
  const volume = params.volume ?? 0;
  const nonZeroCount = [area, length, volume].filter(v => v > 0).length;
  if (nonZeroCount < 2) {
    errors.push({ level: 'error', message: 'At least 2 of area/length/volume must be non-zero' });
  }

  // Hydraulic diameter
  if (!params.hydraulicDiameter || params.hydraulicDiameter <= 0) {
    errors.push({ level: 'error', message: 'Hydraulic diameter must be positive' });
  }

  // Pressure
  if (!params.pressure || params.pressure <= 0) {
    errors.push({ level: 'error', message: 'Pressure must be positive' });
  }

  // njuns
  if (params.njuns === undefined || params.njuns < 0 || params.njuns > 9) {
    errors.push({ level: 'error', message: 'Number of junctions must be 0-9' });
  }

  // Tank-specific: Initial Liquid Level
  if (params.initialLiquidLevel === undefined || params.initialLiquidLevel === null) {
    errors.push({ level: 'error', message: 'Tank requires initial liquid level' });
  } else if (params.initialLiquidLevel < 0) {
    errors.push({ level: 'error', message: 'Initial liquid level must be >= 0' });
  }

  // Tank-specific: Volume-Level Curve
  if (!params.volumeLevelCurve || params.volumeLevelCurve.length < 2) {
    errors.push({ level: 'error', message: 'Tank requires at least 2 volume-level pairs' });
  } else {
    // Check ascending level order
    for (let i = 1; i < params.volumeLevelCurve.length; i++) {
      if (params.volumeLevelCurve[i].level <= params.volumeLevelCurve[i - 1].level) {
        warnings.push({ level: 'warning', message: 'Volume-level curve should be in ascending level order' });
        break;
      }
    }

    // Check initial level vs curve bounds
    if (params.initialLiquidLevel !== undefined) {
      const levels = params.volumeLevelCurve.map(p => p.level);
      const minLevel = Math.min(...levels);
      const maxLevel = Math.max(...levels);
      if (params.initialLiquidLevel > maxLevel) {
        warnings.push({ level: 'warning', message: 'Initial level exceeds maximum level in curve' });
      }
      if (params.initialLiquidLevel < minLevel) {
        warnings.push({ level: 'warning', message: 'Initial level below minimum level in curve' });
      }
    }
  }

  // Junction warnings
  if (params.junctions && params.junctions.length > 0) {
    params.junctions.forEach((j, idx) => {
      if (!j.from?.nodeId && !j.to?.nodeId) {
        warnings.push({ level: 'warning', message: `Junction ${j.junctionNumber || idx + 1}: no connections` });
      }
    });
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'incomplete' : 'valid';
  return { status, errors, warnings };
}
