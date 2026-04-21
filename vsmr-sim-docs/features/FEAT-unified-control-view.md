---
title: "FEAT-unified-control-view"
status: planned
phase: 4
last_updated: 2026-04-03
---

# FEAT-unified-control-view

## Unified Control View (통합 제어 뷰)

> **Status**: ⏳ Design
> **Created**: 2026-03-27
> **Screen ID**: SIM-003
> **Branch**: (미정)
> **선행 조건**: InteractiveControlView (SIM-002) 기능 정상 동작

---

## 1. 개요

### 1.1 배경

현재 SimulationPage는 **Simulation Monitoring** 탭과 **Interaction Control** 탭이 분리되어 있다. 원자로 설계자가 ICV(Interactive Control Variable)를 조작한 후 결과를 확인하려면 Monitoring 탭으로 전환해야 하며, 이 과정에서:

- 탭 전환으로 인한 **집중도 하락**
- 조작한 ICV가 **어떤 차트에 영향을 주는지 알 수 없음** (비전문가 이슈)
- 노드 위젯이 제한된 변수만 표시하여 **데이터 가시성 부족**
- 핵심 변수를 한 곳에서 모아보기 **불가**

### 1.2 목표

기존 탭을 수정하지 않고, **별도의 "Unified Control" 탭**을 신규 추가하여 통합 레이아웃의 사용성을 테스트한다.

### 1.3 도메인 근거

원전 제어실 HMI 설계 표준 및 연구에 기반한 설계 원칙:

| 원칙 | 근거 | 적용 |
|------|------|------|
| **공간적 맥락 우선** | NUREG-0700: 운전원은 P&ID(Process Mimic) 기반 공간 표시에서 60-70% 시간 소비 | FlowCanvas를 주 뷰로 유지 |
| **제어-피드백 근접** | NUREG/CR-6633: 제어 조작의 피드백은 같은 화면에서 1-click 이내 접근 | ICV 조작 시 관련 차트를 캔버스 위/옆에 인라인 표시 |
| **점진적 공개** | ISO 11064: 개요 먼저, 상세는 필요 시 | 노드 위젯(개요) → 클릭 시 상세 차트(Detail) |
| **상황 인식 3단계** | Endsley(1995): 인지→이해→예측 | 현재값(L1) + 임계치 대비(L2) + 트렌드(L3) |
| **알람 공간 연계** | NUREG/CR-6105: 알람은 프로세스 디스플레이의 해당 위치에서 표시 | 노드 테두리 색상 코딩 + 알람 바 |
| **정보 밀도 관리** | NUREG-0700: 동시 모니터링 파라미터 5-9개 이내 | Pinned Variables 패널 최대 표시 제한 |

---

## 2. 범위

### 2.1 In Scope (1차 프로토타입)

| ID | 기능 | 설명 |
|----|------|------|
| UC-01 | **통합 레이아웃** | FlowCanvas + 우측 패널 + Bottom Drawer를 하나의 화면에 배치 |
| UC-02 | **ICV 연동 차트** | ICV 조작 시 관련 차트를 자동 선정하여 인라인 표시 |
| UC-03 | **Bottom Drawer** | DynamicChartGrid + LiveLogViewer를 토글 가능한 하단 드로어로 배치 |
| UC-04 | **우측 패널 재구성** | Alarms/ICV Controls 탭 + Pinned Variables 탭 |

### 2.2 In Scope (2차 확장)

| ID | 기능 | 설명 |
|----|------|------|
| UC-05 | **변수 탐색기** | TelemetryValues API 활용, 노드별 출력 가능 변수 목록 표시 |
| UC-06 | **차트 강화** | 임계치 밴드, 범례 색상/투명도, 최대화 모달 |
| UC-07 | **ICV 조작 시점 마커** | 차트에 수직선 + 라벨로 조작 이력 표시 |

### 2.3 Out of Scope

- 기존 Simulation Monitoring 탭 수정
- 기존 Interaction Control 탭 수정
- Monitoring 탭 고도화 (별도 Feature로 분리)
- 새로운 BFF API 개발 (기존 TelemetryValues, GetTelemetries 활용)

---

## 3. 화면 구성

### 3.1 전체 레이아웃

