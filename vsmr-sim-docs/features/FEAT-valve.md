---
title: "FEAT: Valve 컴포넌트"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT: Valve 컴포넌트

> **Parent**: [PHASE-03-advanced-components.md](../phases/PHASE-03-advanced-components.md)
> **Status**: ✅ 완료
> **Created**: 2026-02-02

---

## Overview

MARS 시뮬레이터의 Valve 컴포넌트 구현. 유량 제어를 위한 3종의 밸브 타입 지원.

**구현 대상**:
| 타입 | 설명 | 사용 예시 | SMART 사용 수 |
|------|------|----------|:---:|
| **TRPVLV** | Trip Valve (트립 밸브) | PSV, Break | 4 |
| **SRVVLV** | Servo Valve (서보 밸브) | SDSV, SG Tube Rupture | 3 |
| **MTRVLV** | Motor Valve (모터 밸브) | MFIV, MSIV, PRHRS 밸브 | 21 |
| | | **합계** | **28** |

> 분석 기준: SMART_SIM_BASE_REV01.i

---

## Manual Reference

- **PDF**: Mars Input Manual (2010.02.).pdf
- **Pages**: 180-190 (Section 8.15 Valve Component)

### Card Specifications

| Card | 용도 | 필수 | 형식 |
|------|------|:---:|------|
| CCC0000 | Component 정의 | Y | `{id}  {name}  valve` |
| CCC0101 | Junction Geometry | Y | **타입별 상이** (아래 참조) |
| CCC0102 | Loss + Discharge/Thermal | 타입별 | mtrvlv: fwdLoss, revLoss, jefvcahs / trpvlv·srvvlv: discharge, thermal |
| CCC0103 | Discharge/Thermal | mtrvlv만 | dischargeCoeff, thermalCoeff |
| CCC0201 | Initial Conditions | Y | control, liquidFlow, vaporFlow, 0.0 |
| CCC0300 | Valve Sub-Type | Y | trpvlv \| srvvlv \| mtrvlv |
| CCC0301 | Valve-specific Data | Y | 밸브 타입별 상이 |

> **Note**: trpvlv/srvvlv의 CCC0102는 UI에서 "Discharge/Thermal Coefficients" 체크 시에만 출력됩니다.
> 체크하지 않으면 MARS 기본값(1.0, 0.14)이 적용됩니다.

### CCC0101 카드 포맷 차이 (SMART 분석 기반)

| 밸브 타입 | CCC0101 | CCC0102 | CCC0103 |
|-----------|---------|---------|---------|
| **mtrvlv** | 3-word: from, to, area | fwdLoss, revLoss, jefvcahs | dischargeCoeff, thermalCoeff |
| **trpvlv** | 6-word: from, to, area, fwdLoss, revLoss, jefvcahs | 체크 시 출력 | - |
| **srvvlv** | 6-word: from, to, area, fwdLoss, revLoss, jefvcahs | 체크 시 출력 | - |

> **UI 구현**: "Discharge/Thermal Coefficients" 체크박스로 명시적 활성화. 체크 시에만 CCC0102 출력

### Valve Type별 Card 0301 형식

**TRPVLV (Trip Valve)**:
```
CCC0301  {tripNumber}
```
- W1: Trip 번호 (401-599)

**SRVVLV (Servo Valve)**:
```
CCC0301  {controlVariableNumber}  [{valveTableNumber}]
```
- W1: Control Variable 번호
- W2: General Table 번호 (선택)

**MTRVLV (Motor Valve)**:
```
CCC0301  {openTrip}  {closeTrip}  {openingRate}  {initialPosition}  [{tableNum}]  [{closingRate}]
```
- W1: Open Trip 번호
- W2: Close Trip 번호
- W3: 개폐 속도 (s⁻¹)
- W4: 초기 위치 (0-1)
- W5: General Table 번호 (선택)
- W6: 닫힘 속도 (선택)

### SMART 실제 카드 예시

**Motor Valve (mtrvlv)** - C303 MFIV:
```
3030000      fw_misv1         valve
3030101     302010002     305010001        0.0117
3030102           1.0           1.0      01000100
3030103           1.0          0.14
3030201             1          40.2           0.0           0.0
3030300        mtrvlv
3030301           510           506           0.2           1.0
```

