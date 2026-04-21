---
title: "FEAT: SMART.i 누락 항목 보완"
status: planned
phase: 3
last_updated: 2026-04-03
---

# FEAT: SMART.i 누락 항목 보완

> **상태**: 📋 요구사항 정의 완료
> **브랜치**: (미정)
> **일자**: 2026-02-20

---

## 1. 배경

SMART.i 레퍼런스 파일(`documents/reference/SMART_SIM_BASE_REV01.i`) 분석 결과,
GUI에서 완전한 SMART.i 파일을 생성하기 위해 아래 항목들이 누락되어 있음을 확인.

## 2. 구현 범위

| # | 항목 | 우선순위 | 유형 |
|---|------|---------|------|
| A | General Tables (202TTT00) | 🔴 CRITICAL | 신규 시스템 |
| B | Point Reactor Kinetics (30000000) | 🔴 CRITICAL | 신규 시스템 |
| C | GlobalSettings UI 카테고리 그룹화 | 🟡 IMPORTANT | UI 리팩토링 |
| D | Valve `chkvlv` 서브타입 | 🟡 IMPORTANT | 기능 확장 |
| E | Card 001 / 104 / 105 | 🟢 MINOR | 선택 필드 추가 |

---

## 3. 상세 요구사항

### A. General Tables (202TTT00)

#### A.1 개요
- MARS General Table은 x-y lookup 테이블로, 다른 컴포넌트에서 참조됨
- SMART.i에서 8개 테이블 사용: GT100, GT226, GT501~505, GT551
- 주요 참조처: `function` 타입 Control Variable의 `w3` 필드, Kinetics `30000011`

#### A.2 카드 형식 (SMART.i 기준)
```
* 헤더 카드
202TTT00   {type}   [{trip}]   [{scale_x}]   [{scale_y}]

* 데이터 포인트 카드
202TTT01   {x1}   {y1}
202TTT02   {x2}   {y2}
...
202TTTNN   {xN}   {yN}
```

#### A.3 테이블 타입 (SMART.i에서 확인된 것)
| 타입 키워드 | 설명 | 헤더 추가 필드 |
|------------|------|--------------|
| `reac-t` | 범용 x-y lookup 테이블 | 없음 |
| `power` | 출력 기반 테이블 | trip번호, scale_x, scale_y |

#### A.4 타입 정의 (mars.ts에 추가)
```typescript
interface GeneralTable {
  tableNumber: number;       // TTT (3자리, 1~999)
  name: string;              // 사용자 설명 (주석용)
  type: 'reac-t' | 'power';  // 테이블 타입 키워드
  tripNumber?: number;       // 'power' 타입일 때 trip 참조
  scaleX?: number;           // X 스케일 인수
  scaleY?: number;           // Y 스케일 인수
  dataPoints: Array<{        // x-y 데이터 포인트
    x: number;
    y: number;
  }>;
}
```

#### A.5 스토어 (useStore.ts)
- `globalSettings.generalTables: GeneralTable[]` 추가
- CRUD 액션: `addGeneralTable`, `updateGeneralTable`, `removeGeneralTable`

#### A.6 UI 요구사항
- GlobalSettings 다이얼로그 내 "General Tables" 탭
- 테이블 목록 + 추가/삭제 버튼
- 테이블 편집: 번호, 이름, 타입, 데이터 포인트 그리드
- 데이터 포인트: 행 추가/삭제, x/y 값 입력
- `function` CV 편집 시 GT 번호 드롭다운에서 기존 테이블 선택 가능

#### A.7 파일 생성 (fileGenerator.ts)
- `generateGeneralTableCards(table: GeneralTable): string`
- 헤더 카드: `202TTT00 {type} [{trip}] [{scaleX}] [{scaleY}]`
- 데이터 카드: `202TTTNN {x} {y}` (NN = 01부터 순번)

---

### B. Point Reactor Kinetics (30000000)

