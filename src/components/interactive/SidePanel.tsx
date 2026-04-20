/**
 * SidePanel
 * 우측 아코디언 사이드 패널: Alarm Detail / System Dashboard / Control Input / Event Log
 */

import { memo, useState, useMemo, useEffect } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as CollapseIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { ActiveAlarm, SimulationValues, NodeWidgetConfig, ScenarioAlarmResult, EventLogEntry } from '@/types/interactive';
import type { Node } from 'reactflow';
import type { MARSNodeData, InteractiveInput } from '@/types/mars';
import { ControlMode, ICVType } from '@/stubs/mars/mars_service_mod06_pb';
import type { TripICVEntry, GeneralICVEntry } from '@/hooks/useICVPolling';

// ============================================================================
// Alarm Detail Section
// ============================================================================

interface AlarmDetailProps {
  scenarioResults: ScenarioAlarmResult[];
  selectedScenarioId: string | null;
}

const OPERATOR_DISPLAY: Record<string, string> = {
  '>': '>', '>=': '\u2265', '<': '<', '<=': '\u2264', '==': '=', '!=': '\u2260',
};

const AlarmDetailContent: React.FC<AlarmDetailProps> = ({ scenarioResults, selectedScenarioId }) => {
  // 선택된 시나리오 또는 전체
  const displayResults = selectedScenarioId
    ? scenarioResults.filter((r) => r.scenarioId === selectedScenarioId)
    : scenarioResults;

  if (displayResults.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem' }}>
        {selectedScenarioId ? '선택된 시나리오가 해제되었습니다.' : '활성 알람이 없습니다.'}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {displayResults.map((result) => (
        <Box key={result.scenarioId}>
          {/* 시나리오 헤더 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            {result.level === 'danger'
              ? <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />
              : <WarningIcon sx={{ fontSize: 14, color: '#ffa000' }} />
            }
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem', color: result.level === 'danger' ? '#c62828' : '#e65100' }}>
              {result.scenarioName}
            </Typography>
            <Chip
              label={result.level}
              size="small"
              sx={{
                height: 16, fontSize: '0.55rem', fontWeight: 600, ml: 'auto',
                backgroundColor: result.level === 'danger' ? '#ffebee' : '#fff8e1',
                color: result.level === 'danger' ? '#c62828' : '#f57f17',
              }}
            />
          </Box>

          {/* 트리거된 조건 상세 */}
          {result.triggeredConditions.map((tc, idx) => (
            <Box
              key={`${tc.conditionId}-${tc.nodeId}-${idx}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                pl: 1.5,
                py: 0.25,
                borderLeft: `2px solid ${result.level === 'danger' ? '#ffcdd2' : '#ffe082'}`,
                mb: 0.25,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'block' }}>
                  {tc.nodeName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem' }}>
                  {tc.dataKey}: <b>{tc.currentValue.toFixed(2)}</b>
                  {tc.unit ? ` ${tc.unit}` : ''}
                  {' '}({OPERATOR_DISPLAY[tc.operator] ?? tc.operator} {tc.thresholdValue}{tc.unit ? ` ${tc.unit}` : ''})
                </Typography>
              </Box>
            </Box>
          ))}
          <Divider sx={{ mt: 0.5 }} />
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// System Dashboard
// ============================================================================

interface SystemDashboardProps {
  nodes: Node<MARSNodeData>[];
  simulationValues: SimulationValues;
  widgetConfigs: Record<string, NodeWidgetConfig[]>;
  activeAlarms: ActiveAlarm[];
}

/** Raw → Display 변환 */
function rawToDisplay(value: number, unit?: string): number {
  if (unit === 'MPa') return value / 1e6;
  if (unit === '°C') return value - 273.15;
  return value;
}

/** 시계열 또는 단일값에서 현재 raw 값 추출 */
function extractCurrentRaw(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? undefined : n; }
  if (Array.isArray(val) && val.length > 0) return val[val.length - 1]?.value;
  return undefined;
}

interface KpiEntry { sum: number; count: number; }

const SystemDashboardContent: React.FC<SystemDashboardProps> = ({
  nodes,
  simulationValues,
  widgetConfigs,
  activeAlarms,
}) => {
  const kpi = useMemo(() => {
    const pressure: KpiEntry = { sum: 0, count: 0 };
    const temperature: KpiEntry = { sum: 0, count: 0 };
    let totalFlow = 0;
    let flowCount = 0;

    for (const [nodeId, configs] of Object.entries(widgetConfigs)) {
      const vals = simulationValues[nodeId];
      if (!vals) continue;

      for (const cfg of configs) {
        const raw = extractCurrentRaw(vals[cfg.dataKey]);
        if (raw === undefined) continue;

        if (cfg.dataKey === 'pressure') {
          pressure.sum += rawToDisplay(raw, cfg.unit);
          pressure.count++;
        } else if (cfg.dataKey === 'temperature') {
          temperature.sum += rawToDisplay(raw, cfg.unit);
          temperature.count++;
        } else if (cfg.dataKey === 'flowRate') {
          totalFlow += rawToDisplay(raw, cfg.unit);
          flowCount++;
        }
      }
    }

    return {
      avgPressure: pressure.count > 0 ? pressure.sum / pressure.count : null,
      avgTemperature: temperature.count > 0 ? temperature.sum / temperature.count : null,
      totalFlow: flowCount > 0 ? totalFlow : null,
    };
  }, [widgetConfigs, simulationValues]);

  const dangerCount = activeAlarms.filter((a) => a.level === 'danger').length;
  const warningCount = activeAlarms.filter((a) => a.level === 'warning').length;
  const normalCount = nodes.length - dangerCount - warningCount;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
        <KpiCard label="Avg Pressure" value={kpi.avgPressure} unit="MPa" precision={2} color="#1976d2" />
        <KpiCard label="Avg Temp" value={kpi.avgTemperature} unit="°C" precision={1} color="#d32f2f" />
        <KpiCard label="Total Flow" value={kpi.totalFlow} unit="kg/s" precision={1} color="#2e7d32" span={2} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip label={`Normal: ${normalCount}`} size="small"
          sx={{ height: 20, fontSize: '0.65rem', backgroundColor: '#e8f5e9', color: '#2e7d32' }} />
        {warningCount > 0 && (
          <Chip label={`Warning: ${warningCount}`} size="small"
            sx={{ height: 20, fontSize: '0.65rem', backgroundColor: '#fff8e1', color: '#f57f17' }} />
        )}
        {dangerCount > 0 && (
          <Chip label={`Danger: ${dangerCount}`} size="small"
            sx={{ height: 20, fontSize: '0.65rem', backgroundColor: '#ffebee', color: '#d32f2f' }} />
        )}
      </Box>
    </Box>
  );
};

interface KpiCardProps {
  label: string;
  value: number | null;
  unit: string;
  precision: number;
  color: string;
  span?: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, precision, color, span }) => (
  <Box
    sx={{
      p: 0.75, borderRadius: 1, border: '1px solid #e0e0e0',
      backgroundColor: '#fafafa', gridColumn: span ? `span ${span}` : undefined,
    }}
  >
    <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem', lineHeight: 1 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color, fontSize: '0.9rem' }}>
        {value !== null ? value.toFixed(precision) : '--'}
      </Typography>
      <Typography variant="caption" sx={{ color: '#999', fontSize: '0.6rem' }}>{unit}</Typography>
    </Box>
  </Box>
);

// ============================================================================
// Placeholder panels
// ============================================================================

// ============================================================================
// Trip Control Content
// ============================================================================

const CMODE_LABELS: Record<ControlMode, string> = {
  [ControlMode.CONTROL_MODE_UNSPECIFIED]: '---',
  [ControlMode.AUTOMATIC]: 'AUTO',
  [ControlMode.MANUAL_TRUE]: 'MAN(T)',
  [ControlMode.MANUAL_FALSE]: 'MAN(F)',
};

const CMODE_COLORS: Record<ControlMode, { bg: string; text: string }> = {
  [ControlMode.CONTROL_MODE_UNSPECIFIED]: { bg: '#f5f5f5', text: '#999' },
  [ControlMode.AUTOMATIC]: { bg: '#e3f2fd', text: '#1565c0' },
  [ControlMode.MANUAL_TRUE]: { bg: '#e8f5e9', text: '#2e7d32' },
  [ControlMode.MANUAL_FALSE]: { bg: '#fff3e0', text: '#e65100' },
};

interface TripControlContentProps {
  /** 런타임 ICV 매칭 결과 */
  tripEntries: TripICVEntry[];
  /** 설정된 trip interactiveInputs */
  tripInputs: InteractiveInput[];
  loading: boolean;
  error: string | null;
  simulationActive: boolean;
  onSetTripMode: (objectId: number, cmode: ControlMode) => Promise<void>;
}

const TripControlContent: React.FC<TripControlContentProps> = ({
  tripEntries,
  tripInputs,
  loading,
  error,
  simulationActive,
  onSetTripMode,
}) => {
  // 설정된 trip이 없는 경우
  if (tripInputs.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem' }}>
        설정된 Trip 제어 항목이 없습니다.
        <br />
        Global Settings &gt; Interactive Inputs에서 Trip을 추가하세요.
      </Typography>
    );
  }

  // interactiveInputs 기반으로 항상 카드 렌더링 (비활성 시 회색, 활성 시 ICV 데이터 오버레이)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {!simulationActive && (
        <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem', mb: 0.25 }}>
          시뮬레이션 실행 시 활성화됩니다
        </Typography>
      )}
      {simulationActive && loading && (
        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem', mb: 0.25 }}>
          ICV 데이터 로딩 중...
        </Typography>
      )}
      {simulationActive && error && (
        <Typography variant="caption" sx={{ color: '#d32f2f', fontSize: '0.65rem', mb: 0.25 }}>
          ICV 조회 오류: {error}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
        {tripInputs.map((input) => {
          const tripNum = typeof input.parameter === 'string'
            ? parseInt(input.parameter, 10)
            : input.parameter;

          // 런타임 ICV 매칭
          const matched = tripEntries.find((e) => e.tripNumber === tripNum);

          return (
            <TripInputCard
              key={input.cardNumber}
              input={input}
              tripNumber={tripNum}
              matchedEntry={matched ?? null}
              simulationActive={simulationActive}
              onSetMode={onSetTripMode}
            />
          );
        })}
      </Box>
    </Box>
  );
};

interface TripInputCardProps {
  /** 설정된 interactiveInput */
  input: InteractiveInput;
  /** 파싱된 trip 번호 */
  tripNumber: number;
  /** 런타임 ICV 매칭 결과 (없으면 null) */
  matchedEntry: TripICVEntry | null;
  /** 시뮬레이션 활성 여부 */
  simulationActive: boolean;
  onSetMode: (objectId: number, cmode: ControlMode) => Promise<void>;
}

const TripInputCard: React.FC<TripInputCardProps> = ({
  input,
  tripNumber,
  matchedEntry,
  simulationActive,
  onSetMode,
}) => {
  const displayName = input.comment || matchedEntry?.whatis || `Trip ${tripNumber}`;
  const isLive = simulationActive && matchedEntry !== null;
  const cmode = matchedEntry?.cmode ?? ControlMode.CONTROL_MODE_UNSPECIFIED;
  const colors = CMODE_COLORS[cmode];

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (!newMode || !matchedEntry) return;
    const modeMap: Record<string, ControlMode> = {
      auto: ControlMode.AUTOMATIC,
      manual_true: ControlMode.MANUAL_TRUE,
      manual_false: ControlMode.MANUAL_FALSE,
    };
    const target = modeMap[newMode];
    if (target !== undefined && target !== matchedEntry.cmode) {
      void onSetMode(matchedEntry.objectId, target);
    }
  };

  const currentModeValue =
    cmode === ControlMode.AUTOMATIC ? 'auto'
    : cmode === ControlMode.MANUAL_TRUE ? 'manual_true'
    : cmode === ControlMode.MANUAL_FALSE ? 'manual_false'
    : null;

  return (
    <Box
      sx={{
        p: 0.5, borderRadius: 1, border: '1px solid #e0e0e0',
        backgroundColor: isLive ? '#fff' : '#fafafa',
        opacity: simulationActive ? 1 : 0.6,
        minWidth: 0,
      }}
    >
      {/* 헤더: Trip 이름 + Trip 번호 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600, fontSize: '0.65rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
            color: isLive ? 'text.primary' : '#999',
          }}
          title={displayName}
        >
          {displayName}
        </Typography>
        <Chip
          label={`#${tripNumber}`}
          size="small"
          sx={{ height: 14, fontSize: '0.5rem', fontWeight: 600, backgroundColor: '#f5f5f5', ml: 0.25, flexShrink: 0 }}
        />
      </Box>

      {/* 모드 + 값 한 줄 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Chip
          label={isLive ? CMODE_LABELS[cmode] : '---'}
          size="small"
          sx={{
            height: 18, fontSize: '0.55rem', fontWeight: 700,
            backgroundColor: isLive ? colors.bg : '#f5f5f5',
            color: isLive ? colors.text : '#bbb',
          }}
        />
        <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.68rem', color: isLive ? 'text.primary' : '#ccc' }}>
          {isLive ? matchedEntry!.asis.toFixed(4) : '--'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {/* 3-way 토글: A / T / F */}
        <Box sx={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
          {(['auto', 'manual_true', 'manual_false'] as const).map((mode) => {
            const label = mode === 'auto' ? 'A' : mode === 'manual_true' ? 'T' : 'F';
            const isActive = isLive && currentModeValue === mode;
            const disabled = !isLive;
            return (
              <Box
                key={mode}
                onClick={disabled ? undefined : (e) => handleModeChange(e, mode)}
                sx={{
                  width: 18, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.55rem', fontWeight: 700,
                  borderRadius: 0.5,
                  cursor: disabled ? 'default' : 'pointer',
                  border: isActive ? '1.5px solid' : '1px solid',
                  borderColor: disabled ? '#e0e0e0'
                    : isActive ? (mode === 'auto' ? '#1565c0' : mode === 'manual_true' ? '#2e7d32' : '#e65100')
                    : '#ccc',
                  backgroundColor: disabled ? '#fafafa'
                    : isActive ? (mode === 'auto' ? '#e3f2fd' : mode === 'manual_true' ? '#e8f5e9' : '#fff3e0')
                    : '#fff',
                  color: disabled ? '#ddd'
                    : isActive ? (mode === 'auto' ? '#1565c0' : mode === 'manual_true' ? '#2e7d32' : '#e65100')
                    : '#999',
                  transition: 'all 0.15s',
                  ...(!disabled && {
                    '&:hover': { borderColor: mode === 'auto' ? '#1565c0' : mode === 'manual_true' ? '#2e7d32' : '#e65100' },
                  }),
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

// ============================================================================
// General ICV Control Content (Valve, Flow, Heater 등 비-Trip ICV)
// ============================================================================

/** ICVType → 표시 정보 매핑 */
const ICV_TYPE_DISPLAY: Record<number, { label: string; unit: string; color: string; convert: (v: number) => string }> = {
  [ICVType.VALVE]: { label: 'Valve', unit: '%', color: '#e65100', convert: (v) => (v * 100).toFixed(1) },
  [ICVType.FLOWF]: { label: 'Flow(L)', unit: 'kg/s', color: '#2e7d32', convert: (v) => v.toFixed(2) },
  [ICVType.FLOWG]: { label: 'Flow(G)', unit: 'kg/s', color: '#1565c0', convert: (v) => v.toFixed(2) },
  [ICVType.HEATER]: { label: 'Heater', unit: 'W', color: '#c62828', convert: (v) => v.toExponential(2) },
  [ICVType.REACTIVITY]: { label: 'Reactivity', unit: '$', color: '#6a1b9a', convert: (v) => v.toFixed(4) },
  [ICVType.CNTRLVAR]: { label: 'CtrlVar', unit: '', color: '#37474f', convert: (v) => v.toFixed(4) },
  [ICVType.TMDPV]: { label: 'TMDPV', unit: 'Pa', color: '#0277bd', convert: (v) => (v / 1e6).toFixed(3) },
};

const GENERAL_CMODE_LABELS: Record<ControlMode, string> = {
  [ControlMode.CONTROL_MODE_UNSPECIFIED]: '---',
  [ControlMode.AUTOMATIC]: 'A',
  [ControlMode.MANUAL_TRUE]: 'M',
  [ControlMode.MANUAL_FALSE]: 'M',
};

interface GeneralICVContentProps {
  entries: GeneralICVEntry[];
  simulationActive: boolean;
  onSetICVValue: (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => Promise<void>;
}

const GeneralICVContent: React.FC<GeneralICVContentProps> = ({
  entries,
  simulationActive,
  onSetICVValue,
}) => {
  if (entries.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Divider sx={{ my: 0.25 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', color: '#888' }}>
        Variables
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
        {entries.map((entry) => (
          <GeneralICVCard
            key={entry.objectId}
            entry={entry}
            simulationActive={simulationActive}
            onSetICVValue={onSetICVValue}
          />
        ))}
      </Box>
    </Box>
  );
};

interface GeneralICVCardProps {
  entry: GeneralICVEntry;
  simulationActive: boolean;
  onSetICVValue: (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => Promise<void>;
}

const GeneralICVCard: React.FC<GeneralICVCardProps> = ({
  entry,
  simulationActive,
  onSetICVValue,
}) => {
  const typeInfo = ICV_TYPE_DISPLAY[entry.ctype] ?? {
    label: `Type${entry.ctype}`, unit: '', color: '#666', convert: (v: number) => v.toFixed(4),
  };
  const isLive = simulationActive;
  const isAuto = entry.cmode === ControlMode.AUTOMATIC;
  const isManual = entry.cmode === ControlMode.MANUAL_TRUE || entry.cmode === ControlMode.MANUAL_FALSE;

  const handleToggleMode = () => {
    if (!isLive) return;
    const newMode = isAuto ? ControlMode.MANUAL_TRUE : ControlMode.AUTOMATIC;
    void onSetICVValue(entry.objectId, { cmode: newMode });
  };

  return (
    <Box
      sx={{
        p: 0.5, borderRadius: 1, border: '1px solid #e0e0e0',
        backgroundColor: isLive ? '#fff' : '#fafafa',
        opacity: simulationActive ? 1 : 0.6,
        minWidth: 0,
      }}
    >
      {/* 헤더: 이름 + 타입 뱃지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600, fontSize: '0.65rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
            color: isLive ? 'text.primary' : '#999',
          }}
          title={entry.whatis}
        >
          {entry.whatis || `ICV #${entry.objectId}`}
        </Typography>
        <Chip
          label={typeInfo.label}
          size="small"
          sx={{ height: 14, fontSize: '0.5rem', fontWeight: 600, backgroundColor: `${typeInfo.color}15`, color: typeInfo.color, ml: 0.25, flexShrink: 0 }}
        />
      </Box>

      {/* 현재값 + 모드 토글 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 0.25, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.68rem', color: isLive ? typeInfo.color : '#ccc' }}>
            {isLive ? typeInfo.convert(entry.asis) : '--'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.5rem' }}>
            {typeInfo.unit}
          </Typography>
        </Box>

        {/* Auto/Manual 토글 */}
        <Tooltip title={isAuto ? 'Auto → Manual' : 'Manual → Auto'} placement="top">
          <Box
            onClick={isLive ? handleToggleMode : undefined}
            sx={{
              width: 18, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.55rem', fontWeight: 700,
              borderRadius: 0.5,
              cursor: isLive ? 'pointer' : 'default',
              border: '1.5px solid',
              borderColor: !isLive ? '#e0e0e0' : isAuto ? '#1565c0' : '#e65100',
              backgroundColor: !isLive ? '#fafafa' : isAuto ? '#e3f2fd' : '#fff3e0',
              color: !isLive ? '#ddd' : isAuto ? '#1565c0' : '#e65100',
              transition: 'all 0.15s',
              flexShrink: 0,
              ...(isLive && { '&:hover': { opacity: 0.8 } }),
            }}
          >
            {isLive ? GENERAL_CMODE_LABELS[entry.cmode] : '-'}
          </Box>
        </Tooltip>
      </Box>

      {/* Target / Rate (Manual 모드일 때만 표시) */}
      {isLive && isManual && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
          <Typography variant="caption" sx={{ color: '#888', fontSize: '0.5rem' }}>
            T:{typeInfo.convert(entry.target)}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888', fontSize: '0.5rem' }}>
            R:{entry.rate.toExponential(1)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// Event Log Section
// ============================================================================

const EVENT_TYPE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  trip: { label: 'Trip', color: '#1565c0', bg: '#e3f2fd' },
  icv: { label: 'ICV', color: '#e65100', bg: '#fff3e0' },
  simulation: { label: 'SIM', color: '#2e7d32', bg: '#e8f5e9' },
};

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface EventLogContentProps {
  entries: EventLogEntry[];
}

const EventLogContent: React.FC<EventLogContentProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem' }}>
        조작 이력이 없습니다.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: 300, overflowY: 'auto' }}>
      {entries.map((entry) => {
        const style = EVENT_TYPE_STYLES[entry.type] ?? EVENT_TYPE_STYLES.simulation;
        return (
          <Box
            key={entry.id}
            sx={{
              display: 'flex', flexDirection: 'column', gap: 0,
              px: 0.5, py: 0.25,
              borderLeft: `2px solid ${style.color}`,
              '&:hover': { backgroundColor: '#fafafa' },
            }}
          >
            {/* 1행: 시간 + 타입뱃지 + 라벨 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#999', flexShrink: 0 }}>
                {formatLogTime(entry.timestamp)}
              </Typography>
              <Chip
                label={style.label}
                size="small"
                sx={{ height: 14, fontSize: '0.5rem', fontWeight: 700, backgroundColor: style.bg, color: style.color }}
              />
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                title={entry.label}
              >
                {entry.label}
              </Typography>
            </Box>
            {/* 2행: action + oldValue → newValue */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, pl: 5.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#666' }}>
                {entry.action}
                {entry.oldValue != null && entry.newValue != null && (
                  <>
                    {': '}
                    <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#999' }}>
                      {entry.oldValue}
                    </Box>
                    {' → '}
                    <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: style.color }}>
                      {entry.newValue}
                    </Box>
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ============================================================================
// Live Node Values Section
// ============================================================================

interface LiveNodeValuesContentProps {
  nodes: Node<MARSNodeData>[];
  simulationValues: SimulationValues;
  widgetConfigs: Record<string, NodeWidgetConfig[]>;
}

const DATAKEY_DISPLAY: Record<string, { label: string; unit: string; convert: (v: number) => number; precision: number; color: string }> = {
  pressure: { label: 'P', unit: 'MPa', convert: (v) => v / 1e6, precision: 3, color: '#1976d2' },
  temperature: { label: 'T', unit: '°C', convert: (v) => v - 273.15, precision: 1, color: '#d32f2f' },
  flowRate: { label: 'W', unit: 'kg/s', convert: (v) => v, precision: 1, color: '#2e7d32' },
  voidFraction: { label: 'VF', unit: '', convert: (v) => v, precision: 4, color: '#7b1fa2' },
  valvePosition: { label: 'Pos', unit: '%', convert: (v) => v, precision: 0, color: '#e65100' },
};

const LiveNodeValuesContent: React.FC<LiveNodeValuesContentProps> = ({
  nodes,
  simulationValues,
  widgetConfigs,
}) => {
  const nodeEntries = useMemo(() => {
    const entries: Array<{
      nodeId: string;
      nodeName: string;
      componentType: string;
      values: Array<{ dataKey: string; label: string; displayValue: string; unit: string; color: string }>;
    }> = [];

    // nodeId → node lookup
    const nodeMap = new Map<string, Node<MARSNodeData>>();
    for (const n of nodes) nodeMap.set(n.id, n);

    for (const [nodeId, configs] of Object.entries(widgetConfigs)) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const vals = simulationValues[nodeId];
      const nodeValues: typeof entries[0]['values'] = [];

      for (const cfg of configs) {
        if (cfg.dataKey === 'valveMode') continue; // 모드는 텍스트라 별도 처리
        const raw = extractCurrentRaw(vals?.[cfg.dataKey]);
        const display = DATAKEY_DISPLAY[cfg.dataKey];
        if (!display) continue;

        const displayValue = raw !== undefined
          ? display.convert(raw).toFixed(display.precision)
          : '--';

        nodeValues.push({
          dataKey: cfg.dataKey,
          label: display.label,
          displayValue,
          unit: display.unit,
          color: display.color,
        });
      }

      if (nodeValues.length > 0) {
        entries.push({
          nodeId,
          nodeName: node.data.componentName || node.data.componentId || nodeId,
          componentType: node.data.componentType,
          values: nodeValues,
        });
      }
    }

    // 이름순 정렬
    entries.sort((a, b) => a.nodeName.localeCompare(b.nodeName));
    return entries;
  }, [nodes, simulationValues, widgetConfigs]);

  if (nodeEntries.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem' }}>
        활성화된 위젯 노드가 없습니다.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {nodeEntries.map((entry) => (
        <Box
          key={entry.nodeId}
          sx={{
            p: 0.75, borderRadius: 1, border: '1px solid #e0e0e0',
            backgroundColor: '#fff',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
              }}
              title={entry.nodeName}
            >
              {entry.nodeName}
            </Typography>
            <Chip
              label={entry.componentType}
              size="small"
              sx={{ height: 14, fontSize: '0.5rem', backgroundColor: '#f0f0f0', color: '#999' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {entry.values.map((v) => (
              <Box key={v.dataKey} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                <Typography variant="caption" sx={{ color: v.color, fontWeight: 700, fontSize: '0.6rem' }}>
                  {v.label}:
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.7rem' }}>
                  {v.displayValue}
                </Typography>
                {v.unit && (
                  <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.55rem' }}>
                    {v.unit}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// SidePanel (Main Export)
// ============================================================================

export interface SidePanelProps {
  nodes: Node<MARSNodeData>[];
  simulationValues: SimulationValues;
  widgetConfigs: Record<string, NodeWidgetConfig[]>;
  activeAlarms: ActiveAlarm[];
  scenarioResults: ScenarioAlarmResult[];
  selectedScenarioId: string | null;
  /** Trip ICV 엔트리 (폴링 결과) */
  tripEntries?: TripICVEntry[];
  /** 전체 ICV 엔트리 (모든 타입) */
  allICVEntries?: GeneralICVEntry[];
  /** ICV 폴링 로딩 상태 */
  tripLoading?: boolean;
  /** ICV 폴링 에러 */
  tripError?: string | null;
  /** 시뮬레이션 활성 여부 */
  simulationActive?: boolean;
  /** interactiveInputs 중 trip 항목 */
  tripInputs?: InteractiveInput[];
  /** interactiveInputs 중 trip 항목 수 */
  tripInputCount?: number;
  /** Trip 모드 변경 콜백 */
  onSetTripMode?: (objectId: number, cmode: ControlMode) => Promise<void>;
  /** 일반 ICV 값 설정 콜백 */
  onSetICVValue?: (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => Promise<void>;
  /** 이벤트 로그 엔트리 목록 */
  eventLog?: EventLogEntry[];
}

const PANEL_WIDTH = 400;

const SidePanel: React.FC<SidePanelProps> = ({
  nodes,
  simulationValues,
  widgetConfigs,
  activeAlarms,
  scenarioResults,
  selectedScenarioId,
  tripEntries = [],
  allICVEntries = [],
  tripLoading = false,
  tripError = null,
  simulationActive = false,
  tripInputs = [],
  tripInputCount = 0,
  onSetTripMode,
  onSetICVValue,
  eventLog = [],
}) => {
  // 비-Trip ICV 엔트리 필터링
  const nonTripICVEntries = useMemo(
    () => allICVEntries.filter((e) => e.ctype !== ICVType.TRIP && e.ctype !== ICVType.ICV_TYPE_UNSPECIFIED),
    [allICVEntries],
  );
  const totalControlCount = tripInputCount + nonTripICVEntries.length;

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['alarms', 'dashboard', 'control', 'livevalues']);

  const alwaysExpandedPanels = ['control', 'livevalues'];

  const handleAccordionToggle = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    if (alwaysExpandedPanels.includes(panel)) return;
    setExpanded((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel),
    );
  };

  // 시나리오 선택 시 알람 아코디언 자동 펼침
  useEffect(() => {
    if (selectedScenarioId !== null && !expanded.includes('alarms')) {
      setExpanded((prev) => [...prev, 'alarms']);
    }
  }, [selectedScenarioId]);

  if (collapsed) {
    return (
      <Box
        sx={{
          width: 32, borderLeft: '1px solid #e0e0e0', backgroundColor: '#fafafa',
          display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5,
        }}
      >
        <Tooltip title="패널 펼치기" placement="left">
          <IconButton size="small" onClick={() => setCollapsed(false)} sx={{ p: 0.5 }}>
            <CollapseIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: PANEL_WIDTH, minWidth: PANEL_WIDTH,
        borderLeft: '1px solid #e0e0e0', backgroundColor: '#fafafa',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* 패널 헤더 */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1, py: 0.5, borderBottom: '1px solid #e0e0e0', minHeight: 32,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
          Panels
        </Typography>
        <Tooltip title="패널 접기" placement="left">
          <IconButton size="small" onClick={() => setCollapsed(true)} sx={{ p: 0.25 }}>
            <CollapseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 아코디언 목록 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Alarm Detail */}
        <Accordion
          expanded={expanded.includes('alarms')}
          onChange={handleAccordionToggle('alarms')}
          disableGutters elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ minHeight: 32, px: 1, '& .MuiAccordionSummary-content': { my: 0.25 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              Alarm Detail
            </Typography>
            {scenarioResults.length > 0 && (
              <Chip
                label={scenarioResults.length}
                size="small"
                sx={{ height: 16, fontSize: '0.55rem', ml: 0.5, backgroundColor: '#ffebee', color: '#c62828' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1, py: 0.5 }}>
            <AlarmDetailContent
              scenarioResults={scenarioResults}
              selectedScenarioId={selectedScenarioId}
            />
          </AccordionDetails>
        </Accordion>

        {/* System Dashboard */}
        <Accordion
          expanded={expanded.includes('dashboard')}
          onChange={handleAccordionToggle('dashboard')}
          disableGutters elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ minHeight: 32, px: 1, '& .MuiAccordionSummary-content': { my: 0.25 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              System Dashboard
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1, py: 0.5 }}>
            <SystemDashboardContent
              nodes={nodes}
              simulationValues={simulationValues}
              widgetConfigs={widgetConfigs}
              activeAlarms={activeAlarms}
            />
          </AccordionDetails>
        </Accordion>

        {/* Control Input */}
        <Accordion
          expanded={expanded.includes('control')}
          onChange={handleAccordionToggle('control')}
          disableGutters elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ minHeight: 32, px: 1, '& .MuiAccordionSummary-content': { my: 0.25 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              Control Input
            </Typography>
            {totalControlCount > 0 && (
              <Chip
                label={totalControlCount}
                size="small"
                sx={{
                  height: 16, fontSize: '0.55rem', ml: 0.5,
                  backgroundColor: simulationActive ? '#e3f2fd' : '#f5f5f5',
                  color: simulationActive ? '#1565c0' : '#999',
                }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1, py: 0.5 }}>
            <TripControlContent
              tripEntries={tripEntries}
              tripInputs={tripInputs}
              loading={tripLoading}
              error={tripError}
              simulationActive={simulationActive}
              onSetTripMode={onSetTripMode ?? (async () => {})}
            />
            <GeneralICVContent
              entries={nonTripICVEntries}
              simulationActive={simulationActive}
              onSetICVValue={onSetICVValue ?? (async () => {})}
            />
          </AccordionDetails>
        </Accordion>

        {/* Live Node Values */}
        <Accordion
          expanded={expanded.includes('livevalues')}
          onChange={handleAccordionToggle('livevalues')}
          disableGutters elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ minHeight: 32, px: 1, '& .MuiAccordionSummary-content': { my: 0.25 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              Live Values
            </Typography>
            {Object.keys(widgetConfigs).length > 0 && (
              <Chip
                label={Object.keys(widgetConfigs).length}
                size="small"
                sx={{ height: 16, fontSize: '0.55rem', ml: 0.5, backgroundColor: '#e3f2fd', color: '#1565c0' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1, py: 0.5 }}>
            <LiveNodeValuesContent
              nodes={nodes}
              simulationValues={simulationValues}
              widgetConfigs={widgetConfigs}
            />
          </AccordionDetails>
        </Accordion>

        {/* Event Log */}
        <Accordion
          expanded={expanded.includes('eventlog')}
          onChange={handleAccordionToggle('eventlog')}
          disableGutters elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{ minHeight: 32, px: 1, '& .MuiAccordionSummary-content': { my: 0.25 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              Event Log
            </Typography>
            {eventLog.length > 0 && (
              <Chip
                label={eventLog.length}
                size="small"
                sx={{ height: 16, fontSize: '0.55rem', ml: 0.5, backgroundColor: '#e8f5e9', color: '#2e7d32' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1, py: 0.5 }}>
            <EventLogContent entries={eventLog} />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};

export default memo(SidePanel);