**Trip Valve (trpvlv)** - C289 PSV:
```
2890000  pzrpsv1   valve
2890101  280040002    291010001   1.24e-3  1.0    100.0   00100
2890201  1        0.0           0.0           0.0
2890300  trpvlv
2890301  735
```

**Servo Valve (srvvlv)** - C281 SDSV:
```
2810000  sdsv1    valve
2810101  280040002    283010001   0.00144  1.0    100.0   00100
2810201  1        0.0           0.0           0.0
2810300  srvvlv
2810301  101
```

---

## Requirements

### 기능 요구사항

1. **노드 생성/삭제**
   - ComponentPalette에서 드래그 앤 드롭으로 Valve 노드 생성
   - 노드 삭제 시 연결된 Edge 자동 정리

2. **파라미터 편집**
   - PropertyPanel에서 Valve 파라미터 편집
   - 밸브 타입 선택 시 해당 타입의 필드만 표시
   - from/to Volume 연결 Autocomplete 지원
   - Edge↔Form 양방향 동기화 (autoFrom/autoTo)
   - Variable Trips 동적 드롭다운 (Trip/Motor Valve)

3. **파일 생성**
   - .i 파일 내보내기 시 MARS Card 형식으로 생성
   - **밸브 타입별 CCC0101 포맷 분기** (mtrvlv: 3-word / trpvlv·srvvlv: 6-word)
   - mtrvlv: CCC0103 카드 생성 (discharge/thermal coefficients)

4. **검증**
   - 필수 필드 검증 (area, 밸브별 필수 파라미터)
   - 범위 검증 (tripNumber: 401-599, initialPosition: 0-1)
   - from/to 연결은 warning (저장 차단하지 않음)

### 비기능 요구사항

- 기존 SNGLJUN 컴포넌트와 동일한 UX 패턴 유지
- TypeScript 타입 안전성 보장

---

## Implementation Plan

### Step 1: 기본 구조 완성

| Task | 상태 | 파일 |
|------|:---:|------|
| 1.1 타입 정의 | ✅ | `src/types/mars.ts` |
| 1.2 ValveNode 컴포넌트 | ✅ | `src/components/nodes/ValveNode.tsx` |
| 1.3 ValveForm 컴포넌트 | ✅ | `src/components/forms/ValveForm.tsx` |
| 1.4 ComponentPalette 연결 | ✅ | `src/components/ComponentPalette.tsx` |
| 1.5 FlowCanvas nodeTypes 등록 | ✅ | `src/components/FlowCanvas.tsx` |
| 1.6 PropertyPanel 연결 | ✅ | `src/components/PropertyPanel.tsx` |

### Step 2: 핵심 로직

| Task | 상태 | 파일 |
|------|:---:|------|
| 2.1 Edge 연결 시 from/to 자동 업데이트 | ✅ | `src/stores/useStore.ts` |
| 2.2 Edge↔Form 양방향 동기화 | ✅ | `src/stores/useStore.ts`, `ValveForm.tsx` |
| 2.3 파일 생성 (generateValveCards) | ✅ | `src/utils/fileGenerator.ts` |
| 2.4 검증 로직 (validateValve) | ✅ | `src/utils/componentValidation.ts` |

### Step 3: UX 개선

| Task | 상태 | 파일 |
|------|:---:|------|
| 3.1 Variable Trips 동적 드롭다운 | ✅ | `ValveForm.tsx` |
| 3.2 Global Settings 바로가기 버튼 | ✅ | `ValveForm.tsx`, `useStore.ts`, `GlobalSettingsDialog.tsx` |
| 3.3 Control Variable 드롭다운 + 설정탭 연동 | ✅ | CV 드롭다운 선택, 빈 값 안내, GS 바로가기 |

### Step 4: 파일 생성 보완

| Task | 상태 | 파일 |
|------|:---:|------|
| 4.1 CCC0101 타입별 포맷 분기 | ✅ | `src/utils/fileGenerator.ts` |
| 4.2 CCC0103 카드 생성 (mtrvlv) | ✅ | `src/utils/fileGenerator.ts` |

