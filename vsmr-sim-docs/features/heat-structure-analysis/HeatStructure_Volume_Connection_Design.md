# Heat Structure - Volume 연결 설계

> **상위 문서**: [HeatStructure_Development_Plan.md](./HeatStructure_Development_Plan.md)
> **작성일**: 2026-02-02
> **상태**: 설계 완료, 구현 대기

---

## 1. 개요

Heat Structure의 Left/Right Boundary Condition(BC)을 Volume 컴포넌트와 연결하는 방법에 대한 설계 문서입니다.

### 1.1 문제 정의

Heat Structure의 BC 연결은 일반적인 Junction 연결과 다른 특성을 가집니다:

| 구분 | Junction 연결 | Heat Structure BC 연결 |
|------|--------------|----------------------|
| **목적** | 유체 흐름 (질량, 운동량) | 대류 열전달 (에너지) |
| **연결 대상** | Volume의 inlet/outlet **면** | Volume **전체** (내부 유체) |
| **Face 값** | 1(inlet), 2(outlet) | 0(legacy, 자동) |
| **방향성** | source → target | 방향 무관 |

### 1.2 SMART 파일 분석 결과

SMART_SIM_BASE_REV01.i 파일에서 Heat Structure BC 패턴을 분석한 결과:

| 패턴 | 예시 | 빈도 |
|------|------|------|
| **Left ≠ Right** (다른 볼륨) | S3702 (SG tube): 370140000 ↔ 230010000 | **다수** |
| **한쪽 연결 + 한쪽 단열** | S3150 (Steam Pipe): 315010000 ↔ 0 | **가장 흔함** |
| **Left = Right** (같은 볼륨) | S1100 (지지판): 110010000 ↔ 110010000 | 소수 |

**결론**: 양쪽 독립적으로 다른 볼륨 연결이 필수 기능!

---

## 2. 설계 결정

### 2.1 연결 방식: BC 탭 수동 입력 + 동적 엣지 생성

ReactFlow의 source→target 제약으로 인해 **드래그 연결 대신 수동 입력 방식** 채택:

```
1. 사용자가 Heat Structure 노드 선택
2. Property Panel → Left/Right BC 탭에서 Volume 선택 (Autocomplete)
3. 저장 시 자동으로 convection 엣지 생성
4. Volume 노드에 동적 핸들 추가
```

### 2.2 동적 핸들

Volume 노드의 data에 Heat Structure 연결 정보 저장 → 노드 리렌더링 시 핸들 조건부 렌더링:

```typescript
// Volume 노드 parameters에 추가
heatStructureConnections?: {
  hsNodeId: string;      // Heat Structure 노드 ID
  hsSide: 'left' | 'right';  // 어느 쪽 BC인지
}[];
```

**시각적 표현**:
```
       ┌──────────────┐
   ●───┤  Vol 110-01  ├───●   (기존 inlet/outlet)
       │      ●       │       ← 동적 핸들 (빨간색, Heat Structure 연결됨)
       └──────┬───────┘
              ┊ (빨간 점선)
       ┌──────┴───────┐
       │ HeatStr S1100│
       └──────────────┘
```

### 2.3 엣지 타입 추가: `convection`

```typescript
// mars.ts
export type ConnectionType = 'axial' | 'crossflow' | 'convection';
```

| 타입 | 용도 | 색상 | 선 스타일 | 화살표 |
|------|------|------|----------|--------|
| axial | 흐름 (축방향) | 파랑 `#2196F3` | 실선 | ● 있음 |
| crossflow | 흐름 (측면) | 주황 `#FF9800` | 실선 | ● 있음 |
| **convection** | **열전달** | 빨강 `#F44336` | **점선** | ○ 없음 |

---

## 3. 연결 가능한 컴포넌트

### 3.1 매뉴얼 기준

> "hydrodynamic volume number (of the form CCCNN000F)"
> "The boundary volume cannot be a time-dependent volume" (for convective BC type 101)

### 3.2 컴포넌트 목록

| 컴포넌트 | 연결 가능? | 비고 |
|----------|-----------|------|
| **snglvol** | ✅ | 단일 볼륨 |
| **pipe** | ✅ | 각 셀(CCCNN000F) |
| **branch** | ✅ | 각 셀 |
| **annulus** | ✅ | 각 셀 |
| **tmdpvol** | ⚠️ 제한적 | BC type 101(convective)에서는 사용 불가, 1000(온도지정)은 가능 |
| **sngljun, valve** | ❌ | 볼륨 아님 |

---

## 4. 수정 파일 목록

### 4.1 타입 정의

| 파일 | 작업 |
|------|------|
| `src/types/mars.ts` | `ConnectionType`에 `convection` 추가 |
| `src/types/mars.ts` | Volume 파라미터에 `heatStructureConnections` 추가 |

### 4.2 Volume 노드 컴포넌트 (동적 핸들)

| 파일 | 작업 |
|------|------|
| `src/components/nodes/SnglvolNode.tsx` | `heatStructureConnections` 기반 동적 핸들 렌더링 |
| `src/components/nodes/PipeNode.tsx` | 동적 핸들 (각 셀별로 여러 개 가능) |
| `src/components/nodes/BranchNode.tsx` | 동적 핸들 |
| `src/components/nodes/TmdpvolNode.tsx` | 동적 핸들 (BC type 제한 경고 필요) |

### 4.3 Store/로직