#### B.1 개요
- 노심 점동특성(Point Kinetics) 모델 설정
- SMART.i에서 사용된 패턴: `point` + `separabl` 모드
- 지연중성자는 내장 데이터(`gamma-ac`) 사용, 개별 그룹 카드 없음

#### B.2 카드 형식 (SMART.i 기준)
```
* 기본 설정
30000000   {kinType}   {feedbackType}
*          point       separabl|nonseparabl

* 중성자 물리 파라미터
30000001   {decayType}   {power}   {reactivity}   {inverseLambda}   {fpyf}
*          gamma-ac      330.0e6   0.0            347.826087        1.2

* 붕괴열 방법
30000002   {ansStandard}   {additionalDecayHeat}
*          ans79-1         200.0

* 외부 반응도 테이블 참조 (General Table 번호)
30000011   {generalTableNumber}
*          100

* 감속재 밀도 반응도 테이블
3000050N   {density}   {reactivity_dollar}
*          0.0         0.0
*          1000.0      0.0

* 도플러 반응도 테이블
3000060N   {temperature}   {reactivity_dollar}
*          100.0           0.0
*          3000.0          0.0

* 밀도 가중치 인수 (Volume 참조)
3000070N   {volumeId}   {increment}   {factor}   {coefficient}
*          120010000    0             0.05324    0.0

* 도플러 가중치 인수 (Heat Structure 참조)
3000080N   {heatStructureId}   {increment}   {factor}   {coefficient}
*          1200001             0             0.05324    0.0
```

#### B.3 타입 정의 (mars.ts에 추가)
```typescript
interface PointReactorKinetics {
  enabled: boolean;                    // Kinetics 사용 여부

  // 30000000 - 기본 설정
  kineticsType: 'point';              // 현재 point만 지원
  feedbackType: 'separabl' | 'nonseparabl';

  // 30000001 - 중성자 물리 파라미터
  decayType: 'gamma-ac';             // 감마 에너지 + 액티나이드
  power: number;                      // 초기 출력 (W)
  reactivity: number;                 // 초기 반응도 ($)
  inverseLambda: number;              // 1/Λ (1/s), Λ=평균중성자수명
  fpyf: number;                       // fission product yield fraction

  // 30000002 - 붕괴열
  ansStandard: 'ans79-1';            // ANS 붕괴열 표준
  additionalDecayHeat: number;        // 추가 붕괴열 (W)

  // 30000011 - 외부 반응도 참조
  externalReactivityTableNumber?: number;  // General Table 번호 (스크램 등)

  // 3000050N - 감속재 밀도 반응도
  moderatorDensityReactivity: Array<{
    density: number;                  // 밀도 (kg/m³)
    reactivity: number;               // 반응도 ($)
  }>;

  // 3000060N - 도플러 반응도
  dopplerReactivity: Array<{
    temperature: number;              // 온도 (K)
    reactivity: number;               // 반응도 ($)
  }>;

  // 3000070N - 밀도 가중치 인수
  densityWeightingFactors: Array<{
    volumeId: string;                 // Volume 컴포넌트 ID (드롭다운 선택)
    increment: number;                // 증분 (0 = absolute)
    factor: number;                   // 가중치 인수
    coefficient: number;              // 계수
  }>;

  // 3000080N - 도플러 가중치 인수
  dopplerWeightingFactors: Array<{
    heatStructureId: string;          // Heat Structure ID (드롭다운 선택)
    increment: number;                // 증분
    factor: number;                   // 가중치 인수
    coefficient: number;              // 계수
  }>;
}
```

#### B.4 스토어 (useStore.ts)
- `globalSettings.reactorKinetics: PointReactorKinetics` 추가
- `enabled: false`가 기본값 (Kinetics 미사용 시 카드 미생성)
- `updateReactorKinetics(kinetics: Partial<PointReactorKinetics>)` 액션

