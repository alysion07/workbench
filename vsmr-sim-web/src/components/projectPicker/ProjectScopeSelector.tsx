/**
 * ProjectScopeSelector Component
 * PRJ-001-NP: Project Scope + Partition 선택 UI
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import { ProjectScope, ProjectPartition } from '../../types/supabase';

// Scope 옵션
const SCOPE_OPTIONS: { value: ProjectScope; label: string; color: string }[] = [
  { value: 'primary', label: 'Primary Loop', color: '#3f51b5' },
  { value: 'secondary', label: 'Second Loop', color: '#9c27b0' },
  { value: 'bop', label: 'BOP', color: '#009688' },
];

// Analysis Code 옵션
const ANALYSIS_CODES = ['MARS', 'Modelica'];

interface ProjectScopeSelectorProps {
  scope: ProjectScope[];
  partition: ProjectPartition;
  onScopeChange: (scope: ProjectScope[]) => void;
  onPartitionChange: (partition: ProjectPartition) => void;
}

const ProjectScopeSelector: React.FC<ProjectScopeSelectorProps> = ({
  scope,
  partition,
  onScopeChange,
  onPartitionChange,
}) => {
  // Scope 토글
  const handleScopeToggle = (scopeValue: ProjectScope) => {
    if (scope.includes(scopeValue)) {
      onScopeChange(scope.filter((s) => s !== scopeValue));
    } else {
      onScopeChange([...scope, scopeValue]);
    }
  };

  // Partition 변경
  const handlePartitionChange = (field: keyof ProjectPartition, value: any) => {
    onPartitionChange({
      ...partition,
      [field]: value,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Project Scope */}
      <FormControl component="fieldset">
        <FormLabel
          component="legend"
          sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}
        >
          Project Scope
        </FormLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {SCOPE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onClick={() => handleScopeToggle(option.value)}
              onDelete={
                scope.includes(option.value)
                  ? () => handleScopeToggle(option.value)
                  : undefined
              }
              sx={{
                bgcolor: scope.includes(option.value) ? option.color : 'grey.200',
                color: scope.includes(option.value) ? 'white' : 'text.primary',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: scope.includes(option.value) ? option.color : 'grey.300',
                },
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255,255,255,0.7)',
                  '&:hover': {
                    color: 'white',
                  },
                },
              }}
            />
          ))}
        </Box>
      </FormControl>

      {/* Project Partition */}
      <FormControl component="fieldset">
        <FormLabel
          component="legend"
          sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}
        >
          Project Partition
        </FormLabel>

        {/* NSSS Model */}
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={partition.nsssModel || false}
                  onChange={(e) =>
                    handlePartitionChange('nsssModel', e.target.checked)
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2" fontWeight={500}>
                  NSSS Model
                </Typography>
              }
            />
          </Box>
          {partition.nsssModel && (
            <FormControl size="small" sx={{ minWidth: 150, ml: 4 }}>
              <InputLabel>Analysis Code</InputLabel>
              <Select
                value={partition.analysisCode || 'MARS'}
                label="Analysis Code"
                onChange={(e) =>
                  handlePartitionChange('analysisCode', e.target.value)
                }
              >
                {ANALYSIS_CODES.map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* BOP Model */}
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={partition.bopModel || false}
                onChange={(e) =>
                  handlePartitionChange('bopModel', e.target.checked)
                }
                size="small"
              />
            }
            label={
              <Typography variant="body2" fontWeight={500}>
                BOP Model
              </Typography>
            }
          />
        </Box>
      </FormControl>
    </Box>
  );
};

export default ProjectScopeSelector;
