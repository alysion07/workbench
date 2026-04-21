---
title: "FEAT: MARS NEW/RESTART 설정"
status: done
phase: 4
branch: main
related_prs: [#63]
last_updated: 2026-04-03
---

# FEAT: MARS NEW/RESTART 설정

> **Parent**: [PHASE-02-project-model.md](../phases/PHASE-02-project-model.md)
> **Status**: 🚧 구현 완료
> **Created**: 2026-03-12
> **Branch**: `alysion/feat_shaft`

---

## Overview

프로젝트 생성 위저드(PRJ-001-NP)에서 MARS Analysis Code 선택 시 **NEW/RESTART** Problem Type과 **STDY-ST/TRANSNT** Problem Option을 설정하는 기능.

RESTART 선택 시 다른 프로젝트의 MARS 모델에서 nodes/edges를 복사하고, 시뮬레이션 단계에서 RSTPLT 파일을 전달할 수 있도록 소스 참조 정보를 저장한다.

---

## Manual Reference

- **PDF**: MARS-KS Code Manual, Volume II-Input Requirement (2022.2)
- **핵심 섹션**:
  - Card 100 (W1: Problem Type, W2: Problem Option)
  - Card 103 (Restart Input File Control — RESTART 필수, NEW 불가)
  - Card 104 (Restart-Plot File Control)
  - Card 200 (Initial Time — RESTART 시 재시작 시점)
  - Cards 201-299 (Time Step Control — RESTART 시 기존 시리즈 대체)

### MARS RESTART 핵심 규칙

| 규칙 | 설명 |
|------|------|
| Problem Type | `NEW` / `RESTART` (Card 100 W1) |
| Problem Option | `STDY-ST` / `TRANSNT` (Card 100 W2, 양쪽 모두 필수) |
| RESTART 소스 | RSTPLT 파일 (이전 시뮬레이션 출력) |
| Restart Number | RSTPLT 내 블록 번호 또는 -1 (마지막 시점) |
| Option 전환 | RESTART 시 STDY-ST↔TRANSNT 전환 가능 (시간 0으로 리셋) |
| 변경 불가 항목 | Card 110 (비응축가스 종류), Card 115 (비응축가스 질량분율), Cards 120-129 (수력학적 시스템) |
| 변경 가능 항목 | 컴포넌트 파라미터, Trips, Control Systems, Time Step Cards, TMDPVOL/TMDPJUN 테이블 |

---

## Design Decisions

| 항목 | 결정 | 근거 |
|------|------|------|
| UI 위치 | 동적 Step 4 (MARS 파티션 있을 때만) | 다이얼로그는 놓칠 위험, 스텝은 필수 통과 |
| 타입 전략 | `PartitionFormData.marsConfig?` (optional) | 하위 호환, SPHINCS/Modelica 영향 없음 |
| RESTART 복사 | 프로젝트 생성 시 `structuredClone`으로 deep copy | 독립적 모델 보장, 소스 변경에 영향 없음 |
| 설정 저장 | `model.settings.marsConfig` | 시뮬레이션 단계에서 Card 100/103 생성에 활용 |
| 소스 범위 | 전체 프로젝트에서 MARS 모델 리스트업 | 사용자 요구사항 |
| 비활성화 처리 | 별도 태스크로 분리 | 에디터 단계 컴포넌트 수정 필요, 범위 분리 |

---

## Type Definitions

### New Types (`src/types/supabase.ts`)

```typescript
// MARS Problem Type
export type MARSProblemType = 'NEW' | 'RESTART';

// MARS Problem Option
export type MARSProblemOption = 'STDY-ST' | 'TRANSNT';

// RESTART 소스 참조 정보
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
  problemType: MARSProblemType;
  problemOption: MARSProblemOption;
  restartSource?: RestartSource;  // RESTART일 때만
}
```

### Extended Type

```typescript
// PartitionFormData에 marsConfig 추가
export interface PartitionFormData {
  id: string;
  name: string;
  analysisCode: AnalysisCode;
  description?: string;
  scope: SystemScope[];
  marsConfig?: MARSConfig;        // NEW 필드 (MARS일 때만)
}
```

---

## Wizard Flow

```
MARS 미선택: Step 1 → Step 2 → Step 3 → [Create]
MARS 선택:   Step 1 → Step 2 → Step 3 → Step 4 → [Create]
```

### Step 4 Layout

```
┌─── Step 4: MARS Configuration ──────────────────────┐
│                                                       │
│  📦 Partition: "NSSS Model"                          │
│  ┌──────────────────────────────────────────────┐    │
│  │ Problem Type          Problem Option          │    │
│  │ ◉ NEW  ○ RESTART     ○ STDY-ST  ◉ TRANSNT   │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  📦 Partition: "BOP Model"                           │
│  ┌──────────────────────────────────────────────┐    │
│  │ Problem Type          Problem Option          │    │
│  │ ○ NEW  ◉ RESTART     ○ STDY-ST  ◉ TRANSNT   │    │
│  │                                               │    │
│  │ ── Restart Source ──────────────────────────  │    │
│  │ Project:  [▼ APR1400-LOFW                  ]  │    │
│  │ Model:    [▼ BOP System                    ]  │    │
│  │ Run:      [▼ 마지막 시점 (t=500s)          ]  │    │
│  │ RSTPLT:   minio://project-xxx/rstplt (auto)   │    │
│  │                                               │    │
│  │ ⚠️ RESTART: 비응축가스/수력학적 시스템 설정     │    │
│  │    변경 불가 (에디터에서 비활성화 표시)          │    │
│  └──────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

---

## Data Flow (Sequence)

```
Step3: MARS 선택 → "Next"
  │
  hasMarsPartition? ──No──→ Create
  │Yes
  ▼
Step4MarsConfig
  │
  ├─ NEW: problemOption만 설정
  │
  └─ RESTART: problemOption + RestartSourceSelector
       │
       ├─ fetchMarsProjects() → 프로젝트 목록
       ├─ 프로젝트 선택 → MARS 모델 목록
       └─ 모델 선택 → 시뮬레이션/restart point 목록
  │
  "Create" 클릭
  │
  ProjectPickerPage.handleCreateProject
  │
  RESTART? ──No──→ 빈 nodes/edges로 모델 생성
  │Yes
  소스 모델 조회 → nodes/edges structuredClone
  marsConfig를 model.settings에 저장
  │
  Supabase 저장 → 에디터로 이동
```

---

## Impact Analysis

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/types/supabase.ts` | 수정 | 새 타입 추가, PartitionFormData 확장 |
| `src/components/projectPicker/NewProjectWizard/types.ts` | 수정 | WizardStep에 4 추가, getWizardSteps() |
| `src/components/projectPicker/NewProjectWizard/index.tsx` | 수정 | 동적 lastStep, Step4 렌더링, MARS 검증 |
| `src/components/projectPicker/NewProjectWizard/StepIndicator.tsx` | 수정 | steps prop 추가 |
| `src/components/projectPicker/NewProjectWizard/Step4MarsConfig.tsx` | **신규** | MARS 설정 전체 UI |
| `src/components/projectPicker/NewProjectWizard/MarsPartitionConfig.tsx` | **신규** | 개별 MARS 파티션 설정 카드 |
| `src/components/projectPicker/NewProjectWizard/RestartSourceSelector.tsx` | **신규** | Cascading Select (Project→Model→Run) |
| `src/pages/ProjectPickerPage.tsx` | 수정 | handleCreateProject에 RESTART 복사 로직 |
| `src/stores/projectStore.ts` | 수정 | fetchMarsProjects, getMarsModels 추가 |

---

## Follow-up Tasks (별도 태스크)

- [ ] **RESTART 에디터 비활성화**: RESTART 모델 편집 시 Card 110/115/120-129 대응 필드 disabled 처리 + 안내 UI
- [ ] **fileGenerator 연동**: MARS 입력 파일(.i) 생성 시 Card 100/103/104 자동 생성
- [ ] **시뮬레이션 연동**: RSTPLT 파일 경로를 MARS 실행 시 전달하는 Phase 4 로직

---

## Current State

- 🚧 구현 완료, 테스트 대기 (타입 체크 통과)
