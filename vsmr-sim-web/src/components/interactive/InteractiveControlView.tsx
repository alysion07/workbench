/**
 * InteractiveControlView
 * SimulationPage의 "Interaction Control" 탭에서 렌더링되는 read-only FlowCanvas + 위젯
 *
 * 사용자가 노드 우클릭으로 위젯을 추가/제거하는 동적 위젯 관리 방식.
 * enabledWidgetNodes에 등록된 노드만 위젯을 표시한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Typography, Chip, ToggleButtonGroup, ToggleButton, IconButton, Tooltip, Divider } from '@mui/material';
import { BarChart as ChartIcon, TextFields as LabelIcon, Settings as SettingsIcon, MyLocation as _MyLocationIcon, ShowChart as ShowChartIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useStore } from '@/stores/useStore';
import { EDGE_COLORS } from '@/utils/edgeStyleHelpers';
import { interactiveNodeTypes } from './interactiveNodeTypes';
import { WidgetContext, DEFAULT_LOD_THRESHOLD } from './withNodeWidgets';
import WidgetContextMenu from './WidgetContextMenu';
import AlarmPanel from './AlarmPanel';
import SidePanel from './SidePanel';
import AlarmSettingsDialog from './AlarmSettingsDialog';
import WidgetPortalOverlay from './WidgetPortalOverlay';
import DisplacedWidgetLayer from './DisplacedWidgetLayer';
import type { WidgetContextValue } from './withNodeWidgets';
import type {
  NodeWidgetConfig,
  NodeWidgetOverrides,
  WidgetOverride,
  AlarmScenarioConfig,
  EventLogEntry,
} from '@/types/interactive';
import { applyWidgetOverrides, getAvailableWidgets } from '@/types/interactive';
import {
  evaluateAllScenarios,
  scenarioResultsToActiveAlarms,
  deriveWidgetAlarmLevels,
  createDefaultScenarioConfig,
} from '@/utils/scenarioAlarmEngine';
import type { MARSNodeData, ComponentType, ValveParameters, ControlVariable } from '@/types/mars';
import { isNonConstantControlVariable } from '@/types/mars';
import type { Node } from 'reactflow';
import { useActiveModel, useCoSimSession, useLatestMinorEdit } from '@/stores/simulationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ControlMode } from '@/stubs/mars/mars_service_mod06_pb';
import { useICVPolling } from '@/hooks/useICVPolling';
import { buildChartColorMap } from '@/utils/chartConfigBuilder';
import DynamicChartGrid from '@/components/simulation/DynamicChartGrid';
import type { SimulationStatus } from '@/types/simulation';
import { useLiveNodeValues, extractPrimaryVarRef as extractCVPrimaryVarRef } from '@/hooks/useLiveNodeValues';

// Reuse edge styling from FlowCanvas
const StyledReactFlowWrapper = styled(Box)({
  flexGrow: 1,
  height: '100%',
  backgroundColor: '#f5f5f5',
  // elementsSelectable=false + nodesDraggable=false → ReactFlow가 노드에
  // pointer-events:none 인라인 스타일을 적용하므로 우클릭 등 이벤트가 차단됨.
  // 컨텍스트 메뉴(우클릭)를 위해 강제로 재활성화.
  '& .react-flow__node': {
    pointerEvents: 'all !important' as any,
  },
  '& .react-flow__edge .react-flow__edge-path': {
    opacity: 0.3,
  },
  '& .react-flow__edge.selected .react-flow__edge-path': {
    stroke: `${EDGE_COLORS.selected} !important`,
    strokeWidth: '3px !important',
    opacity: '1 !important',
  },
  '& .react-flow__edge:hover:not(.selected) .react-flow__edge-path': {
    filter: 'brightness(1.3)',
    strokeWidth: '2.5px !important',
    opacity: '0.7 !important',
  },
});

// ============================================================================
// enabledWidgetNodes에 등록된 노드만 타입별 기본 위젯 생성
// ============================================================================

export type WidgetDisplayMode = 'chart' | 'label';

function generateWidgetConfigsForEnabledNodes(
  nodes: Node<MARSNodeData>[],
  enabledNodeIds: Set<string>,
  defaultMode: WidgetDisplayMode = 'chart',
  nodeDisplayModes: Record<string, WidgetDisplayMode> = {},
): Record<string, NodeWidgetConfig[]> {
  const configs: Record<string, NodeWidgetConfig[]> = {};

  for (const node of nodes) {
    if (!enabledNodeIds.has(node.id)) continue;
    const nodeMode = nodeDisplayModes[node.id] ?? defaultMode;
    const numericType = nodeMode === 'chart' ? 'mini-chart' : 'numeric-label';
    const { componentType, parameters } = node.data;
    const nodeId = node.id;
    const widgets: NodeWidgetConfig[] = [];

    switch (componentType as ComponentType) {
      case 'snglvol':
      case 'tmdpvol':
      case 'branch':
      case 'pump':
      case 'turbine':
        widgets.push(
          {
            id: `${nodeId}-pressure`,
            type: numericType,
            position: 'top',
            label: 'P',
            dataKey: 'pressure',
            unit: 'MPa',
            precision: 2,
            chartColor: '#1976d2',
          },
          {
            id: `${nodeId}-temperature`,
            type: numericType,
            position: 'bottom',
            label: 'T',
            dataKey: 'temperature',
            unit: 'K',
            precision: 1,
            chartColor: '#d32f2f',
          },
        );
        break;

      case 'pipe':
        widgets.push({
          id: `${nodeId}-pressure`,
          type: numericType,
          position: 'top',
          label: 'P',
          dataKey: 'pressure',
          unit: 'MPa',
          precision: 2,
          chartColor: '#1976d2',
        });
        break;

      case 'valve': {
        const valveParams = parameters as Partial<ValveParameters>;
        const subType = valveParams.valveSubType ?? 'trpvlv';
        if (subType === 'trpvlv') {
          widgets.push({
            id: `${nodeId}-valveMode`,
            type: 'auto-manual-toggle',
            position: 'bottom',
            label: 'Mode',
            dataKey: 'valveMode',
          });
        } else {
          widgets.push({
            id: `${nodeId}-valvePos`,
            type: numericType,
            position: 'bottom',
            label: 'Pos',
            dataKey: 'valvePosition',
            unit: '%',
            precision: 0,
            chartColor: '#7b1fa2',
          });
        }
        break;
      }

      case 'sngljun':
      case 'tmdpjun':
      case 'mtpljun':
        widgets.push({
          id: `${nodeId}-flow`,
          type: numericType,
          position: 'bottom',
          label: 'W',
          dataKey: 'flowRate',
          unit: 'kg/s',
          precision: 1,
          chartColor: '#2e7d32',
        });
        break;

      case 'htstr':
        break;
    }

    if (widgets.length > 0) {
      configs[nodeId] = widgets;
    }
  }

  return configs;
}

// Mock 데이터 생성 함수 제거됨 — useLiveNodeValues 훅이 실시간 데이터 제공

// ============================================================================
// InteractiveControlView Component
// ============================================================================

/** 컨텍스트 메뉴 상태 */
interface ContextMenuState {
  nodeId: string;
  position: { top: number; left: number };
}

