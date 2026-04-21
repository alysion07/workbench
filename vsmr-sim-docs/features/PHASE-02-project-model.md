---
title: "Phase 2: Project & Model Management"
status: in-progress
phase: 2
branch: alysion/feat_project_picker
last_updated: 2026-04-03
---

# Phase 2: Project & Model Management

> **Parent**: [ROADMAP](../ROADMAP.md)
> **Status**: 🚧 진행중
> **브랜치**: `alysion/feat_project_picker`
> **화면 ID**: PRJ-001, MAIN-001, MDH-001

## Overview

프로젝트 및 모델 관리 시스템 구현.
사용자가 여러 프로젝트를 생성/관리하고, 각 프로젝트 내에서 다중 모델(MARS, Modelica)을 설정할 수 있는 계층 구조 도입.

---

## Goals

- [ ] 프로젝트 선택 페이지 (PRJ-001)
- [ ] 프로젝트 홈 페이지 (MAIN-001)
- [ ] 모델 홈 페이지 (MDH-001)
- [ ] Supabase DB 연동
- [ ] MinIO 파일 저장소 연동

---

## 화면 구성

### PRJ-001: 프로젝트 선택

```
┌─────────────────────────────────────────────────────────────────────┐
│  VSMR SIM                                    [날짜] [알림] [메일]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  yjcho's Projects              [Search]  [NEW PROJECT]              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │              │  │              │  │              │   Notice      │
│  │  [Thumbnail] │  │  [Thumbnail] │  │  [Thumbnail] │   ─────────   │
│  │              │  │              │  │              │   Notice A    │
│  │  test project│  │  project 1   │  │  project 2   │   Notice B    │
│  │  2026.01.14  │  │  2026.01.14  │  │  2026.01.14  │               │
│  │   [SELECT]   │  │   [SELECT]   │  │   [SELECT]   │   Tutorial    │
│  └──────────────┘  └──────────────┘  └──────────────┘   ─────────   │
│                                                          tutorial 1 │
│                        [● ● ● ●]                         tutorial 2 │
└─────────────────────────────────────────────────────────────────────┘
```

### MAIN-001: Project Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  Project Home - VSMR-SMART          [SIMULATION] [SETTING]          │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│ Project  │  ┌─────────────────────┐   ┌────────────────────────┐   │
│ Home     │  │                     │   │ Reactor Coolant System │   │
│          │  │  [SMR 이미지]        │   │ Analysis Code: MARS    │   │
│ Reactor  │  │  전체 노형 네비게이션  │   │ Model Scope: Primary   │   │
│ Coolant  │  │                     │   │              [EDIT]    │   │
│ System   │  │                     │   ├────────────────────────┤   │
│          │  │                     │   │ Balance of Plant       │   │
│ BOP      │  │                     │   │ Analysis Code: Modelica│   │
│ Model    │  │                     │   │              [EDIT]    │   │
│          │  └─────────────────────┘   └────────────────────────┘   │
│ History  │                                                          │
│          │  Update History              Simulation History          │
│          │  ┌────────────────────┐     ┌────────────────────────┐  │
│          │  │ 1.2 | 변경 | Restore│     │ LOFW Sim | Success     │  │
│          │  │ 1.1 | 변경 | Restore│     │ Sim 1    | Running     │  │
│          │  └────────────────────┘     └────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────────┘
```

### MDH-001: Model Home

```
┌─────────────────────────────────────────────────────────────────────┐
│  VSMR-SMART → NSSS Model                                            │
│  Model Home                         [SIMULATION] [SETTING]          │
├──────────┬──────────────────────────────────────────────────────────┤
│          │  ┌────────────────────────┐  ┌────────────────────────┐ │
│ Model    │  │ NAME: Reactor Coolant  │  │ Model Preview          │ │
│ Home     │  │ Code: MARS             │  │                        │ │
│          │  │ Desc: LOFW Scenario    │  │ LOFW Simulation        │ │
│ Model    │  │ Scope: Primary Loop    │  │ 홍길동 • 4 Feb 2022    │ │
│ Editor   │  │              [EDIT]    │  │                        │ │
│          │  └────────────────────────┘  │ [comp1][pump][valve]   │ │
│          │                              └────────────────────────┘ │
│          │  Simulation History                                      │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │ 2026-01-15 | LOFW Simulation | Success           │   │
│          │  │ 2026-01-15 | Simulation 1    | Running           │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│          │  Update History                                          │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │ 1.2 | Nordalization Diagram 변경 | Restore       │   │
│          │  └──────────────────────────────────────────────────┘   │
└──────────┴──────────────────────────────────────────────────────────┘
```

---

## Features

| 기능 | 상태 | 문서 |
|------|------|------|
| 프로젝트 리스트 | 🚧 | - |
| 프로젝트 검색/필터 | ⏳ | - |
| 새 프로젝트 생성 (PRJ-001-NP) | ⏳ | - |
| 공지사항/튜토리얼 | ⏳ | - |
| 전체 노형 네비게이션 | ⏳ | - |
| Project Partition | ⏳ | - |
| Update/Simulation History | ⏳ | - |
| Model Preview | ⏳ | - |
| Heat Structure Component | ⏳ | [FEAT-heat-structure](../features/FEAT-heat-structure.md) |

---

## 주요 파일

| 파일 | 설명 | 상태 |
|------|------|------|
| `src/pages/ProjectPickerPage.tsx` | PRJ-001 | 🚧 |
| `src/pages/ProjectHomePage.tsx` | MAIN-001 | 🚧 |
| `src/pages/ModelHomePage.tsx` | MDH-001 | 🚧 |

---

## 데이터 모델

### Project

```typescript
interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  scope: ('Primary Loop' | 'Second Loop' | 'BOP')[];
  partitions: ModelPartition[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}
```

### ModelPartition

```typescript
interface ModelPartition {
  id: string;
  name: string;
  analysisCode: 'MARS' | 'Modelica';
  description: string;
  scope: string[];
}
```

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2025-01-30 | Phase 2 문서 작성 | 진행중 |
