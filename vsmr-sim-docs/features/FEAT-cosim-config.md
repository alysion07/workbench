---
title: "Co-Simulation 설정 페이지"
status: planned
phase: 3
branch: feat/cosim
related_prs: []
last_updated: 2026-04-14
---

# PRD: Co-Simulation (preCICE) 설정 페이지

## 1. 개요

### 1.1 목적
MARS 다중 모델 Co-Simulation을 위한 preCICE 설정을 GUI로 구성하는 기능.
사용자가 XML/NML 파일을 직접 작성하지 않고, 설정값을 입력하면 `precice-config.xml`(1개)과 `precice_mars.nml`(모델당 1개, 총 2개)을 자동 생성하여 업로드한다.

### 1.2 배경
- 현재 상태: `QuickRunDialog`에서 XML/NML 파일을 수동 업로드하는 방식
- 문제: 사용자가 XML/NML 포맷을 직접 알아야 하며, 오류 가능성 높음
- 목표: GUI 기반 설정 → 파일 자동 생성 → 업로드 → 실행

### 1.3 Co-Sim 모드 판별
- **모델 수 기반 자동 판별**: 모델 1개 = 단일 해석, 모델 2개 = Co-Sim
- 별도의 활성화 토글/프로젝트 타입 구분 없음
- 모델 2개 이상일 때만 Co-Sim 관련 UI(CoSimPanel, 검증 게이트 등) 노출
- 현재 스코프: **2개 모델** 간 커플링 (고정)
- 추후 3개 이상 확장 가능하도록 타입 설계

---

## 2. 사용자 플로우

### 2.1 설정 구조

EditorPage 사이드바에 "Co-Sim" 항목 추가. 클릭 시 우측 패널이 **CoSimPanel**로 전환된다.
CoSimPanel은 **모델 탭에 무관하게 동일한 패널**을 표시하며, 한 곳에서 모든 Co-Sim 설정을 완결한다.

```
┌──────────┬──────────┬─────────────────┬───────────────────────┐
│          │Component │                 │ CoSimPanel (우측)      │
│ Sidebar  │Palette   │   FlowCanvas    │                       │
│          │          │                 │ [커플링 경계면]        │
│  canvas  │          │                 │  컴포넌트 + 셀 범위   │
│  cosim ← │          │                 │  직접 입력 (병행)     │
│  settings│          │                 │                       │
│  ...     │          │                 │ [Model 1] write_var ▼ │
│          │          │                 │ [Model 2] write_var ▼ │
│          │          │                 │                       │
│          │          │                 │ [프로젝트 설정] (XML)  │
│          │          │                 │  scheme / timing /    │
│          │          │                 │  mapping              │
└──────────┴──────────┴─────────────────┴───────────────────────┘
```

### 2.2 설정 의존 순서

```
NML 설정 (커플링 경계면 + 모델별 write_variable/init_wdata)
    │
    │  완료 시
    ▼
XML 설정 (프로젝트 레벨 — scheme, timing, mapping)
    │
    │  완료 시
    ▼
실행 가능 (검증 게이트 통과)
```

- NML 미완료 → XML 설정 섹션 비활성
- XML 미완료 → 모든 실행 경로 차단 (EditorPage, SimulationPage 포함)

### 2.3 NML 자동 도출 관계

한쪽 모델의 설정에서 상대 모델의 NML 대부분이 자동 도출된다:

| 항목 | 자동 도출 | 모델별 입력 필요 |
|------|-----------|-----------------|
| coupling_ids | 양쪽 동일 (1회 설정) | |
| participant, mesh_name | 모델명에서 자동 | |
| read_data / write_data | 교차 도출 (한쪽 write = 상대 read) | |
| write_variable | | ✅ 모델별 선택 |
| init_wdata | | ✅ 모델별 입력 (선택) |

---

## 3. 기능 요구사항

### FR-1. NML 설정 (CoSimPanel 상단)

#### FR-1.1 CoSimPanel 위치 및 동작
- EditorPage 우측 패널 영역 (PropertyPanel과 **배타적 렌더링**)
- 사이드바 "Co-Sim" 클릭 시 활성화
- **모델 탭 전환과 무관하게 동일한 패널** 표시 (프로젝트 레벨 설정)
- **모델이 2개 이상일 때만** 사이드바에 "Co-Sim" 항목 노출 (단일 모델 시 숨김)

