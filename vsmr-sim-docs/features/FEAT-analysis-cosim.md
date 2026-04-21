---
title: "FEAT: 분석 페이지 Co-Sim 통합 트리 대응"
status: in-progress
phase: 4
branch: feat/cosim
last_updated: 2026-04-17
---

# FEAT: 분석 페이지 Co-Sim 통합 트리 대응

> **브랜치**: `feat/cosim`
> **상태**: ⏳ 구현 중
> **관련 화면**: Simulation Analysis 탭 + 독립 AnalysisPage
> **전제**: 현재 Co-Sim 인터페이스(`simulationStore.coSimSession`, `analysisStore.modelResults`) 기준

---

## Summary

Co-Sim(모델 2개 이상) 시 분석 페이지에서 **두 모델의 변수를 하나의 트리에 통합**하여 나열하고, 사용자가 변수 선택만으로 자연스럽게 두 모델의 시계열을 같은 차트에 겹쳐 볼 수 있도록 한다.

기존 구현은 `activeAnalysisModelId` + `ModelTabBar`를 통한 **탭 전환 방식**이었으나, 전환 시 차트 구성이 리셋되고 두 모델 비교가 불가능한 한계가 있었다. 이를 **통합 트리 방식**으로 대체한다.

---

## Goals

- Co-Sim 세션에서 `VariableExplorer` 트리가 모델별 루트 노드로 그룹화되어 두 모델의 변수를 모두 노출.
- 차트 패널에 모델이 다른 변수를 동시에 선택하여 겹쳐 볼 수 있음 (색상/라벨로 모델 구분).
- 단일 모델 시 기존 UX는 시각적으로 변화 없음 (루트 노드 없이 플랫 트리).
- `activeAnalysisModelId` 글로벌 상태 제거로 의도치 않은 패널 리셋 부작용 차단.

## Non-goals

- 알람/이벤트 패널의 Co-Sim 대응은 본 작업에서 제외 (별도 FEAT로 분리).
- 3+ 모델 확장은 데이터 구조상 이미 지원되지만, 색상 팔레트/라벨 UX는 2 모델 기준으로 최적화.
- 독립 `AnalysisPage`의 멀티 파일 업로드 UI는 본 작업에서 제외 (현재 단일 파일 업로드 흐름 유지; `modelResults` 경로는 시뮬레이션 결과 자동 로드에서만 채움).

---

## Current State

### 데이터 구조 (이미 구축됨)

```ts
// analysisStore
modelResults: Record<modelId, { label: string; parsed: ParsedPlotFile }> | null
activeAnalysisModelId: string | null    // ← 제거 대상
parsedFile: ParsedPlotFile | null        // ← 단일 모델/로컬 파일용, 유지
```

### 기존 탭 전환 흐름 (제거 대상)

1. `loadModelResults(results)` — `modelResults` 저장 + 첫 모델을 `parsedFile`에 복사 + `activeAnalysisModelId` 세팅.
2. 사용자가 `ModelTabBar`에서 탭 변경 → `setActiveAnalysisModel(modelId)` → `parsedFile` 교체 + **패널 초기화**(`analysisStore.ts:207`).
3. 하위 훅 (`useFilteredData`, `VariableExplorer`, `TimeSeriesChart`, `PowerSummaryCard`)은 **단일 `parsedFile`만 참조**.

### 문제점

- 탭 전환마다 차트가 리셋되어 비교 불가.
- 같은 화면에서 두 모델 변수 선택 불가.
- `activeAnalysisModelId`가 글로벌에 노출되어 향후 기능 확장 시 부작용 소지.

---

## Design Decisions

### D1. 통합 트리 + 모델 프리픽스 dataKey

`VariableExplorer`는 `modelResults`가 존재하면 모델별 루트 노드 아래에 기존 컴포넌트 트리를 중첩 렌더. 단일 모델이면 기존 플랫 트리 유지.

