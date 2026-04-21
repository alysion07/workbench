---
title: "FEAT-separator: SEPARATR (기액 분리기) 컴포넌트"
status: done
phase: 1
branch: main
last_updated: 2026-04-03
---

# FEAT-separator: SEPARATR (기액 분리기) 컴포넌트

> **Status**: ⏳ 요구사항 명세 완료
> **Branch**: (미정)
> **매뉴얼 섹션**: 8.11 (문서 p.125~135, PDF p.143~153)
> **Created**: 2026-03-13

---

## 1. 개요

SEPARATR는 증기 분리기(Steam Separator) 컴포넌트로, MARS-KS에서 **특수화된 Branch**이다.
- 볼륨 1개 + **정확히 3개의 Junction** (고정)
- N=1: 증기 출구 (Vapor Outlet)
- N=2: 액체 되돌림 (Liquid Fall Back)
- N=3: 분리기 입구 (Separator Inlet)
- 연결 코드: 볼륨 `CCC010000`, 접합부 `CCCJJ0000` (JJ = 01~03)

### 1.1 Branch와의 차이점

| 항목 | Branch | Separator |
|------|--------|-----------|
| Junction 수 | 2~9 (가변) | **3 (고정)** |
| Junction 역할 | 자유 지정 | 고정 (vapor/liquid/inlet) |
| Volume Control Flag | `tlpvbfe` (7자리) | **`000001e`** (e만 가변) |
| Junction Control Flag | `0efvcahs` (8자리) | **`0000cahs`** (4자리만 가변) |
| Separator 옵션 | 없음 | ISEPST (0~3), GE 분리기 데이터 |
| Void Fraction Limit | 없음 | W7: VOVER(N=1), VUNDER(N=2) |
| Dryer 데이터 | 없음 | CCC0600 (GE Dryer) |

---

## 2. 카드 체계 (입력 구조)

### 2.1 필수 카드

| 카드 | 이름 | 설명 |
|------|------|------|
| **CCC0001** | Component Information | nj=3 (고정), initialConditionControl |
| **CCC0101-0109** | Volume Data | area, length, volume, angles, roughness, hydraulicDiameter, volumeControlFlags |
| **CCC0200** | Volume Initial Conditions | ebt 제어워드 + 열역학 상태값 (Branch와 동일) |
| **CCCN101-N109** (N=1,2,3) | Junction Geometry | from, to, area, fwdLoss, revLoss, junctionControlFlags, **voidFractionLimit(W7)** |
| **CCCN201** (N=1,2,3) | Junction Initial Conditions | liquidFlow, vaporFlow, interfaceVelocity(=0) |

### 2.2 선택 카드

| 카드 | 이름 | 조건 | 설명 |
|------|------|------|------|
| **CCC0002** | Separator Options | 항상 (기본 ISEPST=0) | ISEPST(0~3), 분리기 수 |
| **CCC0131** | Additional Wall Friction | 선택 | Shape Factor / Viscosity Ratio (x/y/z 좌표별) |
| **CCCN112** (N=1,2,3) | Junction Form Loss Data | 선택 | B_F, C_F, B_R, C_R, KFJUNCV, KRJUNCV |
| **CCC0500** | GE Separator Data | ISEPST=1,2,3 | 8개 값 (기본값 있음) |
| **CCC0501** | GE First Stage Data | ISEPST=1,2,3 | 9개 값 (기본값 있음) |
| **CCC0502** | GE Second Stage Data | ISEPST=2,3 | 9개 값 (기본값 있음) |
| **CCC0503** | GE Third Stage Data | ISEPST=3 | 9개 값 (기본값 있음) |
| **CCC0600** | GE Dryer Data | ISEPST=1,2,3 | 3개 값 (기본값 있음) |

---

## 3. 기능 요구사항

### FR-01: 타입 정의 (`mars.ts`)

#### FR-01-1: SeparatorOption 타입
```
ISEPST:
  0 = Simple separator (RELAP5 기본, GE 데이터 불필요)
  1 = GE dryer model
  2 = GE two-stage separator
  3 = GE three-stage separator
```

