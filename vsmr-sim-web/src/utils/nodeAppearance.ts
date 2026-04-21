/**
 * Node Appearance Utilities
 * 컴포넌트 타입별 기본 외형 설정 및 도형 렌더링 헬퍼
 */

import { Position } from 'reactflow';
import { ComponentType, NodeAppearance, NodeRotation, NodeShape } from '@/types/mars';

// ============================================================================
// 타입별 기본 외형 설정
// ============================================================================

const DEFAULT_APPEARANCES: Record<ComponentType, NodeAppearance> = {
  snglvol: { shape: 'rectangle', width: 80, height: 120, rotation: 0, backgroundColor: '#E3F2FD' },
  sngljun: { shape: 'circle', width: 50, height: 50, rotation: 0, backgroundColor: '#E8F5E9' },
  pipe: { shape: 'rectangle', width: 60, height: 200, rotation: 0, backgroundColor: '#FFF3E0' },
  branch: { shape: 'rectangle', width: 100, height: 150, rotation: 0, backgroundColor: '#E0F7FA' },
  separatr: { shape: 'rectangle', width: 100, height: 150, rotation: 0, backgroundColor: '#E0F7FA' },
  tmdpvol: { shape: 'rectangle', width: 80, height: 120, rotation: 0, backgroundColor: '#F3E5F5' },
  tmdpjun: { shape: 'circle', width: 50, height: 50, rotation: 0, backgroundColor: '#FCE4EC' },
  mtpljun: { shape: 'rectangle', width: 120, height: 140, rotation: 0, backgroundColor: '#EFEBE9' },
  pump: { shape: 'pump-centrifugal', width: 80, height: 80, rotation: 0, backgroundColor: '#F3E5F5' },
  valve: { shape: 'valve-bowtie', width: 60, height: 60, rotation: 0, backgroundColor: '#EDE7F6' },
  turbine: { shape: 'rectangle', width: 100, height: 150, rotation: 0, backgroundColor: '#ECEFF1' },
  htstr: { shape: 'hatched-rect', width: 60, height: 120, rotation: 0, backgroundColor: '#FBE9E7' },
  tank: { shape: 'rectangle', width: 100, height: 150, rotation: 0, backgroundColor: '#E0F7FA' },
};

/**
 * 컴포넌트 타입별 기본 외형 반환
 * MARSNodeData.appearance가 undefined일 때 사용
 */
export function getDefaultAppearance(componentType: ComponentType): NodeAppearance {
  return { ...DEFAULT_APPEARANCES[componentType] };
}

/**
 * appearance가 있으면 사용, 없으면 기본값 반환
 */
export function resolveAppearance(
  appearance: NodeAppearance | undefined,
  componentType: ComponentType,
): NodeAppearance {
  if (appearance) return appearance;
  return getDefaultAppearance(componentType);
}

// ============================================================================
// 타입별 기본 색상 (상태 표시용)
// ============================================================================

export const STATUS_COLORS = {
  incomplete: '#ffa726',
  valid: '#66bb6a',
  error: '#ef5350',
} as const;

// ============================================================================
// 도형별 CSS clip-path
// ============================================================================

export function getShapeClipPath(shape: NodeShape): string | undefined {
  switch (shape) {
    case 'triangle':
      return 'polygon(50% 0%, 0% 100%, 100% 100%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    default:
      return undefined;
  }
}

/**
 * 도형별 border-radius
 */
export function getShapeBorderRadius(shape: NodeShape, rotation: NodeRotation = 0): string | number {
  switch (shape) {
    case 'circle':
      return '50%';
    case 'semicircle': {
      // 좌우 분할 반원 (D형) - 회전에 따라 둥근 면 방향 변경
      // 0°: 오른쪽 둥금 (D), 90°: 위쪽 둥금 (∩), 180°: 왼쪽 둥금 (Ↄ), 270°: 아래쪽 둥금 (∪)
      const map: Record<NodeRotation, string> = {
        0:   '0 9999px 9999px 0',       // flat left, round right
        90:  '9999px 9999px 0 0',        // round top, flat bottom
        180: '9999px 0 0 9999px',        // round left, flat right
        270: '0 0 9999px 9999px',        // flat top, round bottom
      };
      return map[rotation];
    }
    default:
      return 0;
  }
}

// ============================================================================
// SVG Shape 판별 및 P&ID 심볼 정의
// ============================================================================

/**
 * SVG 기반 렌더링이 필요한 shape인지 판별
 */
export function isSvgShape(shape: NodeShape): boolean {
  return shape === 'valve-bowtie' || shape === 'pump-centrifugal' || shape === 'custom';
}

/**
 * P&ID SVG path 정의 (viewBox 기준 좌표)
 */
