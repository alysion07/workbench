/**
 * useLiveNodeValues
 * MinorEdit 스트림 데이터 + ICV 폴링 데이터를 조합하여
 * InteractiveControlView 위젯이 소비하는 SimulationValues 형식으로 변환
 *
 * 매핑 전략:
 *   - MinorEdit: minorEdits[i] 정의 순서 ↔ latestMinorEdit.values[i+1] 인덱스 매핑
 *     (values[0]은 시간축으로 사용됨)
 *   - ICV: cccno → componentId CCC 매핑
 *   - Fallback: 노드 초기 파라미터값
 */

import { useMemo } from 'react';
import type { Node } from 'reactflow';
import type { MARSNodeData, ComponentType, MinorEdit, ValveParameters, ControlVariable } from '@/types/mars';
import { isNonConstantControlVariable } from '@/types/mars';
import type { SimulationValues, TimeSeriesPoint } from '@/types/interactive';
import type { MinorEditNamedSnapshot } from '@/types/simulation';
import type { GeneralICVEntry } from './useICVPolling';
import { ICVType, ControlMode } from '@/stubs/mars/mars_service_mod06_pb';

// ============================================================================
// 상수 & 타입
// ============================================================================

/** 버퍼 안전 상한 — 다운샘플링은 차트 컴포넌트에서 수행 */
const MAX_BUFFER_POINTS = 50_000;

/** MinorEdit 변수 중 노드에 매핑 가능한 타입 */
const VAR_TYPE_TO_DATA_KEY: Record<string, string> = {
  p: 'pressure',
  tempf: 'temperature',
  tempg: 'temperature',
  mflowj: 'flowRate',
  voidf: 'voidFraction',
};

/**
 * ControlVariable 정의에서 주 VariableRef를 추출
 * 복합 CV(SUM, MULT 등)는 첫 번째 참조 변수를 반환
 */
/**
 * ControlVariable 정의에서 주 VariableRef를 추출
 * 복합 CV(SUM, MULT 등)는 첫 번째 참조 변수를 반환
 */
export function extractPrimaryVarRef(
  cv: ControlVariable,
): { variableName: string; parameterCode: number } | null {
  if (!isNonConstantControlVariable(cv)) return null;

  // discriminated union은 cv 자체에서 접근해야 타입 좁히기가 동작
  switch (cv.componentType) {
    case 'SUM':
      return cv.data.terms.length > 0 ? cv.data.terms[0].variable : null;
    case 'MULT':
      return cv.data.factors.length > 0 ? cv.data.factors[0] : null;
    case 'DIV':
      return cv.data.numerator ?? cv.data.denominator;
    case 'DIFFRENI':
    case 'DIFFREND':
    case 'INTEGRAL':
      return cv.data.variable;
    case 'FUNCTION':
      return cv.data.variable;
    case 'DELAY':
      return cv.data.variable;
    case 'DIGITAL':
      return cv.data.variable;
    case 'POWERI':
      return cv.data.variable;
    case 'POWERR':
      return cv.data.variable;
    case 'LAG':
      return cv.data.variable;
    case 'LEAD-LAG':
      return cv.data.variable;
    case 'PROP-INT':
      return cv.data.variable;
    case 'STDFNCTN':
      return cv.data.arguments.length > 0 ? cv.data.arguments[0] : null;
    case 'POWERX':
      return cv.data.base;
    case 'PUMPCTL':
    case 'STEAMCTL':
      return cv.data.sensedVariable;
    case 'FEEDCTL':
      return cv.data.sensedVariable1;
    case 'TRIPUNIT':
    case 'TRIPDLAY':
    case 'SHAFT':
      return null;
    default:
      return null;
  }
}

/** MinorEdit 매핑 엔트리 */
interface MinorEditMapping {
  /** minorEdits 배열 인덱스 (= values[index+1]에 해당) */
  index: number;
  /** 캔버스 노드 ID */
  nodeId: string;
  /** 위젯 dataKey (pressure, temperature, flowRate 등) */
  dataKey: string;
}

interface TimeSeriesBuffer {
  [nodeId_dataKey: string]: TimeSeriesPoint[];
}

/**
 * 모듈 레벨 시계열 버퍼
 * React 컴포넌트 라이프사이클(마운트/언마운트/CSS 토글)과 무관하게 데이터 유지.
 * idle 진입 시 clearTimeSeriesBuffer()로 초기화.
 */
