# VSMR Simulator Roadmap

> **Auto-generated**: 2026-04-21 | `node scripts/generate-roadmap.mjs`로 자동 생성
> **Repository**: vsmr-sim-web
> **UI Spec**: [vsmr-sim-web.pdf](../vsmr-sim-web/public/vsmr-sim-web.pdf)

## Overview

MARS 원자로 시뮬레이터를 위한 웹 기반 GUI 개발 로드맵.

**전체 진행률**: 23/42 완료 | 6 진행중 | 12 예정

---

## Phase Summary

| Phase | 상태 | 설명 | 완료 |
|-------|------|------|------|
| 1 | ✅ | Core Editor MVP | 7/7 |
| 2 | 🚧 | Project & Model Management | 0/4 |
| 3 | ⏳ | Advanced Components | 1/6 |
| 4 | 🚧 | Simulation & Analysis | 15/24 |

---

## Active Work (in-progress)

| Feature | Branch | 문서 |
|---------|--------|------|
| FEAT: 분석 페이지 Co-Sim 통합 트리 대응 | `feat/cosim` | [FEAT-analysis-cosim.md](features/FEAT-analysis-cosim.md) |
| FEAT: Analysis/Plotfl 파이프라인 리팩터링 (5-Phase 로드맵) | `alysion/phase1-parser-tests` | [FEAT-analysis-refactor.md](features/FEAT-analysis-refactor.md) |
| FEAT: Project Picker Page | `alysion/feat_project_picker` | [FEAT-project-picker.md](features/FEAT-project-picker.md) |
| FEAT: Simulation Analysis 탭 개선 | `alysion/feat_textcoode_viewer` | [FEAT-simulation-analysis.md](features/FEAT-simulation-analysis.md) |
| Phase 2: Project & Model Management | `alysion/feat_project_picker` | [PHASE-02-project-model.md](features/PHASE-02-project-model.md) |
| Phase 4: Simulation & Analysis | `alysion/feat_simulation_page` | [PHASE-04-simulation.md](features/PHASE-04-simulation.md) |

---

## Planned (backlog)

| Feature | Phase | 문서 |
|---------|-------|------|
| Co-Sim 설정 페이지 — 설계 문서 | 3 | [FEAT-cosim-config-design.md](features/FEAT-cosim-config-design.md) |
| Co-Sim 설정 페이지 — 구현 계획 | 3 | [FEAT-cosim-config-workflow.md](features/FEAT-cosim-config-workflow.md) |
| Co-Simulation 설정 페이지 | 3 | [FEAT-cosim-config.md](features/FEAT-cosim-config.md) |
| FEAT: Interactive Node Widgets | 4 | [FEAT-interactive-node-widgets.md](features/FEAT-interactive-node-widgets.md) |
| FEAT: Logic Trips (Card 601-799) | 4 | [FEAT-logic-trips.md](features/FEAT-logic-trips.md) |
| FEAT: SMART.i 누락 항목 보완 | 3 | [FEAT-missing-components.md](features/FEAT-missing-components.md) |
| New Project Wizard 리팩토링 계획 | 2 | [FEAT-project-wizard-refactor.md](features/FEAT-project-wizard-refactor.md) |
| FEAT: 시뮬레이션 이력 관리 | 4 | [FEAT-simulation-history-mgmt.md](features/FEAT-simulation-history-mgmt.md) |
| SVG Library Feature - 설계 문서 | 2 | [FEAT-svg-library.md](features/FEAT-svg-library.md) |
| FEAT-unified-control-view | 4 | [FEAT-unified-control-view.md](features/FEAT-unified-control-view.md) |
| FEAT: Widget UX Improvement — 가독성 및 사용성 향상 | 4 | [FEAT-widget-ux-improvement.md](features/FEAT-widget-ux-improvement.md) |
| WORKFLOW: SMART.i 누락 항목 보완 — 구현 워크플로우 | 3 | [WORKFLOW-missing-components.md](features/WORKFLOW-missing-components.md) |

---

## All Features by Phase

### Phase 1: Core Editor MVP

