---
title: "설계서: Simulation 모니터링 그래프 라인 커스터마이징"
status: done
phase: 4
branch: main
related_prs: [#81]
last_updated: 2026-04-03
---

# 설계서: Simulation 모니터링 그래프 라인 커스터마이징

**PRD 참조**: [PRD-chart-line-customization.md](PRD-chart-line-customization.md)  
**작성일**: 2026-04-01  
**상태**: Draft  

---

## 1. 아키텍처 개요

### 1.1 현재 데이터 흐름

```
MinorEdits → DynamicChartGrid(generateChartsFromMinorEdits)
                → ChartConfig[] (dataKeys에 key/label/color 포함)
                    → ResizableChartCard (컨트롤 오버레이)
                        → ChartCard (Recharts LineChart 렌더링)
                            → <Legend> (기본 Recharts Legend)
                            → <Line> (color만 동적, 나머지 고정)
```

### 1.2 변경 후 데이터 흐름

```
MinorEdits → DynamicChartGrid(generateChartsFromMinorEdits)
                → ChartConfig[] (dataKeys에 key/label/color 포함)
                    → ResizableChartCard (컨트롤 오버레이)
                        → ChartCard (+ lineStyles 상태 관리)
                            → <Legend> (커스텀 렌더링 — 클릭/더블클릭/설정아이콘)
                            → <Line> (color/strokeDasharray/strokeWidth/opacity 동적)
                            → LineStylePopover (팝오버 — 색상피커/선스타일/선굵기)

상태 관리:
  simulationStore.chartLineStyles[chartId][dataKey] → LineStyle
```

---

## 2. 타입 설계

### 2.1 신규 타입 (`src/types/simulation.ts`)

```typescript
/**
 * 선 스타일 프리셋
 */
export type LineStylePreset = 'solid' | 'dotted' | 'dashed';

/**
 * 선 굵기 프리셋
 */
export type LineWidthPreset = 'thin' | 'normal' | 'bold';

/**
 * 개별 라인의 커스텀 스타일
 */
export interface LineStyle {
  color?: string;                  // hex 색상 (미지정 시 ChartConfig.dataKeys의 color 사용)
  stylePreset?: LineStylePreset;   // 선 스타일 (기본: 'solid')
  widthPreset?: LineWidthPreset;   // 선 굵기 (기본: 'normal')
}

/**
 * 차트 내 라인별 스타일 맵
 * key: dataKey (예: "p_10001", "tempf_20001")
 */
export type ChartLineStyles = Record<string, LineStyle>;
```

### 2.2 프리셋 → Recharts 속성 매핑 (상수)

```typescript
// ChartCard.tsx 내부 또는 별도 constants 파일
export const LINE_STYLE_MAP: Record<LineStylePreset, string | undefined> = {
  solid: undefined,        // strokeDasharray 미지정 = 실선
  dotted: '2 2',
  dashed: '6 3',
};

export const LINE_WIDTH_MAP: Record<LineWidthPreset, number> = {
  thin: 1,
  normal: 2,
  bold: 3,
};
```

---

## 3. 상태 설계 (`simulationStore.ts`)

### 3.1 상태 추가

```typescript
interface SimulationStore {
  // ... 기존 상태 ...

  // 라인 스타일 커스텀 상태
  // chartId → { dataKey → LineStyle }
  chartLineStyles: Record<string, ChartLineStyles>;

  // Actions
  setLineStyle: (chartId: string, dataKey: string, style: Partial<LineStyle>) => void;
  resetLineStyles: (chartId: string) => void;
}
```

### 3.2 액션 구현

```typescript
setLineStyle: (chartId, dataKey, style) =>
  set((state) => ({
    chartLineStyles: {
      ...state.chartLineStyles,
      [chartId]: {
        ...state.chartLineStyles[chartId],
        [dataKey]: {
          ...state.chartLineStyles[chartId]?.[dataKey],
          ...style,
        },
      },
    },
  }), false, 'setLineStyle'),

resetLineStyles: (chartId) =>
  set((state) => {
    const { [chartId]: _, ...rest } = state.chartLineStyles;
    return { chartLineStyles: rest };
  }, false, 'resetLineStyles'),
```

### 3.3 영속성 (persist)

현재 `partialize`에 포함하지 않음 (PRD 미결 사항 — 나중에 결정).  
→ 세션 동안만 유지, 새로고침 시 초기화.  
→ 향후 저장이 결정되면 `partialize`에 `chartLineStyles` 추가만 하면 됨.

### 3.4 resetAll 반영

```typescript
resetAll: () =>
  set({
    // ... 기존 ...
    chartLineStyles: {},  // 추가
  }, false, 'resetAll'),
```

---

## 4. 컴포넌트 설계

### 4.1 ChartCard 변경 (`src/components/simulation/ChartCard.tsx`)

**핵심 변경**: Legend 커스텀 렌더링 + 라인별 동적 스타일 적용

#### 4.1.1 로컬 상태 추가

```typescript
// 숨김 상태 (로컬 — 세션 내 유지, 저장 불필요)
const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

// 강조 상태 (로컬)
const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());

// 팝오버 앵커 상태 (로컬)
const [popoverAnchor, setPopoverAnchor] = useState<{
  el: HTMLElement;
  dataKey: string;
} | null>(null);
```

> **설계 결정**: `hiddenKeys`와 `highlightedKeys`는 일시적 인터랙션 상태이므로 Zustand가 아닌 컴포넌트 로컬 상태로 관리. `lineStyles`(색상/스타일/굵기)만 store에 저장.

#### 4.1.2 Legend 커스텀 렌더링

현재:
```tsx
<Legend wrapperStyle={{ fontSize: '0.75rem' }} />
```

변경:
```tsx
<Legend
  content={<CustomLegend
    dataKeys={config.dataKeys}
    hiddenKeys={hiddenKeys}
    highlightedKeys={highlightedKeys}
    lineStyles={chartLineStyles}
    onToggleVisibility={handleToggleVisibility}    // 더블클릭
    onToggleHighlight={handleToggleHighlight}      // 클릭
    onOpenStylePopover={handleOpenStylePopover}    // 설정아이콘 클릭
  />}
/>
```

#### 4.1.3 Line 컴포넌트 동적 스타일

현재:
```tsx
<Line
  key={dataKey.key}
  type="monotone"
  dataKey={dataKey.key}
  name={dataKey.label}
  stroke={dataKey.color}
  dot={false}
  strokeWidth={2}
  isAnimationActive={false}
/>
```

변경:
```tsx
{config.dataKeys
  .filter((dk) => !hiddenKeys.has(dk.key))  // 숨김 필터링
  .map((dataKey) => {
    const style = lineStyles[dataKey.key];
    const isHighlighted = highlightedKeys.size === 0 || highlightedKeys.has(dataKey.key);
    const baseWidth = LINE_WIDTH_MAP[style?.widthPreset || 'normal'];

    return (
      <Line
        key={dataKey.key}
        type="monotone"
        dataKey={dataKey.key}
        name={dataKey.label}
        stroke={style?.color || dataKey.color}
        dot={false}
        strokeWidth={highlightedKeys.has(dataKey.key) ? baseWidth * 2 : baseWidth}
        strokeDasharray={LINE_STYLE_MAP[style?.stylePreset || 'solid']}
        strokeOpacity={isHighlighted ? 1 : 0.2}
        isAnimationActive={false}
      />
    );
  })}
```

#### 4.1.4 이벤트 핸들러

```typescript
// 더블클릭: 숨김/표시 토글
const handleToggleVisibility = (dataKey: string) => {
  setHiddenKeys((prev) => {
    const next = new Set(prev);
    const visibleCount = (config.dataKeys?.length || 0) - next.size;

    if (next.has(dataKey)) {
      next.delete(dataKey);  // 숨겨진 것 복원
    } else if (visibleCount > 1) {
      next.add(dataKey);     // 최소 1개 보장
    }
    return next;
  });
};

// 클릭: 강조 토글
const handleToggleHighlight = (dataKey: string) => {
  setHighlightedKeys((prev) => {
    const next = new Set(prev);
    if (next.has(dataKey)) {
      next.delete(dataKey);
    } else {
      next.add(dataKey);
    }
    return next;
  });
};

// 설정 아이콘: 팝오버 열기
const handleOpenStylePopover = (el: HTMLElement, dataKey: string) => {
  setPopoverAnchor({ el, dataKey });
};
```

---

### 4.2 CustomLegend 컴포넌트 (ChartCard 내부 또는 별도 파일)

**인라인 컴포넌트로 ChartCard.tsx 내부에 정의** (단독 재사용 가능성 낮음)

```
┌─ Legend Container (flex, wrap) ──────────────────────────┐
│                                                          │
│  ┌─ Legend Item ──────────────────┐                      │
│  │ [색상선] Label Text [⚙]       │  ← 각 dataKey마다   │
│  └────────────────────────────────┘                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Legend Item 상세

```tsx
interface CustomLegendProps {
  dataKeys: Array<{ key: string; label: string; color: string }>;
  hiddenKeys: Set<string>;
  highlightedKeys: Set<string>;
  lineStyles: ChartLineStyles;
  onToggleVisibility: (dataKey: string) => void;
  onToggleHighlight: (dataKey: string) => void;
  onOpenStylePopover: (el: HTMLElement, dataKey: string) => void;
}
```

각 Legend 항목의 렌더링:

| 상태 | 색상선 | 텍스트 | 설정아이콘 |
|------|--------|--------|-----------|
| 기본 | `─────` (해당 색상/스타일) | 일반 | 호버 시 표시 |
| 강조됨 | `━━━━━` (굵게) | **볼드** | 호버 시 표시 |
| 숨겨짐 | `─ ─ ─` (회색) | ~~취소선~~ + 반투명 | 호버 시 표시 |

#### 인터랙션

- **색상선 + 텍스트 영역**:
  - `onClick` → `onToggleHighlight`
  - `onDoubleClick` → `onToggleVisibility`
- **[⚙] 아이콘**:
  - `onClick` → `onOpenStylePopover`
  - 호버 시에만 표시 (CSS opacity 전환)

> **주의**: 클릭과 더블클릭 공존 시, 클릭 이벤트가 먼저 발생한다. 300ms 디바운스로 처리:
> - 300ms 내에 두 번째 클릭 발생 → 더블클릭으로 처리, 첫 번째 클릭 취소
> - 300ms 후 두 번째 클릭 없음 → 클릭으로 처리

---

### 4.3 LineStylePopover 컴포넌트 (신규)

**파일**: `src/components/simulation/LineStylePopover.tsx`

MUI `<Popover>` 기반, 3개 섹션으로 구성.

#### Props

```typescript
interface LineStylePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  dataKey: string;
  currentColor: string;              // 현재 색상 (ChartConfig 기본값 또는 커스텀)
  currentStyle: LineStylePreset;      // 현재 선 스타일
  currentWidth: LineWidthPreset;      // 현재 선 굵기
  onColorChange: (color: string) => void;
  onStyleChange: (style: LineStylePreset) => void;
  onWidthChange: (width: LineWidthPreset) => void;
  onClose: () => void;
}
```

#### 레이아웃

```
┌─── Popover (width: 260px) ────────────────┐
│                                            │
│  Color                                     │
│  ┌──────────────────────────────────┐      │
│  │  [MUI 색상 피커 또는 직접 구현]  │      │
│  │  + hex 입력 필드                 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  Style                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐         │
│  │ ───── │ │ ····· │ │ -- -- │          │
│  │ Solid  │ │ Dotted │ │ Dashed │         │
│  └────────┘ └────────┘ └────────┘         │
│                                            │
│  Width                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐         │
│  │  ───   │ │  ───   │ │  ━━━   │         │
│  │  Thin  │ │ Normal │ │  Bold  │         │
│  └────────┘ └────────┘ └────────┘         │
│                                            │
└────────────────────────────────────────────┘
```

#### 색상 피커 구현 방안

**선택지**: `react-colorful` 라이브러리 사용 (경량 ~2KB, 의존성 없음)

```bash
npm install react-colorful
```

대안: MUI 자체로 직접 구현 가능하나, 색상 피커 UX가 복잡하므로 전용 라이브러리가 효율적.

#### 스타일/굵기 선택 UI

MUI `<ToggleButtonGroup>` 활용:

```tsx
<ToggleButtonGroup
  value={currentStyle}
  exclusive
  onChange={(_, val) => val && onStyleChange(val)}
  size="small"
