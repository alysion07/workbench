/**
 * Project File Save/Load Utilities
 * Handles serialization and deserialization of MARS Editor projects
 */

import { MARSProject } from '@/types/mars';
import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData } from '@/types/mars';
import type { ProjectData } from '@/types/supabase';
import { validateGlobalSettings, validateSystemReferences } from './globalSettingsValidation';

// ============================================
// VSMR Project JSON Export/Import
// ============================================

/** 현재 스키마 버전 - 스키마 구조 변경 시 bump */
export const VSMR_SCHEMA_VERSION = 2;

/** Export JSON 메타데이터 */
export interface VsmrMeta {
  version: number;
  appVersion: string;
  exportedAt: string;
  projectName: string;
}

/** Export JSON 래퍼 구조 */
export interface VsmrProjectFile {
  _vsmr_meta_: VsmrMeta;
  data: ProjectData;
}

/** 파일 판별 결과 */
export type ProjectFileType = 'vsmr' | 'legacy-mars' | 'raw-projectdata' | 'unknown';

/**
 * ProjectData를 _vsmr_meta_ 래퍼로 감싸서 JSON 문자열로 직렬화
 */
export function serializeProjectData(
  projectData: ProjectData,
  projectName: string,
): string {
  const wrapped: VsmrProjectFile = {
    _vsmr_meta_: {
      version: VSMR_SCHEMA_VERSION,
      appVersion: '0.1.0',
      exportedAt: new Date().toISOString(),
      projectName,
    },
    data: projectData,
  };

  return JSON.stringify(wrapped, null, 2);
}

/**
 * 프로젝트 JSON 파일을 로컬에 다운로드
 */
export function downloadProjectData(
  projectData: ProjectData,
  projectName: string,
): void {
  const jsonContent = serializeProjectData(projectData, projectName);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const sanitizedName = projectName.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  const filename = `${sanitizedName}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * JSON 파일 형식 자동 판별
 */
export function detectProjectFileType(json: Record<string, unknown>): ProjectFileType {
  if (json._vsmr_meta_ && typeof json._vsmr_meta_ === 'object' && json.data) {
    return 'vsmr';
  }
  if (json.metadata && json.nodes && json.edges) {
    return 'legacy-mars';
  }
  if (json.models && Array.isArray(json.models)) {
    return 'raw-projectdata';
  }
  return 'unknown';
}

/**
 * _vsmr_meta_ 버전 호환성 체크
 * @returns null이면 호환, 문자열이면 에러 메시지
 */
export function checkVsmrCompatibility(meta: VsmrMeta): string | null {
  if (meta.version > VSMR_SCHEMA_VERSION) {
    return `이 파일은 최신 버전(v${meta.version})에서 내보낸 것입니다. 앱을 업데이트해주세요. (현재: v${VSMR_SCHEMA_VERSION})`;
  }
  return null;
}

/**
 * JSON 파일을 읽고 형식에 따라 파싱
 */
export function readProjectJsonFile(file: File): Promise<{
  type: ProjectFileType;
  vsmrFile?: VsmrProjectFile;
  marsProject?: MARSProject;
  rawProjectData?: ProjectData;
}> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      reject(new Error('JSON 파일만 지원합니다.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);
        const type = detectProjectFileType(json);

        if (type === 'vsmr') {
          resolve({ type, vsmrFile: json as VsmrProjectFile });
        } else if (type === 'legacy-mars') {
          const project = deserializeProject(content);
          resolve({ type, marsProject: project });
        } else if (type === 'raw-projectdata') {
          resolve({ type, rawProjectData: json as unknown as ProjectData });
        } else {
          reject(new Error('인식할 수 없는 프로젝트 파일 형식입니다.'));
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error('유효하지 않은 JSON 형식입니다.'));
        } else {
          reject(error);
        }
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는 데 실패했습니다.'));
    };

    reader.readAsText(file);
  });
}

/**
 * Serializes the current project state to a JSON string
 */
export function serializeProject(
  nodes: Node<MARSNodeData>[],
  edges: Edge<MARSEdgeData>[],
  metadata: MARSProject['metadata']
): string {
  const project: MARSProject = {
    metadata: {
      ...metadata,
      modified: new Date().toISOString(),
    },
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.data.componentType,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      data: edge.data,
    })),
  };

  return JSON.stringify(project, null, 2);
}

/**
 * Deserializes a JSON string to a project object
 */
export function deserializeProject(jsonString: string): MARSProject {
  try {
    const project = JSON.parse(jsonString) as MARSProject;

    // Validate required fields
    if (!project.metadata || !project.nodes || !project.edges) {
      throw new Error('Invalid project file: missing required fields');
    }

    // Validate metadata
    if (!project.metadata.projectName || !project.metadata.version) {
      throw new Error('Invalid project file: missing metadata');
    }

    return project;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format');
    }
    throw error;
  }
}

/**
 * Downloads a project file to the user's computer
 */
export function downloadProjectFile(
  nodes: Node<MARSNodeData>[],
  edges: Edge<MARSEdgeData>[],
  metadata: MARSProject['metadata']
): void {
  const jsonContent = serializeProject(nodes, edges, metadata);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Generate filename from project name and timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sanitizedName = metadata.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedName}_${timestamp}.mars.json`;

  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a project file from user's computer
 */
export function readProjectFile(file: File): Promise<MARSProject> {
  return new Promise((resolve, reject) => {
    // Validate file extension
    if (!file.name.endsWith('.mars.json') && !file.name.endsWith('.json')) {
      reject(new Error('Invalid file type. Please select a .mars.json file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const project = deserializeProject(content);
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Converts a MARSProject back to ReactFlow nodes and edges
 */
export function projectToReactFlow(project: MARSProject): {
  nodes: Node<MARSNodeData>[];
  edges: Edge<MARSEdgeData>[];
} {
  const nodes: Node<MARSNodeData>[] = project.nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  }));

  const edges: Edge<MARSEdgeData>[] = project.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: edge.data,
  }));

  return { nodes, edges };
}

/**
 * Generates a default project name with timestamp
 */
export function generateDefaultProjectName(): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `MARS_Project_${timestamp}`;
}

