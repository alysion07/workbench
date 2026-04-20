/**
 * Analysis Store
 * plotfl 파일 파싱 결과, 차트 패널, 재생 상태 등 분석 페이지 상태 관리
 *
 * Co-Sim 지원: modelResults에 모델별 결과를 저장.
 * VariableExplorer는 모델별 루트 노드로 통합 트리 렌더, 선택 변수는 "<modelId>::<originalKey>" 프리픽스.
 * useFilteredData가 시간축 기준 outer join으로 병합한 통합 배열을 반환.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { ParsedPlotFile, SelectedVariable, PlotVariable, ChartPanel } from '@/types/analysis';
import { VARIABLE_TYPE_META } from '@/types/analysis';
import type { ChartLineStyles, LineStyle } from '@/types/simulation';

/** 차트 색상 팔레트 */
const CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
];

let panelCounter = 0;

interface AnalysisState {
  // === Co-Sim 모델별 결과 (통합 트리/차트의 소스) ===
  modelResults: Record<string, { label: string; parsed: ParsedPlotFile }> | null;

  // === 단일 파일 데이터 (로컬 업로드 / 단일 모델 결과) ===
  parsedFile: ParsedPlotFile | null;
  fileName: string | null;

  /** 차트 패널 목록 */
  panels: ChartPanel[];
  /** 현재 활성 패널 ID (변수 추가 대상) */
  activePanelId: string | null;
  /** 시간 범위 필터 [start, end] */
  timeRange: [number, number] | null;
  /** 그리드 열 수 (1, 2, 3) */
  gridColumns: 1 | 2 | 3;
  /** X축 줌 동기화 활성 여부 */
  syncZoom: boolean;
  /** 공유 X축 줌 도메인 (null이면 전체 범위) */
  zoomDomain: [number, number] | null;
  /** 비교용 추가 로드 파일 (최대 2개) */
  comparedFiles: Array<{ id: string; label: string; parsed: ParsedPlotFile }>;
  /** 라인 스타일 커스텀 상태: panelId → { dataKey → LineStyle } */
  chartLineStyles: Record<string, ChartLineStyles>;

  // === File Actions ===
  loadFile: (fileName: string, parsed: ParsedPlotFile) => void;
  clearFile: () => void;

  // === Co-Sim Model Results Actions ===
  loadModelResults: (results: Record<string, { label: string; parsed: ParsedPlotFile }>) => void;
  clearModelResults: () => void;

  // === Panel Actions ===
  addPanel: (title?: string) => string;
  removePanel: (panelId: string) => void;
  setActivePanel: (panelId: string) => void;
  renamPanel: (panelId: string, title: string) => void;

  // === Variable Actions (패널 대상) ===
  /**
   * 변수 토글.
   * @param modelId Co-Sim 시 변수가 속한 모델 ID. 지정 시 dataKey는 "<modelId>::<originalKey>"로 네임스페이스화됨.
   */
  toggleVariable: (variable: PlotVariable, panelId?: string, modelId?: string) => void;
  removeVariableFromPanel: (panelId: string, dataKey: string) => void;
  clearPanelVariables: (panelId: string) => void;

  // === Time Actions ===
  setTimeRange: (range: [number, number]) => void;
  resetTimeRange: () => void;

  // === Layout Actions ===
  setGridColumns: (columns: 1 | 2 | 3) => void;

  // === Zoom Sync Actions ===
  setZoomDomain: (domain: [number, number] | null) => void;
  toggleSyncZoom: () => void;

  // === Compare Actions ===
  addComparedFile: (id: string, label: string, parsed: ParsedPlotFile) => void;
  removeComparedFile: (id: string) => void;
  clearComparedFiles: () => void;

  // === Line Style Actions ===
  setLineStyle: (panelId: string, dataKey: string, style: Partial<LineStyle>) => void;
  resetLineStyles: (panelId: string) => void;

  /** 프로젝트 로드 시 전체 초기화 */
  resetAll: () => void;
}

