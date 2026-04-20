/**
 * MARS Component Types and Interfaces
 * Phase 1 MVP - 5 Core Components
 */

// ============================================================================
// Component Types
// ============================================================================

export type ComponentType =
  | 'snglvol'
  | 'sngljun'
  | 'pipe'
  | 'branch'
  | 'separatr'
  | 'tmdpvol'
  | 'tmdpjun'
  | 'mtpljun'
  | 'pump'
  | 'htstr'
  | 'valve'
  | 'turbine'
  | 'tank';

export type VolumeComponentType = 'snglvol' | 'branch' | 'separatr' | 'tmdpvol' | 'turbine' | 'tank';
export type JunctionComponentType = 'sngljun' | 'tmdpjun' | 'mtpljun' | 'valve';

// ============================================================================
// Project Category (계통)
// ============================================================================

export type ProjectCategory = 'nuclear' | 'power' | 'control';

// ============================================================================
// Validation
// ============================================================================

export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationError {
  level: ValidationLevel;
  message: string;
  nodeId?: string;
  edgeId?: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Volume ID Format: VVVCCNNNN
// VVV: Component number (100-999)
// CC: Volume number (01-99)
// NNNN: Face (0000=center, 0001=inlet, 0002=outlet)
// ============================================================================

export type VolumeId = string; // "120010002"

// ============================================================================
// Connection Types
// ============================================================================

export type ConnectionType = 'axial' | 'crossflow';

export type FaceType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ConnectionConfig {
  type: ConnectionType;
  // Junction 정보 (CrossFlow 연결 필수)
  junctionNodeId?: string;      // Junction 노드 ID (SNGLJUN/MTPLJUN)
  junctionNumber?: number;       // Junction 번호 (MTPLJUN만, 1~njuns)
  // From/To Volume 정보
  sourceNodeId: string;
  sourceCell: number;
  sourceFace: FaceType;
  targetNodeId: string;
  targetCell: number;
  targetFace: FaceType;
  // Crossflow 전용 설정
  area?: number;
  fwdLoss?: number;
  revLoss?: number;
  jefvcahs?: string;
}

// Crossflow Dialog 초기값 (Dialog 내부 상태명과 일치)
export interface CrossflowDialogInitialValues {
  junctionNodeId?: string;
  junctionNumber?: number;    // For MTPLJUN/BRANCH junction index
  // From Volume (Dialog 내부 상태명 사용)
  fromVolumeNodeId?: string;  // Dialog: fromVolumeNodeId
  fromCell?: number;          // Dialog: fromCell
  fromFace?: FaceType;        // Dialog: fromFace
  // To Volume
  toVolumeNodeId?: string;    // Dialog: toVolumeNodeId
  toCell?: number;            // Dialog: toCell
  toFace?: FaceType;          // Dialog: toFace
}

// ============================================================================
// Volume Reference (New ID Management System)
// Uses immutable node.id as reference key
// ============================================================================

export interface VolumeReference {
  nodeId: string;      // "node_a1b2c3d4" (immutable ReactFlow node ID)
  volumeNum: number;   // 1-99 (cell/volume number)
  face: number;        // 0-6 (0=center, 1=inlet, 2=outlet, 3-6=crossflow)
}

// Backward compatibility helper (for migration period)
export type VolumeIdOrReference = string | VolumeReference;

// ============================================================================
// Component Parameters
// ============================================================================

// --- SNGLVOL Parameters ---
export interface SnglvolParameters {
  // Basic Info
  name: string;

  // Geometry (Card CCC0101)
  xArea?: number;           // m² (0: use volume)
  xLength: number;          // m
  volume: number;           // m³

  // Angles (Card CCC0102)
  azAngle?: number;         // degree (default: 0)
  incAngle: number;         // degree (0=horizontal, 90=vertical)
  dz: number;               // m

  // Wall (Card CCC0103)
  wallRoughness?: number;   // m (default: 3.048e-5)
  hydraulicDiameter: number; // m
  tlpvbfe?: string;         // 7-digit flags (default: "0000000")

  // Initial Conditions (Card CCC0200)
  ebt: '001' | '002' | '003' | '004' | '005'; // equilibrium option
  pressure: number;         // Pa
  temperature?: number;     // K (for ebt=003)
  quality?: number;         // 0-1 (for ebt=002)
}

// --- SNGLJUN Parameters ---
export interface SngljunParameters {
  // Basic Info
  name: string;

  // Connection (Card CCC0101)
  from: VolumeReference;    // upstream volume reference
  to: VolumeReference;      // downstream volume reference
  area: number;             // m²

  // Loss Coefficients (Card CCC0102)
  fwdLoss: number;          // forward loss coefficient
  revLoss: number;          // reverse loss coefficient
  jefvcahs?: string;        // 8-digit flags (default: "00000000")

  // Initial Flow (Card CCC0201) - optional
  flowDirection?: 1 | -1 | 0; // 1=forward, -1=reverse, 0=stagnant
  mfl?: number;             // kg/s liquid flow
  mfv?: number;             // kg/s vapor flow
}

// --- PIPE Parameters ---
export interface PipeParameters {
  // Basic Info
  name: string;
  ncells: number;           // number of volumes (1-999)

  // Geometry (Cards CCC01XX) - arrays of length ncells
  // Two modes:
  // 1. Area-based: xArea > 0, volume = xArea × xLength (auto-calculated)
  // 2. Volume-based: xArea = 0, volume must be provided explicitly
  xArea: number[];          // m² (0: volume-based mode, >0: area-based mode)
  xLength: number[];        // m (required for all modes)
  volume: number[];         // m³ (required: explicit when xArea=0, calculated when xArea>0)

  // Angles (Cards CCC05XX, CCC06XX)
  // Can be single value (applied to all cells) or array (per-cell values)
  azAngle?: number | number[];     // degree (single: all cells, array: per-cell)
  vertAngle: number | number[];    // degree (single: all cells, array: per-cell)
  xElev?: number[];                // m elevation (optional, per-cell)

  // Wall (Card CCC0801)
  // Can be single value (same for all cells) or array (per-cell values)
  wallRoughness?: number | number[];   // m
  hydraulicDiameter: number | number[]; // m

  // Junction Area (Card CCC02XX) - optional
  // Can be single value (same for all junctions) or array (per-junction values)
  junctionArea?: number | number[];    // m² (per-junction area)

  // Loss Coefficients (Card CCC0901) - optional
  // Can be single value (same for all junctions) or array (per-junction values)
  fwdLoss?: number | number[];         // forward loss
  revLoss?: number | number[];         // reverse loss

  // Flags
  volumeFlags?: string | string[];     // 7-digit (default: "0000000")
  junctionFlags?: string | string[];   // 8-digit (default: "00000000")

  // Initial Conditions (Card CCC1201) - array of length ncells
  initialConditions: Array<{
    ebt: '001' | '002' | '003' | '004' | '005';
    pressure: number;       // Pa
    temperature?: number;   // K
    quality?: number;       // 0-1
  }>;

  // Junction Initial Conditions (Cards CCC1300-13XX) - optional
  junctionControl?: {
    controlWord: 0 | 1;     // 0: velocity (m/s), 1: mass flow (kg/s) [Card CCC1300]
    conditions: Array<{     // Cards CCC1301-13XX
      liquidVelOrFlow: number;  // W1: liquid velocity or mass flow (depends on controlWord)
      vaporVelOrFlow: number;   // W2: vapor velocity or mass flow (depends on controlWord)
      interfaceVel: number;     // W3: interface velocity (not implemented, use 0)
      junctionId: number;       // W4: junction ID (1 to ncells-1)
    }>;
  };

  // Junction Diameter and CCFL Data (Cards CCC1401-14XX) - Optional
  // 5 words per set in sequential expansion format for nv-1 sets
  ccflData?: {
    junctionDiameter: number | number[];  // W1: D_j (m), 0=auto-calculate from area
    beta: number | number[];              // W2: Flooding correlation form β (0=Wallis, 1=Kutateladze, 0~1=Bankoff)
    gasIntercept: number | number[];      // W3: Gas intercept c (default 1.0, must > 0)
    slope: number | number[];             // W4: Slope m (default 1.0, must > 0)
  };
}

// --- TMDPVOL Parameters ---
// εbt format: ε (fluid type) + b (boron flag) + t (thermodynamic option)
// Example: '003' = ε=0 (H₂O), b=0 (no boron), t=3 (P-T)
export type TmdpvolEbtFormat =
  | '000' | '001' | '002' | '003' | '004' | '005' | '006' | '007' | '008'  // ε=0, b=0 (H₂O, no boron)
  | '010' | '011' | '012' | '013' | '014' | '015' | '016' | '017' | '018'  // ε=0, b=1 (H₂O, with boron)
  | '100' | '101' | '102' | '103' | '104' | '105' | '106' | '107' | '108'  // ε=1, b=0 (D₂O, no boron)
  | '110' | '111' | '112' | '113' | '114' | '115' | '116' | '117' | '118'  // ε=1, b=1 (D₂O, with boron)
  | '200' | '201' | '202' | '203' | '204' | '205' | '206' | '207' | '208'; // ε=2, b=0 (other fluid)

// Search Variable Types for TMDPVOL/TMDPJUN CCC0200 W3
export type TmdpSearchVariableType = 'time' | 'p' | 'tempf' | 'cntrlvar' | 'voidf' | 'mflowj';

export const TMDP_SEARCH_VARIABLE_LABELS: Record<TmdpSearchVariableType, { label: string; unit: string; paramLabel: string }> = {
  time:     { label: 'Time',             unit: 's',    paramLabel: '' },
  p:        { label: 'Pressure',         unit: 'Pa',   paramLabel: 'Volume ID (9 digits)' },
  tempf:    { label: 'Temperature',      unit: 'K',    paramLabel: 'Volume ID (9 digits)' },
  cntrlvar: { label: 'Control Variable', unit: '',     paramLabel: 'Control Variable Number' },
  voidf:    { label: 'Void Fraction',    unit: '',     paramLabel: 'Volume ID (9 digits)' },
  mflowj:   { label: 'Mass Flow',        unit: 'kg/s', paramLabel: 'Junction ID (9 digits)' },
};

export interface TmdpvolTimePoint {
  time: number;           // s (search variable value)

  // Thermodynamic data (depends on t option)
  pressure?: number;      // Pa (t=0,2,3,4,6,7,8)
  temperature?: number;   // K (t=1,3,4,5,8)
  quality?: number;       // 0-1 (t=1,2,4,5,8) - static quality xs

  // Internal energy (t=0,6)
  internalEnergyLiquid?: number;  // J/kg (Uf)
  internalEnergyVapor?: number;   // J/kg (Ug)

  // Void fraction (t=0,6,7)
  voidFraction?: number;  // 0-1 (αg)

  // Noncondensable quality (t=4,5,6)
  noncondensableQuality?: number; // 0-1 (xn)

  // Boron concentration (if b=1)
  boronConcentration?: number;    // ppm

  // t=7: Separate liquid/vapor temperatures (TRACE compatible)
  temperatureLiquid?: number;     // K (Tf, t=7)
  temperatureVapor?: number;      // K (Tg, t=7)

  // t=8: Relative humidity
  relativeHumidity?: number;      // 0-1 (RH, t=8)
}

export interface TmdpvolParameters {
  // Basic Info
  name: string;

  // Geometry (Card CCC0101)
  // Rule: A × L = V (at least 2 must be non-zero, 1 can be 0 for auto-calc)
  area?: number;            // m² (0: auto-calculate from V/L)
  length?: number;          // m (0: auto-calculate from V/A)
  volume: number;           // m³ (0: auto-calculate from A×L)

  // Angles (Card CCC0102)
  azAngle?: number;         // degree (|angle| < 360°)
  incAngle: number;         // degree (|angle| < 90°)
  dz: number;               // m (|dz| ≤ length)

  // Wall (Card CCC0103)
  wallRoughness?: number;   // m
  hydraulicDiameter?: number; // m
  tlpvbfe?: string;         // 7-digit flags (TMDPVOL must be 0000000)

  // Boundary Condition Type (Card CCC0200)
  // εbt format: ε (0-2: fluid type) + b (0-1: boron) + t (0-8: thermodynamic option)
  conditionType: TmdpvolEbtFormat;

  // Time-dependent Data (Cards CCC0201-020N, max 5000 entries)
  timeTable: TmdpvolTimePoint[];

  // Optional: Search variable control (Card CCC0200 W2-W4)
  tripNumber?: number;                    // W2: Trip number (0 or omitted = no trip)
  variableType?: TmdpSearchVariableType;  // W3: Search variable type (default: 'time')
  variableCode?: number;                  // W4: Component ID for search variable
}

// --- Crossflow Volume Data (CCC0181-0189, CCC0191-0199) ---
// Branch/Turbine의 y/z 방향 교차흐름 볼륨 기하학 데이터
// 매뉴얼 8.10.5 (Y-Coordinate), 8.10.6 (Z-Coordinate)
export interface CrossflowVolumeData {
  area: number;              // W1: 유동 면적 m² (0 = auto-calculate)
  length: number;            // W2: 길이 m
  roughness: number;         // W3: 표면 조도 m
  hydraulicDiameter: number; // W4: 수력 직경 m
  controlFlags: string;      // W5: 볼륨 제어 플래그 (형식: 00000f0)
  dz: number;                // W8: z방향 위치 변화 m (W6, W7은 미사용=0)
}

// --- BRANCH Parameters ---
export type FaceN = 1 | 2 | 3 | 4 | 5 | 6;

export interface BranchJunction {
  junctionNumber: number;          // 1-9 (N in CCCN101, 연속적일 필요 없음)
  direction: 'inlet' | 'outlet';   // UI 메타데이터 (검증/배치용, 파일에는 기록하지 않음)
  branchFace: FaceN;               // 브랜치 측 face 번호 (1-6, 필수)
  // 1-2: 주축 방향, 3-6: 크로스플로우
  // 이 값으로 브랜치 Volume ID 생성: CCC01000{branchFace}

  // Connection (Card CCCN101)
  from: VolumeReference;           // 상대 노드 측 volume reference
  to: VolumeReference;             // 상대 노드 측 volume reference
  area: number;                    // m² (0 = auto: minimum adjacent volume)

  // Loss Coefficients (Card CCCN102)
  fwdLoss: number;                 // forward loss coefficient
  revLoss: number;                 // reverse loss coefficient
  jefvcahs?: string;               // 8-digit flags (default: "00000000")

  // Energy Exchange (Card CCCN103) - OPTIONAL
  dischargeCoefficient?: number;   // discharge coefficient (default: 1.0)
  thermalConstant?: number;        // thermal nonequilibrium constant (default: 0.14)

  // Junction Diameter and CCFL Data (Card CCCN110) - OPTIONAL
  // Required when f-flag=1 in jefvcahs, or to specify junction hydraulic diameter
  junctionDiameter?: number;       // W1: D_j (m), 0 = auto from area (default: 0)
  ccflBeta?: number;               // W2: β, 0=Wallis, 1=Kutateladze, 0~1=Bankoff (default: 0)
  ccflGasIntercept?: number;       // W3: c, gas intercept >0 (default: 1.0)
  ccflSlope?: number;              // W4: m, slope >0 (default: 1.0)

  // Initial Flow (Card CCCN201) - OPTIONAL
  initialLiquidFlow?: number;      // kg/s or m/s (depends on initialConditionControl)
  initialVaporFlow?: number;       // kg/s or m/s (depends on initialConditionControl)
}

export interface BranchParameters {
  // Basic Info
  name: string;

  // Number of junctions (Card CCC0001)
  njuns: number;                   // 2-9
  initialConditionControl?: 0 | 1; // 0=velocity, 1=mass flow (default: 0)

  // Volume Geometry (Card CCC0101)
  // Rule: A × L = V (at least 2 must be non-zero, 1 can be 0 for auto-calc)
  area?: number;                   // m² (0: auto-calculate from V/L)
  length: number;                  // m
  volume: number;                  // m³

  // Angles (Card CCC0101 continued)
  azAngle?: number;                // degree (|angle| < 360°)
  incAngle: number;                // degree (|angle| ≤ 90°, 0=horizontal)
  dz: number;                      // m (elevation change, |dz| ≤ length)

  // Wall (Card CCC0103)
  wallRoughness?: number;          // m (default: 3.048e-5)
  hydraulicDiameter: number;       // m
  tlpvbfe?: string;                // 7-digit flags (default: "0000000")

  // Initial Conditions (Card CCC0200)
  ebt: '001' | '002' | '003' | '004' | '005'; // equilibrium option
  pressure: number;                // Pa
  temperature?: number;            // K (for ebt=003)
  quality?: number;                // 0-1 (for ebt=002)

  // Junctions (Card CCCN101-N109, N=1-9)
  junctions: BranchJunction[];     // length = njuns (2-9)

  // Y/Z-Coordinate Crossflow Volume Data (Optional)
  yCrossflowData?: CrossflowVolumeData;  // Card CCC0181 (y방향)
  zCrossflowData?: CrossflowVolumeData;  // Card CCC0191 (z방향)
}

// --- SEPARATOR Parameters ---
// MARS 매뉴얼 8.11절: "Specialized Branch" — 볼륨 1개 + 고정 3개 접합부
// N=1: Vapor Outlet, N=2: Liquid Fall Back, N=3: Separator Inlet

export type SeparatorOption = 0 | 1 | 2 | 3;
// 0 = Simple separator (RELAP5 default)
// 1 = GE dryer model
// 2 = GE two-stage separator
// 3 = GE three-stage separator

export interface SeparatorJunction extends BranchJunction {
  voidFractionLimit?: number;  // W7: VOVER(N=1, default 0.5) / VUNDER(N=2, default 0.15) / unused(N=3)
}

export interface SeparatorParameters {
  name: string;

  // Card CCC0001 - Component Info (nj is always 3, not exposed to user)
  initialConditionControl?: 0 | 1; // 0=velocity, 1=mass flow (default: 0)

  // Card CCC0002 - Separator Options
  separatorOption: SeparatorOption;       // ISEPST
  numSeparatorComponents?: number;        // Only needed when ISEPST=2,3

  // Volume Geometry (Card CCC0101) — same as Branch
  area?: number;                   // m²
  length: number;                  // m
  volume: number;                  // m³
  azAngle?: number;                // degree
  incAngle: number;                // degree
  dz: number;                      // m

  // Wall (Card CCC0101 continued)
  wallRoughness?: number;          // m (default: 3.048e-5)
  hydraulicDiameter: number;       // m
  volumeControlFlags?: string;     // "000001e" format (only e-flag variable, default: "0")

  // Initial Conditions (Card CCC0200) — same as Branch
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;                // Pa
  temperature?: number;            // K (for ebt=003)
  quality?: number;                // 0-1 (for ebt=002)

  // 3 Fixed Junctions (CCCN101, CCCN201, N=1,2,3)
  junctions: [SeparatorJunction, SeparatorJunction, SeparatorJunction];
}

// --- TURBINE Parameters ---
// MARS 매뉴얼 8.13절: "Specialized Branch" — 볼륨 1개 + 접합부 1~2개
// 접합부 구조는 BranchJunction을 재사용 (동일한 from/to VolumeReference 패턴)

export type TurbineType = 0 | 1 | 2 | 3;
// 0 = Two-row impulse stage group
// 1 = General impulse-reaction stage group
// 2 = Constant efficiency stage group
// 3 = Gas turbine (requires efficiency + mass flow rate data cards)

export interface TurbinePerfPair {
  pressureRatio: number;    // > 1.0
  value: number;            // efficiency (CCC0401-0450) or corrected mass flow rate (CCC0451-0499)
}

export interface TurbineParameters {
  // Basic Info
  name: string;

  // Component Information (Card CCC0001)
  njuns: 1 | 2;                    // 1: 주유동만, 2: 주유동 + 추기(bleed)
  initialConditionControl?: 0 | 1; // 0=velocity, 1=mass flow (default: 0)

  // Volume Geometry (Card CCC0101) — Branch와 동일
  area?: number;                   // m² (0: auto-calculate from V/L)
  length: number;                  // m
  volume: number;                  // m³
  azAngle?: number;                // degree (|angle| < 360°)
  incAngle: number;                // degree (|angle| ≤ 90°, 0=horizontal)
  dz: number;                      // m (elevation change, |dz| ≤ length)

  // Wall (Card CCC0102)
  wallRoughness?: number;          // m (default: 0.0)
  hydraulicDiameter: number;       // m (0: auto-calculate)
  tlpvbfe?: string;                // 제한: "000001e" 형식 (e-flag만 가변)

  // Volume Initial Conditions (Card CCC0200) — Branch와 동일
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;                // Pa
  temperature?: number;            // K (for ebt=003)
  quality?: number;                // 0-1 (for ebt=002)

  // Junctions (Card CCCN101-N109) — BranchJunction 재사용
  junctions: BranchJunction[];     // length = njuns (1-2)

  // Y/Z-Coordinate Crossflow Volume Data (Optional)
  yCrossflowData?: CrossflowVolumeData;  // Card CCC0181 (y방향)
  zCrossflowData?: CrossflowVolumeData;  // Card CCC0191 (z방향)

  // Shaft Geometry (Card CCC0300) — 터빈 고유
  shaftSpeed: number;              // rad/s or rev/min (축 회전 속도)
  stageInertia: number;            // kg·m² (회전 스테이지 관성)
  shaftFriction: number;           // N·m·s (축 마찰 계수)
  shaftComponentNumber: number;    // SHAFT 컴포넌트 번호
  disconnectTrip: number;          // 0 = 항상 연결, 비0 = 트립 번호
  drainFlag?: number;              // 0 (미사용)

  // Performance Data (Card CCC0400) — 터빈 고유
  turbineType: TurbineType;        // 0-3
  efficiency: number;              // h_0 (최대 효율점 실제 효율)
  reactionFraction: number;        // r (설계 반동분율)
  meanStageRadius: number;         // m (평균 단 반경)

  // Efficiency Data (Card CCC0401-0450) — type=3(가스터빈)만 필요
  efficiencyData?: TurbinePerfPair[];   // 최대 20쌍 (pressureRatio > 1.0, efficiency)

  // Mass Flow Rate Data (Card CCC0451-0499) — type=3(가스터빈)만 필요
  massFlowRateData?: TurbinePerfPair[]; // 최대 20쌍 (pressureRatio > 1.0, corrected mass flow rate)
}

// --- TANK Parameters ---
// MARS 매뉴얼 8.10절: Branch의 특수 변형 — 수위(Level) 추적 기능 추가
// Branch와 동일한 카드 체계 + Tank 전용 카드 2종 (CCC0400, CCC0401-0499)

export interface VolumeLevelPair {
  volume: number;   // m³
  level: number;    // m (오름차순)
}

export interface TankParameters {
  // Basic Info
  name: string;

  // Number of junctions (Card CCC0001) — Branch와 동일
  njuns: number;                   // 0-9
  initialConditionControl?: 0 | 1; // 0=velocity, 1=mass flow (default: 0)

  // Volume Geometry (Card CCC0101) — Branch와 동일
  area?: number;                   // m² (0: auto-calculate from V/L)
  length: number;                  // m
  volume: number;                  // m³
  azAngle?: number;                // degree (|angle| < 360°)
  incAngle: number;                // degree (|angle| ≤ 90°, 0=horizontal)
  dz: number;                      // m (elevation change, |dz| ≤ length)

  // Wall (Card CCC0101 continued)
  wallRoughness?: number;          // m (default: 3.048e-5)
  hydraulicDiameter: number;       // m
  tlpvbfe?: string;                // 7-digit flags (default: "0000000")

  // Initial Conditions (Card CCC0200)
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;                // Pa
  temperature?: number;            // K (for ebt=003)
  quality?: number;                // 0-1 (for ebt=002)

  // Junctions (Card CCCN101-N109) — BranchJunction 재사용
  junctions: BranchJunction[];     // length = njuns (0-9)

  // Y/Z-Coordinate Crossflow Volume Data (Optional)
  yCrossflowData?: CrossflowVolumeData;  // Card CCC0181
  zCrossflowData?: CrossflowVolumeData;  // Card CCC0191

  // ====== Tank 전용 필드 ======
  // Initial Liquid Level (Card CCC0400) — 필수
  initialLiquidLevel: number;      // m

  // Volume vs Level Curve (Card CCC0401-0499) — 필수, 최소 2쌍
  volumeLevelCurve: VolumeLevelPair[];
}

// --- TMDPJUN Parameters ---
export interface TmdpjunParameters {
  // Basic Info
  name: string;

  // Connection (Card CCC0101)
  // Format: CCCVV000N (N=1:inlet, 2:outlet, 3-6:crossflow)
  from: VolumeReference;
  to: VolumeReference;
  area: number;             // m² (0 = auto: minimum adjacent volume flow area)

  // Control flag (Card CCC0101) - e-flag only
  jefvcahs?: string;        // '00000000' (default) or '01000000' (Modified PV term)
  useModifiedPvTerm?: boolean; // UI toggle: true = '01000000', false = '00000000'

  // Boundary Condition Type (Card CCC0200)
  conditionType: 0 | 1;     // 0: velocity, 1: mass flow

  // Time-dependent Flow (Cards CCC0201-020N)
  timeTable: Array<{
    time: number;           // s (search variable value)
    mfl: number;            // kg/s liquid flow
    mfv: number;            // kg/s vapor flow
  }>;

  // Optional: Search variable control (Card CCC0200 W2-W4)
  tripNumber?: number;                    // W2: Trip number (0 or omitted = no trip)
  variableType?: TmdpSearchVariableType;  // W3: Search variable type (default: 'time')
  variableCode?: number;                  // W4: Component ID for search variable
}

// --- MTPLJUN Parameters ---
export interface MtpljunJunction {
  junctionNumber: number;        // 1-99 (junid, Card CCC0NNM W13)
  from: VolumeReference;           // Volume reference (Card CCC0NNM W1)
  to: VolumeReference;             // Volume reference (Card CCC0NNM W2)
  area: number;                  // m² (Card CCC0NNM W3, 0=auto)
  fwdLoss: number;               // Forward loss AF (Card CCC0NNM W4)
  revLoss: number;               // Reverse loss AR (Card CCC0NNM W5)
  jefvcahs: string;              // Junction control flags (Card CCC0NNM W6, format: 0ef0cahs)
  // W7-W9 meaning depends on c-flag in jefvcahs:
  // c=0 (Henry-Fauske): W7=discharge coeff(1.0), W8=thermal nonequil constant(0.14), W9=0.0
  // c=1 (RELAP5):       W7=subcooled dc(1.0),    W8=two-phase dc(1.0),              W9=superheated dc(1.0)
  dischargeCoeff: number;          // Henry-Fauske W7: discharge coefficient (default: 1.0)
  thermalConstant: number;         // Henry-Fauske W8: thermal nonequilibrium constant (default: 0.14)
  subDc: number;                   // RELAP5 W7: Subcooled discharge coefficient (default: 1.0)
  twoDc: number;                   // RELAP5 W8: Two-phase discharge coefficient (default: 1.0)
  supDc: number;                   // RELAP5 W9: Superheated discharge coefficient (default: 1.0)
  fIncre: number;                // From volume increment (Card CCC0NNM W10, default: 0)
  tIncre: number;                // To volume increment (Card CCC0NNM W11, default: 0)
  endJunction?: number;          // Sequential Expansion: 이 set이 커버하는 마지막 junction 번호
  initialLiquidFlow: number;      // mfl (Card CCC1NNM W1, velocity or mass flow)
  initialVaporFlow: number;      // mfv (Card CCC1NNM W2, velocity or mass flow)
  icEndJunction?: number;        // IC SEF: 이 IC set이 커버하는 마지막 junction 번호
}

export interface MtpljunParameters {
  // Basic Info
  name: string;

  // Multiple Junction Information (Card CCC0001)
  njuns: number;                 // Number of junctions (W1, 1-99)
  icond: 0 | 1;                  // Initial condition control (W2)
  // 0: velocities (m/s), 1: mass flows (kg/s)

  // Card format: 'combined' (6-word card11) or 'split' (3-card per junction)
  cardFormat?: 'combined' | 'split';

  // Junctions (Cards CCC0NNM, CCC1NNM)
  junctions: MtpljunJunction[];  // Array of junctions
}

// --- PUMP Homologous Curves Types ---
export type PumpCurvePoint = { x: number; y: number };

export type PumpCurveName =
  | 'han' | 'ban' | 'hvn' | 'bvn'  // Regime 1-2: 정방향 기본 영역
  | 'had' | 'bad' | 'hvd' | 'bvd'  // Regime 3-4: 정방향 저유량/특수
  | 'hat' | 'bat' | 'hvt' | 'bvt'  // Regime 5-6: 과유량/특수
  | 'har' | 'bar'                  // Regime 7: 역운전
  | 'hvr' | 'bvr';                 // Regime 8: 역운전 (a/v)

export interface PumpCurve {
  name: PumpCurveName;
  type: 1 | 2;              // 1=head curve, 2=torque curve
  regime: number;           // 1~8 (운전 구간)
  enabled: boolean;         // 내보내기 활성화 여부 (사용자가 명시적으로 선택한 곡선만 출력)
  xLabel: 'v/a' | 'a/v';    // X축 레이블
  yLabel: 'h/a2' | 'h/v2' | 'b/a2' | 'b/v2';  // Y축 레이블
  points: PumpCurvePoint[]; // 곡선 데이터 포인트
}

// --- PUMP Speed Control Types ---
export interface PumpSpeedControl {
  tripOrControl: number;         // 트립 번호 (CCC6100 W1) - 항상 trip number
  keyword?: string;              // 검색변수 지정 키워드 (CCC6100 W2, optional) - e.g., "cntrlvar", "time"
  parameter?: number;            // 검색변수 파라미터 (CCC6100 W3, optional, default 0)

  // CCC6101~6199: (검색변수 값, 펌프 속도) 테이블
  speedTable: Array<{
    searchVariable: number;      // 검색변수 값 (기본: time - trip time)
    pumpSpeed: number;           // 펌프 속도 (rad/s 또는 rpm)
  }>;
}

// --- PUMP Parameters ---
export interface PumpParameters {
  // Basic Info
  name: string;

  // === CCC0101-0102: Volume Geometry ===
  area: number;              // 펌프 볼륨 면적 (m²)
  length: number;            // 길이 (m)
  volume: number;            // 체적 (m³)
  azAngle: number;           // 아지무스 각도 (deg)
  incAngle: number;          // 경사 각도 (deg)
  dz: number;                // 높이 차이 (m)
  tlpvbfe: string;           // 체적 옵션 플래그 (7자리)

  // === CCC0108-0109: Inlet/Outlet Junctions ===
  inletConnection: VolumeReference | null;   // 입구 연결
  outletConnection: VolumeReference | null;  // 출구 연결
  inletArea: number;                         // 입구 면적 (m²)
  outletArea: number;                        // 출구 면적 (m²)
  inletFwdLoss: number;                      // 입구 정방향 손실계수
  inletRevLoss: number;                      // 입구 역방향 손실계수
  outletFwdLoss: number;                     // 출구 정방향 손실계수
  outletRevLoss: number;                     // 출구 역방향 손실계수
  inletJefvcahs: string;                     // 입구 정션 플래그 (00000000)
  outletJefvcahs: string;                    // 출구 정션 플래그 (00000000)

  // === CCC0110: Inlet Junction Diameter & CCFL (optional) ===
  inletCcflDiameter?: number;                // 입구 CCFL 직경
  inletCcflBeta?: number;                    // 입구 CCFL beta/gas intercept
  inletCcflSlope?: number;                   // 입구 CCFL slope
  inletCcflSlopeIncr?: number;               // 입구 CCFL slope increment

  // === CCC0111: Outlet Junction Diameter & CCFL (optional) ===
  outletCcflDiameter?: number;               // 출구 CCFL 직경
  outletCcflBeta?: number;                   // 출구 CCFL beta/gas intercept
  outletCcflSlope?: number;                  // 출구 CCFL slope
  outletCcflSlopeIncr?: number;              // 출구 CCFL slope increment

  // === CCC0200: Volume Initial Conditions ===
  ebt: string;               // 제어워드 (003 = P/T)
  pressure: number;          // 초기 압력 (Pa)
  temperature: number;       // 초기 온도 (K)

  // === CCC0201-0202: Junction Initial Conditions ===
  inletFlowMode: number;     // 0=속도, 1=질량유량
  inletLiquidFlow: number;   // 입구 액체 유량 (kg/s)
  inletVaporFlow: number;    // 입구 증기 유량 (kg/s)
  outletFlowMode: number;
  outletLiquidFlow: number;
  outletVaporFlow: number;

  // === CCC0301: Index & Options ===
  tbli: number;              // 상사곡선 인덱스 (0=내부, -1~-3=내장)
  twophase: number;          // 2상 옵션 (-1=미사용)
  tdiff: number;             // 2상 difference (-3=미사용)
  mtorq: number;             // 모터 토크 테이블 (-1=미사용)
  tdvel: number;             // 속도 테이블 (-1=미사용, 0=내부)
  ptrip: number;             // 전원 트립 번호
  rev: number;               // 회전 방향 (0=정방향)

  // === CCC0302-0304: Pump Description ===
  ratedSpeed: number;        // 정격 속도 (rad/s 또는 rpm)
  initialSpeedRatio: number; // 초기/정격 속도 비
  ratedFlow: number;         // 정격 유량 (m³/s)
  ratedHead: number;         // 정격 양정 (m)
  ratedTorque: number;       // 정격 토크 (N·m)
  momentOfInertia: number;   // 관성 모멘트 (kg·m²)
  ratedDensity: number;      // 정격 밀도 (kg/m³)
  ratedMotorTorque: number;  // 정격 모터 토크 (0=자동)
  frictionTF2: number;       // 마찰 토크 계수 TF2
  frictionTF0: number;       // 마찰 토크 계수 TF0
  frictionTF1: number;       // 마찰 토크 계수 TF1
  frictionTF3: number;       // 마찰 토크 계수 TF3

  // === CCC1100~CCCxxxx: Homologous Curves (상사곡선) ===
  homologousCurves?: PumpCurve[];  // 14개 곡선 세트 (선택적)

  // === CCC6100~CCC6199: Speed Control (속도 제어) ===
  speedControl?: PumpSpeedControl;  // 시간 의존 속도 제어 (선택적)
}

// --- HEAT STRUCTURE Parameters ---

/**
 * Heat Structure Geometry Type
 * 1 = Rectangular
 * 2 = Cylindrical
 * 3 = Spherical (Phase 2)
 */
export type HsGeometryType = 1 | 2;

/**
 * Heat Structure Boundary Condition Type (Table 9.16-1)
 * 0 = Insulated (symmetry/insulated, zero temperature gradient)
 * 1, 100, 101 = Default convective (101 recommended)
 * 102 = Parallel plates (ORNL, ANS reactor)
 * 109 = HANARO fuel
 * 110 = Vertical bundle without crossflow
 * 111 = Vertical bundle with crossflow
 * 114 = Helical S/G tube side
 * 115 = Parallel plates large gaps
 * 124 = CANDU fuel bundle element
 * 130 = Flat plate above fluid
 * 131 = HANARO horizontal plate HX
 * 134 = Horizontal bundle
 * 135 = Helical S/G shell side
 * 160-162 = Zukauskas correlations
 * 167-168 = PNU turbulent diffusion layer
 * 1000 = Surface temperature from boundary volume
 * 1xxx-4xxx = Table-based, -1yyyy~-3yyyy = CV-based
 */
export type HsBoundaryConditionType = number;

/**
 * Mesh Interval Definition (Cards 1CCCG101-199, Format 1)
 * Defines radial mesh intervals for the heat structure
 */
export interface HsMeshInterval {
  intervals: number;   // Number of mesh intervals (1-99)
  rightCoord: number;  // Right boundary coordinate (m)
}

/**
 * Material Composition (Cards 1CCCG201-299)
 * Maps material numbers to mesh intervals
 */
export interface HsMaterialComposition {
  materialNumber: number;  // Composition number (references thermal property table)
  interval: number;        // Mesh interval number (1 to np-1)
}

/**
 * Source Distribution (Cards 1CCCG301-399)
 * Radial power peaking factors
 */
export interface HsSourceDistribution {
  sourceValue: number;  // Relative source value (radial peaking factor)
  interval: number;     // Mesh interval number
}

/**
 * Initial Temperature (Cards 1CCCG401-499, Format 1)
 * Temperature distribution across mesh points
 */
export interface HsInitialTemperature {
  temperature: number;  // Temperature (K)
  meshPoint: number;    // Mesh point number (1 to np)
}

/**
 * Boundary Condition (Cards 1CCCG501-599, 1CCCG601-699)
 * 6 words per heat structure for left/right boundaries
 */
export interface HsBoundaryCondition {
  boundaryVolume: VolumeReference | null;  // Boundary fluid volume (null = insulated)
  increment: number;                        // Volume number increment (default: 0)
  bcType: HsBoundaryConditionType;          // Boundary condition type
  surfaceAreaCode: 0 | 1;                   // 0=direct area, 1=geometry factor
  surfaceArea: number;                      // Surface area (m²) or height (m) for cylindrical
  hsNumber: number;                         // Heat structure number (1 to nh)
}

/**
 * Source Data (Cards 1CCCG701-799)
 * 5 words per heat structure
 */
export interface HsSourceData {
  sourceType: number;     // 0=none, 1-999=general table, 1000-1004=point kinetics
  multiplier: number;     // Internal source multiplier (axial peaking factor)
  dmhl: number;           // Direct moderator heating multiplier - left
  dmhr: number;           // Direct moderator heating multiplier - right
  hsNumber: number;       // Heat structure number (1 to nh)
}

/**
 * Additional Boundary Data (Cards 1CCCG801-899, 1CCCG901-999)
 * 9-word format for CHF correlation data
 */
export interface HsAdditionalBoundary {
  heatTransferDiameter: number;  // Heat transfer hydraulic diameter (m)
  heatedLengthForward: number;   // Heated length forward (m)
  heatedLengthReverse: number;   // Heated length reverse (m)
  gridSpacerLengthFwd: number;   // Grid spacer length forward (m)
  gridSpacerLengthRev: number;   // Grid spacer length reverse (m)
  gridLossCoeffFwd: number;      // Grid loss coefficient forward
  gridLossCoeffRev: number;      // Grid loss coefficient reverse
  localBoilingFactor: number;    // Local boiling factor (default: 1.0)
  hsNumber: number;              // Heat structure number (1 to nh)
}

// ============================================================================
// Phase 2: Fuel Rod Specific Interfaces
// ============================================================================

/**
 * Additional Boundary Option (Card 1CCCG800/900 Word 1)
 * Controls the format of additional boundary data
 * Phase 1: 0 (9-word format)
 * Phase 2: 1-4 (extended formats)
 */
export type HsAdditionalBoundaryOption = 0 | 1 | 2 | 3 | 4;
// 0: 9-word (Phase 1 기본)
// 1: 12-word (CHF 상관식)
// 2: 13-word (PG-CHF)
// 3: 9-word + 승수
// 4: 12-word + 승수

/**
 * Gap Conductance Data (Card 1CCCG001)
 * Fuel rod gap conductance model
 */
export interface HsGapConductance {
  initialGapPressure: number;     // W1: 초기 갭 내부 압력 (Pa)
  referenceVolume: VolumeReference; // W2: 갭 전도 기준 체적
  conductanceMultiplier?: number; // W3: 갭 전도 승수 (기본값: 1.0)
}

/**
 * Metal-Water Reaction Data (Card 1CCCG003)
 * Oxide layer on cladding outer surface
 */
export interface HsMetalWaterReaction {
  initialOxideThickness: number;  // W1: 클래딩 외면 초기 산화층 두께 (m)
}

/**
 * Cladding Deformation Data (Card 1CCCG004)
 * Form loss calculation flag
 */
export interface HsCladdingDeformation {
  formLossFlag: 0 | 1;            // W1: 0=형손실 계산 안함, 1=계산함
}

/**
 * Gap Deformation Data (Cards 1CCCG011-099)
 * 5-word format, one set per axial node (nh sets total)
 */
export interface HsGapDeformation {
  fuelSurfaceRoughness: number;   // W1: 연료 표면 거칠기 (m)
  cladSurfaceRoughness: number;   // W2: 클래딩 표면 거칠기 (m)
  fuelSwelling: number;           // W3: 연료 팽창/고밀화 변위 (m)
  cladCreepdown: number;          // W4: 클래딩 크리프 변위 (m)
  hsNumber: number;               // W5: 열구조 번호
}

/**
 * Additional Boundary Option Card (Card 1CCCG800/900)
 * Extended format with multipliers (formatFlag=3,4)
 */
export interface HsAdditionalBoundaryOptionCard {
  formatFlag: HsAdditionalBoundaryOption;  // W1
  // Multipliers (when formatFlag=3 or 4)
  liquidHeatTransferMult?: number;  // W2: 액체 열전달 승수
  nucleateBoilingMult?: number;     // W3: 핵비등 승수
  aeclChfMult?: number;             // W4: AECL CHF 승수
  transitionBoilingMult?: number;   // W5: 천이 비등 승수
  filmBoilingMult?: number;         // W6: 막 비등 승수
  vaporHeatTransferMult?: number;   // W7: 증기 열전달 승수
  tripNumber?: number;              // W8: Trip 번호
}

/**
 * 12-word Additional Boundary (Cards 1CCCG801-899, 1CCCG901-999)
 * Extended format for CHF correlation (formatFlag=1 or 4)
 */
export interface HsAdditionalBoundary12Word extends HsAdditionalBoundary {
  naturalCirculationLength: number; // W9: 자연순환 길이 (m)
  pitchToDiameterRatio: number;     // W10: P/D 비율
  foulingFactor: number;            // W11: 오염 계수
  // hsNumber is W12 (inherited from HsAdditionalBoundary)
}

/**
 * 13-word Additional Boundary (PG-CHF, Cards 1CCCG801-899, 1CCCG901-999)
 * Extended format for PG-CHF correlation (formatFlag=2)
 */
export interface HsAdditionalBoundary13Word extends Omit<HsAdditionalBoundary12Word, 'hsNumber'> {
  chfrCorrelationOption: number;    // W12: CHFR 상관식 옵션 (mn 형식)
  hsNumber: number;                 // W13: 열구조 번호
}

/**
 * Heat Structure Parameters
 * Phase 1: General structures
 * Phase 2: Fuel rod support (Reflood, Gap, MWR, Cladding)
 * Card format: 1CCCGXNN where CCC=component, G=geometry, X=card type, NN=card number
 */
export interface HeatStructureParameters {
  // Basic Info
  name: string;

  // === Card 1CCCG000: General Heat Structure Data (Words 1-5) ===
  nh: number;                    // W1: Number of axial heat structures (1-99)
  np: number;                    // W2: Number of radial mesh points (2-99)
  geometryType: HsGeometryType;  // W3: 1=Rectangular, 2=Cylindrical
  ssInitFlag: 0 | 1;             // W4: 0=input temps, 1=calculate steady-state
  leftBoundaryCoord: number;     // W5: Left boundary coordinate (m)

  // === Card 1CCCG000: Reflood Options (Words 6-8) - Phase 2 ===
  refloodFlag?: number;                 // W6: 0=없음, 1/2=자동, trip#=트립 기반
  boundaryVolumeIndicator?: 0 | 1;      // W7: 0=좌측, 1=우측 경계
  maxAxialIntervals?: number;           // W8: 2,4,8,16,32,64,128 중 선택

  // === Phase 2: Fuel Rod Mode ===
  isFuelRod?: boolean;                  // UI toggle: 연료봉 모드 여부

  // === Card 1CCCG100: Mesh Flags ===
  meshLocationFlag: 0;           // 0=geometry data in this input (always 0 for Phase 1)
  meshFormatFlag: 1 | 2;         // 1=intervals+coord, 2=sequential expansion

  // === Cards 1CCCG101-199: Mesh Intervals ===
  meshIntervals: HsMeshInterval[];

  // === Cards 1CCCG201-299: Composition Data ===
  materialCompositions: HsMaterialComposition[];

  // === Cards 1CCCG301-399: Source Distribution ===
  sourceDistributions: HsSourceDistribution[];

  // === Card 1CCCG400: Initial Temperature Flag ===
  initialTempFlag?: number;        // W1: 0=use temp data from G401-G499
  // === Cards 1CCCG401-499: Initial Temperature ===
  initialTemperatures: HsInitialTemperature[];

  // === Cards 1CCCG501-599: Left Boundary Conditions ===
  leftBoundaryConditions: HsBoundaryCondition[];

  // === Cards 1CCCG601-699: Right Boundary Conditions ===
  rightBoundaryConditions: HsBoundaryCondition[];

  // === Cards 1CCCG701-799: Source Data ===
  sourceData: HsSourceData[];

  // === Card 1CCCG800: Additional Left Boundary Option ===
  // Phase 1: 0 (9-word format)
  // Phase 2: 1-4 (extended formats)
  leftAdditionalOption?: HsAdditionalBoundaryOption;
  leftAdditionalOptionCard?: HsAdditionalBoundaryOptionCard;  // Phase 2: multipliers

  // === Cards 1CCCG801-899: Additional Left Boundary ===
  // Phase 1: HsAdditionalBoundary (9-word)
  // Phase 2: HsAdditionalBoundary12Word (12-word) or HsAdditionalBoundary13Word (13-word)
  leftAdditionalBoundary?: (HsAdditionalBoundary | HsAdditionalBoundary12Word | HsAdditionalBoundary13Word)[];

  // === Card 1CCCG900: Additional Right Boundary Option ===
  // Phase 1: 0 (9-word format)
  // Phase 2: 1-4 (extended formats)
  rightAdditionalOption?: HsAdditionalBoundaryOption;
  rightAdditionalOptionCard?: HsAdditionalBoundaryOptionCard;  // Phase 2: multipliers

  // === Cards 1CCCG901-999: Additional Right Boundary ===
  // Phase 1: HsAdditionalBoundary (9-word)
  // Phase 2: HsAdditionalBoundary12Word (12-word) or HsAdditionalBoundary13Word (13-word)
  rightAdditionalBoundary?: (HsAdditionalBoundary | HsAdditionalBoundary12Word | HsAdditionalBoundary13Word)[];

  // ============================================================================
  // Phase 2: Fuel Rod Specific Cards (isFuelRod=true인 경우만)
  // ============================================================================

  // === Card 1CCCG001: Gap Conductance Data ===
  gapConductance?: HsGapConductance;

  // === Card 1CCCG003: Metal-Water Reaction ===
  metalWaterReaction?: HsMetalWaterReaction;

  // === Card 1CCCG004: Cladding Deformation ===
  claddingDeformation?: HsCladdingDeformation;

  // === Cards 1CCCG011-099: Gap Deformation Data ===
  // One set per axial node (nh sets total)
  gapDeformationData?: HsGapDeformation[];
}

// ============================================================================
// VALVE Parameters (SMART: mtrvlv, trpvlv, srvvlv)
// ============================================================================

/**
 * Valve Sub-Type
 * - mtrvlv: Motor Valve (Trip-controlled open/close with rate)
 * - trpvlv: Trip Valve (Instant open/close by trip)
 * - srvvlv: Servo Valve (Continuous control by control variable)
 */
export type ValveSubType = 'mtrvlv' | 'trpvlv' | 'srvvlv' | 'chkvlv';

/**
 * Valve Parameters
 * Based on SMART_SIM_BASE_REV01.i analysis
 * 
 * Card Structure:
 * - CCC0000: name, type (valve)
 * - CCC0101: from, to, area [, fwdLoss, revLoss, jefvcahs] (3 or 6 words)
 * - CCC0102: fwdLoss, revLoss, jefvcahs (mtrvlv only)
 * - CCC0103: dischargeCoeff, thermalCoeff (mtrvlv only)
 * - CCC0201: conditionType, liquidFlow, vaporFlow, unused
 * - CCC0300: valveSubType
 * - CCC0301: Type-specific data
 */
export interface ValveParameters {
  // Basic Info
  name: string;

  // === CCC0101: Junction Geometry ===
  from: VolumeReference;           // From volume (CCCVV000N)
  to: VolumeReference;             // To volume (CCCVV000N)
  area: number;                    // Junction area (m²)
  
  // === CCC0101 (6-word for trpvlv/srvvlv) or CCC0102 (mtrvlv) ===
  fwdLoss: number;                 // Forward loss coefficient (일관성: SngljunParameters)
  revLoss: number;                 // Reverse loss coefficient (일관성: SngljunParameters)
  jefvcahs: string;                // 8-digit junction flags

  // === Discharge/Thermal Coefficients (CCC0102 - optional for all valve types) ===
  enableDischargeCoeffs?: boolean; // Explicitly enable CCC0102 card output
  dischargeCoeff?: number;         // W7: Discharge coefficient (default: 1.0)
  thermalCoeff?: number;           // W8: Thermal nonequilibrium constant (default: 0.14)

  // === CCC0201: Initial Conditions ===
  initialConditionType: 0 | 1;     // 0=velocity, 1=mass flow
  initialLiquidFlow: number;       // kg/s or m/s
  initialVaporFlow: number;        // kg/s or m/s
  initialX?: number;               // Unused (default: 0.0)

  // === CCC0300: Valve Sub-Type ===
  valveSubType: ValveSubType;

  // === CCC0301: Type-Specific Data ===
  // Motor Valve (mtrvlv) - 4 words
  openTripNumber?: number;         // Trip number to open valve
  closeTripNumber?: number;        // Trip number to close valve
  valveRate?: number;              // Opening/closing rate (s⁻¹), e.g., 0.2 = 5s stroke
  initialPosition?: number;        // Initial position (0.0=closed, 1.0=open)

  // Trip Valve (trpvlv) - 1 word
  tripNumber?: number;             // Trip number (true=open, false=closed)

  // Servo Valve (srvvlv) - 2 words (Section 8.15.11)
  controlVariable?: number;        // W1: Control variable number (value = normalized area or stem position)
  valveTableNumber?: number;       // W2: General table number (if set, CV = stem position → table maps to area)

  // Check Valve (chkvlv) - 4 words (Section 8.15.6)
  checkValveType?: -1 | 0 | 1;    // W1: +1=static(no hysteresis), 0=static/flow(hysteresis), -1=static/dynamic(hysteresis)
  checkInitialPosition?: 0 | 1;   // W2: 0=initially open, 1=initially closed
  closingBackPressure?: number;    // W3: Closing back pressure (Pa)
  leakRatio?: number;              // W4: Leak ratio (fraction of junction area, 0=no leak)
}

// ============================================================================
// Component Union Type
// ============================================================================

export type ComponentParameters =
  | SnglvolParameters
  | SngljunParameters
  | PipeParameters
  | BranchParameters
  | SeparatorParameters
  | TmdpvolParameters
  | TmdpjunParameters
  | MtpljunParameters
  | PumpParameters
  | HeatStructureParameters
  | ValveParameters
  | TurbineParameters
  | TankParameters;

// ============================================================================
// MARS Component (extracted from ReactFlow)
// ============================================================================

export interface MARSComponent {
  id: string;                     // "1200000"
  type: ComponentType;
  name: string;
  parameters: ComponentParameters;
  connections?: {
    inlet?: VolumeId;
    outlet?: VolumeId;
  };
}

// ============================================================================
// SVG Library
// ============================================================================

export interface SvgLibraryItem {
  id: string;           // nanoid 생성 (예: "svg_abc123")
  name: string;         // 사용자 지정 이름
  svgMarkup: string;    // sanitized SVG 전체 마크업
  viewBox: string;      // 추출된 viewBox (렌더링 스케일링용)
  createdAt: number;    // Date.now()
}

// ============================================================================
// Node Appearance (Nodalization 시각화)
// ============================================================================

export type NodeShape =
  | 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hatched-rect' | 'semicircle'  // 기본 CSS shapes
  | 'valve-bowtie' | 'pump-centrifugal'                               // P&ID symbols
  | 'custom';                                                          // 사용자 정의 SVG (라이브러리 참조)

export type NodeRotation = 0 | 90 | 180 | 270;

export interface NodeAppearance {
  shape: NodeShape;
  width: number;
  height: number;
  rotation: NodeRotation;
  backgroundColor: string;
  svgLibraryId?: string;    // SVG 라이브러리 아이템 참조 ID
}

// ============================================================================
// ReactFlow Node Data
// ============================================================================

export interface MARSNodeData {
  componentId: string;            // "1200000"
  componentName: string;          // "core_avg"
  componentType: ComponentType;
  parameters: Partial<ComponentParameters>;
  status: 'incomplete' | 'valid' | 'error';
  errors: ValidationError[];
  warnings: ValidationError[];
  enableSideConnections?: boolean;  // 측면 연결 허용 여부 (PIPE 노드용, 기본값: true)
  appearance?: NodeAppearance;     // Nodalization 시각화 설정 (없으면 타입별 기본값)
}

// ============================================================================
// ReactFlow Edge Data
// ============================================================================

export interface MARSEdgeData {
  // 필수 필드: 모든 edge는 완전한 연결 정보를 포함
  fromVolume: VolumeReference;    // Source volume reference (Required)
  toVolume: VolumeReference;      // Target volume reference (Required)
  connectionType: 'axial' | 'crossflow'; // Connection type (Required) - MARS 공식 타입만 사용

  // Junction 정보 (crossflow/axial junction인 경우)
  junctionNodeId?: string;       // Junction 노드 ID (SNGLJUN, MTPLJUN, BRANCH 등)
  junctionNumber?: number;        // Junction 번호 (MTPLJUN, BRANCH의 경우)

  // 연결 파라미터
  area?: number;
  fwdLoss?: number;              // Forward loss coefficient
  revLoss?: number;              // Reverse loss coefficient
  jefvcahs?: string;             // Junction control flags

  // Multi-cell connection (다중 셀 crossflow 연결)
  isMultiCellConnection?: boolean; // True if this edge represents multiple cell connections
  cells?: number[];              // Multi-cell connection (array of cell numbers)
  isMultiJunction?: boolean;     // True if edge represents multiple junctions (= cells.length > 1)

  // UI 표시용
  label?: string;                // Custom label for the edge

  // Legacy (migration용, 추후 제거 예정)
  junctionId?: string;           // @deprecated - use junctionNodeId
  volumeIdFrom?: VolumeId;       // @deprecated - use fromVolume
  volumeIdTo?: VolumeId;         // @deprecated - use toVolume
  fromFace?: number;             // @deprecated - use fromVolume.face
  toFace?: number;               // @deprecated - use toVolume.face
  fromNode?: string;             // @deprecated - use fromVolume.nodeId
  toNode?: string;               // @deprecated - use toVolume.nodeId
  connectionConfig?: ConnectionConfig;  // @deprecated
  flowDirection?: 'forward' | 'reverse';  // @deprecated

  // Heat Structure 연결 정보 (Phase 1.5)
  heatStructureNodeId?: string;           // Heat Structure 노드 ID
  heatStructureSide?: 'left' | 'right';   // 연결된 경계 (left-boundary / right-boundary)
}

// Multi-cell connection specification for dialog
// (구 SideConnectionSpec - 이름 변경하여 MARS 명세와 일치)
export interface MultiCellConnectionSpec {
  fromNodeId: string;
  toNodeId: string;
  fromFace: 1 | 2 | 3 | 4 | 5 | 6;
  toFace: 1 | 2 | 3 | 4 | 5 | 6;
  cells: number[];  // 정렬 + 중복 제거된 상태
  area?: number;
  fwdLoss?: number;
  revLoss?: number;
  jefvcahs?: string;
}

// 하위 호환성을 위한 별칭 (deprecated, 추후 제거 예정)
/** @deprecated Use MultiCellConnectionSpec instead */
export type SideConnectionSpec = MultiCellConnectionSpec;

// ============================================================================
// Global Settings (MARS Control Cards)
// ============================================================================

// Card 001: Development Model Control (optional)
export interface Card001 {
  enabled: boolean;
  values: number[]; // Option numbers (1-90), multiple allowed. e.g., [76, 85]
}

// Card 104: Restart-Plot File Control (optional)
export interface Card104 {
  enabled: boolean;
  action: string; // e.g., 'ncmpress'
  fileName: string; // e.g., 's3sb01_dc.r'
}

// Card 105: CPU Time Remaining and Diagnostic Edit (optional)
export interface Card105 {
  enabled: boolean;
  limit1: number; // CPU time limit 1 (seconds)
  limit2: number; // CPU time limit 2 for diagnostic edit (seconds)
}

// Card 100: Problem Type
export interface Card100 {
  problemType: 'new' | 'restart';
  calculationType: 'transnt' | 'stdy-st';
}

// Card 101: Run Option
export interface Card101 {
  runOption: 'run' | 'input-chk';
}

// Card 102: Units
export interface Card102 {
  inputUnits: 'si' | 'british';
  outputUnits: 'si' | 'british';
}

// Card 103: Restart Input File Control (required for RESTART, not allowed for NEW)
export interface Card103 {
  restartNumber: number;    // W1(I): restart block number (-1 = last block)
  rstpltFileName?: string;  // W2-6(A): RSTPLT file name (max 40 chars, default: 'rstplt')
}

// Card 110: Non-condensable Gas
export interface Card110 {
  gases: ('nitrogen' | 'helium' | 'argon' | 'krypton' | 'xenon' | 'hydrogen' | 'air' | 'sf6')[];
}

// Card 115: Gas Mass Fractions
export interface Card115 {
  fractions: number[]; // must sum to 1.0
}

// Card 120-129: System Configuration
export interface SystemConfig {
  systemNumber: number; // 0-9 (Card 12X, X=systemNumber)
  referenceVolume: VolumeReference; // volume reference (center face, volume 01)
  referenceElevation: number; // m
  fluid: 'h2o' | 'd2o' | 'air';
  systemName: string;
}

// Card 200: Initial Time
export interface Card200 {
  initialTime: number; // seconds
}

// Card 201-299: Time Phases
export interface TimePhase {
  endTime: number;
  minDt: number;
  maxDt: number;
  controlOption: string; // 5-digit format (ssdtt)
  minorEditFreq: number; // steps
  majorEditFreq: number; // steps
  restartFreq: number; // steps
}

// ============================================================================
// Thermal Property Types (201MMMNN Cards)
// ============================================================================

/**
 * Material Type for Thermal Property (W1 of 201MMM00)
 * - Built-in materials: C-STEEL, S-STEEL, UO2, ZR (no table required)
 * - User-defined: TBL/FCTN (table required)
 */
export type ThermalMaterialType =
  | 'C-STEEL' | 'S-STEEL' | 'UO2' | 'ZR'  // Built-in (테이블 불필요)
  | 'TBL/FCTN';                            // User-defined (테이블 필요)

/**
 * Thermal Conductivity Format (W2 of 201MMM00)
 * Only applicable when materialType = 'TBL/FCTN'
 */
export type ThermalConductivityFormat = 1 | 2 | 3;
// 1 = Temperature-conductivity table
// 2 = Polynomial function (Phase 3.5 - not implemented)
// 3 = Gap conductance model (gas composition)

/**
 * Volumetric Heat Capacity Format (W3 of 201MMM00)
 * Only applicable when materialType = 'TBL/FCTN' and conductivityFormat = 1 or 2
 * Note: Ignored when conductivityFormat = 3 (Gap model)
 */
export type VolumetricCapacityFormat = -1 | 1 | 2;
// -1 = Same temperatures as conductivity table (values only)
// 1 = Separate temperature-capacity table
// 2 = Polynomial function (Phase 3.5 - not implemented)

/**
 * Temperature-Property Pair for table format
 */
export interface ThermalPropertyEntry {
  temperature: number;  // K
  value: number;        // W/m-K (conductivity) or J/m³-K (capacity)
}

/**
 * Gap Gas Component Names (for conductivityFormat = 3)
 */
export type GapGasName =
  | 'HELIUM' | 'ARGON' | 'KRYPTON' | 'XENON'
  | 'NITROGEN' | 'HYDROGEN' | 'OXYGEN';

/**
 * Gap Gas Composition Entry
 */
export interface GapGasComposition {
  gasName: GapGasName;
  moleFraction: number;  // 0-1, sum should equal 1.0 (auto-normalized)
}

/**
 * Thermal Property Definition (201MMMNN Cards)
 * Defines thermal properties for a material composition
 */
export interface ThermalProperty {
  materialNumber: number;         // 1-999 (MMM in card number)
  name: string;                   // User-friendly name

  // W1: Material type
  materialType: ThermalMaterialType;

  // === Below fields only for TBL/FCTN (ignored for built-in materials) ===

  // W2: Thermal conductivity format
  conductivityFormat?: ThermalConductivityFormat;

  // W3: Volumetric heat capacity format (ignored when conductivityFormat = 3)
  capacityFormat?: VolumetricCapacityFormat;

  // --- Thermal Conductivity Data (conductivityFormat = 1) ---
  isConstantConductivity?: boolean;       // Whether conductivity is constant
  constantConductivity?: number;          // Constant value (W/m-K)
  conductivityTable?: ThermalPropertyEntry[];  // Temperature-conductivity table

  // --- Volumetric Heat Capacity Data (conductivityFormat = 1, capacityFormat = -1 or 1) ---
  isConstantCapacity?: boolean;           // Whether capacity is constant
  constantCapacity?: number;              // Constant value (J/m³-K)
  capacityTable?: ThermalPropertyEntry[]; // capacityFormat = 1: Temperature-capacity table
  capacityValues?: number[];              // capacityFormat = -1: Values only (shares temp with conductivityTable)

  // --- Gap Gas Composition (conductivityFormat = 3) ---
  gapGasComposition?: GapGasComposition[];
}

// ============================================================================
// General Tables (Cards 202TTTNN)
// Chapter 12: GENERAL TABLES - Mars Input Manual p241-242
// Table 12.1-1: Types of General Tables
// ============================================================================

export type GeneralTableType =
  | 'power'      // Power versus time
  | 'htrnrate'   // Heat flux versus time
  | 'htc-t'      // Heat transfer coefficient versus time
  | 'htc-temp'   // Heat transfer coefficient versus temperature
  | 'temp'       // Temperature versus time
  | 'reac-t'     // Reactivity vs time / Control variable vs time
  | 'normarea';  // Normalized area versus normalized stem position

export interface GeneralTableDataPoint {
  x: number;
  y: number;
  cardIndex?: number;             // 원본 카드 NN 번호 보존 (라운드트립용)
}

export interface GeneralTable {
  tableNumber: number;              // TTT (1~999)
  name: string;                     // 사용자 설명 (주석용)
  type: GeneralTableType;           // 테이블 타입 키워드 (Table 12.1-1)
  tripNumber?: number;              // W2: Trip number (optional)
  // W3-W5: Factors (타입에 따라 의미가 다름)
  // 시간 기반(POWER,HTRNRATE,HTC-T,REAC-T): W3=time factor
  // 온도 기반(HTC-TEMP,TEMP): W3=multiplier M, W4=constant C (T=M·TX+C), W5=function factor
  // NORMAREA: W3-W5=factors (결과값 0≤v≤1.0)
  scaleX?: number;                  // W3: Factor 1 (time scale / multiplier M)
  scaleY?: number;                  // W4: Factor 2 (function scale / constant C)
  factor3?: number;                 // W5: Factor 3 (추가 factor, 온도/NORMAREA용)
  labelX?: string;                  // 사용자 정의 X축 라벨 (주석용, 예: "vol(m3)")
  labelY?: string;                  // 사용자 정의 Y축 라벨 (주석용, 예: "height(m)")
  dataPoints: GeneralTableDataPoint[];
}

// ============================================================================
// Point Reactor Kinetics (Cards 30000000 series)
// Chapter 16: POINT REACTOR KINETICS - Mars Input Manual p267-274
// ============================================================================

export interface ReactivityDataPoint {
  value: number;       // density(kg/m³) 또는 temperature(K)
  reactivity: number;  // 반응도 ($)
}

export interface WeightingFactor {
  componentId: string;  // Volume ID 또는 Heat Structure ID
  increment: number;    // 증분 (보통 0)
  factor: number;       // 가중치 인수
  coefficient: number;  // 계수
}

export interface PointReactorKinetics {
  enabled: boolean;

  // 30000000 - 기본 설정
  kineticsType: 'point';
  feedbackType: 'separabl' | 'nonseparabl';

  // 30000001 - 중성자 물리 파라미터
  decayType: 'gamma-ac';
  power: number;                      // 초기 출력 (W)
  reactivity: number;                 // 초기 반응도 ($)
  inverseLambda: number;              // 1/Λ (1/s)
  fpyf: number;                       // fission product yield fraction

  // 30000002 - 붕괴열
  ansStandard: 'ans79-1';
  additionalDecayHeat: number;        // 추가 붕괴열 (W)

  // 30000011 - 외부 반응도 참조
  externalReactivityTableNumber?: number;  // General Table 번호 (UI 호환용)

  // 30000011-0020 - 반응도 곡선/제어변수 참조 (Section 16.8.1)
  reactivityCurveNumbers?: number[];  // 1~999: General Table, >10000: CV (값-10000)

  // 30000101-0199 - 지연중성자 상수 (Section 16.4)
  delayedNeutronConstants?: {
    yield: number;          // β_i (precursor yield ratio)
    decayConstant: number;  // λ_i (s⁻¹)
  }[];

  // 3000050N - 감속재 밀도 반응도
  moderatorDensityReactivity: ReactivityDataPoint[];

  // 3000060N - 도플러 반응도
  dopplerReactivity: ReactivityDataPoint[];

  // 3000070N - 밀도 가중치 인수
  densityWeightingFactors: WeightingFactor[];

  // 3000080N - 도플러 가중치 인수
  dopplerWeightingFactors: WeightingFactor[];
}

// Global Settings Container
export interface GlobalSettings {
  card001?: Card001; // Card 001: Development Model Control
  card104?: Card104; // Card 104: Restart-Plot File Control
  card105?: Card105; // Card 105: CPU Time Limits
  card100?: Card100;
  card101?: Card101;
  card102?: Card102;
  card103?: Card103; // Card 103: Restart Input File Control (RESTART only)
  card110?: Card110;
  card115?: Card115;
  systems?: SystemConfig[]; // Card 120-129
  card200?: Card200;
  timePhases?: TimePhase[]; // Card 201-299
  minorEdits?: MinorEdit[]; // Card 301-399
  variableTrips?: VariableTrip[]; // Card 401-599
  logicTrips?: LogicTrip[]; // Card 601-799
  controlVariables?: ControlVariable[]; // Card 205CCCNN - Control System
  interactiveInputs?: InteractiveInput[]; // Card 801-999
  widgetOverrides?: import('./interactive').NodeWidgetOverrides; // Interactive Control 위젯 커스터마이징
  nodeDisplayModes?: Record<string, 'chart' | 'label'>; // 노드별 Chart/Label 표시 모드
  alarmThresholds?: import('./interactive').AlarmThresholds; // 알람 한계치 설정 (레거시)
  alarmEnabled?: boolean; // 알람 기능 on/off (레거시, 기본 true)
  alarmScenarioConfig?: import('./interactive').AlarmScenarioConfig; // 시나리오 기반 알람
  enabledWidgetNodes?: string[]; // Interactive Control 위젯이 활성화된 nodeId 목록
  widgetLodThreshold?: number; // LOD 전환 줌 임계값 (기본 0.5, 피드백으로 조정)
  generalTables?: GeneralTable[]; // Card 202TTTNN - General Tables
  reactorKinetics?: PointReactorKinetics; // Card 30000000 series - Point Reactor Kinetics
  thermalProperties?: ThermalProperty[]; // Card 201MMMNN - Heat Structure Thermal Properties
}

// ============================================================================
// Control Variables (Cards 205CCCNN)
// Section 14: CONTROL SYSTEM - Mars Input Manual p269-282
// ============================================================================

/**
 * Control Variable Component Types
 * Phase 1 (P0): CONSTANT, SUM, TRIPUNIT
 * Phase 1 (P1): FUNCTION, MULT, PROP-INT, INTEGRAL
 * Phase 2: STDFNCTN, TRIPDLAY, DIV, etc.
 */
export type ControlComponentType =
  | 'SUM' | 'MULT' | 'DIV'
  | 'DIFFRENI' | 'DIFFREND' | 'INTEGRAL'
  | 'FUNCTION' | 'STDFNCTN'
  | 'DELAY' | 'DIGITAL'
  | 'TRIPUNIT' | 'TRIPDLAY'
  | 'POWERI' | 'POWERR' | 'POWERX'
  | 'PROP-INT' | 'LAG' | 'LEAD-LAG'
  | 'PUMPCTL' | 'STEAMCTL' | 'FEEDCTL'
  | 'SHAFT'
  | 'CONSTANT';

/**
 * Variable Reference for Control Variable data cards
 * References system variables (p, tempf, mflowj, q, cntrlvar, etc.)
 */
export interface VariableRef {
  variableName: string;   // Alphanumeric (p, tempf, mflowj, cntrlvar, q, time, rktpow, ...)
  parameterCode: number;  // Numeric (CCCVV0000, CCC, 0, ...)
}

/**
 * CONSTANT type Control Variable
 * Special rules (Manual p278, Section 14.3.17):
 * - W3 (scalingFactor) is the constant value itself
 * - W4 (initialValue), W5 (initialValueFlag) are omitted
 * - No data cards (205CCC01~) required
 */
export interface ConstantControlVariable {
  number: number;           // Control variable number (CCC: 001-999)
  name: string;             // Descriptive name (max 8 chars)
  componentType: 'CONSTANT';
  scalingFactor: number;    // = constant value
  comment?: string;
}

/**
 * Base interface for non-CONSTANT Control Variables
 * Card 205CCC00 format
 */
export interface ControlVariableBase {
  number: number;           // Control variable number (CCC: 001-999)
  name: string;             // Descriptive name (max 8 chars)
  componentType: Exclude<ControlComponentType, 'CONSTANT'>;
  scalingFactor: number;    // Scaling factor (S)
  initialValue: number;     // Initial value (W4)
  initialValueFlag: 0 | 1;  // 0=use initialValue, 1=compute
  limiterControl?: 0 | 1 | 2 | 3; // 0=none, 1=min, 2=max, 3=both
  minValue?: number;        // Min limit (when limiterControl >= 1)
  maxValue?: number;        // Max limit (when limiterControl >= 2)
  comment?: string;
}

// === Type-specific data interfaces ===

/**
 * SUM type data (Manual p271, Section 14.3.1)
 * Y = S * (A0 + A1*V1 + A2*V2 + ... + Aj*Vj)
 * Card format:
 * - 205CCC01: A0, A1, varName1, varCode1 (4 words)
 * - 205CCC02~: Aj, varNameJ, varCodeJ (3 words, W1 position blank)
 */
export interface SumData {
  constant: number;  // A0
  terms: Array<{
    coefficient: number;     // Aj
    variable: VariableRef;   // {varName, varCode}
  }>;
}

/**
 * MULT type data (Manual p271, Section 14.3.2)
 * Y = S * V1 * V2 * ... * Vj
 */
export interface MultData {
  factors: VariableRef[];  // At least 2 factors required
}

/**
 * DIV type data (Manual p271, Section 14.3.3)
 * Y = S/V1 or Y = S*V2/V1
 */
export interface DivData {
  denominator: VariableRef;  // V1 (required)
  numerator?: VariableRef;   // V2 (optional, for Y = S*V2/V1 form)
}

/**
 * Single variable data (DIFFRENI, DIFFREND, INTEGRAL)
 */
export interface SingleVariableData {
  variable: VariableRef;
}

/**
 * FUNCTION type data (Manual p273, Section 14.3.7)
 * Y = S * TABLE(V1)
 */
export interface FunctionData {
  variable: VariableRef;
  tableNumber: number;  // General table number (202TTTNN)
}

/**
 * STDFNCTN type data (Manual p274, Section 14.3.8)
 * Y = S * f(V1, V2, ...)
 */
export interface StdFunctionData {
  functionName: 'ABS' | 'SQRT' | 'EXP' | 'LOG' | 'SIN' | 'COS' | 'TAN' | 'ATAN' | 'MIN' | 'MAX';
  arguments: VariableRef[];  // 1 arg for most, 2-20 for MIN/MAX
}

/**
 * DELAY type data (Manual p274, Section 14.3.9)
 * Y = S * V1(t - td)
 */
export interface DelayData {
  variable: VariableRef;
  delayTime: number;       // td (seconds)
  holdPositions: number;   // Number of hold positions
}

/**
 * DIGITAL type data (Manual p282, Section 14.3.22)
 * Y = S * V1_sampled(t - td)
 */
export interface DigitalData {
  variable: VariableRef;
  samplingTime: number;  // ts (seconds)
  delayTime: number;     // td (seconds)
}

/**
 * TRIPUNIT type data (Manual p275, Section 14.3.11)
 * Y = S * U(T1) where U(T1) = 0 or 1 based on trip state
 */
export interface TripUnitData {
  tripNumber: number;  // Trip number (negative = complement)
}

/**
 * TRIPDLAY type data (Manual p275, Section 14.3.12)
 * Y = S * Trptim(T1) - time since trip occurred
 */
export interface TripDelayData {
  tripNumber: number;
}

/**
 * POWERI type data (Manual p275, Section 14.3.13)
 * Y = S * V1^I (integer power)
 */
export interface PowerIData {
  variable: VariableRef;
  integerPower: number;
}

/**
 * POWERR type data (Manual p276, Section 14.3.14)
 * Y = S * V1^R (real power)
 */
export interface PowerRData {
  variable: VariableRef;
  realPower: number;
}

/**
 * POWERX type data
 * Y = S * V1^V2 (variable power)
 */
export interface PowerXData {
  base: VariableRef;
  exponent: VariableRef;
}

/**
 * PROP-INT type data (Manual p276, Section 14.3.15)
 * Y = S * (A1*V1 + A2*∫V1 dt)
 */
export interface PropIntData {
  proportionalGain: number;  // A1
  integralGain: number;      // A2
  variable: VariableRef;
}

/**
 * LAG type data (Manual p277, Section 14.3.15)
 * Y = S * ∫(V1-Y)/A1 dt
 */
export interface LagData {
  lagTime: number;  // A1 (seconds)
  variable: VariableRef;
}

/**
 * LEAD-LAG type data (Manual p278, Section 14.3.16)
 * Transfer function: (1+A1s)/(1+A2s)
 */
export interface LeadLagData {
  leadTime: number;  // A1 (seconds)
  lagTime: number;   // A2 (seconds)
  variable: VariableRef;
}

/**
 * PUMPCTL type data (Manual p254, Section 14.3.19)
 * PI controller for pump flow control
 * Card 205CCC01: W1=setpointName, W2=setpointCode, W3=sensedName, W4=sensedCode,
 *                W5=scaleFactor(S_i), W6=integralTime(T2), W7=proportionalTime(T1)
 */
export interface PumpctlData {
  setpointVariable: VariableRef;   // Setpoint (desired) variable
  sensedVariable: VariableRef;     // Sensed (measured) variable
  scaleFactor: number;             // S_i, must be nonzero
  integralTime: number;            // T2 (seconds)
  proportionalTime: number;        // T1 (seconds)
}

/**
 * STEAMCTL type data (Manual p255, Section 14.3.20)
 * PI controller for steam flow control
 * Card 205CCC01: W1=setpointName, W2=setpointCode, W3=sensedName, W4=sensedCode,
 *                W5=scaleFactor(S_j), W6=integralTime(T4), W7=proportionalTime(T3)
 */
export interface SteamctlData {
  setpointVariable: VariableRef;   // Setpoint (desired) variable
  sensedVariable: VariableRef;     // Sensed (measured) variable
  scaleFactor: number;             // S_j, must be nonzero
  integralTime: number;            // T4 (seconds)
  proportionalTime: number;        // T3 (seconds)
}

/**
 * FEEDCTL type data (Manual p256, Section 14.3.21)
 * PI controller for feedwater flow control with two setpoint-sensed pairs
 * Card 205CCC01-03: 12 words across multiple cards
 *   W1-W5: 1st setpoint/sensed pair + scale
 *   W6-W10: 2nd setpoint/sensed pair + scale
 *   W11-W12: integral + proportional time constants
 */
export interface FeedctlData {
  setpointVariable1: VariableRef;  // 1st setpoint variable
  sensedVariable1: VariableRef;    // 1st sensed variable
  scaleFactor1: number;            // S_k, must be nonzero
  setpointVariable2: VariableRef;  // 2nd setpoint variable
  sensedVariable2: VariableRef;    // 2nd sensed variable
  scaleFactor2: number;            // S_m, must be nonzero
  integralTime: number;            // T6 (seconds)
  proportionalTime: number;        // T5 (seconds)
}

/**
 * SHAFT type data (Manual p253, Section 14.3.18)
 * Rotational velocity equation: ΣI·dω/dt = Στ - Σf·ω + τc
 * Connects turbines, pumps, and generators via shaft
 *
 * Card format (from 100%.i reference):
 * - 205CCC01: W1=torqueCV, (blank), W3=inertia, W4=friction
 * - 205CCC02~05: Attached components (type+number pairs, max 4 pairs/card)
 * - 205CCC06: Generator description (optional)
 */
export type ShaftAttachedComponentType = 'TURBINE' | 'PUMP' | 'GENERATR';

export interface ShaftAttachedComponent {
  type: ShaftAttachedComponentType;
  componentNumber: number;  // Hydrodynamic component CCC or generator number
}

export interface ShaftGeneratorData {
  initialVelocity: number;      // Initial angular velocity (rad/s)
  synchronousVelocity: number;  // Synchronous angular velocity (rad/s)
  momentOfInertia: number;      // Moment of inertia (kg·m²)
  frictionFactor: number;       // Friction factor
  tripNumber1: number;          // Trip number 1 (0 = none)
  tripNumber2: number;          // Trip number 2 (0 = none)
}

export interface ShaftData {
  torqueControlVariable: number;    // Control variable number for external torque (0 = none)
  momentOfInertia: number;          // Moment of inertia (kg·m²)
  frictionFactor: number;           // Friction factor
  attachedComponents: ShaftAttachedComponent[];  // 1~10 attached components
  generatorData?: ShaftGeneratorData;            // Optional generator description (card 06)
}

/**
 * Non-CONSTANT Control Variable with type-specific data
 * Uses discriminated union for type safety
 */
export type NonConstantControlVariable = ControlVariableBase & (
  | { componentType: 'SUM'; data: SumData }
  | { componentType: 'MULT'; data: MultData }
  | { componentType: 'DIV'; data: DivData }
  | { componentType: 'DIFFRENI'; data: SingleVariableData }
  | { componentType: 'DIFFREND'; data: SingleVariableData }
  | { componentType: 'INTEGRAL'; data: SingleVariableData }
  | { componentType: 'FUNCTION'; data: FunctionData }
  | { componentType: 'STDFNCTN'; data: StdFunctionData }
  | { componentType: 'DELAY'; data: DelayData }
  | { componentType: 'DIGITAL'; data: DigitalData }
  | { componentType: 'TRIPUNIT'; data: TripUnitData }
  | { componentType: 'TRIPDLAY'; data: TripDelayData }
  | { componentType: 'POWERI'; data: PowerIData }
  | { componentType: 'POWERR'; data: PowerRData }
  | { componentType: 'POWERX'; data: PowerXData }
  | { componentType: 'PROP-INT'; data: PropIntData }
  | { componentType: 'LAG'; data: LagData }
  | { componentType: 'LEAD-LAG'; data: LeadLagData }
  | { componentType: 'PUMPCTL'; data: PumpctlData }
  | { componentType: 'STEAMCTL'; data: SteamctlData }
  | { componentType: 'FEEDCTL'; data: FeedctlData }
  | { componentType: 'SHAFT'; data: ShaftData }
);

/**
 * Control Variable - union of CONSTANT and non-CONSTANT types
 */
export type ControlVariable = ConstantControlVariable | NonConstantControlVariable;

/**
 * Type guard for CONSTANT type
 */
export function isConstantControlVariable(cv: ControlVariable): cv is ConstantControlVariable {
  return cv.componentType === 'CONSTANT';
}

/**
 * Type guard for non-CONSTANT types
 */
export function isNonConstantControlVariable(cv: ControlVariable): cv is NonConstantControlVariable {
  return cv.componentType !== 'CONSTANT';
}

// ============================================================================
// Minor Edits (Card 301-399)
// ============================================================================

/**
 * Minor Edit Variable Types
 * Based on SMART.i analysis
 */
export type MinorEditVariableType =
  | 'rktpow'      // Reactor power (parameter always 0)
  | 'rkmodd'      // Reactor moderator density (parameter always 0)
  | 'rkscram'     // Reactor scram reactivity (parameter always 0)
  | 'rkdopp'      // Reactor Doppler reactivity (parameter always 0)
  | 'rkreac'      // Reactor total reactivity (parameter always 0)
  | 'cntrlvar'    // Control variable (parameter is control var number)
  | 'p'           // Pressure (parameter is Volume ID)
  | 'tempf'       // Fluid temperature (parameter is Volume ID)
  | 'tempg'       // Gas/vapor temperature (parameter is Volume ID)
  | 'mflowj'      // Junction total mass flow (parameter is Junction ID)
  | 'mflowfj'     // Junction liquid mass flow (parameter is Junction ID)
  | 'mflowgj'     // Junction vapor mass flow (parameter is Junction ID)
  | 'voidf'       // Void fraction (parameter is Volume ID)
  | 'flenth'      // Fluid enthalpy (parameter is Volume ID)
  | 'turpow'      // Turbine power (parameter is turbine ID)
  | 'time';       // Time (parameter is 0 or not used)

/**
 * Minor Edit Parameter
 * Can be:
 * - Volume ID (9 digits): for p, tempf, voidf
 * - Junction ID (9 digits): for mflowj
 * - Control Variable Number: for cntrlvar
 * - 0: for rktpow, time
 */
export type MinorEditParameter = string | number;

/**
 * Minor Edit (단축형 Card 301-399, 확장형 Card 20800001+)
 * - 단축형: 301-399 (최대 99개)
 * - 확장형: 20800001-20899999 (99개 초과 시 자동 할당)
 * - 파일 생성 시 카드 번호 자동 할당 (사용자는 변수만 추가)
 * Format: CardNumber VariableType Parameter LowerLimit UpperLimit EditGroup EditPriority [Comment]
 *
 * Example from SMART.i:
 * 301  rktpow    0          300.0e6  400.0e6  1  1     *Total power(W)
 * 302  cntrlvar  324        300.0e6  400.0e6  1  2     *HTRNR:Core  to RCS
 * 304  p         280070000  13.e6    17.e6    2  1     *PZR pressure
 * 20800001  mflowfj  911000000  0.0  1.0e6  1  1      *Extended format
 */
export interface MinorEdit {
  cardNumber: number;              // Auto-assigned: 301-399, then 20800001+
  variableType: MinorEditVariableType;
  parameter: MinorEditParameter;   // Volume ID, Junction ID, Control Var Number, or 0
  lowerLimit: number;              // Lower bound for the variable
  upperLimit: number;              // Upper bound for the variable
  editGroup: number;              // Edit group number (1-999)
  editPriority: number;           // Priority within group (lower = higher priority)
  comment?: string;                // Optional comment
}

// ============================================================================
// Variable Trips (Card 401-599)
// ============================================================================

/**
 * Variable Trip Variable Types
 * Based on SMART.i analysis
 */
export type TripVariableType =
  | 'time'       // Time (parameter is 0)
  | 'p'          // Pressure (parameter is Volume ID)
  | 'tempf'      // Fluid temperature (parameter is Volume ID)
  | 'mflowj'     // Junction mass flow (parameter is Junction ID)
  | 'voidf'      // Void fraction (parameter is Volume ID)
  | 'cntrlvar'   // Control variable (parameter is control var number)
  | 'timeof';    // Time of trip (parameter is Trip number)

/**
 * Trip Relation Operators
 */
export type TripRelation = 'gt' | 'ge' | 'lt' | 'le' | 'eq' | 'ne';

/**
 * Trip Parameter
 * Can be:
 * - Volume ID (9 digits): for p, tempf, voidf
 * - Junction ID (9 digits): for mflowj
 * - Control Variable Number: for cntrlvar
 * - Trip Number: for timeof
 * - 0: for time, null
 */
export type TripParameter = string | number;

/**
 * Variable Trip (Card 401-599)
 * Format: CardNumber LeftVar LeftParam Relation RightVar RightParam ActionValue Latch Timeout [Comment]
 * 
 * Example from SMART.i:
 * 401  time   0   gt   null     0     1.0e6    l  -1.0   "SIS-SBLOCA"
 * 430  p         315010000  gt  null      0         6.50e6    l  -1.0 "SL Hi Pres"
 * 431  p         315010000  lt  null      0         3.42e6    l  -1.0 "SL Lo Pres"
 * 432  mflowj    307000000  lt  null      0         2.8115    l  -1.0 "FW Lo Flow"
 * 506  time      0          gt  timeof    731       0.0       l  -1.0 "SE_V#1 Off"
 * 599  p     120010000    lt    null       0   1.e6      n   -1.0
 */
export interface VariableTrip {
  cardNumber: number;              // 401-599
  leftVar: TripVariableType;       // Left variable type
  leftParam: TripParameter;        // Left variable parameter
  relation: TripRelation;          // Comparison operator
  rightVar: TripVariableType | 'null'; // Right variable type (null means constant)
  rightParam: TripParameter;       // Right variable parameter (0 for null)
  actionValue: number;             // Action threshold value
  latch: 'l' | 'n';                // l = latch, n = no latch
  timeout?: number;                // W8: Timeof (s), optional. omitted/-1.0=trip false, 0/positive=trip true initially
  comment?: string;                // Optional text (max 24 chars)
  isTripMessage?: boolean;         // true = W9 Trip Message "quoted", false/undefined = inline comment * text
}

// ============================================================================
// Logic Trips (Card 601-799)
// ============================================================================

/**
 * Logic Trip Operator
 * Based on SMART.i usage: AND, OR only (XOR excluded per scope decision)
 */
export type LogicTripOperator = 'and' | 'or';

/**
 * Logic Trip (Card 601-799)
 * Combines two trips with a logical operator (AND/OR)
 * Mars Input Manual p.64-65, Section 5.4
 *
 * Format: CardNumber  Trip1  Operator  Trip2  Latch  Timeof  [Comment]
 *
 * Example from SMART.i:
 * 723   423        and           724                n  -1.0 * PZR SDSV
 * 724   424        or            723                n  -1.0 "PZR SDSV TRIP"
 * 730   430        or            431                l  -1.0
 */
export interface LogicTrip {
  cardNumber: number;           // 601-799
  trip1: number;                // First trip number (401-799)
  operator: LogicTripOperator;  // AND or OR
  trip2: number;                // Second trip number (401-799)
  latch: 'l' | 'n';            // l = latch, n = no latch
  timeof?: number;              // W5: Timeof (s), optional. omitted/-1.0=trip false, 0/positive=trip true initially
  comment?: string;             // Optional text (max 24 chars)
  isTripMessage?: boolean;      // true = W6 Trip Message "quoted", false/undefined = inline comment * text
}

// ============================================================================
// Interactive Inputs (Card 801-999)
// ============================================================================

/**
 * Interactive Input Control Types
 * - trip: Trip control (parameter: trip number 400-799)
 * - vlvarea: Servo valve area control (parameter: component number)
 * - mflowfj: Liquid flow control (parameter: junction ID)
 * - mflowgj: Vapor flow control (parameter: junction ID)
 * - power: Heater power control (parameter: table number)
 */
export type InteractiveInputControlType =
  | 'trip'
  | 'vlvarea'
  | 'mflowfj'
  | 'mflowgj'
  | 'power';

/**
 * Interactive Input Parameter
 * - trip: Trip number (400-799)
 * - vlvarea: Component number (3 digits, 100-999)
 * - mflowfj/mflowgj: Junction ID (9 digits, CCCVV000N format)
 * - power: Heater table number
 */
export type InteractiveInputParameter = string | number;

/**
 * Interactive Input (Card 801-999)
 * Defines real-time control variables for NPA (Nuclear Plant Analyzer) simulation
 *
 * Format: CardNumber ControlType Parameter "Comment"
 * Example:
 *   801  trip      401       "SIS Trip Control"
 *   802  vlvarea   150       "PORV Opening"
 *   803  mflowfj   200010001 "Liquid Flow to RCS"
 */
export interface InteractiveInput {
  cardNumber: number;                    // 801-999
  controlType: InteractiveInputControlType;
  parameter: InteractiveInputParameter;  // Type depends on controlType
  comment?: string;                      // Max 32 characters
}

export interface ProjectMetadata {
  projectName: string;
  version: string;
  created: string;                // ISO date
  modified: string;               // ISO date
  author?: string;
  description?: string;

  // Project Category (계통)
  category?: ProjectCategory;     // 'nuclear' | 'power' | 'control'

  // Simulation Control
  simulationType?: 'transnt' | 'stdy-st';
  maxTime?: number;               // s
  minDt?: number;                 // s
  maxDt?: number;                 // s

  // Units
  unitSystem?: 'si' | 'british';
  workingFluid?: 'h2o' | 'air';

  // Global Settings
  globalSettings?: GlobalSettings;

  // RESTART 오버라이드 설정 (오버라이드 카드만, RESTART 모드일 때만 존재)
  restartSettings?: GlobalSettings;

  // Task Mode (프로젝트 수준 restart 판별)
  taskMode?: 'new' | 'restart';
}

// ============================================================================
// Project File Structure
// ============================================================================

export interface MARSProject {
  metadata: ProjectMetadata;
  nodes: Array<{
    id: string;
    type: ComponentType;
    position: { x: number; y: number };
    data: MARSNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    data?: MARSEdgeData;
  }>;
}

// ============================================================================
// File Generation
// ============================================================================

export interface GenerationResult {
  success: boolean;
  content?: string;
  filename?: string;
  errors?: ValidationError[];
}

// ============================================================================
// Component Configuration (for UI)
// ============================================================================

export interface ComponentConfig {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;               // Material-UI icon name
  color: string;              // hex color
  category: 'volume' | 'junction' | 'piping' | 'boundary' | 'thermal';
  isVolumeComponent: boolean;
  isJunctionComponent: boolean;
}

export const COMPONENT_CONFIGS: Record<ComponentType, ComponentConfig> = {
  snglvol: {
    type: 'snglvol',
    label: 'Single Volume',
    description: '단일 체적 - 탱크, 헤더, 플레넘',
    icon: 'CircleOutlined',
    color: '#2196F3',
    category: 'volume',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  sngljun: {
    type: 'sngljun',
    label: 'Single Junction',
    description: '단일 접합부 - 두 체적 연결',
    icon: 'RemoveOutlined',
    color: '#4CAF50',
    category: 'junction',
    isVolumeComponent: false,
    isJunctionComponent: true,
  },
  pipe: {
    type: 'pipe',
    label: 'Pipe',
    description: '다중 노드 배관',
    icon: 'HorizontalRuleOutlined',
    color: '#FF9800',
    category: 'piping',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  branch: {
    type: 'branch',
    label: 'Branch',
    description: '분기점 - 여러 접합부 연결',
    icon: 'CallSplitOutlined',
    color: '#00BCD4',
    category: 'volume',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  separatr: {
    type: 'separatr',
    label: 'Separator',
    description: '기수분리기 - Branch 구조 동일',
    icon: 'CallSplitOutlined',
    color: '#00BCD4',
    category: 'volume',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  tmdpvol: {
    type: 'tmdpvol',
    label: 'Time-Dep Volume',
    description: '시간 의존 체적 - 경계 조건',
    icon: 'AccessTimeOutlined',
    color: '#9C27B0',
    category: 'boundary',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  tmdpjun: {
    type: 'tmdpjun',
    label: 'Time-Dep Junction',
    description: '시간 의존 접합부 - 유량 조건',
    icon: 'TrendingFlatOutlined',
    color: '#E91E63',
    category: 'boundary',
    isVolumeComponent: false,
    isJunctionComponent: true,
  },
  mtpljun: {
    type: 'mtpljun',
    label: 'Multiple Junction',
    description: '다중 접합부 - 여러 체적 연결',
    icon: 'AccountTreeOutlined',
    color: '#795548',
    category: 'junction',
    isVolumeComponent: false,
    isJunctionComponent: true,
  },
  pump: {
    type: 'pump',
    label: 'Pump',
    description: '펌프 - 원자로 냉각재 펌프 (RCP)',
    icon: 'Loop',
    color: '#9C27B0',
    category: 'piping',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  htstr: {
    type: 'htstr',
    label: 'Heat Structure',
    description: '열구조체 - 고체 열전도 및 열전달',
    icon: 'LocalFireDepartmentOutlined',
    color: '#FF5722',
    category: 'thermal',
    isVolumeComponent: false,
    isJunctionComponent: false,
  },
  valve: {
    type: 'valve',
    label: 'Valve',
    description: '밸브 - Motor/Trip/Servo 밸브',
    icon: 'ToggleOnOutlined',
    color: '#9C27B0',
    category: 'junction',
    isVolumeComponent: false,
    isJunctionComponent: true,
  },
  turbine: {
    type: 'turbine',
    label: 'Turbine',
    description: '터빈 - 증기 터빈 (HP/LP)',
    icon: 'SettingsOutlined',
    color: '#607D8B',
    category: 'piping',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
  tank: {
    type: 'tank',
    label: 'Tank',
    description: '탱크 - 수위 추적 분기점',
    icon: 'InboxOutlined',
    color: '#0097A7',
    category: 'volume',
    isVolumeComponent: true,
    isJunctionComponent: false,
  },
};

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isVolumeComponent(type: ComponentType): boolean {
  return COMPONENT_CONFIGS[type].isVolumeComponent;
}

export function isJunctionComponent(type: ComponentType): boolean {
  return COMPONENT_CONFIGS[type].isJunctionComponent;
}

export function isSnglvolParameters(params: Partial<ComponentParameters>): params is SnglvolParameters {
  return 'volume' in params && 'hydraulicDiameter' in params && !('timeTable' in params);
}

export function isSngljunParameters(params: Partial<ComponentParameters>): params is SngljunParameters {
  return 'from' in params && 'to' in params && 'area' in params && !('ncells' in params) && !('njuns' in params) && !('timeTable' in params);
}

export function isPipeParameters(params: Partial<ComponentParameters>): params is PipeParameters {
  return 'ncells' in params && 'xArea' in params;
}

export function isBranchParameters(params: Partial<ComponentParameters>): params is BranchParameters {
  return 'njuns' in params && 'junctions' in params && Array.isArray(params.junctions);
}

export function isTmdpvolParameters(params: Partial<ComponentParameters>): params is TmdpvolParameters {
  return 'timeTable' in params && 'conditionType' in params && 'volume' in params;
}

export function isTmdpjunParameters(params: Partial<ComponentParameters>): params is TmdpjunParameters {
  return 'timeTable' in params && 'conditionType' in params && !('volume' in params);
}

export function isMtpljunParameters(params: Partial<ComponentParameters>): params is MtpljunParameters {
  return 'njuns' in params && 'icond' in params && 'junctions' in params;
}

export function isPumpParameters(params: Partial<ComponentParameters>): params is PumpParameters {
  return 'ratedSpeed' in params && 'momentOfInertia' in params && 'inletConnection' in params;
}

export function isHeatStructureParameters(params: Partial<ComponentParameters>): params is HeatStructureParameters {
  return 'nh' in params && 'np' in params && 'meshIntervals' in params && 'geometryType' in params;
}

export function isValveParameters(params: Partial<ComponentParameters>): params is ValveParameters {
  return 'valveSubType' in params && 'fwdLoss' in params && 'revLoss' in params;
}

export function isTurbineParameters(params: Partial<ComponentParameters>): params is TurbineParameters {
  return 'turbineType' in params && 'shaftSpeed' in params && 'junctions' in params;
}

export function isTankParameters(params: Partial<ComponentParameters>): params is TankParameters {
  return 'initialLiquidLevel' in params && 'volumeLevelCurve' in params && 'junctions' in params;
}

export function isSeparatorParameters(params: Partial<ComponentParameters>): params is SeparatorParameters {
  // separatorOption은 매뉴얼상 optional (CCC0002 카드), 기본값 0
  // junctions === 3이면서 Tank이 아닌 경우 SEPARATR로 판별
  return 'junctions' in params
    && Array.isArray(params.junctions) && params.junctions.length === 3
    && !('initialLiquidLevel' in params);
}

// Phase 2: Additional Boundary Type Guards
export function isHsAdditionalBoundary12Word(
  boundary: HsAdditionalBoundary | HsAdditionalBoundary12Word | HsAdditionalBoundary13Word
): boundary is HsAdditionalBoundary12Word {
  return 'naturalCirculationLength' in boundary &&
         'pitchToDiameterRatio' in boundary &&
         'foulingFactor' in boundary &&
         !('chfrCorrelationOption' in boundary);
}

export function isHsAdditionalBoundary13Word(
  boundary: HsAdditionalBoundary | HsAdditionalBoundary12Word | HsAdditionalBoundary13Word
): boundary is HsAdditionalBoundary13Word {
  return 'chfrCorrelationOption' in boundary;
}

