/**
 * Heat Structure Node Component
 * Thermal structure for ReactFlow - Nodalization shape-based rendering
 */

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { Box, Typography } from '@mui/material';
import { MARSNodeData } from '@/types/mars';
import { resolveAppearance, getShapeClipPath, getShapeBorderRadius, getShapeBackgroundImage, getRotatedPosition, getDisplayDimensions, formatDisplayId, isSvgShape, STATUS_COLORS } from '@/utils/nodeAppearance';
import { useStore } from '@/stores/useStore';
import SvgNodeShape from '../common/SvgNodeShape';

const HeatStructureNode: React.FC<NodeProps<MARSNodeData>> = ({ data, selected, id }) => {
  const { componentName, componentId, componentType, status, appearance: rawAppearance } = data;
  const appearance = resolveAppearance(rawAppearance, componentType);
  const statusColor = STATUS_COLORS[status] || '#999';
  const clipPath = getShapeClipPath(appearance.shape);
  const borderRadius = getShapeBorderRadius(appearance.shape, appearance.rotation);
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const svgItem = useStore((s) => {
    if (!appearance.svgLibraryId) return undefined;
    return s.svgLibrary.find(item => item.id === appearance.svgLibraryId);
  });
  const { displayWidth, displayHeight } = getDisplayDimensions(appearance.width, appearance.height, appearance.rotation);
  const backgroundImage = getShapeBackgroundImage(appearance.shape);

  const handleResize = useCallback(
    (_: unknown, { width: dw, height: dh }: { width: number; height: number }) => {
      const isSwapped = appearance.rotation === 90 || appearance.rotation === 270;
      updateNodeAppearance(id, {
        width: Math.round(isSwapped ? dh : dw),
        height: Math.round(isSwapped ? dw : dh),
      });
    },
    [id, updateNodeAppearance, appearance.rotation],
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={30}
        minHeight={30}
        lineStyle={{ borderColor: '#1976d2', zIndex: 10 }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#1976d2', zIndex: 10 }}
        onResize={handleResize}
      />

      {/* Left Boundary Handle (connects to fluid volumes) */}
      <Handle
        type="target"
        position={getRotatedPosition(Position.Left, appearance.rotation)}
        id="left-boundary"
        style={{
          backgroundColor: '#FF5722',
          width: 12,
          height: 12,
          border: '2px solid white',
          zIndex: 10,
        }}
      />

      {/* Node Shape - SVG or CSS */}
      {isSvgShape(appearance.shape) ? (
        <SvgNodeShape
          shape={appearance.shape}
          width={displayWidth}
          height={displayHeight}
          backgroundColor={appearance.backgroundColor}
          svgMarkup={svgItem?.svgMarkup}
          svgViewBox={svgItem?.viewBox}
          selected={selected}
        >
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.2, textAlign: 'center' }}>
            {formatDisplayId(componentId, componentType)}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.2, textAlign: 'center' }}>
            {componentName || 'Unnamed'}
          </Typography>
        </SvgNodeShape>
      ) : (
        <Box
          sx={{
            width: displayWidth,
            height: displayHeight,
            backgroundColor: appearance.backgroundColor,
            backgroundImage,
            clipPath,
            borderRadius,
            border: clipPath ? 'none' : (selected ? '2px solid #1976d2' : '1px solid #bdbdbd'),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s',
            boxShadow: selected ? '0 0 0 2px rgba(25,118,210,0.3)' : 'none',
            overflow: 'hidden',
            position: 'relative',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusColor,
            }}
          />
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'text.primary',
              lineHeight: 1.2,
              textAlign: 'center',
              px: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {formatDisplayId(componentId, componentType)}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: 'text.secondary',
              lineHeight: 1.2,
              textAlign: 'center',
              px: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {componentName || 'Unnamed'}
          </Typography>
        </Box>
      )}

      {/* Right Boundary Handle (connects to fluid volumes) */}
      <Handle
        type="source"
        position={getRotatedPosition(Position.Right, appearance.rotation)}
        id="right-boundary"
        style={{
          backgroundColor: '#FF5722',
          width: 12,
          height: 12,
          border: '2px solid white',
          zIndex: 10,
        }}
      />
    </>
  );
};

export default memo(HeatStructureNode);
