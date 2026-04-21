---
title: "WORKFLOW: SMART.i 누락 항목 보완 — 구현 워크플로우"
status: planned
phase: 3
last_updated: 2026-04-03
---

# WORKFLOW: SMART.i 누락 항목 보완 — 구현 워크플로우

> **요구사항**: [FEAT-missing-components.md](FEAT-missing-components.md)
> **일자**: 2026-02-20
> **예상 Phase**: 5단계

---

## Phase 1: GlobalSettings UI 카테고리 그룹화

> **목표**: 수평 탭 8개 → 좌측 카테고리 네비게이션 (3그룹) 변환
> **의존성**: 없음 (기존 탭만 재배치)

### Step 1.1 — GlobalSettingsDialog 레이아웃 변환

**파일**: `src/components/GlobalSettingsDialog.tsx`

**변경 사항**:
1. `maxWidth` → `"md"` → `"lg"` 변경
2. 수평 `<Tabs>` 제거
3. `<DialogContent>` 내부를 좌우 분할 레이아웃으로 변경:
   - 좌측 (200px 고정): MUI `List` + `ListItemButton` + `Collapse`
   - 우측 (나머지): 기존 탭 콘텐츠

**카테고리 구성**:
```typescript
const SETTING_CATEGORIES = [
  {
    label: '기본 설정',
    items: [
      { key: 'projectSetup',    label: 'Project Setup',      index: 0 },
      { key: 'systemConfig',    label: 'System Config',      index: 1 },
      { key: 'simControl',      label: 'Simulation Control', index: 2 },
      { key: 'minorEdits',      label: 'Minor Edits',        index: 3 },
    ]
  },
  {
    label: '트립/제어',
    items: [
      { key: 'variableTrips',   label: 'Variable Trips',     index: 4 },
      { key: 'logicTrips',      label: 'Logic Trips',        index: 5 },
      { key: 'controlVars',     label: 'Control Variables',  index: 6 },
    ]
  },
  {
    label: '테이블/물리',
    items: [
      { key: 'generalTables',   label: 'General Tables',     index: 7 },
      { key: 'reactorKinetics', label: 'Reactor Kinetics',   index: 8 },
      { key: 'thermalProps',    label: 'Thermal Properties',  index: 9 },
    ]
  }
];
```

**핵심 구현 세부사항**:
- `activeTab` 상태(숫자 인덱스) 유지 → 기존 TabPanel 로직과 호환
- `initialTab` prop 동작 그대로 유지 (숫자 → 해당 카테고리 자동 펼침)
- 카테고리 접기/펼치기: `Collapse` 컴포넌트, 기본값 모두 펼침
- 선택된 항목 하이라이트: `ListItemButton`의 `selected` prop
- 새 탭 2개(index 7, 8)는 빈 플레이스홀더로 우선 추가 ("Phase 2/3에서 구현")

**주의**: 기존 `initialTab` 매핑이 변경됨
- 기존: `6 = Control Variables`, `7 = Thermal Properties`
- 변경: `6 = Control Variables`, `7 = General Tables`, `8 = Reactor Kinetics`, `9 = Thermal Properties`
- **ValveForm 등에서 `initialTab: 6`으로 CV 탭을 여는 코드** → 영향 없음 (인덱스 6은 그대로 CV)
- **Thermal Properties 직접 열기가 있는지 확인** → `initialTab: 7` → `9`로 변경 필요

### Step 1.2 — initialTab 참조 업데이트

**검색 대상**: 프로젝트 전체에서 `initialTab` 또는 `globalSettingsDialogInitialTab` 참조
- store의 `openGlobalSettingsDialog(tab: number)` 호출처 확인
- Thermal Properties 탭(기존 7 → 9)을 직접 여는 곳이 있으면 인덱스 수정

### Step 1.3 — 검증

- [ ] 모든 기존 탭이 정상 렌더링되는지 확인
- [ ] 카테고리 접기/펼치기 동작 확인
- [ ] initialTab으로 특정 탭 직접 열기 확인 (ValveForm → CV 탭)
- [ ] Save/Cancel 기존 동작 유지 확인
- [ ] 빌드 성공 확인 (`npm run build`)

---

## Phase 2: General Tables (202TTT00)

> **목표**: General Table 타입 정의 + 스토어 + UI 탭 + 파일 생성
> **의존성**: Phase 1 (카테고리 UI에 탭 자리 확보됨)

