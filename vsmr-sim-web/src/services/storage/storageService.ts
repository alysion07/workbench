/**
 * Storage Connect-RPC Service
 * BFF 서버와의 Connect-RPC 통신을 담당
 *
 * MinIO 경로 규약:
 *   모델 파일:   /{user_id}/{project_id}/{model_id}/{file_name}
 *   프로젝트 파일: /{user_id}/{project_id}/{file_name}
 *   결과 파일:   /{user_id}/{project_id}/simulation/{simulation_id}/{task_index}/{file_name}
 */

import { createPromiseClient } from "@connectrpc/connect";
import type { PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { StorageService } from "@/stubs/storage/storage_connect";
import {
  CopyFileRequest,
  DeleteProjectRequest,
  DownloadFileRequest,
  DownloadTaskResultFileRequest,
  GetModelInputFilesRequest,
  ListResultFilesRequest,
  UploadModelFileRequest,
  UploadProjectFileRequest,
  type CopyFileResponse,
  type DeleteProjectResponse,
  type GetModelInputFilesResponse,
  type ListResultFilesResponse,
  type UploadFileResponse,
} from "@/stubs/storage/storage_pb";
import { BFF_URL, createAuthInterceptor } from "@/services/connectCommon";

function validateStorageEnv(env: "development" | "production") {
  const isDev = env === "development";
  const logger = isDev ? console.warn : console.error;
  const envPhrase = isDev ? "" : " in production";
  const hint = isDev
    ? "Check runtime env (window.__ENV) or build-time env (.env)."
    : "Ensure runtime env (env.js) or build-time env are set.";

  if (!BFF_URL) {
    logger(`[StorageService] VITE_BFF_URL is empty${envPhrase}. ${hint}`);
  }
}

if (import.meta.env.DEV) {
  validateStorageEnv("development");
}

if (import.meta.env.PROD) {
  validateStorageEnv("production");
}

const transport = createConnectTransport({
  baseUrl: `${BFF_URL}/api`,
  interceptors: [createAuthInterceptor()],
});

const storageClient: PromiseClient<typeof StorageService> = createPromiseClient(
  StorageService,
  transport
);

export type DownloadedFile = {
  objectKey: string;
  fileName: string;
  contentType: string;
  content: Uint8Array;
};

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

// ============================================
// Upload Operations
// ============================================

/**
 * 모델별 입력 파일 업로드
 * 경로: /{user_id}/{project_id}/{model_id}/{file_name}
 */
export async function uploadModelFile(params: {
  projectId: string;
  modelId: string;
  fileName: string;
  content: Uint8Array | string;
  contentType?: string;
}): Promise<UploadFileResponse> {
  const content = typeof params.content === "string"
    ? new TextEncoder().encode(params.content)
    : new Uint8Array(params.content);

  const request = new UploadModelFileRequest({
    projectId: params.projectId,
    modelId: params.modelId,
    fileName: params.fileName,
    content,
    contentType: params.contentType ?? "application/octet-stream",
  });

  return await storageClient.uploadModelFile(request);
}

/**
 * 프로젝트 공유 파일 업로드 (precice-config.xml 등)
 * 경로: /{user_id}/{project_id}/{file_name}
 */
export async function uploadProjectFile(params: {
  projectId: string;
  fileName: string;
  content: Uint8Array | string;
  contentType?: string;
}): Promise<UploadFileResponse> {
  const content = typeof params.content === "string"
    ? new TextEncoder().encode(params.content)
    : new Uint8Array(params.content);

  const request = new UploadProjectFileRequest({
    projectId: params.projectId,
    fileName: params.fileName,
    content,
    contentType: params.contentType ?? "application/octet-stream",
  });

  return await storageClient.uploadProjectFile(request);
}

// ============================================
// Query Operations
// ============================================

/**
 * 모델별 입력 파일 조회 (.i 파일 + 선택적 .nml 파일)
 * 경로: /{user_id}/{project_id}/{model_id}/
 */
export async function getModelInputFiles(
  projectId: string,
  modelId: string
): Promise<GetModelInputFilesResponse> {
  const request = new GetModelInputFilesRequest({ projectId, modelId });
  return await storageClient.getModelInputFiles(request);
}

/**
 * 결과 파일 목록 조회
 * 경로: /{user_id}/{project_id}/simulation/{simulation_id}/{task_index}/
 */
export async function listResultFiles(
  projectId: string,
  simulationId: string,
  taskIndex: number,
  _modelId?: string,
): Promise<ListResultFilesResponse> {
  const request = new ListResultFilesRequest({
    projectId,
    simulationId,
    modelId: _modelId ?? "",
    taskIndex,
  });
  return await storageClient.listResultFiles(request);
}

// ============================================
// Download Operations
// ============================================

export async function downloadFile(objectKey: string): Promise<DownloadedFile> {
  const stream = storageClient.downloadFile(new DownloadFileRequest({ objectKey }));
  const chunks: Uint8Array[] = [];

  let resolvedObjectKey = objectKey;
  let resolvedFileName = objectKey.split("/").pop() || "download";
  let resolvedContentType = "application/octet-stream";

  for await (const message of stream) {
    if (message.file) {
      resolvedObjectKey = message.file.objectKey || resolvedObjectKey;
      resolvedFileName = message.file.fileName || resolvedFileName;
      resolvedContentType = message.file.contentType || resolvedContentType;
    }
    if (message.chunk && message.chunk.length > 0) {
      chunks.push(message.chunk);
    }
  }

  return {
    objectKey: resolvedObjectKey,
    fileName: resolvedFileName,
    contentType: resolvedContentType,
    content: concatBytes(chunks),
  };
}

/**
 * 시뮬레이션 결과 파일 다운로드
 * 경로: /{user_id}/{project_id}/simulation/{simulation_id}/{task_index}/{file_name}
 */
export async function downloadTaskResultFile(
  projectId: string,
  simulationId: string,
  taskIndex: number,
  fileName: string,
  modelId?: string,
): Promise<DownloadedFile> {
  console.log(
    '[downloadTaskResultFile] projectId=%s, simulationId=%s, taskIndex=%d, fileName=%s',
    projectId, simulationId, taskIndex, fileName
  );

  const stream = storageClient.downloadTaskResultFile(
    new DownloadTaskResultFileRequest({
      projectId,
      simulationId,
      modelId: modelId ?? "",
      taskIndex,
      fileName,
    })
  );
  const chunks: Uint8Array[] = [];

  let resolvedObjectKey = "";
  let resolvedFileName = fileName || "download";
  let resolvedContentType = "application/octet-stream";

  for await (const message of stream) {
    if (message.file) {
      resolvedObjectKey = message.file.objectKey || resolvedObjectKey;
      resolvedFileName = message.file.fileName || resolvedFileName;
      resolvedContentType = message.file.contentType || resolvedContentType;
    }
    if (message.chunk && message.chunk.length > 0) {
      chunks.push(message.chunk);
    }
  }

  return {
    objectKey: resolvedObjectKey,
    fileName: resolvedFileName,
    contentType: resolvedContentType,
    content: concatBytes(chunks),
  };
}

// ============================================
// Project Operations
// ============================================

export async function deleteProject(projectId: string): Promise<DeleteProjectResponse> {
  return await storageClient.deleteProject(new DeleteProjectRequest({ projectId }));
}

export async function copyFile(srcObjectKey: string, dstObjectKey: string): Promise<CopyFileResponse> {
  return await storageClient.copyFile(new CopyFileRequest({ srcObjectKey, dstObjectKey }));
}

// ============================================
// Retry Utility
// ============================================

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delays: number[] = [100, 200, 500]
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }

      const delayTime = delays[i] || delays[delays.length - 1];
      console.warn(`[StorageService] Retry ${i + 1}/${maxRetries} (${delayTime}ms):`, error);
      await new Promise((resolve) => setTimeout(resolve, delayTime));
    }
  }
  throw new Error("[StorageService] Maximum retry count exceeded");
}

// ============================================
// Service object export
// ============================================

export const storageService = {
  uploadModelFile,
  uploadProjectFile,
  getModelInputFiles,
  listResultFiles,
  downloadFile,
  downloadTaskResultFile,
  deleteProject,
  copyFile,
  retryOperation,
};

export default storageService;
