# MARS 입력파일 생성 테스트 체크리스트

> 기준: `documents/100%.i` (SMR BOP Model)
> 타입: `src/types/mars.ts`
> 파일 생성기: `src/utils/fileGenerator.ts`
> **목적**: 입력 폼 필드 차이별로 컴포넌트를 분류하여, 선별 테스트로 전체 커버

---

## 폼 기반 테스트 그룹 총괄

| 그룹 | 폼 패턴 | 컴포넌트 | 테스트 수 |
|------|---------|----------|:---------:|
| A | 단순 볼륨 | SNGLVOL, TMDPVOL | 2 |
| B | 단순 접합부 | SNGLJUN, TMDPJUN | 2 |
| C | 다셀 배열 | PIPE | 1 |
| D | 볼륨+접합부 배열 | BRANCH, TURBINE, TANK | 3 |
| D+ | 분리기 (특수 브랜치) | SEPARATR | 1 |
| E | 접합부만 배열 (확장필드) | MTPLJUN | 1 |
| F | 펌프 전용 | PUMP | 1 |
| G | 밸브 서브타입 분기 | VALVE (trpvlv/mtrvlv/srvvlv/chkvlv) | 3~4 |
| H | 열구조체 (연료봉 분기) | HTSTR | 2 |
| I | 글로벌/편집/제어/보조 | 비 컴포넌트 | 별도 |
| | | **총 수력 컴포넌트 테스트** | **16~17** |

---

## 그룹 A. 단순 볼륨 — SNGLVOL vs TMDPVOL

### 공통 폼 필드 (둘 다 동일)
| 필드 | 타입 | 카드 |
|------|------|------|
| name | string | CCC0000 |
| xArea, xLength, volume | number×3 | CCC0101 |
| azAngle, incAngle, dz | number×3 | CCC0102 |
| wallRoughness, hydraulicDiameter, tlpvbfe | number×2+string | CCC0103 |

### SNGLVOL 전용 필드
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| ebt | `'001'~'005'` (5개) | CCC0200 | 평형 옵션 |
| pressure | number | CCC0200 | |
| temperature / quality | number (ebt에 따라) | CCC0200 | ebt=003→temp, ebt=002→quality |

### TMDPVOL 전용 필드 (SNGLVOL과 다른 점)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| **conditionType** | `TmdpvolEbtFormat` (45+옵션) | CCC0200 | εbt 3자리 (ε:유체종류 × b:붕소 × t:열역학 옵션) |
| **timeTable** | `TmdpvolTimePoint[]` (배열) | CCC0201~020N | t옵션에 따라 입력 필드 조합이 다름 |
| tripNumber | number (선택) | CCC0200 W2 | 트립 번호 |
| variableType | `TmdpSearchVariableType` (6종) | CCC0200 W3 | 검색변수 종류 |
| variableCode | number (선택) | CCC0200 W4 | 검색변수 대상 ID |

> **핵심 차이**: SNGLVOL은 고정 IC (ebt 5개 + P/T), TMDPVOL은 시간종속 경계조건 (conditionType 45+옵션 + timeTable 배열 + 검색변수 제어)

### 100%.i 컴포넌트 번호

**SNGLVOL (4개)**: C100 `sk_inner`, C260 `bt_head`, C302 `fw_hdr`, C738 `main`

**TMDPVOL (6개)**: C290 `pzr_top`, C292 `prt1`, C986 `seawat`, C990 `seawat`, C994 `seawat`, C998 `seawat`

### 테스트 항목
- [ ] **SNGLVOL** (C100 `sk_inner`)
  - [ ] CCC0101: xArea=0.0, xLength=1.593, volume=6.945
  - [ ] CCC0102: azAngle=0.0, incAngle=90.0, dz=1.593
  - [ ] CCC0103: roughness=3.048e-5, hd=0.053798, tlpvbfe=`0000000`
  - [ ] CCC0200: ebt=003, pressure=15.125e6, temperature=560.87
- [ ] **TMDPVOL** (C290 `pzr_top`)
  - [ ] conditionType: εbt 3자리 코드 (예: `002`)
  - [ ] timeTable: 시간종속 데이터 복수행 출력
  - [ ] 검색변수: tripNumber + variableType + variableCode 조합

---

## 그룹 B. 단순 접합부 — SNGLJUN vs TMDPJUN

### 공통 폼 필드
| 필드 | 타입 | 카드 |
|------|------|------|
| name | string | CCC0000 |
| from, to | VolumeReference (노드 선택) | CCC0101 |
| area | number | CCC0101 |

### SNGLJUN 전용 필드
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| fwdLoss, revLoss | number×2 | CCC0102 | 손실계수 |
| jefvcahs | string (8자리) | CCC0102 | 접합부 플래그 |
| flowDirection | 1/-1/0 (선택) | CCC0201 | 흐름 방향 |
| mfl, mfv | number×2 (선택) | CCC0201 | 초기 유량 |

### TMDPJUN 전용 필드 (SNGLJUN과 다른 점)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| jefvcahs | string 또는 useModifiedPvTerm toggle | CCC0101 | PV term 토글 |
| **conditionType** | 0\|1 | CCC0200 | 속도/질량유량 |
| **timeTable** | `{time, mfl, mfv}[]` (배열) | CCC0201~020N | 시간종속 유량 |
| tripNumber | number (선택) | CCC0200 W2 | 트립 번호 |
| variableType | `TmdpSearchVariableType` (6종) | CCC0200 W3 | 검색변수 종류 |
| variableCode | number (선택) | CCC0200 W4 | 검색변수 대상 ID |

> **핵심 차이**: SNGLJUN은 고정 유량 IC (선택), TMDPJUN은 시간종속 유량 테이블 + 검색변수 제어. 손실계수/플래그는 SNGLJUN에만 있고 TMDPJUN에는 PV term 토글만 있음.

