---
title: "PRD: 프로젝트 로드 시 시뮬레이션/분석 상태 초기화"
status: done
phase: 4
branch: main
related_prs: [#76]
last_updated: 2026-04-03
---

# PRD: 프로젝트 로드 시 시뮬레이션/분석 상태 초기화

**Status**: Draft
**Created**: 2026-03-27
**Priority**: High

---

## 1. 문제 정의

### 현상
사용자가 A 프로젝트에서 시뮬레이션을 수행한 후, 대시보드로 이동 → 프로젝트 로드 → 시뮬레이션 탭으로 복귀하면 **이전 프로젝트의 차트/로그/작업 목록이 그대로 남아 있음**.

### 원인
`useStore.loadProject()`는 에디터 상태(nodes, edges, metadata)만 초기화하며, `simulationStore`와 `analysisStore`는 건드리지 않음.

| 상태 | 저장소 | 초기화 여부 |
|------|--------|------------|
| nodes, edges, metadata | useStore | ✅ 초기화됨 |
| plotData, screenLogs | simulationStore (메모리) | ❌ 잔존 |
| jobs, activeJobId | simulationStore (메모리) | ❌ 잔존 |
| chartLayouts, favorites, customTabs | simulationStore (localStorage) | ❌ 잔존 |
| chartYAxisModes, compareMode | simulationStore (메모리) | ❌ 잔존 |
| parsedFile, panels, comparedFiles | analysisStore (메모리) | ❌ 잔존 |

---

## 2. 요구사항

### FR-1: 전체 초기화 (Full Reset)

프로젝트 로드 시 시뮬레이션/분석 관련 **모든** 상태를 초기 값으로 리셋한다.

#### FR-1.1: simulationStore 초기화 대상

```
plotData        → []
screenLogs      → []
latestMinorEdit → null
runtimeMinorEdits → null
jobs            → []
activeJobId     → null
chartLayouts    → {}
favoriteChartIds → new Set()
customTabs      → []
activeTabId     → 'all'
chartCompareMode → false
compareChartIds → [null, null]
chartYAxisModes → {}
chartZoom       → 1
autoScroll      → true
```

#### FR-1.2: analysisStore 초기화 대상

```
parsedFile      → null
fileName        → null
panels          → []
activePanelId   → null
timeRange       → null
gridColumns     → 1
syncZoom        → true
zoomDomain      → null
comparedFiles   → []
```

#### FR-1.3: localStorage 정리

`simulation-layout-storage` 키를 삭제하여 persist된 레이아웃 데이터도 제거.

### FR-2: 트리거 시점

`loadProject()` 호출 시점에 동기적으로 실행. 현재 `loadProject()`가 호출되는 위치:

| 파일 | 라인 | 상황 |
|------|------|------|
| `SimulationPage.tsx` | ~262 | 시뮬레이션 페이지 진입 시 Supabase에서 로드 |
| `EditorPage.tsx` | ~172, ~215, ~394, ~413, ~451, ~490 | 에디터 페이지에서 프로젝트 로드/열기 |

### FR-3: 동일 프로젝트 재로드 시 확인 팝업

| 항목 | 내용 |
|------|------|
| **조건** | 현재 `simulationStore`에 데이터가 존재하고(`jobs.length > 0` 또는 `plotData.length > 0`), 같은 projectId를 로드하려는 경우 |
| **메시지** | "시뮬레이션 결과가 초기화됩니다. 계속하시겠습니까?" |
| **확인** | 초기화 후 프로젝트 로드 진행 |
| **취소** | 로드 중단 (현재 상태 유지) |
| **다른 프로젝트** | 팝업 없이 즉시 초기화 + 로드 |

---

## 3. 설계

### 3.1 새 액션 추가

#### simulationStore: `resetAll()`

기존 `clearAllData()`는 plotData/screenLogs/minorEdit만 초기화하므로, **모든 상태를 초기값으로 되돌리는** `resetAll()` 액션을 추가.

```typescript
// simulationStore.ts
resetAll: () => {
  // localStorage persist 데이터도 함께 초기화
  set({
    jobs: [],
    activeJobId: null,
    plotData: [],
    screenLogs: [],
    latestMinorEdit: null,
    runtimeMinorEdits: null,
    chartZoom: 1,
    autoScroll: true,
    showDevTools: false,
    chartYAxisModes: {},
    chartLayouts: {},
    favoriteChartIds: new Set<string>(),
    customTabs: [],
    activeTabId: 'all',
    chartCompareMode: false,
    compareChartIds: [null, null],
  }, false, 'resetAll');
},
```

#### analysisStore: `resetAll()`

기존 `clearFile()`은 comparedFiles를 초기화하지 않으므로, 전체 리셋 액션 추가.

```typescript
// analysisStore.ts
resetAll: () =>
  set({
    parsedFile: null,
    fileName: null,
    panels: [],
    activePanelId: null,
    timeRange: null,
    gridColumns: 1,
    syncZoom: true,
    zoomDomain: null,
    comparedFiles: [],
  }, false, 'resetAll'),
```

### 3.2 `loadProject()` 수정

`useStore.ts`의 `loadProject()` 내부에서 두 스토어의 `resetAll()`을 호출.

```typescript
// useStore.ts → loadProject()
loadProject: (project) => {
  // ★ 시뮬레이션/분석 상태 초기화
  useSimulationStore.getState().resetAll();
  useAnalysisStore.getState().resetAll();

  // 기존 로직 (migration, edge restore, etc.)
  const migration = migrateProjectNodeIds(...);
  // ...
},
```

> **참고**: `useSimulationStore.getState()`는 React 컴포넌트 외부에서도 호출 가능한 Zustand 패턴.

### 3.3 확인 팝업 (동일 프로젝트 재로드)

SimulationPage.tsx에 확인 다이얼로그를 추가. 이미 MUI `Dialog`를 import하고 있으므로 기존 패턴을 따름.

```
[프로젝트 로드 요청]
    │
    ├─ 다른 프로젝트 → 즉시 loadProject() (resetAll 포함)
    │
    └─ 같은 프로젝트
         │
         ├─ 시뮬레이션 데이터 없음 → 즉시 loadProject()
         │
         └─ 시뮬레이션 데이터 있음 → 확인 팝업
              │
              ├─ 확인 → loadProject()
              └─ 취소 → 중단
```

**팝업 위치**: SimulationPage는 URL의 `projectId`로 자동 로드하므로, 확인 팝업은 `useEffect` 내에서 `projectId` 변경 감지 시 트리거.

**구현 방식**: `loadProject()`에 넣지 않고 SimulationPage의 `loadProjectFromSupabase` useEffect에서 처리. 이유: EditorPage에서의 loadProject 호출은 시뮬레이션 데이터와 무관하게 항상 초기화해야 하므로.

```
SimulationPage useEffect:
  if (같은 projectId && hasSimulationData)
    → 팝업 열기 → 사용자 확인 후 loadProject()
  else
    → 바로 loadProject()

EditorPage:
  → loadProject() 호출 시 항상 resetAll() (팝업 없음)
```

### 3.4 `hasSimulationData` 헬퍼

```typescript
// simulationStore.ts
export const hasSimulationData = () => {
  const state = useSimulationStore.getState();
  return state.jobs.length > 0 || state.plotData.length > 0;
};
```

---

## 4. 영향 범위

| 파일 | 변경 내용 |
|------|-----------|
| `src/stores/simulationStore.ts` | `resetAll()` 액션 추가, `hasSimulationData` export |
| `src/stores/analysisStore.ts` | `resetAll()` 액션 추가 |
| `src/stores/useStore.ts` | `loadProject()` 내에서 두 스토어 resetAll() 호출 |
| `src/pages/SimulationPage.tsx` | 동일 프로젝트 재로드 확인 팝업 추가 |

### 영향 없음 (변경 불필요)

| 파일 | 이유 |
|------|------|
| `useStartSimulation.ts` | 기존 `clearAllData()` 유지 (새 시뮬레이션 시작 시 데이터만 초기화) |
| `useQuickRun.ts` | 동일 - 기존 로직 유지 |
| `useDemoMode.ts` | 동일 - 기존 로직 유지 |
| `ChartToolbar.tsx` | `resetLayouts()` 버튼은 사용자 수동 액션이므로 유지 |

---

## 5. 수용 기준 (Acceptance Criteria)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| AC-1 | A 프로젝트 해석 수행 → 대시보드 → B 프로젝트 로드 → 시뮬레이션 탭 | 차트/로그/작업 목록 비어있음 |
| AC-2 | A 프로젝트 해석 수행 → 대시보드 → A 프로젝트 재로드 | 확인 팝업 → 확인 시 초기화 |
| AC-3 | A 프로젝트 해석 수행 → 대시보드 → A 프로젝트 재로드 → 취소 | 이전 데이터 유지, 페이지 전환 없음 |
| AC-4 | A 프로젝트에서 분석 결과 로드 → B 프로젝트 로드 | analysisStore 초기화됨 (parsedFile=null) |
| AC-5 | 새 시뮬레이션 시작 | 기존 `clearAllData()` 동작 그대로 유지 |
| AC-6 | localStorage의 `simulation-layout-storage` | 프로젝트 로드 후 클리어됨 |
| AC-7 | EditorPage에서 다른 프로젝트 열기 | 팝업 없이 시뮬레이션/분석 상태 초기화 |
