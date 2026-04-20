import { Code, ConnectError, createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ProjectManager } from "@/stubs/pm/project_manager_connect";
import {
  CreateProjectRequest,
  DeleteProjectRequest,
  ListSimulationHistoriesByProjectRequest,
  type Project as PmProject,
  type SimulationHistory as PmSimulationHistory,
  UpdateProjectRequest,
} from "@/stubs/pm/project_manager_pb";
import { BFF_URL, createAuthInterceptor } from "@/services/connectCommon";
import type { Project, ProjectData, SimulationEntry } from "@/types/supabase";

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [createAuthInterceptor()],
});

const projectManagerClient: PromiseClient<typeof ProjectManager> = createPromiseClient(
  ProjectManager,
  transport
);

function toIsoTimestamp(timestamp: { seconds?: bigint | number | string; nanos?: number } | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  let seconds = 0;
  if (typeof timestamp.seconds === "bigint") {
    seconds = Number(timestamp.seconds);
  } else if (typeof timestamp.seconds === "string") {
    seconds = Number(timestamp.seconds);
  } else if (typeof timestamp.seconds === "number") {
    seconds = timestamp.seconds;
  }

  const nanos = typeof timestamp.nanos === "number" ? timestamp.nanos : 0;
  const millis = (seconds * 1000) + Math.floor(nanos / 1_000_000);
  return new Date(millis).toISOString();
}

function parseProjectData(dataJson: string): ProjectData | null {
  if (!dataJson) {
    return null;
  }

  try {
    return JSON.parse(dataJson) as ProjectData;
  } catch (error) {
    console.warn("[projectManagerService] Failed to parse project data_json", error);
    return null;
  }
}

function toProject(pmProject: PmProject): Project {
  return {
    id: pmProject.id,
    user_id: pmProject.userId,
    name: pmProject.name,
    description: pmProject.description || null,
    data: parseProjectData(pmProject.dataJson),
    created_at: toIsoTimestamp(pmProject.createdAt),
    updated_at: toIsoTimestamp(pmProject.updatedAt),
  };
}

function mapSimulationStatus(status: string): SimulationEntry['status'] {
  const s = String(status || '').toLowerCase();
  if (s.includes('run')) return 'Running';
  if (s.includes('fail') || s.includes('error')) return 'Failed';
  if (s.includes('stop') || s.includes('cancel')) return 'Stopped';
  return 'Success';
}

function toSimulationEntry(sh: PmSimulationHistory): SimulationEntry {
  const simulationId = String((sh as any).simulationId ?? (sh as any).taskId ?? '');
  const startIso = toIsoTimestamp((sh as any).startTime);
  const endIso =
    (sh as any).endTime && (Number((sh as any).endTime.seconds) > 0 || (sh as any).endTime.nanos > 0)
      ? toIsoTimestamp((sh as any).endTime)
      : '';

  const timeRange = endIso
    ? `${new Date(startIso).toLocaleTimeString('ko-KR')} ~ ${new Date(endIso).toLocaleTimeString('ko-KR')}`
    : new Date(startIso).toLocaleTimeString('ko-KR');

  return {
    id: simulationId || `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String((sh as any).title || 'Simulation'),
    timestamp: startIso,
    duration: String((sh as any).cpuTime || '-'),
    timeRange,
    status: mapSimulationStatus((sh as any).status),
    modelId: '',
  };
}

export async function createProject(params: {
  userId: string;
  name: string;
  description?: string | null;
  data?: ProjectData | null;
}): Promise<Project> {
  const request = new CreateProjectRequest({
    userId: params.userId,
    name: params.name,
    description: params.description ?? "",
    dataJson: JSON.stringify(params.data ?? {}),
  });

  const response = await projectManagerClient.createProject(request);
  if (!response.project) {
    throw new Error("createProject response has no project");
  }

  return toProject(response.project);
}

export async function updateProject(params: {
  id: string;
  name: string;
  description?: string | null;
  data?: ProjectData | null;
}): Promise<Project> {
  const request = new UpdateProjectRequest({
    id: params.id,
    name: params.name,
    description: params.description ?? "",
    dataJson: JSON.stringify(params.data ?? {}),
  });

  const response = await projectManagerClient.updateProject(request);
  if (!response.project) {
    throw new Error("updateProject response has no project");
  }

  return toProject(response.project);
}

export async function deleteProject(id: string): Promise<void> {
  await projectManagerClient.deleteProject(new DeleteProjectRequest({ id }));
}

export async function listSimulationHistoriesByProject(
  projectId: string,
  pageSize = 50,
): Promise<SimulationEntry[]> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return [];
  }

  const request = new ListSimulationHistoriesByProjectRequest({
    projectId: normalizedProjectId,
    pageSize,
  });
  const response = await projectManagerClient.listSimulationHistoriesByProject(request);
  return (response.simulationHistories || []).flatMap((history) => {
    try {
      return [toSimulationEntry(history)];
    } catch (error) {
      console.warn('[projectManagerService] Failed to map simulation history row', history, error);
      return [];
    }
  });
}

export function isNotFoundConnectError(error: unknown): boolean {
  return error instanceof ConnectError && error.code === Code.NotFound;
}

export const projectManagerService = {
  createProject,
  updateProject,
  deleteProject,
  listSimulationHistoriesByProject,
  isNotFoundConnectError,
};
