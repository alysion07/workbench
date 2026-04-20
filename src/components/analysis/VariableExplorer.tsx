/**
 * VariableExplorer
 * 좌측 변수 탐색기 - 컴포넌트별/타입별 트리 구조
 * Co-Sim 시 모델별 루트 노드로 그룹화하여 두 모델의 변수를 하나의 트리에 통합.
 */

import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Collapse,
  Checkbox,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandLess,
  ExpandMore,
  AccountTree as ModelIcon,
} from '@mui/icons-material';
import { useStore } from '@/stores/useStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { groupVariablesByComponent } from '@/utils/plotflParser';
import { VARIABLE_TYPE_META } from '@/types/analysis';
import type { PlotVariable } from '@/types/analysis';

interface ModelGroup {
  modelId?: string;
  modelLabel: string;
  groups: Map<string, PlotVariable[]>;
}

export default function VariableExplorer() {
  const parsedFile = useAnalysisStore((s) => s.parsedFile);
  const modelResults = useAnalysisStore((s) => s.modelResults);
  const fileName = useAnalysisStore((s) => s.fileName);
  const panels = useAnalysisStore((s) => s.panels);
  const activePanelId = useAnalysisStore((s) => s.activePanelId);
  const toggleVariable = useAnalysisStore((s) => s.toggleVariable);
  const nodes = useStore((s) => s.nodes);

  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const activePanel = panels.find((p) => p.id === activePanelId);

  // componentId → 노드 이름 매핑
  const nodeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (node.data?.componentId) {
        const cNum = String(node.data.componentId).substring(0, 3);
        map.set(cNum, node.data.componentName || node.data.componentId);
        map.set(String(node.data.componentId), node.data.componentName || node.data.componentId);
      }
    }
    return map;
  }, [nodes]);

  // 모델별 그룹 구성
  const modelGroups = useMemo<ModelGroup[]>(() => {
    if (modelResults) {
      return Object.entries(modelResults).map(([id, r]) => ({
        modelId: id,
        modelLabel: r.label,
        groups: groupVariablesByComponent(r.parsed.variables),
      }));
    }
    if (parsedFile) {
      return [
        {
          modelId: undefined,
          modelLabel: fileName ?? 'Loaded',
          groups: groupVariablesByComponent(parsedFile.variables),
        },
      ];
    }
    return [];
  }, [modelResults, parsedFile, fileName]);

  const showModelRoots = modelGroups.length > 1;

  // 검색 필터링 (모델별 groups에 각각 적용)
  const filteredModelGroups = useMemo<ModelGroup[]>(() => {
    if (!search.trim()) return modelGroups;
    const q = search.toLowerCase();

    return modelGroups
      .map((mg) => {
        const filtered = new Map<string, PlotVariable[]>();
        for (const [groupKey, vars] of mg.groups) {
          const name = nodeNameMap.get(groupKey) || groupKey;
          const matching = vars.filter(
            (v) =>
              name.toLowerCase().includes(q) ||
              groupKey.includes(q) ||
              v.componentId.includes(q) ||
              VARIABLE_TYPE_META[v.type].label.includes(q),
          );
          if (matching.length > 0) filtered.set(groupKey, matching);
        }
        return { ...mg, groups: filtered };
      })
      .filter((mg) => mg.groups.size > 0);
  }, [modelGroups, search, nodeNameMap]);

  // 현재 활성 패널에서 선택된 dataKey 집합 (프리픽스 포함)
  const selectedKeys = useMemo(
    () => new Set(activePanel?.variables.map((s) => s.dataKey) ?? []),
    [activePanel],
  );

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasAny = modelGroups.some((mg) => mg.groups.size > 0);
  if (!hasAny) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          plotfl 파일을 로드하면 변수 목록이 표시됩니다.
        </Typography>
      </Box>
    );
  }

  const renderGroups = (mg: ModelGroup, keyPrefix: string) =>
    Array.from(mg.groups).map(([groupKey, vars]) => {
      const name = nodeNameMap.get(groupKey) || `Component ${groupKey}`;
      const groupExpandKey = `${keyPrefix}${groupKey}`;
      const isGroupExpanded = expandedKeys.has(groupExpandKey);
      const indent = showModelRoots ? 4 : 0;

      return (
        <Box key={groupExpandKey}>
          <ListItemButton onClick={() => toggleExpand(groupExpandKey)} sx={{ py: 0.25, pl: indent + 1 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {vars.length}
                  </Typography>
                </Box>
              }
            />
            {isGroupExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
          </ListItemButton>

          <Collapse in={isGroupExpanded} timeout="auto">
            <List dense disablePadding>
              {vars.map((v) => {
                const meta = VARIABLE_TYPE_META[v.type];
                const effectiveKey = mg.modelId ? `${mg.modelId}::${v.dataKey}` : v.dataKey;
                const isSelected = selectedKeys.has(effectiveKey);

                return (
                  <ListItemButton
                    key={`${mg.modelId ?? ''}:${v.dataKey}`}
                    sx={{ pl: indent + 5, py: 0, minHeight: 28 }}
                    onClick={() => toggleVariable(v, undefined, mg.modelId)}
                  >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <Checkbox
                        edge="start"
                        size="small"
                        checked={isSelected}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0.25 }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap component="span">
                          {meta.label}
                          <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 0.5 }}>
                            {v.componentId}{meta.unit ? ` (${meta.unit})` : ''}
                          </Typography>
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>
        </Box>
      );
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 활성 패널 표시 */}
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
        <Chip
          label={activePanel?.title ?? '패널 없음'}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: '0.7rem', width: '100%', justifyContent: 'flex-start' }}
        />
      </Box>

      {/* 검색 */}
      <Box sx={{ px: 1.5, pb: 0.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="변수 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* 트리 목록 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense disablePadding>
          {filteredModelGroups.map((mg) => {
            if (!showModelRoots) {
              // 단일 모델: 루트 노드 없이 플랫
              return <Box key="single">{renderGroups(mg, '')}</Box>;
            }

            const modelKey = `model:${mg.modelId}`;
            const isModelExpanded = expandedKeys.has(modelKey);
            const totalVars = Array.from(mg.groups.values()).reduce(
              (sum, vars) => sum + vars.length,
              0,
            );

            return (
              <Box key={modelKey}>
                <ListItemButton onClick={() => toggleExpand(modelKey)} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <ModelIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1 }}>
                          {mg.modelLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {totalVars}
                        </Typography>
                      </Box>
                    }
                  />
                  {isModelExpanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                </ListItemButton>

                <Collapse in={isModelExpanded} timeout="auto">
                  <List dense disablePadding>
                    {renderGroups(mg, `${modelKey}:`)}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      {/* 하단 요약 */}
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {activePanel?.variables.length ?? 0}개 변수 선택됨 · {panels.length}개 차트
        </Typography>
      </Box>
    </Box>
  );
}
