---
title: "Phase 1: Core Editor MVP + Extended Components"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# Phase 1: Core Editor MVP + Extended Components

> **Parent**: [ROADMAP](../ROADMAP.md)
> **Status**: ✅ 완료
> **화면 ID**: DES-001 (Model Editor), DES-001-GS (Global Settings)
> **브랜치**: `main` (MVP), `alysion/feat_heatstructure` (확장 컴포넌트)

---

## Overview

ReactFlow 기반 MARS 노달라이제이션 에디터 구현.
사용자가 비주얼하게 원자로 계통 컴포넌트를 배치하고 연결하여 MARS 입력 파일(.i)을 생성할 수 있는 통합 편집기.

**초기 MVP** (5종 컴포넌트) 이후 Heat Structure, Valve, Control Variable 등 확장 기능이 지속 추가되어
현재 **10종 컴포넌트 + 7개 Global Settings 탭**을 지원.

---

## Goals

- [x] 비주얼 노드 기반 편집기 구현 (ReactFlow)
- [x] MARS 컴포넌트 10종 구현 (MVP 5종 + 확장 5종)
- [x] MARS 입력 파일(.i) 생성 기능
- [x] 프로젝트 로컬 저장/불러오기 (JSON)
- [x] Global Settings 7개 탭 (카드 100~999, 201MMMNN, 205CCCNN)
- [x] 컴포넌트 유효성 검증 시스템

---

## 화면 구성

### DES-001: Model Editor

```
┌──────────────────────────────────────────────────────────────────┐
│  [1] Component    │  [2] Main Canvas          │  [3] Property    │
│      Palette      │                           │      Panel       │
│  ┌─────────────┐  │  ┌─────────────────────┐  │  ┌────────────┐  │
│  │ VOLUME      │  │  │                     │  │  │ Basic Info │  │
│  │ - SingleVol │  │  │  ReactFlow Canvas   │  │  │            │  │
│  │             │  │  │                     │  │  │ Geometry   │  │
│  │ JUNCTION    │  │  │  Drag & Drop        │  │  │            │  │
│  │ - SingleJun │  │  │  Node Editor        │  │  │ Initial    │  │
│  │ - Mtpljun   │  │  │                     │  │  │ Conditions │  │
│  │ - Valve     │  │  │  Edge Connection    │  │  │            │  │
│  │             │  │  │                     │  │  │ Junction   │  │
│  │ PIPING      │  │  │                     │  │  │ Settings   │  │
│  │ - Pipe      │  │  │                     │  │  │            │  │
│  │ - Branch    │  │  └─────────────────────┘  │  │ [Type-     │  │
│  │ - Pump      │  │                           │  │  specific  │  │
│  │             │  │  [Toolbar]                │  │  tabs...]  │  │
│  │ BOUNDARY    │  │  - Physical Mode Toggle   │  └────────────┘  │
│  │ - TMDPVOL   │  │  - Save / Load / Export   │                  │
│  │ - TMDPJUN   │  │  - Global Settings        │                  │
│  │             │  │                           │                  │
│  │ THERMAL     │  │                           │                  │
│  │ - HeatStr   │  │                           │                  │
│  └─────────────┘  │                           │                  │
└──────────────────────────────────────────────────────────────────┘
```

### DES-001-GS: Global Settings Dialog (7 Tabs)

| # | Tab | 내용 | MARS Cards | 상태 |
|---|-----|------|------------|------|
| 1 | PROJECT SETUP | Problem Type, Run Option, Units | 100, 101, 102, 110, 115 | ✅ |
| 2 | SYSTEM CONFIG | Non-condensable Gases, Gas Mass Fractions, Volume References | Card 120-129 | ✅ |
| 3 | SIMULATION CONTROL | Time Step, End Time, Output Control | Card 200, Time Phases | ✅ |
| 4 | MINOR EDITS | 시뮬레이션 변수 모니터링 설정 | Cards 301-399 | ✅ |
| 5 | VARIABLE TRIPS | Trip 조건 (논리 트립, 변수 트립) | Cards 401-599 | ✅ |
| 6 | CONTROL VARIABLES | 제어 변수 정의 (SUM, CONSTANT, TRIPUNIT) | Cards 205CCCNN | ✅ P0 |
| 7 | THERMAL PROPERTIES | 열물성 데이터 (테이블/함수/내장재료) | Cards 201MMMNN | ✅ |

---

## 구현된 컴포넌트 (10종)

### Hydrodynamic Components

