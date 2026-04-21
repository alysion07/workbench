/**
 * MARS Interactive Control (MOD06) Connect-RPC Service
 * BFF 서버와의 Connect-RPC 통신을 담당
 */

import { createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { InteractiveControl } from "@/stubs/mars/mars_service_mod06_connect";
import { getActiveTaskId } from "@/stores/simulationStore";
import { getSessionId } from "@/services/sm/simulationManagerService";
import { BFF_URL, createAuthInterceptor } from "@/services/connectCommon";

const authSessionInterceptor = createAuthInterceptor({
  getSessionId,
  getTaskId: () => getActiveTaskId(),
});

/**
 * Create Connect transport for BFF server
 */
const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [authSessionInterceptor],
});

/**
 * Interactive Control service client instance (MOD06) (internal use only)
 */
const interactiveControlClient: PromiseClient<typeof InteractiveControl> = createPromiseClient(
  InteractiveControl,
  transport
);

/**
 * ============================================================
 * MARS Interactive Control (MOD06) Service API Wrapper
 * 웹 개발자가 사용하기 쉬운 래퍼 메소드 제공
 * ============================================================
 */

import { Empty } from "@bufbuild/protobuf";
import type { 
  ICVTypeSummary, 
  ICVSnapshotList, 
  ICVSnapshot,
} from "@/stubs/mars/mars_service_mod06_pb";
import {
  ListICVsByTypeRequest,
  GetICVRequest,
  SetICVRequest,
  ICVPatch,
  ICVType,
  ControlMode,
} from "@/stubs/mars/mars_service_mod06_pb";

/**
 * Get ICV type summary (total count + per-type counts)
 */
export async function getICVTypeSummary(): Promise<ICVTypeSummary> {
  return await interactiveControlClient.getICVTypeSummary(new Empty());
}

/**
 * Get all ICVs (recommended for UI polling)
 */
export async function getAllICVs(): Promise<ICVSnapshotList> {
  return await interactiveControlClient.getAllICVs(new Empty());
}

/**
 * Get ICVs filtered by type
 * @param icvType - ICV type to filter
 */
export async function getICVsByType(icvType: ICVType): Promise<ICVSnapshotList> {
  const request = new ListICVsByTypeRequest({ type: icvType });
  return await interactiveControlClient.getICVsByType(request);
}

/**
 * Get a single ICV snapshot
 * @param objectId - Object ID of the ICV
 */
export async function getICV(objectId: number): Promise<ICVSnapshot> {
  const request = new GetICVRequest({ objectId });
  return await interactiveControlClient.getICV(request);
}

/**
 * Set ICV parameters (forward-only command)
 * @param objectId - Object ID of the ICV
 * @param patch - ICV patch with target, rate, or control mode
 */
export async function setICV(
  objectId: number,
  patch: { target?: number; rate?: number; cmode?: ControlMode }
): Promise<void> {
  const icvPatch = new ICVPatch({
    target: patch.target,
    rate: patch.rate,
    ...(patch.cmode !== undefined
      ? { cmodePatch: { case: "cmode" as const, value: patch.cmode } }
      : {}),
  });
  const request = new SetICVRequest({ objectId, patch: icvPatch });
  await interactiveControlClient.setICV(request);
}

/**
 * Set ICV target value (convenience wrapper)
 * @param objectId - Object ID of the ICV
 * @param target - Target value
 */
export async function setICVTarget(objectId: number, target: number): Promise<void> {
  return setICV(objectId, { target });
}

/**
 * Set ICV rate (convenience wrapper)
 * @param objectId - Object ID of the ICV
 * @param rate - Rate value
 */
export async function setICVRate(objectId: number, rate: number): Promise<void> {
  return setICV(objectId, { rate });
}

/**
 * MARS Interactive Control service with wrapper methods
 */
export const interactiveControl = {
  getICVTypeSummary,
  getAllICVs,
  getICVsByType,
  getICV,
  setICV,
  setICVTarget,
  setICVRate,
};

/**
 * Export service as default
 */
export default interactiveControl;
