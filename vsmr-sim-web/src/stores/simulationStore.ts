/**
 * Simulation Store (Zustand)
 * 시뮬레이션 관련 로컬 UI 상태 관리
 *
 * Job[] / activeJobId 제거 → coSimSession 단일 구조로 통합
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware';
import type { PlotData, ChartLayout, CustomTab, MinorEditNamedSnapshot, ChartLineStyles, LineStyle, CoSimSession, ModelSimData, SimStatus, TaskMode } from '../types/simulation';
import type { MinorEdit } from '../types/mars';

/** 모델 상태들로부터 세션 전체 상태를 파생 */
function deriveSessionStatus(models: Record<string, ModelSimData>): SimStatus {
  const statuses = Object.values(models).map((m) => m.status);
  if (statuses.length === 0) return 'building';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'stopped')) return 'stopped';
  if (statuses.some((s) => s === 'running')) return 'running';
  if (statuses.some((s) => s === 'paused')) return 'paused';
  return 'building';
}

/**
 * Simulation Store 인터페이스
 */
interface SimulationStore {
  // UI 상태
  chartZoom: number;
  autoScroll: boolean;
  showDevTools: boolean;
  chartYAxisModes: Record<number, 'fixed' | 'auto'>;

  // 레이아웃 관련 상태
  chartLayouts: Record<string, ChartLayout>;
  favoriteChartIds: Set<string>;
  customTabs: CustomTab[];
  activeTabId: string;
  autoGroupMode: boolean; // 변수 타입별 자동 그룹핑 모드
  icvActiveTabId: string; // ICV 차트 패널 독립 탭 상태
  chartCompareMode: boolean;
  compareChartIds: [string | null, string | null];

  // 라인 스타일 커스텀 상태: chartId → { dataKey → LineStyle }
  chartLineStyles: Record<string, ChartLineStyles>;

  // 시뮬레이션 세션 (단일 모델 / Co-Sim 공통)
  coSimSession: CoSimSession | null;
  activeModelId: string | null;

  // Actions: UI
  setChartZoom: (zoom: number) => void;
  setAutoScroll: (enabled: boolean) => void;
  toggleDevTools: () => void;
  setChartYAxisMode: (cardNumber: number, mode: 'fixed' | 'auto') => void;

  // Actions: 레이아웃 관리
  setChartLayout: (chartId: string, layout: ChartLayout) => void;
  toggleFavorite: (chartId: string) => void;
  addCustomTab: (tab: CustomTab) => void;
  removeCustomTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setIcvActiveTab: (tabId: string) => void;
  setAutoGroupMode: (enabled: boolean) => void;
  setCompareMode: (enabled: boolean) => void;
  addToCompare: (chartId: string, position: 0 | 1) => void;
  clearCompare: () => void;
  resetLayouts: () => void;

  // Actions: 라인 스타일
  setLineStyle: (chartId: string, dataKey: string, style: Partial<LineStyle>) => void;
  resetLineStyles: (chartId: string) => void;

  // Actions: Co-Sim 세션
  initCoSimSession: (
    simId: string,
    projectId: string,
    models: Array<{
      modelId: string;
      modelName: string;
      taskId: string;
      taskIndex: number;
      args: string;
      taskMode: TaskMode;
      status?: SimStatus;
    }>
  ) => void;
  setCoSimStatus: (status: SimStatus) => void;
  setActiveModel: (modelId: string | null) => void;

  // Actions: 모델 데이터
  updateModel: (modelId: string, updates: Partial<ModelSimData>) => void;
  updateModelByTaskId: (taskId: string, updates: Partial<ModelSimData>) => void;
  appendModelPlotData: (modelId: string, data: PlotData) => void;
  appendModelScreenLog: (modelId: string, log: string) => void;
  setModelLatestMinorEdit: (modelId: string, snapshot: MinorEditNamedSnapshot) => void;
  setModelRuntimeMinorEdits: (modelId: string, edits: MinorEdit[] | null) => void;
  clearAllModelData: () => void;
  clearCoSimSession: () => void;

  /** 프로젝트 로드 시 전체 초기화 (localStorage 포함) */
  resetAll: () => void;
}

/**
 * Zustand Store 생성
 */
