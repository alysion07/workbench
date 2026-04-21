# 양방향 핸들 (Bidirectional Handle) 가이드

## 배경

MARS 코드에서 볼륨 연결 형식은 `CCCVV000N` (N=face 번호)이며, **동일 face 간 연결이 허용**됩니다.

| 연결 유형 | 예시 | 유효 |
|-----------|------|------|
| face 2 → face 1 | outlet → inlet (일반적) | O |
| face 1 → face 2 | inlet → outlet (역방향) | O |
| face 1 → face 1 | inlet → inlet (동일) | O |
| face 2 → face 2 | outlet → outlet (동일) | O |

> 참조: MARS-KS Code Manual (2022.2), Section 8.1 - "The number N equal to 1 and 2 specifies the inlet and outlet faces"

## 문제

ReactFlow에서 edge가 렌더링되려면:
- `edge.sourceHandle` → source 노드에 `type="source"` + 해당 `id`의 Handle 필요
- `edge.targetHandle` → target 노드에 `type="target"` + 해당 `id`의 Handle 필요

기존에 각 노드는 단방향 핸들만 보유:
- `inlet` (id="inlet") → `type="target"` only
- `outlet` (id="outlet") → `type="source"` only

junction의 `to` 볼륨이 face 2(outlet)를 사용하면, edge의 `targetHandle='outlet'`이 되지만
해당 노드에 `type="target" id="outlet"` 핸들이 없어 **edge가 렌더링되지 않음**.

## 해결: Hidden Reverse Handle

각 핸들에 대해 **반대 type의 숨김 핸들**을 추가합니다.

```tsx
{/* Primary: visible, 사용자 드래그 가능 */}
<Handle type="target" id="inlet" position={...}
  style={{ width: 12, height: 12, backgroundColor: '...', border: '2px solid white', zIndex: 10 }}
/>
{/* Reverse: hidden, 프로그래밍적 연결만 지원 */}
<Handle type="source" id="inlet" position={...}
  style={{ width: 8, height: 8, backgroundColor: '...', border: '1px solid white',
           zIndex: 9, opacity: 0, pointerEvents: 'none' }}
/>
```

### 핵심 속성

| 속성 | Primary Handle | Reverse Handle |
|------|---------------|----------------|
| `type` | 기본 방향 (target/source) | **반대** 방향 |
| `id` | 동일 | **동일** (ReactFlow가 type으로 구분) |
| `opacity` | 1 (보임) | **0** (숨김) |
| `pointerEvents` | auto | **none** (드래그 불가) |
| `zIndex` | 10 | 9 (primary 아래) |

## 적용 범위

### Volume 노드 (reverse 핸들 필요)

| 노드 | 기존 핸들 | 추가된 reverse 핸들 |
|------|----------|-------------------|
| **PipeNode** | face 1 target, face 2 source (셀별) | face 1 source, face 2 target (셀별) |
| **SnglvolNode** | inlet target, outlet source | inlet source, outlet target |
| **TmdpvolNode** | outlet source (+ inlet target 추가) | inlet source, outlet target |
| **PumpNode** | inlet target, outlet source | inlet source, outlet target |

### Junction 노드 (reverse 핸들 불필요)

| 노드 | 이유 |
|------|------|
| SngljunNode | edge 모델에서 항상 inlet=target, outlet=source |
| TmdpjunNode | 동일 |
| ValveNode | 동일 |
| MtpljunNode | 동적 핸들이 항상 올바른 방향 |
| BranchNode | 동적 핸들이 방향 포함 |

### HeatStructureNode (별도 시스템)

열구조체는 junction 연결이 아닌 별도의 경계 조건 시스템을 사용하므로 적용 대상 아님.

## 연결 흐름

```
[사용자 폼 입력]
    ↓ From/To Volume ID (CCCVV000N)
[onSubmit → updateNodeData]
    ↓
[connectionSync.syncEdgesFromParameters]
    ↓
[buildExpectedEdges]
    ↓ resolveHandleForNode(node, ref) → { handleId, handleType }
    ↓ handleType은 무시됨, handleId만 사용
[reconcileEdges]
    ↓ edge.targetHandle = handleId
[ReactFlow 렌더링]
    ↓ type="target" + id=handleId 핸들 검색
    → Reverse 핸들이 있어야 렌더링 성공
```

## 드래그 UX

- **Primary 핸들**: 사용자가 캔버스에서 드래그하여 연결 가능 (일반적 방향만)
- **Reverse 핸들**: `pointerEvents: 'none'`으로 드래그 불가, 폼 기반 연결만 지원
- **비일반적 연결** (face2→face2 등): PropertyPanel 폼에서 Volume ID 직접 입력으로 생성

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/nodes/PipeNode.tsx` | PipeNode 셀별 양방향 핸들 |
| `src/components/nodes/SnglvolNode.tsx` | 단일볼륨 양방향 핸들 |
| `src/components/nodes/TmdpvolNode.tsx` | 시간의존볼륨 양방향 핸들 |
| `src/components/nodes/PumpNode.tsx` | 펌프 양방향 핸들 |
| `src/utils/connectionSync.ts` | edge 생성/조정 로직 |
| `src/utils/edgeSyncUtils.ts` | 핸들 해석 유틸리티 |
| `src/utils/pipeHandleHelpers.ts` | PipeNode 셀 핸들 ID 생성 |
