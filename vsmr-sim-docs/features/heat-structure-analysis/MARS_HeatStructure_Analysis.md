# MARS Heat Structure 입력 분석 및 Web GUI 개발 계획

## 1. SMART 파일 Heat Structure 컴포넌트 현황

### 1.1 Heat Structure 목록 (총 29개)

| 번호 | 컴포넌트명 | nh | np | Geometry | 특징 |
|------|-----------|----|----|----------|------|
| 1100-0 | RV Bottom Shell | 2 | 6 | Rectangular(1) | 다층 재료 |
| 1100-1 | Flow Skirt | 1 | 3 | Cylindrical(2) | 단순 구조 |
| 1110-0 | Lower Core Support Plate | 1 | 3 | Rectangular(1) | 단순 구조 |
| **1120-0** | **Averaged Fuel Assemblies** | **10** | **8** | **Cylindrical(2)** | **연료봉, Gap모델, Reflood** |
| 1120-2 | Guide Tubes | 13 | 3 | Cylindrical(2) | 다축 노드 |
| 1170-0 | Core Shroud | 12 | 3 | Rectangular(1) | 다축 노드 |
| 1170-1 | Core Shroud (Cyl) | 7 | 3 | Cylindrical(2) | - |
| 1150-0 | Upper Plenum Structure | 1 | 3 | Rectangular(1) | 단순 구조 |
| 1160-0 | Upper Annulus | 6 | 3 | Cylindrical(2) | - |
| 1160-1 | Upper Structure | 6 | 3 | Rectangular(1) | - |
| 1160-2 | Upper Plate 1 | 1 | 3 | Rectangular(1) | 단순 구조 |
| 1160-3 | Upper Plate 2 | 1 | 3 | Rectangular(1) | 단순 구조 |
| 1180-0 | Core Support Barrel (CSB) | 14 | 3 | Cylindrical(2) | 다축 노드 |
| 1180-1 | CSB Section | 1 | 3 | Cylindrical(2) | 단순 구조 |
| 1180-5 | CSB Upper Conical | 1 | 3 | Cylindrical(2) | 단순 구조 |
| 1182-1~4 | CSB Upper Cylindrical | 1 | 3 | Cylindrical(2) | 각 4개 |
| 1182-5~8 | CSB Structure | 1 | 3 | Rectangular(1) | 각 4개 |
| 1181-0 | CSB Plate | 4 | 3 | Rectangular(1) | - |
| 1190-0 | Reactor Vessel (Side) | 12 | 6 | Cylindrical(2) | 다층 재료 |
| 1190-1~4 | RV Side (RCP Discharge) | 3 | 6 | Cylindrical(2) | 다층 재료, 각 4개 |

### 1.2 사용된 카드 타입 통계

| 카드 타입 | 용도 | 사용 횟수 | 필수 여부 |
|-----------|------|----------|----------|
| 1CCCG000 | 기본 정의 | 29 | **필수** |
| 1CCCG001 | Gap 데이터 | 1 | 선택 (연료봉) |
| 1CCCG003 | 금속-물 반응 | 1 | 선택 (연료봉) |
| 1CCCG004 | 피복관 변형 | 1 | 선택 (연료봉) |
| 1CCCG011-099 | Gap 변형 데이터 | 6 | 선택 (연료봉) |
| 1CCCG100 | 메쉬 플래그 | 29 | **필수** |
| 1CCCG101-199 | 메쉬 정의 | 37 | **필수** |
| 1CCCG201-299 | 재료 구성 | 37 | **필수** |
| 1CCCG301-399 | 열원 분포 | 30 | **필수** |
| 1CCCG401-499 | 초기 온도 | 30 | **필수** |
| 1CCCG501-599 | 좌측 경계조건 | 113 | **필수** |
| 1CCCG601-699 | 우측 경계조건 | 113 | **필수** |
| 1CCCG701-799 | 열원 데이터 | 38 | **필수** |
| 1CCCG800 | 추가 좌측 경계 옵션 | 29 | 선택 |
| 1CCCG801-899 | 추가 좌측 경계 데이터 | 29 | 선택 |
| 1CCCG900 | 추가 우측 경계 옵션 | 29 | 선택 |
| 1CCCG901-999 | 추가 우측 경계 데이터 | 38 | 선택 |

---

