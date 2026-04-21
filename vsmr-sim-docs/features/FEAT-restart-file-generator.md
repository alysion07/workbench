---
title: "FEAT: RESTART 모드 파일 생성기 개선"
status: done
phase: 4
branch: main
related_prs: [#63]
last_updated: 2026-04-03
---

# FEAT: RESTART 모드 파일 생성기 개선

> **Branch**: `alysion/feat_icv`
> **Created**: 2026-03-25
> **Updated**: 2026-03-25 (metadata 필드 활용 + store 분리 설계 반영)
> **Status**: 🚧 구현 중

---

## 1. 핵심 원리

MARS 매뉴얼 Section 1.5:
> "If a matching card number is found, the data entered on the previous card are **replaced** by data from the current card."

**RESTART 입력파일 = rstplt 대비 오버라이드할 카드만 작성**

→ 입력파일에 쓴 카드만 rstplt 값을 대체, 안 쓴 카드는 rstplt 값 유지.

---

## 2. 발견된 문제점 및 근본 원인

### 2.1 문제 1: RESTART export 시 전체 출력 (2,045줄 → REF 98줄)

`Model.settings` 하나로 NEW/RESTART를 겸용하여, export 시 전체가 출력됨.

**해결:** `Model.restartSettings` 분리 (섹션 3)

### 2.2 문제 2: import 후 저장 → marsConfig 소실

`model.settings`가 두 가지 역할을 동시에 담당:
- **메타데이터**: `marsConfig` (restart 판별, source 정보)
- **파일 생성 데이터**: trips, GTs, minor edits 등

import 시 `store.metadata.globalSettings = restartSettings`(오버라이드만) → 저장하면 `model.settings = restartSettings` → **marsConfig 포함한 기존 settings 전체 소실**.

**해결:** `ProjectData.metadata` 필드 활용 + store 분리 (섹션 4)

### 2.3 문제 3: `ProjectData.metadata` 필드 미활용

`taskMode`, `restartProjectId`, `restartSourceTaskId`가 타입에 정의되어 있으나:
- 위저드에서 **세팅하지 않음** (항상 undefined)
- `marsConfig`에서 1차로 읽고, metadata는 fallback으로만 사용
- fallback이 항상 undefined이므로 **사실상 무의미**

**해결:** 위저드에서 세팅 + metadata를 primary 소스로 전환 (섹션 4)

---

## 3. 설계: `restartSettings` 분리

### 3.1 Model 데이터 구조

```
Model.settings: GlobalSettings          ← NEW 해석용 전체 데이터 (변경 없음)
Model.restartSettings?: GlobalSettings  ← RESTART 오버라이드 카드만 (새로 추가)
```

### 3.2 동작 원리

| 모드 | fileGenerator 입력 | 결과 |
|------|-------------------|------|
| NEW | `settings` | 전체 출력 (현재와 동일) |
| RESTART | `restartSettings` | 오버라이드 카드만 출력 |

fileGenerator는 **받은 settings를 그대로 출력**하는 것만 담당.
어떤 카드를 넣을지는 **데이터(restartSettings)가 결정**.

---

## 4. 설계: metadata 필드 활용 + store 분리

### 4.1 데이터 소스 역할 정리

| 정보 | 소스 | 용도 |
|------|------|------|
| restart 여부 | `ProjectData.metadata.taskMode` | 모든 restart 판별 |
| source project | `ProjectData.metadata.restartProjectId` | rstplt 복사 경로 |
| source task | `ProjectData.metadata.restartSourceTaskId` | rstplt 복사 경로 |
| card100/103 생성 | `model.settings.marsConfig` 또는 `restartSettings.card100` | 파일 생성용 |

**원칙:**
- **restart 판별 + 소스 정보** → `ProjectData.metadata`에서 읽음 (단일 소스)
- **marsConfig** → 파일 생성(`card100`, `card103` 출력)용으로만 사용
- `metadata`는 `settings` 저장과 독립 → import/저장으로 날아가지 않음

### 4.2 위저드(ProjectPickerPage) 변경

```typescript
// 프로젝트 생성 시 metadata에 restart 정보 세팅
metadata: {
  tags: formData.tags,
  // RESTART partition이면 추가
  taskMode: 'restart',
  restartProjectId: source.projectId,
  restartSourceTaskId: source.simulationId,
},
```

### 4.3 store metadata 분리

```typescript
// 현재: globalSettings 하나에 전부 담음
metadata.globalSettings  ← import 시 restartSettings로 교체됨 → 저장 시 settings 덮어씀

// 변경: 분리
metadata.globalSettings      ← 항상 전체 settings (marsConfig 포함, 불변)
metadata.restartSettings     ← RESTART일 때만 존재, 오버라이드 카드만
```

### 4.4 기존 marsConfig 의존 → metadata 전환

| 위치 | 현재 (marsConfig에서 읽음) | 변경 (metadata에서 읽음) |
|------|--------------------------|------------------------|
| SimulationPage L446-449 | `marsConfig.problemType` → taskMode | `metadata.taskMode` |
| SimulationPage L450-451 | `marsConfig.restartSource.projectId` | `metadata.restartProjectId` |
| SimulationPage L452-453 | `marsConfig.restartSource.simulationId` | `metadata.restartSourceTaskId` |
| SimulationPage L275-279 | `marsConfig.problemType` → isRestart | `metadata.taskMode` |
| EditorPage L169-173 | `marsConfig.problemType` → isRestart | `metadata.taskMode` |
| EditorPage L391-394 | `marsConfig.problemType` → isRestart | `metadata.taskMode` |
| EditorPage L487-490 | `marsConfig.problemType` → isRestart | `metadata.taskMode` |

### 4.5 import 흐름 (변경 후)

```
JSON import → loadProject({
  metadata: {
    globalSettings: model.settings,         ← 전체 (marsConfig 포함, 불변)
    restartSettings: model.restartSettings, ← 오버라이드 카드만
    taskMode: projectData.metadata.taskMode,
    restartProjectId: projectData.metadata.restartProjectId,
    restartSourceTaskId: projectData.metadata.restartSourceTaskId,
  }
})
```

### 4.6 저장 흐름 (변경 후)

```
handleSave → updateModel(projectId, modelId, {
  settings: metadata.globalSettings,         ← 전체 settings (marsConfig 보존)
  restartSettings: metadata.restartSettings, ← 오버라이드 카드만
})
```

### 4.7 Export 시 파일 생성 흐름

```
handleStartSimulation:
  taskMode = metadata.taskMode (또는 Supabase metadata에서)
  if (taskMode === 'restart')
    → fileGenerator.generate(nodes, edges, name, metadata.restartSettings)
  else
    → fileGenerator.generate(nodes, edges, name, metadata.globalSettings)
```

---

## 5. RESTART 시 fileGenerator 출력 규칙

### 5.1 항상 출력 (MARS 필수 카드)

| 카드 | 설명 | 소스 |
|------|------|------|
| Card 1 | Title | 프로젝트명 |
| Card 100 | `restart transnt` | restartSettings.card100 |
| Card 101 | `run` | restartSettings.card101 |
| Card 102 | `si si` | restartSettings.card102 |
| Card 103 | `-1` (restart number) | restartSettings.card103 |
| Card 120-121 | System Configuration | restartSettings.systems |
| Card 200 + 201-20x | Time Step Control | restartSettings.card200 + timePhases |

### 5.2 restartSettings에 있으면 출력

| 섹션 | restartSettings 필드 |
|------|---------------------|
| Minor Edits (301-399) | `minorEdits` |
| Variable Trips (401+) | `variableTrips` |
| Logical Trips (601+) | `logicTrips` |
| General Tables | `generalTables` |
| Control Variables | `controlVariables` |
| Thermal Properties | `thermalProperties` |
| Reactor Kinetics | `reactorKinetics` |

### 5.3 RESTART에서 절대 출력하지 않는 것 (MARS 제약)

| 섹션 | 이유 |
|------|------|
| Card 110/115 (Gas) | rstplt에서 로드 |
| Extended Minor Edits (20800001+) | rstplt에서 로드 (WARNING) |
| Interactive Inputs (801-809) | rstplt에서 로드 (ERROR) |
| Hydrodynamic Components | rstplt에서 로드 |

---

## 6. 타입 변경

### 6.1 Model 인터페이스 (✅ 구현 완료)

```typescript
// src/types/supabase.ts
export interface Model {
  settings: any;                    // NEW 해석용 전체 설정
  restartSettings?: any;            // RESTART 오버라이드 설정 (optional)
}
```

### 6.2 ProjectData.metadata (기존 타입, 활용 시작)

```typescript
metadata?: {
  taskMode?: TaskMode;                      // 'new' | 'restart'
  restartProjectId?: string;                // RESTART 소스 프로젝트 ID
  restartSourceTaskId?: string;             // RESTART 소스 태스크 ID
  tags?: string[];
};
```

---

## 7. 구현 계획

### Phase 1: 기반 (✅ 완료)

- [x] Task 1: 타입 추가 — `Model`에 `restartSettings?: any`
- [x] Task 2: fileGenerator 호환성 — nodes 검증 스킵, 빈 섹션 헤더, MARS 제약 가드
- [x] Task 3: Docker MARS 검증 — REF 대비 해석 결과 동등성 확인

### Phase 2: metadata 활용 + store 분리 (🚧 진행 중)

- [ ] Task 4: 위저드에서 `metadata`에 `taskMode`, `restartProjectId`, `restartSourceTaskId` 세팅
- [ ] Task 5: store `metadata`에 `restartSettings` 필드 분리 추가
- [ ] Task 6: import 로직(EditorPage) — `globalSettings`/`restartSettings` 분리 로드
- [ ] Task 7: 저장 로직(handleSave) — `settings`/`restartSettings` 분리 저장
- [ ] Task 8: SimulationPage — `metadata.taskMode`를 primary 소스로 전환, marsConfig fallback 제거
- [ ] Task 9: EditorPage isRestart 판별 — `metadata.taskMode` primary로 전환
- [ ] Task 10: 빌드 검증 + E2E 테스트

### Phase 3: UI (별도 Feature)

- [ ] RESTART Settings 편집 UI
- [ ] "오버라이드 추가" — settings에서 항목 선택 → restartSettings로 복사

---

## 8. 영향 범위

| 파일 | 변경 |
|------|------|
| `src/types/supabase.ts` | ✅ `restartSettings` 필드 추가 완료 |
| `src/utils/fileGenerator.ts` | ✅ 호환성 수정 완료 |
| `src/pages/ProjectPickerPage.tsx` | metadata에 restart 정보 세팅 |
| `src/stores/useStore.ts` | metadata에 `restartSettings` 필드 추가 |
| `src/pages/EditorPage.tsx` | import/저장 로직 분리, isRestart → metadata |
| `src/pages/SimulationPage.tsx` | taskMode/restartProjectId → metadata primary |

---

## 9. REF 기대 출력 vs 설계 매핑

```
= BOP Conceptual Input Model -restart file     ← 항상 출력 (프로젝트명)
1     90                                        ← restartSettings.card001
100   restart    transnt                        ← restartSettings.card100
101   run                                       ← restartSettings.card101
102   si    si                                  ← restartSettings.card102
103   -1                                        ← restartSettings.card103
120  608010000  12.0  h2onew  BOP               ← restartSettings.systems[0]
121  988010000  8.5   h2onew  SEA               ← restartSettings.systems[1]
200  0                                          ← restartSettings.card200
201-204                                         ← restartSettings.timePhases[0..3]
301-326  (Minor Edits)                          ← restartSettings.minorEdits[...]
401-406  (Variable Trips)                       ← restartSettings.variableTrips[...]
20230000-20230203 (GT 300-302)                  ← restartSettings.generalTables[...]
.                                               ← 항상 출력 (종료 카드)
```
