# Co-Sim Frontend-BFF 연동 가이드

> 작성일: 2026-04-09  
> 대상: BFF 작업자  
> 관련 브랜치: `feat/cosim` (frontend), `feat/cosim` (BFF)

---

## 1. 변경 요약

프론트엔드 `feat/cosim` 브랜치에서 Co-Sim 멀티 모델 지원을 위한 GUI 선행 작업이 완료되었습니다.

| 영역 | 변경 내용 |
|------|-----------|
| Storage Proto | BFF `feat/cosim` 기준으로 동기화 완료 |
| SimulationManager | 3-step Builder (CreateSimulation -> AddTask x N -> Build) 사용 |
| SimulationControl | sim-level Start/Pause/Resume/Stop 사용 |
| QuickRun | 모델 단위 파일 관리 + 시뮬레이션 레벨 설정 파일 분리 |
| 결과 파일 | `task_id` 기반 -> `simulation_id` + `task_index` 기반으로 전환 |

---

## 2. MinIO 경로 규약 (합의 사항)

### 입력 파일

```
v-smr/{user_uuid}/{project_id}/{model_id}/{파일명}
```

- `.i` 파일 (MARS 입력), `.nml` 파일 (preCICE NML 설정) 등
- `precice-config.xml`은 프로젝트 레벨이 아닌 **모델 레벨**에 위치
- 모델 ID: 7자리 축약 UUID (예: `a3f2c1e`)

### 출력 파일 (결과)

```
v-smr/{user_uuid}/{project_id}/simulation/{simulation_id}/{task_index}/{파일명}
```

- `task_id` 제거, **`task_index`** (0부터 시작) 사용
- `simulation_id`: UUID

### 시뮬레이션 설정 (공유)

```
v-smr/{user_uuid}/{project_id}/{파일명}
```

- `precice-config.xml` 등 전체 시뮬레이션 공유 파일
- `UploadProjectFile` RPC로 업로드
- Build RPC의 `shared_configs`에 S3 URL 전달

---

## 3. Proto 정합성 현황

### StorageService (동기화 완료)

프론트엔드 proto를 BFF `feat/cosim`에 맞춰 교체했습니다.

| RPC | 요청 필드 | 비고 |
|-----|-----------|------|
| `GetModelInputFiles` | `project_id`, `model_id` | .i + .nml 자동 탐색 |
| `UploadModelFile` | `project_id`, `model_id`, `file_name`, `content`, `content_type` | 모델별 경로 |
| `UploadProjectFile` | `project_id`, `file_name`, `content`, `content_type` | 프로젝트 루트 경로 |
| `ListResultFiles` | `project_id`, `simulation_id`, `model_id`, `task_index` | 결과 파일 목록 |
| `DownloadTaskResultFile` | `project_id`, `simulation_id`, `model_id`, `task_index`, `file_name` | 결과 파일 다운로드 |
| `DeleteProject` | `project_id` | 변경 없음 |
| `CopyFile` | `src_object_key`, `dst_object_key` | 변경 없음 |
| `DownloadFile` | `object_key` | 변경 없음 |

### SimulationManager (동기화 완료)

프론트엔드는 `vsmr.sm.v1.SimulationManager`를 호출합니다. BFF에서 이미 프록시 구현 완료 확인.

| RPC | 프론트엔드 호출 방식 |
|-----|---------------------|
| `CreateSession` | 로그인 시 자동 호출, 세션 스트림 유지 |
| `CreateSimulation` | `buildSimulation()` 내부 Step 1 |
| `AddTask` | Step 2, 모델별 반복 호출. args에 `--bff-model-id`, `--bff-title`, `--bff-description` 포함 |
| `Build` | Step 3, `shared_configs`에 S3 URL 배열 전달 |
| `DeleteTask` | 세션 종료 시 또는 명시적 삭제 |
| `ListSimulations` | 관리 목적 조회 |

### SimulationControl (동기화 완료)

