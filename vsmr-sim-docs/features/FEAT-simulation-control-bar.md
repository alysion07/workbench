---
title: "FEAT: SimulationControlBar"
status: done
phase: 4
branch: main
last_updated: 2026-04-03
---

# FEAT: SimulationControlBar

> 시뮬레이션 제어를 위한 하단 고정 컨트롤 바 컴포넌트

## Overview

SimulationPage 상단 헤더에 과밀하게 배치된 Playback/Speed/Status 컨트롤을
독립 컴포넌트(`SimulationControlBar`)로 분리하여 화면 최하단에 고정 배치한다.
Monitoring / Interactive Control 탭을 전환해도 동일하게 표시된다.

## Current State

### 문제점
- 상단 헤더 1줄에 버튼 11개 + Select 1개 + 텍스트 3개 혼재
- Playback, Data, Navigation 기능 그룹핑 없이 나열
- 배속 변경 시 시각적 피드백 부족 (텍스트만)
- Interactive Control 탭에서 제어 접근성 낮음 (헤더까지 시선 이동)

### 현재 헤더에서 이동할 요소
| 요소 | 현재 위치 | → 이동 |
|------|----------|--------|
| Pause / Resume / Stop | 헤더 IconButton | ControlBar |
| Speed Select | 헤더 Select | ControlBar ToggleButtonGroup |
| Actual Speed 텍스트 | 헤더 Typography | ControlBar |
| Status Badge (상태+경과시간) | 헤더 Box | ControlBar |

### 헤더에 잔류할 요소
| 요소 | 이유 |
|------|------|
| 프로젝트명 | 네비게이션 컨텍스트 |
| Play (시작) 버튼 | 시뮬레이션 시작은 별도 Dialog 트리거 |
| QuickRun 버튼 | 시작 관련 |
| Demo 모드 토글 | 개발/테스트 전용 |
| Analysis 결과 보기 | 탭 전환 액션 |
| Download 메뉴 (로그/결과) | 완료 후 액션 |
| MinIO 다운로드 | 완료 후 액션 |
| Refresh 버튼 | 데이터 관리 |
| 에디터로 돌아가기 | 네비게이션 |

---

## Design

### 1. 레이아웃 변경

**Before:**
```
┌──────────────────────────────────────┐
│ Header: 프로젝트명 + 모든 컨트롤     │ ← 과밀
├──────────────────────────────────────┤
│ 탭 콘텐츠 (Mon / ICV / Analysis)     │
└──────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────┐
│ Header: 프로젝트명 + 시작/유틸리티   │ ← 단순화
├──────────────────────────────────────┤
│ 탭 콘텐츠 (Mon / ICV / Analysis)     │ ← 세로 공간 확보
├──────────────────────────────────────┤
│ SimulationControlBar (고정 하단)      │ ← 새 컴포넌트
└──────────────────────────────────────┘
```

### 2. AppLayout 변경

`contentFooter` prop 추가:

```typescript
interface AppLayoutProps {
  // 기존 props...
  contentHeader?: React.ReactNode;
  contentFooter?: React.ReactNode;  // ← 추가
  children: React.ReactNode;
}
```

```tsx
// AppLayout 렌더링
<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
  {contentHeader}
  <Box sx={{ flexGrow: 1, overflow: 'auto', height: 0 }}>
    {children}
  </Box>
  {contentFooter}  {/* ← 추가: 하단 고정 */}
</Box>
```

### 3. SimulationControlBar 컴포넌트

**파일**: `src/components/simulation/SimulationControlBar.tsx`

#### Props

```typescript
interface SimulationControlBarProps {
  activeJob: Job | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (ratio: number) => void;
}
```

#### 모드 전환 (컴팩트 / 확장)

사용자가 토글 버튼으로 전환. 선택 값은 `localStorage` 에 persist.

**컴팩트 모드 (1줄, 높이 44px):**
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⏸ ▶ ⏹ │ 0.25x 0.5x [1x] 2x 4x Max │ →1.87x │ T:150.3s #4521 │ ⏱12:34 ● RUN │ ▲ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**확장 모드 (2줄, 높이 72px):**
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⏸ ▶ ⏹  │ 0.25x  0.5x  [1x]  2x  4x  Max │ Target:2x → Actual:1.87x │ ● RUNNING  ⏱ 12:34 │ ▼ │
│          │              Speed               │ T:150.3s    Iter:4521    │ ████████████░░░ 75%  │   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 내부 구조 (섹션별)

```tsx
<Box sx={{ display: 'flex', alignItems: 'center', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>

  {/* Section 1: Playback */}
  <PlaybackGroup>
    <IconButton onClick={onPause}>   {/* running|resumed → enabled */}
    <IconButton onClick={onResume}>  {/* paused → enabled */}
    <IconButton onClick={onStop}>    {/* running|paused|resumed → enabled */}
  </PlaybackGroup>

  <Divider orientation="vertical" />

  {/* Section 2: Speed */}
  <SpeedGroup>
    <ToggleButtonGroup exclusive value={selectedSpeed} onChange={handleSpeed}>
      <ToggleButton value={0.25}>0.25x</ToggleButton>
      <ToggleButton value={0.5}>0.5x</ToggleButton>
      <ToggleButton value={1}>1x</ToggleButton>
      <ToggleButton value={2}>2x</ToggleButton>
      <ToggleButton value={4}>4x</ToggleButton>
      <ToggleButton value={0}>Max</ToggleButton>
    </ToggleButtonGroup>
  </SpeedGroup>

  <Divider orientation="vertical" />

  {/* Section 3: Speed Feedback */}
  <SpeedFeedback>
    {compact
      ? <Typography>→{actualSpeed}</Typography>
      : <>
          <Typography>Target: {targetLabel}</Typography>
          <Typography>→ Actual: {actualLabel}</Typography>
        </>
    }
  </SpeedFeedback>

  <Divider orientation="vertical" />

  {/* Section 4: Simulation Info */}
  <SimInfo>
    {compact
      ? <Typography>T:{timehy}s #{iterCount}</Typography>
      : <>
          <Typography>T: {timehy} s</Typography>
          <Typography>Iter: {iterCount}</Typography>
        </>
    }
  </SimInfo>

  <Divider orientation="vertical" />

  {/* Section 5: Status */}
  <StatusGroup>
    <StatusBadge status={activeJob.status} />
    <Typography>{elapsedTime}</Typography>
    {!compact && activeJob.progress != null && (
      <LinearProgress variant="determinate" value={activeJob.progress} />
    )}
  </StatusGroup>

  {/* Section 6: Mode Toggle */}
  <IconButton onClick={toggleMode}>
    {compact ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
  </IconButton>

</Box>
```

