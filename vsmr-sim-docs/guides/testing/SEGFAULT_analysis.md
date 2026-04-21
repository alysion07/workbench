# MARS GUI Export SEGFAULT 분석 보고서

**분석일**: 2026-03-19
**파일**: `100%_pri-sys (6).i` (GUI Export) vs `100%_ICV.i` (원본 수동 작성)
**결과**: GUI Export 파일의 SEGFAULT 원인 2건 확인, 수정 후 해석 성공

---

## 1. SEGFAULT 원인 요약

| # | 원인 | 영향 | 심각도 |
|---|------|------|--------|
| 1 | **데이터 라인 > 80자** — fileGenerator가 필드마다 과도한 패딩(공백)을 추가하여 라인이 최대 187자까지 확장됨. MARS Fortran은 80자 라인 버퍼를 사용하므로, 80자 이후 데이터가 잘려 필드 누락/잘못된 값 발생 → 배열 오류 → SEGFAULT | HS 추가 경계조건(08xx/09xx) 카드 192줄, Trip 카드 등 총 409줄 영향 | **CRITICAL** |
| 2 | **Card 120/121 W2 정수 출력** — `ref.elev` 필드가 `12` (정수)로 출력되어야 할 곳에 `12.0` (실수)이 필요. MARS는 이 필드를 float로 파싱 | Card 120 (BOP system), Card 121 (SEA system) | **HIGH** |

### 추가 발견 (직접적 SEGFAULT 원인은 아님)

| # | 발견 | 설명 | 심각도 |
|---|------|------|--------|
| 3 | **HS multi-geometry 경계조건 카드 누적 번호** | Geometry 0의 노드 수만큼 다음 geometry의 카드 번호가 오프셋됨 (예: `11201501` → `11201511`). MARS의 `G` 자리가 이미 geometry를 구분하므로 각 geometry는 01부터 시작해야 함 | MEDIUM (80자 초과와 결합 시 문제) |
| 4 | **6줄 `=` 헤더** vs ICV의 1줄 | GUI가 6줄 헤더를 생성하지만, MARS는 문제없이 처리함 | LOW |
| 5 | **Card 200 (0.0) 추가** | ICV에는 없지만 PRI-SYS에 존재. 정상 동작에 영향 없음 | LOW |

---

## 2. 테스트 시행 기록

### 시도 1: HS 경계조건 카드 번호 수정만
- **변경**: 23개 multi-geometry HS 그룹에서 420개 카드 번호를 누적→개별 번호로 수정
- **결과**: ❌ SEGFAULT (exit 139)
- **결론**: HS 번호만으로는 부족

### 시도 2: HS 번호 + 헤더 축소 + Card 200 제거
- **변경**: 6줄 `=` 헤더 → 1줄, Card 200 제거
- **결과**: ❌ SEGFAULT (exit 139)
- **결론**: 헤더/Card 200은 원인 아님

### 시도 3: ICV에 데이터 차이만 적용
- **변경**: C115 fwd_loss 7.0→76.0, HS 1110 boundary 110010000→260010000
- **결과**: ✅ 정상 실행
- **결론**: 데이터 값 차이는 SEGFAULT 원인 아님. 구조/포맷 차이가 원인

### 시도 4: 바이너리 서치 (글로벌 vs 컴포넌트)
- **ICV 글로벌 + PRI 컴포넌트**: ❌ SEGFAULT
- **PRI 글로벌 + ICV 컴포넌트**: ✅ OK
- **결론**: 문제는 PRI-SYS 컴포넌트 섹션에 존재

### 시도 5: 4분할 바이너리 서치
- **각 1/4 + ICV 나머지**: 모두 ✅ OK
- **2/4 조합**: 모든 6가지 조합 ❌ SEGFAULT
- **결론**: 특정 컴포넌트가 아닌 **누적 문제** (파일 전체의 구조적 이슈)

### 시도 6: 라인 길이 분석
- **ICV 데이터 최대 라인 길이**: 79자 (주석 제외)
- **PRI-SYS 데이터 최대 라인 길이**: 187자
- **80자 초과 데이터 라인**: 409줄 (주로 HS 추가 경계조건, Trip 카드)

### 시도 7: 132자 제한 압축
- **변경**: 192줄(HS 카드)을 132자 이하로 압축
- **결과**: ❌ SEGFAULT
- **결론**: 132자 한계는 부족, 80자가 한계

### 시도 8: 80자 제한 압축
- **변경**: 409줄을 80자 이하로 압축
- **결과**: "Errors detected during input processing" → SEGFAULT
- **결론**: 라인 길이 해결, 하지만 Card 120 float 포맷 에러 발견

### 시도 9: 80자 압축 + Card 120/121 float 수정
- **변경**: 80자 압축 + Card 120 W2 `12`→`12.0`, Card 121 W2 `8.5` (이미 float)
- **결과**: ✅ **해석 완료 성공** (10,163 iterations, 정상 종료)

