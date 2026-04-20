/**
 * MTPLJUN Handle Tooltip Component
 * Displays tooltip information for MTPLJUN junction handles
 */

import { useState } from 'react';
import { Handle, Position, HandleProps } from 'reactflow';
import { Box, Tooltip, Zoom } from '@mui/material';
import { getFaceColor } from '@/utils/pipeHandleHelpers';

interface MtpljunHandleTooltipProps extends Omit<HandleProps, 'position'> {
  position: Position;
  face: number;
  junctionNum: number;
  flowDirection?: '+' | '-' | null;
  connectedComponent?: string;
  isConnected?: boolean;
  style?: React.CSSProperties;
}

const MtpljunHandleTooltip: React.FC<MtpljunHandleTooltipProps> = ({
  position,
  face,
  junctionNum,
  flowDirection,
  connectedComponent,
  isConnected = false,
  id,
  type,
  style,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Generate tooltip content based on junction and face info
  const getFaceDescription = (face: number): string => {
    const faceDescriptions = [
      'Face 1 (x−, Inlet)',
      'Face 2 (x+, Outlet)',
      'Face 3 (y−, CF)',
      'Face 4 (y+, CF)',
      'Face 5 (z−, CF)',
      'Face 6 (z+, CF)',
    ];
    return faceDescriptions[face - 1] || `Face ${face}`;
  };

  const tooltipContent = (
    <Box sx={{ fontSize: '12px', fontWeight: 500, padding: '4px' }}>
      <div>Junction {junctionNum.toString().padStart(2, '0')}</div>
      <div>{getFaceDescription(face)}</div>
      {flowDirection && (
        <div style={{ marginTop: 4, color: flowDirection === '+' ? '#4caf50' : '#f44336' }}>
          Flow: {flowDirection === '+' ? 'Positive (+)' : 'Negative (−)'}
        </div>
      )}
      {connectedComponent && (
        <div style={{ marginTop: 4 }}>
          Connected: {connectedComponent}
        </div>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={tooltipContent}
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

export default MtpljunHandleTooltip;