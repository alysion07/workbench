# TEST: RESTART 시뮬레이션 테스트 가이드

> **대상 파일**: `documents/100-50-100%_TR_ICV.i`
> **목표**: RESTART 프로젝트 생성 → 입력파일 출력 → 시뮬레이션 시작 → JSON 내보내기 검증

---

## 1. 참조 입력파일 구조 분석

`100-50-100%_TR_ICV.i`는 **RESTART + TRANSNT** 모드의 입력파일입니다.

| 카드 | 값 | 의미 |
|------|-----|------|
| Title | `= BOP Conceptual Input Model -restart file` | 제목 |
| Card 1 | `1  90` | 문제 번호 + 옵션 |
| Card 100 | `restart  transnt` | **RESTART** + **TRANSNT** |
| Card 101 | `run` | 실행 옵션 |
| Card 102 | `si  si` | 단위계 (SI/SI) |
| Card 103 | `-1` | restart number = -1 (마지막 블록) |
| Card 120-121 | 2개 시스템 (BOP, SEA) | **주의: RESTART에서는 파일생성기가 skip** |
| Card 200 | `0` | 초기 시간 = 0 |
| Card 201-204 | 4개 Time Phase | 시간 단계 제어 |
| Card 301-326 | 26개 Minor Edit | 플롯 요청 변수들 |
| Card 401-406 | 6개 Variable Trip | 트립 조건들 |
| Card 20230000+ | General Table #23 | Load Follow 테이블 (power, reac-t) |

---

## 2. 전제 조건

RESTART 프로젝트를 테스트하려면 **소스 프로젝트(원본 NEW 시뮬레이션)**가 먼저 존재해야 합니다:

1. **소스 프로젝트**에서 NEW + STDY-ST 시뮬레이션을 완료한 이력이 있어야 함
2. 해당 시뮬레이션의 **rstplt 파일**이 MinIO에 저장되어 있어야 함
   - 경로: `{userId}/{projectId}/simulation/history/{taskId}/rstplt`
3. 소스 프로젝트의 **projectId**, **modelId**, **simulationId(taskId)** 를 알아야 함

---

## 3. Step 1: 새 RESTART 프로젝트 생성 (NewProjectWizard)

1. **ProjectPickerPage** → **NEW PROJECT** 버튼 클릭
2. 위저드에서 설정:
   - **Title**: `BOP Load Follow RESTART`
   - **Description**: `100-50-100% TR ICV restart test`
   - **Scope**: BOP 관련 시스템 선택
   - **Partition(모델) 추가**:
     - **Name**: `BOP Model`
     - **Analysis Code**: `MARS`
     - **MARS Config**:
       - **Problem Type**: `RESTART` 선택
       - **Problem Option**: `TRANSNT` 선택
       - **Restart Source**: 소스 프로젝트/모델/시뮬레이션 선택
         - `restartNumber`: `-1` (마지막 블록)

이 단계에서 `models[0].settings`에 저장되는 값:

```json
{
  "marsConfig": {
    "problemType": "RESTART",
    "problemOption": "TRANSNT",
    "restartSource": {
      "projectId": "소스-UUID",
      "modelId": "소스-모델-UUID",
      "simulationId": "소스-태스크-UUID",
      "restartNumber": -1
    }
  },
  "card100": { "problemType": "restart", "calculationType": "transnt" },
  "card103": { "restartNumber": -1, "rstpltFileName": "rstplt" }
}
```

---

## 4. Step 2: 에디터에서 Global Settings 설정

프로젝트 생성 후 에디터(`/projects/{id}`)로 이동하여 **Global Settings** 패널을 열고 다음을 확인/설정합니다.

### 4-1. Global Control 탭 (자동 설정 확인)

| 항목 | 값 | 비고 |
|------|-----|------|
| Card 100 Problem Type | `restart` | 위저드에서 자동 설정됨 |
| Card 100 Calculation Type | `transnt` | 위저드에서 자동 설정됨 |
| Card 101 Run Option | `run` | 기본값 |
| Card 102 Input Units | `si` | 설정 |
| Card 102 Output Units | `si` | 설정 |
| Card 103 Restart Number | `-1` | 위저드에서 자동 설정됨 |

### 4-2. Time Step Control 탭

| 항목 | 값 |
|------|-----|
| Card 200 Initial Time | `0` |

