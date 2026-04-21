import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';

interface InputValidationResultDialogProps {
  open: boolean;
  title: string;
  targetLabel?: string;
  issues: string[];
  onClose: () => void;
}

export default function InputValidationResultDialog({
  open,
  title,
  targetLabel,
  issues,
  onClose,
}: InputValidationResultDialogProps) {
  const normalizedIssues = issues
    .flatMap((issue) => String(issue ?? '').replace(/\r/g, '').split('\n'))
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {targetLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            대상: {targetLabel}
          </Typography>
        )}

        {normalizedIssues.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="PASS" color="success" size="small" />
            <Typography variant="body2">입력 파일 검증을 통과했습니다.</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Chip label="FAIL" color="error" size="small" />
              <Typography variant="body2">검증 오류 {normalizedIssues.length}건</Typography>
            </Box>
            <Box
              sx={{
                height: 400,
                overflow: 'auto',
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.35,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'text.primary',
              }}
            >
              {normalizedIssues.map((issue, index) => (
                <Box key={index} sx={{ mb: index < normalizedIssues.length - 1 ? 0.5 : 0 }}>
                  {issue || 'Unknown validation error'}
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
}
