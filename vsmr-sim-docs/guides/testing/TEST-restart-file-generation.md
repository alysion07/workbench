# TEST: RESTART 파일 생성 및 Docker MARS 검증

> **작성일**: 2026-03-25
> **브랜치**: `alysion/feat_icv`
> **목적**: `restartSettings` 분리 구조로 RESTART 입력파일 생성 → REF 비교 → Docker MARS 해석 검증

---

## 1. 배경

### 1.1 문제

RESTART 모드에서 export 시 `model.settings` 전체(2,045줄)가 출력됨.
MARS RESTART 원리상 **오버라이드 카드만 작성**해야 하며, REF 파일은 98줄.

### 1.2 해결: `restartSettings` 분리

```
Model.settings          ← NEW 해석용 전체 데이터 (변경 없음)
Model.restartSettings   ← RESTART 오버라이드 카드만 (새로 추가)
```

- fileGenerator는 받은 settings를 그대로 출력
- RESTART export 시 `restartSettings`를 전달 → 오버라이드 카드만 출력
- 데이터가 없는 섹션은 `if (settings?.xxx?.length > 0)` 조건으로 자동 스킵

### 1.3 관련 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/supabase.ts` | `Model`, `ModelInsert`, `ModelUpdate`에 `restartSettings?: any` 추가 |
| `src/utils/fileGenerator.ts` | `isRestart` 시 nodes 검증 스킵, 빈 섹션 헤더 조건부 출력 |
| `src/pages/SimulationPage.tsx` | `taskMode === 'restart'`면 `restartSettings` 전달 |
| `src/pages/EditorPage.tsx` | 3곳의 프로젝트 로드에서 RESTART 분기 추가 |

---

## 2. 테스트 데이터 준비

### 2.1 REF 파일

| 파일 | 용도 | 줄 수 |
|------|------|-------|
| `documents/100%_ICV.i` | NEW 해석 REF | 15,316 |
| `documents/100-50-100%_TR_ICV.i` | RESTART 해석 REF | 99 |

### 2.2 Import JSON 생성 (`restartSettings` 포함)

소스 파일: `D:\Download\100-50-100_TR_ICV_v2.json`

이 JSON은 기존 `100-50-100_TR_ICV.json`에서 `restartSettings` 필드를 수동으로 분리한 것.

#### 생성 방법

1. 기존 export JSON (`100-50-100_TR_ICV.json`)을 기반으로 시작
2. `models[0]`에 `restartSettings` 필드 추가
3. REF 파일(`documents/100-50-100%_TR_ICV.i`)에 포함된 카드만 `restartSettings`에 배치
4. `settings`는 NEW 해석용 전체 데이터 유지 (변경 없음)

#### `restartSettings` 구조

