/**
 * Demo Mode Hook
 * 더미 데이터를 실시간 생성하여 시뮬레이션 차트/로그를 가시화
 */

import { useRef, useCallback } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import type { MinorEdit } from '@/types/mars';
import type { PlotData } from '@/types/simulation';
import { buildDataKey } from '@/utils/chartConfigBuilder';

const DEMO_JOB_ID = 'demo-mode-job';
const DEMO_INTERVAL_MS = 200; // 200ms 간격으로 데이터 생성
const DEMO_TIME_STEP = 0.1; // 시뮬레이션 시간 증가분 (초)

/**
 * 기본 더미 MinorEdits
 * GlobalSettings에 minorEdits가 없을 때 사용되는 데모용 차트 설정
 * 원자로 주요 파라미터를 그룹별로 구성
 */
export const DEMO_MINOR_EDITS: MinorEdit[] = [
  // Group 1: Reactor Power
  {
    cardNumber: 301,
    variableType: 'rktpow',
    parameter: 0,
    lowerLimit: 0,
    upperLimit: 3.5e9,
    editGroup: 1,
    editPriority: 1,
    comment: 'Reactor Power',
  },
  // Group 2: Primary Loop Pressure (2개 볼륨 비교)
  {
    cardNumber: 302,
    variableType: 'p',
    parameter: 280010000,
    lowerLimit: 1.0e7,
    upperLimit: 1.7e7,
    editGroup: 2,
    editPriority: 1,
    comment: 'Core Inlet Pressure',
  },
  {
    cardNumber: 303,
    variableType: 'p',
    parameter: 280050000,
    lowerLimit: 1.0e7,
    upperLimit: 1.7e7,
    editGroup: 2,
    editPriority: 2,
    comment: 'Core Outlet Pressure',
  },
  // Group 3: Coolant Temperature (2개 볼륨 비교)
  {
    cardNumber: 304,
    variableType: 'tempf',
    parameter: 280010000,
    lowerLimit: 500,
    upperLimit: 650,
    editGroup: 3,
    editPriority: 1,
    comment: 'Core Inlet Temp',
  },
  {
    cardNumber: 305,
    variableType: 'tempf',
    parameter: 280050000,
    lowerLimit: 500,
    upperLimit: 650,
    editGroup: 3,
    editPriority: 2,
    comment: 'Core Outlet Temp',
  },
  // Group 4: Mass Flow Rate
  {
    cardNumber: 306,
    variableType: 'mflowj',
    parameter: 280000001,
    lowerLimit: 800,
    upperLimit: 1500,
    editGroup: 4,
    editPriority: 1,
    comment: 'Primary Loop Flow',
  },
  // Group 5: Pressurizer Pressure (알람 트리거 데모를 위해 범위를 높게 설정)
  {
    cardNumber: 307,
    variableType: 'p',
    parameter: 350010000,
    lowerLimit: 1.5e7,
    upperLimit: 1.8e7,
    editGroup: 5,
    editPriority: 1,
    comment: 'Pressurizer Pressure',
  },
  // Group 6: SG Secondary Side Temp
  {
    cardNumber: 308,
    variableType: 'tempf',
    parameter: 410010000,
    lowerLimit: 450,
    upperLimit: 570,
    editGroup: 6,
    editPriority: 1,
    comment: 'SG Secondary Temp',
  },
];

/**
 * 변수 타입별 더미 데이터 생성기
 * 실제 MARS 시뮬레이션 값 범위를 모사
 */
