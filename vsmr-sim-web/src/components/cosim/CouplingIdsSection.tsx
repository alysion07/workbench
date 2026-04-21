/**
 * CouplingIdsSection — Tab 1: 커플링 경계면 설정
 * 컴포넌트 드롭다운(양쪽 모델 컴포넌트 조회) + 그룹 + 범위로 coupling_ids 생성
 */

import { useState, useMemo } from 'react';
import {
  Box, Typography, IconButton, TextField, Button, Paper,
  Chip, Divider, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import useProjectStore from '@/stores/projectStore';
import { generateCouplingIds } from '@/types/cosim';
import type { CouplingGroup } from '@/types/cosim';
import type { MARSNodeData, HeatStructureParameters } from '@/types/mars';
import { isHeatStructureParameters } from '@/types/mars';

/** 드롭다운에 표시할 HS sub-structure 정보 */
interface ComponentOption {
  /** 4자리 CCCG (예: "3101") — coupling_ids에서 CCC=310, G=1로 분리 */
  cccg: string;
  /** 3자리 컴포넌트 번호 CCC (예: "310") — NML coupling_ids의 CCC */
  ccc: string;
  /** geometry type G (예: 1) — NML coupling_ids의 G */
  g: number;
  /** 표시 라벨 (예: "HS 310G1 — sg_tube12 (nh=12)") */
  label: string;
  /** 어느 모델에 속하는지 */
  modelName: string;
  /** 축방향 노드 수 (nh) — endNode 기본값으로 사용 */
  nh: number;
}

/**
 * 양쪽 모델에 모두 존재하는 Heat Structure sub-structure만 추출
 *
 * MARS HS componentId: "CCCG..." (예: "3101000")
 *   → CCCG 4자리 단위로 개별 sub-structure 식별
 *   → 양쪽 모델에 동일 CCCG가 존재하는 것만 coupling 대상
 */
function extractComponents(models: { name: string; nodes: any[] }[]): ComponentOption[] {
  if (models.length < 2) return [];

  // 각 모델별 HS sub-structure 맵 (CCCG → {name, nh})
  const perModelHs: Map<string, { name: string; nh: number }>[] = models.map((model) => {
    const map = new Map<string, { name: string; nh: number }>();
    for (const node of model.nodes ?? []) {
      const data = node.data as MARSNodeData | undefined;
      if (!data?.componentId || !data?.componentType) continue;
      if (data.componentType !== 'htstr') continue;

      const cccg = data.componentId.substring(0, 4); // CCCG (4자리)
      if (map.has(cccg)) continue;

      const nh = isHeatStructureParameters(data.parameters)
        ? (data.parameters as HeatStructureParameters).nh
        : 12;
      map.set(cccg, { name: data.componentName || '', nh });
    }
    return map;
  });

  // 양쪽 모델에 모두 존재하는 sub-structure만 추출
  const options: ComponentOption[] = [];
  for (const [cccg, info] of perModelHs[0]) {
    if (!perModelHs[1].has(cccg)) continue;
    const ccc = cccg.substring(0, 3);
    const g = parseInt(cccg.substring(3, 4), 10);
    options.push({
      cccg,
      ccc,
      g,
      label: `HS ${ccc}G${g} — ${info.name} (nh=${info.nh})`,
      modelName: models[0].name,
      nh: info.nh,
    });
  }

  return options.sort((a, b) => a.cccg.localeCompare(b.cccg));
}

export default function CouplingIdsSection() {
  const { config, addComponentGroup, removeComponentGroup, updateComponentGroup } = useCoSimConfigStore();
  const componentGroups = config.nml.componentGroups;
  const allIds = generateCouplingIds(componentGroups);

  const currentProject = useProjectStore((s) => s.currentProject);
  const [selectedComp, setSelectedComp] = useState('');

  // 양쪽 모델의 컴포넌트 옵션 목록
  const componentOptions = useMemo(() => {
    const models = currentProject?.data?.models ?? [];
    return extractComponents(models.map((m) => ({ name: m.name, nodes: m.nodes ?? [] })));
  }, [currentProject]);

  // 이미 추가된 CCCG 제외 (componentNumber + 첫 번째 그룹의 groupNumber로 CCCG 복원)
  const availableOptions = useMemo(() => {
    const addedCccg = new Set(
      componentGroups.map((g) => g.componentNumber + (g.groups[0]?.groupNumber ?? 0)),
    );
    return componentOptions.filter((opt) => !addedCccg.has(opt.cccg));
  }, [componentOptions, componentGroups]);

  const handleAddComponent = () => {
    if (!selectedComp) return;
    const opt = componentOptions.find((o) => o.cccg === selectedComp);
    if (!opt) return;
    addComponentGroup({
      componentNumber: opt.ccc,
      groups: [{ groupNumber: opt.g, startNode: 1, endNode: opt.nh }],
    });
    setSelectedComp('');
  };

  const handleAddGroup = (compNumber: string) => {
    const comp = componentGroups.find((g) => g.componentNumber === compNumber);
    if (!comp) return;
    const nextGroupNum = comp.groups.length > 0
      ? Math.max(...comp.groups.map((g) => g.groupNumber)) + 1
      : 1;
    updateComponentGroup(compNumber, {
      ...comp,
      groups: [...comp.groups, { groupNumber: nextGroupNum, startNode: 1, endNode: 12 }],
    });
  };

  const handleUpdateGroup = (
    compNumber: string,
    groupIndex: number,
    field: keyof CouplingGroup,
    value: number,
  ) => {
    const comp = componentGroups.find((g) => g.componentNumber === compNumber);
    if (!comp) return;
    const newGroups = comp.groups.map((g, i) =>
      i === groupIndex ? { ...g, [field]: value } : g,
    );
    updateComponentGroup(compNumber, { ...comp, groups: newGroups });
  };

  const handleRemoveGroup = (compNumber: string, groupIndex: number) => {
    const comp = componentGroups.find((g) => g.componentNumber === compNumber);
    if (!comp) return;
    const newGroups = comp.groups.filter((_, i) => i !== groupIndex);
    if (newGroups.length === 0) {
      removeComponentGroup(compNumber);
    } else {
      updateComponentGroup(compNumber, { ...comp, groups: newGroups });
    }
  };

  // 추가된 컴포넌트의 라벨 조회 (CCC + G로 CCCG 복원)
  const getCompLabel = (ccc: string, g: number): string => {
    const cccg = ccc + g;
    const opt = componentOptions.find((o) => o.cccg === cccg);
    return opt ? opt.label : `HS ${ccc}G${g}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {/* 컴포넌트 추가 — 드롭다운 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>컴포넌트 선택</InputLabel>
          <Select
            value={selectedComp}
            onChange={(e: SelectChangeEvent) => setSelectedComp(e.target.value)}
            label="컴포넌트 선택"
          >
            {availableOptions.length === 0 && (
              <MenuItem disabled value="">
                <em>선택 가능한 컴포넌트가 없습니다</em>
              </MenuItem>
            )}
            {availableOptions.map((opt) => (
              <MenuItem key={opt.cccg} value={opt.cccg}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddComponent}
          disabled={!selectedComp}
        >
          추가
        </Button>
      </Box>

      {/* 컴포넌트 목록 */}
      {componentGroups.map((comp) => {
        const compIds = generateCouplingIds([comp]);
        return (
          <Paper key={comp.componentNumber} variant="outlined" sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>
                {getCompLabel(comp.componentNumber, comp.groups[0]?.groupNumber ?? 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={`${compIds.length}개 ID`} size="small" color="primary" variant="outlined" />
                <IconButton size="small" onClick={() => removeComponentGroup(comp.componentNumber)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            {comp.groups.map((group, gi) => (
              <Box key={gi} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                <TextField
                  label="그룹"
                  size="small"
                  type="number"
                  value={group.groupNumber}
                  onChange={(e) => handleUpdateGroup(comp.componentNumber, gi, 'groupNumber', parseInt(e.target.value) || 1)}
                  sx={{ width: 70 }}
                  inputProps={{ min: 0, max: 9 }}
                />
                <TextField
                  label="시작"
                  size="small"
                  type="number"
                  value={group.startNode}
                  onChange={(e) => handleUpdateGroup(comp.componentNumber, gi, 'startNode', parseInt(e.target.value) || 1)}
                  sx={{ width: 80 }}
                  inputProps={{ min: 1, max: 999 }}
                />
                <Typography variant="body2" color="text.secondary">~</Typography>
                <TextField
                  label="끝"
                  size="small"
                  type="number"
                  value={group.endNode}
                  onChange={(e) => handleUpdateGroup(comp.componentNumber, gi, 'endNode', parseInt(e.target.value) || 1)}
                  sx={{ width: 80 }}
                  inputProps={{ min: 1, max: 999 }}
                />
                <IconButton size="small" onClick={() => handleRemoveGroup(comp.componentNumber, gi)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddGroup(comp.componentNumber)}>
              그룹 추가
            </Button>
          </Paper>
        );
      })}

      {/* 합계 & 미리보기 */}
      <Divider />
      <Box>
        <Typography variant="body2" color="text.secondary">
          합계: <strong>{allIds.length}</strong>개 coupling IDs
        </Typography>
        {allIds.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
            {allIds.slice(0, 12).join(', ')}{allIds.length > 12 ? ', ...' : ''}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
