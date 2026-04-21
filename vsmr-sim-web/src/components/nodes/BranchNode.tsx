/**
 * BRANCH Node Component
 * Simple rectangle with dynamic junction handles (inlet left, outlet right)
 */

import { memo, useMemo, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import { Box, Typography } from '@mui/material';
import { MARSNodeData, BranchParameters } from '@/types/mars';
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

const BranchNode: React.FC<NodeProps<MARSNodeData>> = ({ data, selected, id }) => {
  const { componentName, componentId, componentType, status, parameters } = data;
  const updateNodeAppearance = useStore((s) => s.updateNodeAppearance);
  const updateNodeInternals = useUpdateNodeInternals();
  const appearance = resolveAppearance(data.appearance, componentType);
  const svgItem = useStore((s) => {
    if (!appearance.svgLibraryId) return undefined;
    return s.svgLibrary.find(item => item.id === appearance.svgLibraryId);
  });
  const params = parameters as Partial<BranchParameters>;
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

  // direction 추론: 명시적 direction > branchFace > from/to의 nodeId로 판단
  const inferDirection = useCallback((j: any): 'inlet' | 'outlet' => {
    if (j.direction) return j.direction;
    if (j.branchFace != null) return j.branchFace === 1 ? 'inlet' : 'outlet';
    // from/to VolumeReference에서 추론: to.nodeId가 자기 자신이면 inlet
    if (j.to?.nodeId === id) return 'inlet';
    if (j.from?.nodeId === id) return 'outlet';
    return 'outlet';
  }, [id]);

  const inletJunctions = useMemo(() => junctions.filter(j => inferDirection(j) === 'inlet'), [junctions, inferDirection]);
  const outletJunctions = useMemo(() => junctions.filter(j => inferDirection(j) === 'outlet'), [junctions, inferDirection]);

  // 핸들 생성 - rotation에 따라 위치 변환
  const handles = useMemo(() => {
    const result: React.ReactNode[] = [];

    // Inlet handles (base: Left)
    const inletPos = getRotatedPosition(Position.Left, rotation);
    inletJunctions.forEach((junction, idx) => {
      const pct = ((idx + 1) / (inletJunctions.length + 1)) * 100;
      const isVerticalSide = inletPos === Position.Left || inletPos === Position.Right;
      result.push(
        <Handle
          key={`inlet-j${junction.junctionNumber}`}
          type="target"
          position={inletPos}
          id={`target-j${junction.junctionNumber}`}
          style={{
            ...(isVerticalSide ? { top: `${pct}%` } : { left: `${pct}%` }),
            width: 12,
            height: 12,
            backgroundColor: '#2196F3',
            border: '2px solid white',
            zIndex: 10,
          }}
        />
      );
    });

    // Outlet handles (base: Right)
    const outletPos = getRotatedPosition(Position.Right, rotation);
    outletJunctions.forEach((junction, idx) => {
      const pct = ((idx + 1) / (outletJunctions.length + 1)) * 100;
      const isVerticalSide = outletPos === Position.Left || outletPos === Position.Right;
      result.push(
        <Handle
          key={`outlet-j${junction.junctionNumber}`}
          type="source"
          position={outletPos}
          id={`source-j${junction.junctionNumber}`}
          style={{
            ...(isVerticalSide ? { top: `${pct}%` } : { left: `${pct}%` }),
            width: 12,
            height: 12,
            backgroundColor: '#FF9800',
            border: '2px solid white',
            zIndex: 10,
          }}
        />
      );
    });

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
  }, [inletJunctions, outletJunctions, rotation]);

  // Notify ReactFlow when junction handles change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [junctions.length, id, updateNodeInternals]);

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

export default memo(BranchNode);