#### FR-01-2: SeparatorJunction 인터페이스
- **BranchJunction을 확장** (기존 패턴 재사용)
- 추가 필드:
  - `voidFractionLimit?: number` — W7 (Junction Geometry 카드)
    - N=1 (Vapor Outlet): VOVER, 기본값 0.5
    - N=2 (Liquid Fall Back): VUNDER, 기본값 0.15
    - N=3 (Inlet): 사용 안 함
- Junction 역할은 `junctionNumber`로 결정 (1=vapor, 2=liquid, 3=inlet)
- `jefvcahs` 제한: `0000cahs` 포맷 (앞 4자리 항상 0)

#### FR-01-3: GESeparatorData 인터페이스 (CCC0500)
```typescript
interface GESeparatorData {
  pickoffRingRadius: number;        // W1: 대형 pickoff ring 반경 (m)
  standpipeFlowArea: number;        // W2: standpipe 유동면적 (m²)
  nozzleExitArea: number;           // W3: nozzle exit 면적 (m²)
  hubRadius: number;                // W4: hub 반경 (m)
  swirlVaneAngle: number;           // W5: swirl vane 각도 (deg)
  liquidCarryoverCoeff: number;     // W6: liquid carryover 계수
  vaporCarryunderCoeff: number;     // W7: vapor carryunder 계수
  axialDistance: number;            // W8: 1단 출구~swirl vane 축거리 (m)
}
```

#### FR-01-4: GEStageData 인터페이스 (CCC0501/0502/0503)
```typescript
interface GEStageData {
  liquidFilmVoidCoeff: number;      // W1: liquid film void profile 계수
  vaporCoreVoidCoeff: number;       // W2: vapor core void profile 계수
  wallInnerRadius: number;          // W3: separator wall inner radius (m)
  pickoffRingInnerRadius: number;   // W4: pickoff ring inner radius (m)
  dischargePassageArea: number;     // W5: discharge passage 유동면적 (m²)
  dischargeHydDiameter: number;     // W6: discharge passage 수력직경 (m)
  separatingBarrelLength: number;   // W7: separating barrel 길이 (m)
  dischargePassageLossCoeff: number;// W8: discharge passage 손실계수
  dischargeLDCoeff: number;         // W9: discharge passage L/D 계수
}
```
- 1단/2단/3단별 기본값이 다름 (매뉴얼 참조)

#### FR-01-5: GEDryerData 인터페이스 (CCC0600)
```typescript
interface GEDryerData {
  vaporVelocityLower: number;       // W1: 0% carryover 속도 (m/s), 기본 1.5
  vaporVelocityUpper: number;       // W2: 100% carryover 속도 (m/s), 기본 6.0
  qualityRange: number;             // W3: carryover 변화 quality 범위, 기본 0.05
}
```

#### FR-01-6: SeparatorParameters 인터페이스
```typescript
interface SeparatorParameters {
  name: string;

  // Card CCC0001 - Component Info
  // njuns는 항상 3 (UI에서 고정, 사용자 변경 불가)
  initialConditionControl?: 0 | 1;

  // Card CCC0002 - Separator Options
  separatorOption: 0 | 1 | 2 | 3;     // ISEPST
  numSeparatorComponents?: number;     // ISEPST=2,3일 때만 필요

  // Card CCC0101 - Volume Geometry
  area?: number;
  length: number;
  volume: number;
  azAngle?: number;
  incAngle: number;
  dz: number;

  // Card CCC0101 continued - Wall
  wallRoughness?: number;
  hydraulicDiameter: number;
  volumeControlFlags?: string;         // "000001e" 형식 (e만 가변, 기본 "0")

  // Card CCC0131 - Additional Wall Friction (선택)
  additionalWallFriction?: {
    xShapeFactor?: number;             // 기본 1.0
    xViscosityRatioExp?: number;       // 기본 0.0
    yShapeFactor?: number;
    yViscosityRatioExp?: number;
    zShapeFactor?: number;
    zViscosityRatioExp?: number;
  };

  // Card CCC0200 - Volume Initial Conditions (Branch와 동일)
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;
  temperature?: number;
  quality?: number;

  // Card CCCN101-N109, CCCN201 - 3개 Junction (고정)
  junctions: [SeparatorJunction, SeparatorJunction, SeparatorJunction];
  // [0]=N=1(vapor), [1]=N=2(liquid), [2]=N=3(inlet)

  // GE Separator Data (ISEPST > 0일 때)
  geSeparatorData?: GESeparatorData;   // CCC0500
  geFirstStageData?: GEStageData;      // CCC0501
  geSecondStageData?: GEStageData;     // CCC0502 (ISEPST=2,3)
  geThirdStageData?: GEStageData;      // CCC0503 (ISEPST=3)
  geDryerData?: GEDryerData;           // CCC0600
}
```

