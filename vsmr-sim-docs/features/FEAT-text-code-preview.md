---
title: "FEAT: Text Code Preview"
status: done
phase: 4
branch: main
related_prs: [#56,#80]
last_updated: 2026-04-03
---

# FEAT: Text Code Preview

> **Parent**: [PHASE-01-core-editor.md](../phases/PHASE-01-core-editor.md)
> **Status**: 🚧 Phase 1 완료, Phase 2 계획
> **Branch**: `alysion/feat_simulation_page`
> **Created**: 2026-03-23

---

## Overview

PropertyPanel 및 EditorPage에서 MARS 입력 파일(.i) 텍스트를 미리 볼 수 있는 기능.
기존 텍스트 기반 MARS 사용자에게 익숙한 코드 형태의 참조 UI를 제공한다.

**목적**: GUI에서 입력한 값이 .i 파일로 어떻게 출력되는지 실시간으로 확인

---

## 기능 구성

### 1. 컴포넌트 단위 미리보기 (PropertyPanel 탭)

| 항목 | 내용 |
|------|------|
| 위치 | PropertyPanel → `[Properties]` `[Text Preview]` 탭 |
| 범위 | 현재 선택된 컴포넌트 1개의 카드만 |
| 형식 | 읽기 전용 모노스페이스 텍스트 (다크 테마) |
| 복사 | Copy to clipboard 버튼 |

**저장 확인**: Text Preview 탭 클릭 시 미저장 변경사항(isDirty)이 있으면 저장 확인 다이얼로그 → 저장 후 미리보기 표시

### 2. 전체 Text Code Preview (EditorHeader 토글)

| 항목 | 내용 |
|------|------|
| 트리거 | EditorHeader의 `</>` 버튼 (CodeIcon) |
| 레이아웃 | FlowCanvas(60%) + Text Code Preview(40%) 공존, 리사이즈 가능 |
| PropertyPanel | Text Code Preview 활성 시 숨김 |
| 내용 | 전체 .i 파일 (Global Cards + 모든 컴포넌트 + End) |
| 라인넘버 | 좌측에 라인 번호 표시 |
| 복사 | Copy to clipboard 버튼 |

**저장 확인**: 토글 시 미저장 변경사항이 있으면 저장 확인 다이얼로그

### 3. Appearance 접이식 패널

| 항목 | 내용 |
|------|------|
| 위치 | Properties 탭 하단 (Accordion) |
| 핀 기능 | 핀 고정 시 노드 전환해도 펼침 유지 |
| 핀 상태 | 현재 세션(useState)만 유지, 새로고침 시 초기화 |

---

## 레이아웃

### 기본 상태
```
[Palette | FlowCanvas (75%)    | PropertyPanel (25%)   ]
                                 [Properties] [Text Preview]
                                 form fields...
                                 ▶ Appearance ──── 📌
```

### Text Code Preview 토글 ON
```
[Palette | FlowCanvas (60%)    | Text Code Preview (40%) ]
                                 (PropertyPanel 숨김)
```

---

## 구현 파일

| 파일 | 역할 |
|------|------|
| `src/stores/useStore.ts` | `fullCodeViewOpen` 상태 + `setFullCodeViewOpen`, `toggleFullCodeView` 액션 |
| `src/utils/fileGenerator.ts` | `generatePreview(node)` — 단일 노드의 카드 텍스트 생성 |
| `src/components/PropertyPanel.tsx` | 탭 `[Properties]` `[Text Preview]` + Appearance 접이식(핀) + 저장 확인 다이얼로그 |
| `src/components/panels/FullCodeView.tsx` | 전체 .i 파일 텍스트 표시 (라인넘버, 다크 테마, Copy) |
| `src/components/editor/EditorHeader.tsx` | Text Code Preview 토글 버튼 (CodeIcon) |
| `src/pages/EditorPage.tsx` | PanelGroup 조건부 패널 (fullCodeView ↔ PropertyPanel), 저장 확인 다이얼로그 |

---

## Current State

### Phase 1 — ✅ 완료 (2026-03-23)

- [x] PropertyPanel 탭 구조 변경: `[Properties]` `[Appearance]` → `[Properties]` `[Text Preview]`
- [x] Appearance를 Properties 탭 하단 접이식 Accordion으로 이동 (핀 기능 포함)
- [x] 컴포넌트 단위 Text Preview 탭 (MARSInputFileGenerator.generatePreview 활용)
- [x] 전체 Text Code Preview (FullCodeView 컴포넌트)
- [x] EditorHeader에 토글 버튼 추가
- [x] FlowCanvas와 FullCodeView 공존 레이아웃 (PanelGroup 내부 조건부 패널)
- [x] 미저장 변경사항 저장 확인 다이얼로그 (PropertyPanel 탭 전환 / EditorHeader 토글)
- [x] 빌드 검증 완료

### Phase 2 — ⏳ 계획

- [ ] 전체 뷰에서 컴포넌트 영역 클릭 → 해당 노드 선택 연동
  - `generateFullPreview()` — `{ nodeId, text }[]` 구조 반환
  - 노드별 `<div data-node-id="node_xxx">` 분리 렌더링
  - 클릭 시 `setSelectedNodeId()` → FullCodeView 닫힘 + FlowCanvas 해당 노드 포커스
- [ ] FlowCanvas 노드 선택 → FullCodeView 해당 컴포넌트 위치 자동 스크롤 (양방향 연동)
- [ ] 구문 하이라이팅 (MARS 카드 번호, 주석, 섹션 헤더 색상 구분)

---

## Changelog

| 날짜 | 내용 |
|------|------|
| 2026-03-23 | Phase 1 구현 완료: 컴포넌트/전체 미리보기, Appearance 접이식, 저장 확인 다이얼로그 |
