/**
 * SEPARATOR Node Component
 * Specialized branch with 3 fixed junctions:
 *   N=1: Vapor Outlet (top), N=2: Liquid Fall Back (left), N=3: Inlet (bottom)
 */

import { memo, useMemo, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { Box, Typography } from '@mui/material';
import { MARSNodeData, SeparatorParameters } from '@/types/mars';
import { useStore } from '@/stores/useStore';
import {
  resolveAppearance,
  formatDisplayId,
  getDisplayDimensions,
  getRotatedPosition,
  getShapeBorderRadius,
  getShapeClipPath,
  isSvgShape,
  STATUS_COLORS,
} from '@/utils/nodeAppearance';
import SvgNodeShape from '../common/SvgNodeShape';

const JUNCTION_LABELS: Record<number, string> = {
  1: 'V', // Vapor Outlet
  2: 'L', // Liquid Fall Back
  3: 'I', // Inlet
};

const SeparatorNode: React.FC<NodeProps<MARSNodeData>> = ({ data, selected, id }) => {
  const { componentName, componentId, componentType, status, parameters } = data;
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const isRestart = useStore((s) => s.metadata?.globalSettings?.card100?.problemType === 'restart');
  const updateNodeInternals = useUpdateNodeInternals();
  const appearance = resolveAppearance(data.appearance, componentType);
  const svgItem = useStore((s) => {
    if (!appearance.svgLibraryId) return undefined;
    return s.svgLibrary.find(item => item.id === appearance.svgLibraryId);
  });
  const params = parameters as Partial<SeparatorParameters>;
  const junctions = params?.junctions || [];
  const rotation = appearance.rotation;
  const { displayWidth, displayHeight } = getDisplayDimensions(appearance.width, appearance.height, rotation);
  const clipPath = getShapeClipPath(appearance.shape);
  const borderRadius = getShapeBorderRadius(appearance.shape, rotation);
  const statusColor = STATUS_COLORS[status] || '#999';

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

  // Fixed 3 handles for separator junctions
  const handles = useMemo(() => {
    const result: React.ReactNode[] = [];

    // N=1: Vapor Outlet — top (source + target)
    const vaporPos = getRotatedPosition(Position.Top, rotation);
    result.push(
      <Handle key="src-j1" type="source" position={vaporPos} id="source-j1"
        style={{ left: '50%', width: 12, height: 12, backgroundColor: '#FF9800', border: '2px solid white', zIndex: 10 }} />,
      <Handle key="tgt-j1" type="target" position={vaporPos} id="target-j1"
        style={{ left: '50%', width: 12, height: 12, backgroundColor: '#FF9800', border: '2px solid white', zIndex: 10, opacity: 0 }} />,
    );

    // N=2: Liquid Fall Back — left (source + target)
    const liquidPos = getRotatedPosition(Position.Left, rotation);
    result.push(
      <Handle key="src-j2" type="source" position={liquidPos} id="source-j2"
        style={{ top: '50%', width: 12, height: 12, backgroundColor: '#2196F3', border: '2px solid white', zIndex: 10 }} />,
      <Handle key="tgt-j2" type="target" position={liquidPos} id="target-j2"
        style={{ top: '50%', width: 12, height: 12, backgroundColor: '#2196F3', border: '2px solid white', zIndex: 10, opacity: 0 }} />,
    );

    // N=3: Inlet — bottom (source + target)
    const inletPos = getRotatedPosition(Position.Bottom, rotation);
    result.push(
      <Handle key="src-j3" type="source" position={inletPos} id="source-j3"
        style={{ left: '50%', width: 12, height: 12, backgroundColor: '#4CAF50', border: '2px solid white', zIndex: 10, opacity: 0 }} />,
      <Handle key="tgt-j3" type="target" position={inletPos} id="target-j3"
        style={{ left: '50%', width: 12, height: 12, backgroundColor: '#4CAF50', border: '2px solid white', zIndex: 10 }} />,
    );

    // Auto-connect (Face 0): hidden center handles for old format connections
    result.push(
      <Handle key="auto-connect-src" type="source" position={Position.Right} id="auto-connect" className="auto-connect-center" />,
      <Handle key="auto-connect-tgt" type="target" position={Position.Left} id="auto-connect" className="auto-connect-center" />,
    );

    return result;
  }, [rotation]);

  // Notify ReactFlow when handles change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [id, updateNodeInternals, rotation]);

  return (
    <>
      <NodeResizer
        isVisible={selected && !isRestart}
        minWidth={30}
        minHeight={30}
        lineStyle={{ borderColor: '#1976d2', zIndex: 10 }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#1976d2', zIndex: 10 }}
        onResize={handleResize}
      />

      {handles}

      {isSvgShape(appearance.shape) && svgItem ? (
        <SvgNodeShape
          shape={appearance.shape}
          width={displayWidth}
          height={displayHeight}
          backgroundColor={appearance.backgroundColor}
          svgMarkup={svgItem.svgMarkup}
          svgViewBox={svgItem.viewBox}
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

          {/* Junction labels inside node */}
          {junctions.map((_j, idx) => {
            const label = JUNCTION_LABELS[idx + 1] || '';
            const positions = [
              { top: 4, left: '50%', transform: 'translateX(-50%)' },  // N=1 top
              { top: '50%', left: 4, transform: 'translateY(-50%)' },  // N=2 left
              { bottom: 4, left: '50%', transform: 'translateX(-50%)' }, // N=3 bottom
            ];
            return (
              <Typography
                key={`jlabel-${idx}`}
                sx={{
                  position: 'absolute',
                  ...positions[idx],
                  fontSize: '0.5rem',
                  fontWeight: 700,
                  color: 'text.disabled',
                  lineHeight: 1,
                }}
              >
                {label}
              </Typography>
            );
          })}

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
    </>
  );
};

export default memo(SeparatorNode);