```
┌─ SimulationPage ──────────────────────────────────────────────────┐
│ ┌─Sidebar─┐ ┌─Header──────────────────────────────────────────┐  │
│ │ Monitor │ │ 프로젝트명 │ ▶Pause│Speed│ [알람: 🟢3 🟡1 🔴0] │  │
│ │ Control │ ├──────────────────────────────────────────────────┤  │
│ │★Unified │ │                                                  │  │
│ │ Analysis│ │                                                  │  │
│ └─────────┘ │   ┌─ FlowCanvas ──────────────┐  ┌─RightPanel─┐│  │
│             │   │                            │  │[🔔][📌]    ││  │
│             │   │  (read-only P&ID 캔버스)    │  │            ││  │
│             │   │  + 노드 위젯               │  │ Alarms/ICV ││  │
│             │   │  + ICV 연동 차트 팝오버     │  │  or        ││  │
│             │   │                            │  │ Pinned Vars││  │
│             │   │                            │  │            ││  │
│             │   └────────────────────────────┘  └────────────┘│  │
│             │                                                  │  │
│             │ ┌─ Bottom Drawer (토글) ────────────────────────┐│  │
│             │ │ ═══ 드래그 핸들 ═══         [Charts][Logs][▲▼]││  │
│             │ │  DynamicChartGrid / LiveLogViewer              ││  │
│             │ └───────────────────────────────────────────────┘│  │
│             │ ┌─ SimulationControlBar ────────────────────────┐│  │
│             │ └───────────────────────────────────────────────┘│  │
│             └──────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 영역별 크기 및 동작

| 영역 | 기본 크기 | 동작 |
|------|----------|------|
| FlowCanvas | 가용 영역 전체 (Drawer 축소 시) | fitView, read-only, 위젯 표시 |
| RightPanel | 폭 300px, 접기 가능 (→ 0px) | 탭 전환: Alarms/ICV ↔ Pinned |
| Bottom Drawer | 축소: 48px (헤더만) / 확대: 40% | 드래그 리사이즈, PanelGroup 재활용 |
| ControlBar | 고정 48px | 기존 SimulationControlBar 그대로 |

---

## 4. 기능 상세

### 4.1 UC-01: 통합 레이아웃

**목적**: 캔버스 + 제어 + 차트를 하나의 화면에서 접근

**구현**:
- `SimulationPage.tsx`에 새 `activeView` 값 `'unified'` 추가
- 사이드바에 "Unified Control" 메뉴 항목 추가
- 새 컴포넌트: `UnifiedControlView.tsx`
- 기존 컴포넌트 **재활용**: InteractiveControlView의 캔버스/위젯 로직, SidePanel, DynamicChartGrid, LiveLogViewer

**레이아웃 구조**:
```tsx
<UnifiedControlView>
  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Header + AlarmPanel */}
    <AlarmPanel />

    {/* Main: Canvas + RightPanel */}
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <FlowCanvas />           {/* 기존 InteractiveControlView의 캔버스 */}
      <UnifiedRightPanel />     {/* 새 우측 패널 */}
    </Box>

    {/* Bottom Drawer */}
    <BottomDrawer>
      <DynamicChartGrid />      {/* 기존 차트 그리드 재활용 */}
      <LiveLogViewer />         {/* 기존 로그 뷰어 재활용 */}
    </BottomDrawer>

    {/* Control Bar */}
    <SimulationControlBar />
  </Box>
</UnifiedControlView>
```

---

### 4.2 UC-02: ICV 연동 차트 (핵심 기능)

**목적**: ICV 조작 시 관련 변수의 차트를 자동 선정하여 캔버스 위에 인라인 표시

#### 4.2.1 관련 차트 자동 추론 로직

ICV 조작 시 어떤 차트를 보여줄지 결정하는 로직. **ReactFlow 엣지(연결) 정보**를 활용하여 도메인 지식 없이도 관련 노드를 추론한다.

```
ICV 조작 이벤트 발생 (예: Valve CCC=291 개도 변경)
│
├─ 1단계: 해당 노드 자신의 변수
│   └─ componentType별 주요 변수:
│       VALVE → valvePosition (%)
│       PUMP → pressure, temperature
│       TMDPVOL → pressure
│
├─ 2단계: ReactFlow 엣지로 연결된 인접 노드의 변수 (depth=1)
│   ├─ source 방향 (상류): 해당 Volume의 pressure
│   └─ target 방향 (하류): 해당 Junction의 flowRate
│
└─ 3단계: MinorEdit에 정의된 변수 중 같은 CCC를 가진 항목
    └─ minorEdits.filter(me => extractCCC(me.parameter) === icvCCC)
