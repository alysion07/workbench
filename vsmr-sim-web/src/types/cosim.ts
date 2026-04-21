/**
 * Co-Simulation (preCICE) 설정 타입
 *
 * 프론트엔드에서 GUI로 설정 → precice-config.xml + precice_mars.nml 파일 자동 생성
 */

// ============================================
// preCICE Data Name ↔ MARS Variable 매핑
// ============================================

/** preCICE 교환 데이터 이름 */
export type PreciceDataName = 'T_WALL' | 'Q_WALL';

/** MARS write_variable 이름 */
export type MarsWriteVariable = 'httmp' | 'htrnro';

/** preCICE data name → MARS variable 하드코딩 매핑 */
export const PRECICE_TO_MARS_VARIABLE: Record<PreciceDataName, MarsWriteVariable> = {
  T_WALL: 'httmp',
  Q_WALL: 'htrnro',
};

/** preCICE data name 드롭다운 옵션 */
export const PRECICE_DATA_OPTIONS: { value: PreciceDataName; label: string }[] = [
  { value: 'T_WALL', label: 'T_WALL (온도)' },
  { value: 'Q_WALL', label: 'Q_WALL (열유속)' },
];

// ============================================
// coupling_ids 컴포넌트 그룹 정의
// ============================================

/** 단일 컴포넌트의 coupling 그룹 설정 */
export interface CouplingComponentGroup {
  /** 컴포넌트 번호 (3자리, 예: "310") */
  componentNumber: string;
  /** 그룹 목록 */
  groups: CouplingGroup[];
}

/** 그룹 내 범위 */
export interface CouplingGroup {
  /** 그룹 번호 (1자리, 예: 1) */
  groupNumber: number;
  /** 시작 노드 번호 (1~999) */
  startNode: number;
  /** 끝 노드 번호 (1~999) */
  endNode: number;
}

// ============================================
// NML 설정 (커플링 경계면 + 모델별)
// ============================================

/** 모델별 NML 설정 — write/read data + init_wdata */
export interface NmlModelConfig {
  writeDataName: PreciceDataName | '';
  readDataName: PreciceDataName | '';
  /** 초기값 (선택, Fortran double 형식 문자열, 예: "560.d0") */
  initWdata?: string;
}

/** NML 설정 전체 — 공통 coupling_ids + 모델별 설정 */
export interface NmlConfig {
  /** 컴포넌트 그룹 기반 설정 */
  componentGroups: CouplingComponentGroup[];
  /** Model 1 설정 */
  model1: NmlModelConfig;
  /** Model 2 설정 (write/read는 Model 1의 반전) */
  model2: NmlModelConfig;
}

// ============================================
// XML 설정 (프로젝트 레벨)
// ============================================

export type CouplingSchemeType =
  | 'serial-explicit'
  | 'serial-implicit'
  | 'parallel-explicit'
  | 'parallel-implicit';

export type MappingType = 'nearest-neighbor' | 'nearest-projection';

export interface XmlConfig {
  schemeType: CouplingSchemeType | '';
  maxTime: number;
  timeWindowSize: number;
  mappingType: MappingType | '';
}

export const COUPLING_SCHEME_OPTIONS: { value: CouplingSchemeType; label: string }[] = [
  { value: 'serial-explicit', label: 'Serial Explicit' },
  { value: 'serial-implicit', label: 'Serial Implicit' },
  { value: 'parallel-explicit', label: 'Parallel Explicit' },
  { value: 'parallel-implicit', label: 'Parallel Implicit' },
];

export const MAPPING_TYPE_OPTIONS: { value: MappingType; label: string }[] = [
  { value: 'nearest-neighbor', label: 'Nearest Neighbor' },
  { value: 'nearest-projection', label: 'Nearest Projection' },
];

// ============================================
// 레거시 호환 (supabase.ts Model 타입에서 참조)
// ============================================

/** @deprecated 프로젝트 레벨 CoSimConfig.nml로 통합됨 */
export interface NmlCouplingConfig {
  couplingMappings?: unknown[];
}