### Step 2.1 — 타입 정의

**파일**: `src/types/mars.ts`

**추가 위치**: `GlobalSettings` 인터페이스 근처 (라인 ~1130)

```typescript
// General Table (202TTTNN)
export interface GeneralTableDataPoint {
  x: number;
  y: number;
}

export interface GeneralTable {
  tableNumber: number;          // TTT (1~999)
  name: string;                 // 사용자 설명 (주석용)
  type: 'reac-t' | 'power';    // 테이블 타입 키워드
  tripNumber?: number;          // 'power' 타입일 때 trip 참조
  scaleX?: number;              // X 스케일 인수
  scaleY?: number;              // Y 스케일 인수
  dataPoints: GeneralTableDataPoint[];
}
```

**GlobalSettings 인터페이스 수정** (라인 1130~1145):
```typescript
export interface GlobalSettings {
  // ... 기존 필드 ...
  generalTables?: GeneralTable[];           // Card 202TTTNN - General Tables (추가)
  thermalProperties?: ThermalProperty[];    // 기존
}
```

### Step 2.2 — 스토어 업데이트

**파일**: `src/stores/useStore.ts`

**패턴**: `updateGlobalSettings` shallow merge 사용 (CV 패턴과 동일)
- General Table의 CRUD는 `GeneralTablesTab` 내부에서 로컬 상태로 관리
- Save 시 `updateGlobalSettings({ generalTables: [...] })`로 전체 배열 저장

**기본값 업데이트**: `src/utils/globalSettingsValidation.ts`
- `getDefaultGlobalSettings()`에 `generalTables: []` 추가

### Step 2.3 — UI 탭 컴포넌트

**새 파일**: `src/components/globalSettings/GeneralTablesTab.tsx`

**Props 패턴** (기존 ControlVariablesTab과 동일):
```typescript
interface GeneralTablesTabProps {
  generalTables: GeneralTable[];
  onChange: (tables: GeneralTable[]) => void;
  // 선택: variableTrips, logicTrips 전달 (trip 참조 검증용)
}
```

