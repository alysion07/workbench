/**
 * AlarmDashboard
 * 알람 전용 탭 — 활성 알람 요약 + threshold 그래프 + 시나리오 설정
 */

import { memo, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Switch,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircleOutline as OkIcon,
  ExpandMore as ExpandIcon,
  Lock as LockIcon,
  NotificationsActive as AlarmIcon,
  NotificationsOff as AlarmOffIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ScenarioAlarmResult, AlarmScenarioConfig, AlarmScenario } from '@/types/interactive';
import type { PlotData } from '@/types/simulation';
import type { MinorEdit } from '@/types/mars';

// ============================================================================
// Types & Constants
// ============================================================================

interface AlarmDashboardProps {
  scenarioResults: ScenarioAlarmResult[];
  scenarioConfig: AlarmScenarioConfig;
  onScenarioConfigChange: (config: AlarmScenarioConfig) => void;
  plotData: PlotData[];
  minorEdits: MinorEdit[];
}

const OPERATOR_DISPLAY: Record<string, string> = {
  '>': '>', '>=': '\u2265', '<': '<', '<=': '\u2264', '==': '=', '!=': '\u2260',
};

/** 차트에 표시할 변수 타입 탭 */
interface VariableTabConfig {
  type: string;
  label: string;
  unit: string;
  alarmKey: string;
  alarmUnit: string;
  factor?: number;   // 알람 단위 → 차트 단위 변환 계수 (알람값 / factor = 차트값)
  offset?: number;   // 알람 단위 → 차트 단위 오프셋 (알람값 - offset = 차트값)
}

const VARIABLE_TABS: VariableTabConfig[] = [
  { type: 'p', label: '압력 (P)', unit: 'Pa', alarmKey: 'pressure', alarmUnit: 'MPa', factor: 1e-6 },
  { type: 'tempf', label: '온도 (T)', unit: 'K', alarmKey: 'temperature', alarmUnit: '°C', offset: -273.15 },
  { type: 'mflowj', label: '유량 (W)', unit: 'kg/s', alarmKey: 'flowRate', alarmUnit: 'kg/s' },
  { type: 'rktpow', label: '출력 (Power)', unit: 'W', alarmKey: 'reactorPower', alarmUnit: 'W' },
];

/** Y축 값 포맷 */
function formatYValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toPrecision(3)}G`;
  if (abs >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toPrecision(3)}k`;
  if (abs >= 1) return value.toPrecision(3);
  if (abs === 0) return '0';
  return value.toPrecision(2);
}

// ============================================================================
// Active Alarms Panel
// ============================================================================