| Phase | endTime | minDt | maxDt | control | minor | major | restart |
|-------|---------|-------|-------|---------|-------|-------|---------|
| 201 | `10.0` | `1.0e-7` | `0.001` | `7` | `1000` | `100000` | `1000000` |
| 202 | `100.0` | `1.0e-7` | `0.01` | `7` | `1000` | `100000` | `1000000` |
| 203 | `1000.0` | `1.0e-7` | `0.01` | `7` | `1000` | `100000` | `1000000` |
| 204 | `43200.0` | `1.0e-7` | `0.01` | `7` | `1000` | `100000` | `1000000` |

### 4-3. Minor Edits 탭 (26개 항목)

| Card# | Variable Type | Parameter |
|-------|--------------|-----------|
| 301 | `cntrlvar` | `325` |
| 302 | `tempf` | `191020000` |
| 303 | `tempf` | `258040000` |
| 304 | `p` | `280070000` |
| 305 | `mflowj` | `261000000` |
| 306 | `cntrlvar` | `511` |
| 307 | `cntrlvar` | `313` |
| 308 | `cntrlvar` | `314` |
| 309 | `cntrlvar` | `315` |
| 310 | `cntrlvar` | `316` |
| 311 | `tempf` | `305010000` |
| 312 | `tempg` | `315010000` |
| 313 | `p` | `305010000` |
| 314 | `p` | `315010000` |
| 315 | `cntrlvar` | `600` |
| 316 | `cntrlvar` | `610` |
| 317 | `rktpow` | `0` |
| 318 | `rkmodd` | `0` |
| 319 | `rkscram` | `0` |
| 320 | `rkdopp` | `0` |
| 321 | `rkreac` | `0` |
| 322 | `cntrlvar` | `210` |
| 323 | `cntrlvar` | `211` |
| 324 | `cntrlvar` | `754` |
| 325 | `cntrlvar` | `182` |
| 326 | `cntrlvar` | `186` |

> **참고**: 원본 파일에 Card 301이 2개(`rktpow 0`, `cntrlvar 325`) 있으나, `rktpow 0`은 317번과 동일하므로 301번은 `cntrlvar 325`로 설정합니다.

### 4-4. Variable Trips 탭 (6개 항목)

| Card# | leftVar | leftParam | relation | rightVar | rightParam | actionValue | latch | timeout | comment |
|-------|---------|-----------|----------|----------|------------|-------------|-------|---------|---------|
| 401 | `time` | `0` | `gt` | `null` | `0` | `1.0e6` | `l` | `-1.0` | `SIS-SBLOCA` |
| 402 | `time` | `0` | `gt` | `null` | `0` | `1.0e6` | `l` | `-1.0` | `FLB-SBLOCA` |
| 403 | `time` | `0` | `ge` | `null` | `0` | `0.0` | `l` | - | - |
| 404 | `time` | `0` | `gt` | `null` | `0` | `1.0e6` | `l` | `-1.0` | `load-follow` |
| 405 | `time` | `0` | `ge` | `null` | `0` | `10.0` | `l` | - | - |
| 406 | `time` | `0` | `ge` | `null` | `0` | `1.0e9` | `l` | - | - |

### 4-5. General Tables 탭 (테이블 #23 - Load Follow)

**테이블 23 서브테이블 00** — Header (power):
- **Table Number**: `23`
- **Type**: `power`
- **Trip Number**: `404`
- **Name**: `Load Follow - Power`

| X (time) | Y (power) |
|----------|-----------|
| -1.0 | 100.0 |
| 0.0 | 100.0 |
| 1.0 | 50.0 |
| 21600.0 | 50.0 |
| 28800.0 | 100.0 |
| 36000.0 | 100.0 |

**테이블 23 서브테이블 01** (reac-t: Power vs Flowrate):
- **Type**: `reac-t`
- **Name**: `Power vs SG Flowrate`

| X (power) | Y (flowrate) |
|-----------|-------------|
| 20.0 | 34.0 |
| 50.0 | 86.0 |
| 75.0 | 134.0 |
| 100.0 | 190.61 |

**테이블 23 서브테이블 02** (reac-t: Power vs SGpressure):
- **Type**: `reac-t`
- **Name**: `Power vs SG Pressure`

| X (power) | Y (SGpressure) |
|-----------|---------------|
| 20.0 | 63.82e5 |
| 80.0 | 59.20e5 |
| 100.0 | 56.20e5 |

