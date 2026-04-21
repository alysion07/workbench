/**
 * SimulationManager Connect-RPC Service
 * BFF 서버와의 Connect-RPC 통신을 담당
 *
 * 오케스트레이션: CreateSimulation → AddTask × N → Build (3단계 Builder)
 */

import { createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { BFF_URL, createAuthInterceptor, getRuntimeEnvVar } from "@/services/connectCommon";
import { useSessionStore } from "@/stores/sessionStore";
import { SimulationManager } from "@/stubs/sm/simulation_manager_connect";
import {
  AddTaskRequest,
  BuildRequest,
  StartMode,
  TaskId,
} from "@/stubs/sm/simulation_manager_pb";
import type { SimulationInfoList } from "@/stubs/sm/simulation_manager_pb";
import { Empty } from "@bufbuild/protobuf";

const TASK_TYPE = getRuntimeEnvVar(
  'VITE_TASK_TYPE',
  import.meta.env.VITE_TASK_TYPE,
  'mars'
);

const SESSION_FIRST_MESSAGE_TIMEOUT_MS = 45000;

type BuildableTask = {
  taskType?: string;
  args: string[];
};

type BuildRequestHeadersContext = {
  simId: string;
  taskIds: string[];
};

type BuildRequestHeadersFactory = (
  context: BuildRequestHeadersContext
) => Record<string, string>;

/**
 * Auth + Session interceptor
 */
const authSessionInterceptor = createAuthInterceptor({
  getSessionId: () => useSessionStore.getState().sessionId,
});

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [authSessionInterceptor],
});

const smClient: PromiseClient<typeof SimulationManager> = createPromiseClient(
  SimulationManager,
  transport
);

// ============================================
// Session Management
// ============================================

export function setSessionId(sessionId: string | null): void {
  useSessionStore.getState().setSessionId(sessionId);
  console.log(`[SimulationManagerService] Session ID set: ${sessionId}`);
}

export function getSessionId(): string | null {
  return useSessionStore.getState().getSessionId();
}

let _sessionAbortController: AbortController | null = null;
let _sessionIdPromise: Promise<string> | null = null;

export async function createSession(): Promise<string> {
  const existing = getSessionId();
  if (existing) {
    useSessionStore.getState().setSessionCreating(false);
    console.log('[SimulationManagerService] Session already exists:', existing);
    return existing;
  }

  if (_sessionIdPromise) {
    useSessionStore.getState().setSessionCreating(true);
    console.log('[SimulationManagerService] Session creation already in progress, waiting...');
    return _sessionIdPromise;
  }

  _sessionAbortController = new AbortController();
  const abortController = _sessionAbortController;
  useSessionStore.getState().setSessionCreating(true);

  _sessionIdPromise = new Promise<string>((resolve, reject) => {
    (async () => {
      let resolved = false;
      let settled = false;
      let firstMessageTimer: ReturnType<typeof setTimeout> | null = null;

      const safeResolve = (value: string) => {
        if (settled) return;
        settled = true;
        if (firstMessageTimer) {
          clearTimeout(firstMessageTimer);
          firstMessageTimer = null;
        }
        resolve(value);
      };

      const safeReject = (error: Error) => {
        if (settled) return;
        settled = true;
        if (firstMessageTimer) {
          clearTimeout(firstMessageTimer);
          firstMessageTimer = null;
        }
        reject(error);
      };

      try {
        console.log('[SimulationManagerService] Creating session...');
        firstMessageTimer = setTimeout(() => {
          if (!resolved && !abortController.signal.aborted) {
            console.error('[SimulationManagerService] CreateSession timed out');
            abortController.abort();
            safeReject(new Error('CreateSession timeout: no session_id received'));
          }
        }, SESSION_FIRST_MESSAGE_TIMEOUT_MS);

        for await (const message of smClient.createSession(
          {},
          { signal: abortController.signal }
        )) {
          if (message.sessionId && !resolved) {
            resolved = true;
            setSessionId(message.sessionId);
            useSessionStore.getState().setSessionCreating(false);
            console.log('[SimulationManagerService] Session created:', message.sessionId);
            safeResolve(message.sessionId);
          }
        }
        if (!resolved) {
          safeReject(new Error('No session_id received from server'));
        } else if (!abortController.signal.aborted) {
          console.warn('[SimulationManagerService] Session stream closed unexpectedly');
          setSessionId(null);
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          console.log('[SimulationManagerService] Session stream aborted (logout)');
        } else {
          console.error('[SimulationManagerService] Session stream error:', err);
          if (!getSessionId()) safeReject(err as Error);
          else setSessionId(null);
        }
      } finally {
        useSessionStore.getState().setSessionCreating(false);
        if (firstMessageTimer) {
          clearTimeout(firstMessageTimer);
          firstMessageTimer = null;
        }
        if (_sessionAbortController === abortController) {
          _sessionAbortController = null;
          _sessionIdPromise = null;
        }
      }
    })();
  });

  return _sessionIdPromise;
}

async function ensureSession(): Promise<string> {
  const existing = getSessionId();
  if (existing) {
    return existing;
  }
  return await createSession();
}