export const useSimulationStore = create<SimulationStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, _get) => ({
        // 초기 상태
        chartZoom: 1,
        autoScroll: true,
        showDevTools: false,
        chartYAxisModes: {},
        chartLayouts: {},
        favoriteChartIds: new Set<string>(),
        customTabs: [],
        activeTabId: 'all',
        icvActiveTabId: 'all',
        autoGroupMode: false,
        chartCompareMode: false,
        compareChartIds: [null, null],
        chartLineStyles: {},
        coSimSession: null,
        activeModelId: null,

        // UI 액션
        setChartZoom: (zoom) =>
          set({ chartZoom: zoom }, false, 'setChartZoom'),

        setAutoScroll: (enabled) =>
          set({ autoScroll: enabled }, false, 'setAutoScroll'),

        toggleDevTools: () =>
          set((state) => ({ showDevTools: !state.showDevTools }), false, 'toggleDevTools'),

        setChartYAxisMode: (cardNumber, mode) =>
          set((state) => ({
            chartYAxisModes: {
              ...state.chartYAxisModes,
              [cardNumber]: mode,
            },
          }), false, 'setChartYAxisMode'),

        // 레이아웃 관리 액션
        setChartLayout: (chartId, layout) =>
          set((state) => ({
            chartLayouts: {
              ...state.chartLayouts,
              [chartId]: layout,
            },
          }), false, 'setChartLayout'),

        toggleFavorite: (chartId) =>
          set((state) => {
            const newFavorites = new Set(state.favoriteChartIds);
            if (newFavorites.has(chartId)) {
              newFavorites.delete(chartId);
            } else {
              newFavorites.add(chartId);
            }
            return { favoriteChartIds: newFavorites };
          }, false, 'toggleFavorite'),

        addCustomTab: (tab) =>
          set((state) => ({
            customTabs: [...state.customTabs, tab],
          }), false, 'addCustomTab'),

        removeCustomTab: (tabId) =>
          set((state) => ({
            customTabs: state.customTabs.filter((tab) => tab.id !== tabId),
            activeTabId: state.activeTabId === tabId ? 'all' : state.activeTabId,
          }), false, 'removeCustomTab'),

        setActiveTab: (tabId) =>
          set({ activeTabId: tabId }, false, 'setActiveTab'),

        setIcvActiveTab: (tabId) =>
          set({ icvActiveTabId: tabId }, false, 'setIcvActiveTab'),

        setAutoGroupMode: (enabled) =>
          set({ autoGroupMode: enabled, activeTabId: 'all', icvActiveTabId: 'all' }, false, 'setAutoGroupMode'),

        setCompareMode: (enabled) =>
          set({ chartCompareMode: enabled }, false, 'setCompareMode'),

        addToCompare: (chartId, position) =>
          set((state) => {
            const newCompareIds: [string | null, string | null] = [...state.compareChartIds];
            newCompareIds[position] = chartId;
            return { compareChartIds: newCompareIds };
          }, false, 'addToCompare'),

        clearCompare: () =>
          set({ compareChartIds: [null, null], chartCompareMode: false }, false, 'clearCompare'),

        resetLayouts: () =>
          set({ chartLayouts: {} }, false, 'resetLayouts'),

        setLineStyle: (chartId, dataKey, style) =>
          set((state) => ({
            chartLineStyles: {
              ...state.chartLineStyles,
              [chartId]: {
                ...state.chartLineStyles[chartId],
                [dataKey]: {
                  ...state.chartLineStyles[chartId]?.[dataKey],
                  ...style,
                },
              },
            },
          }), false, 'setLineStyle'),

        resetLineStyles: (chartId) =>
          set((state) => {
            const { [chartId]: _, ...rest } = state.chartLineStyles;
            return { chartLineStyles: rest };
          }, false, 'resetLineStyles'),

        // 세션 관리 액션 (단일 모델 / Co-Sim 공통)
        initCoSimSession: (simId, projectId, models) =>
          set(() => {
            const now = Date.now();
            const modelMap: Record<string, ModelSimData> = {};
            for (const m of models) {
              modelMap[m.modelId] = {
                modelId: m.modelId,
                modelName: m.modelName,
                taskId: m.taskId,
                taskIndex: m.taskIndex,
                status: m.status ?? 'building',
                args: m.args,
                taskMode: m.taskMode,
                startTime: now,
                plotData: [],
                screenLogs: [],
                latestMinorEdit: null,
                runtimeMinorEdits: null,
              };
            }
            return {
              coSimSession: {
                simId,
                projectId,
                status: deriveSessionStatus(modelMap),
                startTime: now,
                models: modelMap,
              },
              // 단일 모델이면 자동으로 activeModelId 설정
              activeModelId: models.length === 1 ? models[0].modelId : null,
            };
          }, false, 'initCoSimSession'),

        setCoSimStatus: (status) =>
          set((state) => {
            if (!state.coSimSession) return {};
            return {
              coSimSession: { ...state.coSimSession, status },
            };
          }, false, 'setCoSimStatus'),

        setActiveModel: (modelId) =>
          set({ activeModelId: modelId }, false, 'setActiveModel'),

        // 모델 데이터 액션
        // status 변경 시 세션 status 자동 재계산
        updateModel: (modelId, updates) =>
          set((state) => {
            if (!state.coSimSession?.models[modelId]) return {};
            const model = state.coSimSession.models[modelId];
            const newModels = {
              ...state.coSimSession.models,
              [modelId]: { ...model, ...updates },
            };
            return {
              coSimSession: {
                ...state.coSimSession,
                models: newModels,
                ...(updates.status != null ? { status: deriveSessionStatus(newModels) } : {}),
              },
            };
          }, false, 'updateModel'),

        updateModelByTaskId: (taskId, updates) =>
          set((state) => {
            if (!state.coSimSession) return {};
            const models = state.coSimSession.models;
            const entry = Object.entries(models).find(([, m]) => m.taskId === taskId);
            if (!entry) return {};
            const [modelId, model] = entry;
            const newModels = {
              ...models,
              [modelId]: { ...model, ...updates },
            };
            return {
              coSimSession: {
                ...state.coSimSession,
                models: newModels,
                ...(updates.status != null ? { status: deriveSessionStatus(newModels) } : {}),
              },
            };
          }, false, 'updateModelByTaskId'),

        appendModelPlotData: (modelId, data) =>
          set((state) => {
            if (!state.coSimSession?.models[modelId]) return {};
            const model = state.coSimSession.models[modelId];
            const newData = [...model.plotData, data];
            const trimmed = newData.length > 3000 ? newData.slice(-3000) : newData;
            return {
              coSimSession: {
                ...state.coSimSession,
                models: {
                  ...state.coSimSession.models,
                  [modelId]: { ...model, plotData: trimmed },
                },
              },
            };
          }, false, 'appendModelPlotData'),

        appendModelScreenLog: (modelId, log) =>
          set((state) => {
            if (!state.coSimSession?.models[modelId]) return {};
            const model = state.coSimSession.models[modelId];
            const newLogs = [...model.screenLogs, log];
            const trimmed = newLogs.length > 500 ? newLogs.slice(-500) : newLogs;
            return {
              coSimSession: {
                ...state.coSimSession,
                models: {
                  ...state.coSimSession.models,
                  [modelId]: { ...model, screenLogs: trimmed },
                },
              },
            };
          }, false, 'appendModelScreenLog'),

        setModelLatestMinorEdit: (modelId, snapshot) =>
          set((state) => {
            if (!state.coSimSession?.models[modelId]) return {};
            const model = state.coSimSession.models[modelId];
            return {
              coSimSession: {
                ...state.coSimSession,
                models: {
                  ...state.coSimSession.models,
                  [modelId]: { ...model, latestMinorEdit: snapshot },
                },
              },
            };
          }, false, 'setModelLatestMinorEdit'),

        setModelRuntimeMinorEdits: (modelId, edits) =>
          set((state) => {
            if (!state.coSimSession?.models[modelId]) return {};
            const model = state.coSimSession.models[modelId];
            return {
              coSimSession: {
                ...state.coSimSession,
                models: {
                  ...state.coSimSession.models,
                  [modelId]: { ...model, runtimeMinorEdits: edits },
                },
              },
            };
          }, false, 'setModelRuntimeMinorEdits'),

        clearAllModelData: () =>
          set((state) => {
            if (!state.coSimSession) return {};
            const models = { ...state.coSimSession.models };
            for (const id of Object.keys(models)) {
              models[id] = {
                ...models[id],
                plotData: [],
                screenLogs: [],
                latestMinorEdit: null,
                runtimeMinorEdits: null,
              };
            }
            return {
              coSimSession: { ...state.coSimSession, models },
            };
          }, false, 'clearAllModelData'),

        clearCoSimSession: () =>
          set({
            coSimSession: null,
            activeModelId: null,
          }, false, 'clearCoSimSession'),

        resetAll: () =>
          set({
            chartZoom: 1,
            autoScroll: true,
            showDevTools: false,
            chartYAxisModes: {},
            chartLayouts: {},
            favoriteChartIds: new Set<string>(),
            customTabs: [],
            activeTabId: 'all',
            autoGroupMode: false,
            chartCompareMode: false,
            compareChartIds: [null, null],
            chartLineStyles: {},
            coSimSession: null,
            activeModelId: null,
          }, false, 'resetAll'),
      })),
      {
        name: 'simulation-layout-storage',
        partialize: (state) => ({
          chartLayouts: state.chartLayouts,
          favoriteChartIds: Array.from(state.favoriteChartIds),
          customTabs: state.customTabs,
          activeTabId: state.activeTabId,
          icvActiveTabId: state.icvActiveTabId,
        }),
        merge: (persistedState: any, currentState: SimulationStore) => {
          return {
            ...currentState,
            ...persistedState,
            favoriteChartIds: persistedState?.favoriteChartIds
              ? new Set(persistedState.favoriteChartIds)
              : currentState.favoriteChartIds,
          };
        },
      }
    ),
    {
      name: 'simulation-store',
      enabled: import.meta.env.DEV,
    }
  )
);

