---
title: "SVG Library Feature - 설계 문서"
status: planned
phase: 2
last_updated: 2026-04-03
---

# SVG Library Feature - 설계 문서

## 1. 개요

Appearance 탭의 Custom SVG 기능을 **외부 SVG 파일 불러오기**로 변경하고,
**프로젝트 SVG 라이브러리** + **컴포넌트 타입별 기본 SVG 매핑** 기능을 추가한다.

### 핵심 원칙
- SVG 마크업을 문자열로 저장 → 이식성 보장
- 라이브러리 참조 ID 방식 → 중복 저장 방지
- P&ID 내장 심볼은 기존 방식 유지 (배경색 오버라이드 O)
- Custom SVG는 원본 색상 유지 (배경색 오버라이드 X)

---

## 2. 데이터 설계

### 2.1 타입 변경 (`src/types/mars.ts`)

```typescript
// ============================================================================
// SVG Library
// ============================================================================

export interface SvgLibraryItem {
  id: string;           // nanoid 생성 (예: "svg_abc123")
  name: string;         // 사용자 지정 이름 (예: "밸브 심볼 A")
  svgMarkup: string;    // sanitized SVG 전체 마크업 (<svg>...</svg>)
  viewBox: string;      // 추출된 viewBox (렌더링 스케일링용)
  createdAt: number;    // Date.now()
}

// ============================================================================
// Node Appearance (변경)
// ============================================================================

export type NodeShape =
  | 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hatched-rect' | 'semicircle'
  | 'valve-bowtie' | 'pump-centrifugal'
  | 'custom';

export interface NodeAppearance {
  shape: NodeShape;
  width: number;
  height: number;
  rotation: NodeRotation;
  backgroundColor: string;
  svgLibraryId?: string;      // 라이브러리 SVG 참조 ID (신규)
  // customSvgPath 제거
}
```

### 2.2 Store 상태 추가 (`src/stores/useStore.ts`)

```typescript
interface EditorState {
  // ... 기존 상태 ...

  // SVG Library (프로젝트 단위)
  svgLibrary: SvgLibraryItem[];
  defaultSvgByType: Partial<Record<ComponentType, string>>;  // ComponentType → svgLibraryId

  // SVG Library Actions
  addSvgToLibrary: (item: Omit<SvgLibraryItem, 'id' | 'createdAt'>) => string;
  removeSvgFromLibrary: (svgId: string) => void;
  setDefaultSvgForType: (componentType: ComponentType, svgId: string | null) => void;
}
```

### 2.3 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  Store                                                       │
│                                                              │
│  svgLibrary: SvgLibraryItem[]                               │
│  ├─ { id: "svg_001", name: "밸브A", svgMarkup: "...", ... } │
│  ├─ { id: "svg_002", name: "펌프B", svgMarkup: "...", ... } │
│  └─ { id: "svg_003", name: "용기C", svgMarkup: "...", ... } │
│                                                              │
│  defaultSvgByType: { valve: "svg_001", pump: "svg_002" }    │
│                                                              │
│  nodes[i].data.appearance:                                   │
│  ├─ shape: 'custom'                                          │
│  └─ svgLibraryId: "svg_001"  ──────────┐                    │
│                                         │ 참조               │
│  svgLibrary.find(s => s.id === id) ◄───┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 적용 우선순위 (resolveAppearance 확장)

```
개별 노드 svgLibraryId  →  있으면 해당 SVG 사용
        ↓ 없으면
타입별 기본 SVG (defaultSvgByType[componentType])  →  있으면 자동 적용
        ↓ 없으면
기존 CSS shape (DEFAULT_APPEARANCES[componentType])
```

### 2.5 프로젝트 파일 저장/로드

프로젝트 JSON에 `svgLibrary`와 `defaultSvgByType`를 포함:

```json
{
  "metadata": { ... },
  "nodes": [ ... ],
  "edges": [ ... ],
  "svgLibrary": [
    { "id": "svg_001", "name": "밸브A", "svgMarkup": "<svg>...</svg>", "viewBox": "0 0 100 100", "createdAt": 1710806400000 }
  ],
  "defaultSvgByType": { "valve": "svg_001" }
}
```