function generateDummyValue(
  variableType: string,
  time: number,
  paramIndex: number,
  lowerLimit: number,
  upperLimit: number,
): number {
  const range = upperLimit - lowerLimit;
  const mid = (upperLimit + lowerLimit) / 2;

  // 각 파라미터별 위상차를 주어 다른 곡선 생성
  const phase = paramIndex * 0.7;

  switch (variableType) {
    case 'rktpow': {
      // 원자로 출력: 초기 과도 후 안정화 (지수 감쇠 + 약간의 진동)
      const decay = 1 - Math.exp(-time / 5);
      const oscillation = Math.sin(time * 0.5 + phase) * 0.02;
      return mid + range * 0.4 * decay + range * oscillation;
    }
    case 'p': {
      // 압력: 초기 과도 + 느린 진동
      const base = mid + range * 0.1 * Math.sin(time * 0.3 + phase);
      const transient = range * 0.15 * Math.exp(-time / 10) * Math.cos(time * 2 + phase);
      return base + transient;
    }
    case 'tempf':
    case 'tempg': {
      // 온도: 점진적 상승 후 안정화
      const rise = mid + range * 0.3 * (1 - Math.exp(-time / 8));
      const fluctuation = range * 0.02 * Math.sin(time * 0.8 + phase);
      return rise + fluctuation;
    }
    case 'mflowj': {
      // 질량유량: 빠른 과도 후 안정 + 노이즈
      const steady = mid + range * 0.2 * (1 - Math.exp(-time / 3));
      const noise = range * 0.03 * Math.sin(time * 1.5 + phase) * Math.cos(time * 0.7);
      return steady + noise;
    }
    case 'voidf': {
      // 공극율: 0~1 범위, 느린 변동
      const base = 0.1 + 0.05 * Math.sin(time * 0.2 + phase);
      return Math.max(lowerLimit, Math.min(upperLimit, base));
    }
    case 'cntrlvar': {
      // 제어변수: 다양한 패턴 (step, ramp, oscillation)
      const pattern = paramIndex % 3;
      if (pattern === 0) {
        // Step response
        return time > 5 ? mid + range * 0.3 : mid - range * 0.1;
      } else if (pattern === 1) {
        // Ramp + stabilize
        return mid + range * 0.4 * Math.min(time / 15, 1);
      } else {
        // Oscillation
        return mid + range * 0.25 * Math.sin(time * 0.6 + phase);
      }
    }
    default: {
      return mid + range * 0.2 * Math.sin(time * 0.5 + phase);
    }
  }
}

/**
 * 더미 로그 메시지 생성
 */
function generateDemoLog(time: number): string {
  const messages = [
    `[MARS] Time step ${time.toFixed(3)}s - Advancing solution...`,
    `[MARS] Hydraulic iteration converged (iter=3, err=1.2e-06)`,
    `[MARS] Heat transfer calculation completed for all structures`,
    `[MARS] Control system evaluation: 0 trips active`,
    `[MARS] Mass/energy balance check: OK (rel_err=2.3e-08)`,
    `[MARS] Courant limit dt=0.050s, current dt=0.010s`,
    `[MARS] Reactor kinetics: power=${(3.0e9 * (0.95 + Math.random() * 0.1)).toExponential(3)} W`,
    `[MARS] Primary loop flow rate: ${(1200 + Math.random() * 50).toFixed(1)} kg/s`,
    `[MARS] Pressurizer pressure: ${(15.5e6 + Math.random() * 1e5).toExponential(4)} Pa`,
    `[MARS] Steam generator outlet temp: ${(550 + Math.random() * 5).toFixed(1)} K`,
  ];
  const idx = Math.floor(Math.random() * messages.length);
  return messages[idx];
}

/** Co-Sim 데모용 모델 정보 */
interface DemoModelInfo {
  modelId: string;
  modelName: string;
}

/**
 * Demo Mode Hook
 * @param minorEdits GlobalSettings의 minorEdits (있으면 사용, 없으면 DEMO_MINOR_EDITS)
 * @param models 프로젝트의 모델 목록 (2+ 이면 Co-Sim 데모)
 */