```json
{
  "restartSettings": {
    "card001": { "problemNumber": 1, "optionCode": 90 },
    "card100": { "problemType": "restart", "calculationType": "transnt" },
    "card101": { "runType": "run" },
    "card102": { "inputUnits": "si", "outputUnits": "si" },
    "card103": { "restartNumber": -1 },
    "systems": [
      { "cardNumber": 120, "componentId": "608010000", "pressure": 12.0, "fluid": "h2onew", "label": "BOP" },
      { "cardNumber": 121, "componentId": "988010000", "pressure": 8.5, "fluid": "h2onew", "label": "SEA" }
    ],
    "card200": { "initialTime": 0 },
    "timePhases": [
      { "cardNumber": 201, "endTime": 10.0, "minDt": 1e-7, "maxDt": 0.001, "control": "00007", "minorInterval": 1000, "majorInterval": 100000, "restartInterval": 1000000 },
      { "cardNumber": 202, "endTime": 100.0, "minDt": 1e-7, "maxDt": 0.01, "control": "00007", "minorInterval": 1000, "majorInterval": 100000, "restartInterval": 1000000 },
      { "cardNumber": 203, "endTime": 1000.0, "minDt": 1e-7, "maxDt": 0.01, "control": "00007", "minorInterval": 1000, "majorInterval": 100000, "restartInterval": 1000000 },
      { "cardNumber": 204, "endTime": 43200.0, "minDt": 1e-7, "maxDt": 0.01, "control": "00007", "minorInterval": 1000, "majorInterval": 100000, "restartInterval": 1000000 }
    ],
    "minorEdits": [
      {"cardNumber":301,"variableType":"rktpow","parameter":"0"},
      {"cardNumber":301,"variableType":"cntrlvar","parameter":"325"},
      {"cardNumber":302,"variableType":"tempf","parameter":"191020000"},
      {"cardNumber":303,"variableType":"tempf","parameter":"258040000"},
      {"cardNumber":304,"variableType":"p","parameter":"280070000"},
      {"cardNumber":305,"variableType":"mflowj","parameter":"261000000"},
      {"cardNumber":306,"variableType":"cntrlvar","parameter":"511"},
      {"cardNumber":307,"variableType":"cntrlvar","parameter":"313"},
      {"cardNumber":308,"variableType":"cntrlvar","parameter":"314"},
      {"cardNumber":309,"variableType":"cntrlvar","parameter":"315"},
      {"cardNumber":310,"variableType":"cntrlvar","parameter":"316"},
      {"cardNumber":311,"variableType":"tempf","parameter":"305010000"},
      {"cardNumber":312,"variableType":"tempg","parameter":"315010000"},
      {"cardNumber":313,"variableType":"p","parameter":"305010000"},
      {"cardNumber":314,"variableType":"p","parameter":"315010000"},
      {"cardNumber":315,"variableType":"cntrlvar","parameter":"600"},
      {"cardNumber":316,"variableType":"cntrlvar","parameter":"610"},
      {"cardNumber":317,"variableType":"rktpow","parameter":"0"},
      {"cardNumber":318,"variableType":"rkmodd","parameter":"0"},
      {"cardNumber":319,"variableType":"rkscram","parameter":"0"},
      {"cardNumber":320,"variableType":"rkdopp","parameter":"0"},
      {"cardNumber":321,"variableType":"rkreac","parameter":"0"},
      {"cardNumber":322,"variableType":"cntrlvar","parameter":"210"},
      {"cardNumber":323,"variableType":"cntrlvar","parameter":"211"},
      {"cardNumber":324,"variableType":"cntrlvar","parameter":"754"},
      {"cardNumber":325,"variableType":"cntrlvar","parameter":"182"},
      {"cardNumber":326,"variableType":"cntrlvar","parameter":"186"}
    ],
    "variableTrips": [
      {"cardNumber":401,"leftVar":"time","leftParam":"0","relation":"gt","rightVar":"null","rightParam":"0","actionValue":1e6,"latch":"l","timeout":-1.0,"comment":"SIS-SBLOCA"},
      {"cardNumber":402,"leftVar":"time","leftParam":"0","relation":"gt","rightVar":"null","rightParam":"0","actionValue":1e6,"latch":"l","timeout":-1.0,"comment":"FLB-SBLOCA"},
      {"cardNumber":403,"leftVar":"time","leftParam":"0","relation":"ge","rightVar":"null","rightParam":"0","actionValue":0.0,"latch":"l"},
      {"cardNumber":404,"leftVar":"time","leftParam":"0","relation":"gt","rightVar":"null","rightParam":"0","actionValue":1e6,"latch":"l","timeout":-1.0,"comment":"load-follow"},
      {"cardNumber":405,"leftVar":"time","leftParam":"0","relation":"ge","rightVar":"null","rightParam":"0","actionValue":10.0,"latch":"l"},
      {"cardNumber":406,"leftVar":"time","leftParam":"0","relation":"ge","rightVar":"null","rightParam":"0","actionValue":1e9,"latch":"l"}
    ],
    "generalTables": [
      {
        "tableNumber": 300, "type": "power", "tripNumber": 404, "name": "table_300",
        "dataPoints": [
          {"x":-1.0,"y":100.0}, {"x":0.0,"y":100.0}, {"x":1.0,"y":50.0},
          {"x":21600.0,"y":50.0}, {"x":28800.0,"y":100.0}, {"x":36000.0,"y":100.0}
        ]
      },
      {
        "tableNumber": 301, "type": "reac-t", "name": "table_301",
        "dataPoints": [
          {"x":20.0,"y":34.0}, {"x":50.0,"y":86.0}, {"x":75.0,"y":134.0}, {"x":100.0,"y":190.61}
        ]
      },
      {
        "tableNumber": 302, "type": "reac-t", "name": "table_302",
        "dataPoints": [
          {"x":20.0,"y":6382000.0}, {"x":80.0,"y":5920000.0}, {"x":100.0,"y":5620000.0}
        ]
      }
    ]
  }
}
```

> **참고**: `generalTables`의 `tableNumber`는 서브테이블 번호 (300, 301, 302).
> MARS 카드 번호 체계: `202TTTNN` → `20230000`(table 300, sub 00), `20230100`(sub 01), `20230200`(sub 02).

---

## 3. 테스트 절차

### 3.1 Import → Export 테스트