### 100%.i 컴포넌트 번호

**SNGLJUN (90+개, 주요 발췌)**:
- 원자로: C115, C145, C155, C175, C251, C259, C261, C265, C275, C289
- RCS: C205, C215, C225, C235, C245
- BOP: C301, C307/327/347/367, C313/333, C383, C615, C621, C635, C637
- FW Heater: C645~659, C689~753, C809~835
- 해수: C989, C993, C997

**TMDPJUN (3개)**: C987 `w_flow`, C991 `w_flow`, C995 `w_flow`

### 테스트 항목
- [ ] **SNGLJUN** (C115 `inlet_cb`)
  - [ ] from/to: VolumeReference → 9자리 VolumeID 변환 (예: 110010002)
  - [ ] fwdLoss/revLoss + jefvcahs 8자리 플래그
  - [ ] 선택적 flow IC (flowDirection + mfl + mfv)
- [ ] **TMDPJUN** (C987 `w_flow`)
  - [ ] conditionType: 0 또는 1
  - [ ] timeTable: 시간종속 유량 복수행 (time, mfl, mfv)
  - [ ] tripNumber + variableType (cntrlvar) + variableCode

---

## 그룹 C. 다셀 배열 — PIPE (완전 고유)

### 폼 필드 (다른 컴포넌트와 공유 없음)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| name | string | CCC0000 | |
| **ncells** | number | CCC0001 | 셀 수 → 모든 배열 길이 결정 |
| xArea[] | number[] | CCC01NN | SEF 압축 |
| xLength[] | number[] | CCC03NN | SEF 압축 |
| volume[] | number[] | CCC04NN | SEF 압축 |
| azAngle | number\|number[] | CCC05NN | 단일값 또는 셀별 |
| vertAngle | number\|number[] | CCC06NN | 단일값 또는 셀별 |
| xElev[] | number[] (선택) | CCC07NN | 선택적 |
| wallRoughness | number\|number[] | CCC08NN | |
| hydraulicDiameter | number\|number[] | CCC08NN | |
| junctionArea | number\|number[] (선택) | CCC02NN | |
| fwdLoss, revLoss | number\|number[] (선택) | CCC09NN | |
| volumeFlags | string\|string[] | CCC10NN | 7자리 |
| junctionFlags | string\|string[] | CCC11NN | 8자리 |
| initialConditions[] | {ebt,P,T/Q}[] | CCC12NN | 셀별 개별 IC |
| junctionControl | {controlWord, conditions[]} (선택) | CCC1300~13NN | |
| **ccflData** | {diameter,beta,intercept,slope}[] (선택) | CCC14NN | CCFL 데이터 |

> **핵심 특징**: 모든 필드가 ncells 크기 배열, Sequential Expansion Format(SEF) 압축, ccflData/junctionControl 선택적

### 100%.i 컴포넌트 번호 (97+개, 주요 발췌)

- 원자로: C120/C130/C140 (core), C160/C170/C180 (UGS/CSB), C250~258 (FMHA), C270/C280 (PZR)
- RCS: C191~194 (RCP discharge), C200~240 (SG 4세트)
- BOP: C305~375 (FW/SG/MSL 4세트), C382~676 (터빈/복수/FW계통), C720~858 (FW heater), C908~996 (기타)
- 해수: C988/C992/C996

### 테스트 항목
- [ ] **PIPE** (C120 `core_avg`, 12셀)
  - [ ] ncells=12 → 배열 길이 12
  - [ ] SEF 압축: 동일값 연속 → 단일행 합침 (예: `1200301 0.125 1`, `1200302 0.200 11`)
  - [ ] 볼륨 IC (CCC12NN): ebt/P/T × 12셀 (각각 다른 값 가능)
  - [ ] 접합부 IC (CCC13NN): junctionControl 선택 출력
  - [ ] 선택적 카드 생략: xElev 미입력 → CCC07NN 미생성
  - [ ] 카드 번호 순서 정렬

---

## 그룹 D. 볼륨+접합부 배열 — BRANCH / TURBINE / TANK

### 공통 폼 필드 (3종 모두 동일)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| name | string | CCC0000 | |
| njuns | number | CCC0001 | 접합부 수 |
| initialConditionControl | 0\|1 | CCC0001 | 속도/질량유량 |
| area, length, volume | number×3 | CCC0101 | 볼륨 지오메트리 |
| azAngle, incAngle, dz | number×3 | CCC0101 | 각도 |
| wallRoughness, hydraulicDiameter, tlpvbfe | number×2+string | CCC0103 | 벽면 |
| ebt, pressure, temperature/quality | IC | CCC0200 | 초기조건 |
| junctions[] | BranchJunction[] | CCCN101~N201 | 접합부 배열 |
| yCrossflowData, zCrossflowData | CrossflowVolumeData (선택) | CCC0181/0191 | 교차흐름 |

**BranchJunction 필드** (접합부당):
- junctionNumber, direction, branchFace
- from, to (VolumeReference), area
- fwdLoss, revLoss, jefvcahs
- dischargeCoefficient, thermalConstant (선택)
- initialLiquidFlow, initialVaporFlow (선택)

### BRANCH (베이스라인) — 추가 필드 없음
> 위 공통 필드가 전부

