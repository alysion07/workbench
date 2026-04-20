# vsmr-sim-web 로컬 서버 연동/시뮬레이션 수정 사항 정리

작성일: 2026-02-27  
대상: `vsmr-sim-web` 커밋 전 개발자 공유용

---

## 1) 수정 범위

### 1-1. 화면/기능 범위

- **검증 범위(현재): Quick Simulation 중심**
	- Quick Run 다이얼로그에서 파일 선택 → `createTask` 호출 → Job 생성/활성화
	- 실행 후 로그/차트는 Connect stream(`ScreenLog`, `MinorEdit`) 기반으로 수신
- 일반 Simulation 화면도 동일한 서비스 레이어를 사용하도록 정리했지만, **실 테스트는 Quick Simulation 위주로 진행**

### 1-2. 변경 디렉터리/파일 요약 (핵심)

> 아래 표는 “실제 동작 영향이 있는 파일” 기준입니다. (`src/stubs/**`는 생성 파일 묶음으로 별도 정리)

| 구분 | 디렉터리/파일 | 변경 내용 | 영향 |
|---|---|---|---|
| 환경설정 | `.env.example`, `.env`, `public/env.js` | `VITE_BFF_URL`, `VITE_TASK_TYPE` 중심으로 BFF/TaskType 설정 정리 | 로컬/런타임 대상 서버 전환 용이 |
| Proto 생성 | `buf.gen.yaml` | `src/stubs`로 `protoc-gen-es`, `connect-es` 생성 설정 통일 | 스텁 재생성 표준화 |
| 패키지 | `package.json`, `package-lock.json` | `@connectrpc/connect`, `@connectrpc/connect-web`, `@bufbuild/protobuf` 사용 기준으로 의존성 정리 | 구 gRPC-Web 레이어 제거 |
| 시뮬레이션 훅 | `src/hooks/useSimulationData.ts` | 폴링/Mock 흐름에서 Connect stream 기반(`connectTaskStreamService`)으로 전환 | 로그/MinorEdit 실시간 처리 방식 변경 |
| Quick 실행 | `src/hooks/useQuickRun.ts` | `taskManagerService.createTask(args[])` 사용, Minor Edit 파싱 후 설정 병합 | Quick Simulation 실행 경로 일원화 |
| 인증 상태 | `src/stores/authStore.ts` | 로그인/초기화 시 `createSession`, 로그아웃 시 `closeSession` + store 정리 | 세션 생성/정리 타이밍 명확화 |
| 세션 저장소 | `src/stores/sessionStore.ts`, `src/stores/index.ts` | `session_id` 상태 저장 + 서비스 레이어 동기화 | 전역 세션 관리 추가 |
| TaskManager 서비스 | `src/services/tm/taskManagerService.ts`, `src/services/tm/index.ts` | Connect TaskManager 래퍼 + long-lived `CreateSession` 스트림 관리 | Task 생성/조회 표준 API 제공 (`DeleteTask`는 web 미사용) |
| Stream 서비스 | `src/services/sse/connectTaskStreamService.ts`, `src/services/sse/index.ts` | `MarsTaskStream`의 `SubscribeScreenLog`, `SubscribeMinorEdit` 연결 + 재시도 | 실시간 수집 안정성 개선 |
| MARS 제어 서비스 | `src/services/mars/marsTaskControlService.ts`, `marsServiceMod02.ts`, `marsServiceMod06.ts`, `index.ts` | Task 제어/공통변수/ICV 제어 Connect 래퍼 신설 | 화면에서 MARS 제어 RPC 호출 가능 |
| 스토리지 서비스 | `src/services/storage/storageService.ts`, `src/services/storage/index.ts`, `src/services/projectService.ts` | MinIO SDK 직접 호출에서 Storage RPC 호출로 전환 | 파일/프로젝트 CRUD 경로 단일화 |
| UI 반영 | `src/pages/SimulationPage.tsx`, `src/components/simulation/LiveLogViewer.tsx`, `DynamicChartGrid.tsx`, `ChartCard.tsx`, `src/pages/GrpcTestPage.tsx` | Live 로그/차트 표시 개선, 서비스 import 경로 정리 | 시각화/디버그 페이지 동작 일치 |
| Proto 정의 | `proto/mars/mars_task_stream.proto` | `MarsTaskStream` 서비스 정의 포함 | stream API 단일 proto 기준 |
| 레거시 제거 | `src/services/grpc/*`, `src/proto/task_manager*`, `src/services/minioClient.ts` | 구 gRPC-Web/MinIO 직결 코드 삭제 | 코드 경로 단순화 |

### 1-3. 생성 파일(자동 생성) 범위

