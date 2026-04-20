/**
 * MARS Card Import Dialog
 * .i 파일에서 MARS 카드 라인들을 붙여넣어 데이터로 변환
 *
 * 1단계: CCC1201 (Volume Initial Conditions) 지원
 * 향후: 다른 카드 타입으로 확장 가능
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  parseInitialConditionCards,
  type ParsedInitialCondition,
} from '@/utils/marsCardParser';

interface MarsCardImportDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (rows: ParsedInitialCondition[]) => void;
  title: string;
}

export function MarsCardImportDialog({
  open,
  onClose,
  onApply,
  title,
}: MarsCardImportDialogProps) {
  const [pasteText, setPasteText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedInitialCondition[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // 텍스트 변경 시 자동 파싱
  useEffect(() => {
    if (pasteText.trim() === '') {
      setPreviewRows([]);
      setErrors([]);
      setWarnings([]);
      return;
    }

    const result = parseInitialConditionCards(pasteText);
    setPreviewRows(result.rows);
    setErrors(result.errors);
    setWarnings(result.warnings);
  }, [pasteText]);

  // 다이얼로그 닫을 때 초기화
  const handleClose = () => {
    setPasteText('');
    setPreviewRows([]);
    setErrors([]);
    setWarnings([]);
    onClose();
  };

  // 적용 버튼 클릭
  const handleApply = () => {
    if (errors.length > 0) return;
    if (previewRows.length === 0) return;

    onApply(previewRows);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        MARS 카드 Import — {title}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          .i 파일에서 CCC1201 라인들을 복사하여 아래에 붙여넣으세요.
          <br />
          주석(*)은 자동으로 무시되며, 과학적 표기법(6.679e6)도 지원합니다.
        </Typography>

        {/* 텍스트 입력 */}
        <TextField
          autoFocus
          multiline
          rows={10}
          fullWidth
          placeholder={[
            '예시 (.i 파일에서 복사):',
            '3101201  003  6.679e6   503.150  0.0  0.0  0.0   1',
            '3101202  003  6.673e6   528.154  0.0  0.0  0.0   2',
            '3101203  003  6.663e6   544.660  0.0  0.0  0.0   3',
            '3101204  003  6.653e6   555.526  0.0  0.0  0.0   4',
          ].join('\n')}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          sx={{ mt: 2, fontFamily: 'monospace', fontSize: '0.85rem' }}
        />

        {/* 경고 메시지 */}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {warnings.map((w, idx) => (
                <li key={idx}>
                  <Typography variant="caption">{w}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {/* 에러 메시지 */}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              파싱 오류:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {errors.map((err, idx) => (
                <li key={idx}>
                  <Typography variant="caption">{err}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {/* 미리보기 테이블 */}
        {previewRows.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              미리보기 ({previewRows.length}개 행)
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 250 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>EBT</TableCell>
                    <TableCell align="right">Pressure (Pa)</TableCell>
                    <TableCell align="right">Temp (K) / Quality</TableCell>
                    <TableCell align="right">End Cell</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.slice(0, 20).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{row.ebt}</TableCell>
                      <TableCell align="right">
                        {row.pressure.toExponential(4)}
                      </TableCell>
                      <TableCell align="right">
                        {row.ebt === '002'
                          ? row.quality?.toFixed(4) ?? '-'
                          : row.temperature?.toFixed(3) ?? '-'}
                      </TableCell>
                      <TableCell align="right">{row.endCell}</TableCell>
                    </TableRow>
                  ))}
                  {previewRows.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="caption" color="text.secondary">
                          ... 외 {previewRows.length - 20}개 행
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={errors.length > 0 || previewRows.length === 0}
        >
          적용 ({previewRows.length}개 행)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
