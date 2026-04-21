/**
 * withNodeWidgets HOC
 * 기존 노드 컴포넌트를 감싸서 드래그 가능한 위젯을 주입한다.
 * F3.8: createPortal을 사용하여 위젯을 ReactFlow 외부 오버레이 레이어에 렌더링.
 *       이를 통해 ReactFlow 노드의 stacking context에서 벗어나 항상 최상위에 표시.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, useViewport } from 'reactflow';
import type { MARSNodeData, ComponentType } from '@/types/mars';
import { formatDisplayId } from '@/utils/nodeAppearance';
import type {
  NodeWidgetConfig,
  WidgetPosition,
  SimulationValues,
  TimeSeriesPoint,
  AlarmLevel,
  NodeWidgetOverrides,
  WidgetOverride,
} from '@/types/interactive';
import WidgetRenderer from './widgets/WidgetRenderer';
import CompactBadge from './widgets/CompactBadge';
import DraggableWidget from './widgets/DraggableWidget';

export interface WidgetContextValue {
  widgetConfigs: Record<string, NodeWidgetConfig[]>;
  simulationValues: SimulationValues;
  showWidgets: boolean;
  /** 노드 우클릭 → 위젯 설정 메뉴 */
  onNodeContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
  /** 노드별 위젯별 알람 레벨 */
  alarmLevels: Record<string, Record<string, AlarmLevel>>;
  /** 위젯 오버라이드 (위치/크기 정보 포함) */
  widgetOverrides: NodeWidgetOverrides;
  /** 위젯 드래그 이동 완료 */
  onWidgetMove?: (nodeId: string, dataKey: string, x: number, y: number) => void;
  /** 위젯 리사이즈 완료 */
  onWidgetResize?: (nodeId: string, dataKey: string, width: number, height: number) => void;
  /** 위젯 핀 토글 */
  onWidgetPinToggle?: (nodeId: string, dataKey: string) => void;
  /** 위젯 잠금 토글 (이동+리사이즈) */
  onWidgetLockToggle?: (nodeId: string, dataKey: string) => void;
  /** LOD 임계값: 이 줌 레벨 미만에서 CompactBadge로 전환 */
  lodThreshold: number;
  /** F3.8: Portal 렌더링 대상 DOM element */
  portalContainer: HTMLDivElement | null;
  /** Minor Edit 데이터가 흐르는 노드 ID 집합 (가시화 가능 노드) */
  monitoredNodeIds: Set<string>;
}

/** LOD 기본 임계값 — 더 줌아웃해야 CompactBadge 전환 */
export const DEFAULT_LOD_THRESHOLD = 0.15;

const defaultContext: WidgetContextValue = {
  widgetConfigs: {},
  simulationValues: {},
  showWidgets: false,
  alarmLevels: {},
  widgetOverrides: {},
  lodThreshold: DEFAULT_LOD_THRESHOLD,
  portalContainer: null,
  monitoredNodeIds: new Set(),
};

export const WidgetContext = createContext<WidgetContextValue>(defaultContext);

// ── 위치 기본값 계산 ──

const WIDGET_GAP = 10; // 위젯 간 간격 (px)

/** 위젯의 기본 위치를 position('top'|'bottom'|'left'|'right')과 노드 크기로 계산 */
function computeDefaultOffset(
  position: WidgetPosition,
  index: number,
  nodeW: number,
  nodeH: number,
): { x: number; y: number } {
  switch (position) {
    case 'top':
      return { x: nodeW / 2 - 40 + index * 80, y: -(30 + WIDGET_GAP) };
    case 'bottom':
      return { x: nodeW / 2 - 40 + index * 80, y: nodeH + WIDGET_GAP };
    case 'left':
      return { x: -(100 + WIDGET_GAP), y: index * 36 };
    case 'right':
      return { x: nodeW + WIDGET_GAP, y: index * 36 };
  }
}

/**
 * HOC: 원본 노드를 감싸고 위젯을 Portal을 통해 오버레이 레이어에 주입
 */