---

## 3. 컴포넌트 설계

### 3.1 파일 구조

```
src/
├── types/mars.ts                          # SvgLibraryItem 타입 추가
├── stores/useStore.ts                     # svgLibrary 상태 + 액션 추가
├── utils/
│   ├── nodeAppearance.ts                  # resolveAppearance 확장, isSvgShape 수정
│   └── svgSanitizer.ts                    # [신규] SVG sanitize + viewBox 추출
├── components/
│   ├── common/SvgNodeShape.tsx            # Custom SVG 렌더링 분기 추가
│   ├── forms/AppearanceForm.tsx           # Shape=custom 시 라이브러리 선택 UI
│   └── dialogs/SvgLibraryDialog.tsx       # [신규] SVG 라이브러리 관리 다이얼로그
└── components/nodes/*.tsx                 # svgLibraryId → svgMarkup 전달
```

### 3.2 SvgLibraryDialog (신규)

```
┌──────────────────────────────────────────────┐
│  SVG 라이브러리 관리                    [X]  │
│──────────────────────────────────────────────│
│                                              │
│  [+ SVG 파일 추가]                           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ [미리보기]  밸브 심볼 A       [삭제]   │  │
│  │  60x60      기본: Valve ✓             │  │
│  ├────────────────────────────────────────┤  │
│  │ [미리보기]  펌프 심볼 B       [삭제]   │  │
│  │  80x80      기본: -                   │  │
│  ├────────────────────────────────────────┤  │
│  │ [미리보기]  커스텀 용기       [삭제]   │  │
│  │  100x120    기본: -                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── 타입별 기본 SVG ──                       │
│  Valve:    [밸브 심볼 A ▼]                   │
│  Pump:     [없음         ▼]                   │
│  Snglvol:  [없음         ▼]                   │
│  ...                                         │
│                                              │
│                            [닫기]            │
└──────────────────────────────────────────────┘
```

**Props:**
```typescript
interface SvgLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}
```

**주요 동작:**
- "SVG 파일 추가" → `<input type="file" accept=".svg">` → 크기 체크 (≤1MB) → sanitize → store 추가
- "삭제" → 확인 다이얼로그 → 참조 중인 노드 있으면 경고 → store 제거
- 타입별 기본 SVG 드롭다운 → `setDefaultSvgForType()` 호출

### 3.3 AppearanceForm 변경

```
Shape: [Custom SVG ▼]          ← 기존 드롭다운

라이브러리에서 선택:             ← shape='custom'일 때만 표시
[밸브 심볼 A    ▼]              ← Select (svgLibrary 목록)
[라이브러리 관리...]             ← SvgLibraryDialog 열기 버튼

┌─────────────────┐
│  [SVG 미리보기]  │             ← 선택된 SVG 미리보기
│    60 x 60       │
└─────────────────┘

※ 배경색(Background Color) 섹션 숨김
```

**변경 핵심:**
- `customSvgPath` 텍스트 입력 제거
- `svgLibraryId` Select 드롭다운 추가
- `shape === 'custom'`일 때 Background Color 섹션 조건부 렌더링

### 3.4 SvgNodeShape 변경

```typescript
// 기존: customSvgPath → SVG path 단일 렌더링
// 변경: svgMarkup → 전체 SVG 마크업 렌더링 (다색 지원)

interface SvgNodeShapeProps {
  shape: NodeShape;
  width: number;
  height: number;
  backgroundColor: string;
  svgMarkup?: string;       // 전체 SVG 마크업 (custom 용)
  selected?: boolean;
  children?: React.ReactNode;
}
```

**렌더링 분기:**

