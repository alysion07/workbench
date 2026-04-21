/**
 * PlotFileDropZone
 * plotfl 파일 드래그앤드롭 또는 파일 선택 UI
 */

import { useCallback, useState, useRef } from 'react';
import { Typography, Button, Paper } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { parsePlotfl } from '@/utils/plotflParser';
import { useAnalysisStore } from '@/stores/analysisStore';

interface PlotFileDropZoneProps {
  onLoaded?: () => void;
  fillHeight?: boolean;
}

export default function PlotFileDropZone({ onLoaded, fillHeight = false }: PlotFileDropZoneProps) {
  const loadFile = useAnalysisStore((s) => s.loadFile);
  const clearFile = useAnalysisStore((s) => s.clearFile);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const text = await file.text();
        const parsed = parsePlotfl(text);
        clearFile();
        loadFile(file.name, parsed);
        onLoaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : '파일 파싱에 실패했습니다.');
      }
    },
    [clearFile, loadFile, onLoaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <Paper
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 6,
        border: '2px dashed',
        borderColor: isDragging ? 'primary.main' : 'divider',
        backgroundColor: isDragging ? 'action.hover' : 'background.paper',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s',
        minHeight: fillHeight ? '100%' : 300,
        height: fillHeight ? '100%' : 'auto',
        width: fillHeight ? '100%' : 'auto',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="h6" color="text.secondary">
        plotfl 파일을 드래그하거나 클릭하여 선택
      </Typography>
      <Typography variant="body2" color="text.secondary">
        MARS 해석 결과 plotfl 파일을 업로드하면 시계열 그래프로 분석할 수 있습니다.
      </Typography>
      <Button variant="outlined" startIcon={<UploadIcon />}>
        파일 선택
      </Button>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      <input ref={inputRef} type="file" hidden onChange={onFileSelect} />
    </Paper>
  );
}
