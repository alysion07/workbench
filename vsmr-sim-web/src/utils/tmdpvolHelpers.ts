/**
 * TMDPVOL Validation and Helper Utilities
 * Similar to PIPE validation logic for consistency
 */

/**
 * Validate geometry according to MARS rules for TMDPVOL:
 * - Exactly one of A, L, V can be 0 (for auto-calculation)
 * - If all three are non-zero, check consistency: V ≈ A×L (relative error ≤ 1e-6)
 */
export function validateTmdpvolGeometry(
  area: number | undefined,
  length: number | undefined,
  volume: number
): { valid: boolean; error?: string; calculated?: { field: 'area' | 'length' | 'volume'; value: number } } {
  const areaVal = area ?? 0;
  const lengthVal = length ?? 0;
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
      return { valid: true, calculated: { field: 'area', value: calculatedArea } };
    }

    if (lengthVal === 0) {
      if (areaVal === 0 || volumeVal === 0) {
        return { valid: false, error: 'Cannot calculate Length: Area or Volume is zero' };
      }
      const calculatedLength = volumeVal / areaVal;
      return { valid: true, calculated: { field: 'length', value: calculatedLength } };
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
      error: `Inconsistent: A×L=${calculatedVolume.toExponential(3)} ≠ V=${volumeVal.toExponential(3)} (error=${(relativeError * 100).toFixed(4)}%)`
    };
  }

  return { valid: true };
}

/**
 * Parse εbt format to extract fluid type, boron flag, and thermodynamic option
 * Format: εbt where ε=fluid type (0-2), b=boron (0-1), t=thermo option (0-8)
 */
export function parseEbtFormat(ebt: string): {
  fluidType: number;  // ε: 0=H₂O, 1=D₂O, 2=other
  boronFlag: boolean; // b: 0=no boron, 1=with boron
  thermoOption: number; // t: 0-8
} {
  if (ebt.length !== 3) {
    throw new Error('εbt must be 3 digits');
  }

  const epsilon = parseInt(ebt[0]);
  const b = parseInt(ebt[1]);
  const t = parseInt(ebt[2]);

  if (isNaN(epsilon) || isNaN(b) || isNaN(t)) {
    throw new Error('εbt must contain only digits');
  }

  if (epsilon < 0 || epsilon > 2) {
    throw new Error('ε (fluid type) must be 0-2');
  }

  if (b < 0 || b > 1) {
    throw new Error('b (boron flag) must be 0 or 1');
  }

  if (t < 0 || t > 8) {
    throw new Error('t (thermodynamic option) must be 0-8');
  }

  return {
    fluidType: epsilon,
    boronFlag: b === 1,
    thermoOption: t,
  };
}

/**
 * Get required fields for a given thermodynamic option
 */
