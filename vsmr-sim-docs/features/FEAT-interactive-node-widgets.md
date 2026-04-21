---
title: "FEAT: Interactive Node Widgets"
status: planned
phase: 4
last_updated: 2026-04-03
---

# FEAT: Interactive Node Widgets

> **상태**: Phase 0 구현 진행 중 🚧
> **브랜치**: `alysion/feat_shaft`
> **작성일**: 2026-02-20
> **최종 수정**: 2026-03-09

## Overview

SimulationPage의 "Interaction Control" 탭에서 EditorPage의 FlowCanvas를 read-only로 표시하고,
각 노드에 보조 위젯(수치 라벨, Auto/Manual 토글 등)을 부착하여
시뮬레이션 결과를 캔버스 위에서 직접 확인/조작할 수 있게 한다.

## 진입 경로

```
EditorPage → InteractiveInputs 설정 (Card 801-999) → globalSettings에 저장
  → SimulationPage 이동
  → 사이드바 "Interaction Control" 탭 클릭
  → FlowCanvas (read-only) + 모든 노드에 위젯 표시
     (추후: interactiveInputs에 설정된 컴포넌트만 위젯 표시)
```

---

## Current State

### Phase 0: 탐색적 프로토타입 🚧

**범위**: 모든 노드에 위젯 표시 (테스트용) + Trip Valve Auto/Manual 토글

| 항목 | 상태 | 설명 |
|------|------|------|
| 설계 문서 | ✅ | SimulationPage 탭 기반으로 수정 완료 |
| `interactive.ts` 타입 정의 | ⏳ | |
| `withNodeWidgets.tsx` HOC | ⏳ | 기존 노드 래핑 + NodeToolbar 주입 |
| `interactiveNodeTypes.ts` | ⏳ | HOC 래핑된 nodeTypes 맵 |
| `NumericLabelWidget.tsx` | ⏳ | 수치 라벨 위젯 |
| `AutoManualToggleWidget.tsx` | ⏳ | Trip Valve Auto/Manual 토글 |
| `WidgetRenderer.tsx` | ⏳ | 위젯 타입별 디스패처 |
| `InteractiveControlView.tsx` | ⏳ | read-only FlowCanvas + 위젯 |
| SimulationPage 탭 연동 | ⏳ | `disabled: true` → 활성화 + activeView 전환 |

---

## Architecture

### 핵심 변경: 별도 페이지 ❌ → SimulationPage 탭 ✅

```
SimulationPage
  ├─ activeView === 'simulation' → 기존 차트/로그 UI
  └─ activeView === 'interactive' → InteractiveControlView
       └─ ReactFlow (read-only)
            └─ interactiveNodeTypes (HOC 래핑)
                 └─ withNodeWidgets(OriginalNode)
                      ├─ <OriginalNode {...props} />
                      └─ <NodeToolbar> → 위젯들
```

### HOC `withNodeWidgets` 패턴

기존 노드 컴포넌트를 **수정하지 않고** HOC로 감싸서 ReactFlow `NodeToolbar` 기반 위젯 주입.

### 파일 구조 (새 파일만)

```
src/
├── types/
│   └── interactive.ts                    # 위젯 타입 정의
├── components/
│   └── interactive/
│       ├── withNodeWidgets.tsx            # HOC: 노드 래핑 + NodeToolbar 주입
│       ├── interactiveNodeTypes.ts        # HOC 적용된 nodeTypes 맵
│       ├── InteractiveControlView.tsx     # read-only FlowCanvas + 위젯 헤더
│       └── widgets/
│           ├── WidgetRenderer.tsx         # 위젯 타입별 디스패처
│           ├── NumericLabelWidget.tsx     # 수치 라벨 위젯
│           └── AutoManualToggleWidget.tsx # Trip Valve Auto/Manual 토글
```

**수정 파일**: `src/pages/SimulationPage.tsx` (탭 활성화 + InteractiveControlView 렌더)

### 위젯 표시 규칙 (Phase 0 → 추후)

| Phase | 대상 | 설명 |
|-------|------|------|
| Phase 0 (현재) | **모든 노드** | 테스트 목적, 타입별 기본 위젯 자동 생성 |
| 추후 | `interactiveInputs`에 설정된 컴포넌트만 | `controlType`에 맞는 위젯만 표시 |

---

## Phase Roadmap

| Phase | 범위 | 상태 |
|-------|------|------|
| Phase 0 | 모든 노드 위젯 + Trip Valve 토글 (SimulationPage 탭) | 🚧 |
| Phase 1 | interactiveInputs 기반 필터링 + 위젯 설정 UI | 미착수 |
| Phase 2 | Servo Valve 슬라이더 + Motor Valve 버튼 + Pump 토글 | 미착수 |
| Phase 3 | 실시간 시뮬레이션 데이터 연동 | 미착수 |
