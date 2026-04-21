/**
 * React Query Hooks for Simulation
 * 서버 데이터 fetching 및 캐싱
 *
 * Co-Sim 지원: 다중 모델 스트림 관리, Builder 패턴 호출
 * Job[] 제거 → coSimSession.models 기반
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { simulationManagerService, isMockMode } from '@/services/sm';
import { connectTaskStreamService } from '@/services/sse';
import { stopAllStreams, startModelStream } from '@/services/sse';
import { useSimulationStore } from '@/stores/simulationStore';
import type { TaskMode, PlotData, SimStateSnapshot, CoSimSession } from '../types/simulation';
import type { MinorEdit } from '../types/mars';

interface MinorEditNamedValue {
  name: string;
  value: number;
}

interface MinorEditSnapshot {
  ts_ms: number;
  timehy: number;
  task_id: string;
  seq: number;
  values: MinorEditNamedValue[];
}

interface StartSimulationInput {
  args: string;
  title: string;
  description?: string;
  projectId: string;
  taskMode?: TaskMode;
  restartSourceTaskId?: string;
  minorEdits?: MinorEdit[];
}

/**
 * Co-Sim 시작 입력 타입
 */
interface StartCoSimInput {
  projectId: string;
  title: string;
  description?: string;
  models: Array<{
    modelId: string;
    modelName: string;
    inputFileUrl: string;
    preciceMarsNmlUrl?: string;
    taskMode: TaskMode;
    minorEdits?: MinorEdit[];
  }>;
  sharedConfigs?: string[];
}

/**
 * coSimSession에서 taskId로 모델을 찾는 헬퍼
 */
function findModelByTaskId(taskId: string) {
  const session = useSimulationStore.getState().coSimSession;
  if (!session) return null;
  return Object.values(session.models).find((m) => m.taskId === taskId) ?? null;
}

/**
 * 시뮬레이션 시작 mutation (단일 모델)
 */
export function useStartSimulation() {
  const queryClient = useQueryClient();
  const {
    setActiveModel, setActiveTab,
    initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
  } = useSimulationStore();

  return useMutation({
    retry: false,
    mutationFn: async (input: StartSimulationInput) => {
      const rawArgs = String(input.args || '').trim();
      const [modeToken = '', inputFileUrl = '', preciceMarsNmlUrl = ''] = rawArgs
        .split(',')
        .map((part) => part.trim());

      if (!/^(new|restart)$/i.test(modeToken)) {
        throw new Error('시뮬레이션 인자 형식이 올바르지 않습니다. new|restart 접두가 필요합니다');
      }

      const taskMode = modeToken.toLowerCase() as TaskMode;
      const bffProjectId = input.projectId;

      if (!inputFileUrl) {
        throw new Error('시뮬레이션 인자가 비어 있습니다. input_file URL을 전달하세요');
      }

      const { simId, taskIds } = await simulationManagerService.createAndBuildSimulation({
        models: [{
          args: preciceMarsNmlUrl
            ? [taskMode, inputFileUrl, preciceMarsNmlUrl]
            : [taskMode, inputFileUrl],
        }],
        buildRequestHeadersFactory: ({ simId, taskIds }) => ({
          'x-bff-simulation-id': simId,
          'x-bff-task-ids': taskIds.join(','),
          'x-bff-project-id': bffProjectId,
          'x-bff-title': input.title,
          'x-bff-description': input.description ?? '',
          'x-bff-is-restart': String(taskMode === 'restart'),
        }),
      });
      const taskId = taskIds[0];
      if (!taskId) {
        throw new Error('Build failed: empty task_id returned');
      }
      return { taskId, simId, args: input.args, taskMode: taskMode as TaskMode };
    },

    onSuccess: ({ taskId, simId, args, taskMode }, variables) => {
      clearCoSimSession();
      setActiveTab('all');

      // 일관된 modelId 생성: task ID를 직접 사용
      const modelId = taskId;
      initCoSimSession(simId ?? taskId, variables.projectId, [{
        modelId,
        modelName: extractProjectName(args),
        taskId,
        taskIndex: 0,
        args,
        taskMode,
        status: 'running',
      }]);

      // runtimeMinorEdits 설정
      const edits = variables.minorEdits?.filter((e) => e.variableType !== 'time') ?? [];
      setModelRuntimeMinorEdits(modelId, edits);

      setActiveModel(modelId);
      queryClient.invalidateQueries({ queryKey: ['simulation'] });
      console.log(`[useStartSimulation] Started task: ${taskId}, simId: ${simId}`);
    },

    onError: (error: Error) => {
      console.error('[useStartSimulation] Failed to start task:', error);
    },
  });
}