#### FR-1.2 커플링 컴포넌트 선택 (coupling_ids)

> **⚠️ coupling_ids 포맷**: preCICE-MARS 어댑터 자체의 넘버링 체계이며,
> MARS 카드 번호(`CCCXXNN`, `1CCCGXNN`)와 직접 대응하지 않음.
> 정확한 포맷 규칙은 **어댑터 담당자 확인 후 확정** 필요.

두 가지 입력 방법을 제공한다:

**방법 A — 컴포넌트 + 그룹 + 범위 지정 (GUI)**

샘플에서 관찰된 coupling_ids 패턴: `{CCC}{G}{NNN}`
- `CCC` (3자리): 컴포넌트 번호
- `G` (1자리): 그룹 번호 — 하나의 컴포넌트를 몇 개 그룹으로 분할할지
- `NNN` (3자리): 범위 — 해당 그룹 내 노드/셀 번호

UI:
- 컴포넌트 번호 입력/선택
- 그룹 수 설정 (기본 1)
- 그룹별 범위(시작~끝) 지정
- 복수 컴포넌트 추가 가능
- ID 자동 생성 및 미리보기

```
┌ 컴포넌트 310 ────────────────────────┐
│  그룹 수: [1 ▼]                       │
│  그룹 1: 범위 [001] ~ [012]           │
│  → 12개 ID: 3101001 ~ 3101012        │
└──────────────────────────────────────┘

┌ 컴포넌트 330 ────────────────────────┐
│  그룹 수: [1 ▼]                       │
│  그룹 1: 범위 [001] ~ [012]           │
│  → 12개 ID: 3301001 ~ 3301012        │
└──────────────────────────────────────┘

합계: 48개 coupling IDs
```

그룹이 여러 개인 경우:
```
┌ 컴포넌트 310 ────────────────────────┐
│  그룹 수: [2 ▼]                       │
│  그룹 1: 범위 [001] ~ [006]           │
│  그룹 2: 범위 [001] ~ [006]           │
│  → 12개 ID: 3101001~006, 3102001~006 │
└──────────────────────────────────────┘
```

**방법 B — 직접 입력 (병행)**
- 텍스트 영역에 coupling_ids를 쉼표 또는 줄바꿈으로 입력/붙여넣기
- 기존 NML 파일에서 복사/붙여넣기 지원

**양방향 동기화**: 방법 A/B 간 실시간 동기화.

- `n_coupling`은 coupling_ids 개수에서 자동 계산
- **양쪽 모델의 coupling_ids는 동일** → 1회 설정으로 양쪽 NML에 적용

#### FR-1.3 데이터 교환 설정 (write/read_data_name)
- **Model 1에서만 드롭다운 선택**, Model 2는 자동 반전 설정
- 드롭다운 목록:
  - `T_WALL` — 온도
  - `Q_WALL` — 열유속

| | Model 1 (사용자 선택) | Model 2 (자동 설정) |
|--|--|--|
| write_data_name | `Q_WALL` | `T_WALL` |
| read_data_name | `T_WALL` | `Q_WALL` |

- `write_variable`은 `write_data_name`에서 **자동 도출** (하드코딩 매핑):
  - `T_WALL` → `httmp`
  - `Q_WALL` → `htrnro`
- 사용자에게는 write_variable을 읽기 전용으로 표시 (참고용)

#### FR-1.4 init_wdata 입력
- 선택적 숫자 입력 (Fortran double 형식, 예: `560.d0`)
- 비워두면 NML에서 해당 항목 생략
- 모델별로 독립 입력

#### FR-1.5 고정값 (사용자 입력 불필요)
- `participant`: 모델명에서 자동 도출
- `mesh_name`: `Mesh_{participantName}` 자동 생성
- `write_variable`: write_data_name에서 자동 도출 (FR-1.3)
- `config_path`: `/app/config/precice-config.xml` (고정)
- `use_dummy_coords`: `.true.` (고정, 추후 고급 옵션으로 노출 가능)

#### FR-1.6 양쪽 모델 컴포넌트 교차 검증
- CoSimPanel 렌더링 시 양쪽 모델의 Pipe/HeatStructure 컴포넌트 목록을 store에서 조회
- **동일 컴포넌트 번호가 양쪽 모델에 모두 존재하는 경우만 선택 가능**
- 한쪽에만 존재하는 컴포넌트는 비활성 + 이유 표시 (예: "Model 2에 컴포넌트 410이 없습니다")
- 직접 입력(방법 B)의 경우 입력 후 양쪽 모델 대조 검증, 미존재 시 경고

