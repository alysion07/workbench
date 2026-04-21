---
title: "FEAT: Project Picker Page"
status: in-progress
phase: 2
branch: alysion/feat_project_picker
last_updated: 2026-04-03
---

# FEAT: Project Picker Page

> **Parent**: [PHASE-02](../phases/PHASE-02-project-model.md)
> **Status**: 🚧 진행중
> **화면 ID**: PRJ-001, PRJ-001-NP
> **브랜치**: `alysion/feat_project_picker`

## Overview

사용자의 프로젝트 목록을 표시하고 선택/생성할 수 있는 진입점 페이지.
로그인 후 첫 화면으로, 기존 프로젝트 선택 또는 새 프로젝트 생성 기능 제공.

---

## UI Spec Reference

- **PDF**: [vsmr-sim-web.pdf](../../public/vsmr-sim-web.pdf) - Page 2
- **화면 ID**: PRJ-001

---

## Requirements

### 기능 요구사항

| 기능 | 상태 | 설명 |
|------|------|------|
| 프로젝트 리스트 | 🚧 | 카드 그리드로 프로젝트 목록 표시 |
| 프로젝트 검색 | ⏳ | 프로젝트명으로 필터링 |
| 새 프로젝트 생성 | ⏳ | PRJ-001-NP 다이얼로그 |
| 프로젝트 선택 | 🚧 | 클릭 시 MAIN-001로 이동 |
| 공지사항 섹션 | ⏳ | 플랫폼 공지 리스트 |
| 튜토리얼 섹션 | ⏳ | 입문자용 가이드 링크 |

### UI 레이아웃

```
┌─────────────────────────────────────────────────────────────────────┐
│  [M] VSMR SIM                                [DATE] [🔔] [✉]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  yjcho's Projects              [🔍 Search fields]  [NEW PROJECT]   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   ┌────────┐│
│  │              │  │              │  │              │   │Notice  ││
│  │  [Thumbnail] │  │  [Thumbnail] │  │  [Thumbnail] │   │────────││
│  │              │  │              │  │              │   │Notice A││
│  │  test project│  │  noname-1    │  │  noname-2    │   │Notice B││
│  │  최종수정    │  │  최종수정    │  │  최종수정    │   │Notice C││
│  │  2026.01.14  │  │  2026.01.14  │  │  2026.01.14  │   │        ││
│  │              │  │              │  │              │   │Tutorial││
│  │   [SELECT]   │  │   [SELECT]   │  │   [SELECT]   │   │────────││
│  └──────────────┘  └──────────────┘  └──────────────┘   │tut 1   ││
│                                                          │tut 2   ││
│  ┌──────────────┐  ┌──────────────┐                     │tut 3   ││
│  │  [Thumbnail] │  │  [Thumbnail] │                     └────────┘│
│  │  noname-3    │  │  noname-4    │                               │
│  │  2026.01.14  │  │  2026.01.14  │                               │
│  │   [SELECT]   │  │   [SELECT]   │                               │
│  └──────────────┘  └──────────────┘                               │
│                                                                     │
│                        [● ● ● ●] (페이지네이션)                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PRJ-001-NP: 새 프로젝트 생성 다이얼로그

```
┌─────────────────────────────────────────────────────────────────┐
│  New Project                                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐   Title                                │
│  │                     │   [VSMR-SMART________________]         │
│  │   [SMR 이미지]       │                                        │
│  │   계통 하이라이트    │   Description                          │
│  │                     │   [Placeholder__________________]      │
│  │                     │                                        │
│  │                     │   Tag                                  │
│  │                     │   [Chip] [Option 1] [×]                │
│  └─────────────────────┘                                        │
│                            Project Scope                    [+] │
│                            [Primary Loop ×] [Second Loop ×] [BOP ×]│
│                                                                 │
│                            Project Partition                [+] │
│                            ┌───────────────────────────────┐    │
│                            │ NAME: NSSS Model              │    │
│                            │ Analysis Code: [MARS ▼]       │    │
│                            │ Description: [___________]    │    │
│                            │ Model Scope: [Primary Loop ×] │    │
│                            └───────────────────────────────┘    │
│                            ┌───────────────────────────────┐    │
│                            │ NAME: BOP Model               │    │
│                            │ Analysis Code: [Modelica ▼]   │    │
│                            │ Model Scope: [BOP ×]          │    │
│                            └───────────────────────────────┘    │
│                                                                 │
│                                     [CREATE]  [CANCEL]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: 기본 구조 ✅
- [x] `ProjectPickerPage.tsx` 생성
- [x] 라우팅 설정 (`/projects`)
- [x] 기본 레이아웃

### Phase 2: 프로젝트 리스트 🚧
- [ ] 프로젝트 카드 컴포넌트
- [ ] 그리드 레이아웃
- [ ] 썸네일 표시
- [ ] SELECT 버튼 → MAIN-001 이동

### Phase 3: 새 프로젝트 생성 ⏳
- [ ] `NewProjectDialog.tsx` 생성
- [ ] Project Scope 선택 (Multi-select chips)
- [ ] Project Partition 동적 추가
- [ ] Analysis Code 선택 (MARS/Modelica)

### Phase 4: 검색/필터 ⏳
- [ ] 검색 입력창
- [ ] 태그 필터
- [ ] 페이지네이션

### Phase 5: 사이드 섹션 ⏳
- [ ] 공지사항 리스트
- [ ] 튜토리얼 링크

### Phase 6: 데이터 연동 ⏳
- [ ] Supabase 프로젝트 테이블
- [ ] 프로젝트 CRUD API

---

## Data Model

### Project

```typescript
interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  scope: ProjectScope[];
  partitions: ModelPartition[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

type ProjectScope = 'Primary Loop' | 'Second Loop' | 'BOP';

interface ModelPartition {
  id: string;
  name: string;
  analysisCode: 'MARS' | 'Modelica';
  description: string;
  scope: ProjectScope[];
}
```

---

## 주요 파일

| 파일 | 설명 | 상태 |
|------|------|------|
| `src/pages/ProjectPickerPage.tsx` | 메인 페이지 | 🚧 |
| `src/components/ProjectCard.tsx` | 프로젝트 카드 | ⏳ |
| `src/components/NewProjectDialog.tsx` | 생성 다이얼로그 | ⏳ |

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2025-01-30 | Feature 문서 작성 | PRJ-001 상세 명세 |
