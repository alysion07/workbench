---
title: "Phase 4: Simulation & Analysis"
status: in-progress
phase: 4
branch: alysion/feat_simulation_page
last_updated: 2026-04-03
---

# Phase 4: Simulation & Analysis

> **Parent**: [ROADMAP](../ROADMAP.md)
> **Status**: 🚧 진행중
> **화면 ID**: SIM-001, SIM-002, ANA-001

## Overview

MARS 시뮬레이션 실행, 실시간 모니터링, 결과 분석 기능 구현.
gRPC-Web을 통해 백엔드 Task Manager와 통신하여 시뮬레이션을 제어하고 결과를 시각화.

---

## Goals

- [x] Simulation Home 실시간 모니터링 (SIM-001) — 기본 구현 완료
- [x] Interactive Control 수동 제어 (SIM-002) — 기본 구현 완료
- [x] gRPC-Web 스트리밍 완성 — Connect-RPC 연동 완료
- [x] 결과 데이터 시각화 — DynamicChartGrid, LiveLogViewer
- [x] Analysis 결과 분석 (ANA-001) — 기본 레이아웃 + plotfl 뷰어
- [ ] GetTelemetries 연동 (전체 이력 차트)
- [ ] 노달라이제이션 오버레이 (실시간 값 표시)
- [ ] 결과 Export (CSV/PNG)

---

## 화면 구성

### SIM-001: Simulation Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  VSMR-SMART → Simulation          [SIMULATION CONTROL] [SETTING]    │
│  Simulation Home                                                    │
├──────────┬────────────────────────────────────────┬─────────────────┤
│          │                                        │ Trips(Alarm)    │
│ Sim Home │  ┌────────────────────────────────┐   │ ○ Trip A        │
│          │  │                                │   │ ○ Trip B        │
│ Trend    │  │  Nodalization Diagram          │   │ ● Trip C (!)    │
│ Graph    │  │  + 실시간 값 오버레이            │   │                 │
│          │  │                                │   │ Variables       │
│ Inter-   │  │  ┌──────┐    ┌──────┐         │   │ ─────────────   │
│ active   │  │  │P:1234│    │T:115K│         │   │ Junction A      │
│ Control  │  │  └──────┘    └──────┘         │   │   11.8M +2.5%   │
│          │  │                                │   │ Volume A Temp   │
│ History  │  └────────────────────────────────┘   │   8.236K -1.2%  │
│          │                                        │                 │
│          │  실시간 로그                            │                 │
│          │  ┌────────────────────────────────────┴─────────────────┤
│          │  │ [SCREEN] [PLOT]  135 lines                           │
│          │  │ [6.70s] Pressure convergence achieved (1.2e-5)       │
│          │  │ [7.40s] Temperature convergence achieved (3.4e-5)    │
└──────────┴──────────────────────────────────────────────────────────┘
```

### SIM-002: Interactive Control

```
┌─────────────────────────────────────────────────────────────────────┐
│  Interactive Control                [SIMULATION CONTROL] [SETTING]  │
├──────────┬──────────────────────────────────────┬───────────────────┤
│ 계통     │                                      │ Trips             │
│ 트리     │  ┌────────────────────────────────┐ │ ─────────────────  │
│ ───────  │  │                                │ │ Trip Alarm 1      │
│ ▼ Safety │  │  P&ID / Nodalization Diagram   │ │   26.01.11 14:02  │
│   Inject │  │                                │ │ Trip Alarm 2      │
│   801:   │  │   ┌─────┐                      │ │   26.01.11 14:02  │
│   Active │  │   │Auto │  Manual              │ │                   │
│          │  │   └─────┘  ┌─────┐             │ │ Interactive Ctrl  │
│ ▼ Mal-   │  │            │ Pump│             │ │ ─────────────────  │
│   function│ │            └─────┘             │ │ 제어값 변경 가능   │
│   850:   │  │                                │ │ - 이름            │
│   LOCA   │  └────────────────────────────────┘ │ - 현재값          │
│          │                                      │ - 수동 제어값     │
│ ▼ Inter- │  Live Trend                         │                   │
│   active │  ┌────────────────────────────────┐ │                   │
│   Ctrl   │  │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~    │ │                   │
│   800:   │  └────────────────────────────────┘ │                   │
└──────────┴──────────────────────────────────────┴───────────────────┘
```

### ANA-001: Simulation History (결과 분석)

```
┌─────────────────────────────────────────────────────────────────────┐
│  LOCA Simulation  [Completed]       [SIMULATION CONTROL] [SETTING]  │
│  Details: 2026-01-15 13:00:00 LOFW Simulation                       │
├──────────┬────────────────────────────────┬─────────────────────────┤
│ Search   │ ┌────────────────────────────┐ │ Target        Sim Hist  │
│ [______] │ │      Chart Area            │ │ ───────────   ───────   │
│          │ │   (Compare Mode 지원)       │ │ junction A    [List]   │
│ ▼ Compo- │ │                            │ │   11.8M +2.5% │         │
│   nents  │ │   Tokyo ── Berlin          │ │ junction B    │ LOCA    │
│   Pipe101│ │   NY ──    London          │ │   8.236K      │ Success │
│     P    │ └────────────────────────────┘ │               │         │
│     T    │                                │ Volume A      │ Reactor │
│   Valve  │ Favorite Charts               │   8.236K      │ Running │
│          │ ┌──────┐ ┌──────┐ ┌──────┐   │               │         │
│ ▼ Saved  │ │Press │ │Temp  │ │Flow  │   │ Export        │         │
│   Groups │ │381K  │ │375K  │ │392K  │   │ [CSV] [IMG]   │         │
│   Core   │ └──────┘ └──────┘ └──────┘   │               │         │
│   Safe   │                                │               │         │
├──────────┴────────────────────────────────┴─────────────────────────┤
│  [0.0s]═══════════●═══════════════════════════════════════[1000s]   │
│                 250s           500s           750s                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