| 상태 | Feature | Branch | 문서 |
|------|---------|--------|------|
| ✅ | FEAT: Control Variable (제어 변수) | `main` | [FEAT-control-variable.md](features/FEAT-control-variable.md) |
| ✅ | FEAT: Heat Structure Component | `main` | [FEAT-heat-structure.md](features/FEAT-heat-structure.md) |
| ✅ | FEAT: Nodalization 편집 기능 | `main` | [FEAT-nodalization-editor.md](features/FEAT-nodalization-editor.md) |
| ✅ | FEAT-separator: SEPARATR (기액 분리기) 컴포넌트 | `main` | [FEAT-separator.md](features/FEAT-separator.md) |
| ✅ | FEAT: Tank 컴포넌트 | `main` | [FEAT-tank.md](features/FEAT-tank.md) |
| ✅ | FEAT: Valve 컴포넌트 | `main` | [FEAT-valve.md](features/FEAT-valve.md) |
| ✅ | Phase 1: Core Editor MVP + Extended Components | `main` | [PHASE-01-core-editor.md](features/PHASE-01-core-editor.md) |

### Phase 2: Project & Model Management

| 상태 | Feature | Branch | 문서 |
|------|---------|--------|------|
| 🚧 | FEAT: Project Picker Page | `alysion/feat_project_picker` | [FEAT-project-picker.md](features/FEAT-project-picker.md) |
| 🚧 | Phase 2: Project & Model Management | `alysion/feat_project_picker` | [PHASE-02-project-model.md](features/PHASE-02-project-model.md) |
| ⏳ | New Project Wizard 리팩토링 계획 | - | [FEAT-project-wizard-refactor.md](features/FEAT-project-wizard-refactor.md) |
| ⏳ | SVG Library Feature - 설계 문서 | - | [FEAT-svg-library.md](features/FEAT-svg-library.md) |

### Phase 3: Advanced Components

| 상태 | Feature | Branch | 문서 |
|------|---------|--------|------|
| ⏳ | Co-Sim 설정 페이지 — 설계 문서 | `feat/cosim` | [FEAT-cosim-config-design.md](features/FEAT-cosim-config-design.md) |
| ⏳ | Co-Sim 설정 페이지 — 구현 계획 | `feat/cosim` | [FEAT-cosim-config-workflow.md](features/FEAT-cosim-config-workflow.md) |
| ⏳ | Co-Simulation 설정 페이지 | `feat/cosim` | [FEAT-cosim-config.md](features/FEAT-cosim-config.md) |
| ⏳ | FEAT: SMART.i 누락 항목 보완 | - | [FEAT-missing-components.md](features/FEAT-missing-components.md) |
| ⏳ | WORKFLOW: SMART.i 누락 항목 보완 — 구현 워크플로우 | - | [WORKFLOW-missing-components.md](features/WORKFLOW-missing-components.md) |
| ✅ | Phase 3: Advanced Components | `main` | [PHASE-03-advanced-components.md](features/PHASE-03-advanced-components.md) |

### Phase 4: Simulation & Analysis