| 디렉터리 | 설명 |
|---|---|
| `src/stubs/tm/**` | TaskManager Connect/ES 스텁 |
| `src/stubs/mars/**` | MARS 제어/공통변수/인터랙티브/스트림 스텁 |
| `src/stubs/storage/**` | Storage 서비스 스텁 |

> 참고: `src/stubs/**`는 `buf.gen.yaml` 기준 재생성 산출물입니다.

---

## 2) 추가된 설정 정리

### 2-1. 필수/권장 환경변수

| 변수 | 예시 | 용도 |
|---|---|---|
| `VITE_BFF_URL` | `http://localhost:5992` 또는 사내 BFF 주소 | 모든 Connect API base URL (`${BFF_URL}/api`) |
| `VITE_TASK_TYPE` | `mars` | `createTask` 시 task type 지정 |
| `VITE_DEV_MODE` | `true` | 개발 모드 플래그 |
| `VITE_LOG_LEVEL` | `debug` | 로그 레벨 제어 |

런타임 오버라이드는 `public/env.js`의 `window.__ENV` 값을 우선 사용합니다.

---

## 3) 로그인 시 create-session 및 세션 저장 방식

### 3-1. 동작 흐름

1. 앱 초기화(`authStore.initialize`)에서 Supabase 세션 복원
2. 로그인 상태면 `createSession()` 호출
3. `TaskManager.CreateSession` **server-stream**에서 `session_id` 수신
4. `useSessionStore.setSessionId()`로 저장 + `taskManagerService.setSessionId()`로 서비스 레이어 동기화
5. 로그아웃(`SIGNED_OUT` 또는 `signOut`) 시 `closeSession()` 호출하여 stream abort
6. 서버는 stream 종료 감지 후 세션 정리(서버 측 cleanup 트리거)

### 3-2. 저장 위치

- 클라이언트 상태 저장: `zustand` (`sessionStore.sessionId`)
- 서비스 레이어 내부 캐시: `taskManagerService.currentSessionId`
- Supabase 토큰은 기존 방식대로 Supabase SDK에서 관리

---

## 4) RPC 요청 시 HTTP에 전달되는 정보

| 헤더 | 값 | 주입 위치 | 비고 |
|---|---|---|---|
| `Authorization` | `Bearer <supabase access token>` | TM/MARS/Storage/Stream interceptor 공통 | 인증 필수 구간 |
| `X-Session-Id` | `createSession`으로 받은 `session_id` | TM/MARS/Stream interceptor | 세션 문맥 식별 |
| `X-Task-Id` | 현재 활성 Job ID(`activeJobId`) | MARS 제어 계열(mod02/mod06/task_control) | task-scoped RPC에서 사용 |

> 참고: Storage 서비스는 현재 `Authorization` 중심이며 `X-Session-Id`/`X-Task-Id`는 사용하지 않습니다.

---

## 5) 서버 인터페이스 (API 명세 스타일 요약)

기본 URL: `VITE_BFF_URL + /api`  
프로토콜: Connect-RPC (Unary + Server Streaming)

### 5-1. TaskManager (`vsmr.tm.v1.TaskManager`)

| 메서드 | 타입 | Request | Response | 용도 |
|---|---|---|---|---|
| `CreateSession` | Server Stream | `Empty` | `SessionId`(stream) | 세션 생성 + 연결 생존 감지 |
| `CreateTask` | Unary | `TaskArgs(task_type,args[],start_mode)` | `TaskId` | 새 시뮬레이션 작업 생성 |
| `DeleteTask` | Unary | `TaskId` | `Empty` | 작업 삭제(현재 web에서 호출하지 않음) |
| `ListAllTasks` | Unary | `Empty` | `TaskInfoList` | 작업 전체 조회 |
| `ListTaskTypes` | Unary | `Empty` | `TaskTypeList` | 지원 task type 조회 |
| `ListTasksByType` | Unary | `ListTasksByTypeRequest` | `TaskInfoList` | 타입별 작업 조회 |

사용 예시(요약):

- `createSession()` 호출 후 반환된 `sessionId`를 store에 보관
- `createTask(['v-smr','user/project','SMART.i'])`
- 히스토리 저장이 필요한 경우 `Build.shared_configs`에 `--bff-*` 내부 메타데이터를 함께 전달
- `TaskArgs.start_mode`는 proto 기본값이 `AUTO(0)`이며, web에서는 `StartMode.AUTO`를 명시해 호출

히스토리 저장용 `CreateTask` 호출 예시:

```ts
await simulationManagerService.createTask({
	args: [
		'new',
		's3://v-smr/user/project/SMART.i',
	],
	buildHeaders: [
		'--bff-restart-project-id=11111111-2222-3333-4444-555555555555',
		'--bff-title=Base Scenario Run',
		'--bff-description=Initial simulation from web UI',
	],
});
```

