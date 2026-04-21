# Heat Structure 컴포넌트 개발 계획

**최종 업데이트**: 2026-02-02
**Phase 1 상태**: ✅ 완료
**Phase 1.5 상태**: ✅ 완료
**Phase 1.5.1 상태**: ✅ 완료 (BC↔Edge 양방향 동기화)
**Phase 2 상태**: ✅ 완료 (연료봉 지원)
**Phase 3 상태**: ✅ 완료 (Thermal Property 에디터)
**문서 기반**: `MARS_HeatStructure_Analysis.md`, `HeatStructure_Implementation_Review.md`

---

## 1. 현재 구현 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| 노드 컴포넌트 | ✅ 완료 | `HeatStructureNode.tsx` |
| 폼 컴포넌트 | ✅ 완료 | 11개 탭 (Basic~Fuel Rod) |
| 타입 정의 | ✅ Phase 1+2+3 완료 | Gap, MWR, Cladding, ThermalProperty 인터페이스 |
| 파일 생성기 | ✅ 완료 | Phase 2+3 카드 생성 포함 |
| UI 통합 | ✅ 완료 | Palette, FlowCanvas, PropertyPanel |
| 검증 로직 | ✅ 완료 | 연료봉 + Thermal Property 검증 규칙 포함 |
| 재료 드롭다운 | ✅ 완료 | Thermal Properties 동적 연동 + SMART 기본값 |
| 볼륨 선택기 | ✅ 완료 | BC 탭 Autocomplete |
| **엣지 기반 BC 자동 반영** | ✅ 완료 | Phase 1.5 |
| **연료봉 모드 (Fuel Rod)** | ✅ 완료 | Phase 2 |
| **Thermal Property 에디터** | ✅ 완료 | Phase 3 (201MMMNN 카드) |
| **재료 드롭다운 ↔ Thermal Properties** | ✅ 완료 | Phase 3 (동적 연동) |

---

## 2. 개발 로드맵

### Phase 1: 일반 구조물 완성 ✅ 완료

모든 Phase 1 작업이 완료되었습니다:
- 10개 탭 UI (Basic ~ Right Add BC)
- 검증 로직 (`validateHeatStructure()`)
- 재료 드롭다운 (SMART 참조 재료 목록)
- 볼륨 선택기 (Autocomplete 기반)
- 파일 생성기 (`generateHeatStructureCards()`)

### Phase 1.5: 엣지 기반 BC 자동 반영 ✅ 완료

#### 2.1.1 목표

ReactFlow 엣지로 Volume 컴포넌트를 Heat Structure 노드에 연결할 때, 해당 경계조건(BC)이 자동으로 반영되도록 구현

#### 2.1.2 설계 결정

| 항목 | 결정 |
|------|------|
| 다중 nh 처리 | 첫 번째 BC (hsNumber=1)만 자동 반영. 나머지는 수동 설정 |
| bcType 설정 | 연결 시 101(Convective), 삭제 시 0(Insulated) |
| 지원 볼륨 타입 | snglvol, tmdpvol, pipe, branch |
| Face 값 | 축방향만 지원 (face=1 또는 2). Crossflow 미사용 |

#### 2.1.3 SMART 참조 파일 분석 결과

**파일**: `SMART_SIM_BASE_REV01.i`

| 분석 항목 | 결과 |
|----------|------|
| Heat Structure BC 카드 수 | 100+ 개 |
| 볼륨 참조 Face 값 | 모두 `0000` (기본 축방향) |
| Crossflow Face (0003-0006) 사용 | **0건** |

**결론**: Heat Structure 경계조건은 항상 축방향 연결만 사용. Crossflow face 선택 UI 불필요.

#### 2.1.4 구현 작업 목록

| 작업 | 파일 | 설명 | 상태 |
|------|------|------|------|
| MARSEdgeData 타입 확장 | `mars.ts` | heatStructureNodeId, heatStructureSide 추가 | ✅ |
| onConnect() 처리 | `useStore.ts` | Heat Structure 연결 시 BC 자동 반영 | ✅ |
| onEdgesChange() 처리 | `useStore.ts` | 엣지 삭제 시 BC 초기화 | ✅ |
| 엣지 감지 UI | `HeatStructureForm.tsx` | 연결 상태 표시 Alert | ✅ |
| 핸들 시각화 (선택) | `HeatStructureNode.tsx` | 연결 상태에 따른 색상 변경 | ⏳ (선택) |

