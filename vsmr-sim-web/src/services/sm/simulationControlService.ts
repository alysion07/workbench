/**
 * SimulationControl Connect-RPC Service
 * 시뮬레이션 단위 제어
 *
 * - 식별자: 메시지 필드 sim_id (SimulationId)
 * - 제어 단위: simulation 단위 (모든 task에 broadcast)
 * - 응답: SimulationControlReply (state.tasks[] 포함)
 */

import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { SimulationControl } from "@/stubs/sm/simulation_control_connect";
import { SimulationId } from "@/stubs/sm/simulation_manager_pb";
import { SetSimSpeedRequest } from "@/stubs/sm/simulation_control_pb";
import type { SimulationControlReply } from "@/stubs/sm/simulation_control_pb";
import { getSessionId } from "@/services/sm/simulationManagerService";
import { BFF_URL, createAuthInterceptor } from "@/services/connectCommon";

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [
    createAuthInterceptor({ getSessionId }),
  ],
});

const controlClient = createPromiseClient(SimulationControl, transport);

function resolveId(id: string, operation: string): string {
  if (!id || !id.trim()) {
    throw new Error(`${operation}: sim_id is missing`);
  }
  return id.trim();
}

function makeSimId(simId: string): SimulationId {
  return new SimulationId({ simId });
}

// ============================================
// SimulationControl API
// ============================================

export async function startSim(simId: string): Promise<SimulationControlReply> {
  const id = resolveId(simId, 'startSim');
  return await controlClient.start(makeSimId(id));
}

export async function pauseSim(simId: string): Promise<SimulationControlReply> {
  const id = resolveId(simId, 'pauseSim');
  console.log('[SimulationControlService] pauseSim:', id);
  try {
    const reply = await controlClient.pause(makeSimId(id));
    console.log('[SimulationControlService] pauseSim response:', {
      accepted: reply.accepted,
      reason: reply.reason,
    });
    return reply;
  } catch (error) {
    console.error('[SimulationControlService] pauseSim failed:', error);
    throw error;
  }
}

export async function resumeSim(simId: string): Promise<SimulationControlReply> {
  const id = resolveId(simId, 'resumeSim');
  console.log('[SimulationControlService] resumeSim:', id);
  try {
    const reply = await controlClient.resume(makeSimId(id));
    console.log('[SimulationControlService] resumeSim response:', {
      accepted: reply.accepted,
      reason: reply.reason,
    });
    return reply;
  } catch (error) {
    console.error('[SimulationControlService] resumeSim failed:', error);
    throw error;
  }
}

export async function stopSim(simId: string): Promise<SimulationControlReply> {
  const id = resolveId(simId, 'stopSim');
  console.log('[SimulationControlService] stopSim:', id);
  try {
    const reply = await controlClient.stop(makeSimId(id));
    console.log('[SimulationControlService] stopSim response:', {
      accepted: reply.accepted,
      reason: reply.reason,
    });
    return reply;
  } catch (error) {
    console.error('[SimulationControlService] stopSim failed:', error);
    throw error;
  }
}

export async function setSimSpeed(simId: string, speedRatio: number): Promise<SimulationControlReply> {
  const id = resolveId(simId, 'setSimSpeed');
  console.log('[SimulationControlService] setSimSpeed:', { simId: id, speedRatio });
  try {
    const reply = await controlClient.setSimulationSpeed(
      new SetSimSpeedRequest({ simId: id, speedRatio })
    );
    console.log('[SimulationControlService] setSimSpeed response:', {
      accepted: reply.accepted,
      reason: reply.reason,
    });
    return reply;
  } catch (error) {
    console.error('[SimulationControlService] setSimSpeed failed:', error);
    throw error;
  }
}

export async function getSimSpeed(simId: string): Promise<number> {
  const id = resolveId(simId, 'getSimSpeed');
  const response = await controlClient.getSimulationSpeed(makeSimId(id));
  return response.value;
}

// ============================================
// Service object export
// ============================================

export const simulationControlService = {
  startSim,
  pauseSim,
  resumeSim,
  stopSim,
  setSimSpeed,
  getSimSpeed,
};

export default simulationControlService;