| RPC | 용도 |
|-----|------|
| `Start(SimulationId)` | 시뮬레이션 시작 (fan-out to all tasks) |
| `Pause(SimulationId)` | 일시정지 |
| `Resume(SimulationId)` | 재개 |
| `Stop(SimulationId)` | 정지 |
| `GetState(SimulationId)` | 전체 상태 + 태스크별 상태 |
| `SetSimulationSpeed` | 속도 비율 설정 |
| `GetSimulationSpeed` | 현재 속도 조회 |

---

## 4. 프론트엔드 호출 플로우

### 4-1. 단일 모델 QuickRun

```
1. UploadModelFile(projectId="_quickrun", modelId="a3f2c1e", fileName="indta.i", content=...)
   → response.file_url = "s3://v-smr/{user}/{_quickrun}/{a3f2c1e}/indta.i"

2. UploadModelFile(projectId="_quickrun", modelId="a3f2c1e", fileName="precice_mars.nml", content=...)
   → 같은 모델 경로에 설정 파일 업로드

3. CreateSimulation() → simId
4. AddTask(simId, args=["new", "s3://...", "--bff-title=...", "--bff-model-id=a3f2c1e"])
   → taskId = "{simId}-0"
5. Build(simId, shared_configs=[])
```

### 4-2. 멀티 모델 Co-Sim QuickRun

```
1. 모델별 파일 업로드:
   UploadModelFile(projectId="_quickrun", modelId="a3f2c1e", fileName="PRI.i", ...)
   UploadModelFile(projectId="_quickrun", modelId="a3f2c1e", fileName="precice_mars.nml", ...)
   UploadModelFile(projectId="_quickrun", modelId="b7d4e2a", fileName="SEC.i", ...)
   UploadModelFile(projectId="_quickrun", modelId="b7d4e2a", fileName="precice_mars.nml", ...)

2. 시뮬레이션 설정 업로드:
   UploadProjectFile(projectId="_quickrun", fileName="precice-config.xml", ...)
   → response.file_url = "s3://v-smr/{user}/{_quickrun}/precice-config.xml"

3. CreateSimulation() → simId
4. AddTask(simId, args=["new", "s3://.../PRI.i", "--bff-model-id=a3f2c1e", "--bff-title=..."]) → taskId-0
   AddTask(simId, args=["new", "s3://.../SEC.i", "--bff-model-id=b7d4e2a", "--bff-title=..."]) → taskId-1
5. Build(simId, shared_configs=["s3://.../precice-config.xml"])
```

### 4-3. 실시간 스트리밍 (변경 없음)

```
MarsTaskStream.SubscribeScreenLog(taskId) → per-task 스트림
MarsTaskStream.SubscribeMinorEdit(taskId) → per-task 스트림
MarsTaskStream.SubscribeSimState(taskId)  → per-task 스트림
```

프론트엔드는 Co-Sim 시 모델별로 독립 스트림을 열어 데이터를 수집합니다.

### 4-4. 결과 파일 조회

```
ListResultFiles(projectId, simulationId, modelId, taskIndex=0)
DownloadTaskResultFile(projectId, simulationId, modelId, taskIndex=0, fileName="plotfl")
```

---

## 5. BFF 확인/수정 필요 사항

### 5-1. `get_model_input_files` IndentationError

`storage_service_server.py` 214행 부근에 들여쓰기 오류가 있습니다.

```python
# 현재 (잘못됨):
        """
                user_id = self._extract_user_id(ctx, "GetModelInputFiles")

# 수정 필요:
        """
        user_id = self._extract_user_id(ctx, "GetModelInputFiles")
```

### 5-2. `UploadProjectFile` 경로 확인

프론트엔드는 `precice-config.xml`을 `UploadProjectFile`로 업로드합니다.

- 기대 경로: `v-smr/{user_id}/{project_id}/precice-config.xml`
- BFF의 `UploadProjectFile` 구현이 이 경로에 저장하는지 확인 필요

### 5-3. `Build` RPC의 `shared_configs` 처리