let _globalBuffer: TimeSeriesBuffer = {};

/** 버퍼 초기화 (시뮬레이션 idle 진입 시 호출) */
export function clearTimeSeriesBuffer(): void {
  _globalBuffer = {};
}

/** 버퍼 참조 반환 (내부 훅에서 사용) */
function getBuffer(): TimeSeriesBuffer {
  return _globalBuffer;
}

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * MinorEdit parameter에서 CCC 번호 추출
 * "280070000" → "280", "1300100" → "130"
 */
function extractCCCFromParameter(parameter: string | number): string {
  return String(parameter).slice(0, 3);
}

/**
 * 노드 componentId에서 CCC 추출
 * Hydrodynamic(7자리): 앞 3자리, Heat Structure(8자리): 앞 4자리
 */
function extractCCCFromComponentId(componentId: string): string {
  const num = parseInt(componentId, 10);
  if (num >= 10000000) {
    return componentId.slice(0, 4);
  }
  return componentId.slice(0, 3);
}

/**
 * Core 노드 탐색 (하드코딩 휴리스틱)
 * componentName에 'core' 포함 또는 componentId가 '110'으로 시작하는 노드
 */
function findCoreNodeId(nodes: Node<MARSNodeData>[]): string | null {
  for (const node of nodes) {
    const { componentName, componentId } = node.data;
    if (componentName?.toLowerCase().includes('core')) return node.id;
    if (componentId?.startsWith('110')) return node.id;
  }
  return null;
}

/** 시계열 버퍼에 포인트 추가 (중복 시간 방지, 최대 길이 제한) */
function appendToBuffer(
  buffer: TimeSeriesBuffer,
  key: string,
  time: number,
  value: number,
): TimeSeriesPoint[] {
  if (!buffer[key]) buffer[key] = [];
  const series = buffer[key];
  if (series.length === 0 || series[series.length - 1].time !== time) {
    series.push({ time, value });
    if (series.length > MAX_BUFFER_POINTS) {
      series.splice(0, series.length - MAX_BUFFER_POINTS);
    }
  }
  return [...series];
}

// ============================================================================
// Hook
// ============================================================================

type SimulationPhase = 'idle' | 'active' | 'finished';

interface UseLiveNodeValuesOptions {
  nodes: Node<MARSNodeData>[];
  enabledNodeIds: Set<string>;
  /** 입력파일(.i)에서 파싱된 Minor Edit 정의 배열 */
  minorEdits: MinorEdit[];
  /** 입력파일(.i)에서 파싱된 Control Variable 정의 (205CCCNN) */
  controlVariables: ControlVariable[];
  /** 실시간 MinorEdit 스트림 최신 스냅샷 */
  latestMinorEdit: MinorEditNamedSnapshot | null;
  /** ICV 폴링 결과 (전체 타입) */
  allICVEntries: GeneralICVEntry[];
  /** 시뮬레이션 상태: idle(미실행), active(실행/일시정지), finished(완료/정지) */
  simulationPhase: SimulationPhase;
}

