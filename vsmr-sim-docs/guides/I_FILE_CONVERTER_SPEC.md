# .i File → Project JSON 컨버터 사양서

> 100%.i 입력파일을 파싱하여 MARSProject JSON으로 변환하는 오프라인 스크립트 사양
> 참조: `src/types/mars.ts`의 `MARSProject` 인터페이스

---

## 1. 목표 데이터 구조

### MARSProject (출력 JSON 최상위)

```typescript
// src/types/mars.ts:2017
interface MARSProject {
  metadata: ProjectMetadata;
  nodes: Array<{
    id: string;                    // "node_1", "node_2", ...
    type: ComponentType;           // "snglvol", "pipe", ...
    position: { x: number; y: number };  // 캔버스 좌표
    data: MARSNodeData;
  }>;
  edges: Array<{                   // Phase 2에서 구현
    id: string;
    source: string;                // source node id
    target: string;                // target node id
    sourceHandle?: string;
    targetHandle?: string;
    data?: MARSEdgeData;
  }>;
}
```

### MARSNodeData (노드당 데이터)

```typescript
// src/types/mars.ts:1092
interface MARSNodeData {
  componentId: string;             // "1200000" (MARS CCC × 10000)
  componentName: string;           // "core_avg"
  componentType: ComponentType;    // "pipe", "snglvol", ...
  parameters: Partial<ComponentParameters>;  // 타입별 파라미터
  status: 'incomplete' | 'valid' | 'error';
  errors: ValidationError[];
  warnings: ValidationError[];
  appearance?: NodeAppearance;     // 선택사항
}
```

### ProjectMetadata

```typescript
// src/types/mars.ts:1988
interface ProjectMetadata {
  projectName: string;
  version: string;
  created: string;                 // ISO date
  modified: string;
  simulationType?: 'transnt' | 'stdy-st';
  unitSystem?: 'si' | 'british';
  workingFluid?: 'h2o' | 'air';
  globalSettings?: GlobalSettings;
}
```

---

## 2. ComponentID 규칙

| 타입 | CCC (3자리) | componentId (7자리) | 예시 |
|------|:-----------:|:-------------------:|------|
| 수력 컴포넌트 | 100~999 | CCC × 10000 | C120 → `1200000` |
| 열구조체 | 1000~9999 | CCC × 10000 | S1200 → `12000000` (8자리) |

> `formatDisplayId()` 역변환: `1200000` → `C120`, `12000000` → `S1200`

---

## 3. Node ID 규칙

Store에서 사용하는 노드 ID 형식: `"node_{순번}"` (1부터 시작)

```
node_1, node_2, ..., node_200
```

> 레거시 `cmp_` 접두어는 `loadProject` 시 자동 마이그레이션됨

---

## 4. 자동 격자 배치 (Phase 1)

```typescript
position: {
  x: (index % COLS) * SPACING_X + OFFSET_X,
  y: Math.floor(index / COLS) * SPACING_Y + OFFSET_Y
}
```

추천값: `COLS=10, SPACING_X=250, SPACING_Y=200, OFFSET=50`

---

## 5. 컴포넌트 타입별 파라미터 매핑

### 5.1 카드 번호 → CCC 추출 규칙

```
카드 번호: CCCXXXX (7자리)
CCC = Math.floor(cardNumber / 10000)
```

예: `1200301` → CCC=120, 카드=0301

열구조체: `1CCCGXNN` → CCC=첫4자리에서 추출

### 5.2 SNGLVOL (그룹 A)

**.i 파일 패턴:**
```
* snglvol  sk_inner
1000000  sk_inner  snglvol
1000101  0.0  1.593  6.945
1000102  0.0  90.0  1.593
1000103  3.048e-5  0.053798  0000000
1000200  003  15.125e6  560.87
```

**→ JSON 매핑:**
```json
{
  "componentId": "1000000",
  "componentType": "snglvol",
  "componentName": "sk_inner",
  "parameters": {
    "name": "sk_inner",
    "xArea": 0.0,
    "xLength": 1.593,
    "volume": 6.945,
    "azAngle": 0.0,
    "incAngle": 90.0,
    "dz": 1.593,
    "wallRoughness": 3.048e-5,
    "hydraulicDiameter": 0.053798,
    "tlpvbfe": "0000000",
    "ebt": "003",
    "pressure": 15.125e6,
    "temperature": 560.87
  }
}
```

