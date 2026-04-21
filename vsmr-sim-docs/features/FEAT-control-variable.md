---
title: "FEAT: Control Variable (제어 변수)"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT: Control Variable (제어 변수)

> Parent: [PHASE-01](../phases/PHASE-01-core-editor.md) | Status: 🚧

## Overview

MARS 시뮬레이터의 **Control System** (Cards 205CCCNN)을 GUI에서 정의/편집하는 기능.
Control Variable는 시뮬레이션에서 계산된 양(온도, 압력, 유량 등)을 가공하여 새로운 변수를 만들거나,
밸브/펌프 제어 신호를 생성하는 핵심 기능이다.

SMART 입력 파일 기준으로 약 **80+개**의 Control Variable이 정의되며, 11가지 타입이 사용된다.

## Manual Reference

- **PDF**: Mars Input Manual (2010.02.).pdf
- **Pages**: 269-282 (Section 14: CONTROL SYSTEM)
- **Card Range**: 205CCCNN (CCC: 001-999) 또는 205CCCCN (CCCC: 0001-9999)

### Card Format 개요

| Card | 용도 | 필수 |
|------|------|------|
| 20500000 | Card type 선택 (999 or 9999) | N (기본: 205CCCNN) |
| 205CCC00 | 제어 변수 타입/파라미터 정의 | Y |
| 205CCC01-98 | 제어 변수 데이터 (타입별 상이) | 타입에 따라 |

---

## Card Specifications

### Card 205CCC00: Control Component Type

| Word | 타입 | 필드명 | 설명 | 필수 |
|------|------|--------|------|------|
| W1 | A | name | 이름 (최대 8자) | Y |
| W2 | A | type | 컴포넌트 타입 (아래 목록) | Y |
| W3 | R | scalingFactor | 스케일링 팩터 (CONSTANT인 경우 상수 값) | Y |
| W4 | R | initialValue | 초기값 | CONSTANT 외 Y |
| W5 | I | initialValueFlag | 0=W4 사용, 1=자동 계산 | CONSTANT 외 Y |
| W6 | I | limiterControl | 0=없음, 1=최소만, 2=최대만, 3=둘다 | N |
| W7 | R | minOrMaxValue | 단일 제한값 또는 최소값 | W6>0 |
| W8 | R | maxValue | 최대값 (W6=3일 때) | W6=3 |

> **CONSTANT 타입 특수 규칙** (매뉴얼 p278, Section 14.3.17):
> W3가 상수 값 자체. **W4, W5 이후 모든 워드 생략 가능**. 데이터 카드(205CCC01~) 없음.
> "No additional words are entered on this card, and cards 205CCC01-CCC09 are not entered."
> 예: `20521000  pzr1  constant  0.0` (4필드만)

### Control Variable Types (W2)

| 타입 | 설명 | 수식 | Data Card 형식 |
|------|------|------|----------------|
| **SUM** | 합산 | Y = S(A0 + A1V1 + A2V2 + ... + AjVj) | 상수 A0 + 반복 {Aj, varName, varCode} |
| **MULT** | 곱셈 | Y = S * V1 * V2 * ... * Vj | 반복 {varName, varCode} |
| **DIV** | 나눗셈 | Y = S/V1 또는 Y = S*V2/V1 | {varName1, varCode1} [, {varName2, varCode2}] |
| **DIFFRENI** | 미분 (비권장) | Y = S * dV1/dt | {varName, varCode} |
| **DIFFREND** | 미분 | Y = S * dV1/dt (차분 근사) | {varName, varCode} |
| **INTEGRAL** | 적분 | Y = S * ∫V1 dt | {varName, varCode} |
| **FUNCTION** | 테이블 함수 | Y = S * TABLE(V1) | {varName, varCode, tableNumber} |
| **STDFNCTN** | 표준 함수 | Y = S * f(V1, V2, ...) | {fnctnName, varName, varCode, ...} |
| **DELAY** | 지연 | Y = S * V1(t - td) | {varName, varCode, delayTime, holdPositions} |
| **TRIPUNIT** | Trip 유닛 | Y = S * U(T1) | {tripNumber} |
| **TRIPDLAY** | Trip 지연 | Y = S * Trptim(T1) | {tripNumber} |
| **POWERI** | 정수 거듭제곱 | Y = S * V1^I | {varName, varCode, intPower} |
| **POWERR** | 실수 거듭제곱 | Y = S * V1^R | {varName, varCode, realPower} |
| **POWERX** | 변수 거듭제곱 | Y = S * V1^V2 | {varName1, varCode1, varName2, varCode2} |
| **PROP-INT** | 비례적분 | Y = S * (A1*V1 + A2*∫V1 dt) | {A1, A2, varName, varCode} |
| **LAG** | 1차 지연 | Y = S * ∫(V1-Y)/A1 dt | {lagTime, varName, varCode} |
| **LEAD-LAG** | 리드-래그 | 전달함수 (1+A1s)/(1+A2s) | {leadTime, lagTime, varName, varCode} |
| **CONSTANT** | 상수 | Y = W3 (205CCC00의 스케일링 팩터) | 데이터 카드 없음 |
| **SHAFT** | 샤프트 | 회전속도 방정식 | 복합 (CCC01-06) |
| **PUMPCTL** | 펌프 제어 | 자기초기화 루프 유량 제어 | {setpoint, sensed, scale, T2, T1} |
| **STEAMCTL** | 증기 제어 | 자기초기화 증기유량 제어 | {setpoint, sensed, scale, T4, T3} |
| **FEEDCTL** | 급수 제어 | 자기초기화 급수유량 제어 | 복합 (12 words) |
| **DIGITAL** | 디지털 | Y = S * V1_sampled(t - td) | {varName, varCode, samplingTime, delayTime} |

