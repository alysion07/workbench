/**
 * MARS plotfl 파일 파서
 *
 * plotfl 형식:
 *   행1: 변수 타입 헤더 (time, rktpow, cntrlvar, p, tempf, tempg, mflowj ...)
 *   행2: 컴포넌트 ID (0, 324, 280070000 ...)
 *   행3: 빈 줄
 *   행4+: 시계열 데이터 (공백 구분, 과학적 표기법)
 */

import type { PlotVariable, PlotVariableType, ParsedPlotFile } from '@/types/analysis';

const VALID_TYPES = new Set<string>(['rktpow', 'cntrlvar', 'p', 'tempf', 'tempg', 'mflowj']);

/**
 * plotfl 텍스트를 파싱하여 구조화된 데이터로 변환
 */
export function parsePlotfl(text: string): ParsedPlotFile {
  const lines = text.split('\n');

  if (lines.length < 4) {
    throw new Error('plotfl 파일 형식이 올바르지 않습니다. 최소 4행이 필요합니다.');
  }

  // 행1: 변수 타입 헤더
  const typeTokens = lines[0].trim().split(/\s+/);
  // 행2: 컴포넌트 ID
  const idTokens = lines[1].trim().split(/\s+/);

  if (typeTokens[0] !== 'time') {
    throw new Error('plotfl 첫 번째 컬럼이 "time"이 아닙니다.');
  }

  // 변수 목록 구성 (time 제외, index 1부터)
  // 1-pass: 후보 키 수집 + 중복 카운트
  const keyCounts = new Map<string, number>();
  const rawEntries: Array<{ columnIndex: number; type: PlotVariableType; componentId: string; candidateKey: string }> = [];

  for (let i = 1; i < typeTokens.length; i++) {
    const type = typeTokens[i];
    if (!VALID_TYPES.has(type)) continue;

    const componentId = idTokens[i] || String(i);
    const candidateKey = `${type}_${componentId}`;
    keyCounts.set(candidateKey, (keyCounts.get(candidateKey) || 0) + 1);
    rawEntries.push({ columnIndex: i, type: type as PlotVariableType, componentId, candidateKey });
  }

  // 2-pass: 중복 키에만 columnIndex suffix 부착하여 고유성 보장
  const variables: PlotVariable[] = [];
  for (const entry of rawEntries) {
    const hasDuplicates = (keyCounts.get(entry.candidateKey) || 0) > 1;
    const dataKey = hasDuplicates ? `${entry.candidateKey}_${entry.columnIndex}` : entry.candidateKey;

    variables.push({
      columnIndex: entry.columnIndex,
      type: entry.type,
      componentId: entry.componentId,
      dataKey,
    });
  }

  // 데이터 행 파싱 (행3은 빈 줄이므로 행4부터 = index 3)
  const data: Array<Record<string, number>> = [];
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    const time = parseFloat(tokens[0]);
    if (isNaN(time)) continue;

    if (time < minTime) minTime = time;
    if (time > maxTime) maxTime = time;

    const row: Record<string, number> = { time };
    for (const v of variables) {
      const val = parseFloat(tokens[v.columnIndex]);
      row[v.dataKey] = isNaN(val) ? 0 : val;
    }
    data.push(row);
  }

  return {
    variables,
    data,
    timeRange: [minTime, maxTime],
  };
}

/**
 * 컴포넌트 ID에서 MARS 식별자 추출
 * 예: "280070000" → componentNumber "280", volumeNumber "07"
 *     "120070000" → componentNumber "120", volumeNumber "07"
 */
export function parseComponentId(id: string): { componentNumber: string; volumeFace: string } | null {
  // 9자리 MARS ID: CCCVVFFFF (CCC=컴포넌트, VV=볼륨, FFFF=face/field)
  if (id.length === 9 && /^\d+$/.test(id)) {
    return {
      componentNumber: id.substring(0, 3),
      volumeFace: id.substring(3, 5),
    };
  }
  // 제어변수 등 짧은 ID
  return null;
}

/**
 * 변수 목록을 컴포넌트별 → 타입별 트리로 그룹화
 */
export function groupVariablesByComponent(variables: PlotVariable[]): Map<string, PlotVariable[]> {
  const groups = new Map<string, PlotVariable[]>();

  for (const v of variables) {
    const parsed = parseComponentId(v.componentId);
    const groupKey = parsed ? parsed.componentNumber : v.componentId;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(v);
  }

  return groups;
}