export function closeSession(): void {
  console.log('[SimulationManagerService] Closing session stream (logout)...');
  useSessionStore.getState().setSessionCreating(false);
  if (_sessionAbortController) {
    _sessionAbortController.abort();
    _sessionAbortController = null;
  }
  _sessionIdPromise = null;
  setSessionId(null);
}

// ============================================
// Retry Utility
// ============================================

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delays: number[] = [100, 200, 500]
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delayTime = delays[i] || delays[delays.length - 1];
      console.warn(`[SimulationManagerService] Retry ${i + 1}/${maxRetries} (${delayTime}ms):`, error);
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }
  }
  throw new Error('[SimulationManagerService] Maximum retry count exceeded');
}

// ============================================
// 3-Step Builder: CreateSimulation → AddTask × N → Build
// ============================================

/**
 * 내부 헬퍼: 3단계 Builder 패턴으로 시뮬레이션 생성
 */
async function buildSimulation(
  tasks: BuildableTask[],
  sharedConfigs: string[] = [],
  buildRequestHeadersFactory?: BuildRequestHeadersFactory
): Promise<{ simId: string; taskIds: string[] }> {
  await ensureSession();

  // Step 1: CreateSimulation → simId
  const simId = await createSimulation();

  // Step 2: AddTask × N → taskId[]
  const taskIds: string[] = [];
  for (const task of tasks) {
    const taskId = await addTask(simId, task);
    taskIds.push(taskId);
  }
  console.log('[SimulationManagerService] Step 2 - AddTask:', taskIds);

  // Step 3: Build → K8s 프로비저닝
  const buildRequestHeaders = buildRequestHeadersFactory?.({ simId, taskIds }) ?? {};
  await build(simId, sharedConfigs, buildRequestHeaders);

  return { simId, taskIds };
}

export async function createSimulation(): Promise<string> {
  const simResponse = await smClient.createSimulation(new Empty());
  const simId = simResponse.simId;
  if (!simId) {
    throw new Error('CreateSimulation failed: empty sim_id returned');
  }
  console.log('[SimulationManagerService] Step 1 - CreateSimulation:', simId);
  return simId;
}

export async function addTask(
  simId: string,
  task: { taskType?: string; args: string[] }
): Promise<string> {
  const request = new AddTaskRequest({
    simId,
    taskType: task.taskType || TASK_TYPE,
    args: task.args,
    startMode: StartMode.AUTO,
  });
  const taskResponse = await smClient.addTask(request);
  if (!taskResponse.taskId) {
    throw new Error(`AddTask failed: empty task_id returned for sim ${simId}`);
  }
  return taskResponse.taskId;
}

export async function build(
  simId: string,
  sharedConfigs: string[] = [],
  headers: Record<string, string> = {}
): Promise<void> {
  const safeHeaders = { ...headers };
  // Browser Headers only accept ISO-8859-1 bytes. Encode UTF-8 text headers explicitly.
  if (safeHeaders['x-bff-title']) {
    safeHeaders['x-bff-title'] = encodeURIComponent(safeHeaders['x-bff-title']);
  }
  if (safeHeaders['x-bff-description']) {
    safeHeaders['x-bff-description'] = encodeURIComponent(safeHeaders['x-bff-description']);
  }

  await smClient.build(new BuildRequest({
    simId,
    sharedConfigs,
  }), {
    headers: new Headers(safeHeaders),
  });
  console.log('[SimulationManagerService] Step 3 - Build complete:', simId);
}

// ============================================
// SimulationManager API
// ============================================

/**
 * Co-Sim: 다중 모델 시뮬레이션 생성 (3단계 Builder)
 */
export async function createAndBuildSimulation(params: {
  models: Array<{
    taskType?: string;
    args: string[];
  }>;
  sharedConfigs?: string[];
  buildRequestHeadersFactory?: BuildRequestHeadersFactory;
}): Promise<{ simId: string; taskIds: string[] }> {
  const tasks = params.models.map((model) => ({
    taskType: model.taskType,
    args: model.args,
  }));

  return await buildSimulation(
    tasks,
    params.sharedConfigs ?? [],
    params.buildRequestHeadersFactory
  );
}

/**
 * List all simulations
 */
export async function listSimulations(): Promise<SimulationInfoList> {
  return await smClient.listSimulations(new Empty());
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const trimmedTaskId = taskId.trim();
  if (!trimmedTaskId) {
    throw new Error('DeleteTask failed: empty task_id provided');
  }
  await smClient.deleteTask(new TaskId({ taskId: trimmedTaskId }));
}

/**
 * List task types
 */
export async function listTaskTypes() {
  return await smClient.listTaskTypes(new Empty());
}

export const isMockMode = () => false;

// ============================================
// Service object export
// ============================================

export const simulationManagerService = {
  createSession,
  closeSession,
  setSessionId,
  getSessionId,
  createSimulation,
  addTask,
  build,
  createAndBuildSimulation,
  listSimulations,
  deleteTask,
  listTaskTypes,
  isMockMode,
  retryOperation,
};

export default simulationManagerService;