### Phase 1.5.1: BC↔Edge 양방향 동기화 ✅ 완료

#### 2.1.5 버그 수정 (2026-02-02)

**문제 1**: BC 탭에서 boundaryVolume을 삭제해도 ReactFlow Edge가 남아있음
**문제 2**: BC 탭에서 수동으로 boundaryVolume을 추가해도 ReactFlow Edge가 생성되지 않음

**원인**: 단방향 동기화만 구현됨 (Edge→BC만, BC→Edge 누락)

**해결**: Store에 양방향 엣지 관리 액션 추가

| 작업 | 파일 | 설명 | 상태 |
|------|------|------|------|
| deleteHeatStructureEdge 액션 | `useStore.ts` | BC 삭제 시 엣지 자동 삭제 | ✅ |
| createHeatStructureEdge 액션 | `useStore.ts` | BC 추가 시 엣지 자동 생성 | ✅ |
| onSubmit에서 양방향 동기화 | `HeatStructureForm.tsx` | BC 변경 감지 및 엣지 동기화 | ✅ |

**양방향 동기화 로직**:
```typescript
// BC 삭제 → Edge 삭제
if (leftEdgeConnected && leftBoundaryVolume === null) {
  deleteHeatStructureEdge(nodeId, 'left');
}
// BC 추가 → Edge 생성
if (!leftEdgeConnected && leftBoundaryVolume !== null) {
  createHeatStructureEdge(nodeId, 'left', leftBoundaryVolume);
}
```

---

### Phase 1 완료된 작업 (참고용)

| 작업 | 파일 | 설명 | 상태 |
|------|------|------|------|
| Tab 8: Left Add BC | `HeatStructureForm.tsx` | 9-word 포맷 UI | ✅ |
| Tab 9: Right Add BC | `HeatStructureForm.tsx` | 9-word 포맷 UI | ✅ |
| 검증 로직 | `componentValidation.ts` | mesh/BC 검증 규칙 | ✅ |
| 재료 드롭다운 | `HeatStructureForm.tsx` | SMART 참조 재료 목록 | ✅ |
| 볼륨 선택기 | `HeatStructureForm.tsx` | Autocomplete 기반 | ✅ |

#### 2.1.2 추가 경계조건 탭 상세 (9-word Format)

```
필요한 입력 필드:
┌────────────────────────────────────────────────────────┐
│ 1. Heat Transfer Hydraulic Diameter (HTHD)  [m]        │
│ 2. Heated Length Forward (HLF)              [m]        │
│ 3. Heated Length Reverse (HLR)              [m]        │
│ 4. Grid Spacer Length Forward (GSLF)        [m]        │
│ 5. Grid Spacer Length Reverse (GSLR)        [m]        │
│ 6. Grid Loss Coefficient Forward (GLCF)     [-]        │
│ 7. Grid Loss Coefficient Reverse (GLCR)     [-]        │
│ 8. Local Boiling Factor (LBF)               [-]        │
│ 9. HS Number                                [1~nh]     │
└────────────────────────────────────────────────────────┘

SMART 기본값:
- HTHD: 0.0 또는 0.013
- HLF/HLR: 10.0, 12.19
- GSLF/GSLR/GLCF/GLCR: 0.0
- LBF: 1.0
```

#### 2.1.3 검증 규칙 (componentValidation.ts)

```typescript
// 필수 검증 규칙
1. meshIntervals 합계 === np - 1
2. materialCompositions.max(interval) <= np - 1
3. initialTemperatures.max(meshPoint) <= np
4. leftBoundaryConditions.length === nh
5. rightBoundaryConditions.length === nh
6. sourceData.length === nh
7. 추가 BC 사용 시: additionalBoundary.length === nh

// 경고 규칙
- BC Type 101 선택 시 boundaryVolume 필수
- sourceType > 0 시 multiplier 검증
```

#### 2.1.4 재료 번호 드롭다운 옵션