```
┌─ 커플링 가능 컴포넌트 ──────────────────────────┐
│                                                    │
│  번호    Model 1 (PRI)         Model 2 (SEC)      │
│  310    HeatStructure ✅       Pipe ✅     [선택]  │
│  330    HeatStructure ✅       Pipe ✅     [선택]  │
│  350    HeatStructure ✅       Pipe ✅     [선택]  │
│  370    HeatStructure ✅       Pipe ✅     [선택]  │
│  410    HeatStructure ✅       (없음) ❌   [불가]  │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

### FR-2. XML 설정 (CoSimPanel 하단, 프로젝트 레벨)

#### FR-2.1 활성화 조건
- NML 설정이 완료된 상태에서만 XML 설정 섹션 활성화
- 완료 조건: coupling_ids 1개 이상 + 양쪽 모델 write_variable 선택됨
- NML 미완료 시 비활성 + "커플링 설정을 먼저 완료해주세요" 안내

#### FR-2.2 자동 도출 항목 (사용자 입력 불필요)
| XML 요소 | 도출 소스 |
|-----------|-----------|
| `<data:scalar>` 정의 | 양쪽 모델의 write_variable에서 preCICE 데이터명 매핑 |
| `<mesh>` 정의 | participant당 1개 자동 생성, `use-data`는 전체 data 연결 |
| `<participant>` provide/receive-mesh | 참여자 구성에서 자동 |
| `<participant>` write-data/read-data | NML의 write/read 설정에서 도출 |
| `<participant>` mapping | 사용자 선택 방식 적용 |
| `<m2n:sockets>` | 첫 번째=acceptor, 두 번째=connector, 경로/네트워크 고정 |
| `<exchange>` 방향 | NML의 write→상대 read 관계에서 자동 도출 |
| `<log>` | 고정값 (severity > info) |

#### FR-2.3 사용자 입력 항목
| 항목 | UI | 기본값 | 비고 |
|------|-----|--------|------|
| Coupling scheme | 드롭다운 | `serial-explicit` | `serial-explicit`, `serial-implicit`, `parallel-explicit`, `parallel-implicit` |
| max-time | 숫자 입력 | `100` | 전체 시뮬레이션 시간 |
| time-window-size | 숫자 입력 | `1` | 커플링 교환 주기 |
| Mapping 방식 | 드롭다운 | `nearest-neighbor` | `nearest-neighbor`, `nearest-projection` |
| exchange initialize | 체크박스 | 두 번째 참여자의 데이터만 `true` | 초기값 교환 여부 |

#### FR-2.4 Implicit scheme 추가 설정
- `serial-implicit` 또는 `parallel-implicit` 선택 시에만 적용
- **고정 기본값으로 자동 적용** (GUI 노출하지 않음):
  - `max-iterations`: 100
  - convergence measure: relative, limit 1e-4

#### FR-2.5 고정값 (GUI 노출하지 않음)
- `<m2n>` exchange-directory: `/app/precice-exchange`
- `<m2n>` network: `eth0`
- `<log>` filter: `%Severity% > info`
- `<participant>` mapping constraint: `consistent`

---

### FR-3. 실행 시 검증 게이트

#### FR-3.1 검증 순서
1. 모델 2개 이상 여부 확인 (2개 이상 = Co-Sim 모드)
2. NML 설정 완료 여부
   - `coupling_ids` 1개 이상 존재
   - 양쪽 모델 `write_variable` 선택됨
   - coupling_ids의 컴포넌트 번호가 양쪽 모델에 모두 존재
3. XML 설정 완료 여부
   - `scheme` 선택됨
   - `max-time` > 0
   - `time-window-size` > 0

#### FR-3.2 미완료 시 동작
- 실행 버튼 비활성화 (또는 경고 모달)
- 어떤 설정이 미완료인지 명시
- 해당 설정 화면으로 이동할 수 있는 링크/버튼 제공

#### FR-3.3 파일 생성 및 업로드
- 검증 통과 시:
  - `precice-config.xml` 1개 생성
  - `precice_mars.nml` 2개 생성 (모델별)
  - MinIO에 업로드
  - 기존 `useCoSimQuickRun` 또는 정식 실행 플로우로 전달

#### FR-3.4 실행 경로 전수 검증
- 검증은 UI 버튼 비활성뿐 아니라, **실행 함수 레벨**에서 수행
- 모든 실행 경로에 적용:
  - EditorPage 헤더 "Run Simulation" 버튼
  - SimulationPage QuickRun 버튼
  - SimulationPage Play 버튼
  - 재시작(restart) 플로우
- 모델 2개 이상(Co-Sim 모드)에서 검증 미통과 시 실행 차단 + 설정 화면 안내

#### FR-3.5 시뮬레이션 페이지 Co-Sim 상태 표시
- 모델 2개 이상 + Co-Sim 설정 미완료 시 SimulationPage 상단에 **경고 배너** 표시
- 배너 내용:
  - 미완료 항목 목록 (예: "Model 2 write_variable 미설정", "XML scheme 미설정")
  - EditorPage Co-Sim 설정으로 이동하는 링크/버튼
- 실행 버튼 비활성 + 툴팁으로 차단 이유 표시

```
SimulationPage
┌─────────────────────────────────────────────────┐
│  ⚠️ Co-Sim 설정 미완료          [설정으로 이동]  │
│  - XML 프로젝트 설정 미완료                       │
│                                                   │
│  [▶ 실행] ← disabled                             │
└─────────────────────────────────────────────────┘
```

---

### FR-4. 파일 생성 스펙

#### FR-4.1 precice-config.xml 생성 템플릿

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<precice-configuration>

  <log>
    <sink filter="%Severity% > info"
          format="---[precice] %ColorizedSeverity% %Message%"
          enabled="true" />
  </log>

  <!-- data 정의: NML write_variable에서 도출 -->
  <data:scalar name="{data1_name}" />
  <data:scalar name="{data2_name}" />

  <!-- mesh 정의: participant당 1개 -->
  <mesh name="Mesh_{participant1}" dimensions="3">
    <use-data name="{data1_name}" />
    <use-data name="{data2_name}" />
  </mesh>
  <mesh name="Mesh_{participant2}" dimensions="3">
    <use-data name="{data1_name}" />
    <use-data name="{data2_name}" />
  </mesh>

  <!-- participant 정의 -->
  <participant name="{participant1}">
    <provide-mesh name="Mesh_{participant1}" />
    <receive-mesh name="Mesh_{participant2}" from="{participant2}" />
    <write-data name="{p1_write_data}" mesh="Mesh_{participant1}" />
    <read-data  name="{p1_read_data}"  mesh="Mesh_{participant1}" />
    <mapping:{mapping_type} direction="read"
             from="Mesh_{participant2}" to="Mesh_{participant1}"
             constraint="consistent" />
  </participant>

  <participant name="{participant2}">
    <provide-mesh name="Mesh_{participant2}" />
    <receive-mesh name="Mesh_{participant1}" from="{participant1}" />
    <write-data name="{p2_write_data}" mesh="Mesh_{participant2}" />
    <read-data  name="{p2_read_data}"  mesh="Mesh_{participant2}" />
    <mapping:{mapping_type} direction="read"
             from="Mesh_{participant1}" to="Mesh_{participant2}"
             constraint="consistent" />
  </participant>

  <m2n:sockets acceptor="{participant1}" connector="{participant2}"
               exchange-directory="/app/precice-exchange" network="eth0" />

  <coupling-scheme:{scheme_type}>
    <time-window-size value="{time_window_size}" />
    <max-time value="{max_time}" />
    <participants first="{participant1}" second="{participant2}" />
    <exchange data="{p1_write_data}" mesh="Mesh_{participant1}"
              from="{participant1}" to="{participant2}" />
    <exchange data="{p2_write_data}" mesh="Mesh_{participant2}"
              from="{participant2}" to="{participant1}" initialize="true" />
  </coupling-scheme:{scheme_type}>

</precice-configuration>
```