### TURBINE 전용 필드 (BRANCH + 아래 추가)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| njuns | **1\|2** (제한) | CCC0001 | BRANCH는 2~9, TURBINE은 1~2만 |
| **shaftSpeed** | number | CCC0300 | 축 회전 속도 (rad/s) |
| **stageInertia** | number | CCC0300 | 회전 관성 (kg·m²) |
| **shaftFriction** | number | CCC0300 | 축 마찰 (N·m·s) |
| **shaftComponentNumber** | number | CCC0300 | SHAFT 컴포넌트 번호 |
| **disconnectTrip** | number | CCC0300 | 분리 트립 번호 |
| drainFlag | number (선택) | CCC0300 | |
| **turbineType** | 0\|1\|2\|3 | CCC0400 | 터빈 종류 |
| **efficiency** | number | CCC0400 | 최대 효율 |
| **reactionFraction** | number | CCC0400 | 반동분율 |
| **meanStageRadius** | number | CCC0400 | 평균 단 반경 |
| efficiencyData[] | TurbinePerfPair[] (type=3만) | CCC0401~0450 | 효율 테이블 |
| massFlowRateData[] | TurbinePerfPair[] (type=3만) | CCC0451~0499 | 유량 테이블 |

> **핵심 차이**: CCC0300(shaft 6필드) + CCC0400(performance 4필드) + type=3일 때 효율/유량 테이블

### TANK 전용 필드 (BRANCH + 아래 추가)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| njuns | 0~9 (0 가능) | CCC0001 | BRANCH는 2~9, TANK는 0~9 |
| **initialLiquidLevel** | number | CCC0400 | 초기 액위 (m) |
| **volumeLevelCurve** | VolumeLevelPair[] | CCC0401~0499 | 체적-수위 곡선 (최소 2쌍) |

> **핵심 차이**: CCC0400(초기 수위 1필드) + CCC0401+(체적-수위 곡선 배열). BRANCH 대비 추가 2종 카드.

### 100%.i 컴포넌트 번호

**BRANCH (3개)**: C110 `core_p`, C150 `fap`, C195 `br_disbr`

**TURBINE (8개)**: C610 `hp_turb1`, C612 `hp_turb2`, C614 `hp_turb3`, C624~632 `lp_turb1~5`

**TANK (6개, 주석처리)**: C816 `hpfw1tk`, C824 `hpfw2tk`, C726 `lpfw4tk`, C734 `lpfw3tk`, C742 `lpfw2tk`, C750 `lpfw1tk`

### 테스트 항목
- [ ] **BRANCH** (C110 `core_p`, 3접합부)
  - [ ] njuns=3, 볼륨 지오메트리 + IC
  - [ ] junctions[3]: 접합부별 from/to/area/loss/flags
  - [ ] BranchJunction.dischargeCoefficient/thermalConstant (선택 출력)
  - [ ] crossflow (CCC0181/0191, 선택 출력)
- [ ] **TURBINE** (C610 `hp_turb1`)
  - [ ] BRANCH 공통 필드 전체
  - [ ] CCC0300: shaftSpeed/stageInertia/shaftFriction/shaftComponentNumber/disconnectTrip (6필드)
  - [ ] CCC0400: turbineType/efficiency/reactionFraction/meanStageRadius (4필드)
  - [ ] (type=3인 경우) CCC0401~0499: 효율/유량 테이블
- [ ] **TANK** (C824 `hpfw2tk`, 주석처리 참조)
  - [ ] BRANCH 공통 필드 전체
  - [ ] CCC0400: initialLiquidLevel (1필드)
  - [ ] CCC0401+: volumeLevelCurve 복수쌍

---

## 그룹 D+. 분리기 (특수 브랜치) — SEPARATR

### 폼 필드 (BRANCH 공통 + 고유)

**BRANCH와 동일한 필드**:
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| name | string | CCC0000 | |
| initialConditionControl | 0\|1 | CCC0001 | njuns=3 고정 (사용자 변경 불가) |
| ebt, pressure, temperature/quality | IC | CCC0200 | 초기조건 (Branch와 동일) |

**SEPARATR 전용 Volume 카드** (MARS 매뉴얼 8.11.3):
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| area, length, volume | number×3 | CCC0101 W1-W3 | |
| azAngle, incAngle, dz | number×3 | CCC0101 W4-W6 | **Branch와 다름**: 9개 값을 CCC0101-0109 범위에 자유 배치 |
| wallRoughness, hydraulicDiameter | number×2 | (CCC0102 등) W7-W8 | |
| volumeControlFlags | string `000001e` | (CCC0102 등) W9 | **e만 가변** (Branch는 `tlpvbfe` 7자리 전체 가변) |

> **매뉴얼 8.11.3**: "The nine words can be entered on one or more cards, and the card numbers need not be consecutive."
> 참조 100%.i 사용 패턴: CCC0101(W1-W6, 6값) + CCC0102(W7-W9, 3값)

**SEPARATR 전용 Junction 카드** (BRANCH 대비 차이):
| 항목 | BRANCH | SEPARATR | 비고 |
|------|--------|----------|------|
| Junction 수 | 2~9 (가변) | **3 (고정)** | N=1:Vapor, N=2:Liquid, N=3:Inlet |
| CCCN101 형식 | 3-card (N101+N102+N103) | **1-card (7~8 word)** | from/to/area/fwd/rev/flags[/voidLimit] |
| jefvcahs | `0efvcahs` 8자리 | `0000cahs` 4자리만 가변 | 참조: `001000` (6자리) |
| W7 (CCCN101) | discharge coeff | **VOVER(N=1) / VUNDER(N=2)** | N=3은 W7 없음 |
| CCCN103 | discharge + thermal | **없음** | Separator에는 해당 카드 없음 |
| Add/Remove | 가능 | **불가** (고정 3개) | |