### 4. 상태별 동작 매트릭스

| Job Status | 컨트롤바 표시 | Pause | Resume | Stop | Speed |
|------------|-------------|-------|--------|------|-------|
| `null` (없음) | 최소 표시 (비활성) | X | X | X | X |
| `pending` | 비활성 | X | X | X | X |
| `running` | 활성 | O | X | O | O |
| `paused` | 활성 (warning 테마) | X | O | O | O |
| `resumed` | 활성 | O | X | O | O |
| `completed` | 완료 표시 | X | X | X | X |
| `stopped` | 중지 표시 | X | X | X | X |
| `failed` | 에러 표시 | X | X | X | X |

### 5. 데이터 소스 매핑

| 표시 항목 | 데이터 경로 | 갱신 주기 |
|----------|------------|----------|
| Status | `activeJob.status` | SSE 스트림 (실시간) |
| Target Speed | `activeJob.lastSimState.target_speed` | SSE 스트림 |
| Actual Speed | `activeJob.lastSimState.actual_speed` | SSE 스트림 |
| Sim Time (timehy) | `activeJob.lastSimState.timehy` | SSE 스트림 |
| Iteration Count | `activeJob.lastSimState.iteration_count` | SSE 스트림 |
| Progress | `activeJob.progress` | SSE 스트림 |
| Elapsed Time | `Date.now() - activeJob.startTime` | 1초 interval |

### 6. 스타일 가이드

#### 색상 체계 (기존 유지)
| Status | 배경색 | 텍스트색 |
|--------|--------|---------|
| `running` | `success.light` | `success.dark` |
| `paused` | `warning.light` | `warning.dark` |
| `completed` | `info.light` | `info.dark` |
| `stopped` | `grey.300` | `grey.700` |
| `failed` | `error.light` | `error.dark` |

#### ToggleButtonGroup 스타일
```typescript
{
  '& .MuiToggleButton-root': {
    px: 1.5,
    py: 0.5,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'none',
    borderColor: 'divider',
    '&.Mui-selected': {
      bgcolor: 'primary.main',
      color: 'primary.contrastText',
      '&:hover': { bgcolor: 'primary.dark' },
    },
  },
}
```

#### 컨트롤 바 컨테이너
```typescript
{
  borderTop: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  px: 2,
  py: compact ? 0.5 : 1,
  display: 'flex',
  alignItems: compact ? 'center' : 'flex-start',
  gap: 2,
  flexShrink: 0,        // 리사이즈에 의해 줄어들지 않음
  zIndex: 10,            // 콘텐츠 위에 표시
}
```

### 7. localStorage 키

| 키 | 값 | 기본값 |
|----|----|--------|
| `sim-control-bar:mode` | `'compact' \| 'expanded'` | `'expanded'` |

---

## Implementation Plan

### Phase 1: SimulationControlBar 컴포넌트 생성
- [ ] `src/components/simulation/SimulationControlBar.tsx` 생성
- [ ] Props 인터페이스, 컴팩트/확장 모드 전환 로직
- [ ] Playback 버튼 그룹 (Pause/Resume/Stop)
- [ ] Speed ToggleButtonGroup
- [ ] Status/Info 표시 영역
- [ ] Progress LinearProgress (확장 모드)
- [ ] localStorage persist (모드 선택)

### Phase 2: AppLayout 확장
- [ ] `contentFooter` prop 추가
- [ ] 렌더링 위치 (children 아래, 하단 고정)

### Phase 3: SimulationPage 리팩터링
- [ ] 핸들러 함수 재사용 (handlePauseTask, handleResumeTask, handleStopSimulation, handleSpeedChange)
- [ ] 헤더에서 이동 대상 요소 제거
- [ ] `<SimulationControlBar>` 를 `contentFooter` 로 전달
- [ ] elapsedSeconds 타이머 로직 ControlBar 내부로 이동 검토

### Phase 4: 검증
- [ ] Monitoring 탭에서 Playback/Speed 동작 확인
- [ ] Interactive Control 탭에서 동일 동작 확인
- [ ] Analysis 탭에서 비활성 표시 확인
- [ ] 컴팩트/확장 모드 전환 + persist 확인
- [ ] activeJob 없을 때 비활성 표시 확인

---

## Files to Modify

| 파일 | 변경 내용 |
|------|----------|
| `src/components/simulation/SimulationControlBar.tsx` | **신규** — 메인 컴포넌트 |
| `src/components/common/AppLayout.tsx` | `contentFooter` prop 추가 |
| `src/pages/SimulationPage.tsx` | 헤더 요소 이동, ControlBar 연결 |
