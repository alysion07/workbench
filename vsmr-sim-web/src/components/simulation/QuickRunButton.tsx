/**
 * QuickRunButton
 * 퀵 시뮬레이션 실행 버튼 - 헤더에 배치
 */

import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { BoltOutlined as BoltIcon } from '@mui/icons-material';
import QuickRunDialog from './QuickRunDialog';

interface QuickRunButtonProps {
  userId: string;
  disabled?: boolean;
}

const QuickRunButton: React.FC<QuickRunButtonProps> = ({ userId, disabled = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Tooltip title="퀵 시뮬레이션 (기존 입력파일로 실행)">
        <span>
          <IconButton
            color="warning"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
            sx={{
              '&:hover': {
                backgroundColor: 'warning.light',
                color: 'warning.contrastText',
              },
            }}
          >
            <BoltIcon />
          </IconButton>
        </span>
      </Tooltip>

      <QuickRunDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userId={userId}
      />
    </>
  );
};

export default QuickRunButton;
