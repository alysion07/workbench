---
title: "FEAT: 시뮬레이션 이력 관리"
status: planned
phase: 4
last_updated: 2026-04-03
---

# FEAT: 시뮬레이션 이력 관리

> **브랜치**: _(별도 브랜치에서 수행 예정)_
> **상태**: ⏳ 계획 수립 완료
> **관련 화면**: ANA-001 (Analysis 탭 TaskListPanel)
> **선행 작업**: FEAT-simulation-analysis.md Phase 2 (TaskListPanel 기본 구현)
> **최종 수정**: 2026-03-24

---

## Summary

BFF에 구현되어 있으나 UI에 미적용된 시뮬레이션 이력 관련 RPC를 연동한다.
Analysis 탭의 TaskListPanel에 이력 수정/삭제/상세 조회 기능을 추가하여,
사용자가 과거 실행 기록을 관리할 수 있도록 한다.

---

## Background

### BFF 미사용 RPC 현황 (2026-03-24 조사)

| Service | RPC | 설명 | UI 상태 |
|---------|-----|------|---------|
| ProjectManager | `getSimulationHistory` | 단일 이력 조회 (상세) | ❌ 미사용 |
| ProjectManager | `listSimulationHistories` | 전체 이력 목록 | ❌ 미사용 (ByProject만 사용 중) |
| ProjectManager | `updateSimulationHistory` | 이력 수정 (title/description/status) | ❌ 미사용 |
| ProjectManager | `deleteSimulationHistory` | 이력 삭제 | ❌ 미사용 |
| ProjectManager | `listSimulationHistoriesByUser` | 사용자별 전체 이력 | ❌ 미사용 (멀티 프로젝트 시 활용) |
| TaskManager | `deleteTask` | 태스크 삭제 | ❌ 미사용 (메모리 removeJob만 사용) |

### 이미 연동된 RPC

| Service | RPC | 사용 위치 |
|---------|-----|----------|
| ProjectManager | `listSimulationHistoriesByProject` | ProjectHomePage, (향후) TaskListPanel |
| ProjectManager | `createSimulationHistory` | BFF 내부 자동 생성 (createTask 시) |
| Storage | `listResultFiles` | Analysis 탭 결과 파일 목록 |
| Storage | `downloadTaskResultFile` | plotfl 다운로드 |

---

## Scope

- **포함**: 단일 프로젝트 내 이력 CRUD (조회/수정/삭제/상세)
- **제외**: 멀티 프로젝트 기능 (`listProjects`, `getProject`, `listSimulationHistoriesByUser`)
- **제외**: 자동 정리 정책 (후순위, 이력이 100개 이상 쌓일 때 재검토)

---

## Functional Requirements

| # | 요구사항 | 관련 RPC | 우선순위 |
|---|---------|---------|---------|
| FR-1 | 이력 **목록 조회** (전체) | `listSimulationHistoriesByProject` ✅ 이미 연동됨 | 🔴 |
| FR-2 | 이력 **제목/설명 인라인 편집** | `updateSimulationHistory` | 🟡 |
| FR-3 | 이력 **삭제** + 태스크 리소스 정리 | `deleteSimulationHistory` + `deleteTask` | 🟡 |
| FR-4 | 이력 **상세 조회** (CPU 시간, 시작/종료) | `getSimulationHistory` | 🟢 |

## Non-Functional Requirements

| # | 요구사항 |
|---|---------|
| NFR-1 | 삭제 시 반드시 확인 다이얼로그 표시 |
| NFR-2 | 수정/삭제 후 목록 자동 새로고침 |
| NFR-3 | 멀티 프로젝트 기능은 범위 밖 |

---

## User Stories

| # | Story | 수용 기준 |
|---|-------|----------|
| US-1 | 사용자로서, Analysis 탭 우측 패널에서 과거 해석 이력의 제목을 수정할 수 있다 | 인라인 편집 → Enter/blur → 서버 저장 → 목록 반영 |
| US-2 | 사용자로서, 불필요한 이력을 삭제할 수 있다 | 🗑️ 클릭 → 확인 다이얼로그 → 서버 삭제 → 목록에서 제거 |
| US-3 | 사용자로서, 이력 항목을 펼쳐 실행 상세 정보를 확인할 수 있다 | 항목 확장 → CPU 시간, 시작/종료 시간, 상태 표시 |
| US-4 | 종료된 시뮬레이션의 태스크 리소스가 이력 삭제 시 함께 정리된다 | 이력 삭제 → `deleteTask` 호출 → BFF 태스크 제거 |