/**
 * Validates that a project can be safely loaded
 */
export function validateProject(project: MARSProject): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of project.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  // Check for duplicate edge IDs
  const edgeIds = new Set<string>();
  for (const edge of project.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID: ${edge.id}`);
    }
    edgeIds.add(edge.id);
  }

  // Check for orphaned edges (edges that reference non-existent nodes)
  for (const edge of project.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
    }
  }

  // Check for very old project versions
  if (project.metadata.version !== '1.0.0') {
    warnings.push(`Project version ${project.metadata.version} may not be fully compatible`);
  }

  // Validate global settings if present
  if (project.metadata.globalSettings) {
    const globalValidation = validateGlobalSettings(project.metadata.globalSettings);

    if (!globalValidation.valid) {
      errors.push(...globalValidation.errors.map(e =>
        `Global Settings - Card ${e.card} (${e.field}): ${e.message}`
      ));
    }

    warnings.push(...globalValidation.warnings.map(w =>
      `Global Settings - Card ${w.card} (${w.field}): ${w.message}`
    ));

    // Validate system references against project nodes (skip in restart mode)
    const isRestart = project.metadata.globalSettings.card100?.problemType === 'restart';
    if (!isRestart && project.metadata.globalSettings.systems && project.metadata.globalSettings.systems.length > 0) {
      const { nodes } = projectToReactFlow(project);
      const systemValidation = validateSystemReferences(project.metadata.globalSettings.systems, nodes);

      if (!systemValidation.valid) {
        errors.push(...systemValidation.errors.map(e =>
          `Global Settings - Card ${e.card} (${e.field}): ${e.message}`
        ));
      }
    }
  } else {
    warnings.push('Global settings not found. Default values will be used.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}