| 파일 | 작업 |
|------|------|
| `src/stores/useStore.ts` | `createHeatStructureEdge` 수정 - Volume data 업데이트 포함 |
| `src/stores/useStore.ts` | `deleteHeatStructureEdge` 수정 - Volume data 업데이트 포함 |
| `src/components/forms/HeatStructureForm.tsx` | BC 변경 시 엣지 동기화 로직 강화 |

### 4.4 엣지 스타일

| 파일 | 작업 |
|------|------|
| `src/components/FlowCanvas.tsx` 또는 별도 파일 | `convection` 엣지 타입 스타일 (빨간 점선) |

### 4.5 Heat Structure 노드 (선택)

| 파일 | 작업 |
|------|------|
| `src/components/nodes/HeatStructureNode.tsx` | Left/Right 핸들 제거 또는 시각적 표시만 유지 |

---

## 5. 구현 순서

| Step | 파일 | 작업 | 우선순위 |
|------|------|------|---------|
| 1 | `mars.ts` | `ConnectionType`에 `convection` 추가, `heatStructureConnections` 타입 추가 | 높음 |
| 2 | `useStore.ts` | `createHeatStructureEdge`에 Volume data 업데이트 로직 추가 | 높음 |
| 3 | `useStore.ts` | `deleteHeatStructureEdge`에 Volume data 업데이트 로직 추가 | 높음 |
| 4 | `SnglvolNode.tsx` | 동적 핸들 렌더링 | 높음 |
| 5 | `FlowCanvas.tsx` | `convection` 엣지 스타일 적용 | 중간 |
| 6 | `PipeNode.tsx` | 동적 핸들 렌더링 | 중간 |
| 7 | `BranchNode.tsx` | 동적 핸들 렌더링 | 중간 |
| 8 | `TmdpvolNode.tsx` | 동적 핸들 + BC type 경고 | 낮음 |
| 9 | `HeatStructureNode.tsx` | 기존 핸들 정리 (선택) | 낮음 |

---

## 6. 양방향 동기화 로직

### 6.1 BC 추가 시 (HeatStructureForm.tsx → useStore.ts)

```typescript
// 1. Heat Structure BC에 boundaryVolume 설정
leftBoundaryConditions[0].boundaryVolume = '110010000';

// 2. 저장 시 createHeatStructureEdge 호출
createHeatStructureEdge(hsNodeId, 'left', volumeRef);

// 3. createHeatStructureEdge 내부에서:
//    a. 엣지 생성
//    b. Volume 노드 data 업데이트 (heatStructureConnections 추가)
```

### 6.2 BC 삭제 시

```typescript
// 1. Heat Structure BC에서 boundaryVolume 제거
leftBoundaryConditions[0].boundaryVolume = null;

// 2. 저장 시 deleteHeatStructureEdge 호출
deleteHeatStructureEdge(hsNodeId, 'left');

// 3. deleteHeatStructureEdge 내부에서:
//    a. 엣지 삭제
//    b. Volume 노드 data 업데이트 (heatStructureConnections에서 제거)
```

### 6.3 Volume 삭제 시

```typescript
// 1. Volume 노드 삭제 감지 (onNodesDelete 또는 onNodesChange)
// 2. 해당 Volume을 참조하는 모든 Heat Structure BC 초기화
// 3. 관련 엣지 삭제
```

---

## 7. UI/UX 고려사항

### 7.1 시각적 피드백

- **연결된 Volume**: 동적 핸들 표시 (빨간색)
- **연결 엣지**: 빨간 점선으로 흐름 연결과 명확히 구분
- **BC 탭**: 연결 상태 Alert 표시 (기존 Phase 1.5 기능)

### 7.2 Submerged Structure 모드 (선택적 개선)

양면이 같은 볼륨에 연결된 경우(예: S1100)를 위한 편의 기능:

```
┌─ Boundary Configuration ─────────────────────────────┐
│                                                       │
│  ☑ Submerged Structure (양면 동일 볼륨)               │
│     └─ Surrounding Volume: [Volume 110-01 ▼]         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

체크 시 하나의 볼륨 선택으로 Left/Right BC 모두 동일하게 설정.

---

## 8. 테스트 시나리오

### 8.1 기본 연결

1. Heat Structure 생성
2. Left BC 탭에서 Volume 선택 → 저장
3. 확인: 엣지 생성, Volume에 동적 핸들 표시

### 8.2 양면 다른 볼륨 연결

1. Heat Structure 생성
2. Left BC: Volume A 선택
3. Right BC: Volume B 선택
4. 저장
5. 확인: 두 개의 엣지 생성, 각 Volume에 동적 핸들 표시

### 8.3 BC 삭제

1. 연결된 Heat Structure 선택
2. Left BC 탭에서 boundaryVolume 삭제
3. 저장
4. 확인: 엣지 삭제, Volume의 동적 핸들 제거

### 8.4 Volume 삭제

1. Heat Structure와 연결된 Volume 삭제
2. 확인: 엣지 삭제, Heat Structure BC 초기화

### 8.5 파일 생성 확인

1. 연결 설정 후 Export
2. 확인: 501/601 카드에 올바른 볼륨 ID 출력 (CCCNN000F 형식)

---

## 9. 참조

- **MARS 매뉴얼**: Section 9.16 (Left BC), Section 9.17 (Right BC)
- **SMART 참조 파일**: `SMART_SIM_BASE_REV01.i`
- **기존 구현**: Phase 1.5 (엣지→BC 자동 반영), Phase 1.5.1 (양방향 동기화)

---

## 10. Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-02 | 설계 문서 작성 | SMART 파일 분석, 동적 핸들 방식 결정 |