#### FR-01-7: ComponentParameters 유니온에 `SeparatorParameters` 추가

#### FR-01-8: Type Guard 함수
```typescript
function isSeparatorParameters(params): params is SeparatorParameters {
  return 'separatorOption' in params && 'junctions' in params
    && Array.isArray(params.junctions) && params.junctions.length === 3;
}
```

---

### FR-02: 노드 컴포넌트 (`SeparatorNode.tsx`)

- **분류**: Complex Node (Branch/Turbine과 유사)
- **렌더링**: 3개의 고정 핸들 (vapor out, liquid fall back, inlet)
- 핸들 배치:
  - **Inlet (N=3)**: 하단 (separator에 유체가 들어옴)
  - **Vapor Outlet (N=1)**: 상단 (증기 출구)
  - **Liquid Fall Back (N=2)**: 측면 또는 하단-좌 (액체 되돌림)
- `formatDisplayId`: 기존 패턴 (`C` + 3자리)
- `NodeResizer` 지원 (배경색 변경 가능)

---

### FR-03: 폼 컴포넌트 (`SeparatorForm.tsx`)

#### 탭 구조

| 탭 | 내용 | 카드 |
|----|------|------|
| **Basic** | Name, Component ID, Separator Option(ISEPST) | CCC0001, CCC0002 |
| **Volume** | Area, Length, Volume, Angles, Wall, Hydraulic Diameter, Volume Control Flags | CCC0101 |
| **Initial Conditions** | ebt 제어워드 + 열역학 상태값 | CCC0200 |
| **Junctions** | 3개 Junction (Vapor Out / Liquid Fall Back / Inlet) — 각각 From/To, Area, Loss, Flags, Void Fraction Limit | CCCN101, CCCN201 |
| **GE Data** | GE Separator/Stage/Dryer 데이터 (ISEPST>0일 때만 표시) | CCC0500~0600 |
| **Wall Friction** | Additional Wall Friction (선택) | CCC0131 |

#### FR-03-1: Junction 편집 UI
- 3개 Junction은 **고정** (추가/삭제 불가)
- 각 Junction의 역할 라벨 표시: "N=1: Vapor Outlet", "N=2: Liquid Fall Back", "N=3: Inlet"
- `from`/`to`는 VolumeReference 드롭다운 (기존 Branch 패턴)
- **연결 규칙 안내**:
  - N=1 (Vapor Out): `from`은 반드시 separator outlet face (`CCC010002`)
  - N=2 (Liquid Fall Back): `from`은 반드시 separator inlet face (`CCC010001`)
  - N=3 (Inlet): 자유 지정
- `voidFractionLimit` (W7):
  - N=1: VOVER, 기본 0.5 (증기 순도 한계)
  - N=2: VUNDER, 기본 0.15 (액체 순도 한계)
  - N=3: 입력 불필요 (disabled)

#### FR-03-2: GE Data 조건부 표시
- `separatorOption === 0`: GE Data 탭 숨김 또는 "Simple Separator 선택됨 — GE 데이터 불필요" 메시지
- `separatorOption === 1`: CCC0500 + CCC0501 + CCC0600
- `separatorOption === 2`: CCC0500 + CCC0501 + CCC0502 + CCC0600
- `separatorOption === 3`: CCC0500 + CCC0501 + CCC0502 + CCC0503 + CCC0600
- 각 스테이지 데이터는 기본값 표시 (placeholder에 default 값 안내)