| 카테고리 | 컴포넌트 | MARS Code | 노드 파일 | 폼 파일 | 카드 생성 | 상태 |
|---------|----------|-----------|----------|---------|----------|------|
| VOLUME | Single Volume | SNGLVOL | [SnglvolNode.tsx](../../src/components/nodes/SnglvolNode.tsx) | [SnglvolForm.tsx](../../src/components/forms/SnglvolForm.tsx) | CCC0000-0101 | ✅ |
| JUNCTION | Single Junction | SNGLJUN | [SngljunNode.tsx](../../src/components/nodes/SngljunNode.tsx) | [SngljunForm.tsx](../../src/components/forms/SngljunForm.tsx) | CCC0000-0202 | ✅ |
| JUNCTION | Multiple Junction | MTPLJUN | [MtpljunNode.tsx](../../src/components/nodes/MtpljunNode.tsx) | [MtpljunForm.tsx](../../src/components/forms/MtpljunForm.tsx) | CCC0000-0301 | ✅ |
| JUNCTION | Valve | VALVE | [ValveNode.tsx](../../src/components/nodes/ValveNode.tsx) | [ValveForm.tsx](../../src/components/forms/ValveForm.tsx) | CCC0000-0301 | ✅ |
| PIPING | Pipe | PIPE | [PipeNode.tsx](../../src/components/nodes/PipeNode.tsx) | (inline) | CCC0000-2003 | ✅ |
| PIPING | Branch | BRANCH | [BranchNode.tsx](../../src/components/nodes/BranchNode.tsx) | [BranchForm.tsx](../../src/components/forms/BranchForm.tsx) | CCC0000-0210 | ✅ |
| PIPING | Pump | PUMP | [PumpNode.tsx](../../src/components/nodes/PumpNode.tsx) | [PumpForm.tsx](../../src/components/forms/PumpForm.tsx) | CCC0000-0314 | ✅ |
| BOUNDARY | Time-Dep Volume | TMDPVOL | [TmdpvolNode.tsx](../../src/components/nodes/TmdpvolNode.tsx) | [TmdpvolForm.tsx](../../src/components/forms/TmdpvolForm.tsx) | CCC0000-0201 | ✅ |
| BOUNDARY | Time-Dep Junction | TMDPJUN | [TmdpjunNode.tsx](../../src/components/nodes/TmdpjunNode.tsx) | [TmdpjunForm.tsx](../../src/components/forms/TmdpjunForm.tsx) | CCC0000-0301 | ✅ |

### Thermal Components

| 카테고리 | 컴포넌트 | MARS Code | 노드 파일 | 폼 파일 | 카드 생성 | 상태 |
|---------|----------|-----------|----------|---------|----------|------|
| THERMAL | Heat Structure | HTSTR | [HeatStructureNode.tsx](../../src/components/nodes/HeatStructureNode.tsx) | [HeatStructureForm.tsx](../../src/components/forms/HeatStructureForm.tsx) | 1CCC0000-1699 | ✅ |

### Valve 서브타입

| 서브타입 | 설명 | SMART 사용 수 |
|---------|------|--------------|
| mtrvlv | Motor Valve | 21개 (MFIV, MSIV, PRHRS) |
| trpvlv | Trip Valve | 4개 (PSV, Break) |
| srvvlv | Servo Valve | 3개 (SDSV, SG Tube Rupture) |

---

## 주요 기능별 구현 상세

### 1. 파일 생성 (`fileGenerator.ts`)

MARS 입력 파일(.i)을 생성하는 핵심 모듈.

**출력 카드 순서**:
```
1. Title Card (Card 100)
2. Misc Control Cards (101, 102)
3. System Config (110, 115, 120-129)
4. Time Step Control (Card 200, Time Phases)
5. Thermal Properties (201MMMNN)
6. Minor Edits (301-399)
7. Variable Trips (401-599)
8. Control Variables (205CCCNN)    ← NEW
9. Interactive Inputs (801-999)
10. Hydrodynamic Components (CCCXXXX)
11. Heat Structures (1CCCXXXX)
```

**생성 메서드**:

| 메서드 | 대상 | 카드 범위 |
|--------|------|----------|
| `generateGlobalCards()` | 전역 설정 | 100-999 |
| `generateSnglvolCards()` | Single Volume | CCC0000-0101 |
| `generateSngljunCards()` | Single Junction | CCC0000-0202 |
| `generatePipeCards()` | Pipe | CCC0000-2003 |
| `generateBranchCards()` | Branch | CCC0000-0210 |
| `generateTmdpvolCards()` | TMDP Volume | CCC0000-0201 |
| `generateTmdpjunCards()` | TMDP Junction | CCC0000-0301 |
| `generateMtpljunCards()` | Multiple Junction | CCC0000-0301 |
| `generatePumpCards()` | Pump | CCC0000-0314 |
| `generateHeatStructureCards()` | Heat Structure | 1CCC0000-1699 |
| `generateValveCards()` | Valve | CCC0000-0301 |
| `generateThermalPropertyCards()` | 열물성 | 201MMM00-99 |
| `generateControlVariableCards()` | 제어 변수 | 205CCC00-98 |

