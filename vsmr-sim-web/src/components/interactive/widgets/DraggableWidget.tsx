/**
 * DraggableWidget
 * 위젯을 노드 기준 절대 위치에 렌더링하며, 드래그 이동 + 리사이즈를 지원한다.
 * ReactFlow의 nodrag/nopan 클래스를 사용하여 캔버스 이벤트와 충돌하지 않는다.
 * F3.4-F3.6: Pinned 위젯 줌 보정 + 핀 아이콘 표시
 * R2: 바디 전체 드래그 + 잠금(이동/리사이즈) 토글
 * R4: 4-corner 리사이즈 핸들
 */

import { memo, useRef, useCallback, useState } from 'react';
import { Box } from '@mui/material';
import { useViewport } from 'reactflow';

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

interface DraggableWidgetProps {
  /** 노드 좌상단 기준 X 오프셋 */
  x: number;
  /** 노드 좌상단 기준 Y 오프셋 */
  y: number;
  /** 커스텀 너비 (undefined면 auto) */
  width?: number;
  /** 커스텀 높이 (undefined면 auto) */
  height?: number;
  /** 리사이즈 가능 여부 (mini-chart만 true) */
  resizable?: boolean;
  /** F3.6: 핀 상태 표시 */
  pinned?: boolean;
  /** F3.4: Pinned HUD 줌 보정 스케일 (undefined면 미적용) */
  pinScale?: number;
  /** R2: 이동+리사이즈 잠금 */
  locked?: boolean;
  /** 드래그 종료 시 */
  onDragEnd: (x: number, y: number) => void;
  /** 리사이즈 종료 시 */
  onResizeEnd?: (width: number, height: number) => void;
  children: React.ReactNode;
}

const MIN_W = 140;
const MIN_H = 56;

/** 코너별 사이즈 delta 계산 */
function cornerSizeDelta(corner: ResizeCorner, rawDx: number, rawDy: number) {
  switch (corner) {
    case 'se': return { dw: rawDx, dh: rawDy };
    case 'ne': return { dw: rawDx, dh: -rawDy };
    case 'sw': return { dw: -rawDx, dh: rawDy };
    case 'nw': return { dw: -rawDx, dh: -rawDy };
  }
}

/** 코너별 위치 보정 (NW/NE/SW는 사이즈 변화만큼 위치도 이동) */
function cornerPosAdjust(corner: ResizeCorner, actualDw: number, actualDh: number) {
  let dx = 0, dy = 0;
  if (corner === 'nw' || corner === 'sw') dx = -actualDw;
  if (corner === 'nw' || corner === 'ne') dy = -actualDh;
  return { dx, dy };
}

const CORNER_DEFS: { corner: ResizeCorner; pos: Record<string, number>; cursor: string; border: Record<string, string> }[] = [
  {
    corner: 'nw',
    pos: { top: -4, left: -4 },
    cursor: 'nwse-resize',
    border: { borderLeft: '2px solid rgba(0,0,0,0.4)', borderTop: '2px solid rgba(0,0,0,0.4)' },
  },
  {
    corner: 'ne',
    pos: { top: -4, right: -4 },
    cursor: 'nesw-resize',
    border: { borderRight: '2px solid rgba(0,0,0,0.4)', borderTop: '2px solid rgba(0,0,0,0.4)' },
  },
  {
    corner: 'sw',
    pos: { bottom: -4, left: -4 },
    cursor: 'nesw-resize',
    border: { borderLeft: '2px solid rgba(0,0,0,0.4)', borderBottom: '2px solid rgba(0,0,0,0.4)' },
  },
  {
    corner: 'se',
    pos: { bottom: -4, right: -4 },
    cursor: 'nwse-resize',
    border: { borderRight: '2px solid rgba(0,0,0,0.4)', borderBottom: '2px solid rgba(0,0,0,0.4)' },
  },
];