---

## 3. fileGenerator.ts 수정 필요 사항

### 3.1 [CRITICAL] 라인 길이 80자 제한
- **파일**: `src/utils/fileGenerator.ts`
- **문제**: `formatNumber()` 및 필드 패딩(`padEnd`, `padStart`)이 과도한 공백 추가
- **수정**: 모든 데이터 카드 출력 시 80자 이하 보장. 특히:
  - HS 추가 경계조건 카드 (08xx, 09xx) — 12필드 카드가 187자까지 확장
  - Trip 카드 (4xx, 5xx) — 문자열 필드 포함 시 92자까지 확장
  - 일반 패딩을 최소화 (ICV 스타일: 카드번호 후 1-2공백, 필드 간 2-4공백)

### 3.2 [HIGH] Card 120/121 참조 고도 float 포맷
- **파일**: `src/utils/fileGenerator.ts`
- **문제**: Card 120/121의 W2 (ref_elevation)가 정수(`12`)로 출력됨
- **수정**: `formatNumber()` 함수가 정수값도 항상 `.0` 접미사를 포함하도록 수정
  - 또는 Card 120/121 생성 시 명시적으로 `parseFloat` 처리

### 3.3 [MEDIUM] HS multi-geometry 경계조건 카드 번호 누적 오프셋 제거
- **파일**: `src/utils/fileGenerator.ts` (라인 248-268)
- **문제**: `htstrBcOffsets` 로직이 geometry별 누적 노드 수를 카드 번호에 추가
- **수정**: 각 geometry의 05xx/06xx 카드는 항상 `01`부터 시작해야 함
  - `cumulativeLeft/Right` 계산 제거 또는 항상 0으로 설정

---

## 4. 검증된 파일

| 파일 | 설명 | 해석 결과 |
|------|------|-----------|
| `100%_ICV.i` | 원본 (수동 작성) | ✅ 성공 (20,317 iterations) |
| `100%_pri-sys (6).i` | GUI Export 원본 | ❌ SEGFAULT |
| `100%_pri-sys_fixed.i` | HS 번호 수정 + 헤더/Card200 수정 | ❌ SEGFAULT |
| `100%_pri-sys_80col.i` | + 80자 압축 | ❌ Input errors (Card 120 float) |
| `100%_pri-sys_80col_v2.i` | + Card 120 float 수정 | ✅ **성공** (10,163 iterations) |

---

## 5. fileGenerator.ts 수정 완료 (2026-03-19)

### 5.1 formatNumber() 패딩 축소 (라인 2612)
- **변경 전**: `return result.padStart(width);` (기본 width=14 → 각 필드 14자 고정)
- **변경 후**: `return result.padStart(Math.min(width, result.length + 1));` (숫자+1공백만)
- **효과**: HS 추가 경계조건 12필드 카드 187자 → 72자

### 5.2 Card 120/121 참조 고도 float 보장 (라인 2497)
- **변경 전**: `sys.referenceElevation.toString()` → 정수면 `12` 출력
- **변경 후**: `Number.isInteger() ? toFixed(1) : toString()` → 항상 `12.0` 출력

### 5.3 HS multi-geometry BC 오프셋 제거 (라인 248-268)
- **변경 전**: geometry별 누적 노드 수를 BC 카드 번호에 추가
- **변경 후**: 오프셋 항상 0 (각 geometry의 05xx/06xx는 01부터 시작)

### 5.4 Trip 카드 필드 패딩 축소 (라인 114-131)
- **변경 전**: `padEnd(10)`, `padEnd(12)`, `padEnd(6)` 등 넓은 고정 폭 → Trip 카드 92자
- **변경 후**: `padEnd(6)`, `padEnd(10)`, `padEnd(4)` 등 축소 → Trip 카드 69자
- **발견**: `100%_pri-sys (8).i` 테스트에서 HS/formatNumber 수정 반영 후에도 Trip 38줄이 80자 초과하여 SEGFAULT 재현

### 테스트: 100%_pri-sys (8).i
- 원본: ❌ SEGFAULT (Trip 카드 38줄 80자 초과)
- 80자 압축 후: ✅ 성공 (10,163 iterations)

### 5.5 formatNumber() 뒤 .padEnd(12) 148개 일괄 제거
- **문제**: formatNumber 패딩 축소 후에도, 뒤에 .padEnd(12)가 다시 12자로 확장
- **수정**: 정규식으로 `formatNumber(...).padEnd(N)` 및 `.trim().padEnd(N)` 148개 제거

### 5.6 formatNumber() 반환값을 `' ' + result` 로 변경
- **문제**: padEnd 제거 후 필드 간 공백이 사라져 `0.0` + `1` → `0.01`로 합쳐짐
- **수정**: `return ' ' + result;` (앞 공백 1자 보장)
- 직접 연결 8건에 명시적 공백 구분자 추가 (source 카드 hsNumber, junction jefvcahs 등)

