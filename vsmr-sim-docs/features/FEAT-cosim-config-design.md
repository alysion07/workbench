---
title: "Co-Sim 설정 페이지 — 설계 문서"
status: planned
phase: 3
branch: feat/cosim
related_prs: []
last_updated: 2026-04-14
---

# Co-Sim 설정 페이지 — 설계 문서

> PRD: [FEAT-cosim-config.md](./FEAT-cosim-config.md)

## 1. 타입 설계

### 1.1 cosim.ts 확장

기존 `CoSimConfig`, `ParticipantConfig`, `NmlCouplingConfig` 타입을 리팩터링한다.

```ts
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
  /** 컴포넌트 번호 (3자리, 예: 310) */
  componentNumber: string;
  /** 그룹 목록 */
  groups: CouplingGroup[];
}

/** 그룹 내 범위 */
export interface CouplingGroup {
  /** 그룹 번호 (1자리, 예: 1) */
  groupNumber: number;
  /** 시작 노드 (3자리, 예: 1) */
  startNode: number;
  /** 끝 노드 (3자리, 예: 12) */
  endNode: number;
}

// ============================================
// NML 설정 (커플링 경계면 + 모델별)
// ============================================

/** 모델별 NML 설정 — write/read data + init_wdata */
export interface NmlModelConfig {
  writeDataName: PreciceDataName;
  readDataName: PreciceDataName;
  /** 자동 도출 (표시용) */
  writeVariable: MarsWriteVariable;
  /** 초기값 (선택, Fortran double 형식 문자열) */
  initWdata?: string;
}

/** NML 설정 전체 — 공통 coupling_ids + 모델별 설정 */
export interface NmlConfig {
  /** 컴포넌트 그룹 기반 설정 (방법 A) */
  componentGroups: CouplingComponentGroup[];
  /** 직접 입력된 coupling_ids 문자열 (방법 B) — 최종 소스 */
  rawCouplingIds: string;
  /** 파싱된 coupling_ids 배열 (rawCouplingIds에서 파생) */
  couplingIds: number[];
  /** Model 1 설정 */
  model1: NmlModelConfig;
  /** Model 2 설정 */
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
  schemeType: CouplingSchemeType;
  maxTime: number;
  timeWindowSize: number;
  mappingType: MappingType;
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
```

### 1.2 ProjectData 연동

`supabase.ts`의 `ProjectData.coSimConfig`는 이미 존재:
```ts
export interface ProjectData {
  coSimConfig?: CoSimConfig;  // ← 이 필드 활용
  ...
}
```

## 2. Store 설계

### 2.1 coSimConfigStore (신규)

Co-Sim 설정 전용 Zustand store를 생성한다. simulationStore(런타임)과 분리.

```
파일: src/stores/coSimConfigStore.ts
```

**State:**
```ts
interface CoSimConfigStore {
  /** Co-Sim 설정 전체 */
  config: CoSimConfig | null;

  /** 설정 변경 추적 */
  isDirty: boolean;

  // Actions: 초기화/로드
  loadConfig: (config: CoSimConfig | null) => void;
  resetConfig: () => void;

  // Actions: coupling_ids
  setComponentGroups: (groups: CouplingComponentGroup[]) => void;
  setRawCouplingIds: (raw: string) => void;

  // Actions: 모델별 NML 설정
  setModel1DataNames: (write: PreciceDataName, read: PreciceDataName) => void;
  // Model 2는 자동 반전
  setModel1InitWdata: (value: string | undefined) => void;
  setModel2InitWdata: (value: string | undefined) => void;

  // Actions: XML 설정
  setSchemeType: (type: CouplingSchemeType) => void;
  setMaxTime: (value: number) => void;
  setTimeWindowSize: (value: number) => void;
  setMappingType: (type: MappingType) => void;

  // Derived
  getValidation: () => CoSimValidationResult;
}
```

**Persist**: localStorage에 저장하지 않음. ProjectData(Supabase)에 저장/로드.

**플로우**:
1. EditorPage 로드 시 `projectData.coSimConfig` → `loadConfig()`
2. 설정 변경 시 store 업데이트 + `isDirty = true`
3. 프로젝트 저장 시 `config` → `projectData.coSimConfig`에 반영 후 Supabase 저장

### 2.2 기존 Store 수정 없음

- `simulationStore`: 런타임 상태 전용, 변경 불필요
- `useStore` (FlowCanvas): 노드/엣지 상태, 변경 불필요
- `projectStore`: 프로젝트 저장/로드 시 coSimConfig 필드 전달만 추가

## 3. 컴포넌트 설계

### 3.1 CoSimPanel (신규)

```
파일: src/components/cosim/CoSimPanel.tsx
```

EditorPage 우측 패널에 렌더링. PropertyPanel/FullCodeView와 배타적.

**구조:**
```
CoSimPanel
├─ CouplingIdsSection          ← 커플링 경계면
│   ├─ ComponentGroupEditor    ← 방법 A (컴포넌트 + 그룹 + 범위)
│   ├─ RawIdsEditor            ← 방법 B (직접 입력 텍스트)
│   └─ IdsSummary              ← 합계 표시
│
├─ DataExchangeSection         ← 데이터 교환 설정
│   ├─ Model1Config            ← write/read_data_name 드롭다운
│   ├─ Model2Config            ← 자동 반전 (읽기 전용)
│   ├─ Model1InitWdata         ← init_wdata 입력
│   └─ Model2InitWdata         ← init_wdata 입력
│
├─ XmlConfigSection            ← 프로젝트 설정 (NML 완료 시 활성화)
│   ├─ SchemeTypeSelect        ← Coupling scheme 드롭다운
│   ├─ MaxTimeInput            ← 숫자 입력
│   ├─ TimeWindowSizeInput     ← 숫자 입력
│   └─ MappingTypeSelect       ← Mapping 드롭다운
│
└─ StatusFooter                ← 설정 완료 상태 표시
```

