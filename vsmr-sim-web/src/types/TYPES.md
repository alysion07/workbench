# Type System Overview

데이터 타입 정의 문서. `supabase.ts`와 `simulation.ts`의 핵심 인터페이스를 시각화하고 구성 요소를 정리합니다.

---

## 1. 타입 체계 다이어그램

### 1.1 Project & Model 계층 구조 (supabase.ts)

```
┌─────────────────────────────────────────────────────────────┐
│ Project (Supabase 테이블 Row)                               │
│ ├─ id: UUID                                                 │
│ ├─ user_id: auth.uid()                                      │
│ ├─ name, description                                        │
│ └─ data: ProjectData (JSONB 컬럼)                            │
│    ├─ totalScope: ModelScope                                │
│    ├─ models: Model[]                                       │
│    │  ├─ id, name                                           │
│    │  ├─ analysisCodes: AnalysisCode[]                      │
│    │  ├─ scope: ModelScope (중복 불가)                      │
│    │  ├─ nodes, edges (ReactFlow)                           │
│    │  ├─ settings: Record<string, any>                      │
│    │  └─ updateHistory: VersionEntry[]                      │
│    ├─ updateHistory: VersionEntry[]                         │
│    └─ simulationHistory: SimulationEntry[]                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Simulation 실행 계층 (simulation.ts)

```
┌─────────────────────────────────────────────────────────────┐
│ Job (시뮬레이션 작업 상태)                                   │
│ ├─ id: UUID (TaskID)                                        │
│ ├─ args: string (input_file URL)                            │
│ ├─ taskMode: 'new' | 'restart'                              │
│ ├─ status: JobStatus (pending→running→completed)            │
│ ├─ startTime, endTime: timestamp                            │
│ ├─ projectName: string                                      │
│ └─ lastSimState: SimStateSnapshot                           │
│    ├─ task_id, seq, ts_ms, timehy                           │
│    ├─ status, iteration_count                               │
│    ├─ target_speed, actual_speed                            │
│    └─ max_speed                                             │
│                                                             │
├─ PlotData[] (시계열 데이터 포인트)                           │
│  └─ { time, v0, v1, v2, ... }                              │
│     (minorEdits[i] ↔ v${i} 매핑)                            │
│                                                             │
├─ ChartConfig[] (차트 구성)                                   │
│  ├─ id, title, type                                        │
│  ├─ dataKeys: { key, label, color }[]                      │
│  ├─ minorEditCardNumber (301-399)                           │
│  ├─ yAxisMode: 'fixed' | 'auto'                             │
│  ├─ yAxisFixed: [min, max]                                  │
│  ├─ editGroup, editPriority                                 │
│  └─ layout: ChartLayout                                     │
│                                                             │
└─ MinorEditNamedSnapshot (스트림 최신값)                      │
   ├─ timehy: ms (시뮬레이션 시간)                             │
   ├─ seq: number                                             │
   └─ values: { name, value }[]                               │
      (index i ↔ minorEdits[i] 매핑)                          │
```

### 1.3 MinorEdit 흐름도

```
입력 파일 (.i)
  ↓
parseMinorEdits(content)
  ├─ cardNumber 정렬
  └─ filter(e.variableType !== 'time')
  ↓
runtimeMinorEdits: MinorEdit[]
  ├─ [0]: rktpow_0         ← chartConfigBuilder 래핑
  ├─ [1]: p_280070000
  └─ [2]: tempf_300000000
  ↓
서버 스트림 → latestMinorEdit.values[]
  ├─ values[0] = rktpow (timehy 필드로 매핑)
  ├─ values[1] = p값 ↔ runtimeMinorEdits[0]
  ├─ values[2] = tempf값 ↔ runtimeMinorEdits[1]
  └─ ...
  ↓
plotData → transformPlotData()
  └─ { time, v0: p값, v1: tempf값, ... }
     (v${i} ↔ runtimeMinorEdits[i])