| 번호 | 재료명 | 용도 |
|------|--------|------|
| 1 | MDF A508 C3 | RV Base Metal |
| 2 | Austenite SS | RV Cladding |
| 3 | 304 SS | Internal Structure (가장 흔함) |
| 4 | UO2 | Fuel Pellet (Phase 2) |
| 7 | 321 SS | MCP |
| (직접입력) | - | 기타 재료 번호 |

---

### Phase 2: 연료봉 지원 (SMART S1200) ✅ 완료

#### 2.2.0 구현 완료 내용 (2026-02-02)

| 항목 | 파일 | 설명 |
|------|------|------|
| 타입 정의 | `mars.ts` | HsGapConductance, HsMetalWaterReaction, HsCladdingDeformation, HsGapDeformation |
| Fuel Rod 토글 | `HeatStructureForm.tsx` | Basic 탭에 isFuelRod 스위치 |
| Reflood 옵션 | `HeatStructureForm.tsx` | refloodFlag, boundaryVolumeIndicator, maxAxialIntervals |
| Fuel Rod 탭 | `HeatStructureForm.tsx` | Tab 10: Gap/MWR/Cladding/Gap Deformation UI |
| 카드 생성 | `fileGenerator.ts` | Cards 1CCCG001, 003, 004, 011-099 |
| 검증 로직 | `componentValidation.ts` | Gap/Cladding 의존성, MAI 유효값 검증 |

#### 2.2.1 기본 정의 확장 (1CCCG000 W6-W8)

```typescript
// mars.ts 타입 확장
export interface HeatStructureParameters {
  // ... 기존 필드 ...

  // Phase 2: 연료봉 전용
  refloodFlag?: number;     // 0 또는 Trip 번호 (e.g., 599)
  bvi?: number;             // Boundary Volume Index (1-99)
  mai?: number;             // Max Axial Intervals (e.g., 16)
}
```

#### 2.2.2 Gap 데이터 카드 (1CCCG001)

```typescript
export interface HsGapData {
  gapPressure: number;           // Pa (e.g., 5.691173e6)
  referenceVolume: VolumeReference;  // 참조 볼륨
}
```

#### 2.2.3 금속-물 반응 카드 (1CCCG003)

```typescript
export interface HsMetalWaterReaction {
  oxideThickness: number;   // m (e.g., 6.70052e-6)
}
```

#### 2.2.4 피복관 변형 카드 (1CCCG004)

```typescript
export interface HsCladdingDeformation {
  fcflFlag: 0 | 1;  // 0=미사용, 1=사용
}
```

#### 2.2.5 Gap 변형 데이터 (1CCCG011-099)

```typescript
export interface HsGapDeformation {
  fsr: number;        // Fuel Surface Roughness
  csr: number;        // Clad Surface Roughness (1.8859e-6 ~ 3.0722e-6)
  swelling: number;   // 연료 팽윤 (3.8527e-5)
  creepdown: number;  // 피복관 Creep (0.0)
  nodeNumber: number; // 축방향 노드 번호 (1~nh)
}
```

#### 2.2.6 12-word 추가 경계 포맷

```typescript
export interface HsAdditionalBoundary12Word extends HsAdditionalBoundary {
  naturalCirculationLength: number;  // NCL (2.66)
  pitchToDiameterRatio: number;      // TPDR (1.3247)
  foulingFactor: number;             // (1.0)
}

// leftAdditionalOption / rightAdditionalOption 타입 확장
export type HsAdditionalBoundaryOption = 0 | 1;  // 0=9-word, 1=12-word
```

---

### Phase 3: Thermal Property 테이블

#### 2.3.1 재료 속성 관리

```
개발 항목:
┌──────────────────────────────────────────────────────┐
│ 1. Thermal Property 에디터 화면                       │
│ 2. 일반 재료 (Type 1): 열전도도/체적열용량 테이블     │
│ 3. Gap 재료 (Type 3): 가스 조성 + 열용량              │
│ 4. 201MMNN0 카드 생성 로직                           │
└──────────────────────────────────────────────────────┘
```

#### 2.3.2 SMART에서 사용된 재료