#### FR-4.2 precice_mars.nml 생성 템플릿

```fortran
&precice_config
  participant      = '{participant_name}'
  mesh_name        = 'Mesh_{participant_name}'
  read_data_name   = '{read_data_name}'
  write_data_name  = '{write_data_name}'
  config_path      = '/app/config/precice-config.xml'
  n_coupling       = {coupling_ids_count}
  coupling_ids     = {coupling_ids_comma_separated}
  write_variable   = '{write_variable}'
  {init_wdata_line}
  use_dummy_coords = .true.
/
```

- `{init_wdata_line}`: 값이 있으면 `init_wdata       = {value}`, 없으면 생략
- `coupling_ids`: 6자리씩 줄바꿈 포맷 (가독성)

---

## 4. 비기능 요구사항

### NFR-1. 데이터 영속성
- NML/XML 설정값은 프로젝트 상태의 일부로 저장
- 기존 Zustand store 확장 또는 별도 store 생성
- 브라우저 새로고침 후에도 설정 유지 (localStorage 또는 서버 저장)

### NFR-2. 타입 안전성
- 기존 `src/types/cosim.ts`의 타입 정의 활용 및 확장
- write_variable 고정 목록은 const enum 또는 literal union으로 타입 보장

### NFR-3. 기존 코드 호환
- `useCoSimQuickRun` hook의 파일 업로드 로직 재사용
- `simulationStore`의 `coSimSession` 구조 유지
- 정식 실행 플로우에서도 동일하게 사용 가능한 구조

