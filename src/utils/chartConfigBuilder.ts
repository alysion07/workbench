/**
 * chartConfigBuilder
 * MinorEdit[] → ChartConfig[] 변환 유틸리티
 *
 * DynamicChartGrid(Monitoring)와 InteractiveControlView(Interactive) 양쪽에서 공유.
 * 동일한 ChartConfig ID를 생성하므로 simulationStore의 chartYAxisModes 등
 * 스타일 설정이 탭 간에 자동으로 공유된다.
 */

import type { Node } from 'reactflow';
import type { ChartConfig } from '@/types/simulation';
import type { MinorEdit, MARSNodeData } from '@/types/mars';

// --- Constants ---------------------------------------------------------------

export const VARIABLE_TYPE_CONFIG: Record<
  string,
  { label: string; unit: string; defaultColor: string }
> = {
  p: { label: 'Pressure', unit: 'Pa', defaultColor: '#2196F3' },
  tempf: { label: 'Fluid Temp', unit: 'K', defaultColor: '#FF9800' },
  tempg: { label: 'Vapor Temp', unit: 'K', defaultColor: '#FF5722' },
  mflowj: { label: 'Mass Flow', unit: 'kg/s', defaultColor: '#4CAF50' },
  mflowfj: { label: 'Liquid Flow', unit: 'kg/s', defaultColor: '#66BB6A' },
  mflowgj: { label: 'Vapor Flow', unit: 'kg/s', defaultColor: '#81C784' },
  voidf: { label: 'Void Fraction', unit: '', defaultColor: '#9C27B0' },
  flenth: { label: 'Enthalpy', unit: 'J/kg', defaultColor: '#FF7043' },
  rktpow: { label: 'Reactor Power', unit: 'W', defaultColor: '#F44336' },
  rkmodd: { label: 'Moderator ρ', unit: '$', defaultColor: '#E91E63' },
  rkscram: { label: 'Scram ρ', unit: '$', defaultColor: '#AD1457' },
  rkdopp: { label: 'Doppler ρ', unit: '$', defaultColor: '#C62828' },
  rkreac: { label: 'Total ρ', unit: '$', defaultColor: '#B71C1C' },
  cntrlvar: { label: 'Control Variable', unit: '', defaultColor: '#00BCD4' },
  time: { label: 'Time', unit: 's', defaultColor: '#607D8B' },
};

export const VARIABLE_TAG_MAP: Record<string, string> = {
  p: 'Pressure',
  tempf: 'Temperature',
  tempg: 'Temperature',
  mflowj: 'Flow',
  mflowfj: 'Flow',
  mflowgj: 'Flow',
  voidf: 'Void Fraction',
  flenth: 'Enthalpy',
  rktpow: 'Power',
  rkmodd: 'Reactivity',
  rkscram: 'Reactivity',
  rkdopp: 'Reactivity',
  rkreac: 'Reactivity',
  cntrlvar: 'Control',
};

export const CHART_PALETTE = [
  '#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#F44336',
  '#00BCD4', '#607D8B', '#795548', '#9E9E9E', '#E91E63',
];

export const generateColor = (index: number): string =>
  CHART_PALETTE[index % CHART_PALETTE.length];

// --- Helpers -----------------------------------------------------------------

export function findComponentName(
  id: string,
  nodes: Node[],
  isJunction: boolean,
): string {
  const compNum = id.slice(0, 3);

  for (const node of nodes) {
    const nodeData = node.data as MARSNodeData;
    const nodeCompId = nodeData.componentId;

    if (!nodeCompId || nodeCompId.length < 3) continue;

    const nodeCompNum = nodeCompId.slice(0, 3);

    if (nodeCompNum === compNum) {
      if (isJunction) {
        if (
          nodeData.componentType === 'sngljun' ||
          nodeData.componentType === 'tmdpjun'
        ) {
          return nodeData.componentName || `Junction ${id}`;
        }
        const junctionNum = parseInt(id.slice(7, 8), 10);
        return `${nodeData.componentName || 'Pipe'} Junction ${junctionNum}`;
      } else {
        if (
          nodeData.componentType === 'snglvol' ||
          nodeData.componentType === 'tmdpvol'
        ) {
          const volNum = id.slice(3, 5);
          return `${nodeData.componentName || 'Volume'} Vol${volNum}`;
        }
        if (nodeData.componentType === 'pipe') {
          const volNum = id.slice(3, 5);
          return `${nodeData.componentName || 'Pipe'} Vol${volNum}`;
        }
      }
    }
  }

  return id;
}