/** 시뮬레이션 제어 이벤트 (SimulationPage → InteractiveControlView) */
export interface SimulationEvent {
  action: string;  // 'Started' | 'Paused' | 'Resumed' | 'Stopped'
}

interface InteractiveControlViewInnerProps {
  minorEdits?: import('@/types/mars').MinorEdit[];
  visible?: boolean;
  simulationEvents?: SimulationEvent[];
  simulationStatusOverride?: SimulationStatus | null;
}

const InteractiveControlViewInner: React.FC<InteractiveControlViewInnerProps> = ({
  minorEdits,
  visible = true,
  simulationEvents,
  simulationStatusOverride,
}) => {
  const { nodes, edges, metadata, updateMetadata } = useStore();
  const { setCenter, fitView } = useReactFlow();

  // ReactFlow onInit 콜백: 초기화 완료 시 노심 중심 뷰포트 포커싱
  const initialFocusDone = useRef(false);
  const handleInit = useCallback(() => {
    if (initialFocusDone.current || nodes.length === 0) return;
    initialFocusDone.current = true;
    const fuelRodNodes = nodes.filter(
      (n) => n.data?.componentType === 'htstr' && (n.data?.parameters as Record<string, unknown>)?.isFuelRod
    );
    if (fuelRodNodes.length > 0) {
      const cx = fuelRodNodes.reduce((sum, n) => sum + n.position.x + ((n.width ?? 60) / 2), 0) / fuelRodNodes.length;
      const cy = fuelRodNodes.reduce((sum, n) => sum + n.position.y + ((n.height ?? 120) / 2), 0) / fuelRodNodes.length;
      setCenter(cx, cy - 600, { zoom: 0.45, duration: 300 });
    } else {
      fitView({ padding: 0.2, duration: 300 });
    }
  }, [nodes, setCenter, fitView]);

  const activeModel = useActiveModel();
  const coSimSession = useCoSimSession();
  const sessionId = useSessionStore((state) => state.sessionId);
  const sessionCreating = useSessionStore((state) => state.sessionCreating);
  const effectiveSimulationStatus = simulationStatusOverride ?? coSimSession?.status ?? activeModel?.status;
  const simulationActive =
    effectiveSimulationStatus === 'running' ||
    effectiveSimulationStatus === 'paused';
  const icvPollingActive = simulationActive && !!activeModel?.taskId && !!sessionId && !sessionCreating;

  // F3.8: Portal 렌더링 — WidgetPortalOverlay React 컴포넌트 + useStoreApi 직접 구독
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Trip ICV 폴링 (전체 ICV 타입)
  const interactiveInputs = metadata.globalSettings?.interactiveInputs;
  const tripInputs = useMemo(
    () => (interactiveInputs ?? []).filter((i) => i.controlType === 'trip'),
    [interactiveInputs],
  );
  const tripInputCount = tripInputs.length;
  const { tripEntries, allICVEntries, error: tripError, loading: tripLoading, setTripMode, setICVValue } = useICVPolling({
    active: icvPollingActive,
    interactiveInputs,
  });

  // MinorEdit 최신 스냅샷
  const latestMinorEdit = useLatestMinorEdit();

  // ── Event Log ──────────────────────────────────────────────────────────
  const MAX_EVENT_LOG = 200;
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  const addEventLog = useCallback((entry: Omit<EventLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: EventLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    setEventLog((prev) => [newEntry, ...prev].slice(0, MAX_EVENT_LOG));
  }, []);

  // Trip 모드 변경 래핑: oldValue 캡처 → 성공 시 로깅
  const CMODE_DISPLAY: Record<number, string> = {
    [ControlMode.CONTROL_MODE_UNSPECIFIED]: '---',
    [ControlMode.AUTOMATIC]: 'Auto',
    [ControlMode.MANUAL_TRUE]: 'ManualTrue',
    [ControlMode.MANUAL_FALSE]: 'ManualFalse',
  };

  const wrappedSetTripMode = useCallback(async (objectId: number, cmode: ControlMode) => {
    const entry = tripEntries.find((e) => e.objectId === objectId);
    const oldLabel = entry ? CMODE_DISPLAY[entry.cmode] ?? '---' : '---';
    const newLabel = CMODE_DISPLAY[cmode] ?? '---';
    const tripName = entry?.whatis || `Trip obj#${objectId}`;

    await setTripMode(objectId, cmode);

    addEventLog({
      type: 'trip',
      label: tripName,
      action: '모드',
      oldValue: oldLabel,
      newValue: newLabel,
    });
  }, [tripEntries, setTripMode, addEventLog]);

  // ICV 값 변경 래핑
  const wrappedSetICVValue = useCallback(async (objectId: number, patch: { target?: number; rate?: number; cmode?: ControlMode }) => {
    const entry = allICVEntries.find((e) => e.objectId === objectId);
    const name = entry?.whatis || `ICV obj#${objectId}`;

    await setICVValue(objectId, patch);

    if (patch.cmode !== undefined) {
      const oldMode = entry ? (entry.cmode === ControlMode.AUTOMATIC ? 'Auto' : 'Manual') : '---';
      const newMode = patch.cmode === ControlMode.AUTOMATIC ? 'Auto' : 'Manual';
      addEventLog({ type: 'icv', label: name, action: '모드', oldValue: oldMode, newValue: newMode });
    }
    if (patch.target !== undefined) {
      const oldVal = entry?.target?.toFixed(4) ?? '---';
      addEventLog({ type: 'icv', label: name, action: 'target', oldValue: oldVal, newValue: patch.target.toFixed(4) });
    }
    if (patch.rate !== undefined) {
      const oldVal = entry?.rate?.toExponential(2) ?? '---';
      addEventLog({ type: 'icv', label: name, action: 'rate', oldValue: oldVal, newValue: patch.rate.toExponential(2) });
    }
  }, [allICVEntries, setICVValue, addEventLog]);

  // 시뮬레이션 제어 이벤트 수신 → 이벤트 로그 기록
  const prevSimEventsLen = useRef(0);
  useEffect(() => {
    if (!simulationEvents || simulationEvents.length <= prevSimEventsLen.current) {
      prevSimEventsLen.current = simulationEvents?.length ?? 0;
      return;
    }
    const newEvents = simulationEvents.slice(prevSimEventsLen.current);
    prevSimEventsLen.current = simulationEvents.length;
    for (const ev of newEvents) {
      addEventLog({ type: 'simulation', label: '시뮬레이션', action: ev.action });
    }
  }, [simulationEvents, addEventLog]);

  // Minor Edit / ICV에 정의된 컴포넌트 → 자동 위젯 활성화 대상 노드 ID 추출
  const cvDefs = metadata.globalSettings?.controlVariables ?? [];
  const autoEnabledNodeIds = useMemo(() => {
    const VAR_TYPES_WITH_WIDGET = new Set(['p', 'tempf', 'tempg', 'mflowj', 'voidf']);
    const ids = new Set<string>();

    // CCC → nodeId 맵 구축
    const cccMap = new Map<string, string>();
    for (const node of nodes) {
      const cid = (node.data as MARSNodeData).componentId;
      if (!cid) continue;
      const num = parseInt(cid, 10);
      const ccc = num >= 10000000 ? cid.slice(0, 4) : cid.slice(0, 3);
      cccMap.set(ccc, node.id);
      cccMap.set(cid, node.id);
    }

    // CV 번호 → 정의 맵
    const cvLookup = new Map<number, ControlVariable>();
    for (const cv of cvDefs) cvLookup.set(cv.number, cv);

    // MinorEdit 정의에서 매핑 가능한 노드
    for (const edit of (minorEdits ?? [])) {
      if (VAR_TYPES_WITH_WIDGET.has(edit.variableType)) {
        // 직접 매핑 (p, tempf, mflowj 등)
        const ccc = String(edit.parameter).slice(0, 3);
        const nodeId = cccMap.get(ccc);
        if (nodeId) ids.add(nodeId);
      } else if (edit.variableType === 'cntrlvar') {
        // CV 정의를 통한 간접 매핑
        const cvNum = typeof edit.parameter === 'string'
          ? parseInt(edit.parameter, 10) : edit.parameter;
        const cv = cvLookup.get(cvNum);
        if (!cv || !isNonConstantControlVariable(cv)) continue;
        const varRef = extractCVPrimaryVarRef(cv);
        if (!varRef || !VAR_TYPES_WITH_WIDGET.has(varRef.variableName)) continue;
        const ccc = String(varRef.parameterCode).slice(0, 3);
        const nodeId = cccMap.get(ccc);
        if (nodeId) ids.add(nodeId);
      }
    }

    // ICV 정의에서 매핑 가능한 노드 (valve 등)
    for (const input of (interactiveInputs ?? [])) {
      if (input.controlType === 'trip') continue;
      const ccc = String(input.parameter).slice(0, 3);
      const nodeId = cccMap.get(ccc);
      if (nodeId) ids.add(nodeId);
    }

    return ids;
  }, [nodes, minorEdits, interactiveInputs, cvDefs]);

  // ── ICV → NodeId 매칭 맵 (위치 찾기 기능용) ──────────────────────────────
  const { icvNodeMap: _icvNodeMap, generalIcvNodeMap: _generalIcvNodeMap } = useMemo(() => {
    const cardMap = new Map<number, string>();
    const cccNodeMap = new Map<number, string>();

    const cccMap = new Map<string, string>();
    for (const node of nodes) {
      const cid = (node.data as MARSNodeData).componentId;
      if (!cid) continue;
      const num = parseInt(cid, 10);
      const ccc = num >= 10000000 ? cid.slice(0, 4) : cid.slice(0, 3);
      cccMap.set(ccc, node.id);
      cccMap.set(cid, node.id);
    }

    const tripToNodeMap = new Map<number, string>();
    for (const node of nodes) {
      const data = node.data as MARSNodeData;
      if (data.componentType !== 'valve') continue;
      const params = data.parameters as Partial<ValveParameters> | undefined;
      const tripNum = params?.tripNumber;
      if (typeof tripNum === 'number' && tripNum > 0) {
        tripToNodeMap.set(tripNum, node.id);
      }
    }

    for (const input of (interactiveInputs ?? [])) {
      if (input.controlType === 'trip') {
        const tripNum = typeof input.parameter === 'string'
          ? parseInt(input.parameter, 10) : input.parameter;
        const nodeId = tripToNodeMap.get(tripNum);
        if (nodeId) cardMap.set(input.cardNumber, nodeId);
      } else {
        const ccc = String(input.parameter).slice(0, 3);
        const nodeId = cccMap.get(ccc);
        if (nodeId) cardMap.set(input.cardNumber, nodeId);
      }
    }

    for (const [key, nodeId] of cccMap.entries()) {
      const num = parseInt(key, 10);
      if (!isNaN(num)) cccNodeMap.set(num, nodeId);
    }

    return { icvNodeMap: cardMap, generalIcvNodeMap: cccNodeMap };
  }, [nodes, interactiveInputs]);

  // ── 노드 위치 찾기 (하이라이트 + 뷰포트 이동) — SidePanel에 icvNodeMap 연결 시 활성화
  // const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  // const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // const handleLocateNode = useCallback((nodeId: string) => { ... }, [nodes, setCenter]);

  // 위젯이 활성화된 노드 목록 (수동 + 자동)
  const [enabledWidgetNodes, setEnabledWidgetNodes] = useState<string[]>(
    () => metadata.globalSettings?.enabledWidgetNodes ?? [],
  );
  const enabledNodeIds = useMemo(() => {
    const merged = new Set(enabledWidgetNodes);
    for (const id of autoEnabledNodeIds) merged.add(id);
    return merged;
  }, [enabledWidgetNodes, autoEnabledNodeIds]);

  const [showWidgets, setShowWidgets] = useState(true);
  const [displayMode, setDisplayMode] = useState<WidgetDisplayMode>('chart');
  const [nodeDisplayModes, setNodeDisplayModes] = useState<Record<string, WidgetDisplayMode>>(
    () => metadata.globalSettings?.nodeDisplayModes ?? {},
  );

  // 위젯 오버라이드: globalSettings에서 초기값 로드
  const [widgetOverrides, setWidgetOverrides] = useState<NodeWidgetOverrides>(
    () => metadata.globalSettings?.widgetOverrides ?? {},
  );

  // 시나리오 기반 알람 설정
  const [scenarioConfig, setScenarioConfig] = useState<AlarmScenarioConfig>(() => {
    const gs = metadata.globalSettings;
    if (gs?.alarmScenarioConfig) return gs.alarmScenarioConfig;
    // 레거시 마이그레이션
    return createDefaultScenarioConfig(gs?.alarmThresholds, gs?.alarmEnabled);
  });
  const [alarmSettingsOpen, setAlarmSettingsOpen] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // 노드 삭제 시 orphan 정리 (overrides, displayModes, enabledWidgetNodes)
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  useMemo(() => {
    const orphanOverrides = Object.keys(widgetOverrides).filter((id) => !nodeIds.has(id));
    const orphanModes = Object.keys(nodeDisplayModes).filter((id) => !nodeIds.has(id));
    const orphanEnabled = enabledWidgetNodes.filter((id) => !nodeIds.has(id));
    if (orphanOverrides.length === 0 && orphanModes.length === 0 && orphanEnabled.length === 0) return;

    if (orphanOverrides.length > 0) {
      setWidgetOverrides((prev) => {
        const next = { ...prev };
        for (const id of orphanOverrides) delete next[id];
        updateMetadata({ globalSettings: { ...metadata.globalSettings, widgetOverrides: next } });
        return next;
      });
    }
    if (orphanModes.length > 0) {
      setNodeDisplayModes((prev) => {
        const next = { ...prev };
        for (const id of orphanModes) delete next[id];
        updateMetadata({ globalSettings: { ...metadata.globalSettings, nodeDisplayModes: next } });
        return next;
      });
    }
    if (orphanEnabled.length > 0) {
      setEnabledWidgetNodes((prev) => {
        const next = prev.filter((id) => nodeIds.has(id));
        updateMetadata({ globalSettings: { ...metadata.globalSettings, enabledWidgetNodes: next } });
        return next;
      });
    }
  }, [nodeIds]);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // 기본 위젯 configs 생성 (enabledWidgetNodes만)
  const defaultWidgetConfigs = useMemo(
    () => generateWidgetConfigsForEnabledNodes(nodes, enabledNodeIds, displayMode, nodeDisplayModes),
    [nodes, enabledNodeIds, displayMode, nodeDisplayModes],
  );

  // chartColorMap: MinorEdit 기반 dataKey → 자동 할당 색상 (모니터링탭과 동기화)
  const chartColorMap = useMemo(
    () => (minorEdits?.length ? buildChartColorMap(minorEdits, nodes) : {}),
    [minorEdits, nodes],
  );

  // 위젯 dataKey → MinorEdit variableType 역매핑
  const WIDGET_KEY_TO_VAR_TYPE: Record<string, string[]> = {
    pressure: ['p'],
    temperature: ['tempf', 'tempg'],
    flowRate: ['mflowj', 'mflowfj', 'mflowgj'],
    voidFraction: ['voidf'],
    rktpow: ['rktpow'],
  };

  // 오버라이드 적용된 최종 configs + 모니터링탭 색상 동기화
  const widgetConfigs = useMemo(() => {
    const base = applyWidgetOverrides(defaultWidgetConfigs, widgetOverrides);

    // chartColorMap이 비어있으면 동기화 불필요
    if (Object.keys(chartColorMap).length === 0) return base;

    const synced: Record<string, NodeWidgetConfig[]> = {};
    for (const [nodeId, widgets] of Object.entries(base)) {
      const node = nodes.find((n) => n.id === nodeId);
      const ccc = node?.data?.componentId?.slice(0, 3) ?? '';

      synced[nodeId] = widgets.map((w) => {
        if (w.type !== 'mini-chart' || !w.chartColor) return w;

        // 위젯 dataKey에 해당하는 variableType 후보들
        const varTypes = WIDGET_KEY_TO_VAR_TYPE[w.dataKey];
        if (!varTypes) return w;

        // chartColorMap에서 CCC가 매칭되는 첫 번째 색상을 찾음
        for (const vt of varTypes) {
          for (const [mapKey, color] of Object.entries(chartColorMap)) {
            if (mapKey.startsWith(`${vt}_`) && mapKey.includes(ccc)) {
              return { ...w, chartColor: color };
            }
          }
        }
        // rktpow는 chartColorMap에서 rktpow_ 접두사로 매칭
        if (w.dataKey === 'rktpow') {
          const rktpowKey = Object.keys(chartColorMap).find((k) => k.startsWith('rktpow_'));
          if (rktpowKey) return { ...w, chartColor: chartColorMap[rktpowKey] };
        }
        return w;
      });
    }
    return synced;
  }, [defaultWidgetConfigs, widgetOverrides, chartColorMap, nodes]);

  // 시뮬레이션 상태 판별: idle / active / finished
  // failed도 finished 취급 — BFF 스트림 close가 onError로 올 수 있어 completed → failed 전환 시 버퍼 보존 필요
  const simulationPhase = !activeModel ? 'idle' as const
    : (activeModel.status === 'running' || activeModel.status === 'paused') ? 'active' as const
    : (activeModel.status === 'completed' || activeModel.status === 'stopped' || activeModel.status === 'failed') ? 'finished' as const
    : 'idle' as const;

  // 실시간 데이터: MinorEdit 스트림 + ICV 폴링 + 초기값 fallback
  const controlVariables = metadata.globalSettings?.controlVariables ?? [];
  const simulationValues = useLiveNodeValues({
    nodes,
    enabledNodeIds,
    minorEdits: minorEdits ?? [],
    controlVariables,
    latestMinorEdit,
    allICVEntries,
    simulationPhase,
  });


  // --- 컨텍스트 메뉴 핸들러 ---

  /** WidgetContext 경유 (HOC div wrapper) */
  const handleNodeContextMenuFromCtx = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const available = getAvailableWidgets(
      node.data.componentType,
      (node.data.parameters as Partial<ValveParameters>)?.valveSubType,
    );
    if (available.length === 0) return;

    setContextMenu({
      nodeId,
      position: { top: event.clientY, left: event.clientX },
    });
  }, [nodes]);

  /** ReactFlow onNodeContextMenu prop (더 안정적) */
  const handleRFNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<MARSNodeData>) => {
    event.preventDefault();
    event.stopPropagation();
    const available = getAvailableWidgets(
      node.data.componentType,
      (node.data.parameters as Partial<ValveParameters>)?.valveSubType,
    );
    if (available.length === 0) return;

    setContextMenu({
      nodeId: node.id,
      position: { top: event.clientY, left: event.clientX },
    });
  }, []);

  // --- 위젯 노드 추가/제거 ---

  const handleAddWidgetNode = useCallback((nodeId: string) => {
    setEnabledWidgetNodes((prev) => {
      if (prev.includes(nodeId)) return prev;
      const next = [...prev, nodeId];
      updateMetadata({ globalSettings: { ...metadata.globalSettings, enabledWidgetNodes: next } });
      return next;
    });
    setContextMenu(null);
  }, [metadata.globalSettings, updateMetadata]);

  const handleRemoveWidgetNode = useCallback((nodeId: string) => {
    setEnabledWidgetNodes((prev) => {
      const next = prev.filter((id) => id !== nodeId);
      updateMetadata({ globalSettings: { ...metadata.globalSettings, enabledWidgetNodes: next } });
      return next;
    });
    // 연관 overrides/displayModes도 정리
    setWidgetOverrides((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      updateMetadata({ globalSettings: { ...metadata.globalSettings, widgetOverrides: next } });
      return next;
    });
    setNodeDisplayModes((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setContextMenu(null);
  }, [metadata.globalSettings, updateMetadata]);

  // 노드 이름 매핑
  const nodeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const n of nodes) {
      map[n.id] = n.data.componentName || n.data.componentId || n.id;
    }
    return map;
  }, [nodes]);

  // 시나리오 평가
  const scenarioResults = useMemo(
    () => evaluateAllScenarios(scenarioConfig, simulationValues, widgetConfigs, nodeNames),
    [scenarioConfig, simulationValues, widgetConfigs, nodeNames],
  );

  // 위젯용 알람 레벨
  const alarmLevels = useMemo(
    () => deriveWidgetAlarmLevels(scenarioResults),
    [scenarioResults],
  );

  // 활성 알람 목록
  const activeAlarms = useMemo(
    () => scenarioResultsToActiveAlarms(scenarioResults),
    [scenarioResults],
  );

  // 알람 설정 저장
  const handleAlarmSettingsSave = useCallback((config: AlarmScenarioConfig) => {
    setScenarioConfig(config);
    updateMetadata({
      globalSettings: {
        ...metadata.globalSettings,
        alarmScenarioConfig: config,
      },
    });
  }, [metadata.globalSettings, updateMetadata]);

  // 위젯 드래그 이동 핸들러
  const handleWidgetMove = useCallback((nodeId: string, dataKey: string, x: number, y: number) => {
    setWidgetOverrides((prev) => {
      const next = {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          [dataKey]: {
            ...prev[nodeId]?.[dataKey],
            offsetX: Math.round(x),
            offsetY: Math.round(y),
          },
        },
      };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [metadata.globalSettings, updateMetadata]);

  // 위젯 리사이즈 핸들러
  const handleWidgetResize = useCallback((nodeId: string, dataKey: string, width: number, height: number) => {
    setWidgetOverrides((prev) => {
      const next = {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          [dataKey]: {
            ...prev[nodeId]?.[dataKey],
            width: Math.round(width),
            height: Math.round(height),
            pinned: true, // F3.2: 리사이즈 시 자동 핀
          },
        },
      };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [metadata.globalSettings, updateMetadata]);

  // 위젯 핀 토글 핸들러
  const handleWidgetPinToggle = useCallback((nodeId: string, dataKey: string) => {
    setWidgetOverrides((prev) => {
      const current = prev[nodeId]?.[dataKey]?.pinned ?? false;
      const next = {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          [dataKey]: {
            ...prev[nodeId]?.[dataKey],
            pinned: !current,
          },
        },
      };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [metadata.globalSettings, updateMetadata]);

  // R2: 위젯 잠금 토글 (이동+리사이즈)
  const handleWidgetLockToggle = useCallback((nodeId: string, dataKey: string) => {
    setWidgetOverrides((prev) => {
      const current = prev[nodeId]?.[dataKey]?.locked ?? false;
      const next = {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          [dataKey]: {
            ...prev[nodeId]?.[dataKey],
            locked: !current,
          },
        },
      };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [metadata.globalSettings, updateMetadata]);

  const widgetContextValue = useMemo<WidgetContextValue>(() => ({
    widgetConfigs,
    simulationValues,
    showWidgets,
    onNodeContextMenu: handleNodeContextMenuFromCtx,
    alarmLevels,
    widgetOverrides,
    onWidgetMove: handleWidgetMove,
    onWidgetResize: handleWidgetResize,
    onWidgetPinToggle: handleWidgetPinToggle,
    onWidgetLockToggle: handleWidgetLockToggle,
    lodThreshold: metadata.globalSettings?.widgetLodThreshold ?? DEFAULT_LOD_THRESHOLD,
    portalContainer,
    monitoredNodeIds: enabledNodeIds,
  }), [widgetConfigs, simulationValues, showWidgets, handleNodeContextMenuFromCtx, alarmLevels, widgetOverrides, handleWidgetMove, handleWidgetResize, handleWidgetPinToggle, handleWidgetLockToggle, metadata.globalSettings?.widgetLodThreshold, portalContainer, enabledNodeIds]);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOverrideChange = useCallback((dataKey: string, override: WidgetOverride) => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;

    setWidgetOverrides((prev) => {
      const next = {
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          [dataKey]: override,
        },
      };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [contextMenu, metadata.globalSettings, updateMetadata]);

  const handleResetNode = useCallback(() => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;

    // nodeDisplayModes에서도 해당 노드 제거
    setNodeDisplayModes((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          nodeDisplayModes: next,
        },
      });
      return next;
    });

    setWidgetOverrides((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          widgetOverrides: next,
        },
      });
      return next;
    });
  }, [contextMenu, metadata.globalSettings, updateMetadata]);

  // 컨텍스트 메뉴에서 노드별 displayMode 변경
  const handleNodeDisplayModeChange = useCallback((mode: WidgetDisplayMode) => {
    if (!contextMenu) return;
    setNodeDisplayModes((prev) => {
      const next = { ...prev, [contextMenu.nodeId]: mode };
      updateMetadata({
        globalSettings: {
          ...metadata.globalSettings,
          nodeDisplayModes: next,
        },
      });
      return next;
    });
  }, [contextMenu, metadata.globalSettings, updateMetadata]);

  // 컨텍스트 메뉴용 가용 위젯 목록
  const contextMenuAvailableWidgets = useMemo(() => {
    if (!contextMenu) return [];
    const node = nodes.find((n) => n.id === contextMenu.nodeId);
    if (!node) return [];
    return getAvailableWidgets(
      node.data.componentType,
      (node.data.parameters as Partial<ValveParameters>)?.valveSubType,
    );
  }, [contextMenu, nodes]);

  // 컨텍스트 메뉴 대상 노드에 수치형 위젯이 있는지 (Chart/Label 토글 표시 여부)
  const contextMenuHasNumericWidgets = useMemo(() => {
    if (!contextMenu) return false;
    return contextMenuAvailableWidgets.some(
      (w) => w.dataKey !== 'valveMode',
    );
  }, [contextMenu, contextMenuAvailableWidgets]);

  const contextMenuOverrides = contextMenu ? (widgetOverrides[contextMenu.nodeId] ?? {}) : {};
  const contextMenuDisplayMode = contextMenu
    ? (nodeDisplayModes[contextMenu.nodeId] ?? displayMode)
    : displayMode;
  const contextMenuNodeEnabled = contextMenu ? enabledNodeIds.has(contextMenu.nodeId) : false;

  const widgetCount = Object.values(widgetConfigs).reduce(
    (sum, arr) => sum + arr.filter((w) => w.visible !== false).length, 0,
  );

  // ── 차트 패널 토글 ──
  const [showChartPanel, setShowChartPanel] = useState(false);
  const [chartPanelHeight, setChartPanelHeight] = useState(280);
  const { zoom: _currentZoom } = useViewport();

  const displayNodes = nodes;

  // 비활성 탭: 데이터 수집 훅은 위에서 계속 실행, UI 렌더링만 스킵
  if (!visible) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Interactive Control
          </Typography>
          <Chip
            label={`${widgetCount} widgets`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_, v) => { if (v) { setDisplayMode(v); setNodeDisplayModes({}); updateMetadata({ globalSettings: { ...metadata.globalSettings, nodeDisplayModes: {} } }); } }}
            size="small"
            sx={{ height: 26 }}
          >
            <ToggleButton value="label" sx={{ px: 1, py: 0, fontSize: '0.65rem' }}>
              <LabelIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Label
            </ToggleButton>
            <ToggleButton value="chart" sx={{ px: 1, py: 0, fontSize: '0.65rem' }}>
              <ChartIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Chart
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Alarm Settings">
            <IconButton
              size="small"
              onClick={() => setAlarmSettingsOpen(true)}
              sx={{ p: 0.5 }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Chip
            label={showWidgets ? 'Widgets ON' : 'Widgets OFF'}
            size="small"
            color={showWidgets ? 'success' : 'default'}
            onClick={() => setShowWidgets((v) => !v)}
            sx={{ cursor: 'pointer', height: 24, fontWeight: 600 }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title={showChartPanel ? '차트 패널 숨기기' : '모니터링 차트 표시'}>
            <Chip
              icon={<ShowChartIcon sx={{ fontSize: 14 }} />}
              label="Charts"
              size="small"
              color={showChartPanel ? 'info' : 'default'}
              variant={showChartPanel ? 'filled' : 'outlined'}
              onClick={() => setShowChartPanel((v) => !v)}
              sx={{ cursor: 'pointer', height: 24, fontWeight: 600 }}
            />
          </Tooltip>
        </Box>
      </Box>

      {/* Alarm Bar */}
      {scenarioConfig.globalEnabled && (
        <AlarmPanel
          scenarioResults={scenarioResults}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={setSelectedScenarioId}
        />
      )}

      {/* Main Content: (Canvas + Charts) + Side Panel */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Canvas (위) + Charts (아래) 세로 배치 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Read-only ReactFlow Canvas */}
          <StyledReactFlowWrapper sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <WidgetContext.Provider value={widgetContextValue}>
              <ReactFlow
                nodes={displayNodes}
                edges={edges}
                nodeTypes={interactiveNodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                selectNodesOnDrag={false}
                nodesFocusable={false}
                edgesUpdatable={false}
                onNodeContextMenu={handleRFNodeContextMenu}
                onInit={handleInit}
                deleteKeyCode={null}
                connectionMode={ConnectionMode.Strict}
                snapToGrid
                snapGrid={[15, 15]}
                minZoom={0.1}
                onlyRenderVisibleElements
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  style: { stroke: EDGE_COLORS.axial, strokeWidth: 2, opacity: 0.3 },
                }}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#aaa" gap={15} />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeStrokeWidth={2}
                  pannable
                  zoomable
                  style={{ width: 120, height: 80 }}
                />
              </ReactFlow>
              <WidgetPortalOverlay onReady={setPortalContainer} />
              <DisplacedWidgetLayer
                nodes={nodes}
                widgetConfigs={widgetConfigs}
                widgetOverrides={widgetOverrides}
                simulationValues={simulationValues}
                alarmLevels={alarmLevels}
                portalContainer={portalContainer}
                onWidgetMove={handleWidgetMove}
                onWidgetResize={handleWidgetResize}
                onWidgetPinToggle={handleWidgetPinToggle}
                onWidgetLockToggle={handleWidgetLockToggle}
                lodThreshold={metadata.globalSettings?.widgetLodThreshold ?? DEFAULT_LOD_THRESHOLD}
              />
            </WidgetContext.Provider>
          </StyledReactFlowWrapper>

          {/* Resize Handle + Chart Panel — 캔버스 아래에 가로 전체 폭으로 표시 */}
          {showChartPanel && (
            <>
              {/* Drag resize handle */}
              <Box
                sx={{
                  height: 6,
                  cursor: 'row-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#f5f5f5',
                  borderTop: '1px solid #e0e0e0',
                  borderBottom: '1px solid #e0e0e0',
                  flexShrink: 0,
                  '&:hover': { bgcolor: '#e0e0e0' },
                  '&:active': { bgcolor: '#d0d0d0' },
                }}
                onMouseDown={(e: React.MouseEvent) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = chartPanelHeight;
                  const onMouseMove = (ev: MouseEvent) => {
                    const delta = startY - ev.clientY;
                    setChartPanelHeight(Math.max(120, Math.min(800, startHeight + delta)));
                  };
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
              >
                <Box sx={{ width: 32, height: 2, borderRadius: 1, bgcolor: '#bbb' }} />
              </Box>

              <Box
                sx={{
                  height: chartPanelHeight,
                  flexShrink: 0,
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <DynamicChartGrid
                  taskId=""
                  nodes={nodes}
                  minorEdits={minorEdits}
                  mode="embedded"
                />
              </Box>
            </>
          )}
        </Box>

        {/* Right Side Panel */}
        <SidePanel
          nodes={nodes}
          simulationValues={simulationValues}
          widgetConfigs={widgetConfigs}
          activeAlarms={activeAlarms}
          scenarioResults={scenarioResults}
          selectedScenarioId={selectedScenarioId}
          tripEntries={tripEntries}
          allICVEntries={allICVEntries}
          tripInputs={tripInputs}
          tripLoading={tripLoading}
          tripError={tripError}
          simulationActive={simulationActive}
          tripInputCount={tripInputCount}
          onSetTripMode={wrappedSetTripMode}
          onSetICVValue={wrappedSetICVValue}
          eventLog={eventLog}
        />
      </Box>

      {/* Widget Context Menu */}
      <WidgetContextMenu
        open={contextMenu != null}
        anchorPosition={contextMenu?.position ?? null}
        onClose={handleContextMenuClose}
        availableWidgets={contextMenuAvailableWidgets}
        overrides={contextMenuOverrides}
        onOverrideChange={handleOverrideChange}
        onReset={handleResetNode}
        hasNumericWidgets={contextMenuHasNumericWidgets}
        displayMode={contextMenuDisplayMode}
        onDisplayModeChange={handleNodeDisplayModeChange}
        isNodeEnabled={contextMenuNodeEnabled}
        onAddWidgets={() => contextMenu && handleAddWidgetNode(contextMenu.nodeId)}
        onRemoveWidgets={() => contextMenu && handleRemoveWidgetNode(contextMenu.nodeId)}
      />

      {/* Alarm Settings Dialog */}
      <AlarmSettingsDialog
        open={alarmSettingsOpen}
        onClose={() => setAlarmSettingsOpen(false)}
        scenarioConfig={scenarioConfig}
        onSave={handleAlarmSettingsSave}
        nodeNames={nodeNames}
      />
    </Box>
  );
};

interface InteractiveControlViewProps {
  minorEdits?: import('@/types/mars').MinorEdit[];
  /** false 시 데이터 수집만 유지하고 UI 렌더링 스킵 */
  visible?: boolean;
  /** 시뮬레이션 제어 이벤트 (append-only 배열) */
  simulationEvents?: SimulationEvent[];
  /** 제어 직후 반영을 위한 시뮬레이션 상태 오버라이드 */
  simulationStatusOverride?: SimulationStatus | null;
}

const InteractiveControlView: React.FC<InteractiveControlViewProps> = ({
  minorEdits,
  visible = true,
  simulationEvents,
  simulationStatusOverride,
}) => (
  <ReactFlowProvider>
    <InteractiveControlViewInner
      minorEdits={minorEdits}
      visible={visible}
      simulationEvents={simulationEvents}
      simulationStatusOverride={simulationStatusOverride}
    />
  </ReactFlowProvider>
);

export default InteractiveControlView;
