/**
 * Homologous Curve Dialog
 * PUMP 상사곡선 편집을 위한 전체화면 다이얼로그
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { PumpCurve } from '../../types/mars';
import { HomologousCurveEditor } from './HomologousCurveEditor';

interface HomologousCurveDialogProps {
  open: boolean;
  onClose: () => void;
  curves: PumpCurve[];
  onChange: (curves: PumpCurve[]) => void;
}

export function HomologousCurveDialog({
  open,
  onClose,
  curves,
  onChange,
}: HomologousCurveDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        Homologous Curves Editor (상사곡선 편집기)
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <HomologousCurveEditor curves={curves} onChange={onChange} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
