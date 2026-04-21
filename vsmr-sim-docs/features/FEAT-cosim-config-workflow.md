---
title: "Co-Sim 설정 페이지 — 구현 계획"
status: planned
phase: 3
branch: feat/cosim
related_prs: []
last_updated: 2026-04-14
---

# Co-Sim 설정 페이지 — 구현 계획

> PRD: [FEAT-cosim-config.md](./FEAT-cosim-config.md)
> 설계: [FEAT-cosim-config-design.md](./FEAT-cosim-config-design.md)

## 구현 순서

의존 관계 기반으로 7단계로 분할. 각 단계는 독립 커밋 가능.

---

### Step 1. 타입 정의 (`cosim.ts` 리팩터링)

**파일**: `src/types/cosim.ts`

**작업**:
- 기존 타입 제거 (현재 미사용 상태)
- 새 타입 정의:
  - `PreciceDataName`, `MarsWriteVariable`, `PRECICE_TO_MARS_VARIABLE`
  - `CouplingComponentGroup`, `CouplingGroup`
  - `NmlModelConfig`, `NmlConfig`
  - `CouplingSchemeType`, `MappingType`, `XmlConfig`
  - `CoSimConfig` (최종)
  - `CoSimValidationResult`
  - `PRECICE_DATA_OPTIONS` 상수

**의존**: 없음 (첫 단계)
**검증**: `npm run build` 통과

---

### Step 2. Store 생성 (`coSimConfigStore`)

**파일**: `src/stores/coSimConfigStore.ts`

**작업**:
- Zustand store 생성
- State: `config`, `isDirty`
- Actions: `loadConfig`, `resetConfig`, coupling_ids 관련, 모델 설정, XML 설정
- `getValidation()` 파생 함수 (NML/XML 완료 여부 판정)
- Model 1 write_data_name 변경 시 → Model 2 자동 반전 로직
- write_data_name → write_variable 자동 도출 로직
- componentGroups ↔ rawCouplingIds 양방향 동기화

**의존**: Step 1 (타입)
**검증**: 단위 테스트 또는 `npm run build`

---

### Step 3. 파일 생성 유틸리티

**파일**:
- `src/utils/preciceXmlGenerator.ts`
- `src/utils/preciceMarsNmlGenerator.ts`

**작업**:
- `generatePreciceConfigXml()`: NmlConfig + XmlConfig + 모델명 → XML 문자열
  - log, data, mesh, participant, m2n, coupling-scheme 섹션 생성
  - implicit scheme일 때 고정 convergence 설정 포함
- `generatePreciceMarsNml()`: 참여자 정보 + NmlModelConfig + couplingIds → NML 문자열
  - Fortran namelist 포맷 (`&precice_config ... /`)
  - coupling_ids 줄바꿈 포맷 (6개씩)

**검증**: 샘플 파일(`documents/co-sim/`)과 출력 비교
- `precice-config.xml`과 동일 구조인지
- `precice_mars.nml` × 2 와 동일 구조인지

**의존**: Step 1 (타입)

---

### Step 4. CoSimPanel UI 컴포넌트

**파일**:
- `src/components/cosim/CoSimPanel.tsx` (메인)
- `src/components/cosim/CouplingIdsSection.tsx`
- `src/components/cosim/DataExchangeSection.tsx`
- `src/components/cosim/XmlConfigSection.tsx`

**작업**:

**CouplingIdsSection**:
- 컴포넌트 추가 UI (번호 입력 + 그룹 수 + 범위)
- 직접 입력 토글 (텍스트 영역)
- 양방향 동기화
- 합계 표시

**DataExchangeSection**:
- Model 1: write_data_name / read_data_name 드롭다운
- Model 2: 자동 반전 (읽기 전용 표시)
- write_variable 자동 표시 (읽기 전용)
- init_wdata 입력 필드 (모델별)

**XmlConfigSection**:
- NML 완료 여부에 따라 활성/비활성
- Coupling scheme 드롭다운
- max-time, time-window-size 숫자 입력
- Mapping 방식 드롭다운

**CoSimPanel**:
- 3개 섹션 조합
- 하단 상태 표시 (✅ 완료 / ⚠️ 미완료)
- MUI 컴포넌트 사용 (기존 디자인 시스템 준수)

