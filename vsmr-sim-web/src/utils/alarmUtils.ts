/**
 * Alarm Utilities
 * 시뮬레이션 값과 한계치 비교 → AlarmLevel 계산
 */

import type {
  AlarmLevel,
  AlarmThreshold,
  AlarmThresholds,
  ActiveAlarm,
  SimulationValues,
  NodeWidgetConfig,
  TimeSeriesPoint,
} from '@/types/interactive';

/** Display 단위 → Raw 단위 변환 (한계치 비교용) */
export function displayToRaw(value: number, unit?: string): number {
  if (unit === 'MPa') return value * 1e6;       // MPa → Pa
  if (unit === '°C') return value + 273.15;     // °C → K
  return value;
}

/** Raw 단위 → Display 단위 변환 */
export function rawToDisplay(value: number, unit?: string): number {
  if (unit === 'MPa') return value / 1e6;       // Pa → MPa
  if (unit === '°C') return value - 273.15;     // K → °C
  return value;
}

/** Raw 값을 display 단위 한계치와 비교하여 AlarmLevel 결정 */
export function computeAlarmLevel(
  rawValue: number | undefined,
  threshold: AlarmThreshold | undefined,
  unit?: string,
): AlarmLevel {
  if (rawValue === undefined || !threshold) return 'normal';

  const displayValue = rawToDisplay(rawValue, unit);

  // Danger check (최우선)
  if (threshold.dangerHigh !== undefined && displayValue >= threshold.dangerHigh) return 'danger';
  if (threshold.dangerLow !== undefined && displayValue <= threshold.dangerLow) return 'danger';

  // Warning check
  if (threshold.warningHigh !== undefined && displayValue >= threshold.warningHigh) return 'warning';
  if (threshold.warningLow !== undefined && displayValue <= threshold.warningLow) return 'warning';

  return 'normal';
}

/** 기본 알람 한계치 */
export function getDefaultAlarmThresholds(): AlarmThresholds {
  return {
    pressure: { warningHigh: 16.0, dangerHigh: 17.0 },
    temperature: { warningHigh: 320.0, dangerHigh: 350.0 },
    flowRate: { warningHigh: 500.0, dangerHigh: 600.0 },
    valvePosition: { warningHigh: 90.0, dangerHigh: 95.0 },
  };
}

/** SimulationValues에서 raw number 값 추출 */
function extractRawValue(val: number | string | TimeSeriesPoint[] | undefined): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
  }
  // TimeSeriesPoint[] → 마지막 값
  if (Array.isArray(val) && val.length > 0) return val[val.length - 1].value;
  return undefined;
}

/** 전체 노드에 대한 alarmLevels 계산 (nodeId → dataKey → AlarmLevel) */
export function computeAllAlarmLevels(
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
  simulationValues: SimulationValues,
  thresholds: AlarmThresholds,
): Record<string, Record<string, AlarmLevel>> {
  const result: Record<string, Record<string, AlarmLevel>> = {};

  for (const [nodeId, configs] of Object.entries(widgetConfigs)) {
    const nodeValues = simulationValues[nodeId];
    if (!nodeValues) continue;

    const nodeAlarms: Record<string, AlarmLevel> = {};
    for (const cfg of configs) {
      const rawVal = extractRawValue(nodeValues[cfg.dataKey]);
      const level = computeAlarmLevel(rawVal, thresholds[cfg.dataKey], cfg.unit);
      if (level !== 'normal') {
        nodeAlarms[cfg.dataKey] = level;
      }
    }
    if (Object.keys(nodeAlarms).length > 0) {
      result[nodeId] = nodeAlarms;
    }
  }

  return result;
}

/** 활성 알람 목록 수집 */
export function collectActiveAlarms(
  widgetConfigs: Record<string, NodeWidgetConfig[]>,
  simulationValues: SimulationValues,
  thresholds: AlarmThresholds,
  nodeNames: Record<string, string>,
): ActiveAlarm[] {
  const alarms: ActiveAlarm[] = [];

  for (const [nodeId, configs] of Object.entries(widgetConfigs)) {
    const nodeValues = simulationValues[nodeId];
    if (!nodeValues) continue;

    for (const cfg of configs) {
      const rawVal = extractRawValue(nodeValues[cfg.dataKey]);
      if (rawVal === undefined) continue;

      const threshold = thresholds[cfg.dataKey];
      const level = computeAlarmLevel(rawVal, threshold, cfg.unit);
      if (level === 'normal') continue;

      const displayValue = rawToDisplay(rawVal, cfg.unit);

      // 초과한 한계치 결정
      let exceededThreshold = 0;
      if (threshold) {
        if (level === 'danger') {
          if (threshold.dangerHigh !== undefined && displayValue >= threshold.dangerHigh) {
            exceededThreshold = threshold.dangerHigh;
          } else if (threshold.dangerLow !== undefined && displayValue <= threshold.dangerLow) {
            exceededThreshold = threshold.dangerLow;
          }
        } else {
          if (threshold.warningHigh !== undefined && displayValue >= threshold.warningHigh) {
            exceededThreshold = threshold.warningHigh;
          } else if (threshold.warningLow !== undefined && displayValue <= threshold.warningLow) {
            exceededThreshold = threshold.warningLow;
          }
        }
      }

      alarms.push({
        nodeId,
        nodeName: nodeNames[nodeId] ?? nodeId,
        dataKey: cfg.dataKey,
        label: cfg.label,
        unit: cfg.unit,
        level,
        currentValue: displayValue,
        threshold: exceededThreshold,
      });
    }
  }

  // Danger 우선 정렬
  alarms.sort((a, b) => {
    if (a.level === 'danger' && b.level !== 'danger') return -1;
    if (a.level !== 'danger' && b.level === 'danger') return 1;
    return 0;
  });

  return alarms;
}