**SEPARATR 고유 카드**:
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| **separatorOption** (ISEPST) | 0\|1\|2\|3 | CCC0002 W1 | 0=Simple(RELAP5), 1=GE dryer, 2=GE 2-stage, 3=GE 3-stage |
| numSeparatorComponents | number | CCC0002 W2 | ISEPST=2,3일 때만 |
| **geSeparatorData** | 8 values | CCC0500 | ISEPST>0 시 |
| **geFirstStageData** | 9 values | CCC0501 | ISEPST>0 시 |
| geSecondStageData | 9 values | CCC0502 | ISEPST≥2 시 |
| geThirdStageData | 9 values | CCC0503 | ISEPST=3 시 |
| **geDryerData** | 3 values | CCC0600 | ISEPST>0 시 |
| voidFractionLimit | number | CCCN101 W7 | N=1: VOVER(기본0.5), N=2: VUNDER(기본0.15) |
| CCCN110 | 4 values | CCCN110 | Junction Diameter/CCFL (선택, Branch와 동일) |

> **핵심 차이**: 고정 3 Junction + CCCN101 단일행 형식 + W7 void fraction limit + GE separator 데이터(ISEPST>0) + volumeControlFlags `000001e` 제한

### 100%.i 컴포넌트 번호 (1개)

**SEPARATR**: C618 `sgb_sep`

### 참조 데이터 (100%.i, C618 sgb_sep)

```
6180000   sgb_sep   separatr
6180001   3         1
6180101   0.0       1.46279    17.236993   0.0         90.0   1.46279
6180102   0.00005   0.28575    00000
6180200   002       4.526e5    1.0
6181101   618010000  620000000  12.44125  0.0    0.0    001000  0.5
6182101   618000000  720010000  2.748381  2.5    2.5    001000  0.15
6183101   616010000  618000000  3.539606  10.0   10.0    001000
6181110   0.0        0.0   1.0   1.0
6182110   0.30480    0.0   1.0   1.0
6183110   0.0        0.0   1.0   1.0
6181201   0.0        123.27       0.0
6182201   13.45      0.0          0.0
6183201   14.01065   122.7032     0.0
```

### 입력 필드 매핑

#### Basic Information
| 필드 | 값 | 비고 |
|------|-----|------|
| Component Name | sgb_sep | textbox |
| Component ID | 6180000 | textbox (테스트에선 자동생성 ID 사용) |
| Separator Option (ISEPST) | 0 | radio/select (100%.i에 CCC0002 없음 → Simple) |
| Initial Condition Control | 1 | CCC0001 W2 |

#### Volume Geometry
| 필드 | 값 | 비고 |
|------|-----|------|
| Area (m²) | 0.0 | spinbutton (0 = MARS가 V/L로 계산) |
| Length (m) | 1.46279 | spinbutton |
| Volume (m³) | 17.236993 | spinbutton |

#### Angles
| 필드 | 값 | 비고 |
|------|-----|------|
| Azimuthal Angle (°) | 0.0 | spinbutton |
| Inclination Angle (°) | 90.0 | spinbutton |
| Elevation Change (m) | 1.46279 | spinbutton |

#### Wall Properties
| 필드 | 값 | 비고 |
|------|-----|------|
| Wall Roughness (m) | 0.00005 (5e-5) | spinbutton |
| Hydraulic Diameter (m) | 0.28575 | spinbutton |
| Volume Control Flags | 00000 | textbox (`000001e`, e=0) |

#### Initial Conditions
| 필드 | 값 | 비고 |
|------|-----|------|
| ebt | 002 | select → [P, xs(quality)] |
| Pressure (Pa) | 452600 (4.526e5) | spinbutton |
| Quality (xs) | 1.0 | spinbutton (ebt=002 시 표시) |

#### Junctions (3 Fixed)

**N=1: Vapor Outlet**
| 필드 | 값 | 비고 |
|------|-----|------|
| From Volume | 618010002 (self face 2) | **자동잠금** (disabled) |
| To Volume | 620000000 | combobox (연결 필요) |
| Area (m²) | 12.44125 | spinbutton |
| Fwd Loss | 0.0 | spinbutton |
| Rev Loss | 0.0 | spinbutton |
| Junction Flags | 001000 | textbox (6~8자리) |
| Void Fraction Limit (VOVER) | 0.5 | spinbutton (기본 0.5) |
| Liquid Flow (kg/s) | 0.0 | spinbutton |
| Vapor Flow (kg/s) | 123.27 | spinbutton |

**N=2: Liquid Fall Back**
| 필드 | 값 | 비고 |
|------|-----|------|
| From Volume | 618000000 (self face 1) | **자동잠금** (disabled) |
| To Volume | 720010000 | combobox (연결 필요) |
| Area (m²) | 2.748381 | spinbutton |
| Fwd Loss | 2.5 | spinbutton |
| Rev Loss | 2.5 | spinbutton |
| Junction Flags | 001000 | textbox |
| Void Fraction Limit (VUNDER) | 0.15 | spinbutton (기본 0.15) |
| Liquid Flow (kg/s) | 13.45 | spinbutton |
| Vapor Flow (kg/s) | 0.0 | spinbutton |

**N=3: Separator Inlet**
| 필드 | 값 | 비고 |
|------|-----|------|
| From Volume | 616010000 | combobox (연결 필요) |
| To Volume | 618000000 | combobox (연결 필요) |
| Area (m²) | 3.539606 | spinbutton |
| Fwd Loss | 10.0 | spinbutton |
| Rev Loss | 10.0 | spinbutton |
| Junction Flags | 001000 | textbox |
| Void Fraction Limit | — | **N=3은 입력 불필요** (disabled) |
| Liquid Flow (kg/s) | 14.01065 | spinbutton |
| Vapor Flow (kg/s) | 122.7032 | spinbutton |

### 출력 검증 체크리스트