### Variable Request Codes (참조 변수)

Control Variable의 데이터 카드에서 사용되는 변수 참조.
매뉴얼 Minor Edit 섹션 (p47-61) 기반.

#### Volume Quantities (파라미터: CCCNN0000)

| Alphanumeric | 설명 | SMART 사용빈도 |
|--------------|------|---------------|
| p | 압력 (Pa) | 6회 |
| tempf | 유체 온도 (K) | 2회 |
| tempg | 증기 온도 (K) | 3회 |
| voidf | 보이드율 (void fraction) | 65회 |
| rhof | 액체 밀도 | - |
| uf | 액체 내부 에너지 | - |

> **파라미터 형식**: `CCCNN0000` (CCC=컴포넌트, NN=볼륨번호)
> 예: `280040000` = 컴포넌트 280, 볼륨 04

#### Junction Quantities (파라미터: CCCMM0000)

| Alphanumeric | 설명 | SMART 사용빈도 |
|--------------|------|---------------|
| mflowj | 총 질량유량 (kg/s) | 9회 |
| mflowfj | 액체 질량유량 | - |
| mflowgj | 증기 질량유량 | - |
| voidfj | Junction 보이드율 | - |

> **파라미터 형식**: 컴포넌트 타입에 따라 다름
> - 단일 Junction (SNGLJUN): `CCC000000`
> - Pipe 내부 Junction: `CCCMM0000` (MM=정션번호)
> - Multiple Junction: `CCCIINN00` (II, NN=인덱스)

#### Heat Structure Quantities

| Alphanumeric | 설명 | SMART 사용빈도 |
|--------------|------|---------------|
| q | 총 벽면 열전달량 (W) | **82회** |
| httemp | 메시 포인트 온도 | - |
| htvat | 체적 평균 온도 | - |
| htrnr | 열속 (W/m²) | - |

> **파라미터 형식** (매뉴얼 p58 기반):
> - 기본 형식: `CCCG0NN` (7자리) + 경계 표시 (2자리) = **9자리**
>   - CCC = 컴포넌트 번호 (예: 120)
>   - G = 기하구조 번호 (0-9, 대부분 0)
>   - NN = 셀/영역 번호 (01-99)
>   - 경계: 00=좌측, 01=우측, 또는 메시포인트 번호
>
> - **`q` 예시**: `120020000` = HS#120, 셀 02, 좌측 경계 열전달량
> - **`httemp` 예시**: `CCCG0NNMM` (MM=메시포인트 번호)

#### General System Quantities (파라미터: 0)

| Alphanumeric | 설명 |
|--------------|------|
| time | 시뮬레이션 시간 (s) |
| rktpow | 총 원자로 출력 (W) |
| cputime | CPU 시간 (s) |

#### Control Variable Reference (파라미터: CCC)

| Alphanumeric | 설명 |
|--------------|------|
| cntrlvar | 다른 Control Variable 참조 |

> **파라미터**: 제어변수 번호 (CCC: 001-999)

> **전체 목록**: 매뉴얼 p47-61 (Minor Edit 섹션) 참조

---

## SMART 파일 사용 현황 분석

### 타입별 사용 빈도

