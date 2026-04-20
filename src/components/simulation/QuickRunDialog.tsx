/**
 * QuickRunDialog
 * 모델 단위 파일 관리 + 시뮬레이션 레벨 설정 파일
 *
 * .i 파일: 모델당 1개 선택 (여러 개 있으면 드롭다운)
 * .nml: 모델 레벨 설정 (각 모델 경로에 업로드)
 * .xml: 시뮬레이션 레벨 설정 (전체 공유, sharedConfigs)
 */

import { useRef, useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Paper, IconButton, CircularProgress,
  TextField, Chip, Tooltip, Divider, Select, MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon, PlayArrow as PlayIcon,
  Add as AddIcon, Delete as DeleteIcon,
  FolderOpen as FolderIcon, CloudQueue as CloudIcon,
  InsertDriveFile as FileIcon, CreateNewFolder as FolderAddIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  useCoSimQuickRun,
  type QuickRunModel,
  type SelectedFile,
  InputValidationFailedError,
} from '@/hooks/useCoSimQuickRun';
import type { InputValidationIssue } from '@/services/inputd/inputdService';
import MinioFileBrowser from './MinioFileBrowser';
import InputValidationResultDialog from './InputValidationResultDialog';
import toast from 'react-hot-toast';

interface QuickRunDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const STORAGE_KEY_PREFIX = 'simulation-run:last-input';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const QuickRunDialog: React.FC<QuickRunDialogProps> = ({ open, onClose, userId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationTargetLabel, setValidationTargetLabel] = useState('');
  const [validationIssues, setValidationIssues] = useState<InputValidationIssue[]>([]);
  const [minioTarget, setMinioTarget] = useState<{ type: 'model'; modelId: string } | { type: 'sim' } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const simFileInputRef = useRef<HTMLInputElement>(null);
  const startClickLockRef = useRef(false);
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; description?: string };
      setTitle(parsed.title ?? '');
      setDescription(parsed.description ?? '');
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ title, description }));
    } catch { /* ignore */ }
  }, [storageKey, title, description]);

  const {
    models, simFiles, isMultiModel, canStart,
    addModel, removeModel, renameModel, selectInput,
    addFilesToModel, addMinioFileToModel, removeFileFromModel,
    addSimFiles, removeSimFile,
    addModelsFromFolder, clearAll,
    startQuickRun, isLoading,
  } = useCoSimQuickRun({
    userId, title, description,
    onSuccess: () => onClose(),
    onError: (error) => {
      if (error instanceof InputValidationFailedError) {
        setValidationTargetLabel(error.targetLabel);
        setValidationIssues(error.issues);
        setValidationDialogOpen(true);
      }
    },
  });

  useEffect(() => {
    if (!isLoading) {
      startClickLockRef.current = false;
    }
  }, [isLoading]);

  const isTitleValid = title.trim().length > 0;

  const handleClose = () => {
    if (!isLoading) {
      clearAll();
      onClose();
    }
  };

  const handleStartQuickRun = () => {
    if (startClickLockRef.current || isLoading) {
      return;
    }
    startClickLockRef.current = true;
    startQuickRun();
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const count = addModelsFromFolder(fileList);
    if (count === 0) toast('인식 가능한 파일(.i, .nml, .xml)이 없습니다');
    e.target.value = '';
  };

  const handleSimFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { addSimFiles(e.target.files); e.target.value = ''; }
  };

  const handleMinioFileSelect = (file: SelectedFile) => {
    if (!minioTarget) return;
    if (minioTarget.type === 'model') {
      addMinioFileToModel(minioTarget.modelId, {
        name: file.name, path: file.path || '', projectName: file.projectName,
      });
    }
    // sim-level MinIO는 추후 필요 시 구현
    setMinioTarget(null);
  };

  return (
    <>
      <Dialog
        open={open} onClose={handleClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">퀵 시뮬레이션 실행</Typography>
            {isMultiModel && (
              <Chip label={`${models.length}개 모델`} color="primary" size="small" variant="outlined" />
            )}
          </Box>
          <IconButton onClick={handleClose} disabled={isLoading} size="small"><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>

          {/* ── 시뮬레이션 설정 파일 (precice-config.xml 등) ── */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SettingsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary">시뮬레이션 설정</Typography>
              <Button
                size="small" variant="text" onClick={() => simFileInputRef.current?.click()}
                disabled={isLoading} sx={{ fontSize: '0.75rem', ml: 'auto' }}
              >
                + 파일 추가
              </Button>
              <input
                ref={simFileInputRef} type="file" accept=".xml" multiple
                style={{ display: 'none' }} onChange={handleSimFileSelect}
              />
            </Box>
            {simFiles.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {simFiles.map((f) => (
                  <Chip
                    key={f.id}
                    icon={<FileIcon sx={{ fontSize: 14 }} />}
                    label={`${f.name}${f.size ? ` (${formatFileSize(f.size)})` : ''}`}
                    onDelete={() => removeSimFile(f.id)}
                    size="small" variant="outlined" color="info"
                    disabled={isLoading}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>
                precice-config.xml 등 전체 공유 설정 (선택 사항)
              </Typography>
            )}
          </Box>

          <Divider />

          {/* ── 모델 추가 버튼 ── */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined" startIcon={<AddIcon />}
              onClick={() => addModel()} disabled={isLoading} size="small"
            >
              모델 추가
            </Button>
            <Button
              variant="outlined" startIcon={<FolderAddIcon />}
              onClick={() => folderInputRef.current?.click()} disabled={isLoading} size="small"
            >
              폴더로 추가
            </Button>
            <input
              ref={folderInputRef} type="file"
              // @ts-expect-error webkitdirectory
              webkitdirectory="" multiple
              style={{ display: 'none' }} onChange={handleFolderSelect}
            />
          </Box>

          {/* ── 모델 카드 목록 ── */}
          {models.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'background.default' }}
            >
              <AddIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" align="center">
                "모델 추가"로 모델을 생성하거나, "폴더로 추가"로 일괄 등록하세요
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 380, overflow: 'auto' }}>
              {models.map((model, idx) => (
                <ModelCard
                  key={model.id} model={model} index={idx} disabled={isLoading}
                  onRename={renameModel} onRemove={removeModel}
                  onSelectInput={selectInput}
                  onAddFiles={addFilesToModel} onRemoveFile={removeFileFromModel}
                  onOpenMinio={(id) => setMinioTarget({ type: 'model', modelId: id })}
                />
              ))}
            </Box>
          )}

          <Divider />

          {/* ── 실행 정보 ── */}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">실행 정보</Typography>
            <TextField
              label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading} fullWidth size="small" required
              error={!isTitleValid}
              helperText={!isTitleValid ? 'Title은 필수 입력입니다' : ''}
              placeholder="시뮬레이션 제목을 입력하세요"
            />
            <TextField
              label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading} fullWidth multiline minRows={2}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {models.length > 0 && `${models.length}개 모델`}
            {simFiles.length > 0 && ` / ${simFiles.length}개 공유 설정`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleClose} disabled={isLoading}>취소</Button>
            <Button
              variant="contained" color="warning"
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <PlayIcon />}
              onClick={handleStartQuickRun} disabled={!canStart || isLoading || !isTitleValid}
            >
              {isLoading ? '실행 중...' : isMultiModel ? `${models.length}개 해석 시작` : '해석 시작'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <MinioFileBrowser
        open={minioTarget !== null}
        onClose={() => setMinioTarget(null)}
        userId={userId} onFileSelect={handleMinioFileSelect}
      />

      <InputValidationResultDialog
        open={validationDialogOpen}
        title="입력 파일 검증 결과"
        targetLabel={validationTargetLabel}
        issues={validationIssues}
        onClose={() => setValidationDialogOpen(false)}
      />
    </>
  );
};