---

## 5. 기존 코드 현황 및 영향 범위

### 5.1 활용할 기존 코드

| 파일 | 활용 내용 |
|------|-----------|
| `src/types/cosim.ts` | `CoSimConfig`, `NmlCouplingConfig` 타입 — 확장하여 사용 |
| `src/types/simulation.ts` | `CoSimSession`, `ModelSimData` — 런타임 구조 유지 |
| `src/stores/simulationStore.ts` | `coSimSession` 상태 — Co-Sim 설정 상태 추가 필요 |
| `src/hooks/useCoSimQuickRun.ts` | 파일 업로드/실행 로직 — 파일 생성 단계 추가 |
| `src/pages/EditorPage.tsx` | 3-pane 레이아웃 + 사이드바 — Co-Sim 항목 및 패널 추가 |
| `src/pages/SimulationPage.tsx` | 실행 버튼 + 헤더 — Co-Sim 상태 배너 및 실행 차단 |
| `src/types/mars.ts` | `PipeParameters`, `HeatStructureParameters` — 컴포넌트 목록 조회 |

### 5.2 신규 구현 필요

| 구분 | 내용 |
|------|------|
| 타입 | `cosim.ts` 확장 — write_variable 리터럴, coupling_ids 범위, XML 설정 인터페이스 |
| Store | Co-Sim 설정 상태 (coupling_ids, 모델별 설정, XML 설정, 완료 여부) |
| 컴포넌트 | CoSimPanel (통합 패널 — NML + XML 설정) |
| 컴포넌트 | CoSimStatusBanner (SimulationPage 경고 배너) |
| 유틸리티 | XML 생성기, NML 생성기 (`src/utils/` 하위) |
| Hook | Co-Sim 설정 검증 hook (실행 함수 레벨 검증) |

### 5.3 수정 필요

| 파일 | 수정 내용 |
|------|-----------|
| `EditorPage.tsx` | 사이드바 "Co-Sim" 항목 추가, 우측 패널 CoSimPanel 렌더링 |
| `SimulationPage.tsx` | Co-Sim 상태 배너 추가, 실행 버튼 비활성 조건 추가 |
| `useCoSimQuickRun.ts` | 설정 기반 파일 자동 생성 → 업로드 플로우 |
| `cosim.ts` | 타입 확장 (write_variable literal, coupling range 등) |

---

## 6. UI/UX 요구사항

### 6.1 CoSimPanel 레이아웃 (EditorPage 우측 패널)

CoSimPanel은 PropertyPanel과 배타적으로 렌더링되며, 모델 탭 전환과 무관하게 동일한 내용을 표시한다.
**3탭 구조**로 섹션을 분리하여 정보 밀도를 관리한다 (PropertyPanel의 3탭 패턴과 일관).

```
CoSimPanel
┌─────────────────────────────────────────────┐
│  Stepper: [1.경계면 ✅]─[2.교환 🔵]─[3.설정 ⬜] │
├─────────────────────────────────────────────┤
│  [경계면]  [데이터 교환]  [프로젝트 설정]     │ ← 탭
├─────────────────────────────────────────────┤
│                                               │
│  (선택된 탭의 내용만 표시)                     │
│                                               │
└─────────────────────────────────────────────┘
```