```

**MARS 도메인 근거**:
- MARS에서 밸브/펌프 등의 ICV 조작은 **직접 연결된 Volume/Junction**의 유체 상태(압력, 온도, 유량)에 즉각적 영향
- ReactFlow의 엣지 = MARS의 유체 네트워크 연결 → 엣지 기반 탐색이 물리적으로 유효
- CCC(Component Control Code) 3자리가 같으면 같은 Hydrodynamic 컴포넌트에 속함

#### 4.2.2 ICV 연동 차트 표시 UI

```
ICV 조작 발생
  ↓
┌─ ICV Impact Panel (캔버스 우상단 또는 조작 노드 근처) ──────────┐
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 ICV Action: Valve C291 (pzrpsv1) 개도 50% → 80%        │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ┌─ C291 Valve Position ─────────┐                          │ │
│ │ │  80% ━━━━━━━━━━━━━━━━━━━━┐   │                          │ │
│ │ │  50% ─────────────────┘      │  ← 조작 시점에 수직 마커  │ │
│ │ │       0s  10s  20s  30s      │                          │ │
│ │ └──────────────────────────────┘                          │ │
│ │ ┌─ C130 Pressure (상류) ────────┐                          │ │
│ │ │  15.5 MPa  ╱╲╱╲_╱╲╱╲       │                          │ │
│ │ └──────────────────────────────┘                          │ │
│ │ ┌─ C261 Flow Rate (하류) ───────┐                          │ │
│ │ │  125 kg/s  ╲_╱╲╱╲╱╲╱       │                          │ │
│ │ └──────────────────────────────┘                          │ │
│ │                                                            │ │
│ │ [📌 Pin to Panel]  [📊 Show in Drawer]  [✕ Close]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**동작**:
- ICV 값 변경 시 자동으로 표시 (3-5초 후 자동 축소, 또는 사용자가 닫기)
- `📌 Pin to Panel`: Pinned Variables 패널에 해당 변수 추가
- `📊 Show in Drawer`: Bottom Drawer를 열고 해당 차트로 스크롤
- `✕ Close`: 닫기
- 최대 3개 차트 동시 표시 (정보 밀도 관리, ISO 11064 7±2 원칙)

#### 4.2.3 ICV Type별 연관 변수 매핑

| ICV Type | 자체 변수 | 상류(source) 노드 변수 | 하류(target) 노드 변수 |
|----------|----------|---------------------|---------------------|
| VALVE | valvePosition (%) | pressure (MPa) | flowRate (kg/s) |
| FLOWF | flowRate (kg/s) | pressure (MPa) | pressure (MPa) |
| FLOWG | flowRate (kg/s) | pressure (MPa) | pressure (MPa) |
| TMDPV | pressure (MPa) | - | flowRate (kg/s) |
| HEATER | power (MW) | temperature (K) | temperature (K) |
| TRIP | tripStatus (T/F) | (trip 대상 컴포넌트의 주요 변수) | - |
| REACTIVITY | reactivity ($) | rktpow (MW) | - |
| CNTRLVAR | cntrlvar (무차원) | (CV가 참조하는 변수) | - |

**TRIP의 특수 처리**: Trip은 특정 컴포넌트가 아닌 시스템 전체에 영향을 줄 수 있으므로, Trip과 연결된 Control Variable이나 Valve를 추적하여 관련 차트를 선정한다. 1차 프로토타입에서는 Trip 연동 차트는 미구현으로 두고, VALVE/FLOW/TMDPV만 지원한다.

---

### 4.3 UC-03: Bottom Drawer

**목적**: DynamicChartGrid와 LiveLogViewer를 토글 가능한 하단 드로어로 배치

**동작**:
| 상태 | 높이 | 내용 |
|------|------|------|
| 축소 (기본) | 48px | 탭 헤더만 표시: `[Charts] [Logs]` + `[▲ 펼치기]` |
| 확대 | 40% (드래그 조절 가능) | 선택된 탭의 컨텐츠 표시 |
| 최대화 | 80% | 캔버스를 최소화하고 차트/로그 집중 |