### 5.7 Trip 카드 fields.join('  ') 방식으로 변경
- **문제**: padEnd 고정폭으로 92자 초과
- **수정**: `fields.join('  ')` 방식으로 필드 간 2공백 구분

### 5.8 Generator 카드 (205CCC06) trip 번호 분리
- **문제**: `formatNumber(frictionFactor)` + `trip1` 직접 연결 → `0.050`으로 합쳐짐
- **수정**: trip1/trip2 앞에 명시적 `  ` 공백 추가

### 최종 테스트: 100%_pri-sys.i (2026-03-20 10:09)
- GUI Export → Docker 해석 ✅ **성공** (10,163 iterations, 정상 완료)
- 80자 초과 데이터 라인: 0줄
- Input processing: 에러 없음

---

## 6. 원본 대비 수정 상세 (100%_pri-sys (6).i → 80col_v2.i)

### 통계
| 항목 | 원본 | 수정 |
|------|------|------|
| 줄 수 | 12,560 | 12,554 (-6줄) |
| 최대 라인 길이 | 187자 | 121자 |
| 80자 초과 데이터 라인 | 409줄 | 0줄 |

### 변경 카테고리 5건

#### (1) 헤더 축소 (6줄 → 1줄)
```
# 원본
================================================================================
= MARS Input File
= Project:  100% - pri-sys
= Generated: 2026-03-19T08:30:11.022Z
= Tool: MARS GUI Editor v0.1.0
================================================================================

# 수정
= 100% pri-sys - MARS GUI Editor v0.1.0
```
**이유**: `=`로 시작하는 줄은 MARS 타이틀 카드. 여러 줄이어도 동작하지만 ICV 스타일에 맞춰 1줄로 축소.

#### (2) Card 120 W2 float 포맷 (1건)
```
# 원본
120   608010000     12            h2onew  BOP

# 수정
120  608010000  12.0  h2onew  BOP
```
**이유**: MARS는 W2 (참조 고도)를 float로 파싱. `12` (정수) → `12.0` (실수)로 변경 필요.
Card 121은 원본부터 `8.5`로 이미 float이므로 변경 없음 (공백만 축소).

#### (3) Card 200 제거 (1줄)
```
# 원본
200   0.0

# 수정
(제거)
```
**이유**: ICV에는 없는 카드. 제거해도 동작에 영향 없음. (new transient의 시작 시간 기본값 = 0.0)

#### (4) HS multi-geometry 경계조건 카드 번호 수정 (420건)
23개 multi-geometry HS 그룹 영향. 각 geometry의 05xx(좌측BC)/06xx(우측BC) 카드 번호가 이전 geometry 노드 수만큼 누적 오프셋되어 있었음 → 각 geometry 01부터 시작으로 수정.

```
# 예시: HS 1120, Geometry 1 (이전 Geometry 0의 노드 수 = 10)
# 원본: 11부터 시작 (10 누적)
11201511  0  0  0  1  52.8  1
11201512  0  0  0  1  52.8  2
...

# 수정: 01부터 시작
11201501  0  0  0  1  52.8  1
11201502  0  0  0  1  52.8  2
...
```
**이유**: 카드 번호 `1CCCGXXX`에서 `G`(geometry 자리)가 이미 geometry를 구분하므로, 각 geometry 내 카드 번호는 항상 `01`부터 시작해야 함.

#### (5) 80자 초과 라인 압축 (409건)
과도한 공백 패딩을 축소하여 모든 데이터 라인을 80자 이하로 맞춤.

```
# 예시 A: HS 추가 경계조건 12필드 카드 (187자 → 72자)
# 원본 (187자):
11200910           0.011            1.9            0.1             0.0             0.0             0.0             0.0            1.0             2.0          1.3261             1.0    10

# 수정 (72자):
11200910  0.011  1.9  0.1  0.0  0.0  0.0  0.0  1.0  2.0  1.3261  1.0  10

# 예시 B: Trip 카드 (92자 → 72자)
# 원본:
401  time      0           gt    null      0           1000000.0    l  -1.0     "SIS-SBLOCA"

# 수정:
401  time  0  gt  null  0  1000000.0  l  -1.0  "SIS-SBLOCA"
```
**이유**: MARS Fortran 입력 파서는 **80자 라인 버퍼**를 사용. 80자 초과 부분은 잘려서 필드 데이터가 누락됨 → 배열 초기화 오류 → SEGFAULT. ICV 원본의 데이터 라인 최대 길이도 79자.

### 변경하지 않은 항목
- **데이터 값**: 모든 숫자값 동일 유지 (C115 fwd_loss=76.0, HS 1110 boundary=260010000 등 GUI 입력값 그대로)
- **카드 순서**: 원본과 동일
- **주석**: 원본과 동일
- **숫자 표기법**: `15125000.0` vs `15.125e6` 등 형식적 차이는 변경하지 않음 (MARS가 동일하게 처리)
