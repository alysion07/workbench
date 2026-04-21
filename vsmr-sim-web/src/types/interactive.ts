/**
 * Interactive Node Widget Types
 * Phase 0: SimulationPage "Interaction Control" 탭용 위젯 시스템
 */

import { Position } from 'reactflow';

// ============================================================================
// Widget Configuration
// ============================================================================

export type WidgetPosition = 'top' | 'bottom' | 'left' | 'right';

export type WidgetType = 'numeric-label' | 'auto-manual-toggle' | 'mini-chart';

export interface NodeWidgetConfig {
  id: string;                     // unique ID: "nodeId-dataKey"
  type: WidgetType;
  position: WidgetPosition;
  label: string;                  // "P", "T", "Mode"
  dataKey: string;                // "pressure", "temperature", "valveMode"
  unit?: string;                  // "MPa", "K"
  precision?: number;             // decimal places (default: 2)
  visible?: boolean;              // default: true
  chartColor?: string;            // mini-chart line color (default: '#2196F3')
  nodeName?: string;              // 소속 컴포넌트 이름 (ex. "rcp-1")
  nodeDisplayId?: string;         // 약식 ID (ex. "C181")
}

// ============================================================================
// Time Series (mini-chart)
// ============================================================================

export interface TimeSeriesPoint {
  time: number;
  value: number;
}

// ============================================================================
// Simulation Values
// ============================================================================

/** nodeId → { dataKey → value } */
export type SimulationValues = Record<string, Record<string, number | string | TimeSeriesPoint[]>>;

// ============================================================================
// Widget Customization (per-node overrides)
// ============================================================================

export interface WidgetOverride {
  visible?: boolean;        // false면 해당 위젯 숨김
  position?: WidgetPosition; // 기본 위치 (드래그 전 초기 방향)
  offsetX?: number;         // 노드 중심 기준 X 오프셋 (px)
  offsetY?: number;         // 노드 중심 기준 Y 오프셋 (px)
  width?: number;           // 커스텀 너비 (px, mini-chart용)
  height?: number;          // 커스텀 높이 (px, mini-chart용)
  pinned?: boolean;         // 줌아웃 시 Full Widget 유지 (HUD 모드)
  locked?: boolean;         // 이동+리사이즈 잠금
}

/** nodeId → dataKey → override */
export type NodeWidgetOverrides = Record<string, Record<string, WidgetOverride>>;

/** 컴포넌트 타입별 가용 위젯 정의 */
export interface AvailableWidget {
  dataKey: string;
  label: string;
  unit?: string;
  defaultPosition: WidgetPosition;
  chartColor?: string;
}

/** 컴포넌트 타입별 가용 위젯 목록 반환 */
export function getAvailableWidgets(componentType: string, valveSubType?: string): AvailableWidget[] {
  switch (componentType) {
    case 'snglvol':
    case 'tmdpvol':
    case 'branch':
    case 'pump':
    case 'turbine':
      return [
        { dataKey: 'pressure', label: 'P', unit: 'MPa', defaultPosition: 'top', chartColor: '#1976d2' },
        { dataKey: 'temperature', label: 'T', unit: 'K', defaultPosition: 'bottom', chartColor: '#d32f2f' },
      ];
    case 'pipe':
      return [
        { dataKey: 'pressure', label: 'P', unit: 'MPa', defaultPosition: 'top', chartColor: '#1976d2' },
      ];
    case 'sngljun':
    case 'tmdpjun':
    case 'mtpljun':
      return [
        { dataKey: 'flowRate', label: 'W', unit: 'kg/s', defaultPosition: 'bottom', chartColor: '#2e7d32' },
      ];
    case 'valve': {
      const sub = valveSubType ?? 'trpvlv';
      if (sub === 'trpvlv') {
        return [
          { dataKey: 'valveMode', label: 'Mode', defaultPosition: 'bottom' },
        ];
      }
      return [
        { dataKey: 'valvePosition', label: 'Pos', unit: '%', defaultPosition: 'bottom', chartColor: '#7b1fa2' },
      ];
    }
    case 'htstr':
      return [
        { dataKey: 'temperature', label: 'T', unit: 'K', defaultPosition: 'top', chartColor: '#d32f2f' },
      ];
    case 'tank':
      return [
        { dataKey: 'pressure', label: 'P', unit: 'MPa', defaultPosition: 'top', chartColor: '#1976d2' },
        { dataKey: 'temperature', label: 'T', unit: 'K', defaultPosition: 'bottom', chartColor: '#d32f2f' },
      ];
    case 'separatr':
      return [
        { dataKey: 'pressure', label: 'P', unit: 'MPa', defaultPosition: 'top', chartColor: '#1976d2' },
        { dataKey: 'temperature', label: 'T', unit: 'K', defaultPosition: 'bottom', chartColor: '#d32f2f' },
      ];
    default:
      return [];
  }
}

