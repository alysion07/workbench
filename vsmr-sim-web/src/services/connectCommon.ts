import type { Interceptor } from "@connectrpc/connect";
import { supabase } from "@/lib/supabase";

export function getRuntimeEnvVar(
  key: string,
  buildTimeValue: string | undefined,
  defaultValue: string = ""
): string {
  if (typeof window !== "undefined" && (window as any).__ENV && (window as any).__ENV[key] != null) {
    return (window as any).__ENV[key];
  }
  return buildTimeValue || defaultValue;
}

export const BFF_URL = getRuntimeEnvVar(
  "VITE_BFF_URL",
  import.meta.env.VITE_BFF_URL,
  "http://localhost:8080"
);

interface AuthInterceptorOptions {
  getSessionId?: () => string | null;
  getTaskId?: () => string | null;
  getSimId?: () => string | null;
  includeLegacySessionHeader?: boolean;
  includeLegacyTaskHeader?: boolean;
}

export function createAuthInterceptor(options: AuthInterceptorOptions = {}): Interceptor {
  const {
    getSessionId,
    getTaskId,
    getSimId,
    includeLegacySessionHeader = false,
    includeLegacyTaskHeader = false,
  } = options;

  return (next) => async (req) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      req.header.set("Authorization", `Bearer ${session.access_token}`);
    }
    if (session?.user?.id) {
      req.header.set("x-auth-user-id", session.user.id);
    }

    const sessionId = getSessionId?.();
    if (sessionId) {
      req.header.set("X-Session-Id", sessionId);
      if (includeLegacySessionHeader) {
        req.header.set("session_id", sessionId);
      }
    }

    const taskId = getTaskId?.();
    if (taskId) {
      req.header.set("X-Task-Id", taskId);
      if (includeLegacyTaskHeader) {
        req.header.set("task_id", taskId);
      }
    }

    const simId = getSimId?.();
    if (simId) {
      req.header.set("X-Simulation-Id", simId);
    }

    return await next(req);
  };
}