**Props:** 없음 (store에서 직접 구독)

### 3.2 CoSimStatusBanner (신규)

```
파일: src/components/cosim/CoSimStatusBanner.tsx
```

SimulationPage 상단에 Co-Sim 미완료 경고 배너 표시.

**Props:**
```ts
interface CoSimStatusBannerProps {
  validation: CoSimValidationResult;
  onNavigateToSettings: () => void;
}
```

### 3.3 EditorPage 수정

```diff
// activeView 확장
- const [activeView, setActiveView] = useState<'canvas' | 'settings'>('canvas');
+ const [activeView, setActiveView] = useState<'canvas' | 'settings' | 'cosim'>('canvas');

// 사이드바 항목 추가 (isMultiModel일 때만)
+ {
+   id: 'cosim',
+   label: 'Co-Sim Settings',
+   icon: <LinkIcon />,
+   type: 'action',
+   onClick: () => setActiveView('cosim'),
+   selected: activeView === 'cosim',
+ },

// 우측 패널 렌더링 조건 추가
+ {activeView === 'cosim' && (
+   <>
+     <PanelResizeHandle style={resizeHandleStyle} />
+     <Panel defaultSize={30} minSize={20} maxSize={50}>
+       <CoSimPanel />
+     </Panel>
+   </>
+ )}
```

**조건**: `isMultiModel`이 true일 때만 사이드바에 'cosim' 항목 노출.
`activeView === 'cosim'`일 때 PropertyPanel/FullCodeView 대신 CoSimPanel 렌더링.

### 3.4 SimulationPage 수정

- 헤더 영역에 `CoSimStatusBanner` 조건부 렌더링
- 실행 버튼 disabled 조건에 Co-Sim 검증 추가

## 4. 파일 생성 유틸리티

### 4.1 preciceXmlGenerator.ts (신규)

```
파일: src/utils/preciceXmlGenerator.ts
```

```ts
export function generatePreciceConfigXml(
  nml: NmlConfig,
  xml: XmlConfig,
  model1Name: string,
  model2Name: string,
): string
```

입력: CoSimConfig의 nml + xml + 모델명
출력: precice-config.xml 문자열

### 4.2 preciceMarsNmlGenerator.ts (신규)

```
파일: src/utils/preciceMarsNmlGenerator.ts
```

```ts
export function generatePreciceMarsNml(
  participantName: string,
  meshName: string,
  modelConfig: NmlModelConfig,
  couplingIds: number[],
): string
```

입력: 참여자 정보 + NML 모델 설정 + coupling_ids
출력: precice_mars.nml 문자열 (Fortran namelist 포맷)

## 5. 실행 검증 Hook

### 5.1 useCoSimValidation (신규)

```
파일: src/hooks/useCoSimValidation.ts
```

```ts
export function useCoSimValidation(): {
  isCoSimMode: boolean;        // 모델 2개 이상
  validation: CoSimValidationResult;
  canExecute: boolean;         // 단일모델이거나 Co-Sim 설정 완료
  statusMessage: string | null;
}
```

모든 실행 경로에서 이 hook을 사용하여 Co-Sim 검증 수행.

## 6. 데이터 플로우

```
[EditorPage 로드]
  └→ projectStore.fetchProject()
      └→ projectData.coSimConfig
          └→ coSimConfigStore.loadConfig()

[CoSimPanel에서 설정 변경]
  └→ coSimConfigStore 업데이트
      └→ isDirty = true

[프로젝트 저장 (handleSave)]
  └→ coSimConfigStore.config → projectData.coSimConfig에 병합
      └→ projectStore.updateProject()
          └→ Supabase 저장

[실행 요청]
  └→ useCoSimValidation.canExecute 확인
      ├→ false: 경고 + 차단
      └→ true: XML/NML 생성 → 업로드 → 실행
```

## 7. 파일 목록

### 신규 파일
| 파일 | 용도 |
|------|------|
| `src/stores/coSimConfigStore.ts` | Co-Sim 설정 상태 관리 |
| `src/components/cosim/CoSimPanel.tsx` | 설정 메인 패널 |
| `src/components/cosim/CouplingIdsSection.tsx` | coupling_ids 입력 섹션 |
| `src/components/cosim/DataExchangeSection.tsx` | write/read data 설정 섹션 |
| `src/components/cosim/XmlConfigSection.tsx` | XML 프로젝트 설정 섹션 |
| `src/components/cosim/CoSimStatusBanner.tsx` | SimulationPage 경고 배너 |
| `src/utils/preciceXmlGenerator.ts` | XML 파일 생성 |
| `src/utils/preciceMarsNmlGenerator.ts` | NML 파일 생성 |
| `src/hooks/useCoSimValidation.ts` | 실행 전 검증 hook |

### 수정 파일
| 파일 | 수정 내용 |
|------|-----------|
| `src/types/cosim.ts` | 타입 전면 리팩터링 |
| `src/pages/EditorPage.tsx` | 사이드바 항목 + 우측 패널 CoSimPanel |
| `src/pages/SimulationPage.tsx` | 상태 배너 + 실행 차단 |
| `src/hooks/useCoSimQuickRun.ts` | 파일 자동 생성 연동 |
| `src/stores/projectStore.ts` | 저장/로드 시 coSimConfig 전달 |