---

### FR-04: 파일 생성기 (`fileGenerator.ts`)

#### 생성 카드 목록

```
* SEPARATR 컴포넌트 CCC
CCC0000  CCC  SEPARATR
CCC0001  3  [initialConditionControl]
CCC0002  [ISEPST]  [numSeparatorComponents]        (선택)
CCC0101  [area] [length] [volume] [azAngle] [incAngle] [dz] [roughness] [hydDiam] [volFlags]
CCC0131  [shapeFactor_x] [viscRatio_x] ...          (선택)
CCC0200  [ebt] [thermodynamic state values...]
CCC1101  [from] [to] [area] [fwdLoss] [revLoss] [juncFlags] [VOVER]
CCC2101  [from] [to] [area] [fwdLoss] [revLoss] [juncFlags] [VUNDER]
CCC3101  [from] [to] [area] [fwdLoss] [revLoss] [juncFlags]
CCC1112  [B_F] [C_F] [B_R] [C_R] [KFJUNCV] [KRJUNCV]  (선택)
CCC2112  ...                                              (선택)
CCC3112  ...                                              (선택)
CCC1201  [liqFlow] [vapFlow] [0]
CCC2201  [liqFlow] [vapFlow] [0]
CCC3201  [liqFlow] [vapFlow] [0]
CCC0500  [8 values]                                       (ISEPST>0)
CCC0501  [9 values]                                       (ISEPST>0)
CCC0502  [9 values]                                       (ISEPST>=2)
CCC0503  [9 values]                                       (ISEPST=3)
CCC0600  [3 values]                                       (ISEPST>0)
```

---

### FR-05: 검증 로직 (`componentValidation.ts`)

| 규칙 | 수준 | 설명 |
|------|------|------|
| Junction 수 = 3 | error | 항상 3이어야 함 |
| ISEPST 범위 | error | 0~3 |
| N=1 from = CCC010002 | error | Vapor outlet from은 separator outlet face |
| N=2 from = CCC010001 | error | Liquid fall back from은 separator inlet face |
| Volume = Area × Length | warning | 정합성 체크 (기존 Branch 로직 재사용) |
| \|dz\| ≤ length | error | elevation change 범위 |
| \|incAngle\| ≤ 90 | error | inclination angle 범위 |
| \|azAngle\| < 360 | error | azimuthal angle 범위 |
| volumeControlFlags 형식 | error | `000001[0-1]` 패턴만 허용 |
| junctionControlFlags 형식 | error | `0000[0-1][0-2][0-1][0-3]` 패턴만 허용 |
| VOVER (N=1) | warning | 0~1 범위, 미입력 시 기본 0.5 |
| VUNDER (N=2) | warning | 0~1 범위, 미입력 시 기본 0.15 |
| Choking off 권장 | warning | 매뉴얼 권장: 3개 Junction 모두 choking 끄기 |
| Nonhomogeneous 권장 | warning | N=1, N=2는 nonhomogeneous 사용 권장 |
| GE 데이터 필수성 | error | ISEPST>0인데 GE 데이터 없으면 오류 |
| GE Stage 필수성 | error | ISEPST=2인데 2nd stage 없으면 오류, ISEPST=3인데 3rd stage 없으면 오류 |

---

### FR-06: Store 연동 (`useStore.ts`)

- 팔레트에 SEPARATR 추가 (카테고리: VOLUME 또는 SPECIALIZED)
- 기본값 프리셋:
  - `separatorOption: 0` (Simple)
  - `njuns: 3` (고정, 파라미터에 노출하지 않음)
  - 3개 Junction 초기 구조 자동 생성
  - VOVER 기본 0.5, VUNDER 기본 0.15
- Edge 연결 시 VolumeReference 동기화 (기존 Branch 패턴)

### FR-07: 노드 외형 (`nodeAppearance.ts`)

- 기본 shape: `rectangle` 또는 전용 도형 (추후 결정)
- 기본 색상: 기존 Branch와 구별되는 색상
- `formatDisplayId`: `C` + 앞 3자리 (예: `C810`)