// --- Main Builder ------------------------------------------------------------

export function generateChartsFromMinorEdits(
  minorEdits: MinorEdit[],
  nodes: Node[],
): ChartConfig[] {
  const charts: ChartConfig[] = [];
  const editsByGroup = new Map<number, MinorEdit[]>();

  minorEdits.forEach((edit) => {
    const group = edit.editGroup;
    if (!editsByGroup.has(group)) {
      editsByGroup.set(group, []);
    }
    editsByGroup.get(group)!.push(edit);
  });

  const sortedGroups = [...editsByGroup.entries()].sort(([a], [b]) => a - b);

  sortedGroups.forEach(([group, edits]) => {
    const sortedEdits = [...edits].sort((a, b) => a.cardNumber - b.cardNumber);
    const firstEdit = sortedEdits[0];
    const varConfig = VARIABLE_TYPE_CONFIG[firstEdit.variableType] || {
      label: firstEdit.variableType,
      unit: '',
      defaultColor: generateColor(0),
    };

    const dataKeys: Array<{ key: string; label: string; color: string }> = [];

    sortedEdits.forEach((edit) => {
      const dataKey = buildDataKey(edit);
      let label = '';

      // Volume-based variables (parameter = Volume ID)
      const volumeVars = ['p', 'tempf', 'tempg', 'voidf', 'flenth'];
      // Junction-based variables (parameter = Junction ID)
      const junctionVars = ['mflowj', 'mflowfj', 'mflowgj'];
      // Reactor kinetics (parameter = 0)
      const reactorVars = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];

      if (reactorVars.includes(edit.variableType)) {
        label = edit.comment || varConfig.label;
      } else if (edit.variableType === 'cntrlvar') {
        label = edit.comment || `${varConfig.label} ${edit.parameter}`;
      } else if (volumeVars.includes(edit.variableType)) {
        const paramStr = edit.parameter.toString();
        const compName = findComponentName(paramStr, nodes, false);
        label = edit.comment || `${compName} (${varConfig.label})`;
      } else if (junctionVars.includes(edit.variableType)) {
        const paramStr = edit.parameter.toString();
        const compName = findComponentName(paramStr, nodes, true);
        label = edit.comment || `${compName} (${varConfig.label})`;
      } else {
        label = edit.comment || varConfig.label;
      }

      const colorIndex = edit.editPriority - 1;
      dataKeys.push({
        key: dataKey,
        label,
        color: generateColor(colorIndex),
      });
    });

    const minLimit = Math.min(...sortedEdits.map((e) => e.lowerLimit));
    const maxLimit = Math.max(...sortedEdits.map((e) => e.upperLimit));

    const chartTitle = firstEdit.comment
      ? firstEdit.comment
      : `${varConfig.label} (Group ${group})`;

    const tag = VARIABLE_TAG_MAP[firstEdit.variableType] || firstEdit.variableType;

    charts.push({
      id: `chart-group-${group}`,
      title: chartTitle,
      type: 'line',
      dataKeys,
      unit: varConfig.unit,
      minorEditCardNumber: firstEdit.cardNumber,
      yAxisMode: 'auto',
      yAxisFixed: [minLimit, maxLimit],
      editGroup: group,
      editPriority: Math.min(...sortedEdits.map((e) => e.editPriority)),
      size: 'small',
      tags: [tag],
    });
  });

  return charts;
}

// --- 원자력 해석 변수 타입 → 자동 그룹 매핑 -----------------------------------

const AUTO_GROUP_MAP: Record<string, string> = {
  p:        'pressure',
  tempf:    'temperature',
  tempg:    'temperature',
  mflowj:   'flow',
  mflowfj:  'flow',
  mflowgj:  'flow',
  voidf:    'void',
  flenth:   'enthalpy',
  rktpow:   'kinetics',
  rkmodd:   'kinetics',
  rkscram:  'kinetics',
  rkdopp:   'kinetics',
  rkreac:   'kinetics',
  cntrlvar: 'control',
  time:     'time',
};