## 2. 사용된 파라미터 상세 분석

### 2.1 기본 정의 카드 (1CCCG000) - 8 Words

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | nh (축방향 노드 수) | 1~14 | 필수 |
| W2 | np (반경방향 메쉬 수) | 3, 6, 8 | 필수 |
| W3 | Geometry Type | **1** (Rectangular), **2** (Cylindrical) | 필수, 구형(3) 미사용 |
| W4 | SS Init Flag | **1** (계산) | 정상상태 초기화 |
| W5 | Left Boundary Coord | 0.0 ~ 2.672 m | 좌측 경계 좌표 |
| W6 | Reflood Flag | **0** (미사용), **599** (Trip 번호) | 연료봉에서만 599 사용 |
| W7 | BVI (연료봉) | **1** | 연료봉에서만 사용 |
| W8 | MAI (연료봉) | **16** | 연료봉에서만 사용 |

### 2.2 Gap 데이터 카드 (1CCCG001) - 연료봉 전용

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Gap Pressure | 5.691173e6 Pa | 갭 내 압력 |
| W2 | Reference Volume | 120010000 | 참조 유체 볼륨 번호 |

### 2.3 금속-물 반응 카드 (1CCCG003) - 연료봉 전용

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Oxide Thickness | 6.70052e-6 m | 초기 산화층 두께 |

### 2.4 피복관 변형 모델 카드 (1CCCG004) - 연료봉 전용

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | FCFL Flag | 1 | 변형 모델 활성화 |

### 2.5 Gap 변형 데이터 (1CCCG011-099) - 연료봉 전용

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | FSR | 0.0 | Fuel Surface Roughness |
| W2 | CSR | 1.8859e-6 ~ 3.0722e-6 | Clad Surface Roughness |
| W3 | Swelling | 3.8527e-5 | 연료 팽윤 |
| W4 | Creepdown | 0.0 | 피복관 Creep |
| W5 | Node Number | 1~10 | 축방향 노드 번호 |

### 2.6 메쉬 플래그 카드 (1CCCG100)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Mesh Flag | **0** | Format 1 사용 |
| W2 | Format | **1** | 간격+반경 포맷 |

### 2.7 메쉬 정의 (1CCCG101-199)

| Word | 파라미터 | 사용값 범위 | 설명 |
|------|----------|------------|------|
| W1 | Intervals | 1~4 | 메쉬 간격 수 |
| W2 | Radius | 0.3 ~ 3.0543 m | 메쉬 경계 반경 |

### 2.8 재료 구성 (1CCCG201-299)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Material Number | **1, 2, 3, 4, 7** (양수), **-5, -6** (음수=Gap) | 재료 번호 |
| W2 | Interval | 1~7 | 적용 메쉬 간격 |

**사용된 재료:**
- 1: MDF A508 C3 (RV Base Metal)
- 2: Austenite SS (RV Cladding)
- 3: 304 SS (Internal Structure) - **가장 많이 사용**
- 4: UO2 (Fuel Pellet)
- -5: Fuel Gap (음수 = Gap Conductance 모델)
- -6: Zircaloy (Cladding, Gap 모델 연동)
- 7: 321 SS (MCP)

### 2.9 열원 분포 (1CCCG301-399)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | RPKF (Radial Peaking Factor) | **0.0** (발열 없음), **1.0** (발열) | 반경방향 출력 분포 |
| W2 | Interval | 1~7 | 적용 메쉬 간격 |

### 2.10 초기 온도 (1CCCG401-499)

| Word | 파라미터 | 사용값 범위 | 설명 |
|------|----------|------------|------|
| W1 | Temperature | 565.5 ~ 901.56 K | 초기 온도 |
| W2 | Mesh Point | 1~8 | 메쉬 포인트 번호 |

### 2.11 경계조건 (1CCCG501-599, 1CCCG601-699)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Boundary Volume | CCCNN0000 형식, 또는 **0** | 경계 유체 볼륨 |
| W2 | Increment | **0** | 볼륨 번호 증분 (미사용) |
| W3 | BC Type | **0** (단열), **101** (대류) | 경계조건 타입 |
| W4 | Surface Area Code | **0** (직접 면적), **1** (형상 계수) | 면적 코드 |
| W5 | Surface Area/Factor | 0.12 ~ 42.5 m² | 표면적 또는 높이 |
| W6 | HS Number | 1~14 | Heat Structure 번호 |

