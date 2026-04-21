/**
 * DisplacedWidgetLayer
 *
 * onlyRenderVisibleElements에 의해 부모 노드가 컬링되었지만,
 * 사용자가 위젯을 드래그하여 뷰포트 내에 위치한 "이탈 위젯"을 렌더링하는 보조 레이어.
 *
 * - 부모 노드가 뷰포트에 있으면 → withNodeWidgets HOC가 처리 → 이 레이어는 스킵
 * - 부모 노드가 컬링되었지만 위젯이 뷰포트에 있으면 → 이 레이어가 렌더링
 * - ReactFlow storeApi 직접 구독으로 불필요한 리렌더 최소화
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useViewport, useStoreApi } from 'reactflow';
import type { Node } from 'reactflow';
import type { MARSNodeData, ComponentType } from '@/types/mars';
import { formatDisplayId } from '@/utils/nodeAppearance';
import type {
  NodeWidgetConfig,
  NodeWidgetOverrides,
  WidgetOverride,
  SimulationValues,
  TimeSeriesPoint,
  AlarmLevel,
} from '@/types/interactive';
import DraggableWidget from './widgets/DraggableWidget';
import WidgetRenderer from './widgets/WidgetRenderer';
import CompactBadge from './widgets/CompactBadge';

interface DisplacedWidgetLayerProps {
  nodes: Node<MARSNodeData>[];
  widgetConfigs: Record<string, NodeWidgetConfig[]>;
  widgetOverrides: NodeWidgetOverrides;
  simulationValues: SimulationValues;
  alarmLevels: Record<string, Record<string, AlarmLevel>>;
  portalContainer: HTMLDivElement | null;
  onWidgetMove: (nodeId: string, dataKey: string, x: number, y: number) => void;
  onWidgetResize: (nodeId: string, dataKey: string, w: number, h: number) => void;
  onWidgetPinToggle: (nodeId: string, dataKey: string) => void;
  onWidgetLockToggle: (nodeId: string, dataKey: string) => void;
  lodThreshold: number;
}

/** 위젯 바운딩 박스 추정 크기 (뷰포트 교차 판정용) */
const WIDGET_BBOX = 300;

/**
 * 커스텀 오프셋이 있는 위젯의 dataKey 목록만 추출 (오프셋이 없으면 노드 근처 → 컬링 대상)
 */
function getDisplacedDataKeys(nodeOverrides: Record<string, WidgetOverride>): string[] {
  const keys: string[] = [];
  for (const [dataKey, override] of Object.entries(nodeOverrides)) {
    if (override.offsetX !== undefined && override.offsetY !== undefined) {
      keys.push(dataKey);
    }
  }
  return keys;
}

