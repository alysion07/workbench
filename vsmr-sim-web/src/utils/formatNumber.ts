/**
 * Format a number for display, preserving full precision.
 *
 * - Uses scientific notation for very large (>=1e6) or very small (<1e-3) values
 * - toExponential() without arguments preserves all significant digits
 *   e.g., 13870000 → "1.387e+7" (not "1.39e+7" which loses precision)
 * - Normal range numbers are displayed as-is
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '';
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3) {
    const s = value.toExponential();
    // 소수점 없는 과학적 표기법 방지: "1e+6" → "1.0e+6"
    return /^-?\d+e/i.test(s) ? s.replace(/^(-?\d+)(e)/i, '$1.0$2') : s;
  }
  return String(value);
}
