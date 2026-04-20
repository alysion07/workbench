/**
 * PIPE Spread Format Utilities
 * Handles MARS "Sequential Expansion Format" for PIPE cells
 * 
 * Format: Each row specifies "value applies up to this cell number"
 */

// ============================================================================
// Tab 1: Geometry (MARS Rules: exactly one of A, L, V can be 0 for auto-calc)
// ============================================================================
export interface GeometrySpreadRow {
  id: string;
  endCell: number;
  xArea: number;      // 0 means auto-calculate from V/L
  xLength: number;    // 0 means auto-calculate from V/A
  volume: number;     // 0 means auto-calculate from A×L
}

/**
 * Validate geometry according to MARS rules:
 * - Exactly one of A, L, V can be 0 (for auto-calculation)
 * - If all three are non-zero, check consistency: V ≈ A×L (relative error ≤ 1e-6)
 */
/**
 * Compress arrays into spread rows by grouping identical consecutive values
 * Used for loading saved parameters back into spread format
 */
export function compressArraysToGeometryRows(
  xAreaArray: number[],
  xLengthArray: number[],
  volumeArray: number[]
): GeometrySpreadRow[] {
  if (xAreaArray.length === 0) return [];

  const rows: GeometrySpreadRow[] = [];
  let currentRow: GeometrySpreadRow | null = null;

  for (let i = 0; i < xAreaArray.length; i++) {
    const cellNum = i + 1;

    if (!currentRow) {
      // First cell
      currentRow = {
        id: `geo-${cellNum}`,
        endCell: cellNum,
        xArea: xAreaArray[i],
        xLength: xLengthArray[i],
        volume: volumeArray[i],
      };
    } else {
      // Check if current cell matches previous row
      const matches =
        currentRow.xArea === xAreaArray[i] &&
        currentRow.xLength === xLengthArray[i] &&
        currentRow.volume === volumeArray[i];

      if (matches) {
        // Extend the range
        currentRow.endCell = cellNum;
      } else {
        // Save current row and start new one
        rows.push(currentRow);
        currentRow = {
          id: `geo-${cellNum}`,
          endCell: cellNum,
          xArea: xAreaArray[i],
          xLength: xLengthArray[i],
          volume: volumeArray[i],
        };
      }
    }
  }

  // Push last row
  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Compress junction data arrays into spread rows
 */
export function compressArraysToJunctionRows(
  junctionAreaData: number | number[] | undefined,
  fwdLossData: number | number[],
  revLossData: number | number[],
  junctionFlagsData: string | string[],
  numJunctions: number
): JunctionSpreadRow[] {
  if (numJunctions < 1) return [];

  // Convert to arrays
  const junctionAreaArray = junctionAreaData !== undefined
    ? (Array.isArray(junctionAreaData) ? junctionAreaData : Array(numJunctions).fill(junctionAreaData))
    : Array(numJunctions).fill('auto' as const);
  const fwdLossArray = Array.isArray(fwdLossData) ? fwdLossData : Array(numJunctions).fill(fwdLossData);
  const revLossArray = Array.isArray(revLossData) ? revLossData : Array(numJunctions).fill(revLossData);
  const junctionFlagsArray = Array.isArray(junctionFlagsData) ? junctionFlagsData : Array(numJunctions).fill(junctionFlagsData);

  const rows: JunctionSpreadRow[] = [];
  let currentRow: JunctionSpreadRow | null = null;

  for (let i = 0; i < numJunctions; i++) {
    const junctionNum = i + 1;

    if (!currentRow) {
      // First junction
      currentRow = {
        id: `jun-${junctionNum}`,
        endJunction: junctionNum,
        junctionArea: junctionAreaArray[i],
        fwdLoss: fwdLossArray[i],
        revLoss: revLossArray[i],
        junctionFlags: junctionFlagsArray[i],
      };
    } else {
      // Check if current junction matches previous row
      const matches =
        currentRow.junctionArea === junctionAreaArray[i] &&
        currentRow.fwdLoss === fwdLossArray[i] &&
        currentRow.revLoss === revLossArray[i] &&
        currentRow.junctionFlags === junctionFlagsArray[i];

      if (matches) {
        // Extend the range
        currentRow.endJunction = junctionNum;
      } else {
        // Save current row and start new one
        rows.push(currentRow);
        currentRow = {
          id: `jun-${junctionNum}`,
          endJunction: junctionNum,
          junctionArea: junctionAreaArray[i],
          fwdLoss: fwdLossArray[i],
          revLoss: revLossArray[i],
          junctionFlags: junctionFlagsArray[i],
        };
      }
    }
  }

  // Push last row
  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Compress angle arrays into spread rows
 */
export function compressArraysToAngleRows(
  azAngleData: number | number[],
  vertAngleData: number | number[],
  xElevArray: number[] | undefined,
  ncells: number
): AngleSpreadRow[] {
  const azAngleArray = Array.isArray(azAngleData) ? azAngleData : Array(ncells).fill(azAngleData);
  const vertAngleArray = Array.isArray(vertAngleData) ? vertAngleData : Array(ncells).fill(vertAngleData);

  const rows: AngleSpreadRow[] = [];
  let currentRow: AngleSpreadRow | null = null;

  for (let i = 0; i < ncells; i++) {
    const cellNum = i + 1;
    const xElev = xElevArray ? xElevArray[i] : undefined;

    if (!currentRow) {
      currentRow = {
        id: `ang-${cellNum}`,
        endCell: cellNum,
        azAngle: azAngleArray[i],
        vertAngle: vertAngleArray[i],
        xElev,
      };
    } else {
      const matches =
        currentRow.azAngle === azAngleArray[i] &&
        currentRow.vertAngle === vertAngleArray[i] &&
        currentRow.xElev === xElev;

      if (matches) {
        currentRow.endCell = cellNum;
      } else {
        rows.push(currentRow);
        currentRow = {
          id: `ang-${cellNum}`,
          endCell: cellNum,
          azAngle: azAngleArray[i],
          vertAngle: vertAngleArray[i],
          xElev,
        };
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Compress wall arrays into spread rows
 */
export function compressArraysToWallRows(
  wallRoughnessData: number | number[],
  hydraulicDiameterData: number | number[],
  volumeFlagsData: string | string[],
  ncells: number
): WallSpreadRow[] {
  // Convert to arrays
  const wallRoughnessArray = Array.isArray(wallRoughnessData)
    ? wallRoughnessData
    : Array(ncells).fill(wallRoughnessData);
  const hydraulicDiameterArray = Array.isArray(hydraulicDiameterData)
    ? hydraulicDiameterData
    : Array(ncells).fill(hydraulicDiameterData);
  const volumeFlagsArray = Array.isArray(volumeFlagsData)
    ? volumeFlagsData
    : Array(ncells).fill(volumeFlagsData);

  const rows: WallSpreadRow[] = [];
  let currentRow: WallSpreadRow | null = null;

  for (let i = 0; i < ncells; i++) {
    const cellNum = i + 1;

    if (!currentRow) {
      currentRow = {
        id: `wall-${cellNum}`,
        endCell: cellNum,
        wallRoughness: wallRoughnessArray[i],
        hydraulicDiameter: hydraulicDiameterArray[i],
        volumeFlags: volumeFlagsArray[i],
      };
    } else {
      const matches =
        currentRow.wallRoughness === wallRoughnessArray[i] &&
        currentRow.hydraulicDiameter === hydraulicDiameterArray[i] &&
        currentRow.volumeFlags === volumeFlagsArray[i];

      if (matches) {
        currentRow.endCell = cellNum;
      } else {
        rows.push(currentRow);
        currentRow = {
          id: `wall-${cellNum}`,
          endCell: cellNum,
          wallRoughness: wallRoughnessArray[i],
          hydraulicDiameter: hydraulicDiameterArray[i],
          volumeFlags: volumeFlagsArray[i],
        };
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Compress initial condition arrays into spread rows
 */
export function compressArraysToInitialRows(
  initialConditions: Array<{
    ebt: '001' | '002' | '003' | '004' | '005';
    pressure: number;
    temperature?: number;
    quality?: number;
  }>
): InitialConditionSpreadRow[] {
  if (initialConditions.length === 0) return [];

  const rows: InitialConditionSpreadRow[] = [];
  let currentRow: InitialConditionSpreadRow | null = null;

  for (let i = 0; i < initialConditions.length; i++) {
    const cellNum = i + 1;
    const ic = initialConditions[i];

    if (!currentRow) {
      currentRow = {
        id: `init-${cellNum}`,
        endCell: cellNum,
        ebt: ic.ebt,
        pressure: ic.pressure,
        temperature: ic.ebt === '002' ? undefined : (ic.temperature ?? 560.0),
        quality: ic.ebt === '002' ? (ic.quality ?? 0.0) : undefined,
      };
    } else {
      const matches =
        currentRow.ebt === ic.ebt &&
        currentRow.pressure === ic.pressure &&
        (ic.ebt === '002'
          ? currentRow.quality === (ic.quality ?? 0.0)
          : currentRow.temperature === (ic.temperature ?? 560.0));

      if (matches) {
        currentRow.endCell = cellNum;
      } else {
        rows.push(currentRow);
        currentRow = {
          id: `init-${cellNum}`,
          endCell: cellNum,
          ebt: ic.ebt,
          pressure: ic.pressure,
          temperature: ic.ebt === '002' ? undefined : (ic.temperature ?? 560.0),
          quality: ic.ebt === '002' ? (ic.quality ?? 0.0) : undefined,
        };
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}

export function validateGeometryRow(
  xArea: number,
  xLength: number,
  volume: number
): { valid: boolean; error?: string; calculated?: { field: 'xArea' | 'xLength' | 'volume'; value: number } } {
  const zeroCount = [xArea, xLength, volume].filter(v => v === 0).length;

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
    if (xArea === 0) {
      if (xLength === 0 || volume === 0) {
        return { valid: false, error: 'Cannot calculate Area: Length or Volume is zero' };
      }
      const calculatedArea = volume / xLength;
      return { valid: true, calculated: { field: 'xArea', value: calculatedArea } };
    }

    if (xLength === 0) {
      if (xArea === 0 || volume === 0) {
        return { valid: false, error: 'Cannot calculate Length: Area or Volume is zero' };
      }
      const calculatedLength = volume / xArea;
      return { valid: true, calculated: { field: 'xLength', value: calculatedLength } };
    }

    if (volume === 0) {
      if (xArea === 0 || xLength === 0) {
        return { valid: false, error: 'Cannot calculate Volume: Area or Length is zero' };
      }
      const calculatedVolume = xArea * xLength;
      return { valid: true, calculated: { field: 'volume', value: calculatedVolume } };
    }
  }

  // All non-zero - check consistency: V ≈ A×L
  if (zeroCount === 0) {
    const calculated = xArea * xLength;
    const maxVal = Math.max(Math.abs(volume), Math.abs(calculated));
    const relativeError = Math.abs(volume - calculated) / maxVal;

    if (relativeError > 1e-6) {
      return {
        valid: false,
        error: `Inconsistent values: V (${volume.toExponential(6)}) ≠ A×L (${calculated.toExponential(6)}), relative error: ${relativeError.toExponential(2)}`
      };
    }

    return { valid: true };
  }

  return { valid: true };
}

// ============================================================================
// Tab 2: Angles
// ============================================================================
export interface AngleSpreadRow {
  id: string;
  endCell: number;
  azAngle: number;
  vertAngle: number;
  xElev?: number;
}

// ============================================================================
// Tab 3: Walls
// ============================================================================
export interface WallSpreadRow {
  id: string;
  endCell: number;
  wallRoughness: number;
  hydraulicDiameter: number;
  volumeFlags: string;  // 7-digit
}

// ============================================================================
// Tab 4: Initial Conditions
// ============================================================================
export interface InitialConditionSpreadRow {
  id: string;
  endCell: number;
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;
  temperature?: number;  // Required for EBT 001, 003, 004, 005
  quality?: number;      // Required for EBT 002
}

// ============================================================================
// Tab 5: Advanced (Junctions)
// ============================================================================
export interface JunctionSpreadRow {
  id: string;
  endJunction: number;  // Junction number (1 to ncells-1)
  junctionArea: number | 'auto';
  fwdLoss: number;
  revLoss: number;
  junctionFlags: string;  // 8-digit
}

// ============================================================================
// Legacy interface (for backward compatibility)
// ============================================================================
export interface SpreadRow {
  id: string;
  endCell: number;
  xArea: number | 'auto';
  xLength: number;
  volume: number | 'auto';
  pressure: number;
  temperature: number;
  ebt: '001' | '002' | '003' | '004' | '005';
  quality?: number;
}

export interface CellData {
  xArea: number;
  xLength: number;
  volume: number;
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;
  temperature?: number;
  quality?: number;
}

/**
 * Calculate volume from area and length
 */
export function calculateVolume(area: number, length: number): number {
  return area * length;
}

/**
 * Calculate area from volume and length
 */
export function calculateArea(volume: number, length: number): number {
  if (length === 0) return 0;
  return volume / length;
}

/**
 * Expand spread rows into individual cells
 * Uses MARS "Sequential Expansion Format"
 */
export function expandSpreadRows(spreadRows: SpreadRow[]): CellData[] {
  const cells: CellData[] = [];

  let startCell = 1;

  for (const row of spreadRows) {
    const endCell = row.endCell;

    // Calculate actual values based on mode
    let actualArea: number;
    let actualVolume: number;

    // Mode 1: Volume-based (xArea = 0)
    if (row.xArea === 0 || (row.xArea === 'auto' && row.volume !== 'auto')) {
      actualArea = row.xArea === 'auto' ? calculateArea(row.volume as number, row.xLength) : 0;

      if (row.volume === 'auto') {
        console.warn(`End cell ${endCell}: Volume is required when xArea = 0 (volume-based mode)`);
        actualVolume = 0;
      } else {
        actualVolume = row.volume as number;
      }
    }
    // Mode 2: Area-based (xArea > 0)
    else if (row.xArea !== 'auto') {
      actualArea = row.xArea as number;

      if (row.volume === 'auto') {
        // Auto-calculate: V = A × L
        actualVolume = calculateVolume(actualArea, row.xLength);
      } else {
        actualVolume = row.volume as number;
      }
    }
    // Invalid: both auto
    else {
      console.warn(`End cell ${endCell}: Both area and volume cannot be auto`);
      actualArea = 0;
      actualVolume = 0;
    }

    // Create cells for the range [startCell, endCell]
    for (let i = startCell; i <= endCell; i++) {
      cells.push({
        xArea: actualArea,
        xLength: row.xLength,
        volume: actualVolume,
        ebt: row.ebt,
        pressure: row.pressure,
        temperature: row.temperature,
        quality: row.quality,
      });
    }

    // Next row starts after this one
    startCell = endCell + 1;
  }

  return cells;
}

/**
 * Compress cells into spread rows by grouping identical consecutive cells
 * Produces MARS "Sequential Expansion Format"
 */
export function compressToSpreadRows(cells: CellData[]): SpreadRow[] {
  if (cells.length === 0) return [];

  const spreadRows: SpreadRow[] = [];
  let currentRow: SpreadRow | null = null;

  cells.forEach((cell, index) => {
    const cellNum = index + 1;

    if (!currentRow) {
      // First cell
      currentRow = {
        id: `row-${cellNum}`,
        endCell: cellNum,
        xArea: cell.xArea,
        xLength: cell.xLength,
        volume: cell.volume,
        pressure: cell.pressure,
        temperature: cell.temperature || 560.0,
        ebt: cell.ebt,
        quality: cell.quality,
      };
    } else {
      // Check if current cell matches the previous row
      const matches =
        currentRow.xArea === cell.xArea &&
        currentRow.xLength === cell.xLength &&
        currentRow.volume === cell.volume &&
        currentRow.pressure === cell.pressure &&
        currentRow.temperature === (cell.temperature || 560.0) &&
        currentRow.ebt === cell.ebt;

      if (matches) {
        // Extend the range
        currentRow.endCell = cellNum;
      } else {
        // Save the current row and start a new one
        spreadRows.push(currentRow);
        currentRow = {
          id: `row-${cellNum}`,
          endCell: cellNum,
          xArea: cell.xArea,
          xLength: cell.xLength,
          volume: cell.volume,
          pressure: cell.pressure,
          temperature: cell.temperature || 560.0,
          ebt: cell.ebt,
          quality: cell.quality,
        };
      }
    }
  });

  // Push the last row
  if (currentRow) {
    spreadRows.push(currentRow);
  }

  return spreadRows;
}

/**
 * Validate spread rows using MARS Sequential Expansion Format rules
 * Returns error messages if any
 */
export function validateSpreadRows(spreadRows: SpreadRow[], expectedTotal: number): string[] {
  const errors: string[] = [];

  if (spreadRows.length === 0) {
    errors.push('At least one row is required');
    return errors;
  }

  let expectedStart = 1;
  let lastEndCell = 0;

  for (let i = 0; i < spreadRows.length; i++) {
    const row = spreadRows[i];
    const endCell = row.endCell;

    // Check if endCell is valid number
    if (!Number.isInteger(endCell) || endCell < 1) {
      errors.push(`Row ${i + 1}: End cell must be a positive integer`);
      continue;
    }

    // Check sequential order
    if (endCell <= lastEndCell) {
      errors.push(`Row ${i + 1}: End cell ${endCell} must be greater than previous end cell ${lastEndCell}`);
    }

    // Check if endCell exceeds total
    if (endCell > expectedTotal) {
      errors.push(`Row ${i + 1}: End cell ${endCell} exceeds total cells ${expectedTotal}`);
    }

    // Check auto fields
    if (row.xArea === 'auto' && row.volume === 'auto') {
      errors.push(`Row ${i + 1} (cells ${expectedStart}-${endCell}): Both Area and Volume cannot be auto`);
    }

    // Check volume-based mode (xArea = 0)
    if (row.xArea === 0 && row.volume === 'auto') {
      errors.push(`Row ${i + 1} (cells ${expectedStart}-${endCell}): Volume is required when xArea = 0`);
    }

    // Check values
    if (row.xArea !== 'auto' && row.xArea < 0) {
      errors.push(`Row ${i + 1}: Area must be non-negative`);
    }
    if (row.volume !== 'auto' && row.volume < 0) {
      errors.push(`Row ${i + 1}: Volume must be non-negative`);
    }
    if (row.xLength <= 0) {
      errors.push(`Row ${i + 1}: Length must be positive`);
    }
    if (row.pressure <= 0) {
      errors.push(`Row ${i + 1}: Pressure must be positive`);
    }
    if (row.temperature <= 0) {
      errors.push(`Row ${i + 1}: Temperature must be positive`);
    }

    expectedStart = endCell + 1;
    lastEndCell = endCell;
  }

  // Check if all cells are covered
  if (lastEndCell !== expectedTotal) {
    if (lastEndCell < expectedTotal) {
      errors.push(`Missing cells: ${lastEndCell + 1} to ${expectedTotal} are not defined`);
    }
  }

  return errors;
}

// ============================================================================
// Generic validation for any spread row type
// ============================================================================
export function validateGenericSpreadRows<T extends { endCell: number }>(
  spreadRows: T[],
  expectedTotal: number,
  rowTypeName: string
): string[] {
  const errors: string[] = [];

  if (spreadRows.length === 0) {
    errors.push(`${rowTypeName}: At least one row is required`);
    return errors;
  }

  let lastEndCell = 0;

  for (let i = 0; i < spreadRows.length; i++) {
    const row = spreadRows[i];
    const endCell = row.endCell;

    if (!Number.isInteger(endCell) || endCell < 1) {
      errors.push(`${rowTypeName} Row ${i + 1}: End cell must be a positive integer`);
      continue;
    }

    if (endCell <= lastEndCell) {
      errors.push(`${rowTypeName} Row ${i + 1}: End cell ${endCell} must be greater than previous end cell ${lastEndCell}`);
    }

    if (endCell > expectedTotal) {
      errors.push(`${rowTypeName} Row ${i + 1}: End cell ${endCell} exceeds total cells ${expectedTotal}`);
    }

    lastEndCell = endCell;
  }

  if (lastEndCell !== expectedTotal) {
    if (lastEndCell < expectedTotal) {
      errors.push(`${rowTypeName}: Missing cells ${lastEndCell + 1} to ${expectedTotal}`);
    }
  }

  return errors;
}

// ============================================================================
// Tab 4 Advanced: CCFL Data (CCC1401 — Junction Diameter & CCFL Correlation)
// ============================================================================
export interface CcflSpreadRow {
  id: string;
  endJunction: number;  // Junction number (1 to ncells-1)
  diameter: number;     // W1: Junction diameter (m), 0 = auto from area
  beta: number;         // W2: Flooding correlation form (0=Wallis, 1=Kutateladze)
  gasIntercept: number; // W3: Gas intercept c (default 1.0)
  slope: number;        // W4: Slope m (default 1.0)
}

/**
 * Compress CCFL data arrays into spread rows by grouping identical consecutive values.
 * Used for loading saved ccflData back into spread format.
 */
export function compressArraysToCcflRows(
  diameterData: number | number[],
  betaData: number | number[],
  gasInterceptData: number | number[],
  slopeData: number | number[],
  numJunctions: number
): CcflSpreadRow[] {
  if (numJunctions < 1) return [];

  // Convert to arrays
  const diameterArray = Array.isArray(diameterData) ? diameterData : Array(numJunctions).fill(diameterData);
  const betaArray = Array.isArray(betaData) ? betaData : Array(numJunctions).fill(betaData);
  const gasInterceptArray = Array.isArray(gasInterceptData) ? gasInterceptData : Array(numJunctions).fill(gasInterceptData);
  const slopeArray = Array.isArray(slopeData) ? slopeData : Array(numJunctions).fill(slopeData);

  const rows: CcflSpreadRow[] = [];
  let currentRow: CcflSpreadRow | null = null;

  for (let i = 0; i < numJunctions; i++) {
    const junctionNum = i + 1;

    if (!currentRow) {
      currentRow = {
        id: `ccfl-${junctionNum}`,
        endJunction: junctionNum,
        diameter: diameterArray[i],
        beta: betaArray[i],
        gasIntercept: gasInterceptArray[i],
        slope: slopeArray[i],
      };
    } else {
      const matches =
        currentRow.diameter === diameterArray[i] &&
        currentRow.beta === betaArray[i] &&
        currentRow.gasIntercept === gasInterceptArray[i] &&
        currentRow.slope === slopeArray[i];

      if (matches) {
        currentRow.endJunction = junctionNum;
      } else {
        rows.push(currentRow);
        currentRow = {
          id: `ccfl-${junctionNum}`,
          endJunction: junctionNum,
          diameter: diameterArray[i],
          beta: betaArray[i],
          gasIntercept: gasInterceptArray[i],
          slope: slopeArray[i],
        };
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
}