/** 패널 내에서 다음 색상 */
function getNextColor(variables: SelectedVariable[]): string {
  const usedColors = new Set(variables.map((s) => s.color));
  for (const color of CHART_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return CHART_COLORS[variables.length % CHART_COLORS.length];
}

/** 변수에 대한 표시 라벨 생성 */
function makeLabel(variable: PlotVariable, modelLabel?: string): string {
  const meta = VARIABLE_TYPE_META[variable.type];
  const base = `${meta.label} (${variable.componentId})`;
  return modelLabel ? `${base} · ${modelLabel}` : base;
}

/** Co-Sim 변수 키 네임스페이스 */
const MODEL_KEY_SEP = '::';

function namespacedKey(modelId: string, originalKey: string): string {
  return `${modelId}${MODEL_KEY_SEP}${originalKey}`;
}

/** 모든 모델 결과의 시간축 union 범위 */
function unionTimeRange(
  results: Record<string, { label: string; parsed: ParsedPlotFile }>,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const { parsed } of Object.values(results)) {
    if (parsed.timeRange[0] < min) min = parsed.timeRange[0];
    if (parsed.timeRange[1] > max) max = parsed.timeRange[1];
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return [min, max];
}

function createPanel(title?: string): ChartPanel {
  panelCounter++;
  return {
    id: `panel-${panelCounter}-${Date.now()}`,
    title: title || `Chart ${panelCounter}`,
    variables: [],
  };
}

export const useAnalysisStore = create<AnalysisState>()(
  devtools(
    subscribeWithSelector((set) => ({
      modelResults: null,
      parsedFile: null,
      fileName: null,
      panels: [],
      activePanelId: null,
      timeRange: null,
      gridColumns: 1,
      syncZoom: true,
      zoomDomain: null,
      comparedFiles: [],
      chartLineStyles: {},

      // === File Actions (단일 파일 로드 — 로컬 업로드 또는 단일 모델 결과) ===
      loadFile: (fileName, parsed) => {
        panelCounter = 0;
        const firstPanel = createPanel('Chart 1');
        set(
          {
            modelResults: null,
            parsedFile: parsed,
            fileName,
            panels: [firstPanel],
            activePanelId: firstPanel.id,
            timeRange: [...parsed.timeRange] as [number, number],
            comparedFiles: [],
          },
          false,
          'loadFile',
        );
      },

      clearFile: () =>
        set(
          {
            modelResults: null,
            parsedFile: null,
            fileName: null,
            panels: [],
            activePanelId: null,
            timeRange: null,
            comparedFiles: [],
          },
          false,
          'clearFile',
        ),

      // === Co-Sim Model Results Actions ===
      loadModelResults: (results) => {
        panelCounter = 0;
        const firstPanel = createPanel('Chart 1');
        const labels = Object.values(results).map((r) => r.label);
        const union = unionTimeRange(results);

        set(
          {
            modelResults: results,
            parsedFile: null,
            fileName: labels.length > 0 ? `Co-Sim: ${labels.join(' + ')}` : null,
            panels: [firstPanel],
            activePanelId: firstPanel.id,
            timeRange: union,
            comparedFiles: [],
          },
          false,
          'loadModelResults',
        );
      },

      clearModelResults: () =>
        set(
          {
            modelResults: null,
            parsedFile: null,
            fileName: null,
            panels: [],
            activePanelId: null,
            timeRange: null,
            comparedFiles: [],
          },
          false,
          'clearModelResults',
        ),

      // === Panel Actions ===
      addPanel: (title) => {
        const panel = createPanel(title);
        set(
          (state) => ({
            panels: [...state.panels, panel],
            activePanelId: panel.id,
          }),
          false,
          'addPanel',
        );
        return panel.id;
      },

      removePanel: (panelId) =>
        set(
          (state) => {
            const newPanels = state.panels.filter((p) => p.id !== panelId);
            return {
              panels: newPanels,
              activePanelId:
                state.activePanelId === panelId
                  ? (newPanels[0]?.id ?? null)
                  : state.activePanelId,
            };
          },
          false,
          'removePanel',
        ),

      setActivePanel: (panelId) => set({ activePanelId: panelId }, false, 'setActivePanel'),

      renamPanel: (panelId, title) =>
        set(
          (state) => ({
            panels: state.panels.map((p) => (p.id === panelId ? { ...p, title } : p)),
          }),
          false,
          'renamePanel',
        ),

      // === Variable Actions ===
      toggleVariable: (variable, panelId, modelId) =>
        set(
          (state) => {
            const targetId = panelId || state.activePanelId;
            if (!targetId) return state;

            const effectiveKey = modelId
              ? namespacedKey(modelId, variable.dataKey)
              : variable.dataKey;
            const modelLabel = modelId ? state.modelResults?.[modelId]?.label : undefined;

            return {
              panels: state.panels.map((panel) => {
                if (panel.id !== targetId) return panel;

                const exists = panel.variables.find((v) => v.dataKey === effectiveKey);
                if (exists) {
                  return {
                    ...panel,
                    variables: panel.variables.filter((v) => v.dataKey !== effectiveKey),
                  };
                }

                const meta = VARIABLE_TYPE_META[variable.type];
                const newVar: SelectedVariable = {
                  dataKey: effectiveKey,
                  label: makeLabel(variable, modelLabel),
                  color: getNextColor(panel.variables),
                  unit: meta.unit,
                  ...(modelId ? { modelId, originalKey: variable.dataKey } : {}),
                };
                return { ...panel, variables: [...panel.variables, newVar] };
              }),
            };
          },
          false,
          'toggleVariable',
        ),

      removeVariableFromPanel: (panelId, dataKey) =>
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId
                ? { ...p, variables: p.variables.filter((v) => v.dataKey !== dataKey) }
                : p,
            ),
          }),
          false,
          'removeVariableFromPanel',
        ),

      clearPanelVariables: (panelId) =>
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId ? { ...p, variables: [] } : p,
            ),
          }),
          false,
          'clearPanelVariables',
        ),

      // === Time Actions ===
      setTimeRange: (range) => set({ timeRange: range }, false, 'setTimeRange'),

      resetTimeRange: () =>
        set(
          (state) => {
            if (state.modelResults) {
              return { timeRange: unionTimeRange(state.modelResults) };
            }
            return {
              timeRange: state.parsedFile
                ? ([...state.parsedFile.timeRange] as [number, number])
                : null,
            };
          },
          false,
          'resetTimeRange',
        ),

      // === Layout Actions ===
      setGridColumns: (columns) => set({ gridColumns: columns }, false, 'setGridColumns'),

      // === Zoom Sync Actions ===
      setZoomDomain: (domain) => set({ zoomDomain: domain }, false, 'setZoomDomain'),
      toggleSyncZoom: () => set((state) => ({ syncZoom: !state.syncZoom, zoomDomain: null }), false, 'toggleSyncZoom'),

      // === Compare Actions ===
      addComparedFile: (id, label, parsed) =>
        set(
          (state) => {
            if (state.comparedFiles.length >= 2) return state;
            if (state.comparedFiles.some((f) => f.id === id)) return state;
            return { comparedFiles: [...state.comparedFiles, { id, label, parsed }] };
          },
          false,
          'addComparedFile',
        ),
      removeComparedFile: (id) =>
        set(
          (state) => ({ comparedFiles: state.comparedFiles.filter((f) => f.id !== id) }),
          false,
          'removeComparedFile',
        ),
      clearComparedFiles: () => set({ comparedFiles: [] }, false, 'clearComparedFiles'),

      // === Line Style Actions ===
      setLineStyle: (panelId, dataKey, style) =>
        set((state) => ({
          chartLineStyles: {
            ...state.chartLineStyles,
            [panelId]: {
              ...state.chartLineStyles[panelId],
              [dataKey]: {
                ...state.chartLineStyles[panelId]?.[dataKey],
                ...style,
              },
            },
          },
        }), false, 'setLineStyle'),

      resetLineStyles: (panelId) =>
        set((state) => {
          const { [panelId]: _, ...rest } = state.chartLineStyles;
          return { chartLineStyles: rest };
        }, false, 'resetLineStyles'),

      resetAll: () => {
        panelCounter = 0;
        set({
          modelResults: null,
          parsedFile: null,
          fileName: null,
          panels: [],
          activePanelId: null,
          timeRange: null,
          gridColumns: 1,
          syncZoom: true,
          zoomDomain: null,
          comparedFiles: [],
          chartLineStyles: {},
        }, false, 'resetAll');
      },
    })),
    { name: 'analysis-store', enabled: import.meta.env.DEV },
  ),
);