**UI 구성**:
```
┌─────────────────────────────────────────────┐
│ General Tables                    [+ 추가]  │
├─────────────────────────────────────────────┤
│ ┌─ GT 목록 (Accordion 또는 List) ─────────┐ │
│ │ ▶ GT100 - 스크램 반응도 테이블           │ │
│ │ ▶ GT501 - PZR 실제 수위                 │ │
│ │ ▶ GT502 - PZR 프로그램 수위              │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ 선택된 GT 편집 ─────────────────────────┐ │
│ │ 번호: [___] 이름: [____________]         │ │
│ │ 타입: [reac-t ▼]  Trip: [___]            │ │
│ │                                         │ │
│ │ 데이터 포인트:                [+ 행 추가] │ │
│ │ ┌──────┬──────┬──────┐                  │ │
│ │ │  #   │  X   │  Y   │                  │ │
│ │ ├──────┼──────┼──────┤                  │ │
│ │ │  1   │ 0.0  │ 0.0  │  [삭제]          │ │
│ │ │  2   │15.16 │25.0  │  [삭제]          │ │
│ │ └──────┴──────┴──────┘                  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**핵심 포인트**:
- Accordion 패턴으로 테이블 목록 표시 (MUI `Accordion`)
- 각 테이블 확장 시 편집 폼 표시
- 데이터 포인트는 테이블 형태 (MUI `Table` 또는 직접 그리드)
- 테이블 번호 중복 검증
- 삭제 시 확인 다이얼로그 (다른 컴포넌트에서 참조 중일 수 있음)

### Step 2.4 — GlobalSettingsDialog에 탭 연결

**파일**: `src/components/GlobalSettingsDialog.tsx`

1. `GeneralTablesTab` 임포트 추가
2. index 7에 `GeneralTablesTab` 렌더링 (Phase 1의 플레이스홀더 대체)
3. `localSettings` 내 `generalTables` 상태 관리 연결
4. Save 시 validation 추가 (테이블 번호 중복, 빈 데이터 포인트 등)

### Step 2.5 — 파일 생성

**파일**: `src/utils/fileGenerator.ts`

**새 함수**: `generateGeneralTableCards(tables: GeneralTable[]): string[]`
```
* ================================================
* GENERAL TABLES
* ================================================
*
* General Table 100: 스크램 반응도 테이블
20210000   reac-t
20210001   0.000           0.000000
20210002   0.138          -0.663931
...
*
* General Table 501: PZR 실제 수위
20250100   reac-t
20250101   0.0             0.0
...
```

**카드 번호 생성 로직**:
```typescript
// TTT = tableNumber (3자리), NN = 데이터 포인트 인덱스 (00=헤더, 01~99=데이터)
const ttt = table.tableNumber.toString().padStart(3, '0');  // 주의: 3자리가 아닐 수 있음
// GT100 → 20210000, GT501 → 20250100
// 실제 패턴: 202 + TTT(가변길이) + NN(2자리)
```

**주의 — 카드 번호 패딩 규칙**:
SMART.i 분석 결과, GT100은 `20210000`이고 GT501은 `20250100`입니다.
- `202` + `100` + `00` = `20210000` (8자리)
- `202` + `501` + `00` = `20250100` (8자리)
- 규칙: `202` + `TTT` + `NN` → 항상 8자리 (TTT는 왼쪽 정렬, 빈자리 없음)

**삽입 위치**: `generate()` 함수에서 CONTROL SYSTEM 섹션(라인 149) **직전**에 호출

### Step 2.6 — FUNCTION CV 드롭다운 연동

**파일**: `src/components/globalSettings/ControlVariablesTab.tsx`

**변경**: FUNCTION 타입 CV 편집 다이얼로그에서 `tableNumber` 필드를:
- 기존: 숫자 직접 입력
- 변경: 기존 General Tables 목록에서 드롭다운 선택 + 수동 입력 폴백

**Props 추가**: `ControlVariablesTab`에 `generalTables: GeneralTable[]` prop 전달

### Step 2.7 — 검증

- [ ] General Table CRUD 동작 확인
- [ ] 테이블 번호 중복 검증
- [ ] 파일 생성 결과가 SMART.i 레퍼런스와 일치하는지 확인
- [ ] FUNCTION CV에서 GT 드롭다운 선택 동작 확인
- [ ] 빌드 성공 확인

---

## Phase 3: Point Reactor Kinetics (30000000)

> **목표**: Kinetics 타입 정의 + 스토어 + UI 탭 + 파일 생성
> **의존성**: Phase 2 (GT 참조 필요 — 외부 반응도 테이블)

### Step 3.1 — 타입 정의

**파일**: `src/types/mars.ts`

**추가 위치**: `GeneralTable` 타입 근처

```typescript
// Point Reactor Kinetics (30000000 series)
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

  // 30000000
  kineticsType: 'point';
  feedbackType: 'separabl' | 'nonseparabl';

  // 30000001
  decayType: 'gamma-ac';
  power: number;
  reactivity: number;
  inverseLambda: number;
  fpyf: number;

  // 30000002
  ansStandard: 'ans79-1';
  additionalDecayHeat: number;

  // 30000011
  externalReactivityTableNumber?: number;

  // 3000050N
  moderatorDensityReactivity: ReactivityDataPoint[];

  // 3000060N
  dopplerReactivity: ReactivityDataPoint[];

  // 3000070N
  densityWeightingFactors: WeightingFactor[];

  // 3000080N
  dopplerWeightingFactors: WeightingFactor[];
}
```

**GlobalSettings에 추가**:
```typescript
reactorKinetics?: PointReactorKinetics;  // Card 30000000 series
```

### Step 3.2 — 스토어 업데이트

**패턴**: `updateGlobalSettings({ reactorKinetics: {...} })`
- Kinetics는 단일 객체이므로 전체 교체

**기본값**: `getDefaultGlobalSettings()`에 추가
```typescript
reactorKinetics: {
  enabled: false,
  kineticsType: 'point',
  feedbackType: 'separabl',
  decayType: 'gamma-ac',
  power: 0, reactivity: 0, inverseLambda: 0, fpyf: 1.0,
  ansStandard: 'ans79-1',
  additionalDecayHeat: 0,
  moderatorDensityReactivity: [],
  dopplerReactivity: [],
  densityWeightingFactors: [],
  dopplerWeightingFactors: [],
}
```

### Step 3.3 — UI 탭 컴포넌트

**새 파일**: `src/components/globalSettings/ReactorKineticsTab.tsx`

**UI 구성** (섹션별 접을 수 있는 Accordion):
```
┌─────────────────────────────────────────────────┐
│ Reactor Kinetics                                │
│ ┌─ 활성화 ─────────────────────────────────────┐ │
│ │ [✓] Point Reactor Kinetics 활성화            │ │
│ └───────────────────────────────────────────────┘ │
│                                                 │
│ ▶ 기본 설정 (30000000)                           │
│   피드백 타입: [separabl ▼]                      │
│                                                 │
│ ▶ 중성자 물리 (30000001)                         │
│   초기 출력(W):    [330.0e6 ]                    │
│   초기 반응도($):  [0.0     ]                    │
│   1/Λ (1/s):      [347.826 ]                    │
│   FPYF:           [1.2     ]                    │
│                                                 │
│ ▶ 붕괴열 (30000002)                              │
│   ANS 표준:    [ans79-1 ▼]                       │
│   추가 붕괴열(W): [200.0  ]                      │
│                                                 │
│ ▶ 외부 반응도 (30000011)                         │
│   General Table: [GT100 - 스크램 반응도 ▼]       │
│                                                 │
│ ▶ 감속재 밀도 반응도 (3000050N)     [+ 행 추가]  │
│   ┌───────────┬──────────────┐                   │
│   │ 밀도(kg/m³)│ 반응도($)     │                  │
│   │ 0.0       │ 0.0          │                   │
│   │ 1000.0    │ 0.0          │                   │
│   └───────────┴──────────────┘                   │
│                                                 │
│ ▶ 도플러 반응도 (3000060N)          [+ 행 추가]  │
│   ┌───────────┬──────────────┐                   │
│   │ 온도(K)   │ 반응도($)     │                   │
│   │ 100.0     │ 0.0          │                   │
│   │ 3000.0    │ 0.0          │                   │
│   └───────────┴──────────────┘                   │
│                                                 │
│ ▶ 밀도 가중치 인수 (3000070N)       [+ 행 추가]  │
│   ┌──────────────┬────┬────────┬──────┐          │
│   │ Volume       │증분│ 인수   │ 계수 │           │
│   │ [C120-1 ▼]   │ 0 │0.05324│ 0.0  │           │
│   │ [C120-2 ▼]   │ 0 │0.06797│ 0.0  │           │
│   └──────────────┴────┴────────┴──────┘          │
│                                                 │
│ ▶ 도플러 가중치 인수 (3000080N)     [+ 행 추가]  │
│   ┌──────────────┬────┬────────┬──────┐          │
│   │ HeatStr      │증분│ 인수   │ 계수 │           │
│   │ [S1200-1 ▼]  │ 0 │0.05324│ 0.0  │           │
│   └──────────────┴────┴────────┴──────┘          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**드롭다운 데이터 소스**:
- **General Table 드롭다운**: `globalSettings.generalTables` 배열에서 번호+이름 표시
- **Volume 드롭다운**: 캔버스 노드에서 Hydrodynamic 컴포넌트(PIPE, SNGLVOL, BRANCH 등)의 `componentId` 목록
- **HeatStructure 드롭다운**: 캔버스 노드에서 HTSTR 타입의 `componentId` 목록

