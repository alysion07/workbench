---
title: "New Project Wizard 리팩토링 계획"
status: planned
phase: 2
last_updated: 2026-04-03
---

# New Project Wizard 리팩토링 계획

> 작성일: 2026-01-20
> 상태: Phase 1 진행 중

## 개요

기존 단일 페이지 NewProjectDialog를 3단계 위저드 형식으로 재구성

## 설계 결정사항

| 항목 | 결정 |
|------|------|
| 레이아웃 | 3단계 위저드 |
| Step 1 | 기본 정보만 (SVG 없음) |
| Step 2 | Project Scope 대분류 선택 + SVG + 토글 Chip |
| Step 3 | Partition 생성 + SVG (호버/색상) + 카드 리스트 |
| 진행 표시 | 스텝 인디케이터 (●━━○━━○) |
| 다이얼로그 크기 | 현재 유지 |
| 세부 Scope 관리 | 별도 프로젝트 설정 페이지 (Phase 2) |

## 데이터 구조

```typescript
// Partition: Project Scope의 부분집합
// 컴포넌트 할당: 배타적 (하나의 Partition에만)
// Scope 변경: 프로젝트 설정에서만
```

---

## Phase 1: Wizard 재구성 (현재)

### 컴포넌트 구조
```
src/components/projectPicker/
├── NewProjectWizard/
│   ├── index.tsx                 # 메인 위저드 컨테이너
│   ├── StepIndicator.tsx         # 스텝 진행 표시
│   ├── Step1BasicInfo.tsx        # 기본 정보 폼
│   ├── Step2ScopeSelect.tsx      # Scope 선택 + SVG
│   ├── Step3PartitionSetup.tsx   # Partition 설정 + SVG
│   └── types.ts                  # 위저드 관련 타입
├── PartitionCard.tsx             # (기존 재사용)
└── ReactorSystemSVG.tsx          # (기존 재사용, 확장 필요)
```

### Tasks

- [x] TODO 문서 생성
- [ ] StepIndicator 컴포넌트 생성
- [ ] Step1BasicInfo 컴포넌트 생성
- [ ] Step2ScopeSelect 컴포넌트 생성
- [ ] Step3PartitionSetup 컴포넌트 생성
- [ ] NewProjectWizard 메인 컴포넌트 통합
- [ ] 기존 NewProjectDialog 교체
- [ ] 테스트 및 검증

---

## Phase 2: Project Settings - Scope Management (추후)

### 기능 요구사항

1. **Scope 세부 관리 페이지**
   - Project Scope 확장/축소
   - 컴포넌트 ↔ Partition 할당 UI
   - 의존성 검증 로직

2. **컴포넌트 할당 규칙**
   - 배타적 할당: 하나의 컴포넌트는 하나의 Partition에만
   - Partition Scope ⊆ Project Scope
   - 변경 시 타 Partition 의존성 체크

3. **UI 요소**
   - SVG with Partition별 색상 표시
   - 미할당 컴포넌트 경고
   - 드래그 앤 드롭 할당 (선택적)

### 예상 컴포넌트
```
src/pages/ProjectSettingsPage.tsx
src/components/projectSettings/
├── ScopeManagement.tsx
├── PartitionAssignment.tsx
├── ComponentList.tsx
└── DependencyWarning.tsx
```

---

## 와이어프레임

### Step 1: 기본 정보
```
┌─────────────────────────────────────────────────────────────────┐
│ New Project                                                     │
├─────────────────────────────────────────────────────────────────┤
│      ●━━━━━━━━━━━○━━━━━━━━━━━○                                  │
│    Step 1       Step 2       Step 3                             │
│   기본 정보     Scope 선택   Partition 설정                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Title *        [____________________________________]         │
│                                                                 │
│   Description    [____________________________________]         │
│                                                                 │
│   Tag            [____________________________________]         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                    [Cancel]  [Next →]           │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Scope 선택
```
┌─────────────────────────────────────────────────────────────────┐
│ New Project                                                     │
├─────────────────────────────────────────────────────────────────┤
│      ○━━━━━━━━━━━●━━━━━━━━━━━○                                  │
│    Step 1       Step 2       Step 3                             │
├────────────────────────┬────────────────────────────────────────┤
│                        │                                        │
│   [SVG Overview]       │   Project Scope                        │
│                        │                                        │
│   선택 영역            │   ┌────────────┐ ┌──────────────┐     │
│   하이라이트           │   │ Primary ✓  │ │ Secondary ✓  │     │
│                        │   └────────────┘ └──────────────┘     │
│                        │   ┌────────────┐                      │
│                        │   │    BOP     │  ← 비활성             │
│                        │   └────────────┘                      │
│                        │                                        │
├────────────────────────┴────────────────────────────────────────┤
│                          [← Back]  [Cancel]  [Next →]           │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Partition 설정
```
┌─────────────────────────────────────────────────────────────────┐
│ New Project                                                     │
├─────────────────────────────────────────────────────────────────┤
│      ○━━━━━━━━━━━○━━━━━━━━━━━●                                  │
│    Step 1       Step 2       Step 3                             │
├────────────────────────┬────────────────────────────────────────┤
│                        │  Project Partition              [+ Add]│
│   [SVG Overview]       │                                        │
│                        │  ┌──────────────────────────────────┐ │
│   Partition별          │  │ 🟦 Main Model                    │ │
│   색상 구분 표시       │  │    Analysis Code: MARS    [▼]   │ │
│                        │  │    Scope: Primary, Secondary     │ │
│   호버 시              │  └──────────────────────────────────┘ │
│   해당 영역 강조       │  ┌──────────────────────────────────┐ │
│                        │  │ 🟩 Sub Model                     │ │
│                        │  │    Analysis Code: RELAP   [▼]   │ │
│                        │  │    Scope: BOP                    │ │
│                        │  └──────────────────────────────────┘ │
│                        │                                        │
├────────────────────────┴────────────────────────────────────────┤
│                          [← Back]  [Cancel]  [Create]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 참고 사항

- 기존 `PartitionCard.tsx`, `ReactorSystemSVG.tsx` 재사용
- 타입 정의는 `@/types/supabase.ts` 유지
- Step 3에서 SVG는 Partition별 색상 구분 + 호버 하이라이트 기능 필요
