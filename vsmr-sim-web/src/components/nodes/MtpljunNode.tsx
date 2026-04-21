/**
 * MTPLJUN Node Component
 * Simple rectangle with dynamic From/To handles per junction
 */

import { memo, useMemo, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals, NodeResizer } from 'reactflow';
import { Box, Typography, Tooltip } from '@mui/material';
import { MARSNodeData, MtpljunParameters, VolumeReference } from '@/types/mars';
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

const MtpljunNode: React.FC<NodeProps<MARSNodeData>> = ({ data, selected, id }) => {
  const { componentName, componentId, componentType, status, parameters } = data;
  const edges = useStore((s) => s.edges);
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const updateNodeInternals = useUpdateNodeInternals();

  const appearance = resolveAppearance(data.appearance, componentType);
  const svgItem = useStore((s) => {
    if (!appearance.svgLibraryId) return undefined;
    return s.svgLibrary.find(item => item.id === appearance.svgLibraryId);
  });
  const params = parameters as Partial<MtpljunParameters>;
  const njuns = params?.njuns || 0;
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

  // Format volume reference for display
  const formatVolumeRef = (volumeRef: VolumeReference | undefined): string => {
    if (!volumeRef || !volumeRef.nodeId) return '—';
    const node = useStore.getState().nodes.find(n => n.id === volumeRef.nodeId);
    return `${node?.data?.componentName || volumeRef.nodeId}:v${volumeRef.volumeNum.toString().padStart(2, '0')}:F${volumeRef.face}`;
  };

  // Check if a junction handle is connected
  const isJunctionConnected = (junctionNum: number, isFrom: boolean): boolean => {
    return edges.some(edge =>
      isFrom
        ? edge.target === id && edge.targetHandle === `j${junctionNum}-from`
        : edge.source === id && edge.sourceHandle === `j${junctionNum}-to`
    );
  };

  // Generate handles - rotation-aware
  const handles = useMemo(() => {
    const result: React.ReactNode[] = [];
    const displayJunctions = junctions;
    const fromPos = getRotatedPosition(Position.Left, rotation);
    const toPos = getRotatedPosition(Position.Right, rotation);

    displayJunctions.forEach((junction, idx) => {
      const junctionNumber = junction.junctionNumber;
      const pct = ((idx + 1) / (displayJunctions.length + 1)) * 100;
      const fromConnected = isJunctionConnected(junctionNumber, true);
      const toConnected = isJunctionConnected(junctionNumber, false);
      const isFromVertical = fromPos === Position.Left || fromPos === Position.Right;
      const isToVertical = toPos === Position.Left || toPos === Position.Right;

      // From handle (base: Left → target)
      result.push(
        <Tooltip
          key={`j${junctionNumber}-from-tooltip`}
          title={
            <Box sx={{ fontSize: '12px', fontWeight: 500, padding: '4px' }}>
              <div>Junction {junctionNumber.toString().padStart(2, '0')} - From</div>
              <div>{formatVolumeRef(junction.from)}</div>
            </Box>
          }
          placement="left"
          arrow
        >
          <Handle
            type="target"
            position={fromPos}
            id={`j${junctionNumber}-from`}
            style={{
              ...(isFromVertical ? { top: `${pct}%` } : { left: `${pct}%` }),
              width: 12,
              height: 12,
              backgroundColor: fromConnected || junction.from ? '#4caf50' : '#bdbdbd',
              border: fromConnected || junction.from ? '2px solid white' : '1px solid #999',
              zIndex: 10,
            }}
          />
        </Tooltip>
      );

      // To handle (base: Right → source)
      result.push(
        <Tooltip
          key={`j${junctionNumber}-to-tooltip`}
          title={
            <Box sx={{ fontSize: '12px', fontWeight: 500, padding: '4px' }}>
              <div>Junction {junctionNumber.toString().padStart(2, '0')} - To</div>
              <div>{formatVolumeRef(junction.to)}</div>
            </Box>
          }
          placement="right"
          arrow
        >
          <Handle
            type="source"
            position={toPos}
            id={`j${junctionNumber}-to`}
            style={{
              ...(isToVertical ? { top: `${pct}%` } : { left: `${pct}%` }),
              width: 12,
              height: 12,
              backgroundColor: toConnected || junction.to ? '#2196f3' : '#bdbdbd',
              border: toConnected || junction.to ? '2px solid white' : '1px solid #999',
              zIndex: 10,
            }}
          />
        </Tooltip>
      );
    });

    return result;
  }, [junctions, edges, id, rotation]);

  // Force edge updates when junction count changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [njuns, junctions.length, id, updateNodeInternals]);

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

export default memo(MtpljunNode);
