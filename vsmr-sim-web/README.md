# VSMR Simulator Web GUI

MARS 원자로 시뮬레이터를 위한 웹 기반 GUI.
ReactFlow 기반 비주얼 노드 편집기로 MARS 입력 파일(.i)을 생성하고, 시뮬레이션을 실행/모니터링하는 통합 개발 환경.

## Tech Stack

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 18+, pnpm 9+ |
| Framework | React 18, TypeScript, Vite |
| State | Zustand 4 |
| UI | MUI 5, React Hook Form, Zod |
| Flow Editor | ReactFlow 11.11 |
| Charts | Recharts, D3 |
| Backend 통신 | Connect-RPC (@connectrpc) |
| 인증 | Supabase Auth |
| 저장소 | MinIO (S3), Supabase |

## Quick Start

```bash
# 의존성 설치
pnpm install

# 개발 서버 (Vite)
pnpm dev

# 프로덕션 빌드
pnpm build

# 빌드 미리보기
pnpm preview

# ESLint 체크
pnpm lint
```

## Project Structure

```
src/
├── pages/                  # 페이지 컴포넌트
│   ├── LoginPage.tsx       # 로그인 (GitHub OAuth / 이메일)
│   ├── ProjectPickerPage.tsx # 프로젝트 선택
│   ├── ProjectHomePage.tsx # 프로젝트 홈
│   ├── ModelHomePage.tsx   # 모델 홈
│   ├── EditorPage.tsx      # MARS 모델 에디터 (메인)
│   ├── SimulationPage.tsx  # 시뮬레이션 실행/모니터링
│   └── AnalysisPage.tsx    # 결과 분석 (plotfl 뷰어)
├── components/
│   ├── nodes/              # ReactFlow 노드 (13개)
│   ├── forms/              # 속성 편집 폼 (13개)
│   ├── panels/             # FullCodeView, EdgePropertyPanel
│   ├── editor/             # EditorHeader 등
│   ├── simulation/         # LiveLogViewer, DynamicChartGrid, ChartCard
│   ├── interactive/        # InteractiveControlView, AlarmPanel
│   ├── analysis/           # VariableExplorer, ChartPanelGrid, TimeSeriesChart
│   ├── dialogs/            # GlobalSettingsDialog 등
│   └── common/             # AppLayout, Sidebar, ProtectedRoute
├── stores/
│   ├── useStore.ts         # 에디터 상태 (Zustand + persist)
│   ├── simulationStore.ts  # 시뮬레이션 Job 관리
│   ├── projectStore.ts     # 프로젝트 CRUD (Supabase)
│   ├── analysisStore.ts    # Plotfl 파서 상태
│   └── authStore.ts        # 인증 상태
├── services/
│   ├── mars/               # MARS 제어 (pause, resume, stop, speed)
│   ├── sse/                # Task Stream (Connect-RPC)
│   ├── pm/                 # ProjectManager RPC
│   └── storage/            # MinIO 파일 서비스
├── types/
│   └── mars.ts             # MARS 컴포넌트 타입 정의
└── utils/
    ├── fileGenerator.ts    # MARS 입력 파일(.i) 생성기
    └── nodeAppearance.ts   # 노드 외형 (도형/색상/크기)
```

## MARS Components (13 Types)

| Category | Component | MARS Code |
|----------|-----------|-----------|
| Volume | Single Volume | SNGLVOL |
| Junction | Single Junction | SNGLJUN |
| Junction | Multiple Junction | MTPLJUN |
| Piping | Pipe | PIPE |
| Piping | Branch | BRANCH |
| Piping | Tank | TANK |
| Equipment | Pump | PUMP |
| Equipment | Turbine | TURBINE |
| Equipment | Separator | SEPARATOR |
| Equipment | Valve | VALVE |
| Thermal | Heat Structure | HTSTR |
| Boundary | Time-Dep Volume | TMDPVOL |
| Boundary | Time-Dep Junction | TMDPJUN |

## Key Features

- **Visual Node Editor**: ReactFlow 기반 드래그 앤 드롭 MARS 모델링
- **MARS Input File Generation**: GUI 입력을 .i 파일로 자동 변환
- **Text Code Preview**: 실시간 입력 파일 미리보기 (컴포넌트 단위 / 전체)
- **Global Settings**: Project Setup, Trips, Control Variables, Thermal Properties
- **Nodalization Editor**: 노드 크기/색상/도형/회전 커스터마이징
- **Simulation Control**: 시뮬레이션 시작/정지/일시정지/배속 제어
- **Live Monitoring**: 실시간 로그 뷰어 + MinorEdit 차트
- **Interactive Control**: ICV 조회/설정, 알람 패널
- **Analysis**: Plotfl 파일 로드, 변수 탐색기, 시계열 차트

## Proto Generation (Connect-RPC)

```bash
# Windows
pnpm proto:generate

# Unix/macOS
pnpm proto:generate:unix
```