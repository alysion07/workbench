---
title: "FEAT: Widget UX Improvement — 가독성 및 사용성 향상"
status: planned
phase: 4
branch: alysion/feat_icv
last_updated: 2026-04-03
---

# FEAT: Widget UX Improvement — 가독성 및 사용성 향상

> **상태**: Phase 1 ✅ Phase 2 ✅ Phase 3 ✅ (F3.8 Portal ✅)
> **브랜치**: `alysion/feat_icv` (기존 Interactive Control 브랜치)
> **작성일**: 2026-03-25
> **최종 수정**: 2026-03-25
> **선행 문서**: [FEAT-interactive-node-widgets](FEAT-interactive-node-widgets.md)

---

## 1. 배경 및 문제 정의

### 1.1 현재 상태

InteractiveControlView (SIM-002)의 위젯 시스템이 Phase 0 수준으로 구현되어 있으나,
실제 시뮬레이션 모델(수백 개 노드)에서 다음 문제가 발생한다:

| 문제 | 설명 | 영향 |
|------|------|------|
| **정보 밀도 과부하** | 수백 개 위젯이 동시 표시, 줌아웃 시 텍스트 읽기 불가 | 모니터링 효율 저하 |
| **시각적 계층 부재** | 모든 위젯이 동일한 흰색 배경, 데이터 종류 구분 불가 | 값 탐색 시간 증가 |
| **줌 레벨 대응 없음** | 폰트 크기 고정(0.75~0.85rem), 줌아웃 시 가독성 급감 | 전체 조감도에서 위젯 무용 |
| **사용자 커스텀 무시** | LOD 전환 시 사용자가 의도적으로 키운 위젯까지 축소 위험 | 사용자 의도 충돌 |

### 1.2 목표

- 줌인/줌아웃 모든 상황에서 **위젯 값이 읽을 수 있어야** 한다
- 데이터 종류(P/T/W)를 **색상만으로 직관적 구분** 가능해야 한다
- 사용자가 **의도적으로 크기를 조절한 위젯은 줌아웃에서도 유지**되어야 한다
- 기존 드래그/리사이즈/컨텍스트메뉴 동작에 **영향 없어야** 한다

---

## 2. 사용자 시나리오

### S1: 줌인 모니터링 (주요 사용 패턴)

> 사용자는 특정 영역(예: 1차 계통)을 확대하여 P/T/W 값을 실시간 모니터링한다.
> → Full Widget이 표시되며, 색상 코딩으로 P(파랑)/T(빨강)/W(초록) 구분.

### S2: 줌아웃 조감 (보조 사용 패턴)

> 사용자가 전체 시스템을 줌아웃하면:
> - 일반 위젯 → Compact Badge로 전환 (값+단위만, 줌 보정)
> - 사용자가 크게 키워놓은 중요 차트 → Full Widget 유지 (HUD 방식)
> - NumericLabel은 줌아웃에서도 항상 숫자값 표시

### S3: 중요 위젯 핀(Pin) 설정

> 사용자가 특정 미니차트를 리사이즈하여 크게 만들면 자동으로 Pinned 상태가 된다.
> 핀된 위젯은 줌아웃해도 화면상 동일한 크기를 유지한다.
> 컨텍스트 메뉴에서 수동으로 Pin/Unpin 전환 가능.

---

## 3. 기능 요구사항

### Phase 1: Full Widget 스타일 개선 (우선 구현)

| ID | 요구사항 | 상세 | 영향 범위 |
|----|---------|------|----------|
| **F1.1** | dataKey 기반 색상 코딩 | `dataKey` 키워드로 자동 매핑. 좌측 테두리(3px)로 표현 | `NumericLabelWidget`, `MiniChartWidget` |
| **F1.2** | 색상 매핑 테이블 | 아래 참조 | 신규 유틸 함수 |
| **F1.3** | 값 폰트 크기 증가 | 현재값: `0.85rem` → `1.0rem`, `fontWeight: 700` | `NumericLabelWidget`, `MiniChartWidget` |
| **F1.4** | 라벨-값 시각 분리 | 라벨: `0.65rem`, `color: #999` / 값: `1.0rem`, `#333` | 동일 |
| **F1.5** | 위젯 배경 대비 | `rgba(255,255,255,0.97)` + `boxShadow: '0 1px 4px rgba(0,0,0,0.12)'` | `DraggableWidget` 또는 각 위젯 |
| **F1.6** | 알람 우선 규칙 | 알람 활성 시 색상 코딩 테두리를 알람 색상으로 대체 | 각 위젯 |

#### F1.2 색상 매핑 테이블

