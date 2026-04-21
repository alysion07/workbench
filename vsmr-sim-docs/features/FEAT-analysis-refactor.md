---
title: "FEAT: Analysis/Plotfl 파이프라인 리팩터링 (5-Phase 로드맵)"
status: in-progress
phase: 4
branch: alysion/phase1-parser-tests
related_prs: []
last_updated: 2026-04-20
---

# FEAT: Analysis/Plotfl 파이프라인 장기 리팩터링

> **상위 브랜치**: `alysion/wip` (로컬 전용, 리모트 없음)
> **현재 Phase**: 1 — Parser 안전망 (`alysion/phase1-parser-tests` 워크트리)
> **관련 파일**: `src/utils/plotflParser.ts`, `src/stores/analysisStore.ts`, `src/stores/simulationStore.ts`, `src/components/analysis/*`, `src/components/simulation/DynamicChartGrid.tsx`

---

## Summary

`plotflParser.ts` 는 Analysis 페이지의 중추이자 SimulationPage 7군데에서 재활용되는 핵심 유틸이지만, **테스트 0건 + 러너 미설치** 상태다. 그 위에 다음 4가지 구조적 문제가 쌓여 있다:

1. `VALID_TYPES` 화이트리스트가 새 변수(rktpow 서브타입, 일부 cntrlvar 등)를 **조용히 드롭**한다.
2. 파싱 결과가 `Record<dataKey, number>[]` row-oriented 라 수십만 행 × 수십 컬럼에서 **V8 object header 로 메모리 부풀고**, LOD 다운샘플링마다 재순회가 발생한다.
3. `ChartPanelGrid`(analysis, 135L) + `DynamicChartGrid`(simulation, 641L) + `TimeSeriesChart`(560L) + `ChartCard`(310L) ≈ **1.6 kLOC 가 거의 같은 일**을 서로 다른 store(analysisStore / simulationStore) 로 수행.
4. Co-Sim 2-모델 outer-join 은 SimulationPage 에서만 수동 처리되고 Analysis 페이지는 단일 모델 경로뿐.

한 번에 다 고치면 회귀 감지가 불가능하므로 **5-Phase 로드맵**으로 분리. 본 문서는 Phase 1 을 실행 가능한 수준까지 상세히, Phase 2–5 는 범위·의존성·완료 기준만 정의한다.

---

## Goals

- `plotflParser.ts` 회귀를 `pnpm test` 한 줄로 감지 가능한 안전망 구축 (Phase 1)
- 변수 메타 카탈로그로 단위·라벨·색상 일원화 (Phase 2)
- Column-oriented IR 로 메모리 50%+ 절감, LOD 성능 개선 (Phase 3)
- 실시간/사후 스트림을 단일 `ResultSource` 추상으로 수렴 (Phase 4)
- 차트 컴포넌트 4개 → 1개로 통합, LOC ~700 순감소 (Phase 5)

## Non-goals

- 차트 라이브러리 교체(recharts → uPlot). Phase 4 이후 성능 요구가 명확해지면 별도 FEAT.
- outdta / rstplt 파서 추가 (공간 분석). Phase 5 완료 후 별도 FEAT.
- 스파게티/민감도 분석 UI.

---

## Current State (2026-04-20)

