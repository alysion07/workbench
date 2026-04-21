---
title: "FEAT: Logic Trips (Card 601-799)"
status: planned
phase: 4
last_updated: 2026-04-03
---

# FEAT: Logic Trips (Card 601-799)
> Parent: [ROADMAP](../ROADMAP.md) | Status: 🚧

## Overview

MARS 시뮬레이터의 Logic Trip 기능 구현. Variable Trip(401-599)들을 AND/OR 조합으로 결합하여 복합 트립 조건을 정의한다.

## Manual Reference
- **PDF**: Mars Input Manual (2010.02.).pdf
- **Pages**: 64-65 (Section 5.4: Logical Trips)
- **Cards**: 601-799

### Card Specification (매뉴얼 p.64-65)

```
Format: CardNumber  W1(Trip1)  W2(Operator)  W3(Trip2)  W4(Latch)  W5(Timeof)  W6(Comment)

W1(I) - Trip number (참조할 트립 번호, 401-799)
W2(A) - Operator: AND, OR (XOR 미지원 - SMART.i 범위)
W3(I) - Trip number (참조할 트립 번호, 401-799)
W4(A) - Latch: L (한번 true이면 유지) / N (매번 재평가)
W5(R) - TIMEOF 초기값 (옵션, -1.0 = false 초기화)
W6(A) - Comment (옵션, 24자 이내)

논리식: CONDITION(W1) OPERATOR(W2) CONDITION(W3)
```

### SMART.i 사용 범위 (11개 Logic Trip)

| Card | W1 | W2 | W3 | W4 | W5 | Comment | 용도 |
|------|-----|-----|-----|-----|------|---------|------|
| 622 | 522 | and | 623 | n | -1.0 | - | CV-110Y Letdown |
| 623 | 523 | or | 622 | n | -1.0 | "letdown valve CV-110Y On" | CV-110Y On |
| 624 | 524 | and | 625 | n | -1.0 | - | CV-110Z Letdown |
| 625 | 525 | or | 624 | n | -1.0 | "letdown valve CV-110Z On" | CV-110Z On |
| 630 | 530 | and | 531 | n | -1.0 | - | Proportional Heater |
| 723 | 423 | and | 724 | n | -1.0 | - | PZR SDSV Logic |
| 724 | 424 | or | 723 | n | -1.0 | "PZR SDSV TRIP" | PZR SDSV Trip |
| 730 | 430 | or | 431 | l | -1.0 | - | PRHRS Logic |
| 731 | 730 | or | 432 | l | -1.0 | "PRHRS Operation" | PRHRS Operation |
| 734 | 434 | and | 735 | n | -1.0 | - | PZR PSV Logic |
| 735 | 435 | or | 734 | n | -1.0 | "PZR PSV TRIP" | PZR PSV Trip |

## Scope (SMART.i 범위 한정)

| 항목 | 포함 | 제외 |
|------|------|------|
| AND/OR 연산자 | O | XOR |
| Latch (L/N) | O | - |
| TIMEOF 초기값 | O | - |
| Comment (24자) | O | - |
| Card 601-799 | O | Card 600 (Trip Stop) |
| 음수 트립 번호 (NOT) | X | - |

---

## Implementation Plan

### Task 1: 타입 정의 (mars.ts)

**파일**: [src/types/mars.ts](../../src/types/mars.ts)

#### 1-1. LogicTrip 인터페이스 추가 (Line 1487 이후)

```typescript
// ============================================================================
// Logic Trips (Card 601-799)
// ============================================================================

/**
 * Logic Trip Operator
 * Based on SMART.i usage: AND, OR only (XOR excluded)
 */
export type LogicTripOperator = 'and' | 'or';

/**
 * Logic Trip (Card 601-799)
 * Combines two trips with a logical operator (AND/OR)
 *
 * Format: CardNumber  Trip1  Operator  Trip2  Latch  Timeof  [Comment]
 *
 * Example from SMART.i:
 * 723   423        and           724                n  -1.0 * PZR SDSV
 * 724   424        or            723                n  -1.0 "PZR SDSV TRIP"
 * 730   430        or            431                l  -1.0
 */
export interface LogicTrip {
  cardNumber: number;           // 601-799
  trip1: number;                // First trip number (401-799)
  operator: LogicTripOperator;  // AND or OR
  trip2: number;                // Second trip number (401-799)
  latch: 'l' | 'n';            // l = latch, n = no latch
  timeof: number;               // TIMEOF initial value (-1.0 = false init)
  comment?: string;             // Optional comment (max 24 chars)
}
```

