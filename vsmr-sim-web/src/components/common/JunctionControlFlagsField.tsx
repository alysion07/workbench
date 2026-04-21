/**
 * JunctionControlFlagsField - Junction Control Flags (jefvcahs) 개별 플래그 편집 컴포넌트
 *
 * MARS 매뉴얼의 jefvcahs 플래그를 ToggleButtonGroup으로 분리하여 표시.
 * 컴포넌트 타입별로 편집 가능/고정 플래그가 다름:
 *   - Separator: 0000cahs (j,e,f,v 고정)
 *   - Branch:    0efvcahs (j 고정)
 *   - SNGLJUN:   jefvcahs (모두 편집 가능)
 *   - MTPLJUN:   0ef0cahs (j,v 고정)
 *
 * 내부적으로는 항상 8자리 문자열로 조합하여 저장.
 */

import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';

// ── Flag 정의 ──────────────────────────────────────────

type FlagKey = 'j' | 'e' | 'f' | 'v' | 'c' | 'a' | 'h' | 's';

interface FlagOption {
  value: number;
  label: string;
}

interface FlagDefinition {
  key: FlagKey;
  label: string;
  tooltip: string;
  options: FlagOption[];
}

const FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    key: 'j',
    label: 'Junction Type',
    tooltip: 'Junction type flag (normally 0)',
    options: [{ value: 0, label: 'Normal' }],
  },
  {
    key: 'e',
    label: 'Modified PV',
    tooltip: 'Modified PV term in energy equations',
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'On' },
    ],
  },
  {
    key: 'f',
    label: 'CCFL',
    tooltip: 'Counter-Current Flow Limitation model',
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'On' },
    ],
  },
  {
    key: 'v',
    label: 'Stratification',
    tooltip: 'Horizontal stratification entrainment/pullthrough',
    options: [
      { value: 0, label: 'Off' },
      { value: 1, label: 'Up' },
      { value: 2, label: 'Down' },
      { value: 3, label: 'Side' },
    ],
  },
  {
    key: 'c',
    label: 'Choking',
    tooltip: 'Choking model (Henry-Fauske or RELAP5)',
    options: [
      { value: 0, label: 'On' },
      { value: 1, label: 'Off' },
    ],
  },
  {
    key: 'a',
    label: 'Area Change',
    tooltip: 'Area change options for junction',
    options: [
      { value: 0, label: 'Smooth' },
      { value: 1, label: 'Full' },
      { value: 2, label: 'Partial' },
    ],
  },
  {
    key: 'h',
    label: 'Momentum Eq.',
    tooltip: 'Homogeneous (single-velocity) vs Nonhomogeneous (two-velocity)',
    options: [
      { value: 0, label: 'Nonhomo' },
      { value: 1, label: 'Homo-1' },
      { value: 2, label: 'Homo-2' },
    ],
  },
  {
    key: 's',
    label: 'Momentum Flux',
    tooltip: 'Momentum flux calculation scope',
    options: [
      { value: 0, label: 'Both' },
      { value: 1, label: 'From' },
      { value: 2, label: 'To' },
      { value: 3, label: 'None' },
    ],
  },
];

// ── Preset 설정 ────────────────────────────────────────

interface FlagRecommendation {
  value: number;
  label: string;
}

export interface FlagPreset {
  lockedFlags: FlagKey[];
  editableFlags: FlagKey[];
  recommendations?: Partial<Record<FlagKey, FlagRecommendation>>;
}

export const FLAG_PRESETS: Record<string, FlagPreset> = {
  separator: {
    lockedFlags: ['j', 'e', 'f', 'v'],
    editableFlags: ['c', 'a', 'h', 's'],
    recommendations: {
      c: { value: 1, label: 'Manual 8.11: choking off recommended' },
      h: { value: 0, label: 'Manual 8.11: nonhomogeneous recommended (J1,J2)' },
    },
  },
  branch: {
    lockedFlags: ['j'],
    editableFlags: ['e', 'f', 'v', 'c', 'a', 'h', 's'],
  },
  sngljun: {
    lockedFlags: [],
    editableFlags: ['j', 'e', 'f', 'v', 'c', 'a', 'h', 's'],
  },
  mtpljun: {
    lockedFlags: ['j', 'v'],
    editableFlags: ['e', 'f', 'c', 'a', 'h', 's'],
  },
  valve: {
    lockedFlags: [],
    editableFlags: ['j', 'e', 'f', 'v', 'c', 'a', 'h', 's'],
  },
  turbine: {
    lockedFlags: [],
    editableFlags: ['j', 'e', 'f', 'v', 'c', 'a', 'h', 's'],
  },
  tank: {
    lockedFlags: ['j'],
    editableFlags: ['e', 'f', 'v', 'c', 'a', 'h', 's'],
  },
};

// ── Helper 함수 ────────────────────────────────────────

const FLAG_ORDER: FlagKey[] = ['j', 'e', 'f', 'v', 'c', 'a', 'h', 's'];

export function parseFlags(value: string): Record<FlagKey, number> {
  const padded = (value || '00000000').padStart(8, '0');
  const result: Record<FlagKey, number> = { j: 0, e: 0, f: 0, v: 0, c: 0, a: 0, h: 0, s: 0 };
  FLAG_ORDER.forEach((key, idx) => {
    result[key] = parseInt(padded[idx], 10) || 0;
  });
  return result;
}