| 타입 | 개수 | 용도 예시 |
|------|------|----------|
| SUM | 30 | 열전달량 합계, 수위 계산, 압력차 계산 |
| CONSTANT | 20 | 서보밸브 초기 위치 (pzr1~4, msiv1~4, mfiv1~4) |
| FUNCTION | 16 | 수위→% 변환 (테이블 501~505 참조) |
| TRIPUNIT | 4 | Trip → 0/1 변환 (sdsv, pzrpsv) |
| MULT | 2 | 출력×Trip 신호 곱셈 |
| PROP-INT | 2 | PI 제어기 (LIC-100, PIC-100) |
| STDFNCTN | 1 | MAX 함수 (h-tavg) |
| INTEGRAL | 1 | 급수 유량 적분 (int_fw) |
| TRIPDLAY | 1 | Trip 후 경과 시간 (aftpow) |
| DIGITAL | 0 | (본 모델 미사용) |

### 참조 변수 (Variable Request Code) 사용 빈도

| Code | 횟수 | 파라미터 예시 | 설명 |
|------|------|-------------|------|
| q | 82 | 120020000 | Heat Structure 열전달량 |
| voidf | 65 | 280010000 | Volume void fraction |
| cntrlvar | 7+ | 510, 201 | 다른 Control Variable |
| mflowj | 9 | 307000000 | Junction 질량유량 |
| p | 6 | 280040000 | Volume 압력 |
| tempg | 3 | CCCNN0000 | 증기 온도 |
| tempf | 2 | CCCNN0000 | 유체 온도 |

### Control Variable 번호 관례 (SMART 기준)

| 범위 | 용도 | 예시 |
|------|------|------|
| 1xx | Trip 기반 신호 (TRIPUNIT) | 101=sdsv, 102=pzrpsv |
| 2xx | 수위/레벨 계산 | 201=rpv-l, 206=sg-l |
| 2xx (261~) | 노심 출력 분포 | 261=pow01 ~ 270=pow10 |
| 3xx | Heat Transfer 계산 | 301=c2r_avg, 304=r2s_1 |
| 5xx | 제어기 (PI, Function) | 510=pzr-l, 517=LIC-100 |
| 6xx | 유량/적분 계산 | 600=tot_fw, 602=int_fw |
| 9xx | 압력차/밸브 제어 | 901=core_dp, 910=brk1 |

> 자동 번호 할당 시 이 관례 참고 권장

### 대표 예시

**SUM 타입** (코어 평균 온도):
```
*           name      type      scaling   initial   intial value flag
20530100    c2r_avg   sum       1.0       0.0       1
*           w1     w2     w3       w4
20530101    0.0    1.0    q        120020000
20530102           1.0    q        120030000
...
20530110           1.0    q        120110000
```

**TRIPUNIT 타입** (안전 정지 신호):
```
*           name     type       scale     ival      iflag
20510100    sdsv     tripunit   1.0       0.0       1
*           w1(trip number)
20510101    724
```

**FUNCTION 타입** (가압기 수위):
```
*           name     type       scale     ival      iflag
20551100    pzr-al   function   1.0       70.0      1
*           w1        w2     w3
20551101    cntrlvar  510    501
```

**CONSTANT 타입**:
```
20521000  pzr1    constant    0.0
20521100  pzr2    constant    0.0
```

**PROP-INT 타입** (PI 제어기):
```
*         name      type      scaling   initial   intial value flag
20551700  LIC-100   prop-int  1.0       0.0       1
*         w1        w2           w3         w4
20551701  1.0       5.5556e-4    cntrlvar   516
```

---

## Requirements

### 기능 요구사항

1. **Control Variable 목록 관리**: CRUD (생성/조회/수정/삭제)
2. **22가지 타입 지원**: 최소 SMART에서 사용되는 11가지 타입 우선 구현
3. **타입별 동적 폼**: 선택된 타입에 따라 데이터 카드 입력 폼 변경
4. **변수 참조 자동완성**: 볼륨/정션/열구조물/제어변수 ID 자동완성
5. **MARS 입력 파일 생성**: 205CCCNN 카드 형식으로 출력
6. **유효성 검증**: 필수 필드, 참조 무결성, 타입별 규칙

### 비기능 요구사항

- GlobalSettingsDialog의 새 탭으로 구현
- 기존 VariableTripsTab/ThermalPropertiesTab 패턴 준수
- 대량 (80+) Control Variable 효율적 처리 (가상화 또는 페이지네이션)

---

## Implementation Plan

### Phase 1: 기본 타입 구현 (Core)

가장 빈도가 높고 단순한 타입부터 구현.

