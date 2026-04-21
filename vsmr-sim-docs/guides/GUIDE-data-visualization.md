# GUIDE-data-visualization: 시뮬레이션 데이터 가시화 조건 가이드

> **Created**: 2026-04-01
> **Related**: FEAT-alarm-improvement, FEAT-interactive-node-widgets

---

## 1. 데이터의 유일한 원천

BFF gRPC Stream에서 수신하는 **MinorEdit Snapshot**이 유일한 실시간 데이터 소스입니다 (ICV 폴링 제외).

```
BFF gRPC Stream
     |
     onMinorEdit(snapshot)
     |
     snapshot = {
       timehy: 45300,                              // 시뮬레이션 시간 (ms)
       values: [
         { name: "rktpow_0",        value: 3.2e9 },   // v0
         { name: "p_280070000",     value: 15.5e6 },   // v1
         { name: "tempf_280010000", value: 573.2 },    // v2
         { name: "mflowj_280000001", value: 1205.3 },  // v3
         ...
       ]
     }
```

`values` 배열의 순서와 내용은 **프로젝트의 Minor Edit 정의**(`metadata.globalSettings.minorEdits`)에 의해 결정됩니다.

---

## 2. 가시화 가능 여부의 공식

```
가시화 가능한 데이터 목록 = Minor Edit 정의 목록
```

Minor Edit가 정의되어 있으면 BFF가 해당 값을 스트리밍합니다. 정의되어 있지 않으면 데이터가 없습니다.

```typescript
const availableData = (runtimeMinorEdits ?? metadata.globalSettings?.minorEdits ?? [])
  .sort((a, b) => a.cardNumber - b.cardNumber)
  .map((edit, index) => ({
    index,                                          // plotData에서 v{index}로 접근
    variableType: edit.variableType,                // p, tempf, mflowj, rktpow, cntrlvar...
    parameter: edit.parameter,                      // 280070000, 0, 324...
    plotDataKey: `v${index}`,                       // plotData[i][`v${index}`]
    chartDataKey: `${edit.variableType}_${edit.parameter}`, // DynamicChartGrid용
    editGroup: edit.editGroup,
    comment: edit.comment,
  }));
```

---

## 3. 두 갈래 데이터 경로

하나의 MinorEdit Snapshot이 수신되면 **두 경로로 분기**됩니다.

```
BFF 스트림 (MinorEdit Snapshot)
     |
     +-- (1) PlotData 경로 (차트용)
     |     parseMinorEditSnapshot()
     |     -> { time, v0, v1, v2... }
     |     -> simulationStore.plotData (최대 3000개)
     |     -> DynamicChartGrid -> ChartCard에 표시
     |
     +-- (2) LiveNodeValues 경로 (위젯/알람용)
           useLiveNodeValues()
           -> CCC 매칭 -> { nodeId: { pressure: TimeSeries[] } }
           -> MiniChartWidget에 표시
           -> scenarioAlarmEngine이 평가
```

### 경로 (1): PlotData — 차트용

| 항목 | 내용 |
|------|------|
| 저장소 | `simulationStore.plotData: PlotData[]` |
| 키 형식 | `v{index}` (Minor Edit 정의 순서 기반) |
| 변환 | DynamicChartGrid에서 `v{i}` -> `{variableType}_{parameter}` 재매핑 |
| 커버리지 | **Minor Edit에 정의된 모든 변수** (누락 없음) |
| 제한 | 최대 3000 포인트 (오래된 데이터 자동 제거) |

### 경로 (2): LiveNodeValues — 위젯/알람용

| 항목 | 내용 |
|------|------|
| 저장소 | `simulationStore.latestMinorEdit` (최신 1개 스냅샷만) |
| 변환 | `useLiveNodeValues` 훅에서 CCC 매칭 -> nodeId + dataKey |
| 커버리지 | **CCC 매칭 성공 + enabledWidgetNodes인 노드만** |
| 제한 | TimeSeries 최대 60 포인트, 매핑 가능한 변수 타입만 |

---

## 4. 변수 타입별 지원 현황

### 4.1 Minor Edit 변수 타입 전체 (MinorEditVariableType)

