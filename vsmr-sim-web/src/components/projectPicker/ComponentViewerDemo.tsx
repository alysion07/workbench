/**
 * ComponentViewerDemo - Component Viewer 테스트/데모 페이지
 *
 * ReactorSystemSVG와 체크박스 연동을 테스트하기 위한 데모
 * 실제 ProjectSettingDialog에서 사용할 구조 미리보기
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Chip,
  Grid,
} from '@mui/material';
import ReactorSystemSVG, { type ReactorComponentId } from './ReactorSystemSVG';

// Primary Loop 컴포넌트 정의
const PRIMARY_LOOP_COMPONENTS: { id: ReactorComponentId; label: string }[] = [
  { id: 'reactor', label: 'Reactor Pressure Vessel' },
  { id: 'steamGenerator', label: 'Steam Generator' },
];

// Secondary Loop 컴포넌트 정의
const SECONDARY_LOOP_COMPONENTS: { id: ReactorComponentId; label: string }[] = [
  { id: 'turbine', label: 'Turbine Generator' },
  { id: 'condenser', label: 'Condenser' },
  { id: 'feedwaterPump', label: 'Feedwater Pump' },
  { id: 'coolingTower', label: 'Cooling Tower' },
];

const ComponentViewerDemo: React.FC = () => {
  // 선택된 컴포넌트 상태
  const [selectedComponents, setSelectedComponents] = useState<ReactorComponentId[]>([
    'reactor',
    'steamGenerator',
  ]);

  // 호버 중인 컴포넌트
  const [hoveredComponent, setHoveredComponent] = useState<ReactorComponentId | null>(null);

  // 체크박스 토글 핸들러
  const handleToggle = (componentId: ReactorComponentId) => {
    setSelectedComponents((prev) =>
      prev.includes(componentId)
        ? prev.filter((id) => id !== componentId)
        : [...prev, componentId]
    );
  };

  // SVG에서 컴포넌트 클릭 시
  const handleComponentClick = (componentId: ReactorComponentId) => {
    handleToggle(componentId);
  };

  // 전체 선택/해제
  const handleSelectAll = (loop: 'primary' | 'secondary', selected: boolean) => {
    const components = loop === 'primary' ? PRIMARY_LOOP_COMPONENTS : SECONDARY_LOOP_COMPONENTS;
    const componentIds = components.map((c) => c.id);

    setSelectedComponents((prev) => {
      if (selected) {
        // 추가
        return [...new Set([...prev, ...componentIds])];
      } else {
        // 제거
        return prev.filter((id) => !componentIds.includes(id));
      }
    });
  };

  // Loop 전체 선택 여부 확인
  const isLoopFullySelected = (loop: 'primary' | 'secondary') => {
    const components = loop === 'primary' ? PRIMARY_LOOP_COMPONENTS : SECONDARY_LOOP_COMPONENTS;
    return components.every((c) => selectedComponents.includes(c.id));
  };

  const isLoopPartiallySelected = (loop: 'primary' | 'secondary') => {
    const components = loop === 'primary' ? PRIMARY_LOOP_COMPONENTS : SECONDARY_LOOP_COMPONENTS;
    const selectedCount = components.filter((c) => selectedComponents.includes(c.id)).length;
    return selectedCount > 0 && selectedCount < components.length;
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Component Viewer Demo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        체크박스를 선택하면 SVG 다이어그램에서 해당 컴포넌트가 하이라이트됩니다.
        SVG에서 컴포넌트를 클릭해도 토글됩니다.
      </Typography>

      <Grid container spacing={3}>
        {/* 좌측: SVG Viewer */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                System Diagram
              </Typography>
              {hoveredComponent && (
                <Chip
                  label={hoveredComponent}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>

            <ReactorSystemSVG
              highlightedComponents={selectedComponents}
              onComponentHover={setHoveredComponent}
              onComponentClick={handleComponentClick}
              height={400}
            />
          </Paper>
        </Grid>

        {/* 우측: 체크박스 선택 */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Select Components
            </Typography>

            {/* Primary Loop */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isLoopFullySelected('primary')}
                    indeterminate={isLoopPartiallySelected('primary')}
                    onChange={(e) => handleSelectAll('primary', e.target.checked)}
                    sx={{
                      color: '#EF4444',
                      '&.Mui-checked': { color: '#EF4444' },
                    }}
                  />
                }
                label={
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#EF4444' }}>
                    Primary Loop
                  </Typography>
                }
              />
              <FormGroup sx={{ pl: 3 }}>
                {PRIMARY_LOOP_COMPONENTS.map((component) => (
                  <FormControlLabel
                    key={component.id}
                    control={
                      <Checkbox
                        checked={selectedComponents.includes(component.id)}
                        onChange={() => handleToggle(component.id)}
                        size="small"
                      />
                    }
                    label={component.label}
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: selectedComponents.includes(component.id) ? 600 : 400,
                      },
                    }}
                  />
                ))}
              </FormGroup>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Secondary Loop */}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isLoopFullySelected('secondary')}
                    indeterminate={isLoopPartiallySelected('secondary')}
                    onChange={(e) => handleSelectAll('secondary', e.target.checked)}
                    sx={{
                      color: '#3B82F6',
                      '&.Mui-checked': { color: '#3B82F6' },
                    }}
                  />
                }
                label={
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#3B82F6' }}>
                    Secondary Loop
                  </Typography>
                }
              />
              <FormGroup sx={{ pl: 3 }}>
                {SECONDARY_LOOP_COMPONENTS.map((component) => (
                  <FormControlLabel
                    key={component.id}
                    control={
                      <Checkbox
                        checked={selectedComponents.includes(component.id)}
                        onChange={() => handleToggle(component.id)}
                        size="small"
                      />
                    }
                    label={component.label}
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: selectedComponents.includes(component.id) ? 600 : 400,
                      },
                    }}
                  />
                ))}
              </FormGroup>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 선택된 컴포넌트 요약 */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Selected Components:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {selectedComponents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    None
                  </Typography>
                ) : (
                  selectedComponents.map((id) => (
                    <Chip
                      key={id}
                      label={id}
                      size="small"
                      onDelete={() => handleToggle(id)}
                      color="primary"
                      variant="outlined"
                    />
                  ))
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ComponentViewerDemo;