프론트엔드는 `Build(simId, shared_configs=["s3://..."])` 형태로 호출합니다.

- BFF에서 `--bff-*` 항목을 `shared_configs`에서도 추출하는 로직이 있는데, 프론트엔드는 `shared_configs`에 `--bff-*`를 넣지 않습니다.
- `shared_configs`에는 순수한 S3 URL만 전달됩니다.

### 5-4. `AddTask` args에 포함되는 BFF 메타데이터

프론트엔드가 `AddTask.args`에 포함하는 `--bff-*` 항목:

| Key | 예시 | 용도 |
|-----|------|------|
| `--bff-model-id` | `a3f2c1e` | 모델 식별 (7자리 short UUID) |
| `--bff-title` | `PRI, SEC` | 시뮬레이션 제목 |
| `--bff-description` | `Co-Sim test` | 설명 |
| `--bff-restart-project-id` | (빈 문자열 or UUID) | 재시작 시 프로젝트 ID |

BFF `AddTask` 핸들러에서 `--bff-model-id` 추출 로직이 있는지 확인 필요합니다.
현재 BFF 코드에서 `--bff-restart-project-id`, `--bff-title`, `--bff-description`은 처리하지만
`--bff-model-id`는 처리 여부가 불명확합니다.

---

## 6. 논의 필요 사항

### 6-1. `simulation_history` 테이블 스키마

BFF의 `_insert_simulation_history`가 Build 성공 후 DB에 기록합니다.
현재 스키마에 `simulation_id` 컬럼이 있는지, 기존 `task_id` 기반에서 마이그레이션이 필요한지 확인 필요.

프론트엔드의 `SimulationEntry` 타입:
```typescript
interface SimulationEntry {
  id: string;          // 기존: task_id, 신규: simulation_id ?
  simId?: string;      // Co-Sim simulation ID
  taskIds?: string[];  // Co-Sim 내 각 모델의 task ID 목록
  modelId: string;
  // ...
}
```

**질문**: `simulation_history`의 PK가 `task_id`에서 `simulation_id`로 변경되었는지?
프론트엔드는 결과 파일 조회 시 `simId || entry.id`로 폴백하고 있어서,
`entry.id`가 `simulation_id`인지 `task_id`인지에 따라 동작이 달라집니다.

### 6-2. `UploadProjectFile`의 위치

논의에서 `precice-config.xml`은 "시뮬레이션 레벨"이라 모델과 무관하다고 결정되었습니다.
그런데 BFF `feat/cosim`에서 `UploadProjectFile`이 `v-smr/{user}/{project}/{file}` 경로에 저장하는 것이 맞는지,
아니면 `UploadModelFile`을 사용하여 각 모델에 복사해야 하는지 최종 확인이 필요합니다.

현재 프론트엔드 구현:
- `precice-config.xml` -> `UploadProjectFile` (프로젝트 루트)
- `precice_mars.nml` -> `UploadModelFile` (모델별)

### 6-3. QuickRun용 projectId

QuickRun은 실제 프로젝트 없이 파일을 직접 선택하여 실행합니다.
프론트엔드는 `projectId = "_quickrun"`이라는 더미 값을 사용합니다.

- BFF/MinIO에서 `_quickrun`을 특별한 프로젝트 ID로 허용하는지?
- 아니면 임시 프로젝트를 먼저 생성해야 하는지?
- QuickRun 결과 파일의 정리(cleanup) 정책은?

### 6-4. `model_id` 형식

프론트엔드는 `crypto.randomUUID()` 앞 7자리를 `model_id`로 사용합니다.
(예: `a3f2c1e`)

- BFF/SimManager에서 이 형식을 수용하는지?
- 정규 GUI 흐름에서는 프로젝트 내 Model의 UUID (전체 길이)를 사용할 예정
- QuickRun에서만 7자리 축약 사용. 충돌 가능성은 무시할 수준.

### 6-5. `SimulationControl` 연결

