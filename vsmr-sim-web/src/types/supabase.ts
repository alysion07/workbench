/**
 * Supabase Database Types
 *
 * Supabase projects 테이블 및 관련 타입 정의
 * MAIN-001, MDH-001 지원을 위한 계층형 데이터 구조
 */

import type { TaskMode } from './simulation';
import type { CoSimConfig, NmlCouplingConfig } from './cosim';

// ============================================
// 기본 타입 정의
// ============================================

/**
 * @deprecated Category는 더 이상 사용하지 않음 - DB 스키마에서 제거 예정
 */
export type ProjectCategory = 'nuclear' | 'power' | 'control';

// 계통 스코프 타입 (primary, secondary, bop)
export type SystemScope = 'primary' | 'secondary' | 'bop';

// 분석 코드 타입 (복수 선택 가능)
export type AnalysisCode = 'MARS' | 'SPHINCS' | 'Modelica';

// MARS Problem Type (Card 100 W1)
export type MARSProblemType = 'NEW' | 'RESTART';

// MARS Problem Option (Card 100 W2)
export type MARSProblemOption = 'STDY-ST' | 'TRANSNT';

// RESTART 소스 참조 정보 (Card 103)
export interface RestartSource {
  projectId: string;          // 소스 프로젝트 ID
  projectName: string;        // 표시용 (denormalized)
  modelId: string;            // 소스 모델 ID
  modelName: string;          // 표시용 (denormalized)
  simulationId?: string;      // 특정 시뮬레이션 run
  restartNumber: number;      // restart block 번호 (-1 = 마지막)
  rstpltPath?: string;        // MinIO 경로 (auto-resolved)
}

// MARS 설정 (파티션별)
export interface MARSConfig {
  problemType: MARSProblemType;       // NEW | RESTART
  problemOption: MARSProblemOption;   // STDY-ST | TRANSNT
  restartSource?: RestartSource;      // RESTART일 때만
}

// ============================================
// Model 관련 타입 (MAIN-001, MDH-001)
// ============================================

// 모델 스코프 (계통 + 컴포넌트)
export interface ModelScope {
  systems: SystemScope[];    // 계통 레벨: ['primary'], ['secondary', 'bop'] 등
  components: string[];      // 개별 컴포넌트 ID들 (선택적)
}

// 버전 히스토리 엔트리
export interface VersionEntry {
  version: string;           // "1.0", "1.1", "1.2"
  timestamp: string;         // ISO timestamp
  author: string;            // 작성자 이름/ID
  description: string;       // "Nodalization Diagram 수정"
}

// 시뮬레이션 히스토리 엔트리
export interface SimulationEntry {
  id: string;                // UUID
  name: string;              // "LOFW Simulation"
  timestamp: string;         // ISO timestamp
  duration: string;          // "3 sec"
  timeRange: string;         // "13:00:00 ~ 14:00:00"
  status: 'Running' | 'Success' | 'Failed' | 'Stopped';
  modelId: string;           // 연관된 모델 ID
  // Co-Sim 확장 필드
  simId?: string;            // Co-Sim 시뮬레이션 ID
  taskIds?: string[];        // Co-Sim 내 각 모델의 task ID 목록
}

// 모델 인터페이스 (프로젝트 내 개별 모델)
export interface Model {
  id: string;                       // UUID
  name: string;                     // "Reactor Coolant System"
  analysisCodes: AnalysisCode[];    // 복수 선택: ['MARS', 'SPHINCS']
  description: string | null;
  scope: ModelScope;                // 담당 스코프 (중복 불가)
  nodes: any[];                     // ReactFlow 노드
  edges: any[];                     // ReactFlow 엣지
  settings: any;                    // 모델별 설정 (NEW 해석용 전체)
  restartSettings?: any;            // RESTART 오버라이드 설정 (오버라이드 카드만)
  svgLibrary?: any[];               // SVG 라이브러리 아이템 목록
  defaultSvgByType?: Record<string, string>;  // 컴포넌트 타입별 기본 SVG ID
  nmlCouplingConfig?: NmlCouplingConfig;  // Co-Sim NML 커플링 설정
  updateHistory: VersionEntry[];    // 모델 버전 히스토리
  created_at: string;               // ISO timestamp
  updated_at: string;               // ISO timestamp
}

// 새 모델 생성 시 필요한 필드
export interface ModelInsert {
  name: string;
  analysisCodes: AnalysisCode[];
  description?: string | null;
  scope: ModelScope;
  nodes?: any[];
  edges?: any[];
  settings?: any;
  restartSettings?: any;
  nmlCouplingConfig?: NmlCouplingConfig;
}

// 모델 업데이트 시 사용할 필드
export interface ModelUpdate {
  name?: string;
  analysisCodes?: AnalysisCode[];
  description?: string | null;
  scope?: ModelScope;
  nodes?: any[];
  edges?: any[];
  settings?: any;
  restartSettings?: any;
  svgLibrary?: any[];
  defaultSvgByType?: Record<string, string>;
  nmlCouplingConfig?: NmlCouplingConfig;
}

