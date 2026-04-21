# VolumeReference 기반 From/To 연결 가이드

> Junction/연결형 컴포넌트(SNGLJUN, TMDPJUN, BRANCH, MTPLJUN, PUMP, VALVE 등) 구현 시 참조.
> 볼륨형 컴포넌트(SNGLVOL, PIPE 등)만 다루는 경우 불필요.

## VolumeReference 개요

```typescript
// src/types/mars.ts
interface VolumeReference {
  nodeId: string;      // ReactFlow 노드 ID (immutable key, 예: "cmp_1200000")
  volumeNum: number;   // 셀 번호 (1-99)
  face: number;        // 면 번호 (1=inlet, 2=outlet, 3-6=crossflow)
}
```

- **nodeId**: 7자리 컴포넌트 ID가 아닌 **불변 ReactFlow 노드 ID**를 참조 키로 사용
- **Volume ID 변환**: `VolumeReference` → 9자리 `CCCVV000N` 형식 (파일 생성 시)
- **NodeIdResolver**: 변환/검증/조회 유틸리티 ([nodeIdResolver.ts](../src/utils/nodeIdResolver.ts))

## 기존 구현 참조 (레퍼런스)

| 참조 구현 | 파일 | 핵심 라인 | 설명 |
|-----------|------|----------|------|
| **타입 정의** | [mars.ts](../src/types/mars.ts) | L106-110 | VolumeReference 인터페이스 |
| **SNGLJUN 폼** | [SngljunForm.tsx](../src/components/forms/SngljunForm.tsx) | L89-166 | 엣지 자동감지 + 볼륨 목록 생성 |
| **TMDPJUN 폼** | [TmdpjunForm.tsx](../src/components/forms/TmdpjunForm.tsx) | L96-165 | 시간의존 junction From/To |
| **Valve 폼** | [ValveForm.tsx](../src/components/forms/ValveForm.tsx) | - | Valve From/To 구현 |
| **NodeIdResolver** | [nodeIdResolver.ts](../src/utils/nodeIdResolver.ts) | L76-247 | 변환/검증/라벨 유틸리티 |
| **파일 생성** | [fileGenerator.ts](../src/utils/fileGenerator.ts) | L285-324 | VolumeReference → Volume ID 변환 |
| **엣지 데이터** | [mars.ts](../src/types/mars.ts) | L903-941 | MARSEdgeData의 fromVolume/toVolume |

## 컴포넌트 타입별 볼륨/면 범위

| 컴포넌트 타입 | volumeNum 범위 | face 범위 | 비고 |
|--------------|---------------|----------|------|
| SNGLVOL / TMDPVOL | 1 | 1-2 (축방향), 1-6 (crossflow) | 단일 볼륨 |
| PIPE | 1 ~ ncells | 1-2 (축방향), 1-6 (crossflow) | 다중 셀 |
| BRANCH | 1 | 1-2 또는 1-6 | 분기 볼륨 |
| PUMP | inletConnection / outletConnection | 1-2 | 펌프 입출구 |

## 계획 수립 시 From/To 기획 체크리스트

연결형 컴포넌트의 Feature 문서 작성 시 아래 항목을 반드시 포함:

1. [ ] 매뉴얼에서 해당 컴포넌트의 연결 Card 확인 (From/To Volume ID 필드)
2. [ ] 타입 정의에 from/to 필드를 `VolumeReference | null` 로 선언
3. [ ] 엣지 자동감지 로직 설계 (connectedEdges → autoFrom/autoTo)
4. [ ] 사용 가능한 볼륨 목록 생성 로직 설계 (컴포넌트 타입별 셀/면 범위)
5. [ ] Autocomplete UI 기획 (볼륨 선택 + 면 선택)
6. [ ] 파일 생성 시 VolumeReference → CCCVV000N 변환 로직 기획
7. [ ] 유효성 검증 기획 (연결 누락, 잘못된 참조 경고)

## 엣지 자동감지 패턴 (필수 구현)

```typescript
// 표준 패턴: connectedEdges에서 From/To 자동 설정
for (const edge of connectedEdges) {
  const isJunctionSource = edge.source === nodeId;
  if (isJunctionSource) {
    // Junction → Volume: "to" = 대상 볼륨 inlet (face 1)
    autoTo = { nodeId: connectedNodeId, volumeNum: 1, face: 1 };
  } else {
    // Volume → Junction: "from" = 소스 볼륨 outlet (face 2)
    autoFrom = { nodeId: connectedNodeId, volumeNum: 1, face: 2 };
  }
}
```

## Feature 문서 From/To 섹션 템플릿

```markdown
## From/To Connection Design
- **연결 Card**: CCC0201 (From Volume ID), CCC0202 (To Volume ID)
- **타입 필드**: `from: VolumeReference | null`, `to: VolumeReference | null`
- **자동감지**: connectedEdges 기반 autoFrom/autoTo 설정
- **UI**: Autocomplete (볼륨 선택) + Face 선택 드롭다운
- **파일 생성**: `NodeIdResolver.getVolumeIdFromReference()` → CCCVV000N
- **검증**: 미연결 경고, 잘못된 참조 에러
- **레퍼런스 구현**: SngljunForm.tsx 패턴 따름
```

## 금지 사항

| 금지 | 대신 |
|------|------|
| 7자리 컴포넌트 ID를 직접 참조 | VolumeReference의 nodeId (불변 ReactFlow ID) 사용 |
| 문자열로 Volume ID 하드코딩 | VolumeReference 객체 + NodeIdResolver 변환 |
| 연결 정보를 수동 입력만 지원 | 엣지 자동감지 + 수동 오버라이드 병행 |
| From/To 없이 junction 컴포넌트 기획 | 반드시 VolumeReference 기반 연결 설계 포함 |