>
  <ToggleButton value="solid">
    <Box sx={{ width: 40, height: 2, bgcolor: 'currentColor' }} />
  </ToggleButton>
  <ToggleButton value="dotted">
    <Box sx={{ width: 40, borderBottom: '2px dotted currentColor' }} />
  </ToggleButton>
  <ToggleButton value="dashed">
    <Box sx={{ width: 40, borderBottom: '2px dashed currentColor' }} />
  </ToggleButton>
</ToggleButtonGroup>
```

---

## 5. 컴포넌트 간 데이터 흐름

```
simulationStore
  ├── chartLineStyles[chartId][dataKey] = { color, stylePreset, widthPreset }
  │
  └── setLineStyle(chartId, dataKey, partialStyle)

ChartCard (chartId = config.id)
  ├── useState: hiddenKeys, highlightedKeys, popoverAnchor
  │
  ├── useSimulationStore → chartLineStyles[config.id]
  │
  ├── CustomLegend
  │     ├── onClick → toggleHighlight (로컬 상태)
  │     ├── onDoubleClick → toggleVisibility (로컬 상태)
  │     └── onSettingsClick → setPopoverAnchor (로컬 상태)
  │
  ├── <Line> 렌더링 시
  │     ├── hiddenKeys → filter로 제외
  │     ├── highlightedKeys → strokeWidth 배수 + strokeOpacity
  │     └── chartLineStyles → color, strokeDasharray, strokeWidth
  │
  └── LineStylePopover
        ├── open = popoverAnchor !== null
        ├── onChange → store.setLineStyle()
        └── onClose → setPopoverAnchor(null)