| dataKey 패턴 | 색상 | Hex | 용도 |
|-------------|------|-----|------|
| `pressure` | 파랑 | `#1976d2` | 압력 계통 |
| `temperature` | 빨강 | `#d32f2f` | 온도 계통 |
| `flowRate` | 초록 | `#2e7d32` | 유량 계통 |
| `valveMode`, `valvePosition`, `valveState` | 주황 | `#e65100` | 밸브 제어 |
| (기타/매칭 없음) | 회색 | `#616161` | 기본값 |

**구현**: `getWidgetColorByDataKey(dataKey: string): string` 유틸 함수

```typescript
// src/utils/widgetColors.ts
export function getWidgetColorByDataKey(dataKey: string): string {
  if (dataKey.includes('pressure'))    return '#1976d2';
  if (dataKey.includes('temperature')) return '#d32f2f';
  if (dataKey.includes('flow'))        return '#2e7d32';
  if (dataKey.includes('valve'))       return '#e65100';
  return '#616161';
}
```

### Phase 2: LOD (Level of Detail) 시스템

| ID | 요구사항 | 상세 |
|----|---------|------|
| **F2.1** | 2단계 LOD 전환 | `zoom >= threshold` → Full Widget / `zoom < threshold` → Compact Badge |
| **F2.2** | Compact Badge | 라벨 생략, 값+단위만 표시, 색상 코딩 좌측 테두리 유지 |
| **F2.3** | NumericLabel 줌아웃 보장 | 줌 < threshold에서도 값+단위 텍스트 항상 표시 (Compact Badge 형태) |
| **F2.4** | MiniChart → Compact 축소 | 줌아웃 시 차트 영역 제거, 최신값만 Compact Badge로 표시 |
| **F2.5** | 임계값 설정 가능 | `globalSettings`에 `widgetLodThreshold: number` 저장. 초기값은 사용 피드백으로 결정 |
| **F2.6** | Unpinned 줌 보정 | 줌에 따라 축소하되 최소 크기 보장: `minBadgeWidth: 50px`, `minFontSize: 10px` (화면 기준) |

#### Compact Badge 시각 스펙

```
┌──────────┐
│ 15.5 MPa │   높이: 20~24px, 패딩: 2px 6px
└──────────┘   좌측 테두리: 3px (dataKey 색상)
               폰트: 0.8rem monospace bold
               배경: rgba(255,255,255,0.95)
```

### Phase 3: Pin 시스템

| ID | 요구사항 | 상세 |
|----|---------|------|
| **F3.1** | `WidgetOverride.pinned` 필드 | `boolean`, 기본값 `undefined` (= unpinned) |
| **F3.2** | 자동 핀 | 사용자가 `width` 또는 `height`를 리사이즈하면 `pinned: true` 자동 설정 |
| **F3.3** | 수동 핀 토글 | `WidgetContextMenu`에 "📌 Pin (줌아웃 시 유지)" 체크박스 추가 |
| **F3.4** | Pinned 줌 보정 (HUD) | `transform: scale(min(1/zoom, maxScale))` 적용. 화면상 크기 고정 |
| **F3.5** | 보정 상한 | `maxScale = 4` — 줌 0.25 이하에서도 4배까지만 보정 |
| **F3.6** | 핀 시각 표시 | Pinned 위젯 좌상단에 📌 아이콘 (8px, opacity 0.6) |
| **F3.7** | Unpinned LOD 전환 | Unpinned 위젯은 Phase 2의 LOD 규칙 적용 |
| **F3.8** | Portal 렌더링 전환 | 위젯을 노드 내부가 아닌 ReactFlow 바깥 레이어에 `createPortal`로 렌더링. ReactFlow의 `transform`이 stacking context를 생성하여 위젯 z-index가 형제 노드에 가려지는 문제 해결. Pin의 `scale(1/zoom)` 적용 시 이중 transform 회피에도 필수 |

#### Pinned 위젯 줌 보정 동작 (부분 HUD — `1/√zoom`)

```
줌 1.0  → scale(1.0)   → 사용자 설정 크기 그대로
줌 0.5  → scale(1.41)  → 화면상 71% 유지 (적당히 축소)
줌 0.3  → scale(1.83)  → 화면상 55% 유지
줌 0.1  → scale(3.16)  → maxScale(4) 미만, 완만하게 축소
줌 0.05 → scale(4.0)   → maxScale 도달, 상한 고정
```

#### 데이터 모델 변경

```typescript
// src/types/interactive.ts — WidgetOverride 확장
export interface WidgetOverride {
  visible?: boolean;
  position?: WidgetPosition;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
  pinned?: boolean;          // NEW: 줌아웃 시 Full Widget 유지
}
```

---

## 4. 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| **NF1** | 기존 동작 보존 | 드래그/리사이즈/컨텍스트메뉴/알람 기존 동작 100% 유지 |
| **NF2** | 렌더링 성능 | 500개 위젯 동시 표시 시 60fps 유지 (React.memo + 조건부 렌더) |
| **NF3** | 알람 > 색상코딩 | 알람 활성 시 색상 코딩 테두리를 알람 색상이 대체 |
| **NF4** | 설정 영속성 | `pinned`, LOD 임계값은 `globalSettings`에 저장, 새로고침 후 복원 |
| **NF5** | 하위 호환 | `pinned` 필드 없는 기존 데이터 → `undefined` = unpinned로 동작 |