---

## Technical Notes

### 타입 구조

```typescript
export type ValveSubType = 'mtrvlv' | 'trpvlv' | 'srvvlv';

export interface ValveParameters {
  name: string;
  from: VolumeReference;
  to: VolumeReference;
  area: number;
  fwdLoss: number;
  revLoss: number;
  jefvcahs: string;
  enableDischargeCoeffs?: boolean;  // 명시적 활성화 체크박스
  dischargeCoeff?: number;          // default: 1.0
  thermalCoeff?: number;            // default: 0.14
  initialConditionType: 0 | 1;
  initialLiquidFlow: number;
  initialVaporFlow: number;
  valveSubType: ValveSubType;
  // mtrvlv
  openTripNumber?: number;
  closeTripNumber?: number;
  valveRate?: number;
  initialPosition?: number;
  // trpvlv
  tripNumber?: number;
  // srvvlv
  controlVariable?: number;
}
```

### 파일 생성 예시

**TRPVLV** (6-word CCC0101):
```
1500000  TRPVALVE1    valve
1500101  120010002  130010001  1.24e-3  1.0  100.0  00100
1500201  1  0.0  0.0  0.0
1500300  trpvlv
1500301  501
```

**SRVVLV** (6-word CCC0101):
```
1600000  SRVOVALVE1   valve
1600101  120010002  130010001  0.00144  1.0  100.0  00100
1600201  1  0.0  0.0  0.0
1600300  srvvlv
1600301  101
```

**MTRVLV** (3-word CCC0101 + CCC0102 + CCC0103):
```
1700000  MTRVALVE1    valve
1700101  120010002  130010001  0.0117
1700102  1.0  1.0  01000100
1700103  1.0  0.14
1700201  1  0.0  0.0  0.0
1700300  mtrvlv
1700301  501  502  0.2  1.0
```

---

## 제외 항목 (SMART 미사용)

| 항목 | 사유 |
|------|------|
| CHKVLV (Check Valve) | SMART에서 미사용 |
| INRVLV (Inertial Valve) | SMART에서 미사용 |
| CCC0110 (CCFL Data) | SMART에서 미사용 |
| CCC0111 (Form Loss Data) | SMART에서 미사용 |
| CCC0400-0499 (Valve Table) | SMART에서 미사용 |

---

## Dependencies

- **Requires**: None (기본 컴포넌트 구조 이미 구현됨)
- **Blocks**: None

---

## Verification

### 테스트 체크리스트

- [x] ComponentPalette에서 Valve 드래그 앤 드롭
- [x] 노드가 캔버스에 정상 생성
- [x] PropertyPanel에 ValveForm 표시
- [x] 밸브 타입 변경 시 해당 필드만 표시
- [x] from/to Autocomplete 동작
- [x] 폼 저장 시 노드 데이터 업데이트
- [x] 상태 표시 (OK/Error/Setup)
- [x] Edge 연결/삭제 시 from/to 동기화
- [x] Variable Trips 드롭다운 동작
- [x] .i 파일 생성 시 타입별 CCC0101 포맷 검증
- [x] mtrvlv CCC0103 카드 출력 검증
- [x] SMART 파일 타입별 대표 검증 (mtrvlv/trpvlv/srvvlv 각 1건, 28개 모두 동일 구조)

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-02 | 초기 작성 | TRPVLV, SRVVLV, MTRVLV 구현 계획 |
| 2026-02-02 | Step 1 완료 | 타입, 노드, 폼, 팔레트, 캔버스, 패널 |
| 2026-02-03 | Step 2 완료 (2.3 제외) | Edge 동기화, 검증 로직 |
| 2026-02-03 | Step 3 완료 (3.3 제외) | Trip 드롭다운, 설정 바로가기 |
| 2026-02-10 | Step 3.3 완료 + 출력 검증 | CV 드롭다운, 빈 값 처리, 출력파일 포맷 개선 (주석 헤더 추가), CCC0101/0103 검증 완료 |
| 2026-02-03 | 문서 통합 | Valve_Implementation_Plan.md 내용 머지 (SMART 분석, 카드 포맷 차이, 제외 항목) |