---

## 3-A. VolumeReference 연결 및 동기화 설계

> 기존 BranchForm.tsx / edgeSyncUtils.ts / nodeIdResolver.ts 패턴을 그대로 따른다.

### FR-A1: VolumeReference 기반 From/To 연결

SEPARATR의 각 Junction은 `from: VolumeReference | null`, `to: VolumeReference | null` 필드를 갖는다.
이는 기존 `BranchJunction` 패턴과 **완전히 동일**하다.

```typescript
// SeparatorJunction의 from/to 필드 (BranchJunction 확장)
interface SeparatorJunction extends BranchJunction {
  voidFractionLimit?: number;  // W7: VOVER(N=1) / VUNDER(N=2) / 미사용(N=3)
}
// BranchJunction.from, BranchJunction.to는 이미 VolumeReference | null
```

#### SEPARATR 볼륨/면 범위

| 컴포넌트 | volumeNum | face | 비고 |
|----------|-----------|------|------|
| SEPARATR (자기 자신) | 1 | 1 (inlet), 2 (outlet) | 단일 볼륨, Branch와 동일 |

#### Junction별 고정 연결 규칙 (MARS 매뉴얼 8.11)

| Junction | from (유체 출발지) | to (유체 도착지) | 비고 |
|----------|-------------------|-----------------|------|
| **N=1** (Vapor Outlet) | **자기 자신 face 2** (outlet) `{nodeId: self, volumeNum: 1, face: 2}` | 외부 볼륨 (사용자 지정) | from은 자동 잠금 |
| **N=2** (Liquid Fall Back) | **자기 자신 face 1** (inlet) `{nodeId: self, volumeNum: 1, face: 1}` | 외부 볼륨 (사용자 지정) | from은 자동 잠금 |
| **N=3** (Separator Inlet) | 외부 볼륨 (사용자 지정) | 외부 볼륨 (사용자 지정) | 양쪽 모두 사용자 지정 |

### FR-A2: availableVolumes 목록 생성 (Autocomplete 드롭다운)

BranchForm의 기존 패턴을 그대로 재사용한다:

```typescript
// 1. NodeIdResolver 인스턴스 생성 (nodes digest 기반 메모이제이션)
const resolver = useMemo(() => new NodeIdResolver(nodes), [nodesDigest]);

// 2. availableVolumes 빌드 (기존 BranchForm 패턴 100% 동일)
const availableVolumes = useMemo(() => {
  const options: VolumeOption[] = [];

  // 자기 자신의 face 1/2 추가
  for (let face = 1; face <= 2; face++) {
    options.push({
      ref: { nodeId, volumeNum: 1, face },
      volumeId: resolver.getVolumeIdFromReference({ nodeId, volumeNum: 1, face }),
      label: `${selfName} - ${face === 1 ? 'Inlet' : 'Outlet'}`,
    });
  }

  // 다른 모든 Volume 컴포넌트 (snglvol, tmdpvol, branch, pipe 등)
  nodes.forEach(node => { /* BranchForm과 동일한 로직 */ });

  return options.sort((a, b) => a.volumeId.localeCompare(b.volumeId));
}, [nodesDigest, ...]);
```

**Autocomplete UI 구성** (BranchForm 패턴):
- `getOptionLabel`: `option.volumeId` (9자리 CCCVV000N)
- `renderOption`: volumeId + componentName + label (볼드)
- `helperText`: 선택된 옵션의 label (예: "core_avg - Outlet")
- `renderInput`: `<TextField label="From Volume" size="small" />`

### FR-A3: Edge ↔ Junction 자동 동기화

BranchForm의 기존 `useEffect` 패턴을 재사용하되, **고정 3개 Junction**에 맞게 조정:

