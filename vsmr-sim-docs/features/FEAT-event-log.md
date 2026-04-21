---
title: "FEAT: Event Log — 운전원 조작 이력 실시간 표시"
status: done
phase: 4
branch: main
related_prs: [#63]
last_updated: 2026-04-03
---

# FEAT: Event Log — 운전원 조작 이력 실시간 표시

> **상태**: ✅ 구현 완료
> **브랜치**: `alysion/feat_icv`
> **작성일**: 2026-03-25
> **선행 문서**: [FEAT-interactive-node-widgets](FEAT-interactive-node-widgets.md)

---

## 1. 배경 및 목표

### 1.1 현재 상태

SidePanel의 Event Log 아코디언이 플레이스홀더 상태이다.
운전원이 시뮬레이션 중 수행한 Trip 모드 변경, ICV 값 조작, 시뮬레이션 제어 등의 조작 내역을
확인할 수단이 없다.

### 1.2 목표

- 운전원이 **자신의 조작 이력**을 시간순으로 확인할 수 있다
- **서버 요청 성공 건만** 기록하여 신뢰성 있는 이력을 제공한다
- 이전값 → 새값을 표시하여 **무엇이 바뀌었는지** 즉시 파악 가능하다

### 1.3 비목표 (Scope Out)

- 서버측 감사 로그(audit log) 영구 저장
- 로그 파일 내보내기(CSV/텍스트)
- 다른 운전원의 조작 이력 표시
- 실패한 요청 기록

---

## 2. 기능 요구사항

### F1. Trip 모드 변경 로깅

| 항목 | 내용 |
|------|------|
| **트리거** | `setTripMode()` await 성공 후 |
| **캡처** | 호출 전 현재 cmode(이전값), 요청한 cmode(새값) |
| **표시 형식** | `Trip #501: Auto → ManualTrue` |

### F2. ICV 값 변경 로깅

| 항목 | 내용 |
|------|------|
| **트리거** | `setICVValue()` await 성공 후 |
| **캡처 대상** | cmode 변경, target 변경, rate 변경 (patch 내용에 따라) |
| **표시 형식 (모드)** | `valve_1 모드: A → M` |
| **표시 형식 (값)** | `valve_1 target: 0.500 → 0.800` |

### F3. 시뮬레이션 상태 변경 로깅

| 항목 | 내용 |
|------|------|
| **트리거** | `handleStartSimulation`, `handlePauseTask`, `handleResumeTask`, `handleStopSimulation` 성공 후 |
| **표시 형식** | `시뮬레이션 Started` / `Paused` / `Resumed` / `Stopped` |
| **참고** | SimulationPage에서 발생 → InteractiveControlView로 전달 필요 |

### F4. 타임스탬프

- **Wall clock** 기준 `HH:MM:SS` 형식
- 로그 엔트리마다 표시

### F5. 이전값 → 새값

- 조작 함수 호출 **직전**에 현재 상태를 스냅샷
- await 성공 후 스냅샷(이전값)과 요청값(새값)을 함께 기록

---

## 3. 비기능 요구사항

| # | 요구사항 | 상세 |
|---|---------|------|
| NF1 | **로컬 state** | 컴포넌트 state로 관리, 탭 전환/새로고침 시 유실 허용 |
| NF2 | **최신순 정렬** | 최신 항목이 위에 표시 |
| NF3 | **최대 200건** | 초과 시 가장 오래된 엔트리 삭제 (메모리 보호) |
| NF4 | **성능** | 로그 추가가 UI 렌더링에 영향 없어야 함 |

---

## 4. 데이터 설계

### 4.1 EventLogEntry 타입

```typescript
// src/types/interactive.ts에 추가

type EventLogType = 'trip' | 'icv' | 'simulation';

interface EventLogEntry {
  id: string;              // crypto.randomUUID() 또는 timestamp 기반
  timestamp: number;       // Date.now()
  type: EventLogType;
  label: string;           // 대상 이름 (e.g., "Trip #501", "valve_1", "시뮬레이션")
  action: string;          // 동작 설명 (e.g., "모드 변경", "target 변경", "Started")
  oldValue?: string;       // 이전값 (문자열 변환)
  newValue?: string;       // 새값 (문자열 변환)
}
```

### 4.2 상태 관리

```
InteractiveControlView (로컬 state)
  └─ eventLog: EventLogEntry[] (useState, max 200)
  └─ addEventLog: (entry: Omit<EventLogEntry, 'id' | 'timestamp'>) => void
```

---

## 5. 구현 설계

### 5.1 로그 수집 지점

#### Trip/ICV (useICVPolling 훅 래핑)

```
현재 흐름:
  SidePanel → onSetTripMode(objectId, cmode) → useICVPolling.setTripMode → setICV()

변경 흐름:
  InteractiveControlView에서 래핑:
    1. 호출 전: 현재 tripEntry/icvEntry에서 oldValue 캡처
    2. await setTripMode(objectId, cmode) 성공
    3. addEventLog({ type: 'trip', label, action, oldValue, newValue })
```

- `useICVPolling` 훅은 변경하지 않음 (단일 책임)
- InteractiveControlView에서 래핑 함수를 만들어 SidePanel에 전달

#### 시뮬레이션 제어 (SimulationPage → props 전달)

```
현재 흐름:
  SimulationPage → handlePauseTask() → pauseTask() → updateJob()

변경 흐름:
  SimulationPage에서 성공 시 이벤트 콜백 호출:
    1. await pauseTask() 성공
    2. onSimulationEvent?.({ type: 'simulation', label: '시뮬레이션', action: 'Paused' })

  InteractiveControlView가 onSimulationEvent prop을 통해 수신 → addEventLog()
```

### 5.2 컴포넌트 구조

```
SidePanel
  └─ Accordion "Event Log"
       └─ EventLogContent
            ├─ 로그 없을 때: "조작 이력이 없습니다" 안내
            └─ 로그 목록 (역순)
                 └─ EventLogItem × N
                      ├─ 타임스탬프 (HH:MM:SS)
                      ├─ 타입 아이콘/뱃지 (trip/icv/sim)
                      ├─ label + action
                      └─ oldValue → newValue
```

### 5.3 UI 레이아웃 (EventLogItem)

```
┌──────────────────────────────────────┐
│ 14:23:05  [Trip]  Trip #501          │
│           모드: Auto → ManualTrue    │
├──────────────────────────────────────┤
│ 14:22:51  [ICV]   valve_1           │
│           target: 0.500 → 0.800     │
├──────────────────────────────────────┤
│ 14:20:00  [SIM]   시뮬레이션        │
│           Started                    │
└──────────────────────────────────────┘
```

- 타입별 색상: Trip(blue), ICV(orange), Simulation(green)
- 컴팩트 디자인 (기존 SidePanel 카드 스타일과 통일)

---

## 6. 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | `EventLogEntry` 타입 정의 | `src/types/interactive.ts` |
| 2 | `EventLogContent` / `EventLogItem` 컴포넌트 구현 | `src/components/interactive/SidePanel.tsx` |
| 3 | InteractiveControlView에 `eventLog` state + `addEventLog` 추가 | `InteractiveControlView.tsx` |
| 4 | Trip/ICV 콜백 래핑 (oldValue 캡처 → 성공 시 로깅) | `InteractiveControlView.tsx` |
| 5 | SidePanel에 `eventLog` prop 전달, EventLogPlaceholder 교체 | `SidePanel.tsx` |
| 6 | 시뮬레이션 제어 이벤트 연동 (SimulationPage → ICV props) | `SimulationPage.tsx` |

---

## 7. 열린 질문 (결정 완료)

| # | 질문 | 결정 |
|---|------|------|
| Q1 | 최대 건수 | 200건 |
| Q2 | 시뮬레이션 시간 표시 | Wall clock만 (HH:MM:SS) |
| Q3 | 로그 내보내기 | Scope Out (향후 필요 시 추가) |
| Q4 | 실패 건 기록 | 기록하지 않음 (성공만) |
| Q5 | 저장 위치 | 컴포넌트 로컬 state |