#### Task 1: 타입 정의 (`mars.ts`) ✅

- [x] `ControlComponentType` 유니온 타입 정의 (18가지 타입, SHAFT/PUMPCTL/STEAMCTL/FEEDCTL 제외)
- [x] `ControlVariableBase` 인터페이스 정의 (공통 필드)
- [x] 타입별 Data 인터페이스 (Discriminated Union) - 18개 타입 모두 정의
- [x] `VariableRef` 인터페이스 (variableName + parameterCode 쌍)
- [x] `GlobalSettings`에 `controlVariables` 필드 추가
- [x] `isConstantControlVariable`, `isNonConstantControlVariable` 타입 가드 함수

```typescript
// === Control Variable Types ===

export type ControlComponentType =
  | 'SUM' | 'MULT' | 'DIV'
  | 'DIFFRENI' | 'DIFFREND' | 'INTEGRAL'
  | 'FUNCTION' | 'STDFNCTN'
  | 'DELAY' | 'DIGITAL'
  | 'TRIPUNIT' | 'TRIPDLAY'
  | 'POWERI' | 'POWERR' | 'POWERX'
  | 'PROP-INT' | 'LAG' | 'LEAD-LAG'
  | 'CONSTANT'
  | 'SHAFT' | 'PUMPCTL' | 'STEAMCTL' | 'FEEDCTL';

export interface VariableReference {
  variableName: string;  // Alphanumeric (p, tempf, mflowj, cntrlvar, ...)
  parameterCode: number; // Numeric (CCCVV0000, CCC, 0, ...)
}

/**
 * CONSTANT 타입 전용 인터페이스
 * - W4(initialValue), W5(initialValueFlag) 생략
 * - scalingFactor가 상수 값 자체
 */
export interface ConstantControlVariable {
  number: number;
  name: string;
  componentType: 'CONSTANT';
  scalingFactor: number;  // = 상수 값
  comment?: string;
  // 아래 필드 없음 (CONSTANT 특수 규칙)
}

/**
 * CONSTANT 외 타입의 공통 베이스 인터페이스
 */
export interface ControlVariableBase {
  /** Control variable number (CCC: 001-999) */
  number: number;
  /** Descriptive name (max 8 chars) */
  name: string;
  /** Component type (CONSTANT 제외) */
  componentType: Exclude<ControlComponentType, 'CONSTANT'>;
  /** Scaling factor (S) */
  scalingFactor: number;
  /** Initial value (required for non-CONSTANT) */
  initialValue: number;
  /** Initial value flag: 0=use initialValue, 1=compute */
  initialValueFlag: 0 | 1;
  /** Limiter control: 0=none, 1=min, 2=max, 3=both */
  limiterControl: 0 | 1 | 2 | 3;
  /** Min value (when limiterControl >= 1) */
  minValue?: number;
  /** Max value (when limiterControl >= 2) */
  maxValue?: number;
  /** User comment */
  comment?: string;
}

// --- Type-specific data ---

export interface SumData {
  /** Constant A0 */
  constant: number;
  /** Product terms: {coefficient, variable} */
  terms: Array<{
    coefficient: number;
    variable: VariableReference;
  }>;
}

export interface MultData {
  /** Factor variables */
  factors: VariableReference[];
}

export interface DivData {
  /** Numerator variable (V2, optional for Y=S/V1 form) */
  numerator?: VariableReference;
  /** Denominator variable (V1) */
  denominator: VariableReference;
}

export interface SingleVariableData {
  /** Single variable reference (DIFFRENI, DIFFREND, INTEGRAL) */
  variable: VariableReference;
}

export interface FunctionData {
  /** Input variable */
  variable: VariableReference;
  /** General table number */
  tableNumber: number;
}

export interface StdFunctionData {
  /** Function name: ABS, SQRT, EXP, LOG, SIN, COS, TAN, ATAN, MIN, MAX */
  functionName: 'ABS' | 'SQRT' | 'EXP' | 'LOG' | 'SIN' | 'COS' | 'TAN' | 'ATAN' | 'MIN' | 'MAX';
  /** Arguments (1 for most, 2-20 for MIN/MAX) */
  arguments: VariableReference[];
}

export interface DelayData {
  variable: VariableReference;
  delayTime: number;
  holdPositions: number;
}

export interface DigitalData {
  variable: VariableReference;
  samplingTime: number;
  delayTime: number;
}

export interface TripUnitData {
  /** Trip number (negative = complement) */
  tripNumber: number;
}

export interface TripDelayData {
  tripNumber: number;
}

export interface PowerIData {
  variable: VariableReference;
  integerPower: number;
}

export interface PowerRData {
  variable: VariableReference;
  realPower: number;
}

export interface PowerXData {
  base: VariableReference;
  exponent: VariableReference;
}

export interface PropIntData {
  proportionalGain: number;  // A1
  integralGain: number;      // A2
  variable: VariableReference;
}

export interface LagData {
  lagTime: number;  // A1 (s)
  variable: VariableReference;
}

export interface LeadLagData {
  leadTime: number;  // A1 (s)
  lagTime: number;   // A2 (s)
  variable: VariableReference;
}

// Discriminated union: CONSTANT와 그 외 타입 분리
type NonConstantControlVariable = ControlVariableBase & (
  | { componentType: 'SUM'; data: SumData }
  | { componentType: 'MULT'; data: MultData }
  | { componentType: 'DIV'; data: DivData }
  | { componentType: 'DIFFRENI'; data: SingleVariableData }
  | { componentType: 'DIFFREND'; data: SingleVariableData }
  | { componentType: 'INTEGRAL'; data: SingleVariableData }
  | { componentType: 'FUNCTION'; data: FunctionData }
  | { componentType: 'STDFNCTN'; data: StdFunctionData }
  | { componentType: 'DELAY'; data: DelayData }
  | { componentType: 'DIGITAL'; data: DigitalData }
  | { componentType: 'TRIPUNIT'; data: TripUnitData }
  | { componentType: 'TRIPDLAY'; data: TripDelayData }
  | { componentType: 'POWERI'; data: PowerIData }
  | { componentType: 'POWERR'; data: PowerRData }
  | { componentType: 'POWERX'; data: PowerXData }
  | { componentType: 'PROP-INT'; data: PropIntData }
  | { componentType: 'LAG'; data: LagData }
  | { componentType: 'LEAD-LAG'; data: LeadLagData }
  | { componentType: 'SHAFT'; data: Record<string, unknown> }
  | { componentType: 'PUMPCTL'; data: Record<string, unknown> }
  | { componentType: 'STEAMCTL'; data: Record<string, unknown> }
  | { componentType: 'FEEDCTL'; data: Record<string, unknown> }
);

// 최종 타입: CONSTANT | 그 외
export type ControlVariable = ConstantControlVariable | NonConstantControlVariable;
```

