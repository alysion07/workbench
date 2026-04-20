/**
 * Project Data Migration Utility
 *
 * 레거시 프로젝트 데이터를 새 구조(models[])로 자동 변환
 * - 기존: { nodes, edges, globalSettings, metadata }
 * - 신규: { totalScope, models[], updateHistory[], simulationHistory[] }
 */

import type {
  ProjectData,
  Model,
  ModelScope,
  VersionEntry,
  AnalysisCode,
  SystemScope,
} from '@/types/supabase';
import { migrateProjectNodeIds } from './nodeIdMigration';

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

/**
 * 현재 ISO 타임스탬프 생성
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 레거시 데이터인지 확인
 * - nodes/edges가 있고 models가 없으면 레거시
 */
export function isLegacyProjectData(data: ProjectData | null): boolean {
  if (!data) return false;

  // models가 이미 있으면 새 구조
  if (data.models && data.models.length > 0) {
    return false;
  }

  // nodes 또는 edges가 있으면 레거시
  return !!(data.nodes?.length || data.edges?.length);
}

/**
 * 레거시 metadata.scope를 ModelScope로 변환
 */
function convertLegacyScope(metadata?: ProjectData['metadata']): ModelScope {
  const defaultScope: ModelScope = {
    systems: ['primary', 'secondary', 'bop'],
    components: [],
  };

  if (!metadata?.scope || metadata.scope.length === 0) {
    return defaultScope;
  }

  return {
    systems: metadata.scope as SystemScope[],
    components: [],
  };
}

/**
 * 레거시 analysisCode를 AnalysisCode[]로 변환
 */
function convertLegacyAnalysisCode(metadata?: ProjectData['metadata']): AnalysisCode[] {
  const analysisCode = metadata?.partition?.analysisCode;

  if (!analysisCode) {
    return ['MARS']; // 기본값
  }

  // 유효한 AnalysisCode인지 확인
  const validCodes: AnalysisCode[] = ['MARS', 'SPHINCS', 'Modelica'];
  if (validCodes.includes(analysisCode as AnalysisCode)) {
    return [analysisCode as AnalysisCode];
  }

  return ['MARS'];
}

/**
 * 레거시 프로젝트 데이터를 새 구조로 마이그레이션
 *
 * @param data 기존 ProjectData
 * @returns 마이그레이션된 ProjectData
 */
export function migrateProjectData(data: ProjectData | null): ProjectData {
  // null이면 빈 새 구조 반환
  if (!data) {
    return {
      totalScope: {
        systems: ['primary', 'secondary', 'bop'],
        components: [],
      },
      models: [],
      updateHistory: [],
      simulationHistory: [],
    };
  }

  // 이미 새 구조면 그대로 반환 (모델 내부 node ID 마이그레이션 적용)
  if (!isLegacyProjectData(data)) {
    return {
      totalScope: data.totalScope ?? {
        systems: ['primary', 'secondary', 'bop'],
        components: [],
      },
      models: (data.models ?? []).map(migrateModelNodeIds),
      updateHistory: data.updateHistory ?? [],
      simulationHistory: data.simulationHistory ?? [],
      // metadata 보존 (tags, taskMode 등 레거시 호환 필드)
      ...(data.metadata ? { metadata: data.metadata } : {}),
    };
  }

  // 레거시 데이터 마이그레이션
  const now = getCurrentTimestamp();
  const scope = convertLegacyScope(data.metadata);
  const analysisCodes = convertLegacyAnalysisCode(data.metadata);

  // 기존 nodes/edges를 기본 모델 1개로 래핑 (+ node ID 마이그레이션)
  const legacyMigration = migrateProjectNodeIds(
    data.nodes ?? [],
    data.edges ?? [],
    data.globalSettings,
  );
  const defaultModel: Model = {
    id: generateId(),
    name: 'Default Model',
    analysisCodes,
    description: 'Migrated from legacy project structure',
    scope,
    nodes: legacyMigration.nodes,
    edges: legacyMigration.edges,
    settings: legacyMigration.globalSettings ?? data.globalSettings ?? {},
    updateHistory: [],
    created_at: now,
    updated_at: now,
  };

  // 마이그레이션 버전 엔트리 추가
  const migrationEntry: VersionEntry = {
    version: '1.0',
    timestamp: now,
    author: 'System',
    description: 'Auto-migrated from legacy structure',
  };

  return {
    totalScope: scope,
    models: [defaultModel],
    updateHistory: [migrationEntry],
    simulationHistory: [],
    // 레거시 필드는 유지 (참조용, 하위호환)
    metadata: data.metadata,
    globalSettings: data.globalSettings,
  };
}

/**
 * 프로젝트 데이터 유효성 검증
 * - models 스코프 중복 체크
 */
export function validateProjectData(data: ProjectData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.models || data.models.length === 0) {
    return { valid: true, errors: [] }; // 모델 없으면 통과
  }

  // 스코프 중복 체크
  const usedSystems = new Set<SystemScope>();
  const usedComponents = new Set<string>();

  for (const model of data.models) {
    // 시스템 스코프 중복 체크
    for (const system of model.scope.systems) {
      if (usedSystems.has(system)) {
        errors.push(`Duplicate system scope: "${system}" in model "${model.name}"`);
      }
      usedSystems.add(system);
    }

    // 컴포넌트 스코프 중복 체크
    for (const component of model.scope.components) {
      if (usedComponents.has(component)) {
        errors.push(`Duplicate component scope: "${component}" in model "${model.name}"`);
      }
      usedComponents.add(component);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 모델 ID로 모델 찾기
 */
export function findModelById(data: ProjectData, modelId: string): Model | undefined {
  return data.models?.find((m) => m.id === modelId);
}

/**
 * 프로젝트의 총 노드 수 계산
 */
export function getTotalNodeCount(data: ProjectData): number {
  if (!data.models || data.models.length === 0) {
    // 레거시 구조 fallback
    return data.nodes?.length ?? 0;
  }

  return data.models.reduce((sum, model) => sum + (model.nodes?.length ?? 0), 0);
}

/**
 * 프로젝트의 총 엣지 수 계산
 */
export function getTotalEdgeCount(data: ProjectData): number {
  if (!data.models || data.models.length === 0) {
    // 레거시 구조 fallback
    return data.edges?.length ?? 0;
  }

  return data.models.reduce((sum, model) => sum + (model.edges?.length ?? 0), 0);
}

/**
 * 모델 내부의 cmp_ node ID를 node_ 형식으로 마이그레이션
 */
function migrateModelNodeIds(model: Model): Model {
  const result = migrateProjectNodeIds(
    model.nodes ?? [],
    model.edges ?? [],
    model.settings,
  );
  if (!result.migrated) return model;
  return {
    ...model,
    nodes: result.nodes,
    edges: result.edges,
    settings: result.globalSettings ?? model.settings,
  };
}