```

---

## 6. 파일 변경 목록

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `src/types/simulation.ts` | 수정 | `LineStyle`, `LineStylePreset`, `LineWidthPreset`, `ChartLineStyles` 타입 추가 |
| `src/stores/simulationStore.ts` | 수정 | `chartLineStyles` 상태 + `setLineStyle`, `resetLineStyles` 액션 추가 |
| `src/components/simulation/ChartCard.tsx` | 수정 | Legend 커스텀 렌더링, Line 동적 스타일, 로컬 상태(hidden/highlight/popover), 클릭/더블클릭 디바운스 |
| `src/components/simulation/LineStylePopover.tsx` | **신규** | 색상 피커 + 선 스타일 + 선 굵기 팝오버 |
| `package.json` | 수정 | `react-colorful` 의존성 추가 |

---

## 7. 구현 순서

| 단계 | 작업 | 의존성 |
|------|------|--------|
| **1** | 타입 추가 (`simulation.ts`) | 없음 |
| **2** | Store 확장 (`simulationStore.ts`) | 단계 1 |
| **3** | `react-colorful` 설치 | 없음 |
| **4** | `LineStylePopover` 컴포넌트 생성 | 단계 1, 3 |
| **5** | `ChartCard` 수정 (Legend + Line + 이벤트) | 단계 1, 2, 4 |
| **6** | 통합 테스트 | 전체 |

---

## 8. 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `hiddenKeys`/`highlightedKeys`를 로컬 상태로 | 일시적 인터랙션 상태, 차트 간 공유 불필요, 저장 필요 없음 |
| `lineStyles`를 store에 | 색상/스타일 변경은 의도적 커스터마이징, 향후 영속성 옵션 필요 |
| 클릭/더블클릭 디바운스 300ms | 브라우저 기본 더블클릭 간격(~500ms) 내에서 빠른 응답 보장 |
| `react-colorful` 사용 | 경량(2KB), 무의존성, React 친화적, HexColorPicker 즉시 사용 가능 |
| CustomLegend를 ChartCard 내부에 정의 | 단독 재사용 가능성 낮음, props 전달 복잡도 감소 |
| LineStylePopover를 별도 파일로 | 크기가 상당하고, 향후 Analysis 차트에서도 재사용 가능 |
