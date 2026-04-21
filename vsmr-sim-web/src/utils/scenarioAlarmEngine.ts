/**
 * 시나리오 기반 알람 평가 엔진
 */

import type {
  AlarmScenario,
  AlarmScenarioConfig,
  AlarmCondition,
  AlarmLevel,
  ScenarioAlarmResult,
  TriggeredCondition,
  ActiveAlarm,
  SimulationValues,
  NodeWidgetConfig,
  TimeSeriesPoint,
  AlarmThresholds,
  ComparisonOperator,
} from '@/types/interactive';
import { rawToDisplay } from './alarmUtils';
import { createPredefinedScenarios } from './predefinedScenarios';

// ============================================================================
// Condition Evaluation
// ============================================================================

/** Raw 값 추출 */
function extractRaw(val: number | string | TimeSeriesPoint[] | undefined): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
  }
  if (Array.isArray(val) && val.length > 0) return val[val.length - 1].value;
  return undefined;
}

/** 비교 연산 */
function compare(left: number, op: ComparisonOperator, right: number): boolean {
  switch (op) {
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '==': return Math.abs(left - right) < 1e-9;
    case '!=': return Math.abs(left - right) >= 1e-9;
  }
}

/** dataKey에 해당하는 unit 조회 (위젯 configs에서) */
function findUnitForDataKey(
  dataKey: string,
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
): string | undefined {
  for (const configs of Object.values(widgetConfigs)) {
    for (const c of configs) {
      if (c.dataKey === dataKey && c.unit) return c.unit;
    }
  }
  return undefined;
}

interface ConditionMatch {
  nodeId: string;
  currentValue: number; // display 단위
}

/** 단일 조건 평가: 어떤 노드들이 조건을 만족하는지 반환 */
function evaluateCondition(
  condition: AlarmCondition,
  simulationValues: SimulationValues,
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
): ConditionMatch[] {
  const matches: ConditionMatch[] = [];
  const unit = condition.unit ?? findUnitForDataKey(condition.dataKey, widgetConfigs);

  // 대상 노드 결정
  let targetNodeIds: string[];
  if (condition.scope.type === 'specific') {
    targetNodeIds = condition.scope.nodeIds;
  } else {
    // 'any' 또는 'all': 해당 dataKey를 가진 모든 노드
    targetNodeIds = Object.keys(widgetConfigs).filter((nodeId) =>
      widgetConfigs[nodeId]?.some((c) => c.dataKey === condition.dataKey),
    );
  }

  for (const nodeId of targetNodeIds) {
    const nodeValues = simulationValues[nodeId];
    if (!nodeValues) continue;

    const rawVal = extractRaw(nodeValues[condition.dataKey]);
    if (rawVal === undefined) continue;

    const displayValue = rawToDisplay(rawVal, unit);
    if (compare(displayValue, condition.operator, condition.value)) {
      matches.push({ nodeId, currentValue: displayValue });
    }
  }

  // scope 'all' 체크: 모든 대상 노드가 만족해야 함
  if (condition.scope.type === 'all') {
    if (matches.length < targetNodeIds.length) return [];
  }

  return matches;
}

// ============================================================================
// Scenario Evaluation
// ============================================================================

/** 단일 시나리오 평가 */
function evaluateScenario(
  scenario: AlarmScenario,
  simulationValues: SimulationValues,
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
  nodeNames: Record<string, string>,
): ScenarioAlarmResult | null {
  if (!scenario.enabled || scenario.conditions.length === 0) return null;

  const conditionResults = scenario.conditions.map((cond) => ({
    condition: cond,
    matches: evaluateCondition(cond, simulationValues, widgetConfigs),
  }));

  let triggered: boolean;
  if (scenario.logic === 'AND') {
    triggered = conditionResults.every((r) => r.matches.length > 0);
  } else {
    triggered = conditionResults.some((r) => r.matches.length > 0);
  }

  if (!triggered) return null;

  const triggeredConditions: TriggeredCondition[] = [];
  for (const { condition, matches } of conditionResults) {
    if (matches.length === 0) continue;
    for (const m of matches) {
      triggeredConditions.push({
        conditionId: condition.id,
        nodeId: m.nodeId,
        nodeName: nodeNames[m.nodeId] ?? m.nodeId,
        dataKey: condition.dataKey,
        currentValue: m.currentValue,
        thresholdValue: condition.value,
        operator: condition.operator,
        unit: condition.unit,
      });
    }
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.nameKo ?? scenario.name,
    scenarioNameKo: scenario.nameKo,
    level: scenario.level,
    source: scenario.source,
    triggeredConditions,
  };
}

/** 전체 시나리오 평가 */
export function evaluateAllScenarios(
  config: AlarmScenarioConfig,
  simulationValues: SimulationValues,
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
  nodeNames: Record<string, string>,
): ScenarioAlarmResult[] {
  if (!config.globalEnabled) return [];

  const results: ScenarioAlarmResult[] = [];
  const sorted = [...config.scenarios].sort((a, b) => a.priority - b.priority);

  for (const scenario of sorted) {
    const result = evaluateScenario(scenario, simulationValues, widgetConfigs, nodeNames);
    if (result) results.push(result);
  }

  // danger 우선 정렬
  results.sort((a, b) => {
    if (a.level === 'danger' && b.level !== 'danger') return -1;
    if (a.level !== 'danger' && b.level === 'danger') return 1;
    return 0;
  });

  return results;
}

