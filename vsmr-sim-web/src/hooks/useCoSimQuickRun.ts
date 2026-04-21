/**
 * useCoSimQuickRun Hook
 * 모델 단위로 파일을 관리하여 N개 독립/Co-Sim 해석을 실행
 *
 * 구조:
 *   시뮬레이션 레벨: precice-config.xml (전체 공유, sharedConfigs)
 *   모델 레벨:      .i 파일 1개(메인 입력) + .nml 등 설정 파일들
 *
 * .i 파일이 여러 개 있으면 드롭다운으로 1개 선택, 나머지는 업로드하지 않음.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ProjectService } from '@/services/projectService';
import { useSimulationStore } from '@/stores/simulationStore';
import { simulationManagerService } from '@/services/sm';
import { validateInputContent, type InputValidationIssue } from '@/services/inputd/inputdService';
import { parseMinorEdits } from '@/utils/minorEditParser';
import toast from 'react-hot-toast';
import type { TaskMode } from '@/types/simulation';

// ============================================
// ID Generators
// ============================================

function generateId(): string {
  const c = globalThis.crypto;

  // Prefer native UUID only in secure contexts (HTTPS/localhost).
  if (globalThis.isSecureContext && c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  // Improved fallback for non-secure contexts: generate RFC4122-like v4 UUID.
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort fallback when Web Crypto is unavailable.
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 서버 전달용 7자리 short UUID */
function shortUUID(): string {
  return generateId().replace(/-/g, '').slice(0, 7);
}

// ============================================
// Types
// ============================================

export interface ModelFile {
  id: string;
  name: string;
  source: 'local' | 'minio';
  file?: File;
  path?: string;
  projectName?: string;
  size?: number;
}

export interface SelectedFile {
  type: 'local' | 'minio';
  name: string;
  path?: string;
  projectName?: string;
  file?: File;
  size?: number;
}

export interface QuickRunModel {
  id: string;
  modelId: string;           // 7자리 short UUID
  name: string;
  files: ModelFile[];         // 이 모델의 모든 파일 (.i 포함)
  selectedInputId?: string;   // .i 파일 중 선택된 1개의 file ID
}

export type ModelValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface ModelValidationState {
  status: ModelValidationStatus;
  targetLabel: string;
  inputHash: string;
  issues: InputValidationIssue[];
}

interface PreparedModelInput {
  model: QuickRunModel;
  mainInput: ModelFile;
  inputContent: string;
  inputHash: string;
  targetLabel: string;
}