/**
 * 필터링된 데이터 선택자 (시간 범위 적용).
 *
 * modelResults가 있으면: 각 모델의 data를 시간축 outer join으로 병합하고
 *   모든 변수를 "<modelId>::<originalKey>" 프리픽스 키로 재배치한 통합 배열을 반환.
 * 없으면: parsedFile.data를 timeRange로 필터링한 기존 배열을 반환.
 */
export function useFilteredData() {
  const parsedFile = useAnalysisStore((s) => s.parsedFile);
  const modelResults = useAnalysisStore((s) => s.modelResults);
  const timeRange = useAnalysisStore((s) => s.timeRange);

  return useMemo(() => {
    if (!timeRange) return [];
    const [start, end] = timeRange;

    if (modelResults) {
      const timeMap = new Map<number, Record<string, number>>();
      for (const [modelId, { parsed }] of Object.entries(modelResults)) {
        for (const row of parsed.data) {
          if (row.time < start || row.time > end) continue;
          let merged = timeMap.get(row.time);
          if (!merged) {
            merged = { time: row.time };
            timeMap.set(row.time, merged);
          }
          for (const v of parsed.variables) {
            const val = row[v.dataKey];
            if (val !== undefined) {
              merged[`${modelId}${MODEL_KEY_SEP}${v.dataKey}`] = val;
            }
          }
        }
      }
      return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
    }

    if (!parsedFile) return [];
    return parsedFile.data.filter((row) => row.time >= start && row.time <= end);
  }, [parsedFile, modelResults, timeRange]);
}

/** 활성 패널의 변수 목록 */
export function useActivePanelVariables(): SelectedVariable[] {
  const panels = useAnalysisStore((s) => s.panels);
  const activePanelId = useAnalysisStore((s) => s.activePanelId);
  return panels.find((p) => p.id === activePanelId)?.variables ?? [];
}

/** 모든 패널에서 선택된 dataKey 집합 */
export function useAllSelectedKeys(): Set<string> {
  const panels = useAnalysisStore((s) => s.panels);
  const keys = new Set<string>();
  for (const panel of panels) {
    for (const v of panel.variables) {
      keys.add(v.dataKey);
    }
  }
  return keys;
}