export const PID_SVG_PATHS: Record<string, { viewBox: string; paths: string[] }> = {
  'valve-bowtie': {
    viewBox: '0 0 100 60',
    paths: [
      'M 0,0 L 50,30 L 0,60 Z',    // 좌측 삼각형
      'M 100,0 L 50,30 L 100,60 Z', // 우측 삼각형
    ],
  },
  'pump-centrifugal': {
    viewBox: '0 0 50 39',
    paths: [
      // 원형 본체 + 토출 노즐 (단일 path, 표준 P&ID 원심펌프)
      'M 49.275,1.008 L 49.275,18.605 L 37.768,18.605 C 37.781,18.89 37.788,19.176 37.788,19.464 C 37.788,29.716 29.478,38.026 19.226,38.026 C 8.974,38.026 0.664,29.716 0.664,19.464 C 0.664,9.212 8.974,0.902 19.226,0.902 C 19.9,0.902 20.566,0.938 21.222,1.008 Z',
    ],
  },
};

// ============================================================================
// 선택 가능한 도형 목록 (그룹별)
// ============================================================================

export const AVAILABLE_SHAPES: { value: NodeShape; label: string; group: string }[] = [
  // Basic Shapes
  { value: 'rectangle', label: 'Rectangle', group: 'Basic' },
  { value: 'circle', label: 'Circle', group: 'Basic' },
  { value: 'diamond', label: 'Diamond', group: 'Basic' },
  { value: 'triangle', label: 'Triangle', group: 'Basic' },
  { value: 'hatched-rect', label: 'Hatched Rect', group: 'Basic' },
  { value: 'semicircle', label: 'Semicircle', group: 'Basic' },
  // P&ID Symbols
  { value: 'valve-bowtie', label: 'Valve (Bowtie)', group: 'P&ID' },
  { value: 'pump-centrifugal', label: 'Pump (Centrifugal)', group: 'P&ID' },
  // Custom
  { value: 'custom', label: 'Custom SVG', group: 'Custom' },
];

// ============================================================================
// 프리셋 색상 팔레트
// ============================================================================

export const COLOR_PRESETS = [
  '#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', // Blue
  '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', // Green
  '#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D', // Orange
  '#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8', // Purple
  '#FCE4EC', '#F8BBD0', '#F48FB1', '#F06292', // Pink
  '#FBE9E7', '#FFCCBC', '#FFAB91', '#FF8A65', // Deep Orange
  '#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', // Cyan
  '#EFEBE9', '#D7CCC8', '#BCAAA4', '#A1887F', // Brown
];

// ============================================================================
// 최소/최대 크기 제한
// ============================================================================

export const NODE_SIZE_LIMITS = {
  minWidth: 10,
  minHeight: 10,
};

// ============================================================================
// 회전 관련 헬퍼
// ============================================================================

/**
 * 회전에 따른 핸들 Position 매핑 (시계방향 회전)
 * 0°: Left→Left   90°: Left→Top    180°: Left→Right   270°: Left→Bottom
 */
const ROTATION_POSITION_MAP: Record<NodeRotation, Record<string, Position>> = {
  0:   { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom },
  90:  { left: Position.Top, right: Position.Bottom, top: Position.Right, bottom: Position.Left },
  180: { left: Position.Right, right: Position.Left, top: Position.Bottom, bottom: Position.Top },
  270: { left: Position.Bottom, right: Position.Top, top: Position.Left, bottom: Position.Right },
};

/**
 * 기본 핸들 Position을 회전 각도에 따라 변환
 */
export function getRotatedPosition(basePosition: Position, rotation: NodeRotation): Position {
  if (rotation === 0) return basePosition;
  const key = basePosition === Position.Left ? 'left'
    : basePosition === Position.Right ? 'right'
    : basePosition === Position.Top ? 'top' : 'bottom';
  return ROTATION_POSITION_MAP[rotation][key];
}

/**
 * 회전을 고려한 표시 크기 반환
 * 90°/270°에서는 width↔height 스왑
 */
export function getDisplayDimensions(width: number, height: number, rotation: NodeRotation) {
  const isSwapped = rotation === 90 || rotation === 270;
  return {
    displayWidth: isSwapped ? height : width,
    displayHeight: isSwapped ? width : height,
  };
}

// ============================================================================
// 도형별 배경 이미지 (hatched-rect 패턴)
// ============================================================================

/**
 * hatched-rect 도형을 위한 대각선 해칭 패턴
 */
export function getShapeBackgroundImage(shape: NodeShape): string | undefined {
  if (shape === 'hatched-rect') {
    return 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)';
  }
  return undefined;
}

// ============================================================================
// 사용 가능한 회전 값
// ============================================================================

export const AVAILABLE_ROTATIONS: { value: NodeRotation; label: string }[] = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
];

// ============================================================================
// 컴포넌트 ID 약식 표기 (MARS Nodalization 규칙)
// ============================================================================

/**
 * MARS Nodalization 규칙에 따른 약식 컴포넌트 ID 반환
 * - 수력학 컴포넌트: C + 앞 3자리 (예: 1300000 → C130)
 * - 열구조체(HTSTR): S + 앞 4자리 (예: 1200000 → S1200)
 */
export function formatDisplayId(componentId: string, componentType: ComponentType): string {
  if (componentType === 'htstr') {
    return 'S' + componentId.substring(0, 4);
  }
  return 'C' + componentId.substring(0, 3);
}