---

## 5. 영향 범위

### 신규 파일

| 파일 | 용도 |
|------|------|
| `src/utils/widgetColors.ts` | dataKey → 색상 매핑 함수 |

### 수정 파일

| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `src/components/interactive/widgets/NumericLabelWidget.tsx` | 1 | 색상 코딩 테두리 + 폰트 크기 + 라벨/값 분리 |
| `src/components/interactive/widgets/MiniChartWidget.tsx` | 1 | 색상 코딩 테두리 + 폰트 크기 + 알람 우선 |
| `src/components/interactive/widgets/AutoManualToggleWidget.tsx` | 1 | 색상 코딩 테두리 (밸브 주황) |
| `src/components/interactive/widgets/DraggableWidget.tsx` | 1,3 | 배경 그림자 + Pin 줌 보정 transform |
| `src/components/interactive/withNodeWidgets.tsx` | 2,3 | LOD 전환 로직 + Compact Badge 렌더 분기 + Portal 렌더링 전환 |
| `src/components/interactive/WidgetContextMenu.tsx` | 3 | Pin/Unpin 토글 메뉴 항목 |
| `src/types/interactive.ts` | 3 | `WidgetOverride.pinned` 필드 추가 |

---

## 6. 구현 순서

```
Phase 1: 스타일 개선 (F1.1~F1.6)
  ├─ widgetColors.ts 생성
  ├─ NumericLabelWidget 스타일 적용
  ├─ MiniChartWidget 스타일 적용
  ├─ AutoManualToggleWidget 스타일 적용
  └─ 검증: 기존 동작 보존 확인

Phase 2: LOD 시스템 (F2.1~F2.6)
  ├─ withNodeWidgets에 zoom 기반 분기
  ├─ CompactBadge 컴포넌트 (또는 인라인)
  ├─ 줌 보정 로직 (Unpinned)
  └─ 검증: 줌인/줌아웃 전환 동작

Phase 3: Pin 시스템 (F3.1~F3.7)
  ├─ WidgetOverride.pinned 타입 추가
  ├─ 리사이즈 시 자동 핀
  ├─ 컨텍스트 메뉴 Pin/Unpin
  ├─ DraggableWidget transform 줌 보정
  └─ 검증: Pinned HUD + Unpinned LOD 공존
```

> 각 Phase는 독립 배포 가능. Phase 1 완료 후 사용 피드백으로 Phase 2 임계값 결정.

---

## 7. 검증 체크리스트

### Phase 1

- [ ] 압력 위젯에 파랑 좌측 테두리 표시
- [ ] 온도 위젯에 빨강 좌측 테두리 표시
- [ ] 유량 위젯에 초록 좌측 테두리 표시
- [ ] 밸브 위젯에 주황 좌측 테두리 표시
- [ ] 알람 발생 시 색상 코딩 → 알람 색상으로 대체
- [ ] 값 폰트가 라벨보다 시각적으로 우세
- [ ] 기존 드래그/리사이즈 동작 정상

### Phase 2

- [ ] 줌 임계값 이상: Full Widget 표시
- [ ] 줌 임계값 미만: Compact Badge (값+단위) 표시
- [ ] NumericLabel 줌아웃에서도 숫자값 읽을 수 있음
- [ ] MiniChart 줌아웃 시 차트 제거, 최신값만 표시
- [ ] Compact Badge에 색상 코딩 테두리 유지

### Phase 3

- [ ] 리사이즈 시 자동 pinned = true
- [ ] 컨텍스트 메뉴에서 Pin/Unpin 토글 가능
- [ ] Pinned 위젯: 줌아웃해도 화면상 크기 고정 (HUD)
- [ ] Pinned 위젯: maxScale(4) 이상 커지지 않음
- [ ] Unpinned 위젯: LOD 전환 정상 동작
- [ ] Pinned 위젯에 📌 아이콘 표시
- [ ] 새로고침 후 pinned 상태 복원

---

## 8. 미결 사항

| # | 항목 | 결정 시점 |
|---|------|----------|
| O1 | LOD 임계값 초기값 (0.5? 0.6?) | Phase 1 완료 후 사용 피드백 |
| O2 | Compact Badge 줌 보정의 최소 크기 픽셀값 | Phase 2 구현 중 테스트 |
| O3 | maxScale 값 (3 vs 4) | Phase 3 구현 중 테스트 |
| O4 | 색상 매핑 사용자 커스텀 가능 여부 | 추후 결정 (현재는 하드코딩 우선) |