// ============================================
// Project 타입 정의
// ============================================

// Projects 테이블 Row 타입 (DB에서 조회 시)
export interface Project {
  id: string; // UUID
  user_id: string; // auth.uid()
  name: string;
  description: string | null;
  /** @deprecated Category는 더 이상 사용하지 않음 */
  category?: ProjectCategory;
  data: ProjectData | null; // JSONB
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// 프로젝트 생성 시 필요한 필드
export interface ProjectInsert {
  name: string;
  description?: string | null;
  /** @deprecated Category는 더 이상 사용하지 않음 */
  category?: ProjectCategory;
  data?: ProjectData | null;
  // user_id는 RLS에서 자동으로 auth.uid() 사용
}

// 프로젝트 업데이트 시 사용할 필드
export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  /** @deprecated Category는 더 이상 사용하지 않음 */
  category?: ProjectCategory;
  data?: ProjectData | null;
}

// Project Scope 타입 (PRJ-001-NP) - SystemScope의 별칭으로 유지 (하위 호환)
export type ProjectScope = SystemScope;

// Project Partition 설정 (PRJ-001-NP)
export interface ProjectPartition {
  nsssModel?: boolean;
  bopModel?: boolean;
  analysisCode?: AnalysisCode | string;
}

// ============================================
// ProjectData 타입 (JSONB 컬럼)
// ============================================

/**
 * 프로젝트 데이터 (JSONB)
 * - 새 구조: totalScope, models[], updateHistory[], simulationHistory[]
 * - 레거시 구조: nodes, edges, globalSettings, metadata (자동 마이그레이션)
 */
export interface ProjectData {
  // 새 구조 (MAIN-001, MDH-001)
  totalScope?: ModelScope;                    // 프로젝트 전체 스코프
  models?: Model[];                           // 모델 목록
  updateHistory?: VersionEntry[];             // 프로젝트 버전 히스토리
  simulationHistory?: SimulationEntry[];      // 시뮬레이션 히스토리
  coSimConfig?: CoSimConfig;                  // Co-Sim 프로젝트 레벨 설정

  // 레거시 구조 (마이그레이션 전 데이터 호환)
  /** @deprecated models[] 사용 권장 - 자동 마이그레이션됨 */
  nodes?: any[];
  /** @deprecated models[] 사용 권장 - 자동 마이그레이션됨 */
  edges?: any[];
  /** @deprecated models[].settings 사용 권장 */
  globalSettings?: any;
  /** @deprecated totalScope, models[].scope 사용 권장 */
  metadata?: {
    version?: string;
    lastModified?: string;
    scope?: ProjectScope[];
    partition?: ProjectPartition;
    taskMode?: TaskMode;                      // 작업 모드 (new: 신규, restart: 재시작)
    restartProjectId?: string;                // RESTART 소스 프로젝트 ID (UUID)
    restartSourceTaskId?: string;             // RESTART 소스 태스크 ID (UUID)
    restartSimulationId?: string;             // RESTART 소스 시뮬레이션 run ID (UUID, undefined = 마지막)
    tags?: string[];
    [key: string]: any;
  };
}

// 프로젝트 목록 조회 시 반환되는 요약 정보
export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  /** @deprecated Category는 더 이상 사용하지 않음 */
  category?: ProjectCategory;
  created_at: string;
  updated_at: string;
  nodeCount: number; // data.nodes.length
  modelCount?: number; // models.length
}

// ============================================
// 프로젝트 생성 폼 타입 (NewProjectDialog)
// ============================================

/**
 * 프로젝트 생성 시 파티션(모델) 정의
 * - 각 파티션은 프로젝트 전체 스코프의 일부를 담당
 * - 파티션 간 스코프 중복 불가 (mutually exclusive)
 */
export interface PartitionFormData {
  id: string;                    // 임시 ID (폼 내 식별용)
  name: string;                  // 모델 이름: "NSSS Model"
  analysisCode: AnalysisCode;    // 분석 코드: MARS | SPHINCS | Modelica
  description?: string;          // 모델 설명 (선택)
  scope: SystemScope[];          // 담당 계통: ['primary'] 또는 ['secondary', 'bop']
  marsConfig?: MARSConfig;       // MARS 설정 (MARS 선택 시만 사용)
}

/**
 * 새 프로젝트 생성 폼 데이터
 */
export interface NewProjectFormData {
  title: string;                       // 프로젝트 이름
  description: string;                 // 프로젝트 설명
  tags: string[];                      // 태그 목록
  scope: SystemScope[];                // 전체 프로젝트 스코프
  partitions: PartitionFormData[];     // 모델(파티션) 목록
}
