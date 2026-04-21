# Workflow: SimulationStore Job[] 제거 + coSimSession 단일 구조 통합

> 생성일: 2026-04-13
> 브랜치: `feat/cosim`
> Phase: 1 (SimulationStore 리팩토링)
> Phase 2 (AnalysisStore Co-Sim 지원)는 별도 워크플로우로 진행

---

## 목표

- `Job` 타입, `jobs: Job[]`, `activeJobId` **즉시 완전 삭제**
- 모든 태스크 lifecycle 상태를 `coSimSession.models[modelId]`에 통합
- 시뮬레이션 제어 단위를 `simId` 기반으로 일원화
- `SimulationStatus` / `JobStatus` → `SimStatus`로 통합

---

## 의존 그래프 (변경 순서 결정용)

```
types/simulation.ts              ← Step 1: 타입 (Job 삭제 + ModelSimData 확장)
    ↑
stores/simulationStore.ts        ← Step 2: 스토어 (jobs 삭제 + 액션 교체)
stores/index.ts                  ← Step 2: re-export 수정
    ↑
hooks/useSimulationData.ts       ← Step 3: 스트리밍 훅
hooks/useQuickRun.ts             ← Step 3
hooks/useCoSimQuickRun.ts        ← Step 3
hooks/useDemoMode.ts             ← Step 3
services/mars/marsServiceMod02.ts ← Step 3
services/mars/marsServiceMod06.ts ← Step 3
    ↑
pages/SimulationPage.tsx          ← Step 4: 페이지/컴포넌트
components/simulation/SimulationControlBar.tsx  ← Step 4
components/simulation/LiveLogViewer.tsx         ← Step 4
components/simulation/JobListSidebar.tsx        ← Step 4 (파일 삭제)
components/interactive/InteractiveControlView.tsx ← Step 4
```

---

## Step 1: 타입 정의 — Job 삭제 + SimStatus 통합

**파일**: `src/types/simulation.ts`
**의존**: 없음 (최하위)

### 1-1. Job 및 JobStatus 삭제

다음을 **완전 삭제**:

```typescript
// 삭제 대상
export type JobStatus = 'pending' | 'running' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'failed';
export interface Job { ... }  // 28~44행 전체
```

### 1-2. SimStatus 통합 타입 생성

기존 두 타입을 하나로 통합:

```typescript
// 기존: JobStatus + SimulationStatus 각각 존재
// 통합:
export type SimStatus = 'building' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
// 매핑:
//   'pending' → 'building'
//   'resumed' → 'running' (구분 불필요)
//   'ready' → 제거 (Build 후 바로 Start)
```

기존 `SimulationStatus` 타입도 `SimStatus`로 교체.

### 1-3. ModelSimData 확장

Job의 lifecycle 필드를 흡수:

```typescript
export interface ModelSimData {
  // 식별
  modelId: string;
  modelName: string;
  taskId: string;
  taskIndex: number;
  // lifecycle (기존 Job에서 이동)
  status: SimStatus;
  args: string;
  taskMode: TaskMode;
  startTime: number;
  endTime?: number;
  progress?: number;
  error?: string;
  lastSimState?: SimStateSnapshot;
  // streaming data (기존 유지)
  plotData: PlotData[];
  screenLogs: string[];
  latestMinorEdit: MinorEditNamedSnapshot | null;
  runtimeMinorEdits: import('../types/mars').MinorEdit[] | null;
}
```

### 1-4. CoSimSession 확장

```typescript
export interface CoSimSession {
  simId: string;
  projectId: string;
  status: SimStatus;       // SimulationStatus → SimStatus
  startTime: number;       // NEW
  models: Record<string, ModelSimData>;
}
```

### 검증

- [ ] `npm run build` — 대량 에러 예상 (정상, Step 2~4에서 수정)

---

## Step 2: Store 리팩토링 — jobs 삭제 + 액션 교체

**파일**: `src/stores/simulationStore.ts`, `src/stores/index.ts`
**의존**: Step 1 완료

### 2-1. 상태 필드 삭제

```diff
 interface SimulationStore {
-  jobs: Job[];
-  activeJobId: string | null;
   // UI 상태 유지
   coSimSession: CoSimSession | null;
   activeModelId: string | null;
 }
```

초기값에서도 `jobs: []`, `activeJobId: null` 제거.

### 2-2. 액션 삭제 + 교체