### 2. 유효성 검증

#### Global Settings 검증 (`globalSettingsValidation.ts`)

| 함수 | 대상 |
|------|------|
| `validateGlobalSettings()` | 전체 전역 설정 (Card 100-200) |
| `validateSystemReferences()` | System Config 볼륨 참조 |
| `validateMinorEdits()` | Minor Edit 변수 참조 |
| `validateVariableTrips()` | Variable Trip 조건/참조 |
| `validateControlVariables()` | Control Variable 타입별 검증 |
| `validateInteractiveInputs()` | Interactive Input 참조 |

#### Component 검증 (`componentValidation.ts`)

| 함수 | 대상 |
|------|------|
| `autoValidateNode()` | 전체 노드 자동 검증 (타입별 분기) |
| `validateSngljun()` | SNGLJUN From/To 연결 |
| `validateValve()` | Valve From/To + 서브타입별 규칙 |
| `validateHeatStructure()` | Heat Structure 경계조건 + 메시 |
| `validateThermalProperties()` | 열물성 데이터 무결성 |
| `validateHeatStructureMaterialReferences()` | HS → Thermal Property 참조 |

### 3. 엣지 연결 시스템

| 연결 유형 | 설명 | 구현 |
|----------|------|------|
| 축방향 (axial) | Volume ↔ Junction 기본 연결 | ✅ 자동 |
| Crossflow | Volume ↔ Volume 교차유동 | ✅ 다이얼로그 |
| Heat Structure | HeatStr ↔ Volume 열전달 경계 | ✅ 자동 BC 반영 |
| VolumeReference | Junction From/To 볼륨 참조 | ✅ Autocomplete |

---

## 확장 기능 (Post-MVP)

### Heat Structure ✅

**문서**: [HeatStructure_Development_Plan.md](../analysis/HeatStructure_Development_Plan.md)

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 일반 구조물: 10개 탭, 경계조건, 카드 생성 | ✅ |
| 1.5 | 엣지 기반 BC 자동 반영 + 양방향 동기화 | ✅ |
| 2 | 연료봉 지원: Gap, MWR, Cladding | ✅ |
| 3 | Thermal Property 에디터: 201MMMNN 카드 | ✅ |

### Valve ✅

**문서**: [Valve_Implementation_Plan.md](../Valve_Implementation_Plan.md) / [FEAT-valve.md](../features/FEAT-valve.md)

- 3종 서브타입: mtrvlv, trpvlv, srvvlv
- VolumeReference 기반 From/To 연결
- Trip/Control Variable 연동
- 카드 생성 + 검증

### Control Variable 🚧

**문서**: [FEAT-control-variable.md](../features/FEAT-control-variable.md)

| Priority | 타입 | 상태 |
|----------|------|------|
| P0 | CONSTANT, SUM, TRIPUNIT | ✅ 구현 완료 |
| P1 | FUNCTION, MULT, PROP-INT, INTEGRAL | ⏳ |
| P2 | STDFNCTN, TRIPDLAY, DIV, LAG, LEAD-LAG, etc. | ⏳ |

---

## 주요 파일 참조

### 페이지/레이아웃

| 파일 | 설명 |
|------|------|
| [EditorPage.tsx](../../src/pages/EditorPage.tsx) | 에디터 메인 페이지 |
| [FlowCanvas.tsx](../../src/components/FlowCanvas.tsx) | ReactFlow 캔버스 |
| [ComponentPalette.tsx](../../src/components/ComponentPalette.tsx) | 컴포넌트 팔레트 (5 카테고리, 10종) |
| [PropertyPanel.tsx](../../src/components/PropertyPanel.tsx) | 속성 편집 패널 |

### 전역 설정

| 파일 | 설명 |
|------|------|
| [GlobalSettingsDialog.tsx](../../src/components/GlobalSettingsDialog.tsx) | 전역 설정 다이얼로그 (7 탭) |
| [ProjectSetupTab.tsx](../../src/components/globalSettings/ProjectSetupTab.tsx) | Card 100, 101, 102, 110, 115 |
| [SystemConfigTab.tsx](../../src/components/globalSettings/SystemConfigTab.tsx) | System Config (120-129) |
| [SimulationControlTab.tsx](../../src/components/globalSettings/SimulationControlTab.tsx) | Card 200, Time Phases |
| [MinorEditsTab.tsx](../../src/components/globalSettings/MinorEditsTab.tsx) | Cards 301-399 |
| [VariableTripsTab.tsx](../../src/components/globalSettings/VariableTripsTab.tsx) | Cards 401-599 |
| [ControlVariablesTab.tsx](../../src/components/globalSettings/ControlVariablesTab.tsx) | Cards 205CCCNN |
| [ThermalPropertiesTab.tsx](../../src/components/globalSettings/ThermalPropertiesTab.tsx) | Cards 201MMMNN |

