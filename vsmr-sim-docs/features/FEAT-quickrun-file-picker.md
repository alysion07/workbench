---
title: "FEAT: 퀵런 MinIO 파일 선택 다이얼로그 UI 개선"
status: done
phase: 4
branch: main
last_updated: 2026-04-03
---

# FEAT: 퀵런 MinIO 파일 선택 다이얼로그 UI 개선

> **브랜치**: `alysion/feat_quickrun_impr`
> **상태**: 🚧 설계 완료, 구현 대기
> **관련 이슈**: GitHub Issue #58
> **관련 화면**: QuickRunDialog → MinioFileBrowser (서브 다이얼로그)
> **최종 수정**: 2026-03-27

---

## 1. Summary

퀵 시뮬레이션의 MinIO 파일 선택 다이얼로그를 **폴더 트리 → 테이블 뷰**로 전환한다.
프로젝트명, 생성일시, 입력파일, 입력파일 저장일시를 한 눈에 비교할 수 있게 하고,
프로젝트 홈 페이지로의 네비게이션 링크를 제공하여 기존 프로젝트 탭과 연계한다.

---

## 2. Background

### 현재 문제점

1. **정보 부족**: 프로젝트 폴더명만 표시 → 어떤 프로젝트의 파일을 선택해야 하는지 판단 어려움
2. **탐색 비효율**: 폴더를 하나씩 클릭해서 열어봐야 파일 존재 여부 확인 가능
3. **맥락 단절**: MinIO 브라우저에서 프로젝트 탭(HistoryTables)으로 이동할 수 없음

### 기존 시스템 연계점

| 화면 | 역할 | 연계 |
|------|------|------|
| ProjectHomePage | 프로젝트별 모델/시뮬레이션 기록 관리 | 프로젝트명 클릭 → 이 페이지로 이동 |
| HistoryTables | 업데이트 기록 + 시뮬레이션 기록 테이블 | 퀵런 실행 결과도 여기 표시됨 |
| TaskListPanel | Analysis 탭 시뮬레이션 이력 패널 | 퀵런 실행 후 결과 조회 |

---

## 3. Scope

- **포함**: MinioFileBrowser 컴포넌트를 테이블 뷰로 리팩토링
- **포함**: 프로젝트 홈 페이지 네비게이션 링크 추가
- **제외**: QuickRunDialog 본체 변경 없음
- **제외**: ProjectHomePage / HistoryTables 수정 없음
- **제외**: 새로운 BFF API 추가 없음 (기존 API로 충족)

---

## 4. Data Availability

모든 데이터가 **기존 API**로 제공됨:

| 데이터 | API | 응답 필드 | 현재 사용 |
|--------|-----|-----------|----------|
| 프로젝트 목록 | Supabase `projects` 테이블 | `id, name, created_at, updated_at` | ✅ fetchProjects() |
| 입력파일 정보 | `StorageService.getProjectInputFile(projectId)` | `FileInfo { fileName, objectKey, size, contentType, lastModified }` | ✅ 파일명만 사용 중 |
| 입력파일 저장일시 | 위와 동일 | `FileInfo.lastModified` (ISO-8601) | ❌ **미사용 → 신규 활용** |
| 입력파일 크기 | 위와 동일 | `FileInfo.size` (bytes) | ❌ **미사용 → 신규 활용** |

---

## 5. Functional Requirements

| # | 요구사항 | 우선순위 |
|---|---------|---------|
| FR-1 | 트리 UI → MUI Table 플랫 뷰 전환 | 🔴 |
| FR-2 | 4개 컬럼 표시: 프로젝트명 / 프로젝트 생성일시 / 입력파일 [선택] / 입력파일 저장일시 | 🔴 |
| FR-3 | 기본 정렬: 입력파일 저장일시 최신순 (파일 없는 프로젝트는 하단) | 🔴 |
| FR-4 | 입력파일 없는 행: 회색 처리, [선택] 버튼 비활성화 | 🔴 |
| FR-5 | 프로젝트명 검색 필터 유지 | 🔴 |
| FR-6 | 새로고침 버튼 유지 (프로젝트 + 파일정보 모두 재로딩) | 🟡 |
| FR-7 | 프로젝트명에 프로젝트 홈 페이지 링크 아이콘 (새 탭) | 🟡 |

## 6. Non-Functional Requirements

| # | 요구사항 |
|---|---------|
| NFR-1 | 다이얼로그 오픈 시 모든 프로젝트의 입력파일 정보를 `Promise.allSettled`로 병렬 조회 |
| NFR-2 | 프로젝트 목록은 즉시 표시, 입력파일 컬럼은 개별 로딩 표시 (Skeleton 또는 Spinner) |
| NFR-3 | 날짜 포맷: `YYYY.MM.DD HH:mm` (한국 로케일, 기존 HistoryTables 패턴 준수) |
| NFR-4 | 기존 QuickRunDialog → MinioFileBrowser 인터페이스(`MinioFileBrowserProps`) 변경 없음 |

