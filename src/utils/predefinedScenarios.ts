/**
 * 사전정의 원전 사고 시나리오
 *
 * 정상 운전 조건 (APR1400 기준):
 *   - 1차측 압력: 15.5 MPa (운전), 범위 14~16 MPa
 *   - 1차측 온도: 290~330°C (냉각재)
 *   - 유량: 약 100~200 kg/s (루프당)
 *   - 밸브: 0~100% (정상 범위)
 *
 * 시나리오 조건은 정상 운전 범위를 벗어난 **사고 수준**으로 설정.
 * 기본 enabled=false로 설정하여 사용자가 필요한 시나리오만 활성화.
 */

import type { AlarmScenario } from '@/types/interactive';

/** 8개 사전정의 시나리오 생성 */
export function createPredefinedScenarios(): AlarmScenario[] {
  return [
    {
      id: 'predefined-LOCA',
      name: 'LOCA',
      nameKo: '냉각재 상실 사고',
      description: 'Loss of Coolant Accident: 급격한 압력 저하 + 온도 상승',
      source: 'predefined',
      level: 'danger',
      conditions: [
        { id: 'loca-p', dataKey: 'pressure', operator: '<', value: 7, unit: 'MPa', scope: { type: 'any' } },
        { id: 'loca-t', dataKey: 'temperature', operator: '>', value: 350, unit: '°C', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: false,
      priority: 1,
    },
    {
      id: 'predefined-SGTR',
      name: 'SGTR',
      nameKo: '증기발생기 세관 파단',
      description: 'Steam Generator Tube Rupture: 2차측 압력 비정상 상승 + 유량 급감',
      source: 'predefined',
      level: 'danger',
      conditions: [
        { id: 'sgtr-p', dataKey: 'pressure', operator: '>', value: 17, unit: 'MPa', scope: { type: 'any' } },
        { id: 'sgtr-w', dataKey: 'flowRate', operator: '<', value: 5, unit: 'kg/s', scope: { type: 'any' } },
      ],
      logic: 'OR',
      enabled: false,
      priority: 2,
    },
    {
      id: 'predefined-OVERPRESSURE_WARNING',
      name: 'Overpressure',
      nameKo: '과압 경고',
      description: '계통 압력이 경고 한계를 초과',
      source: 'predefined',
      level: 'warning',
      conditions: [
        { id: 'op-w', dataKey: 'pressure', operator: '>', value: 16.5, unit: 'MPa', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: true,
      priority: 10,
    },
    {
      id: 'predefined-OVERPRESSURE_DANGER',
      name: 'Overpressure',
      nameKo: '과압 위험',
      description: '계통 압력이 위험 한계를 초과',
      source: 'predefined',
      level: 'danger',
      conditions: [
        { id: 'op-d', dataKey: 'pressure', operator: '>', value: 17.2, unit: 'MPa', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: true,
      priority: 3,
    },
    {
      id: 'predefined-OVERCOOLING',
      name: 'Overcooling',
      nameKo: '과냉',
      description: '계통 온도가 급격히 저하',
      source: 'predefined',
      level: 'warning',
      conditions: [
        { id: 'oc-t', dataKey: 'temperature', operator: '<', value: 180, unit: '°C', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: false,
      priority: 11,
    },
    {
      id: 'predefined-CORE_DAMAGE',
      name: 'Core Damage',
      nameKo: '노심 손상',
      description: '극한 온도 + 극한 압력 조합',
      source: 'predefined',
      level: 'danger',
      conditions: [
        { id: 'cd-t', dataKey: 'temperature', operator: '>', value: 400, unit: '°C', scope: { type: 'any' } },
        { id: 'cd-p', dataKey: 'pressure', operator: '>', value: 17.5, unit: 'MPa', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: false,
      priority: 0,
    },
    {
      id: 'predefined-PUMP_FAILURE',
      name: 'Pump Failure',
      nameKo: '펌프 고장',
      description: '유량이 거의 0에 가깝게 감소',
      source: 'predefined',
      level: 'danger',
      conditions: [
        { id: 'pf-w', dataKey: 'flowRate', operator: '<', value: 2, unit: 'kg/s', scope: { type: 'any' } },
      ],
      logic: 'AND',
      enabled: false,
      priority: 4,
    },
    {
      id: 'predefined-VALVE_MALFUNCTION',
      name: 'Valve Malfunction',
      nameKo: '밸브 고장',
      description: '밸브가 완전 개방 또는 완전 폐쇄 상태',
      source: 'predefined',
      level: 'warning',
      conditions: [
        { id: 'vm-hi', dataKey: 'valvePosition', operator: '>', value: 98, unit: '%', scope: { type: 'any' } },
        { id: 'vm-lo', dataKey: 'valvePosition', operator: '<', value: 2, unit: '%', scope: { type: 'any' } },
      ],
      logic: 'OR',
      enabled: false,
      priority: 12,
    },
  ];
}