#### B.5 UI 요구사항
- GlobalSettings 다이얼로그 내 "Reactor Kinetics" 탭
- **기본 설정 섹션**: kinetics 활성화 스위치, 피드백 타입 선택
- **중성자 물리 섹션**: 출력, 반응도, 1/Λ, fpyf 입력 필드
- **붕괴열 섹션**: ANS 표준 선택, 추가 붕괴열 입력
- **외부 반응도 섹션**: General Table 번호 드롭다운 (기존 GT 목록에서 선택)
- **감속재 밀도 반응도 섹션**: 데이터 포인트 그리드 (density, reactivity)
- **도플러 반응도 섹션**: 데이터 포인트 그리드 (temperature, reactivity)
- **밀도 가중치 인수 섹션**: Volume 드롭다운 + factor/coefficient 입력 그리드
- **도플러 가중치 인수 섹션**: HeatStructure 드롭다운 + factor/coefficient 입력 그리드

#### B.6 파일 생성 (fileGenerator.ts)
- `generateReactorKineticsCards(kinetics: PointReactorKinetics): string`
- `enabled: false`이면 빈 문자열 반환
- 카드 순서: 30000000 → 30000001 → 30000002 → 30000011 → 3000050N → 3000060N → 3000070N → 3000080N

---

### C. GlobalSettings UI 카테고리 그룹화

#### C.1 현재 상태
```
수평 탭: Project | System | Simulation | Minor | VarTrips | LogicTrips | CV | Thermal
```
→ 8개 탭이 수평으로 나열되어 스크롤 필요, 발견성 낮음

#### C.2 목표 레이아웃
```
┌────────────────┬──────────────────────────────────────┐
│ ▶ 기본 설정     │                                      │
│   Project Setup│  선택된 탭의 콘텐츠                     │
│   System Config│                                      │
│   Sim Control  │                                      │
│   Minor Edits  │                                      │
│                │                                      │
│ ▶ 트립/제어     │                                      │
│   Variable Trip│                                      │
│   Logic Trips  │                                      │
│   Control Vars │                                      │
│                │                                      │
│ ▶ 테이블/물리   │                                      │
│   Gen Tables   │                                      │
│   Reactor Kin. │                                      │
│   Thermal Prop │                                      │
├────────────────┼──────────────────────────────────────┤
│                │  [Cancel]              [Save]         │
└────────────────┴──────────────────────────────────────┘
```

#### C.3 카테고리 구성
| 카테고리 | 탭 목록 | 비고 |
|---------|---------|------|
| 기본 설정 | Project Setup, System Config, Simulation Control, Minor Edits | 기존 4개 탭 |
| 트립/제어 | Variable Trips, Logic Trips, Control Variables | 기존 3개 탭 |
| 테이블/물리 | General Tables, Reactor Kinetics, Thermal Properties | 기존 1개 + 신규 2개 |

#### C.4 구현 방식
- 다이얼로그 크기: `maxWidth="lg"` (현재 `md`에서 확대)
- 좌측 네비게이션: MUI `List` + `ListItemButton` + `Collapse` (카테고리 접기/펼치기)
- 좌측 너비: 200px 고정
- 우측 콘텐츠: 기존 탭 컴포넌트 그대로 사용
- `initialTab` prop 기존 동작 유지 (ValveForm에서 CV 탭 직접 열기)

---

### D. Valve `chkvlv` 서브타입

#### D.1 변경 범위
1. **mars.ts**: `ValveSubType`에 `'chkvlv'` 추가
   ```typescript
   export type ValveSubType = 'mtrvlv' | 'trpvlv' | 'srvvlv' | 'chkvlv';
   ```

2. **ValveForm.tsx**: `chkvlv` 선택 시 UI (기존 `trpvlv`와 유사)
   - chkvlv는 Trip 기반으로 동작하는 체크밸브
   - 역방향 흐름 시 자동 폐쇄

3. **fileGenerator.ts**: `generateValveCards`에 `chkvlv` 처리 추가
   - CCC0001: `chkvlv` 키워드
   - CCC0301: trip 참조 (trpvlv와 유사한 패턴)

