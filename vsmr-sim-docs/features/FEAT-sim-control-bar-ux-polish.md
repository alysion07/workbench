---
title: "FEAT: SimulationControlBar UX Polish (small-wins #1)"
status: done
phase: 4
branch: alysion/sim-control-bar-ux-polish
last_updated: 2026-04-20
related_prs: []
---

# FEAT: SimulationControlBar UX Polish

> 하단 컨트롤 바의 가시성/가독성/제어성을 개선. `FEAT-simulation-control-bar` (done) 의 follow-up.

## Motivation

2026-04-20 사용자 피드백에서 다음 항목이 제기됨:

1. `RUNNING` 상태 배지와 **probTime** (MARS 내부 해석 시간) 이 "중요한 정보인데 잘 안 보임"
2. 표기 개선: `Iter` → 사용자 친화적 표현
3. 배속 컨트롤 개선 — actual dt 가 매 스텝 변동하는 동적 특성을 UI 에 반영, 10배속까지의 범위를 6–10개 토글버튼으로 나누기엔 지저분함

본 문서는 위 3개 항목을 하나의 small-wins 번들(#1) 로 묶어 해결한다. 기존 MUI 기조는 유지한다.

## Scope

### In-scope
- 히어로 스트립 추가 (expanded mode 상단)
- RUNNING 배지 및 probTime 대형화·재배치
- `Iter` → `52,340 steps` value-first 표기
- Speed ToggleButtonGroup → **로그 스케일 슬라이더** 로 교체 (M1 + RO1 변형)
- 기존 "speed feedback table" (Max/Target/Actual 3-row) 제거 (슬라이더 readout 이 대체)

### Out-of-scope (본 번들에서 제외)
- Compact mode 레이아웃 변경 — 기존 유지
- `SimulationControlBarProps` API 변경 — 콜백 시그니처 동일
- 서버 측 dt/speed 로직 변경 — 클라이언트 표시층만 수정

## Design

### (1) 히어로 스트립 (expanded mode 전용)

컨트롤 바 최상단에 신설. 기존 Row 2 progress-row 는 흡수·삭제.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ● RUNNING    probTime 1234.5 s          [bar]  12m 30s   45%       │  ← 히어로 스트립 (신설)
├─────────────────────────────────────────────────────────────────────┤
│ ⏸ ▶ ⏹  │  [──── speed slider ─────]  TGT 2.0× / ACT 1.87×  │ 52,340 steps │
└─────────────────────────────────────────────────────────────────────┘
```

- **배경**: `linear-gradient(90deg, rgba(76,175,80,0.06), rgba(25,118,210,0.04))` — 옅은 success/info 그라데이션
- **하단 구분선**: `1px dashed #e0e0e0`
- **패딩**: `10px 20px`

**레이아웃** (flex, 좌·우 클러스터):

```
left-cluster                                          right-cluster
│                                                     width: 340px, margin-left:auto
│                                                     │
├─ status-badge                                       ├─ progress-bar (flex:1)
└─ probTime (probTime 1234.5 s)                       ├─ elapsed (12m 30s)
                                                      └─ progress-pct (45%)
```

#### 1-a. Status Badge (RUNNING)

| 속성 | 값 |
|------|-----|
| font-size | 14px (기존 0.75rem → semibold) |
| font-weight | 600 |
| padding | 6px 14px |
| border-radius | 4px |
| bgcolor | 기존 `STATUS_COLORS[status].bg` 유지 (success.light 등) |
| color | 기존 `STATUS_COLORS[status].fg` 유지 |
| dot | 8px (기존 6px) · pulse 애니메이션 유지 |
| gap | 8px (dot ↔ 텍스트) |

#### 1-b. probTime

| 속성 | 값 |
|------|-----|
| label | `probTime` (기존 `T` → 변경) · 11px Roboto · rgba(0,0,0,0.6) |
| value | 22px Roboto Mono 500 · `info.dark` (#0d47a1) · tabular-nums |
| unit | 13px · rgba(0,0,0,0.55) |
| format | `formatTimehy(timehy)` 기존 함수 재사용 (소수점 1자리 초) |

#### 1-c. Progress Cluster (우측)

| 요소 | 속성 |
|------|------|
| progress-bar | 기존 `LinearProgress` 유지. flex:1, height:5px |
| elapsed | 기존 mono 11px · rgba(0,0,0,0.55) · `formatElapsed()` 재사용 |
| pct | Roboto Mono 13px semibold · min-width: 42px · right-align |

우측 클러스터 폭 340px 고정 → 시각적 균형 유지.

#### 1-d. 표시 조건

- `activeModel` 존재 + progress 계산 가능 (`progress` 또는 `timehy/maxTime`) 시 전체 히어로 스트립 표시
- `activeModel` null / progress 계산 불가 → 히어로 스트립 숨김 (기존 Row 2 "시뮬레이션 대기 중" 대응)

### (2) `Iter` → `52,340 steps`

**Compact mode** (`#` 기호 유지)
- 현재: `# 52,340` → 유지

**Expanded mode** (controls row)
- 현재: 테이블 `T / Iter` 2-row
- 변경: `T` 행 제거 (probTime 은 히어로로 이동) · `Iter` 행 제거 → 단일 readout 으로 교체
- 신규 표기: `52,340 steps` (value-first, unit suffix)
  - number: 11px Roboto Mono 500, tabular-nums
  - unit: "steps" 10px 회색 (#999), margin-left: 3px

### (3) Speed Slider (M1 + RO1)

**기존 ToggleButtonGroup 전체 교체**. 6개 프리셋 버튼 → 슬라이더 + 우측 readout.

#### 3-a. 슬라이더

| 속성 | 값 |
|------|-----|
| track width | 280px · height 4px · `#eceff1` |
| fill | `linear-gradient(90deg, #64b5f6, #1976d2)` · border-radius 2px |
| thumb | 14px 원 · border 2px `#0d47a1` · 내부 dot `#0d47a1` · box-shadow |
| 스케일 | **log-base-2**, 0.25× ↔ 10× |
| tick 위치 | 0.25× / 0.5× / 1× / 2× / 5× / 10× (라벨 표시) |

**스케일: 구간별 선형 보간 (piecewise-linear)**

목업에서 확정된 tick 라벨을 **등간격 5구간(각 20%)** 으로 고정하고,
position↔speed 변환은 인접 tick 사이의 선형 보간을 사용.

```
TICK_POSITIONS = [0.00, 0.20, 0.40, 0.60, 0.80, 1.00]
TICK_SPEEDS    = [0.25, 0.50, 1.00, 2.00, 5.00, 10.00]

positionToSpeed(p):
  for i in 0..4:
    if p between TICK_POSITIONS[i] and TICK_POSITIONS[i+1]:
      t = (p - TICK_POSITIONS[i]) / 0.20
      return TICK_SPEEDS[i] + t * (TICK_SPEEDS[i+1] - TICK_SPEEDS[i])

speedToPosition(s): 역함수 (동일 구간 탐색)
```

**이 선택의 이유**:
- 순수 log2 매핑은 tick 라벨이 불규칙 간격으로 놓여 UI 가독성 저하
- 등간격 tick 만 쓰되 구간 내 보간을 linear 로 하면 사용자 체감상 "프리셋 6개가 균등 간격" 으로 인지됨
- 구간 별 기울기가 달라지지만 UX 관점에서는 허용 가능 (0.25–0.5 와 5–10 구간의 "드래그 민감도" 차이가 생기되, 두 구간 모두 ×2 배속 변화이므로 자연스러움)

#### 3-b. Fill (actual)

- `fill.width = position(actual_speed) * 100%`
- actual_speed 업데이트 시 width CSS 트랜지션 `0.2s ease-out`

#### 3-c. Thumb (target)

- `thumb.left = position(target_speed) * 100%`
- 드래그: `mousedown → mousemove` 로 position 계산 → `onSpeedChange(speedFromPosition(p))`
- **Max 처리**: 슬라이더 우측 끝 = 10× 대신 `onSpeedChange(0)` (기존 "MAX = 0" 약속 유지) 로 호출
  - 우측 끝 10× 라벨은 유지하되, 실제 서버 max가 다르면 값은 해당 `max_speed` 로 내부 바인딩
- **서버 max 초과 영역 표시**: `max_speed < 10` 일 경우 슬라이더 오른쪽 일부를 회색으로 disable 표시 (opacity 0.4)

#### 3-d. RO1 Readout (slider 우측)

```
TARGET   2.0×
ACTUAL   1.87×
```

| 속성 | TARGET | ACTUAL |
|------|--------|--------|
| label | 9px Roboto 500 · rgba(0,0,0,0.5) · letter-spacing 0.12em · uppercase | 동일 |
| value | 15px Roboto Mono 600 · `#0d47a1` | 12px Roboto Mono 400 · rgba(0,0,0,0.65) |
| alignment | 2-col grid · baseline align · value right-align · column-gap 10px | 동일 |

#### 3-e. 제거

- 기존 `feedback-tbl` 테이블 (Max/Target/Actual 3-row) **전체 제거**
- Max 값은 본 번들에서 UI 노출 안 함. 서버 max 초과 영역 표시(3-c) 로 시각적 제약만 전달.

## Compact Mode

본 번들에서는 **변경 없음**. 기존 `compact === true` 분기:
- ToggleButtonGroup (6-preset) 그대로
- `→{actual}x` caption 그대로
- `T: {timehy}s # {iter}` inline 그대로

히어로 스트립은 expanded 전용 → compact 에서는 렌더하지 않음.

## Impact

### 파일 변경

| 파일 | 변경 |
|------|------|
| `src/components/simulation/SimulationControlBar.tsx` | expanded 블록 대폭 수정, compact 블록 거의 무변경 |
| `src/components/simulation/SpeedSlider.tsx` | **신규** — 로그 슬라이더 + RO1 readout 캡슐화 |
| `src/components/simulation/SimStatusBadge.tsx` | (검토) badge 만 분리할지 — 미분리 권장 (작음) |
| `src/components/simulation/HeroStrip.tsx` | **신규** — 히어로 스트립 컴포넌트 |

### Props / State

- `SimulationControlBarProps` **변경 없음** (기존 `onSpeedChange: (ratio: number) => void` 그대로)
- 내부 파생 상태: target_speed 는 `activeModel.lastSimState.target_speed`, actual_speed 는 `activeModel.lastSimState.actual_speed` (기존 경로)

### 접근성

- 슬라이더: `role="slider"`, `aria-valuemin/max/now/valuetext="2.0x"`
- 키보드: ← → 로 프리셋 단계 이동 (0.25/0.5/1/2/5/10)
- thumb focus: outline 처리 유지

## Non-Goals

- **actual speed 의 damping/smoothing** 는 본 번들에서 다루지 않음 (별도 follow-up 가능)
- probTime 의 `formatTimehy` 포맷 (단위 표시, 과학 표기법 등) 개선은 별도
- Hero strip 의 alarm/error 상태 표기 확장은 별도 (`FEAT-alarm-threshold-ui`)

## Open Questions

- [ ] 기존 `MAX = ratio 0` 관례 처리: 본 번들은 슬라이더 우측 끝을 numeric `10×` (`onSpeedChange(10)`) 로 처리한다. `ratio 0` 시맨틱("무제한으로 최대한 빠르게") 유지가 필요하면 별도 토글 버튼 추가 필요 — BFF 동작 확인 후 결정.
- [ ] progress 정보 없음 (`activeModel` 있으나 `progress` null) 케이스에서 히어로 스트립 전체 숨김 vs bar 만 숨김 — 구현시 확인
- [ ] 슬라이더 드래그 중 actual fill 애니메이션 일시 중지 여부 (드래그 중 fill 변화가 혼란스러울 수 있음)

## References

- 모회원 feature: [FEAT-simulation-control-bar.md](./FEAT-simulation-control-bar.md) (done, 2026-04-03)
- 사용자 피드백 세션: 2026-04-20 (small-wins 번들 #1 시작)
- 목업 기록: `.superpowers/brainstorm/64096-1776667942/content/` (로컬)

## Current State

- 2026-04-20: brainstorm 완료, 설계 문서 작성. 구현 계획(writing-plans) 대기.