| 삭제 | 대체 |
|------|------|
| `addJob(job)` | `initCoSimSession`에 lifecycle 필드 포함 |
| `updateJob(id, updates)` | **신규** `updateModelByTaskId(taskId, updates)` |
| `removeJob(id)` | 삭제 (세션 단위 관리) |
| `setActiveJob(id)` | `setActiveModel(modelId)` (기존) |
| `clearJobs()` | `clearCoSimSession()` (기존) |
| `updateModelJob(modelId, updates)` | **신규** `updateModel(modelId, updates)` |

#### updateModelByTaskId 구현

```typescript
updateModelByTaskId: (taskId, updates) =>
  set((state) => {
    if (!state.coSimSession) return {};
    const models = { ...state.coSimSession.models };
    const entry = Object.entries(models).find(([, m]) => m.taskId === taskId);
    if (!entry) return {};
    const [modelId, model] = entry;
    models[modelId] = { ...model, ...updates };
    return { coSimSession: { ...state.coSimSession, models } };
  }, false, 'updateModelByTaskId'),
```

#### updateModel 구현

```typescript
updateModel: (modelId, updates) =>
  set((state) => {
    if (!state.coSimSession?.models[modelId]) return {};
    const model = state.coSimSession.models[modelId];
    return {
      coSimSession: {
        ...state.coSimSession,
        models: {
          ...state.coSimSession.models,
          [modelId]: { ...model, ...updates },
        },
      },
    };
  }, false, 'updateModel'),
```

### 2-3. initCoSimSession 시그니처 변경

```typescript
initCoSimSession: (
  simId: string,
  projectId: string,
  models: Array<{
    modelId: string;
    modelName: string;
    taskId: string;
    taskIndex: number;
    args: string;
    taskMode: TaskMode;
    status?: SimStatus;   // 기본값: 'building'
  }>
) => void;
```

구현: `startTime: Date.now()` 자동 설정, `status` 기본값 `'building'`.

### 2-4. 새 선택자

```typescript
// useActiveJob 대체
export const useActiveModel = () =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    if (!coSimSession || !activeModelId) return null;
    return coSimSession.models[activeModelId] ?? null;
  });

// activeJobId 대체 (MARS 서비스용)
export const getActiveTaskId = () => {
  const { coSimSession, activeModelId } = useSimulationStore.getState();
  if (!coSimSession) return null;
  // activeModelId 있으면 해당 모델, 없으면 첫 번째 모델 사용
  const targetId = activeModelId ?? Object.keys(coSimSession.models)[0];
  return coSimSession.models[targetId]?.taskId ?? null;
};

// jobs 대체
export const useSessionModels = () =>
  useSimulationStore((state) =>
    state.coSimSession ? Object.values(state.coSimSession.models) : []
  );
```

### 2-5. 기존 선택자 삭제

```diff
-export const useActiveJob = () => ...;
-export const useJobs = () => ...;
```

### 2-6. `stores/index.ts` re-export 수정

```diff
-export { useSimulationStore, useActiveJob, usePlotData } from './simulationStore';
+export { useSimulationStore, useActiveModel, usePlotData } from './simulationStore';
```

### 2-7. hasSimulationData 수정

```typescript
export const hasSimulationData = () => {
  const session = useSimulationStore.getState().coSimSession;
  if (!session) return false;
  return Object.values(session.models).some(
    (m) => m.plotData.length > 0 || m.status === 'running'
  );
};
```

### 2-8. resetAll 수정

```diff
 resetAll: () =>
   set({
-    jobs: [],
-    activeJobId: null,
     chartZoom: 1,
     ...
     coSimSession: null,
     activeModelId: null,
   }, false, 'resetAll'),
```

### 검증

- [ ] Store 내부 일관성 확인
- [ ] `npm run build` — 소비자(훅/서비스) 에러 예상 (Step 3에서 수정)

---

## Step 3: 훅 & 서비스 마이그레이션

**파일**: 6개
**의존**: Step 2 완료

### 3-1. `hooks/useSimulationData.ts` (핵심)

#### a) import 정리

```diff
-import type { Job, TaskMode, PlotData, JobStatus, SimStateSnapshot, CoSimSession } from '../types/simulation';
+import type { TaskMode, PlotData, SimStatus, SimStateSnapshot, CoSimSession } from '../types/simulation';
```

#### b) mapSimStateStatusToJobStatus → mapSimStateStatus

```typescript
function mapSimStateStatus(serverStatus: string): SimStatus {
  switch (serverStatus?.toLowerCase()) {
    case 'running': return 'running';
    case 'paused': return 'paused';
    case 'completed': case 'finished': return 'completed';
    case 'stopped': return 'stopped';
    case 'failed': case 'error': return 'failed';
    default: return 'building';
  }
}
```