#### D.2 참고
- SMART.i에서는 직접 사용되지 않았으나, MARS 매뉴얼 Section 8.15.6에 정의됨
- 추후 확장성을 위해 타입 + 파일생성 + 기본 UI 제공

---

### E. Card 001 / 104 / 105 (선택 카드)

#### E.1 Card 001 — Development Model Control
- **위치**: Project Setup 탭 또는 System Config 탭
- **UI**: 선택적 숫자 필드 (비어있으면 카드 미생성)
- **타입**: `globalSettings.devModelControl?: number`
- **파일 생성**: `001  {value}` (값이 있을 때만)
- **참고**: SMART.i에서 `76`(새 EOS+JHD), `85`(새 EOS+tecplot) 등

#### E.2 Card 104 — Restart-Plot File Control
- **위치**: Project Setup 탭
- **UI**: 활성화 체크박스 + 옵션(compress/ncmpress) + 파일명 입력
- **타입**:
  ```typescript
  globalSettings.restartPlot?: {
    action: 'cmpress' | 'ncmpress';
    fileName: string;
  }
  ```
- **파일 생성**: `104  {action}  {fileName}` (활성화 시에만)

#### E.3 Card 105 — CPU Time
- **위치**: Simulation Control 탭
- **UI**: 활성화 체크박스 + 두 개 숫자 필드 (limit1, limit2)
- **타입**:
  ```typescript
  globalSettings.cpuTime?: {
    limit1: number;  // 재시작 덤프 개시 잔여 시간
    limit2: number;  // 진단 편집 잔여 시간
  }
  ```
- **파일 생성**: `105  {limit1}  {limit2}` (활성화 시에만)

---

## 4. 의존성 관계

```
General Tables (A)  ←──참조──  Reactor Kinetics (B)
                                  30000011 → GT 번호
                    ←──참조──  Control Variables (기존)
                                  FUNCTION w3 → GT 번호

Reactor Kinetics (B) ──참조──→ Volume 컴포넌트 (기존, 밀도 가중치)
                     ──참조──→ Heat Structure 컴포넌트 (기존, 도플러 가중치)

GlobalSettings UI (C) ──포함──→ General Tables 탭 (A)
                      ──포함──→ Reactor Kinetics 탭 (B)
                      ──포함──→ Card 001/104/105 (E)
```

## 5. 구현 순서 (권장)

| Phase | 작업 | 의존성 |
|-------|------|--------|
| 1 | GlobalSettings UI 카테고리 그룹화 (C) | 없음 (기존 탭만 재배치) |
| 2 | General Tables 타입 + 스토어 + UI + 파일생성 (A) | Phase 1 (탭 자리 확보) |
| 3 | Point Reactor Kinetics 타입 + 스토어 + UI + 파일생성 (B) | Phase 2 (GT 참조 필요) |
| 4 | chkvlv 서브타입 (D) | 없음 (독립적) |
| 5 | Card 001/104/105 (E) | Phase 1 (기존 탭에 필드 추가) |

---

## 6. 미결 사항 / 향후 확인 필요

1. **General Table 타입 확장**: SMART.i에서는 `reac-t`와 `power`만 확인됨. MARS 매뉴얼 Chapter 12에 추가 타입이 있을 수 있음
2. **Kinetics 지연중성자 개별 그룹**: SMART.i에서는 `gamma-ac` 내장 데이터 사용. 개별 그룹 입력이 필요한 경우 Chapter 16.2~16.3 참조 필요
3. **chkvlv 상세 카드 형식**: MARS 매뉴얼 Section 8.15.6 확인 후 정확한 카드 형식 결정
4. **Card 001 유효 값 목록**: 매뉴얼 Section 2.1에서 정확한 옵션 값 확인 필요
5. **FUNCTION CV → GT 드롭다운**: 기존 ControlVariablesTab의 FUNCTION 타입 편집 UI에서 tableNumber 필드를 GT 목록 드롭다운으로 변경 필요