interface UseCoSimQuickRunOptions {
  userId: string;
  title?: string;
  description?: string;
  taskMode?: TaskMode;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export class InputValidationFailedError extends Error {
  issues: InputValidationIssue[];
  targetLabel: string;

  constructor(targetLabel: string, issues: InputValidationIssue[]) {
    super(`입력 파일 검증 실패: ${targetLabel}`);
    this.name = 'InputValidationFailedError';
    this.issues = issues;
    this.targetLabel = targetLabel;
  }
}

// ============================================
// Helpers
// ============================================

function getIFiles(files: ModelFile[]): ModelFile[] {
  return files.filter((f) => f.name.toLowerCase().endsWith('.i'));
}

function getNonIFiles(files: ModelFile[]): ModelFile[] {
  return files.filter((f) => !f.name.toLowerCase().endsWith('.i'));
}

/** .i 파일 중 메인 입력 자동 추정: _tr 없는 것 우선, 이름 짧은 것 우선 */
function guessMainInput(files: ModelFile[]): string | undefined {
  const iFiles = getIFiles(files);
  if (iFiles.length === 0) return undefined;
  if (iFiles.length === 1) return iFiles[0].id;
  const sorted = [...iFiles].sort((a, b) => {
    const aTr = a.name.toLowerCase().includes('_tr') ? 1 : 0;
    const bTr = b.name.toLowerCase().includes('_tr') ? 1 : 0;
    if (aTr !== bTr) return aTr - bTr;
    return a.name.length - b.name.length;
  });
  return sorted[0].id;
}

function getSelectedInput(model: QuickRunModel): ModelFile | undefined {
  if (model.selectedInputId) {
    const f = model.files.find((f) => f.id === model.selectedInputId);
    if (f) return f;
  }
  // fallback: 자동 추정
  const guessed = guessMainInput(model.files);
  return guessed ? model.files.find((f) => f.id === guessed) : undefined;
}

function hashContent(content: string): string {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================
// Hook
// ============================================

export function useCoSimQuickRun({
  title = '',
  description = '',
  taskMode = 'new',
  onSuccess,
  onError,
}: UseCoSimQuickRunOptions) {
  const [models, setModels] = useState<QuickRunModel[]>([]);
  const [simFiles, setSimFiles] = useState<ModelFile[]>([]); // 시뮬레이션 레벨 파일 (.xml)
  const [validationByModel, setValidationByModel] = useState<Record<string, ModelValidationState>>({});
  const [validatedInputs, setValidatedInputs] = useState<Record<string, PreparedModelInput>>({});
  const {
    setActiveModel, setActiveTab,
    initCoSimSession, clearCoSimSession, setModelRuntimeMinorEdits,
  } = useSimulationStore();

  const isMultiModel = models.length > 1;
  const canStart = useMemo(
    () => models.length > 0 && models.every((m) => getSelectedInput(m) !== undefined),
    [models],
  );
  const canExecute = useMemo(
    () => canStart && models.every((m) => validationByModel[m.id]?.status === 'valid' && !!validatedInputs[m.id]),
    [canStart, models, validationByModel, validatedInputs],
  );

  const clearValidationForModel = useCallback((modelUiId: string) => {
    setValidationByModel((prev) => {
      if (!prev[modelUiId]) return prev;
      const next = { ...prev };
      delete next[modelUiId];
      return next;
    });
    setValidatedInputs((prev) => {
      if (!prev[modelUiId]) return prev;
      const next = { ...prev };
      delete next[modelUiId];
      return next;
    });
  }, []);

  const clearAllValidation = useCallback(() => {
    setValidationByModel({});
    setValidatedInputs({});
  }, []);

  // ============================================
  // 시뮬레이션 레벨 파일 관리 (precice-config.xml 등)
  // ============================================

  const addSimFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: ModelFile[] = Array.from(fileList).map((f) => ({
      id: generateId(), name: f.name, source: 'local', file: f, size: f.size,
    }));
    setSimFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeSimFile = useCallback((fileId: string) => {
    setSimFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // ============================================
  // 모델 관리
  // ============================================

  const addModel = useCallback((name?: string) => {
    setModels((prev) => [
      ...prev,
      {
        id: generateId(),
        modelId: shortUUID(),
        name: name || `Model ${prev.length + 1}`,
        files: [],
      },
    ]);
  }, []);

  const removeModel = useCallback((modelUiId: string) => {
    setModels((prev) => prev.filter((m) => m.id !== modelUiId));
    clearValidationForModel(modelUiId);
  }, [clearValidationForModel]);

  const renameModel = useCallback((modelUiId: string, name: string) => {
    setModels((prev) => prev.map((m) => (m.id === modelUiId ? { ...m, name } : m)));
  }, []);

  const selectInput = useCallback((modelUiId: string, fileId: string) => {
    setModels((prev) => prev.map((m) =>
      m.id === modelUiId ? { ...m, selectedInputId: fileId } : m
    ));
    clearValidationForModel(modelUiId);
  }, [clearValidationForModel]);

  // ============================================
  // 모델 파일 관리
  // ============================================

  const addFilesToModel = useCallback((modelUiId: string, fileList: FileList | File[]) => {
    const newFiles: ModelFile[] = Array.from(fileList).map((f) => ({
      id: generateId(), name: f.name, source: 'local', file: f, size: f.size,
    }));
    setModels((prev) => prev.map((m) => {
      if (m.id !== modelUiId) return m;
      const updated = { ...m, files: [...m.files, ...newFiles] };
      // .i 파일이 추가되었고 아직 선택이 없으면 자동 추정
      if (!updated.selectedInputId) {
        updated.selectedInputId = guessMainInput(updated.files);
      }
      return updated;
    }));
    clearValidationForModel(modelUiId);
  }, [clearValidationForModel]);

  const addMinioFileToModel = useCallback((modelUiId: string, params: {
    name: string; path: string; projectName?: string;
  }) => {
    const newFile: ModelFile = {
      id: generateId(), name: params.name, source: 'minio',
      path: params.path, projectName: params.projectName,
    };
    setModels((prev) => prev.map((m) => {
      if (m.id !== modelUiId) return m;
      const updated = { ...m, files: [...m.files, newFile] };
      if (!updated.selectedInputId) {
        updated.selectedInputId = guessMainInput(updated.files);
      }
      return updated;
    }));
    clearValidationForModel(modelUiId);
  }, [clearValidationForModel]);

  const removeFileFromModel = useCallback((modelUiId: string, fileId: string) => {
    setModels((prev) => prev.map((m) => {
      if (m.id !== modelUiId) return m;
      const updated = { ...m, files: m.files.filter((f) => f.id !== fileId) };
      // 선택된 입력이 제거되면 재추정
      if (updated.selectedInputId === fileId) {
        updated.selectedInputId = guessMainInput(updated.files);
      }
      return updated;
    }));
    clearValidationForModel(modelUiId);
  }, [clearValidationForModel]);

  const clearAll = useCallback(() => {
    setModels([]);
    setSimFiles([]);
    clearAllValidation();
  }, [clearAllValidation]);

  // ============================================
  // 폴더 기반 자동 모델 생성
  // ============================================

  const addModelsFromFolder = useCallback((fileList: FileList | File[]) => {
    const modelGroups = new Map<string, File[]>();
    const rootFiles: File[] = [];

    for (const file of Array.from(fileList)) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = relativePath.split('/');

      if (parts.length >= 3) {
        const folderName = parts[1];
        if (!modelGroups.has(folderName)) modelGroups.set(folderName, []);
        modelGroups.get(folderName)!.push(file);
      } else {
        rootFiles.push(file);
      }
    }

    // 루트 .xml → 시뮬레이션 레벨 파일
    const rootXmlFiles = rootFiles.filter((f) => f.name.toLowerCase().endsWith('.xml'));
    if (rootXmlFiles.length > 0) {
      setSimFiles((prev) => [
        ...prev,
        ...rootXmlFiles.map((f) => ({
          id: generateId(), name: f.name, source: 'local' as const, file: f, size: f.size,
        })),
      ]);
    }

    // 서브폴더 → 모델 생성
    const newModels: QuickRunModel[] = [];
    for (const [folderName, files] of modelGroups) {
      const relevant = files.filter((f) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.i') || lower.endsWith('.nml') || lower.endsWith('.xml');
      });
      if (relevant.length === 0) continue;

      const modelFiles: ModelFile[] = relevant.map((f) => ({
        id: generateId(), name: f.name, source: 'local' as const, file: f, size: f.size,
      }));

      newModels.push({
        id: generateId(),
        modelId: shortUUID(),
        name: folderName,
        files: modelFiles,
        selectedInputId: guessMainInput(modelFiles),
      });
    }

    newModels.sort((a, b) => a.name.localeCompare(b.name));
    if (newModels.length > 0) {
      setModels((prev) => [...prev, ...newModels]);
    }

    return newModels.length;
  }, []);

  // ============================================
  // 파일 업로드
  // ============================================

  async function readModelInput(model: QuickRunModel): Promise<PreparedModelInput> {
    const mainInput = getSelectedInput(model);
    if (!mainInput) throw new Error(`모델 "${model.name}"에 입력 파일(.i)이 선택되지 않았습니다`);

    let inputContent: string;
    if (mainInput.source === 'local' && mainInput.file) {
      inputContent = await mainInput.file.text();
    } else if (mainInput.source === 'minio' && mainInput.path) {
      inputContent = await ProjectService.getFileContentByKey(mainInput.path);
    } else {
      throw new Error(`입력 파일 "${mainInput.name}"을 읽을 수 없습니다`);
    }

    const inputHash = hashContent(inputContent);
    return {
      model,
      mainInput,
      inputContent,
      inputHash,
      targetLabel: `${model.name} / ${mainInput.name}`,
    };
  }

  async function uploadModelFiles(
    prepared: PreparedModelInput,
    projectId: string,
  ): Promise<{ inputFileUrl: string; inputContent: string; preciceMarsNmlUrl?: string }> {
    const { model, mainInput, inputContent } = prepared;

    const uploaded = await ProjectService.uploadModelFile(
      projectId, model.modelId, mainInput.name, inputContent, 'text/plain'
    );
    const inputFileUrl = uploaded.fileUrl;
    let preciceMarsNmlUrl: string | undefined;

    // .i 이외의 설정 파일만 업로드 (.nml, .xml 등)
    for (const f of getNonIFiles(model.files)) {
      let content: Uint8Array;
      if (f.source === 'local' && f.file) {
        content = new Uint8Array(await f.file.arrayBuffer());
      } else if (f.source === 'minio' && f.path) {
        content = new TextEncoder().encode(await ProjectService.getFileContentByKey(f.path));
      } else {
        continue;
      }
      const uploadedExtra = await ProjectService.uploadModelFile(
        projectId, model.modelId, f.name, content, 'application/octet-stream'
      );
      if (f.name.toLowerCase() === 'precice_mars.nml') {
        preciceMarsNmlUrl = uploadedExtra.fileUrl;
      }
    }

    return { inputFileUrl, inputContent, preciceMarsNmlUrl };
  }

  const validateMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!canStart) throw new Error('각 모델에 입력 파일(.i)을 선택해주세요');

      const preparedInputs: PreparedModelInput[] = [];
      for (const model of models) {
        preparedInputs.push(await readModelInput(model));
      }

      for (const prepared of preparedInputs) {
        const cached = validationByModel[prepared.model.id];
        if (cached?.status === 'valid' && cached.inputHash === prepared.inputHash) {
          setValidatedInputs((prev) => ({ ...prev, [prepared.model.id]: prepared }));
          continue;
        }

        setValidationByModel((prev) => ({
          ...prev,
          [prepared.model.id]: {
            status: 'validating',
            targetLabel: prepared.targetLabel,
            inputHash: prepared.inputHash,
            issues: [],
          },
        }));

        const validationResult = await validateInputContent(prepared.inputContent);
        if (!validationResult.success) {
          const issues = validationResult.messages.length > 0
            ? validationResult.messages
            : ['inputd validation failed (no details returned)'];

          setValidationByModel((prev) => ({
            ...prev,
            [prepared.model.id]: {
              status: 'invalid',
              targetLabel: prepared.targetLabel,
              inputHash: prepared.inputHash,
              issues,
            },
          }));

          throw new InputValidationFailedError(prepared.targetLabel, issues);
        }

        setValidationByModel((prev) => ({
          ...prev,
          [prepared.model.id]: {
            status: 'valid',
            targetLabel: prepared.targetLabel,
            inputHash: prepared.inputHash,
            issues: [],
          },
        }));
        setValidatedInputs((prev) => ({ ...prev, [prepared.model.id]: prepared }));
      }
    },
    onSuccess: () => {
      toast.success('입력 파일 검증 완료', { id: 'cosim-quickrun-validate' });
    },
    onError: (error: Error) => {
      if (error instanceof InputValidationFailedError) {
        toast.error('입력 파일 검증 실패', { id: 'cosim-quickrun-validate' });
      } else {
        toast.error('입력 파일 검증 중 오류', { id: 'cosim-quickrun-validate' });
      }
      onError?.(error);
    },
  });

  async function uploadSimLevelFiles(projectId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const f of simFiles) {
      let content: Uint8Array;
      if (f.source === 'local' && f.file) {
        content = new Uint8Array(await f.file.arrayBuffer());
      } else if (f.source === 'minio' && f.path) {
        content = new TextEncoder().encode(await ProjectService.getFileContentByKey(f.path));
      } else {
        continue;
      }
      const uploaded = await ProjectService.uploadProjectFile(
        projectId, f.name, content, 'application/octet-stream'
      );
      if (uploaded.fileUrl) urls.push(uploaded.fileUrl);
    }
    return urls;
  }

  // ============================================
  // 시뮬레이션 시작
  // ============================================

  const startMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!canStart) throw new Error('각 모델에 입력 파일(.i)을 선택해주세요');

      const quickRunProjectId = '_quickrun';
      const trimmedTitle = title.trim();
      if (!trimmedTitle) throw new Error('시뮬레이션 Title을 입력해주세요');

      // Step 1: 시뮬레이션 레벨 파일 업로드
      let sharedConfigUrls: string[] = [];
      if (simFiles.length > 0) {
        toast.loading('시뮬레이션 설정 업로드 중...', { id: 'cosim-quickrun' });
        sharedConfigUrls = await uploadSimLevelFiles(quickRunProjectId);
      }

      // Step 2: 모델별 파일 업로드
      toast.loading(`모델 파일 업로드 중 (${models.length}개)...`, { id: 'cosim-quickrun' });
      const modelInfos: Array<{
        modelId: string; modelName: string;
        inputFileUrl: string; minorEdits: ReturnType<typeof parseMinorEdits>;
        preciceMarsNmlUrl?: string;
      }> = [];

      for (const model of models) {
        const currentPrepared = await readModelInput(model);
        let prepared = validatedInputs[model.id];

        if (!prepared || currentPrepared.inputHash !== prepared.inputHash) {
          const validationResult = await validateInputContent(currentPrepared.inputContent);
          if (!validationResult.success) {
            const issues = validationResult.messages.length > 0
              ? validationResult.messages
              : ['inputd validation failed (no details returned)'];

            setValidationByModel((prev) => ({
              ...prev,
              [currentPrepared.model.id]: {
                status: 'invalid',
                targetLabel: currentPrepared.targetLabel,
                inputHash: currentPrepared.inputHash,
                issues,
              },
            }));

            throw new InputValidationFailedError(currentPrepared.targetLabel, issues);
          }

          setValidationByModel((prev) => ({
            ...prev,
            [currentPrepared.model.id]: {
              status: 'valid',
              targetLabel: currentPrepared.targetLabel,
              inputHash: currentPrepared.inputHash,
              issues: [],
            },
          }));
          setValidatedInputs((prev) => ({ ...prev, [currentPrepared.model.id]: currentPrepared }));
          prepared = currentPrepared;
        }

        const { inputFileUrl, inputContent, preciceMarsNmlUrl } = await uploadModelFiles(prepared, quickRunProjectId);
        let parsedEdits: ReturnType<typeof parseMinorEdits> = [];
        parsedEdits = parseMinorEdits(inputContent).filter((e) => e.variableType !== 'time');
        modelInfos.push({
          modelId: model.modelId, modelName: model.name,
          inputFileUrl, minorEdits: parsedEdits, preciceMarsNmlUrl,
        });
      }

      // Step 3: 시뮬레이션 생성
      toast.loading('시뮬레이션 시작 중...', { id: 'cosim-quickrun' });

      if (modelInfos.length === 1) {
        const m = modelInfos[0];
        const { simId, taskIds } = await simulationManagerService.createAndBuildSimulation({
          models: [{
            args: m.preciceMarsNmlUrl
              ? [taskMode, m.inputFileUrl, m.preciceMarsNmlUrl]
              : [taskMode, m.inputFileUrl],
          }],
          buildRequestHeadersFactory: ({ simId, taskIds }) => ({
            'x-bff-simulation-id': simId,
            'x-bff-task-ids': taskIds.join(','),
            'x-bff-project-id': quickRunProjectId,
            'x-bff-title': trimmedTitle,
            'x-bff-description': description,
            'x-bff-is-restart': String(taskMode === 'restart'),
          }),
        });
        const taskId = taskIds[0];
        if (!taskId) {
          throw new Error('Build failed: empty task_id returned');
        }

        clearCoSimSession();
        setActiveTab('all');

        const modelId = m.modelId;
        initCoSimSession(simId ?? taskId, quickRunProjectId, [{
          modelId, modelName: m.modelName, taskId, taskIndex: 0,
          args: m.inputFileUrl, taskMode, status: 'running',
        }]);
        setModelRuntimeMinorEdits(modelId, m.minorEdits);
        setActiveModel(modelId);
        return { mode: 'single' as const, taskId, simId };

      } else {
        const { simId, taskIds } = await simulationManagerService.createAndBuildSimulation({
          models: modelInfos.map((m) => ({
            args: m.preciceMarsNmlUrl
              ? [taskMode, m.inputFileUrl, m.preciceMarsNmlUrl]
              : [taskMode, m.inputFileUrl],
          })),
          sharedConfigs: sharedConfigUrls,
          buildRequestHeadersFactory: ({ simId, taskIds }) => ({
            'x-bff-simulation-id': simId,
            'x-bff-task-ids': taskIds.join(','),
            'x-bff-project-id': quickRunProjectId,
            'x-bff-title': trimmedTitle,
            'x-bff-description': description,
            'x-bff-is-restart': String(taskMode === 'restart'),
          }),
        });

        clearCoSimSession();
        setActiveTab('all');

        initCoSimSession(simId, quickRunProjectId, modelInfos.map((m, i) => ({
          modelId: m.modelId, modelName: m.modelName,
          taskId: taskIds[i], taskIndex: i,
          args: m.inputFileUrl, taskMode, status: 'running' as const,
        })));

        // 멀티 모델일 때 첫 번째 모델을 활성 모델로 설정 (플롯/로그 표시용)
        if (modelInfos.length > 0) {
          setActiveModel(modelInfos[0].modelId);
        }

        for (const m of modelInfos) {
          setModelRuntimeMinorEdits(m.modelId, m.minorEdits);
        }

        return { mode: 'cosim' as const, simId, taskIds };
      }
    },

    onSuccess: (result) => {
      const msg = result.mode === 'single'
        ? '퀵 시뮬레이션이 시작되었습니다'
        : `Co-Sim: ${result.taskIds.length}개 모델 시작`;
      toast.success(msg, { id: 'cosim-quickrun' });
      onSuccess?.();
    },

    onError: (error: Error) => {
      if (error instanceof InputValidationFailedError) {
        toast.error('입력 파일 검증 실패', { id: 'cosim-quickrun' });
      } else {
        toast.error('시뮬레이션 시작 실패', { id: 'cosim-quickrun' });
      }
      console.error('[useCoSimQuickRun] Error:', error);
      onError?.(error);
    },
  });

  const startQuickRun = useCallback(() => {
    void (async () => {
      if (!canStart) {
        throw new Error('각 모델에 입력 파일(.i)을 선택해주세요');
      }

      if (!canExecute) {
        await validateMutation.mutateAsync();
      }

      await startMutation.mutateAsync();
    })();
  }, [canStart, canExecute, validateMutation, startMutation]);

  return {
    models, simFiles, isMultiModel, canStart, canExecute, validationByModel,
    addModel, removeModel, renameModel, selectInput,
    addFilesToModel, addMinioFileToModel, removeFileFromModel,
    addSimFiles, removeSimFile,
    addModelsFromFolder, clearAll,
    isValidating: validateMutation.isPending,
    startQuickRun,
    isLoading: startMutation.isPending || validateMutation.isPending,
  };
}