| shape | 렌더링 방식 | backgroundColor |
|-------|------------|-----------------|
| `valve-bowtie` | 기존 `<path>` + fill 오버라이드 | O (fill 적용) |
| `pump-centrifugal` | 기존 `<path>` + fill 오버라이드 | O (fill 적용) |
| `custom` + svgMarkup | `dangerouslySetInnerHTML` | X (원본 색상) |
| `custom` + 없음 | 빈 placeholder | - |

### 3.5 노드 컴포넌트 변경 (7개 Simple Nodes)

각 노드 컴포넌트에서 `SvgNodeShape`에 전달하는 prop 변경:

```typescript
// 기존
<SvgNodeShape customSvgPath={appearance.customSvgPath} ... />

// 변경: store에서 svgMarkup 조회
const svgItem = appearance.svgLibraryId
  ? svgLibrary.find(s => s.id === appearance.svgLibraryId)
  : undefined;

<SvgNodeShape svgMarkup={svgItem?.svgMarkup} ... />
```

**최적화**: `svgLibrary` 전체를 구독하지 않고, `svgLibraryId`로 개별 아이템만 셀렉터로 조회:
```typescript
const svgMarkup = useStore((s) => {
  if (!appearance.svgLibraryId) return undefined;
  return s.svgLibrary.find(item => item.id === appearance.svgLibraryId)?.svgMarkup;
});
```

---

## 4. SVG Sanitize (`src/utils/svgSanitizer.ts`)

### 4.1 제거 대상
```typescript
const DANGEROUS_TAGS = [
  'script', 'foreignObject', 'iframe', 'object', 'embed',
  'use',     // 외부 리소스 참조 차단
  'animate', // 선택적 (애니메이션 불필요)
];

const DANGEROUS_ATTRS = [
  /^on/i,           // onclick, onload 등 모든 이벤트 핸들러
  /^xlink:href/i,   // 외부 리소스 링크
];
```

### 4.2 함수 시그니처
```typescript
interface SanitizeResult {
  sanitizedMarkup: string;
  viewBox: string;           // 추출된 viewBox (없으면 "0 0 100 100")
  warnings: string[];        // 제거된 요소 목록
}

export function sanitizeSvg(rawSvg: string): SanitizeResult;
```

### 4.3 구현 방식
- `DOMParser`로 SVG 파싱
- 위험 태그/속성 재귀 제거
- `<svg>` 루트의 `viewBox` 추출
- `XMLSerializer`로 다시 문자열화

---

## 5. 노드 생성 시 타입별 기본 SVG 적용

### 5.1 FlowCanvas.tsx `onDrop` 수정

```typescript
const onDrop = useCallback((event: React.DragEvent) => {
  // ... 기존 로직 ...

  const defaultSvgByType = useStore.getState().defaultSvgByType;
  const defaultSvgId = defaultSvgByType[type];

  const newNode = {
    id: nodeId,
    type,
    position,
    data: {
      // ... 기존 필드 ...
      appearance: defaultSvgId
        ? { ...getDefaultAppearance(type), shape: 'custom' as NodeShape, svgLibraryId: defaultSvgId }
        : undefined,  // undefined → resolveAppearance에서 기본값 사용
    } as MARSNodeData,
  };

  addNode(newNode);
}, [...]);
```

---

## 6. Store 액션 상세

### 6.1 addSvgToLibrary

```typescript
addSvgToLibrary: (item) => {
  const id = `svg_${nanoid(8)}`;
  const newItem: SvgLibraryItem = { ...item, id, createdAt: Date.now() };
  set((state) => ({
    svgLibrary: [...state.svgLibrary, newItem],
    isDirty: true,
  }));
  return id;
},
```

### 6.2 removeSvgFromLibrary

