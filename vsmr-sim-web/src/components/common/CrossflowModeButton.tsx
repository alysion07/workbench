/**
 * CrossFlow Connection Button Component
 * Floating action button to open crossflow connection wizard dialog
 */

import { Fab, Tooltip, Zoom } from '@mui/material';
import { AccountTree } from '@mui/icons-material';
import { useStore } from '@/stores/useStore';

const CrossflowModeButton: React.FC = () => {
  const { openCrossflowDialog } = useStore();

  return (
    <Zoom in={true}>
      <Tooltip
        title="CrossFlow 연결 생성"
        arrow
        placement="right"
      >
        <Fab
          color="primary"
          size="medium"
          onClick={() => openCrossflowDialog()}
          sx={{
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
            },
          }}
          aria-label="Create CrossFlow connection"
        >
          <AccountTree />
        </Fab>
      </Tooltip>
    </Zoom>
  );
};

export default CrossflowModeButton;