| 변수 타입 | 설명 | Parameter | 차트 경로 | 위젯 경로 | 알람 |
|-----------|------|-----------|:---------:|:---------:|:----:|
| `p` | 압력 | Volume ID (9자리) | O | O (`pressure`) | O |
| `tempf` | 유체 온도 | Volume ID | O | O (`temperature`) | O |
| `tempg` | 기체/증기 온도 | Volume ID | O | O (`temperature`) | O |
| `mflowj` | 총 질량유량 | Junction ID | O | O (`flowRate`) | O |
| `mflowfj` | 액체 질량유량 | Junction ID | O | X | X |
| `mflowgj` | 증기 질량유량 | Junction ID | O | X | X |
| `voidf` | 공극률 | Volume ID | O | O (`voidFraction`) | X |
| `flenth` | 유체 엔탈피 | Volume ID | O | X | X |
| `rktpow` | 원자로 출력 | 0 | O | X (매핑 없음) | X |
| `rkmodd` | 감속재 밀도 | 0 | O | X | X |
| `rkscram` | 스크램 반응도 | 0 | O | X | X |
| `rkdopp` | 도플러 반응도 | 0 | O | X | X |
| `rkreac` | 총 반응도 | 0 | O | X | X |
| `cntrlvar` | 제어변수 | CV 번호 | O | △ (CV 참조 추적) | X |
| `turpow` | 터빈 출력 | Turbine ID | O | X | X |
| `time` | 시간 | 0 | O | X | X |

### 4.2 위젯 경로 매핑 테이블

`useLiveNodeValues.ts`의 `VAR_TYPE_TO_DATA_KEY`:

```typescript
const VAR_TYPE_TO_DATA_KEY = {
  p:      'pressure',
  tempf:  'temperature',
  tempg:  'temperature',
  mflowj: 'flowRate',
  voidf:  'voidFraction',
};
```

이 테이블에 없는 변수 타입(`rktpow`, `cntrlvar`, `mflowfj`, `flenth` 등)은 위젯 경로에서 **스킵**됩니다.

### 4.3 ICV (Interactive Control Variable) 경유 데이터

PlotData가 아닌 별도 폴링으로 수신:

| ICV 타입 | 위젯 dataKey | 비고 |
|----------|-------------|------|
| `ICVType.VALVE` | `valvePosition` (%), `valveMode` | 밸브 전용 |
| `ICVType.FLOWF/FLOWG` | `flowRate` | 유량 오버라이드 |
| `ICVType.TMDPV` | `pressure` | 시간종속 볼륨 |

---

## 5. 위젯 경로의 3중 조건

위젯에 데이터가 표시되려면 **3가지 조건이 모두 충족**되어야 합니다:

```
조건 1: Minor Edit 정의 존재
   해당 변수(p, tempf 등)에 대한 Minor Edit가 프로젝트에 설정되어 있어야
   BFF가 값을 스트리밍

조건 2: CCC 매칭 성공
   Minor Edit의 parameter CCC가 캔버스 노드의 componentId CCC와 일치
   - Hydrodynamic (7자리 이하): 앞 3자리 (예: 280070000 -> 280)
   - Heat Structure (8자리): 앞 4자리 (예: 12800100 -> 1280)

조건 3: 위젯 노드 활성화
   enabledWidgetNodes에 해당 노드가 포함
   (autoEnabledNodeIds로 자동 활성화 또는 사용자 수동 추가)
```

---

## 6. 컴포넌트별 위젯 지원 현황

`getAvailableWidgets()` + `generateWidgetConfigsForEnabledNodes()`에서 정의:

| 컴포넌트 타입 | 위젯 | dataKey |
|--------------|------|---------|
| `snglvol` | P, T | `pressure`, `temperature` |
| `tmdpvol` | P, T | `pressure`, `temperature` |
| `branch` | P, T | `pressure`, `temperature` |
| `pump` | P, T | `pressure`, `temperature` |
| `turbine` | P, T | `pressure`, `temperature` |
| `pipe` | P | `pressure` |
| `sngljun` | W | `flowRate` |
| `tmdpjun` | W | `flowRate` |
| `mtpljun` | W | `flowRate` |
| `valve` (trpvlv) | Mode | `valveMode` |
| `valve` (non-trip) | Pos | `valvePosition` |
| `htstr` | T | `temperature` |
| `tank` | P, T | `pressure`, `temperature` |
| `separatr` | P, T | `pressure`, `temperature` |