export function withNodeWidgets(
  WrappedNode: React.ComponentType<NodeProps<MARSNodeData>>,
): React.FC<NodeProps<MARSNodeData>> {
  const WidgetNode: React.FC<NodeProps<MARSNodeData>> = (props) => {
    const { id, xPos, yPos } = props;
    const ctx = useContext(WidgetContext);
    const { zoom } = useViewport();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [nodeSize, setNodeSize] = useState<{ w: number; h: number }>({ w: 100, h: 60 });

    // LOD: zoom < threshold → CompactBadge 모드
    const isCompactMode = zoom < ctx.lodThreshold;

    // 노드 크기 관찰
    useEffect(() => {
      if (!wrapperRef.current) return;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setNodeSize({ w: entry.contentRect.width, h: entry.contentRect.height });
        }
      });
      observer.observe(wrapperRef.current);
      return () => observer.disconnect();
    }, []);

    // 로컬 상태: Auto/Manual 토글, valveState 등
    const [localValues, setLocalValues] = useState<Record<string, string>>({});

    const handleValueChange = useCallback((dataKey: string, newValue: string) => {
      setLocalValues((prev) => ({ ...prev, [dataKey]: newValue }));
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      if (ctx.onNodeContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        ctx.onNodeContextMenu(id, e);
      }
    }, [ctx, id]);

    // 데이터가 흐르는 노드인지 판별 (Minor Edit CCC 매칭)
    const isMonitored = ctx.monitoredNodeIds.has(id);
    const hasWidgets = (ctx.widgetConfigs[id]?.length ?? 0) > 0;

    // 노드 렌더링 (위젯 표시 시 NodeResizer 숨김 — 확대된 위젯과 노드 핸들 혼동 방지)
    const nodeElement = (
      <div
        ref={wrapperRef}
        onContextMenu={handleContextMenu}
        className={ctx.showWidgets ? 'hide-node-resizer' : undefined}
        style={{
          position: 'relative',
          overflow: 'visible',
          // 모니터링 가능 노드 글로우 + pulse 애니메이션
          ...(ctx.showWidgets && isMonitored && !hasWidgets ? {
            boxShadow: '0 0 12px 4px rgba(25, 118, 210, 0.6), 0 0 24px 8px rgba(25, 118, 210, 0.25)',
            borderRadius: '4px',
            outline: '2px solid rgba(25, 118, 210, 0.7)',
            outlineOffset: '1px',
            animation: 'monitoredPulse 2s ease-in-out infinite',
          } : {}),
        }}
      >
        <WrappedNode {...props} />
        {/* 모니터링 가능 뱃지: 위젯 미활성 + 데이터가 흐르는 노드 */}
        {ctx.showWidgets && isMonitored && !hasWidgets && (
          <div
            style={{
              position: 'absolute',
              top: -10,
              right: -10,
              minWidth: 22,
              height: 22,
              borderRadius: '11px',
              backgroundColor: '#1976d2',
              border: '2.5px solid #fff',
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              cursor: 'pointer',
              padding: '0 4px',
              animation: 'monitoredBadgePulse 2s ease-in-out infinite',
            }}
            title="실시간 데이터 수신 중 — 우클릭으로 위젯 추가"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="#fff"/>
            </svg>
          </div>
        )}
        {/* pulse 키프레임 주입 (한 번만) */}
        {ctx.showWidgets && isMonitored && !hasWidgets && (
          <style>{`
            @keyframes monitoredPulse {
              0%, 100% { box-shadow: 0 0 12px 4px rgba(25, 118, 210, 0.6), 0 0 24px 8px rgba(25, 118, 210, 0.25); }
              50% { box-shadow: 0 0 18px 6px rgba(25, 118, 210, 0.8), 0 0 36px 12px rgba(25, 118, 210, 0.35); }
            }
            @keyframes monitoredBadgePulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.15); }
            }
          `}</style>
        )}
      </div>
    );

    if (!ctx.showWidgets) return nodeElement;

    const configs = ctx.widgetConfigs[id];
    if (!configs || configs.length === 0) return nodeElement;

    // R3: 이름표 주입 — 컴포넌트 이름 + 약식 ID
    const { componentId, componentType, componentName } = props.data;
    const nodeName = componentName || '';
    const nodeDisplayId = componentId ? formatDisplayId(componentId, componentType as ComponentType) : '';

    const visibleConfigs = configs
      .filter((w) => w.visible !== false)
      .map((w) => ({ ...w, nodeName, nodeDisplayId }));
    if (visibleConfigs.length === 0) return nodeElement;

    const simValues = ctx.simulationValues[id] ?? {};
    const mergedValues: Record<string, number | string | TimeSeriesPoint[] | undefined> = { ...simValues, ...localValues };
    const nodeAlarmLevels = ctx.alarmLevels[id] ?? {};
    const nodeOverrides = ctx.widgetOverrides[id] ?? {};

    // position별로 인덱스 추적 (기본 위치 계산용)
    const positionCounters: Record<WidgetPosition, number> = { top: 0, bottom: 0, left: 0, right: 0 };

    // F3.8: Portal 렌더링 — 위젯을 오버레이 레이어에 렌더링
    const portalTarget = ctx.portalContainer;

    const widgetElements = visibleConfigs.map((w) => {
      const override: WidgetOverride = nodeOverrides[w.dataKey] ?? {};
      const pos = override.position ?? w.position;
      const idx = positionCounters[pos]++;

      // 오프셋이 저장되어 있으면 사용, 아니면 기본 위치 계산
      const hasCustomOffset = override.offsetX !== undefined && override.offsetY !== undefined;
      const defaultOff = computeDefaultOffset(pos, idx, nodeSize.w, nodeSize.h);
      const finalX = hasCustomOffset ? override.offsetX! : defaultOff.x;
      const finalY = hasCustomOffset ? override.offsetY! : defaultOff.y;

      const isChart = w.type === 'mini-chart';
      const isPinned = override.pinned === true;
      const isLocked = override.locked === true;

      // F3.4-F3.7: Pinned → Full Widget 유지 (HUD 줌 보정)
      //            Unpinned + Compact → CompactBadge
      //            Unpinned + Full → Full Widget
      if (isCompactMode && !isPinned) {
        // F2.6: 줌 보정을 DraggableWidget 컨테이너 레벨에서 적용
        // → CompactBadge 내부 transform 제거하고 pinScale로 통합 (핸들 위치 일치)
        const compactScale = Math.min(1 / Math.max(zoom, 0.01), 8.0);
        return (
          <DraggableWidget
            key={w.id}
            x={finalX}
            y={finalY}
            resizable={isChart}
            locked={isLocked}
            pinScale={compactScale}
            onDragEnd={(newX, newY) => ctx.onWidgetMove?.(id, w.dataKey, newX, newY)}
            onResizeEnd={isChart ? (newW, newH) => ctx.onWidgetResize?.(id, w.dataKey, newW, newH) : undefined}
          >
            <CompactBadge
              config={w}
              value={mergedValues[w.dataKey]}
              alarmLevel={nodeAlarmLevels[w.dataKey]}
              locked={isLocked}
              onLockToggle={() => ctx.onWidgetLockToggle?.(id, w.dataKey)}
            />
          </DraggableWidget>
        );
      }

      // 줌 보정: 1/√zoom → 줌아웃 시 적당히 확대되어 가독성 유지
      // Pinned 위젯은 항상 적용, 일반 위젯도 zoom < 1 이면 적용
      const MAX_PIN_SCALE = 5;
      const rawScale = 1 / Math.sqrt(Math.max(zoom, 0.01));
      const pinScale = (isPinned || zoom < 1)
        ? Math.min(rawScale, MAX_PIN_SCALE)
        : undefined;

      return (
        <DraggableWidget
          key={w.id}
          x={finalX}
          y={finalY}
          width={override.width}
          height={override.height}
          resizable={isChart}
          locked={isLocked}
          pinned={isPinned}
          pinScale={pinScale}
          onDragEnd={(newX, newY) => ctx.onWidgetMove?.(id, w.dataKey, newX, newY)}
          onResizeEnd={isChart ? (newW, newH) => ctx.onWidgetResize?.(id, w.dataKey, newW, newH) : undefined}
        >
          <WidgetRenderer
            config={w}
            value={mergedValues[w.dataKey]}
            onValueChange={handleValueChange}
            extraValues={mergedValues}
            alarmLevel={nodeAlarmLevels[w.dataKey]}
            customWidth={override.width}
            customHeight={override.height}
            pinned={isPinned}
            onPinToggle={() => ctx.onWidgetPinToggle?.(id, w.dataKey)}
            locked={isLocked}
            onLockToggle={() => ctx.onWidgetLockToggle?.(id, w.dataKey)}
          />
        </DraggableWidget>
      );
    });

    // 위젯을 노드의 world position 기준으로 그룹화하여 Portal 렌더링
    const widgetGroup = (
      <div
        style={{
          position: 'absolute',
          left: xPos,
          top: yPos,
          pointerEvents: 'none',
        }}
      >
        {widgetElements}
      </div>
    );

    return (
      <>
        {nodeElement}
        {portalTarget
          ? createPortal(widgetGroup, portalTarget)
          : /* Portal 미준비 시 인라인 폴백 (첫 프레임) */
            widgetGroup
        }
      </>
    );
  };

  WidgetNode.displayName = `WithWidgets(${WrappedNode.displayName || WrappedNode.name || 'Node'})`;
  return WidgetNode;
}