#### c) useStartSimulation (단일 모델)

```diff
 onSuccess: ({ taskId, simId, args, taskMode }, variables) => {
   clearCoSimSession();
   setActiveTab('all');
   const modelId = `single-${taskId}`;
   initCoSimSession(simId ?? taskId, variables.projectId, [{
     modelId, modelName: extractProjectName(args),
     taskId, taskIndex: 0,
+    args, taskMode, status: 'running',
   }]);
-  const newJob: Job = { id: taskId, args, taskMode, status: 'running', ... };
-  addJob(newJob);
-  setActiveJob(taskId);
+  setActiveModel(modelId);
 },
```

#### d) useStartCoSimulation (다중 모델)

```diff
 onSuccess: ({ simId, taskIds, models }, variables) => {
   clearCoSimSession();
   setActiveTab('all');
   initCoSimSession(simId, variables.projectId, models.map((m, i) => ({
     modelId: m.modelId, modelName: m.modelName,
     taskId: taskIds[i], taskIndex: i,
+    args: m.inputFileUrl, taskMode: m.taskMode, status: 'running',
   })));
-  for (let i = 0; i < models.length; i++) {
-    addJob({ id: taskIds[i], ... });
-  }
-  if (taskIds.length > 0) setActiveJob(taskIds[0]);
 },
```

#### e) useLiveData — updateJob → updateModelByTaskId

```diff
-  const currentJob = useSimulationStore.getState().jobs.find((job) => job.id === taskId);
+  const session = useSimulationStore.getState().coSimSession;
+  const model = session ? Object.values(session.models).find((m) => m.taskId === taskId) : null;
   ...
-  updateJob(taskId, { status: newStatus, lastSimState: snapshot, endTime: ... });
+  updateModelByTaskId(taskId, { status: newStatus, lastSimState: snapshot, endTime: ... });
```

#### f) useCoSimLiveData — 동일 패턴

`updateModelJob(modelId, updates)` → `updateModel(modelId, updates)`

#### g) updateOverallSimStatus — jobs 참조 제거

```diff
-  const statuses = Object.values(session.models).map((m) => {
-    const job = useSimulationStore.getState().jobs.find((j) => j.id === m.taskId);
-    return job?.status ?? 'pending';
-  });
+  const statuses = Object.values(session.models).map((m) => m.status);
```

status 집계 로직의 `'pending'` → `'building'` 변경.

#### h) store 디스트럭처링 변경

```diff
   const {
-    addJob, setActiveJob, setActiveTab,
-    initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
+    setActiveModel, setActiveTab,
+    initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
+    updateModelByTaskId, updateModel, setCoSimStatus,
   } = useSimulationStore();
```

### 3-2. `hooks/useQuickRun.ts`

```diff
 const {
-  addJob, setActiveJob, setActiveTab,
+  setActiveModel, setActiveTab,
   initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
 } = useSimulationStore();
 ...
 onSuccess: ({ taskId, simId, args, taskMode }) => {
   clearCoSimSession();
   const modelId = `single-${taskId}`;
   initCoSimSession(simId ?? taskId, quickRunProjectId, [{
     modelId, modelName: ..., taskId, taskIndex: 0,
+    args, taskMode, status: 'running',
   }]);
-  addJob({ id: taskId, args, taskMode, status: 'running', ... });
-  setActiveJob(taskId);
+  setActiveModel(modelId);
 },
```

### 3-3. `hooks/useCoSimQuickRun.ts`

단일/다중 모델 양쪽에서 동일 패턴 적용:
- `addJob` 호출 제거
- `initCoSimSession`에 `args`, `taskMode`, `status` 포함
- `setActiveJob` → `setActiveModel`

### 3-4. `hooks/useDemoMode.ts`

```diff
-  addJob({ id: m.taskId, args: ..., status: 'running', ... });
+  // initCoSimSession에 이미 포함됨 — addJob 호출 제거
```

데모 데이터 생성 시 `initCoSimSession` 호출에 lifecycle 필드 포함.

### 3-5. `services/mars/marsServiceMod02.ts` + `marsServiceMod06.ts`

```diff
+import { getActiveTaskId } from '@/stores/simulationStore';
 ...
-  getTaskId: () => useSimulationStore.getState().activeJobId,
+  getTaskId: () => getActiveTaskId(),
```

### 검증

- [ ] 각 훅의 import에서 `Job`, `addJob`, `setActiveJob` 완전 제거 확인
- [ ] `npm run build` — 페이지/컴포넌트 에러만 남아야 함