const ActiveAlarmsPanel: React.FC<{
  scenarioResults: ScenarioAlarmResult[];
}> = ({ scenarioResults }) => {
  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    return scenarioResults
      .filter((r) => {
        if (seen.has(r.scenarioId)) return false;
        seen.add(r.scenarioId);
        return true;
      })
      .sort((a, b) => (a.level === 'danger' ? -1 : 1) - (b.level === 'danger' ? -1 : 1));
  }, [scenarioResults]);

  if (uniqueResults.length === 0) {
    return (
      <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, backgroundColor: '#e8f5e9', border: '1px solid #c8e6c9' }}>
        <OkIcon sx={{ color: '#4caf50', fontSize: 28 }} />
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32' }}>
            알람 없음
          </Typography>
          <Typography variant="caption" sx={{ color: '#558b2f' }}>
            모든 관측값이 정상 범위 내에 있습니다
          </Typography>
        </Box>
      </Paper>
    );
  }

  const dangerCount = uniqueResults.filter((r) => r.level === 'danger').length;
  const warningCount = uniqueResults.filter((r) => r.level === 'warning').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* 요약 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <AlarmIcon sx={{ fontSize: 22, color: dangerCount > 0 ? '#d32f2f' : '#f57c00' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          활성 알람
        </Typography>
        {dangerCount > 0 && (
          <Chip icon={<ErrorIcon sx={{ fontSize: 14 }} />} label={`Danger ${dangerCount}`} size="small"
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#d32f2f', color: '#fff', '& .MuiChip-icon': { color: '#fff' } }} />
        )}
        {warningCount > 0 && (
          <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label={`Warning ${warningCount}`} size="small"
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#f57c00', color: '#fff', '& .MuiChip-icon': { color: '#fff' } }} />
        )}
      </Box>

      {/* 시나리오 카드 그리드 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
        {uniqueResults.map((r) => {
          const isDanger = r.level === 'danger';
          return (
            <Paper
              key={r.scenarioId}
              elevation={0}
              sx={{
                p: 1.5,
                border: `1.5px solid ${isDanger ? '#ef9a9a' : '#ffcc80'}`,
                backgroundColor: isDanger ? '#fff5f5' : '#fffde7',
                borderRadius: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                {isDanger ? <ErrorIcon sx={{ fontSize: 18, color: '#d32f2f' }} /> : <WarningIcon sx={{ fontSize: 18, color: '#f57c00' }} />}
                <Typography variant="body2" sx={{ fontWeight: 700, color: isDanger ? '#b71c1c' : '#e65100', flex: 1 }}>
                  {r.scenarioNameKo ?? r.scenarioName}
                </Typography>
                <Chip label={r.level.toUpperCase()} size="small"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: isDanger ? '#d32f2f' : '#f57c00', color: '#fff' }} />
              </Box>
              {r.triggeredConditions.map((tc, idx) => (
                <Box key={`${tc.conditionId}-${tc.nodeId}-${idx}`}
                  sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, pl: 1, py: 0.25, borderLeft: `2px solid ${isDanger ? '#ef9a9a' : '#ffcc80'}`, mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#555', minWidth: 80 }}>
                    {tc.nodeName}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#777' }}>
                    {tc.dataKey}:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.72rem', color: isDanger ? '#c62828' : '#e65100' }}>
                    {tc.currentValue.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#999' }}>
                    {OPERATOR_DISPLAY[tc.operator] ?? tc.operator} {tc.thresholdValue} {tc.unit}
                  </Typography>
                </Box>
              ))}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

// ============================================================================
// Threshold Graph Panel
// ============================================================================

const ThresholdGraphPanel: React.FC<{
  plotData: PlotData[];
  minorEdits: MinorEdit[];
  scenarioConfig: AlarmScenarioConfig;
}> = ({ plotData, minorEdits, scenarioConfig }) => {
  const [activeTab, setActiveTab] = useState(0);

  // 현재 탭의 변수 타입에 해당하는 Minor Edit 데이터 키 추출
  const tabConfig = VARIABLE_TABS[activeTab];

  const chartDataKeys = useMemo(() => {
    if (!tabConfig) return [];
    const sorted = [...minorEdits].sort((a, b) => a.cardNumber - b.cardNumber);
    return sorted
      .map((edit, index) => ({ edit, index }))
      .filter(({ edit }) => edit.variableType === tabConfig.type)
      .map(({ edit, index }) => {
        let dataKey: string;
        if (edit.variableType === 'rktpow' || edit.variableType === 'time') {
          dataKey = `v${index}`;
        } else {
          dataKey = `v${index}`;
        }
        const label = edit.comment || `${tabConfig.label} (${edit.parameter})`;
        return { dataKey, label, parameter: edit.parameter };
      });
  }, [minorEdits, tabConfig]);

  // threshold 라인 값 추출 (시나리오 조건에서)
  const thresholdLines = useMemo(() => {
    if (!tabConfig) return [];
    const lines: Array<{ value: number; level: 'warning' | 'danger'; label: string }> = [];

    for (const scenario of scenarioConfig.scenarios) {
      if (!scenario.enabled) continue;
      for (const cond of scenario.conditions) {
        if (cond.dataKey === tabConfig.alarmKey) {
          // 알람 단위 → 차트 단위 변환
          let chartValue = cond.value;
          if (tabConfig.factor) chartValue = cond.value / tabConfig.factor;
          if (tabConfig.offset) chartValue = cond.value - (tabConfig.offset ?? 0);

          const opLabel = OPERATOR_DISPLAY[cond.operator] ?? cond.operator;
          lines.push({
            value: chartValue,
            level: scenario.level as 'warning' | 'danger',
            label: `${scenario.nameKo ?? scenario.name} (${opLabel}${cond.value} ${cond.unit ?? ''})`,
          });
        }
      }
    }

    // 중복 제거 (같은 값)
    const seen = new Set<string>();
    return lines.filter((l) => {
      const key = `${l.value}-${l.level}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [scenarioConfig, tabConfig]);

  const hasData = plotData.length > 0 && chartDataKeys.length > 0;

  // 색상 팔레트
  const colors = ['#1976d2', '#d32f2f', '#2e7d32', '#7b1fa2', '#00838f', '#e65100'];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Threshold 그래프
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1.5, minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0, fontSize: '0.8rem', textTransform: 'none' } }}
      >
        {VARIABLE_TABS.map((tab) => {
          const hasEdits = minorEdits.some((e) => e.variableType === tab.type);
          return <Tab key={tab.type} label={tab.label} disabled={!hasEdits} />;
        })}
      </Tabs>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          border: '1px solid #e0e0e0',
          borderRadius: 1.5,
          height: 340,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!hasData ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'text.secondary' }}>
            <Typography variant="body2">
              {plotData.length === 0
                ? '시뮬레이션 데이터가 없습니다. 시뮬레이션을 실행하거나 데모 모드를 켜세요.'
                : `${tabConfig?.label ?? ''} 타입의 Minor Edit가 설정되지 않았습니다.`}
            </Typography>
          </Box>
        ) : (
          <>
            {/* 범례 */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
              {chartDataKeys.map((dk, idx) => (
                <Box key={dk.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 3, backgroundColor: colors[idx % colors.length], borderRadius: 1 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#555' }}>{dk.label}</Typography>
                </Box>
              ))}
              {thresholdLines.map((tl, idx) => (
                <Box key={`tl-${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{
                    width: 16, height: 0,
                    borderTop: tl.level === 'danger' ? '2px solid #d32f2f' : '2px dashed #f57c00',
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: tl.level === 'danger' ? '#c62828' : '#e65100' }}>
                    {tl.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* 차트 */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={plotData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={formatYValue}
                    width={60}
                    fontSize={11}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => formatYValue(value)}
                    labelFormatter={(v) => `Time: ${Number(v).toFixed(2)}s`}
                  />
                  {chartDataKeys.map((dk, idx) => (
                    <Line
                      key={dk.dataKey}
                      type="monotone"
                      dataKey={dk.dataKey}
                      name={dk.label}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {/* Threshold 수평선 */}
                  {thresholdLines.map((tl, idx) => (
                    <ReferenceLine
                      key={`ref-${idx}`}
                      y={tl.value}
                      stroke={tl.level === 'danger' ? '#d32f2f' : '#f57c00'}
                      strokeWidth={tl.level === 'danger' ? 2 : 1.5}
                      strokeDasharray={tl.level === 'danger' ? undefined : '6 3'}
                      label={{
                        value: `${tl.level === 'danger' ? 'D' : 'W'} ${formatYValue(tl.value)}`,
                        position: 'right',
                        fill: tl.level === 'danger' ? '#d32f2f' : '#f57c00',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

// ============================================================================
// Scenario Settings Panel
// ============================================================================

const ScenarioSettingsPanel: React.FC<{
  scenarioConfig: AlarmScenarioConfig;
  onConfigChange: (config: AlarmScenarioConfig) => void;
}> = ({ scenarioConfig, onConfigChange }) => {
  const handleGlobalToggle = useCallback((enabled: boolean) => {
    onConfigChange({ ...scenarioConfig, globalEnabled: enabled });
  }, [scenarioConfig, onConfigChange]);

  const handleToggleScenario = useCallback((id: string, enabled: boolean) => {
    onConfigChange({
      ...scenarioConfig,
      scenarios: scenarioConfig.scenarios.map((s) => s.id === id ? { ...s, enabled } : s),
    });
  }, [scenarioConfig, onConfigChange]);

  const grouped = useMemo(() => {
    const predefined = scenarioConfig.scenarios.filter((s) => s.source === 'predefined');
    const threshold = scenarioConfig.scenarios.filter((s) => s.source === 'threshold');
    const custom = scenarioConfig.scenarios.filter((s) => s.source === 'custom');
    return { predefined, threshold, custom };
  }, [scenarioConfig.scenarios]);

  const renderScenarioRow = (s: AlarmScenario) => {
    const isDanger = s.level === 'danger';
    return (
      <Box
        key={s.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.75,
          px: 1,
          borderRadius: 1,
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' },
        }}
      >
        {s.source === 'predefined' && <LockIcon sx={{ fontSize: 12, color: '#bbb' }} />}
        <Chip
          icon={isDanger ? <ErrorIcon sx={{ fontSize: 11 }} /> : <WarningIcon sx={{ fontSize: 11 }} />}
          label={isDanger ? 'D' : 'W'}
          size="small"
          sx={{
            height: 18, width: 36, fontSize: '0.6rem', fontWeight: 700,
            backgroundColor: isDanger ? '#ffebee' : '#fff8e1',
            color: isDanger ? '#c62828' : '#f57f17',
            '& .MuiChip-icon': { color: isDanger ? '#c62828' : '#f57f17' },
            '& .MuiChip-label': { px: 0.25 },
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.78rem', display: 'block' }}>
            {s.nameKo ?? s.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem' }}>
            {s.conditions.map((c) => `${c.dataKey} ${OPERATOR_DISPLAY[c.operator] ?? c.operator} ${c.value}${c.unit ? ` ${c.unit}` : ''}`).join(` ${s.logic} `)}
          </Typography>
        </Box>
        <Switch
          checked={s.enabled}
          onChange={(_, checked) => handleToggleScenario(s.id, checked)}
          size="small"
        />
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          알람 시나리오 설정
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {scenarioConfig.globalEnabled
            ? <AlarmIcon sx={{ fontSize: 16, color: '#4caf50' }} />
            : <AlarmOffIcon sx={{ fontSize: 16, color: '#999' }} />}
          <Typography variant="caption" sx={{ color: scenarioConfig.globalEnabled ? '#4caf50' : '#999', fontWeight: 600 }}>
            {scenarioConfig.globalEnabled ? '활성' : '비활성'}
          </Typography>
          <Switch
            checked={scenarioConfig.globalEnabled}
            onChange={(_, checked) => handleGlobalToggle(checked)}
            size="small"
          />
        </Box>
      </Box>

      {grouped.predefined.length > 0 && (
        <Accordion disableGutters elevation={0} defaultExpanded sx={{ border: '1px solid #e0e0e0', '&:before': { display: 'none' }, mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
              사전정의 ({grouped.predefined.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 0.5 }}>
            {grouped.predefined.map(renderScenarioRow)}
          </AccordionDetails>
        </Accordion>
      )}

      {grouped.threshold.length > 0 && (
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', '&:before': { display: 'none' }, mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
              한계치 ({grouped.threshold.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 0.5 }}>
            {grouped.threshold.map(renderScenarioRow)}
          </AccordionDetails>
        </Accordion>
      )}

      {grouped.custom.length > 0 && (
        <Accordion disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
              사용자 정의 ({grouped.custom.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 0.5 }}>
            {grouped.custom.map(renderScenarioRow)}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

// ============================================================================
// Main Dashboard
// ============================================================================

const AlarmDashboard: React.FC<AlarmDashboardProps> = ({
  scenarioResults,
  scenarioConfig,
  onScenarioConfigChange,
  plotData,
  minorEdits,
}) => {
  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* 활성 알람 */}
      <ActiveAlarmsPanel scenarioResults={scenarioResults} />

      {/* Threshold 그래프 */}
      <ThresholdGraphPanel
        plotData={plotData}
        minorEdits={minorEdits}
        scenarioConfig={scenarioConfig}
      />

      {/* 시나리오 설정 */}
      <ScenarioSettingsPanel
        scenarioConfig={scenarioConfig}
        onConfigChange={onScenarioConfigChange}
      />
    </Box>
  );
};

export default memo(AlarmDashboard);