---

## UI Integration

TaskListPanel (FEAT-simulation-analysis.md Phase 2)에 통합:

```
┌──────────────────────┐
│ 📋 해석 목록   ◀ ↻   │  ← 헤더 (접기 + 새로고침)
├──────────────────────┤
│ 📁 로컬 파일 열기     │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ ✅ 해석 #1  ★    │ │  ← 현재 로드된 항목 하이라이트
│ │ 2026-03-24 14:05 │ │
│ │ 5m 32s           │ │
│ │ [✏️ 편집] [🗑️]   │ │  ← FR-2, FR-3
│ │ ▼ 상세 펼치기     │ │  ← FR-4
│ │  시작: 14:00:05  │ │
│ │  종료: 14:05:37  │ │
│ │  CPU: 332s       │ │
│ ├──────────────────┤ │
│ │ ❌ 해석 #2       │ │  ← Failed 항목
│ │ 2026-03-23 09:12 │ │
│ │ Failed           │ │
│ │         [🗑️]    │ │  ← 삭제만 가능
│ └──────────────────┘ │
└──────────────────────┘
```

---

## Implementation Plan

### Phase 1: Service Layer 추가

**파일**: `src/services/pm/projectManagerService.ts`

추가할 wrapper 함수:
- `getSimulationHistory(taskId)` → 단일 이력 상세
- `updateSimulationHistory(taskId, { title, description })` → 이력 수정
- `deleteSimulationHistory(taskId)` → 이력 삭제

**파일**: `src/services/tm/taskManagerService.ts`

추가할 export:
- `deleteTask(taskId)` → 태스크 리소스 정리

### Phase 2: TaskListPanel CRUD 액션

**선행**: FEAT-simulation-analysis.md Phase 2 (TaskListPanel 기본 구현) 완료 후

**파일**: `src/components/analysis/TaskListPanel.tsx`

Props 확장:
```typescript
interface TaskListPanelProps {
  // 기존 (FEAT-simulation-analysis.md에서 정의)
  projectId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLoadResult: (entry: SimulationEntry) => void;
  onOpenLocalFile: () => void;
  loadingId: string | null;
  activeResultId: string | null;
  // 추가
  onEditTitle?: (taskId: string, newTitle: string) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}
```

기능 추가:
1. 각 항목에 편집/삭제 아이콘 버튼
2. 제목 인라인 편집 (TextField → 인라인 전환)
3. 삭제 확인 다이얼로그 (MUI Dialog)
4. 항목 Accordion 확장 → `getSimulationHistory` 호출 → 상세 표시

### Phase 3: 삭제 연계 (deleteTask)

**파일**: `src/stores/simulationStore.ts`

`removeJob` 액션에서 `deleteTask` 호출 추가:
```
현재: removeJob(jobId) → 메모리에서만 제거
개선: removeJob(jobId) → deleteTask(jobId) + 메모리 제거
```

---

## File Impact Summary

| 파일 | Phase | 변경 |
|------|-------|------|
| `src/services/pm/projectManagerService.ts` | 1 | wrapper 3개 추가 |
| `src/services/tm/taskManagerService.ts` | 1 | `deleteTask` export 추가 |
| `src/components/analysis/TaskListPanel.tsx` | 2 | CRUD 액션 UI (편집/삭제/상세) |
| `src/stores/simulationStore.ts` | 3 | `removeJob`에 `deleteTask` 연동 |

---

## Dependencies

- **선행**: FEAT-simulation-analysis.md Phase 2 (TaskListPanel 기본 구현)
- **백엔드 협의 필요**: 이력 삭제 시 MinIO 결과 파일 cascade 삭제 여부
  - Option A: BFF `deleteSimulationHistory` 내부에서 자동 정리 (추천)
  - Option B: UI에서 `deleteSimulationHistory` + 별도 파일 삭제 RPC 순차 호출

## Future Considerations

- **자동 정리 정책**: 이력 100개 초과 시 오래된 항목 자동 삭제 (사용자 설정 가능)
- **멀티 프로젝트**: `listProjects`, `getProject`, `listSimulationHistoriesByUser` 연동
- **결과 파일 개별 삭제**: Storage에 `deleteTaskResultFiles(projectId, taskId)` RPC 필요 시 백엔드 요청