| 재료번호 | 재료명 | 타입 |
|----------|--------|------|
| 1 | MDF A508 C3 (RV Base) | Type 1 |
| 2 | Austenite SS (RV Clad) | Type 1 |
| 3 | 304 SS (Internal) | Type 1 |
| 4 | UO2 (Fuel) | Type 1 |
| 5 | Fuel Gap | Type 3 (가스) |
| 6 | Zircaloy (Clad) | Type 1 |
| 7 | 321 SS (MCP) | Type 1 |
| 8 | Inconel 690 (SG) | Type 1 |
| 9 | Wet Insulator (PZR) | Type 1 |

---

## 3. 구현 체크리스트

### Phase 1 (일반 구조물) ✅ 완료

- [x] 기본 정의 (1CCCG000) - nh, np, geom, ssInit, leftCoord
- [x] 메쉬 플래그 (1CCCG100)
- [x] 메쉬 간격 (1CCCG101-199)
- [x] 재료 구성 (1CCCG201-299)
- [x] 열원 분포 (1CCCG301-399)
- [x] 초기 온도 (1CCCG401-499)
- [x] 좌측 경계조건 (1CCCG501-599)
- [x] 우측 경계조건 (1CCCG601-699)
- [x] 열원 데이터 (1CCCG701-799)
- [x] 추가 좌측 경계 탭 UI (1CCCG800-899) - 9-word format
- [x] 추가 우측 경계 탭 UI (1CCCG900-999) - 9-word format
- [x] 검증 로직 (componentValidation.ts) - validateHeatStructure 함수
- [x] 재료 드롭다운 선택기 - SMART 참조 재료 목록
- [x] 경계 볼륨 드롭다운 선택기 - Autocomplete 기반
- [ ] nh/np 변경 시 테이블 자동 동기화 (선택적 개선사항)

### Phase 1.5 (엣지 기반 BC 자동 반영) ✅ 완료

- [x] SMART 참조 파일 분석 (Crossflow 미사용 확인)
- [x] MARSEdgeData 타입 확장 (heatStructureNodeId, heatStructureSide)
- [x] onConnect() 수정 - Heat Structure 연결 시 BC 자동 반영
- [x] onEdgesChange() 수정 - 엣지 삭제 시 BC 초기화
- [x] HeatStructureForm 엣지 감지 UI
- [ ] HeatStructureNode 핸들 시각화 (선택적 개선사항)

### Phase 1.5.1 (BC↔Edge 양방향 동기화) ✅ 완료

- [x] `useStore.ts`에 `deleteHeatStructureEdge` 액션 추가 (BC 삭제 → 엣지 삭제)
- [x] `useStore.ts`에 `createHeatStructureEdge` 액션 추가 (BC 추가 → 엣지 생성)
- [x] `HeatStructureForm.tsx` onSubmit에서 양방향 동기화 로직 구현
- [x] 빌드 확인

### Phase 2 (연료봉) ✅ 완료

- [x] 기본 정의 확장 (Reflood, BVI, MAI) - Card 1CCCG000 Words 6-8
- [x] Gap 데이터 (1CCCG001) - HsGapConductance 인터페이스
- [x] 금속-물 반응 (1CCCG003) - HsMetalWaterReaction 인터페이스
- [x] 피복관 변형 (1CCCG004) - HsCladdingDeformation 인터페이스
- [x] Gap 변형 데이터 (1CCCG011-099) - HsGapDeformation 인터페이스
- [x] 12-word 추가 경계 타입 정의 - HsAdditionalBoundary12Word, 13Word
- [x] 음수 재료 번호 지원 (-5, -6) - 재료 드롭다운에 추가
- [x] Fuel Rod 탭 (Tab 10) UI 구현
- [x] fileGenerator.ts Phase 2 카드 생성 로직
- [x] componentValidation.ts 연료봉 검증 규칙
- [x] 빌드 확인 (`npm run build` 성공)

### Phase 3 (Thermal Property) ✅ 완료

- [x] Thermal Property 에디터 화면 (`ThermalPropertiesTab.tsx`)
- [x] 일반 재료 속성 테이블 (Type 1): 온도-열전도도/열용량 테이블
- [x] Gap 재료 속성 (Type 3): 가스 조성 테이블
- [x] 201MMMNN 카드 생성 (`fileGenerator.ts`)
- [x] 내장 재료 지원 (C-STEEL, S-STEEL, UO2, ZR)
- [x] 상수 열전도도/열용량 지원
- [x] W3=-1 공유 온도 모드 지원
- [x] 검증 로직 (`componentValidation.ts`)
- [x] GlobalSettingsDialog 통합
- [x] 빌드 확인 (`npm run build` 성공)
- [x] Heat Structure 재료 드롭다운 ↔ Thermal Properties 동적 연동 (`HeatStructureForm.tsx`)
  - Thermal Properties 정의 재료 우선 표시
  - SMART 기본 재료는 충돌 없는 번호만 `[기본값]` 라벨로 표시
  - 특수 재료 (-5, -6) 및 Custom 옵션 유지