### SIM-001: Simulation Home

| 기능 | 상태 | 설명 |
|------|------|------|
| 시뮬레이션 시작/정지/일시정지/재개 | ✅ | CreateTask + MARSTaskControl RPC |
| 배속 제어 | ✅ | SetSimulationSpeed 드롭다운 |
| 실시간 로그 | ✅ | LiveLogViewer (SubscribeScreenLog) |
| 실시간 차트 | ✅ | DynamicChartGrid (SubscribeMinorEdit, 1000pt) |
| gRPC 스트리밍 | ✅ | Connect-RPC (SubscribeSimState, ScreenLog, MinorEdit) |
| 단일 해석 관리 | ✅ | beforeunload + 네비게이션 가드 ([FEAT](../features/FEAT-single-simulation-guard.md)) |
| 노달라이제이션 오버레이 | ⏳ | 다이어그램 위에 실시간 값 표시 |
| Trips(Alarm) 패널 | ⏳ | 알람 상태 표시, 발생 시 깜빡임 |
| Variables 패널 | ⏳ | 주요 변수 실시간 수치 + 변화율 |

### SIM-002: Interactive Control

| 기능 | 상태 | 설명 |
|------|------|------|
| InteractiveControlView 탭 | ✅ | SimulationPage 내 탭 전환 |
| ICV 조회/설정 | ✅ | GetAllICVs / SetICV RPC |
| Alarm Panel | ✅ | AlarmPanel + AlarmSettingsDialog |
| SidePanel 정보 | ✅ | 위젯 컨텍스트 메뉴, 노드 위젯 |
| 계통 트리 네비게이션 | ⏳ | 1차/2차/안전/제어 계통 세부 |
| P&ID 다이어그램 | ⏳ | 제어 가능한 컴포넌트 표시 |
| Manual/Auto 제어 확장 | ⏳ | 밸브 Open/Close, 펌프 속도 제어 |
| Live Trend | ⏳ | 실시간 그래프 (대화형) |

### ANA-001: Analysis (결과 분석)

| 기능 | 상태 | 설명 |
|------|------|------|
| AnalysisPage 라우팅 | ✅ | `/analysis` 별도 페이지 |
| Plotfl 파일 로드 | ✅ | PlotFileDropZone (드래그앤드롭) |
| 변수 탐색기 | ✅ | VariableExplorer (컴포넌트별 변수 트리) |
| 차트 패널 그리드 | ✅ | ChartPanelGrid + TimeSeriesChart |
| 타임 슬라이더 | ✅ | TimeRangeSlider |
| 전력 요약 카드 | ✅ | PowerSummaryCard |
| GetTelemetries 연동 | ⏳ | InfluxDB 시간범위 조회 (Backlog) |
| Compare Mode | ⏳ | 두 결과 오버레이 비교 |
| Favorite Charts | ⏳ | 자주 보는 차트 저장 |
| Layout Resize | ⏳ | 1x1, 2x2, Free Grid 배치 |
| Export | ⏳ | CSV 데이터, PNG 이미지 |

---

## 서버 연동 현황 (2026-03-17 기준)

> 프로토콜: Connect-RPC. 상세 스펙은 [UPDATED.md](../../UPDATED.md) 참조.

### BFF 아키텍처 변경 (hslim, 2026-03-16)

1. **시뮬레이션 이력 BFF 관리**
   - CreateTask 성공 시 BFF가 자동으로 `simulation_history` 레코드 생성 (PostgreSQL)
   - 상태 변경 시마다 자동 저장 → 브라우저 닫혀도 이력 보존
   - 웹 클라이언트: `src/services/pm/projectManagerService.ts` → `listSimulationHistoriesByProject()`

2. **시뮬레이션 배속 제어**
   - `MARSTaskControl.SetSimulationSpeed` / `GetSimulationSpeed` RPC
   - SimulationPage 헤더에 Speed 드롭다운 추가 완료

