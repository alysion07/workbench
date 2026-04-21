# 컴포넌트 작업 가이드

> 컴포넌트(SNGLVOL, PIPE, VALVE, HTSTR 등) 관련 작업 시 이 문서를 참조.
> 일반 UI/페이지 작업에서는 불필요.

## Source of Truth

```
[MARS INPUT MANUAL](documents\reference\MARS-KS Code Manual, Volume II-Input Requirement (2022.2)_내부결재용.pdf)  ← 📖 필수 참조 

```

## 작업 흐름

**1. 계획 수립**: PDF 매뉴얼 검색 → 해당 섹션 읽기 → 파라미터/Card 번호 확인 → 계획 작성
**2. 구현**: 매뉴얼 기반 타입 정의 → 폼 필드 구현 → 파일 생성 로직 구현
**3. 검증**: 매뉴얼 Card 형식과 생성된 .i 파일 비교 → 필수/옵션 필드 확인

## PDF 매뉴얼 검색

```bash
# 키워드로 페이지 찾기
python -c "
import PyPDF2
search = 'SNGLVOL'  # 찾을 컴포넌트명
with open('documents/reference/Mars Input Manual (2010.02.).pdf', 'rb') as f:
    reader = PyPDF2.PdfReader(f)
    for i, page in enumerate(reader.pages):
        if search.lower() in page.extract_text().lower():
            print(f'Page {i+1}')
"

# 특정 페이지 범위 읽기
python -c "
import PyPDF2
with open('documents/reference/Mars Input Manual (2010.02.).pdf', 'rb') as f:
    reader = PyPDF2.PdfReader(f)
    for i in range(230, 245):  # 0-indexed 페이지 범위
        print(f'=== Page {i+1} ===')
        print(reader.pages[i].extract_text())
"
```

## 금지 사항

| 금지 | 대신 |
|------|------|
| 파라미터 추측 | 매뉴얼에서 Card 번호/형식 확인 |
| 기억에 의존 | 매뉴얼 페이지 직접 참조 |
| 대충 구현 | 매뉴얼 예제와 비교 검증 |

---

## Feature 문서 필수 항목

컴포넌트 관련 Feature 문서 작성 시 반드시 포함:

```markdown
## Manual Reference
- **PDF**: Mars Input Manual (2010.02.).pdf
- **Pages**: 230-245
- **Cards**: CCC0001, CCC0101-0109, CCC0200, ...

## Card Specifications
| Card | 필드 | 형식 | 필수 | 설명 |
|------|------|------|------|------|
| CCC0001 | ... | ... | Y | ... |
```

Junction/연결형 컴포넌트의 경우 From/To 섹션 필수 → [GUIDE-volume-reference.md](GUIDE-volume-reference.md) 참조