**위젯 미지원 (default: [])**: 없음 (모든 주요 타입 커버)

---

## 7. ICV 탭 가시화 노드 강조 (monitoredNodeIds)

### 판별 로직

`InteractiveControlView`에서 `monitoredNodeIds`를 계산:

1. 모든 노드를 순회하며 `getAvailableWidgets() != []`인 노드만 CCC 맵에 등록
2. Minor Edit 정의를 순회하며 `parameter`의 CCC가 맵에 존재하면 `monitoredNodeIds`에 추가
3. 대상 변수 타입: `p`, `tempf`, `tempg`, `mflowj`, `mflowfj`, `mflowgj`, `voidf`, `flenth`

### 시각적 강조

| 노드 상태 | 표현 |
|----------|------|
| 데이터 흐름 + **위젯 미활성** | 파란 글로우(pulse 애니메이션) + 우상단 뱃지 |
| 데이터 흐름 + **위젯 활성** | 위젯이 이미 표시됨 (글로우/뱃지 없음) |
| 데이터 없음 | 변화 없음 |

### CCC 매칭 주의사항

| 컴포넌트 | componentId 자릿수 | CCC 추출 | 비고 |
|----------|:------------------:|----------|------|
| Hydrodynamic (snglvol, pipe 등) | 7자리 이하 | 앞 3자리 | Minor Edit parameter도 3자리로 매칭 |
| Heat Structure (htstr) | 8자리 | 앞 4자리 | Minor Edit의 volume ID CCC(3자리)와 **직접 매칭 불가** |

Heat Structure는 자체 componentId의 CCC 체계가 다르므로, Minor Edit의 volume 기반 CCC와 직접 매칭되지 않습니다. HS가 연결된 volume을 통한 간접 매칭이 필요합니다 (미구현).

---

## 8. 가시화 확장 로드맵

### 현재 상태 요약

```
                  PlotData 경로        LiveNodeValues 경로     알람
p, tempf, mflowj     O                      O                  O
voidf                 O                      O                  X (미등록)
rktpow                O                      X (매핑 없음)       X
cntrlvar              O                      triangle (간접)            X
valvePosition         X (ICV 경유)           O (ICV)            O
mflowfj/mflowgj      O                      X                  X
flenth, turpow        O                      X                  X
rk* (반응도 등)        O                      X                  X
```

### 데이터 소스 통합 (P2) 시 변경

PlotData 경로의 `v{i}` 데이터를 알람 엔진에도 공급하면:

- **voidf, rktpow, cntrlvar** 등도 알람 가능
- 위젯 활성화 없이도 알람 동작
- Alarm Dashboard 그래프에 실제 데이터 표시

---

## 9. 관련 파일 맵

| 파일 | 역할 |
|------|------|
| `src/types/mars.ts` (L1923-1973) | `MinorEditVariableType`, `MinorEdit` 타입 정의 |
| `src/types/interactive.ts` (L73-109) | `getAvailableWidgets()` — 컴포넌트별 가용 위젯 |
| `src/hooks/useSimulationData.ts` (L270-309) | `parseMinorEditSnapshot()` — PlotData 변환 |
| `src/hooks/useLiveNodeValues.ts` (L29-35, L224-266) | `VAR_TYPE_TO_DATA_KEY`, MinorEdit 매핑 |
| `src/stores/simulationStore.ts` (L141-164) | `appendPlotData`, `setLatestMinorEdit` |
| `src/components/simulation/DynamicChartGrid.tsx` (L361-403) | `v{i}` -> `{type}_{param}` 변환 |
| `src/components/interactive/InteractiveControlView.tsx` (L94-204) | `generateWidgetConfigsForEnabledNodes` |
| `src/components/interactive/InteractiveControlView.tsx` (L609-644) | `monitoredNodeIds` 계산 |
| `src/components/interactive/withNodeWidgets.tsx` (L134-198) | 글로우/뱃지 렌더링 |
