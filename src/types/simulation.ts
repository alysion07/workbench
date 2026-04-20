// Simulation 관련 TypeScript 타입 정의

/**
 * 통합 시뮬레이션 상태 (세션 레벨 + 모델 레벨 공용)
 * - 'building': Build 진행 중 (기존 'pending')
 * - 'resumed' 제거: 'running'으로 통합
 */
export type SimStatus = 'building' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';

/**
 * SimState 스트림 스냅샷 (BFF -> Web)
 */
export interface SimStateSnapshot {
  task_id: string;
  seq: number;
  ts_ms: number;
  timehy: number;
  status: string;
  iteration_count: number;
  target_speed: number;
  actual_speed: number;
  max_speed: number;
}

/**
 * 시뮬레이션 작업 모드
 */
export type TaskMode = 'new' | 'restart';

/**
 * 플롯 데이터 포인트
 */
export interface PlotData {
  time: number;                  // 시뮬레이션 시간
  [key: string]: number;         // 동적 센서 데이터 (p1, tempf1, mflowj1 등)
}

/**
 * MinorEdit 스냅샷 (이름 보존 버전 — Interactive Control 위젯 매핑용)
 */
export interface MinorEditNamedValue {
  name: string;   // MARS variable name (e.g. "v_da_p", "j_da_mflowj")
  value: number;
}

export interface MinorEditNamedSnapshot {
  timehy: number;           // 시뮬레이션 시간 (ms)
  tsMs: number;             // wall-clock timestamp (ms)
  seq: number;
  values: MinorEditNamedValue[];
}

/**
 * 선 스타일 프리셋
 */
export type LineStylePreset = 'solid' | 'dotted' | 'dashed';

/**
 * 선 굵기 프리셋
 */
export type LineWidthPreset = 'thin' | 'normal' | 'bold';

/**
 * 개별 라인의 커스텀 스타일
 */
export interface LineStyle {
  color?: string;                  // hex 색상 (미지정 시 ChartConfig.dataKeys의 color 사용)
  stylePreset?: LineStylePreset;   // 선 스타일 (기본: 'solid')
  widthPreset?: LineWidthPreset;   // 선 굵기 (기본: 'normal')
}

/**
 * 차트 내 라인별 스타일 맵
 * key: dataKey (예: "p_10001", "tempf_20001")
 */
export type ChartLineStyles = Record<string, LineStyle>;

/**
 * 차트 크기 정의
 */
export type ChartSize = 'small' | 'medium' | 'large';

/**
 * 차트 레이아웃 정보 (react-grid-layout용)
 */
export interface ChartLayout {
  x: number;                      // 그리드 X 위치
  y: number;                      // 그리드 Y 위치
  w: number;                      // 그리드 너비 (칼럼 수)
  h: number;                      // 그리드 높이 (행 수)
  minW?: number;                  // 최소 너비
  minH?: number;                  // 최소 높이
  maxW?: number;                  // 최대 너비
  maxH?: number;                  // 최대 높이
}

/**
 * 차트 요약 정보
 */
export interface ChartSummary {
  chartId: string;                // 차트 ID
  currentValue: number | null;     // 현재값
  minValue: number | null;        // 최솟값
  maxValue: number | null;        // 최댓값
  sparklineData: Array<{          // 스파크라인 데이터 (최근 N개 포인트, 각 dataKey 포함)
    time: number;
    [key: string]: number;        // 각 dataKey의 값
  }>;
}

/**
 * 사용자 정의 탭 구성
 */
export interface CustomTab {
  id: string;                     // 탭 고유 ID
  label: string;                  // 탭 라벨
  chartIds: string[];             // 포함할 차트 ID 목록
  isDefault?: boolean;             // 기본 탭 여부
}

/**
 * 차트 구성
 */
export interface ChartConfig {
  id: string;                    // 차트 고유 ID
  title: string;                 // 차트 제목
  type: 'line' | 'area' | 'scatter' | 'heatmap' | 'gauge';
  sensors?: ChartSensor[];        // 표시할 센서 목록 (legacy)
  dataKeys?: Array<{              // 데이터 키 목록 (Minor Edit 기반)
    key: string;
    label: string;
    color: string;
  }>;
  unit?: string;                  // 단위 (예: 'Pa', 'K')
  yAxisDomain?: [number, number] | ['auto', 'auto']; // Y축 도메인
  yAxis?: {
    label: string;
    min?: number;
    max?: number;
  };
  xAxis?: {
    label: string;
    min?: number;
    max?: number;
  };
  // Minor Edit 기반 필드
  minorEditCardNumber?: number;   // 301-399
  yAxisMode?: 'fixed' | 'auto';   // 사용자 토글 가능한 Y축 모드
  yAxisFixed?: [number, number];   // 고정 Y축 범위 [lowerLimit, upperLimit]
  editGroup?: number;              // 편집 그룹 번호 (탭 그룹화용)
  editPriority?: number;           // 그룹 내 우선순위
  // 레이아웃 관련 필드
  size?: ChartSize;                // 차트 크기 (small: 1x1, medium: 2x1, large: 2x2)
  tags?: string[];                 // 태그 (필터링용, 예: 'Pressure', 'Temperature')
}