export function useDemoMode(minorEdits?: MinorEdit[], models?: DemoModelInfo[]) {
  // minorEdits가 없거나 비어있으면 더미 minorEdits 사용
  const effectiveEdits = minorEdits && minorEdits.length > 0 ? minorEdits : DEMO_MINOR_EDITS;
  const isCoSim = models && models.length > 1;

  const intervalRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const {
    setActiveModel, updateModel,
    initCoSimSession, appendModelPlotData, appendModelScreenLog,
    setModelLatestMinorEdit, clearCoSimSession,
  } = useSimulationStore();

  const startDemo = useCallback(() => {
    // 이전 세션 정리
    clearCoSimSession();
    timeRef.current = 0;

    if (isCoSim && models) {
      // ── Co-Sim 데모 모드 ──
      const demoSimId = 'demo-cosim-session';
      const modelInfos = models.map((m, i) => ({
        modelId: m.modelId,
        modelName: m.modelName,
        taskId: `demo-task-${i}`,
        taskIndex: i,
      }));

      // Co-Sim 세션 초기화 (lifecycle 포함)
      initCoSimSession(demoSimId, 'demo-project', modelInfos.map((m) => ({
        ...m,
        args: `demo-cosim-${m.modelName}`,
        taskMode: 'new' as const,
        status: 'running' as const,
      })));

      appendModelScreenLog(modelInfos[0].modelId, '[DEMO] ===== Co-Sim Demo Mode Started =====');
      models.forEach((m, i) => appendModelScreenLog(modelInfos[i].modelId, `[DEMO] Model: ${m.modelName} (${m.modelId})`));

      // 주기적 데이터 생성 (모델별)
      intervalRef.current = window.setInterval(() => {
        const time = timeRef.current;

        modelInfos.forEach((modelInfo, modelIdx) => {
          const point: PlotData = { time };
          effectiveEdits.forEach((edit, idx) => {
            const { variableType, lowerLimit, upperLimit } = edit;

            // 모델별 위상 차이: paramIndex에 모델 오프셋 추가
            const value = generateDummyValue(variableType, time, idx + modelIdx * 10, lowerLimit, upperLimit);
            point[buildDataKey(edit)] = value;
            point[`v${idx}`] = value;
          });

          appendModelPlotData(modelInfo.modelId, point);

          // 모델별 MinorEdit 스냅샷
          setModelLatestMinorEdit(modelInfo.modelId, {
            timehy: time * 1000,
            tsMs: Date.now(),
            seq: Math.floor(time / DEMO_TIME_STEP),
            values: effectiveEdits.map((edit, idx) => ({
              name: `${edit.variableType}_${edit.parameter}`,
              value: point[`v${idx}`] as number,
            })),
          });

          // 모델별 로그 (10 스텝마다, 모델 간 시차)
          if (Math.floor(time * 10) % 10 === modelIdx * 3) {
            appendModelScreenLog(modelInfo.modelId, `[${modelInfo.modelName}] ${generateDemoLog(time)}`);
          }
        });

        // 글로벌 로그 (첫 번째 모델에 기록)
        if (Math.floor(time * 10) % 15 === 0) {
          appendModelScreenLog(modelInfos[0].modelId, `[DEMO] Co-Sim sync point t=${time.toFixed(1)}s`);
        }

        timeRef.current += DEMO_TIME_STEP;
      }, DEMO_INTERVAL_MS);
    } else {
      // ── 단일 모델 데모 모드 (coSimSession 통합) ──
      const demoModelId = `single-${DEMO_JOB_ID}`;
      initCoSimSession(DEMO_JOB_ID, 'demo-project', [{
        modelId: demoModelId,
        modelName: 'Demo Mode',
        taskId: DEMO_JOB_ID,
        taskIndex: 0,
        args: 'demo-mode',
        taskMode: 'new',
        status: 'running',
      }]);
      setActiveModel(demoModelId);

      appendModelScreenLog(demoModelId, '[DEMO] ===== Demo Mode Started =====');
      appendModelScreenLog(demoModelId, '[DEMO] Generating dummy simulation data...');

      intervalRef.current = window.setInterval(() => {
        const time = timeRef.current;
        const point: PlotData = { time };

        effectiveEdits.forEach((edit, idx) => {
          const { variableType, lowerLimit, upperLimit } = edit;

          const value = generateDummyValue(variableType, time, idx, lowerLimit, upperLimit);
          point[buildDataKey(edit)] = value;
          point[`v${idx}`] = value;
        });

        appendModelPlotData(demoModelId, point);

        setModelLatestMinorEdit(demoModelId, {
          timehy: time * 1000,
          tsMs: Date.now(),
          seq: Math.floor(time / DEMO_TIME_STEP),
          values: effectiveEdits.map((edit, idx) => ({
            name: `${edit.variableType}_${edit.parameter}`,
            value: point[`v${idx}`] as number,
          })),
        });

        if (Math.floor(time * 10) % 5 === 0) {
          appendModelScreenLog(demoModelId, generateDemoLog(time));
        }

        timeRef.current += DEMO_TIME_STEP;
      }, DEMO_INTERVAL_MS);
    }
  }, [effectiveEdits, isCoSim, models, setActiveModel, initCoSimSession, appendModelPlotData, appendModelScreenLog, setModelLatestMinorEdit, clearCoSimSession]);

  const stopDemo = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 중지 로그를 activeModel에 기록
    const state = useSimulationStore.getState();
    const session = state.coSimSession;
    if (session) {
      const firstModelId = Object.keys(session.models)[0];
      if (firstModelId) {
        appendModelScreenLog(firstModelId, `[DEMO] ===== Demo Mode Stopped (t=${timeRef.current.toFixed(1)}s) =====`);
      }
    }

    if (isCoSim && models) {
      models.forEach((m) => {
        updateModel(m.modelId, { status: 'completed', endTime: Date.now() });
      });
    } else {
      const demoModelId = `single-${DEMO_JOB_ID}`;
      updateModel(demoModelId, { status: 'completed', endTime: Date.now() });
    }
  }, [appendModelScreenLog, updateModel, isCoSim, models]);

  return { startDemo, stopDemo, demoJobId: DEMO_JOB_ID, effectiveEdits };
}