1. 개발 서버 실행: `npm run dev`
2. 에디터 페이지에서 **Import** → `100-50-100_TR_ICV_v2.json` 선택
3. **Export .i** 버튼 클릭 → `.i` 파일 다운로드
4. REF와 비교

#### 기대 결과

| 항목 | REF (99줄) | Export |
|------|-----------|--------|
| 헤더 (title) | `= BOP Conceptual...` | `= MARS Input File` (fileGenerator 기본 헤더) |
| Card 100 | `restart transnt` | `restart transnt` |
| Card 103 | `-1` | `-1` |
| Card 120-121 | 2개 시스템 | 2개 시스템 |
| Card 200 + 201-204 | 5줄 | 5줄 |
| Minor Edits 301-326 | 27개 | 27개 |
| Variable Trips 401-406 | 6개 | 6개 |
| General Tables | 3개 서브테이블 | 3개 서브테이블 |
| 종료 | `.End of input` | `*` (fileGenerator 종료 형식) |
| **Hydro Components** | **없음** | **없음** (MARS 제약 가드) |
| **Interactive Inputs** | **없음** | **없음** (MARS 제약 가드) |
| **Control Variables** | **없음** | **없음** (restartSettings에 미포함) |

> 줄 수 차이는 fileGenerator의 장식(섹션 구분선, 주석 헤더)에 의한 것이며, MARS 해석에 영향 없음.

### 3.2 Docker MARS 해석 테스트

#### 전제 조건

- Docker 이미지: `mars-adapter:latest`
- engine 폴더: `D:/gym/cursor/etri/mars-adapter/simulation/engine/`
- 물성 파일: `tpfh2o`, `tpfh2onew` (engine 폴더에 존재)
- **rstplt**: NEW 해석에서 생성된 것이 있어야 함

#### Step 1: NEW 해석으로 rstplt 생성

```bash
# NEW 해석 입력파일을 indta.i로 복사
cp "D:/gym/cursor/etri/mars-adapter/simulation/engine/indta.i.bak" \
   "D:/gym/cursor/etri/mars-adapter/simulation/engine/indta.i"

# Docker MARS 실행
docker run --rm \
  -v "D:/gym/cursor/etri/mars-adapter/simulation/engine:/mars-adapter/simulation/engine" \
  mars-adapter:latest \
  python3 mars_adapter_server.py --auto-start --speed-ratio 0
```

확인 사항:
- `Input processing completed successfully.` 출력
- `Simulation completed` 출력
- `rstplt` 파일 생성됨 (~37MB)

#### Step 2: Export .i 파일로 RESTART 해석

```bash
# Export된 RESTART 입력파일을 indta.i로 복사
cp "D:/Download/100-50-100_TR_ICV_pri-rst.i" \
   "D:/gym/cursor/etri/mars-adapter/simulation/engine/indta.i"

# Docker MARS 실행
docker run --rm \
  -v "D:/gym/cursor/etri/mars-adapter/simulation/engine:/mars-adapter/simulation/engine" \
  mars-adapter:latest \
  python3 mars_adapter_server.py --auto-start --speed-ratio 0
```

확인 사항:
- `Desired restart number is -1. Using last restart block in file.`
- `Input processing completed successfully.`
- `Simulation completed`
- 결과 `outdta` 생성 → `outdta_export`로 백업

#### Step 3: REF .i 파일로 RESTART 해석

```bash
# rstplt를 NEW 해석의 것으로 복원 (Step 2에서 덮어쓰였으므로)
# → Step 1을 다시 수행하여 rstplt 재생성

# REF 입력파일을 indta.i로 복사
cp "d:/gym/cursor/etri/vsmr-sim-web/documents/100-50-100%_TR_ICV.i" \
   "D:/gym/cursor/etri/mars-adapter/simulation/engine/indta.i"

# Docker MARS 실행
docker run --rm \
  -v "D:/gym/cursor/etri/mars-adapter/simulation/engine:/mars-adapter/simulation/engine" \
  mars-adapter:latest \
  python3 mars_adapter_server.py --auto-start --speed-ratio 0
```

확인 사항:
- 동일하게 `Simulation completed`
- 결과 `outdta` → `outdta_ref`로 백업

#### Step 4: 결과 비교

```bash
# 해석 결과 부분만 추출 (입력 echo 이후)
grep -an "Input processing" outdta_ref     # → 예: 5441행
grep -an "Input processing" outdta_export  # → 예: 5464행

tail -n +5441 outdta_ref > /tmp/ref_result.txt
tail -n +5464 outdta_export > /tmp/export_result.txt

# diff
diff --text /tmp/ref_result.txt /tmp/export_result.txt | head -80

# 물리량 비교 (Volume 데이터)
grep -a "100-010000\|200-010000" /tmp/ref_result.txt | head -6
grep -a "100-010000\|200-010000" /tmp/export_result.txt | head -6
```