---

## 7. User Stories

| # | Story | 수용 기준 |
|---|-------|----------|
| US-1 | 사용자로서, 퀵런에서 MinIO 파일 선택 시 모든 프로젝트의 입력파일 상태를 한눈에 비교할 수 있다 | 테이블에 프로젝트명, 생성일시, 파일명, 파일 저장일시 표시 |
| US-2 | 사용자로서, 가장 최근에 저장된 입력파일을 빠르게 찾을 수 있다 | 입력파일 저장일시 최신순 정렬, 파일 없는 프로젝트는 하단 |
| US-3 | 사용자로서, 입력파일이 없는 프로젝트를 선택하려는 실수를 방지할 수 있다 | 파일 없는 행 회색 처리 + 버튼 비활성화 |
| US-4 | 사용자로서, 특정 프로젝트의 상세 정보가 필요할 때 프로젝트 홈으로 이동할 수 있다 | 프로젝트명 옆 링크 아이콘 → 프로젝트 홈 새 탭 |
| US-5 | 사용자로서, 프로젝트명으로 검색하여 원하는 프로젝트를 빠르게 찾을 수 있다 | 검색 필터로 프로젝트명 필터링 |

---

## 8. UI Design

### AS-IS (트리 뷰)

```
┌──────────────────────────────────┐
│ ☁️ MinIO 파일 선택       ↻  ✕   │
├──────────────────────────────────┤
│ 🔍 프로젝트 검색...              │
├──────────────────────────────────┤
│ ▸ 📁 g1soft                     │
│ ▸ 📁 260310-jhseo-test          │
│ ▸ 📁 gjb-test                   │
│ ▸ 📁 jhsuh-project              │
│ ▸ 📁 100_ICV                    │
│   ...                            │
└──────────────────────────────────┘
```

### TO-BE (테이블 뷰)

```
┌─────────────────────────────────────────────────────────────────┐
│ ☁️ MinIO 파일 선택                                   ↻  ✕     │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 프로젝트 검색...                                            │
├──────────────┬─────────────┬──────────────┬────────────────────┤
│ 프로젝트     │ 생성 일시    │ 입력파일      │ 파일 저장 일시      │
├──────────────┼─────────────┼──────────────┼────────────────────┤
│ g1soft    🔗 │ 2026.03.25  │ [선택]       │ 2026.03.26 14:30   │
│              │ 14:20       │ input.i      │                    │
├──────────────┼─────────────┼──────────────┼────────────────────┤
│ 260310-   🔗 │ 2026.03.10  │ [선택]       │ 2026.03.12 09:15   │
│ jhseo-test   │ 11:05       │ test.i       │                    │
├──────────────┼─────────────┼──────────────┼────────────────────┤
│ gjb-test  🔗 │ 2026.03.12  │ —            │ —                  │  ← 회색 (파일 없음)
│              │ 08:30       │              │                    │
├──────────────┼─────────────┼──────────────┼────────────────────┤
│ ...          │             │              │                    │
└──────────────┴─────────────┴──────────────┴────────────────────┘
```

### 상태별 UI

| 상태 | 입력파일 컬럼 | 파일 저장 일시 | 행 스타일 |
|------|-------------|--------------|----------|
| 로딩 중 | `<Skeleton />` | `<Skeleton />` | 기본 |
| 파일 있음 | `[선택] 파일명` | `YYYY.MM.DD HH:mm` | 기본, hover 가능 |
| 파일 없음 | `—` | `—` | `opacity: 0.5`, 선택 불가 |
| API 에러 | `조회 실패` | `—` | `color: error`, 선택 불가 |

---

## 9. Component Design

### 9.1 변경 대상

**MinioFileBrowser** (`src/components/simulation/MinioFileBrowser.tsx`) — 전면 리팩토링

### 9.2 Props (변경 없음)

```typescript
interface MinioFileBrowserProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onFileSelect: (file: SelectedFile) => void;
}
```

### 9.3 내부 상태 재설계

```typescript
// AS-IS: 트리용 상태
interface ProjectItem { id: string; name: string; }
interface ProjectFiles { [projectId: string]: ProjectInputFileItem[]; }

// TO-BE: 테이블용 통합 행 데이터
interface ProjectFileRow {
  projectId: string;
  projectName: string;
  projectCreatedAt: string;          // ISO-8601
  inputFile: FileInfo | null;        // { fileName, objectKey, size, lastModified }
  fileLoading: boolean;              // 개별 파일 로딩 상태
  fileError: boolean;                // 파일 조회 실패 여부
}
```

### 9.4 데이터 로딩 플로우