#### Task 2: UI 컴포넌트 (`ControlVariablesTab.tsx`) ✅

- [x] `ControlVariablesTab` 컴포넌트 신규 생성
- [x] Control Variable 목록 테이블 (번호, 이름, 타입, 수식 미리보기)
- [x] 생성/편집/복사/삭제 다이얼로그
- [x] 타입 선택 시 동적 데이터 입력 폼 전환 (P0: CONSTANT, SUM, TRIPUNIT)
- [ ] 변수 참조 Autocomplete (볼륨/정션/열구조물/제어변수 목록) → **P1으로 연기**

**UI 구조**:
```
┌─ ControlVariablesTab ──────────────────────────────────┐
│                                                        │
│  [+ Add] [Import from .i]                              │
│                                                        │
│  ┌─ Table ──────────────────────────────────────────┐  │
│  │ # │ Name     │ Type      │ Formula Preview      │  │
│  │───┼──────────┼───────────┼──────────────────────│  │
│  │101│ sdsv     │ TRIPUNIT  │ Y = 1.0 * U(T724)   │  │
│  │201│ c2r_avg  │ SUM       │ Y = 1.0*(0+1.0*q...)│  │
│  │511│ pzr-al   │ FUNCTION  │ Y = 1.0*TBL501(cv510)│ │
│  │...│          │           │                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Edit Dialog ────────────────────────────────────┐  │
│  │ Number: [___] Name: [________]                   │  │
│  │ Type: [SUM        ▼]                             │  │
│  │ Scaling: [1.0] Initial: [0.0] Flag: [1 ▼]      │  │
│  │ Limiter: [0-None ▼] Min: [___] Max: [___]       │  │
│  │                                                  │  │
│  │ ┌─ Data Card (SUM) ───────────────────────────┐  │  │
│  │ │ A0: [0.0]                                   │  │  │
│  │ │ ┌─────┬──────────┬────────────────┐         │  │  │
│  │ │ │  Aj │ Variable │ Parameter      │         │  │  │
│  │ │ │ 1.0 │ q        │ 120020000      │  [x]   │  │  │
│  │ │ │ 1.0 │ q        │ 120030000      │  [x]   │  │  │
│  │ │ │ ... │          │                │         │  │  │
│  │ │ └─────┴──────────┴────────────────┘         │  │  │
│  │ │ [+ Add Term]                                │  │  │
│  │ └─────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │ [Cancel] [Save]                                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### Task 3: GlobalSettingsDialog 탭 추가 ✅

- [x] `GlobalSettingsDialog.tsx`에 "Control Variables" 탭 추가 (6번째 탭)
- [x] `ControlVariablesTab` import 및 연결
- [x] Tab 순서: Project Setup → System Config → Simulation → Minor Edits → Variable Trips → **Control Variables** → Thermal Properties
- [x] `mergeWithDefaults`에 `controlVariables` 병합 추가
- [x] `handleControlVariablesChange` 핸들러 추가
- [x] `validateControlVariables` 저장 시 검증 연동

#### Task 4: 파일 생성 (`fileGenerator.ts`) ✅

- [x] `generateControlVariableCards()` private 메서드 구현
- [x] 타입별 데이터 카드 포맷팅 로직 (CONSTANT, SUM, TRIPUNIT)
- [x] 카드 번호 계산: `205` + `CCC`(3자리) + `NN`(2자리)
- [x] Variable Trips 다음, Interactive Inputs 이전에 출력
- [x] SUM 후속 카드 W1 공백 처리 (매뉴얼 포맷 준수)

**파일 생성 예시**:
```
* Control Variables
20510100    sdsv        tripunit    1.0       0.0       1
20510101    724
*
20530100    c2r_avg     sum         1.0       0.0       1
20530101    0.0    1.0    q        120020000
20530102           1.0    q        120030000
...
```

#### Task 5: 유효성 검증 (`globalSettingsValidation.ts`) ✅

- [x] Control Variable 번호 범위 (1-999) 및 중복 검사
- [x] 필수 필드 검증 (타입별: CONSTANT 값, SUM terms, TRIPUNIT trip번호)
- [x] 참조 변수 존재 여부 검증 (cntrlvar → 해당 CV 존재? → Warning)
- [x] 이름 길이 제한 (8자 초과 Warning)
- [x] TRIPUNIT trip 번호 범위 (400-799) 및 Variable Trips 존재 확인
- [x] Min/Max 값 역전 검사, 스케일링 팩터 0 경고
- [ ] 순환 참조 감지 (A → B → A) → **미구현, P1으로 연기**

> **참고**: 검증 로직은 `componentValidation.ts`가 아닌 `globalSettingsValidation.ts`에 구현됨 (기존 패턴 준수)

**검증 규칙 상세**:

| 검증 항목 | 규칙 | 에러 레벨 |
|----------|------|----------|
| CV 번호 범위 | 1-999 | Error |
| CV 번호 중복 | 동일 번호 불가 | Error |
| 이름 길이 | 최대 8자 | Error |
| 이름 문자 | 영숫자, `-`, `_` 만 허용 | Warning |
| TRIPUNIT Trip 참조 | Variable Trips에 존재해야 함 | Warning |
| FUNCTION 테이블 참조 | 번호만 검증 (1-999) | Info |
| cntrlvar 참조 | 해당 CV 존재해야 함 | Warning |
| cntrlvar 순환참조 | A→B→A 불가 (DFS로 검출) | Error |
| SUM 항목 수 | 최소 1개, 최대 20개 | Error |
| MULT 항목 수 | 최소 2개 | Error |
| MIN/MAX 인자 수 | 최소 2개, 최대 20개 | Error |

> **Phase 1 구현 범위**: Error 레벨만 필수 구현, Warning/Info는 Phase 2로 연기 가능.

### Phase 2: 고급 기능 (향후)

- [ ] SHAFT 타입 전체 지원 (GENERATR 포함)
- [ ] PUMPCTL/STEAMCTL/FEEDCTL 전체 지원
- [ ] Control Variable 의존성 그래프 시각화
- [ ] .i 파일 임포트 (기존 Control Variable 파싱)
- [ ] 수식 미리보기 / LaTeX 렌더링
- [ ] 드래그앤드롭 순서 변경

---

## Technical Notes

### 타입별 데이터 카드 생성 규칙

#### SUM 타입

매뉴얼 p271, Section 14.3.1:
> "At least four words that define a constant and one product term must be entered.
> **Additional sets of three words corresponding to Words 2-4** can be entered for additional
> product terms up to twenty product terms."

```
205CCC01  A0    A1  varName1  varCode1   ← 첫 카드: 4 words (W1=A0, W2=A1, W3=varName, W4=varCode)
205CCC02        A2  varName2  varCode2   ← 후속 카드: 3 words (W2=Aj, W3=varName, W4=varCode)
205CCC03        A3  varName3  varCode3
...
```

- **첫 카드 (205CCC01)**: W1=A0(상수), W2=A1, W3=varName1, W4=varCode1 → **4 words**
- **후속 카드 (205CCC02~)**: W2=Aj, W3=varNameJ, W4=varCodeJ → **3 words** (W1 위치 공백)
- 카드당 1개 항목 권장 (SMART 패턴)
- 최대 20개 항목, 카드 번호는 연속일 필요 없음

**SMART 예시 (c2r_avg, CV#301)**:
```
20530101   0.0    1.0    q        120020000   ← A0=0.0, A1=1.0, q 120020000
20530102          1.0    q        120030000   ← W1공백, A2=1.0, q 120030000
20530103          1.0    q        120040000
...
20530110          1.0    q        120110000   ← 10개 항목
```

**파일 생성 시 공백 처리 (fileGenerator 구현 참고)**:

```typescript
// 첫 카드: A0, A1, varName, varCode
const firstCard = `${cardNum}   ${A0}    ${A1}    ${varName}        ${varCode}`;