#### 1-2. GlobalSettings 필드 추가 (Line 1118 영역)

```typescript
export interface GlobalSettings {
  // ... 기존 필드들 ...
  variableTrips?: VariableTrip[];   // Card 401-599
  logicTrips?: LogicTrip[];         // Card 601-799  ← NEW
  controlVariables?: ControlVariable[];
  // ...
}
```

---

### Task 2: UI 컴포넌트 (LogicTripsTab.tsx)

**새 파일**: `src/components/globalSettings/LogicTripsTab.tsx`

#### 2-1. 컴포넌트 인터페이스

```typescript
interface LogicTripsTabProps {
  logicTrips: LogicTrip[];
  variableTrips: VariableTrip[];  // timeof 및 참조 검증용
  onChange: (logicTrips: LogicTrip[]) => void;
}
```

#### 2-2. UI 구성 (VariableTripsTab 패턴 동일)

```
┌─────────────────────────────────────────────────────────┐
│ Logic Trips (Cards 601-799)              [Add Logic Trip]│
├──────┬────────────────────────┬────┬────┬────┬──────────┤
│ Card │ Condition              │Ltch│Time│Note│ Actions  │
├──────┼────────────────────────┼────┼────┼────┼──────────┤
│ 723  │ Trip 423  AND  Trip 724│ N  │-1.0│ *  │ [E] [D]  │
│ 724  │ Trip 424  OR   Trip 723│ N  │-1.0│ "  │ [E] [D]  │
│ 730  │ Trip 430  OR   Trip 431│ L  │-1.0│    │ [E] [D]  │
└──────┴────────────────────────┴────┴────┴────┴──────────┘
```

#### 2-3. 편집 다이얼로그 구성

```
┌── Add/Edit Logic Trip ──────────────────────────────────┐
│                                                          │
│ Card Number: [622___] (601-799)                          │
│                                                          │
│ ┌──────────────────┐  ┌──────────┐  ┌──────────────────┐│
│ │ Trip 1           │  │ Operator │  │ Trip 2           ││
│ │ [Autocomplete v] │  │ [AND  v] │  │ [Autocomplete v] ││
│ │ 522 (cntrlvar>58)│  │  AND     │  │ 623 (Logic Trip) ││
│ └──────────────────┘  │  OR      │  └──────────────────┘│
│                       └──────────┘                       │
│ ┌────────────┐  ┌────────────┐                           │
│ │ Latch      │  │ Timeof     │                           │
│ │ [N      v] │  │ [-1.0____] │                           │
│ └────────────┘  └────────────┘                           │
│                                                          │
│ Comment: [PZR SDSV TRIP______________] (max 24 chars)    │
│                                                          │
│                            [Cancel] [Save]               │
└──────────────────────────────────────────────────────────┘
```

#### 2-4. Trip Autocomplete 옵션 생성 로직

```typescript
// 사용 가능한 트립 번호 목록 (Variable + Logic)
const availableTripOptions = useMemo(() => {
  const options: Array<{ tripNumber: number; label: string; type: 'variable' | 'logic' }> = [];

  // Variable Trips (401-599)
  variableTrips.forEach(vt => {
    const condition = `${vt.leftVar}(${vt.leftParam}) ${vt.relation} ${vt.rightVar === 'null' ? vt.actionValue : vt.rightVar + '(' + vt.rightParam + ')'}`;
    options.push({
      tripNumber: vt.cardNumber,
      label: `${vt.cardNumber} - ${condition}${vt.comment ? ' "' + vt.comment + '"' : ''}`,
      type: 'variable'
    });
  });

  // Logic Trips (601-799) - 자기 자신 제외
  logicTrips.forEach(lt => {
    if (lt.cardNumber !== dialog.trip.cardNumber) {
      options.push({
        tripNumber: lt.cardNumber,
        label: `${lt.cardNumber} - Trip ${lt.trip1} ${lt.operator.toUpperCase()} Trip ${lt.trip2}${lt.comment ? ' "' + lt.comment + '"' : ''}`,
        type: 'logic'
      });
    }
  });

  return options.sort((a, b) => a.tripNumber - b.tripNumber);
}, [variableTrips, logicTrips, dialog.trip.cardNumber]);
```