```typescript
// Edge → Junction 동기화 (BranchForm L641-676 패턴)
useEffect(() => {
  const sepEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);

  junctions.forEach((junction, idx) => {
    // 핸들 ID 매칭으로 해당 Junction의 Edge 찾기
    const edge = sepEdges.find(e => {
      const handleId = e.source === nodeId ? e.sourceHandle : e.targetHandle;
      return handleId?.match(/j(\d+)/)?.[1] === String(junction.junctionNumber);
    });

    if (edge?.data) {
      // Edge의 fromVolume/toVolume → Junction의 from/to에 반영
      if (edge.data.fromVolume && !volumeRefsEqual(edge.data.fromVolume, junction.from)) {
        setValue(`junctions.${idx}.from`, edge.data.fromVolume, { shouldDirty: false });
      }
      if (edge.data.toVolume && !volumeRefsEqual(edge.data.toVolume, junction.to)) {
        setValue(`junctions.${idx}.to`, edge.data.toVolume, { shouldDirty: false });
      }
    }
  });
}, [edges, nodeId]);
```

### FR-A4: ComponentID 변경 시 VolumeReference 동기화

기존 `ComponentIdField` 컴포넌트가 처리한다 (BranchForm과 동일 패턴):
- `ComponentIdField`는 componentId 변경 시 store의 `updateComponentId` 호출
- Store가 모든 관련 Edge의 `fromVolume`/`toVolume`에서 해당 노드를 참조하는 부분을 자동 갱신
- **VolumeReference는 nodeId(불변)를 참조하므로 componentId 변경에 영향받지 않음**
- 파일 생성 시점에 `NodeIdResolver.getVolumeIdFromReference()`가 최신 componentId로 변환

### FR-A5: edgeSyncUtils.ts 확장

`getHandleIdForVolumeReference()` 함수에 `separatr` 케이스 추가:

```typescript
// edgeSyncUtils.ts - 기존 branch/tank 케이스에 separatr 추가
case 'separatr': {
  // Branch와 동일: face 1-6 → 핸들 매핑
  return { handleId: `face-${ref.face}`, handleType: 'target' };
}
```

### FR-A6: 노드 핸들 구조 (SeparatorNode.tsx)

3개의 고정 Junction 핸들 + 기본 face 핸들:

| 핸들 ID | 타입 | 위치 | Junction | 설명 |
|---------|------|------|----------|------|
| `source-j1` | source | 상단 | N=1 (Vapor Out) | Edge 출발점 |
| `target-j1` | target | 상단 | N=1 (Vapor Out) | Edge 도착점 |
| `source-j2` | source | 좌측 | N=2 (Liquid Fall Back) | Edge 출발점 |
| `target-j2` | target | 좌측 | N=2 (Liquid Fall Back) | Edge 도착점 |
| `source-j3` | source | 하단 | N=3 (Inlet) | Edge 출발점 |
| `target-j3` | target | 하단 | N=3 (Inlet) | Edge 도착점 |

핸들 네이밍은 기존 `BranchNode.tsx`의 `source-j{N}` / `target-j{N}` 패턴과 동일.

### FR-A7: Junction 탭 UI (SeparatorForm - Junctions 탭)

BranchForm의 Junction 서브탭 패턴을 따르되, **고정 3개 탭**:

```
┌──────────────┬────────────────┬──────────────┐
│ N=1 Vapor ●  │ N=2 Liquid ●   │ N=3 Inlet ○  │  ← Chip 탭 (●=연결됨, ○=미연결)
└──────────────┴────────────────┴──────────────┘

┌─ Junction N=1: Vapor Outlet ─────────────────┐
│                                                │
│  Direction:  [outlet]  (고정, disabled)         │
│  Branch Face: [2]      (고정, disabled)         │
│                                                │
│  ┌─ Connection ─────────────────────────────┐  │
│  │ From Volume: [CCC010002 ▼] (자동잠금)     │  │
│  │   → "Self - Outlet (face 2)"              │  │
│  │ To Volume:   [Autocomplete ▼] (사용자선택) │  │
│  │   → helperText: "core_avg - Inlet"        │  │
│  └───────────────────────────────────────────┘  │
│                                                │
│  Area:     [________] m²  (0 = auto)           │
│  Fwd Loss: [________]     Rev Loss: [________] │
│                                                │
│  Junction Control Flags: [0000____]            │
│  (c: choking, a: area change, h: homo, s: flux)│
│  ⚠ 권장: Choking off (c=1), Nonhomogeneous    │
│                                                │
│  Void Fraction Limit (VOVER): [0.5___]         │
│  → helperText: "Default: 0.5 (미입력 시 적용)"  │
│                                                │
│  ┌─ Initial Flow ───────────────────────────┐  │
│  │ Liquid Flow: [________] kg/s             │  │
│  │ Vapor Flow:  [________] kg/s             │  │
│  └───────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

#### 기존 BranchForm과의 차이점 요약

| 항목 | BranchForm | SeparatorForm |
|------|-----------|---------------|
| Junction 수 | 가변 (1-9), Add/Remove 버튼 | **고정 3개**, Add/Remove 없음 |
| Junction 방향 | 사용자 선택 (inlet/outlet) | **고정** (N=1: outlet, N=2: outlet, N=3: inlet 해석) |
| branchFace | 사용자 선택 (1-6) | **N=1→face 2, N=2→face 1, N=3→사용자 지정** |
| From/To | 양쪽 모두 Autocomplete | N=1,N=2: **from 자동잠금** + to만 Autocomplete |
| jefvcahs | 8자리 전체 편집 | **`0000cahs`** 뒤 4자리만 편집 |
| Void Fraction | 없음 | W7 필드 (N=1: VOVER, N=2: VUNDER) |
| Crossflow 위저드 | 있음 | **없음** (face 3-6 미사용) |
| Discharge Coefficient | 선택적 | **없음** (Separator에는 해당 카드 없음) |

### FR-A8: 입력 필드 패턴 (기존 UX 통일)

모든 숫자 필드는 BranchForm과 동일한 MUI + react-hook-form 패턴 사용:

```tsx
// 표준 숫자 입력 패턴 (프로젝트 전역 공통)
<Controller
  name="fieldName"
  control={control}
  render={({ field }) => (
    <TextField
      {...field}
      value={field.value ?? ''}
      label="필드 라벨"
      type="number"
      inputProps={numberInputProps}      // from @/utils/inputHelpers
      size="small"
      fullWidth
      InputProps={{
        endAdornment: <InputAdornment position="end">단위</InputAdornment>,
      }}
      error={!!errors.fieldName}
      helperText={errors.fieldName?.message || '기본값 안내'}
      onChange={(e) => handleNumberChange(e.target.value, field.onChange)}
      onBlur={(e) => handleNumberBlur(e.target.value, field.onChange, defaultValue)}
    />
  )}