/**
 * 차트 센서 정의
 */
export interface ChartSensor {
  key: string;                   // 데이터 키 (예: 'p1', 'tempf1')
  label: string;                 // 표시 이름
  color?: string;                // 라인 색상
  unit?: string;                 // 단위 (예: 'Pa', 'K')
}

/**
 * 차트 그룹
 */
export interface ChartGroup {
  id: string;                    // 그룹 ID
  title: string;                 // 그룹 제목
  type: string;                  // 그룹 타입
  layout: 'primary' | 'secondary' | 'tertiary' | 'auxiliary';
  charts: ChartConfig[];         // 차트 목록
}

/**
 * 대시보드 레이아웃
 * Note: 기존 ChartLayout과 이름 충돌로 DashboardLayout으로 변경 (Line 38의 ChartLayout은 개별 차트 위치용)
 */
export interface DashboardLayout {
  grid: {
    columns: number;
    rows: number;
  };
  sections: ChartSection[];
}

/**
 * 차트 섹션
 */
export interface ChartSection {
  title: string;
  charts: ChartGroup[];
  span: {
    cols: number;
    rows: number;
  };
}

/**
 * 데이터 갭 정보
 */
export interface DataGap {
  start: number;                 // 시작 시퀀스
  end: number;                   // 종료 시퀀스
  missed: number;                // 누락된 데이터 수
  timestamp: number;             // 감지 시각
}

/**
 * 데이터 품질 지표
 */
export interface DataQuality {
  missedUpdates: number;         // 누락된 업데이트 수
  recoveryAttempts: number;      // 복구 시도 횟수
  lastGapTime: number | null;    // 마지막 갭 발생 시각
  isHealthy: boolean;            // 건강 상태
}

/**
 * 로그 수준
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * 로그 항목
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  source?: string;
}

/**
 * 폴링 옵션
 */
export interface PollingOptions {
  interval?: number;             // 폴링 간격 (ms)
  maxRetries?: number;           // 최대 재시도 횟수
  timeout?: number;              // 타임아웃 (ms)
  onScreenLog?: (log: string) => void;
  onPlotLog?: (log: string) => void;
  onScreenComplete?: () => void;
  onPlotComplete?: () => void;
  onError?: (error: Error, type: 'screen' | 'plot') => void;
}

/**
 * 노드 그룹 분석 결과
 */
export interface NodeGroupAnalysis {
  volumes: NodeVolume[];
  junctions: NodeJunction[];
  heatStructures: NodeHeatStructure[];
  controllers: NodeController[];
  boundaries: NodeBoundary[];
}

/**
 * Volume 노드 정보
 */
export interface NodeVolume {
  id: number;
  name: string;
  type?: 'pipe';
  sensors: string[];
}

/**
 * Junction 노드 정보
 */
export interface NodeJunction {
  id: number;
  name: string;
  fromVolume?: number;
  toVolume?: number;
  sensors: string[];
}

/**
 * Heat Structure 노드 정보
 */
export interface NodeHeatStructure {
  id: number;
  name: string;
  sensors: string[];
}

/**
 * Controller 노드 정보
 */
export interface NodeController {
  id: number;
  name: string;
  type: string;
  sensors: string[];
}

/**
 * Boundary 노드 정보
 */
export interface NodeBoundary {
  id: number;
  name: string;
  type: string;
  sensors: string[];
}

/**
 * 연결 관계 분석
 */
export interface ConnectionAnalysis {
  loops: Loop[];
  branches: Branch[];
}

/**
 * 루프 정보
 */
export interface Loop {
  id: string;
  junctions: number[];
  volumes: number[];
}

/**
 * 분기 정보
 */
export interface Branch {
  id: string;
  fromJunction: number;
  toJunctions: number[];
}

// ============================================
// Co-Simulation 타입 정의
// ============================================

// SimulationStatus는 SimStatus로 통합됨 (하위 호환용 alias)
export type SimulationStatus = SimStatus;

/**
 * 모델별 데이터 (식별 + lifecycle + 실시간 스트리밍)
 */
export interface ModelSimData {
  // 식별
  modelId: string;
  modelName: string;
  taskId: string;
  taskIndex: number;
  // lifecycle (기존 Job에서 통합)
  status: SimStatus;
  args: string;
  taskMode: TaskMode;
  startTime: number;
  endTime?: number;
  progress?: number;
  error?: string;
  lastSimState?: SimStateSnapshot;
  // streaming data
  plotData: PlotData[];
  screenLogs: string[];
  latestMinorEdit: MinorEditNamedSnapshot | null;
  runtimeMinorEdits: import('../types/mars').MinorEdit[] | null;
}

/**
 * Co-Sim 세션
 */
export interface CoSimSession {
  simId: string;
  projectId: string;
  status: SimStatus;
  startTime: number;
  models: Record<string, ModelSimData>;  // key = modelId
}
