# Workflow: main #86 기능을 feat/cosim에 적용

> **커밋**: `6fb0124` — fix: separate component ID namespace for heat structures and add junction control flags UI (#86)
> **전략**: 의존성 순서대로 기능 그룹별 수동 적용
> **상태**: 전체 완료 (2026-04-15)
> **변경**: 35파일, +688/-386

## 적용 결과

| Phase | Step | 내용 | 상태 |
|-------|------|------|:----:|
| 1 | A | Component ID Namespace 분리 (htstr 독립 번호 체계) | 완료 |
| 1 | B | JunctionControlFlagsField 신규 + BranchForm 적용 | 완료 |
| 1 | C | Edge 색상 Desaturated Tint + Separator 핸들러 + Face 0 검증 확장 | 완료 |
| 2 | F | MinorEditsTab null-safe, useLiveNodeValues rktpow→Core 매핑, fileGenerator jefvcahs 패딩 | 완료 |
| 2 | F2 | SeparatorForm Face 0 legacy 옵션 + JunctionControlFlagsField 적용 | 완료 |
| 3 | D1 | LoadFollowWidget 신규 + 위젯 5개 frosted glass + withNodeWidgets LOD 개선 | 완료 |
| 3 | D2 | MiniChartWidget 다운샘플링 + buildChartColorMap 색상 동기화 유틸 | 완료 |
| 3 | D3 | ICV: autoGroupMode 동기화 + chartColorMap 위젯 색상 동기화 | 완료 |
| - | E | Chart Auto Group (chartConfigBuilder, DynamicChartGrid, simulationStore) | 완료 |

## 인터페이스 매핑 참고

| main (구) | feat/cosim (현) |
|-----------|----------------|
| `useActiveJob()` | `useActiveModel()` |
| `activeJob?.taskId` | `activeModel?.taskId` |
| `activeJob?.status` | `activeModel?.status` |
| `Job[]` | `coSimSession.models` |
| `activeJobId` | `activeModelId` |
| `useSimulationStore().jobs` | `useSimulationStore().coSimSession?.models` |

---

## 테스트 체크리스트

### 1. Chart Auto Group — 모니터링 ↔ ICV 통합

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 1.1 | Auto Group 토글 동작 | Monitoring 탭 → `Auto Group` 버튼 클릭 → editGroup → variableType 기준 재그룹핑 |Pass |
| 1.2 | Auto Group 탭 표시 | ON 시 "Pressure", "Temperature", "Flow" 등 변수 타입별 탭 표시 |Pass |
| 1.3 | Auto Group OFF 복원 | OFF 시 Group 1, 2, ... 숫자 탭으로 복원 | Pass|
| 1.4 | ICV 차트 그리드 표시 | ICV Charts 토글 → 하단에 DynamicChartGrid(embedded) 표시, 탭+그리드 레이아웃 확인 | Pass|
| 1.5 | ICV 탭 독립 동작 | Monitoring에서 Group 2 선택 → ICV 탭은 All 유지 (독립 `icvActiveTabId`) | Pass|
| 1.6 | ICV 차트 리사이즈 | ICV 하단 차트 패널에서 개별 차트 드래그 리사이즈 동작 | Pass|
| 1.7 | ICV Auto Group 공유 | Auto Group 토글 → Monitoring & ICV 양쪽 동시 반영 |Pass |
| 1.8 | 위젯 색상 동기화 | ICV MiniChartWidget 상단 테두리 색상 = Monitoring 차트 라인 색상 | Pass|
| 1.9 | chartConfigBuilder 공유 | DynamicChartGrid full & embedded 모두 동일한 dataKey 사용 확인 |Pass |
| 1.10 | ICV 패널 높이 조절 | 리사이즈 핸들 드래그 → 차트 그리드가 높이에 맞게 재배치 | Pass|

### 2. Component ID Namespace 분리

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 2.1 | 열구조체 동일 CCC 허용 | Pipe(CCC=100) + HeatStructure(CCC=100) 동시 추가 → 에러 없음 | Pass |
| 2.2 | 같은 카테고리 내 중복 차단 | Pipe(200) 존재 → 새 Pipe CCC=200 입력 → 중복 에러 | Pass|
| 2.3 | ComponentIdField 경고 | HeatStructureForm에서 수력 컴포넌트와 동일 CCC → 에러 안남 |Pass |
| 2.4 | 프로젝트 로드 | 동일 CCC를 가진 htstr+수력 프로젝트 로드 → 정상 | Pass|

### 3. Junction Control Flags UI

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 3.1 | BranchForm 플래그 UI | Branch → Junction 섹션에 ToggleButton 기반 플래그 UI |Pass |
| 3.2 | SeparatorForm 플래그 UI | Separator → j,e,f,v 고정(0000), c,a,h,s만 편집 가능 | Pass|
| 3.3 | 플래그 기본값 | Separator jefvcahs = `00001000` | Pass |
| 3.4 | 추천값 표시 | Separator choking 필드에 ★ 아이콘 + 설명 | Pass|
| 3.5 | Result 값 갱신 | 플래그 변경 → "Result: XXXXXXXX" 실시간 갱신 | Pass |
| 3.6 | 파일 생성 포맷 | .i 파일의 jefvcahs가 6자리 패딩 출력 (00001000 → 001000) |Pass |

### 4. Edge/Connection 개선

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 4.1 | 엣지 색상 | 기본 엣지가 저채도 파스텔(연한 파란/앰버) | Pass|
| 4.2 | 엣지 호버 | 마우스 올리면 채도 복원 | Pass|
| 4.3 | 엣지 트랜지션 | 색상 전환 0.2s smooth 애니메이션 |Pass|
| 4.4 | 선택 색상 | 선택 시 `#1976d2` (진한 파란) | Pass|
| 4.5 | Separator 엣지 동기화 | Separator 연결 생성 → junction 파라미터 동기화 | Pass|
| 4.6 | Edge recovery on load | 엣지 누락 프로젝트 로드 → 자동 보충 | Pass|

### 5. SeparatorForm Volume Reference

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 5.1 | Face 0 옵션 | Junction From/To 드롭다운에 "Inlet Side" / "Outlet Side" 표시 | |
| 5.2 | Pipe Face 0 | 대상 Pipe에 "Inlet Side", "Cell 1 Center", "Cell N Center" 표시 | |
| 5.3 | Turbine/Tank 지원 | 연결 대상에 Turbine, Tank도 표시 | Pass|

### 6. Widget UI 개선 — 리팩터링 예정, 테스트 생략

### 7. MinorEditsTab / useLiveNodeValues — 리팩터링 예정, 테스트 생략

### 8. handleResolver / nodeIdResolver

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 8.1 | Branch/Separator 핸들 | Volume Reference → `target-j{N}` / `source-j{N}` 해석 | |
| 8.2 | Face 0 범위 확장 | Face 0에서 volumeNum 0~99 유효 (이전: 0, 1만) | |

### 9. Co-Sim 호환성 (Regression)

| # | 항목 | 검증 방법 | Pass |
|---|------|----------|:----:|
| 9.1 | 단일 모델 QuickRun | 실행 → 시뮬레이션 동작 + 차트 표시 | |
| 9.2 | Co-Sim QuickRun | 다중 모델 → 탭 전환 시 독립 데이터 표시 | |
| 9.3 | 모델별 plotData | ICV에서 활성 모델 데이터만 반환 | |
| 9.4 | 세션 상태 전환 | building → running → completed 정상 반영 | |

---

**총 31개 항목 / 9개 영역** (6,7번 리팩터링 예정으로 생략)
**우선순위**: 1(차트 동기화) > 9(Co-Sim regression) > 3(Junction Flags) > 나머지

## 별도 이슈
- **Pipe face 1 드래그 연결 불가** — Branch/Separator 핸들에서 Pipe face 1(초록)에 드래그 연결 안 됨, face 2(파란)만 가능. 양방향 핸들 설계(GUIDE-handle-bidirectional.md) 관련 조사 필요