| 카드 | 내용 | 기대값 | 비고 |
|------|------|--------|------|
| CCC0000 | name + type | `sgb_sep  separatr` | |
| CCC0001 | njuns + icond | `3  1` | njuns 항상 3 |
| CCC0101 | area/length/vol | `0.0  1.46279  17.236993` | ⚠ 현재 3-card vs 참조 2-card |
| CCC0102 | az/inc/dz 또는 rough/hd/flags | 형식에 따라 다름 | 아래 "잠재 이슈" 참조 |
| CCC0200 | ebt + P + quality | `002  4.526000e+5  1.0` | ebt=002 → quality 출력 |
| CCC1101 | N=1 junction (7 word) | `618010002 620000000 12.44125 0.0 0.0 001000 0.5` | from=자동잠금 |
| CCC2101 | N=2 junction (7 word) | `618000000 720010000 2.748381 2.5 2.5 001000 0.15` | from=자동잠금 |
| CCC3101 | N=3 junction (6 word) | `616010000 618000000 3.539606 10.0 10.0 001000` | W7 없음 |
| CCC1110 | N=1 CCFL | `0.0 0.0 1.0 1.0` | 선택적 (참조에 있음) |
| CCC2110 | N=2 CCFL | `0.30480 0.0 1.0 1.0` | |
| CCC3110 | N=3 CCFL | `0.0 0.0 1.0 1.0` | |
| CCC1201 | N=1 flow | `0.0 123.27 0.0` | |
| CCC2201 | N=2 flow | `13.45 0.0 0.0` | |
| CCC3201 | N=3 flow | `14.01065 122.7032 0.0` | |

### 잠재 이슈 (사전 식별)

| # | 이슈 | 설명 | 심각도 |
|---|------|------|--------|
| SEP-1 | Volume 카드 형식 차이 | 현재 생성기: 3-card (CCC0101/0102/0103). 참조 100%.i: 2-card (CCC0101 6값 + CCC0102 3값). 매뉴얼은 "one or more cards" 허용 → **MARS 동작에 문제없으나 참조와 불일치** | ⚠ warning |
| SEP-2 | jefvcahs 자릿수 | 참조 `001000` (6자리), 폼 기본 `00000000` (8자리). MARS가 둘 다 수용하는지 확인 필요 | ⚠ warning |
| SEP-3 | CCCN110 (CCFL) 미구현 가능성 | 참조에 CCCN110 카드 존재. 폼에 junctionDiameter/ccflBeta 필드 있으나 실제 입력 UI 확인 필요 | 🔍 확인필요 |
| SEP-4 | From Volume 자동잠금 | N=1의 from은 `CCC010002` (self face 2), N=2의 from은 `CCC010001` (self face 1) — 폼에서 자동설정 확인 | 🔍 확인필요 |
| SEP-5 | GE 데이터 미구현 (Phase 2) | ISEPST>0 시 CCC0500~0600 카드 필요. 현재 생성기에 미구현 → ISEPST=0만 테스트 가능 | ℹ 정보 |
| SEP-6 | ebt=002 quality 출력 | 참조: `002  4.526e5  1.0` (quality). 이전 버그(BUG-2)로 Branch/Tank 수정 완료, Separator 생성기도 이미 대응됨 | ✅ 수정됨 |

### 테스트 항목
- [ ] **SEPARATR** (C618 `sgb_sep`, ISEPST=0)
  - [ ] CCC0000: name + `separatr`
  - [ ] CCC0001: njuns=3, initialConditionControl=1
  - [ ] CCC0101~0102(또는 0103): 9개 Volume 값 (형식 차이 기록)
  - [ ] CCC0200: ebt=002 → pressure + quality (temperature 아님)
  - [ ] CCC1101: N=1 from=self(face2), to=외부, area, loss, flags, VOVER=0.5
  - [ ] CCC2101: N=2 from=self(face1), to=외부, area, loss, flags, VUNDER=0.15
  - [ ] CCC3101: N=3 from/to=외부, area, loss, flags (W7 없음)
  - [ ] CCC{N}110: CCFL 데이터 (선택적, 참조에 존재)
  - [ ] CCC{N}201: 초기유량 mfl/mfv/0.0 × 3 junctions
- [ ] **독립 테스트 한계**: From/To Volume은 연결된 컴포넌트 필요 (없으면 000000000 + WARNING)

---

## 그룹 E. 접합부만 배열 — MTPLJUN

### 폼 필드 (BRANCH의 접합부와 다름)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| name | string | CCC0000 | |
| njuns | number (1~99) | CCC0001 | BRANCH보다 범위 넓음 |
| icond | 0\|1 | CCC0001 | |
| junctions[] | **MtpljunJunction[]** | CCCNN11~1NN11 | 아래 참조 |

**MtpljunJunction 필드** (BranchJunction과의 차이):
| 필드 | MtpljunJunction | BranchJunction | 비고 |
|------|-----------------|----------------|------|
| from, to, area | O | O | 동일 |
| fwdLoss, revLoss | O | O | 동일 |
| jefvcahs | O | O (선택) | MTPLJUN은 필수 |
| **subDc, twoDc, supDc** | **O (3종 방출계수)** | X | MTPLJUN 고유 |
| **fIncre, tIncre** | **O (증분)** | X | MTPLJUN 고유 |
| dischargeCoefficient | X | O (선택) | BRANCH 고유 |
| thermalConstant | X | O (선택) | BRANCH 고유 |
| branchFace | X | O | BRANCH 고유 |
| junctionNumber | O (1~99) | O (1~9) | 범위 다름 |
| initialFlow | O (필수) | O (선택) | MTPLJUN은 IC 포함 |

> **핵심 차이**: 볼륨 없이 접합부만 존재. 접합부 필드 구조가 BranchJunction과 다름 (방출계수 3종 + 증분 2종 추가, face/discharge/thermal 없음). 카드 번호도 다름 (CCCNN11 2자리 vs CCCN101 1자리).

### 100%.i 컴포넌트 번호 (6개)

C125 `core_crs` (12접합부), C165 `ugs_crs`, C190 `dischage`, C246 `fmhamj`, C661 `poolj`, C937 `poolj`

