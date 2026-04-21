/**
 * Component ID Input Field with Duplicate Check
 * Allows users to edit component ID with real-time validation
 */

import { useState, useEffect, useMemo } from 'react';
import { TextField, Alert } from '@mui/material';
import { useStore } from '@/stores/useStore';
import type { ComponentType } from '@/types/mars';

// MARS에서 열구조체(1CCCGXNN)와 수력 컴포넌트(CCCXXNN)는 독립된 번호 네임스페이스
const HEAT_STRUCTURE_TYPES: ComponentType[] = ['htstr'];

function isHeatStructureType(type: ComponentType): boolean {
  return HEAT_STRUCTURE_TYPES.includes(type);
}

interface ComponentIdFieldProps {
  nodeId: string;
  currentComponentId: string;
  componentType: ComponentType; // 카테고리별 중복체크를 위해 필요
  value?: string; // Controlled value from react-hook-form
  onChange?: (newId: string) => void; // Controlled onChange from react-hook-form
  onComponentIdChange?: (newId: string) => void;
}

const ComponentIdField: React.FC<ComponentIdFieldProps> = ({
  nodeId,
  currentComponentId,
  componentType,
  value: _value,
  onChange,
  onComponentIdChange
}) => {
  const nodes = useStore(state => state.nodes);
  
  // Extract CCC (first 3 digits) from current component ID for display
  const getCccFromId = (id: string): string => {
    if (!id || id.length < 3) return '';
    return id.slice(0, 3);
  };
  
  const [ccc, setCcc] = useState(getCccFromId(currentComponentId));
  const [error, setError] = useState<string>('');
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Update local state when currentComponentId changes (e.g., from external update)
  useEffect(() => {
    setCcc(getCccFromId(currentComponentId));
  }, [currentComponentId]);

  // Validate CCC and check for duplicates
  const validateCcc = useMemo(() => {
    return (cccValue: string): { valid: boolean; error?: string; duplicate?: boolean; fullId?: string } => {
      // Empty check
      if (!cccValue || cccValue.trim() === '') {
        return { valid: false, error: 'Component Number (CCC) is required' };
      }

      // Format check: must be 3 digits
      if (!/^\d{3}$/.test(cccValue)) {
        return { valid: false, error: 'Component Number must be 3 digits (100-999)' };
      }

      // Range check
      const cccNum = parseInt(cccValue);
      if (cccNum < 100 || cccNum > 999) {
        return { valid: false, error: 'Component Number must be between 100 and 999' };
      }

      // Construct full 7-digit ID (CCC + 0000)
      const fullId = cccValue + '0000';

      // Check for duplicates within the same MARS namespace
      // 열구조체(1CCCGXNN)와 수력 컴포넌트(CCCXXNN)는 독립된 번호 체계
      const isCurrentHtstr = isHeatStructureType(componentType);
      const duplicateNode = nodes.find(
        (n) => n.id !== nodeId &&
               n.data.componentId === fullId &&
               isHeatStructureType(n.data.componentType) === isCurrentHtstr
      );

      if (duplicateNode) {
        return {
          valid: false,
          error: `Component Number ${cccValue} already used by "${duplicateNode.data.componentName || 'Unknown'}"`,
          duplicate: true,
          fullId,
        };
      }

      return { valid: true, fullId };
    };
  }, [nodes, nodeId, componentType]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCcc = event.target.value.trim();

    // Only allow digits and limit to 3 characters
    const digitsOnly = newCcc.replace(/\D/g, '').slice(0, 3);
    setCcc(digitsOnly);

    if (digitsOnly.length === 3) {
      const validation = validateCcc(digitsOnly);
      if (validation.valid && validation.fullId) {
        setError('');
        setIsDuplicate(false);
        // Notify react-hook-form immediately so isDirty is triggered
        onChange?.(validation.fullId);
        onComponentIdChange?.(validation.fullId);
      } else {
        setError(validation.error || '');
        setIsDuplicate(validation.duplicate || false);
      }
    } else if (digitsOnly.length > 0) {
      const cccNum = parseInt(digitsOnly);
      if (cccNum >= 1 && cccNum <= 999) {
        setError('');
        setIsDuplicate(false);
      } else {
        setError('Component Number must be between 100 and 999');
      }
    } else {
      setError('');
      setIsDuplicate(false);
    }
  };

  const handleBlur = () => {
    // Revert to stored value if input is incomplete or invalid
    if (ccc.length === 3) {
      const validation = validateCcc(ccc);
      if (!validation.valid) {
        setCcc(getCccFromId(currentComponentId));
        onChange?.(currentComponentId);
        setError('');
        setIsDuplicate(false);
      }
    } else {
      setCcc(getCccFromId(currentComponentId));
      onChange?.(currentComponentId);
      setError('');
      setIsDuplicate(false);
    }
  };

  // Get full ID for display in helper text
  const fullId = ccc.length === 3 ? ccc + '0000' : currentComponentId;
  const displayCcc = ccc.length === 3 ? ccc : getCccFromId(currentComponentId);

  return (
    <>
      <TextField
        label="Component ID"
        value={ccc}
        onChange={handleChange}
        onBlur={handleBlur}
        size="small"
        fullWidth
        required
        error={!!error}
        helperText={
          error ||
          (ccc.length === 3
            ? `Full ID: ${fullId} (CCC: ${displayCcc} - Component Number)`
            : 'Enter 3-digit component number (100-999)')
        }
        inputProps={{
          maxLength: 3,
          pattern: '[0-9]{3}',
        }}
      />
      {isDuplicate && (
        <Alert severity="error" sx={{ mt: 0.5 }}>
          This Component Number is already in use. Please choose a different number.
        </Alert>
      )}
    </>
  );
};

export default ComponentIdField;

