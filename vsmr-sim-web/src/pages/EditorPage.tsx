/**
 * Editor Page
 * MARS 에디터 페이지 - URL 파라미터에서 프로젝트/모델 정보를 읽어서 로드
 * Supabase DB 연동 + 모델 단위 편집 지원 (MAIN-001, MDH-001)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, Chip, CircularProgress } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useStore } from '@/stores/useStore';
import { useProjectStore } from '@/stores/projectStore';
import { MARSInputFileGenerator, downloadFile } from '@/utils/fileGenerator';
import {
  validateProject,
  projectToReactFlow,
  downloadProjectData,
  readProjectJsonFile,
  checkVsmrCompatibility,
} from '@/utils/projectFileHelpers';
import ComponentPalette from '@/components/ComponentPalette';
import FlowCanvas from '@/components/FlowCanvas';
import PropertyPanel from '@/components/PropertyPanel';
import FullCodeView from '@/components/panels/FullCodeView';
import GlobalSettingsDialog from '@/components/GlobalSettingsDialog';
import AppLayout from '@/components/common/AppLayout';
import EditorHeader from '@/components/editor/EditorHeader';
import type { SidebarItem } from '@/components/common/Sidebar';
import { formatDisplayId } from '@/utils/nodeAppearance';
import type { MARSNodeData } from '@/types/mars';
import type { ProjectData, Model } from '@/types/supabase';
import {
  Edit as EditIcon,
  Settings as SettingsIcon,
  Assessment as AnalysisIcon,
  Dashboard as DashboardIcon,
  Tune as TuneIcon,
  Link as LinkIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import InteractiveInputsDialog from '@/components/dialogs/InteractiveInputsDialog';
import { useModelTabs } from '@/hooks/useModelTabs';
import ModelTabBar from '@/components/simulation/ModelTabBar';
import CoSimPanel from '@/components/cosim/CoSimPanel';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import { validateCoSimConfig } from '@/types/cosim';

// Resize handle style
const resizeHandleStyle: React.CSSProperties = {
  width: '4px',
  backgroundColor: '#e0e0e0',
  cursor: 'col-resize',
  transition: 'background-color 0.2s',
};

const EditorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Zustand: 렌더링에 필요한 상태만 개별 selector로 구독 ──
  const selectedNodeId = useStore(s => s.selectedNodeId);
  const fullCodeViewOpen = useStore(s => s.fullCodeViewOpen);
  const sidebarExpanded = useStore(s => s.sidebarExpanded);
  const globalSettingsDialogOpen = useStore(s => s.globalSettingsDialogOpen);
  const globalSettingsDialogInitialTab = useStore(s => s.globalSettingsDialogInitialTab);
  const hasEdges = useStore(s => s.edges.length > 0);
  const nodes = useStore(s => s.nodes); // searchResults useMemo에 필요
  const metadataProjectName = useStore(s => s.metadata.projectName);

  // ── Zustand: 액션 (참조 불변) ──
  const loadProject = useStore(s => s.loadProject);
  const setUserId = useStore(s => s.setUserId);
  const setIsDirty = useStore(s => s.setIsDirty);
  const toggleSidebar = useStore(s => s.toggleSidebar);
  const closeGlobalSettingsDialog = useStore(s => s.closeGlobalSettingsDialog);

  // Supabase Project Store
  const { currentProject, fetchProject, updateProject, loading: projectLoading, saving: projectSaving, error: projectError, clearError } = useProjectStore();

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
    action?: 'retry' | null;  // 재시도 버튼 표시 여부
  }>({
    open: false,
    message: '',
    severity: 'success',
    action: null,
  });
  const [savingAll, setSavingAll] = useState(false);
  const [showHelp, setShowHelp] = useState(() => localStorage.getItem('hideEdgeHelp') !== 'true');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: 'load' | 'new' | null }>({
    open: false,
    action: null,
  });
  const [importDialog, setImportDialog] = useState<{
    open: boolean;
    jsonModels: Model[];
    projectData: ProjectData;
    projectName: string;
  } | null>(null);
  const [importApplying, setImportApplying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewSaveConfirmOpen, setPreviewSaveConfirmOpen] = useState(false);
  const [interactiveInputsOpen, setInteractiveInputsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'canvas' | 'settings' | 'cosim'>('canvas');
  const coSimComplete = useCoSimConfigStore((s) => validateCoSimConfig(s.config).isComplete);

  // === Code ↔ Canvas 연동 ===
  const [codeFocusNodeId, setCodeFocusNodeId] = useState<string | null>(null);

  // === Canvas Node Search ===
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return nodes
      .filter((node) => {
        const data = node.data as MARSNodeData;
        if (!data?.componentId || !data?.componentType) return false;
        const displayId = formatDisplayId(data.componentId, data.componentType).toLowerCase();
        const name = (data.componentName || '').toLowerCase();
        return displayId.includes(q) || name.includes(q);
      })
      .map((node) => node.id);
  }, [searchQuery, nodes]);

  // 검색 결과 변경 시 인덱스 리셋
  useEffect(() => {
    setSearchActiveIndex(0);
  }, [searchResults.length, searchQuery]);

  // 노드 선택 시 Co-Sim 패널에서 PropertyPanel로 전환
  useEffect(() => {
    if (selectedNodeId && activeView === 'cosim') {
      setActiveView('canvas');
    }
  }, [selectedNodeId, activeView]);

  const focusNodeId = searchResults.length > 0 ? searchResults[searchActiveIndex] : null;

  const handleSearchNext = useCallback(() => {
    if (searchResults.length === 0) return;
    setSearchActiveIndex((prev) => (prev + 1) % searchResults.length);
  }, [searchResults.length]);

  const handleSearchPrev = useCallback(() => {
    if (searchResults.length === 0) return;
    setSearchActiveIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
  }, [searchResults.length]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSearchActiveIndex(0);
  }, []);

  // 모델 탭 전환
  const { models: projectModels, activeModelId: tabActiveModelId, switchModel, showTabs } = useModelTabs();

  // 코드 블록 클릭 → 캔버스 노드 포커스
  const handleCodeBlockClick = useCallback((nodeId: string) => {
    setCodeFocusNodeId(nodeId);
    // 포커스 후 리셋하여 같은 노드 재클릭 허용
    setTimeout(() => setCodeFocusNodeId(null), 500);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL 파라미터에서 프로젝트/모델 정보 읽기 (Supabase UUID)
  const projectId = searchParams.get('projectId');
  const modelId = searchParams.get('modelId');

  // 현재 모델 정보
  const { setCurrentModel, currentModel } = useProjectStore();
  const [currentModelName, setCurrentModelName] = useState<string | null>(null);

  // 프로젝트/모델 데이터를 FlowCanvas 스토어에 로드하는 헬퍼
  const loadModelIntoEditor = useCallback((project: NonNullable<typeof currentProject>, model: typeof currentModel) => {
    if (!model) return;
    const projectData = project.data;
    const isRestart = projectData?.metadata?.taskMode === 'restart';

    setCurrentModel(model);
    setCurrentModelName(model.name);

    loadProject({
      nodes: model.nodes || [],
      edges: model.edges || [],
      metadata: {
        projectName: `${project.name} - ${model.name}`,
        version: model.updateHistory?.[0]?.version || '1.0.0',
        created: model.created_at,
        modified: model.updated_at,
        simulationType: model.settings?.simulationType || 'transnt',
        maxTime: model.settings?.maxTime || 100.0,
        minDt: model.settings?.minDt || 1.0e-6,
        maxDt: model.settings?.maxDt || 0.1,
        unitSystem: model.settings?.unitSystem || 'si',
        workingFluid: model.settings?.workingFluid || 'h2o',
        globalSettings: model.settings,
        restartSettings: isRestart ? model.restartSettings : undefined,
        taskMode: isRestart ? 'restart' : 'new',
        category: project.category,
      },
      svgLibrary: model.svgLibrary,
      defaultSvgByType: model.defaultSvgByType,
    });
  }, [loadProject, setCurrentModel]);

  // Supabase 프로젝트/모델 로드
  useEffect(() => {
    const loadProjectFromSupabase = async () => {
      if (!projectId) {
        navigate('/projects');
        return;
      }

      // 같은 프로젝트 내 모델 전환: 이미 로드된 데이터에서 직접 로드 (리마운트 방지)
      if (currentProject && currentProject.id === projectId && modelId) {
        const model = currentProject.data?.models?.find((m) => m.id === modelId);
        if (model) {
          loadModelIntoEditor(currentProject, model);
          return;
        }
      }

      // Supabase에서 프로젝트 로드 (최초 진입 또는 프로젝트 변경 시)
      setLoading(true);
      try {
        const project = await fetchProject(projectId);

        if (project) {
          const projectData = project.data;

          // Co-Sim 설정 로드
          useCoSimConfigStore.getState().loadConfig(projectData?.coSimConfig ?? null);

          if (modelId && projectData?.models) {
            const model = projectData.models.find((m) => m.id === modelId);
            if (model) {
              loadModelIntoEditor(project, model);

              setSnackbar({
                open: true,
                message: `✅ 모델을 불러왔습니다: ${model.name}`,
                severity: 'success',
              });
            } else {
              navigate(`/projects/${projectId}`);
              return;
            }
          } else {
            const firstModel = projectData?.models?.[0];
            if (firstModel) {
              navigate(`/editor?projectId=${projectId}&modelId=${firstModel.id}`, { replace: true });
              return;
            }

            loadProject({
              nodes: projectData?.nodes || [],
              edges: projectData?.edges || [],
              metadata: {
                projectName: project.name,
                version: projectData?.metadata?.version || '1.0.0',
                created: project.created_at,
                modified: project.updated_at,
                simulationType: projectData?.metadata?.simulationType || 'transnt',
                maxTime: projectData?.metadata?.maxTime || 100.0,
                minDt: projectData?.metadata?.minDt || 1.0e-6,
                maxDt: projectData?.metadata?.maxDt || 0.1,
                unitSystem: projectData?.metadata?.unitSystem || 'si',
                workingFluid: projectData?.metadata?.workingFluid || 'h2o',
                globalSettings: projectData?.globalSettings,
                category: project.category,
              },
            });

            setSnackbar({
              open: true,
              message: `✅ 프로젝트를 불러왔습니다: ${project.name}`,
              severity: 'success',
            });
          }

          setUserId(project.user_id);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        setSnackbar({
          open: true,
          message: `❌ 프로젝트 불러오기 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProjectFromSupabase();
  }, [projectId, modelId, fetchProject, loadProject, loadModelIntoEditor, setUserId, navigate, setCurrentModel, currentProject]);

  // Supabase에 저장 (모델 단위 지원)
  const { updateModel } = useProjectStore();

  const handleSave = async () => {
    if (!projectId) {
      setSnackbar({
        open: true,
        message: '프로젝트 정보가 없습니다.',
        severity: 'error',
      });
      return;
    }

    // 저장 시점의 최신 상태를 읽음 (구독 불필요)
    const { nodes: curNodes, edges: curEdges, metadata: curMeta, svgLibrary: curSvgLibrary, defaultSvgByType: curDefaultSvgByType } = useStore.getState();

    try {
      let success = false;

      if (modelId) {
        // 모델 단위 저장: globalSettings(전체)를 settings에, restartSettings는 별도
        success = await updateModel(projectId, modelId, {
          nodes: curNodes,
          edges: curEdges,
          settings: {
            ...curMeta.globalSettings,
            simulationType: curMeta.simulationType,
            maxTime: curMeta.maxTime,
            minDt: curMeta.minDt,
            maxDt: curMeta.maxDt,
            unitSystem: curMeta.unitSystem,
            workingFluid: curMeta.workingFluid,
          },
          restartSettings: curMeta.restartSettings ?? undefined,
          svgLibrary: curSvgLibrary.length > 0 ? curSvgLibrary : undefined,
          defaultSvgByType: Object.keys(curDefaultSvgByType).length > 0 ? curDefaultSvgByType : undefined,
        });

        if (success) {
          setIsDirty(false);

          // Co-Sim 설정이 변경되었으면 프로젝트 레벨로 저장
          const coSimConfigStore = useCoSimConfigStore.getState();
          if (coSimConfigStore.isDirty) {
            // updateModel 직후 최신 data를 재조회 (React 클로저 stale 방지)
            const latestData = useProjectStore.getState().currentProject?.data;
            await updateProject(projectId, {
              data: {
                ...latestData,
                coSimConfig: coSimConfigStore.config,
              },
            });
            coSimConfigStore.loadConfig(coSimConfigStore.config); // isDirty 리셋
          }

          setSnackbar({
            open: true,
            message: `✅ 모델이 저장되었습니다: ${currentModelName || currentModel?.name}`,
            severity: 'success',
            action: null,
          });
        }
      } else {
        // 레거시 방식 (프로젝트 전체 저장)
        success = await updateProject(projectId, {
          data: {
            nodes: curNodes,
            edges: curEdges,
            globalSettings: curMeta.globalSettings,
            metadata: {
              version: curMeta.version,
              simulationType: curMeta.simulationType,
              maxTime: curMeta.maxTime,
              minDt: curMeta.minDt,
              maxDt: curMeta.maxDt,
              unitSystem: curMeta.unitSystem,
              workingFluid: curMeta.workingFluid,
              lastModified: new Date().toISOString(),
            },
          },
        });

        if (success) {
          setIsDirty(false);
          setSnackbar({
            open: true,
            message: `✅ 프로젝트가 저장되었습니다: ${curMeta.projectName || currentProject?.name}`,
            severity: 'success',
            action: null,
          });
        }
      }

      if (!success) {
        throw new Error(useProjectStore.getState().error || '저장 실패');
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      setSnackbar({
        open: true,
        message: `❌ 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        action: 'retry',
      });
    }
  };

  // 모든 모델 일괄 저장 (현재 탭 + projectStore의 다른 모델들)
  const handleSaveAll = async () => {
    if (!projectId || !currentProject) {
      setSnackbar({ open: true, message: '프로젝트 정보가 없습니다.', severity: 'error' });
      return;
    }

    const allModels = currentProject.data?.models ?? [];
    if (allModels.length === 0) {
      setSnackbar({ open: true, message: '저장할 모델이 없습니다.', severity: 'warning' });
      return;
    }

    const { nodes: curNodes, edges: curEdges, metadata: curMeta, svgLibrary: curSvgLibrary, defaultSvgByType: curDefaultSvgByType } = useStore.getState();

    setSavingAll(true);
    try {
      let successCount = 0;
      const total = allModels.length;

      for (const m of allModels) {
        const isActive = m.id === modelId;
        // 활성 탭은 에디터 스토어 데이터 사용, 비활성 탭은 projectStore의 마지막 저장 상태 재저장
        const ok = await updateModel(projectId, m.id, isActive ? {
          nodes: curNodes,
          edges: curEdges,
          settings: {
            ...curMeta.globalSettings,
            simulationType: curMeta.simulationType,
            maxTime: curMeta.maxTime,
            minDt: curMeta.minDt,
            maxDt: curMeta.maxDt,
            unitSystem: curMeta.unitSystem,
            workingFluid: curMeta.workingFluid,
          },
          restartSettings: curMeta.restartSettings ?? undefined,
          svgLibrary: curSvgLibrary.length > 0 ? curSvgLibrary : undefined,
          defaultSvgByType: Object.keys(curDefaultSvgByType).length > 0 ? curDefaultSvgByType : undefined,
        } : {
          nodes: m.nodes,
          edges: m.edges,
          settings: m.settings,
          restartSettings: m.restartSettings,
          svgLibrary: m.svgLibrary,
          defaultSvgByType: m.defaultSvgByType,
        });
        if (ok) successCount++;
      }

      if (successCount === total) {
        setIsDirty(false);

        // Co-Sim 설정도 저장
        const coSimConfigStore = useCoSimConfigStore.getState();
        if (coSimConfigStore.isDirty) {
          // 반복 updateModel 직후 최신 data를 재조회 (React 클로저 stale 방지)
          const latestData = useProjectStore.getState().currentProject?.data;
          await updateProject(projectId, {
            data: { ...latestData, coSimConfig: coSimConfigStore.config },
          });
          coSimConfigStore.loadConfig(coSimConfigStore.config);
        }

        setSnackbar({ open: true, message: `✅ ${total}개 모델이 모두 저장되었습니다.`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `⚠️ ${successCount}/${total} 모델만 저장되었습니다.`, severity: 'warning' });
      }
    } catch (error) {
      console.error('Failed to save all models:', error);
      setSnackbar({ open: true, message: `❌ 전체 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' });
    } finally {
      setSavingAll(false);
    }
  };

  const handleOpenClick = () => {
    // Check if there are unsaved changes
    const { isDirty, nodes: curNodes, edges: curEdges } = useStore.getState();
    if (isDirty && (curNodes.length > 0 || curEdges.length > 0)) {
      setConfirmDialog({ open: true, action: 'load' });
    } else {
      triggerFileInput();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // JSON 모델 1개를 현재 에디터에 적용하는 공통 헬퍼
  const applySingleModelToEditor = useCallback((model: Model, projectData: ProjectData, projectName: string) => {
    const now = new Date().toISOString();
    const isRestart =
      projectData?.metadata?.taskMode === 'restart' ||
      model.settings?.marsConfig?.problemType === 'RESTART' ||
      model.settings?.marsConfig?.problemType === 'restart';

    loadProject({
      nodes: model.nodes || [],
      edges: model.edges || [],
      metadata: {
        projectName,
        version: '1.0.0',
        created: model.created_at || now,
        modified: model.updated_at || now,
        globalSettings: model.settings,
        restartSettings: isRestart ? model.restartSettings : undefined,
        taskMode: isRestart ? 'restart' : 'new',
        ...(model.settings || {}),
      },
      svgLibrary: model.svgLibrary,
      defaultSvgByType: model.defaultSvgByType,
    });
  }, [loadProject]);

  // ProjectData를 에디터에 적용 (멀티모델 분기 포함)
  const applyProjectData = useCallback((projectData: ProjectData, projectName: string) => {
    const jsonModels = projectData.models ?? [];
    const curProjectModels = currentProject?.data?.models ?? [];

    // 멀티모델: JSON 2개 이상 + 프로젝트 2개 이상 → 다이얼로그
    if (jsonModels.length >= 2 && curProjectModels.length >= 2) {
      setImportDialog({ open: true, jsonModels: jsonModels as Model[], projectData, projectName });
      return;
    }

    // 단일모델 또는 프로젝트 모델 1개: 기존 동작
    if (jsonModels.length > 0) {
      applySingleModelToEditor(jsonModels[0] as Model, projectData, projectName);
    } else if (projectData.nodes && projectData.edges) {
      // 레거시 구조 fallback
      const now = new Date().toISOString();
      loadProject({
        nodes: projectData.nodes,
        edges: projectData.edges,
        metadata: {
          projectName,
          version: '1.0.0',
          created: now,
          modified: now,
          globalSettings: projectData.globalSettings,
          ...(projectData.metadata || {}),
        },
      });
    }

    // Co-Sim 설정 import: store에만 반영, isDirty=true (사용자 명시 저장 필요)
    if (projectData.coSimConfig !== undefined) {
      useCoSimConfigStore.getState().setConfigFromImport(projectData.coSimConfig ?? null);
    }

    setSnackbar({ open: true, message: `✅ 프로젝트를 불러왔습니다: ${projectName}`, severity: 'success' });
  }, [currentProject, applySingleModelToEditor, loadProject]);

  // 멀티모델 일괄 적용
  const handleBulkApply = useCallback(async () => {
    if (!importDialog || !currentProject || !projectId) return;
    const { jsonModels, projectData, projectName } = importDialog;
    const curProjectModels = currentProject.data?.models ?? [];
    const pairs = Math.min(jsonModels.length, curProjectModels.length);
    const isRestart =
      projectData?.metadata?.taskMode === 'restart' ||
      jsonModels[0]?.settings?.marsConfig?.problemType === 'RESTART' ||
      jsonModels[0]?.settings?.marsConfig?.problemType === 'restart';

    setImportApplying(true);
    try {
      for (let i = 0; i < pairs; i++) {
        const src = jsonModels[i];
        const dst = curProjectModels[i];

        // 모든 모델을 DB에 저장 (currentProject 갱신 → useEffect 재실행 시에도 올바른 데이터 유지)
        await updateModel(projectId, dst.id, {
          nodes: src.nodes ?? [],
          edges: src.edges ?? [],
          settings: src.settings,
          restartSettings: isRestart ? src.restartSettings : undefined,
          svgLibrary: src.svgLibrary,
          defaultSvgByType: src.defaultSvgByType,
        });

        // 현재 활성 탭이면 에디터 캔버스에도 로드
        if (dst.id === modelId) {
          applySingleModelToEditor(src, projectData, projectName);
        }
      }

      // 프로젝트 레벨 metadata(taskMode, restartProjectId 등)는 위저드에서 설정된 값을 항상 유지.
      // JSON 로드는 모델 데이터(nodes/edges/settings)만 반영함.

      // Co-Sim 설정 import: store에만 반영, isDirty=true (사용자 명시 저장 필요)
      if (projectData.coSimConfig !== undefined) {
        useCoSimConfigStore.getState().setConfigFromImport(projectData.coSimConfig ?? null);
      }

      setImportDialog(null);
      setSnackbar({ open: true, message: `✅ ${pairs}개 모델에 데이터를 적용했습니다.`, severity: 'success' });
    } catch (error) {
      console.error('Failed to bulk apply models:', error);
      setSnackbar({ open: true, message: `❌ 일괄 적용 실패: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' });
    } finally {
      setImportApplying(false);
    }
  }, [importDialog, currentProject, projectId, modelId, applySingleModelToEditor, updateModel]);

  // 현재 탭만 적용
  const handleCurrentTabApply = useCallback(() => {
    if (!importDialog || !currentProject) return;
    const { jsonModels, projectData, projectName } = importDialog;
    const curProjectModels = currentProject.data?.models ?? [];

    // 현재 modelId의 인덱스를 찾아 같은 인덱스의 JSON 모델 적용
    const currentIndex = curProjectModels.findIndex(m => m.id === modelId);
    const srcModel = jsonModels[currentIndex >= 0 ? currentIndex : 0];

    if (srcModel) {
      applySingleModelToEditor(srcModel, projectData, projectName);
    }

    // Co-Sim 설정 import: store에만 반영, isDirty=true (사용자 명시 저장 필요)
    if (projectData.coSimConfig !== undefined) {
      useCoSimConfigStore.getState().setConfigFromImport(projectData.coSimConfig ?? null);
    }

    setImportDialog(null);
    setSnackbar({ open: true, message: `✅ 현재 모델에 데이터를 적용했습니다.`, severity: 'success' });
  }, [importDialog, currentProject, modelId, applySingleModelToEditor]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await readProjectJsonFile(file);

      if (result.type === 'vsmr' && result.vsmrFile) {
        const compatError = checkVsmrCompatibility(result.vsmrFile._vsmr_meta_);
        if (compatError) {
          setSnackbar({ open: true, message: `❌ ${compatError}`, severity: 'error' });
          return;
        }
        const projectData = result.vsmrFile.data;
        const projectName = currentProject?.name || result.vsmrFile._vsmr_meta_.projectName;
        applyProjectData(projectData, projectName);

      } else if (result.type === 'legacy-mars' && result.marsProject) {
        const project = result.marsProject;
        const validation = validateProject(project);

        if (!validation.valid) {
          setSnackbar({ open: true, message: `❌ 프로젝트 파일 오류:\n${validation.errors.join('\n')}`, severity: 'error' });
          return;
        }
        if (validation.warnings.length > 0) {
          console.warn('Project validation warnings:', validation.warnings);
        }

        const { nodes: projectNodes, edges: projectEdges } = projectToReactFlow(project);
        loadProject({
          nodes: projectNodes,
          edges: projectEdges,
          metadata: {
            ...project.metadata,
            projectName: currentProject?.name || project.metadata.projectName,
          },
        });
        setSnackbar({ open: true, message: `✅ 프로젝트를 불러왔습니다: ${project.metadata.projectName}`, severity: 'success' });

        if (validation.warnings.length > 0) {
          setTimeout(() => {
            setSnackbar({ open: true, message: `⚠️ 경고: ${validation.warnings.join(', ')}`, severity: 'warning' });
          }, 2000);
        }

      } else if (result.type === 'raw-projectdata' && result.rawProjectData) {
        const projectData = result.rawProjectData;
        const projectName = currentProject?.name || file.name.replace(/\.json$/i, '');
        applyProjectData(projectData, projectName);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      setSnackbar({
        open: true,
        message: `❌ 불러오기 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleConfirmDialogClose = (confirmed: boolean) => {
    if (confirmed && confirmDialog.action === 'load') {
      triggerFileInput();
    }
    setConfirmDialog({ open: false, action: null });
  };

  const handleExport = () => {
    const { nodes: curNodes, edges: curEdges, metadata: curMeta } = useStore.getState();
    const generator = new MARSInputFileGenerator();
    // RESTART 모드일 때 restartSettings(오버라이드 카드만) 사용
    const isRestart = curMeta.taskMode === 'restart';
    const settings = (isRestart && curMeta.restartSettings)
      ? curMeta.restartSettings
      : curMeta.globalSettings;
    const result = generator.generate(curNodes, curEdges, curMeta.projectName, settings);

    if (result.content && result.filename) {
      // 파일명: [프로젝트이름]_[파티션이름].i
      const projName = (currentProject?.name || curMeta.projectName || 'Untitled').trim().replace(/\s+/g, '_');
      const modelName = (currentModelName || currentModel?.name || '').trim().replace(/\s+/g, '_');
      const exportFilename = modelName
        ? `${projName}_${modelName}.i`
        : `${projName}.i`;

      downloadFile(result.content, exportFilename);

      if (result.warnings && result.warnings.length > 0) {
        // 경고가 있지만 파일 생성 성공
        setSnackbar({
          open: true,
          message: `⚠️ ${exportFilename} 생성 완료 (경고: ${result.warnings[0]})`,
          severity: 'warning',
        });
      } else {
        setSnackbar({
          open: true,
          message: `✅ ${exportFilename} 파일이 생성되었습니다!`,
          severity: 'success',
        });
      }
    } else {
      const errorMsg = result.errors?.join('\n') || 'Unknown error';
      setSnackbar({
        open: true,
        message: `❌ 오류: ${errorMsg}`,
        severity: 'error',
      });
    }
  };

  const handleExportProjectJson = () => {
    const { nodes: curNodes, edges: curEdges, metadata: curMeta, svgLibrary: curSvgLibrary, defaultSvgByType: curDefaultSvgByType } = useStore.getState();
    const projectName = currentProject?.name || curMeta.projectName || 'VSMR_Project';

    // 현재 에디터 상태에서 ProjectData 구성
    const projectData = currentProject?.data
      ? { ...currentProject.data }
      : {
          totalScope: { systems: ['primary' as const, 'secondary' as const, 'bop' as const], components: [] },
          models: [],
          updateHistory: [],
          simulationHistory: [],
        };

    // 현재 에디터의 nodes/edges/settings를 해당 모델에 반영
    if (modelId && projectData.models) {
      projectData.models = projectData.models.map((m) =>
        m.id === modelId
          ? {
              ...m,
              nodes: curNodes,
              edges: curEdges,
              settings: {
                ...curMeta.globalSettings,
                simulationType: curMeta.simulationType,
                maxTime: curMeta.maxTime,
                minDt: curMeta.minDt,
                maxDt: curMeta.maxDt,
                unitSystem: curMeta.unitSystem,
                workingFluid: curMeta.workingFluid,
              },
              restartSettings: curMeta.restartSettings ?? undefined,
              svgLibrary: curSvgLibrary.length > 0 ? curSvgLibrary : undefined,
              defaultSvgByType: Object.keys(curDefaultSvgByType).length > 0 ? curDefaultSvgByType : undefined,
              updated_at: new Date().toISOString(),
            }
          : m,
      );
    } else {
      // 레거시 방식: nodes/edges를 직접 포함
      projectData.nodes = curNodes;
      projectData.edges = curEdges;
      projectData.globalSettings = curMeta.globalSettings;
      projectData.metadata = {
        version: curMeta.version,
        simulationType: curMeta.simulationType,
        maxTime: curMeta.maxTime,
        minDt: curMeta.minDt,
        maxDt: curMeta.maxDt,
        unitSystem: curMeta.unitSystem,
        workingFluid: curMeta.workingFluid,
        lastModified: new Date().toISOString(),
      };
    }

    downloadProjectData(projectData, projectName);

    setSnackbar({
      open: true,
      message: `✅ ${projectName}.json 파일이 다운로드되었습니다.`,
      severity: 'success',
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleBackToWorkspace = () => {
    const { isDirty, nodes: curNodes, edges: curEdges, metadata: curMeta } = useStore.getState();
    if (isDirty && (curNodes.length > 0 || curEdges.length > 0)) {
      if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
        const category = currentProject?.category || curMeta.category || 'nuclear';
        navigate(`/dashboard/${category}`);
      }
    } else {
      const category = currentProject?.category || curMeta.category || 'nuclear';
      navigate(`/dashboard/${category}`);
    }
  };

  const handleLogout = () => {
    const { resetUser } = useStore.getState();
    resetUser();
    navigate('/login');
  };

  const handleSettingsClick = () => {
    setActiveView('settings');
    setSettingsOpen(true);
  };

  const handleInteractiveInputsClick = () => {
    setInteractiveInputsOpen(true);
  };

  const handleDashboardClick = () => {
    handleBackToWorkspace();
  };

  // Text Code Preview 토글 (isDirty 시 저장 확인)
  const handleToggleFullCodeView = useCallback(() => {
    const store = useStore.getState();
    if (store.fullCodeViewOpen) {
      // 닫기: 바로 닫음
      store.setFullCodeViewOpen(false);
      return;
    }
    // 열기: isDirty 체크
    if (store.propertyFormState.isDirty) {
      setPreviewSaveConfirmOpen(true);
    } else {
      store.setFullCodeViewOpen(true);
    }
  }, []);

  const handlePreviewSaveConfirm = useCallback(() => {
    setPreviewSaveConfirmOpen(false);
    const store = useStore.getState();
    if (store.formSubmitHandler) {
      store.formSubmitHandler();
    }
    setTimeout(() => useStore.getState().setFullCodeViewOpen(true), 100);
  }, []);

  const handleRunSimulation = async () => {
    if (!projectId) {
      setSnackbar({
        open: true,
        message: '프로젝트 정보가 없습니다. 프로젝트를 먼저 저장하세요.',
        severity: 'error',
      });
      return;
    }

    if (useStore.getState().nodes.length === 0) {
      setSnackbar({
        open: true,
        message: '노드가 없습니다. 모델을 먼저 구성하세요.',
        severity: 'warning',
      });
      return;
    }

    // Co-Sim 설정이 변경되었으면 먼저 저장
    const coSimStore = useCoSimConfigStore.getState();
    if (coSimStore.isDirty) {
      await updateProject(projectId, {
        data: {
          ...currentProject?.data,
          coSimConfig: coSimStore.config,
        },
      });
      coSimStore.loadConfig(coSimStore.config);
    }

    // Navigate to simulation page
    // 멀티 모델(Co-Sim)이면 modelId 없이 → shouldStartMultiModel = true
    const simUrl = showTabs
      ? `/simulation?projectId=${projectId}`
      : modelId
        ? `/simulation?projectId=${projectId}&modelId=${modelId}`
        : `/simulation?projectId=${projectId}`;
    navigate(simUrl);
  };

  // Sidebar items for EditorPage
  const editorSidebarItems: SidebarItem[] = [
    {
      id: 'canvas',
      label: 'Editing Canvas',
      icon: <EditIcon />,
      type: 'action',
      onClick: () => setActiveView('canvas'),
      selected: activeView === 'canvas',
    },
    {
      id: 'settings',
      label: 'Global Settings',
      icon: <SettingsIcon />,
      type: 'action',
      onClick: handleSettingsClick,
      selected: activeView === 'settings',
    },
    {
      id: 'controlSettings',
      label: 'Interactive Inputs',
      icon: <TuneIcon />,
      type: 'action',
      onClick: handleInteractiveInputsClick,
    },
    ...(showTabs ? [{
      id: 'cosim',
      label: 'Co-Sim Settings',
      icon: <LinkIcon />,
      type: 'action' as const,
      onClick: () => setActiveView('cosim'),
      selected: activeView === 'cosim',
      badge: !coSimComplete ? '!' : undefined,
    }] : []),
    {
      id: 'divider-1',
      label: '',
      icon: <></>,
      type: 'divider',
    },
    {
      id: 'simulation',
      label: 'Simulation',
      icon: <AnalysisIcon />,
      type: 'action',
      onClick: handleRunSimulation,
    },
    {
      id: 'divider-2',
      label: '',
      icon: <></>,
      type: 'divider',
    },
    {
      id: 'project-home',
      label: 'Project Home',
      icon: <ProjectIcon />,
      type: 'action',
      onClick: () => {
        if (projectId) {
          navigate(`/projects/${projectId}`);
        } else {
          navigate('/projects');
        }
      },
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      type: 'action',
      onClick: handleDashboardClick,
    },
  ];

  // 프로젝트 이름 결정
  const displayProjectName = currentProject?.name || metadataProjectName;

  if (loading || projectLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>프로젝트를 불러오는 중...</Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Hidden file input for opening projects */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mars.json,.json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <AppLayout
        sidebarExpanded={sidebarExpanded}
        onSidebarToggle={toggleSidebar}
        sidebarItems={editorSidebarItems}
        activeSidebarItemId={editorSidebarItems.find((item) => item.selected)?.id}
        onLogout={handleLogout}
        onAccountSettings={() => navigate('/settings')}
        showUserProfile={true}
        showCollapseButton={true}
        contentHeader={
          <>
            <EditorHeader
              projectName={displayProjectName || undefined}
              saving={projectSaving}
              onOpenClick={handleOpenClick}
              onSave={handleSave}
              onSaveAll={handleSaveAll}
              saveAllVisible={(currentProject?.data?.models?.length ?? 0) > 1}
              savingAll={savingAll}
              onExport={handleExport}
              onExportProjectJson={handleExportProjectJson}
              onRunSimulation={handleRunSimulation}
              saveDisabled={!projectId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchResultCount={searchResults.length}
              searchActiveIndex={searchActiveIndex}
              onSearchNext={handleSearchNext}
              onSearchPrev={handleSearchPrev}
              onSearchClear={handleSearchClear}
              fullCodeViewOpen={fullCodeViewOpen}
              onToggleFullCodeView={handleToggleFullCodeView}
            />
            {showTabs && (
              <ModelTabBar
                models={projectModels.map((m) => ({
                  modelId: m.id,
                  modelName: m.name,
                  status: 'ready',
                }))}
                activeModelId={tabActiveModelId}
                onSelectModel={(id) => {
                  handleSave();
                  switchModel(id);
                }}
                showAllTab={false}
              />
            )}
          </>
        }
      >
        {/* Main Content Area */}
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
          {/* Component Palette - Fixed Width */}
          <Box sx={{ width: 220, borderRight: '1px solid #e0e0e0', flexShrink: 0 }}>
            <ComponentPalette />
          </Box>

          {/* Center and Right: FlowCanvas + PropertyPanel or Text Code Preview */}
          <PanelGroup
            direction="horizontal"
            autoSaveId="vsmr-sim-web-layout"
          >
            {/* ReactFlow Canvas - always visible */}
            <Panel defaultSize={(selectedNodeId || fullCodeViewOpen) ? 60 : 100} minSize={30}>
              <FlowCanvas
                searchHighlightNodeIds={codeFocusNodeId ? [codeFocusNodeId] : searchResults}
                searchFocusNodeId={codeFocusNodeId || focusNodeId}
                modelId={modelId}
              />
            </Panel>

            {/* Right panel: Text Code Preview OR PropertyPanel */}
            {fullCodeViewOpen && (
              <>
                <PanelResizeHandle style={resizeHandleStyle} />
                <Panel defaultSize={40} minSize={20} maxSize={70}>
                  <FullCodeView
                    codeHighlightNodeId={selectedNodeId}
                    onCodeBlockClick={handleCodeBlockClick}
                  />
                </Panel>
              </>
            )}

            {!fullCodeViewOpen && activeView !== 'cosim' && selectedNodeId && (
              <>
                <PanelResizeHandle style={resizeHandleStyle} />
                <Panel defaultSize={25} minSize={15} maxSize={50}>
                  <PropertyPanel />
                </Panel>
              </>
            )}

            {activeView === 'cosim' && !fullCodeViewOpen && (
              <>
                <PanelResizeHandle style={resizeHandleStyle} />
                <Panel defaultSize={30} minSize={20} maxSize={50}>
                  <CoSimPanel />
                </Panel>
              </>
            )}
          </PanelGroup>

        {/* Help Tooltip */}
        {showHelp && hasEdges && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(25, 118, 210, 0.95)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 2,
              boxShadow: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <InfoIcon fontSize="small" />
            <Typography variant="body2">
              💡 엣지를 클릭하고 <strong>Delete</strong> 키를 눌러 연결을 제거할 수 있습니다
            </Typography>
            <Button
              size="small"
              onClick={() => { localStorage.setItem('hideEdgeHelp', 'true'); setShowHelp(false); }}
              sx={{
                color: 'white',
                minWidth: 'auto',
                ml: 1,
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              닫기
            </Button>
          </Box>
        )}
      </Box>
      </AppLayout>

      {/* Confirm Dialog for unsaved changes */}
      <Dialog open={confirmDialog.open} onClose={() => handleConfirmDialogClose(false)}>
        <DialogTitle>저장하지 않은 변경사항</DialogTitle>
        <DialogContent>
          <DialogContentText>
            현재 프로젝트에 저장하지 않은 변경사항이 있습니다.
            {confirmDialog.action === 'load' && ' 프로젝트를 불러오면 현재 작업이 사라집니다.'}
            계속하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirmDialogClose(false)}>취소</Button>
          <Button onClick={() => handleConfirmDialogClose(true)} color="primary" autoFocus>
            계속하기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Text Code Preview 저장 확인 다이얼로그 */}
      <Dialog open={previewSaveConfirmOpen} onClose={() => setPreviewSaveConfirmOpen(false)}>
        <DialogTitle>저장되지 않은 변경사항</DialogTitle>
        <DialogContent>
          <DialogContentText>
            저장되지 않은 변경사항이 있습니다. 저장하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewSaveConfirmOpen(false)}>취소</Button>
          <Button onClick={handlePreviewSaveConfirm} variant="contained" autoFocus>
            저장 후 미리보기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Multi-Model Import Dialog */}
      <Dialog
        open={!!importDialog?.open}
        onClose={importApplying ? undefined : () => setImportDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>프로젝트 파일 로드</DialogTitle>
        <DialogContent>
          {importDialog && (() => {
            const curProjectModels = currentProject?.data?.models ?? [];
            const pairs = Math.min(importDialog.jsonModels.length, curProjectModels.length);
            const mismatch = importDialog.jsonModels.length !== curProjectModels.length;

            return (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  JSON 파일에 <strong>{importDialog.jsonModels.length}개</strong> 모델이 포함되어 있습니다.
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>JSON 모델</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>프로젝트 모델</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from({ length: Math.max(importDialog.jsonModels.length, curProjectModels.length) }).map((_, i) => {
                      const jsonModel = importDialog.jsonModels[i];
                      const projModel = curProjectModels[i];
                      const isActive = projModel?.id === modelId;
                      return (
                        <TableRow key={i} sx={isActive ? { bgcolor: 'action.selected' } : undefined}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{jsonModel?.name ?? <Typography variant="caption" color="text.disabled">-</Typography>}</TableCell>
                          <TableCell sx={{ textAlign: 'center', color: 'text.secondary' }}>{jsonModel && projModel ? '→' : ''}</TableCell>
                          <TableCell>
                            {projModel ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {projModel.name}
                                {isActive && <Chip label="활성" size="small" color="primary" sx={{ height: 18, fontSize: '0.7rem' }} />}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.disabled">-</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {mismatch && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1.5, display: 'block' }}>
                    모델 수 불일치 (JSON: {importDialog.jsonModels.length}개, 프로젝트: {curProjectModels.length}개) — {pairs}개만 적용됩니다.
                  </Typography>
                )}
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(null)} disabled={importApplying}>취소</Button>
          <Button onClick={handleCurrentTabApply} disabled={importApplying}>현재 탭만 적용</Button>
          <Button onClick={handleBulkApply} variant="contained" autoFocus disabled={importApplying}
            startIcon={importApplying ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {importApplying ? '적용 중...' : '전체 적용'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Settings Dialog */}
      <GlobalSettingsDialog
        open={settingsOpen || globalSettingsDialogOpen}
        initialTab={globalSettingsDialogOpen ? globalSettingsDialogInitialTab : undefined}
        onClose={() => {
          setSettingsOpen(false);
          closeGlobalSettingsDialog();
          setActiveView('canvas');
        }}
      />

      {/* Interactive Inputs Dialog (Control Settings) */}
      <InteractiveInputsDialog
        open={interactiveInputsOpen}
        onClose={() => setInteractiveInputsOpen(false)}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.action === 'retry' ? null : 4000}  // 재시도 버튼이 있으면 자동으로 닫히지 않음
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ top: '80px !important' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%', alignItems: 'center' }}
          action={
            snackbar.action === 'retry' && (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  handleCloseSnackbar();
                  handleSave();
                }}
                sx={{ fontWeight: 600 }}
              >
                재시도
              </Button>
            )
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Project Error Alert */}
      {projectError && (
        <Snackbar
          open={!!projectError}
          autoHideDuration={5000}
          onClose={clearError}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={clearError} severity="error" sx={{ width: '100%' }}>
            {projectError}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default EditorPage;
