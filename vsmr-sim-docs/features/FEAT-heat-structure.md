---
title: "FEAT: Heat Structure Component"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT: Heat Structure Component

> **Parent**: [PHASE-03](../phases/PHASE-03-advanced-components.md)
> **Status**: ⏳ 대기
> **우선순위**: 🔴 High

## Overview

MARS Heat Structure (HTSTR) 컴포넌트 구현.
벽면을 통한 열전달을 모델링하며, Volume과 연결되어 열교환을 수행하는 핵심 열수력 컴포넌트.

---

## Manual Reference

- **PDF**: Mars Input Manual (2010.02.).pdf
- **Pages**: 230-245 (Heat Structure 섹션)
- **Section**: 8 HYDRODYNAMIC COMPONENTS → Heat Structure

---

## Requirements

### 기능 요구사항
- [ ] Heat Structure 노드 생성 및 캔버스 배치
- [ ] Volume과의 연결 (좌/우 경계면)
- [ ] Mesh 구성 (재질, 두께, 노드 수)
- [ ] 초기 온도 설정
- [ ] 경계 조건 설정

### UI 요구사항
- [ ] 노드 시각화 (직사각형, 층 구분)
- [ ] 속성 패널 폼 (Geometry, Mesh, Initial, Boundary)
- [ ] Volume 연결 시 자동 ID 매핑

---

## Card Specifications

### CCC0001: Heat Structure Information

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| HSNUM | Integer | Y | Heat Structure 번호 |
| NHSN | Integer | Y | Axial 노드 수 |
| NHSG | Integer | Y | Geometry 타입 (1=slab, 2=cylinder) |

### CCC0101-0199: Mesh Flags

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| MFL | Integer | Y | Mesh flag per region |

### CCC0201-0299: Mesh Intervals

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| DELX | Real | Y | Mesh interval 두께 |

### CCC0301-0399: Compositions

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| MATID | Integer | Y | Material ID |
| NLEFT | Integer | Y | Left boundary node |
| NRIGHT | Integer | Y | Right boundary node |

### CCC0401-0499: Initial Temperatures

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| TEMP | Real | Y | Initial temperature (K) |

### CCC0501-0599: Left Boundary Conditions

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| BVOL | Integer | Y | Boundary volume number |
| INCR | Integer | Y | Volume increment |
| BCODE | Integer | Y | Boundary condition code |

### CCC0601-0699: Right Boundary Conditions

| 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|
| BVOL | Integer | Y | Boundary volume number |
| INCR | Integer | Y | Volume increment |
| BCODE | Integer | Y | Boundary condition code |

---

## Implementation Plan

### Phase 1: 타입 정의
- [ ] `HeatStructureData` 타입 정의 (`src/types/mars.ts`)
- [ ] Card 데이터 구조 정의

### Phase 2: 노드 컴포넌트
- [ ] `HeatStructureNode.tsx` 생성
- [ ] 노드 시각화 (층 구분, 색상)
- [ ] 연결 핸들 (좌/우)

### Phase 3: 폼 컴포넌트
- [ ] `HeatStructureForm.tsx` 생성
- [ ] Geometry 섹션
- [ ] Mesh 섹션 (동적 row 추가)
- [ ] Composition 섹션
- [ ] Initial Temperature 섹션
- [ ] Boundary Condition 섹션

### Phase 4: 파일 생성
- [ ] `fileGenerator.ts`에 Heat Structure 카드 생성 로직 추가
- [ ] 매뉴얼 형식 검증

### Phase 5: 테스트
- [ ] 단위 테스트
- [ ] 생성된 .i 파일 검증

---

## Technical Notes

### Geometry Types
```
1 = Rectangular (Slab)
    ┌─────────────┐
    │   Layer 1   │
    ├─────────────┤
    │   Layer 2   │
    └─────────────┘

2 = Cylindrical
    ╭─────────────╮
    │   Layer 1   │
    ├─────────────┤
    │   Layer 2   │
    ╰─────────────╯
```

### Boundary Condition Codes
- 0: Adiabatic (단열)
- 1: Convective to volume
- 101-199: Table-driven

---

## Dependencies

- **Requires**: Volume 컴포넌트 (연결 대상)
- **Blocks**: 열전달 시뮬레이션

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2025-01-30 | 초기 작성 | 매뉴얼 기반 Card 명세 정리 |