const AUTO_GROUP_LABEL: Record<string, string> = {
  pressure:    'Pressure',
  temperature: 'Temperature',
  flow:        'Mass Flow',
  void:        'Void Fraction',
  enthalpy:    'Enthalpy',
  kinetics:    'Reactor Kinetics',
  control:     'Control Variable',
  time:        'Time',
};

const GROUP_ORDER = ['pressure', 'temperature', 'flow', 'void', 'enthalpy', 'kinetics', 'control', 'time'];

// --- 색상 계열 분화 (HSL 기반) ------------------------------------------------

function generateVariantColor(baseHex: string, index: number, total: number): string {
  if (total <= 1) return baseHex;
  if (total >= 6) return CHART_PALETTE[index % CHART_PALETTE.length];

  const r = parseInt(baseHex.slice(1, 3), 16) / 255;
  const g = parseInt(baseHex.slice(3, 5), 16) / 255;
  const b = parseInt(baseHex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hueSpread = 0.16;
  const hueStep = total > 1 ? (hueSpread * 2) / (total - 1) : 0;
  const newH = ((h - hueSpread + hueStep * index) % 1 + 1) % 1;
  const lightBase = 0.48;
  const lightOffset = index % 2 === 0 ? 0.1 * Math.floor(index / 2) : -0.1 * Math.ceil(index / 2);
  const newL = Math.max(0.3, Math.min(0.65, lightBase + lightOffset));
  const newS = Math.max(0.7, Math.min(1.0, s));

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
  const p = 2 * newL - q;
  const nr = Math.round(hue2rgb(p, q, newH + 1 / 3) * 255);
  const ng = Math.round(hue2rgb(p, q, newH) * 255);
  const nb = Math.round(hue2rgb(p, q, newH - 1 / 3) * 255);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// --- 자동 그룹핑 Builder (variableType 기반) ----------------------------------

export function generateChartsAutoGrouped(
  minorEdits: MinorEdit[],
  nodes: Node[],
): ChartConfig[] {
  const charts: ChartConfig[] = [];
  const editsByAutoGroup = new Map<string, MinorEdit[]>();

  minorEdits.forEach((edit) => {
    const autoGroup = AUTO_GROUP_MAP[edit.variableType] ?? edit.variableType;
    if (!editsByAutoGroup.has(autoGroup)) {
      editsByAutoGroup.set(autoGroup, []);
    }
    editsByAutoGroup.get(autoGroup)!.push(edit);
  });

  const sortedGroupKeys = [...editsByAutoGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  sortedGroupKeys.forEach((autoGroup) => {
    const edits = editsByAutoGroup.get(autoGroup)!;
    const sortedEdits = [...edits].sort((a, b) => a.cardNumber - b.cardNumber);
    const firstEdit = sortedEdits[0];

    const groupLabel = AUTO_GROUP_LABEL[autoGroup] ?? autoGroup;
    const firstVarConfig = VARIABLE_TYPE_CONFIG[firstEdit.variableType];
    const groupBaseColor = firstVarConfig?.defaultColor ?? generateColor(0);
    const groupUnit = firstVarConfig?.unit ?? '';

    const volumeVars = ['p', 'tempf', 'tempg', 'voidf', 'flenth'];
    const junctionVars = ['mflowj', 'mflowfj', 'mflowgj'];
    const reactorVars = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];

    const dataKeys: Array<{ key: string; label: string; color: string }> = [];

    sortedEdits.forEach((edit, index) => {
      const varConfig = VARIABLE_TYPE_CONFIG[edit.variableType] || {
        label: edit.variableType, unit: '', defaultColor: generateColor(0),
      };
      const dataKey = buildDataKey(edit);
      let label = '';

      if (reactorVars.includes(edit.variableType)) {
        label = edit.comment || varConfig.label;
      } else if (edit.variableType === 'cntrlvar') {
        label = edit.comment || `${varConfig.label} ${edit.parameter}`;
      } else if (volumeVars.includes(edit.variableType)) {
        const paramStr = edit.parameter.toString();
        label = edit.comment || `${findComponentName(paramStr, nodes, false)} (${varConfig.label})`;
      } else if (junctionVars.includes(edit.variableType)) {
        const paramStr = edit.parameter.toString();
        label = edit.comment || `${findComponentName(paramStr, nodes, true)} (${varConfig.label})`;
      } else {
        label = edit.comment || varConfig.label;
      }

      const baseColor = VARIABLE_TYPE_CONFIG[edit.variableType]?.defaultColor ?? groupBaseColor;
      dataKeys.push({
        key: dataKey,
        label,
        color: generateVariantColor(baseColor, index, sortedEdits.length),
      });
    });

    const minLimit = Math.min(...sortedEdits.map((e) => e.lowerLimit));
    const maxLimit = Math.max(...sortedEdits.map((e) => e.upperLimit));
    const tag = VARIABLE_TAG_MAP[firstEdit.variableType] || firstEdit.variableType;

    charts.push({
      id: `chart-auto-${autoGroup}`,
      title: groupLabel,
      type: 'line',
      dataKeys,
      unit: groupUnit,
      minorEditCardNumber: firstEdit.cardNumber,
      yAxisMode: 'auto',
      yAxisFixed: [minLimit, maxLimit],
      editGroup: 0,
      editPriority: Math.min(...sortedEdits.map((e) => e.editPriority)),
      size: 'small',
      tags: [tag],
    });
  });

  return charts;
}

// --- Chart Color Map (모니터링 ↔ ICV 색상 동기화) ----------------------------

export type ChartColorMap = Record<string, string>;

/**
 * MinorEdit 배열에서 dataKey → 자동 할당 색상 맵을 생성.
 * DynamicChartGrid의 차트 라인 색상과 MiniChartWidget의 라인/테두리 색상을
 * 동기화하기 위한 단일 진실 소스(single source of truth).
 */
export function buildChartColorMap(minorEdits: MinorEdit[], nodes: Node[]): ChartColorMap {
  const configs = generateChartsFromMinorEdits(minorEdits, nodes);
  const colorMap: ChartColorMap = {};
  for (const chart of configs) {
    if (!chart.dataKeys) continue;
    for (const dk of chart.dataKeys) {
      colorMap[dk.key] = dk.color;
    }
  }
  return colorMap;
}

// --- Plot Data Transformer ---------------------------------------------------

const REACTOR_VARS = ['rktpow', 'rkmodd', 'rkscram', 'rkdopp', 'rkreac', 'time'];

/**
 * MinorEdit에서 고유한 dataKey를 생성한다.
 * cardNumber를 포함하여 같은 변수가 여러 카드에 등장해도 충돌하지 않도록 한다.
 * 예: "rktpow_301", "tempf_302_191020000", "cntrlvar_306_511"
 */
export function buildDataKey(edit: MinorEdit): string {
  if (REACTOR_VARS.includes(edit.variableType)) {
    return `${edit.variableType}_${edit.cardNumber}`;
  }
  return `${edit.variableType}_${edit.cardNumber}_${edit.parameter}`;
}

/**
 * plotData(v0, v1, …) → chartData(rktpow_301, tempf_302_191020000, …) 변환.
 * DynamicChartGrid와 InteractiveControlView 양쪽에서 공유한다.
 */
export function transformPlotData(
  plotData: Array<Record<string, any>>,
  minorEdits: MinorEdit[],
): Array<Record<string, any>> {
  if (plotData.length === 0 || minorEdits.length === 0) return [];

  const sortedEdits = [...minorEdits].sort((a, b) => a.cardNumber - b.cardNumber);

  return plotData.map((point) => {
    const dataPoint: Record<string, any> = { time: point.time || 0 };

    sortedEdits.forEach((edit, index) => {
      const value = point[`v${index}`];
      if (value === undefined || value === null) return;

      dataPoint[buildDataKey(edit)] = value;
    });

    // v0..vN 이외의 기존 키도 보존
    Object.keys(point).forEach((key) => {
      if (key !== 'time' && !(/^v\d+$/).test(key)) {
        dataPoint[key] = point[key];
      }
    });

    return dataPoint;
  });
}