/** ::after 위치: 코너에 따라 border 꺾임 위치 지정 */
function cornerAfterPos(corner: ResizeCorner): Record<string, number | string> {
  switch (corner) {
    case 'se': return { bottom: 2, right: 2 };
    case 'sw': return { bottom: 2, left: 2 };
    case 'ne': return { top: 2, right: 2 };
    case 'nw': return { top: 2, left: 2 };
  }
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  x,
  y,
  width,
  height,
  resizable = false,
  pinned: _pinned = false,
  pinScale,
  locked = false,
  onDragEnd,
  onResizeEnd,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoom } = useViewport();
  // zoom을 ref로 보관하여 mousemove 콜백에서 최신값 참조
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // pinScale을 ref로 보관 — resize mousemove 콜백에서 최신값 참조
  const pinScaleRef = useRef(pinScale);
  pinScaleRef.current = pinScale;

  // ── Drag State ──
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, originX: x, originY: y };
    setDragOffset({ dx: 0, dy: 0 });

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const z = zoomRef.current || 1;
      const dx = (ev.clientX - dragStartRef.current.startX) / z;
      const dy = (ev.clientY - dragStartRef.current.startY) / z;
      setDragOffset({ dx, dy });
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (dragStartRef.current) {
        const z = zoomRef.current || 1;
        const dx = (ev.clientX - dragStartRef.current.startX) / z;
        const dy = (ev.clientY - dragStartRef.current.startY) / z;
        onDragEnd(dragStartRef.current.originX + dx, dragStartRef.current.originY + dy);
      }
      dragStartRef.current = null;
      setDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [x, y, onDragEnd, locked]);

  // ── Resize State (4-corner) ──
  const [resizeDelta, setResizeDelta] = useState<{ rawDx: number; rawDy: number } | null>(null);
  const resizeStartRef = useRef<{
    startX: number; startY: number;
    origW: number; origH: number;
    origPosX: number; origPosY: number;
    corner: ResizeCorner;
  } | null>(null);

  const handleResizeStart = useCallback((corner: ResizeCorner, e: React.MouseEvent) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const z = zoomRef.current || 1;
    const ps = pinScaleRef.current || 1;
    const rect = containerRef.current.getBoundingClientRect();
    // getBoundingClientRect는 화면 픽셀(zoom * pinScale 적용됨)이므로 두 배율 모두 보정
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: width ?? (rect.width / z / ps),
      origH: height ?? (rect.height / z / ps),
      origPosX: x,
      origPosY: y,
      corner,
    };
    setResizeDelta({ rawDx: 0, rawDy: 0 });

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const curZ = zoomRef.current || 1;
      const curPs = pinScaleRef.current || 1;
      const rawDx = (ev.clientX - resizeStartRef.current.startX) / curZ / curPs;
      const rawDy = (ev.clientY - resizeStartRef.current.startY) / curZ / curPs;
      setResizeDelta({ rawDx, rawDy });
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (resizeStartRef.current) {
        const { corner: c, origW, origH, origPosX, origPosY } = resizeStartRef.current;
        const curZ = zoomRef.current || 1;
        const curPs = pinScaleRef.current || 1;
        const rawDx = (ev.clientX - resizeStartRef.current.startX) / curZ / curPs;
        const rawDy = (ev.clientY - resizeStartRef.current.startY) / curZ / curPs;

        const { dw, dh } = cornerSizeDelta(c, rawDx, rawDy);
        const newW = Math.max(MIN_W, origW + dw);
        const newH = Math.max(MIN_H, origH + dh);

        if (onResizeEnd) {
          onResizeEnd(newW, newH);
        }

        // NW/NE/SW 코너는 위치도 이동해야 함
        const actualDw = newW - origW;
        const actualDh = newH - origH;
        const { dx: posAdjX, dy: posAdjY } = cornerPosAdjust(c, actualDw, actualDh);
        if (posAdjX !== 0 || posAdjY !== 0) {
          onDragEnd(origPosX + posAdjX, origPosY + posAdjY);
        }
      }
      resizeStartRef.current = null;
      setResizeDelta(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [x, y, width, height, onDragEnd, onResizeEnd, locked]);

  // ── Computed position/size ──
  let containerWidth = width;
  let containerHeight = height;
  let resizePosAdjX = 0;
  let resizePosAdjY = 0;

  if (resizeDelta && resizeStartRef.current) {
    const { corner, origW, origH } = resizeStartRef.current;
    const { rawDx, rawDy } = resizeDelta;
    const { dw, dh } = cornerSizeDelta(corner, rawDx, rawDy);

    const newW = Math.max(MIN_W, origW + dw);
    const newH = Math.max(MIN_H, origH + dh);
    containerWidth = newW;
    containerHeight = newH;

    const actualDw = newW - origW;
    const actualDh = newH - origH;
    const adj = cornerPosAdjust(corner, actualDw, actualDh);
    resizePosAdjX = adj.dx;
    resizePosAdjY = adj.dy;
  }

  const finalX = (dragOffset ? x + dragOffset.dx : x) + resizePosAdjX;
  const finalY = (dragOffset ? y + dragOffset.dy : y) + resizePosAdjY;

  const isDragging = dragOffset !== null;
  const isResizing = resizeDelta !== null;

  // F3.4: Pinned HUD 줌 보정 transform
  const scaleTransform = pinScale ? `scale(${pinScale})` : undefined;

  return (
    <Box
      ref={containerRef}
      className="nodrag nopan nowheel"
      onMouseDown={handleDragStart}
      sx={{
        position: 'absolute',
        left: finalX,
        top: finalY,
        zIndex: isDragging || isResizing ? 10000 : 9999,
        width: containerWidth ?? 'fit-content',
        height: containerHeight ?? 'fit-content',
        cursor: locked ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.85 : 1,
        transition: isDragging || isResizing ? 'none' : 'left 0.15s, top 0.15s',
        pointerEvents: 'all',
        // F3.4: HUD 줌 보정 (CompactBadge의 compensateScale 포함)
        transform: scaleTransform,
        transformOrigin: 'center center',
        // hover 시 리사이즈 핸들 표시
        '&:hover .resize-handle': { opacity: 1 },
      }}
    >
      {/* 위젯 컨텐츠 (잠금 버튼은 각 위젯 내부에서 렌더링) */}
      {children}

      {/* R4: 4-corner 리사이즈 핸들 (resizable && !locked일 때만) */}
      {resizable && !locked && CORNER_DEFS.map(({ corner, pos, cursor, border }) => (
        <Box
          key={corner}
          className="resize-handle"
          onMouseDown={(e) => handleResizeStart(corner, e)}
          sx={{
            position: 'absolute',
            ...pos,
            width: 10,
            height: 10,
            cursor,
            opacity: 0,
            transition: 'opacity 0.15s',
            zIndex: 1,
            '&::after': {
              content: '""',
              position: 'absolute',
              width: 6,
              height: 6,
              ...cornerAfterPos(corner),
              ...border,
            },
          }}
        />
      ))}
    </Box>
  );
};

export default memo(DraggableWidget);
