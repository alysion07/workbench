---
title: "FEAT: Simulation Analysis 탭 개선"
status: in-progress
phase: 4
branch: alysion/feat_textcoode_viewer
last_updated: 2026-04-03
---

# FEAT: Simulation Analysis 탭 개선

> **브랜치**: `alysion/feat_textcoode_viewer`
> **상태**: ⏳ 계획 수립 완료
> **관련 화면**: ANA-001
> **최종 수정**: 2026-03-24

---

## Summary

기존 "Simulation History" 탭을 "Simulation Analysis"로 리브랜딩하고 핵심 개선을 수행한다:
1. 체크박스 동작 버그 수정 (VariableExplorer)
2. 탭 이름 변경 + Monitoring → Analysis 전환 흐름
3. 우측 접이식 Task List 패널 추가 (과거 해석 목록)
4. 기능 추가: CSV 내보내기, 차트 X축 동기화, 다중 결과 오버레이 비교, 시간축 재생 애니메이션

---

## Current State

### 현재 구조
```
AnalysisView (SimulationPage.tsx:1280)
├─ selectorDialog (결과 선택 다이얼로그)
│  ├─ Tab 0: PlotFileDropZone (로컬 파일 업로드)
│  └─ Tab 1: 시뮬레이션 결과 테이블 (listSimulationHistoriesByProject)
├─ 좌측 (280px): VariableExplorer
│  ├─ 활성 패널 칩 + 검색
│  ├─ 컴포넌트별 트리 (groupVariablesByComponent)
│  └─ 하단 요약 (선택 변수 수)
└─ 우측 (flex: 1)
   ├─ PowerSummaryCard (원자로 출력 요약)
   ├─ ChartPanelGrid (1/2/3열 그리드)
   │  └─ TimeSeriesChart × N (Recharts LineChart + ReferenceLine 커서)
   └─ TimeRangeSlider (시간 범위 + 재생 컨트롤)
```

### 기존 컴포넌트 상태

| 컴포넌트 | 파일 | 상태 | 비고 |
|----------|------|------|------|
| VariableExplorer | `src/components/analysis/VariableExplorer.tsx` | 🔴 버그 | 체크박스 연쇄 체크 |
| ChartPanelGrid | `src/components/analysis/ChartPanelGrid.tsx` | ✅ | 1/2/3열 그리드 |
| TimeSeriesChart | `src/components/analysis/TimeSeriesChart.tsx` | ✅ | ReferenceLine 커서 포함 |
| TimeRangeSlider | `src/components/analysis/TimeRangeSlider.tsx` | ✅ | 재생 컨트롤 UI 구현됨 (Play/Pause/Stop, 속도, rAF 루프) |
| PowerSummaryCard | `src/components/analysis/PowerSummaryCard.tsx` | ✅ | 재생 시점 연동 미구현 |
| PlotFileDropZone | `src/components/analysis/PlotFileDropZone.tsx` | ✅ | |
| JobListSidebar | `src/components/simulation/JobListSidebar.tsx` | ⏸️ 미사용 | 주석 처리, 재활용 가능 |
| analysisStore | `src/stores/analysisStore.ts` | ✅ | playback 상태 포함 |

### 알려진 버그
- **체크박스 연쇄 체크**: 하나의 변수 체크 시 다른 변수도 함께 체크됨
  - 원인 추정: `plotflParser.ts:41`에서 `dataKey = ${type}_${componentId}` → 동일 타입·동일 componentId 변수가 여러 컬럼에 존재하면 dataKey 충돌
  - 위치: `VariableExplorer.tsx`, `analysisStore.ts:toggleVariable`

### 데이터 흐름 (현재)

**해석 목록 조회**:
```
listSimulationHistoriesByProject(projectId)     ← BFF Connect-RPC
  → SimulationEntry[] { id, name, status, duration, timestamp, modelId }
```

**결과 파일 다운로드**:
```
storageService.downloadTaskResultFile(projectId, taskId, 'plotfl')  ← BFF Connect-RPC 스트림
  → Uint8Array chunks → concatBytes → TextDecoder → string
  → parsePlotfl(text) → ParsedPlotFile { variables, data, timeRange }
  → analysisStore.loadFile(fileName, parsed)
```