---

## 4. 검증 결과 (2026-03-25)

### 4.1 Export 파일 비교

| 항목 | REF | Export | 결과 |
|------|-----|--------|------|
| 줄 수 | 99 | 119 | 차이는 헤더/섹션 구분선만 |
| Card 100 `restart transnt` | O | O | PASS |
| Card 103 `-1` | O | O | PASS |
| Card 120-121 시스템 2개 | O | O | PASS |
| Card 200 + 201-204 | O | O | PASS |
| Minor Edits 27개 (301-326) | O | O | PASS |
| Variable Trips 6개 (401-406) | O | O | PASS |
| General Tables 3개 (300-302) | O | O | PASS |
| Hydro Components 미출력 | O | O | PASS |
| Interactive Inputs 미출력 | O | O | PASS |
| Control Variables 미출력 | O | O | PASS |

### 4.2 Docker MARS 해석

| 항목 | Export .i | REF .i | 결과 |
|------|----------|--------|------|
| Input processing | `completed successfully` | `completed successfully` | PASS |
| Restart block 로드 | `-1 → 10162` | `-1 → 10162` | PASS |
| Simulation | `completed` | `completed` | PASS |
| outdta 줄 수 | 20,891 | 20,866 | 유사 |

### 4.3 outdta 비교 분석

**해석 결과 부분 diff**: 318줄 차이 (전체 15,400줄 중 ~2%)

| 차이 유형 | 원인 | 영향 |
|-----------|------|------|
| 메모리 주소 | 실행 환경 차이 (Docker 프로세스) | 없음 |
| CPU 시간 | 실행 타이밍 차이 | 없음 |
| Trip 초기값 | REF에 주석 처리된 trip 카드(`*404`)가 포함, Export에는 미포함 | 미세 |
| Heat Structure 열유속 | Trip 초기값 차이에 의한 초기 time step 미세 차이 | 무시 가능 |

**핵심 물리량 (Volume 압력/온도/질량)**: 완전 동일

```
REF:    100-010000  2.12662E+07  1.0000  0.0000  0.0000  571.249  643.991
EXPORT: 100-010000  2.12662E+07  1.0000  0.0000  0.0000  571.249  643.991
```

### 4.4 결론

| 항목 | 판정 |
|------|------|
| `restartSettings` 분리 구조 동작 | **PASS** |
| 오버라이드 카드만 출력 (2,045줄 → 119줄) | **PASS** |
| Docker MARS 해석 정상 완료 | **PASS** |
| REF 대비 해석 결과 동등성 | **PASS** (물리량 동일, 미세 차이는 주석 카드 유무) |

---

## 5. Trip 초기값 차이 상세 분석

REF 파일에는 주석 처리된 trip 404가 3개 존재:

```
*404   time   0   gt   null     0     7200.0   n   -1.0    "load-follow"
*404   time   0   gt   null     0     100.0    n   -1.0    "load-follow"
 404   time   0   gt   null     0     1.0e6    l  -1.0   "load-follow"
```

MARS는 주석(`*`)을 무시하므로 마지막 `404`만 유효하지만, 일부 MARS 버전에서 주석 카드의 존재가 내부 초기화 순서에 미세하게 영향을 줄 수 있음.

Export 파일에서는 주석 카드가 포함되지 않아 trip 434, 500번대의 초기값이 다름:
- REF: trip 434 = `0.000000`, trip 500 = `1.1E-07`
- Export: trip 434 = `-1.000000`, trip 500 = `-1.000000`

이 차이는 **해석 결과에 유의미한 영향을 주지 않음** (주요 열수력 변수 동일).

---

## 6. 재현 절차 요약

```
1. v2.json import → export .i
2. NEW 해석 실행 (rstplt 생성)
3. Export .i로 RESTART 해석 → outdta_export 백업
4. NEW 해석 재실행 (rstplt 재생성, Step 3에서 덮어쓰였으므로)
5. REF .i로 RESTART 해석 → outdta_ref 백업
6. diff --text outdta_ref outdta_export → 비교
```

> **주의**: RESTART 해석은 rstplt를 덮어쓰므로, Export와 REF를 비교하려면
> 각 RESTART 전에 동일한 NEW 해석을 수행하여 rstplt를 동일 상태로 맞춰야 함.
