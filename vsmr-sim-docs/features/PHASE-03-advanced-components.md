---
title: "Phase 3: Advanced Components"
status: done
phase: 3
branch: main
last_updated: 2026-04-03
---

# Phase 3: Advanced Components

> **Parent**: [ROADMAP](../ROADMAP.md)
> **Status**: ✅ 완료 (Accumulator 제외)
> **화면 ID**: DES-001 확장

## Overview

MARS 시뮬레이터에서 필요한 고급 컴포넌트 추가 구현.
Phase 1의 기본 컴포넌트 외에 분기, 펌프, 밸브, 열구조물 등 복잡한 컴포넌트 지원.

---

## Goals

- [x] Branch 컴포넌트 ✅
- [x] Pump 컴포넌트 ✅
- [x] Valve 컴포넌트 ✅
- [x] Heat Structure 컴포넌트 ✅
- [x] Separator 컴포넌트 ✅
- [x] Turbine 컴포넌트 ✅
- [x] Tank 컴포넌트 ✅
- [x] Multiple Junction 컴포넌트 ✅
- [ ] Accumulator 컴포넌트

---

## 컴포넌트 현황

| 컴포넌트 | MARS Code | Node 파일 | Form 파일 | 상태 |
|----------|-----------|-----------|-----------|------|
| **Heat Structure** | HTSTR | `HeatStructureNode.tsx` | `HeatStructureForm.tsx` | ✅ |
| **Branch** | BRANCH | `BranchNode.tsx` | `BranchForm.tsx` | ✅ |
| **Pump** | PUMP | `PumpNode.tsx` | `PumpForm.tsx` | ✅ |
| **Valve** | VALVE | `ValveNode.tsx` | `ValveForm.tsx` | ✅ |
| **Turbine** | TURBINE | `TurbineNode.tsx` | `TurbineForm.tsx` | ✅ |
| **Tank** | TANK | `TankNode.tsx` | `TankForm.tsx` | ✅ |
| **Separator** | SEPARATOR | `SeparatorNode.tsx` | `SeparatorForm.tsx` | ✅ |
| **Multiple Junction** | MTPLJUN | `MtpljunNode.tsx` | `MtpljunForm.tsx` | ✅ |
| **Accumulator** | ACCUM | - | - | ⏳ |

---

## Heat Structure (HTSTR)

**문서**: [FEAT-heat-structure](../features/FEAT-heat-structure.md)

### 개요
- 벽면을 통한 열전달 모델링
- Volume과 연결되어 열교환 수행
- 여러 재질 층(Mesh) 구성 가능

### 주요 Cards
| Card | 설명 |
|------|------|
| CCC0001 | Heat structure number, geometry |
| CCC0101-0199 | Mesh flags |
| CCC0201-0299 | Mesh intervals |
| CCC0301-0399 | Compositions |
| CCC0401-0499 | Initial temperatures |

---

## Branch (BRANCH)

### 개요
- 3개 이상의 연결점을 가진 분기 컴포넌트
- 복수의 Junction을 하나의 노드로 관리

### 예상 구현
```
      ┌───┐
  ────┤   ├────
      │ B │
  ────┤   ├────
      └───┘
```

---

## Pump (PUMP)

### 개요
- 유체 구동 장치
- 회전 속도, 헤드 곡선 등 설정

### 주요 속성
- Pump speed (RPM)
- Head curve
- Torque curve
- Two-phase multiplier

---

## Valve (VALVE)

### 개요
- 유량 제어 장치
- 개폐 상태, 유량 계수 설정

### 주요 속성
- Valve type (check, relief, servo)
- Flow area
- Open/Close status
- Cv coefficient

---

## Dependencies

- **Requires**: Phase 1 (Core Editor) ✅
- **Requires**: Phase 2 (Project Management) - 모델 저장 연동

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-03-23 | Phase 3 상태 갱신 | 8개 컴포넌트 완료 반영 (Accum 제외) |
| 2025-01-30 | Phase 3 문서 작성 | 대기 상태 |