### 5.3 TMDPVOL (그룹 A)

**.i 파일 패턴:**
```
* tmdpvol  seawat
9860000  seawat  tmdpvol
9860101  0.0  1.0  1.0
9860102  0.0  0.0  0.0
9860103  0.0  0.0  0000000
9860200  002  0  time  0
9860201  0.0  1.01325e5  0.0
9860202  1000.0  1.01325e5  0.0
```

**→ JSON 매핑:**
```json
{
  "componentId": "9860000",
  "componentType": "tmdpvol",
  "parameters": {
    "name": "seawat",
    "area": 0.0,
    "length": 1.0,
    "volume": 1.0,
    "azAngle": 0.0,
    "incAngle": 0.0,
    "dz": 0.0,
    "conditionType": "002",
    "tripNumber": 0,
    "variableType": "time",
    "variableCode": 0,
    "timeTable": [
      { "time": 0.0, "pressure": 1.01325e5, "quality": 0.0 },
      { "time": 1000.0, "pressure": 1.01325e5, "quality": 0.0 }
    ]
  }
}
```

### 5.4 SNGLJUN (그룹 B)

**.i 파일 패턴:**
```
* sngljun  inlet_cb
1150000  inlet_cb  sngljun
1150101  110010002  140010001  0.0
1150102  0.0  0.0  00000000
1150201  0  0.0  0.0
```

**→ JSON 매핑:**
> `from`/`to`는 VolumeReference 객체로 변환 (Phase 2: Edge 복원 시)
> Phase 1에서는 9자리 문자열로 보존

```json
{
  "parameters": {
    "name": "inlet_cb",
    "from": { "raw": "110010002" },
    "to": { "raw": "140010001" },
    "area": 0.0,
    "fwdLoss": 0.0,
    "revLoss": 0.0,
    "jefvcahs": "00000000",
    "flowDirection": 0,
    "mfl": 0.0,
    "mfv": 0.0
  }
}
```

### 5.5 PIPE (그룹 C)

**.i 파일 패턴 (SEF 역파싱):**
```
1200001  12                        ← ncells=12
1200101  0.125  1                  ← xArea[0]=0.125 (셀 1~1)
1200102  0.200  11                 ← xArea[1~10]=0.200 (셀 2~11)
1200103  0.341  12                 ← xArea[11]=0.341 (셀 12)
```

**SEF 역파싱 알고리즘:**
```
for each card CCC0X01~CCC0X99:
  value = W1
  endCell = W2
  fill array[prevEnd..endCell-1] = value
  prevEnd = endCell
```

### 5.6 BRANCH (그룹 D)

**.i 파일 패턴:**
```
1100001  3  1                      ← njuns=3, icond=1
1100101  ...                       ← 볼륨 지오메트리
1101101  From  To  Area            ← junction 1 (N=1)
1101102  fwdLoss  revLoss  flags
1101201  mfl  mfv
1102101  ...                       ← junction 2 (N=2)
```

**접합부 번호 추출:** 카드 `CCCN1XX` → N = `Math.floor((cardNum % 10000) / 1000)`

### 5.7 TURBINE (그룹 D, BRANCH 확장)

**BRANCH 필드 전체 + 추가 카드:**
```
6100300  speed  inertia  friction  shaftNo  trip  drain
6100400  type  efficiency  fraction  radius
```

### 5.8 TANK (그룹 D, BRANCH 확장)

**BRANCH 필드 전체 + 추가 카드:**
```
8160400  initialLevel
8160401  vol1  level1
8160402  vol2  level2
```

### 5.9 MTPLJUN (그룹 E)

**.i 파일 패턴:**
```
1250001  12  1                     ← njuns=12, icond=1
1250111  from  to  area  fLoss  rLoss  flags  subDc  twoDc  supDc  fIncre  tIncre
1250211  from  to  area  ...       ← junction 2
12510111  mfl  mfv                 ← IC for junction 1 (icond=1)
```

