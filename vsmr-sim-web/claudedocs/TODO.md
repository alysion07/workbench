# TODO — feat/cosim

> 마지막 갱신: 2026-04-15

## 미해결 이슈

### Pipe face 1 드래그 연결 불가
- **증상**: Branch/Separator 핸들에서 Pipe face 1(초록)에 드래그 연결 안 됨, face 2(파란)만 가능
- **원인 추정**: 양방향 핸들 설계(같은 ID로 source+target 중복)에서 ReactFlow 핸들 해석 충돌
- **참조**: `../vsmr-sim-docs/guides/GUIDE-handle-bidirectional.md`
- **관련 파일**: `src/components/nodes/PipeNode.tsx`, `FlowCanvas.tsx` (ConnectionMode.Strict)

## 미테스트 항목 (main #86 적용)

### 5. SeparatorForm Volume Reference
- [ ] 5.1 Face 0 옵션 — Junction From/To 드롭다운에 "Inlet Side" / "Outlet Side" 표시
- [ ] 5.2 Pipe Face 0 — 대상 Pipe에 "Inlet Side", "Cell 1 Center", "Cell N Center" 표시

### 8. handleResolver / nodeIdResolver

- [ ] **8.1 Branch/Separator 핸들 해석**
  1. Branch에 Pipe를 연결 (폼에서 From/To 수동 선택)
  2. 저장 → 캔버스에 엣지 생성 확인
  3. 엣지의 sourceHandle/targetHandle이 `source-j{N}` / `target-j{N}` 형식인지 확인 (개발자 도구 → React DevTools 또는 콘솔에서 edges 배열)
  4. Separator도 동일하게 J1, J2, J3 각각 테스트

- [ ] **8.2 Face 0 범위 확장 (0~99)**
  1. Pipe의 셀 수를 10 이상으로 설정
  2. Separator 폼 → Junction N=1 → To Volume 드롭다운 열기
  3. "Pipe - Cell 5 Center" (volumeNum=5, face=0) 옵션이 표시되는지 확인
  4. "Cell 10 Center" 선택 → 저장 → Text Preview에서 Volume Reference가 `{CCC}100000` 형식으로 출력되는지 확인
  5. 폼 재오픈 → 저장된 값 유지 확인

### 9. Co-Sim 호환성 (서버 연결 필요: vsmrtest2.r-e.kr)

- [ ] **9.1 단일 모델 QuickRun**
  1. 프로젝트에 모델 1개만 있는 상태에서 Quick Run 실행
  2. 시뮬레이션 상태가 building → running으로 전환 확인
  3. Monitoring 탭에서 차트 데이터 수신 + 라인 표시 확인
  4. ICV 탭 전환 → embedded 차트에도 동일 데이터 표시 확인

- [ ] **9.2 Co-Sim QuickRun (다중 모델)**
  1. 프로젝트에 모델 2개 이상 설정 (Co-Sim 구성)
  2. Quick Run 실행
  3. 모델 탭(Model A, Model B) 전환 시 각 모델의 독립 차트 데이터 표시 확인
  4. Model A 선택 → Monitoring 차트에 Model A 데이터만 표시
  5. Model B 선택 → Monitoring 차트에 Model B 데이터로 전환

- [ ] **9.3 모델별 plotData**
  1. Co-Sim 실행 중 ICV 탭 열기
  2. 모델 탭 전환 → ICV 위젯/차트에 활성 모델 데이터만 표시되는지 확인
  3. 다른 모델의 데이터가 혼입되지 않는지 확인 (값 비교)

- [ ] **9.4 세션 상태 전환**
  1. Quick Run 실행 → 상태 표시가 building → running 전환 확인
  2. 시뮬레이션 완료 대기 → running → completed 전환 확인
  3. 중간에 Stop 버튼 → stopped 상태 전환 확인
  4. Co-Sim의 경우: 한 모델만 완료되어도 세션 전체는 running 유지, 전체 완료 시 completed

## 리팩터링 예정
- Widget UI 개선 (6번 영역) — frosted glass, LOD, 다운샘플링 등
- MinorEditsTab / useLiveNodeValues (7번 영역) — null-safe, rktpow 매핑, 버퍼 상한
