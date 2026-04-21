/**
 * AlarmSettingsDialog
 * 시나리오 기반 알람 설정 다이얼로그 (3개 탭: 시나리오 / 한계치 / 사용자 정의)
 */

import { memo, useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type {
  AlarmScenarioConfig,
  AlarmScenario,
  AlarmCondition,
  AlarmLevel,
  ComparisonOperator,
  ConditionLogic,
  ScenarioSource,
} from '@/types/interactive';

interface AlarmSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  scenarioConfig: AlarmScenarioConfig;
  onSave: (config: AlarmScenarioConfig) => void;
  nodeNames: Record<string, string>;
}

// ============================================================================
// Tab 0: 시나리오 목록
// ============================================================================

interface ScenarioListTabProps {
  scenarios: AlarmScenario[];
  onToggle: (id: string, enabled: boolean) => void;
}

const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  '>': '>', '>=': '≥', '<': '<', '<=': '≤', '==': '=', '!=': '≠',
};

function formatConditionSummary(c: AlarmCondition): string {
  const op = OPERATOR_LABELS[c.operator] ?? c.operator;
  return `${c.dataKey} ${op} ${c.value}${c.unit ? ` ${c.unit}` : ''}`;
}

const ScenarioListTab: React.FC<ScenarioListTabProps> = ({ scenarios, onToggle }) => {
  if (scenarios.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: '#888', py: 2, textAlign: 'center' }}>
        등록된 시나리오가 없습니다.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {scenarios.map((s) => (
        <Accordion key={s.id} disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
            {s.source === 'predefined' && (
              <Tooltip title="사전정의 시나리오 (삭제 불가)">
                <LockIcon sx={{ fontSize: 14, color: '#999' }} />
              </Tooltip>
            )}
            <Chip
              icon={s.level === 'danger' ? <ErrorIcon sx={{ fontSize: 12 }} /> : <WarningIcon sx={{ fontSize: 12 }} />}
              label={s.level === 'danger' ? 'Danger' : 'Warning'}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 600,
                backgroundColor: s.level === 'danger' ? '#ffebee' : '#fff8e1',
                color: s.level === 'danger' ? '#c62828' : '#f57f17',
                '& .MuiChip-icon': { color: s.level === 'danger' ? '#c62828' : '#f57f17' },
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', flex: 1 }}>
              {s.nameKo ?? s.name}
            </Typography>
            <SourceChip source={s.source} />
            <Switch
              checked={s.enabled}
              onChange={(_, checked) => onToggle(s.id, checked)}
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            {s.description && (
              <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                {s.description}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: '#888' }}>
              조건 ({s.logic}): {s.conditions.map(formatConditionSummary).join(s.logic === 'AND' ? ' AND ' : ' OR ')}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

const SourceChip: React.FC<{ source: ScenarioSource }> = ({ source }) => {
  const labels: Record<ScenarioSource, string> = { predefined: '사전정의', threshold: '한계치', custom: '사용자' };
  const colors: Record<ScenarioSource, string> = { predefined: '#e3f2fd', threshold: '#f3e5f5', custom: '#e8f5e9' };
  return (
    <Chip
      label={labels[source]}
      size="small"
      sx={{ height: 18, fontSize: '0.6rem', backgroundColor: colors[source] }}
    />
  );
};

// ============================================================================
// Tab 1: 한계치 (레거시 호환)
// ============================================================================

interface ThresholdTabProps {
  scenarios: AlarmScenario[];
  onUpdate: (scenarios: AlarmScenario[]) => void;
}

const THRESHOLD_FIELDS = [
  { dataKey: 'pressure', label: '압력 (Pressure)', unit: 'MPa' },
  { dataKey: 'temperature', label: '온도 (Temperature)', unit: '°C' },
  { dataKey: 'flowRate', label: '유량 (Flow Rate)', unit: 'kg/s' },
  { dataKey: 'valvePosition', label: '밸브 위치 (Valve Position)', unit: '%' },
];

const ThresholdTab: React.FC<ThresholdTabProps> = ({ scenarios, onUpdate }) => {
  // threshold 시나리오에서 값 추출
  const getValue = (dataKey: string, suffix: string): string => {
    const id = `threshold-${dataKey}-${suffix}`;
    const s = scenarios.find((sc) => sc.id === id);
    if (!s || s.conditions.length === 0) return '';
    return String(s.conditions[0].value);
  };

  const handleChange = (dataKey: string, suffix: string, value: string) => {
    const id = `threshold-${dataKey}-${suffix}`;
    const num = value === '' ? undefined : parseFloat(value);
    if (num !== undefined && isNaN(num)) return;

    const levelMap: Record<string, AlarmLevel> = { wh: 'warning', wl: 'warning', dh: 'danger', dl: 'danger' };
    const opMap: Record<string, ComparisonOperator> = { wh: '>=', wl: '<=', dh: '>=', dl: '<=' };
    const nameMap: Record<string, string> = { wh: '상한 경고', wl: '하한 경고', dh: '상한 위험', dl: '하한 위험' };
    const fieldLabel = THRESHOLD_FIELDS.find((f) => f.dataKey === dataKey)?.label ?? dataKey;
    const unit = THRESHOLD_FIELDS.find((f) => f.dataKey === dataKey)?.unit;

    const updated = [...scenarios];
    const idx = updated.findIndex((s) => s.id === id);

    if (num === undefined) {
      // 값 삭제 → 시나리오 제거
      if (idx >= 0) {
        updated.splice(idx, 1);
        onUpdate(updated);
      }
      return;
    }

    const scenario: AlarmScenario = {
      id,
      name: `${fieldLabel} ${nameMap[suffix]}`,
      nameKo: `${fieldLabel.split(' (')[0]} ${nameMap[suffix]}`,
      source: 'threshold',
      level: levelMap[suffix],
      conditions: [
        { id: `${dataKey}-${suffix}`, dataKey, operator: opMap[suffix], value: num, unit, scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: true,
      priority: 100,
    };

    if (idx >= 0) {
      updated[idx] = scenario;
    } else {
      updated.push(scenario);
    }
    onUpdate(updated);
  };

  return (
    <Box>
      {THRESHOLD_FIELDS.map((field) => (
        <Box key={field.dataKey} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.85rem' }}>
            {field.label} ({field.unit})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" label="Warning High" type="number"
              value={getValue(field.dataKey, 'wh')}
              onChange={(e) => handleChange(field.dataKey, 'wh', e.target.value)}
              sx={{ flex: 1 }} InputProps={{ sx: { fontSize: '0.8rem' } }} InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
            />
            <TextField size="small" label="Danger High" type="number"
              value={getValue(field.dataKey, 'dh')}
              onChange={(e) => handleChange(field.dataKey, 'dh', e.target.value)}
              sx={{ flex: 1 }} InputProps={{ sx: { fontSize: '0.8rem' } }} InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <TextField size="small" label="Warning Low" type="number"
              value={getValue(field.dataKey, 'wl')}
              onChange={(e) => handleChange(field.dataKey, 'wl', e.target.value)}
              sx={{ flex: 1 }} InputProps={{ sx: { fontSize: '0.8rem' } }} InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
            />
            <TextField size="small" label="Danger Low" type="number"
              value={getValue(field.dataKey, 'dl')}
              onChange={(e) => handleChange(field.dataKey, 'dl', e.target.value)}
              sx={{ flex: 1 }} InputProps={{ sx: { fontSize: '0.8rem' } }} InputLabelProps={{ sx: { fontSize: '0.8rem' } }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// Tab 2: 사용자 정의 시나리오
// ============================================================================

interface CustomScenarioTabProps {
  scenarios: AlarmScenario[];
  onAdd: (scenario: AlarmScenario) => void;
  onDelete: (id: string) => void;
  onUpdate: (scenario: AlarmScenario) => void;
}

const DATA_KEY_OPTIONS = [
  { value: 'pressure', label: '압력 (P)', unit: 'MPa' },
  { value: 'temperature', label: '온도 (T)', unit: '°C' },
  { value: 'flowRate', label: '유량 (W)', unit: 'kg/s' },
  { value: 'valvePosition', label: '밸브 위치 (%)', unit: '%' },
];

const OPERATOR_OPTIONS: ComparisonOperator[] = ['>', '>=', '<', '<=', '==', '!='];

let customCounter = 0;

const CustomScenarioTab: React.FC<CustomScenarioTabProps> = ({ scenarios, onAdd, onDelete, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AlarmScenario>>({});

  const startNew = () => {
    const id = `custom-${Date.now()}-${customCounter++}`;
    setEditingId(id);
    setDraft({
      id,
      name: '',
      nameKo: '',
      source: 'custom',
      level: 'warning',
      conditions: [{ id: `cond-0`, dataKey: 'pressure', operator: '>', value: 0, unit: 'MPa', scope: { type: 'any' } }],
      logic: 'AND',
      enabled: true,
      priority: 200,
    });
  };

  const startEdit = (s: AlarmScenario) => {
    setEditingId(s.id);
    setDraft({ ...s, conditions: s.conditions.map((c) => ({ ...c })) });
  };

  const addCondition = () => {
    setDraft((d) => ({
      ...d,
      conditions: [...(d.conditions ?? []), { id: `cond-${Date.now()}`, dataKey: 'pressure', operator: '>' as ComparisonOperator, value: 0, unit: 'MPa', scope: { type: 'any' as const } }],
    }));
  };

  const removeCondition = (idx: number) => {
    setDraft((d) => ({
      ...d,
      conditions: (d.conditions ?? []).filter((_, i) => i !== idx),
    }));
  };

  const updateCondition = (idx: number, field: string, value: any) => {
    setDraft((d) => {
      const conditions = [...(d.conditions ?? [])];
      conditions[idx] = { ...conditions[idx], [field]: value };
      // unit 자동 설정
      if (field === 'dataKey') {
        const opt = DATA_KEY_OPTIONS.find((o) => o.value === value);
        if (opt) conditions[idx].unit = opt.unit;
      }
      return { ...d, conditions };
    });
  };

  const handleSave = () => {
    if (!draft.name || !draft.conditions?.length) return;
    const scenario: AlarmScenario = {
      id: draft.id!,
      name: draft.name!,
      nameKo: draft.nameKo || draft.name,
      source: 'custom',
      level: draft.level as AlarmLevel ?? 'warning',
      conditions: draft.conditions as AlarmCondition[],
      logic: draft.logic as ConditionLogic ?? 'AND',
      enabled: draft.enabled ?? true,
      priority: draft.priority ?? 200,
    };

    if (scenarios.some((s) => s.id === scenario.id)) {
      onUpdate(scenario);
    } else {
      onAdd(scenario);
    }
    setEditingId(null);
    setDraft({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft({});
  };

  return (
    <Box>
      {/* 기존 커스텀 시나리오 목록 */}
      {scenarios.map((s) => (
        <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
              {s.nameKo ?? s.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              {s.conditions.map(formatConditionSummary).join(s.logic === 'AND' ? ' AND ' : ' OR ')}
            </Typography>
          </Box>
          <Chip
            label={s.level === 'danger' ? 'Danger' : 'Warning'}
            size="small"
            sx={{ height: 20, fontSize: '0.65rem', backgroundColor: s.level === 'danger' ? '#ffebee' : '#fff8e1' }}
          />
          <IconButton size="small" onClick={() => startEdit(s)}>
            <ExpandIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(s.id)} sx={{ color: '#f44336' }}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ))}

      {/* 편집/생성 폼 */}
      {editingId && (
        <Box sx={{ p: 1.5, border: '2px solid #1976d2', borderRadius: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField size="small" label="시나리오 이름" value={draft.nameKo ?? ''} fullWidth
              onChange={(e) => setDraft((d) => ({ ...d, nameKo: e.target.value, name: e.target.value }))}
              InputProps={{ sx: { fontSize: '0.82rem' } }} InputLabelProps={{ sx: { fontSize: '0.82rem' } }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={{ fontSize: '0.82rem' }}>레벨</InputLabel>
              <Select value={draft.level ?? 'warning'} label="레벨"
                onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value as AlarmLevel }))}
                sx={{ fontSize: '0.82rem' }}>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="danger">Danger</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel sx={{ fontSize: '0.82rem' }}>조건</InputLabel>
              <Select value={draft.logic ?? 'AND'} label="조건"
                onChange={(e) => setDraft((d) => ({ ...d, logic: e.target.value as ConditionLogic }))}
                sx={{ fontSize: '0.82rem' }}>
                <MenuItem value="AND">AND</MenuItem>
                <MenuItem value="OR">OR</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 조건 목록 */}
          {(draft.conditions ?? []).map((cond, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 0.5, mb: 0.5, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={cond.dataKey}
                  onChange={(e) => updateCondition(idx, 'dataKey', e.target.value)}
                  sx={{ fontSize: '0.78rem' }}>
                  {DATA_KEY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 60 }}>
                <Select value={cond.operator}
                  onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                  sx={{ fontSize: '0.78rem' }}>
                  {OPERATOR_OPTIONS.map((op) => <MenuItem key={op} value={op}>{OPERATOR_LABELS[op]}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" type="number" value={cond.value}
                onChange={(e) => updateCondition(idx, 'value', parseFloat(e.target.value) || 0)}
                sx={{ width: 80 }} InputProps={{ sx: { fontSize: '0.78rem' } }}
              />
              <Typography variant="caption" sx={{ color: '#888', minWidth: 30 }}>{cond.unit}</Typography>
              {(draft.conditions?.length ?? 0) > 1 && (
                <IconButton size="small" onClick={() => removeCondition(idx)}>
                  <DeleteIcon sx={{ fontSize: 14, color: '#999' }} />
                </IconButton>
              )}
            </Box>
          ))}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={addCondition} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              조건 추가
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={handleCancel} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              취소
            </Button>
            <Button size="small" variant="contained" onClick={handleSave}
              disabled={!draft.name || !(draft.conditions?.length)}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              저장
            </Button>
          </Box>
        </Box>
      )}

      {!editingId && (
        <Button
          fullWidth variant="outlined" startIcon={<AddIcon />}
          onClick={startNew} sx={{ mt: 1, textTransform: 'none' }}
        >
          사용자 시나리오 추가
        </Button>
      )}
    </Box>
  );
};

// ============================================================================
// Main Dialog
// ============================================================================

const AlarmSettingsDialog: React.FC<AlarmSettingsDialogProps> = ({
  open,
  onClose,
  scenarioConfig,
  onSave,
  nodeNames: _nodeNames,
}) => {
  const [localConfig, setLocalConfig] = useState<AlarmScenarioConfig>(scenarioConfig);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setLocalConfig(scenarioConfig);
      setTabIndex(0);
    }
  }, [open, scenarioConfig]);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    setLocalConfig((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((s) => s.id === id ? { ...s, enabled } : s),
    }));
  }, []);

  const thresholdScenarios = localConfig.scenarios.filter((s) => s.source === 'threshold');
  const customScenarios = localConfig.scenarios.filter((s) => s.source === 'custom');

  const handleThresholdUpdate = useCallback((updated: AlarmScenario[]) => {
    setLocalConfig((prev) => ({
      ...prev,
      scenarios: [
        ...prev.scenarios.filter((s) => s.source !== 'threshold'),
        ...updated,
      ],
    }));
  }, []);

  const handleCustomAdd = useCallback((scenario: AlarmScenario) => {
    setLocalConfig((prev) => ({
      ...prev,
      scenarios: [...prev.scenarios, scenario],
    }));
  }, []);

  const handleCustomDelete = useCallback((id: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      scenarios: prev.scenarios.filter((s) => s.id !== id),
    }));
  }, []);

  const handleCustomUpdate = useCallback((scenario: AlarmScenario) => {
    setLocalConfig((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((s) => s.id === scenario.id ? scenario : s),
    }));
  }, []);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', pb: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        알람 설정
        <FormControlLabel
          control={
            <Switch
              checked={localConfig.globalEnabled}
              onChange={(_, checked) => setLocalConfig((prev) => ({ ...prev, globalEnabled: checked }))}
              size="small"
            />
          }
          label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>알람 활성화</Typography>}
        />
      </DialogTitle>
      <DialogContent sx={{ px: 2, pt: 0 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 1, minHeight: 36 }}
          TabIndicatorProps={{ sx: { height: 2 } }}>
          <Tab label="시나리오" sx={{ textTransform: 'none', fontSize: '0.82rem', minHeight: 36, py: 0 }} />
          <Tab label="한계치" sx={{ textTransform: 'none', fontSize: '0.82rem', minHeight: 36, py: 0 }} />
          <Tab label="사용자 정의" sx={{ textTransform: 'none', fontSize: '0.82rem', minHeight: 36, py: 0 }} />
        </Tabs>

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ maxHeight: 450, overflow: 'auto' }}>
          {tabIndex === 0 && (
            <ScenarioListTab scenarios={localConfig.scenarios} onToggle={handleToggle} />
          )}
          {tabIndex === 1 && (
            <ThresholdTab scenarios={thresholdScenarios} onUpdate={handleThresholdUpdate} />
          )}
          {tabIndex === 2 && (
            <CustomScenarioTab
              scenarios={customScenarios}
              onAdd={handleCustomAdd}
              onDelete={handleCustomDelete}
              onUpdate={handleCustomUpdate}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none' }}>
          취소
        </Button>
        <Button onClick={handleSave} variant="contained" size="small" sx={{ textTransform: 'none' }}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(AlarmSettingsDialog);