### 테스트 항목
- [ ] **MTPLJUN** (C125 `core_crs`, 12접합부)
  - [ ] njuns=12, icond=1
  - [ ] 접합부별 CCCNN11: from/to/area/fwdLoss/revLoss/jefvcahs/subDc/twoDc/supDc/fIncre/tIncre (11필드)
  - [ ] 접합부별 CCC1NN11: initialLiquidFlow/initialVaporFlow (icond=1일 때)
  - [ ] NN 번호: 01~12 (2자리 제로패딩)
  - [ ] VolumeID 변환 정확성

---

## 그룹 F. 펌프 전용 — PUMP (완전 고유)

### 폼 필드 (다른 컴포넌트와 공유 없음)
| 섹션 | 필드 | 타입 | 카드 |
|------|------|------|------|
| 볼륨 | area, length, volume, angles, dz, tlpvbfe | 7필드 | CCC0101~0102 |
| **입구 접합부** | inletConnection, inletArea, inletFwdLoss, inletRevLoss, inletJefvcahs | 5필드 | **CCC0108** |
| **출구 접합부** | outletConnection, outletArea, outletFwdLoss, outletRevLoss, outletJefvcahs | 5필드 | **CCC0109** |
| IC | ebt, pressure, temperature | 3필드 | CCC0200 |
| **입구 유량** | inletFlowMode, inletLiquidFlow, inletVaporFlow | 3필드 | **CCC0201** |
| **출구 유량** | outletFlowMode, outletLiquidFlow, outletVaporFlow | 3필드 | **CCC0202** |
| **옵션** | tbli, twophase, tdiff, mtorq, tdvel, ptrip, rev | **7필드** | **CCC0301** |
| **펌프 기술** | ratedSpeed~frictionTF3 | **12필드** | **CCC0302~0304** |
| **상사곡선** | homologousCurves[16종] (PumpCurve[]) | 배열 | **CCC1100~2600** |
| **속도제어** | speedControl (tripOrControl + speedTable[]) | 선택 | **CCC6100+** |

> **핵심 차이**: 접합부가 분리 (inlet/outlet 각각 별도 카드), 7개 정수 옵션, 12개 펌프 기술 파라미터, 16종 상사곡선 (head×4 + torque×4 × 정방향/역방향), 속도제어 테이블. 다른 어떤 컴포넌트와도 폼 구조가 다름.

### 100%.i 컴포넌트 번호 (6개)

- RCP: C181 `rcp-1`, C182 `rcp-2`, C183 `rcp-3`, C184 `rcp-4`
- FWP: C640 `fwp`, C666 `fwp`

### 테스트 항목
- [ ] **PUMP** (C181 `rcp-1`)
  - [ ] CCC0108/0109: 입구/출구 분리 접합부 (각각 VolumeRef + area + loss + flags)
  - [ ] CCC0301: 7개 정수 옵션 (tbli/twophase/tdiff/mtorq/tdvel/ptrip/rev)
  - [ ] CCC0302~0304: 12개 펌프 기술 파라미터
  - [ ] CCC1100~2600: 상사곡선 16종 중 enabled=true인 것만 출력
  - [ ] 각 곡선: 헤더(type, regime) + 데이터행(v/a, h/a²)
  - [ ] CCC6100+: 속도제어 테이블 (선택적)

---

## 그룹 G. 밸브 서브타입 분기 — VALVE

### 공통 폼 필드 (4종 모두 동일)
| 필드 | 타입 | 카드 |
|------|------|------|
| name | string | CCC0000 |
| from, to | VolumeReference | CCC0101 |
| area | number | CCC0101 |
| fwdLoss, revLoss | number×2 | CCC0101/0102 |
| jefvcahs | string (8자리) | CCC0101/0102 |
| enableDischargeCoeffs | boolean (선택) | CCC0102 |
| dischargeCoeff, thermalCoeff | number×2 (선택) | CCC0102 |
| initialConditionType | 0\|1 | CCC0201 |
| initialLiquidFlow, initialVaporFlow | number×2 | CCC0201 |
| **valveSubType** | `'trpvlv'\|'mtrvlv'\|'srvvlv'\|'chkvlv'` | CCC0300 |

### 서브타입별 전용 필드 (CCC0301)

| 필드 | trpvlv | mtrvlv | srvvlv | chkvlv |
|------|:------:|:------:|:------:|:------:|
| tripNumber | **O** (1필드) | | | |
| openTripNumber | | **O** | | |
| closeTripNumber | | **O** | | |
| valveRate | | **O** | | |
| initialPosition | | **O** | | |
| controlVariable | | | **O** | |
| valveTableNumber | | | **O** | |
| checkValveType | | | | **O** |
| checkInitialPosition | | | | **O** |
| closingBackPressure | | | | **O** |
| leakRatio | | | | **O** |
| **CCC0301 필드 수** | **1** | **4** | **2** | **4** |

> **핵심 차이**: 공통 접합부 필드 동일, valveSubType 선택에 따라 CCC0301 카드의 필드 구조가 완전히 다름. 4종 모두 테스트 필요하나 chkvlv는 100%.i에 없음.

### 100%.i 컴포넌트 번호 (18개)

**trpvlv (9개)**: C291 `pzrpsv1`, C377 `msl_4`, C811 `HPbyp1`, C859 `byps3`, C723 `byps4`, C907 `sgtbn`, C913 `HPbyp3`, C919 `HPbyp3_1`, C909 `LPbyp4`

**mtrvlv (7개)**: C303 `fw_misv1`, C323 `fw_misv2`, C343 `fw_misv3`, C363 `fw_misv4`, C317 `msiv_1`, C337 `msiv_2`, C357 `msiv_3`

