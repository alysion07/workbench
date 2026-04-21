/**
 * Handle Tooltip Component
 * Displays tooltip information for pipe handles
 */

import { useState } from 'react';
import { Handle, Position, HandleProps } from 'reactflow';
import { Box, Tooltip, Zoom } from '@mui/material';
import { getFaceDescription, getFaceColor } from '@/utils/pipeHandleHelpers';

interface HandleTooltipProps extends Omit<HandleProps, 'position'> {
  position: Position;
  face: number;
  cellNum: number;
  isConnected?: boolean;
  style?: React.CSSProperties;
}

const HandleTooltip: React.FC<HandleTooltipProps> = ({
  position,
  face,
  cellNum,
  isConnected = false,
  id,
  type,
  style,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const tooltipContent = getFaceDescription(face, cellNum);

  return (
    <Tooltip
      title={
        <Box sx={{
          fontSize: '12px',
          fontWeight: 500,
          padding: '4px',
        }}>
          {tooltipContent}
        </Box>
      }
      placement={
        position === Position.Left ? 'left' :
        position === Position.Right ? 'right' :
        position === Position.Top ? 'top' :
        'bottom'
      }
      arrow
      open={isHovered}
      TransitionComponent={Zoom}
      enterDelay={200}
      leaveDelay={0}
      sx={{
        '& .MuiTooltip-tooltip': {
          backgroundColor: 'rgba(0, 0, 0, 0.87)',
          fontSize: '12px',
        },
        '& .MuiTooltip-arrow': {
          color: 'rgba(0, 0, 0, 0.87)',
        },
      }}
    >
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          width: isHovered ? 16 : 12,
          height: isHovered ? 16 : 12,
          backgroundColor: isHovered ? getFaceColor(face) : (isConnected ? getFaceColor(face) : '#bdbdbd'),
          border: isHovered ? '2px solid white' : (isConnected ? '2px solid white' : '1px solid #999'),
          boxShadow: isHovered ? '0 0 8px rgba(0, 0, 0, 0.3)' : 'none',
          cursor: 'grab',
          zIndex: 10,
          transition: 'all 0.2s ease',
          ...style, // Apply custom styles last to allow override
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    </Tooltip>
  );
};

export default HandleTooltip;