---

## 4. SMART 파일 호환성 목표

| 컴포넌트 유형 | SMART 예시 | Phase 1 지원 | Phase 2 지원 |
|--------------|------------|-------------|-------------|
| 단순 구조물 | S1100-1, S1110-0 | ✅ | - |
| 다층 구조물 | S1100-0, S1190-0 | ✅ | - |
| 다축 노드 | S1170-0, S1180-0 | ✅ | - |
| **연료봉** | **S1200** | - | ✅ 완료 |

---

## 5. 다음 작업 제안

### Phase 2.5: Heat Structure - Volume 연결 개선 ⏳ 대기

**문서**: [HeatStructure_Volume_Connection_Design.md](HeatStructure_Volume_Connection_Design.md)

현재 BC 탭에서 수동으로 Volume을 선택하면 엣지가 생성되지만, 시각적 표현을 개선하기 위한 설계:

| 항목 | 설명 |
|------|------|
| 동적 핸들 | Volume 노드에 Heat Structure 연결 시 핸들 자동 생성/삭제 |
| Convection 엣지 | 빨간 점선으로 열전달 연결 명확히 구분 |
| 양방향 동기화 | BC 변경 ↔ 엣지 변경 자동 동기화 |

### 선택적 개선사항

```
1. HeatStructureNode.tsx 핸들 시각화 (선택)
   - 연결 상태에 따른 핸들 색상 변경 (미연결: #FF5722, 연결됨: #4CAF50)

2. nh/np 변경 시 테이블 자동 동기화
   - 경계조건, 열원 데이터 배열 자동 조정

3. 12/13-word 추가 경계 UI 확장 (선택)
   - Additional BC 탭에 formatFlag 선택 드롭다운
   - 동적 필드 렌더링 (NCL, P/D Ratio, Fouling Factor)
```

### 향후 작업 (Phase 3.5: 확장 기능)

```
1. 다항식 함수 입력 (W2=2, W3=2): 계수 A0~A5 입력 UI
2. 재료 프리셋 저장/불러오기 기능
3. CSV/Excel 임포트 기능
```

> **Note**: Phase 3 (Thermal Property 에디터)는 완료되었습니다. 상세 구현 계획은
> `.claude/plans/cozy-prancing-harbor.md` 참조.

---

## 6. 참조 문서

- `MARS_HeatStructure_Analysis.md` - SMART 파일 상세 분석
- `HeatStructure_Implementation_Review.md` - 구현 상태 검토
- `HeatStructure_Volume_Connection_Design.md` - HS-Volume 연결 설계 (**NEW**)
- `Mars Input Manual (2010.02.)_part2.pdf` - 공식 매뉴얼
- `SMART_SIM_BASE_REV01.i` - 참조 입력 파일

---

## 7. Changelog

| 날짜 | 변경 | 비고 |
|------|------|------|
| 2026-02-02 | 재료 드롭다운 ↔ Thermal Properties 동적 연동 | HeatStructureForm.tsx 수정 |
| 2026-02-02 | HS-Volume 연결 설계 문서 작성 | 동적 핸들, Convection 엣지 |
| 2026-02-02 | Phase 3 (Thermal Property) 구현 완료 | ThermalPropertiesTab.tsx, 201MMMNN 카드 생성 |
| 2026-02-02 | Phase 2 (연료봉) 구현 완료 | Fuel Rod 탭, Gap/MWR/Cladding 카드 |
| 2026-02-02 | Phase 1.5.1 완료 | BC↔Edge 양방향 동기화 |
| 2026-02-01 | Phase 1.5 완료 | 엣지 기반 BC 자동 반영 |
| 2026-01-31 | Phase 1 완료 | 10개 탭, 파일 생성, 검증 로직 |