| 상태 | Feature | Branch | 문서 |
|------|---------|--------|------|
| 🚧 | FEAT: 분석 페이지 Co-Sim 통합 트리 대응 | `feat/cosim` | [FEAT-analysis-cosim.md](features/FEAT-analysis-cosim.md) |
| 🚧 | FEAT: Analysis/Plotfl 파이프라인 리팩터링 (5-Phase 로드맵) | `alysion/phase1-parser-tests` | [FEAT-analysis-refactor.md](features/FEAT-analysis-refactor.md) |
| 🚧 | FEAT: Simulation Analysis 탭 개선 | `alysion/feat_textcoode_viewer` | [FEAT-simulation-analysis.md](features/FEAT-simulation-analysis.md) |
| 🚧 | Phase 4: Simulation & Analysis | `alysion/feat_simulation_page` | [PHASE-04-simulation.md](features/PHASE-04-simulation.md) |
| ⏳ | FEAT: Interactive Node Widgets | - | [FEAT-interactive-node-widgets.md](features/FEAT-interactive-node-widgets.md) |
| ⏳ | FEAT: Logic Trips (Card 601-799) | - | [FEAT-logic-trips.md](features/FEAT-logic-trips.md) |
| ⏳ | FEAT: 시뮬레이션 이력 관리 | - | [FEAT-simulation-history-mgmt.md](features/FEAT-simulation-history-mgmt.md) |
| ⏳ | FEAT-unified-control-view | - | [FEAT-unified-control-view.md](features/FEAT-unified-control-view.md) |
| ⏳ | FEAT: Widget UX Improvement — 가독성 및 사용성 향상 | `alysion/feat_icv` | [FEAT-widget-ux-improvement.md](features/FEAT-widget-ux-improvement.md) |
| ✅ | FEAT-alarm-improvement: 알람 시스템 개선 | `main` | [FEAT-alarm-improvement.md](features/FEAT-alarm-improvement.md) |
| ✅ | 설계서: Simulation 모니터링 그래프 라인 커스터마이징 | `main` | [FEAT-chart-line-customization-design.md](features/FEAT-chart-line-customization-design.md) |
| ✅ | PRD: Simulation 모니터링 그래프 라인 커스터마이징 | `main` | [FEAT-chart-line-customization-prd.md](features/FEAT-chart-line-customization-prd.md) |
| ✅ | FEAT: Event Log — 운전원 조작 이력 실시간 표시 | `main` | [FEAT-event-log.md](features/FEAT-event-log.md) |
| ✅ | DESIGN: Control Input → 노드 위치 찾기 기능 | `main` | [FEAT-locate-node-from-control-input.md](features/FEAT-locate-node-from-control-input.md) |
| ✅ | FEAT: MARS RESTART Phase 2 — 에디터 연동 및 파일 생성 | `main` | [FEAT-mars-restart-phase2.md](features/FEAT-mars-restart-phase2.md) |
| ✅ | FEAT: MARS NEW/RESTART 설정 | `main` | [FEAT-mars-restart.md](features/FEAT-mars-restart.md) |
| ✅ | FEAT: 퀵런 MinIO 파일 선택 다이얼로그 UI 개선 | `main` | [FEAT-quickrun-file-picker.md](features/FEAT-quickrun-file-picker.md) |
| ✅ | FEAT: Restart 모드에서 컴포넌트 편집 허용 | `alysion/restart-editable` | [FEAT-restart-editable.md](features/FEAT-restart-editable.md) |
| ✅ | FEAT: RESTART 모드 파일 생성기 개선 | `main` | [FEAT-restart-file-generator.md](features/FEAT-restart-file-generator.md) |
| ✅ | FEAT: SimulationControlBar UX Polish (small-wins #1) | `alysion/sim-control-bar-ux-polish` | [FEAT-sim-control-bar-ux-polish.md](features/FEAT-sim-control-bar-ux-polish.md) |
| ✅ | FEAT: SimulationControlBar | `main` | [FEAT-simulation-control-bar.md](features/FEAT-simulation-control-bar.md) |
| ✅ | PRD: 프로젝트 로드 시 시뮬레이션/분석 상태 초기화 | `main` | [FEAT-simulation-reset-on-project-load.md](features/FEAT-simulation-reset-on-project-load.md) |
| ✅ | FEAT: 단일 해석 관리 + 이탈 방지 | `main` | [FEAT-single-simulation-guard.md](features/FEAT-single-simulation-guard.md) |
| ✅ | FEAT: Text Code Preview | `main` | [FEAT-text-code-preview.md](features/FEAT-text-code-preview.md) |

### Unphased

| 상태 | Feature | 문서 |
|------|---------|------|
| 📖 | MARS 입력 파일 컴포넌트 비교 분석 | [FEAT-mars-component-comparison.md](features/FEAT-mars-component-comparison.md) |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite |
| State | Zustand |
| UI | Tailwind CSS, shadcn/ui |
| Flow Editor | ReactFlow |
| Backend 통신 | gRPC-Web |
| 인증 | Supabase Auth |
| 저장소 | MinIO (S3), Supabase |