const DisplacedWidgetLayer: React.FC<DisplacedWidgetLayerProps> = ({
  nodes,
  widgetConfigs,
  widgetOverrides,
  simulationValues,
  alarmLevels,
  portalContainer,
  onWidgetMove,
  onWidgetResize,
  onWidgetPinToggle,
  onWidgetLockToggle,
  lodThreshold,
}) => {
  const storeApi = useStoreApi();
  const { zoom } = useViewport();

  // 컬링된 노드 중 뷰포트에 이탈 위젯이 보이는 노드 ID 목록
  const [culledNodeIds, setCulledNodeIds] = useState<string[]>([]);

  // storeApi 구독: 뷰포트 변경 시 컬링 대상 재계산
  useEffect(() => {
    function check() {
      const state = storeApi.getState();
      const [tx, ty, z] = state.transform;
      const vw = state.width;
      const vh = state.height;

      // 뷰포트 → 월드 좌표 변환
      const vLeft = -tx / z;
      const vTop = -ty / z;
      const vRight = (-tx + vw) / z;
      const vBottom = (-ty + vh) / z;

      const newCulledIds: string[] = [];

      for (const nodeId of Object.keys(widgetOverrides)) {
        const nodeInternal = state.nodeInternals.get(nodeId);
        if (!nodeInternal) continue;

        const nx = nodeInternal.positionAbsolute?.x ?? nodeInternal.position.x;
        const ny = nodeInternal.positionAbsolute?.y ?? nodeInternal.position.y;
        const nw = nodeInternal.width ?? 100;
        const nh = nodeInternal.height ?? 60;

        // 노드가 뷰포트에 있으면 HOC가 처리 → 스킵
        const nodeVisible =
          nx + nw > vLeft && nx < vRight &&
          ny + nh > vTop && ny < vBottom;
        if (nodeVisible) continue;

        // 노드가 컬링됨 → 이탈 위젯 중 뷰포트에 보이는 것이 있는지 확인
        const nodeOverrides = widgetOverrides[nodeId];
        const displacedKeys = getDisplacedDataKeys(nodeOverrides);

        for (const dataKey of displacedKeys) {
          const o = nodeOverrides[dataKey];
          const wx = nx + o.offsetX!;
          const wy = ny + o.offsetY!;

          if (
            wx + WIDGET_BBOX > vLeft && wx - WIDGET_BBOX < vRight &&
            wy + WIDGET_BBOX > vTop && wy - WIDGET_BBOX < vBottom
          ) {
            newCulledIds.push(nodeId);
            break; // 이 노드는 이미 포함됨
          }
        }
      }

      setCulledNodeIds((prev) => {
        if (
          prev.length === newCulledIds.length &&
          prev.every((id, i) => id === newCulledIds[i])
        ) {
          return prev; // 변경 없음 → 리렌더 방지
        }
        return newCulledIds;
      });
    }

    check(); // 초기 실행
    const unsub = storeApi.subscribe(check);
    return unsub;
  }, [storeApi, widgetOverrides]);

  // 로컬 값 변경 핸들러 (AutoManualToggle용)
  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});
  const handleValueChange = useCallback((nodeId: string, dataKey: string, newValue: string) => {
    setLocalValues((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], [dataKey]: newValue },
    }));
  }, []);

  if (!portalContainer || culledNodeIds.length === 0) return null;

  const isCompactMode = zoom < lodThreshold;

  return createPortal(
    <>
      {culledNodeIds.map((nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        const configs = widgetConfigs[nodeId];
        if (!configs?.length) return null;

        const nodeOverrides = widgetOverrides[nodeId] ?? {};
        const simValues = simulationValues[nodeId] ?? {};
        const nodeLocalValues = localValues[nodeId] ?? {};
        const mergedValues: Record<string, number | string | TimeSeriesPoint[] | undefined> = {
          ...simValues,
          ...nodeLocalValues,
        };
        const nodeAlarmLevels = alarmLevels[nodeId] ?? {};

        const { componentId, componentType, componentName } = node.data;
        const nodeName = componentName || '';
        const nodeDisplayId = componentId
          ? formatDisplayId(componentId, componentType as ComponentType)
          : '';

        const nx = node.positionAbsolute?.x ?? node.position.x;
        const ny = node.positionAbsolute?.y ?? node.position.y;

        // 커스텀 오프셋이 있는 위젯만 렌더링
        const displacedWidgets = configs
          .filter((w) => w.visible !== false)
          .filter((w) => {
            const o = nodeOverrides[w.dataKey];
            return o?.offsetX !== undefined && o?.offsetY !== undefined;
          })
          .map((w) => ({ ...w, nodeName, nodeDisplayId }));

        if (displacedWidgets.length === 0) return null;

        return (
          <div
            key={nodeId}
            style={{ position: 'absolute', left: nx, top: ny, pointerEvents: 'none' }}
          >
            {displacedWidgets.map((w) => {
              const override: WidgetOverride = nodeOverrides[w.dataKey] ?? {};
              const isPinned = override.pinned === true;
              const isLocked = override.locked === true;
              const isChart = w.type === 'mini-chart';

              if (isCompactMode && !isPinned) {
                const compactScale = Math.min(1 / Math.max(zoom, 0.01), 8.0);
                return (
                  <DraggableWidget
                    key={w.id}
                    x={override.offsetX!}
                    y={override.offsetY!}
                    resizable={isChart}
                    locked={isLocked}
                    pinScale={compactScale}
                    onDragEnd={(newX, newY) => onWidgetMove(nodeId, w.dataKey, newX, newY)}
                    onResizeEnd={
                      isChart
                        ? (newW, newH) => onWidgetResize(nodeId, w.dataKey, newW, newH)
                        : undefined
                    }
                  >
                    <CompactBadge
                      config={w}
                      value={mergedValues[w.dataKey]}
                      alarmLevel={nodeAlarmLevels[w.dataKey]}
                      locked={isLocked}
                      onLockToggle={() => onWidgetLockToggle(nodeId, w.dataKey)}
                    />
                  </DraggableWidget>
                );
              }

              const MAX_PIN_SCALE = 4;
              const pinScale =
                isCompactMode && isPinned
                  ? Math.min(1 / Math.sqrt(Math.max(zoom, 0.01)), MAX_PIN_SCALE)
                  : undefined;

              return (
                <DraggableWidget
                  key={w.id}
                  x={override.offsetX!}
                  y={override.offsetY!}
                  width={override.width}
                  height={override.height}
                  resizable={isChart}
                  locked={isLocked}
                  pinned={isPinned}
                  pinScale={pinScale}
                  onDragEnd={(newX, newY) => onWidgetMove(nodeId, w.dataKey, newX, newY)}
                  onResizeEnd={
                    isChart
                      ? (newW, newH) => onWidgetResize(nodeId, w.dataKey, newW, newH)
                      : undefined
                  }
                >
                  <WidgetRenderer
                    config={w}
                    value={mergedValues[w.dataKey]}
                    onValueChange={(dataKey, val) => handleValueChange(nodeId, dataKey, val)}
                    extraValues={mergedValues}
                    alarmLevel={nodeAlarmLevels[w.dataKey]}
                    customWidth={override.width}
                    customHeight={override.height}
                    pinned={isPinned}
                    onPinToggle={() => onWidgetPinToggle(nodeId, w.dataKey)}
                    locked={isLocked}
                    onLockToggle={() => onWidgetLockToggle(nodeId, w.dataKey)}
                  />
                </DraggableWidget>
              );
            })}
          </div>
        );
      })}
    </>,
    portalContainer,
  );
};

export default memo(DisplacedWidgetLayer);