> **참고**: 하나의 `tableNumber=23`에 3개 서브테이블(00, 01, 02)이 존재합니다. 카드 번호 체계:
> - `20230000`: Header (power, trip 404)
> - `20230100`: reac-t (별도 서브테이블)
> - `20230200`: reac-t (별도 서브테이블)
>
> 현재 UI의 `GeneralTable` 타입은 `tableNumber` 단위로 관리되므로, 서브테이블은 별도 테이블로 추가해야 할 수 있습니다.

---

## 5. Step 3: 입력 파일 미리보기 확인

에디터에서 **입력 파일 미리보기** 기능으로 생성되는 `.i` 파일을 확인합니다.

### RESTART 모드 핵심 체크포인트

| # | 확인 항목 | 기대 결과 |
|---|----------|-----------|
| 1 | Card 100 | `restart  transnt` 로 출력 |
| 2 | Card 103 | `-1  rstplt` 로 출력 |
| 3 | Card 110 (Non-condensable Gases) | **생략** (RESTART에서는 skip) |
| 4 | Card 120-121 (System Configuration) | **생략** (RESTART에서는 skip) |
| 5 | Card 200 | `0` 출력 |
| 6 | Card 201-204 Time Phase | 4개 항목 정상 출력 |
| 7 | Card 301-326 Minor Edits | 26개 항목 정상 출력 |
| 8 | Card 401-406 Variable Trips | 6개 항목 정상 출력 |
| 9 | Card 20230000+ General Table | Load Follow 데이터 정상 출력 |

> **파일생성기 참조 코드**:
> - Card 110 skip: `fileGenerator.ts:2484` — `!isRestart` 조건
> - Card 120 skip: `fileGenerator.ts:2498` — `!isRestart` 조건
> - Card 103 출력: `fileGenerator.ts:2462-2467` — `isRestart` 일 때만

---

## 6. Step 4: 시뮬레이션 시작 및 RESTART 동작 검증

1. **Simulation 페이지**로 이동 (`/projects/{id}/simulation`)
2. **Start** 버튼 클릭 → Title 입력 → 시작
3. **콘솔 로그에서 확인할 항목**:

```
[SimulationPage] Input file generated: BOP_Load_Follow_RESTART.i
[SimulationPage] uploadedObjectKey: ...
[SimulationPage] Restart rstplt copied: {
  srcRstpltObjectKey: "userId/소스ProjectId/simulation/history/소스TaskId/rstplt",
  dstRstpltObjectKey: "..."
}
```

4. **BFF로 전달되는 args 확인**:
   - `taskMode` = `restart`
   - args = `restart,s3://bucket/.../BOP_Load_Follow_RESTART.i`
   - `--bff-restart-project-id=소스-프로젝트-UUID`
   - `--bff-restart-source-task-id=소스-태스크-UUID`

5. **서버 응답 확인**: SSE 스트림에서 `SimState.status = RUNNING` 수신 여부

### 코드 흐름 참조

| 단계 | 파일 | 라인 |
|------|------|------|
| marsConfig 읽기 | `SimulationPage.tsx` | L431-436 |
| taskMode 결정 | `SimulationPage.tsx` | L438-441 |
| restartProjectId 추출 | `SimulationPage.tsx` | L442-443 |
| restartSourceTaskId 추출 | `SimulationPage.tsx` | L444-445 |
| rstplt 복사 | `SimulationPage.tsx` | L525-557 |
| BFF args 전달 | `SimulationPage.tsx` | L561-569 |
| createTask 호출 | `useSimulationData.ts` | L102-113 |

---

## 7. Step 5: JSON 내보내기를 통한 RESTART 필드 검증

### 7-1. JSON 내보내기 방법

에디터 페이지(`/projects/{id}`)에서 **Export Project JSON** 버튼 클릭 → `{프로젝트명}.json` 다운로드

내보내기 구조:
```json
{
  "_vsmr_meta_": {
    "version": 2,
    "appVersion": "0.1.0",
    "exportedAt": "2026-03-25T...",
    "projectName": "BOP Load Follow RESTART"
  },
  "data": { ... ProjectData ... }
}
```

> **코드 참조**: `EditorPage.tsx:549` (`handleExportProjectJson`) → `projectFileHelpers.ts:59` (`downloadProjectData`)

### 7-2. 검증 체크리스트 — `data.models[0].settings`