**srvvlv (2개)**: C607 `GValve`, C643 `LPFCV`

**chkvlv**: 100%.i에 없음 (별도 생성 필요)

### 테스트 항목
- [ ] **trpvlv** (C291 `pzrpsv1`)
  - [ ] CCC0300: `trpvlv`
  - [ ] CCC0301: tripNumber (정수 1필드)
- [ ] **mtrvlv** (C337 `msiv_2`)
  - [ ] CCC0300: `mtrvlv`
  - [ ] CCC0301: openTripNumber, closeTripNumber, valveRate, initialPosition (4필드)
- [ ] **srvvlv** (C607 `GValve`)
  - [ ] CCC0300: `srvvlv`
  - [ ] CCC0301: controlVariable, valveTableNumber (2필드)
- [ ] **(선택) chkvlv** — 100%.i에 없으므로 수동 생성 테스트
  - [ ] CCC0301: checkValveType, checkInitialPosition, closingBackPressure, leakRatio (4필드)

---

## 그룹 H. 열구조체 — HTSTR (일반 vs 연료봉)

### 공통 폼 필드 (일반/연료봉 모두 동일)
| 필드 | 타입 | 카드 |
|------|------|------|
| name | string | |
| nh, np | number×2 | 1CCCG000 |
| geometryType | 1(판형)\|2(원통) | 1CCCG000 |
| ssInitFlag | 0\|1 | 1CCCG000 |
| leftBoundaryCoord | number | 1CCCG000 |
| meshLocationFlag, meshFormatFlag | 0, 1\|2 | 1CCCG100 |
| meshIntervals[] | HsMeshInterval[] | 1CCCG1XX |
| materialCompositions[] | HsMaterialComposition[] | 1CCCG2XX |
| sourceDistributions[] | HsSourceDistribution[] | 1CCCG3XX |
| initialTemperatures[] | HsInitialTemperature[] | 1CCCG4XX |
| leftBoundaryConditions[] | HsBoundaryCondition[] | 1CCCG5XX |
| rightBoundaryConditions[] | HsBoundaryCondition[] | 1CCCG6XX |
| sourceData[] | HsSourceData[] | 1CCCG7XX |
| leftAdditionalOption + leftAdditionalBoundary[] | 선택 | 1CCCG8XX |
| rightAdditionalOption + rightAdditionalBoundary[] | 선택 | 1CCCG9XX |

### 연료봉 전용 필드 (isFuelRod=true)
| 필드 | 타입 | 카드 | 설명 |
|------|------|------|------|
| refloodFlag | number | 1CCCG000 W6 | Reflood 옵션 |
| boundaryVolumeIndicator | 0\|1 | 1CCCG000 W7 | 경계 방향 |
| maxAxialIntervals | 2~128 | 1CCCG000 W8 | 축방향 분할 |
| **gapConductance** | {initialGapPressure, referenceVolume, conductanceMultiplier} | **1CCCG001** | 갭 전도 |
| **metalWaterReaction** | {initialOxideThickness} | **1CCCG003** | 금속-물 반응 |
| **claddingDeformation** | {formLossFlag: 0\|1} | **1CCCG004** | 클래딩 변형 |
| **gapDeformationData[]** | HsGapDeformation[] (nh개) | **1CCCG011~099** | 갭 변형 데이터 |

> **핵심 차이**: isFuelRod 토글에 의해 4종 카드 그룹이 추가/제거. 1CCCG000에 reflood 관련 3필드도 추가. 일반 열구조체는 이 필드들 전부 미출력.

### 100%.i 컴포넌트 번호 (80+개, 그룹별)

**연료봉 (3개)**: S1200 `Averaged Fuel` (nh=10,np=8,원통), S1201 `Hot Fuel` (nh=10,np=8), S1202 `Guide tubes` (nh=13,np=3)

**일반 — RV/내부구조물 (30+개)**: S1000~S1002 (RV bottom/Skirt), S1100 (LCSP), S1500 (FAP), S1600~S1603 (UGS), S1700 (Core shroud), S1701~S1828 (CSB/RCP), S1901~S1904 (RV side), S2500~S2501 (FMHA), S2700~S2804 (UGS upper/PZR)

**일반 — SG/배관 (20+개)**: S3020 (FW Header), S3820 (Steam Header), S1305~S1375 (Steam line), S1310~S1370 (SG tube)

**일반 — BOP (20+개)**: S6203~S6204, S9880~S9960 (해수 HX), S6740/S6700 (FWHX7), S6480~S6560 (FWHX5/6)

### 테스트 항목
- [ ] **연료봉 HTSTR** (S1200 `Averaged Fuel`)
  - [ ] 1CCCG000: nh=10, np=8, geom=2(원통), reflood=599
  - [ ] 1CCCG001: gapConductance (initialGapPressure + referenceVolume)
  - [ ] 1CCCG003: metalWaterReaction (initialOxideThickness)
  - [ ] 1CCCG004: claddingDeformation (formLossFlag)
  - [ ] 1CCCG011~: gapDeformationData × nh개
  - [ ] 공통 카드 전체 (mesh~source~BC~additional)
  - [ ] 재료: 음수 ID = thermal property table 참조
- [ ] **일반 HTSTR** (S1700 `Core shroud`)
  - [ ] 연료봉 전용 카드 (001/003/004/011~) **미출력** 확인
  - [ ] 1CCCG000: reflood/boundary/maxAxial 필드 없음 확인
  - [ ] 좌/우 BC 각각 다른 bcType
  - [ ] 재료: 양수 ID = 내장재료

---

## 그룹 I. 비 컴포넌트 데이터