**Props**:
```typescript
interface ReactorKineticsTabProps {
  kinetics: PointReactorKinetics;
  onChange: (kinetics: PointReactorKinetics) => void;
  generalTables: GeneralTable[];       // GT 드롭다운용
  nodes: Node[];                       // Volume/HTSTR 드롭다운용
}
```

### Step 3.4 — GlobalSettingsDialog에 탭 연결

**파일**: `src/components/GlobalSettingsDialog.tsx`

1. `ReactorKineticsTab` 임포트
2. index 8에 렌더링 (Phase 1의 플레이스홀더 대체)
3. `nodes` 데이터를 store에서 가져와 props로 전달
4. Save 시 validation: enabled=true인데 필수값 미입력 체크

### Step 3.5 — 파일 생성

**파일**: `src/utils/fileGenerator.ts`

**새 함수**: `generateReactorKineticsCards(kinetics: PointReactorKinetics): string[]`

**생성 순서**:
```
* ================================================
* POINT REACTOR KINETICS
* ================================================
30000000   point      separabl
30000001   gamma-ac   330.0e6   0.0   347.826087   1.2
30000002   ans79-1    200.0
*
30000011   100
*
* Moderator Density Reactivity
30000501   0.0         0.0
30000502   1000.0      0.0
*
* Doppler Reactivity
30000601   100.0       0.0
30000602   3000.0      0.0
*
* Density Weighting Factors
30000701   120010000   0   0.05324   0.0
30000702   120020000   0   0.06797   0.0
...
*
* Doppler Weighting Factors
30000801   1200001   0   0.05324   0.0
30000802   1200002   0   0.06797   0.0
...
```

