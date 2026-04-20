import { createPromiseClient, Code, ConnectError } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { MarsTaskStream } from '@/stubs/mars/mars_task_stream_connect';
import { TaskId } from '@/stubs/tm/task_manager_pb';
import { SimulationId } from '@/stubs/sm/simulation_manager_pb';
import { getSessionId } from '@/services/sm/simulationManagerService';
import { BFF_URL, createAuthInterceptor } from '@/services/connectCommon';
import type { SimStateSnapshot } from '@/types/simulation';
import type { SimulationState } from '@/stubs/sm/simulation_control_pb';

const authSessionInterceptor = createAuthInterceptor({
  getSessionId,
});

export interface PollingCallbacks {
  onScreenLog?: (log: string) => void;
  onScreenLogs?: (logs: string[]) => void;
  onMinorEdit?: (data: any) => void;
  onSimState?: (state: SimStateSnapshot) => void;
  onError?: (error: Error) => void;
}

export interface SimulationStateStreamCallbacks {
  onSimulationState?: (state: SimulationState) => void;
  onError?: (error: Error) => void;
}

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [authSessionInterceptor],
});

const streamClient = createPromiseClient(MarsTaskStream, transport);

// 다중 스트림 관리: streamKey(modelId) → stop function
const activeStreams = new Map<string, { taskId: string; stop: () => void }>();

// 레거시 호환용 (단일 스트림)
let activeTaskId: string | null = null;
let activeStop: (() => void) | null = null;

// simulation 단위 상태 스트림 (단일 활성 스트림)
let activeSimulationId: string | null = null;
let activeSimulationStop: (() => void) | null = null;

const RETRYABLE_CODES = new Set<Code>([
  Code.Canceled,
  Code.Unknown,
  Code.DeadlineExceeded,
  Code.ResourceExhausted,
  Code.Aborted,
  Code.Internal,
  Code.Unavailable,
]);

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ConnectError)) {
    return true;
  }

  return RETRYABLE_CODES.has(error.code);
}

