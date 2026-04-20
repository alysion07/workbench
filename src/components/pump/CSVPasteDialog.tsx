/**
 * CSV Paste Dialog
 * CSV/엑셀 데이터를 붙여넣어 상사곡선 포인트로 변환
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
  Checkbox,
  FormControlLabel,
} from '@mui/material';

interface CSVPasteDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (points: { x: number; y: number }[]) => void;
  curveName: string;
  xLabel: string;
  yLabel: string;
}

interface ParseResult {
  points: { x: number; y: number }[];
  errors: string[];
}

/**
 * CSV 텍스트를 파싱하여 (x, y) 포인트 배열로 변환
 */
function parseCSVText(text: string, skipHeader: boolean): ParseResult {
  const errors: string[] = [];
  let lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');

  if (skipHeader && lines.length > 0) {
    lines = lines.slice(1);
  }

  const points: { x: number; y: number }[] = [];

  lines.forEach((line, idx) => {
    // 탭, 콤마, 세미콜론, 공백(2개 이상) 구분자 지원
    const cols = line.split(/[\t,;]+|\s{2,}/).filter((c) => c.trim() !== '');

    if (cols.length < 2) {
      errors.push(`${idx + 1}행: 최소 2개 컬럼(X,Y)이 필요합니다. (${line})`);
      return;
    }

    const [xStr, yStr] = cols;
    const x = Number(xStr.trim());
    const y = Number(yStr.trim());

    if (Number.isNaN(x) || Number.isNaN(y)) {
      errors.push(`${idx + 1}행: 숫자 변환 실패. X="${xStr}", Y="${yStr}"`);
      return;
    }

    points.push({ x, y });
  });

  // X 오름차순 정렬
  points.sort((a, b) => a.x - b.x);

  return { points, errors };
}

export function CSVPasteDialog({
  open,
  onClose,
  onApply,
  curveName,
  xLabel,
  yLabel,
}: CSVPasteDialogProps) {
  const [pasteText, setPasteText] = useState('');
  const [skipHeader, setSkipHeader] = useState(false);
  const [previewPoints, setPreviewPoints] = useState<{ x: number; y: number }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // 텍스트 변경 시 자동 파싱
  useEffect(() => {
    if (pasteText.trim() === '') {
      setPreviewPoints([]);
      setErrors([]);
      return;
    }

    const { points, errors } = parseCSVText(pasteText, skipHeader);
    setPreviewPoints(points);
    setErrors(errors);
  }, [pasteText, skipHeader]);

  // 다이얼로그 닫을 때 초기화
  const handleClose = () => {
    setPasteText('');
    setSkipHeader(false);
    setPreviewPoints([]);
    setErrors([]);
    onClose();
  };

  // 적용 버튼 클릭
  const handleApply = () => {
    if (errors.length > 0) return;
    if (previewPoints.length === 0) return;

    onApply(previewPoints);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        CSV/엑셀 데이터 붙여넣기 - {curveName.toUpperCase()}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          엑셀에서 X, Y 두 컬럼을 선택 후 Ctrl+C → 아래 입력창을 클릭하고 Ctrl+V 하세요.
          <br />
          구분자는 쉼표(,), 탭, 공백 모두 자동 감지합니다.
        </Typography>

        {/* 옵션 */}
        <Box sx={{ my: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={skipHeader}
                onChange={(e) => setSkipHeader(e.target.checked)}
              />
            }
            label="첫 줄은 헤더로 무시"
          />
        </Box>

        {/* 텍스트 입력 */}
        <TextField
          autoFocus
          multiline
          rows={8}
          fullWidth
          placeholder={`예시:\n${xLabel}\t${yLabel}\n0.000\t1.652\n0.072\t1.566\n0.144\t1.525`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
        />

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
        {previewPoints.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              미리보기 ({previewPoints.length}개 포인트)
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>X ({xLabel})</TableCell>
                    <TableCell>Y ({yLabel})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewPoints.slice(0, 10).map((pt, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{pt.x.toFixed(6)}</TableCell>
                      <TableCell>{pt.y.toFixed(6)}</TableCell>
                    </TableRow>
                  ))}
                  {previewPoints.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="caption" color="text.secondary">
                          ... 외 {previewPoints.length - 10}개 포인트
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
          disabled={errors.length > 0 || previewPoints.length === 0}
        >
          적용
        </Button>
      </DialogActions>
    </Dialog>
  );
}
