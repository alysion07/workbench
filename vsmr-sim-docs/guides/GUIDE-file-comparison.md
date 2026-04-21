# MARS .i 파일 비교 가이드

## 개요

원본 `.i` 파일 → 컨버터 → JSON → GUI Import → GUI Export → `.i` 파일의 **전체 파이프라인 라운드트립 검증** 가이드.

## 파일 구조

```
documents/
├── 100-50-100%.i              # 원본 레퍼런스 (100→50→100% 부하추종)
├── 100%.i                     # 원본 레퍼런스 (100% 고정출력)
├── 100%_ICV.i                 # 초기조건 생성용 (100% + Interactive Control)
├── 100-50-100%_TR_ICV.i       # Restart용 (100→50→100% + Interactive Control)
├── 100-50-100%.json           # 컨버터 출력 JSON
├── 100%.json                  # 컨버터 출력 JSON
├── 100%_ICV.json              # 컨버터 출력 JSON
└── 100-50-100%_TR_ICV.json    # 컨버터 출력 JSON (restart, 노드 0개)
```

## 파일 간 관계

### 100%.i vs 100-50-100%.i
- **차이 2개**: CV 230 테이블 값만 다름 (`100.0` vs `50.0`, 카드 20230003~04)
- 포맷 차이 1개: `10.0` vs `10.` (비기능적)

### 100%.i vs 100%_ICV.i
- Time Step: 43200초 → 100초 단축, min dt 완화
- Trip 404: load-follow 비활성 (`1e6` never-trip)
- Valve C303/323/343/363: mtrvlv 주석처리
- Interactive Control Block (801~809) 추가

### 100-50-100%_TR_ICV.i
- 99줄 restart 파일 (수력 컴포넌트 없음)
- Global Control + Minor Edits + Trips + General Table만 포함

## 검증 파이프라인

### Step 1: 컨버터로 JSON 생성

```bash
npx tsx scripts/i-file-parser/converter.ts "documents/100%.i" "documents/100%.json"
```

출력 확인:
- 노드 수: 331개 (수력 245 + 열구조체 86)
- 에지 수: 947개
- 파싱 오류: 0개

### Step 2: GUI Import → Export

1. 브라우저에서 `npm run dev`로 개발서버 실행
2. JSON 파일 Import
3. 파일 Export (.i 형식)
4. 다운로드된 파일 경로 확인 (예: `D:/Download/100-Interactive-contorl_model-mars (2).i`)

### Step 3: 라운드트립 스크립트로 비교

```bash
# GUI Export 자체 검증 (lossless 확인)
npx tsx scripts/i-file-parser/roundtrip.ts "D:/Download/exported.i"

# 원본 대비 비교
npx tsx scripts/i-file-parser/roundtrip.ts "documents/100%.i" --compare "D:/Download/exported.i"
```

### Step 4: 결과 해석

```
========================================
        라운드트립 비교 결과
========================================
원본 카드: 6778, Export 카드: 6778
기능적 차이(그룹): 0          ← 이 숫자가 0이면 검증 통과
포맷만 다름(그룹): 1011       ← 비기능적 (카드 split/merge)
========================================
```

## 비기능적 차이 패턴 (허용 목록)

아래 차이는 MARS 실행 결과에 영향 없음:

| # | 패턴 | 예시 | 설명 |
|---|------|------|------|
| 1 | 카드번호 포맷 | `1  90` → `001  90` | 동일 카드 |
| 2 | MARS 기본값 명시 | 원본 생략 → `115  1.0000` | 기본값과 동일 |
| 3 | Sngljun 0101+0102 병합 | 2카드 → 1카드 | 동일 데이터 |
| 4 | Pipe spread 인덱스 압축 | 개별값 → `value N` | 동일 결과 |
| 5 | CV SUM 데이터 줄 분할 | 1줄 → 2줄 | 동일 데이터 |
| 6 | Separatr 카드 분할 | 1줄 → 2줄 | 동일 데이터 |
| 7 | Pump CCC0101 분할 | 1줄 → 2줄 | 동일 데이터 |
| 8 | Pipe CCC1201 초기조건 압축 | 개별값 → 압축형 | 동일 결과 |
| 9 | Mtpljun 초기조건 개별화 | 압축형 → 개별값 | 동일 결과 |
| 10 | Snglvol 카드 분할 | 1줄 → 2줄 | 동일 데이터 |
| 11 | Pump CCC0302 줄 이동 | 줄 순서 변경 | 동일 데이터 |
| 12 | Junction area 기본값 | 원본 생략 → `0.0 N` | 0.0 = 볼륨 면적 사용 |
| 13 | 열구조체 우측경계 | 원본 생략 → `13CC1900  0` | 기본값 0 |

## 과거 이슈 및 해결

### formatNumber precision 손실 (해결)

**증상**: `1.69348e-6` → `1.6935e-6` (유효숫자 6자리 → 5자리)

**원인**: `fileGenerator.ts`의 `formatNumber()`에서 `toExponential(4)` 사용

**수정**: `toExponential(4)` → `toExponential()` (자동 정밀도)

**파일**: `src/utils/fileGenerator.ts:2585, 2589`

### Interactive Inputs 코멘트 누락 (해결)

**증상**: `801  trip  404  "load-follow"` → `801  trip  404` (코멘트 누락)

**원인**: 컨버터 파서 `parseInteractiveInputs()`가 `words[2]` 이후 따옴표 문자열을 무시

**수정**: `words[2:]`를 합쳐서 따옴표 제거 후 `comment` 필드에 매핑

**파일**: `scripts/i-file-parser/globalParser.ts:309-323`

### Fortran 지수 표기 (해결)

**증상**: `1.69348-6` (Fortran shorthand) → `1.69348` (지수 누락)

**원인**: 토크나이저에 `normalizeFortranExponent()` 미적용

**수정**: `1.69348-6` → `1.69348e-6` 변환 함수 추가

**파일**: `scripts/i-file-parser/tokenizer.ts:139-159`

## 검증 체크리스트

```
[ ] 컨버터 JSON 생성 (오류 0개 확인)
[ ] GUI Import 정상 동작
[ ] GUI Export 수행
[ ] 라운드트립 스크립트 실행
[ ] 기능적 차이 0개 확인
[ ] CV precision 값 확인 (grep "1.69348" exported.i)
[ ] Interactive Inputs 코멘트 확인 (grep "^80" exported.i)
```