설명:

- `--bff-*` 항목은 frontend에서 `Build.shared_configs`로 옮겨져 BFF가 내부적으로만 소비함
- task mode(`new`/`restart`)와 `input_file` URL만 simulation-manager `AddTask.args`로 전달됨
- `CreateTask` 성공 시 `task_id`와 함께 `simulation_history`에 저장됨
- `project_id`는 BFF DB의 `simulation_history.project_id`와 호환되는 값을 사용해야 함
- restart의 `rstplt` 사전 복사는 web이 `StorageService.CopyFile`을 먼저 호출해 수행하고, BFF는 `--bff-*`를 이력 저장 메타데이터로만 사용함

### 5-2. Stream (`vsmr.mars.v1.MarsTaskStream`)

| 메서드 | 타입 | Request | Response | 용도 |
|---|---|---|---|---|
| `SubscribeScreenLog` | Server Stream | `TaskId` | `ScreenLogLine` | 실시간 화면 로그 수신 |
| `SubscribeMinorEdit` | Server Stream | `TaskId` | `MinorEditSnapshot` | 실시간 MinorEdit 데이터 수신 |

클라이언트 구현 포인트:

- `connectTaskStreamService.startConnectTaskStream(taskId, callbacks)` 사용
- 재연결(backoff + jitter) 내장
- 로그는 500ms batch flush 후 store append

### 5-3. MARS 제어 API

#### A) Task Control (`vsmr.mars.v1.MARSTaskControl`)

| 메서드 | 타입 | Request | Response | 상세 |
|---|---|---|---|---|
| `Start` | Unary | `google.protobuf.Empty` | `ControlReply` | 상태 전이 요청: `CREATED → RUNNING` |
| `Pause` | Unary | `google.protobuf.Empty` | `ControlReply` | 상태 전이 요청: `RUNNING → PAUSED` |
| `Resume` | Unary | `google.protobuf.Empty` | `ControlReply` | 상태 전이 요청: `PAUSED → RUNNING` |
| `Stop` | Unary | `google.protobuf.Empty` | `ControlReply` | 상태 전이 요청: `RUNNING/PAUSED/COMPLETED → STOPPED` |
| `GetState` | Unary | `google.protobuf.Empty` | `TaskState` | 단일 진실원(Source of Truth) 상태 조회 |
| `GetIterationCount` | Unary | `google.protobuf.Empty` | `google.protobuf.Int64Value` | 반복/스텝 카운터 조회 |

`ControlReply` 필드 설명:

- `accepted: bool` — 상태 전이가 **적용되었는지** 여부 (`false`면 불법 전이로 거절)
- `reason: string` — 거절/처리 이유(예: `cannot pause when state is CREATED`)
- `state: TaskState` — 요청 처리 **이후** 상태

`TaskState` 필드 설명:

- `status: Status` — `CREATED | RUNNING | PAUSED | COMPLETED | STOPPED`
- `last_update_ts_ms: int64` — 마지막 상태 변경 시각(ms epoch, UI 디버깅 용도)
- `detail: string` — 사람이 읽는 상세 정보(선택)

프론트 처리 권장:

- 제어 버튼 호출 후 `accepted` 확인 → 실패 시 `reason` 표시
- 성공/실패와 무관하게 `state.status`를 화면 상태의 기준값으로 사용

#### B) Common Variables (`vsmr.mars.v1.CommonVariables`)

| 메서드 | 타입 | Request | Response | 상세 |
|---|---|---|---|---|
| `GetSnapshot` | Unary | `google.protobuf.Empty` | `CVsSnapshot` | 공통 변수 묶음 조회(화면 초기 hydrate에 유용) |
| `GetTimeHy` | Unary | `google.protobuf.Empty` | `google.protobuf.DoubleValue` | 현재 시뮬레이션 시간 |
| `GetDt` | Unary | `google.protobuf.Empty` | `google.protobuf.DoubleValue` | 시간 간격(dt) |
| `IsDone` | Unary | `google.protobuf.Empty` | `google.protobuf.BoolValue` | 종료 여부 |
| `GetProblemType` | Unary | `google.protobuf.Empty` | `google.protobuf.Int32Value` | 문제 타입 코드 |
| `GetProblemOpt` | Unary | `google.protobuf.Empty` | `google.protobuf.Int32Value` | 문제 옵션 코드 |

`CVsSnapshot` 필드 설명:

- `timehy: double` — 시뮬레이션 시간
- `dt: double` — 시간 증분
- `done: bool` — 종료 여부
- `problem_type: int32` — 시나리오/문제 타입 코드
- `problem_opt: int32` — 문제 옵션 코드

