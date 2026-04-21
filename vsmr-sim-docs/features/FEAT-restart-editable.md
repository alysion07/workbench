---
title: "FEAT: Restart 모드에서 컴포넌트 편집 허용"
status: done
phase: 4
branch: alysion/restart-editable
last_updated: 2026-04-20
related_prs: []
---

# FEAT: Restart 모드에서 컴포넌트 편집 허용

> Restart 프로젝트에서 컴포넌트 속성·리사이즈를 자유롭게 편집할 수 있도록 readonly 가드를 제거.

## Motivation

2026-04-20 사용자 피드백 3번 항목:

> restart 모드에서도 컴포넌트 추가/수정/삭제가 가능함 (→ 일부 카드를 제외하고 나머지 항목들은 읽기 전용으로 열림 제약을 없애면 됨)

현재 Restart 모드 (`globalSettings.card100.problemType === 'restart'`) 에서:
- `PropertyPanel` 우측 속성 폼이 `pointerEvents: none + opacity 0.6` 으로 잠겨 있음
- 각 Node 컴포넌트의 `NodeResizer` 가 숨겨져 있음 (`isVisible={selected && !isRestart}`)

이 제약들만 제거하면 자연스럽게 restart 모드에서도 편집·추가·삭제가 가능해진다.
또한 해석 후 업데이트된 `rstplt` 파일을 다시 restart source 로 이어 쓰는 체인도 편집 기능에서 자연스럽게 파생된다.

## Scope

### In-scope
- `PropertyPanel.tsx` 의 restart-guard 제거 (Alert 배너 및 `pointerEvents:none` 래퍼)
- Node 컴포넌트들의 `NodeResizer isVisible` 조건에서 `!isRestart` 제거

### Out-of-scope (유지 대상)
- `GlobalSettings` 의 Card 100 (ProblemType) / Card 101 (SystemConfig) 영역의 readonly 가드 → **유지**
- (이유: Card 100 의 problemType 자체가 restart 의 root 지정이므로 편집 불가)

## Design

### 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `src/components/PropertyPanel.tsx` | 라인 354-361 : Alert 배너 문구를 정보성으로 변경, `pointerEvents:none` 가드 제거 |
| `src/components/nodes/SnglvolNode.tsx` | `isVisible={selected && !isRestart}` → `isVisible={selected}` |
| `src/components/nodes/PipeNode.tsx` | 동일 |
| `src/components/nodes/BranchNode.tsx` | 동일 |
| `src/components/nodes/ValveNode.tsx` | 동일 |
| `src/components/nodes/PumpNode.tsx` | 동일 |
| `src/components/nodes/TankNode.tsx` | 동일 |
| `src/components/nodes/TurbineNode.tsx` | 동일 |
| `src/components/nodes/TmdpvolNode.tsx` | 동일 |
| `src/components/nodes/TmdpjunNode.tsx` | 동일 |
| `src/components/nodes/SngljunNode.tsx` | 동일 |
| `src/components/nodes/MtpljunNode.tsx` | 동일 |
| `src/components/nodes/SeparatorNode.tsx` | 동일 |
| `src/components/nodes/HeatStructureNode.tsx` | 동일 |

**Total**: 14 files (PropertyPanel + 13 Node 컴포넌트).

### Alert 배너 문구

Restart 모드임을 유지하면서 편집 가능성을 알릴 필요가 있음:

변경 전:
```tsx
{isRestart && (
  <Alert severity="info" sx={{ m: 1, mb: 0 }}>
    RESTART 모드에서는 컴포넌트 속성을 변경할 수 없습니다.
  </Alert>
)}
<Box p={1.5} sx={isRestart ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
```

변경 후:
```tsx
{isRestart && (
  <Alert severity="info" sx={{ m: 1, mb: 0 }}>
    RESTART 모드입니다. 변경 사항은 minor-edit 으로 저장됩니다.
  </Alert>
)}
<Box p={1.5}>
```

### Node 컴포넌트의 `isRestart` 변수

최종 구현에서는 **제거**. TypeScript `noUnusedLocals` 규칙에 의해 `isVisible` 에서만 쓰이던 변수를 `!isRestart` 만 떼어내면 미사용 경고가 발생. 향후 시각적 힌트 등 다른 용도가 생기면 다시 추가.

## Test Plan

- Restart 프로젝트 열기
- PropertyPanel 우측 폼이 편집 가능 상태로 표시됨 (opacity 정상)
- Alert 배너 문구가 "변경 사항은 minor-edit 으로 저장됩니다" 로 변경됨
- 노드 선택 시 NodeResizer 가 표시되어 크기 조절 가능
- 속성 변경 → 저장 → minor-edit 반영되어 재해석 시 반영되는지 확인
- 일반 (new) 프로젝트: 변화 없음 (회귀 없음)
- GlobalSettings 의 Project Setup / System Config: **여전히 readonly** (회귀 없음)

## Non-Goals

- `GlobalSettings` Card 100/101 편집 허용 — 별도 이슈
- rstplt 재-restart 체인 UI — 본 변경으로 자연스럽게 가능 (추가 UI 없음)
- `.i` 텍스트 입력 모드 — 별도 트랙 (파서 포함 대형 작업)

## References

- 2026-04-20 small-wins #2 세션
- 관련 문서: [FEAT-mars-restart-phase2.md](./FEAT-mars-restart-phase2.md) (done)
