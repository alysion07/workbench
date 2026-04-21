---
title: "FEAT: Tank 컴포넌트"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT: Tank 컴포넌트

> **Parent**: [PHASE-03-advanced-components.md](../phases/PHASE-03-advanced-components.md)
> **Status**: ⏳ 계획 수립 완료
> **Created**: 2026-03-12

---

## Overview

MARS 시뮬레이터의 **Tank** 컴포넌트 구현. Branch의 특수 변형으로, 수위(Level) 추적 기능이 추가된 볼륨형 컴포넌트.

**핵심 차이**: Branch와 동일한 카드 체계를 공유하되, Tank 전용 카드 2종(초기 수위 CCC0400, 체적-수위 곡선 CCC0401-0499)이 추가됨.

---

## Architecture Decision: 별도 컴포넌트 (Turbine 선례 따름)

**선택**: `ComponentType`에 `'tank'`를 추가하고, 전용 타입/폼/노드/파일생성 구현

**근거**:
1. Turbine이 이미 Branch 특수 변형을 **별도 타입**으로 구현한 선례
2. `ComponentType`에 `'tank'`가 명시적으로 존재 → 타입 안전성
3. Tank 전용 기능 확장 시 Branch 코드 오염 없음
4. connectionSync는 `tank: branchHandler` 한 줄 등록으로 해결 (Turbine 패턴)

**공통 로직 재사용 전략**:
- `BranchJunction` 인터페이스 재사용 (Tank도 동일한 junction 구조)
- `CrossflowVolumeData` 인터페이스 재사용
- `connectionSync.ts`: `tankHandler = { ...branchHandler }` (Turbine 패턴)
- `BranchForm.tsx`의 공통 섹션(Geometry, Junction, InitialConditions)을 참조하되, TankForm은 독립 파일

---

## Manual Reference

- **PDF**: MARS-KS Code Manual, Volume II-Input Requirement (2022.2)
- **Section**: 8.10 Branch or Tank Component, BRANCH or TANK (문서 p.114~125, PDF p.132~143)

### Branch와 Tank의 차이 (매뉴얼 근거)

| 항목 | Branch | Tank |
|------|--------|------|
| CCC0000 W2 | `branch` | `tank` |
| CCC0001~CCCN201 | 동일 | 동일 |
| **CCC0400** | 없음 | **필수** — 초기 수위 (m) |
| **CCC0401-0499** | 없음 | **필수** — 체적 vs 수위 곡선 |
| Volume 번호 | CCC010000 | CCC010000 (동일) |
| Junction 번호 | CCCJJ0000 (01≤JJ≤09) | CCCJJ0000 (01≤JJ≤09) |

### Card Specifications (전체)

| Card | 용도 | 필수 | Branch 공유 | Tank 전용 |
|------|------|:---:|:---:|:---:|
| CCC0000 | Component 정의 (`tank`) | Y | ✅ | - |
| CCC0001 | Component Info (nj, ICC) | Y | ✅ | - |
| CCC0101-0109 | X-Coordinate Volume Data (9 words) | Y | ✅ | - |
| CCC0111 | ORNL ANS Interphase Values | b=2일때 | ✅ | - |
| CCC0131 | Additional Wall Friction | N | ✅ | - |
| CCC0181-0189 | Y-Coordinate Crossflow Data | N | ✅ | - |
| CCC0191-0199 | Z-Coordinate Crossflow Data | N | ✅ | - |
| CCC0200 | Volume Initial Conditions | Y | ✅ | - |
| CCCN101-N109 | Junction Geometry (N=1~9) | nj>0 | ✅ | - |
| CCCN110 | Junction Diameter/CCFL | N | ✅ | - |
| CCCN112 | Junction Form Loss Data | N | ✅ | - |
| CCCN201 | Junction Initial Conditions | nj>0 | ✅ | - |
| **CCC0400** | **Initial Liquid Level** | **Y** | - | ✅ |
| **CCC0401-0499** | **Volume vs Level Curve** | **Y** | - | ✅ |

### Tank 전용 카드 상세

**CCC0400 — Initial Liquid Level** (필수)
| Word | 타입 | 설명 |
|------|------|------|
| W1(R) | float | 초기 수위 (m 또는 ft) |

**CCC0401-0499 — Volume vs Level Curve** (필수, 복수 카드 가능)
| Word | 타입 | 설명 |
|------|------|------|
| W1(R) | float | 체적 (m³ 또는 ft³) |
| W2(R) | float | 수위 (m 또는 ft) |

- 최소 2쌍 이상의 (volume, level) 데이터 필요 (곡선 정의)
- 카드 번호는 연속적이지 않아도 됨
- 데이터는 level 기준 오름차순이어야 함

---

## Requirements

### 1. 타입 정의 (mars.ts)

#### 1.1 TankParameters 인터페이스 (신규)

