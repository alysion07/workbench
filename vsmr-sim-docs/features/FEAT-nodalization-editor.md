---
title: "FEAT: Nodalization 편집 기능"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT: Nodalization 편집 기능

> **상태**: Phase 2 구현 완료 + 버그픽스 ✅
> **브랜치**: `alysion/feat_heatstructure`
> **작성일**: 2026-02-11
> **최종 수정**: 2026-02-12

## Current State

### Phase 1 ✅ 완료

| 항목 | 상태 | 설명 |
|------|------|------|
| `NodeAppearance` 타입 정의 | ✅ | `mars.ts`에 `NodeShape`, `NodeRotation`, `NodeAppearance` 추가 |
| `MARSNodeData.appearance` 필드 | ✅ | optional 필드로 하위 호환성 유지 |
| `nodeAppearance.ts` 유틸리티 | ✅ | 기본값, 헬퍼, 색상 프리셋, 도형 유틸 |
| `updateNodeAppearance` 스토어 액션 | ✅ | `useStore.ts`에 추가 |
| Simple 노드 도형 렌더링 (7개) | ✅ | ID+이름만 표시, 도형 기반 Box 렌더링 |
| Complex 노드 배경색 (3개) | ✅ | Pipe/Branch/Mtpljun Paper에 backgroundColor 적용 |
| 드래그 리사이즈 (Simple 노드) | ✅ | NodeResizer `onResize` → store 동기화 |
| AppearanceForm 컴포넌트 | ✅ | 크기(W/H + lock ratio) + 색상 프리셋 + Shape(비활성) |
| PropertyPanel Appearance 탭 | ✅ | Tabs로 Properties / Appearance 전환 |
| 미니맵 색상 반영 | ✅ | `resolveAppearance` 기반 nodeColor |

### Phase 2 ✅ 완료

| 항목 | 상태 | 설명 |
|------|------|------|
| 도형 변경 UI | ✅ | Shape 드롭다운 활성화 (5가지 도형) |
| 도형별 CSS 렌더링 | ✅ | clipPath(triangle/diamond), borderRadius(circle), backgroundImage(hatched-rect) |
| 4방향 회전 | ✅ | ToggleButtonGroup으로 0°/90°/180°/270° 선택 |
| 회전 시 핸들 재매핑 | ✅ | `getRotatedPosition()` 기반 동적 Position 변환 |
| 회전 시 디멘션 스왑 | ✅ | 90°/270°에서 width↔height 스왑 (onResize도 역스왑) |
| Complex 노드 리사이즈 | ⏳ | Pipe/Branch/Mtpljun 동적 콘텐츠 - 향후 과제 |

### 버그픽스 / 개선 ✅

| 항목 | 상태 | 설명 |
|------|------|------|
| Handle z-index 수정 | ✅ | 모든 노드(10개) Handle에 `zIndex: 10` 적용, 노드 콘텐츠 위에 렌더링 |
| 컴포넌트 ID 약식 표기 | ✅ | MARS Nodalization 규칙: 수력학=`C`+앞3자리, 열구조체=`S`+앞4자리 |
| `formatDisplayId()` 유틸 | ✅ | `nodeAppearance.ts`에 추가, 전체 10개 노드에 적용 |

---

## 1. 개요

현재 MUI Paper 카드 형태의 개념적 노드를 **MARS Nodalization 다이어그램 스타일**의 형상 기반 노드로 전환하고, 사용자가 **크기/회전/색상/도형**을 편집할 수 있는 기능 추가.

### 목표
- 컴포넌트의 실제 형상(크기, 방향)을 시각적으로 반영
- Nodalization 다이어그램에 가까운 직관적 표현
- 사용자 커스터마이징으로 계통별 시각적 구분 가능

## 2. 확정 요구사항

