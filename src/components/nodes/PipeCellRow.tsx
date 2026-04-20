/**
 * Pipe Cell Row Component
 * Represents a single cell row in the PIPE node
 */

import { Box, Typography } from '@mui/material';
import { CellConnectionInfo } from '@/utils/pipeHandleHelpers';

interface PipeCellRowProps {
  cellNum: number;
  componentId: string;
  isExpanded: boolean;
  connections: CellConnectionInfo | undefined;
  rowIndex: number;  // 셀 행의 인덱스 (0부터 시작)
  totalVisibleCells: number;  // 표시되는 총 셀 개수
}

const PipeCellRow: React.FC<PipeCellRowProps> = ({
  cellNum,
  componentId: _componentId,
  isExpanded: _isExpanded,
  connections: _connections,
  rowIndex: _rowIndex,
  totalVisibleCells: _totalVisibleCells
}) => {
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 1.5,
        px: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': {
          borderBottom: 'none',
        },
        position: 'relative',
        minHeight: 60,
      }}
    >
      {/* 셀 번호 라벨 */}
      <Typography
        variant="caption"
        sx={{
          minWidth: 50,
          ml: 1,
          fontWeight: 500,
          color: 'text.secondary',
          fontSize: '0.75rem',
        }}
      >
        v{cellNum.toString().padStart(2, '0')}
      </Typography>
      
      {/* 셀 정보 (중앙) */}
      <Box sx={{ flex: 1, mx: 1 }} />
    </Box>
  );
};

export default PipeCellRow;