**구현**:
- 기존 `PanelGroup` (react-resizable-panels) 재활용
- 축소 시 `minSize={5}` (헤더만), 확대 시 `defaultSize={40}`
- 탭 전환: Charts ↔ Logs (MUI Tabs)
- DynamicChartGrid, LiveLogViewer는 기존 컴포넌트 그대로 사용

**시뮬레이션 시작 시**: Drawer 자동 확대 (사용자가 즉시 차트 확인 가능)
**ICV 조작 시**: Drawer가 축소 상태면 그대로 유지 (ICV Impact Panel이 캔버스 위에서 보여주므로)

---

### 4.4 UC-04: 우측 패널 재구성

**목적**: 기존 4-아코디언 패널 → 목적별 2-탭 패널

#### 탭 A: Alarms & Control

```
┌─ Alarms & Control ────────────────────┐
│                                        │
│ ── Active Monitors ──                  │
│ 🟢 LOCA 감시     P < 12.0 MPa  ━━━░  │  ← 프로그레스 바: 현재값/임계치
│ 🟢 과압 경고     P > 16.5 MPa  ━━░░  │
│ 🟢 펌프 고장     W < 50 kg/s   ━░░░  │
│                                        │
│ ── ICV Controls ──                     │
│ ┌──────────────────────────────────┐  │
│ │ Valve C291 (pzrpsv1)            │  │
│ │ Mode: [AUTO ▼]  Pos: 50%  [━━] │  │
│ │ Target: [____]  Rate: [____]    │  │
│ ├──────────────────────────────────┤  │
│ │ Trip #501                       │  │
│ │ [AUTO] [MAN(T)] [MAN(F)]       │  │
│ ├──────────────────────────────────┤  │
│ │ Flow C280                       │  │
│ │ Current: 125.3 kg/s             │  │
│ │ Target: [____]  Rate: [____]    │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ── System KPI ──                       │
│ Avg P: 15.52 MPa  Avg T: 290°C       │
│ Total W: 1250 kg/s                    │
└────────────────────────────────────────┘
```

#### 탭 B: Pinned Variables

```
┌─ Pinned Variables ─────────────────────┐
│ ★ 핵심 변수 (4/20)        [+ 추가] [⚙]│
│                                        │
│ ┌─ C130 압력 ────────────────────────┐ │
│ │ 15.52 MPa  ▲0.03  ╱╲╱╲_╱╲       │ │
│ │ [범위: 14.0 - 17.0]    [✕ 제거]   │ │
│ └────────────────────────────────────┘ │
│ ┌─ C261 유량 ────────────────────────┐ │
│ │ 125.3 kg/s  ▼2.1  ╲_╱╲╱╲╱       │ │
│ │ [범위: 50 - 200]       [✕ 제거]   │ │
│ └────────────────────────────────────┘ │
│ ┌─ C291 밸브개도 ────────────────────┐ │
│ │ 50.0%  ━━━  ─────────┐           │ │
│ └────────────────────────────────────┘ │
│ ┌─ rktpow 원자로출력 ────────────────┐ │
│ │ 2815 MW  ▲12  ╱╱╱╱╱╱╱╱          │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [+ 추가] → 변수 탐색기 열기 (2차)     │
└────────────────────────────────────────┘
```

**Pinned Variable 카드 구성**:
- 컴포넌트 이름 + 변수명
- 현재값 (모노스페이스, 컬러 코딩)
- 변화 방향 화살표 (▲/▼/━): 직전 값 대비
- 미니 스파크라인 (최근 60포인트)
- 임계치 범위 표시 (설정 시)
- 제거 버튼

**데이터 소스**: 기존 `useLiveNodeValues` 훅의 `simulationValues` 재활용 + MinorEdit 스트림

---

## 5. 데이터 흐름

### 5.1 기존 데이터 파이프라인 (변경 없음)

```
MARS Adapter → Kafka → BFF Redis → Connect RPC → Web Client
                                                      ↓
                                    ┌─ MinorEdit Stream (plotData)
                                    ├─ TelemetryValues Stream (노드 변수)
                                    ├─ ICV Polling (gRPC MOD06)
                                    └─ SimState Stream (상태/속도)
```

