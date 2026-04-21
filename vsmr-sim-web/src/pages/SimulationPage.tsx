/**
 * Simulation Page
 * 시뮬레이션 실행 및 모니터링 페이지
 * Layout: coSimSession 기반 단일/멀티 모델 모니터링 + Analysis
 */


import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Assessment as AssessmentIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
  ControlPoint as ControlPointIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import AppLayout from '@/components/common/AppLayout';
import LiveLogViewer from '@/components/simulation/LiveLogViewer';
import DynamicChartGrid from '@/components/simulation/DynamicChartGrid';
import QuickRunButton from '@/components/simulation/QuickRunButton';
import SimulationControlBar from '@/components/simulation/SimulationControlBar';
import { GlobalSettingsDialog } from '@/components/GlobalSettingsDialog';
import { useStore } from '@/stores/useStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSimulationStore, useActiveModel, hasSimulationData, useCoSimSession, useActiveModelId, useRuntimeMinorEdits } from '@/stores/simulationStore';
import { useStartSimulation, useStartCoSimulation, useLiveData, useCoSimLiveData } from '@/hooks/useSimulationData';
import { connectTaskStreamService } from '@/services/sse';
import {
  pauseSim,
  resumeSim,
  stopSim,
  setSimSpeed,
} from '@/services/sm/simulationControlService';
import { SimulationStatus } from '@/stubs/sm/simulation_control_pb';
import type { SimStatus } from '@/types/simulation';
import ModelTabBar from '@/components/simulation/ModelTabBar';
import CoSimStatusBanner from '@/components/cosim/CoSimStatusBanner';
import { useCoSimValidation } from '@/hooks/useCoSimValidation';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import { generatePreciceConfigXml } from '@/utils/preciceXmlGenerator';
import { generatePreciceMarsNml } from '@/utils/preciceMarsNmlGenerator';
import { generateCouplingIds, getParticipantName, getMeshName, validateCoSimConfig } from '@/types/cosim';
import { ProjectService } from '@/services/projectService';
// listSimulationHistoriesByProject moved to TaskListPanel
import { storageService } from '@/services/storage/storageService';
import { MARSInputFileGenerator } from '@/utils/fileGenerator';
import { parsePlotfl } from '@/utils/plotflParser';
import { validateGlobalSettings } from '@/utils/globalSettingsValidation';
import type { SidebarItem } from '@/components/common/Sidebar';
import type { Node } from 'reactflow';
import type { MinorEdit } from '@/types/mars';
import InteractiveControlView from '@/components/interactive/InteractiveControlView';
import type { SimulationEvent } from '@/components/interactive/InteractiveControlView';
import PlotFileDropZone from '@/components/analysis/PlotFileDropZone';
import VariableExplorer from '@/components/analysis/VariableExplorer';
import ChartPanelGrid from '@/components/analysis/ChartPanelGrid';
import PowerSummaryCard from '@/components/analysis/PowerSummaryCard';
import TaskListPanel from '@/components/analysis/TaskListPanel';
import InputValidationResultDialog from '@/components/simulation/InputValidationResultDialog';
import { validateInputContent, type InputValidationIssue } from '@/services/inputd/inputdService';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useDemoMode } from '@/hooks/useDemoMode';
import type { SimulationEntry } from '@/types/supabase';
import toast from 'react-hot-toast';

/** SimulationControl task status(string) -> SimStatus 매핑 */
function simTaskStateToSimStatus(status: string): SimStatus {
  switch ((status || '').toUpperCase()) {
    case 'RUNNING': return 'running';
    case 'PAUSED': return 'paused';
    case 'COMPLETED': return 'completed';
    case 'STOPPED': return 'stopped';
    case 'FAILED': case 'ERROR': return 'failed';
    case 'CREATED':
    case 'READY':
    case 'BUILDING':
      return 'building';
    default:
      return 'running';
  }
}

/** SimulationControl SimulationStatus(enum) -> SimStatus 매핑 */
function simStatusEnumToSimStatus(status: SimulationStatus): SimStatus {
  switch (status) {
    case SimulationStatus.RUNNING:
      return 'running';
    case SimulationStatus.PAUSED:
      return 'paused';
    case SimulationStatus.COMPLETED:
      return 'completed';
    case SimulationStatus.STOPPED:
      return 'stopped';
    case SimulationStatus.BUILDING:
    case SimulationStatus.READY:
    default:
      return 'building';
  }
}

const resizeHandleStyle: React.CSSProperties = {
  height: '4px',
  backgroundColor: '#e0e0e0',
  cursor: 'row-resize',
  transition: 'background-color 0.2s',
};

interface SimulationResultFile {
  fileName: string;
  objectKey: string;
}

const SIMULATION_INPUT_STORAGE_PREFIX = 'simulation-run:last-input';
const RESULT_FILE_NAME = 'plotfl';

function parseTaskIndexFromTaskId(taskId?: string | null): number | null {
  const normalized = (taskId || '').trim();
  if (!normalized) {
    return null;
  }

  const lastHyphen = normalized.lastIndexOf('-');
  if (lastHyphen <= 0 || lastHyphen === normalized.length - 1) {
    return null;
  }

  const suffix = normalized.slice(lastHyphen + 1);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }

  const parsed = Number.parseInt(suffix, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Co-Sim All 탭: 모델별 차트 + 로그 섹션
 * hooks를 모델별로 호출하기 위해 별도 컴포넌트로 분리
 */
const CoSimModelSection: React.FC<{
  modelId: string;
  modelName: string;
  taskId: string;
  nodes: Node[];
  fallbackMinorEdits?: MinorEdit[];
  demoActive?: boolean;
  demoMinorEdits?: MinorEdit[];
  onOpenGlobalSettings: () => void;
}> = ({ modelId, modelName, taskId, nodes, fallbackMinorEdits, demoActive, demoMinorEdits, onOpenGlobalSettings }) => {
  const runtimeMinorEdits = useRuntimeMinorEdits(modelId);
  const effectiveMinorEdits = demoActive ? demoMinorEdits : (runtimeMinorEdits ?? fallbackMinorEdits);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography
        variant="subtitle2"
        sx={{
          px: 2,
          py: 0.75,
          bgcolor: 'action.hover',
          fontWeight: 600,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {modelName}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 300, overflow: 'hidden' }}>
        <DynamicChartGrid
          taskId={taskId}
          nodes={nodes}
          modelId={modelId}
          minorEdits={effectiveMinorEdits}
          onOpenGlobalSettings={onOpenGlobalSettings}
        />
      </Box>
      <Box sx={{ height: 200, overflow: 'hidden', borderTop: '1px solid', borderColor: 'divider' }}>
        <LiveLogViewer
          taskId={taskId}
          modelId={modelId}
          minorEdits={effectiveMinorEdits}
        />
      </Box>
    </Box>
  );
};

const SimulationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL에서 projectId, modelId 가져오기 (Supabase UUID)
  const projectId = searchParams.get('projectId');
  const modelId = searchParams.get('modelId');
  const requestedView = searchParams.get('view');
  const requestedSimulationId = searchParams.get('simulationId');

  // Co-Sim 검증
  const { isCoSimMode, validation: coSimValidation, canExecute: coSimCanExecute } = useCoSimValidation();

  // Store state
  const { nodes, edges, metadata, loadProject, swapModelNodes, setUserId } = useStore();

  // Supabase Project Store
  const { currentProject, fetchProject, loading: projectLoading } = useProjectStore();
  const { updateModelByTaskId, clearAllModelData, setActiveModel, setCoSimStatus } = useSimulationStore();
  const runtimeMinorEdits = useRuntimeMinorEdits();
  const activeModel = useActiveModel();
  const coSimSession = useCoSimSession();
  const coSimSessionSimId = coSimSession?.simId ?? null;
  const activeModelId = useActiveModelId();
  const [, setIsControlTransitioning] = useState(false);
  const { sidebarExpanded, toggleSidebar } = useStore();

  // 시뮬레이션 활성 상태 판단 (coSimSession.status 단일 소스)
  const effectiveSessionStatus = coSimSession?.status ?? null;
  const isSimulationActive =
    effectiveSessionStatus === 'running' ||
    effectiveSessionStatus === 'paused';

  // BFF 스트림 연결 (탭 전환과 무관하게 SimulationPage 레벨에서 유지)
  const modelCount = coSimSession ? Object.keys(coSimSession.models).length : 0;
  const firstModel = coSimSession ? Object.values(coSimSession.models)[0] : null;

  // 단일 모델: useLiveData
  useLiveData(modelCount === 1 ? (firstModel?.taskId ?? null) : null, {
    enabled: modelCount === 1 && isSimulationActive,
  });

  // 다중 모델: useCoSimLiveData
  useCoSimLiveData(modelCount > 1 && isSimulationActive ? coSimSession : null, {
    enabled: modelCount > 1 && isSimulationActive,
  });

  // simulation 단위 상태 스트림: SubscribeSimulationState
  useEffect(() => {
    if (!coSimSessionSimId || !isSimulationActive) {
      return;
    }

    let stopStream: (() => void) | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        stopStream = await connectTaskStreamService.startSimulationStateStream(coSimSessionSimId, {
          onSimulationState: (state) => {
            const sessionStatus = simStatusEnumToSimStatus(state.status);
            setCoSimStatus(sessionStatus);

            const taskStates = state.tasks ?? [];
            if (taskStates.length > 0) {
              for (const taskInfo of taskStates) {
                const mapped = simTaskStateToSimStatus(taskInfo.status);
                const currentSession = useSimulationStore.getState().coSimSession;
                const currentModel = currentSession
                  ? Object.values(currentSession.models).find((m) => m.taskId === taskInfo.taskId)
                  : null;

                updateModelByTaskId(taskInfo.taskId, {
                  status: mapped,
                  ...(mapped === 'completed' || mapped === 'stopped'
                    ? { endTime: currentModel?.endTime ?? Date.now() }
                    : {}),
                });
              }
              return;
            }

            // task 세부 상태가 없는 경우에는 세션 상태를 모델 전체에 반영
            const currentSession = useSimulationStore.getState().coSimSession;
            const sessionModels = currentSession ? Object.values(currentSession.models) : [];
            for (const model of sessionModels) {
              updateModelByTaskId(model.taskId, {
                status: sessionStatus,
                ...(sessionStatus === 'completed' || sessionStatus === 'stopped'
                  ? { endTime: model.endTime ?? Date.now() }
                  : {}),
              });
            }
          },
          onError: (error) => {
            console.error('[SimulationPage] SubscribeSimulationState error:', error);
          },
        });
      } catch (error) {
        console.error('[SimulationPage] Failed to start SubscribeSimulationState:', error);
      }

      if (cancelled && stopStream) {
        stopStream();
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (stopStream) {
        stopStream();
      }
    };
  }, [coSimSessionSimId, isSimulationActive, setCoSimStatus, updateModelByTaskId]);

  // 브라우저 닫기/새로고침 방지 (beforeunload)
  useEffect(() => {
    if (!isSimulationActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '시뮬레이션이 실행 중입니다. 페이지를 떠나면 진행 상황을 복원할 수 없습니다.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSimulationActive]);

  // Simulation events for Event Log
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const pushSimEvent = useCallback((action: string) => {
    setSimulationEvents((prev) => [...prev, { action }]);
  }, []);

  const isProjectReadyForAnalysis = useMemo(() => {
    if (!projectId) return false;
    if (projectId === '_quickrun') return true;
    if (projectLoading) return false;
    return currentProject?.id === projectId;
  }, [currentProject?.id, projectId, projectLoading]);

  // Demo mode — 프로젝트에 2+ 모델이 있으면 Co-Sim 데모
  const [demoActive, setDemoActive] = useState(false);
  const demoModels = useMemo(() => {
    const models = currentProject?.data?.models;
    if (!models || models.length <= 1) return undefined;
    return models.map((m) => ({ modelId: m.id, modelName: m.name }));
  }, [currentProject]);
  const { startDemo, stopDemo, effectiveEdits: demoMinorEdits } = useDemoMode(metadata.globalSettings?.minorEdits, demoModels);

  // UI state
  const [activeView, setActiveView] = useState<'simulation' | 'results' | 'interactive' | 'analysis'>('simulation');
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [pendingAnalysisTaskId, setPendingAnalysisTaskId] = useState<string | null>(null);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  const [minioDownloadMenuAnchor, setMinioDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  const [resultFiles, setResultFiles] = useState<SimulationResultFile[]>([]);
  const [isResultFilesLoading, setIsResultFilesLoading] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startTitle, setStartTitle] = useState('');
  const [startDescription, setStartDescription] = useState('');
  const [inputValidationDialogOpen, setInputValidationDialogOpen] = useState(false);
  const [inputValidationTargetLabel, setInputValidationTargetLabel] = useState('');
  const [inputValidationIssues, setInputValidationIssues] = useState<InputValidationIssue[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const startDialogStorageKey = currentProject?.user_id
    ? `${SIMULATION_INPUT_STORAGE_PREFIX}:${currentProject.user_id}`
    : null;

  // Mutations
  const startSimulation = useStartSimulation();
  const startCoSimulation = useStartCoSimulation();
  const isStartingSimulation = startSimulation.isPending || startCoSimulation.isPending;

  useEffect(() => {
    if (requestedView === 'history' || requestedView === 'analysis') {
      setActiveView('analysis');
    }
  }, [requestedView]);

  useEffect(() => {
    if (!startDialogStorageKey) {
      return;
    }

    try {
      const raw = localStorage.getItem(startDialogStorageKey);
      if (!raw) {
        setStartTitle('');
        setStartDescription('');
        return;
      }

      const parsed = JSON.parse(raw) as { title?: string; description?: string };
      setStartTitle(parsed.title ?? '');
      setStartDescription(parsed.description ?? '');
    } catch (error) {
      console.warn('[SimulationPage] Failed to load saved simulation input:', error);
    }
  }, [startDialogStorageKey]);

  useEffect(() => {
    if (!startDialogStorageKey) {
      return;
    }

    try {
      localStorage.setItem(
        startDialogStorageKey,
        JSON.stringify({ title: startTitle, description: startDescription })
      );
    } catch (error) {
      console.warn('[SimulationPage] Failed to save simulation input:', error);
    }
  }, [startDialogStorageKey, startTitle, startDescription]);

  const openStartSimulationDialog = useCallback(() => {
    setStartDialogOpen(true);
  }, []);

  // 이전에 로드된 projectId 추적 (동일 프로젝트 재로드 감지용)
  const prevProjectIdRef = useRef<string | null>(null);

  // Supabase 프로젝트 로드
  const doLoadProject = useCallback(async () => {
    if (!projectId) {
      toast.error('프로젝트 ID가 없습니다. 에디터에서 다시 시도해주세요.');
      navigate('/home');
      return;
    }

    try {
      const project = await fetchProject(projectId);

      if (project) {
        const projectData = project.data;

        // model 기반 구조 지원: modelId가 있거나 models[]가 존재하면 model에서 데이터 읽기
        const model = modelId
          ? projectData?.models?.find((m: { id: string }) => m.id === modelId)
          : projectData?.models?.[0]; // modelId 없으면 첫 번째 모델 사용

        // nodes/edges: model 우선, 레거시 fallback
        const resolvedNodes = model?.nodes ?? projectData?.nodes ?? [];
        const resolvedEdges = model?.edges ?? projectData?.edges ?? [];

        // RESTART 판정: metadata.taskMode primary
        const isRestart = projectData?.metadata?.taskMode === 'restart';

        // metadata 필드: model.settings 또는 top-level metadata에서 읽기
        const settingsSource = model?.settings ?? projectData?.metadata ?? {};

        loadProject({
          nodes: resolvedNodes,
          edges: resolvedEdges,
          metadata: {
            projectName: project.name,
            version: model?.updateHistory?.[0]?.version ?? projectData?.metadata?.version ?? '1.0.0',
            created: project.created_at,
            modified: project.updated_at,
            simulationType: settingsSource?.simulationType || 'transnt',
            maxTime: settingsSource?.maxTime || 100.0,
            minDt: settingsSource?.minDt || 1.0e-6,
            maxDt: settingsSource?.maxDt || 0.1,
            unitSystem: settingsSource?.unitSystem || 'si',
            workingFluid: settingsSource?.workingFluid || 'h2o',
            globalSettings: model?.settings ?? projectData?.globalSettings,
            restartSettings: isRestart ? model?.restartSettings : undefined,
            taskMode: isRestart ? 'restart' : 'new',
            category: project.category,
          },
        });

        // Co-Sim 설정 로드 (프로젝트 데이터에서)
        useCoSimConfigStore.getState().loadConfig(projectData?.coSimConfig ?? null);

        // userId 설정 (Supabase Auth에서 가져옴)
        setUserId(project.user_id);
        prevProjectIdRef.current = projectId;
      }
    } catch (error) {
      console.error('[SimulationPage] Failed to load project:', error);
      toast.error('프로젝트를 불러오는데 실패했습니다');
    }
  }, [projectId, modelId, fetchProject, loadProject, setUserId, navigate]);

  useEffect(() => {
    if (!projectId) {
      doLoadProject();
      return;
    }

    // 동일 프로젝트 재로드 + 시뮬레이션 데이터 존재 시 확인 팝업
    const isSameProject = prevProjectIdRef.current === projectId;
    if (isSameProject && hasSimulationData()) {
      setResetConfirmOpen(true);
      return;
    }

    doLoadProject();
  }, [projectId, doLoadProject]);

  // Co-Sim 탭 전환 시 해당 모델의 nodes/edges를 에디터 스토어에 반영
  useEffect(() => {
    if (!activeModelId || !currentProject?.data?.models) return;
    const model = currentProject.data.models.find((m: { id: string }) => m.id === activeModelId);
    if (!model) return;
    const modelNodes = model.nodes ?? [];
    const modelEdges = model.edges ?? [];
    const settings = model.settings;
    swapModelNodes(
      modelNodes,
      modelEdges,
      settings ? {
        simulationType: settings.simulationType,
        maxTime: settings.maxTime,
        minDt: settings.minDt,
        maxDt: settings.maxDt,
        unitSystem: settings.unitSystem,
        workingFluid: settings.workingFluid,
        globalSettings: settings,
      } : undefined,
    );
  }, [activeModelId, currentProject, swapModelNodes]);

  // 이전 상태 추적
  const prevStatusRef = useRef<string | undefined>();

  // 시뮬레이션 완료 감지 (running -> completed 전환 시에만)
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = coSimSession?.status;

    if (prevStatus === 'running' && currentStatus === 'completed' && coSimSession?.startTime) {
      const duration = Math.floor((Date.now() - coSimSession.startTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      toast.success(
        `시뮬레이션이 완료되었습니다! (소요 시간: ${minutes}분 ${seconds}초)`,
        { duration: 5000 }
      );
    }

    prevStatusRef.current = currentStatus;
  }, [coSimSession?.status, coSimSession?.startTime]);

  // 필수 항목 검증 (시뮬레이션 시작 가능 여부 확인)
  const canStartSimulation = useMemo(() => {
    // 프로젝트 로딩 중이면 시작 불가
    if (projectLoading) {
      return false;
    }
    if (!metadata.globalSettings) {
      return false;
    }
    const validationResult = validateGlobalSettings(metadata.globalSettings);
    const requiredErrors = validationResult.errors.filter(
      (err) => err.card === '100' || err.card === '101' || err.card === '102'
    );
    if (requiredErrors.length > 0) return false;

    // Co-Sim 모드: 설정 완료 여부 확인
    if (!coSimCanExecute) return false;

    return true;
  }, [metadata.globalSettings, projectLoading, coSimCanExecute]);

  const resolveProjectIdForActiveModel = useCallback((): string | null => {
    if (!activeModel) {
      return null;
    }

    // QuickRun은 항상 _quickrun project_id를 사용한다.
    if (coSimSession?.projectId === '_quickrun') {
      return coSimSession.projectId;
    }

    const args = activeModel.args || '';
    const parts = args.split(',').map((value) => value.trim());
    const runPathRaw = parts[1] || parts[0] || '';
    const runPath = runPathRaw.startsWith('s3://')
      ? runPathRaw.replace(/^s3:\/\/[^/]+\//, '')
      : runPathRaw;
    const userId = currentProject?.user_id;

    if (userId && runPath.startsWith(`${userId}/`)) {
      const relativePath = runPath.slice(`${userId}/`.length);
      const projectIdFromArgs = relativePath.split('/')[0];
      if (projectIdFromArgs) {
        return projectIdFromArgs;
      }
    }

    const runPathSegments = runPath.split('/').filter(Boolean);
    if (runPathSegments.length >= 2) {
      return runPathSegments[1];
    }

    return projectId || currentProject?.id || coSimSession?.projectId || null;
  }, [activeModel, coSimSession?.projectId, currentProject?.id, currentProject?.user_id, projectId]);

  const loadResultFilesForActiveModel = useCallback(async () => {
    if (!coSimSession || coSimSession.status !== 'completed' || !activeModel) {
      setResultFiles([]);
      return;
    }

    const resolvedProjectId = resolveProjectIdForActiveModel();
    if (!resolvedProjectId) {
      setResultFiles([]);
      return;
    }

    setIsResultFilesLoading(true);
    try {
          const parsedTaskIndex = parseTaskIndexFromTaskId(activeModel.taskId);
          const taskIndexForResultFiles = parsedTaskIndex ?? activeModel.taskIndex ?? 0;
      const files = await ProjectService.listResultFiles(
        resolvedProjectId,
      coSimSession.simId || activeModel.taskId,
      taskIndexForResultFiles,
      activeModel.modelId,
      );
      setResultFiles(
        files.map((file) => ({
          fileName: file.fileName,
          objectKey: file.objectKey,
        }))
      );
    } catch (error) {
      console.error('[SimulationPage] Failed to load result files:', error);
      setResultFiles([]);
      toast.error('결과 파일 목록을 불러오지 못했습니다');
    } finally {
      setIsResultFilesLoading(false);
    }
  }, [coSimSession, activeModel, resolveProjectIdForActiveModel]);

  const handleStartSimulation = async (runMeta: { title: string; description: string }) => {
    if (!currentProject) {
      toast.error('프로젝트 정보가 없습니다');
      return;
    }

    if (!runMeta.title.trim()) {
      toast.error('시뮬레이션 Title을 입력해주세요');
      return;
    }

    const projectName = currentProject.name;
    const targetProjectId = projectId || currentProject.id || projectName;

    const projectData = currentProject.data;

    // RESTART 판정: metadata.taskMode primary
    const taskMode: 'new' | 'restart' =
      (projectData?.metadata?.taskMode === 'restart') ? 'restart' : 'new';
    const restartProjectId =
      (projectData?.metadata?.restartProjectId ?? '').trim();
    const restartSourceTaskId =
      (projectData?.metadata?.restartSourceTaskId ?? '').trim();
    const restartSimulationId =
      (projectData?.metadata?.restartSimulationId ?? '').trim();
    const restartUserId = (currentProject.user_id ?? '').trim();

    const buildRestartRstpltS3Uri = (taskIndex: number): string | undefined => {
      if (taskMode !== 'restart') {
        return undefined;
      }
      if (!restartUserId || !restartProjectId || !restartSimulationId) {
        return undefined;
      }
      return `s3://v-smr/${restartUserId}/${restartProjectId}/simulation/${restartSimulationId}/${taskIndex}/rstplt`;
    };

    if (taskMode !== 'restart' && nodes.length === 0) {
      toast.error('노드가 없습니다. 에디터에서 모델을 먼저 구성하세요');
      return;
    }

    // Global Settings: RESTART면 store의 restartSettings, 아니면 globalSettings
    const globalSettings = taskMode === 'restart'
      ? (metadata.restartSettings ?? metadata.globalSettings)
      : metadata.globalSettings;
    if (!globalSettings) {
      toast.error(
        'Global Settings가 설정되지 않았습니다. Global Settings를 먼저 설정해주세요.',
        { duration: 5000 }
      );
      setShowGlobalSettings(true);
      return;
    }

    // 필수 항목 검증 (Card 100, 101, 102)
    const validationResult = validateGlobalSettings(globalSettings);
    if (!validationResult.valid || validationResult.errors.length > 0) {
      const requiredErrors = validationResult.errors.filter(
        (err) => err.card === '100' || err.card === '101' || err.card === '102'
      );

      if (requiredErrors.length > 0) {
        const missingCards = requiredErrors.map((err) => `Card ${err.card}`).join(', ');
        toast.error(
          `필수 항목이 설정되지 않았습니다: ${missingCards}. Global Settings를 확인해주세요.`,
          { duration: 6000 }
        );
        setShowGlobalSettings(true);
        return;
      }

      // 기타 검증 오류가 있는 경우
      const errorMessages = validationResult.errors.map((err) => err.message).join(', ');
      toast.error(
        `Global Settings 검증 오류: ${errorMessages}`,
        { duration: 6000 }
      );
      setShowGlobalSettings(true);
      return;
    }

    // Note: Mock mode not supported in Connect-RPC

    // Construct simulation arguments
    // Format: bucket,user/project,inputFileName
    // Example: ["v-smr", "user-uuid/project-name", "project_name.i"]
    const inputFileName = `${projectName.trim().replace(/\s+/g, '_')}.i`;

    try {
      const projectModels = projectData?.models ?? [];
      const shouldStartMultiModel = projectModels.length > 1 && !modelId;

      if (shouldStartMultiModel) {
        // Co-Sim 설정 검증 (함수 레벨 — UI disable과 이중 방어)
        const coSimValidationResult = validateCoSimConfig(useCoSimConfigStore.getState().config);
        if (!coSimValidationResult.isComplete) {
          toast.error(
            `Co-Sim 설정 미완료: ${coSimValidationResult.errors[0] ?? '설정을 확인해주세요'}`,
            { duration: 5000 },
          );
          return;
        }

        const sanitizeName = (value: string) => value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
        const multiModelInputs: Array<{
          modelId: string;
          modelName: string;
          inputFileUrl: string;
          taskMode: 'new' | 'restart';
          minorEdits: MinorEdit[];
          preciceMarsNmlUrl?: string;
        }> = [];

          for (let taskIndex = 0; taskIndex < projectModels.length; taskIndex++) {
            const projectModel = projectModels[taskIndex];
          const modelNodes = projectModel.nodes ?? [];
          const modelEdges = projectModel.edges ?? [];
          const modelSettings = taskMode === 'restart'
            ? (projectModel.restartSettings ?? projectModel.settings ?? metadata.globalSettings)
            : (projectModel.settings ?? metadata.globalSettings);

          if (!modelSettings) {
            throw new Error(`모델 ${projectModel.name}의 Global Settings가 없습니다`);
          }

          const perModelValidation = validateGlobalSettings(modelSettings);
          if (!perModelValidation.valid || perModelValidation.errors.length > 0) {
            const requiredErrors = perModelValidation.errors.filter(
              (err) => err.card === '100' || err.card === '101' || err.card === '102'
            );
            if (requiredErrors.length > 0) {
              const missingCards = requiredErrors.map((err) => `Card ${err.card}`).join(', ');
              throw new Error(`모델 ${projectModel.name} 필수 항목 누락: ${missingCards}`);
            }
            const errorMessages = perModelValidation.errors.map((err) => err.message).join(', ');
            throw new Error(`모델 ${projectModel.name} 설정 검증 오류: ${errorMessages}`);
          }

          toast.loading(`입력파일 생성 중... (${projectModel.name})`, { id: 'simulation-start' });
          const generator = new MARSInputFileGenerator(modelNodes as Node[]);
          const generated = generator.generate(modelNodes as Node[], modelEdges as any[], projectModel.name, modelSettings);
          if (!generated.success || !generated.content) {
            const errorMsg = generated.errors?.join(', ') || '알 수 없는 오류';
            throw new Error(`모델 ${projectModel.name} 입력파일 생성 실패: ${errorMsg}`);
          }

          toast.loading(`입력검증 중... (${projectModel.name})`, { id: 'simulation-start' });
          const validation = await validateInputContent(generated.content, {
            rstpltS3Uri: buildRestartRstpltS3Uri(taskIndex),
          });
          if (!validation.success) {
            const issues = validation.messages.length > 0
              ? validation.messages
              : ['inputd validation failed (no details returned)'];
            const modelInputName = `${sanitizeName(projectName)}_${sanitizeName(projectModel.name)}.i`;
            setInputValidationTargetLabel(modelInputName);
            setInputValidationIssues(issues);
            setInputValidationDialogOpen(true);
            toast.error('입력 파일 검증 실패', { id: 'simulation-start' });
            return;
          }

          toast.loading(`입력파일 업로드 중... (${projectModel.name})`, { id: 'simulation-start' });
          const modelInputFileName = `${sanitizeName(projectName)}_${sanitizeName(projectModel.name)}.i`;
          const uploaded = await ProjectService.uploadModelFile(
            targetProjectId,
            projectModel.id,
            modelInputFileName,
            generated.content,
            'text/plain',
          );

          if (taskMode === 'restart') {
            if (!restartProjectId) {
              throw new Error('RESTART 모드에는 Restart Project Id가 필요합니다');
            }

            const userId = currentProject.user_id;
            if (!userId) {
              throw new Error('사용자 정보가 없어 Restart를 시작할 수 없습니다.');
            }

            if (!restartSimulationId) {
              throw new Error('RESTART 모드에는 시뮬레이션 run을 선택해야 합니다');
            }
              const srcRstpltObjectKey = `${userId}/${restartProjectId}/simulation/${restartSimulationId}/${taskIndex}/rstplt`;
            const dstRstpltObjectKey = `${userId}/${targetProjectId}/${projectModel.id}/rstplt`;

            toast.loading(`RESTART 파일 준비 중... (${projectModel.name})`, { id: 'simulation-start' });
            const copyResp = await storageService.copyFile(srcRstpltObjectKey, dstRstpltObjectKey);
            if (!copyResp.success) {
              throw new Error(copyResp.message || `모델 ${projectModel.name} rstplt 복사 실패`);
            }
          }

          const parsedMinorEdits = (modelSettings?.minorEdits ?? []) as MinorEdit[];
          multiModelInputs.push({
            modelId: projectModel.id,
            modelName: projectModel.name,
            inputFileUrl: uploaded.fileUrl,
            taskMode,
            minorEdits: parsedMinorEdits,
          });
        }

        // Co-Sim 설정 파일 생성 및 업로드 (설정 완료 시)
        const coSimConfig = useCoSimConfigStore.getState().config;
        const coSimIds = generateCouplingIds(coSimConfig.nml.componentGroups);
        let sharedConfigUrls: string[] = [];

        if (coSimIds.length > 0 && projectModels.length >= 2) {
          toast.loading('Co-Sim 설정 파일 생성 중...', { id: 'simulation-start' });

          const p1 = getParticipantName(0);
          const p2 = getParticipantName(1);

          // precice-config.xml 생성 및 업로드
          const xmlContent = generatePreciceConfigXml(coSimConfig.nml, coSimConfig.xml, p1, p2);
          const xmlFile = new File([xmlContent], 'precice-config.xml', { type: 'application/xml' });
          const xmlUploaded = await ProjectService.uploadProjectFileFromFile(targetProjectId, xmlFile);
          if (xmlUploaded.fileUrl) sharedConfigUrls.push(xmlUploaded.fileUrl);

          // precice_mars.nml 생성 및 업로드 (모델별)
          for (let mi = 0; mi < Math.min(projectModels.length, 2); mi++) {
            const modelCfg = mi === 0 ? coSimConfig.nml.model1 : coSimConfig.nml.model2;
            const pName = getParticipantName(mi);
            const nmlContent = generatePreciceMarsNml(pName, getMeshName(mi), modelCfg, coSimIds);
            const nmlUploaded = await ProjectService.uploadModelFile(
              targetProjectId, projectModels[mi].id, 'precice_mars.nml', nmlContent, 'text/plain'
            );
            // NML URL은 모델별 input과 함께 전달됨
            if (multiModelInputs[mi]) {
              multiModelInputs[mi].preciceMarsNmlUrl = nmlUploaded.fileUrl;
            }
          }
        }

        toast.loading('시뮬레이션 시작 중...', { id: 'simulation-start' });
        await startCoSimulation.mutateAsync({
          projectId: targetProjectId,
          title: runMeta.title.trim(),
          description: runMeta.description.trim(),
          models: multiModelInputs,
          ...(sharedConfigUrls.length > 0 ? { sharedConfigs: sharedConfigUrls } : {}),
        });

        toast.success('멀티 모델 시뮬레이션이 시작되었습니다', { id: 'simulation-start' });
        pushSimEvent('Started');
        setStartDialogOpen(false);
        return;
      }

      // Step 1: 입력파일(.i) 생성
      toast.loading('입력파일 생성 중...', { id: 'simulation-start' });
      const generator = new MARSInputFileGenerator(nodes);
      const result = generator.generate(nodes, edges, projectName, globalSettings);

      if (!result.success || !result.content) {
        const errorMsg = result.errors?.join(', ') || '알 수 없는 오류';
        toast.error(`입력파일 생성 실패: ${errorMsg}`, { id: 'simulation-start' });
        return;
      }

      console.log('[SimulationPage] Input file generated:', inputFileName, 'size:', result.content.length);

      // Step 2: inputd RPC로 입력 파일 검증
      toast.loading('업로드전에 입력검증', { id: 'simulation-start' });
      const validationResult = await validateInputContent(result.content, {
        rstpltS3Uri: buildRestartRstpltS3Uri(0),
      });
      if (!validationResult.success) {
        const issues = validationResult.messages.length > 0
          ? validationResult.messages
          : ['inputd validation failed (no details returned)'];
        setInputValidationTargetLabel(inputFileName);
        setInputValidationIssues(issues);
        setInputValidationDialogOpen(true);
        toast.error('입력 파일 검증 실패', { id: 'simulation-start' });
        return;
      }
      toast.success('입력 파일 검증 성공', { id: 'simulation-start' });

      // Step 3: MinIO에 입력파일 업로드
      toast.loading('입력파일 업로드 중...', { id: 'simulation-start' });
      const singleModelId = modelId || projectModels[0]?.id || '';
      if (!singleModelId) {
        throw new Error('모델 ID를 찾을 수 없어 입력 파일 업로드 경로를 결정할 수 없습니다');
      }

      const uploadedInputFile = await ProjectService.uploadModelFile(
        targetProjectId,
        singleModelId,
        inputFileName,
        result.content,
        'text/plain',
      );
      const uploadedObjectKey = uploadedInputFile.objectKey;
      console.log('[SimulationPage] uploadedObjectKey (raw from BFF):', uploadedObjectKey);
      const inputFileUrl = uploadedInputFile.fileUrl;
      console.log('[SimulationPage] inputFileUrl (s3:// 변환 후):', inputFileUrl);

      if (taskMode === 'restart') {
        if (!restartProjectId) {
          throw new Error('RESTART 모드에는 Restart Project Id가 필요합니다');
        }

        const userId = currentProject.user_id;
        if (!userId) {
          throw new Error('사용자 정보가 없어 Restart를 시작할 수 없습니다.');
        }

        if (!restartSimulationId) {
          throw new Error('RESTART 모드에는 시뮬레이션 run을 선택해야 합니다');
        }
        const srcRstpltObjectKey = `${userId}/${restartProjectId}/simulation/${restartSimulationId}/0/rstplt`;
        const dstRstpltObjectKey = `${userId}/${targetProjectId}/${singleModelId}/rstplt`;

        toast.loading('RESTART 파일 준비 중...', { id: 'simulation-start' });
        const copyResp = await storageService.copyFile(srcRstpltObjectKey, dstRstpltObjectKey);
        if (!copyResp.success) {
          throw new Error(copyResp.message || 'rstplt 복사에 실패했습니다');
        }

        console.log('[SimulationPage] Restart rstplt copied:', {
          srcRstpltObjectKey,
          dstRstpltObjectKey,
        });
      }

      // Step 4: 시뮬레이션 시작
      toast.loading('시뮬레이션 시작 중...', { id: 'simulation-start' });
      const args = `${taskMode},${inputFileUrl}`;
      await startSimulation.mutateAsync({
        args,
        projectId: targetProjectId,
        title: runMeta.title.trim(),
        description: runMeta.description.trim(),
        taskMode,
        restartSourceTaskId: taskMode === 'restart' && restartSourceTaskId ? restartSourceTaskId : undefined,
        minorEdits: globalSettings?.minorEdits ?? [],
      });

      toast.success('시뮬레이션이 시작되었습니다', { id: 'simulation-start' });
      pushSimEvent('Started');
      setStartDialogOpen(false);
    } catch (error) {
      console.error('[SimulationPage] Simulation start failed:', error);
      toast.error('시뮬레이션 시작 실패', { id: 'simulation-start' });
    }
  };

  const handleStopSimulation = async () => {
    if (!coSimSession || (effectiveSessionStatus !== 'running' && effectiveSessionStatus !== 'paused' && effectiveSessionStatus !== 'completed')) {
      toast.error('중지할 실행 중 작업이 없습니다');
      return;
    }

    const controlSimId = coSimSession.simId;
    setIsControlTransitioning(true);
    try {
      console.log('[SimulationPage] Stop requested:', { sessionStatus: coSimSession.status });
      toast.loading('시뮬레이션 중지 요청 중...', { id: 'simulation-stop' });

      const reply = await stopSim(controlSimId);
      if (!reply.accepted) {
        toast.error('시뮬레이션 중지 실패', { id: 'simulation-stop' });
        return;
      }

      const tasks = reply.state?.tasks ?? [];
      if (tasks.length > 0) {
        for (const taskInfo of tasks) {
          const mapped = simTaskStateToSimStatus(taskInfo.status);
          updateModelByTaskId(taskInfo.taskId, {
            status: mapped,
            ...(mapped === 'stopped' || mapped === 'completed' ? { endTime: Date.now() } : {}),
          });
        }
      } else {
        for (const m of Object.values(coSimSession.models)) {
          updateModelByTaskId(m.taskId, { status: 'stopped', endTime: Date.now() });
        }
      }

      setCoSimStatus('stopped');

      toast.success('시뮬레이션 중지됨', { id: 'simulation-stop' });
      pushSimEvent('Stopped');
    } catch (error) {
      console.error('[SimulationPage] Simulation stop failed:', error);
      toast.error('시뮬레이션 중지 실패', { id: 'simulation-stop' });
    } finally {
      setIsControlTransitioning(false);
    }
  };

  const handlePauseTask = async () => {
    if (!coSimSession || effectiveSessionStatus !== 'running') {
      toast.error('일시중지할 실행 중 작업이 없습니다');
      return;
    }

    const controlSimId = coSimSession.simId;
    setIsControlTransitioning(true);
    try {
      toast.loading('일시중지 요청 중...', { id: 'simulation-pause' });

      const reply = await pauseSim(controlSimId);
      if (!reply.accepted) {
        toast.error('일시중지 실패', { id: 'simulation-pause' });
        return;
      }

      const tasks = reply.state?.tasks ?? [];
      if (tasks.length > 0) {
        for (const taskInfo of tasks) {
          updateModelByTaskId(taskInfo.taskId, { status: simTaskStateToSimStatus(taskInfo.status) });
        }
      } else {
        for (const m of Object.values(coSimSession.models)) {
          updateModelByTaskId(m.taskId, { status: 'paused' });
        }
      }

      setCoSimStatus('paused');

      toast.success('일시중지됨', { id: 'simulation-pause' });
      pushSimEvent('Paused');
    } catch (error) {
      console.error('[SimulationPage] Pause failed:', error);
      toast.error('일시중지 실패', { id: 'simulation-pause' });
    } finally {
      setIsControlTransitioning(false);
    }
  };

  const handleResumeTask = async () => {
    if (!coSimSession || effectiveSessionStatus !== 'paused') {
      toast.error('재개할 일시중지 작업이 없습니다');
      return;
    }

    const controlSimId = coSimSession.simId;
    setIsControlTransitioning(true);
    try {
      toast.loading('재개 요청 중...', { id: 'simulation-resume' });

      const reply = await resumeSim(controlSimId);
      if (!reply.accepted) {
        toast.error('재개 실패', { id: 'simulation-resume' });
        return;
      }

      const tasks = reply.state?.tasks ?? [];
      if (tasks.length > 0) {
        for (const taskInfo of tasks) {
          updateModelByTaskId(taskInfo.taskId, { status: simTaskStateToSimStatus(taskInfo.status) });
        }
      } else {
        for (const m of Object.values(coSimSession.models)) {
          updateModelByTaskId(m.taskId, { status: 'running' });
        }
      }

      setCoSimStatus('running');

      toast.success('재개됨', { id: 'simulation-resume' });
      pushSimEvent('Resumed');
    } catch (error) {
      console.error('[SimulationPage] Resume failed:', error);
      toast.error('재개 실패', { id: 'simulation-resume' });
    } finally {
      setIsControlTransitioning(false);
    }
  };

  const handleRefresh = () => {
    clearAllModelData();
    toast.success('데이터가 초기화되었습니다');
  };

  const handleSpeedChange = async (ratio: number) => {
    if (!coSimSession) {
      toast.error('속도를 변경할 활성 작업이 없습니다');
      return;
    }

    const controlSimId = coSimSession.simId;
    try {
      await setSimSpeed(controlSimId, ratio);
      const label = ratio === 0 ? 'Max' : `${ratio}x`;
      toast.success(`Speed 변경: ${label}`);
    } catch (error) {
      toast.error('Speed 변경 실패');
    }
  };

  const handleDownloadLogs = () => {
    if (!activeModel) return;

    const content = (activeModel.screenLogs ?? []).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-log-${activeModel.taskId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('로그 파일이 다운로드되었습니다');
  };

  const handleDownloadResults = () => {
    if (!activeModel) return;

    const plotData = activeModel.plotData ?? [];
    
    // CSV 형식으로 변환
    let csvContent = 'time';
    const firstPoint = plotData[0];
    if (firstPoint) {
      Object.keys(firstPoint).forEach(key => {
        if (key !== 'time') {
          csvContent += `,${key}`;
        }
      });
    }
    csvContent += '\n';
    
    plotData.forEach(point => {
      csvContent += point.time;
      Object.keys(point).forEach(key => {
        if (key !== 'time') {
          csvContent += `,${point[key]}`;
        }
      });
      csvContent += '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-results-${activeModel.taskId}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('결과 파일이 다운로드되었습니다');
  };

  const handleDownloadSimulationArtifact = async (file: SimulationResultFile) => {
    try {
      await ProjectService.downloadObjectToBrowser(file.objectKey, file.fileName);
      toast.success(`${file.fileName} 파일 다운로드를 시작했습니다`);
    } catch (error) {
      console.error(`[SimulationPage] ${file.fileName} download failed:`, error);
      toast.error(`${file.fileName} 다운로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpenResultFileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMinioDownloadMenuAnchor(event.currentTarget);
    void loadResultFilesForActiveModel();
  };

  const handleToggleDemo = () => {
    if (demoActive) {
      stopDemo();
      setDemoActive(false);
      toast.success('데모 모드가 종료되었습니다');
    } else {
      // 실행 중인 시뮬레이션이 있으면 데모 시작 불가
      if (isSimulationActive) {
        toast.error('시뮬레이션이 실행 중일 때는 데모 모드를 사용할 수 없습니다');
        return;
      }
      startDemo();
      setDemoActive(true);
      toast.success('데모 모드가 시작되었습니다 (더미 데이터 생성 중)');
    }
  };

  // 시뮬레이션 실행 중 SPA 내부 네비게이션 차단 (useBlocker)
  const blocker = useBlocker(() => isSimulationActive);

  const handleConfirmLeave = () => {
    if (blocker.state !== 'blocked') return;
    // 서버 시뮬레이션 중지 (fire-and-forget — 사용자가 이미 이탈을 선택함)
    if (coSimSession?.simId) {
      void stopSim(coSimSession.simId).catch(() => {});
    }
    blocker.proceed();
  };

  const handleCancelLeave = () => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleBackToEditor = () => {
    const editorUrl = modelId
      ? `/editor?projectId=${projectId}&modelId=${modelId}`
      : `/editor?projectId=${projectId}`;
    navigate(editorUrl);
  };

  const handleLogout = () => {
    const { resetUser } = useStore.getState();
    resetUser();
    navigate('/login');
  };

  const handleBackToDashboard = () => {
    const category = currentProject?.category || 'nuclear';
    navigate(`/dashboard/${category}`);
  };

  // Sidebar items
  const simulationSidebarItems: SidebarItem[] = [
    {
      id: 'simulation',
      label: 'Simulation Monitoring',
      icon: <AssessmentIcon />,
      type: 'action',
      onClick: () => setActiveView('simulation'),
      selected: activeView === 'simulation',
    },
    {
      id: 'interaction control',
      label: 'Interaction Control',
      icon: <ControlPointIcon />,
      type: 'action',
      onClick: () => setActiveView('interactive'),
      selected: activeView === 'interactive',
    },
{
      id: 'analysis',
      label: 'Simulation Analysis',
      icon: <TimelineIcon />,
      type: 'action',
      onClick: () => setActiveView('analysis'),
      selected: activeView === 'analysis',
    },
    {
      id: 'divider-1',
      label: '',
      icon: <></>,
      type: 'divider',
    },
    {
      id: 'editor',
      label: 'Editor',
      icon: <EditIcon />,
      type: 'action',
      onClick: handleBackToEditor,
    },
    {
      id: 'project',
      label: 'Project Home',
      icon: <ProjectIcon />,
      type: 'action',
      onClick: () => projectId ? navigate(`/projects/${projectId}`) : navigate('/projects'),
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      type: 'action',
      onClick: handleBackToDashboard,
    },
  ];

  // Co-Sim 모델 탭 데이터 (contentHeader용)
  const coSimModelTabs = useMemo(() => {
    if (!coSimSession || Object.keys(coSimSession.models).length <= 1) return null;
    return Object.values(coSimSession.models).map((m) => ({
      modelId: m.modelId,
      modelName: m.modelName,
      status: m.status,
    }));
  }, [coSimSession]);

  // Simulation header
  const simulationHeader = (
    <>
    {isCoSimMode && !coSimValidation.isComplete && (
      <CoSimStatusBanner
        validation={coSimValidation}
        onNavigateToSettings={() => {
          const pid = searchParams.get('projectId');
          if (pid) navigate(`/editor?projectId=${pid}&view=cosim`);
        }}
      />
    )}
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: coSimModelTabs ? 'none' : '1px solid #e0e0e0',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {metadata.projectName || 'Simulation Monitor'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip
          title={
            !canStartSimulation
              ? 'Global Settings의 필수 항목(Card 100, 101, 102)을 먼저 설정해주세요'
              : isSimulationActive
              ? '시뮬레이션이 이미 실행 중입니다'
              : '시뮬레이션 시작'
          }
        >
          <span>
            <IconButton
              color="primary"
              onClick={openStartSimulationDialog}
              disabled={
                isStartingSimulation ||
                isSimulationActive ||
                !canStartSimulation
              }
            >
              <PlayIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* 퀵 시뮬레이션 버튼 */}
        {currentProject && (
          <QuickRunButton
            userId={currentProject.user_id}
            disabled={isSimulationActive}
          />
        )}

        <Tooltip title="데이터 초기화">
          <span>
            <IconButton onClick={handleRefresh} disabled={demoActive}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* 데모 모드 토글 */}
        <Tooltip title={demoActive ? '데모 모드 종료' : '데모 모드 (더미 데이터 실시간 가시화)'}>
          <IconButton
            onClick={handleToggleDemo}
            sx={{
              color: demoActive ? 'warning.main' : 'inherit',
              animation: demoActive ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          >
            <ScienceIcon />
          </IconButton>
        </Tooltip>

        {/* Analysis에서 결과 보기 */}
        {coSimSession?.status === 'completed' && activeView !== 'analysis' && (
          <Tooltip title="Analysis에서 결과 보기">
            <IconButton
              color="primary"
              onClick={() => {
                setPendingAnalysisTaskId(activeModel?.taskId ?? null);
                setActiveView('analysis');
              }}
            >
              <AssessmentIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* 로컬 다운로드 (로그 txt + 결과 csv) */}
        {(coSimSession?.status === 'completed' || coSimSession?.status === 'stopped') && (
          <>
            <Tooltip title="로그/결과 다운로드">
              <IconButton color="primary" onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}>
                <CloudDownloadIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={downloadMenuAnchor}
              open={Boolean(downloadMenuAnchor)}
              onClose={() => setDownloadMenuAnchor(null)}
            >
              <MenuItem onClick={() => { handleDownloadLogs(); setDownloadMenuAnchor(null); }}>
                <ListItemIcon><CloudDownloadIcon fontSize="small" /></ListItemIcon>
                <ListItemText>로그 다운로드 (.txt)</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { handleDownloadResults(); setDownloadMenuAnchor(null); }}>
                <ListItemIcon><CloudDownloadIcon fontSize="small" /></ListItemIcon>
                <ListItemText>플롯 데이터 다운로드 (.csv)</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}

        {/* MinIO 시뮬레이션 결과파일 다운로드 */}
        {currentProject && coSimSession?.status === 'completed' && (
          <>
            <Tooltip title="시뮬레이션 결과 파일 다운로드">
              <IconButton color="secondary" onClick={handleOpenResultFileMenu}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={minioDownloadMenuAnchor}
              open={Boolean(minioDownloadMenuAnchor)}
              onClose={() => setMinioDownloadMenuAnchor(null)}
            >
              {isResultFilesLoading && (
                <MenuItem disabled>
                  <ListItemText>결과 파일 목록 로딩 중...</ListItemText>
                </MenuItem>
              )}
              {!isResultFilesLoading && resultFiles.length === 0 && (
                <MenuItem disabled>
                  <ListItemText>다운로드 가능한 결과 파일이 없습니다</ListItemText>
                </MenuItem>
              )}
              {!isResultFilesLoading && resultFiles.map((file) => (
                <MenuItem
                  key={file.objectKey}
                  onClick={() => {
                    void handleDownloadSimulationArtifact(file);
                    setMinioDownloadMenuAnchor(null);
                  }}
                >
                  <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>{file.fileName}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <Button variant="outlined" onClick={handleBackToEditor} sx={{ ml: 1 }}>
          에디터로 돌아가기
        </Button>
      </Box>
    </Box>
    {coSimModelTabs && (
      <ModelTabBar
        models={coSimModelTabs}
        activeModelId={activeModelId}
        onSelectModel={setActiveModel}
      />
    )}
    </>
  );

  return (
    <AppLayout
      sidebarExpanded={sidebarExpanded}
      onSidebarToggle={toggleSidebar}
      sidebarItems={simulationSidebarItems}
      activeSidebarItemId={simulationSidebarItems.find((item) => item.selected)?.id}
      onLogout={handleLogout}
      onAccountSettings={() => navigate('/settings')}
      showUserProfile={true}
      showCollapseButton={true}
      contentHeader={simulationHeader}
      contentFooter={
        activeView !== 'analysis' ? (
          <SimulationControlBar
            activeModel={activeModel}
            sessionStatus={coSimSession?.status ?? null}
            onPause={handlePauseTask}
            onResume={handleResumeTask}
            onStop={handleStopSimulation}
            onSpeedChange={handleSpeedChange}
          />
        ) : undefined
      }
    >
      {/* Main Content */}
      {/* InteractiveControlView: 항상 마운트 (데이터 수집 훅 유지), visible로 UI 렌더링 제어 */}
      <InteractiveControlView
        minorEdits={demoActive ? demoMinorEdits : (runtimeMinorEdits ?? metadata.globalSettings?.minorEdits)}
        visible={activeView === 'interactive'}
        simulationEvents={simulationEvents}
        simulationStatusOverride={coSimSession?.status ?? null}
      />
      {activeView === 'analysis' ? (
        <AnalysisView
          projectId={projectId}
          pendingTaskId={pendingAnalysisTaskId}
          requestedSimulationId={requestedSimulationId}
          projectReady={isProjectReadyForAnalysis}
          analysisModels={(currentProject?.data?.models || []).map((m) => ({ id: m.id, name: m.name }))}
          onTaskLoaded={() => setPendingAnalysisTaskId(null)}
        />
      ) : activeView !== 'interactive' ? (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* Main Content Area: Charts + Logs */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Co-Sim All 탭: 모델별 차트/로그 섹션 */}
            {coSimSession && !activeModelId ? (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {Object.values(coSimSession.models).map((model) => (
                  <CoSimModelSection
                    key={model.modelId}
                    modelId={model.modelId}
                    modelName={model.modelName}
                    taskId={model.taskId}
                    nodes={nodes}
                    fallbackMinorEdits={metadata.globalSettings?.minorEdits}
                    demoActive={demoActive}
                    demoMinorEdits={demoMinorEdits}
                    onOpenGlobalSettings={() => setShowGlobalSettings(true)}
                  />
                ))}
              </Box>
            ) : activeModel ? (
              <PanelGroup direction="vertical" autoSaveId="simulation-layout">
                {/* Charts Area */}
                <Panel defaultSize={60} minSize={30}>
                  <DynamicChartGrid
                    taskId={activeModel.taskId}
                    nodes={nodes}
                    minorEdits={demoActive ? demoMinorEdits : (runtimeMinorEdits ?? metadata.globalSettings?.minorEdits)}
                    onOpenGlobalSettings={() => setShowGlobalSettings(true)}
                  />
                </Panel>

                <PanelResizeHandle style={resizeHandleStyle} />

                {/* Logs Area */}
                <Panel defaultSize={40} minSize={20}>
                  <LiveLogViewer
                    taskId={activeModel.taskId}
                    minorEdits={runtimeMinorEdits ?? metadata.globalSettings?.minorEdits}
                  />
                </Panel>
              </PanelGroup>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                }}
              >
                <AssessmentIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  시뮬레이션이 실행되지 않았습니다
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', maxWidth: 400 }}>
                  상단의 재생 버튼을 클릭하여 시뮬레이션을 시작하세요
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={openStartSimulationDialog}
                  disabled={isStartingSimulation || !canStartSimulation}
                  title={!canStartSimulation ? 'Global Settings의 필수 항목을 먼저 설정해주세요' : ''}
                >
                  시뮬레이션 시작
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      ) : null}

      {/* Global Settings Dialog */}

      <GlobalSettingsDialog
        open={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
      />

      <Dialog
        open={startDialogOpen}
        onClose={(_, reason) => {
          // 에러 직후 backdrop/escape로 의도치 않게 닫히는 것을 방지한다.
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            return;
          }
          if (!isStartingSimulation) {
            setStartDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>시뮬레이션 시작</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={startTitle}
              onChange={(event) => setStartTitle(event.target.value)}
              required
              fullWidth
              size="small"
              disabled={isStartingSimulation}
              error={startTitle.trim().length === 0}
              helperText={startTitle.trim().length === 0 ? 'Title은 필수 입력입니다' : ''}
            />
            <TextField
              label="Description"
              value={startDescription}
              onChange={(event) => setStartDescription(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              disabled={isStartingSimulation}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStartDialogOpen(false)}
            disabled={isStartingSimulation}
          >
            취소
          </Button>
          <Button
            variant="contained"
            onClick={() => handleStartSimulation({ title: startTitle, description: startDescription })}
            disabled={isStartingSimulation || startTitle.trim().length === 0}
          >
            {isStartingSimulation ? '시작 중...' : '해석 시작'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 시뮬레이션 실행 중 페이지 이탈 확인 다이얼로그 */}
      <Dialog open={blocker.state === 'blocked'} onClose={handleCancelLeave}>
        <DialogTitle>시뮬레이션 실행 중</DialogTitle>
        <DialogContent>
          <Typography>
            시뮬레이션이 실행 중입니다. 페이지를 떠나면 시뮬레이션이 중지되며 진행 상황을 복원할 수 없습니다.
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
            계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLeave}>머물기</Button>
          <Button variant="contained" color="warning" onClick={handleConfirmLeave}>
            중지 후 이동
          </Button>
        </DialogActions>
      </Dialog>

      {/* 동일 프로젝트 재로드 시 시뮬레이션 데이터 초기화 확인 */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
      >
        <DialogTitle>시뮬레이션 데이터 초기화</DialogTitle>
        <DialogContent>
          <Typography>
            현재 시뮬레이션 결과가 존재합니다. 프로젝트를 다시 로드하면 모든 시뮬레이션 결과(차트, 로그, 작업 목록)가 초기화됩니다.
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
            계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmOpen(false)}>
            취소
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setResetConfirmOpen(false);
              doLoadProject();
            }}
          >
            초기화 후 로드
          </Button>
        </DialogActions>
      </Dialog>

      <InputValidationResultDialog
        open={inputValidationDialogOpen}
        title="입력 파일 검증 결과"
        targetLabel={inputValidationTargetLabel}
        issues={inputValidationIssues}
        onClose={() => setInputValidationDialogOpen(false)}
      />
    </AppLayout>
  );
};

/**
 * AnalysisView - Simulation Analysis 탭 내부 뷰
 * plotfl 파일 로드 → 변수 탐색 → 시계열 차트
 * 우측 TaskListPanel에서 과거 해석 결과 선택 또는 로컬 파일 업로드
 */
function AnalysisView({
  projectId,
  pendingTaskId,
  requestedSimulationId,
  projectReady,
  analysisModels,
  onTaskLoaded,
}: {
  projectId: string | null;
  pendingTaskId?: string | null;
  requestedSimulationId?: string | null;
  projectReady?: boolean;
  analysisModels?: Array<{ id: string; name: string }>;
  onTaskLoaded?: () => void;
}) {
  const parsedFile = useAnalysisStore((s) => s.parsedFile);
  const fileName = useAnalysisStore((s) => s.fileName);
  const loadFile = useAnalysisStore((s) => s.loadFile);
  const clearFile = useAnalysisStore((s) => s.clearFile);
  const addComparedFile = useAnalysisStore((s) => s.addComparedFile);
  const removeComparedFile = useAnalysisStore((s) => s.removeComparedFile);
  const comparedFiles = useAnalysisStore((s) => s.comparedFiles);
  const loadModelResults = useAnalysisStore((s) => s.loadModelResults);
  const modelResults = useAnalysisStore((s) => s.modelResults);

  const coSimSessionForAnalysis = useCoSimSession();

  const [loadedHistoryMeta, setLoadedHistoryMeta] = useState<{
    title: string;
    duration: string;
    status: SimulationEntry['status'];
    timestamp: string;
  } | null>(null);

  const [taskListCollapsed, setTaskListCollapsed] = useState(false);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [comparingId, setComparingId] = useState<string | null>(null);
  const requestedHistoryLoadRef = useRef<string | null>(null);

  // BFF를 통해 plotfl 결과 파일 다운로드 → analysisStore에 로드
  const downloadAndLoadResult = useCallback(
    async (taskId: string, entryName?: string, entryDuration?: string, entryStatus?: SimulationEntry['status'], entryTimestamp?: string, simId?: string) => {
      if (!projectId) {
        toast.error('프로젝트 정보가 없습니다.');
        return;
      }

      setDownloadingHistoryId(taskId);
      try {
        const taskIndex = parseTaskIndexFromTaskId(taskId) ?? 0;
        const downloaded = await storageService.downloadTaskResultFile(
          projectId,
          simId || taskId,
          taskIndex,
          RESULT_FILE_NAME,
        );

        if (!downloaded.content || downloaded.content.length === 0) {
          toast.error('플롯 결과 파일이 존재하지 않습니다.');
          return;
        }

        const text = new TextDecoder().decode(downloaded.content);
        if (!text.trim()) {
          toast.error('플롯 결과 파일이 존재하지 않습니다.');
          return;
        }

        const parsed = parsePlotfl(text);
        clearFile();
        loadFile(downloaded.fileName || RESULT_FILE_NAME, parsed);
        setActiveResultId(taskId);
        if (entryName) {
          setLoadedHistoryMeta({
            title: entryName,
            duration: entryDuration || '',
            status: entryStatus || 'Success',
            timestamp: entryTimestamp || new Date().toISOString(),
          });
        }
      } catch (error) {
        console.warn('[AnalysisView] Failed to download result file:', error);
        toast.error('플롯 결과 파일을 다운로드하지 못했습니다.');
      } finally {
        setDownloadingHistoryId(null);
      }
    },
    [projectId, loadFile, clearFile]
  );

  // 과거 Co-Sim 이력: analysisModels 기준으로 taskIndex 0..N-1 결과를 일괄 다운로드 → loadModelResults
  // 한 건이라도 받으면 true. 모두 비면 false (호출부가 단일 fallback으로 분기).
  const downloadAndLoadMultiModelResults = useCallback(
    async (
      simulationId: string,
      entryMeta?: { name?: string; duration?: string; status?: SimulationEntry['status']; timestamp?: string },
    ): Promise<boolean> => {
      if (!projectId || projectId === '_quickrun') return false;
      if (!analysisModels || analysisModels.length <= 1) return false;

      setDownloadingHistoryId(simulationId);
      try {
        const results: Record<string, { label: string; parsed: import('@/types/analysis').ParsedPlotFile }> = {};
        for (let taskIndex = 0; taskIndex < analysisModels.length; taskIndex += 1) {
          const model = analysisModels[taskIndex];
          if (!model) continue;
          try {
            const downloaded = await storageService.downloadTaskResultFile(
              projectId,
              simulationId,
              taskIndex,
              RESULT_FILE_NAME,
            );
            if (!downloaded.content || downloaded.content.length === 0) continue;
            const text = new TextDecoder().decode(downloaded.content);
            if (!text.trim()) continue;
            results[model.id] = { label: model.name, parsed: parsePlotfl(text) };
          } catch {
            // 일부 모델 결과가 없어도 나머지 로딩은 계속 진행
          }
        }

        if (Object.keys(results).length === 0) return false;

        loadModelResults(results);
        setActiveResultId(simulationId);
        if (entryMeta?.name) {
          setLoadedHistoryMeta({
            title: entryMeta.name,
            duration: entryMeta.duration || '',
            status: entryMeta.status || 'Success',
            timestamp: entryMeta.timestamp || new Date().toISOString(),
          });
        }
        return true;
      } finally {
        setDownloadingHistoryId(null);
      }
    },
    [projectId, analysisModels, loadModelResults],
  );

  // TaskListPanel에서 항목 클릭 시 호출
  const handleLoadResult = useCallback(
    async (entry: SimulationEntry) => {
      if (entry.status === 'Failed') return;
      console.log('[AnalysisView] handleLoadResult entry:', { id: entry.id, name: entry.name, status: entry.status, projectId });
      const simulationId = entry.simId || entry.id;
      if ((analysisModels?.length || 0) > 1 && projectId && projectId !== '_quickrun') {
        const ok = await downloadAndLoadMultiModelResults(simulationId, {
          name: entry.name,
          duration: entry.duration,
          status: entry.status,
          timestamp: entry.timestamp,
        });
        if (ok) return;
      }
      await downloadAndLoadResult(entry.id, entry.name, entry.duration, entry.status, entry.timestamp, entry.simId);
    },
    [downloadAndLoadResult, downloadAndLoadMultiModelResults, analysisModels, projectId]
  );

  // 비교용 결과 다운로드 → analysisStore에 비교 파일 추가
  const handleCompareResult = useCallback(
    async (entry: SimulationEntry) => {
      if (!projectId || entry.status === 'Failed') return;
      setComparingId(entry.id);
      try {
        const taskIndex = parseTaskIndexFromTaskId(entry.id) ?? 0;
        const downloaded = await storageService.downloadTaskResultFile(
          projectId,
          entry.simId || entry.id,
          taskIndex,
          RESULT_FILE_NAME,
        );
        if (!downloaded.content || downloaded.content.length === 0) {
          toast.error('비교 결과 파일이 존재하지 않습니다.');
          return;
        }
        const text = new TextDecoder().decode(downloaded.content);
        if (!text.trim()) {
          toast.error('비교 결과 파일이 존재하지 않습니다.');
          return;
        }
        const parsed = parsePlotfl(text);
        addComparedFile(entry.id, entry.name || 'Unnamed', parsed);
      } catch (error) {
        console.warn('[AnalysisView] Failed to download compare file:', error);
        toast.error('비교 결과를 다운로드하지 못했습니다.');
      } finally {
        setComparingId(null);
      }
    },
    [projectId, addComparedFile]
  );

  // Co-Sim: 모든 모델의 결과를 한번에 다운로드
  const downloadAllModelResults = useCallback(
    async () => {
      if (!projectId || !coSimSessionForAnalysis) return;

      const models = Object.values(coSimSessionForAnalysis.models);
      if (models.length <= 1) return; // 단일 모델은 기존 플로우 사용

      setDownloadingHistoryId('cosim-all');
      try {
        const results: Record<string, { label: string; parsed: import('@/types/analysis').ParsedPlotFile }> = {};
        for (const model of models) {
          try {
            const downloaded = await storageService.downloadTaskResultFile(
              projectId,
              coSimSessionForAnalysis.simId,
              model.taskIndex,
              RESULT_FILE_NAME,
            );
            const text = new TextDecoder().decode(downloaded.content);
            if (text.trim()) {
              results[model.modelId] = {
                label: model.modelName,
                parsed: parsePlotfl(text),
              };
            }
          } catch (err) {
            console.warn(`[AnalysisView] Failed to download result for model ${model.modelName}:`, err);
          }
        }
        if (Object.keys(results).length > 0) {
          loadModelResults(results);
        } else {
          toast.error('모든 모델의 결과 파일을 다운로드하지 못했습니다.');
        }
      } finally {
        setDownloadingHistoryId(null);
      }
    },
    [projectId, coSimSessionForAnalysis, loadModelResults]
  );

  // ProjectHomePage에서 전달된 simulationId로 Analysis 자동 로드
  useEffect(() => {
    if (!projectReady) return;
    if (!projectId || !requestedSimulationId || pendingTaskId) return;
    // 일반 프로젝트는 모델 목록이 준비된 뒤에 로드해야 taskIndex 매핑이 안정적이다.
    if (projectId !== '_quickrun' && (!analysisModels || analysisModels.length === 0)) return;

    const loadKey = `${projectId}:${requestedSimulationId}`;
    if (requestedHistoryLoadRef.current === loadKey) return;

    requestedHistoryLoadRef.current = loadKey;

    const run = async () => {
      let loaded = false;
      try {
        // 비-quickrun + 멀티 모델은 taskIndex 0..N-1 모두 시도
        if (projectId !== '_quickrun' && (analysisModels?.length || 0) > 1) {
          const results: Record<string, { label: string; parsed: import('@/types/analysis').ParsedPlotFile }> = {};
          for (let taskIndex = 0; taskIndex < (analysisModels?.length || 0); taskIndex += 1) {
            const model = analysisModels?.[taskIndex];
            if (!model) continue;

            try {
              const downloaded = await storageService.downloadTaskResultFile(
                projectId,
                requestedSimulationId,
                taskIndex,
                RESULT_FILE_NAME,
              );
              if (!downloaded.content || downloaded.content.length === 0) continue;
              const text = new TextDecoder().decode(downloaded.content);
              if (!text.trim()) continue;

              results[model.id] = {
                label: model.name,
                parsed: parsePlotfl(text),
              };
            } catch {
              // 일부 모델 결과가 없어도 나머지 로딩은 계속 진행
            }
          }

          if (Object.keys(results).length > 0) {
            loadModelResults(results);
            setActiveResultId(requestedSimulationId);
            loaded = true;
            return;
          }
        }

        // 단일 모델 또는 quickrun fallback
        const downloaded = await storageService.downloadTaskResultFile(
          projectId,
          requestedSimulationId,
          0,
          RESULT_FILE_NAME,
        );
        if (!downloaded.content || downloaded.content.length === 0) {
          toast.error('플롯 결과 파일이 존재하지 않습니다.');
          return;
        }

        const text = new TextDecoder().decode(downloaded.content);
        if (!text.trim()) {
          toast.error('플롯 결과 파일이 존재하지 않습니다.');
          return;
        }

        clearFile();
        loadFile(downloaded.fileName || RESULT_FILE_NAME, parsePlotfl(text));
        setActiveResultId(requestedSimulationId);
        loaded = true;
      } catch (error) {
        console.warn('[AnalysisView] Failed to auto-load requested simulation history:', error);
      } finally {
        // 실패한 경우에는 동일 simulationId라도 다시 시도할 수 있게 잠금을 해제한다.
        if (!loaded) {
          requestedHistoryLoadRef.current = null;
        }
      }
    };

    void run();
  }, [analysisModels, clearFile, loadFile, loadModelResults, pendingTaskId, projectId, projectReady, requestedSimulationId]);

  // Monitoring 탭에서 완료 후 전환 시 자동 로드
  useEffect(() => {
    if (!pendingTaskId || !projectId) return;

    const models = coSimSessionForAnalysis ? Object.values(coSimSessionForAnalysis.models) : [];
    if (models.length > 1) {
      // Co-Sim: 모든 모델 결과 다운로드
      void downloadAllModelResults().then(() => {
        onTaskLoaded?.();
      });
    } else {
      // 단일 모델: 기존 동작
      void downloadAndLoadResult(pendingTaskId).then(() => {
        onTaskLoaded?.();
      });
    }
  }, [pendingTaskId, projectId, coSimSessionForAnalysis, downloadAndLoadResult, downloadAllModelResults, onTaskLoaded]);

  // 로컬 파일 업로드 다이얼로그
  const uploadDialog = (
    <Dialog
      open={uploadDialogOpen}
      onClose={() => setUploadDialogOpen(false)}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>로컬 plotfl 파일 업로드</DialogTitle>
      <DialogContent dividers sx={{ height: '50vh', display: 'flex' }}>
        <PlotFileDropZone
          onLoaded={() => {
            setLoadedHistoryMeta(null);
            setActiveResultId(null);
            setUploadDialogOpen(false);
          }}
          fillHeight
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setUploadDialogOpen(false)}>닫기</Button>
      </DialogActions>
    </Dialog>
  );

  // 분석할 결과가 없는 초기 상태 (parsedFile: 단일 파일, modelResults: Co-Sim)
  if (!parsedFile && !modelResults) {
    return (
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* 중앙: 안내 메시지 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            해석 결과를 선택하세요
          </Typography>
          <Typography variant="body2" color="text.secondary">
            우측 해석 목록에서 결과를 선택하거나, 로컬 plotfl 파일을 업로드하세요.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setUploadDialogOpen(true)}
          >
            로컬 파일 업로드
          </Button>
        </Box>

        {/* 우측: Task List (초기 상태에서도 표시) */}
        <TaskListPanel
          projectId={projectId}
          collapsed={taskListCollapsed}
          onToggleCollapse={() => setTaskListCollapsed((p) => !p)}
          onLoadResult={handleLoadResult}
          onOpenLocalFile={() => setUploadDialogOpen(true)}
          loadingId={downloadingHistoryId}
          activeResultId={activeResultId}
          onCompareResult={handleCompareResult}
          onRemoveCompare={removeComparedFile}
          comparedIds={comparedFiles.map((f) => f.id)}
          comparingId={comparingId}
        />

        {uploadDialog}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 상단 헤더: 로드된 파일 정보 */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {fileName ? `Loaded: ${fileName}` : 'Result loaded'}
          </Typography>
          {loadedHistoryMeta && (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {`${loadedHistoryMeta.title}  |  ${new Date(loadedHistoryMeta.timestamp).toLocaleString('ko-KR')}  |  ${loadedHistoryMeta.duration}  |  ${loadedHistoryMeta.status.toUpperCase()}`}
            </Typography>
          )}
        </Box>
      </Box>

      {uploadDialog}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 좌측: 변수 탐색기 */}
        <Box
          sx={{
            width: 280,
            minWidth: 280,
            borderRight: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <VariableExplorer />
        </Box>

        {/* 중앙: Summary + 차트 패널 + 타임슬라이더 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
            <PowerSummaryCard />
          </Box>

          <Box sx={{ flex: 1, p: 1.5, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            <ChartPanelGrid />
          </Box>

        </Box>

        {/* 우측: Task List 패널 */}
        <TaskListPanel
          projectId={projectId}
          collapsed={taskListCollapsed}
          onToggleCollapse={() => setTaskListCollapsed((p) => !p)}
          onLoadResult={handleLoadResult}
          onOpenLocalFile={() => setUploadDialogOpen(true)}
          loadingId={downloadingHistoryId}
          activeResultId={activeResultId}
          onCompareResult={handleCompareResult}
          onRemoveCompare={removeComparedFile}
          comparedIds={comparedFiles.map((f) => f.id)}
          comparingId={comparingId}
        />
      </Box>
    </Box>
  );
}

export default SimulationPage;