**삽입 위치**: `generate()` 함수에서 HYDRODYNAMIC COMPONENTS 섹션 **직전** (현재 라인 183)
- 순서: ... → Thermal Properties → **General Tables** → **Reactor Kinetics** → Hydrodynamic Components → End

**`enabled: false`이면 전체 섹션 생략**

### Step 3.6 — 검증

- [ ] Kinetics 활성화/비활성화 시 카드 생성/미생성 확인
- [ ] GT 참조 드롭다운 동작 확인
- [ ] Volume/HTSTR 드롭다운 목록 정확성 확인
- [ ] 파일 생성 결과가 SMART.i 레퍼런스 `30000000` 시리즈와 일치하는지 비교
- [ ] 빌드 성공 확인

---

## Phase 4: Valve chkvlv 서브타입

> **목표**: chkvlv를 ValveSubType에 추가, UI + 파일 생성 지원
> **의존성**: 없음 (독립적, Phase 1~3과 병렬 가능)

### Step 4.1 — 타입 추가

**파일**: `src/types/mars.ts` (라인 798)

```typescript
// 변경 전
export type ValveSubType = 'mtrvlv' | 'trpvlv' | 'srvvlv';
// 변경 후
export type ValveSubType = 'mtrvlv' | 'trpvlv' | 'srvvlv' | 'chkvlv';
```

### Step 4.2 — UI 업데이트

**파일**: `src/components/forms/ValveForm.tsx`

- 서브타입 선택 드롭다운에 `chkvlv` (Check Valve) 옵션 추가
- `chkvlv` 선택 시 표시할 필드: `trpvlv`와 유사 (trip 참조 기반)
- chkvlv 특화 필드가 있다면 매뉴얼 Section 8.15.6 확인 후 추가

**참고**: 매뉴얼 확인 전까지는 `trpvlv`와 동일한 UI로 구현하되,
`valveSubType` 값만 `'chkvlv'`로 구분

### Step 4.3 — 파일 생성

**파일**: `src/utils/fileGenerator.ts` (라인 ~1659 switch문)

`generateValveCards` 내 switch문에 `case 'chkvlv':` 분기 추가:
```typescript
case 'chkvlv':
  // CCC0001에 'chkvlv' 키워드
  // CCC0301 카드 형식은 매뉴얼 확인 후 결정
  // 기본: trpvlv와 동일한 패턴 (trip 참조)
  break;
```

### Step 4.4 — 검증

- [ ] Valve 노드에서 chkvlv 서브타입 선택 가능 확인
- [ ] 파일 생성 시 `chkvlv` 키워드 출력 확인
- [ ] 기존 mtrvlv/trpvlv/srvvlv에 영향 없음 확인
- [ ] 빌드 성공 확인

---

## Phase 5: Card 001 / 104 / 105

> **목표**: 선택적 카드를 기존 탭에 필드로 추가
> **의존성**: Phase 1 (탭 위치 확정)

### Step 5.1 — 타입 추가

**파일**: `src/types/mars.ts` → `GlobalSettings` 인터페이스

```typescript
export interface GlobalSettings {
  // ... 기존 필드 ...
  devModelControl?: number;            // Card 001
  restartPlot?: {                      // Card 104
    action: 'cmpress' | 'ncmpress';
    fileName: string;
  };
  cpuTime?: {                          // Card 105
    limit1: number;
    limit2: number;
  };
}
```

### Step 5.2 — UI 필드 추가

**Card 001** → `src/components/globalSettings/ProjectSetupTab.tsx` 또는 `SystemConfigTab.tsx`
- "Development Model Control" 섹션 추가
- 선택적 숫자 입력 (비어있으면 카드 미생성)
- 도움말 텍스트: "MARS 개발 옵션 (예: 76=New EOS+JHD, 85=New EOS+tecplot)"

**Card 104** → `src/components/globalSettings/ProjectSetupTab.tsx`
- "Restart-Plot File" 섹션 추가
- 활성화 체크박스 + 압축 옵션 선택 + 파일명 입력

