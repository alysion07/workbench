/**
 * Input Field Helper Functions
 * Utilities for handling number inputs with decimal support
 */

/**
 * Handle number input change with proper decimal support
 * Allows typing decimal point and scientific notation (e.g., 1.5e6)
 */
export const handleNumberChange = (value: string, onChange: (val: number | undefined) => void) => {
  if (value === '' || value === '-' || value === '.') {
    // Allow empty, minus sign, or decimal point during typing
    onChange(undefined);
    return;
  }

  const parsed = parseFloat(value);
  if (!isNaN(parsed)) {
    onChange(parsed);
  }
};

/**
 * Handle number input blur - final validation
 */
export const handleNumberBlur = (value: string, onChange: (val: number | undefined) => void, defaultValue?: number) => {
  if (value === '' || value === '-' || value === '.') {
    onChange(defaultValue);
    return;
  }

  const parsed = parseFloat(value);
  if (!isNaN(parsed)) {
    onChange(parsed);
  } else {
    onChange(defaultValue);
  }
};

/**
 * Common props for number input fields
 */
export const numberInputProps = {
  step: 'any',
  inputMode: 'decimal' as const,
};

/**
 * Format number for display
 * Handles scientific notation and regular decimals
 */
export const formatNumberValue = (value: number | undefined): string => {
  if (value === undefined || value === null) return '';
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-3 && value !== 0)) {
    return value.toExponential(6);
  }
  return value.toString();
};