| JSON 경로 | 기대값 | 설명 |
|-----------|--------|------|
| `settings.marsConfig.problemType` | `"RESTART"` | 위저드에서 설정한 원본 값 |
| `settings.marsConfig.problemOption` | `"TRANSNT"` | 위저드에서 설정한 원본 값 |
| `settings.marsConfig.restartSource.projectId` | 소스 프로젝트 UUID | 소스 프로젝트 식별자 |
| `settings.marsConfig.restartSource.modelId` | 소스 모델 UUID | 소스 모델 식별자 |
| `settings.marsConfig.restartSource.simulationId` | 소스 태스크 UUID | rstplt 복사에 사용 |
| `settings.marsConfig.restartSource.restartNumber` | `-1` | 마지막 restart 블록 |
| `settings.card100.problemType` | `"restart"` | 소문자 (파일생성기용) |
| `settings.card100.calculationType` | `"transnt"` | 소문자 |
| `settings.card103.restartNumber` | `-1` | Card 103 출력용 |
| `settings.card103.rstpltFileName` | `"rstplt"` | Card 103 출력용 |

> **핵심**: `marsConfig`는 대문자(`RESTART`), `card100`은 소문자(`restart`)로 저장됩니다.
> `SimulationPage`는 `marsConfig.problemType`을 대소문자 모두 체크합니다 (`SimulationPage.tsx:439`).

### 7-3. 검증 체크리스트 — `data.metadata` (레거시 fallback)

| JSON 경로 | 기대값 | 설명 |
|-----------|--------|------|
| `data.metadata.taskMode` | 없음 또는 `undefined` | Plan B에서는 미사용 (fallback용) |
| `data.metadata.restartProjectId` | 없음 또는 `undefined` | Plan B에서는 미사용 |
| `data.metadata.restartSourceTaskId` | 없음 또는 `undefined` | Plan B에서는 미사용 |
| `data.metadata.tags` | `["태그1", ...]` | 위저드에서 입력한 태그 |

> **중요**: Plan B 방식에서는 `metadata`에 RESTART 필드를 설정하지 않습니다.
> 모든 RESTART 정보는 `models[].settings.marsConfig`에서 읽으며, `metadata`는 fallback으로만 존재합니다.

### 7-4. 검증 체크리스트 — Global Settings 카드

`data.models[0].settings` 내 Global Settings:

| JSON 경로 | 기대값 |
|-----------|--------|
| `settings.card101.runOption` | `"run"` |
| `settings.card102.inputUnits` | `"si"` |
| `settings.card102.outputUnits` | `"si"` |
| `settings.card200.initialTime` | `0` |
| `settings.timePhases` | 4개 항목 (201-204) |
| `settings.minorEdits` | 26개 항목 (301-326) |
| `settings.variableTrips` | 6개 항목 (401-406) |
| `settings.generalTables` | General Table #23 데이터 |
| `settings.systems` | 비어있거나 있어도 RESTART에서는 skip |

### 7-5. RESTART 동작 흐름 추적 요약

JSON에 저장된 값 → 시뮬레이션 시작 시 사용 경로:

```
data.models[0].settings.marsConfig.problemType = "RESTART"
    → SimulationPage L436: marsConfig 읽기
    → SimulationPage L438-441: taskMode = 'restart' 결정

data.models[0].settings.marsConfig.restartSource.projectId
    → SimulationPage L442-443: restartProjectId 추출

data.models[0].settings.marsConfig.restartSource.simulationId
    → SimulationPage L444-445: restartSourceTaskId 추출

data.models[0].settings.card100 = {problemType: "restart", calculationType: "transnt"}
    → fileGenerator L2442-2443: Card 100 출력 → "100   restart   transnt"

data.models[0].settings.card103 = {restartNumber: -1, rstpltFileName: "rstplt"}
    → fileGenerator L2462-2467: Card 103 출력 → "103   -1        rstplt"
```

### 7-6. JSON 내보내기 → 가져오기 라운드트립 테스트

1. RESTART 프로젝트에서 **Export Project JSON** 실행
2. 다운로드된 `.json` 파일을 텍스트 에디터로 열어 위 체크리스트 확인
3. (선택) 새 프로젝트를 만들고 **Import** 기능으로 해당 JSON을 가져와서:
   - `marsConfig` 값이 보존되는지 확인
   - 입력 파일 미리보기에서 Card 100/103이 정상 출력되는지 확인
   - 시뮬레이션 시작 시 `taskMode = 'restart'` 경로로 진입하는지 확인