### Git
- `alysion/wip` 단독, **리모트 없음** → PR 생성 불가, 로컬 커밋·머지로만 관리
- 최근 heavy 변경: Co-Sim 통합(PR #87 Job[] 제거, #88 차트 통합, #93 Co-Sim import)
- `plotflParser.ts` 는 #56 이후 1개월 이상 미변경 → 핫스팟 아님, **안전망 설치 적기**
- 기존 관례: 다단계 리팩터링마다 `claudedocs/workflow_*.md` 작성

### 데이터 흐름
```
plotfl (ASCII)
  → parsePlotfl()                          [src/utils/plotflParser.ts]
  → ParsedPlotFile { variables[], data: Record<string,number>[] }
      ├─ analysisStore.loadFile() / loadModelResults()
      │   → VariableExplorer / ChartPanelGrid / TimeSeriesChart  (사후)
      └─ simulationStore.appendModelPlotData() (스트리밍 minor-edit)
          → DynamicChartGrid / ChartCard  (실시간)
```

---

## Phase 1 — Parser 안전망 (현재 작업)

**목표**: 기능 변경 0, 순수 투자. `pnpm test` 한 줄로 파서 회귀를 잡을 수 있게.

### 완료 기준
- `pnpm test` → 전 케이스 통과, 골든 스냅샷 생성
- `parsePlotfl` / `parseComponentId` / `groupVariablesByComponent` 현재 동작이 실·합성 픽스처로 잠김
- `plotflParser.ts` 는 한 글자도 수정하지 않음

### 최종 구조
```
repo/
├─ vitest.config.ts                    (신규)
├─ package.json                        (test 스크립트 + vitest devDep)
└─ tests/
   ├─ fixtures/cosim-sample/
   │  ├─ mars1.plotfl                  (로컬 복사)
   │  ├─ mars2.plotfl                  (로컬 복사)
   │  ├─ README.md                     (출처 메모)
   │  └─ synthetic/
   │     ├─ minimal.plotfl
   │     ├─ duplicate-keys.plotfl
   │     └─ sparse-time.plotfl
   └─ utils/
      ├─ plotflParser.test.ts
      └─ __snapshots__/plotflParser.test.ts.snap
```

### 의존성·설정
- `devDependencies`: `vitest@^1.6`, `@vitest/ui@^1.6`(선택)
- `scripts`: `test`, `test:watch`, `test:ui`
- `vitest.config.ts` 신규 (vite.config 재사용하지 않음 — env 검증·node-polyfills 가 테스트용으로는 과함)

### 테스트 매트릭스
```
parsePlotfl
├─ real: mars1.plotfl     → shape 스냅샷 + spot checks
├─ real: mars2.plotfl     → shape 스냅샷 + spot checks
├─ synth: minimal         → variables/data 정확 값
├─ synth: duplicate-keys  → dataKey _${columnIndex} suffix 검증
├─ synth: sparse-time     → 빈 줄·NaN 방어
└─ err: 3행 미만·time 누락 → throws

parseComponentId
├─ 9자리 → { componentNumber, volumeFace }
├─ 3자리(324) → null
└─ 비숫자(abc123456) → null

groupVariablesByComponent
├─ 9자리 ID → 3자리 prefix 로 그룹
└─ cntrlvar 는 원본 ID 그대로 그룹 키
```

### 검증
1. `pnpm test` → 전 통과, 스냅샷 생성
2. `pnpm test` 재실행 → diff 0
3. **회귀 시뮬레이션**: `plotflParser.ts:41` 의 `if (!VALID_TYPES.has(type)) continue;` 임시 삭제 → 스냅샷 mismatch 로 실패 확인 → 원상복구 (커밋 X)
4. `pnpm lint`, `pnpm build` 통과

### 커밋
단일 커밋: `test(parser): add golden tests and fixtures for plotflParser`

---

## Phase 2 — 변수 메타 카탈로그

**문제**: `plotflParser.ts:7-10` 의 `VALID_TYPES` 화이트리스트가 새 변수를 조용히 드롭. y축 단위·라벨·색 계열은 차트 컴포넌트들에 하드코딩 산재.

**범위**
- `src/types/mars-variables.ts` 신규 — `VARIABLE_TYPE_META: Record<type, { label, unit, siUnit, factor, colorFamily, group, logScale? }>`
- `plotflParser.ts` 의 `VALID_TYPES` 를 카탈로그 lookup 으로 교체. 미등록 타입은 drop 대신 `meta: undefined` 로 통과 + 1회 경고.
- `VariableExplorer`, `TimeSeriesChart` y-axis 라벨, `chartConfigBuilder` 색상 할당을 카탈로그 기반으로 일원화
- Phase 1 스냅샷에 meta 필드가 붙으면 `pnpm test -- -u` 로 1회 갱신 (diff 리뷰 필수)

**완료 기준**: rktpow, cntrlvar 서브타입이 차트에 단위·색으로 자동 표현. 새 변수 추가가 카탈로그 1줄 수정으로 끝남.

**의존**: Phase 1
**브랜치**: `alysion/phase2-var-catalog`

---

## Phase 3 — Column-oriented IR

**문제**: `ParsedPlotFile.data: Record<string, number>[]` 는 행마다 key 문자열 해시 중복 저장. 수십만 행 × 수십 컬럼에서 메모리·GC 부담, LOD 다운샘플링마다 전체 순회.

**범위**
- `ParsedPlotFile` 을 `{ time: Float64Array; columns: Record<dataKey, Float64Array>; variables; timeRange }` 로 교체
- 기존 row-view 소비자용 `asRowView(parsed): Iterable<Record>` 얇은 어댑터 제공. 신규 차트 코드는 column 직접 사용.
- LOD 다운샘플링 유틸을 column slice 기반으로 재작성
- Phase 1 스냅샷을 새 shape 에 맞춰 1회 업데이트

**완료 기준**: mars1.plotfl 로드 시 **메모리 50%+ 감소**, 차트 zoom 재계산이 row iteration 없이 column slice 로 동작.

**의존**: Phase 1 (안전망), Phase 2 (카탈로그 타입 결정에 참고 가능)
**브랜치**: `alysion/phase3-column-ir`

---

## Phase 4 — ResultSource 추상화

**문제**: `analysisStore`(업로드 + 완료 런 다운로드) 와 `simulationStore`(스트리밍) 가 각자 별도 state 로 차트를 먹인다. Co-Sim outer-join 은 SimulationPage 에서만 수동.

**범위**
- 인터페이스: `ResultSource { id, label, variables, timeRange, getColumn(dataKey) → Float64Array, subscribe?(cb) }`
- 구현: `PlotflResultSource`(Phase 3 IR), `StreamingResultSource`(simulationStore live), `CompositeResultSource`(Co-Sim N-모델 outer-join 시간축)
- `useResultSource(id)` 훅 하나로 analysis·simulation 양쪽 수렴
- SimulationPage 의 6개 `parsePlotfl` 호출을 `PlotflResultSource.fromText(text, label)` 로 교체

**완료 기준**: Analysis 페이지가 Co-Sim 2-모델 동시 업로드·outer-join 차트 표시. SimulationPage 가 running/completed 양쪽에서 같은 인터페이스.

**의존**: Phase 3
**브랜치**: `alysion/phase4-result-source`

---

## Phase 5 — Chart 컴포넌트 통합

**범위**
- `ResultSource` 1개 + `chartConfig` 1개 → 단일 `<ChartPanel source={…} config={…} />` (+ grid 래퍼)
- 분석/시뮬레이션 페이지가 같은 컴포넌트 소비
- `ChartCustomLegend`, `buildChartColorMap` 은 그대로 공유
- 구 컴포넌트 4개 삭제: `ChartPanelGrid`(analysis), `DynamicChartGrid`, `TimeSeriesChart`(기존), `ChartCard`

**완료 기준**: `src/components/charts/ChartPanel.tsx` + `ChartPanelGrid.tsx` 단일본. **LOC 순감소 ≈ 700**. UX 동일.

**의존**: Phase 4
**브랜치**: `alysion/phase5-chart-unify`

---

## 전체 로드맵 요약

| Phase | 브랜치 | 기능 변경 | 의존 |
|---|---|:---:|---|
| 1. Parser 안전망 | `alysion/phase1-parser-tests` | 없음 | — |
| 2. 변수 카탈로그 | `alysion/phase2-var-catalog` | 드롭되던 변수 표시 | 1 |
| 3. Column IR | `alysion/phase3-column-ir` | 메모리·성능 | 1(+2) |
| 4. ResultSource | `alysion/phase4-result-source` | Co-Sim 분석 활성 | 3 |
| 5. Chart 통합 | `alysion/phase5-chart-unify` | 유지보수성 (UX 동일) | 4 |

각 Phase 는 완료 시 `claudedocs/workflow_<phase-name>.md` 를 기존 포맷대로 추가한다.

---

## Progress Log

- **2026-04-20**: 플랜 확정. Phase 1 착수 (`alysion/phase1-parser-tests` 워크트리 생성).
- **2026-04-20**: ✅ **Phase 1 완료**. 17/17 테스트 통과, 스냅샷 2개, 회귀 시뮬 검증. 커밋 `5ca8cbd`(.gitignore), `d6b2007`(tests+fixtures), `13b5433`(@vitest/ui). `claudedocs/workflow_phase1-parser-tests.md` 추가. `alysion/wip` 머지 대기.
