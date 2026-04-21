/**
 * Edge Style and Label Helpers
 * Provides utilities for determining edge styles and labels based on connection type
 *
 * 색상 체계 (Color Scheme):
 * - Axial (축방향): 파란색 계열 - 메인 유로 연결
 * - Crossflow (교차류): 오렌지색 계열 - 수평 교차 연결 (Face 3-6)
 * - MultiCell (다중 셀): 초록색 계열 - 다중 셀 crossflow 연결
 * - Legacy: 회색 계열 - 구버전 호환 (점선)
 */

// MARS 공식 연결 타입 + legacy 호환
// 'side'는 제거됨 - 대신 crossflow + isMultiCellConnection 사용
export type ConnectionType = 'axial' | 'crossflow' | 'legacy';

/**
 * 연결 타입별 색상 상수 (중앙화)
 *
 * Desaturated Tint 전략:
 * - 기본 상태: 낮은 채도의 파스텔 톤 → 노드 대비 시각적 잡음 최소화
 * - 호버 상태: 채도 복원 → 타입 정보가 자연스럽게 드러남
 * - 선택 상태: 완전 채도 + glow
 */
export const EDGE_COLORS = {
  // 기본 색상 (Default) - 저채도 파스텔
  axial: '#a8c4d8',      // 연한 파란색
  crossflow: '#d4b896',  // 연한 앰버
  multiCell: '#a8c8a8',  // 연한 초록색
  legacy: '#c0c0c0',     // 연한 회색
  default: '#b0bec5',    // 블루그레이

  // 호버 색상 (Hover) - 채도 복원
  axialHover: '#5c9bc7',     // 중간 파란색
  crossflowHover: '#c48a5a', // 중간 앰버
  multiCellHover: '#6a9e6a', // 중간 초록색
  legacyHover: '#9e9e9e',    // 중간 회색
  defaultHover: '#78909c',   // 중간 블루그레이

  // 선택 색상 (Selected) - 완전 채도 강조
  selected: '#1976d2',       // 진한 파란색 (공통)
} as const;

/**
 * Get edge style (color and stroke width) based on connection type
 * @param connectionType - 연결 타입 (axial, crossflow, legacy)
 * @param isMultiCell - 다중 셀 연결 여부 (true일 경우 초록색 사용)
 */
export function getEdgeStyle(
  connectionType: ConnectionType,
  isMultiCell: boolean = false
): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  // 다중 셀 연결인 경우 초록색 사용
  if (isMultiCell) {
    return { stroke: EDGE_COLORS.multiCell, strokeWidth: 1.5 };
  }

  switch (connectionType) {
    case 'legacy':
      // Old Format: 점선으로 시각적 구별
      return { stroke: EDGE_COLORS.legacy, strokeWidth: 1.5, strokeDasharray: '6 3' };
    case 'axial':
      return { stroke: EDGE_COLORS.axial, strokeWidth: 1.5 };
    case 'crossflow':
      return { stroke: EDGE_COLORS.crossflow, strokeWidth: 1.5 };
    default:
      return { stroke: EDGE_COLORS.default, strokeWidth: 1.5 };
  }
}

/**
 * Get hover color for connection type
 * @param connectionType - 연결 타입 (axial, crossflow, legacy)
 * @param isMultiCell - 다중 셀 연결 여부
 */
export function getEdgeHoverColor(
  connectionType: ConnectionType,
  isMultiCell: boolean = false
): string {
  if (isMultiCell) {
    return EDGE_COLORS.multiCellHover;
  }

  switch (connectionType) {
    case 'legacy':
      return EDGE_COLORS.legacyHover;
    case 'axial':
      return EDGE_COLORS.axialHover;
    case 'crossflow':
      return EDGE_COLORS.crossflowHover;
    default:
      return EDGE_COLORS.defaultHover;
  }
}

/**
 * Get edge label based on connection type, cell, and face
 * @param connectionType - 연결 타입
 * @param cell - 셀 번호
 * @param face - 면 번호
 * @param isMultiCell - 다중 셀 연결 여부
 */
export function getEdgeLabel(
  connectionType: ConnectionType,
  cell: number,
  face: number,
  isMultiCell: boolean = false
): string {
  // Face 0 (Old Format): show Inlet/Outlet Side instead of cell/face
  if (face === 0) {
    const side = cell === 0 ? 'Inlet' : 'Outlet';
    return `Old: ${side} Side`;
  }

  const cellStr = cell.toString().padStart(2, '0');

  if (isMultiCell) {
    return `MultiCell: v${cellStr} F${face}`;
  }

  switch (connectionType) {
    case 'legacy':
      return `Legacy: v${cellStr} F${face}`;
    case 'axial':
      return `Axial: v${cellStr} F${face}`;
    case 'crossflow':
      return `CF: v${cellStr} F${face}`;
    default:
      return `v${cellStr} F${face}`;
  }
}

/**
 * Determine connection type based on face values
 * - Face 0: legacy (Legacy format, actually axial)
 * - Face 1-2: axial (Inlet/Outlet)
 * - Face 3-6: crossflow (CrossFlow)
 */
export function determineConnectionType(fromFace: number, toFace: number): ConnectionType {
  // If either face is 0, it's a legacy connection
  if (fromFace === 0 || toFace === 0) {
    return 'legacy';
  }

  // If both faces are 1-2, it's axial
  if ((fromFace === 1 || fromFace === 2) && (toFace === 1 || toFace === 2)) {
    return 'axial';
  }

  // If either face is 3-6, it's crossflow
  if (fromFace >= 3 || toFace >= 3) {
    return 'crossflow';
  }

  // Default to axial
  return 'axial';
}
