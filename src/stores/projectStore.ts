/**
 * Project Store
 *
 * Supabase DB를 사용한 프로젝트 상태 관리
 * - 프로젝트 CRUD 작업
 * - 모델 CRUD 작업 (MAIN-001, MDH-001)
 * - RLS로 사용자별 데이터 자동 분리
 * - 레거시 데이터 자동 마이그레이션
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { projectManagerService } from '@/services/pm/projectManagerService';
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectSummary,
  ProjectData,
  Model,
  ModelInsert,
  ModelUpdate,
  VersionEntry,
  SimulationEntry,
} from '@/types/supabase';
import {
  migrateProjectData,
  isLegacyProjectData,
  findModelById,
  getTotalNodeCount,
} from '@/utils/projectMigration';

interface ProjectState {
  // 상태
  projects: Project[];
  currentProject: Project | null;
  currentModel: Model | null;  // 현재 선택된 모델
  loading: boolean;
  saving: boolean;  // 저장 작업용 별도 상태
  error: string | null;

  // 프로젝트 액션
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<Project | null>;
  createProject: (project: ProjectInsert) => Promise<Project | null>;
  updateProject: (id: string, updates: ProjectUpdate) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;

  // 모델 액션 (MAIN-001, MDH-001)
  createModel: (projectId: string, model: ModelInsert) => Promise<Model | null>;
  updateModel: (projectId: string, modelId: string, updates: ModelUpdate) => Promise<boolean>;
  deleteModel: (projectId: string, modelId: string) => Promise<boolean>;
  setCurrentModel: (model: Model | null) => void;
  getModel: (projectId: string, modelId: string) => Model | null;

  // 히스토리 액션
  addVersionEntry: (projectId: string, modelId: string | null, entry: Omit<VersionEntry, 'timestamp'>) => Promise<boolean>;
  addSimulationEntry: (projectId: string, entry: Omit<SimulationEntry, 'id' | 'timestamp'>) => Promise<boolean>;

  // 유틸리티
  getProjectSummaries: () => ProjectSummary[];
  getProjectModels: (projectId: string) => Model[];
}

// UUID 생성 헬퍼
function generateId(): string {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

async function syncCreatedProjectToBff(project: Project): Promise<void> {
  try {
    await projectManagerService.updateProject({
      id: project.id,
      name: project.name,
      description: project.description,
      data: project.data,
    });
    return;
  } catch (error) {
    console.warn('[ProjectStore] BFF project create-sync update step failed, trying create:', error);
  }

  try {
    await projectManagerService.createProject({
      userId: project.user_id,
      name: project.name,
      description: project.description,
      data: project.data,
    });
  } catch (error) {
    console.warn('[ProjectStore] BFF project create-sync create step failed:', error);
  }
}

async function syncUpdatedProjectToBff(project: Project): Promise<void> {
  try {
    await projectManagerService.updateProject({
      id: project.id,
      name: project.name,
      description: project.description,
      data: project.data,
    });
  } catch (error) {
    if (!projectManagerService.isNotFoundConnectError(error)) {
      console.warn('[ProjectStore] BFF project update-sync failed:', error);
      return;
    }

    try {
      await projectManagerService.createProject({
        userId: project.user_id,
        name: project.name,
        description: project.description,
        data: project.data,
      });
    } catch (createError) {
      console.warn('[ProjectStore] BFF project update-sync create fallback failed:', createError);
    }
  }
}

async function syncProjectDeleteToBff(projectId: string): Promise<void> {
  try {
    await projectManagerService.deleteProject(projectId);
  } catch (error) {
    console.warn('[ProjectStore] BFF project delete sync failed:', error);
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 초기 상태
  projects: [],
  currentProject: null,
  currentModel: null,
  loading: false,
  saving: false,
  error: null,

  /**
   * 프로젝트 목록 조회
   */
  fetchProjects: async () => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({ projects: data || [], loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 목록을 불러오는데 실패했습니다';
      set({ error: message, loading: false });
      console.error('[ProjectStore] fetchProjects error:', error);
    }
  },

  /**
   * 단일 프로젝트 조회 (레거시 데이터 자동 마이그레이션)
   * @param id 프로젝트 ID
   */
  fetchProject: async (id: string) => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      // 레거시 데이터 마이그레이션 체크
      if (data && isLegacyProjectData(data.data)) {
        console.log('[ProjectStore] Migrating legacy project data:', id);
        const migratedData = migrateProjectData(data.data);

        // DB에 마이그레이션된 데이터 저장
        const { error: updateError } = await supabase
          .from('projects')
          .update({ data: migratedData })
          .eq('id', id);

        if (updateError) {
          console.warn('[ProjectStore] Migration save failed:', updateError);
        }

        data.data = migratedData;
      }

      set({ currentProject: data, loading: false });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트를 불러오는데 실패했습니다';
      set({ error: message, loading: false, currentProject: null });
      console.error('[ProjectStore] fetchProject error:', error);
      return null;
    }
  },

  /**
   * 프로젝트 생성 (새 구조 지원)
   * @param project 생성할 프로젝트 정보
   */
  createProject: async (project: ProjectInsert) => {
    set({ loading: true, error: null });

    try {
      // user_id는 RLS 정책에 의해 자동으로 설정되지 않으므로 직접 설정 필요
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 새 구조로 초기 데이터 생성
      const initialData: ProjectData = project.data
        ? migrateProjectData(project.data)  // 기존 데이터 있으면 마이그레이션
        : {
            totalScope: {
              systems: ['primary', 'secondary', 'bop'],
              components: [],
            },
            models: [],
            updateHistory: [],
            simulationHistory: [],
          };

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...project,
          user_id: user.id,
          data: initialData,
        })
        .select()
        .single();

      if (error) {
        // 중복 이름 에러 처리
        if (error.code === '23505') {
          throw new Error('같은 이름의 프로젝트가 이미 존재합니다');
        }
        throw error;
      }

      // 목록에 추가
      set((state) => ({
        projects: [data, ...state.projects],
        loading: false,
      }));

      // Supabase 저장 성공 후 BFF도 동기화한다.
      await syncCreatedProjectToBff(data);

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 생성에 실패했습니다';
      set({ error: message, loading: false });
      console.error('[ProjectStore] createProject error:', error);
      return null;
    }
  },

  /**
   * 프로젝트 업데이트
   * @param id 프로젝트 ID
   * @param updates 업데이트할 필드
   */
  updateProject: async (id: string, updates: ProjectUpdate) => {
    // saving 상태 사용 (loading과 분리하여 UI 깜빡임 방지)
    set({ saving: true, error: null });

    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 목록 및 현재 프로젝트 업데이트
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? data : p)),
        currentProject: state.currentProject?.id === id ? data : state.currentProject,
        saving: false,
      }));

      // Supabase 변경 성공 후 BFF도 동기화한다.
      await syncUpdatedProjectToBff(data);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 업데이트에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] updateProject error:', error);
      return false;
    }
  },

  /**
   * 프로젝트 삭제
   * @param id 프로젝트 ID
   */
  deleteProject: async (id: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // 목록에서 제거 및 현재 프로젝트 초기화
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false,
      }));

      // Supabase 삭제 성공 후 BFF도 삭제 동기화한다.
      await syncProjectDeleteToBff(id);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '프로젝트 삭제에 실패했습니다';
      set({ error: message, loading: false });
      console.error('[ProjectStore] deleteProject error:', error);
      return false;
    }
  },

  /**
   * 현재 프로젝트 설정
   */
  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  /**
   * 에러 초기화
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * 프로젝트 요약 정보 반환 (목록 표시용)
   */
  getProjectSummaries: (): ProjectSummary[] => {
    const { projects } = get();

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      updated_at: p.updated_at,
      nodeCount: getTotalNodeCount(p.data ?? {}),
    }));
  },

  // ============================================
  // 모델 액션 (MAIN-001, MDH-001)
  // ============================================

  /**
   * 모델 생성
   * @param projectId 프로젝트 ID
   * @param model 생성할 모델 정보
   */
  createModel: async (projectId: string, model: ModelInsert) => {
    set({ saving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
      if (!project) {
        throw new Error('프로젝트를 찾을 수 없습니다');
      }

      const now = new Date().toISOString();
      const newModel: Model = {
        id: generateId(),
        name: model.name,
        analysisCodes: model.analysisCodes,
        description: model.description ?? null,
        scope: model.scope,
        nodes: model.nodes ?? [],
        edges: model.edges ?? [],
        settings: model.settings ?? {},
        updateHistory: [],
        created_at: now,
        updated_at: now,
      };

      const updatedData: ProjectData = {
        ...project.data,
        models: [...(project.data?.models ?? []), newModel],
      };

      const { error } = await supabase
        .from('projects')
        .update({ data: updatedData })
        .eq('id', projectId);

      if (error) throw error;

      // 상태 업데이트
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, data: updatedData } : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, data: updatedData }
          : state.currentProject,
        saving: false,
      }));

      const syncedProject: Project = {
        ...project,
        data: updatedData,
      };
      await syncUpdatedProjectToBff(syncedProject);

      return newModel;
    } catch (error) {
      const message = error instanceof Error ? error.message : '모델 생성에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] createModel error:', error);
      return null;
    }
  },

  /**
   * 모델 업데이트
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID
   * @param updates 업데이트할 필드
   */
  updateModel: async (projectId: string, modelId: string, updates: ModelUpdate) => {
    set({ saving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
      if (!project?.data?.models) {
        throw new Error('프로젝트를 찾을 수 없습니다');
      }

      const modelIndex = project.data.models.findIndex((m) => m.id === modelId);
      if (modelIndex === -1) {
        throw new Error('모델을 찾을 수 없습니다');
      }

      const updatedModel: Model = {
        ...project.data.models[modelIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const updatedModels = [...project.data.models];
      updatedModels[modelIndex] = updatedModel;

      const updatedData: ProjectData = {
        ...project.data,
        models: updatedModels,
      };

      const { error } = await supabase
        .from('projects')
        .update({ data: updatedData })
        .eq('id', projectId);

      if (error) throw error;

      // 상태 업데이트
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, data: updatedData } : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, data: updatedData }
          : state.currentProject,
        currentModel: state.currentModel?.id === modelId
          ? updatedModel
          : state.currentModel,
        saving: false,
      }));

      const syncedProject: Project = {
        ...project,
        data: updatedData,
      };
      await syncUpdatedProjectToBff(syncedProject);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '모델 업데이트에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] updateModel error:', error);
      return false;
    }
  },

  /**
   * 모델 삭제
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID
   */
  deleteModel: async (projectId: string, modelId: string) => {
    set({ saving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
      if (!project?.data?.models) {
        throw new Error('프로젝트를 찾을 수 없습니다');
      }

      const updatedData: ProjectData = {
        ...project.data,
        models: project.data.models.filter((m) => m.id !== modelId),
      };

      const { error } = await supabase
        .from('projects')
        .update({ data: updatedData })
        .eq('id', projectId);

      if (error) throw error;

      // 상태 업데이트
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, data: updatedData } : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, data: updatedData }
          : state.currentProject,
        currentModel: state.currentModel?.id === modelId
          ? null
          : state.currentModel,
        saving: false,
      }));

      const syncedProject: Project = {
        ...project,
        data: updatedData,
      };
      await syncUpdatedProjectToBff(syncedProject);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '모델 삭제에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] deleteModel error:', error);
      return false;
    }
  },

  /**
   * 현재 모델 설정
   */
  setCurrentModel: (model: Model | null) => {
    set({ currentModel: model });
  },

  /**
   * 프로젝트에서 모델 가져오기
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID
   */
  getModel: (projectId: string, modelId: string): Model | null => {
    const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
    return findModelById(project?.data ?? {}, modelId) ?? null;
  },

  // ============================================
  // 히스토리 액션
  // ============================================

  /**
   * 버전 엔트리 추가
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID (null이면 프로젝트 레벨)
   * @param entry 버전 엔트리 (timestamp 제외)
   */
  addVersionEntry: async (projectId: string, modelId: string | null, entry: Omit<VersionEntry, 'timestamp'>) => {
    set({ saving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
      if (!project?.data) {
        throw new Error('프로젝트를 찾을 수 없습니다');
      }

      const fullEntry: VersionEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
      };

      let updatedData: ProjectData;

      if (modelId) {
        // 모델 레벨 히스토리
        const models = project.data.models ?? [];
        const modelIndex = models.findIndex((m) => m.id === modelId);
        if (modelIndex === -1) {
          throw new Error('모델을 찾을 수 없습니다');
        }

        const updatedModel = {
          ...models[modelIndex],
          updateHistory: [...(models[modelIndex].updateHistory ?? []), fullEntry],
        };
        const updatedModels = [...models];
        updatedModels[modelIndex] = updatedModel;

        updatedData = { ...project.data, models: updatedModels };
      } else {
        // 프로젝트 레벨 히스토리
        updatedData = {
          ...project.data,
          updateHistory: [...(project.data.updateHistory ?? []), fullEntry],
        };
      }

      const { error } = await supabase
        .from('projects')
        .update({ data: updatedData })
        .eq('id', projectId);

      if (error) throw error;

      // 상태 업데이트
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, data: updatedData } : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, data: updatedData }
          : state.currentProject,
        saving: false,
      }));

      const syncedProject: Project = {
        ...project,
        data: updatedData,
      };
      await syncUpdatedProjectToBff(syncedProject);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '버전 히스토리 추가에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] addVersionEntry error:', error);
      return false;
    }
  },

  /**
   * 시뮬레이션 엔트리 추가
   * @param projectId 프로젝트 ID
   * @param entry 시뮬레이션 엔트리 (id, timestamp 제외)
   */
  addSimulationEntry: async (projectId: string, entry: Omit<SimulationEntry, 'id' | 'timestamp'>) => {
    set({ saving: true, error: null });

    try {
      const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
      if (!project?.data) {
        throw new Error('프로젝트를 찾을 수 없습니다');
      }

      const fullEntry: SimulationEntry = {
        ...entry,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };

      const updatedData: ProjectData = {
        ...project.data,
        simulationHistory: [...(project.data.simulationHistory ?? []), fullEntry],
      };

      const { error } = await supabase
        .from('projects')
        .update({ data: updatedData })
        .eq('id', projectId);

      if (error) throw error;

      // 상태 업데이트
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, data: updatedData } : p
        ),
        currentProject: state.currentProject?.id === projectId
          ? { ...state.currentProject, data: updatedData }
          : state.currentProject,
        saving: false,
      }));

      const syncedProject: Project = {
        ...project,
        data: updatedData,
      };
      await syncUpdatedProjectToBff(syncedProject);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '시뮬레이션 히스토리 추가에 실패했습니다';
      set({ error: message, saving: false });
      console.error('[ProjectStore] addSimulationEntry error:', error);
      return false;
    }
  },

  /**
   * 프로젝트의 모델 목록 반환
   * @param projectId 프로젝트 ID
   */
  getProjectModels: (projectId: string): Model[] => {
    const project = get().projects.find((p) => p.id === projectId) ?? get().currentProject;
    return project?.data?.models ?? [];
  },
}));

export default useProjectStore;
