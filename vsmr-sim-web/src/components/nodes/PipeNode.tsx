/**
 * PIPE Node Component
 * Rectangle divided into cells - supports rotation (0/90/180/270)
 * MARS standard: Cell 01 = inlet (Face 1), Cell NN = outlet (Face 2)
 *
 * Rotation mapping:
 *   0°: vertical, 01 at bottom → NN at top
 *  90°: horizontal, 01 at left → NN at right
 * 180°: vertical inverted, 01 at top → NN at bottom
 * 270°: horizontal inverted, 01 at right → NN at left
 */

import { memo, useMemo, useCallback, useEffect } from 'react';
import { NodeProps, Position, Handle, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { Box, Typography } from '@mui/material';
import { MARSNodeData, PipeParameters } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import {
  resolveAppearance,
  formatDisplayId,
  getDisplayDimensions,
  getRotatedPosition,
  isSvgShape,
} from '@/utils/nodeAppearance';
import { generateCellHandleId } from '@/utils/pipeHandleHelpers';
import SvgNodeShape from '../common/SvgNodeShape';

const PipeNode: React.FC<NodeProps<MARSNodeData>> = ({ data, selected, id }) => {
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const updateNodeInternals = useUpdateNodeInternals();
  const appearance_ = resolveAppearance(data.appearance, data.componentType);
  const svgItem = useStore((s) => {
    if (!appearance_.svgLibraryId) return undefined;
    return s.svgLibrary.find(item => item.id === appearance_.svgLibraryId);
  });

  const { componentId, componentType, parameters } = data;
  const appearance = resolveAppearance(data.appearance, data.componentType);
  const params = parameters as Partial<PipeParameters>;
  const ncells = params?.ncells || 1;
  const rotation = appearance.rotation;

  // Display dimensions (swapped for 90/270)
  const { displayWidth, displayHeight } = getDisplayDimensions(
    appearance.width,
    appearance.height,
    rotation,
  );

  // Layout direction based on rotation
  const isHorizontal = rotation === 90 || rotation === 270;
  // Whether cell order is reversed (180° or 270° flips the visual order)
  const isReversed = rotation === 180 || rotation === 270;

  // Cell size along the flow axis
  const cellSize = isHorizontal
    ? displayWidth / ncells
    : displayHeight / ncells;

  const handleResize = useCallback(
    (_: unknown, { width: dw, height: dh }: { width: number; height: number }) => {
      const isSwapped = rotation === 90 || rotation === 270;
      updateNodeAppearance(id, {
        width: Math.round(isSwapped ? dh : dw),
        height: Math.round(isSwapped ? dw : dh),
      });
    },
    [id, updateNodeAppearance, rotation],
  );

  // Build ordered cell array for rendering
  // Default (0°): NN at top → 01 at bottom (reversed: NN first in render order)
  // 90°: 01 at left → NN at right (normal order in render)
  // 180°: 01 at top → NN at bottom (normal order in render)
  // 270°: NN at left → 01 at right (reversed order in render)
  const cells = useMemo(() => {
    const arr: number[] = [];
    if (isHorizontal) {
      // Horizontal: left to right
      if (isReversed) {
        // 270°: NN at left → 01 at right
        for (let i = ncells; i >= 1; i--) arr.push(i);
      } else {
        // 90°: 01 at left → NN at right
        for (let i = 1; i <= ncells; i++) arr.push(i);
      }
    } else {
      // Vertical: top to bottom
      if (isReversed) {
        // 180°: 01 at top → NN at bottom
        for (let i = 1; i <= ncells; i++) arr.push(i);
      } else {
        // 0°: NN at top → 01 at bottom
        for (let i = ncells; i >= 1; i--) arr.push(i);
      }
    }
    return arr;
  }, [ncells, isHorizontal, isReversed]);

  // Build handles for all cells
  const handles = useMemo(() => {
    const result: React.ReactNode[] = [];

    for (let cellNum = 1; cellNum <= ncells; cellNum++) {
      // Find visual index of this cell in the render order
      const visualIndex = cells.indexOf(cellNum);
      // Center position as percentage along the flow axis
      const centerPct = ((visualIndex + 0.5) / ncells) * 100;

      // Face 1 (inlet, x-) and Face 2 (outlet, x+) - main axial handles
      // For vertical pipe (0°): Face1=Left, Face2=Right of each cell
      // getRotatedPosition handles the mapping for other rotations
      const f1Pos = getRotatedPosition(Position.Left, rotation);
      const f2Pos = getRotatedPosition(Position.Right, rotation);

      // Helper: position handle along the correct axis based on resolved Position.
      // Left/Right handles sit on vertical sides → use `top` to offset along that side.
      // Top/Bottom handles sit on horizontal edges → use `left` to offset along that edge.
      const positionStyle = (resolvedPos: Position): Pick<React.CSSProperties, 'top' | 'left' | 'transform'> => {
        const isVerticalSide = resolvedPos === Position.Left || resolvedPos === Position.Right;
        return isVerticalSide
          ? { top: `${centerPct}%`, transform: 'translateY(-50%)' }
          : { left: `${centerPct}%`, transform: 'translateX(-50%)' };
      };

      result.push(
        <Handle
          key={`${cellNum}-f1`}
          type="target"
          position={f1Pos}
          id={generateCellHandleId(cellNum, 1)}
          style={{ width: 10, height: 10, border: '2px solid white', zIndex: 10, backgroundColor: '#4caf50', ...positionStyle(f1Pos) }}
        />,
      );

      // Face 1 reverse: hidden source handle (for edges where pipe is source via face 1)
      result.push(
        <Handle
          key={`${cellNum}-f1-src`}
          type="source"
          position={f1Pos}
          id={generateCellHandleId(cellNum, 1)}
          style={{ width: 8, height: 8, backgroundColor: '#4caf50', border: '1px solid white', zIndex: 9, opacity: 0, pointerEvents: 'none' as const, ...positionStyle(f1Pos) }}
        />,
      );

      result.push(
        <Handle
          key={`${cellNum}-f2`}
          type="source"
          position={f2Pos}
          id={generateCellHandleId(cellNum, 2)}
          style={{ width: 10, height: 10, border: '2px solid white', zIndex: 10, backgroundColor: '#2196f3', ...positionStyle(f2Pos) }}
        />,
      );

      // Face 2 reverse: hidden target handle (for edges where pipe is target via face 2)
      result.push(
        <Handle
          key={`${cellNum}-f2-tgt`}
          type="target"
          position={f2Pos}
          id={generateCellHandleId(cellNum, 2)}
          style={{ width: 8, height: 8, backgroundColor: '#2196f3', border: '1px solid white', zIndex: 9, opacity: 0, pointerEvents: 'none' as const, ...positionStyle(f2Pos) }}
        />,
      );

      // CrossFlow faces (3-6) - hidden, for programmatic connections
      // Crossflow is perpendicular to flow direction but connects from the SIDES
      // (same Left/Right edges as axial handles, just different handle IDs)
      // Face 3 (y-) / Face 5 (z-): Left side (same as Face 1)
      // Face 4 (y+) / Face 6 (z+): Right side (same as Face 2)
      const crossFlowFaces = [
        { face: 3, basePos: Position.Left, color: '#ff9800' },
        { face: 4, basePos: Position.Right, color: '#9c27b0' },
        { face: 5, basePos: Position.Left, color: '#f44336' },
        { face: 6, basePos: Position.Right, color: '#00bcd4' },
      ];

      for (const { face, basePos, color } of crossFlowFaces) {
        const cfPos = getRotatedPosition(basePos, rotation);
        const cfHandleId = generateCellHandleId(cellNum, face);
        const cfStyle = {
          width: 8,
          height: 8,
          backgroundColor: color,
          border: '1px solid white',
          zIndex: 9,
          opacity: 0,
          pointerEvents: 'none' as const,
          ...positionStyle(cfPos),
        };

        // Source handle (pipe is FROM side of connection)
        result.push(
          <Handle
            key={`${cellNum}-f${face}-src`}
            type="source"
            position={cfPos}
            id={cfHandleId}
            style={cfStyle}
          />,
        );

        // Target handle (pipe is TO side of connection)
        // Same id works because ReactFlow distinguishes by id+type
        result.push(
          <Handle
            key={`${cellNum}-f${face}-tgt`}
            type="target"
            position={cfPos}
            id={cfHandleId}
            style={cfStyle}
          />,
        );
      }
    }

    // Auto-connect (Face 0): hidden center handles for old format connections (CCC000000/CCC010000)
    // CSS class 'auto-connect-center' (reactFlowOverrides.css) uses !important to override ReactFlow position classes
    result.push(
      <Handle
        key="auto-connect-src"
        type="source"
        position={Position.Right}
        id="auto-connect"
        className="auto-connect-center"
      />,
      <Handle
        key="auto-connect-tgt"
        type="target"
        position={Position.Left}
        id="auto-connect"
        className="auto-connect-center"
      />,
    );

    return result;
  }, [ncells, cells, rotation, isHorizontal]);

  // Notify ReactFlow when cell handles change (matches BranchNode/MtpljunNode pattern)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [ncells, id, updateNodeInternals]);

  const borderColor = selected ? '#1976d2' : '#bdbdbd';
  const borderWidth = selected ? 2 : 1;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={40}
        lineStyle={{ borderColor: '#1976d2', zIndex: 10 }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#1976d2', zIndex: 10 }}
        onResize={handleResize}
      />

      {/* All handles */}
      {handles}

      {/* Main pipe body: Custom SVG or default cell-based rendering */}
      {isSvgShape(appearance.shape) && svgItem ? (
        <SvgNodeShape
          shape={appearance.shape}
          width={displayWidth}
          height={displayHeight}
          backgroundColor={appearance.backgroundColor}
          svgMarkup={svgItem.svgMarkup}
          svgViewBox={svgItem.viewBox}
          selected={selected}
          dividers={{ count: ncells, direction: isHorizontal ? 'row' : 'column' }}
        >
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.primary', lineHeight: 1, textAlign: 'center', textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>
            {formatDisplayId(componentId, componentType)}
          </Typography>
        </SvgNodeShape>
      ) : (
        <Box
          sx={{
            width: displayWidth,
            height: displayHeight,
            backgroundColor: appearance.backgroundColor,
            border: `${borderWidth}px solid ${borderColor}`,
            position: 'relative',
            cursor: 'pointer',
            overflow: 'hidden',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
          }}
        >
          {/* Cell divider lines */}
          {cells.map((cellNum, index) => {
            const isLast = index === cells.length - 1;
            const dividerSx = isHorizontal
              ? { borderRight: isLast ? 'none' : '1px dashed #999' }
              : { borderBottom: isLast ? 'none' : '1px dashed #999' };

            return (
              <Box
                key={cellNum}
                sx={{
                  flex: 1,
                  ...dividerSx,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  minHeight: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: cellSize < 16 ? '0.5rem' : '0.65rem',
                    color: 'text.secondary',
                    fontWeight: 500,
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  {cellSize >= 12 ? cellNum.toString().padStart(2, '0') : ''}
                </Typography>
              </Box>
            );
          })}

          {/* Component ID overlay - center left */}
          <Typography
            sx={{
              position: 'absolute',
              top: '50%',
              left: isHorizontal ? '50%' : 4,
              transform: isHorizontal ? 'translate(-50%, -50%)' : 'translateY(-50%)',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'text.primary',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
              textShadow: '0 0 3px rgba(255,255,255,0.8), 0 0 3px rgba(255,255,255,0.8)',
            }}
          >
            {formatDisplayId(componentId, componentType)}
          </Typography>
        </Box>
      )}
    </>
  );
};

export default memo(PipeNode);