```

---

## 2. Project/ProjectData 구성 요소

### ProjectData (JSONB 컬럼)

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `totalScope` | `ModelScope` | 프로젝트 전체 인수 범위 (primary, secondary, bop) | 모델 스코프 합집합 관리 |
| `models[]` | `Model[]` | 프로젝트 내 모든 모델 | MAIN-001, MDH-001 지원 |
| `updateHistory[]` | `VersionEntry[]` | 프로젝트 레벨 버전 히스토리 (작성자, 타임스탬프 포함) | 모델의 updateHistory와 분리 |
| `simulationHistory[]` | `SimulationEntry[]` | 시뮬레이션 실행 기록 | 이름, 상태, 기간, 모델ID 포함 |
| **레거시** | | | |
| `nodes` (deprecated) | `any[]` | 이전 ReactFlow 노드 | 자동 마이그레이션됨 |
| `edges` (deprecated) | `any[]` | 이전 ReactFlow 엣지 | 자동 마이그레이션됨 |
| `globalSettings` (deprecated) | `any` | 이전 전역 설정 | models[].settings 로 이동 |
| `metadata` (deprecated) | `Object` | 이전 메타데이터 | totalScope, partition 등 포함 |

### Project (Supabase Row)

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `id` | `UUID` | 프로젝트 고유 ID | Primary Key |
| `user_id` | `UUID` | 프로젝트 소유자 (auth.uid) | RLS로 자동 필터링 |
| `name` | `string` | 프로젝트 이름 | 사용자당 unique constraint |
| `description` | `string \| null` | 프로젝트 설명 | 선택사항 |
| `data` | `ProjectData \| null` | 프로젝트 콘텐츠 (JSONB) | 모델, 히스토리 포함 |
| `created_at` | `ISO timestamp` | 생성 시간 | 자동 설정 |
| `updated_at` | `ISO timestamp` | 수정 시간 | 자동 갱신 |

---

## 3. Model 구성 요소

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `id` | `UUID` | 모델 고유 ID | 프로젝트 내 unique |
| `name` | `string` | 모델명 ("Reactor Coolant System") | 사용자 입력 |
| `analysisCodes` | `AnalysisCode[]` | 분석 코드 배열 | 'MARS', 'SPHINCS', 'Modelica' 복수 선택 |
| `scope` | `ModelScope` | 이 모델이 담당할 계통 + 컴포넌트 | 프로젝트의 totalScope 내에서 선택 |
| `nodes` | `any[]` | ReactFlow 노드 배열 | 캔버스 상태 저장 |
| `edges` | `any[]` | ReactFlow 엣지 배열 | 연결선 상태 저장 |
| `settings` | `Object` | 모델별 설정 (Global Settings) | NEW 해석 시 전체 카드 |
| `restartSettings` | `Object` | RESTART 오버라이드 설정 | RESTART 시에만 사용 |
| `svgLibrary` | `any[]` | SVG 라이브러리 아이템 목록 | 커스텀 SVG 저장 |
| `defaultSvgByType` | `Record<string, string>` | 컴포넌트 타입별 기본 SVG ID | 타입 → SVG ID 매핑 |
| `updateHistory` | `VersionEntry[]` | 모델 버전 히스토리 | 작성자, 버전, 설명 기록 |
| `created_at` | `ISO timestamp` | 모델 생성 시간 | |
| `updated_at` | `ISO timestamp` | 모델 수정 시간 | |

### ModelScope

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `systems` | `SystemScope[]` | 계통 배열 | 'primary', 'secondary', 'bop' 중 선택 |
| `components` | `string[]` | 개별 컴포넌트 ID 목록 | 선택사항 |

---

## 4. Simulation 구성 요소

### Job (시뮬레이션 작업)

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `id` | `UUID` | Task ID (서버 생성) | Primary Key |
| `args` | `string` | 실행 인자 (input_file URL) | "new,s3://..." 형식 |
| `taskMode` | `'new' \| 'restart'` | 작업 모드 | NEW: 신규 / RESTART: 이전 결과 기반 |
| `status` | `JobStatus` | 작업 상태 | pending → running → completed/stopped/failed |
| `startTime` | `number` | 시작 타임스탬프 (ms) | Date.now() |
| `endTime` | `number \| undefined` | 종료 타임스탐프 (ms) | completed/stopped/failed일 때 설정 |
| `error` | `string \| undefined` | 에러 메시지 | status==='failed'일 때 기록 |
| `projectName` | `string \| undefined` | 프로젝트 이름 | input_file URL에서 추출 |
| `progress` | `number \| undefined` | 진행률 (0-100) | LSE에서 계산 (미사용 중) |
| `lastSimState` | `SimStateSnapshot \| undefined` | 마지막 SimState 스냅샷 | 속도, 반복 횟수, 상태 포함 |

### PlotData (시계열 데이터)

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `time` | `number` | 시뮬레이션 시간 (초) | MNorEditSnapshot의 timehy / 1000 |
| `v${i}` | `number` | 동적 데이터 키 | minorEdits[i] ↔ v${i} 매핑 |

> **주요 특성**
> - 서버에서 v0, v1, ... 형식으로 스트리밍
> - transformPlotData()로 dataKey쌍 (e.g. "p_280070000")으로 변환
> - 최대 3000개 포인트 유지 (메모리 관리)

### ChartConfig (차트 구성)

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `id` | `string` | 차트 고유 ID | 선택 시 필요 |
| `title` | `string` | 차트 제목 | UI 표시용 |
| `type` | `'line' \| 'area' \| 'scatter' \| 'heatmap' \| 'gauge'` | 차트 타입 | Recharts 지원 타입 |
| `dataKeys` | `Array<{key, label, color}>` | 데이터 키 목록 | dataKey별 레이블, 색상 |
| `unit` | `string \| undefined` | 단위 | 예: 'Pa', 'K', '℃' |
| `yAxisMode` | `'fixed' \| 'auto' \| undefined` | Y축 모드 | 사용자 토글 가능 |
| `yAxisFixed` | `[number, number] \| undefined` | 고정 Y축 범위 | [lowerLimit, upperLimit] |
| `yAxisDomain` | `[number, number] \| ['auto', 'auto'] \| undefined` | Y축 도메인 | Recharts 렌더링용 |
| `minorEditCardNumber` | `number \| undefined` | 원본 MinorEdit 카드 번호 | generateChartsFromMinorEdits용 |
| `editGroup` | `number \| undefined` | 편집 그룹 번호 | 탭 그룹화 |
| `editPriority` | `number \| undefined` | 그룹 내 우선순위 | 정렬용 |
| `size` | `'small' \| 'medium' \| 'large' \| undefined` | 크기 | 그리드 레이아웃 크기 |
| `tags` | `string[] \| undefined` | 태그 | 필터링용 (예: 'Pressure', 'Temperature') |

### MinorEditNamedSnapshot

| 필드 | 타입 | 설명 | 비고 |
|---|---|---|---|
| `timehy` | `number` | 시뮬레이션 시간 (ms) | 서버에서 전달 |
| `tsMs` | `number` | Wall-clock 타임스탐프 (ms) | 수신 시간 |
| `seq` | `number` | 시퀀스 번호 | 데이터 연속성 확인용 |
| `values[]` | `MinorEditNamedValue[]` | MinorEdit 값 배열 | name, value 쌍 |

---

## 5. 주요 매핑 관계

### v-Index ↔ MinorEdit 매핑

```
runtimeMinorEdits (cardNumber 정렬후):
[0] { variableType: 'rktpow', parameter: 0, ... }
[1] { variableType: 'p', parameter: 280070000, ... }
[2] { variableType: 'tempf', parameter: 300000000, ... }