### 7-7. 브라우저 DevTools 로그 확인

시뮬레이션 시작 시 콘솔에서 다음 로그들을 순서대로 확인:

```
// 1. 입력파일 생성
[SimulationPage] Input file generated: BOP_Load_Follow_RESTART.i size: ...

// 2. rstplt 복사 (RESTART일 때만)
[SimulationPage] Restart rstplt copied: { srcRstpltObjectKey: "...", dstRstpltObjectKey: "..." }

// 3. 시뮬레이션 태스크 생성
[useStartSimulation] Started task: {taskId}
```

> **Tip**: `handleStartSimulation` 함수 시작 부분에 임시로 아래 로그를 추가하면 디버깅이 용이합니다:
> ```typescript
> console.log('[DEBUG] marsConfig:', marsConfig, 'taskMode:', taskMode,
>   'restartProjectId:', restartProjectId, 'restartSourceTaskId:', restartSourceTaskId);
> ```

---

## 8. 주의사항 및 예상 이슈

| 항목 | 설명 |
|------|------|
| **Card 120-121 차이** | 원본 파일에는 Card 120-121이 있지만, 파일생성기는 RESTART 모드에서 이를 skip합니다. 이것은 정상 — MARS RESTART에서는 원본 rstplt에서 시스템 정보를 읽기 때문입니다. |
| **General Table 서브테이블** | `20230000`(power), `20230100`(reac-t), `20230200`(reac-t)는 UI에서 3개의 별도 테이블로 입력해야 할 수 있습니다. 테이블 번호가 23의 서브테이블인지, 별도 테이블 번호인지 확인 필요 |
| **Card 301 중복** | 원본에 301번이 2개 (`rktpow 0`, `cntrlvar 325`). 두 번째가 유효 — 317번에 이미 `rktpow 0`이 있으므로 301은 `cntrlvar 325`로 설정 |
| **소스 프로젝트 필수** | rstplt 복사를 위해 소스 프로젝트의 완료된 시뮬레이션이 반드시 필요 |
| **restartSourceTaskId 경로** | `marsConfig.restartSource.simulationId`가 사용됨 — NewProjectWizard의 RestartSourceSelector에서 선택한 시뮬레이션 ID |
| **marsConfig 대소문자** | `marsConfig.problemType`은 `"RESTART"` (대문자), `card100.problemType`은 `"restart"` (소문자). SimulationPage는 양쪽 모두 체크 |

---

## 9. 테스트 결과 기록 템플릿

### 입력 파일 생성 결과

| # | 확인 항목 | Pass/Fail | 비고 |
|---|----------|-----------|------|
| 1 | Card 100 = `restart transnt` | | |
| 2 | Card 103 = `-1 rstplt` | | |
| 3 | Card 110 생략됨 | | |
| 4 | Card 120-121 생략됨 | | |
| 5 | Card 200 정상 출력 | | |
| 6 | Card 201-204 정상 출력 | | |
| 7 | Minor Edits 26개 정상 | | |
| 8 | Variable Trips 6개 정상 | | |
| 9 | General Table 정상 | | |

### JSON 내보내기 검증 결과

| # | 확인 항목 | Pass/Fail | 비고 |
|---|----------|-----------|------|
| 1 | `marsConfig.problemType` = `"RESTART"` | | |
| 2 | `marsConfig.restartSource.projectId` 존재 | | |
| 3 | `marsConfig.restartSource.simulationId` 존재 | | |
| 4 | `card100.problemType` = `"restart"` | | |
| 5 | `card103.restartNumber` = `-1` | | |
| 6 | `metadata.taskMode` 없음 (정상) | | |
| 7 | JSON Import 후 값 보존됨 | | |

### 시뮬레이션 시작 결과

| # | 확인 항목 | Pass/Fail | 비고 |
|---|----------|-----------|------|
| 1 | `taskMode = 'restart'` 경로 진입 | | |
| 2 | rstplt 복사 성공 로그 | | |
| 3 | BFF args에 `restart,s3://...` 전달 | | |
| 4 | `--bff-restart-project-id` 포함 | | |
| 5 | `--bff-restart-source-task-id` 포함 | | |
| 6 | SSE 스트림 `RUNNING` 수신 | | |