프론트엔드 SimulationPage에서 Co-Sim 모드일 때:
- Start/Pause/Stop 버튼이 `SimulationControl.Start(simId)` 등을 호출해야 합니다.
- 현재 이 연결은 아직 미구현 (UI 버튼 -> 서비스 호출 분기 코드가 없음).
- 다음 작업에서 처리 예정이며, BFF `SimulationControlProxyService`가 정상 동작하는지 사전 확인 요청.

### 6-6. 스트림 토픽 (Redis)

Co-Sim 시 모델별 독립 스트림을 엽니다:

```
startModelStream(modelId="a3f2c1e", taskId="{simId}-0", callbacks)
startModelStream(modelId="b7d4e2a", taskId="{simId}-1", callbacks)
```

BFF의 `BFFMarsTaskStreamProxyService`가 `taskId` 기반으로 Redis Stream을 구독하므로
별도 수정 없이 동작할 것으로 예상되나, 복수 스트림 동시 구독 시 성능/안정성 확인 필요.

---

## 7. 테스트 시나리오

BFF가 준비되면 다음 순서로 E2E 검증:

```
1. 개발 서버 기동 (Frontend + BFF + SimManager + MinIO + Redis)

2. 단일 모델 QuickRun
   - QuickRunDialog -> 모델 추가 -> .i 파일 1개 추가 -> "해석 시작"
   - 확인: UploadModelFile 호출, CreateSimulation/AddTask/Build 순서, 스트림 연결

3. 멀티 모델 QuickRun
   - "폴더로 추가" -> co-sim 샘플 폴더 선택
   - 확인: mars1/mars2 자동 생성, precice-config.xml 시뮬레이션 설정 분류
   - .i 드롭다운에서 메인 입력 선택 -> "2개 해석 시작"
   - 확인: 모델별 UploadModelFile, UploadProjectFile, 2x AddTask, Build(shared_configs)

4. 시뮬레이션 모니터링
   - ModelTabBar에 모델별 탭 표시
   - "All" 탭: 모델별 차트/로그 수직 스택
   - 개별 탭: 해당 모델 데이터만 표시

5. 결과 파일 조회 (시뮬레이션 완료 후)
   - ListResultFiles(projectId, simId, taskIndex=0)
   - DownloadTaskResultFile로 plotfl 다운로드
```

---

## 8. 파일 변경 목록 (프론트엔드)

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `proto/storage/storage.proto` | 수정 | BFF proto 동기화 |
| `src/stubs/storage/*` | 자동생성 | buf generate |
| `src/services/storage/storageService.ts` | 전면 재작성 | 새 RPC 사용 |
| `src/services/sm/simulationManagerService.ts` | 수정 | createTask -> {taskId, simId} 반환 |
| `src/services/projectService.ts` | 수정 | listResultFiles/getModelInputFiles 시그니처 |
| `src/hooks/useCoSimQuickRun.ts` | 신규 | 멀티 모델 QuickRun 훅 |
| `src/hooks/useSimulationData.ts` | 수정 | simId/taskIndex를 Job에 저장 |
| `src/hooks/useQuickRun.ts` | 수정 | simId/taskIndex 지원 |
| `src/hooks/useModelTabs.ts` | 신규 | 모델 탭 URL 동기화 |
| `src/hooks/useDemoMode.ts` | 수정 | Co-Sim 데모 데이터 |
| `src/components/simulation/QuickRunDialog.tsx` | 전면 재작성 | 모델 단위 UI |
| `src/components/simulation/MinioFileBrowser.tsx` | 수정 | getModelInputFiles 사용 |
| `src/pages/SimulationPage.tsx` | 수정 | Co-Sim 레이아웃, simId 기반 결과 조회 |
| `src/pages/ProjectHomePage.tsx` | 수정 | simId 기반 결과 다운로드 |
| `src/pages/EditorPage.tsx` | 수정 | 멀티 모델 탭/뷰포트 캐싱 |
| `src/stores/simulationStore.ts` | 수정 | CoSimSession, 모델별 데이터 |