↓ 서버 스트림 (values[i+1] = minorEdits[i])

latestMinorEdit.values:
[0] = { name: 'v_da_power', value: 1023.5 }  (rktpow)
[1] = { name: 'v1_p', value: 2.5e6 }         (p, index 0)
[2] = { name: 'v2_tempf', value: 573.15 }    (tempf, index 1)
[3] = { name: 'v3_mflowj', value: -200.0 }   (mflowj, index 2)

↓ transformPlotData()

plotData:
{ time: 100.5, v0: 2.5e6, v1: 573.15, v2: -200.0 }

↓ chartConfigBuilder

chartData:
{ 
  time: 100.5,
  p_280070000: 2.5e6,
  tempf_300000000: 573.15,
  mflowj_400000000: -200.0
}
```

### useLiveNodeValues 매핑

```
minorEdits[i] (sorted by cardNumber):
  - variableType: 'p' (pressure)
  - parameter: 280070000
  
↓

CCC 추출: '280070000' → '280'

↓

cccToNodeMap.get('280') → nodeId = 'node-001'

↓

latestMinorEdit.values[i + 1] → { name, value }

↓

bufKey = 'node-001_pressure' → TimeSeriesPoint[]

↓

SimulationValues[nodeId][dataKey] = series
```

---

## 6. 타입 버전 관리

### 레거시 데이터 마이그레이션

| 레거시 | 신규 | 상태 |
|---|---|---|
| `project.data.nodes` | `project.data.models[].nodes` | ✅ 자동 마이그레이션 |
| `project.data.edges` | `project.data.models[].edges` | ✅ 자동 마이그레이션 |
| `project.data.globalSettings` | `project.data.models[].settings` | ✅ 자동 마이그레이션 |
| `project.data.metadata.scope` | `project.data.totalScope` | ✅ 자동 마이그레이션 |
| `project.category` | (제거) | ⚠️ Deprecated, 향후 삭제 예정 |

마이그레이션은 `projectMigration.ts`의 `migrateProjectData()` 함수에서 처리됩니다.

---

## 7. 반정규화 필드

프로젝트 성능/UX 최적화를 위해 다음 필드들은 의도적으로 반정규화됩니다:

| 반정규화 필드 | 원본 | 사유 |
|---|---|---|
| `RestartSource.projectName` | `Project.name` | RESTART 카드 표시 시 프로젝트명 필요 |
| `RestartSource.modelName` | `Model.name` | RESTART 카드 표시 시 모델명 필요 |
| `ProjectSummary.nodeCount` | `Project.data.nodes.length` | 목록 페이지에서 카운트 표시 |
| `SimulationEntry.duration` | 계산값 | 히스토리에서 빠른 표시 |

---

## 8. 참고 링크

| 파일 | 목적 | 경로 |
|---|---|---|
| 접근 타입 정의 | Supabase DB 트리 | [supabase.ts](./supabase.ts) |
| 시뮬레이션 타입 | 작업/데이터 | [simulation.ts](./simulation.ts) |
| MARS 타입 | 모델/노드 | [mars.ts](./mars.ts) |
| 마이그레이션 로직 | 레거시 변환 | [../utils/projectMigration.ts](../utils/projectMigration.ts) |