#### Tab 1: 커플링 경계면

```
┌─────────────────────────────────────────────┐
│  + 컴포넌트 추가                              │
│                                               │
│  ┌ 컴포넌트 310 ──────────────────── [✕] ┐  │
│  │  그룹 수: [1 ▼]                        │  │
│  │  그룹 1: 범위 [001] ~ [012]            │  │
│  │  → 12개 ID                             │  │
│  └────────────────────────────────────────┘  │
│  ┌ 컴포넌트 330 ──────────────────── [✕] ┐  │
│  │  그룹 수: [1 ▼]                        │  │
│  │  그룹 1: 범위 [001] ~ [012]            │  │
│  └────────────────────────────────────────┘  │
│  ...                                          │
│                                               │
│  합계: 48개 coupling IDs                      │
│  미리보기: 3101001, 3101002, ...              │
└─────────────────────────────────────────────┘
```

#### Tab 2: 데이터 교환

```
┌─────────────────────────────────────────────┐
│  Model 1 (PRI)                                │
│   write_data_name: [Q_WALL ▼]                 │
│   read_data_name:  [T_WALL ▼]                 │
│   → write_variable: htrnro (자동)             │
│   init_wdata:      [        ] (선택)          │
│                                               │
│        ↕ 자동 반전                             │
│                                               │
│  Model 2 (SEC)                                │
│   write_data_name: T_WALL  (자동 반전)         │
│   read_data_name:  Q_WALL  (자동 반전)         │
│   → write_variable: httmp  (자동)             │
│   init_wdata:      [560.d0  ]                 │
│                                               │
│  ℹ️ Model 2는 Model 1 설정에서 자동 결정됩니다  │
└─────────────────────────────────────────────┘
```

#### Tab 3: 프로젝트 설정 (XML)

NML 설정(Tab 1 + Tab 2) 완료 시 활성화. 미완료 시 비활성 + 안내 표시.

```
┌─────────────────────────────────────────────┐
│  Coupling Scheme: [serial-explicit ▼]         │
│                                               │
│  max-time:        [100      ]                 │
│  time-window-size:[1        ]                 │
│                                               │
│  Mapping:         [nearest-neighbor ▼]        │
└─────────────────────────────────────────────┘
```

### 6.2 사이드바 Co-Sim 진입점

- 모델 2개 이상일 때만 사이드바에 "Co-Sim" 항목 노출
- Co-Sim 설정 미완료 시 사이드바 항목에 **경고 배지(dot)** 표시
- 모델 2개 이상 최초 생성 시 **원타임 안내 Toast**: "Co-Sim 모드 활성화. 사이드바에서 커플링 설정을 진행하세요."

### 6.3 SimulationPage Co-Sim 상태 배너

```
┌─────────────────────────────────────────────────┐
│  ⚠️ Co-Sim 설정 미완료          [설정으로 이동]  │
│  - 커플링 경계면 미설정                           │
│  - XML 프로젝트 설정 미완료                       │
└─────────────────────────────────────────────────┘
```

- 모델 2개 이상 + 설정 미완료 시에만 표시
- 설정 완료 시 배너 숨김
- "설정으로 이동" 클릭 → EditorPage Co-Sim 패널로 네비게이션

### 6.4 검증 상태 표시
- EditorPage/SimulationPage 실행 버튼 근처에 Co-Sim 설정 상태 표시
- 상태: 미설정 / NML 진행중 / XML 미완료 / 완료
- 미완료 시 실행 버튼 disabled + 툴팁으로 이유 표시

---

## 7. coupling_ids 생성 규칙

### 7.1 ID 포맷

> **⚠️ 담당자 확인 필요**: coupling_ids의 정확한 포맷 규칙은 preCICE-MARS 어댑터 담당자 확인 후 확정.
> 웹 공개 문서에 해당 어댑터 정보 없음 (내부 개발물).

**현재 샘플에서 관찰된 패턴**: `{CCC}{G}{NNN}` (7자리)
- `CCC` (3자리): 컴포넌트 번호
- `G` (1자리): 그룹 번호 — 하나의 컴포넌트를 몇 개 그룹으로 분할할지
- `NNN` (3자리): 범위 — 해당 그룹 내 노드/셀 번호
- 양쪽 NML에 **동일한 값** 사용

