---
title: "FEAT: 단일 해석 관리 + 이탈 방지"
status: done
phase: 4
branch: main
last_updated: 2026-04-03
---

# FEAT: 단일 해석 관리 + 이탈 방지

> **Parent**: [PHASE-04-simulation](../phases/PHASE-04-simulation.md)
> **Branch**: `alysion/feat_shaft`
> **Status**: ✅ 완료

---

## 목표

시뮬레이션 페이지에서 **현재 실행 중인 단일 해석만 관리**하고, 해석 실행 중 사용자가 페이지를 벗어나는 경우 **경고를 표시**하여 의도치 않은 스트림 연결 끊김을 방지한다.

### 배경

- Backend 서버와의 스트림 연결 유효성을 보장할 수 없음
- 브라우저를 닫거나 페이지를 이동하면 스트림이 끊기고, 복원 방법이 없음 (복원 기능은 별도 작업)
- 현재 다중 Job 리스트(JobListSidebar)는 실사용 시나리오에서 불필요

---

## 요구사항

### R1. JobListSidebar 숨김

- `JobListSidebar` 컴포넌트 렌더링을 제거 (코드 삭제 X, import 유지)
- simulation 뷰의 메인 영역이 전체 폭을 차지하도록 변경
- `jobs[]` 배열, `addJob`, `removeJob` 등 기존 store 로직에는 영향 없음
- 빈 상태 안내 텍스트에서 "좌측 목록에서 이전 작업을 선택하세요" 문구 제거

### R2. beforeunload 경고 (브라우저 이탈 방지)

- **조건**: `activeJob.status`가 `running` | `paused` | `resumed` 일 때
- **대상**: 브라우저 탭 닫기, 새로고침, URL 직접 입력으로 이동
- **방식**: `window.addEventListener('beforeunload', handler)`
- **해제**: status가 `completed` | `stopped` | `failed`로 전환되면 리스너 제거
- 최신 브라우저는 커스텀 메시지를 무시하지만, `e.preventDefault()` + `e.returnValue` 설정은 필수

### R3. 내부 네비게이션 가드 (SPA 이탈 방지)

- **조건**: R2와 동일 (`isSimulationActive`)
- **대상 핸들러**:
  - `handleBackToEditor()` — 에디터로 이동
  - `handleBackToDashboard()` — 대시보드로 이동
  - `handleLogout()` — 로그아웃
  - 사이드바 `Editor` / `Dashboard` 버튼 (위 핸들러와 동일)
- **방식**: `window.confirm()` 다이얼로그
  - 메시지: `"시뮬레이션이 실행 중입니다. 페이지를 떠나면 진행 상황을 복원할 수 없습니다. 계속하시겠습니까?"`
  - 확인 → 네비게이션 진행
  - 취소 → 네비게이션 중단
- **사이드바 탭 전환** (`simulation` / `interactive` / `history`): React state 변경만이므로 **경고 불필요** (스트림 끊기지 않음)

### R4. 완료/중지/실패 후 동작

- `activeJob.status`가 `completed` | `stopped` | `failed` → 이탈 경고 해제
- 자유롭게 페이지 이동 가능

---

## 설계

### 활성 상태 판단

```typescript
// 스트림 연결 상태를 간접 판단 (Job status ≈ Stream lifecycle)
const isSimulationActive =
  activeJob?.status === 'running' ||
  activeJob?.status === 'paused' ||
  activeJob?.status === 'resumed';
```

**근거**: 스트림은 Server Stream(단방향)이며 `SimState` push로 상태가 동기화됨. 클라이언트에서 스트림 연결 여부를 직접 노출하지 않으므로, Job status로 간접 판단하는 것이 현실적.

### 변경 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/pages/SimulationPage.tsx` | beforeunload 훅, 네비게이션 가드, JobListSidebar 숨김 |