**경계조건 타입 사용 현황:**
- **0 (Symmetry/Insulated)**: 좌측 10회, 우측 41회
- **101 (Convective)**: 좌측 103회, 우측 72회

### 2.12 열원 데이터 (1CCCG701-799)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Source Type | **0** (없음), **10261~10270** (Control Variable) | 열원 타입 |
| W2 | Multiplier | 0.0, 0.977 | 축방향 피킹 팩터 |
| W3 | DMHL | 0.0, 0.023 | 좌측 직접 감속재 가열 |
| W4 | DMHR | 0.0, 0.023 | 우측 직접 감속재 가열 |
| W5 | HS Number | 1~14 | Heat Structure 번호 |

### 2.13 추가 경계 옵션 (1CCCG800, 1CCCG900)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | Format Option | **0** (9-word), **1** (12-word) | 포맷 선택 |

### 2.14 추가 경계 데이터 - 9-Word Format (기본)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1 | HTHD | 0.0 | Heat Transfer Hydraulic Diameter |
| W2 | HLF | 10.0, 12.19 | Heated Length Forward |
| W3 | HLR | 10.0, 12.19 | Heated Length Reverse |
| W4 | GSLF | 0.0 | Grid Spacer Length Forward |
| W5 | GSLR | 0.0 | Grid Spacer Length Reverse |
| W6 | GLCF | 0.0 | Grid Loss Coefficient Forward |
| W7 | GLCR | 0.0 | Grid Loss Coefficient Reverse |
| W8 | LBF | 1.0 | Local Boiling Factor |
| W9 | HS Number | 1~14 | Heat Structure 번호 |

### 2.15 추가 경계 데이터 - 12-Word Format (연료봉 우측)

| Word | 파라미터 | 사용값 | 설명 |
|------|----------|--------|------|
| W1~W8 | (9-Word와 동일) | - | - |
| W9 | NCL | 2.66 | Natural Circulation Length |
| W10 | TPDR | 1.3247 | Tube Pitch to Diameter Ratio |
| W11 | Fouling | 1.0 | Fouling Factor |
| W12 | HS Number | 1~10 | Heat Structure 번호 |

---

## 3. Thermal Property 데이터 (201MMNN0)

### 3.1 사용된 재료 속성 테이블

| 재료번호 | 재료명 | 타입 | 데이터 형식 |
|----------|--------|------|-------------|
| 1 | MDF A508 C3 (RV Base) | tbl/fctn | 온도 테이블 |
| 2 | Austenite SS (RV Clad) | tbl/fctn | 온도 테이블 |
| 3 | 304 SS (Internal) | tbl/fctn | 온도 테이블 |
| 4 | UO2 (Fuel) | tbl/fctn | 온도 테이블 |
| 5 | Fuel Gap | tbl/fctn (type=3) | 가스 조성 + 열용량 |
| 6 | Zircaloy (Clad) | tbl/fctn | 온도 테이블 |
| 7 | 321 SS (MCP) | tbl/fctn | 온도 테이블 |
| 8 | Inconel 690 (SG) | tbl/fctn | 상수값 |
| 9 | Wet Insulator (PZR) | tbl/fctn | 온도 테이블 |

### 3.2 재료 속성 데이터 구조

**일반 재료 (Type 1):**
- 열전도도 vs 온도 테이블 (20100M01~)
- 체적 열용량 vs 온도 테이블 (20100M51~)

**Gap 재료 (Type 3):**
- 가스 조성 (helium, nitrogen, xenon, krypton, argon)
- 체적 열용량 vs 온도 테이블

---

## 4. GUI 개발 항목 정리

### 4.1 Heat Structure 입력 화면

#### 4.1.1 기본 정보 탭 (필수)

| 입력 항목 | 데이터 타입 | 범위/옵션 | 비고 |
|-----------|-------------|-----------|------|
| HS 번호 (CCC) | Integer | 100-999 | 자동 생성 또는 수동 |
| Geometry 번호 (G) | Integer | 0-9 | 같은 볼륨 내 구분용 |
| 이름/설명 | Text | - | 코멘트용 |
| 축방향 노드 수 (nh) | Integer | 1-99 | 동적 행 생성에 사용 |
| 반경방향 메쉬 수 (np) | Integer | 2-99 | 동적 열 생성에 사용 |
| Geometry Type | Select | 1=Rectangular, 2=Cylindrical | **구형(3) 미포함** |
| SS Init Flag | Select | 0=입력값, 1=계산 | 정상상태 초기화 |
| Left Boundary Coord | Float | ≥0.0 (m) | 좌측 경계 좌표 |