```
다이얼로그 open
  │
  ├─ Step 1: fetchProjects()
  │  └─ projects 배열 즉시 표시 (fileLoading: true)
  │
  └─ Step 2: Promise.allSettled(
  │    projects.map(p => ProjectService.getProjectInputFile(p.id))
  │  )
  │  └─ 각 프로젝트별 결과를 rows에 병합
  │     ├─ fulfilled → inputFile = FileInfo, fileLoading = false
  │     ├─ rejected  → inputFile = null, fileError = true, fileLoading = false
  │     └─ FileInfo 없음 → inputFile = null, fileLoading = false
  │
  └─ Step 3: 정렬 적용
     └─ 1차: inputFile.lastModified 최신순 (null은 하단)
     └─ 2차: projectCreatedAt 최신순 (동순위 시)
```

### 9.5 정렬 로직

```typescript
function sortRows(rows: ProjectFileRow[]): ProjectFileRow[] {
  return [...rows].sort((a, b) => {
    const aTime = a.inputFile?.lastModified;
    const bTime = b.inputFile?.lastModified;

    // 파일 있는 것이 상위
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;

    // 둘 다 파일 있으면 lastModified 최신순
    if (aTime && bTime) {
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    }

    // 둘 다 파일 없으면 프로젝트 생성일 최신순
    return new Date(b.projectCreatedAt).getTime() - new Date(a.projectCreatedAt).getTime();
  });
}
```

### 9.6 파일 선택 핸들러 (기존 인터페이스 유지)

```typescript
const handleFileSelect = (row: ProjectFileRow) => {
  if (!row.inputFile) return;

  onFileSelect({
    type: 'minio',
    name: row.inputFile.fileName,
    path: row.inputFile.objectKey || `${userId}/${row.projectId}/${row.inputFile.fileName}`,
    projectName: row.projectName,
  });
  onClose();
};
```

### 9.7 프로젝트 홈 링크

```typescript
const handleOpenProjectHome = (e: React.MouseEvent, projectId: string) => {
  e.stopPropagation();  // 행 클릭 이벤트 방지
  window.open(`/projects/${projectId}`, '_blank');
};
```

---

## 10. Data Flow Diagram

```
┌─────────────────┐    ┌──────────────┐    ┌──────────────────┐
│  QuickRunDialog  │───▸│ MinioFile    │───▸│ Supabase         │
│  (부모 다이얼로그) │    │ Browser      │    │ fetchProjects()  │
│                  │    │ (테이블 뷰)   │    └──────────────────┘
│  onFileSelect ◂──│────│              │
│  (SelectedFile)  │    │              │───▸┌──────────────────┐
└─────────────────┘    │              │    │ StorageService    │
                       │              │    │ getProjectInput   │
                       │              │    │ File() × N건      │
                       │  🔗 링크 ────│───▸└──────────────────┘
                       └──────────────┘
                              │
                              ▼ (새 탭)
                       ┌──────────────────┐
                       │ ProjectHomePage   │
                       │ - HistoryTables  │
                       │ - ModelCardList  │
                       └──────────────────┘
```

---

## 11. File Impact Summary

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/components/simulation/MinioFileBrowser.tsx` | **전면 리팩토링** | 트리 → 테이블 뷰, 병렬 로딩, 정렬, 프로젝트 링크 |

**변경 없는 파일들:**
- `QuickRunDialog.tsx` — Props 인터페이스 동일, 수정 불필요
- `ProjectHomePage.tsx` — 기존 그대로 활용 (링크 대상)
- `HistoryTables.tsx` — 기존 그대로 활용
- `projectService.ts` — `getProjectInputFile()`이 이미 `FileInfo` 전체 반환
- `storageService.ts` — 변경 불필요

---

## 12. Risk & Mitigation

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 프로젝트 수가 많을 때 (50+) 병렬 API 호출 부하 | 초기 로딩 지연 | `Promise.allSettled` + 개별 행 Skeleton으로 체감 지연 최소화 |
| `getProjectInputFile` API 에러 (일부 프로젝트) | 해당 행만 에러 표시 | `allSettled`로 개별 실패 격리, 전체 UI 깨지지 않음 |
| 기존 QuickRunDialog 인터페이스 깨짐 | 퀵런 실행 실패 | Props 인터페이스 변경 없음 (NFR-4) |

---

## 13. Future Considerations

- **컬럼 정렬 클릭**: 테이블 헤더 클릭으로 정렬 기준 변경 (프로젝트명/생성일/파일일시)
- **페이지네이션**: 프로젝트 100+ 시 가상 스크롤 또는 페이지네이션 추가
- **FEAT-simulation-history-mgmt 연계**: 시뮬레이션 이력 수 표시 컬럼 추가 가능
- **입력파일 미리보기**: 파일명 hover 시 파일 크기/내용 일부 미리보기 툴팁
