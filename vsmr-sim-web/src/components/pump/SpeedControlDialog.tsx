/**
 * Speed Control Dialog
 * PUMP 속도 제어 편집을 위한 전체화면 다이얼로그
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
import type { PumpSpeedControl } from '../../types/mars';
import { SpeedControlEditor } from './SpeedControlEditor';

interface SpeedControlDialogProps {
  open: boolean;
  onClose: () => void;
  speedControl: PumpSpeedControl | undefined;
  onChange: (speedControl: PumpSpeedControl | undefined) => void;
}

export function SpeedControlDialog({
  open,
  onClose,
  speedControl,
  onChange,
}: SpeedControlDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Speed Control Editor (속도 제어 편집기)
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
        <SpeedControlEditor speedControl={speedControl} onChange={onChange} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