```typescript
export interface VolumeLevelPair {
  volume: number;   // m³
  level: number;    // m (오름차순)
}

export interface TankParameters {
  // Basic Info
  name: string;

  // Number of junctions (Card CCC0001) — Branch와 동일
  njuns: number;                   // 0-9
  initialConditionControl?: 0 | 1; // 0=velocity, 1=mass flow (default: 0)

  // Volume Geometry (Card CCC0101) — Branch와 동일
  area?: number;                   // m²
  length: number;                  // m
  volume: number;                  // m³
  azAngle?: number;                // degree
  incAngle: number;                // degree
  dz: number;                      // m
  wallRoughness?: number;          // m
  hydraulicDiameter: number;       // m
  tlpvbfe?: string;                // 7-digit flags

  // Initial Conditions (Card CCC0200) — Branch와 동일
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;                // Pa
  temperature?: number;            // K
  quality?: number;                // 0-1

  // Junctions (Card CCCN101-N109) — BranchJunction 재사용
  junctions: BranchJunction[];

  // Crossflow (Optional) — Branch와 동일
  yCrossflowData?: CrossflowVolumeData;
  zCrossflowData?: CrossflowVolumeData;

  // ====== Tank 전용 필드 ======
  // Initial Liquid Level (Card CCC0400)
  initialLiquidLevel: number;      // m (필수)

  // Volume vs Level Curve (Card CCC0401-0499)
  volumeLevelCurve: VolumeLevelPair[];  // 최소 2쌍 (필수)
}
```

#### 1.2 ComponentType 확장

```typescript
export type ComponentType =
  | 'snglvol' | 'sngljun' | 'pipe' | 'branch'
  | 'tmdpvol' | 'tmdpjun' | 'mtpljun' | 'pump'
  | 'htstr' | 'valve' | 'turbine'
  | 'tank';  // 신규 추가

export type ComponentParameters =
  | SnglvolParameters | SngljunParameters | PipeParameters
  | BranchParameters | TmdpvolParameters | TmdpjunParameters
  | MtpljunParameters | PumpParameters | HeatStructureParameters
  | ValveParameters | TurbineParameters
  | TankParameters;  // 신규 추가
```

#### 1.3 타입 가드

```typescript
export function isTankParameters(params: Partial<ComponentParameters>): params is TankParameters {
  return 'initialLiquidLevel' in params && 'volumeLevelCurve' in params;
}
```

### 2. UI — TankForm.tsx (신규)

BranchForm.tsx를 참조하되 독립 파일로 구현.

#### 2.1 폼 구조 (탭 또는 섹션)

| 섹션 | 내용 | Branch 대비 |
|------|------|------------|
| **Basic Info** | name, componentId, njuns | 동일 |
| **Volume Geometry** | area, length, volume, angles, wall | 동일 |
| **Initial Conditions** | ebt, pressure, temperature/quality | 동일 |
| **Tank Level** | initialLiquidLevel, volumeLevelCurve | **Tank 전용** |
| **Junctions** | junction 편집 (from/to, loss, flags) | 동일 |

#### 2.2 Tank Level 섹션 UI

**Initial Liquid Level**:
- NumericTextField, 단위: m, 범위: ≥ 0

**Volume-Level Curve 테이블**:
- 행 추가/삭제 가능한 테이블 (TmdpvolForm.tsx의 timeTable 패턴 참조)
- 열: Volume (m³), Level (m)
- 행 추가 버튼 (+), 행 삭제 버튼 (-), 최소 2행
- level 오름차순 검증

#### 2.3 UX 통일성

| UX 패턴 | 참조 컴포넌트 | 적용 |
|---------|-------------|------|
| 데이터 테이블 (행 추가/삭제) | TmdpvolForm.tsx (timeTable) | volumeLevelCurve |
| Junction 편집 (동적 개수) | BranchForm.tsx | junctions |
| VolumeReference Autocomplete | BranchForm.tsx | from/to 연결 |
| NumericTextField | 전체 폼 공통 | 숫자 입력 |
| Geometry 검증 (A×L=V) | BranchForm.tsx | validateBranchGeometry 재사용 |

### 3. TankNode.tsx (신규)

BranchNode.tsx를 기반으로 독립 파일 생성.

- **핸들 구조**: Branch와 동일 (dynamic junction handles — inlet/outlet)
- **auto-connect 핸들**: 동일 패턴
- **표시**: `formatDisplayId(componentId, 'tank')` → `C` + 3자리 (또는 별도 포맷)
- **시각 구분**: 기본 배경색을 Branch와 다르게 설정 (예: 연한 파란색)
- **NodeResizer**: 동일

### 4. 파일 생성 — generateTankCards() (신규)

```typescript
// fileGenerator.ts
case 'tank':
  if (isTankParameters(parameters)) {
    cards.push(...this.generateTankCards(componentId, componentName, parameters));
  }
  break;
```

`generateTankCards()`는 `generateBranchCards()`를 기반으로:
1. CCC0000의 타입을 `tank`으로 출력
2. CCC0001 ~ CCCN201 까지 Branch와 동일한 로직
3. **CCC0400**: `initialLiquidLevel` 출력
4. **CCC0401-0499**: `volumeLevelCurve` 쌍 출력

### 5. ConnectionSync

