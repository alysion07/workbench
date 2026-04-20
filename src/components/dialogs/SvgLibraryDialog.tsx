/**
 * SVG Library Dialog
 * 프로젝트 SVG 라이브러리 관리 (등록/삭제) + 타입별 기본 SVG 설정
 */

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import { ComponentType, SvgLibraryItem } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import { sanitizeSvg, validateSvgSize, readSvgFile } from '@/utils/svgSanitizer';

// 타입별 표시 이름
const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  snglvol: 'SNGLVOL',
  sngljun: 'SNGLJUN',
  pipe: 'PIPE',
  branch: 'BRANCH',
  separatr: 'SEPARATR',
  tmdpvol: 'TMDPVOL',
  tmdpjun: 'TMDPJUN',
  mtpljun: 'MTPLJUN',
  pump: 'PUMP',
  valve: 'VALVE',
  turbine: 'TURBINE',
  htstr: 'HTSTR',
  tank: 'TANK',
};

const ALL_COMPONENT_TYPES = Object.keys(COMPONENT_TYPE_LABELS) as ComponentType[];

interface SvgLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SvgLibraryDialog({ open, onClose }: SvgLibraryDialogProps) {
  const svgLibrary = useStore((s) => s.svgLibrary);
  const defaultSvgByType = useStore((s) => s.defaultSvgByType);
  const addSvgToLibrary = useStore((s) => s.addSvgToLibrary);
  const removeSvgFromLibrary = useStore((s) => s.removeSvgFromLibrary);
  const setDefaultSvgForType = useStore((s) => s.setDefaultSvgForType);
  const nodes = useStore((s) => s.nodes);

  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SVG 파일 추가 핸들러
  const handleAddSvg = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setWarnings([]);

    const file = event.target.files?.[0];
    if (!file) return;

    // 크기 검증
    const sizeError = validateSvgSize(file);
    if (sizeError) {
      setError(sizeError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const rawSvg = await readSvgFile(file);
      const result = sanitizeSvg(rawSvg);

      if (!result.sanitizedMarkup) {
        setError(result.warnings[0] || 'SVG 파일 처리 실패');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      }

      // 파일명에서 확장자 제거하여 이름으로 사용
      const name = file.name.replace(/\.svg$/i, '');

      addSvgToLibrary({
        name,
        svgMarkup: result.sanitizedMarkup,
        viewBox: result.viewBox,
      });
    } catch (err) {
      setError('SVG 파일 읽기에 실패했습니다.');
    }

    // 파일 입력 초기화 (같은 파일 재선택 가능)
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addSvgToLibrary]);

  // SVG 삭제 핸들러
  const handleRemoveSvg = useCallback((svgId: string) => {
    // 사용 중인 노드 수 확인
    const usedCount = nodes.filter(n => n.data.appearance?.svgLibraryId === svgId).length;
    if (usedCount > 0) {
      const confirmed = window.confirm(
        `이 SVG를 사용 중인 노드가 ${usedCount}개 있습니다. 삭제하면 해당 노드의 외형이 기본값으로 복원됩니다. 계속하시겠습니까?`
      );
      if (!confirmed) return;
    }
    removeSvgFromLibrary(svgId);
  }, [nodes, removeSvgFromLibrary]);

  // 타입별 기본 SVG 변경
  const handleDefaultSvgChange = useCallback((componentType: ComponentType, event: SelectChangeEvent) => {
    const value = event.target.value;
    setDefaultSvgForType(componentType, value === '' ? null : value);
  }, [setDefaultSvgForType]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        SVG 라이브러리 관리
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* 에러/경고 메시지 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarnings([])}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </Alert>
        )}

        {/* SVG 파일 추가 버튼 */}
        <Box sx={{ mb: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            onChange={handleAddSvg}
            style={{ display: 'none' }}
            id="svg-file-input"
          />
          <label htmlFor="svg-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<AddIcon />}
              size="small"
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              SVG 파일 추가 (최대 1MB)
            </Button>
          </label>
        </Box>

        {/* SVG 목록 */}
        {svgLibrary.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            등록된 SVG가 없습니다.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {svgLibrary.map((item) => (
              <SvgLibraryListItem
                key={item.id}
                item={item}
                onRemove={handleRemoveSvg}
                usedCount={nodes.filter(n => n.data.appearance?.svgLibraryId === item.id).length}
              />
            ))}
          </Box>
        )}

        {/* 타입별 기본 SVG 설정 */}
        {svgLibrary.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              타입별 기본 SVG
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              새로 생성되는 노드에 자동 적용됩니다.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {ALL_COMPONENT_TYPES.map((type) => (
                <FormControl key={type} size="small" fullWidth>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>{COMPONENT_TYPE_LABELS[type]}</InputLabel>
                  <Select
                    value={defaultSvgByType[type] ?? ''}
                    label={COMPONENT_TYPE_LABELS[type]}
                    onChange={(e) => handleDefaultSvgChange(type, e)}
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <MenuItem value="" sx={{ fontSize: '0.8rem' }}>
                      <em>없음 (기본 shape)</em>
                    </MenuItem>
                    {svgLibrary.map((item) => (
                      <MenuItem key={item.id} value={item.id} sx={{ fontSize: '0.8rem' }}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// SVG 라이브러리 아이템 컴포넌트
// ============================================================================

interface SvgLibraryListItemProps {
  item: SvgLibraryItem;
  onRemove: (id: string) => void;
  usedCount: number;
}

function SvgLibraryListItem({ item, onRemove, usedCount }: SvgLibraryListItemProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1,
        mb: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      {/* SVG 미리보기 */}
      <Box
        sx={{
          width: 48,
          height: 48,
          flexShrink: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 0.5,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          '& svg': {
            width: '100%',
            height: '100%',
            display: 'block',
          },
        }}
        dangerouslySetInnerHTML={{ __html: item.svgMarkup }}
      />

      {/* 이름 + 사용 정보 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {usedCount > 0 ? `${usedCount}개 노드에서 사용 중` : '미사용'}
        </Typography>
      </Box>

      {/* 삭제 버튼 */}
      <Tooltip title="삭제">
        <IconButton size="small" onClick={() => onRemove(item.id)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
