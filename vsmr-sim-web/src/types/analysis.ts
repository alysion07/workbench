/**
 * Analysis 페이지 관련 타입 정의
 * plotfl 파일 파싱 결과 및 변수 트리 구조
 */

/** plotfl 변수 타입 */
export type PlotVariableType = 'rktpow' | 'cntrlvar' | 'p' | 'tempf' | 'tempg' | 'mflowj';

/** 변수 타입별 한글 라벨 및 단위 */
export const VARIABLE_TYPE_META: Record<PlotVariableType, { label: string; unit: string }> = {
  rktpow: { label: '원자로 출력', unit: 'W' },
  cntrlvar: { label: '제어변수', unit: '' },
  p: { label: '압력', unit: 'Pa' },
  tempf: { label: '유체온도', unit: 'K' },
  tempg: { label: '기체온도', unit: 'K' },
  mflowj: { label: '질량유량', unit: 'kg/s' },
};

/** 파싱된 개별 변수 정보 */
export interface PlotVariable {
  /** 컬럼 인덱스 (0 = time) */
  columnIndex: number;
  /** 변수 타입 (p, tempf 등) */
  type: PlotVariableType;
  /** 컴포넌트 ID (예: "280070000") 또는 제어변수 번호 (예: "324") */
  componentId: string;
  /** 차트에서 사용할 고유 데이터 키 (예: "p_280070000") */
  dataKey: string;
}

/** plotfl 파싱 결과 */
export interface ParsedPlotFile {
  /** 변수 목록 (time 제외) */
  variables: PlotVariable[];
  /** 시계열 데이터 - 각 행은 { time, p_280070000: ..., tempf_191020000: ... } 형태 */
  data: Array<Record<string, number>>;
  /** 전체 시간 범위 [min, max] */
  timeRange: [number, number];
}

/** 변수 탐색기 트리 노드 */
export interface VariableTreeNode {
  /** 노드 ID */
  id: string;
  /** 표시 라벨 */
  label: string;
  /** 자식 노드 */
  children?: VariableTreeNode[];
  /** 리프 노드인 경우 대응하는 PlotVariable */
  variable?: PlotVariable;
}

/** 선택된 변수 (차트에 표시할) */
export interface SelectedVariable {
  /** 차트 LineChart에서 조회할 키. Co-Sim 시 "<modelId>::<originalKey>" 형태 */
  dataKey: string;
  label: string;
  color: string;
  unit: string;
  /** Co-Sim에서 모델 구분용. 단일 모델(로컬 업로드 등)에서는 생략 */
  modelId?: string;
  /** 프리픽스 없는 원본 dataKey. 모델 간 같은 변수 매칭 시 사용 */
  originalKey?: string;
}

/** 차트 패널 */
export interface ChartPanel {
  /** 패널 고유 ID */
  id: string;
  /** 패널 제목 */
  title: string;
  /** 이 패널에 표시할 변수 목록 */
  variables: SelectedVariable[];
}