// 후속 카드: W1 위치 공백 (~10칸) + Aj, varName, varCode
const subsequentCard = `${cardNum}          ${Aj}    ${varName}        ${varCode}`;
//                              ^^^^^^^^^^  W1 자리 = 공백 (SMART 패턴: 약 10칸)
```

> MARS 파서는 공백으로 필드를 구분하므로, W1 위치에 충분한 공백을 넣으면 됨.
> SMART 파일 기준: 카드번호 후 약 10칸 공백 → W2 시작.

#### MULT 타입
```
205CCC01  varName1  varCode1  varName2  varCode2
```
- 쌍(varName, varCode)으로 입력, 최소 2쌍

#### CONSTANT 타입
- 데이터 카드 없음 (205CCC00의 W3가 상수 값)
- W4(initialValue), W5(initialValueFlag) 생략
- **파일 생성 시**: `205CCC00  name  constant  value` (4필드만 출력)

#### TRIPUNIT 타입
```
205CCC01  tripNumber
```
- 음수 = 보수(complement) 사용

### 카드 출력 순서

MARS 파서는 카드 순서에 제약이 없으나, 가독성을 위해 아래 순서 권장:

```
1. Misc Control Cards (001, 100-115)
2. System Config (120-129)
3. Time Step Control (201-299)
4. Minor Edits (301-399)
5. Variable Trips (401-599)
6. General Tables (202TTTNN)        ← 향후 구현
7. Control Variables (205CCCNN)     ← ★ 여기
8. Interactive Inputs (801-999)
9. Hydrodynamic Components (CCCXXXX)
10. Heat Structures (1CCCXXXX)
11. Reactor Kinetics (30000XXX)
```

> SMART 파일에서는 Control Variables가 Hydrodynamic Components 뒤에 위치하지만,
> 논리적으로는 Trip → General Table → Control Variable 순서가 의존성을 명확히 함.

### 기존 코드 참조

| 참조 구현 | 파일 | 설명 |
|-----------|------|------|
| **VariableTripsTab** | [VariableTripsTab.tsx](../../src/components/globalSettings/VariableTripsTab.tsx) | 가장 유사한 패턴 |
| **ThermalPropertiesTab** | [ThermalPropertiesTab.tsx](../../src/components/globalSettings/ThermalPropertiesTab.tsx) | 복잡한 데이터 구조 패턴 |
| **GlobalSettings** | [mars.ts:1108-1121](../../src/types/mars.ts#L1108-L1121) | GlobalSettings 인터페이스 |
| **fileGenerator** | [fileGenerator.ts:91-115](../../src/utils/fileGenerator.ts#L91-L115) | Variable Trips 카드 생성 패턴 |

### 타입별 구현 우선순위

| 우선순위 | 타입 | 이유 |
|----------|------|------|
| **P0** | CONSTANT | 가장 단순, 데이터 카드 없음 |
| **P0** | SUM | 가장 많이 사용 (30개), 핵심 기능 |
| **P0** | TRIPUNIT | Trip 연동, 밸브 제어 필수 |
| **P1** | FUNCTION | 테이블 참조, 가압기 수위 등 |
| **P1** | MULT | 곱셈 연산 |
| **P1** | PROP-INT | PI 제어기 |
| **P1** | INTEGRAL | 적분 |
| **P2** | STDFNCTN | 표준 수학 함수 |
| **P2** | TRIPDLAY | Trip 지연 |
| **P2** | DIV, DIFFREND | 나눗셈, 미분 |
| **P2** | LAG, LEAD-LAG | 전달함수 |
| **P2** | DELAY, DIGITAL | 지연/샘플링 |
| **P2** | POWERI, POWERR, POWERX | 거듭제곱 |
| **P3** | SHAFT, PUMPCTL, STEAMCTL, FEEDCTL | 복합 제어 |

---

## Dependencies

- **Requires**: Variable Trips ✅ (TRIPUNIT/TRIPDLAY에서 Trip 참조)
- **Requires**: General Tables (Cards 202TTTNN) ⚠️ **미구현**
  - FUNCTION 타입에서 테이블 번호로 참조 (SMART 사용: 501, 502, 503, 504, 505, 261, 551 등)
  - **임시 방안**: 테이블 번호 직접 입력, 존재 여부 검증은 Phase 2로 연기
- **Blocks**: VALVE 서보밸브 제어 (SRVVLV → controlVariable 참조)
- **Blocks**: Interactive Input (Cards 801-999) - `cntrlvar` 타입으로 CV 참조하여 실시간 모니터링
- **Blocks**: 시뮬레이션 결과 변수 모니터링 (SIM-001)

---

## 수정 대상 파일 요약

| 파일 | 변경 유형 | 상태 | 설명 |
|------|----------|------|------|
| `src/types/mars.ts` | **수정** | ✅ | ControlVariable 타입 + GlobalSettings 필드 추가 |
| `src/components/globalSettings/ControlVariablesTab.tsx` | **신규** | ✅ | 탭 UI 컴포넌트 (P0: CONSTANT, SUM, TRIPUNIT) |
| `src/components/GlobalSettingsDialog.tsx` | **수정** | ✅ | 6번째 탭 추가 + 검증 연동 |
| `src/utils/fileGenerator.ts` | **수정** | ✅ | 205CCCNN 카드 생성 (generateControlVariableCards) |
| `src/utils/globalSettingsValidation.ts` | **수정** | ✅ | validateControlVariables 함수 추가 |

---

## Decisions

| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2026-02-03 | GlobalSettings 탭으로 구현 | Control Variable는 노드가 아닌 전역 설정 | 별도 페이지, 사이드 패널 |
| 2026-02-03 | 205CCCNN (3자리) 기본 | SMART 기준, 999개 충분 | 205CCCCN (4자리, 9999개) |
| 2026-02-03 | Discriminated Union 패턴 | 타입별 데이터 구조 안전하게 분리 | 단일 범용 인터페이스 |
| 2026-02-03 | P0 우선순위: SUM, CONSTANT, TRIPUNIT | SMART에서 가장 많이 사용 | 전체 동시 구현 |

---

## Current State

**Phase 1 P0+P1+P2 파일 생성 완료** (18개 타입 전체)

### 완료된 작업
- [x] P0 타입: CONSTANT, SUM, TRIPUNIT (2026-02-05)
- [x] P1 타입: FUNCTION, MULT, PROP-INT, INTEGRAL, STDFNCTN, TRIPDLAY (2026-02-20)
- [x] P2 타입: DIV, DIFFRENI, DIFFREND, DELAY, DIGITAL, POWERI, POWERR, POWERX, LAG, LEAD-LAG (2026-02-20)

### 남은 작업
- [ ] 변수 참조 Autocomplete UI
- [ ] 순환 참조 감지 (DFS)
- [ ] P1+ 타입 UI 폼 (현재 SUM/CONSTANT/TRIPUNIT만 동적 폼 지원)

---

## Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-20 | **P1+P2 파일 생성 완료** | 18개 타입 전체 205CCCNN 데이터 카드 생성 지원 (fileGenerator.ts) |
| 2026-02-05 | **Phase 1 P0 구현 완료** | Task 1-5 완료 (CONSTANT/SUM/TRIPUNIT), 빌드 성공 확인 |
| 2026-02-05 | 2차 검토 반영 | HS q 형식 명확화, TypeScript 타입 분리, SUM 공백 처리, 검증 규칙 상세화 |
| 2026-02-04 | 검토 결과 반영 | VRC 형식 수정, CONSTANT 규칙, SUM 상세화, 의존성 보완 |
| 2026-02-03 | 초기 작성 | 매뉴얼 p269-282, SMART 파일 분석 기반 |