export function useLiveNodeValues({
  nodes,
  enabledNodeIds,
  minorEdits,
  controlVariables,
  latestMinorEdit,
  allICVEntries,
  simulationPhase,
}: UseLiveNodeValuesOptions): SimulationValues {

  // CCC → nodeId 맵 (enabled 노드만)
  const cccToNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (!enabledNodeIds.has(node.id)) continue;
      const cid = node.data.componentId;
      if (!cid) continue;
      const ccc = extractCCCFromComponentId(cid);
      map.set(ccc, node.id);
      // 전체 componentId도 등록 (정확 매칭용)
      map.set(cid, node.id);
    }
    return map;
  }, [nodes, enabledNodeIds]);

  // CV 번호 → ControlVariable 정의 맵
  const cvMap = useMemo(() => {
    const map = new Map<number, ControlVariable>();
    for (const cv of controlVariables) {
      map.set(cv.number, cv);
    }
    return map;
  }, [controlVariables]);

  // MinorEdit 매핑 테이블: minorEdits[i] 중 노드에 매핑 가능한 항목만
  const minorEditMappings = useMemo<MinorEditMapping[]>(() => {
    const sorted = [...minorEdits].sort((a, b) => a.cardNumber - b.cardNumber);
    const mappings: MinorEditMapping[] = [];

    sorted.forEach((edit, index) => {
      // 직접 매핑 가능한 변수 타입 (p, tempf, mflowj 등)
      const directDataKey = VAR_TYPE_TO_DATA_KEY[edit.variableType];
      if (directDataKey) {
        const ccc = extractCCCFromParameter(edit.parameter);
        const nodeId = cccToNodeMap.get(ccc);
        if (nodeId) {
          mappings.push({ index, nodeId, dataKey: directDataKey });
        }
        return;
      }

      // cntrlvar → CV 정의에서 참조 변수를 추출하여 매핑
      if (edit.variableType === 'cntrlvar') {
        const cvNumber = typeof edit.parameter === 'string'
          ? parseInt(edit.parameter, 10)
          : edit.parameter;
        const cv = cvMap.get(cvNumber);
        if (!cv) return;

        const varRef = extractPrimaryVarRef(cv);
        if (!varRef) return;

        const dataKey = VAR_TYPE_TO_DATA_KEY[varRef.variableName];
        if (!dataKey) return; // 참조 변수가 cntrlvar 자체이거나 매핑 불가

        const ccc = String(varRef.parameterCode).slice(0, 3);
        const nodeId = cccToNodeMap.get(ccc);
        if (nodeId) {
          mappings.push({ index, nodeId, dataKey });
        }
      }

      // rktpow → Core 노드에 매핑 (하드코딩)
      if (edit.variableType === 'rktpow') {
        const coreNodeId = findCoreNodeId(nodes);
        if (coreNodeId) {
          mappings.push({ index, nodeId: coreNodeId, dataKey: 'rktpow' });
        }
      }
      // time 등 → 스킵
    });

    return mappings;
  }, [minorEdits, cccToNodeMap, cvMap]);

  // 메인 값 계산
  const simulationValues = useMemo<SimulationValues>(() => {
    const values: SimulationValues = {};
    const buffer = getBuffer();

    // idle(미실행) → 버퍼 초기화 + 초기값 반환
    if (simulationPhase === 'idle') {
      clearTimeSeriesBuffer();
      return buildInitialValues(nodes, enabledNodeIds);
    }

    // finished(완료/정지) → 버퍼 유지, 마지막 데이터 그대로 반환 (새 데이터 추가 안 함)
    if (simulationPhase === 'finished') {
      // 기존 시계열 버퍼의 마지막 스냅샷을 반환
      const frozenValues: SimulationValues = {};
      for (const [key, series] of Object.entries(buffer)) {
        const lastUnderscore = key.lastIndexOf('_');
        if (lastUnderscore <= 0) continue;
        const nodeId = key.slice(0, lastUnderscore);
        const dataKey = key.slice(lastUnderscore + 1);
        if (!dataKey || series.length === 0) continue;
        if (!frozenValues[nodeId]) frozenValues[nodeId] = {};
        frozenValues[nodeId][dataKey] = [...series];
      }
      // ICV 데이터도 오버레이 (completed 후에도 마지막 ICV 값 유지)
      for (const icv of allICVEntries) {
        const cccStr = String(icv.cccno);
        const nodeId = cccToNodeMap.get(cccStr) ?? cccToNodeMap.get(cccStr.slice(0, 3));
        if (!nodeId) continue;
        if (!frozenValues[nodeId]) frozenValues[nodeId] = {};
        switch (icv.ctype) {
          case ICVType.VALVE:
            frozenValues[nodeId].valvePosition = icv.asis * 100;
            frozenValues[nodeId].valveMode = icv.cmode === ControlMode.AUTOMATIC ? 'auto' : 'manual';
            break;
        }
      }
      // 데이터 없는 enabled 노드 → 초기값 fallback
      for (const node of nodes) {
        if (!enabledNodeIds.has(node.id)) continue;
        if (frozenValues[node.id] && Object.keys(frozenValues[node.id]).length > 0) continue;
        const initial = buildNodeInitialValues(node);
        if (initial) frozenValues[node.id] = initial;
      }
      return frozenValues;
    }

    const time = latestMinorEdit
      ? latestMinorEdit.timehy / 1000 // ms → s
      : 0;

    // ---- 1. MinorEdit 인덱스 매핑 ----
    if (latestMinorEdit && latestMinorEdit.values.length > 1) {
      for (const mapping of minorEditMappings) {
        // values[0]은 시간축(rktpow), 실제 데이터는 values[index+1]부터
        const valueEntry = latestMinorEdit.values[mapping.index + 1];
        if (!valueEntry) continue;

        let numValue = Number(valueEntry.value);
        if (!Number.isFinite(numValue)) continue;

        // rktpow: W → MW 단위 변환
        if (mapping.dataKey === 'rktpow') numValue /= 1e6;

        const bufKey = `${mapping.nodeId}_${mapping.dataKey}`;
        const series = appendToBuffer(buffer, bufKey, time, numValue);

        if (!values[mapping.nodeId]) values[mapping.nodeId] = {};
        values[mapping.nodeId][mapping.dataKey] = series;
      }
    }

    // ---- 2. ICV 데이터 오버레이 ----
    for (const icv of allICVEntries) {
      const cccStr = String(icv.cccno);
      const nodeId = cccToNodeMap.get(cccStr) ?? cccToNodeMap.get(cccStr.slice(0, 3));
      if (!nodeId) continue;

      if (!values[nodeId]) values[nodeId] = {};

      switch (icv.ctype) {
        case ICVType.VALVE:
          values[nodeId].valvePosition = icv.asis * 100; // 0~1 → %
          values[nodeId].valveMode = icv.cmode === ControlMode.AUTOMATIC ? 'auto' : 'manual';
          break;
        case ICVType.FLOWF:
        case ICVType.FLOWG: {
          const bufKey = `${nodeId}_flowRate`;
          values[nodeId].flowRate = appendToBuffer(buffer, bufKey, time, icv.asis);
          break;
        }
        case ICVType.TMDPV: {
          const bufKey = `${nodeId}_pressure`;
          values[nodeId].pressure = appendToBuffer(buffer, bufKey, time, icv.asis);
          break;
        }
        // TRIP, HEATER, REACTIVITY, CNTRLVAR → SidePanel에서 별도 처리
      }
    }

    // ---- 3. 데이터 없는 enabled 노드 → 초기값 fallback ----
    for (const node of nodes) {
      if (!enabledNodeIds.has(node.id)) continue;
      if (values[node.id] && Object.keys(values[node.id]).length > 0) continue;

      const initial = buildNodeInitialValues(node);
      if (initial) {
        values[node.id] = initial;
      }
    }

    return values;
  }, [nodes, enabledNodeIds, minorEdits, latestMinorEdit, allICVEntries, simulationPhase, cccToNodeMap, minorEditMappings]);

  return simulationValues;
}