### 탭 간 연결 부재
- Monitoring 탭: `simulationStore` (activeJob, jobs)
- Analysis 탭: `analysisStore` (parsedFile, panels)
- 두 스토어 간 연결 로직 없음 → 완료 후 수동으로 결과 선택 필요

---

## Implementation Plan

### Phase 1: 버그 수정 + 탭 이름 변경

#### 1-1. 체크박스 버그 수정

**조사 순서**:
1. plotfl 파일에서 실제 `dataKey` 중복 여부 확인
2. `toggleVariable` 로직의 비교 기준 검증
3. React 리렌더링 시 `selectedKeys` useMemo 의존성 확인

**수정 방향 (dataKey 중복이 원인인 경우)**:
```
Before: dataKey = `${type}_${componentId}`              // p_280070000
After:  dataKey = `${type}_${componentId}_${columnIndex}` // p_280070000_3
```

**파일**: `plotflParser.ts:41`, (필요 시) `analysisStore.ts`

#### 1-2. 탭 이름 변경

| 항목 | Before | After |
|------|--------|-------|
| 탭 라벨 (line 852) | `'Simulation History'` | `'Simulation Analysis'` |
| 탭 ID (line 851) | `'history'` | `'analysis'` |
| activeView 타입 | `'... \| 'history'` | `'... \| 'analysis'` |
| 모든 `=== 'history'` 참조 | history | analysis |

**파일**: `SimulationPage.tsx` 내부만 (외부 라우트 변경 없음)

### Phase 2: Task List 패널 + Monitoring→Analysis 전환

#### 2-1. 레이아웃 변경

**Before**:
```
┌──────────┬─────────────────────────────┐
│ 변수탐색기 │  차트 영역                    │
│ (280px)  │  (flex: 1)                  │
└──────────┴─────────────────────────────┘
```

**After**:
```
┌──────────┬──────────────────────┬──────────────┐
│ 변수탐색기 │  차트 영역             │ Task List   │
│ (280px)  │  (flex: 1)           │ (280px)     │
│          │                      │ collapsible │
│          │                      │ ◀ 접기 버튼  │
└──────────┴──────────────────────┴──────────────┘
```

**파일**: `SimulationPage.tsx` 내 `AnalysisView` 컴포넌트

#### 2-2. TaskListPanel 컴포넌트

**파일**: `src/components/analysis/TaskListPanel.tsx` (신규)

```typescript
interface TaskListPanelProps {
  projectId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLoadResult: (entry: SimulationEntry) => void;
  onOpenLocalFile: () => void;
  loadingId: string | null;
  activeResultId: string | null;
}
```

**UI 구조**:
```
┌─────────────────────┐
│ 📋 해석 목록   ◀ ↻  │  ← 헤더 (접기 + 새로고침)
├─────────────────────┤
│ 📁 로컬 파일 열기    │  ← PlotFileDropZone 다이얼로그 트리거
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ ✅ 해석 #1  ★   │ │  ← 현재 로드된 항목 하이라이트
│ │ 2026-03-24      │ │
│ │ 5m 32s          │ │
│ ├─────────────────┤ │
│ │ ❌ 해석 #2       │ │  ← Failed 항목은 비활성
│ │ 2026-03-23      │ │
│ └─────────────────┘ │
└─────────────────────┘
```

**접기 동작**:
- `collapsed=true`: 아이콘 버튼만 표시 (너비 ~48px)
- `collapsed=false`: 전체 패널 (너비 280px)
- `AnalysisView` 내 `useState<boolean>` 관리

**재활용**:
- `JobListSidebar.tsx`: `getStatusIcon`, `getStatusColor`, `formatDuration` 유틸리티
- `AnalysisView`의 `handleSelectHistoryResult`: plotfl 다운로드 → `loadFile()` 로직을 TaskListPanel로 이동

#### 2-3. 데이터 로딩 흐름

```
TaskListPanel
  │
  ├─ mount / 새로고침 버튼
  │   └→ listSimulationHistoriesByProject(projectId)    ← BFF
  │       → setHistories(SimulationEntry[])
  │
  ├─ 항목 클릭 (onLoadResult)
  │   └→ storageService.downloadTaskResultFile(
  │        projectId, entry.id, 'plotfl'                ← BFF 스트림
  │      )
  │      → Uint8Array → TextDecoder → string
  │      → parsePlotfl(text)
  │      → analysisStore.clearFile()
  │      → analysisStore.loadFile(fileName, parsed)
  │      → setActiveResultId(entry.id)  ← 하이라이트
  │
  └─ 로컬 파일 버튼
      └→ PlotFileDropZone 다이얼로그 열기
         → onLoaded() → setActiveResultId(null)
```