### 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `src/stores/simulationStore.ts` | jobs[], activeJobId 등 기존 로직 유지 |
| `src/components/simulation/JobListSidebar.tsx` | 코드 삭제하지 않음 (숨김만) |
| `src/hooks/useSimulationData.ts` | 스트림 로직 변경 없음 (8c3bdb75에서 `StartSimulationInput` 타입으로 변경됨 — 이미 반영) |
| `src/services/sse/connectTaskStreamService.ts` | 스트림 서비스 변경 없음 |

### 코드 베이스 현황 (리베이스 후, 8c3bdb75 기준)

> 구현 시 아래 현황을 기준으로 작업

| 항목 | 현재 상태 |
|------|-----------|
| 시작 버튼 | `openStartSimulationDialog()` → Title/Description 다이얼로그 → `handleStartSimulation(runMeta)` |
| `useStartSimulation` 인자 | `StartSimulationInput` 객체 (`args`, `projectId`, `title`, `description`, `isRestart`) |
| 제어 함수 시그니처 | `pause(taskId)`, `resume(taskId)`, `stop(taskId)` — taskId 명시 전달 |
| Speed UI | 헤더에 드롭다운 + Actual Speed 표시 |
| LiveLogViewer | 언마운트 시 `stopPolling()` 호출로 스트림 정리 |
| localStorage 키 | `simulation-run:last-input:${userId}` (QuickRun과 통일)

---

## 구현 계획

### Task 1: `isSimulationActive` 파생 상태 추가

**위치**: `SimulationPage.tsx` (컴포넌트 상단)

```typescript
const isSimulationActive =
  activeJob?.status === 'running' ||
  activeJob?.status === 'paused' ||
  activeJob?.status === 'resumed';
```

### Task 2: beforeunload 이벤트 리스너

**위치**: `SimulationPage.tsx` (useEffect)

```typescript
useEffect(() => {
  if (!isSimulationActive) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '시뮬레이션이 실행 중입니다. 페이지를 떠나면 진행 상황을 복원할 수 없습니다.';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isSimulationActive]);
```

### Task 3: 내부 네비게이션 가드

**위치**: `handleBackToEditor`, `handleBackToDashboard`, `handleLogout`

각 핸들러 앞에 확인 로직 추가:

```typescript
const confirmNavigationIfActive = (): boolean => {
  if (!isSimulationActive) return true;
  return window.confirm(
    '시뮬레이션이 실행 중입니다. 페이지를 떠나면 진행 상황을 복원할 수 없습니다.\n계속하시겠습니까?'
  );
};

const handleBackToEditor = () => {
  if (!confirmNavigationIfActive()) return;
  // ... 기존 로직
};
```

### Task 4: JobListSidebar 숨김

**위치**: `SimulationPage.tsx` simulation 뷰 렌더링 부분

- `<JobListSidebar ... />` 렌더링 제거 (import는 유지)
- 빈 상태 안내 텍스트 수정

**Before**:
```tsx
<Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
  <JobListSidebar jobs={jobs} activeJobId={activeJobId} onJobSelect={setActiveJob} />
  <Box sx={{ flexGrow: 1, ... }}>
```

**After**:
```tsx
<Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
  {/* JobListSidebar 숨김 — 단일 해석 관리 모드 */}
  <Box sx={{ flexGrow: 1, ... }}>
```

---

## 스코프 외 (별도 작업)

| 항목 | 문서 |
|------|------|
| 기존 해석 복원 (`ListAllTasks` + `GetState` + 스트림 재연결) | [PHASE-04 Backlog](../phases/PHASE-04-simulation.md) |
| 전체 이력 차트 (`GetTelemetries` API 연동) | [PHASE-04 Backlog](../phases/PHASE-04-simulation.md) |

---

## Current State

- [x] Task 1: `isSimulationActive` 파생 상태 ✅
- [x] Task 2: beforeunload 이벤트 리스너 ✅
- [x] Task 3: 내부 네비게이션 가드 (`confirmNavigationIfActive`) ✅
- [x] Task 4: JobListSidebar 숨김 + 빈 상태 텍스트 수정 ✅
- [x] TypeScript 빌드 검증 통과 ✅