export function assembleFlags(flags: Record<FlagKey, number>): string {
  return FLAG_ORDER.map((key) => String(flags[key] || 0)).join('');
}

// ── 컴포넌트 Props ─────────────────────────────────────

interface JunctionControlFlagsFieldProps {
  value: string;
  onChange: (value: string) => void;
  preset: keyof typeof FLAG_PRESETS;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

// ── 메인 컴포넌트 ──────────────────────────────────────

const LABEL_WIDTH = 110;

export const JunctionControlFlagsField: React.FC<JunctionControlFlagsFieldProps> = ({
  value,
  onChange,
  preset,
  error,
  helperText,
  disabled,
}) => {
  const config = FLAG_PRESETS[preset];
  const flags = useMemo(() => parseFlags(value), [value]);

  const handleFlagChange = useCallback(
    (flagKey: FlagKey, newValue: number) => {
      const updated = { ...flags, [flagKey]: newValue };
      config.lockedFlags.forEach((lk) => {
        updated[lk] = 0;
      });
      onChange(assembleFlags(updated));
    },
    [flags, config.lockedFlags, onChange]
  );

  const editableDefinitions = useMemo(
    () => FLAG_DEFINITIONS.filter((d) => config.editableFlags.includes(d.key)),
    [config.editableFlags]
  );

  const rawValue = assembleFlags(flags);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: error ? 'error.main' : 'rgba(0,0,0,0.23)',
        borderRadius: '4px',
        position: 'relative',
        pt: 1.25,
        pb: 1,
        px: 1.5,
        '&:hover': {
          borderColor: error ? 'error.main' : 'rgba(0,0,0,0.87)',
        },
      }}
    >
      {/* Floating label - MUI outlined style */}
      <Typography
        component="label"
        sx={{
          position: 'absolute',
          top: 0,
          left: 8,
          transform: 'translateY(-50%)',
          px: 0.5,
          bgcolor: 'background.paper',
          fontSize: '0.75rem',
          color: error ? 'error.main' : 'text.secondary',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        Junction Control Flags
      </Typography>

      {/* Flag rows */}
      {editableDefinitions.map((flagDef) => {
        const recommendation = config.recommendations?.[flagDef.key];
        const currentValue = flags[flagDef.key];
        const isRecommended = recommendation && currentValue === recommendation.value;

        return (
          <Box
            key={flagDef.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: flagDef.key !== editableDefinitions[editableDefinitions.length - 1].key ? '6px' : 0,
            }}
          >
            {/* Label - fixed width */}
            <Tooltip
              title={
                <>
                  {flagDef.tooltip}
                  {recommendation && (
                    <>
                      <br />
                      {recommendation.label}
                    </>
                  )}
                </>
              }
              arrow
              placement="left"
            >
              <Box
                sx={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 0.5,
                  pr: 1.5,
                  cursor: 'help',
                }}
              >
                {recommendation && !isRecommended && (
                  <StarIcon sx={{ fontSize: 11, color: 'warning.main', flexShrink: 0 }} />
                )}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: 'text.primary',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  {flagDef.label}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.72rem',
                    color: 'primary.main',
                    fontWeight: 800,
                    flexShrink: 0,
                    minWidth: 12,
                    textAlign: 'center',
                  }}
                >
                  {flagDef.key}
                </Typography>
              </Box>
            </Tooltip>

            {/* Toggle buttons - stretch to fill */}
            <ToggleButtonGroup
              value={currentValue}
              exclusive
              size="small"
              disabled={disabled}
              onChange={(_, newVal) => {
                if (newVal !== null) handleFlagChange(flagDef.key, newVal);
              }}
              sx={{
                flex: 1,
                '& .MuiToggleButtonGroup-grouped': {
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:not(:first-of-type)': {
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    marginLeft: '-1px',
                  },
                },
              }}
            >
              {flagDef.options.map((opt) => {
                const isRec = recommendation?.value === opt.value;
                const isSelected = currentValue === opt.value;
                return (
                  <ToggleButton
                    key={opt.value}
                    value={opt.value}
                    sx={{
                      fontSize: '0.72rem',
                      py: '3px',
                      textTransform: 'none',
                      lineHeight: 1.4,
                      fontWeight: isSelected ? 600 : 400,
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: isRec ? 'rgba(46,125,50,0.08)' : 'rgba(25,118,210,0.08)',
                        color: isRec ? 'success.dark' : 'primary.main',
                        borderColor: isRec ? 'success.main' : 'primary.main',
                        '&:hover': {
                          bgcolor: isRec ? 'rgba(46,125,50,0.15)' : 'rgba(25,118,210,0.15)',
                        },
                      },
                    }}
                  >
                    {opt.label}
                    {isRec && isSelected && (
                      <StarIcon sx={{ fontSize: 10, ml: 0.4 }} />
                    )}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          </Box>
        );
      })}

      {/* Result value row */}
      <Box
        sx={{
          mt: 1,
          pt: 0.75,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.73rem',
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          Result
        </Typography>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: 'text.primary',
            fontWeight: 700,
            letterSpacing: '1px',
          }}
        >
          {rawValue}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.65rem',
            color: 'text.disabled',
            fontFamily: 'monospace',
          }}
        >
          (jefvcahs)
        </Typography>
      </Box>

      {/* Error text */}
      {helperText && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem', color: 'error.main' }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default JunctionControlFlagsField;
