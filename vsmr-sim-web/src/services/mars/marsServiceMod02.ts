/**
 * MARS Common Variables (MOD02) Connect-RPC Service
 * BFF 서버와의 Connect-RPC 통신을 담당
 */

import { createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { CommonVariables } from "@/stubs/mars/mars_service_mod02_connect";
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
 * Common Variables service client instance (MOD02) (internal use only)
 */
const commonVariablesClient: PromiseClient<typeof CommonVariables> = createPromiseClient(
  CommonVariables,
  transport
);

/**
 * ============================================================
 * MARS Common Variables (MOD02) Service API Wrapper
 * 웹 개발자가 사용하기 쉬운 래퍼 메소드 제공
 * ============================================================
 */

import { Empty } from "@bufbuild/protobuf";
import type { CVsSnapshot } from "@/stubs/mars/mars_service_mod02_pb";

/**
 * Get snapshot of all common variables
 */
export async function getSnapshot(): Promise<CVsSnapshot> {
  return await commonVariablesClient.getSnapshot(new Empty());
}

/**
 * Get time in Hy
 */
export async function getTimeHy(): Promise<number> {
  const response = await commonVariablesClient.getTimeHy(new Empty());
  return response.value;
}

/**
 * Get delta time (dt)
 */
export async function getDt(): Promise<number> {
  const response = await commonVariablesClient.getDt(new Empty());
  return response.value;
}

/**
 * Check if simulation is done
 */
export async function isDone(): Promise<boolean> {
  const response = await commonVariablesClient.isDone(new Empty());
  return response.value;
}

/**
 * Get problem type
 */
export async function getProblemType(): Promise<number> {
  const response = await commonVariablesClient.getProblemType(new Empty());
  return response.value;
}

/**
 * Get problem option
 */
export async function getProblemOpt(): Promise<number> {
  const response = await commonVariablesClient.getProblemOpt(new Empty());
  return response.value;
}

/**
 * MARS Common Variables service with wrapper methods
 */
export const commonVariables = {
  getSnapshot,
  getTimeHy,
  getDt,
  isDone,
  getProblemType,
  getProblemOpt,
};

/**
 * Export service as default
 */
export default commonVariables;
