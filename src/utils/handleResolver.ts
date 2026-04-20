/**
 * Handle Resolver — VolumeReference → ReactFlow Handle ID 변환 (Single Source of Truth)
 *
 * Face 0 (Old Format) 포함 모든 face 값에 대해 일관된 핸들 ID를 반환합니다.
 * 시스템 전체에서 이 함수만 사용하여 VolumeReference → Handle ID 변환을 수행합니다.
 */

/**
 * VolumeReference의 face/volumeNum 정보를 해당 노드의 실제 ReactFlow Handle ID로 변환
 *
 * @param face - Volume face (0=Old Format, 1=inlet, 2=outlet, 3-6=crossflow)
 * @param volumeNum - Volume/cell number
 * @param componentType - 대상 노드의 컴포넌트 타입
 * @returns 실제 ReactFlow Handle ID 문자열
 */
export function resolveVolumeRefToHandle(
  face: number,
  volumeNum: number,
  componentType: string,
): string {
  // Face 0 (Old Format): 모든 볼륨 노드 공통 → hidden center 'auto-connect' 핸들
  if (face === 0) {
    return 'auto-connect';
  }

  // Pipe: cell 기반 핸들 (cell-{N}-face-{F})
  if (componentType === 'pipe') {
    return `cell-${volumeNum}-face-${face}`;
  }

  // Branch/Separator/Turbine/Tank: junction 기반 핸들 (target-j{N} / source-j{N})
  // volumeNum은 junction number로 사용, face 1=target, face 2=source
  if (['branch', 'separatr', 'turbine', 'tank'].includes(componentType)) {
    const handleType = face === 1 ? 'target' : 'source';
    const junctionNum = volumeNum >= 1 ? volumeNum : 1;
    return `${handleType}-j${junctionNum}`;
  }

  // 단일볼륨 (snglvol, tmdpvol) / Junction (sngljun, tmdpjun, valve, pump) 등:
  // face 1 = inlet, face 2+ = outlet
  return face === 1 ? 'inlet' : 'outlet';
}