**Card 105** → `src/components/globalSettings/SimulationControlTab.tsx`
- "CPU Time Limits" 섹션 추가
- 활성화 체크박스 + limit1/limit2 숫자 입력

### Step 5.3 — 파일 생성

**파일**: `src/utils/fileGenerator.ts` → `generateGlobalCards()` 내

Card 001, 104, 105는 Global Control Cards 섹션에 속하므로
기존 `generateGlobalCards()` 함수 내에서 Card 100~115 다음에 추가:

```
001  {devModelControl}     ← 값이 있을 때만
104  {action}  {fileName}  ← restartPlot이 있을 때만
105  {limit1}  {limit2}    ← cpuTime이 있을 때만
```

### Step 5.4 — 검증

- [ ] 각 카드 필드가 비어있을 때 카드 미생성 확인
- [ ] 값 입력 시 올바른 카드 형식 생성 확인
- [ ] 기존 카드(100~115)에 영향 없음 확인
- [ ] 빌드 성공 확인

---

## 전체 파일 변경 매트릭스

| 파일 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|---------|---------|---------|---------|---------|
| `src/types/mars.ts` | | ✏️ GT 타입 + GS필드 | ✏️ Kinetics 타입 + GS필드 | ✏️ ValveSubType | ✏️ GS필드 3개 |
| `src/stores/useStore.ts` | | ✏️ 기본값 | ✏️ 기본값 | | |
| `src/utils/globalSettingsValidation.ts` | | ✏️ 기본값 | ✏️ 기본값 | | |
| `src/components/GlobalSettingsDialog.tsx` | ✏️ 레이아웃 변환 | ✏️ GT탭 연결 | ✏️ Kinetics탭 연결 | | |
| `src/components/globalSettings/GeneralTablesTab.tsx` | | 🆕 신규 | | | |
| `src/components/globalSettings/ReactorKineticsTab.tsx` | | | 🆕 신규 | | |
| `src/components/globalSettings/ControlVariablesTab.tsx` | | ✏️ GT 드롭다운 | | | |
| `src/components/globalSettings/ProjectSetupTab.tsx` | | | | | ✏️ 001, 104 |
| `src/components/globalSettings/SimulationControlTab.tsx` | | | | | ✏️ 105 |
| `src/components/forms/ValveForm.tsx` | | | | ✏️ chkvlv | |
| `src/utils/fileGenerator.ts` | | ✏️ GT 생성 | ✏️ Kinetics 생성 | ✏️ chkvlv | ✏️ 001/104/105 |
| `src/pages/EditorPage.tsx` | ✏️ initialTab 참조 | | | | |

---

## 체크포인트 (Phase 간 빌드 검증)

| 체크포인트 | 시점 | 검증 항목 |
|-----------|------|----------|
| CP1 | Phase 1 완료 | `npm run build` + 기존 기능 회귀 테스트 |
| CP2 | Phase 2 완료 | CP1 + GT CRUD + GT 파일 생성 + SMART.i 비교 |
| CP3 | Phase 3 완료 | CP2 + Kinetics 활성화/비활성화 + 파일 생성 + SMART.i 비교 |
| CP4 | Phase 4 완료 | chkvlv 선택 + 파일 생성 |
| CP5 | Phase 5 완료 | 전체 빌드 + SMART.i 전체 카드 비교 검증 |

---

## 미결 사항 (구현 전 확인 필요)

| # | 항목 | 확인 방법 | 영향 Phase |
|---|------|----------|-----------|
| 1 | chkvlv 카드 형식 상세 | MARS 매뉴얼 Section 8.15.6 (PDF p.167+18=185) | Phase 4 |
| 2 | Card 001 유효 값 목록 | MARS 매뉴얼 Section 2.1 (PDF p.7+18=25) | Phase 5 |
| 3 | GT `power` 타입 상세 형식 | MARS 매뉴얼 Chapter 12 (PDF p.247+18=265) | Phase 2 |
| 4 | Kinetics 지연중성자 개별 그룹 카드 | MARS 매뉴얼 Chapter 16.2-16.3 (PDF p.268+18=286) | Phase 3 |
| 5 | `initialTab`을 `7`(Thermal)로 여는 코드 존재 여부 | 프로젝트 전체 검색 | Phase 1 |