---

## Step 4: 페이지 & 컴포넌트 마이그레이션

**파일**: 5개
**의존**: Step 3 완료

### 4-1. `pages/SimulationPage.tsx` (가장 큰 변경)

#### a) import 변경

```diff
-import { useSimulationStore, useActiveJob, hasSimulationData, useCoSimSession, ... } from '@/stores/simulationStore';
+import { useSimulationStore, useActiveModel, hasSimulationData, useCoSimSession, ... } from '@/stores/simulationStore';
-import type { JobStatus } from '@/types/simulation';
+import type { SimStatus } from '@/types/simulation';
```

#### b) 상태 판단 변경

```diff
-  const activeJob = useActiveJob();
+  const activeModel = useActiveModel();

-  const isSimulationActive =
-    activeJob?.status === 'running' ||
-    activeJob?.status === 'paused' ||
-    activeJob?.status === 'resumed';
+  const isSimulationActive =
+    coSimSession?.status === 'running' ||
+    coSimSession?.status === 'paused';
```

#### c) 제어 핸들러 (Stop/Pause/Resume)

```diff
-  if (!activeJob && !coSimSession) return;
-  const controlSimId = coSimSession?.simId || activeJob?.simId;
+  if (!coSimSession?.simId) return;
+  const controlSimId = coSimSession.simId;
   ...
-  updateJob(activeJob.id, { status: 'stopped', endTime: Date.now() });
+  for (const m of Object.values(coSimSession.models)) {
+    updateModelByTaskId(m.taskId, { status: 'stopped', endTime: Date.now() });
+  }
+  setCoSimStatus('stopped');
```

#### d) 완료 감지

```diff
-  }, [activeJob?.status, activeJob?.endTime, ...]);
+  }, [coSimSession?.status, ...]);
```

#### e) 결과 파일 조회

```diff
-  if (!activeJob || activeJob.status !== 'completed') return;
+  if (!coSimSession || coSimSession.status !== 'completed') return;
+  if (!activeModel) return;
   ...
-  activeJob.simId || activeJob.id,
-  activeJob.taskIndex ?? 0,
-  activeJob.modelId,
+  coSimSession.simId,
+  activeModel.taskIndex,
+  activeModel.modelId,
```

#### f) SimulationControlBar props

```diff
   <SimulationControlBar
-    activeJob={activeJob}
+    activeModel={activeModel}
+    sessionStatus={coSimSession?.status ?? null}
     onPause={handlePause}
     ...
   />
```

#### g) Co-Sim 모델 탭 — jobs.find 제거

```diff
   const coSimModelTabs = useMemo(() => {
     return Object.values(coSimSession.models).map((m) => ({
       modelId: m.modelId,
       modelName: m.modelName,
-      status: useSimulationStore.getState().jobs.find((j) => j.id === m.taskId)?.status ?? 'pending',
+      status: m.status,
     }));
   }, [coSimSession]);
```

#### h) useLiveData vs useCoSimLiveData 분기

```diff
-  useLiveData(coSimSession ? null : (activeJob?.id ?? null), {
-    enabled: !coSimSession && !!activeJob?.id && isSimulationActive,
-  });
-  useCoSimLiveData(coSimSession && isSimulationActive ? coSimSession : null);
+  // 단일 모델: useLiveData, 멀티 모델: useCoSimLiveData
+  const modelCount = coSimSession ? Object.keys(coSimSession.models).length : 0;
+  const firstModel = coSimSession ? Object.values(coSimSession.models)[0] : null;
+
+  useLiveData(modelCount === 1 ? (firstModel?.taskId ?? null) : null, {
+    enabled: modelCount === 1 && isSimulationActive,
+  });
+  useCoSimLiveData(modelCount > 1 && isSimulationActive ? coSimSession : null);
```

#### i) store 디스트럭처링 정리

```diff
   const {
-    updateJob, setActiveJob,
+    updateModelByTaskId, setActiveModel,
     setCoSimStatus, ...
   } = useSimulationStore();
```

### 4-2. `components/simulation/SimulationControlBar.tsx`