### 코어 모듈

| 파일 | 설명 |
|------|------|
| [useStore.ts](../../src/stores/useStore.ts) | Zustand 상태 관리 (40+ 액션) |
| [mars.ts](../../src/types/mars.ts) | TypeScript 타입 정의 (모든 MARS 타입) |
| [fileGenerator.ts](../../src/utils/fileGenerator.ts) | MARS .i 파일 생성 (13+ 생성 메서드) |
| [globalSettingsValidation.ts](../../src/utils/globalSettingsValidation.ts) | 전역 설정 검증 (6 함수) |
| [componentValidation.ts](../../src/utils/componentValidation.ts) | 컴포넌트 검증 (6 함수) |
| [nodeIdResolver.ts](../../src/utils/nodeIdResolver.ts) | VolumeReference ↔ Volume ID 변환 |

---

## 관련 Feature 문서

| 문서 | 기능 | 상태 |
|------|------|------|
| [FEAT-control-variable.md](../features/FEAT-control-variable.md) | Control Variable (205CCCNN) | 🚧 P0 완료 |
| [FEAT-valve.md](../features/FEAT-valve.md) | Valve 컴포넌트 | ✅ |
| [FEAT-heat-structure.md](../features/FEAT-heat-structure.md) | Heat Structure | ✅ |
| [HeatStructure_Development_Plan.md](../analysis/HeatStructure_Development_Plan.md) | HS 상세 개발 계획 | ✅ |
| [Valve_Implementation_Plan.md](../Valve_Implementation_Plan.md) | Valve 구현 계획 | ✅ |
| [HeatStructure_Volume_Connection_Design.md](../analysis/HeatStructure_Volume_Connection_Design.md) | HS↔Volume 동적 핸들 설계 | ⏳ |

---

## 잔여 작업 (선택적)

### Control Variable P1

- [ ] FUNCTION, MULT, PROP-INT, INTEGRAL 타입 UI + 파일 생성 + 검증
- [ ] 변수 참조 Autocomplete UI
- [ ] 순환 참조 감지 (DFS)

### Heat Structure 개선

- [ ] 동적 핸들 + Convection 엣지 구현 ([설계 문서](../analysis/HeatStructure_Volume_Connection_Design.md))
- [ ] nh/np 변경 시 테이블 자동 동기화
- [ ] Additional BC 12/13-word 포맷 확장

### Thermal Property 확장

- [ ] 다항식 함수 입력 (W2=2, W3=2): 계수 A0~A5 UI
- [ ] 재료 프리셋 저장/불러오기
- [ ] CSV/Excel 임포트

---

## Decisions

| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2025-01-30 | ReactFlow 기반 노드 에디터 | 풍부한 생태계, React 친화적 | cytoscape.js, D3.js |
| 2025-01-30 | Zustand 상태 관리 | 간결함, 보일러플레이트 최소 | Redux, Jotai |
| 2026-02-02 | VolumeReference 패턴 | 불변 nodeId 참조로 안정성 확보 | 7자리 컴포넌트 ID 직접 참조 |
| 2026-02-03 | Discriminated Union (CV) | 타입별 데이터 구조 안전하게 분리 | 단일 범용 인터페이스 |
| 2026-02-05 | CV P0 우선순위 | SMART에서 가장 많이 사용되는 3종 먼저 | 전체 동시 구현 |

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-05 | Control Variable P0 구현 완료 | CONSTANT/SUM/TRIPUNIT, 205CCCNN 카드 |
| 2026-02-05 | 문서 전면 재작성 | 10종 컴포넌트, 7탭 GS, 파일 생성/검증 상세 |
| 2026-02-02 | Valve 컴포넌트 구현 | mtrvlv/trpvlv/srvvlv 3종 |
| 2026-02-02 | Thermal Property 에디터 완료 | 201MMMNN 카드, 재료 드롭다운 연동 |
| 2026-02-02 | Heat Structure 전체 완료 | Phase 1~3, 연료봉/BC 양방향 동기화 |
| 2025-01-30 | Phase 1 문서 작성 | MVP 완료 상태 정리 (5종 컴포넌트) |