export function getThermoOptionFields(thermoOption: number): {
  required: string[];
  optional: string[];
  labels: Record<string, string>;
} {
  const fieldsMap: Record<number, {
    required: string[];
    optional: string[];
    labels: Record<string, string>;
  }> = {
    0: {
      required: ['pressure', 'internalEnergyLiquid', 'internalEnergyVapor', 'voidFraction'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        internalEnergyLiquid: 'Liquid Internal Energy Uf (J/kg)',
        internalEnergyVapor: 'Vapor Internal Energy Ug (J/kg)',
        voidFraction: 'Void Fraction αg (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    1: {
      required: ['temperature', 'quality'],
      optional: ['boronConcentration'],
      labels: {
        temperature: 'Temperature (K)',
        quality: 'Static Quality xs (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    2: {
      required: ['pressure', 'quality'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        quality: 'Static Quality xs (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    3: {
      required: ['pressure', 'temperature'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        temperature: 'Temperature (K)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    4: {
      required: ['pressure', 'temperature', 'quality'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        temperature: 'Temperature (K)',
        quality: 'Static Quality xs (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    5: {
      required: ['temperature', 'quality', 'noncondensableQuality'],
      optional: ['boronConcentration'],
      labels: {
        temperature: 'Temperature (K)',
        quality: 'Static Quality xs (0-1)',
        noncondensableQuality: 'Noncondensable Quality xn (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    6: {
      required: ['pressure', 'internalEnergyLiquid', 'internalEnergyVapor', 'voidFraction', 'noncondensableQuality'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        internalEnergyLiquid: 'Liquid Internal Energy Uf (J/kg)',
        internalEnergyVapor: 'Vapor Internal Energy Ug (J/kg)',
        voidFraction: 'Void Fraction αg (0-1)',
        noncondensableQuality: 'Noncondensable Quality xn (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    7: {
      required: ['pressure', 'temperatureLiquid', 'temperatureVapor', 'voidFraction'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        temperatureLiquid: 'Liquid Temp Tf (K)',
        temperatureVapor: 'Vapor Temp Tg (K)',
        voidFraction: 'Void Fraction αg (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
    8: {
      required: ['pressure', 'temperature', 'quality', 'relativeHumidity'],
      optional: ['boronConcentration'],
      labels: {
        pressure: 'Pressure (Pa)',
        temperature: 'Temperature (K)',
        quality: 'Static Quality xs (0-1)',
        relativeHumidity: 'Relative Humidity (0-1)',
        boronConcentration: 'Boron Concentration (ppm)',
      },
    },
  };

  return fieldsMap[thermoOption] || { required: [], optional: [], labels: {} };
}

/**
 * Validate quality range according to MARS manual
 * - Two-phase: 1.0E-9 < xs < 0.99999999
 * - Single phase: xs <= 1.0E-9 or xs >= 0.99999999
 * - Special values: xs=0.0 (dry noncondensable), xs=1.0 (single phase vapor)
 * - Valid range: 0.0 <= xs <= 1.0
 */
export function validateQualityRange(quality: number | undefined): { valid: boolean; error?: string } {
  if (quality === undefined) return { valid: true };

  // Quality must be between 0.0 and 1.0 (inclusive)
  if (quality < 0.0 || quality > 1.0) {
    return {
      valid: false,
      error: `Quality must be between 0.0 and 1.0 (current: ${quality})`,
    };
  }

  return { valid: true };
}

/**
 * Validate angle ranges according to MARS manual
 * - Azimuthal angle: |angle| ≤ 360°
 * - Inclination angle: |angle| ≤ 90° (0°=horizontal, +angle=upward, -angle=downward)
 */
export function validateAngles(azAngle: number | undefined, incAngle: number): {
  valid: boolean;
  errors: string[]
} {
  const errors: string[] = [];

  if (azAngle !== undefined && Math.abs(azAngle) > 360) {
    errors.push('Azimuthal angle must be |angle| ≤ 360°');
  }

  if (Math.abs(incAngle) > 90) {
    errors.push('Inclination angle must be |angle| ≤ 90° (0°=horizontal, +angle=upward inlet, -angle=downward inlet)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate elevation change relative to length
 */
export function validateElevation(dz: number, length: number | undefined): {
  valid: boolean;
  error?: string
} {
  if (length === undefined || length === 0) {
    return { valid: true }; // Cannot validate without length
  }

  if (Math.abs(dz) > length) {
    return {
      valid: false,
      error: `Elevation change |dz|=${Math.abs(dz).toFixed(3)}m must be ≤ Length=${length.toFixed(3)}m`,
    };
  }

  return { valid: true };
}

/**
 * Get fluid type name
 */
export function getFluidTypeName(fluidType: number): string {
  const names: Record<number, string> = {
    0: 'H₂O (Light Water)',
    1: 'D₂O (Heavy Water)',
    2: 'Other Fluid',
  };
  return names[fluidType] || 'Unknown';
}

/**
 * Get thermodynamic option description
 */
export function getThermoOptionDescription(thermoOption: number): string {
  const descriptions: Record<number, string> = {
    0: 't=0: P, Uf, Ug, αg',
    1: 't=1: T, xs',
    2: 't=2: P, xs',
    3: 't=3: P, T',
    4: 't=4: P, T, xs (with noncondensable)',
    5: 't=5: T, xs, xn',
    6: 't=6: P, Uf, Ug, αg, xn',
    7: 't=7: P, Tf, Tg, αg (TRACE compatible)',
    8: 't=8: P, T, xs, RH (relative humidity)',
  };
  return descriptions[thermoOption] || 'Unknown';
}