// ============================================================================
// Bridge Functions (하위호환)
// ============================================================================

/** ScenarioAlarmResult[] → ActiveAlarm[] 변환 */
export function scenarioResultsToActiveAlarms(
  results: ScenarioAlarmResult[],
): ActiveAlarm[] {
  const alarms: ActiveAlarm[] = [];

  for (const result of results) {
    for (const tc of result.triggeredConditions) {
      alarms.push({
        nodeId: tc.nodeId,
        nodeName: tc.nodeName,
        dataKey: tc.dataKey,
        label: dataKeyToLabel(tc.dataKey),
        unit: tc.unit,
        level: result.level,
        currentValue: tc.currentValue,
        threshold: tc.thresholdValue,
        scenarioId: result.scenarioId,
        scenarioName: result.scenarioName,
        scenarioSource: result.source,
      });
    }
  }

  return alarms;
}

/** ScenarioAlarmResult[] → nodeId→dataKey→AlarmLevel (위젯 알람 스타일용) */
export function deriveWidgetAlarmLevels(
  results: ScenarioAlarmResult[],
): Record<string, Record<string, AlarmLevel>> {
  const levels: Record<string, Record<string, AlarmLevel>> = {};

  for (const result of results) {
    for (const tc of result.triggeredConditions) {
      if (!levels[tc.nodeId]) levels[tc.nodeId] = {};
      const current = levels[tc.nodeId][tc.dataKey];
      // danger가 warning보다 우선
      if (!current || (result.level === 'danger' && current === 'warning')) {
        levels[tc.nodeId][tc.dataKey] = result.level;
      }
    }
  }

  return levels;
}

/** dataKey → 짧은 라벨 */
function dataKeyToLabel(dataKey: string): string {
  switch (dataKey) {
    case 'pressure': return 'P';
    case 'temperature': return 'T';
    case 'flowRate': return 'W';
    case 'valvePosition': return 'Pos';
    default: return dataKey;
  }
}

// ============================================================================
// Migration (레거시 한계치 → 시나리오 변환)
// ============================================================================

/** 레거시 AlarmThresholds → AlarmScenario[] 변환 */
export function migrateThresholdsToScenarios(
  thresholds: AlarmThresholds,
): AlarmScenario[] {
  const scenarios: AlarmScenario[] = [];
  let priority = 100;

  const unitMap: Record<string, string> = {
    pressure: 'MPa',
    temperature: '°C',
    flowRate: 'kg/s',
    valvePosition: '%',
  };

  const labelMap: Record<string, string> = {
    pressure: '압력',
    temperature: '온도',
    flowRate: '유량',
    valvePosition: '밸브 위치',
  };

  for (const [dataKey, th] of Object.entries(thresholds)) {
    const unit = unitMap[dataKey];
    const label = labelMap[dataKey] ?? dataKey;

    if (th.warningHigh !== undefined) {
      scenarios.push({
        id: `threshold-${dataKey}-wh`,
        name: `${label} Warning High`,
        nameKo: `${label} 상한 경고`,
        source: 'threshold',
        level: 'warning',
        conditions: [
          { id: `${dataKey}-wh`, dataKey, operator: '>=', value: th.warningHigh, unit, scope: { type: 'any' } },
        ],
        logic: 'AND',
        enabled: true,
        priority: priority++,
      });
    }
    if (th.warningLow !== undefined) {
      scenarios.push({
        id: `threshold-${dataKey}-wl`,
        name: `${label} Warning Low`,
        nameKo: `${label} 하한 경고`,
        source: 'threshold',
        level: 'warning',
        conditions: [
          { id: `${dataKey}-wl`, dataKey, operator: '<=', value: th.warningLow, unit, scope: { type: 'any' } },
        ],
        logic: 'AND',
        enabled: true,
        priority: priority++,
      });
    }
    if (th.dangerHigh !== undefined) {
      scenarios.push({
        id: `threshold-${dataKey}-dh`,
        name: `${label} Danger High`,
        nameKo: `${label} 상한 위험`,
        source: 'threshold',
        level: 'danger',
        conditions: [
          { id: `${dataKey}-dh`, dataKey, operator: '>=', value: th.dangerHigh, unit, scope: { type: 'any' } },
        ],
        logic: 'AND',
        enabled: true,
        priority: priority++,
      });
    }
    if (th.dangerLow !== undefined) {
      scenarios.push({
        id: `threshold-${dataKey}-dl`,
        name: `${label} Danger Low`,
        nameKo: `${label} 하한 위험`,
        source: 'threshold',
        level: 'danger',
        conditions: [
          { id: `${dataKey}-dl`, dataKey, operator: '<=', value: th.dangerLow, unit, scope: { type: 'any' } },
        ],
        logic: 'AND',
        enabled: true,
        priority: priority++,
      });
    }
  }

  return scenarios;
}

/** 기본 AlarmScenarioConfig 생성 (마이그레이션 포함) */
export function createDefaultScenarioConfig(
  legacyThresholds?: AlarmThresholds,
  legacyEnabled?: boolean,
): AlarmScenarioConfig {
  const predefined = createPredefinedScenarios();
  const thresholdScenarios = legacyThresholds
    ? migrateThresholdsToScenarios(legacyThresholds)
    : [];

  return {
    scenarios: [...predefined, ...thresholdScenarios],
    globalEnabled: legacyEnabled ?? true,
  };
}