function getBackoffDelayMs(attempt: number): number {
  const base = Math.min(10000, 500 * (2 ** attempt));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

async function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function startConnectTaskStream(
  taskId: string,
  callbacks: PollingCallbacks,
  options?: { replaceActive?: boolean }
): Promise<() => void> {
  console.log('[ConnectTaskStreamService] Starting Connect stream for task:', taskId);

  const replaceActive = options?.replaceActive ?? true;

  if (replaceActive && activeStop && activeTaskId !== taskId) {
    activeStop();
    activeStop = null;
    activeTaskId = null;
  }

  const abortController = new AbortController();
  const { signal } = abortController;

  const screenLogBuffer: string[] = [];
  const flushScreenLogs = () => {
    if (screenLogBuffer.length === 0) return;
    const batch = screenLogBuffer.splice(0, screenLogBuffer.length);
    if (callbacks.onScreenLogs) {
      callbacks.onScreenLogs(batch);
      return;
    }
    if (callbacks.onScreenLog) {
      batch.forEach((line) => callbacks.onScreenLog?.(line));
    }
  };

  const flushTimer = window.setInterval(flushScreenLogs, 500);
  const request = new TaskId({ taskId });

  const runScreenLogLoop = async () => {
    let attempt = 0;

    while (!signal.aborted) {
      try {
        const stream = streamClient.subscribeScreenLog(request, { signal });

        for await (const message of stream) {
          attempt = 0;
          if (typeof message.line === 'string') {
            screenLogBuffer.push(message.line);
          }
        }

        return;
      } catch (error) {
        if (signal.aborted) return;

        if (!isRetryableError(error)) {
          callbacks.onError?.(
            error instanceof Error ? error : new Error('Screen log stream failed')
          );
          return;
        }

        const delayMs = getBackoffDelayMs(attempt);
        attempt += 1;
        console.warn(`[ConnectTaskStreamService] ScreenLog reconnect in ${delayMs}ms (attempt=${attempt})`);
        await waitWithAbort(delayMs, signal);
      }
    }
  };

  const runMinorEditLoop = async () => {
    if (!callbacks.onMinorEdit) return;

    let attempt = 0;

    while (!signal.aborted) {
      try {
        const stream = streamClient.subscribeMinorEdit(request, { signal });

        for await (const message of stream) {
          attempt = 0;

          callbacks.onMinorEdit({
            ts_ms: Number(message.tsMs),
            timehy: Number(message.timehy),
            task_id: message.taskId,
            seq: Number(message.seq),
            values: (message.values || []).map((item) => ({
              name: item.name,
              value: item.value,
            })),
          });
        }

        return;
      } catch (error) {
        if (signal.aborted) return;

        if (!isRetryableError(error)) {
          console.error('[ConnectTaskStreamService] MinorEdit non-retryable error:', error);
          callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        const delayMs = getBackoffDelayMs(attempt);
        attempt += 1;
        console.warn(`[ConnectTaskStreamService] MinorEdit reconnect in ${delayMs}ms (attempt=${attempt})`);
        await waitWithAbort(delayMs, signal);
      }
    }
  };

  const runSimStateLoop = async () => {
    if (!callbacks.onSimState) return;

    let attempt = 0;

    while (!signal.aborted) {
      try {
        const stream = streamClient.subscribeSimState(request, { signal });

        for await (const message of stream) {
          attempt = 0;

          callbacks.onSimState({
            task_id: message.taskId,
            seq: Number(message.seq),
            ts_ms: Number(message.tsMs),
            timehy: Number(message.timehy),
            status: message.status,
            iteration_count: Number(message.iterationCount),
            target_speed: Number(message.targetSpeed),
            actual_speed: Number(message.actualSpeed),
            max_speed: Number(message.maxSpeed),
          });
        }

        return;
      } catch (error) {
        if (signal.aborted) return;

        if (!isRetryableError(error)) {
          console.error('[ConnectTaskStreamService] SimState non-retryable error:', error);
          callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        const delayMs = getBackoffDelayMs(attempt);
        attempt += 1;
        console.warn(`[ConnectTaskStreamService] SimState reconnect in ${delayMs}ms (attempt=${attempt})`);
        await waitWithAbort(delayMs, signal);
      }
    }
  };

  void runScreenLogLoop();
  void runMinorEditLoop();
  void runSimStateLoop();

  const stop = () => {
    console.log('[ConnectTaskStreamService] Stopping Connect stream');
    abortController.abort();
    window.clearInterval(flushTimer);
    flushScreenLogs();

    if (replaceActive && activeTaskId === taskId) {
      activeTaskId = null;
      activeStop = null;
    }
  };

  if (replaceActive) {
    activeTaskId = taskId;
    activeStop = stop;
  }

  return stop;
}

export async function startSimulationStateStream(
  simulationId: string,
  callbacks: SimulationStateStreamCallbacks,
  options?: { replaceActive?: boolean }
): Promise<() => void> {
  const normalizedSimulationId = simulationId.trim();
  if (!normalizedSimulationId) {
    throw new Error('simulationId is required');
  }

  const replaceActive = options?.replaceActive ?? true;

  if (replaceActive && activeSimulationStop && activeSimulationId !== normalizedSimulationId) {
    activeSimulationStop();
    activeSimulationStop = null;
    activeSimulationId = null;
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  const request = new SimulationId({ simId: normalizedSimulationId });

  const runSimulationStateLoop = async () => {
    let attempt = 0;

    while (!signal.aborted) {
      try {
        const stream = streamClient.subscribeSimulationState(request, { signal });

        for await (const message of stream) {
          attempt = 0;
          callbacks.onSimulationState?.(message);
        }

        return;
      } catch (error) {
        if (signal.aborted) return;

        if (!isRetryableError(error)) {
          callbacks.onError?.(
            error instanceof Error ? error : new Error('Simulation state stream failed')
          );
          return;
        }

        const delayMs = getBackoffDelayMs(attempt);
        attempt += 1;
        console.warn(`[ConnectTaskStreamService] SimulationState reconnect in ${delayMs}ms (attempt=${attempt})`);
        await waitWithAbort(delayMs, signal);
      }
    }
  };

  void runSimulationStateLoop();

  const stop = () => {
    abortController.abort();

    if (replaceActive && activeSimulationId === normalizedSimulationId) {
      activeSimulationId = null;
      activeSimulationStop = null;
    }
  };

  if (replaceActive) {
    activeSimulationId = normalizedSimulationId;
    activeSimulationStop = stop;
  }

  return stop;
}

/**
 * Co-Sim 다중 스트림: streamKey(modelId) 기반으로 개별 스트림 관리
 */
export async function startModelStream(
  streamKey: string,
  taskId: string,
  callbacks: PollingCallbacks
): Promise<() => void> {
  // 기존 동일 streamKey 스트림이 있으면 중지
  const existing = activeStreams.get(streamKey);
  if (existing) {
    existing.stop();
    activeStreams.delete(streamKey);
  }

  const stop = await startConnectTaskStream(taskId, callbacks, { replaceActive: false });

  const wrappedStop = () => {
    stop();
    activeStreams.delete(streamKey);
  };

  activeStreams.set(streamKey, { taskId, stop: wrappedStop });
  return wrappedStop;
}

/**
 * 특정 모델의 스트림 중지
 */
export function stopStream(streamKey: string): void {
  const entry = activeStreams.get(streamKey);
  if (entry) {
    entry.stop();
    // stop() 내부에서 activeStreams.delete 호출됨
  }
}

/**
 * 모든 모델 스트림 중지
 */
export function stopAllStreams(): void {
  for (const [, entry] of activeStreams) {
    entry.stop();
  }
  activeStreams.clear();

  // 레거시 싱글턴도 정리
  if (activeStop) {
    activeStop();
    activeStop = null;
    activeTaskId = null;
  }

  if (activeSimulationStop) {
    activeSimulationStop();
    activeSimulationStop = null;
    activeSimulationId = null;
  }
}

export const connectTaskStreamService = {
  startConnectTaskStream,
  startSimulationStateStream,
  startModelStream,
  stopStream,
  stopAllStreams,
};

export default connectTaskStreamService;