3. **Telemetry InfluxDB 저장**
   - MinorEdit 데이터가 InfluxDB에 저장됨 (확인 완료)
   - `AnalysisService.GetTelemetries`로 시간 범위 조회 가능

4. **marsTaskControlService 리팩토링**
   - 모든 제어 함수가 `taskId`를 명시적 인자로 받도록 변경
   - store 직접 참조 제거 → 서비스-store 디커플링

### 서비스 목록

| 서비스 | Proto | 주요 RPC |
|--------|-------|----------|
| TaskManager | `vsmr.tm.v1` | CreateSession, CreateTask, ListAllTasks |
| MARSTaskControl | `vsmr.mars.v1` | Start, Pause, Resume, Stop, GetState, SetSimulationSpeed |
| CommonVariables | `vsmr.mars.v1` | GetSnapshot, GetTimeHy, IsDone |
| InteractiveControl | `vsmr.mars.v1` | GetAllICVs, SetICV |
| MarsTaskStream | `vsmr.mars.v1` | SubscribeScreenLog, SubscribeMinorEdit, SubscribeSimState |
| AnalysisService | `vsmr.analysis.v1` | GetTelemetries |
| ProjectManager | `vsmr.pm.v1` | CRUD + ListSimulationHistories |
| StorageService | `vsmr.storage.v1` | Upload/Download/List files |

---

## Dependencies

- **Requires**: Phase 1 (Core Editor) ✅
- **Requires**: Phase 2 (Project Management) 🚧
- **Requires**: Backend (vsmr-sim-bff) ✅ Connect-RPC 연동 완료
- **Requires**: Kubernetes 배포 환경

---

## Backlog: 전체 이력 차트 (GetTelemetries 연동)

> **상태**: ⏳ 대기 (별도 작업으로 분리)
> **선행 조건**: BFF `AnalysisService.GetTelemetries` API 연동

### 배경

- 현재 차트는 클라이언트 메모리에 최근 1000포인트만 유지 (슬라이딩 윈도우)
- 시뮬레이션 시작(t=0)부터의 전체 이력 차트 불가
- 비활성 탭에서도 데이터 수신/저장은 계속되나, 1000개 초과 시 앞에서 잘림 (활성/비활성 무관)
- 브라우저 비활성 탭에서 `requestAnimationFrame` 중단 → 차트 렌더링 멈춤 (데이터 유실은 아님, 탭 복귀 시 최신 데이터 즉시 반영)

### BFF에서 발견된 API (2026-03-13 추가, commit 4eccfc8)

```protobuf
// proto/analysis/analysis.proto
service AnalysisService {
  rpc GetTelemetries(GetTelemetriesRequest) returns (GetTelemetriesResponse);
}

message GetTelemetriesRequest {
  string task_id = 1;
  google.protobuf.Timestamp start = 2;   // 구간 시작
  google.protobuf.Timestamp end = 3;     // 구간 끝
  repeated ObjectVariableFilter object_variable_filters = 4;
  string measurement = 5;               // 기본값: "telemetry_v1"
}
```

- 엔드포인트: `/api/vsmr.analysis.v1.AnalysisService/GetTelemetries`
- 백엔드: InfluxDB (Flux query)
- 시간 범위 + 변수 필터로 조회 가능

### 활용 시나리오

1. **전체 이력 차트** — t=0부터 현재까지 서버에서 조회 (클라이언트 메모리 제한 해소)
2. **비활성 탭 복귀** — 빠진 구간 서버에서 보충 조회
3. **재연결 시 과거 데이터 복원** — `ListAllTasks` + `GetTelemetries`
4. **줌/팬** — 구간별 재요청으로 고해상도 데이터 조회

### 추가 발견된 BFF API

| API | 용도 | 저장소 |
|-----|------|--------|
| `SubscribeSimState` | 실시간 상태 push 스트림 | Kafka |
| `ListSimulationHistories` | 시뮬레이션 실행 이력 조회 | PostgreSQL |
| `ListSimulationHistoriesByProject` | 프로젝트별 이력 필터 | PostgreSQL |
| `SimulationHistory` 레코드 | task_id, project_id, title, status, start/end_time, cpu_time, is_restart | PostgreSQL |

### 구현 방향 (예상)

- 프론트 서비스 레이어에 `analysisService` 추가
- 차트 컴포넌트에서 시간 범위별 조회
- 줌/팬 시 해당 구간 재요청 구조
- 서버 다운샘플링 필요 여부 확인 필요

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-03-23 | Phase 4 상태 ⏳→🚧 갱신 | SIM-001/SIM-002/ANA-001 구현 현황 반영, Goals 체크리스트 업데이트 |
| 2026-03-17 | 서버 연동 현황 섹션 갱신, Backlog 기록 | GetTelemetries API 확인, 서비스 목록 정리 |
| 2026-03-16 | BFF 연동 변경 반영 (hslim) | 이력 BFF 관리, 배속 제어, Telemetry InfluxDB, marsTaskControl 리팩토링 |
| 2025-01-30 | Phase 4 문서 작성 | 대기 상태 |
