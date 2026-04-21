---
title: "FEAT: MARS RESTART Phase 2 — 에디터 연동 및 파일 생성"
status: done
phase: 4
branch: main
related_prs: [#63]
last_updated: 2026-04-03
---

# FEAT: MARS RESTART Phase 2 — 에디터 연동 및 파일 생성

> **Parent**: [FEAT-mars-restart.md](FEAT-mars-restart.md) (Phase 1: 프로젝트 생성 위저드)
> **Status**: ⏳ 요구사항 정의
> **Created**: 2026-03-17
> **Branch**: TBD

---

## 1. 배경 및 목적

Phase 1에서 프로젝트 생성 위저드의 NEW/RESTART 선택, RestartSourceSelector, 소스 모델 복사가 구현되었다.

Phase 2에서는 **RESTART 모델이 에디터에서 올바르게 편집·검증·export 되도록** 나머지 기능을 완성한다.

### Phase 1 → Phase 2 연결점

| Phase 1 (완료) | Phase 2 (본 문서) |
|---------------|------------------|
| 위저드에서 problemType 선택 | 에디터에서 problemType에 따른 UI 제한 |
| RestartSource 메타데이터 저장 | fileGenerator에서 Card 103 출력 |
| 소스 모델 nodes/edges 복사 | Validation에서 restart 모드 고려 |
| Card 100 UI (ProjectSetupTab) | Card 110/115/120-129 비활성화 |

---

## 2. MARS 매뉴얼 근거

### 2.1 Card 103 — Restart Input File Control (섹션 2.9)

> "This card is required for all problem types (W1 of card 100) except type NEW and is not allowed for type NEW."

| 필드 | 타입 | 설명 |
|------|------|------|
| W1(I) | 정수 | Restart 번호. RSTPLT 내 restart block 번호. `-1` = 마지막 블록 |
| W2-6(A) | 문자열 | RSTPLT 파일명 (선택적, 최대 40자). 기본값: `rstplt` |

### 2.2 Card 104 — Restart-Plot File Control (섹션 2.10)

> "This card can be entered for NEW, RESTART, and STRIP options."

| 필드 | 타입 | 설명 |
|------|------|------|
| W1(A) | 문자열 | `NONE` = rstplt 미생성, `FILENAME` = W2-6에 파일명 |
| W2-6(A) | 문자열 | 출력 rstplt 파일명 (NEW에서만 입력, RESTART에서는 Card 103에 입력) |

### 2.3 RESTART 시 변경 불가 카드

| 카드 | 이름 | 매뉴얼 근거 |
|------|------|------------|
| Card 110 | Noncondensable Gas Species | "This card cannot be entered on a RESTART problem" |
| Card 115 | Noncondensable Gas Mass Fractions | "This card cannot be entered on a RESTART problem" |
| Card 120-129 | Hydrodynamic System Control | "These cards should not be entered in a RESTART problem" |

### 2.4 RESTART 시 컴포넌트 카드 재입력 규칙 (섹션 8 서두)

> "These cards may be entered for RESTART problems. In a RESTART problem, the hydrodynamic systems may be modified by **deleting, adding, or replacing** components."

매뉴얼상 모든 컴포넌트 카드가 RESTART에서 재입력 **가능**하지만, 재입력하지 않으면 rstplt 파일의 값이 유지된다. 실제 RESTART 운용에서는 **컴포넌트 토폴로지를 변경하지 않는 것이 일반적**이며, 변경사항은 Global Settings 영역(Trips, Tables, Time Steps 등)에 한정된다.

**설계 결정 (B-1)**: RESTART `.i` 파일에서 **컴포넌트 카드를 전부 생략**한다.
- 근거: 실제 RESTART 입력 파일 샘플(`100-50-100%_TR_ICV.i`)에 컴포넌트 카드가 없음
- rstplt 파일은 사용자가 직접 수정할 수 없으므로 컴포넌트 데이터는 변경되지 않음
- 에디터 캔버스(ReactFlow)를 **읽기 전용**으로 처리하여 일관성 보장

### 2.5 RESTART 시 변경 가능 항목 (Global Settings 영역)

- Trips (Variable/Logical) — 추가/삭제/교체 가능
- Control Systems — 추가/삭제/교체 가능
- Time Step Cards (Card 200, 201-299) — 재입력 시 원래 시리즈 대체
- General Tables — 추가/삭제/수정 가능
- Minor/Major Edits — 추가/교체 가능
- Interactive Input (Card 801-999) — 추가/교체 가능
- Card 001 (Development Model) — 옵션 활성화/비활성화 가능
- Card 101 (Run Option), Card 102 (Units) — 재입력 가능

### 2.6 RESTART 시 변경 불가 항목

| 항목 | 매뉴얼 근거 |
|------|------------|
| Card 110 (Noncondensable Gas Species) | "This card **cannot** be entered on a RESTART problem" |
| Card 115 (Noncondensable Gas Mass Fractions) | "This card **cannot** be entered on a RESTART problem" |
| Card 120-129 (Hydrodynamic System Control) | "These cards **should not** be entered in a RESTART problem" |
| 컴포넌트 토폴로지 (노드/엣지 추가·삭제·연결) | 설계 결정 B-1: rstplt 종속, 캔버스 읽기 전용 |

### 2.7 Problem Option 전환 시 주의사항

> STDY-ST ↔ TRANSNT 전환 시:
> - advancement time이 0으로 리셋됨
> - trips, control systems, general tables, TMDP 테이블 등 시간 의존 항목 재입력 필요
> - delay component의 history table이 수정됨

---

## 3. 기능 요구사항

### FR-RST-01: Card 103 파일 생성

**설명**: `fileGenerator.ts`에서 `problemType === 'restart'`일 때 Card 103을 자동 생성한다.

**입력 데이터 소스**:
- `globalSettings.card100.problemType` → restart 여부 판단
- `model.settings.marsConfig.restartSource` → restart 번호, 파일명

**출력 형식**:
```
* Card 103 : Restart Input File Control
103   -1        rstplt
```

**규칙**:
- `problemType === 'new'` → Card 103 출력 금지
- `problemType === 'restart'` → Card 103 필수 출력
- `restartNumber`가 없으면 기본값 `-1` (마지막 블록)
- `rstpltPath`에서 파일명 추출하거나 기본값 `rstplt` 사용
- Card 103은 Card 102 다음, Card 104 이전에 출력

**수용 기준**:
- [ ] restart 모드에서 `.i` export 시 Card 103이 올바른 위치에 포함됨
- [ ] new 모드에서는 Card 103이 출력되지 않음
- [ ] restart 번호 `-1`이 기본값으로 동작함

---

### FR-RST-02: Card 110/115 RESTART 모드 비활성화

**설명**: `problemType === 'restart'`일 때 ProjectSetupTab의 Card 110/115 편집 영역을 비활성화한다.

**UI 동작**:
- Card 110 (Noncondensable Gas Species) 필드: `disabled` 상태
- Card 115 (Noncondensable Gas Mass Fractions) 필드: `disabled` 상태
- 비활성화 영역에 안내 메시지 표시: "RESTART 모드에서는 비응축가스 설정을 변경할 수 없습니다. (MARS 매뉴얼 Card 110/115)"

**규칙**:
- 비활성화 시 기존 값은 그대로 표시 (읽기 전용)
- 에디터에서 `problemType` 전환 금지 (Q3 결정) → 모드 전환 시나리오 없음
- Problem Type Select도 `disabled` 처리

**수용 기준**:
- [ ] restart 모드에서 Card 110/115 필드가 disabled 상태
- [ ] 안내 메시지(Alert 또는 Banner)가 표시됨
- [ ] Problem Type Select가 disabled 상태 (에디터에서 전환 불가)

---

### FR-RST-03: Card 120-129 RESTART 모드 비활성화

**설명**: `problemType === 'restart'`일 때 SystemConfigTab의 시스템 추가/편집/삭제를 비활성화한다.

**UI 동작**:
- "Add System" 버튼: `disabled`
- 기존 시스템 목록: 읽기 전용 (편집/삭제 버튼 숨김 또는 disabled)
- 안내 메시지: "RESTART 모드에서는 수력학적 시스템 설정을 변경할 수 없습니다. (MARS 매뉴얼 Card 120-129)"

**규칙**:
- 시스템 목록은 표시하되 수정 불가
- referenceVolume, referenceElevation, fluid, systemName 모두 읽기 전용

**수용 기준**:
- [ ] restart 모드에서 시스템 추가/편집/삭제 불가
- [ ] 기존 시스템 정보는 읽기 전용으로 표시
- [ ] Problem Type Select가 disabled 상태 (에디터에서 전환 불가, Q3 결정)

---

### FR-RST-04: Card 110/115/120-129 파일 생성 억제

**설명**: `problemType === 'restart'`일 때 `fileGenerator.ts`에서 Card 110, 115, 120-129를 출력하지 않는다.

**규칙**:
- restart 모드: Card 110, 115, 120-129 출력 생략
- new 모드: 기존 로직 유지 (정상 출력)

**수용 기준**:
- [ ] restart `.i` 파일에 Card 110/115/120-129가 포함되지 않음
- [ ] new `.i` 파일에는 정상적으로 포함됨

---

### FR-RST-05: Validation 로직 restart 모드 대응

**설명**: `globalSettingsValidation.ts`에서 restart 모드일 때 validation 규칙을 조정한다.

**변경 사항**:

| 기존 Validation | restart 모드 동작 |
|----------------|------------------|
| Card 120-129: referenceVolume 필수 | skip (이전 run에서 상속) |
| Card 110: 가스 종류 필수 | skip |
| Card 115: 질량분율 합 = 1.0 | skip |
| Card 103: 없음 | restartNumber 유효성 검증 추가 |

**신규 Validation**:
- restart 모드 + Card 103 미설정 → error: "RESTART 모드에서는 restart 소스 정보가 필요합니다"
- restartNumber가 -1 미만 또는 0인 경우 → warning (0은 STRIP 전용)

**수용 기준**:
- [ ] restart 모드에서 referenceVolume 관련 에러가 발생하지 않음
- [ ] restart 모드에서 Card 110/115 관련 에러가 발생하지 않음
- [ ] restart 소스 미설정 시 에러 표시

---

### FR-RST-08: RESTART 모드 캔버스 읽기 전용 (ReactFlow)

**설명**: `problemType === 'restart'`일 때 ReactFlow 캔버스를 완전한 읽기 전용으로 전환한다. 컴포넌트 토폴로지는 rstplt 파일에 종속되므로 에디터에서 변경할 수 없다.

**차단 동작**:

| 동작 | 차단 방법 |
|------|----------|
| 노드 드래그 이동 | `nodesDraggable={false}` |
| 노드 추가 (팔레트 드롭) | `onDrop` 핸들러에서 restart 시 무시 |
| 노드 삭제 (Delete 키) | `onNodesDelete` 무시 |
| 엣지 연결 (핸들 드래그) | `nodesConnectable={false}` |
| 엣지 삭제 | `onEdgesDelete` 무시 |

**허용 동작**:

| 동작 | 이유 |
|------|------|
| 캔버스 팬/줌 | 모델 구조 확인용 |
| 노드 클릭 → PropertyPanel | 파라미터 확인용 (읽기 전용 표시) |
| Global Settings 편집 | Trips, Tables, Time Steps 등 변경 가능 |

**UI 표시**:
- 캔버스 상단에 배너: "RESTART 모드 — 캔버스 읽기 전용 (컴포넌트 토폴로지는 리소스 프로젝트에서 상속됨)"
- 노드 팔레트(사이드바): disabled 또는 숨김

**수용 기준**:
- [ ] 노드 드래그 불가
- [ ] 팔레트에서 노드 드롭 불가
- [ ] Delete 키로 노드/엣지 삭제 불가
- [ ] 핸들 드래그로 새 엣지 연결 불가
- [ ] 팬/줌은 정상 동작
- [ ] NEW 프로젝트에서는 모든 동작 정상 (regression)

---

### FR-RST-09: RESTART 모드 컴포넌트 카드 파일 생성 생략

**설명**: `problemType === 'restart'`일 때 `fileGenerator.ts`에서 컴포넌트 카드(Section 8: Hydrodynamic, Section 9: Heat Structure)를 출력하지 않는다.

**근거**: RESTART `.i` 파일은 변경사항만 포함한다. 컴포넌트 데이터는 rstplt 파일에서 로드되며, 사용자가 rstplt를 직접 수정할 수 없으므로 컴포넌트 카드 재출력이 불필요하다.

**생략 대상**:
- 모든 Hydrodynamic 컴포넌트 카드 (SNGLVOL, TMDPVOL, SNGLJUN, TMDPJUN, PIPE, BRANCH, PUMP, VALVE, TURBINE, MTPLJUN, ACCUM 등)
- Heat Structure 카드

**유지 대상** (Global Settings):
- Card 100-103 (Problem Type, Run Option, Units, Restart Control)
- Card 200-299 (Time Step Control)
- Card 301-399 (Minor Edits)
- Card 401-799 (Trips)
- Card 801-999 (Interactive Input)
- Card 20200000+ (Control Variables)
- Card 20230000+ (General Tables)

**수용 기준**:
- [ ] RESTART `.i` 파일에 컴포넌트 카드(CCC0000~CCC9999)가 포함되지 않음
- [ ] RESTART `.i` 파일에 Heat Structure 카드가 포함되지 않음
- [ ] Global Settings 카드(Trips, Tables, Time Steps 등)는 정상 출력됨
- [ ] NEW `.i` 파일에는 모든 카드가 정상 출력됨 (regression)

---

### FR-RST-10: RESTART 모드 PropertyPanel 읽기 전용

**설명**: RESTART 모드에서 노드를 클릭하면 PropertyPanel이 열리지만, 모든 입력 필드가 disabled 상태로 표시된다.

**UI 동작**:
- PropertyPanel 상단에 안내 메시지: "RESTART 모드 — 읽기 전용"
- 모든 입력 필드, 버튼, 토글: `disabled`
- 값은 그대로 표시 (리소스 프로젝트에서 복사된 데이터 확인용)

**수용 기준**:
- [ ] RESTART 프로젝트에서 노드 클릭 시 PropertyPanel이 읽기 전용으로 표시됨
- [ ] NEW 프로젝트에서는 PropertyPanel이 정상 편집 가능 (regression)

---

### FR-RST-06: JSON Import 시 restart 설정 보존

**설명**: 컨버터로 생성된 JSON 파일(예: `100-50-100%_TR_ICV.json`)을 import할 때 restart 관련 설정이 올바르게 처리된다.

**규칙**:
- `card100.problemType === 'restart'`이면 해당 프로젝트를 restart 모드로 인식
- import 시 Card 110/115/120-129 validation 에러를 표시하지 않음
- `nodes: []`, `edges: []`인 restart 파일도 유효하게 처리 (노드 없는 restart 모델)
- import된 restart 파일에서 restartSource가 없으면 → UI에서 설정 유도

**수용 기준**:
- [ ] 컨버터 생성 restart JSON 파일이 에러 없이 import됨
- [ ] import 후 에디터에서 restart 모드 UI 제한이 적용됨
- [ ] 토스트 메시지에 referenceVolume 관련 에러가 표시되지 않음

---

### FR-RST-07: problemType 대소문자 통일

**설명**: 현재 두 곳에서 다른 케이스를 사용하고 있어 통일이 필요하다.

| 위치 | 현재 | 용도 |
|------|------|------|
| `mars.ts` Card100 | `'new' \| 'restart'` (소문자) | 에디터 내부, JSON, fileGenerator |
| `supabase.ts` MARSConfig | `'NEW' \| 'RESTART'` (대문자) | 프로젝트 생성 위저드 |

**규칙**:
- 내부 저장/편집: 소문자 (`'new' | 'restart'`) — mars.ts 기준 유지
- MARS `.i` 파일 출력: 소문자 (MARS 코드가 대소문자 무관하게 처리)
- 위저드 → 에디터 전환 시: 대문자 → 소문자 변환 레이어 필요
- 또는 하나로 통일 (권장: 소문자, mars.ts 기준)

**수용 기준**:
- [ ] 위저드에서 RESTART 선택 후 에디터 진입 시 `card100.problemType`이 올바르게 설정됨
- [ ] 대소문자 불일치로 인한 런타임 에러 없음

---

## 4. 비기능 요구사항

### NFR-RST-01: 하위 호환성

- 기존 NEW 모드 프로젝트에 영향 없음
- `card100`이 없는 기존 JSON 파일은 `problemType: 'new'`로 기본 처리
- `marsConfig`가 없는 프로젝트는 NEW로 간주

### NFR-RST-02: 성능

- restart 모드 판별은 동기 연산 (store에서 즉시 조회)
- UI disabled 처리는 렌더링 시 props로 전달 (추가 네트워크 호출 없음)

### NFR-RST-03: 에러 처리

- MinIO 접근 불가 시 restartSource 설정 불가 → 에러 메시지 표시
- RSTPLT 파일 미존재 시 → warning 표시 (시뮬레이션 단계에서 최종 검증)

---

## 5. 영향 분석

### 수정 대상 파일

| 파일 | 변경 내용 | 우선순위 | 상태 |
|------|----------|---------|------|
| `src/utils/fileGenerator.ts` | Card 103 생성, Card 110/115/120-129 조건부 생략 | P0 | ✅ 완료 |
| `src/utils/globalSettingsValidation.ts` | restart 모드 validation skip + Card 103 검증 | P0 | ✅ 완료 |
| `src/components/globalSettings/ProjectSetupTab.tsx` | Card 110/115 disabled, Problem Type disabled | P1 | ✅ 완료 |
| `src/components/globalSettings/SystemConfigTab.tsx` | Card 120-129 disabled 처리 | P1 | ✅ 완료 |
| `src/components/GlobalSettingsDialog.tsx` | isRestart prop 전달 | P1 | ✅ 완료 |
| `src/types/mars.ts` | Card103 타입 추가 | P1 | ✅ 완료 |
| `src/pages/ProjectPickerPage.tsx` | 위저드 → card100/card103 소문자 동기화 | P1 | ✅ 완료 |
| `src/utils/fileGenerator.ts` | RESTART 시 컴포넌트 카드 전체 생략 (FR-RST-09) | P0 | ⏳ |
| `src/components/FlowCanvas.tsx` | RESTART 캔버스 읽기 전용 (FR-RST-08) | P0 | ⏳ |
| `src/components/PropertyPanel.tsx` (또는 해당 폼) | RESTART PropertyPanel 읽기 전용 (FR-RST-10) | P1 | ⏳ |

### 수정하지 않는 파일

| 파일 | 이유 |
|------|------|
| `RestartSourceSelector.tsx` | Phase 1 완료, 변경 불필요 |
| `MarsPartitionConfig.tsx` | Phase 1 완료, 변경 불필요 |
| `NewProjectWizard/index.tsx` | Phase 1 완료, 변경 불필요 |

---

## 6. 데이터 흐름

### 6.1 Restart 모드 판별 흐름

```
에디터 로드
  │
  globalSettings.card100.problemType
  │
  ├─ 'new' → 기본 동작 (모든 필드 활성, 캔버스 편집 가능)
  │
  └─ 'restart'
       │
       ├─ FlowCanvas → 읽기 전용 (드래그/연결/삭제/드롭 차단)
       ├─ PropertyPanel → 읽기 전용 (모든 폼 필드 disabled)
       ├─ ProjectSetupTab → Card 110/115 disabled, Problem Type disabled
       ├─ SystemConfigTab → Card 120-129 disabled
       ├─ globalSettingsValidation → skip Card 110/115/120-129 검증
       └─ fileGenerator
            ├─ Card 103 출력
            ├─ Card 110/115/120-129 생략
            └─ 컴포넌트 카드 전체 생략 (rstplt에서 로드)
```

### 6.2 Card 103 데이터 소스 흐름

```
프로젝트 생성 위저드
  │
  MARSConfig.restartSource
  │
  model.settings.marsConfig 에 저장 (Supabase)
  │
  에디터 로드 시 → globalSettings에 restartSource 반영
  │
  fileGenerator
  │
  Card 103: restartNumber + rstplt 파일명
```

### 6.3 JSON Import 흐름 (컨버터 파일)

```
컨버터 생성 JSON
  │
  card100.problemType === 'restart'
  │
  import 처리
  │
  ├─ validation: restart 모드 → Card 110/115/120-129 skip
  ├─ UI: disabled 처리 적용
  └─ restartSource 없음 → 사용자에게 설정 안내
```

---

## 7. 작업 순서 및 검증 계획

> 각 단계 구현 후 **검증 항목을 통과한 뒤** 다음 단계로 진행한다.
> 검증 실패 시 해당 단계에서 수정 완료 후 재검증.

### Phase 2-A: 핵심 로직 (P0)

#### Step 1. FR-RST-07 — problemType 대소문자 통일

**구현**: `ProjectPickerPage.tsx`에서 위저드 → `model.settings`에 `card100`, `card103` 소문자 동기화

**검증**:
- [ ] 위저드에서 RESTART 프로젝트 생성
- [ ] 생성 직후 Supabase에서 해당 프로젝트의 `data.models[0].settings` 확인
- [ ] `settings.card100.problemType === 'restart'` (소문자) 확인
- [ ] `settings.card103.restartNumber === -1` 확인
- [ ] 기존 NEW 프로젝트 생성이 정상 동작하는지 확인

---

#### Step 2. FR-RST-05 — Validation 로직 restart 모드 대응

**구현**: `globalSettingsValidation.ts`, `projectFileHelpers.ts`에서 restart 시 Card 110/115/120-129 validation skip

**검증**:
- [ ] RESTART 프로젝트를 에디터에서 열기
- [ ] Global Settings 다이얼로그 열기 → Validation 에러 토스트에 `referenceVolume` 관련 에러 **없음** 확인
- [ ] Card 110/115 관련 에러 **없음** 확인
- [ ] NEW 프로젝트에서는 기존과 동일하게 validation 에러가 표시되는지 확인 (regression 체크)

---

#### Step 3. FR-RST-04 — fileGenerator Card 110/115/120-129 생략

**구현**: `fileGenerator.ts`에서 `isRestart` 분기 → Card 110, 115, 120-129 출력 생략

**검증**:
- [ ] RESTART 프로젝트에서 `.i` 파일 Export (또는 Preview)
- [ ] 출력 파일에 `Card 110` 줄 **없음** 확인
- [ ] 출력 파일에 `Card 115` 줄 **없음** 확인
- [ ] 출력 파일에 `Card 120-129` (SYSTEM CONFIGURATION) 섹션 **없음** 확인
- [ ] NEW 프로젝트에서 `.i` Export → Card 110/115/120-129 **정상 출력** 확인 (regression)

---

#### Step 4. FR-RST-01 — fileGenerator Card 103 생성

**구현**: `fileGenerator.ts`에서 `isRestart` 시 Card 103 출력, `mars.ts`에 `Card103` 타입 추가

**검증**:
- [ ] RESTART 프로젝트에서 `.i` 파일 Export
- [ ] 출력 파일에서 Card 102 다음에 `* Card 103 : Restart Input File Control` 주석 확인
- [ ] `103   -1        rstplt` 형태의 카드 확인
- [ ] Card 103이 Card 104 **이전**에 위치하는지 확인
- [ ] NEW 프로젝트에서는 Card 103 **없음** 확인 (regression)

---

### Phase 2-B: UI 제한 (P1)

#### Step 5. FR-RST-02 — ProjectSetupTab Card 110/115 + Problem Type disabled

**구현**: `ProjectSetupTab.tsx`에서 Problem Type Select `disabled`, Card 110/115 영역 disabled + 안내 메시지

**검증**:
- [ ] RESTART 프로젝트 → Global Settings → Project Setup 탭 열기
- [ ] Problem Type Select가 `disabled`이고 "RESTART" 표시 확인
- [ ] Calculation Type Select는 **활성** 상태 (STDY-ST ↔ TRANSNT 전환 가능)
- [ ] Card 110 체크박스들이 전부 `disabled` 확인
- [ ] Card 115 fraction 입력 필드들이 전부 `disabled` 확인
- [ ] "RESTART 모드에서는 비응축가스 설정을 변경할 수 없습니다" 안내 메시지 표시 확인
- [ ] Normalize 링크 **숨김** 확인
- [ ] NEW 프로젝트에서는 모든 필드 **활성** 확인 (regression)

---

#### Step 6. FR-RST-03 — SystemConfigTab Card 120-129 disabled

**구현**: `SystemConfigTab.tsx`에 `isRestart` prop, `GlobalSettingsDialog.tsx`에서 전달

**검증**:
- [ ] RESTART 프로젝트 → Global Settings → System Configuration 탭 열기
- [ ] "Add System" 버튼이 `disabled` 확인
- [ ] 기존 시스템 목록의 Edit/Delete 아이콘 버튼이 `disabled` 확인
- [ ] 시스템 정보(System #, Card #, Reference Volume 등)는 읽기 전용으로 **표시** 확인
- [ ] "RESTART 모드에서는 수력학적 시스템 설정을 변경할 수 없습니다" 안내 메시지 표시 확인
- [ ] NEW 프로젝트에서는 Add/Edit/Delete 모두 **활성** 확인 (regression)

---

### Phase 2-C: 캔버스 읽기 전용 + 컴포넌트 생략 (P0)

#### Step 8. FR-RST-09 — fileGenerator 컴포넌트 카드 생략

**구현**: `fileGenerator.ts`에서 `isRestart` 시 컴포넌트 카드(Hydrodynamic + Heat Structure) 생성 전체 skip

**검증**:
- [ ] RESTART 프로젝트에서 `.i` 파일 Export
- [ ] 컴포넌트 카드(CCC0000~CCC9999) **없음** 확인
- [ ] Heat Structure 카드 **없음** 확인
- [ ] Global Settings 카드(Card 200-299, 301-399, 401-799 등) **정상 출력** 확인
- [ ] NEW 프로젝트에서는 모든 카드 정상 출력 (regression)

---

#### Step 9. FR-RST-08 — ReactFlow 캔버스 읽기 전용

**구현**: `FlowCanvas.tsx`에서 `isRestart` 판별 → `nodesDraggable`, `nodesConnectable` 등 제한, `onDrop`/`onNodesDelete`/`onEdgesDelete` 차단

**검증**:
- [ ] RESTART 프로젝트에서 노드 드래그 **불가** 확인
- [ ] 팔레트에서 캔버스로 드롭 **불가** 확인
- [ ] Delete 키로 노드/엣지 삭제 **불가** 확인
- [ ] 핸들 드래그로 엣지 연결 **불가** 확인
- [ ] 팬/줌은 **정상** 동작 확인
- [ ] 캔버스 상단에 "RESTART 읽기 전용" 배너 표시 확인
- [ ] NEW 프로젝트에서는 모든 동작 정상 (regression)

---

#### Step 10. FR-RST-10 — PropertyPanel 읽기 전용

**구현**: PropertyPanel에서 `isRestart` 시 모든 폼 필드 disabled + 안내 메시지

**검증**:
- [ ] RESTART 프로젝트에서 노드 클릭 → PropertyPanel 열림
- [ ] 모든 입력 필드가 disabled 상태
- [ ] "RESTART 모드 — 읽기 전용" 안내 메시지 표시
- [ ] NEW 프로젝트에서는 정상 편집 가능 (regression)

---

### Phase 2-D: Import 개선 (P1)

#### Step 11. FR-RST-06 — JSON import restart 처리 개선

**구현**: import 시 `card100.problemType === 'restart'` 감지 → validation skip, UI 제한 적용

**검증**:
- [ ] 컨버터 생성 restart JSON 파일 (예: `100-50-100%_TR_ICV.json`) import
- [ ] import 후 에러 토스트에 referenceVolume 관련 에러 **없음** 확인
- [ ] 에디터에서 restart 모드 UI 제한(Card 110/115 disabled, System disabled)이 적용되는지 확인
- [ ] `nodes: []`인 restart JSON 파일도 에러 없이 import 되는지 확인
- [ ] NEW 모드 JSON import는 기존과 동일하게 동작 확인 (regression)

---

## 8. Open Questions

| # | 질문 | 영향 | 결정 상태 |
|---|------|------|----------|
| Q1 | restart 모드에서 `nodes: []`인 경우, 노드 없이도 프로젝트가 유효한가? | FR-RST-06 | 미결 |
| Q2 | 컨버터로 생성된 restart JSON에 `restartSource`가 없을 때, Card 103의 restartNumber와 파일명을 어디서 가져올 것인가? | FR-RST-01 | 미결 |
| Q3 | `problemType`을 에디터에서 `new` ↔ `restart` 전환하는 것을 허용할 것인가? | FR-RST-02, FR-RST-03 | **결정: 전환 금지** — Problem Type Select `disabled` 처리 |
| Q4 | MinIO RSTPLT 파일 경로가 에디터 단계에서도 접근 가능한가? | FR-RST-01 | 미결 |
| Q5 | Card 103 타입을 `mars.ts`의 GlobalSettings에 추가할 것인가? | FR-RST-01 | **결정: GlobalSettings에 추가** — `card103?: Card103` 필드로 구현 완료 |
| Q6 | RESTART `.i` 파일에서 컴포넌트 카드를 어떻게 처리할 것인가? | FR-RST-09 | **결정: B-1 (전부 생략)** — 컴포넌트 토폴로지는 rstplt에서 로드. 사용자가 rstplt를 직접 수정할 수 없으므로 컴포넌트 데이터 불변. 캔버스 읽기 전용으로 일관성 보장. |
| Q7 | RESTART 모드에서 ReactFlow 캔버스를 어느 수준까지 제한할 것인가? | FR-RST-08 | **결정: 완전한 읽기 전용** — 드래그/연결/삭제/드롭 모두 차단. 팬/줌만 허용. |

---

## 9. 참고 자료

- [FEAT-mars-restart.md](FEAT-mars-restart.md) — Phase 1 문서
- [MARS-KS Manual Vol.II](../reference/MARS-KS%20Code%20Manual%2C%20Volume%20II-Input%20Requirement%20(2022.2)_내부결재용.pdf) — 섹션 2.6 (Card 100), 2.9 (Card 103), 2.10 (Card 104), 2.12 (Card 110), 2.13 (Card 115), 2.16 (Card 120-129)
- [100-50-100%_TR_ICV.json](../100-50-100%_TR_ICV.json) — 컨버터 생성 restart JSON 샘플
- [100-50-100%_TR_ICV.i](../100-50-100%_TR_ICV.i) — 실제 RESTART 입력 파일 샘플 (컴포넌트 카드 없음, Global Settings만 포함)