/**
 * Co-Sim 시작 mutation (다중 모델)
 */
export function useStartCoSimulation() {
  const queryClient = useQueryClient();
  const {
    setActiveTab, setActiveModel,
    initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
  } = useSimulationStore();

  return useMutation({
    retry: false,
    mutationFn: async (input: StartCoSimInput) => {
      const { simId, taskIds } = await simulationManagerService.createAndBuildSimulation({
        models: input.models.map((m) => ({
          args: m.preciceMarsNmlUrl
            ? [m.taskMode, m.inputFileUrl, m.preciceMarsNmlUrl]
            : [m.taskMode, m.inputFileUrl],
        })),
        sharedConfigs: input.sharedConfigs,
        buildRequestHeadersFactory: ({ simId, taskIds }) => ({
          'x-bff-simulation-id': simId,
          'x-bff-task-ids': taskIds.join(','),
          'x-bff-project-id': input.projectId,
          'x-bff-title': input.title,
          'x-bff-description': input.description ?? '',
        }),
      });

      return { simId, taskIds, models: input.models };
    },

    onSuccess: ({ simId, taskIds, models }, variables) => {
      clearCoSimSession();
      setActiveTab('all');

      // Co-Sim 세션 초기화 (lifecycle 필드 포함)
      initCoSimSession(simId, variables.projectId, models.map((m, i) => ({
        modelId: m.modelId,
        modelName: m.modelName,
        taskId: taskIds[i],
        taskIndex: i,
        args: m.inputFileUrl,
        taskMode: m.taskMode,
        status: 'running' as const,
      })));

      // 다중 모델이면 첫 번째 모델을 활성 모델로 설정
      if (models.length > 0) {
        setActiveModel(models[0].modelId);
      }

      // 각 모델의 runtimeMinorEdits 설정
      for (const m of models) {
        const edits = m.minorEdits?.filter((e) => e.variableType !== 'time') ?? [];
        setModelRuntimeMinorEdits(m.modelId, edits);
      }

      queryClient.invalidateQueries({ queryKey: ['simulation'] });
      console.log(`[useStartCoSimulation] Started co-sim: ${simId}, tasks:`, taskIds);
    },

    onError: (error: Error) => {
      console.error('[useStartCoSimulation] Failed to start co-simulation:', error);
    },
  });
}

/**
 * 실시간 로그 데이터 (스트리밍) — 단일 모델 (coSimSession 기반)
 */
export function useLiveData(taskId: string | null, options?: { enabled?: boolean; refetchInterval?: number }) {
  const { appendModelPlotData, appendModelScreenLog, setModelLatestMinorEdit, updateModelByTaskId } = useSimulationStore();
  const mockMode = isMockMode();

  return useQuery({
    queryKey: ['simulation', 'live', taskId],
    queryFn: async () => {
      if (!taskId) return null;

      const model = findModelByTaskId(taskId);
      const modelId = model?.modelId;

      if (!modelId) {
        console.warn('[useLiveData] No modelId found for taskId:', taskId);
        return null;
      }

      let hasLoggedFirstMinorEdit = false;

      if (mockMode) {
        console.warn('[useLiveData] Mock mode not supported in Connect-RPC');
        return { taskId, isMock: false, completed: false };
      }

      const stopPolling = await connectTaskStreamService.startConnectTaskStream(taskId, {
        onScreenLogs: (logs) => {
          logs.forEach((log) => appendModelScreenLog(modelId, log));
        },

        onMinorEdit: (data) => {
          const snapshot = data as MinorEditSnapshot;
          if (!snapshot || !Array.isArray(snapshot.values)) {
            console.warn('[useLiveData] Invalid MinorEdit snapshot:', data);
            return;
          }

          if (!hasLoggedFirstMinorEdit && snapshot.values.length > 0) {
            const first = snapshot.values[0];
            console.log('[useLiveData] MinorEdit first value:', {
              name: first?.name, value: first?.value,
              seq: snapshot.seq, timehy: snapshot.timehy,
            });
            hasLoggedFirstMinorEdit = true;
          }

          setModelLatestMinorEdit(modelId, {
            timehy: snapshot.timehy,
            tsMs: snapshot.ts_ms,
            seq: snapshot.seq,
            values: snapshot.values,
          });

          const point = parseMinorEditSnapshot(snapshot);
          if (point) {
            appendModelPlotData(modelId, point);
          }
        },

        onSimState: (state) => {
          const simSnapshot: SimStateSnapshot = state;
          updateModelByTaskId(taskId, { lastSimState: simSnapshot });
        },

        onError: (error) => {
          console.error('[useLiveData] Polling error:', error);
          updateModelByTaskId(taskId, {
            status: 'failed',
            error: error.message,
            endTime: Date.now(),
          });
        },
      });

      return { taskId, stopPolling };
    },

    enabled: (options?.enabled ?? true) && !!taskId,
    refetchInterval: false,
    staleTime: Infinity,
  });
}