// DEV: 브라우저 콘솔에서 store 접근 가능하게 노출
if (import.meta.env.DEV) {
  (window as any).__simStore = useSimulationStore;
}

/** 시뮬레이션 데이터 존재 여부 (팝업 판단용) */
export const hasSimulationData = () => {
  const session = useSimulationStore.getState().coSimSession;
  if (!session) return false;
  return Object.values(session.models).some(
    (m) => m.plotData.length > 0 || m.status === 'running'
  );
};

/**
 * 선택적 구독 훅들 (성능 최적화)
 */

const EMPTY_PLOT_DATA: PlotData[] = [];
const EMPTY_SCREEN_LOGS: string[] = [];

// 활성 모델 전체 데이터 (기존 useActiveJob 대체)
export const useActiveModel = () =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    if (!coSimSession || !activeModelId) return null;
    return coSimSession.models[activeModelId] ?? null;
  });

// 활성 모델의 taskId (MARS 서비스용)
export const getActiveTaskId = () => {
  const { coSimSession, activeModelId } = useSimulationStore.getState();
  if (!coSimSession) return null;
  const targetId = activeModelId ?? Object.keys(coSimSession.models)[0];
  return coSimSession.models[targetId]?.taskId ?? null;
};

// 전체 모델 목록
export const useSessionModels = () =>
  useSimulationStore((state) =>
    state.coSimSession ? Object.values(state.coSimSession.models) : []
  );