// ============================================
// Co-Sim 설정 전체
// ============================================

/** 프로젝트 레벨 Co-Sim 설정 (저장 대상) */
export interface CoSimConfig {
  /** NML 설정 (커플링 경계면 + 모델별) */
  nml: NmlConfig;
  /** XML 설정 (프로젝트 레벨) */
  xml: XmlConfig;
}

// ============================================
// 설정 완료 여부 판정
// ============================================

export interface CoSimValidationResult {
  isNmlComplete: boolean;
  isXmlComplete: boolean;
  isComplete: boolean;
  errors: string[];
}

// ============================================
// 유틸리티 함수
// ============================================

/** preCICE participant 이름 생성 — primary-scope / secondary-scope */
export function getParticipantName(modelIndex: number): string {
  return modelIndex === 0 ? 'primary-scope' : 'secondary-scope';
}

/** preCICE mesh 이름 생성 — {participantName}-mesh */
export function getMeshName(modelIndex: number): string {
  return `${getParticipantName(modelIndex)}-mesh`;
}

/** 컴포넌트 그룹에서 coupling_ids 배열 생성 */
export function generateCouplingIds(groups: CouplingComponentGroup[]): number[] {
  const ids: number[] = [];
  for (const comp of groups) {
    const ccc = parseInt(comp.componentNumber, 10);
    if (isNaN(ccc)) continue;
    for (const group of comp.groups) {
      for (let node = group.startNode; node <= group.endNode; node++) {
        ids.push(ccc * 10000 + group.groupNumber * 1000 + node);
      }
    }
  }
  return ids;
}

/** NmlModelConfig에서 write_variable 자동 도출 */
export function deriveWriteVariable(config: NmlModelConfig): MarsWriteVariable | '' {
  if (!config.writeDataName) return '';
  return PRECICE_TO_MARS_VARIABLE[config.writeDataName];
}

/** 기본 CoSimConfig 생성 — 모든 필드 미설정 상태로 초기화 */
export function createDefaultCoSimConfig(): CoSimConfig {
  return {
    nml: {
      componentGroups: [],
      model1: {
        writeDataName: '',
        readDataName: '',
      },
      model2: {
        writeDataName: '',
        readDataName: '',
      },
    },
    xml: {
      schemeType: '',
      maxTime: 0,
      timeWindowSize: 0,
      mappingType: '',
    },
  };
}

/** Co-Sim 설정 검증 */
export function validateCoSimConfig(config: CoSimConfig | null): CoSimValidationResult {
  const errors: string[] = [];

  if (!config) {
    return { isNmlComplete: false, isXmlComplete: false, isComplete: false, errors: ['Co-Sim 설정이 없습니다'] };
  }

  // NML 검증
  const couplingIds = generateCouplingIds(config.nml.componentGroups);
  const hasIds = couplingIds.length > 0;
  const hasModel1Write = !!config.nml.model1.writeDataName;
  const hasModel2Write = !!config.nml.model2.writeDataName;

  if (!hasIds) errors.push('커플링 경계면이 설정되지 않았습니다');
  if (!hasModel1Write) errors.push('Model 1 write_data_name이 설정되지 않았습니다');
  if (!hasModel2Write) errors.push('Model 2 write_data_name이 설정되지 않았습니다');

  const isNmlComplete = hasIds && hasModel1Write && hasModel2Write;

  // XML 검증
  const hasScheme = !!config.xml.schemeType;
  const hasMaxTime = config.xml.maxTime > 0;
  const hasTimeWindow = config.xml.timeWindowSize > 0;

  if (!hasScheme) errors.push('Coupling scheme이 설정되지 않았습니다');
  if (!hasMaxTime) errors.push('max-time이 0보다 커야 합니다');
  if (!hasTimeWindow) errors.push('time-window-size가 0보다 커야 합니다');

  const isXmlComplete = hasScheme && hasMaxTime && hasTimeWindow;

  return {
    isNmlComplete,
    isXmlComplete,
    isComplete: isNmlComplete && isXmlComplete,
    errors,
  };
}