#### 2-4. 기존 다이얼로그 정리

- `selectorDialog` 내 "시뮬레이션 결과 파일" 탭(Tab 1) 제거 → Task List 패널로 대체
- 로컬 업로드(Tab 0)는 Task List 상단 버튼 클릭 시 `PlotFileDropZone` 다이얼로그로 유지
- `parsedFile`이 없는 초기 상태: 전체 화면 안내 메시지 + Task List 패널은 표시

#### 2-5. Monitoring → Analysis 전환 흐름

**시뮬레이션 완료 감지** (`SimulationPage.tsx`):
- 현재: `running → completed` 시 toast.success만 표시
- 개선: 상단 헤더에 **"Analysis에서 결과 보기" 버튼** 표시

**상단 헤더 변경** (`simulationHeader` 영역):
```
┌──────────────────────────────────────────────────────────┐
│ [시뮬레이션 제목]  상태: COMPLETED  소요시간: 5m 32s       │
│                              [📊 Analysis에서 결과 보기]  │
└──────────────────────────────────────────────────────────┘
```

- 버튼은 `activeJob.status === 'completed'` 일 때만 표시
- 클릭 시:
  1. `setActiveView('analysis')` → 탭 전환
  2. `activeJob.id`를 Analysis 탭으로 전달
  3. Analysis 탭이 자동으로 해당 Job의 plotfl 다운로드 + 로드

**데이터 전달 방식**:
```typescript
// SimulationPage 레벨 state
const [pendingAnalysisTaskId, setPendingAnalysisTaskId] = useState<string | null>(null);

// 헤더 버튼 클릭
const handleGoToAnalysis = () => {
  setPendingAnalysisTaskId(activeJob.id);
  setActiveView('analysis');
};

// AnalysisView에 전달
<AnalysisView
  projectId={projectId}
  pendingTaskId={pendingAnalysisTaskId}
  onTaskLoaded={() => setPendingAnalysisTaskId(null)}
/>
```

**AnalysisView 내 자동 로드**:
```typescript
useEffect(() => {
  if (!pendingTaskId || !projectId) return;
  // pendingTaskId로 plotfl 다운로드 → loadFile → onTaskLoaded()
}, [pendingTaskId, projectId]);
```

### Phase 3: 기능 추가

#### 3-1. CSV 내보내기

**위치**: `ChartPanelGrid` 상단 툴바에 "CSV 내보내기" 버튼

**동작**:
1. 현재 활성 패널의 선택된 변수 dataKey 목록 수집
2. `analysisStore.parsedFile.data`에서 `timeRange` 필터 적용
3. 헤더행: `time, label1(unit), label2(unit), ...`
4. 데이터행: 필터된 time + 선택 변수 값
5. `Blob` → `URL.createObjectURL` → `<a download>` 트리거

**파일**: `ChartPanelGrid.tsx`

#### 3-2. 차트 X축 동기화

**목적**: 여러 차트 패널의 X축 줌/팬을 연동

**analysisStore 추가 상태**:
```typescript
syncZoom: boolean;
zoomDomain: [number, number] | null;
setZoomDomain: (domain: [number, number] | null) => void;
toggleSyncZoom: () => void;
```

**동작**:
- `ChartPanelGrid` 툴바에 "X축 동기화" 토글
- `TimeSeriesChart`에서 `onMouseDown`/`onMouseUp` → `ReferenceArea` 브러시 줌
- 줌 변경 시 `setZoomDomain()` → 모든 차트에 동일 도메인 적용
- `XAxis domain`을 `zoomDomain ?? ['dataMin', 'dataMax']`로 설정
- 더블 클릭으로 줌 리셋

**파일**: `analysisStore.ts`, `ChartPanelGrid.tsx`, `TimeSeriesChart.tsx`

#### 3-3. 다중 결과 오버레이 비교

**목적**: 2~3개 해석 결과를 같은 차트에 겹쳐 표시