// 플롯 데이터만 구독 (activeModelId 또는 overrideModelId 기반)
export const usePlotData = (overrideModelId?: string) =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    const targetId = overrideModelId ?? activeModelId;
    if (coSimSession && targetId && coSimSession.models[targetId]) {
      return coSimSession.models[targetId].plotData;
    }
    return EMPTY_PLOT_DATA;
  });

// 스크린 로그만 구독 (activeModelId 또는 overrideModelId 기반)
export const useScreenLogs = (overrideModelId?: string) =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    const targetId = overrideModelId ?? activeModelId;
    if (coSimSession && targetId && coSimSession.models[targetId]) {
      return coSimSession.models[targetId].screenLogs;
    }
    return EMPTY_SCREEN_LOGS;
  });

// 최신 MinorEdit 스냅샷만 구독 (activeModelId 또는 overrideModelId 기반)
export const useLatestMinorEdit = (overrideModelId?: string) =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    const targetId = overrideModelId ?? activeModelId;
    if (coSimSession && targetId && coSimSession.models[targetId]) {
      return coSimSession.models[targetId].latestMinorEdit;
    }
    return null;
  });

// runtimeMinorEdits 구독 (overrideModelId 지원)
export const useRuntimeMinorEdits = (overrideModelId?: string) =>
  useSimulationStore((state) => {
    const { coSimSession, activeModelId } = state;
    const targetId = overrideModelId ?? activeModelId;
    if (coSimSession && targetId && coSimSession.models[targetId]) {
      return coSimSession.models[targetId].runtimeMinorEdits;
    }
    return null;
  });

// Co-Sim 세션 구독
export const useCoSimSession = () =>
  useSimulationStore((state) => state.coSimSession);

// 활성 모델 ID 구독
export const useActiveModelId = () =>
  useSimulationStore((state) => state.activeModelId);

// UI 상태만 구독
export const useSimulationUI = () =>
  useSimulationStore((state) => ({
    chartZoom: state.chartZoom,
    autoScroll: state.autoScroll,
    showDevTools: state.showDevTools,
  }));