```typescript
removeSvgFromLibrary: (svgId) => {
  set((state) => {
    // 1) 라이브러리에서 제거
    const svgLibrary = state.svgLibrary.filter(s => s.id !== svgId);

    // 2) 참조 중인 노드의 svgLibraryId 초기화 → shape를 타입 기본값으로 복원
    const nodes = state.nodes.map(n => {
      if (n.data.appearance?.svgLibraryId === svgId) {
        const { svgLibraryId, ...rest } = n.data.appearance;
        return {
          ...n,
          data: {
            ...n.data,
            appearance: { ...rest, shape: getDefaultAppearance(n.data.componentType).shape },
          },
        };
      }
      return n;
    });

    // 3) 타입별 기본 매핑에서도 제거
    const defaultSvgByType = { ...state.defaultSvgByType };
    for (const [key, val] of Object.entries(defaultSvgByType)) {
      if (val === svgId) delete defaultSvgByType[key as ComponentType];
    }

    return { svgLibrary, nodes, defaultSvgByType, isDirty: true };
  });
},
```

### 6.3 setDefaultSvgForType

```typescript
setDefaultSvgForType: (componentType, svgId) => {
  set((state) => {
    const defaultSvgByType = { ...state.defaultSvgByType };
    if (svgId) {
      defaultSvgByType[componentType] = svgId;
    } else {
      delete defaultSvgByType[componentType];
    }
    return { defaultSvgByType, isDirty: true };
  });
},
```

---

## 7. 보안 고려사항

| 위협 | 대응 |
|------|------|
| `<script>` 삽입 (XSS) | sanitizeSvg에서 제거 |
| `on*` 이벤트 핸들러 | 정규식으로 모든 이벤트 속성 제거 |
| `<foreignObject>` | HTML 삽입 경로 → 태그 제거 |
| 외부 리소스 로드 | `xlink:href`, `<use>` 제거 |
| 대용량 SVG (DoS) | 1MB 파일 크기 제한 |
| `dangerouslySetInnerHTML` | sanitize 후에만 사용 |

---

## 8. 구현 순서 (권장)

| 단계 | 작업 | 영향 범위 |
|------|------|----------|
| 1 | `SvgLibraryItem` 타입 추가, `NodeAppearance` 변경 | `mars.ts` |
| 2 | `svgSanitizer.ts` 유틸 작성 | 신규 파일 |
| 3 | Store에 `svgLibrary`, `defaultSvgByType` 상태 + 액션 추가 | `useStore.ts` |
| 4 | `SvgNodeShape` 컴포넌트 수정 (svgMarkup 렌더링) | `SvgNodeShape.tsx` |
| 5 | `SvgLibraryDialog` 다이얼로그 작성 | 신규 파일 |
| 6 | `AppearanceForm` 수정 (라이브러리 선택 + 배경색 숨김) | `AppearanceForm.tsx` |
| 7 | 7개 Simple Node 컴포넌트 수정 | `*Node.tsx` |
| 8 | `FlowCanvas.tsx` onDrop에 타입별 기본 SVG 적용 | `FlowCanvas.tsx` |
| 9 | `nodeAppearance.ts` resolveAppearance 확장 | `nodeAppearance.ts` |
| 10 | 프로젝트 저장/로드에 svgLibrary 포함 | `projectFileHelpers.ts` |

---

## 9. 영향도 분석

### 변경 파일
| 파일 | 변경 유형 | 변경 규모 |
|------|----------|----------|
| `src/types/mars.ts` | 수정 | 소 (타입 추가/변경) |
| `src/stores/useStore.ts` | 수정 | 중 (상태+액션 추가) |
| `src/utils/nodeAppearance.ts` | 수정 | 소 (resolveAppearance 확장) |
| `src/utils/svgSanitizer.ts` | **신규** | 중 (sanitize 로직) |
| `src/components/common/SvgNodeShape.tsx` | 수정 | 중 (렌더링 분기) |
| `src/components/forms/AppearanceForm.tsx` | 수정 | 중 (UI 변경) |
| `src/components/dialogs/SvgLibraryDialog.tsx` | **신규** | 대 (다이얼로그 전체) |
| `src/components/nodes/*Node.tsx` (7개) | 수정 | 소 (prop 변경) |
| `src/components/FlowCanvas.tsx` | 수정 | 소 (onDrop 확장) |
| `src/utils/projectFileHelpers.ts` | 수정 | 소 (저장/로드 확장) |