/** 기본 위젯 configs에 사용자 오버라이드를 적용 */
export function applyWidgetOverrides(
  configs: Record<string, NodeWidgetConfig[]>,
  overrides: NodeWidgetOverrides,
): Record<string, NodeWidgetConfig[]> {
  const result: Record<string, NodeWidgetConfig[]> = {};

  for (const [nodeId, widgets] of Object.entries(configs)) {
    const nodeOverrides = overrides[nodeId];
    if (!nodeOverrides) {
      result[nodeId] = widgets;
      continue;
    }

    result[nodeId] = widgets.map((w) => {
      const override = nodeOverrides[w.dataKey];
      if (!override) return w;
      return {
        ...w,
        visible: override.visible ?? w.visible,
        position: override.position ?? w.position,
      };
    });
  }

  return result;
}

// ============================================================================
// Alarm / Warning System
// ============================================================================

export type AlarmLevel = 'normal' | 'warning' | 'danger';

export interface AlarmThreshold {
  warningHigh?: number;   // display 단위 상한
  warningLow?: number;    // display 단위 하한
  dangerHigh?: number;
  dangerLow?: number;
}

/** dataKey → 한계치 */
export type AlarmThresholds = Record<string, AlarmThreshold>;

export interface ActiveAlarm {
  nodeId: string;
  nodeName: string;
  dataKey: string;
  label: string;
  unit?: string;
  level: AlarmLevel;
  currentValue: number;   // display 단위
  threshold: number;      // 초과한 한계치 (display 단위)
  scenarioId?: string;
  scenarioName?: string;
  scenarioSource?: ScenarioSource;
}

// ============================================================================
// Scenario-Based Alarm System
// ============================================================================

export type ComparisonOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';
export type ConditionLogic = 'AND' | 'OR';
export type ScenarioSource = 'predefined' | 'threshold' | 'custom';

export type ConditionScope =
  | { type: 'all' }
  | { type: 'any' }
  | { type: 'specific'; nodeIds: string[] };

export interface AlarmCondition {
  id: string;
  dataKey: string;
  operator: ComparisonOperator;
  value: number;                 // display 단위 (MPa, °C, kg/s, %)
  unit?: string;
  scope: ConditionScope;
}

export interface AlarmScenario {
  id: string;
  name: string;
  nameKo?: string;
  description?: string;
  source: ScenarioSource;
  level: AlarmLevel;
  conditions: AlarmCondition[];
  logic: ConditionLogic;
  enabled: boolean;
  priority: number;              // 낮을수록 우선
}

export type PredefinedScenarioId =
  | 'LOCA'
  | 'SGTR'
  | 'OVERPRESSURE_WARNING'
  | 'OVERPRESSURE_DANGER'
  | 'OVERCOOLING'
  | 'CORE_DAMAGE'
  | 'PUMP_FAILURE'
  | 'VALVE_MALFUNCTION';

export interface ScenarioAlarmResult {
  scenarioId: string;
  scenarioName: string;
  scenarioNameKo?: string;
  level: AlarmLevel;
  source: ScenarioSource;
  triggeredConditions: TriggeredCondition[];
}

export interface TriggeredCondition {
  conditionId: string;
  nodeId: string;
  nodeName: string;
  dataKey: string;
  currentValue: number;
  thresholdValue: number;
  operator: ComparisonOperator;
  unit?: string;
}

export interface AlarmScenarioConfig {
  scenarios: AlarmScenario[];
  globalEnabled: boolean;
}

// ============================================================================
// Event Log
// ============================================================================

export type EventLogType = 'trip' | 'icv' | 'simulation';

export interface EventLogEntry {
  id: string;
  timestamp: number;
  type: EventLogType;
  label: string;
  action: string;
  oldValue?: string;
  newValue?: string;
}

// ============================================================================
// Helpers
// ============================================================================

export function widgetPositionToRFPosition(pos: WidgetPosition): Position {
  switch (pos) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
  }
}

/** Group widget configs by position */
export function groupWidgetsByPosition(
  configs: NodeWidgetConfig[],
): Record<WidgetPosition, NodeWidgetConfig[]> {
  const grouped: Record<WidgetPosition, NodeWidgetConfig[]> = {
    top: [], bottom: [], left: [], right: [],
  };
  for (const c of configs) {
    grouped[c.position].push(c);
  }
  return grouped;
}