#### 2-5. Autocomplete 그룹 표시

```typescript
// Trip 번호 선택 시 그룹별 표시
<Autocomplete
  options={availableTripOptions}
  groupBy={(option) => option.type === 'variable' ? 'Variable Trips (401-599)' : 'Logic Trips (601-799)'}
  getOptionLabel={(option) => option.label}
  renderInput={(params) => (
    <TextField {...params} label="Trip 1" placeholder="Select trip number" />
  )}
/>
```

---

### Task 3: 파일 생성 (fileGenerator.ts)

**파일**: [src/utils/fileGenerator.ts](../../src/utils/fileGenerator.ts)

#### 3-1. Logic Trips 섹션 추가 (Line 115 이후, Variable Trips 뒤)

```typescript
// Logic Trips (Cards 601-799)
cards.push('*' + '='.repeat(79));
cards.push('* LOGICAL TRIPS');
cards.push('*' + '='.repeat(79));
cards.push('*');
if (settings?.logicTrips && settings.logicTrips.length > 0) {
  const sortedLogicTrips = [...settings.logicTrips].sort((a, b) => a.cardNumber - b.cardNumber);
  sortedLogicTrips.forEach(trip => {
    // Format: CardNumber  Trip1  Operator  Trip2  Latch  Timeof  [Comment]
    // Example: 723   423        and           724                n  -1.0 * PZR SDSV
    const cardNum = trip.cardNumber.toString();
    const trip1Str = trip.trip1.toString().padEnd(10);
    const operatorStr = trip.operator.padEnd(14);
    const trip2Str = trip.trip2.toString().padEnd(18);
    const latchStr = trip.latch.padEnd(3);
    const timeofStr = this.formatNumber(trip.timeof).trim();
    const commentStr = trip.comment
      ? (trip.comment.startsWith('"') ? `  ${trip.comment}` : `  "${trip.comment}"`)
      : '';
    cards.push(`${cardNum}   ${trip1Str}${operatorStr}${trip2Str}${latchStr}${timeofStr}${commentStr}`);
  });
}
cards.push('*');
```

#### 3-2. 출력 순서

```
Variable Trips (401-599)   ← 기존
Logical Trips (601-799)    ← NEW (바로 뒤)
Control Variables (205CCC) ← 기존
Interactive Inputs (801-999) ← 기존
```

---

### Task 4: 검증 로직 (globalSettingsValidation.ts)

**파일**: [src/utils/globalSettingsValidation.ts](../../src/utils/globalSettingsValidation.ts)

#### 4-1. validateLogicTrips 함수 (신규)

```typescript
export function validateLogicTrips(
  logicTrips: LogicTrip[],
  variableTripNumbers?: number[],
  logicTripNumbers?: number[]
): GlobalValidationResult {
  const errors: GlobalValidationError[] = [];
  const warnings: GlobalValidationError[] = [];
  const usedCardNumbers = new Set<number>();

  // 전체 사용 가능한 트립 번호 (Variable + Logic)
  const allTripNumbers = new Set<number>([
    ...(variableTripNumbers || []),
    ...(logicTripNumbers || [])
  ]);

  logicTrips.forEach(trip => {
    const cardNum = trip.cardNumber;

    // 1. 카드 번호 범위 (601-799)
    if (cardNum < 601 || cardNum > 799) {
      errors.push({
        card: `${cardNum}`, field: 'cardNumber',
        message: 'Logic trip card number must be between 601 and 799'
      });
    }

    // 2. 중복 체크
    if (usedCardNumbers.has(cardNum)) {
      errors.push({
        card: `${cardNum}`, field: 'cardNumber',
        message: `Duplicate logic trip card number: ${cardNum}`
      });
    }
    usedCardNumbers.add(cardNum);

    // 3. Trip1 참조 검증
    if (!allTripNumbers.has(trip.trip1)) {
      warnings.push({
        card: `${cardNum}`, field: 'trip1',
        message: `Trip ${trip.trip1} referenced in trip1 does not exist`
      });
    }

    // 4. Trip2 참조 검증
    if (!allTripNumbers.has(trip.trip2)) {
      warnings.push({
        card: `${cardNum}`, field: 'trip2',
        message: `Trip ${trip.trip2} referenced in trip2 does not exist`
      });
    }

    // 5. 연산자 검증
    if (trip.operator !== 'and' && trip.operator !== 'or') {
      errors.push({
        card: `${cardNum}`, field: 'operator',
        message: 'Operator must be "and" or "or"'
      });
    }

    // 6. Comment 길이 검증
    if (trip.comment && trip.comment.length > 24) {
      warnings.push({
        card: `${cardNum}`, field: 'comment',
        message: 'Comment exceeds 24 characters'
      });
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
```