**접합부 번호 추출:** 카드 `CCCNN11` → NN = 2자리 (01~99)

### 5.10 PUMP (그룹 F)

**고유 카드 구조:**
```
1810101  area  length  vol         ← 볼륨
1810108  fromVol  area  kf  kr  flags  ← 입구 접합부
1810109  toVol  area  kf  kr  flags    ← 출구 접합부
1810301  tbli  twophase  tdiff  mtorq  tdvel  ptrip  rev  ← 7옵션
1810302  ratedSpeed  initRatio  ratedFlow  ratedHead      ← 기술 1
1810303  ratedTorque  inertia  ratedDensity  ratedMotor   ← 기술 2
1810304  tf2  tf0  tf1  tf3                               ← 마찰 계수
1811100+  상사곡선 데이터                                   ← 16종
```

### 5.11 VALVE (그룹 G)

**서브타입별 CCC0301 파싱:**
```
CCC0300  trpvlv   → CCC0301: tripNumber (1 word)
CCC0300  mtrvlv   → CCC0301: openTrip closeTrip rate initPos (4 words)
CCC0300  srvvlv   → CCC0301: cvNum tableNum (2 words)
CCC0300  chkvlv   → CCC0301: type initPos backPress leakRatio (4 words)
```

### 5.12 HTSTR (그룹 H)

**카드 접두어:** `1CCCG` (CCC=컴포넌트, G=지오메트리 그룹)
```
1CCCG000  nh  np  geom  ssif  leftCoord [reflood  bvInd  maxAxial]
1CCCG100  meshLocFlag  meshFmtFlag
1CCCG101  intervals  rightCoord
...
```

**연료봉 판별:** `1CCCG001` 카드 존재 여부 → `isFuelRod = true`

---

## 6. 파서 구현 순서

| 단계 | 범위 | 산출물 |
|:----:|------|--------|
| 1 | 주석/빈줄 제거, 카드 토큰화 | `Card[]` 배열 |
| 2 | CCC 그룹핑 + 컴포넌트 타입 판별 | `ComponentBlock[]` |
| 3 | 타입별 파라미터 파싱 (그룹 A~H) | `MARSNodeData[]` |
| 4 | 격자 좌표 할당 | `MARSProject.nodes` |
| 5 | 글로벌 설정 파싱 (Card 1~299) | `ProjectMetadata` |
| 6 | 비컴포넌트 데이터 (trips, CV, etc.) | `GlobalSettings` |
| 7 | (Phase 2) VolumeID → Edge 복원 | `MARSProject.edges` |

### 카드 토큰화 규칙

```
입력: "1200301  0.125000  1       * comment here"
출력: { cardNumber: 1200301, words: [0.125, 1], comment: "comment here" }
```

- `*`로 시작하는 줄: 주석 (skip 또는 컴포넌트명 힌트로 활용)
- `.` 만 있는 줄: End card (파일 종료)
- 빈줄: skip
- `$` 시작: 주석 (skip)

### 컴포넌트 타입 판별

```
CCC0000 카드의 W2 값으로 판별:
  "snglvol" | "sngljun" | "pipe" | "branch" | "tmdpvol" | "tmdpjun"
  | "mtpljun" | "pump" | "valve" | "turbine" | "tank"

열구조체: 1CCCG000 카드 존재 (8자리 카드번호, 1로 시작)
```

---

## 7. VolumeReference 역매핑 (Phase 2)

### 9자리 VolumeID 분해

```
CCCVV000N
├── CCC: 컴포넌트 번호 (3자리)
├── VV: 볼륨/셀 번호 (2자리, 01~99)
├── 000: 고정
└── N: face 번호 (1=inlet, 2=outlet, 3~6=crossflow)
```

### VolumeReference 객체 복원

```typescript
interface VolumeReference {
  nodeId: string;        // ReactFlow 노드 ID ("node_5")
  componentId: string;   // MARS ID ("1100000")
  volumeNum: number;     // 셀/볼륨 번호 (1~99)
  face: FaceType;        // 1~6
}
```