// ============================================================================
// 초기값 빌더
// ============================================================================

function buildInitialValues(
  nodes: Node<MARSNodeData>[],
  enabledNodeIds: Set<string>,
): SimulationValues {
  const values: SimulationValues = {};
  for (const node of nodes) {
    if (!enabledNodeIds.has(node.id)) continue;
    const initial = buildNodeInitialValues(node);
    if (initial) values[node.id] = initial;
  }
  return values;
}

function buildNodeInitialValues(
  node: Node<MARSNodeData>,
): Record<string, number | string> | null {
  const { componentType, parameters } = node.data;
  const vals: Record<string, number | string> = {};

  switch (componentType as ComponentType) {
    case 'snglvol':
    case 'branch':
    case 'pump':
    case 'turbine': {
      const p = (parameters as any)?.pressure;
      const t = (parameters as any)?.temperature;
      if (p != null) vals.pressure = p;
      if (t != null) vals.temperature = t;
      break;
    }
    case 'tmdpvol': {
      const p = (parameters as any)?.pressure
        ?? (parameters as any)?.timeTable?.[0]?.pressure;
      const t = (parameters as any)?.temperature
        ?? (parameters as any)?.timeTable?.[0]?.temperature;
      if (p != null) vals.pressure = p;
      if (t != null) vals.temperature = t;
      break;
    }
    case 'pipe': {
      const pArr = (parameters as any)?.pressure;
      const p = Array.isArray(pArr) ? pArr[0] : pArr;
      if (p != null) vals.pressure = p;
      break;
    }
    case 'valve': {
      const vp = parameters as Partial<ValveParameters>;
      const sub = vp.valveSubType ?? 'trpvlv';
      if (sub === 'trpvlv') {
        vals.valveMode = 'auto';
      } else {
        vals.valvePosition = (vp.initialPosition ?? 0.5) * 100;
      }
      break;
    }
    case 'sngljun':
    case 'tmdpjun':
    case 'mtpljun': {
      const mfl = (parameters as any)?.mfl;
      if (mfl != null) vals.flowRate = mfl;
      break;
    }
    default:
      return null;
  }

  return Object.keys(vals).length > 0 ? vals : null;
}
