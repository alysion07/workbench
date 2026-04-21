---
title: "DESIGN: Control Input → 노드 위치 찾기 기능"
status: done
phase: 4
branch: main
related_prs: [#80]
last_updated: 2026-04-03
---

# DESIGN: Control Input → 노드 위치 찾기 기능

> **Created**: 2026-04-01  
> **Status**: Draft  
> **Related**: FEAT-interactive-node-widgets, GUIDE-data-visualization

---

## 1. 개요

Control Input 섹션의 TripInputCard / GeneralICVCard에서 **위치 찾기 버튼** 클릭 시, 해당 ICV가 제어하는 캔버스 노드로 뷰포트를 이동하고 하이라이트 효과를 적용한다.

---

## 2. 데이터 흐름 설계

### 2.1 ICV → NodeId 매칭 맵 (`icvLocateMap`)

기존 `autoEnabledNodeIds` 로직(L341-390)의 CCC 맵을 재활용하여, **InteractiveInput별 nodeId 매칭 맵**을 별도로 구축한다.

```
InteractiveControlViewInner
│
├─ 기존: cccMap (CCC → nodeId)           ← L346-354
│
└─ 신규: icvLocateMap (cardNumber → nodeId)
         │
         ├─ trip 타입:
         │    input.parameter (tripNumber)는 CCC가 아님
         │    → 밸브 노드의 parameters에서 tripNumber를 참조하는 노드 탐색
         │    → 매칭 실패 시 null (버튼 disabled)
         │
         └─ non-trip 타입 (vlvarea, mflowfj, mflowgj, power):
              input.parameter에서 CCC 추출 → cccMap 조회
              → 매칭 성공 시 nodeId 반환
```

```typescript
// InteractiveControlView.tsx 내부 (신규 useMemo)
const icvLocateMap = useMemo(() => {
  const map = new Map<number, string>(); // cardNumber → nodeId

  // CCC → nodeId 맵 (기존 cccMap 로직 재활용)
  const cccMap = new Map<string, string>();
  for (const node of nodes) {
    const cid = (node.data as MARSNodeData).componentId;
    if (!cid) continue;
    const num = parseInt(cid, 10);
    const ccc = num >= 10000000 ? cid.slice(0, 4) : cid.slice(0, 3);
    cccMap.set(ccc, node.id);
    cccMap.set(cid, node.id);
  }

  // tripNumber → nodeId 맵 (밸브 노드의 trip 참조 스캔)
  const tripToNodeMap = new Map<number, string>();
  for (const node of nodes) {
    const data = node.data as MARSNodeData;
    if (data.componentType !== 'valve') continue;
    const params = data.parameters as Record<string, unknown> | undefined;
    // trpvlv의 tripNumber 필드 확인
    const tripNum = params?.tripNumber;
    if (typeof tripNum === 'number' && tripNum > 0) {
      tripToNodeMap.set(tripNum, node.id);
    }
  }

  for (const input of (interactiveInputs ?? [])) {
    if (input.controlType === 'trip') {
      // Trip → 밸브 노드 매칭
      const tripNum = typeof input.parameter === 'string'
        ? parseInt(input.parameter, 10) : input.parameter;
      const nodeId = tripToNodeMap.get(tripNum);
      if (nodeId) map.set(input.cardNumber, nodeId);
    } else {
      // Non-trip → CCC 직접 매칭
      const ccc = String(input.parameter).slice(0, 3);
      const nodeId = cccMap.get(ccc);
      if (nodeId) map.set(input.cardNumber, nodeId);
    }
  }

  return map;
}, [nodes, interactiveInputs]);
```

### 2.2 콜백 흐름

```
SidePanel (props)
  ├─ onLocateNode?: (cardNumber: number) => void    ← 신규 prop
  │
  ├─ ControlInputContent
  │   ├─ TripInputCard → 🔍 클릭 → onLocateNode(input.cardNumber)
  │   └─ GeneralICVCard → 🔍 클릭 → onLocateNode(???)
  │        ※ GeneralICVEntry에는 cardNumber가 없음 → objectId 기반으로 변경
  │
  └─ (대안) onLocateNodeByCCC?: (cccno: number) => void

```

**결정**: GeneralICVEntry는 `cardNumber`가 없고 `cccno`를 가지므로, 두 카드 타입을 통합하려면 콜백을 **두 개**로 분리하거나 **union 파라미터**로 설계한다.

```typescript
// 통합 콜백 시그니처
onLocateNode?: (lookup: { type: 'trip'; cardNumber: number } | { type: 'general'; cccno: number }) => void;
```

→ 심플하게 **nodeId를 직접 전달**하는 방식이 가장 깔끔하다:

```typescript
// 최종 결정: SidePanel에 nodeId 직접 전달
onLocateNode?: (nodeId: string) => void;

// SidePanel 내부에서 호출 시:
// TripInputCard:  onLocateNode(icvLocateMap.get(input.cardNumber))
// GeneralICVCard: onLocateNode(resolvedNodeId)
```

하지만 SidePanel은 `icvLocateMap`을 모르므로, **매칭 결과를 prop으로 전달**해야 한다.

---

## 3. 컴포넌트 설계

### 3.1 InteractiveControlViewInner (변경)

```
파일: src/components/interactive/InteractiveControlView.tsx
```

**추가 상태:**
```typescript
// 하이라이트 대상 노드 ID (3초 후 자동 해제)
const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
```

**추가 핸들러:**
```typescript
const handleLocateNode = useCallback((nodeId: string) => {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) return;

  // 뷰포트 이동
  const x = targetNode.position.x + ((targetNode.width ?? 100) / 2);
  const y = targetNode.position.y + ((targetNode.height ?? 50) / 2);
  setCenter(x, y, { zoom: 0.8, duration: 500 });

  // 하이라이트 설정 (3초 후 자동 해제)
  if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  setHighlightedNodeId(nodeId);
  highlightTimerRef.current = setTimeout(() => setHighlightedNodeId(null), 3000);
}, [nodes, setCenter]);
```

**SidePanel prop 추가:**
```tsx
<SidePanel
  // ... 기존 props
  icvNodeMap={icvNodeMap}           // Map<number, string> (cardNumber → nodeId)
  generalIcvNodeMap={generalIcvNodeMap}  // Map<number, string> (cccno → nodeId)
  onLocateNode={handleLocateNode}   // (nodeId: string) => void
/>
```

**highlightedNodeId를 ReactFlow 노드에 전달:**
```tsx
// wrappedNodes에 highlightedNodeId 반영
const wrappedNodes = useMemo(() =>
  nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      _highlighted: node.id === highlightedNodeId,
    },
  })),
  [nodes, highlightedNodeId]
);
```

### 3.2 SidePanel (변경)

```
파일: src/components/interactive/SidePanel.tsx
```

**Props 추가:**
```typescript
interface SidePanelProps {
  // ... 기존 props
  icvNodeMap?: Map<number, string>;         // cardNumber → nodeId
  generalIcvNodeMap?: Map<number, string>;  // cccno → nodeId
  onLocateNode?: (nodeId: string) => void;
}
```

### 3.3 TripInputCard (변경)

**Props 추가:**
```typescript
interface TripInputCardProps {
  // ... 기존 props
  locatableNodeId?: string | null;  // 매칭된 nodeId (없으면 null)
  onLocate?: (nodeId: string) => void;
}
```

**UI 변경 — hover-only 아이콘:**
```tsx
<Box sx={{ position: 'relative', /* 기존 스타일 */ }}>
  {/* 기존 카드 내용 */}

  {/* 위치 찾기 버튼: hover 시에만 표시 */}
  {locatableNodeId && onLocate && (
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onLocate(locatableNodeId); }}
      sx={{
        position: 'absolute',
        top: 0, right: 0,
        width: 18, height: 18,
        opacity: 0,
        transition: 'opacity 0.15s',
        '.MuiBox-root:hover > &': { opacity: 1 },
        // 또는 부모 Box에 '&:hover .locate-btn': { opacity: 1 }
      }}
    >
      <MyLocationIcon sx={{ fontSize: 12 }} />
    </IconButton>
  )}
</Box>
```

> **아이콘 선택**: `MyLocation` (⊕ 크로스헤어) — "위치 찾기" 의미가 직관적이고, 기존 UI에서 사용하지 않는 아이콘.

**매칭 실패 시**: `locatableNodeId`가 null이면 버튼이 렌더링되지 않음 → 심플한 처리.  
(NFR-2 대안: disabled 상태로 표시하는 것도 가능하나, 카드 공간이 매우 좁으므로 숨기는 것이 적절)

### 3.4 GeneralICVCard (변경)

TripInputCard와 동일한 패턴. `generalIcvNodeMap.get(entry.cccno)` → `locatableNodeId`.

### 3.5 withNodeWidgets.tsx (변경)

```
파일: src/components/interactive/withNodeWidgets.tsx
```

**하이라이트 글로우 추가:**

기존 `monitoredNodeIds` 글로우(파란색 pulse)와 구분되는 **골드 글로우**:

```typescript
// node.data._highlighted === true 시
const HIGHLIGHT_GLOW = {
  boxShadow: '0 0 12px 4px rgba(255, 160, 0, 0.6)',
  animation: 'locateFlash 0.5s ease-in-out 3',  // 3회 깜빡임
};

// CSS keyframes
const locateFlashKeyframes = `
  @keyframes locateFlash {
    0%, 100% { box-shadow: 0 0 12px 4px rgba(255, 160, 0, 0.6); }
    50% { box-shadow: 0 0 20px 8px rgba(255, 160, 0, 0.9); }
  }
`;
```

---

## 4. 상세 시퀀스 다이어그램

```
User                   TripInputCard        SidePanel       InteractiveControlView     ReactFlow     withNodeWidgets
  |                        |                    |                     |                     |              |
  |-- hover card --------->|                    |                     |                     |              |
  |   (🔍 아이콘 표시)      |                    |                     |                     |              |
  |-- click 🔍 ----------->|                    |                     |                     |              |
  |                        |-- onLocate(nodeId) |                     |                     |              |
  |                        |                    |-- onLocateNode(id)->|                     |              |
  |                        |                    |                     |-- setCenter(x,y) -->|              |
  |                        |                    |                     |   {zoom:0.8, 500ms} |              |
  |                        |                    |                     |                     |-- animate -->|
  |                        |                    |                     |-- setHighlighted --->|              |
  |                        |                    |                     |                     |              |-- gold glow
  |                        |                    |                     |                     |              |   (3x flash)
  |                        |                    |                     |-- setTimeout(3s) -->|              |
  |                        |                    |                     |-- clearHighlight -->|              |
  |                        |                    |                     |                     |              |-- fade out
```

---

## 5. CCC 매칭 전략

### 5.1 Non-Trip ICV (직접 매칭)

```
InteractiveInput.parameter  →  String().slice(0,3)  →  cccMap.get(ccc)  →  nodeId
       (예: 150)                    → "150"              → "node-xyz"
```

**성공률**: 높음 — 캔버스에 해당 컴포넌트가 배치되어 있으면 거의 100% 매칭.

### 5.2 Trip ICV (간접 매칭)

```
InteractiveInput.parameter  →  tripNumber  →  tripToNodeMap.get(tripNum)  →  nodeId
       (예: 401)                  401            밸브 노드 파라미터 스캔
```

**매칭 조건**: 캔버스에 해당 trip을 참조하는 `valve` (trpvlv) 노드가 존재해야 함.  
**실패 케이스**: trip이 밸브가 아닌 다른 메커니즘으로 사용되는 경우 → 버튼 미표시.

### 5.3 cccMap 중복 방지

동일 CCC를 가진 노드가 여러 개일 수 있음 (pipe의 여러 볼륨 등).  
현재 `cccMap.set(ccc, node.id)`는 **후자 우선** → 마지막 노드만 매칭됨.  
→ P0에서는 이 동작을 유지하고, 추후 다중 매칭 시 선택 UI를 고려.

---

## 6. 스타일 스펙

### 6.1 위치 찾기 버튼

| 속성 | 값 |
|------|-----|
| 아이콘 | `MyLocation` (MUI Icons) |
| 크기 | 18×18px |
| 아이콘 크기 | 12px |
| 위치 | 카드 우상단 absolute (top: -2, right: -2) |
| 기본 상태 | `opacity: 0` |
| 카드 hover 시 | `opacity: 0.7` → hover 시 `opacity: 1` |
| 색상 | `#1976d2` (파란색) |
| 배경 | `rgba(255,255,255,0.9)` (카드 위 오버레이) |
| border-radius | 50% |

### 6.2 노드 하이라이트

| 속성 | 값 |
|------|-----|
| 색상 | `#ffa000` (앰버/골드) |
| 효과 | `box-shadow: 0 0 12px 4px rgba(255, 160, 0, 0.6)` |
| 애니메이션 | `locateFlash 0.5s ease-in-out` × 3회 |
| 지속 시간 | 3초 후 자동 해제 |
| border | `2px solid #ffa000` (추가 강조) |

### 6.3 뷰포트 이동

| 속성 | 값 |
|------|-----|
| 메서드 | `setCenter(x, y, options)` |
| zoom | `0.8` (노드와 주변 컨텍스트 모두 보이는 수준) |
| duration | `500ms` |
| 대상 좌표 | 노드 중심 (`position.x + width/2`, `position.y + height/2`) |

---

## 7. 변경 파일 목록

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `InteractiveControlView.tsx` | 수정 | `icvLocateMap` + `generalIcvNodeMap` 계산, `handleLocateNode` 핸들러, `highlightedNodeId` 상태, SidePanel prop 전달 |
| `SidePanel.tsx` | 수정 | `icvNodeMap` / `generalIcvNodeMap` / `onLocateNode` prop 추가, TripInputCard/GeneralICVCard에 전달 |
| `withNodeWidgets.tsx` | 수정 | `_highlighted` 플래그에 따른 골드 글로우 렌더링 |

**신규 파일 없음** — 기존 컴포넌트 내에서 모든 변경 수용 가능.

---

## 8. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| CCC 매칭 실패 (노드 미배치) | 버튼 미렌더링 (locatableNodeId === undefined) |
| 동일 CCC 다중 노드 | 후자 우선 (현재 동작 유지) |
| 시뮬레이션 비활성 상태에서 클릭 | 정상 동작 (뷰포트 이동 + 하이라이트는 시뮬레이션 상태와 무관) |
| 연속 빠른 클릭 (다른 카드) | 이전 타이머 clear → 새 노드로 즉시 전환 |
| 이미 화면에 보이는 노드 클릭 | 동일하게 setCenter + 하이라이트 (zoom 재조정 효과) |

---

## 9. 구현 순서

1. `InteractiveControlView.tsx` — `icvLocateMap`, `generalIcvNodeMap` 계산 + `handleLocateNode` 핸들러
2. `SidePanel.tsx` — prop 인터페이스 확장 + 카드에 전달
3. `TripInputCard` / `GeneralICVCard` — hover-only 🔍 버튼 추가
4. `withNodeWidgets.tsx` — 골드 글로우 하이라이트 렌더링
5. `InteractiveControlView.tsx` — `highlightedNodeId`를 wrappedNodes에 반영

---

## 10. 추후 확장 (P1)

- 포커스 시 노드 근처에 컴포넌트 정보 팝오버 표시
- 팝오버 내 위젯 활성화/비활성화 토글
- 다중 CCC 매칭 시 선택 UI
- Alarm Detail 아이템에서도 동일한 위치 찾기 기능 제공