**의존**: Step 1 (타입), Step 2 (store)
**검증**: 화면 렌더링 + 설정값 입력 동작

---

### Step 5. EditorPage 통합

**파일**: `src/pages/EditorPage.tsx`

**작업**:
- `activeView` 타입에 `'cosim'` 추가
- 사이드바 `editorSidebarItems`에 Co-Sim 항목 추가 (조건: `isMultiModel`)
- 우측 패널 렌더링 조건 추가:
  - `activeView === 'cosim'` → `<CoSimPanel />`
  - 기존 PropertyPanel/FullCodeView와 배타적
- 프로젝트 로드 시 `coSimConfigStore.loadConfig(projectData.coSimConfig)`
- 프로젝트 저장 시 `coSimConfigStore.config` → `projectData.coSimConfig`

**수정 파일 추가**:
- `src/stores/projectStore.ts`: 저장/로드 시 coSimConfig 필드 전달

**의존**: Step 4 (CoSimPanel)
**검증**: 에디터에서 Co-Sim 패널 열기/닫기, 설정 입력 후 저장/로드

---

### Step 6. 검증 Hook + SimulationPage 통합

**파일**:
- `src/hooks/useCoSimValidation.ts` (신규)
- `src/components/cosim/CoSimStatusBanner.tsx` (신규)
- `src/pages/SimulationPage.tsx` (수정)

**작업**:

**useCoSimValidation**:
- `isCoSimMode`: 모델 2개 이상
- `validation`: coSimConfigStore.getValidation()
- `canExecute`: 단일 모델이거나 Co-Sim 설정 완료
- `statusMessage`: 미완료 항목 설명

**CoSimStatusBanner**:
- 경고 배너 UI (MUI Alert)
- 미완료 항목 목록
- "설정으로 이동" 버튼 → EditorPage Co-Sim 패널

**SimulationPage**:
- 헤더 영역에 CoSimStatusBanner 조건부 렌더링
- 실행 버튼(Play, QuickRun)에 `canExecute` 조건 추가

**의존**: Step 2 (store), Step 5 (EditorPage 통합)
**검증**: Co-Sim 미설정 시 실행 차단 + 배너 표시

---

### Step 7. 실행 플로우 연동

**파일**: `src/hooks/useCoSimQuickRun.ts` (수정)

**작업**:
- 실행 시 `coSimConfigStore.config`에서 설정 읽기
- `generatePreciceConfigXml()` → XML 파일 생성
- `generatePreciceMarsNml()` × 2 → NML 파일 생성
- 생성된 파일을 `ProjectService.uploadProjectFile()` / `uploadModelFile()`로 업로드
- 기존 수동 업로드 플로우와 병행 (Co-Sim 설정 완료 시 자동 생성 우선)

**의존**: Step 3 (파일 생성), Step 6 (검증)
**검증**: 전체 E2E — 설정 입력 → 파일 생성 → 업로드 → 실행 시작

---

## 요약 의존 그래프

```
Step 1 (타입)
  ├→ Step 2 (Store)
  │     ├→ Step 4 (CoSimPanel UI)
  │     │     └→ Step 5 (EditorPage 통합)
  │     │           └→ Step 6 (검증 + SimulationPage)
  │     │                 └→ Step 7 (실행 연동)
  │     └→ Step 6
  └→ Step 3 (파일 생성)
        └→ Step 7
```

## 커밋 전략

| Step | 커밋 메시지 |
|------|------------|
| 1 | `feat(FEAT-cosim-config): define Co-Sim configuration types` |
| 2 | `feat(FEAT-cosim-config): add coSimConfigStore for settings state` |
| 3 | `feat(FEAT-cosim-config): add XML/NML file generators` |
| 4 | `feat(FEAT-cosim-config): implement CoSimPanel UI components` |
| 5 | `feat(FEAT-cosim-config): integrate CoSimPanel into EditorPage` |
| 6 | `feat(FEAT-cosim-config): add validation hook and SimulationPage banner` |
| 7 | `feat(FEAT-cosim-config): connect file generation to execution flow` |
