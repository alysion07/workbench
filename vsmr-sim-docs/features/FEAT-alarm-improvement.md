---
title: "FEAT-alarm-improvement: 알람 시스템 개선"
status: done
phase: 4
branch: main
related_prs: [#81,#83]
last_updated: 2026-04-03
---

# FEAT-alarm-improvement: 알람 시스템 개선

> **Status**: ⏳ 설계 완료 / 구현 대기
> **Created**: 2026-04-01
> **Branch**: (미정)
> **Related**: FEAT-interactive-node-widgets, FEAT-widget-ux-improvement

---

## 1. 개요

시뮬레이션 알람 시스템의 **절충안** 접근:

1. **Global Alarm Bar** — simulationHeader 아래, 알람 인지용 얇은 바 (모든 탭)
2. **Alarm Dashboard 탭** — 별도 탭에 알람 관련 기능 집중 (그래프, 히스토리, 설정)
3. **기존 차트 수정 최소화** — ChartCard/TimeSeriesChart는 건드리지 않음

추가로 알람 데이터 소스 통합 및 기준 항목 확장을 포함.

### 접근 방식: 절충안 (Global Alarm Bar + 별도 탭)

- Global Alarm Bar: 최소한의 알람 인지 역할 (칩 + 카운트)
- 칩 클릭 → Alarm Dashboard 탭으로 이동
- 상세 확인/설정/threshold 그래프/히스토리는 전부 알람 탭에서
- 기존 Interactive Control의 AlarmPanel/SidePanel 알람 부분은 알람 탭으로 이전
- **기존 차트 컴포넌트 수정 없음** → 구현 리스크 최소화

---

## 2. 현재 상태 (Before)

### 2.1 알람 UI 위치

| 컴포넌트 | 위치 | 문제 |
|---------|------|------|
| AlarmPanel | Interactive Control 탭 내부 상단 | 다른 탭에서 안 보임 |
| SidePanel (알람 상세) | Interactive Control 탭 우측 | 다른 탭에서 안 보임 |
| MiniChartWidget | Interactive Control 노드 위젯 | 테두리/pulse만, threshold 라인 없음 |

### 2.2 알람 데이터 소스

현재 **Interactive 위젯 경로(useLiveNodeValues)만** 사용:
- 위젯 활성화된 노드 + CCC 매칭된 Minor Edit만 알람 평가 가능
- Simulation 차트 경로(PlotData)는 알람과 완전히 분리

### 2.3 알람 기준 항목 (dataKey)

| dataKey | 알람 등록 | 위젯 매핑 | 차트 출력 |
|---------|:--------:|:--------:|:--------:|
| pressure | O | O | O |
| temperature | O | O | O |
| flowRate | O | O | O |
| valvePosition | O | O (ICV) | X |
| voidFraction | **X** | O | O |
| rktpow (원자로출력) | **X** | **X** | O |
| cntrlvar (제어변수) | **X** | △ (간접) | O |

### 2.4 차트와 알람 연결

| 차트 | threshold 라인 | 초과 시 시각효과 |
|------|:-------------:|:--------------:|
| ChartCard (Simulation) | 없음 | 없음 |
| ChartSummaryCard | 없음 | 없음 |
| TimeSeriesChart (Analysis) | 없음 | 없음 |
| MiniChartWidget (Interactive) | 없음 | 테두리+배경+pulse |
| AlarmSettingsDialog | 없음 | 그래프 자체 없음 |

---

## 3. 요구사항 (After)

### 3.1 Global Alarm Bar

**위치**: `simulationHeader` 바로 아래 (contentHeader 확장)

```
┌─ AppLayout ─────────────────────────────────────────────┐
│ ┌─Sidebar─┐ ┌─simulationHeader──────────────────────┐  │
│ │         │ │ 프로젝트명 | ▶ QuickRun 🔄 📥 [에디터]│  │
│ │         │ ├─────────────────────────────────────────┤  │
│ │         │ │ ⚠️ Global Alarm Bar (새로 추가)         │  │
│ │         │ ├─────────────────────────────────────────┤  │
│ │         │ │                                         │  │
│ │         │ │  탭 컨텐츠 (Simulation/Interactive/...)  │  │
│ └─────────┘ └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**동작**:
- 정상: 바 자체를 숨김 (공간 0) 또는 녹색 얇은 라인
- Warning: 주황 바 + 시나리오 이름 칩 (기존 AlarmPanel과 유사)
- Danger: 빨간 바 + blink 애니메이션 + 시나리오 칩
- 칩 클릭 → Interactive Control 탭으로 전환 + 해당 시나리오 상세 표시

**기술 구현**:
- InteractiveControlView가 이미 항상 마운트됨 (visible prop으로 UI만 제어)
- `scenarioResults`를 SimulationPage 레벨로 전달 (콜백 또는 store)
- Global Alarm Bar 컴포넌트는 SimulationPage에서 직접 렌더링

### 3.2 Chart Threshold Overlay

**대상 차트**: ChartCard (Simulation), TimeSeriesChart (Analysis), MiniChartWidget (Interactive)

**표현**:
- Recharts `<ReferenceLine>` 사용
  - Warning: 주황색 점선 (`stroke="#ffa000" strokeDasharray="6 3"`)
  - Danger: 빨간색 실선 (`stroke="#f44336" strokeWidth={2}`)
- 라벨: threshold 값 표시 (예: "W 16.5 MPa", "D 17.2 MPa")
- 차트 카드 테두리: 현재 값이 threshold 초과 시 빨간색 blink

**dataKey 매핑** (차트 variableType → 알람 dataKey):

| 차트 variableType | 알람 dataKey | 단위 변환 |
|-------------------|-------------|----------|
| `p` | `pressure` | 차트: Pa, 알람: MPa → ×1e6 |
| `tempf` | `temperature` | 차트: K, 알람: °C → +273.15 |
| `mflowj` | `flowRate` | 동일 (kg/s) |
| `voidf` | `voidFraction` | 동일 |
| `rktpow` | `reactorPower` | 차트: W, 알람: (단위 TBD) |
| `cntrlvar` | `controlVariable` | 사용자 정의 |

**threshold 값 소스**: 알람 시나리오의 조건값을 역참조
- 시나리오에서 `pressure > 16.5 MPa` → 차트에 16.5×1e6 Pa 수평선
- 한계치 탭의 warningHigh/dangerHigh/warningLow/dangerLow도 포함

### 3.3 알람 설정 내 그래프 표출

**방식**: AlarmSettingsDialog를 확장하여 한계치 탭에 인라인 그래프 추가

**각 dataKey 행 구조** (기존: 숫자 입력만 → 개선 후):
```
┌─ 압력 (Pressure) MPa ─────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │  [실시간 미니 차트]                               │ │
│ │  ──── 현재값 추세 라인                            │ │
│ │  - - - Warning High (주황 점선)                   │ │
│ │  ──── Danger High (빨간 실선)                     │ │
│ │                                                   │ │
│ └─────────────────────────────────────────────────┘ │
│ Warning High: [16.0]  Danger High: [17.0]           │
│ Warning Low:  [___]   Danger Low:  [___]            │
└─────────────────────────────────────────────────────┘
```

**데이터 소스 (통합)**:
- Interactive 위젯의 `TimeSeriesPoint[]` (실시간, 최대 60포인트)
- Simulation 차트의 `PlotData[]` (최대 3000포인트)
- 두 경로 통합하여 가용한 데이터를 자동 선택

**그래프 기능**:
- threshold 입력값 변경 시 수평선 실시간 업데이트 (미리보기)
- 현재 값이 threshold를 초과하는 구간이 있으면 빨간색 하이라이트

---

## 4. 알람 데이터 소스 통합

### 4.1 통합 전략 (결정: C — 두 경로 통합)

```
                    ┌─────────────────┐
  MinorEdit Stream → │  PlotData Store │ → Simulation 차트
                    │  (v0, v1, ...)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Unified Alarm   │ ← 새로 추가
                    │ Data Provider   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  Global Alarm Bar    Chart Overlay     AlarmSettingsDialog
                                        (그래프)
```

- **PlotData 경로**: Minor Edit가 있으면 무조건 데이터 수신 → 위젯 활성화 없이도 알람 가능
- **LiveNodeValues 경로**: ICV 데이터(밸브 등)는 이 경로에서만 가용
- **통합**: 두 소스를 병합하여 더 넓은 커버리지 제공

### 4.2 알람 기준 항목 확장

기존 4종 → **7종**으로 확장:

| dataKey | label | 기본 단위 | 소스 |
|---------|-------|----------|------|
| pressure | 압력 (P) | MPa | MinorEdit(p) + ICV(TMDPV) |
| temperature | 온도 (T) | °C | MinorEdit(tempf) |
| flowRate | 유량 (W) | kg/s | MinorEdit(mflowj) + ICV(FLOWF/G) |
| valvePosition | 밸브 개도 | % | ICV(VALVE) |
| voidFraction | 공극률 | - | MinorEdit(voidf) |
| reactorPower | 원자로 출력 | W | MinorEdit(rktpow) |
| controlVariable | 제어변수 | (사용자 정의) | MinorEdit(cntrlvar) |

**변경 필요 파일**:
- `src/types/interactive.ts` — 타입 정의 확장
- `src/components/interactive/AlarmSettingsDialog.tsx` — THRESHOLD_FIELDS, DATA_KEY_OPTIONS 확장
- `src/utils/alarmUtils.ts` — getDefaultAlarmThresholds, displayToRaw/rawToDisplay 확장
- `src/utils/predefinedScenarios.ts` — 새 시나리오 추가 가능
- `src/utils/scenarioAlarmEngine.ts` — 통합 데이터 소스 지원

---

## 5. SimulationControlBar 진행률 개선

**결정**: 진행률 표시는 Header로 이동하지 않고, 기존 **ControlBar에서 개선**.

### 현재 문제
- `activeJob.progress`가 거의 항상 `null` → "Progress 정보 없음" 표시
- 계산 가능한 데이터는 이미 존재: `lastSimState.timehy` (현재 시간) + `metadata.maxTime` (목표 시간)

### 개선 내용
- 진행률 계산: `(timehy / 1000) / maxTime × 100`
- `maxTime`을 SimulationControlBar props로 전달
- `activeJob.progress`가 `null`일 때 위 계산값으로 fallback
- LinearProgress 바에 실제 진행률 표시

---

## 6. 구현 순서 (제안)

| Phase | 작업 | 의존성 |
|-------|------|--------|
| **P1** | 알람 기준 항목 확장 (voidf, rktpow, cntrlvar) | 없음 |
| **P2** | 알람 데이터 소스 통합 (PlotData + LiveNodeValues) | P1 |
| **P3** | Global Alarm Bar (simulationHeader 아래) | P2 |
| **P4** | Chart Threshold Overlay (ReferenceLine 추가) | P1 |
| **P5** | AlarmSettingsDialog 그래프 표출 | P2, P4 |
| **P6** | SimulationControlBar 진행률 개선 (timehy/maxTime) | 없음 (독립) |

---

## 7. 미결 사항

| # | 항목 | 상태 |
|---|------|------|
| 1 | Global Alarm Bar 정상 시: 완전 숨김 vs 녹색 얇은 라인 | 미결정 |
| 2 | reactorPower/controlVariable의 기본 threshold 값 | 미결정 |
| 3 | 사운드 알림 (Danger 시 경고음) 필요 여부 | 미결정 |
| 4 | 브라우저 Notification (탭 비활성 시) 필요 여부 | 미결정 |
| 5 | Toast/Snackbar (Danger 최초 발생 시) 추가 여부 | 미결정 |
| 6 | AlarmSettingsDialog 다이얼로그 크기 확장 (그래프 공간 확보) | 미결정 |

---

## 8. 관련 파일 맵

### 수정 대상

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/SimulationPage.tsx` | Global Alarm Bar 추가, scenarioResults 전달 |
| `src/components/simulation/ChartCard.tsx` | ReferenceLine 추가 |
| `src/components/analysis/TimeSeriesChart.tsx` | ReferenceLine 추가 |
| `src/components/interactive/widgets/MiniChartWidget.tsx` | ReferenceLine 추가 |
| `src/components/interactive/AlarmSettingsDialog.tsx` | 그래프 표출 + 항목 확장 |
| `src/components/interactive/InteractiveControlView.tsx` | scenarioResults 외부 전달 |
| `src/types/interactive.ts` | dataKey 타입 확장 |
| `src/utils/alarmUtils.ts` | 단위 변환 확장, threshold 기본값 |
| `src/utils/scenarioAlarmEngine.ts` | 통합 데이터 소스 |

### 신규 생성

| 파일 | 용도 |
|------|------|
| `src/components/simulation/GlobalAlarmBar.tsx` | 전역 알람 바 컴포넌트 |
| `src/hooks/useUnifiedAlarmData.ts` (또는 store 확장) | PlotData + LiveNodeValues 통합 |