| 항목 | 결정 사항 |
|------|-----------|
| **형상** | 기본 도형 기반 (직사각형, 원, 다이아몬드, 삼각형, 해칭 직사각형) |
| **도형 정책** | 타입별 기본 도형 + 사용자가 다른 도형으로 변경 가능 |
| **크기 조절** | 드래그 리사이즈 + 속성 패널 숫자 입력 (양방향 동기화) |
| **회전** | 4방향 프리셋 (0° / 90° / 180° / 270°) |
| **회전 시 텍스트** | 노드 전체와 함께 회전 (CSS transform) |
| **색상** | 배경색만 변경 가능 |
| **편집 UI** | 속성 패널(PropertyPanel)에 **Appearance 탭** 추가 |
| **노드 내부 정보** | MARS 약식 ID (C130, S1200) + 이름 표시 |

## 3. 구현 우선순위

### Phase 1: 크기 + 색상 (MVP) ✅ 완료

- [x] `NodeAppearance` 타입 정의 (`mars.ts`)
- [x] `MARSNodeData`에 `appearance` 필드 추가
- [x] 기본값/헬퍼 유틸 (`nodeAppearance.ts`)
- [x] `updateNodeAppearance` 스토어 액션 (`useStore.ts`)
- [x] 드래그 리사이즈 구현 (ReactFlow 내장 `NodeResizer`)
- [x] `onResize` 콜백으로 store 동기화 (Simple 노드 7개)
- [x] 속성 패널 Appearance 탭 (크기 입력 + 색상 프리셋)
- [x] 배경색 변경 기능 (32색 프리셋 팔레트)
- [x] 노드 렌더링을 도형 기반으로 변경 (Simple 노드 7개)
- [x] Complex 노드 배경색 적용 (Pipe/Branch/Mtpljun)
- [x] 기존 데이터 하위 호환 (`appearance` 없으면 기본값)
- [x] 노드 내부 정보 간략화 (ID + 이름만)
- [x] 미니맵 색상 반영

### Phase 2: 도형 + 회전 ✅ 완료
- [x] Shape 드롭다운 활성화 (rectangle/circle/diamond/triangle/hatched-rect)
- [x] 도형별 CSS 렌더링 (clipPath, borderRadius, backgroundImage)
- [x] hatched-rect 해칭 패턴 (repeating-linear-gradient)
- [x] 4방향 회전 ToggleButtonGroup (0°/90°/180°/270°)
- [x] 회전 시 핸들 위치 재매핑 (`getRotatedPosition`)
- [x] 회전 시 디멘션 스왑 (`getDisplayDimensions`)
- [x] onResize에서 회전 역스왑 처리
- [ ] Complex 노드 리사이즈 대응 (향후 과제)

## 4. 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/mars.ts` | `NodeShape`, `NodeRotation`, `NodeAppearance` 타입 추가, `MARSNodeData.appearance?` |
| `src/stores/useStore.ts` | `updateNodeAppearance` 액션 추가 + `resolveAppearance` import |
| `src/utils/nodeAppearance.ts` | **(신규)** 기본값, 헬퍼, 색상 프리셋, 도형 유틸, `formatDisplayId()` |
| `src/components/forms/AppearanceForm.tsx` | **(신규)** 크기(W/H lock ratio) + 색상 프리셋 + Shape + Rotation + Reset |
| `src/components/PropertyPanel.tsx` | Tabs 추가 (Properties / Appearance), 노드 변경 시 탭 리셋 |
| `src/components/FlowCanvas.tsx` | MiniMap `nodeColor`에 `resolveAppearance` 적용 |
| `src/components/nodes/SnglvolNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/SngljunNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/TmdpvolNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/TmdpjunNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/PumpNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/HeatStructureNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/ValveNode.tsx` | 도형 렌더링 + onResize + Handle zIndex + 약식ID |
| `src/components/nodes/PipeNode.tsx` | 배경색 + NodeResizer + 약식ID |
| `src/components/nodes/BranchNode.tsx` | 배경색 + NodeResizer + Handle zIndex + 약식ID |
| `src/components/nodes/MtpljunNode.tsx` | 배경색 + NodeResizer + Handle zIndex + 약식ID |

### 패키지 추가
- 없음 (`NodeResizer`는 ReactFlow v11.7+ 내장)

## 5. 타입별 기본 도형