#### 4-2. getDefaultGlobalSettings 수정 (Line 647)

```typescript
export function getDefaultGlobalSettings(): GlobalSettings {
  return {
    // ... 기존 ...
    variableTrips: [],
    logicTrips: [],     // ← NEW
    controlVariables: [],
    interactiveInputs: []
  };
}
```

---

### Task 5: GlobalSettingsDialog 수정

**파일**: [src/components/GlobalSettingsDialog.tsx](../../src/components/GlobalSettingsDialog.tsx)

#### 5-1. 탭 추가 (Line 402-410)

```
기존 탭 순서:
1. Project Setup
2. System Config
3. Simulation Control
4. Minor Edits
5. Variable Trips
6. Control Variables      ← index 5
7. Thermal Properties     ← index 6

변경 후:
1. Project Setup
2. System Config
3. Simulation Control
4. Minor Edits
5. Variable Trips
6. Logic Trips            ← NEW (index 5)
7. Control Variables      ← index 6 (기존 5)
8. Thermal Properties     ← index 7 (기존 6)
```

#### 5-2. 핸들러 추가

```typescript
const handleLogicTripsChange = (logicTrips: LogicTrip[]) => {
  setLocalSettings({ ...localSettings, logicTrips });
};
```

#### 5-3. 검증 호출 추가 (handleSave 내, Line 329 이후)

```typescript
// Validate logic trips
if (localSettings.logicTrips && localSettings.logicTrips.length > 0) {
  const variableTripNumbers = localSettings.variableTrips?.map(t => t.cardNumber) || [];
  const logicTripNumbers = localSettings.logicTrips.map(t => t.cardNumber);
  const logicTripsValidation = validateLogicTrips(
    localSettings.logicTrips, variableTripNumbers, logicTripNumbers
  );

  if (!logicTripsValidation.valid) {
    // ... 에러 처리 ...
  }
}
```

#### 5-4. 기존 검증에서 tripNumbers 범위 확대

```typescript
// Variable Trips 검증 시 Logic Trip 번호도 포함
const tripNumbers = [
  ...(localSettings.variableTrips?.map(t => t.cardNumber) || []),
  ...(localSettings.logicTrips?.map(t => t.cardNumber) || [])
];
```

#### 5-5. mergeWithDefaults 수정

```typescript
logicTrips: settings.logicTrips ?? defaults.logicTrips,
```

#### 5-6. TabPanel 추가

```typescript
<TabPanel value={activeTab} index={5}>
  <LogicTripsTab
    logicTrips={localSettings.logicTrips || []}
    variableTrips={localSettings.variableTrips || []}
    onChange={handleLogicTripsChange}
  />
</TabPanel>
```

---

### Task 6: 기존 코드 수정 (Trip 범위 확대)

#### 6-1. componentValidation.ts (Line 136-140)

```typescript
// Before: 401-599
if (params.tripNumber < 401 || params.tripNumber > 599) {
  validationErrors.push({ level: 'error', message: 'Trip Number must be between 401-599' });
}

// After: 401-799
if (params.tripNumber < 401 || params.tripNumber > 799) {
  validationErrors.push({ level: 'error', message: 'Trip Number must be between 401-799' });
}
```

#### 6-2. ValveForm.tsx - Zod schema

```typescript
// Before
tripNumber: z.number().int().min(401).max(599).optional()

// After
tripNumber: z.number().int().min(401).max(799).optional()
```

#### 6-3. VariableTripsTab.tsx - availableTripNumbers (Line 188-190)

```typescript
// Before: Variable Trips만
const availableTripNumbers = useMemo(() => {
  return variableTrips.map(t => t.cardNumber).sort((a, b) => a - b);
}, [variableTrips]);

// After: 변경 필요 없음 - VariableTripsTab은 자체 props만 사용
// Logic Trips 번호는 GlobalSettingsDialog에서 props로 전달
```

