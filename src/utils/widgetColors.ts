/**
 * Widget Color Mapping
 * dataKey 기반 자동 색상 매핑 — 위젯 좌측 테두리 및 Compact Badge 색상에 사용
 */

export interface WidgetColorInfo {
  color: string;
  label: string;
}

const COLOR_MAP: { pattern: string; color: string; label: string }[] = [
  { pattern: 'pressure',    color: '#1976d2', label: '압력' },
  { pattern: 'temperature', color: '#d32f2f', label: '온도' },
  { pattern: 'flow',        color: '#2e7d32', label: '유량' },
  { pattern: 'valve',       color: '#e65100', label: '밸브' },
];

const DEFAULT_COLOR: WidgetColorInfo = { color: '#616161', label: '기타' };

/** dataKey에서 색상 Hex 반환 */
export function getWidgetColorByDataKey(dataKey: string): string {
  const lower = dataKey.toLowerCase();
  for (const entry of COLOR_MAP) {
    if (lower.includes(entry.pattern)) return entry.color;
  }
  return DEFAULT_COLOR.color;
}

/** dataKey에서 색상 + 라벨 정보 반환 */
export function getWidgetColorInfo(dataKey: string): WidgetColorInfo {
  const lower = dataKey.toLowerCase();
  for (const entry of COLOR_MAP) {
    if (lower.includes(entry.pattern)) return { color: entry.color, label: entry.label };
  }
  return DEFAULT_COLOR;
}