#### 4.1.2 연료봉 전용 옵션 탭 (선택)

| 입력 항목 | 데이터 타입 | 범위/옵션 | 비고 |
|-----------|-------------|-----------|------|
| Reflood Flag | Integer | 0 또는 Trip번호 | 0=미사용 |
| BVI | Integer | 1-99 | Reflood시 필수 |
| MAI | Integer | - | Reflood시 필수 |
| Gap Pressure | Float | Pa | 001 카드 |
| Reference Volume | Volume ID | CCCNN000 형식 | 001 카드 |
| Oxide Thickness | Float | m | 003 카드 |
| FCFL Flag | Select | 0=미사용, 1=사용 | 004 카드 |

#### 4.1.3 Gap 변형 데이터 테이블 (연료봉, 011-099)

| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| Node Number | Integer | 1~nh |
| FSR | Float | Fuel Surface Roughness |
| CSR | Float | Clad Surface Roughness |
| Swelling | Float | 연료 팽윤 |
| Creepdown | Float | 피복관 Creep |

#### 4.1.4 메쉬 정의 탭 (필수)

**메쉬 플래그:**
| 입력 항목 | 사용값 | 비고 |
|-----------|--------|------|
| Mesh Flag | 0 (고정) | Format 1 고정 |
| Format | 1 (고정) | 간격+반경 포맷 |

**메쉬 간격 테이블:**
| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| Interval Number | Integer | 자동 증가 |
| Number of Intervals | Integer | 메쉬 간격 수 |
| Radius (m) | Float | 메쉬 경계 반경 |

#### 4.1.5 재료 구성 탭 (필수)

| 컬럼 | 데이터 타입 | 옵션 | 비고 |
|------|-------------|------|------|
| Material Number | Select/Integer | 1-9 또는 음수(-5,-6) | 드롭다운 + 직접입력 |
| Interval | Integer | 1~(np-1) | 적용 구간 |

#### 4.1.6 열원 분포 탭 (필수)

| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| RPKF | Float | 0.0=발열없음, 1.0=발열 |
| Interval | Integer | 적용 구간 |

#### 4.1.7 초기 온도 탭 (필수)

| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| Temperature (K) | Float | 초기 온도 |
| Mesh Point | Integer | 1~np |

#### 4.1.8 좌측 경계조건 탭 (필수)

| 입력 항목 | 데이터 타입 | 옵션/범위 | 비고 |
|-----------|-------------|-----------|------|
| Boundary Volume | Volume ID | CCCNN000 형식 또는 0 | 볼륨 선택기 |
| Increment | Integer | 0 (고정) | SMART에서 미사용 |
| BC Type | Select | **0=Insulated, 101=Convective** | 2가지만 사용 |
| Surface Area Code | Select | 0=면적, 1=형상계수 | - |
| Surface Area/Factor | Float | m² 또는 m | - |
| HS Number | Integer | 1~nh | 자동 증가 |

#### 4.1.9 우측 경계조건 탭 (필수)

(좌측 경계조건과 동일 구조)

#### 4.1.10 열원 데이터 탭 (필수)

| 입력 항목 | 데이터 타입 | 옵션/범위 | 비고 |
|-----------|-------------|-----------|------|
| Source Type | Select/Integer | 0=없음, 1000=Point Kinetics, 10001~=Control Var | - |
| Multiplier | Float | 축방향 피킹 팩터 |
| DMHL | Float | 좌측 직접 감속재 가열 |
| DMHR | Float | 우측 직접 감속재 가열 |
| HS Number | Integer | 1~nh |

#### 4.1.11 추가 좌측 경계 탭 (선택)

**옵션 선택:**
| 입력 항목 | 사용값 | 비고 |
|-----------|--------|------|
| Format Option | 0 (9-word) | SMART 기본값 |