```typescript
// connectionSync.ts — handler registry에 추가
const tankHandler: ConnectionHandler = {
  parseHandle: branchHandler.parseHandle,
  onEdgeCreated: branchHandler.onEdgeCreated,
  onEdgeDeleted: branchHandler.onEdgeDeleted,
  buildExpectedEdges: branchHandler.buildExpectedEdges,
  cleanupOrphanedRefs: branchHandler.cleanupOrphanedRefs,
};

// registry
const handlers: Record<string, ConnectionHandler> = {
  // ... 기존 ...
  tank: tankHandler,  // 추가
};
```

`edgeSyncUtils.ts`에도 `case 'tank':` 추가 (branch와 동일 로직).

### 6. ComponentPalette 확장

| 카테고리 | 항목 | componentType |
|---------|------|---------------|
| PIPING (기존) | Branch | `branch` |
| **PIPING (신규)** | **Tank** | **`tank`** |

### 7. useStore.ts 확장

- `nodeTypes`에 `tank: TankNode` 등록
- `PropertyPanel`에서 `componentType === 'tank'`일 때 `TankForm` 렌더링
- 드래그 생성 시 Tank 기본 파라미터 설정

### 8. 유효성 검증

#### 8.1 공통 (Branch 로직 재사용)
- `njuns` 범위: 0~9
- 기하학: area × length ≈ volume
- Junction: from/to VolumeReference 유효성

#### 8.2 Tank 전용
| 규칙 | 심각도 | 메시지 |
|------|--------|--------|
| `initialLiquidLevel` 미입력 | error | "Tank requires initial liquid level" |
| `volumeLevelCurve` < 2쌍 | error | "Tank requires at least 2 volume-level pairs" |
| level 비오름차순 | warning | "Volume-level curve should be in ascending level order" |
| initialLevel > max(level) | warning | "Initial level exceeds maximum level in curve" |
| initialLevel < min(level) | warning | "Initial level below minimum level in curve" |

---

## From/To Connection Design

> [GUIDE-volume-reference.md](../guides/GUIDE-volume-reference.md) 참조

- **연결 Card**: CCCN101 W1 (From), CCCN101 W2 (To) — Branch와 동일
- **타입 필드**: `BranchJunction.from/to: VolumeReference` — 재사용
- **자동감지**: connectedEdges 기반 — branchHandler 재사용
- **UI**: Autocomplete + Face 선택 — BranchForm 패턴
- **파일 생성**: `NodeIdResolver.getVolumeIdFromReference()` — 재사용
- **검증**: 미연결 경고, 잘못된 참조 에러 — 재사용

---

## Implementation Plan

### Phase 1: 타입 + 기반 (코어)

| Step | 파일 | 작업 |
|------|------|------|
| 1.1 | `mars.ts` | `VolumeLevelPair`, `TankParameters` 인터페이스 추가, `ComponentType`/`ComponentParameters` 확장, `isTankParameters` 타입 가드 |
| 1.2 | `connectionSync.ts` | `tankHandler` 등록 (branchHandler 복사) |
| 1.3 | `edgeSyncUtils.ts` | `case 'tank':` 추가 (branch와 동일) |

### Phase 2: 파일 생성 + 검증

| Step | 파일 | 작업 |
|------|------|------|
| 2.1 | `fileGenerator.ts` | `generateTankCards()` 신규 메서드, case 분기 |
| 2.2 | `componentValidation.ts` | Tank 전용 검증 규칙 |

### Phase 3: 노드 + 폼 UI

| Step | 파일 | 작업 |
|------|------|------|
| 3.1 | `TankNode.tsx` | 신규 — BranchNode 기반, 시각 구분 |
| 3.2 | `TankForm.tsx` | 신규 — BranchForm 기반 + Tank Level 섹션 |

### Phase 4: 통합 (팔레트 + 스토어)

| Step | 파일 | 작업 |
|------|------|------|
| 4.1 | `ComponentPalette.tsx` | Tank 팔레트 항목 추가 |
| 4.2 | `useStore.ts` | nodeTypes 등록, Tank 초기 파라미터, PropertyPanel 분기 |
| 4.3 | `FlowCanvas.tsx` | nodeTypes에 tank 추가 (필요 시) |

---

## 변경 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `mars.ts` | 수정 | TankParameters, ComponentType 확장 |
| `connectionSync.ts` | 수정 | tankHandler 등록 (1줄) |
| `edgeSyncUtils.ts` | 수정 | case 'tank' 추가 |
| `fileGenerator.ts` | 수정 | generateTankCards() 신규 메서드 |
| `componentValidation.ts` | 수정 | Tank 검증 규칙 |
| **`TankNode.tsx`** | **신규** | Tank 노드 컴포넌트 |
| **`TankForm.tsx`** | **신규** | Tank 속성 폼 |
| `ComponentPalette.tsx` | 수정 | Tank 항목 추가 |
| `useStore.ts` | 수정 | nodeTypes, 초기 파라미터, 폼 분기 |
| `FlowCanvas.tsx` | 수정 | nodeTypes 등록 (필요 시) |

---

## Current State

⏳ 요구사항 분석 및 계획 수립 완료. **별도 컴포넌트 방식**으로 구현 대기.