프론트 처리 권장:

- 대시보드 초기 진입 시 `GetSnapshot` 1회 호출 후, 필요한 값만 개별 getter로 보강
- 래퍼(`marsServiceMod02.ts`)는 wrapper message에서 `.value`를 꺼내 primitive로 반환

#### C) Interactive Control (`vsmr.mars.v1.InteractiveControl`)

| 메서드 | 타입 | Request | Response | 상세 |
|---|---|---|---|---|
| `GetICVTypeSummary` | Unary | `google.protobuf.Empty` | `ICVTypeSummary` | 전체 수 + 타입별 개수 |
| `GetAllICVs` | Unary | `google.protobuf.Empty` | `ICVSnapshotList` | 전체 ICV 스냅샷(폴링 권장 API) |
| `GetICVsByType` | Unary | `ListICVsByTypeRequest` | `ICVSnapshotList` | 타입 필터 조회 |
| `GetICV` | Unary | `GetICVRequest` | `ICVSnapshot` | 단일 object_id 조회 |
| `SetICV` | Unary | `SetICVRequest` | `google.protobuf.Empty` | ICV 제어값 전달(Forward-only) |

요청 메시지 설명:

- `ListICVsByTypeRequest.type: ICVType` — 타입별 필터 (`TRIP`, `VALVE`, `FLOWF`, `FLOWG`, `HEATER`, `REACTIVITY`, `CNTRLVAR`, `TMDPV`)
- `GetICVRequest.object_id: int32` — 단일 ICV 식별자
- `SetICVRequest.object_id: int32`, `SetICVRequest.patch: ICVPatch`
	- `ICVPatch.target: DoubleValue` (선택)
	- `ICVPatch.rate: DoubleValue` (선택)
	- `ICVPatch.cmode: ControlMode` (선택, oneof 기반 presence)

응답 메시지 설명:

- `ICVTypeSummary.total_count`, `counts[]` — 전체/타입별 개수
- `ICVSnapshot` — `object_id`, `whatis`, `ctype`, `cccno`, `cmode`, `asis`, `target`, `rate`
- `ICVSnapshotList.icvs[]` — 다건 스냅샷

`ControlMode` 매핑(외부 API 기준):

- `AUTOMATIC`, `MANUAL_TRUE`, `MANUAL_FALSE`
- 서버 내부 MARS 값 매핑은 `0 / 1 / -1`

중요 계약(주석 기준):

- `SetICV`는 **전달 성공 여부만** 보장하고, 실제 적용 완료를 보장하지 않음
- 적용 확인은 `GetICV` 또는 `GetAllICVs` 재조회(폴링)로 검증해야 함

### 5-4. Storage (`vsmr.storage.v1.StorageService`)

| 메서드 | 타입 | 용도 |
|---|---|---|
| `ListBuckets` | Unary | 버킷 목록 조회 |
| `ListProjects` | Unary | 사용자 프로젝트 목록 |
| `ListProjectFiles` | Unary | 프로젝트 파일 목록 |
| `UploadFile` | Unary | 파일 업로드 |
| `DownloadFile` | Unary | 파일 바이너리 다운로드 |
| `GetDownloadUrl` | Unary | 사전서명 URL 발급 |
| `DeleteFile` | Unary | 파일 삭제 |
| `DeleteProject` | Unary | 프로젝트 삭제 |

---

## 6) Quick Simulation 기준 사용 방법(개발자 참고)

1. 로그인 후 세션 생성 로그 확인 (`createSession`)
2. Simulation 화면에서 Quick Run 버튼으로 `.i` 파일 선택
3. `useQuickRun`이 Minor Edit 파싱 → globalSettings 병합
4. 필요 시 `createTask([...bffMetaArgs, ...runtimeArgs])` 형식으로 내부 메타데이터와 실행 인자를 함께 전달
5. `createTask(args[])` 실행 후 `activeJobId` 설정
6. `useLiveData`가 stream 구독 시작
	 - ScreenLog → 로그 패널
	 - MinorEditSnapshot → 차트 데이터(`v0..vn`) 반영

---

## 7) 참고/주의사항

- 현재 `isMockMode()`는 `false` 고정이며 Connect-RPC 기준으로 동작합니다.
- 레거시 gRPC-Web/MinIO 직접 연동 코드는 제거되었습니다.
- `src/stubs/**`는 생성물이라 수동 수정 대신 proto + `buf generate` 갱신을 권장합니다.
- 이번 정리는 **커밋 전 공유용**이며, 실제 운영 검증 범위는 추가 회귀 테스트가 필요합니다.

