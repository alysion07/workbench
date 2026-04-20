/**
 * Project Service
 * MinIO를 사용한 프로젝트 CRUD 서비스
 */

import { storageService } from '@/services/storage/storageService';

export interface ProjectInfo {
  name: string;
  count: number;
}

export interface UploadedInputFile {
  objectKey: string;
  fileUrl: string;
}

export const ProjectService = {
  /**
   * 재시도 래퍼 함수 (최적화된 지연 시간)
   * @param operation 실행할 비동기 작업
   * @param maxRetries 최대 재시도 횟수
   * @param delays 재시도 간 지연 시간 배열 (ms) - 기본값: [100, 200, 500]
   * @returns 작업 결과
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delays: number[] = [100, 200, 500]
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        const delayTime = delays[i] || delays[delays.length - 1];
        console.warn(`재시도 ${i + 1}/${maxRetries} (${delayTime}ms 후):`, error);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
    }
    throw new Error('최대 재시도 횟수 초과');
  },


  /**
   * 사용자의 모든 프로젝트 목록 조회 (재시도 적용)
   * @param userId 사용자 ID (예: 'user1')
   * @returns 프로젝트 이름 배열 (예: ['projectA', 'projectB'])
   */
  async listProjects(userId: string): Promise<string[]> {
    return this.retryOperation(async () => {
      // const response = await storageService.listProjects(userId);
      // return response.projectNames || [];
      void userId;
      return [];
    });
  },

  /**
   * 프로젝트 JSON 파일 로딩 (재시도 적용)
   * @param userId 사용자 ID
   * @param projectName 프로젝트 이름
   * @returns 프로젝트 데이터 (nodes + edges + metadata)
   */
  async loadProjectJson(userId: string, projectName: string): Promise<any> {
    return this.retryOperation(async () => {
      const objectKey = `${userId}/${projectName}/${projectName}.json`;
      const content = await this.getFileContentByKey(objectKey);
      const json = JSON.parse(content);
      if (!json.nodes || !json.edges) {
        throw new Error('유효하지 않은 프로젝트 데이터입니다');
      }

      return json;
    });
  },

  /**
   * 프로젝트 하위 파일 전체 조회 (재시도 적용)
   * @param userId 사용자 ID
   * @param projectName 프로젝트 이름
   * @returns 파일 경로 배열
   */
  async listProjectFiles(userId: string, projectName: string): Promise<string[]> {
    return this.retryOperation(async () => {
      // const response = await storageService.listProjectFiles(userId, projectName);
      // const prefix = `${userId}/${projectName}/`;
      // return (response.files || [])
      //   .map((item) => item.key)
      //   .filter((key) => key !== prefix);
      void userId;
      void projectName;
      return [];
    });
  },

  /**
   * object_key 기반 파일 다운로드 (DownloadFile stream)
   */
  async downloadObjectToBrowser(objectKey: string, downloadFileName?: string): Promise<void> {
    const response = await storageService.downloadFile(objectKey);
    const contentBuffer = response.content.buffer.slice(
      response.content.byteOffset,
      response.content.byteOffset + response.content.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([contentBuffer], {
      type: response.contentType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);

    const fileName = downloadFileName
      || response.fileName
      || objectKey.split('/').pop()
      || 'download';

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async listResultFiles(projectId: string, simulationId: string, taskIndex: number, modelId?: string) {
    const response = await storageService.listResultFiles(projectId, simulationId, taskIndex, modelId);
    return response.files;
  },

  async getModelInputFiles(projectId: string, modelId: string) {
    const response = await storageService.getModelInputFiles(projectId, modelId);
    return response;
  },

  /**
   * 프로젝트 레벨 파일 업로드 (precice-config.xml 등)
   * 경로: /{user_id}/{project_id}/{file_name}
   * @param projectId 프로젝트 ID
   * @param file 업로드할 File 객체
   * @returns 업로드된 파일의 object_key 와 버킷 포함 s3 URL
   */
  async uploadProjectFileFromFile(projectId: string, file: File): Promise<UploadedInputFile> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.uploadProjectFile(
      projectId,
      file.name,
      new Uint8Array(arrayBuffer),
      file.type || 'application/octet-stream',
    );
  },

  /**
   * 프로젝트 레벨 파일 콘텐츠 업로드
   * 경로: /{user_id}/{project_id}/{file_name}
   * @param projectId 프로젝트 ID
   * @param fileName 저장할 파일 이름
   * @param content 파일 콘텐츠 (string 또는 Uint8Array)
   * @param contentType MIME 타입 (기본값: 'application/octet-stream')
   * @returns 업로드된 파일의 object_key 와 버킷 포함 s3 URL
   */
  async uploadProjectFile(
    projectId: string,
    fileName: string,
    content: string | Uint8Array,
    contentType?: string,
  ): Promise<UploadedInputFile> {
    const response = await storageService.uploadProjectFile({
      projectId,
      fileName,
      content,
      contentType: contentType || 'application/octet-stream',
    });

    if (!response.success || !response.objectKey) {
      throw new Error(response.message || '프로젝트 파일 업로드에 실패했습니다');
    }

    const objectKey = String(response.objectKey || '').trim().replace(/^\/+/, '');
    const fileUrl = String(response.fileUrl || '').trim();
    if (!fileUrl) {
      throw new Error('프로젝트 파일 업로드 응답에 fileUrl이 없습니다');
    }

    return { objectKey, fileUrl };
  },

  /**
   * Co-Sim 모델 입력 파일(.i) 업로드
   * 경로: /{user_id}/{project_id}/{model_id}/{file_name}
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID
   * @param file 업로드할 File 객체
   * @returns 업로드된 파일의 object_key 와 버킷 포함 s3 URL
   */
  async uploadModelInputFile(projectId: string, modelId: string, file: File): Promise<UploadedInputFile> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.uploadModelFile(
      projectId,
      modelId,
      file.name,
      new Uint8Array(arrayBuffer),
      file.type || 'application/octet-stream',
    );
  },

  /**
   * Co-Sim 모델 입력 파일 콘텐츠 업로드
   * 경로: /{user_id}/{project_id}/{model_id}/{file_name}
   * @param projectId 프로젝트 ID
   * @param modelId 모델 ID
   * @param fileName 저장할 파일 이름
   * @param content 파일 콘텐츠 (string 또는 Uint8Array)
   * @param contentType MIME 타입 (기본값: 'application/octet-stream')
   * @returns 업로드된 파일의 object_key 와 버킷 포함 s3 URL
   */
  async uploadModelFile(
    projectId: string,
    modelId: string,
    fileName: string,
    content: string | Uint8Array,
    contentType?: string,
  ): Promise<UploadedInputFile> {
    const response = await storageService.uploadModelFile({
      projectId,
      modelId,
      fileName,
      content,
      contentType: contentType || 'application/octet-stream',
    });

    if (!response.success || !response.objectKey) {
      throw new Error(response.message || '모델 입력 파일 업로드에 실패했습니다');
    }

    const objectKey = String(response.objectKey || '').trim().replace(/^\/+/, '');
    const fileUrl = String(response.fileUrl || '').trim();
    if (!fileUrl) {
      throw new Error('모델 입력 파일 업로드 응답에 fileUrl이 없습니다');
    }

    return { objectKey, fileUrl };
  },

  /**
   * JSON 파일 업로드
   * @param userId 사용자 ID
   * @param projectName 프로젝트 이름
   * @param file JSON Blob/File
   */
  async uploadProjectJson(userId: string, projectName: string, file: Blob | File): Promise<void> {
    const fileName = `${projectName}.json`;
    const arrayBuffer = await file.arrayBuffer();
    await this.uploadProjectFile(
      projectName,
      fileName,
      new Uint8Array(arrayBuffer),
      file.type || 'application/json',
    );
    void userId;
  },

  /**
   * 프로젝트 JSON 저장 (에디터에서 저장 시 사용)
   * @param userId 사용자 ID
   * @param projectName 프로젝트 이름
   * @param data 프로젝트 데이터 객체
   */
  async saveProjectJson(userId: string, projectName: string, data: any): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    await this.uploadProjectJson(userId, projectName, blob);
  },

  /**
   * 프로젝트 전체 삭제 (폴더 단위)
   * @param projectId 프로젝트 ID
   */
  async deleteProject(projectId: string): Promise<void> {
    const response = await storageService.deleteProject(projectId);
    if (!response.success) {
      throw new Error(response.message || `프로젝트 삭제 실패: ${projectId}`);
    }
  },

  /**
   * 파일 내용 가져오기 (텍스트)
   * @param userId 사용자 ID
   * @param projectName 프로젝트 이름
   * @param fileName 파일 이름
   * @returns 파일 내용 문자열
   */
  async getFileContent(userId: string, projectName: string, fileName: string): Promise<string> {
    return await this.getFileContentByKey(`${userId}/${projectName}/${fileName}`);
  },

  /**
   * 파일 내용 가져오기 (경로로 직접 접근)
   * @param objectKey 전체 경로 (예: 'user1/projectA/file.i')
   * @returns 파일 내용 문자열
   */
  async getFileContentByKey(objectKey: string): Promise<string> {
    return this.retryOperation(async () => {
      const response = await storageService.downloadFile(objectKey);
      return new TextDecoder().decode(response.content);
    });
  },
};