| 컴포넌트 | 기본 도형 | 기본 크기 (W x H) | 기본 색상 | 설명 |
|----------|-----------|-------------------|-----------|------|
| SNGLVOL | `rectangle` | 80 x 120 | #E3F2FD | 탱크/헤더 |
| SNGLJUN | `circle` | 40 x 40 | #E8F5E9 | 연결 접합부 |
| PIPE | `rectangle` | 200 x 60 | #FFF3E0 | 배관 (가로 긴) |
| BRANCH | `rectangle` | 100 x 150 | #E0F7FA | 다중 분기 |
| TMDPVOL | `triangle` | 80 x 80 | #F3E5F5 | 경계조건 볼륨 |
| TMDPJUN | `triangle` | 50 x 50 | #FCE4EC | 경계 접합부 |
| MTPLJUN | `rectangle` | 100 x 120 | #EFEBE9 | 다중 접합 |
| PUMP | `circle` | 80 x 80 | #F3E5F5 | 펌프 |
| VALVE | `diamond` | 60 x 60 | #F3E5F5 | 밸브 |
| HTSTR | `hatched-rect` | 60 x 120 | #FBE9E7 | 열구조물 |

## 6. 데이터 모델

### NodeAppearance 타입

```typescript
type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hatched-rect';
type NodeRotation = 0 | 90 | 180 | 270;

interface NodeAppearance {
  shape: NodeShape;
  width: number;
  height: number;
  rotation: NodeRotation;
  backgroundColor: string;
}
```

### MARSNodeData 변경

```typescript
export interface MARSNodeData {
  componentId: string;
  componentName: string;
  componentType: ComponentType;
  parameters: Partial<ComponentParameters>;
  status: 'incomplete' | 'valid' | 'error';
  errors: ValidationError[];
  warnings: ValidationError[];
  enableSideConnections?: boolean;
  appearance?: NodeAppearance;  // ← 추가 (optional, 하위 호환)
}
```

## 7. 핸들 위치 매핑 (Phase 2 - 회전)

| 회전 | Inlet (target) | Outlet (source) |
|------|----------------|-----------------|
| 0°   | Left           | Right           |
| 90°  | Top            | Bottom          |
| 180° | Right          | Left            |
| 270° | Bottom         | Top             |

> CSS `transform: rotate(Xdeg)` 적용 시, 핸들의 ReactFlow Position도 함께 변환 필요.

## 8. 기술적 구현 세부사항

### NodeResizer 리사이즈

- ReactFlow v11.7+ 내장 `NodeResizer` 컴포넌트 사용 (별도 패키지 불필요)
- Simple 노드: `onResize` 콜백 → `updateNodeAppearance(id, { width, height })` → store 갱신 → re-render
- Complex 노드: Phase 1에서는 장식용 (동적 콘텐츠가 크기 결정)
- `lineStyle`/`handleStyle`에 `zIndex: 10` 필수 (노드 콘텐츠 Box의 `position: relative` 위에 렌더링)

### 도형 렌더링 (Phase 2)
- `rectangle`: 기본 div + border-radius
- `circle`: border-radius: 50%
- `diamond`: CSS clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
- `triangle`: CSS clip-path: polygon(50% 0%, 100% 100%, 0% 100%)
- `hatched-rect`: SVG pattern (해칭 무늬)

### 하위 호환성
- `appearance` 필드가 `undefined`이면 `resolveAppearance()` → `getDefaultAppearance(componentType)` 사용
- 기존 저장된 프로젝트 JSON은 수정 없이 로드 가능
- 첫 편집 시 기본값으로 appearance 필드 생성

### 미니맵 반영
- ReactFlow MiniMap의 `nodeColor` 콜백에서 `resolveAppearance` → `backgroundColor` 사용
- 도형은 미니맵에서 단순 사각형으로 표시 (MiniMap 제약)

## 9. 열린 질문 (향후 결정)

- [ ] Complex 노드(Pipe/Branch/Mtpljun)의 리사이즈 방식? (width만 vs width+height)
- [ ] 노드 그룹핑/계통별 색상 일괄 적용 기능?
- [ ] 줌 레벨에 따른 정보 표시 수준 (LOD)?

## 10. 다음 단계

1. ~~Phase 1 구현~~ ✅
2. ~~Phase 2 구현~~ ✅
3. Complex 노드 리사이즈 대응 (향후 과제)
4. 테스트 및 기존 데이터 호환성 검증