### 5.2 UnifiedControlView 데이터 소비

```
UnifiedControlView
  ├─ useLiveNodeValues()      → 노드별 simulationValues (위젯 + Pinned)
  ├─ useICVPolling()          → ICV 엔트리 + Trip 엔트리 (Controls 탭)
  ├─ useLiveData()            → plotData (Bottom Drawer 차트)
  ├─ useLatestMinorEdit()     → MinorEdit 스냅샷 (차트 생성)
  └─ evaluateAllScenarios()   → 알람 평가 (Alarm 표시)
```

### 5.3 ICV Impact Panel 데이터 흐름

```
ICV SetValue 호출
  ↓
onICVChanged 콜백 (nodeId, icvType, oldValue, newValue)
  ↓
getRelatedChartVariables(nodeId, icvType, edges)
  ├─ 자체: componentType → 주요 변수
  ├─ 인접: edges.filter(source/target === nodeId) → 인접 노드 변수
  └─ MinorEdit: CCC 매칭
  ↓
ICV Impact Panel 렌더링
  ├─ 자체 변수 미니차트
  ├─ 인접 노드 변수 미니차트 (최대 2개)
  └─ 조작 시점 마커 (현재 시뮬레이션 시간)
```

---

## 6. 컴포넌트 구조

### 6.1 신규 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| `UnifiedControlView` | `src/components/unified/UnifiedControlView.tsx` | 최상위 레이아웃 컴포넌트 |
| `UnifiedRightPanel` | `src/components/unified/UnifiedRightPanel.tsx` | 우측 패널 (2-탭) |
| `AlarmsControlTab` | `src/components/unified/AlarmsControlTab.tsx` | 알람 모니터 + ICV 제어 탭 |
| `PinnedVariablesTab` | `src/components/unified/PinnedVariablesTab.tsx` | 핀된 변수 모아보기 탭 |
| `PinnedVariableCard` | `src/components/unified/PinnedVariableCard.tsx` | 개별 핀 변수 카드 |
| `BottomDrawer` | `src/components/unified/BottomDrawer.tsx` | 하단 드로어 (Charts/Logs) |
| `ICVImpactPanel` | `src/components/unified/ICVImpactPanel.tsx` | ICV 연동 차트 팝오버 |
| `ActiveMonitorList` | `src/components/unified/ActiveMonitorList.tsx` | 알람 조건 상시 표시 |

### 6.2 재활용 컴포넌트

| 기존 컴포넌트 | 재활용 방식 |
|-------------|-----------|
| `InteractiveControlView` 내부 캔버스 로직 | 위젯/데이터 훅 로직 추출하여 공유 |
| `interactiveNodeTypes` | 그대로 import |
| `withNodeWidgets` HOC | 그대로 사용 |
| `WidgetPortalOverlay` | 그대로 사용 |
| `AlarmPanel` | 그대로 import |
| `DynamicChartGrid` | Bottom Drawer에서 import |
| `LiveLogViewer` | Bottom Drawer에서 import |
| `SimulationControlBar` | 하단에 그대로 배치 |
| `SidePanel` 내 TripControlContent, ICVControlContent | 추출하여 AlarmsControlTab에서 사용 |

---

## 7. 상태 관리

### 7.1 신규 상태 (UnifiedControlView 로컬)

```typescript
// 우측 패널
const [rightPanelTab, setRightPanelTab] = useState<'alarms' | 'pinned'>('alarms');
const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

// Bottom Drawer
const [drawerExpanded, setDrawerExpanded] = useState(false);
const [drawerTab, setDrawerTab] = useState<'charts' | 'logs'>('charts');

// ICV Impact Panel
const [icvImpact, setIcvImpact] = useState<ICVImpactState | null>(null);

// Pinned Variables
const [pinnedVariables, setPinnedVariables] = useState<PinnedVariable[]>([]);
```

### 7.2 Pinned Variables 영속화

```typescript
interface PinnedVariable {
  id: string;                    // 고유 ID
  nodeId: string;                // 노드 ID
  dataKey: string;               // 변수 키 (pressure, flowRate, etc.)
  label: string;                 // 표시명
  unit: string;                  // 단위
  thresholdLow?: number;         // 하한 임계치
  thresholdHigh?: number;        // 상한 임계치
  order: number;                 // 정렬 순서
}
```

