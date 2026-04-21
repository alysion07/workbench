/**
 * Co-Sim 설정 Store (Zustand)
 * preCICE 설정 GUI 상태 관리 — simulationStore(런타임)과 분리
 *
 * 저장: ProjectData.coSimConfig (Supabase)
 * localStorage 미사용
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  CoSimConfig,
  CouplingComponentGroup,
  CouplingSchemeType,
  MappingType,
  PreciceDataName,
  CoSimValidationResult,
} from '@/types/cosim';
import {
  createDefaultCoSimConfig,
  validateCoSimConfig,
  PRECICE_TO_MARS_VARIABLE,
} from '@/types/cosim';

interface CoSimConfigStore {
  /** Co-Sim 설정 전체 */
  config: CoSimConfig;

  /** 설정 변경 추적 */
  isDirty: boolean;

  // Actions: 초기화/로드
  loadConfig: (config: CoSimConfig | null) => void;
  /** JSON import: config를 교체하고 isDirty=true (사용자 명시 저장 필요) */
  setConfigFromImport: (config: CoSimConfig | null) => void;
  resetConfig: () => void;

  // Actions: coupling_ids (컴포넌트 그룹)
  setComponentGroups: (groups: CouplingComponentGroup[]) => void;
  addComponentGroup: (group: CouplingComponentGroup) => void;
  removeComponentGroup: (componentNumber: string) => void;
  updateComponentGroup: (componentNumber: string, group: CouplingComponentGroup) => void;

  // Actions: 모델별 NML 설정
  /** Model 1 write/read 설정 → Model 2 자동 반전 */
  setModel1DataNames: (write: PreciceDataName, read: PreciceDataName) => void;
  setModel1InitWdata: (value: string | undefined) => void;
  setModel2InitWdata: (value: string | undefined) => void;

  // Actions: XML 설정
  setSchemeType: (type: CouplingSchemeType) => void;
  setMaxTime: (value: number) => void;
  setTimeWindowSize: (value: number) => void;
  setMappingType: (type: MappingType) => void;

  // Derived
  getValidation: () => CoSimValidationResult;
}

export const useCoSimConfigStore = create<CoSimConfigStore>()(
  devtools(
    (set, get) => ({
      config: createDefaultCoSimConfig(),
      isDirty: false,

      loadConfig: (config) =>
        set(
          { config: config ?? createDefaultCoSimConfig(), isDirty: false },
          false,
          'loadConfig',
        ),

      setConfigFromImport: (config) =>
        set(
          { config: config ?? createDefaultCoSimConfig(), isDirty: true },
          false,
          'setConfigFromImport',
        ),

      resetConfig: () =>
        set(
          { config: createDefaultCoSimConfig(), isDirty: false },
          false,
          'resetConfig',
        ),

      // coupling_ids
      setComponentGroups: (groups) =>
        set(
          (state) => ({
            config: { ...state.config, nml: { ...state.config.nml, componentGroups: groups } },
            isDirty: true,
          }),
          false,
          'setComponentGroups',
        ),

      addComponentGroup: (group) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                componentGroups: [...state.config.nml.componentGroups, group],
              },
            },
            isDirty: true,
          }),
          false,
          'addComponentGroup',
        ),

      removeComponentGroup: (componentNumber) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                componentGroups: state.config.nml.componentGroups.filter(
                  (g) => g.componentNumber !== componentNumber,
                ),
              },
            },
            isDirty: true,
          }),
          false,
          'removeComponentGroup',
        ),

      updateComponentGroup: (componentNumber, group) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                componentGroups: state.config.nml.componentGroups.map((g) =>
                  g.componentNumber === componentNumber ? group : g,
                ),
              },
            },
            isDirty: true,
          }),
          false,
          'updateComponentGroup',
        ),

      // Model 1 → Model 2 자동 반전
      setModel1DataNames: (write, read) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                model1: {
                  ...state.config.nml.model1,
                  writeDataName: write,
                  readDataName: read,
                },
                model2: {
                  ...state.config.nml.model2,
                  writeDataName: read,
                  readDataName: write,
                },
              },
            },
            isDirty: true,
          }),
          false,
          'setModel1DataNames',
        ),

      setModel1InitWdata: (value) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                model1: { ...state.config.nml.model1, initWdata: value },
              },
            },
            isDirty: true,
          }),
          false,
          'setModel1InitWdata',
        ),

      setModel2InitWdata: (value) =>
        set(
          (state) => ({
            config: {
              ...state.config,
              nml: {
                ...state.config.nml,
                model2: { ...state.config.nml.model2, initWdata: value },
              },
            },
            isDirty: true,
          }),
          false,
          'setModel2InitWdata',
        ),

      // XML 설정
      setSchemeType: (type) =>
        set(
          (state) => ({
            config: { ...state.config, xml: { ...state.config.xml, schemeType: type } },
            isDirty: true,
          }),
          false,
          'setSchemeType',
        ),

      setMaxTime: (value) =>
        set(
          (state) => ({
            config: { ...state.config, xml: { ...state.config.xml, maxTime: value } },
            isDirty: true,
          }),
          false,
          'setMaxTime',
        ),

      setTimeWindowSize: (value) =>
        set(
          (state) => ({
            config: { ...state.config, xml: { ...state.config.xml, timeWindowSize: value } },
            isDirty: true,
          }),
          false,
          'setTimeWindowSize',
        ),

      setMappingType: (type) =>
        set(
          (state) => ({
            config: { ...state.config, xml: { ...state.config.xml, mappingType: type } },
            isDirty: true,
          }),
          false,
          'setMappingType',
        ),

      // Derived
      getValidation: () => validateCoSimConfig(get().config),
    }),
    { name: 'CoSimConfigStore' },
  ),
);

/** write_variable 도출 헬퍼 (컴포넌트에서 사용) */
export function getWriteVariable(writeDataName: PreciceDataName | ''): string {
  if (!writeDataName) return '';
  return PRECICE_TO_MARS_VARIABLE[writeDataName];
}