```diff
-import type { Job } from '@/types/simulation';
+import type { ModelSimData, SimStatus } from '@/types/simulation';
 ...
 export interface SimulationControlBarProps {
-  activeJob: Job | null;
+  activeModel: ModelSimData | null;
+  sessionStatus: SimStatus | null;
   onPause: () => void;
   onResume: () => void;
   onStop: () => void;
   onSpeedChange: (ratio: number) => void;
   maxTime?: number;
 }

-  const isActive = activeJob?.status === 'running' || activeJob?.status === 'paused' || activeJob?.status === 'resumed';
+  const isActive = sessionStatus === 'running' || sessionStatus === 'paused';

-  activeJob.startTime / activeJob.endTime / activeJob.lastSimState
+  activeModel?.startTime / activeModel?.endTime / activeModel?.lastSimState
```

STATUS_MAP 키에서 `'resumed'` → `'running'`, `'pending'` → `'building'` 변경.

### 4-3. `components/simulation/LiveLogViewer.tsx`

```diff
-import { useActiveJob } from '@/stores/simulationStore';
+import { useActiveModel } from '@/stores/simulationStore';

-  const activeJob = useActiveJob();
+  const activeModel = useActiveModel();

-  activeJob?.startTime
+  activeModel?.startTime
```

### 4-4. `components/interactive/InteractiveControlView.tsx`

```diff
-import { useActiveJob, useLatestMinorEdit } from '@/stores/simulationStore';
+import { useActiveModel, useLatestMinorEdit } from '@/stores/simulationStore';

-  const activeJob = useActiveJob();
+  const activeModel = useActiveModel();
```

### 4-5. `components/simulation/JobListSidebar.tsx` — 파일 삭제

SimulationPage에서 이미 주석 처리 상태. 파일 삭제 + import 주석 제거.

### 검증

- [ ] `npm run build` — **에러 0**
- [ ] `npm run lint` — 미사용 import 없음
- [ ] grep 확인: `grep -rn "Job\b\|activeJobId\|addJob\|useActiveJob\|useJobs" src/ --include="*.ts" --include="*.tsx"` → 결과 없음
- [ ] 브라우저 테스트: 단일 모델 QuickRun
- [ ] 브라우저 테스트: 멀티 모델 Co-Sim QuickRun
- [ ] 브라우저 테스트: Pause/Resume/Stop
- [ ] 브라우저 테스트: 데모 모드

---

## 리스크 및 주의사항

### High Risk

| 항목 | 리스크 | 대응 |
|------|--------|------|
| `useLiveData` vs `useCoSimLiveData` 분기 | 단일 모델도 coSimSession 사용 → 기존 `!coSimSession` 분기 깨짐 | Step 4-1h: 모델 수 기반 분기로 변경 |
| `marsService` getActiveTaskId | taskId null이면 API 호출 실패 | getActiveTaskId에 첫 번째 모델 자동 선택 폴백 포함 |
| persist middleware | localStorage 이전 데이터 충돌 가능 | `partialize`에 jobs 미포함 확인 완료 (현재도 미포함) |

### Medium Risk

| 항목 | 리스크 | 대응 |
|------|--------|------|
| `updateOverallSimStatus` | `'pending'` → `'building'` 매핑 누락 시 상태 계산 오류 | Step 3-1g에서 명시적 변경 |
| SimulationControlBar STATUS_MAP | `'resumed'`, `'pending'` 키 제거 시 런타임 에러 | Step 4-2에서 `SimStatus` 키로 교체 |

### Low Risk

| 항목 | 비고 |
|------|------|
| ChartComparePanel, ChartToolbar, DynamicChartGrid | jobs/activeJob 미사용, UI 상태만 참조 |
| stores/useStore.ts | simulationStore import하나 직접 jobs 미참조 |

---

## 예상 작업 규모

| Step | 파일 수 | 핵심 파일 |
|------|---------|----------|
| Step 1 (타입) | 1 | `types/simulation.ts` |
| Step 2 (스토어) | 2 | `simulationStore.ts`, `stores/index.ts` |
| Step 3 (훅/서비스) | 6 | `useSimulationData.ts` (핵심), `useQuickRun.ts`, `useCoSimQuickRun.ts`, `useDemoMode.ts`, `marsServiceMod02/06.ts` |
| Step 4 (페이지/컴포넌트) | 5 | `SimulationPage.tsx` (핵심), `SimulationControlBar.tsx`, `LiveLogViewer.tsx`, `InteractiveControlView.tsx`, `JobListSidebar.tsx` (삭제) |
| **합계** | **14** | |

기존 5단계 → **4단계로 축소** (Step 5 정리 단계 제거 — Step 1에서 즉시 삭제)

---

## 다음 단계

이 워크플로우 승인 후 `/sc:implement`로 Step 1부터 순차 실행.
각 Step 완료 시 `npm run build`로 중간 검증.