### I-1. 글로벌 설정 (Card 1~299)
- [ ] Card 100: `new transnt` / `restart stdy-st`
- [ ] Card 101: `run` / `inp-chk`
- [ ] Card 102: 단위 조합 (`si si` / `british si`)
- [ ] Card 110: 가스 타입 (`air` / `helium`)
- [ ] Card 120~129: 시스템 설정 × 최대 10개
- [ ] Card 201~299: 시간 구간 (min/max dt, control)

### I-2. Minor Edits (301~399, 20800001+)
- [ ] 단축형 (301~399): 카드 번호 자동 할당
- [ ] 확장형 (20800001+): 100개 초과 시 자동 확장
- [ ] 변수 타입별: rktpow, cntrlvar, p, tempf, tempg, mflowj 등
- [ ] 포맷: `cardNum varType param lowerLimit upperLimit group priority *comment`

### I-3. Trips (401~799)
- [ ] Variable Trip (401~599): leftVar, relation, rightVar, latch, timeout
- [ ] Logic Trip (601~799): AND/OR, timeof, trip message

### I-4. 제어변수 (205CCCNN, 22종)

| 폼 서브패턴 | 해당 타입 | 대표 | 차이점 |
|-------------|----------|------|--------|
| 헤더만 (데이터행 없음) | CONSTANT | C205213 | 초기값만 입력 |
| 합산/연산 (nterms 반복) | SUM, MULT, DIV, POWERI/R/X | C205701 | a0 + {value,var,param} × nterms |
| 함수/참조 (trip 기반) | FUNCTION, STDFNCTN, TRIPUNIT | 100%.i 참조 | trip 번호 + 변환 파라미터 |
| 제어기 (PID 유사) | PUMPCTL, STEAMCTL, FEEDCTL, PROP-INT, LAG, LEAD-LAG | C205182 | setpoint/sense + 시정수 |
| 특수 (축 연결) | SHAFT, DELAY, DIGITAL, TRIPDLAY | C205999 | nattach + 연결목록 + 속도/모멘트 |

- [ ] **CONSTANT**: 헤더만, 데이터행 없음
- [ ] **SUM**: nterms → 반복 데이터행
- [ ] **TRIPUNIT**: trip 번호 참조
- [ ] **PUMPCTL**: setpoint/sense + 시정수 5필드
- [ ] **SHAFT**: nattach + 연결목록 + 초기속도/동기속도/모멘트/마찰/트립

### I-5. 보조 데이터
- [ ] Thermal Properties (201MMMNN): 내장재료 vs TBL/FCTN 테이블
- [ ] General Tables (202TTTNN): type, trip, scale + x-y 데이터
- [ ] Reactor Kinetics (30000000): 지연중성자/밀도반응도/도플러/가중인자

---

## 통합 검증

### 전체 파일 생성
- [ ] 모든 그룹(A~I) 포함 프로젝트에서 .i 파일 Export
- [ ] 카드 번호 정렬 순서 확인
- [ ] 헤더/섹션 구분 주석 확인
- [ ] 마지막 줄 `.` (end card) 확인

### 포맷 검증
- [ ] 과학적 표기법 (1.0e-10, 15.125e6)
- [ ] VolumeID 9자리 포맷 (CCCVV0000)
- [ ] 플래그: 7자리 (0000000) / 8자리 (00000000)
- [ ] SEF 압축 정확성 (PIPE)

### VolumeReference 해석
- [ ] 단일 볼륨 → 9자리 ID 변환
- [ ] 파이프 셀 → 9자리 ID (face 포함)
- [ ] 브랜치 접합부 → 9자리 ID (branchFace 포함)
- [ ] 미연결 → `000000000` + 경고

---

## 최소 테스트 세트 요약

| # | 그룹 | 컴포넌트 | 100%.i 참조 | 테스트 포인트 |
|:-:|------|---------|-------------|-------------|
| 1 | A-볼륨 | SNGLVOL | C100 | 고정 IC (ebt 5종) |
| 2 | A-시간종속볼륨 | TMDPVOL | C290 | conditionType 45+ + timeTable + 검색변수 |
| 3 | B-접합부 | SNGLJUN | C115 | VolumeRef→9자리, loss/flags, 선택적 flow IC |
| 4 | B-시간종속접합부 | TMDPJUN | C987 | conditionType + timeTable + trip/검색변수 |
| 5 | C-다셀 | PIPE | C120 (12셀) | ncells 배열, SEF 압축, ccflData |
| 6 | D-브랜치 | BRANCH | C110 (3접합부) | BranchJunction 배열, crossflow |
| 7 | D-터빈 | TURBINE | C610 | BRANCH + shaft(6) + performance(4) |
| 8 | D-탱크 | TANK | C824* | BRANCH + 수위 + 체적-수위곡선 |
| 9 | D+-분리기 | **SEPARATR** | C618 | 고정3 Junction, CCCN101 단일행, VOVER/VUNDER, ebt=002 quality |
| 10 | E-복수접합부 | MTPLJUN | C125 (12접합부) | MtpljunJunction (방출계수3+증분2), 2자리 NN |
| 11 | F-펌프 | PUMP | C181 | 분리접합부, 7옵션, 12기술, 16곡선, 속도제어 |
| 12 | G-trip밸브 | trpvlv | C291 | CCC0301: tripNumber (1필드) |
| 13 | G-motor밸브 | mtrvlv | C337 | CCC0301: open/close/rate/pos (4필드) |
| 14 | G-servo밸브 | srvvlv | C607 | CCC0301: CV + table (2필드) |
| 15 | H-연료봉 | HTSTR | S1200 | isFuelRod=true → 4종 추가 카드 |
| 16 | H-일반 | HTSTR | S1700 | isFuelRod=false → 추가 카드 미출력 확인 |

> `*` TANK는 100%.i에서 주석처리 상태
> 그룹 I (글로벌/편집/제어/보조) 는 컴포넌트가 아니므로 별도 진행