저장 위치: `metadata.globalSettings.pinnedVariables` (기존 store persist 활용)

### 7.3 ICV Impact State

```typescript
interface ICVImpactState {
  icvEntry: GeneralICVEntry;     // 조작된 ICV
  nodeId: string;                // 해당 노드 ID
  oldValue: number;              // 이전 값
  newValue: number;              // 새 값
  timestamp: number;             // 조작 시점 (timehy)
  relatedVariables: RelatedVar[]; // 자동 추론된 관련 변수
  dismissed: boolean;            // 사용자가 닫았는지
}

interface RelatedVar {
  nodeId: string;
  nodeName: string;
  dataKey: string;
  unit: string;
  relation: 'self' | 'upstream' | 'downstream' | 'minorEdit';
}
```

---

## 8. 구현 단계

### Phase 1: 기본 레이아웃 (1차 프로토타입)

| # | 작업 | 의존성 | 예상 난이도 |
|---|------|--------|-----------|
| 1-1 | `SimulationPage`에 `unified` 뷰 추가 + 사이드바 메뉴 | 없음 | 낮음 |
| 1-2 | `UnifiedControlView` 레이아웃 구성 (Canvas + RightPanel + Drawer) | 1-1 | 중간 |
| 1-3 | 기존 캔버스/위젯 로직을 공유 가능하게 리팩토링 | 1-2 | 중간 |
| 1-4 | `BottomDrawer` 구현 (PanelGroup 기반 토글) | 1-2 | 낮음 |
| 1-5 | `UnifiedRightPanel` 2-탭 구조 (Alarms/ICV + Pinned) | 1-2 | 낮음 |
| 1-6 | `AlarmsControlTab` (기존 SidePanel 로직 재활용) | 1-5 | 중간 |
| 1-7 | `ActiveMonitorList` (알람 조건 상시 표시 + 거리 프로그레스) | 1-6 | 중간 |
| 1-8 | `PinnedVariablesTab` + `PinnedVariableCard` 기본 구현 | 1-5 | 중간 |

### Phase 2: ICV 연동 차트

| # | 작업 | 의존성 | 예상 난이도 |
|---|------|--------|-----------|
| 2-1 | `getRelatedChartVariables()` 엣지 기반 추론 로직 | Phase 1 | 중간 |
| 2-2 | `ICVImpactPanel` UI 구현 | 2-1 | 중간 |
| 2-3 | ICV 조작 콜백에서 Impact Panel 트리거 연결 | 2-2 | 낮음 |
| 2-4 | Pin to Panel / Show in Drawer 연동 | 2-3, 1-8 | 낮음 |

### Phase 3: 차트 강화 (2차 확장)

| # | 작업 | 의존성 | 예상 난이도 |
|---|------|--------|-----------|
| 3-1 | 차트 임계치 밴드 (ReferenceArea) | Phase 1 | 중간 |
| 3-2 | 범례 강화 (색상/투명도/표시 토글) | Phase 1 | 중간 |
| 3-3 | 차트 최대화 모달 | Phase 1 | 낮음 |
| 3-4 | ICV 조작 시점 수직 마커 (ReferenceLine) | Phase 2 | 낮음 |
| 3-5 | 변수 탐색기 (TelemetryValues API 연동) | Phase 1 | 높음 |

---

## 9. 기술 고려사항

### 9.1 성능

- InteractiveControlView는 현재 `visible=false`여도 항상 마운트됨 (데이터 훅 유지)
- UnifiedControlView가 추가되면 **동일 데이터를 두 곳에서 구독**할 수 있음
  - 해결: `activeView === 'unified'`일 때 InteractiveControlView의 데이터 훅 비활성화
  - 또는 데이터 훅을 SimulationPage 레벨로 끌어올려 공유

### 9.2 캔버스 로직 공유

현재 `InteractiveControlViewInner`는 캔버스 + 위젯 + 알람 + ICV + 이벤트 로그를 모두 포함하는 ~1000줄 컴포넌트.

**리팩토링 전략**:
- 캔버스 + 위젯 렌더링 → `useInteractiveCanvas()` 커스텀 훅으로 추출
- ICV 폴링 + 알람 평가 → 이미 별도 훅 (`useICVPolling`, `useLiveNodeValues`)
- SidePanel의 TripControl, ICVControl → 별도 컴포넌트로 export

