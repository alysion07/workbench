/**
 * NumericTextField - MUI TextField wrapper that supports scientific notation typing.
 *
 * Problem: <TextField type="number"> rejects intermediate states like "1e" or "1e-"
 * during typing, making it impossible to type scientific notation (e.g., 1e-8).
 *
 * Solution: Uses type="text" with internal string state management.
 * - Syncs text from numeric value when not focused (e.g., dialog open)
 * - Allows free typing including scientific notation intermediates
 * - Calls onChange with parsed number when valid, NaN when invalid
 * - NaN naturally fails numeric comparisons (x > NaN → false),
 *   so parent canSave checks work without extra validity tracking
 * - Shows red error border for invalid input
 * - Preserves user's original format (e.g., "13.87e6" stays as typed)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

type NumericTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

export const NumericTextField: React.FC<NumericTextFieldProps> = ({
  value,
  onChange,
  error: externalError,
  helperText: externalHelperText,
  inputProps,
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
  ...rest
}) => {
  const [text, setText] = useState(!isNaN(value) ? String(value) : '');
  const focusedRef = useRef(false);

  // Sync text from parent value ONLY when:
  // 1. The field is not focused (user is not typing)
  // 2. The value prop actually changed (dialog open, external update)
  // Using ref for focus avoids triggering sync on blur
  useEffect(() => {
    if (!focusedRef.current && !isNaN(value)) {
      setText(String(value));
    }
  }, [value]);

  const parsed = parseFloat(text);
  const isInternallyInvalid = text !== '' && (isNaN(parsed) || !isFinite(parsed));

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    const num = parseFloat(newText);
    // Always notify parent - NaN when invalid, valid number otherwise
    onChange(num);
  }, [onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    if (externalOnFocus) {
      (externalOnFocus as (e: React.FocusEvent<HTMLInputElement>) => void)(e);
    }
  }, [externalOnFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    const trimmed = text.trim();
    if (trimmed !== '' && !isNaN(parsed) && isFinite(parsed)) {
      // Only normalize incomplete intermediates (e.g., "1e" → "1", "1e-" → "1")
      // Keep valid user format as-is (e.g., "13.87e6" stays, "1e-8" stays)
      if (isNaN(Number(trimmed))) {
        setText(String(parsed));
      }
    }
    if (externalOnBlur) {
      (externalOnBlur as (e: React.FocusEvent<HTMLInputElement>) => void)(e);
    }
  }, [text, parsed, externalOnBlur]);

  return (
    <TextField
      {...rest}
      type="text"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      error={isInternallyInvalid || !!externalError}
      helperText={isInternallyInvalid ? 'Invalid number' : externalHelperText}
      inputProps={{ ...inputProps, inputMode: 'decimal' as const }}
    />
  );
};