**9-Word 데이터:**
| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| HTHD | Float | Heat Transfer Hydraulic Diameter |
| HLF | Float | Heated Length Forward |
| HLR | Float | Heated Length Reverse |
| GSLF | Float | Grid Spacer Length Forward |
| GSLR | Float | Grid Spacer Length Reverse |
| GLCF | Float | Grid Loss Coeff Forward |
| GLCR | Float | Grid Loss Coeff Reverse |
| LBF | Float | Local Boiling Factor |
| HS Number | Integer | 1~nh |

#### 4.1.12 추가 우측 경계 탭 (선택)

**옵션 선택:**
| 입력 항목 | 사용값 | 비고 |
|-----------|--------|------|
| Format Option | 0 (9-word), 1 (12-word) | 연료봉은 12-word |

**12-Word 추가 컬럼 (연료봉):**
| 컬럼 | 데이터 타입 | 비고 |
|------|-------------|------|
| NCL | Float | Natural Circulation Length |
| TPDR | Float | Pitch to Diameter Ratio |
| Fouling | Float | Fouling Factor |

---

### 4.2 Thermal Property 입력 화면

#### 4.2.1 재료 기본 정보

| 입력 항목 | 데이터 타입 | 옵션 | 비고 |
|-----------|-------------|------|------|
| Material Number | Integer | 1-99 | 재료 번호 |
| Material Name | Text | - | 설명용 |
| Type | Select | 1=일반, 3=Gap | tbl/fctn |

#### 4.2.2 일반 재료 (Type 1) 속성 테이블

**열전도도 테이블:**
| 컬럼 | 데이터 타입 | 단위 |
|------|-------------|------|
| Temperature | Float | K |
| Thermal Conductivity | Float | W/m·K |

**체적 열용량 테이블:**
| 컬럼 | 데이터 타입 | 단위 |
|------|-------------|------|
| Temperature | Float | K |
| Volumetric Heat Capacity | Float | J/m³·K |

#### 4.2.3 Gap 재료 (Type 3) 속성

**가스 조성 테이블:**
| 컬럼 | 데이터 타입 | 옵션 |
|------|-------------|------|
| Gas Type | Select | helium, nitrogen, xenon, krypton, argon |
| Mole Fraction | Float | 0.0~1.0 |

**체적 열용량 테이블:**
(일반 재료와 동일)

---

### 4.3 개발 우선순위

#### Phase 1: 필수 기능 (일반 구조물)
1. 기본 정의 (1CCCG000) - W1~W6
2. 메쉬 정의 (1CCCG100, 101-199)
3. 재료 구성 (1CCCG201-299)
4. 열원 분포 (1CCCG301-399)
5. 초기 온도 (1CCCG401-499)
6. 좌/우측 경계조건 (1CCCG501-599, 601-699)
7. 열원 데이터 (1CCCG701-799)
8. 추가 경계 옵션 - 9-word (1CCCG800-899, 900-999)

#### Phase 2: 연료봉 전용 기능
1. 기본 정의 확장 (Reflood, BVI, MAI)
2. Gap 데이터 (1CCCG001)
3. 금속-물 반응 (1CCCG003)
4. 피복관 변형 (1CCCG004)
5. Gap 변형 데이터 (1CCCG011-099)
6. 추가 경계 옵션 - 12-word

#### Phase 3: Thermal Property
1. 일반 재료 속성 테이블
2. Gap 재료 속성 (가스 조성)

---

### 4.4 GUI 구현 시 고려사항

1. **동적 테이블 생성**: nh, np 값에 따라 경계조건/온도 테이블 행/열 수 자동 조절

2. **데이터 검증**:
   - 메쉬 간격 합 = np-1
   - 재료 구성 구간 = np-1
   - 경계조건 행 수 = nh

3. **참조 데이터 연동**:
   - Boundary Volume → Hydrodynamic 컴포넌트 목록
   - Material Number → Thermal Property 테이블
   - Source Type (Control Variable) → Control Variable 목록

4. **조건부 UI 표시**:
   - Geometry=2 (Cylindrical) 선택 시 연료봉 옵션 활성화
   - Reflood>0 시 BVI, MAI 필수
   - 900 카드 W1=1 시 12-word 포맷 표시

5. **기본값 설정**:
   - Increment = 0
   - Mesh Flag = 0
   - Format = 1
   - GSLF, GSLR, GLCF, GLCR = 0.0
   - LBF = 1.0