// ============================================
// ModelCard
// ============================================

function ModelCard({
  model, index, disabled,
  onRename, onRemove, onSelectInput, onAddFiles, onRemoveFile, onOpenMinio,
}: {
  model: QuickRunModel;
  index: number;
  disabled: boolean;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onSelectInput: (modelId: string, fileId: string) => void;
  onAddFiles: (id: string, files: FileList | File[]) => void;
  onRemoveFile: (modelId: string, fileId: string) => void;
  onOpenMinio: (modelId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iFiles = model.files.filter((f) => f.name.toLowerCase().endsWith('.i'));
  const nonIFiles = model.files.filter((f) => !f.name.toLowerCase().endsWith('.i'));
  const selectedId = model.selectedInputId || iFiles[0]?.id;
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(model.id, e.target.files);
      e.target.value = '';
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Chip label={`#${index + 1}`} size="small" color="primary" variant="outlined" />
        <TextField
          value={model.name} onChange={(e) => onRename(model.id, e.target.value)}
          disabled={disabled} size="small" variant="standard" placeholder="모델명"
          sx={{ flex: 1 }} InputProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
        />
        <Chip
          label={model.modelId} size="small" variant="outlined"
          sx={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'text.disabled' }}
        />
        <IconButton size="small" onClick={() => onRemove(model.id)} disabled={disabled}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 입력 파일 선택 (.i) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pl: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
          입력 파일
        </Typography>
        {iFiles.length === 0 ? (
          <Chip label=".i 파일을 추가하세요" size="small" color="error" variant="outlined" />
        ) : iFiles.length === 1 ? (
          <Chip
            icon={<FileIcon sx={{ fontSize: 14 }} />}
            label={iFiles[0].name}
            size="small" color="primary"
          />
        ) : (
          <Select
            value={selectedId || ''}
            onChange={(e) => onSelectInput(model.id, e.target.value)}
            size="small" disabled={disabled}
            sx={{ fontSize: '0.8rem', height: 28, minWidth: 160 }}
          >
            {iFiles.map((f) => (
              <MenuItem key={f.id} value={f.id} sx={{ fontSize: '0.8rem' }}>
                {f.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      {/* 설정 파일 목록 (.nml 등, .i 제외) */}
      {nonIFiles.length > 0 && (
        <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.5, pl: 1 }}>
          {nonIFiles.map((file) => {
            const isNml = file.name.toLowerCase().endsWith('.nml');
            const isXml = file.name.toLowerCase().endsWith('.xml');
            return (
              <Box key={file.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileIcon sx={{ fontSize: 14, color: 'action.active' }} />
                <Tooltip title={file.name}>
                  <Typography
                    variant="body2"
                    sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}
                  >
                    {file.name}
                  </Typography>
                </Tooltip>
                <Chip
                  label={isNml ? 'NML' : isXml ? 'XML' : '기타'}
                  color={isNml ? 'success' : isXml ? 'info' : 'default'}
                  size="small" sx={{ fontSize: '0.65rem', height: 20 }}
                />
                {file.size != null && (
                  <Typography variant="caption" color="text.disabled" sx={{ minWidth: 50, textAlign: 'right' }}>
                    {formatFileSize(file.size)}
                  </Typography>
                )}
                <IconButton size="small" onClick={() => onRemoveFile(model.id, file.id)} disabled={disabled} sx={{ p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 파일 추가 */}
      <Box sx={{ display: 'flex', gap: 1, pl: 1 }}>
        <Button
          size="small" variant="text" startIcon={<FolderIcon sx={{ fontSize: 16 }} />}
          onClick={() => fileInputRef.current?.click()} disabled={disabled} sx={{ fontSize: '0.75rem' }}
        >
          파일 추가
        </Button>
        <Button
          size="small" variant="text" startIcon={<CloudIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenMinio(model.id)} disabled={disabled} sx={{ fontSize: '0.75rem' }}
        >
          MinIO
        </Button>
        <input
          ref={fileInputRef} type="file" accept=".i,.nml,.xml" multiple
          style={{ display: 'none' }} onChange={handleFileSelect}
        />
      </Box>
    </Paper>
  );
}

export default QuickRunDialog;