변수 선택 시 `SelectedVariable.dataKey`에 모델 프리픽스를 부착하여 충돌 방지:

```
단일 모델:       dataKey = "p_280070000"
Co-Sim(통합):    dataKey = "<modelId>::p_280070000"
```

`PlotVariable` 자체는 수정하지 않는다 (파서 출력과 저장 포맷 분리). 트리 렌더 시점에 모델 컨텍스트를 가지고 `toggleVariable`에 `modelId`를 넘겨 `SelectedVariable` 단계에서 프리픽스화한다.

### D2. 차트 데이터 병합 — `useFilteredData`에서 처리

`useFilteredData`는 `modelResults`가 있으면 **모든 모델의 `parsed.data`를 시간축(time) 기준 outer join**으로 병합하고, 각 변수의 값을 프리픽스된 키로 재배치한 통합 배열을 반환:

```ts
// 병합 후 한 행의 형태
{
  time: 12.3,
  "modelA::p_280070000": 1.5e5,
  "modelA::tempf_191020000": 523.1,
  "modelB::p_280070000": 1.48e5,
  ...
}
```

`TimeSeriesChart`는 `SelectedVariable.dataKey`로 바로 조회하므로 렌더 로직 변경 없음.

**시간축 정합성**: 두 모델의 time 샘플이 다를 경우, outer join으로 빈 값은 `undefined`로 두고 Recharts의 `connectNulls`(기존 비교 오버레이와 동일 전략)로 처리 가능하지만, Co-Sim은 동일 timestep으로 진행되므로 대부분 정합. 병합 비용은 각 모델 size 합 비례 — 선형, 초기 1회만 수행 후 useMemo로 캐시.

### D3. `activeAnalysisModelId` 제거

- 필드, 액션(`setActiveAnalysisModel`), `SimulationPage`의 소비부(`line 1766, 1767, 2132, 2133`), `ModelTabBar` 렌더링(`line 2125~2135`) 모두 제거.
- `loadModelResults`의 `parsedFile` 세팅 로직도 제거 (`parsedFile`은 단일 모델/로컬 파일 전용으로 역할 축소).
- `setActiveAnalysisModel`의 **패널 초기화 부작용**(`line 207`)도 함께 소멸.

### D4. 단일 데이터 접근 훅 `useFilteredData` 유지

하위 뷰는 `parsedFile` 또는 `modelResults` 중 어느 것이 채워졌는지 의식하지 않는다. `useFilteredData()`가 통합 인터페이스를 제공:

- `modelResults` 존재 시 → 병합 배열 반환
- `parsedFile` 존재 시 → 기존 필터 배열 반환
- 둘 다 없으면 `[]`

### D5. 초기 화면 판단

`AnalysisView`의 `!parsedFile` 가드는 `!parsedFile && !modelResults`로 확장 — Co-Sim 자동 로드가 `modelResults`만 세팅해도 차트 화면으로 진입.

### D6. 변수 라벨/색상

- `SelectedVariable.label`에 모델명 suffix 포함: `"압력 (280) · Model-A"`.
- 색상 팔레트: 단일 트리 내 전역 순차 배정 (기존 로직 유지) — 동일 모델 변수끼리 색상이 밀집되지 않도록 `getNextColor`에 모델 인덱스 오프셋을 가미하는 것도 선택 가능하나, 이번 작업에서는 단순 순차로 출발 후 실사용 피드백 따라 조정.

---

## Implementation Plan

### Phase 1 — 타입 & 스토어 리팩토링

1. `src/types/analysis.ts`
   - `SelectedVariable`에 `modelId?: string` 추가 (옵셔널 — 단일 모델 시 생략).