```
샘플: 4개 컴포넌트 × 1그룹 × 12노드 = 48개
  310-1-001~012, 330-1-001~012, 350-1-001~012, 370-1-001~012
```

**담당자 확인 사항**:
1. `G` 자릿수가 "그룹"이 맞는지, 다른 의미인지
2. 컴포넌트 타입(Pipe/HeatStructure)에 따라 ID 포맷이 달라지는지
3. Pipe 310이 ncells=14인데 coupling_ids가 12개인 이유

### 7.2 입력 방식

**방법 A — 컴포넌트 + 그룹 + 범위 지정 (GUI)**
- 컴포넌트 번호 입력/선택
- 그룹 수 설정 (기본 1)
- 그룹별 범위(시작~끝) 지정
- ID 자동 생성: `{CCC}{그룹번호}{시작:03d}` ~ `{CCC}{그룹번호}{끝:03d}`
- 복수 컴포넌트 추가 가능
- 생성된 ID 미리보기 표시

**방법 B — 직접 입력 (병행)**
- 텍스트 영역에 쉼표 또는 줄바꿈으로 ID 입력/붙여넣기
- 기존 NML 파일에서 복사/붙여넣기 지원

**양방향 동기화**: 방법 A/B 간 실시간 동기화.

**양방향 동기화**: 방법 A/B 간 실시간 동기화.

### 7.3 셀 범위 참고값 (자동 추정용)
- **Pipe**: `PipeParameters.ncells` (1~999)
- **Heat Structure**: 각 섹션별 `nh` 값 (multi-section 구조)
- 단, 실제 커플링 셀 범위는 컴포넌트 전체 셀과 다를 수 있으므로 사용자가 최종 범위를 지정

---

## 8. 제약 사항 및 향후 확장

### 모델 스코프 겹침
- 모델 생성 시 해석 범위가 겹치지 않도록 생성
- 이후 사용자가 모델 페이지에서 임의로 추가한 컴포넌트에 의한 겹침은 현재 스코프에서 미고려

### 현재 스코프 제약
- 참여자 수: 2개 모델 고정
- 대상 컴포넌트: Pipe, Heat Structure만
- write_variable: `htrnro`, `httmp` 2개
- Mapping: `nearest-neighbor`, `nearest-projection` 2개
- Implicit convergence: 고정 기본값 (GUI 미노출)

### 향후 확장 가능
- 3개 이상 참여자 지원
- 추가 컴포넌트 타입 (Branch, Separator 등)
- write_variable 목록 확장
- Implicit convergence GUI 노출
- RBF mapping 방식 추가
- `use_dummy_coords` 고급 옵션 노출
- Vector 데이터 타입 지원

---

## 9. 수용 기준 (Acceptance Criteria)

### 설정 UI
- [ ] EditorPage 사이드바에 "Co-Sim" 항목이 표시된다
- [ ] CoSimPanel에서 양쪽 모델의 Pipe/HeatStructure 목록이 교차 조회된다
- [ ] 양쪽 모델에 모두 존재하는 컴포넌트만 선택 가능하다
- [ ] 한쪽에만 존재하는 컴포넌트는 비활성 + 이유가 표시된다
- [ ] 컴포넌트 선택 후 셀 범위(시작~끝)를 지정할 수 있다
- [ ] 직접 입력으로 coupling_ids를 붙여넣기할 수 있다
- [ ] 방법 A/B 간 양방향 동기화가 동작한다
- [ ] 모델별로 write_variable을 선택할 수 있다

### 설정 의존 및 검증
- [ ] NML 설정이 완료되면 XML 설정 섹션이 활성화된다
- [ ] XML 설정에서 scheme/max-time/time-window-size/mapping을 입력할 수 있다
- [ ] Co-Sim 활성 상태에서 설정 미완료 시 **모든 실행 경로에서** 실행이 차단된다
- [ ] SimulationPage에 Co-Sim 미완료 경고 배너가 표시된다
- [ ] 미완료 배너에서 EditorPage 설정으로 이동할 수 있다

### 파일 생성
- [ ] 설정 완료 시 precice-config.xml 1개 + precice_mars.nml 2개가 올바르게 생성된다
- [ ] 생성된 파일이 샘플(documents/co-sim/)과 동일한 포맷이다

### 영속성
- [ ] 설정값은 브라우저 새로고침 후에도 유지된다