**analysisStore 추가 상태**:
```typescript
comparedFiles: Array<{
  id: string;
  label: string;
  parsed: ParsedPlotFile;
}>;
addComparedFile: (id: string, label: string, parsed: ParsedPlotFile) => void;
removeComparedFile: (id: string) => void;
clearComparedFiles: () => void;
```

**UI**:
- Task List에서 항목 우클릭 → "비교 추가" 또는 체크박스 다중 선택
- 비교 파일: Task List에서 뱃지 표시, 최대 3개 (기본 1 + 비교 2)

**차트 오버레이**:
- 동일 `dataKey` 변수를 점선(`strokeDasharray`)으로 표시
- 범례에 파일 라벨 포함: `"압력 (280) [해석 #2]"`
- 비교 파일 색상: 동일 색상의 밝은 변형 (opacity 0.6)

**파일**: `analysisStore.ts`, `TaskListPanel.tsx`, `TimeSeriesChart.tsx`

#### 3-4. 시간축 재생 애니메이션

**현황**: 재생 컨트롤 UI + rAF 루프 + ReferenceLine 커서 이미 구현됨

**개선 방향**: ReferenceLine만 이동하는 것이 아니라 **차트가 시간에 따라 점진적으로 그려지는 애니메이션**

**구현**:
- `TimeSeriesChart`에서 `playbackTime`까지의 데이터만 렌더링:
  ```typescript
  const animatedData = useMemo(() => {
    if (playbackTime === null) return chartData;
    return chartData.filter(row => row.time <= playbackTime);
  }, [chartData, playbackTime]);
  ```
- `LineChart data={animatedData}` → Play 시 데이터가 점진적으로 추가되는 효과
- `ReferenceLine`은 보조 역할로 유지 (현재 시점 표시)
- `XAxis domain`은 전체 `timeRange` 고정 → 축은 움직이지 않고 데이터만 채워짐

**PowerSummaryCard 연동**:
- `playbackTime` 시점의 데이터 값 표시 (재생 중일 때):
  ```typescript
  const currentVal = playbackTime !== null
    ? interpolateAtTime(data, rktpowKey, playbackTime)
    : data[data.length - 1][rktpowKey];
  ```

**파일**: `TimeSeriesChart.tsx`, `PowerSummaryCard.tsx`

---

## File Impact Summary

| 파일 | Phase | 변경 |
|------|-------|------|
| `plotflParser.ts` | 1-1 | dataKey 고유성 개선 |
| `VariableExplorer.tsx` | 1-1 | 체크박스 버그 수정 |
| `SimulationPage.tsx` | 1-2, 2 | 탭 이름/ID 변경, AnalysisView 레이아웃, 헤더 "결과 보기" 버튼, pendingTaskId 전달 |
| `TaskListPanel.tsx` | 2 | **신규** - 우측 접이식 해석 목록 패널 |
| `ChartPanelGrid.tsx` | 3-1, 3-2 | CSV 내보내기 버튼, X축 동기화 토글 |
| `TimeSeriesChart.tsx` | 3-2, 3-3, 3-4 | 브러시 줌, 오버레이 라인, playbackTime 기반 데이터 필터 |
| `PowerSummaryCard.tsx` | 3-4 | 재생 시점 값 연동 |
| `analysisStore.ts` | 3-2, 3-3 | syncZoom, zoomDomain, comparedFiles 상태 추가 |

---

## 우선순위

| # | Phase | 항목 | 중요도 | 난이도 |
|---|-------|------|--------|--------|
| 1 | 1-1 | 체크박스 버그 수정 | 🔴 | 하 |
| 2 | 1-2 | 탭 이름 변경 (Simulation Analysis) | 🔴 | 하 |
| 3 | 2 | Task List 패널 + 데이터 로딩 흐름 + Monitoring→Analysis 전환 | 🟡 | 중 |
| 4 | 3-1 | CSV 내보내기 | 🟢 | 하 |
| 5 | 3-2 | 차트 X축 동기화 | 🟢 | 중 |
| 6 | 3-3 | 다중 결과 오버레이 비교 | 🟢 | 상 |
| 7 | 3-4 | 시간축 재생 애니메이션 + 시점 값 연동 | 🟢 | 중 |