### 9.3 Bottom Drawer 구현

- `react-resizable-panels`의 PanelGroup(direction="vertical") 재활용
- 축소/확대 토글: Panel의 `collapse()` / `expand()` API 사용
- `onCollapse` / `onExpand` 콜백으로 상태 동기화

---

## 10. 수용 기준

### Phase 1 완료 기준

- [ ] Sidebar에서 "Unified Control" 클릭 → 통합 레이아웃 표시
- [ ] FlowCanvas에 기존 위젯 정상 표시 (위치, 드래그, 알람 색상)
- [ ] 우측 패널에서 Alarms/ICV ↔ Pinned 탭 전환
- [ ] ICV 제어 (Trip 모드 변경, Valve 값 설정) 정상 동작
- [ ] 알람 조건 목록이 현재값/임계치 거리와 함께 상시 표시
- [ ] Bottom Drawer 토글 (축소 ↔ 확대)
- [ ] Drawer Charts 탭에 DynamicChartGrid 정상 표시
- [ ] Drawer Logs 탭에 LiveLogViewer 정상 표시
- [ ] Pinned Variables에 수동으로 변수 추가/제거 가능
- [ ] Pinned 변수의 실시간 값 + 스파크라인 표시
- [ ] SimulationControlBar (Play/Pause/Speed) 정상 동작

### Phase 2 완료 기준

- [ ] ICV 값 변경 시 ICV Impact Panel 자동 표시
- [ ] Impact Panel에 자체 + 인접 노드 변수 차트 표시 (최대 3개)
- [ ] Pin to Panel 버튼 → Pinned Variables에 추가
- [ ] Show in Drawer 버튼 → Bottom Drawer 확대 + 해당 차트 스크롤

---

## 11. 향후 확장 (별도 Feature)

| 항목 | 설명 | Feature |
|------|------|---------|
| Monitoring 탭 고도화 | 히트맵, 다중 축 차트, 비교 분석 강화 | FEAT-monitoring-enhancement |
| 변수 탐색기 | TelemetryValues API 기반 전체 변수 브라우징 | FEAT-variable-explorer |
| 차트 프리셋 | 차트 레이아웃 저장/불러오기 | FEAT-chart-presets |
| ICV 매크로 | 여러 ICV를 한번에 조작하는 프리셋 | FEAT-icv-macros |

---

## 12. 참고 자료

### 원전 HMI 표준

| 문서 | 내용 | 관련 섹션 |
|------|------|----------|
| NUREG-0700 Rev.3 | Human-System Interface Design Review Guidelines | 4.1 Display, 4.3 Controls, 4.5 Alarms, 4.8 Trends |
| NUREG/CR-6633 | Advanced Information Systems Design | 제어-피드백 근접 원칙 |
| NUREG/CR-6684 | Advanced Alarm Systems | 알람 공간 연계 |
| IEC 61772 | NPP Main Control Room - VDU Application | 피드백 지연시간 기준 |
| ISO 11064 | Ergonomic Design of Control Centres | 정보 밀도 5-9 파라미터 |
| Endsley (1995) | Situation Awareness Model | 인지-이해-예측 3단계 |

### MARS 매뉴얼 참조

| 섹션 | 내용 | 관련 기능 |
|------|------|----------|
| 8.15 (p.156) | VALVE 컴포넌트 | ICV VALVE 타입 연관 변수 |
| 8.16 (p.166) | PUMP 컴포넌트 | ICV 펌프 제어 |
| 8.3 (p.56) | TMDPVOL 컴포넌트 | ICV TMDPV 타입 |
| 14 (p.245) | Control System | CNTRLVAR ICV 타입 |

### BFF API (기존)

| 엔드포인트 | 용도 |
|-----------|------|
| `TelemetryValues` (Kafka stream) | 전체 볼륨/접합부 변수 실시간 스트림 |
| `GetTelemetries` (InfluxDB) | 과거 데이터 시계열 조회 |
| `InteractiveControl` (MOD06) | ICV 조회/설정 |
| `MarsTaskStream.SubscribeMinorEdit` | MinorEdit 스트림 |