2. `src/stores/analysisStore.ts`
   - `activeAnalysisModelId` 필드 + `setActiveAnalysisModel` 액션 제거.
   - `loadModelResults(results)` 재정의:
     - `modelResults` 저장, `parsedFile`은 `null`로 설정, `fileName`은 요약 라벨(`"Co-Sim: <N> models"`), `timeRange`는 모든 모델 union.
     - 패널은 빈 상태로 초기화(`createPanel('Chart 1')`).
   - `clearModelResults`, `resetAll`, `loadFile`, `clearFile` — `activeAnalysisModelId` 참조 제거.
   - `toggleVariable(variable, panelId?, modelId?)` 시그니처 확장:
     - `modelId` 있으면 `SelectedVariable.dataKey = "${modelId}::${variable.dataKey}"`, `label`에 모델명 suffix.
   - `useFilteredData()` 재작성: `modelResults` 우선 → 시간축 병합 + 프리픽스 키 배치. 없으면 기존 경로.
   - `resetTimeRange` — `modelResults` 존재 시 union 범위로 복원.

### Phase 2 — VariableExplorer 트리 통합

1. `modelResults`가 있을 때 상위 루트 노드(모델별) 추가.
2. 각 루트 아래에 기존 `groupVariablesByComponent` 결과 렌더.
3. `toggleVariable` 호출 시 해당 모델의 `modelId`를 함께 전달.
4. `selectedKeys` 비교는 프리픽스된 전체 `dataKey` 기준.
5. 단일 모델 시(기존 `parsedFile`만 있는 경우) 루트 노드 없이 기존 렌더 그대로.

### Phase 3 — SimulationPage & 차트 구성

1. `SimulationPage.tsx:1766~1767` — `activeAnalysisModelId`, `setActiveAnalysisModel` import 제거.
2. `SimulationPage.tsx:2101~2135` — `ModelTabBar` 블록 제거, 상단 헤더의 `borderBottom` 조건부 로직 정리.
3. `AnalysisView`의 `!parsedFile` 가드를 `!parsedFile && !modelResults`로 확장.
4. `fileName` 표시부: `modelResults` 시 모델 라벨 나열("Co-Sim: Model-A + Model-B").

### Phase 4 — PowerSummaryCard 호환성

1. `modelResults` 존재 시 각 모델별 `rktpow`를 찾아 각각의 카드를 가로로 나열 (단순 확장). 또는 최소한 첫 모델 기준 단일 카드 유지 + 모델 라벨 표기.
2. 본 작업에서는 **첫 모델 기준 카드 유지**로 단순화, 개선은 후속 FEAT로 위임.

### Phase 5 — 검증

- `npm run lint`, `npm run build`로 타입 오류 확인.
- 단일 모델 경로(로컬 업로드, 단일 모델 프로젝트)가 회귀 없이 동작하는지 수동 확인.
- Co-Sim 프로젝트에서 두 모델 결과가 자동 로드 + 트리에 노출되는지 확인.

---

## File Impact

| 파일 | Phase | 변경 |
|------|-------|------|
| `src/types/analysis.ts` | 1 | `SelectedVariable.modelId?` 추가 |
| `src/stores/analysisStore.ts` | 1 | `activeAnalysisModelId`/`setActiveAnalysisModel` 제거, `loadModelResults` 재정의, `toggleVariable`에 modelId 지원, `useFilteredData` 병합 구현 |
| `src/components/analysis/VariableExplorer.tsx` | 2 | 모델별 루트 노드, `toggleVariable(variable, undefined, modelId)` 호출 |
| `src/pages/SimulationPage.tsx` | 3 | `ModelTabBar` 블록 제거, `activeAnalysisModelId` 참조 제거, 초기 가드 확장 |
| `src/components/analysis/PowerSummaryCard.tsx` | 4 | 최소 변경 — `parsedFile` 없고 `modelResults`만 있으면 첫 모델 기준 동작 |

---

## Open Questions (후속 작업 후보)

- 모델별 색상 팔레트 분리(한색계/난색계) — UX 피드백 후 결정.
- 알람 패널의 Co-Sim 대응.
- 독립 `AnalysisPage`의 멀티 파일 업로드 UI.
- 3+ 모델 시 트리 검색/필터링 최적화.