/**
 * Co-Sim 실시간 데이터 (다중 스트림)
 */
export function useCoSimLiveData(
  coSimSession: CoSimSession | null,
  options?: { enabled?: boolean }
) {
  const {
    appendModelPlotData, appendModelScreenLog,
    setModelLatestMinorEdit, updateModel,
  } = useSimulationStore();

  return useQuery({
    queryKey: ['simulation', 'cosim-live', coSimSession?.simId],
    queryFn: async () => {
      if (!coSimSession) return null;

      // 이전 스트림 모두 정리
      stopAllStreams();

      const models = Object.values(coSimSession.models);
      const stops: Array<() => void> = [];

      for (const model of models) {
        const { modelId, taskId } = model;
        let hasLoggedFirst = false;

        const stop = await startModelStream(modelId, taskId, {
          onScreenLogs: (logs) => {
            logs.forEach((log) => appendModelScreenLog(modelId, log));
          },

          onMinorEdit: (data) => {
            const snapshot = data as MinorEditSnapshot;
            if (!snapshot || !Array.isArray(snapshot.values)) return;

            if (!hasLoggedFirst && snapshot.values.length > 0) {
              console.log(`[useCoSimLiveData] ${modelId} first MinorEdit:`, {
                name: snapshot.values[0]?.name,
                seq: snapshot.seq,
              });
              hasLoggedFirst = true;
            }

            setModelLatestMinorEdit(modelId, {
              timehy: snapshot.timehy,
              tsMs: snapshot.ts_ms,
              seq: snapshot.seq,
              values: snapshot.values,
            });

            const point = parseMinorEditSnapshot(snapshot);
            if (point) {
              appendModelPlotData(modelId, point);
            }
          },

          onSimState: (state) => {
              const simSnapshot: SimStateSnapshot = state;
              updateModel(modelId, { lastSimState: simSnapshot });
            },

          onError: (error) => {
            console.error(`[useCoSimLiveData] ${modelId} stream error:`, error);
            updateModel(modelId, {
              status: 'failed',
              error: error.message,
              endTime: Date.now(),
            });
          },
        });

        stops.push(stop);
      }

      return {
        simId: coSimSession.simId,
        stopAll: () => {
          stops.forEach((s) => s());
          stopAllStreams();
        },
      };
    },

    enabled: (options?.enabled ?? true) && !!coSimSession,
    refetchInterval: false,
    staleTime: Infinity,
  });
}

/**
 * MinorEditSnapshot -> PlotData
 */
function parseMinorEditSnapshot(snapshot: MinorEditSnapshot): PlotData | null {
  if (!snapshot || !Array.isArray(snapshot.values)) return null;
  if (snapshot.values.length === 0) return null;

  const simulationTimeSeconds = Number(snapshot.timehy) / 1000;
  if (!Number.isFinite(simulationTimeSeconds)) return null;

  const point: PlotData = { time: simulationTimeSeconds };

  snapshot.values.forEach((item, idx) => {
    const numeric = Number(item?.value);
    if (Number.isFinite(numeric)) {
      point[`v${idx}`] = numeric;
    }
  });

  return point;
}

/**
 * args에서 프로젝트 이름 추출
 */
function extractProjectName(args: string): string {
  const parts = args.split(',').map((part) => part.trim()).filter(Boolean);
  const inputFileUrl = parts.length >= 2 ? parts[1] : parts[0] ?? '';

  if (/^[a-z]+:\/\//i.test(inputFileUrl)) {
    const withoutScheme = inputFileUrl.replace(/^[a-z]+:\/\//i, '');
    const segments = withoutScheme.split('/').filter(Boolean);
    if (segments.length >= 3) return segments[segments.length - 2];
    return segments[0] || 'Unknown';
  }

  if (inputFileUrl.includes('/')) {
    const pathSegments = inputFileUrl.split('/').filter(Boolean);
    if (pathSegments.length >= 2) return pathSegments[pathSegments.length - 2];
    return pathSegments[pathSegments.length - 1] || 'Unknown';
  }

  return 'Unknown';
}