> **참고**: VariableTripsTab에서 timeof 참조 시 Logic Trip도 참조 가능하도록 하려면 props에 `logicTrips` 추가 필요. 단, SMART.i에서 Variable Trip의 timeof는 Variable/Logic Trip 모두 참조 가능 (예: `506 time 0 gt timeof 731`에서 731은 Logic Trip).

#### 6-4. VariableTripsTab - timeof에 Logic Trip 참조 지원

```typescript
// Props 확장
interface VariableTripsTabProps {
  variableTrips: VariableTrip[];
  logicTripNumbers?: number[];  // ← NEW: Logic Trip 번호 목록
  onChange: (variableTrips: VariableTrip[]) => void;
}

// availableTripNumbers 수정
const availableTripNumbers = useMemo(() => {
  const varNums = variableTrips.map(t => t.cardNumber);
  const logicNums = logicTripNumbers || [];
  return [...varNums, ...logicNums].sort((a, b) => a - b);
}, [variableTrips, logicTripNumbers]);
```

---

## Data Flow Diagram

```
GlobalSettingsDialog
├── localSettings.variableTrips (401-599)
├── localSettings.logicTrips (601-799)       ← NEW
│
├── VariableTripsTab
│   ├── props: variableTrips, logicTripNumbers ← Logic Trip 번호 전달
│   └── timeof 참조: 401-799 전체 범위
│
├── LogicTripsTab                             ← NEW
│   ├── props: logicTrips, variableTrips
│   └── trip1/trip2 Autocomplete: 401-799 전체 범위
│
├── ControlVariablesTab
│   └── TRIPUNIT tripNumber: 401-799 (기존 이미 지원)
│
└── handleSave()
    ├── validateVariableTrips(variableTrips, ..., allTripNumbers)
    ├── validateLogicTrips(logicTrips, variableTripNumbers, logicTripNumbers)  ← NEW
    └── validateControlVariables(controlVariables, allTripNumbers)
```

## File Generation Output Example

```
*===============================================================================
* VARIABLE TRIPS
*===============================================================================
*
401  time      0           gt    null      0           1.00e+6     l  -1.0   "SIS-SBLOCA"
423  p         280040000   ge    null      0           2.00e+7     n  -1.0   "PZR SDSV Relief"
424  p         280040000   ge    null      0           2.03e+7     n  -1.0   "PZR SDSV Safety"
*
*===============================================================================
* LOGICAL TRIPS
*===============================================================================
*
723   423        and           724                n  -1.0  * PZR SDSV
724   424        or            723                n  -1.0  "PZR SDSV TRIP"
730   430        or            431                l  -1.0
731   730        or            432                l  -1.0  "PRHRS Operation"
*
```

---

## Implementation Checklist

- [ ] **Task 1**: mars.ts - LogicTrip 인터페이스 + GlobalSettings 필드 추가
- [ ] **Task 2**: LogicTripsTab.tsx 생성 (VariableTripsTab 패턴)
- [ ] **Task 3**: fileGenerator.ts - Logic Trips 생성 섹션 추가
- [ ] **Task 4**: globalSettingsValidation.ts - validateLogicTrips + getDefaultGlobalSettings
- [ ] **Task 5**: GlobalSettingsDialog.tsx - 탭/핸들러/검증 추가
- [ ] **Task 6**: 기존 코드 수정 (trip 범위 401-799 확대)
  - [ ] componentValidation.ts
  - [ ] ValveForm.tsx
  - [ ] VariableTripsTab.tsx (logicTripNumbers props)

## Dependencies
- **Requires**: Variable Trips (Card 401-599) ✅ 완료
- **Blocks**: 없음

## Decisions
| 날짜 | 결정 | 이유 | 대안 |
|------|------|------|------|
| 2026-02-10 | AND/OR만 지원, XOR 제외 | SMART.i 사용 범위 한정 | 매뉴얼 전체 지원 |
| 2026-02-10 | 음수 트립 번호(NOT) 미지원 | SMART.i 미사용 | 매뉴얼 전체 지원 |
| 2026-02-10 | Card 600 (Trip Stop) 제외 | SMART.i 미사용 | 함께 구현 |
| 2026-02-10 | 순환 참조 허용 | SMART.i 패턴 (622↔623 등) | 순환 참조 차단 |

## Changelog
| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-10 | 초기 설계 문서 작성 | SMART.i 분석 + 매뉴얼 참조 |