/>
```

**공통 유틸리티** (기존 것 재사용):
- `handleNumberChange` / `handleNumberBlur`: 숫자 입력 핸들러
- `numberInputProps`: step, min 등 input 속성
- `NumericTextField`: 커스텀 숫자 컴포넌트 (일부 폼에서 사용)
- `ComponentIdField`: 7자리 컴포넌트 ID 편집 + 중복 검사 + 동기화

**Zod 스키마 패턴** (BranchForm과 동일):
- `z.number().min(0)` — 양수 필드
- `z.number().positive()` — 0 초과 필드
- `z.string().regex(/^패턴$/)` — 플래그 문자열
- `volumeRefValidator` — VolumeReference 커스텀 검증
- `.refine()` — 교차 필드 검증 (dz ≤ length, A×L=V 등)

---

## 4. 비기능 요구사항

| ID | 항목 | 설명 |
|----|------|------|
| NFR-01 | 코드 재사용 | BranchJunction/BranchParameters의 볼륨/초기조건 패턴 최대 재사용 |
| NFR-02 | 패턴 일관성 | Turbine/Tank처럼 "Branch 변형" 패턴 따르기 |
| NFR-03 | 조건부 UI | ISEPST 값에 따른 동적 폼 표시/숨김 |
| NFR-04 | 기본값 처리 | GE 데이터의 많은 기본값은 placeholder로 안내, 빈칸=기본값 적용 |

---

## 5. 구현 우선순위

### Phase 1: 기본 SEPARATR (ISEPST=0)
1. 타입 정의 (`SeparatorParameters`, `SeparatorJunction`)
2. 노드 컴포넌트 (`SeparatorNode.tsx`)
3. 폼 컴포넌트 (`SeparatorForm.tsx`) — Basic/Volume/IC/Junctions 탭
4. 파일 생성기 — CCC0001, CCC0101, CCC0200, CCCN101, CCCN201
5. 검증 로직
6. Store/팔레트 연동

### Phase 2: GE Separator (ISEPST=1,2,3)
1. GE 데이터 타입 정의
2. GE Data 탭 UI
3. 파일 생성기 — CCC0002, CCC0500~0503, CCC0600
4. 조건부 검증 로직 확장

### Phase 3: 선택적 기능
1. Additional Wall Friction (CCC0131)
2. Junction Form Loss Data (CCCN112)
3. 전용 노드 도형 (P&ID 기호)

---

## 6. 결정 사항

| # | 결정 | 근거 |
|---|------|------|
| D1 | SeparatorJunction = BranchJunction + `voidFractionLimit` (extends) | 코드 재사용 극대화, Turbine/Tank 패턴 동일 |
| D2 | N=1, N=2의 `from`은 자동 잠금 (disabled Autocomplete) | 매뉴얼 규칙 명확: N=1→self outlet, N=2→self inlet |
| D3 | VolumeReference 연결은 BranchForm 패턴 100% 재사용 | availableVolumes, Edge 동기화, ComponentIdField 모두 동일 |
| D4 | 입력 필드는 Controller + TextField + handleNumberChange 패턴 통일 | 프로젝트 전역 UX 일관성 |
| D5 | Junction 추가/삭제 버튼 없음 (고정 3개 탭) | SEPARATR 스펙상 nj=3 고정 |
| D6 | edgeSyncUtils에 `separatr` 케이스 추가 (branch와 동일 로직) | 기존 branch/tank 패턴 |

## 7. 미결 사항 (Open Questions)

| # | 질문 | 영향 |
|---|------|------|
| Q1 | 팔레트 카테고리를 "VOLUME"에 넣을지 "SPECIALIZED"로 분리할지? | 노드 팔레트 UI |
| Q2 | GE 기본값을 폼에 자동 채울지, placeholder만 표시할지? | UX |
| Q3 | Phase 1 범위에서 CCC0002 카드(ISEPST=0)도 항상 출력할지, 생략할지? | 파일 생성기 |

---

## 8. 참조

### 매뉴얼
- MARS-KS Code Manual Vol.II, Section 8.11 (p.125~135)

### 기존 구현 (레퍼런스 코드)

| 파일 | 역할 | 재사용 대상 |
|------|------|------------|
| `src/types/mars.ts` L336-398 | `BranchJunction`, `BranchParameters` 타입 | Junction 구조, Volume/IC 필드 |
| `src/components/forms/BranchForm.tsx` | Branch 폼 전체 | availableVolumes, Edge 동기화, Junction 탭 UI, Zod 스키마 |
| `src/components/nodes/BranchNode.tsx` | Branch 노드 렌더링 | 핸들 구조 (`source-j{N}`, `target-j{N}`), NodeResizer |
| `src/utils/edgeSyncUtils.ts` L163-205 | `getHandleIdForVolumeReference()` | `separatr` 케이스 추가 필요 |
| `src/utils/nodeIdResolver.ts` | VolumeReference ↔ Volume ID 변환 | 변경 없이 그대로 사용 |
| `src/utils/fileGenerator.ts` L558+ | `generateBranchCards()` | 현재 `separatr`가 `branch`와 합쳐져 있음 → 분리 필요 |
| `src/utils/nodeAppearance.ts` L18 | separatr 기본 외형 | 이미 등록됨 (branch와 동일, 색상 차별화 예정) |
| `src/components/forms/ComponentIdField.tsx` | 7자리 ID 편집 + 동기화 | 변경 없이 그대로 사용 |
| `src/utils/inputHelpers.ts` | `handleNumberChange`, `handleNumberBlur`, `numberInputProps` | 변경 없이 그대로 사용 |

### VolumeReference 가이드
- `documents/guides/GUIDE-volume-reference.md` — From/To 연결 체크리스트, 금지 사항