**역매핑 과정:**
1. 9자리 → CCC, VV, face 분리
2. CCC → componentId → nodeId 룩업 테이블
3. VolumeReference 객체 생성

---

## 8. Store 로드 경로

생성된 JSON은 `loadProject()` 함수로 주입:

```typescript
// src/stores/useStore.ts:112
loadProject: (project: {
  metadata: ProjectMetadata;
  nodes: Node<MARSNodeData>[];
  edges: Edge<MARSEdgeData>[];
}) => void;
```

### Supabase 경유 경로 (실제 프로젝트 저장)

```
ProjectData.models[0].nodes = MARSProject.nodes
ProjectData.models[0].edges = MARSProject.edges
ProjectData.models[0].settings = { globalSettings }
```

### 직접 로드 경로 (개발/테스트)

```
JSON 파일 → loadProject({ metadata, nodes, edges })
```

---

## 9. 검증 방법

1. 파서 출력 JSON → `loadProject()` → Store 로드
2. Store에서 `fileGenerator.ts` → .i 파일 Export
3. 원본 100%.i vs Export diff
4. 차이 분석 → 파서 수정 → 반복

---

## 10. 구현 현황 (Phase 1 완료)

### 실행 결과 (100%.i)
```
입력: 15,299줄 → 7,013개 카드
출력: 286개 노드 (파싱 오류 0개)

타입별 분포:
  branch: 4 (separatr 1개 포함, branch로 매핑)
  htstr: 41
  mtpljun: 6
  pipe: 101
  pump: 6
  sngljun: 89
  snglvol: 4
  tmdpjun: 3
  tmdpvol: 6
  turbine: 8
  valve: 18

글로벌 데이터:
  systems: 2, timeSteps: 3, minorEdits: 36
  variableTrips: 30, controlVariables: 106
  thermalProperties: 13
```

### 실행 방법
```bash
npx tsx scripts/i-file-parser/converter.ts documents/100%.i output.json
```

### 알려진 제한사항
- `separatr` 타입은 GUI에서 미지원 → `branch`로 매핑
- VolumeReference는 `{ raw: "110010002" }` 형태로 보존 (Phase 2에서 Edge 복원)
- 중복 카드번호는 마지막 값 사용 (100%.i의 1150102, 1810301 등)
- MTPLJUN IC 카드는 8자리 (CCC*100000 + 10000 + NN*100 + 11)

---

## 11. 파서 모듈 구조

| 파일 | 용도 |
|------|------|
| `scripts/i-file-parser/tokenizer.ts` | 줄 → Card 배열 변환 (주석/빈줄 제거) |
| `scripts/i-file-parser/grouper.ts` | CCC 그룹핑 + 컴포넌트 타입 판별 |
| `scripts/i-file-parser/componentParsers.ts` | 12종 컴포넌트별 파라미터 파서 |
| `scripts/i-file-parser/globalParser.ts` | 글로벌/비컴포넌트 데이터 파서 |
| `scripts/i-file-parser/converter.ts` | 메인 CLI (토큰화→그룹핑→파싱→JSON 출력) |

---

## 12. 참고 파일

| 파일 | 용도 |
|------|------|
| `src/types/mars.ts` | 모든 TypeScript 인터페이스 (파서 출력 타겟) |
| `src/utils/fileGenerator.ts` | .i 생성 로직 (역방향 참조) |
| `src/stores/useStore.ts` | loadProject 함수, 마이그레이션 로직 |
| `src/utils/projectFileHelpers.ts` | Import/Export 형식 (VsmrProjectFile, MARSProject) |
| `src/types/supabase.ts` | DB 저장 구조 (ProjectData → Model) |
| `documents/100%.i` | 원본 입력파일 (파서 입력) |
| `documents/testing/INPUT_FILE_TEST_CHECKLIST.md` | 폼 필드 차이 분류 (타입별 파싱 가이드) |
| `documents/testing/100percent_parsed.json` | 파서 출력 결과 (286노드, 1MB) |
