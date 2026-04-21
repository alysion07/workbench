/**
 * ReactFlow Canvas Component
 * Main canvas for node editing
 */

import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  NodeTypes,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/styles/reactFlowOverrides.css';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

import { useStore } from '@/stores/useStore';
import { debugDnD } from '@/utils/debug';
import { ComponentType, MARSNodeData, MARSEdgeData, SideConnectionSpec } from '@/types/mars';
import { getDefaultHomologousCurves } from '@/utils/pumpDefaults';
import { generateNodeId } from '@/utils/nodeIdGenerator';
import { resolveAppearance, getDefaultAppearance } from '@/utils/nodeAppearance';
import SideConnectionDialog from './dialogs/SideConnectionDialog';
import CrossflowConnectionDialog from './dialogs/CrossflowConnectionDialog';
import { formatSideEdgeLabel } from '@/utils/edgeLabelHelpers';
import { getEdgeStyle, EDGE_COLORS, determineConnectionType } from '@/utils/edgeStyleHelpers';
import SnglvolNode from './nodes/SnglvolNode';
import SngljunNode from './nodes/SngljunNode';
import PipeNode from './nodes/PipeNode';
import BranchNode from './nodes/BranchNode';
import TmdpvolNode from './nodes/TmdpvolNode';
import TmdpjunNode from './nodes/TmdpjunNode';
import MtpljunNode from './nodes/MtpljunNode';
import PumpNode from './nodes/PumpNode';
import HeatStructureNode from './nodes/HeatStructureNode';
import ValveNode from './nodes/ValveNode';
import TurbineNode from './nodes/TurbineNode';
import TankNode from './nodes/TankNode';
import SeparatorNode from './nodes/SeparatorNode';
import CrossflowModeButton from './common/CrossflowModeButton';
import NodeContextMenu from './common/NodeContextMenu';

// Register custom node types
const nodeTypes: NodeTypes = {
  snglvol: SnglvolNode,
  sngljun: SngljunNode,
  pipe: PipeNode,
  branch: BranchNode,
  tmdpvol: TmdpvolNode,
  tmdpjun: TmdpjunNode,
  mtpljun: MtpljunNode,
  pump: PumpNode,
  htstr: HeatStructureNode,
  valve: ValveNode,
  turbine: TurbineNode,
  tank: TankNode,
  separatr: SeparatorNode,
};

// Styled wrapper for ReactFlow with enhanced edge styles
const StyledReactFlowWrapper = styled(Box)({
  flexGrow: 1,
  height: '100%',
  backgroundColor: '#f5f5f5',

  // ===== 엣지 트랜지션 (부드러운 색상 전환) =====
  '& .react-flow__edge-path': {
    transition: 'stroke 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease',
  },

  // ===== 선택된 엣지 스타일 (Selected Edge) =====
  '& .react-flow__edge.selected .react-flow__edge-path': {
    stroke: `${EDGE_COLORS.selected} !important`,
    strokeWidth: '2.5px !important',
    filter: `drop-shadow(0 0 6px ${EDGE_COLORS.selected}60)`,
  },

  '& .react-flow__edge.selected .react-flow__edge-interaction': {
    strokeWidth: '20px !important',
  },

  '& .react-flow__edge.selected .react-flow__edge-text': {
    fill: EDGE_COLORS.selected,
    fontWeight: 600,
  },

  // ===== 호버 엣지 스타일 (Hover Edge) =====
  // 기본: 채도 복원 + 약간 두꺼워짐
  '& .react-flow__edge:hover:not(.selected) .react-flow__edge-path': {
    strokeWidth: '2px !important',
    filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.15))',
  },

  // Axial 호버 (파란색 채도 복원)
  [`& .react-flow__edge[data-connection-type="axial"]:hover:not(.selected) .react-flow__edge-path`]: {
    stroke: `${EDGE_COLORS.axialHover} !important`,
  },

  // Crossflow 호버 (앰버 채도 복원)
  [`& .react-flow__edge[data-connection-type="crossflow"]:hover:not(.selected) .react-flow__edge-path`]: {
    stroke: `${EDGE_COLORS.crossflowHover} !important`,
  },

  // MultiCell 호버 (초록 채도 복원)
  [`& .react-flow__edge[data-multi-cell="true"]:hover:not(.selected) .react-flow__edge-path`]: {
    stroke: `${EDGE_COLORS.multiCellHover} !important`,
  },

  // Legacy 호버 (회색 채도 복원)
  [`& .react-flow__edge[data-connection-type="legacy"]:hover:not(.selected) .react-flow__edge-path`]: {
    stroke: `${EDGE_COLORS.legacyHover} !important`,
  },
});

interface FlowCanvasProps {
  searchHighlightNodeIds?: string[];
  searchFocusNodeId?: string | null;
  /** 현재 모델 ID — 전달 시 모델별 뷰포트 캐시/복원 활성화 */
  modelId?: string | null;
}

// 모델별 뷰포트 캐시 (컴포넌트 외부 — 리렌더 불필요)
const viewportCache = new Map<string, { x: number; y: number; zoom: number }>();

const FlowCanvasInner: React.FC<FlowCanvasProps> = ({ searchHighlightNodeIds, searchFocusNodeId, modelId }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const viewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const prevModelIdRef = useRef<string | null | undefined>(modelId);
  /** 모델 전환 중 플래그 — selectedNodeId effect 간섭 방지 */
  const modelSwitchingRef = useRef(false);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRotationsRef = useRef<Map<string, number>>(new Map());
  const [edgesVisible, setEdgesVisible] = useState(true);
  const [edgeLabelsVisible, setEdgeLabelsVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    position: { x: number; y: number };
  } | null>(null);

  // P0-3 fix: 개별 selector로 분리하여 불필요한 re-render 방지
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const addNode = useStore((s) => s.addNode);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const generateComponentId = useStore((s) => s.generateComponentId);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const pendingSideConnection = useStore((s) => s.pendingSideConnection);
  const setPendingSideConnection = useStore((s) => s.setPendingSideConnection);
  const setEdges = useStore((s) => s.setEdges);
  const crossflowDialogOpen = useStore((s) => s.crossflowDialogOpen);
  const crossflowDialogInitialValues = useStore((s) => s.crossflowDialogInitialValues);
  const crossflowDialogOnApply = useStore((s) => s.crossflowDialogOnApply);

  // RESTART 모드: 캔버스 읽기 전용 (노드 드래그/연결/삭제/드롭 차단)
  const isRestart = useStore((s) => s.metadata?.globalSettings?.card100?.problemType === 'restart');
  const closeCrossflowDialog = useStore((s) => s.closeCrossflowDialog);
  const createCrossflowConnection = useStore((s) => s.createCrossflowConnection);
  
  const { setCenter } = useReactFlow();
  const isSearchActive = searchHighlightNodeIds && searchHighlightNodeIds.length > 0;
  const highlightSet = useMemo(
    () => new Set(searchHighlightNodeIds || []),
    [searchHighlightNodeIds]
  );

  // Apply search highlight / dim styles to nodes
  const styledNodes = useMemo(() => {
    if (!isSearchActive) return nodes;
    return nodes.map((node: Node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: highlightSet.has(node.id) ? 1 : 0.3,
        transition: 'opacity 0.2s ease',
        ...(node.id === searchFocusNodeId
          ? { boxShadow: '0 0 0 3px #1976d2, 0 0 12px rgba(25, 118, 210, 0.5)', borderRadius: '4px' }
          : {}),
      },
    }));
  }, [nodes, isSearchActive, highlightSet, searchFocusNodeId]);

  // 엣지 스타일을 EDGE_COLORS 상수 기준으로 동적 재계산 (persist된 인라인 스타일 덮어쓰기)
  // edgesVisible === false 이면 빈 배열 반환하여 엣지 숨김
  const styledEdges = useMemo(() => {
    if (!edgesVisible) return [];
    return edges.map((edge: Edge) => {
      const edgeData = edge.data as MARSEdgeData | undefined;
      const fromFace = edgeData?.fromVolume?.face ?? 0;
      const toFace = edgeData?.toVolume?.face ?? 0;
      const connType = determineConnectionType(fromFace, toFace);
      const isMultiCell = edgeData?.isMultiCellConnection ?? false;
      const freshStyle = getEdgeStyle(connType, isMultiCell);
      return {
        ...edge,
        style: { ...edge.style, ...freshStyle },
        ...(edgeLabelsVisible ? {} : { label: undefined }),
      };
    });
  }, [edges, edgesVisible, edgeLabelsVisible]);

  // Viewport focus: move to the focused node
  const prevFocusNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!searchFocusNodeId || searchFocusNodeId === prevFocusNodeIdRef.current) return;
    prevFocusNodeIdRef.current = searchFocusNodeId;
    const targetNode = nodes.find((n) => n.id === searchFocusNodeId);
    if (!targetNode) return;
    const x = targetNode.position.x + ((targetNode.width ?? 100) / 2);
    const y = targetNode.position.y + ((targetNode.height ?? 50) / 2);
    setCenter(x, y, { zoom: 1, duration: 300 });
  }, [searchFocusNodeId, nodes, setCenter]);

  // 초기 마운트 시 fitView
  const initialAnimating = useRef(true);
  const onInit = useCallback(() => {
    // 모델별 캐시된 뷰포트가 있으면 복원, 없으면 fitView
    const cached = modelId ? viewportCache.get(modelId) : null;
    if (cached) {
      setViewport(cached, { duration: 200 });
    } else {
      fitView({ padding: 0.2, duration: 300 });
    }
    setTimeout(() => {
      viewportRef.current = getViewport();
      initialAnimating.current = false;
    }, 350);
  }, [modelId, fitView, getViewport, setViewport]);

  // Save viewport on every move
  const onMove = useCallback(() => {
    const viewport = getViewport();
    viewportRef.current = viewport;
  }, [getViewport]);
  
  // 모델 전환: 뷰포트 저장/복원 (selectedNodeId effect보다 먼저 선언 → 먼저 실행)
  useEffect(() => {
    if (initialAnimating.current) return;
    const prevId = prevModelIdRef.current;
    if (prevId === modelId) return;

    modelSwitchingRef.current = true;

    // 이전 모델 뷰포트 저장 — getViewport()로 정확한 현재값 사용
    if (prevId) {
      viewportCache.set(prevId, getViewport());
    }

    prevModelIdRef.current = modelId;

    // 새 모델 뷰포트 복원 (nodes는 같은 렌더에서 이미 교체됨)
    if (modelId) {
      const cached = viewportCache.get(modelId);
      // ReactFlow가 새 nodes를 처리한 뒤 적용
      requestAnimationFrame(() => {
        if (cached) {
          setViewport(cached, { duration: 0 });
          viewportRef.current = cached;
        } else {
          fitView({ padding: 0.2, duration: 0 });
          viewportRef.current = getViewport();
        }
        modelSwitchingRef.current = false;
      });
    } else {
      modelSwitchingRef.current = false;
    }
  }, [modelId, getViewport, setViewport, fitView]);

  // Preserve viewport when selectedNodeId changes (panel shows/hides)
  useEffect(() => {
    if (modelSwitchingRef.current) return;

    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    if (viewportRef.current && !initialAnimating.current) {
      resizeTimeoutRef.current = setTimeout(() => {
        if (viewportRef.current && !modelSwitchingRef.current) {
          setViewport(viewportRef.current, { duration: 0 });
        }
      }, 50);
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [selectedNodeId, setViewport]);

  // P0-1 + P0-2 fix: appearance 변경(크기/회전/모양) 또는 노드 추가/삭제 시에만 트리거
  // 드래그(위치 변경)나 선택 등 무관한 변경은 무시
  const appearanceKey = useMemo(
    () => nodes.map(n => {
      const a = n.data?.appearance;
      return `${n.id}:${a?.width ?? 0}:${a?.height ?? 0}:${a?.rotation ?? 0}:${a?.shape ?? ''}`;
    }).join(','),
    [nodes]
  );
  useEffect(() => {
    // 1) rotation이 변경된 노드는 핸들 위치 캐시 갱신
    const changedNodeIds: string[] = [];
    const currentRotations = new Map<string, number>();

    for (const node of nodes) {
      const rotation = node.data?.appearance?.rotation ?? 0;
      currentRotations.set(node.id, rotation);

      const prev = prevRotationsRef.current.get(node.id);
      if (prev !== undefined && prev !== rotation) {
        changedNodeIds.push(node.id);
      }
    }

    prevRotationsRef.current = currentRotations;

    if (changedNodeIds.length > 0) {
      const timer = setTimeout(() => {
        changedNodeIds.forEach(nid => updateNodeInternals(nid));
      }, 50);
      return () => clearTimeout(timer);
    }

    // 2) 크기/모양/노드수 변경 시 엣지 재계산 (같은 viewport 재설정으로 트리거)
    // 초기 노심 포커싱이 완료되기 전에는 건너뛰기
    if (initialAnimating.current) return;
    const updateTimeout = setTimeout(() => {
      const currentViewport = getViewport();
      setViewport(currentViewport, { duration: 0 });
    }, 150);

    return () => clearTimeout(updateTimeout);
  }, [appearanceKey, updateNodeInternals, getViewport, setViewport]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle node click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Handle node context menu (right-click)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      nodeId: node.id,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    const { setSelectedNodeId, setSelectedEdgeId } = useStore.getState();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);
  
  // Handle side connection dialog confirmation
  const handleSideConnectionConfirm = useCallback((spec: SideConnectionSpec) => {
    const { edges: currentEdges } = useStore.getState();

    // Generate edge ID (multicell crossflow connection)
    const edgeId = `multicell-${spec.fromNodeId}-${spec.toNodeId}-${Date.now()}`;

    // Create edge with multi-cell crossflow connection data
    // 'side'는 MARS 공식 타입이 아니므로 'crossflow' + isMultiCellConnection 사용
    const isMultiCell = spec.cells.length > 1;
    const multiCellStyle = getEdgeStyle('crossflow', isMultiCell);
    const newEdge: Edge<MARSEdgeData> = {
      id: edgeId,
      source: spec.fromNodeId,
      target: spec.toNodeId,
      sourceHandle: `f${spec.fromFace}`,
      targetHandle: `f${spec.toFace}`,
      data: {
        connectionType: 'crossflow' as const,  // MARS 공식 타입
        isMultiCellConnection: true,           // 다중 셀 연결 표시
        fromVolume: {
          nodeId: spec.fromNodeId,
          volumeNum: spec.cells[0], // Multi-cell의 경우 첫 번째 cell
          face: spec.fromFace,
        },
        toVolume: {
          nodeId: spec.toNodeId,
          volumeNum: spec.cells[0],  // Multi-cell의 경우 첫 번째 cell
          face: spec.toFace,
        },
        cells: spec.cells,           // Multi-cell 정보 유지
        area: spec.area,
        fwdLoss: spec.fwdLoss,
        revLoss: spec.revLoss,
        jefvcahs: spec.jefvcahs,
        label: formatSideEdgeLabel(spec),
        isMultiJunction: isMultiCell,
      },
      type: 'smoothstep',
      animated: false,
      style: multiCellStyle,
    };

    setEdges([...currentEdges, newEdge]);
    setPendingSideConnection(null);
  }, [setEdges, setPendingSideConnection]);
  
  // Handle side connection dialog close
  const handleSideConnectionClose = useCallback(() => {
    setPendingSideConnection(null);
  }, [setPendingSideConnection]);
  
  // Handle edge click
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: any) => {
    const { setSelectedEdgeId } = useStore.getState();
    setSelectedEdgeId(edge.id);
  }, []);
  
  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      // CRITICAL: Prevent ReactFlow's default drop behavior
      event.preventDefault();
      event.stopPropagation();
      
      const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
      const source = event.dataTransfer.getData('application/source');
      
      // Only handle drops from palette
      if (source !== 'palette') return;
      if (!type) return;
      
      // Use screenToFlowPosition - no need to calculate bounds manually
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      // Generate unique IDs - CRITICAL: Do this atomically to prevent race conditions
      const componentId = generateComponentId(type);
      const nodeId = generateNodeId();
      
      // Double-check that componentId doesn't already exist (race condition protection)
      // MARS에서 열구조체와 수력 컴포넌트는 독립된 번호 네임스페이스이므로 같은 카테고리 내에서만 비교
      const currentNodes = useStore.getState().nodes;
      const isHtstr = type === 'htstr';
      if (currentNodes.some(n => n.data.componentId === componentId && (n.data.componentType === 'htstr') === isHtstr)) {
        console.error('RACE CONDITION: componentId already exists!', componentId);
        return;
      }
      
      // Set default parameters and status based on component type
      const getDefaultParameters = (compType: ComponentType) => {
        switch (compType) {
          case 'snglvol':
            return {
              xArea: 0,
              xLength: 1.0,
              volume: 1.0,
              azAngle: 0,
              incAngle: 90,
              dz: 1.0,
              wallRoughness: 3.048e-5,
              hydraulicDiameter: 0.1,
              tlpvbfe: '0000000',
              ebt: '003',
              pressure: 15.5e6,
              temperature: 560.0,
            };
          case 'tmdpvol':
            return {
              area: 0,
              length: 1.0,
              volume: 1.0,
              azAngle: 0,
              incAngle: 90,
              dz: 1.0,
              wallRoughness: 0.0,
              hydraulicDiameter: 0.0,
              conditionType: '003',
              timeTable: [
                { time: 0.0, pressure: 15.5e6, temperature: 560.0 },
                { time: 1000.0, pressure: 15.5e6, temperature: 560.0 },
              ],
            };
          case 'pipe':
            return {
              ncells: 1,
              areas: [1.0],
              lengths: [1.0],
              volumes: [0],
              azAngles: [0],
              incAngles: [90],
              elevations: [1.0],
              wallRoughness: [3.048e-5],
              hydraulicDiameters: [0.1],
              volumeFlags: '0000000',
              junctionAreas: [0],
              fwdLoss: [0.0],
              revLoss: [0.0],
              junctionFlags: '00000000',
              ebt: '003',
              pressures: [15.5e6],
              temperatures: [560.0],
            };
          case 'sngljun':
            return {
              // Don't set from/to - leave undefined so status starts as 'incomplete'
              area: 0.5,
              fwdLoss: 0.5,
              revLoss: 0.5,
              jefvcahs: '00000000',
              flowDirection: 1,
              mfl: 0.0,
              mfv: 0.0,
            };
          case 'tmdpjun':
            return {
              // Don't set from/to - leave undefined so status starts as 'incomplete'
              area: 0.5,
              fwdLoss: 0.5,
              revLoss: 0.5,
              jefvcahs: '00000000',
              timeTable: [
                { time: 0.0, mfl: 0.0, mfv: 0.0 },
                { time: 1000.0, mfl: 0.0, mfv: 0.0 },
              ],
            };
          case 'branch':
            return {
              njuns: 2,
              initialConditionControl: 0,
              area: 0.0,
              length: 0.18,
              volume: 0.52348,
              azAngle: 0.0,
              incAngle: 90.0,
              dz: 0.18,
              wallRoughness: 3.048e-5,
              hydraulicDiameter: 0.18815,
              tlpvbfe: '0000000',
              ebt: '003',
              pressure: 15.074e6,
              temperature: 594.05,
              junctions: [
                {
                  junctionNumber: 1,
                  direction: 'inlet',
                  branchFace: 1,
                  from: '',
                  to: '',
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00000000',
                },
                {
                  junctionNumber: 2,
                  direction: 'outlet',
                  branchFace: 2,
                  from: '',
                  to: '',
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00000000',
                },
              ],
            };
          case 'mtpljun':
            return {
              njuns: 1,
              icond: 1, // Default: mass flows (kg/s)
              junctions: [
                {
                  junctionNumber: 1,
                  from: '',
                  to: '',
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00000000',
                  dischargeCoeff: 1.0,
                  thermalConstant: 0.14,
                  subDc: 1.0,
                  twoDc: 1.0,
                  supDc: 1.0,
                  fIncre: 10000,
                  tIncre: 10000,
                  initialLiquidFlow: 0.0,
                  initialVaporFlow: 0.0,
                },
              ],
            };
          case 'pump':
            // Default values from SMART.txt Component 181 (RCP-1)
            return {
              name: 'RCP',
              // CCC0101-0102: Volume Geometry
              area: 4.0,
              length: 0.0,
              volume: 0.236,
              azAngle: 0.0,
              incAngle: 0.0,
              dz: 0.0,
              tlpvbfe: '0000000',
              // CCC0108-0109: Inlet/Outlet Junctions
              inletConnection: null,
              outletConnection: null,
              inletArea: 0.36,
              outletArea: 0.36,
              inletFwdLoss: 1.173,
              inletRevLoss: 4.408,
              outletFwdLoss: 1.173,
              outletRevLoss: 4.408,
              inletJefvcahs: '00000000',
              outletJefvcahs: '00000000',
              // CCC0200-0202: Initial Conditions
              ebt: '003',
              pressure: 15.15e6,
              temperature: 596.15,
              inletFlowMode: 1,
              inletLiquidFlow: 2507.0,
              inletVaporFlow: 0.0,
              outletFlowMode: 1,
              outletLiquidFlow: 2507.0,
              outletVaporFlow: 0.0,
              // CCC0301: Options
              tbli: 0,
              twophase: -1,
              tdiff: -3,
              mtorq: -1,
              tdvel: 0,
              ptrip: 501,
              rev: 0,
              // CCC0302-0304: Pump Characteristics
              ratedSpeed: 494.2772,
              initialSpeedRatio: 1.0,
              ratedFlow: 3.9468,
              ratedHead: 30.3,
              ratedTorque: 2654.0,
              momentOfInertia: 16.0,
              ratedDensity: 676.0,
              ratedMotorTorque: 0.0,
              frictionTF0: 0.0,
              frictionTF1: 0.0,
              frictionTF2: 0.0,
              frictionTF3: 0.0,
              // Homologous Curves - 16개 기본 곡선
              homologousCurves: getDefaultHomologousCurves(),
            };
          case 'turbine':
            return {
              name: 'TURBINE',
              njuns: 1,
              initialConditionControl: 0,
              area: 0.0,
              length: 1.0,
              volume: 1.0,
              azAngle: 0.0,
              incAngle: 0.0,
              dz: 0.0,
              wallRoughness: 0.0,
              hydraulicDiameter: 0.1,
              tlpvbfe: '0000000',
              ebt: '003' as const,
              pressure: 6.0e6,
              temperature: 548.0,
              junctions: [
                {
                  junctionNumber: 1,
                  direction: 'inlet' as const,
                  branchFace: 1,
                  from: '',
                  to: '',
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00000000',
                },
              ],
              shaftSpeed: 188.5,
              stageInertia: 100.0,
              shaftFriction: 0.0,
              shaftComponentNumber: 0,
              disconnectTrip: 0,
              drainFlag: 0,
              turbineType: 1 as const,
              efficiency: 0.85,
              reactionFraction: 0.5,
              meanStageRadius: 0.5,
            };
          case 'separatr':
            return {
              name: 'SEPARATR',
              initialConditionControl: 0,
              separatorOption: 0 as const,
              area: 0.0,
              length: 1.0,
              volume: 1.0,
              azAngle: 0.0,
              incAngle: 90.0,
              dz: 1.0,
              wallRoughness: 0.0,
              hydraulicDiameter: 0.1,
              volumeControlFlags: '0000010',
              ebt: '003' as const,
              pressure: 6.0e6,
              temperature: 548.0,
              junctions: [
                {
                  junctionNumber: 1,
                  direction: 'outlet' as const,
                  branchFace: 2,
                  from: null,
                  to: null,
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00001000',
                  voidFractionLimit: 0.5,
                },
                {
                  junctionNumber: 2,
                  direction: 'inlet' as const,
                  branchFace: 1,
                  from: null,
                  to: null,
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00001000',
                  voidFractionLimit: 0.15,
                },
                {
                  junctionNumber: 3,
                  direction: 'inlet' as const,
                  branchFace: 1,
                  from: null,
                  to: null,
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00001000',
                },
              ],
            };
          case 'tank':
            return {
              name: 'TANK',
              njuns: 1,
              initialConditionControl: 0,
              area: 0.0,
              length: 1.0,
              volume: 1.0,
              azAngle: 0.0,
              incAngle: 0.0,
              dz: 0.0,
              wallRoughness: 0.0,
              hydraulicDiameter: 0.1,
              tlpvbfe: '0000000',
              ebt: '003' as const,
              pressure: 1.0e5,
              temperature: 300.0,
              junctions: [
                {
                  junctionNumber: 1,
                  direction: 'inlet' as const,
                  branchFace: 1,
                  from: '',
                  to: '',
                  area: 0,
                  fwdLoss: 0,
                  revLoss: 0,
                  jefvcahs: '00000000',
                },
              ],
              initialLiquidLevel: 0.0,
              volumeLevelCurve: [
                { volume: 0.0, level: 0.0 },
                { volume: 1.0, level: 1.0 },
              ],
            };
          case 'htstr':
            // Heat Structure default values (Phase 1: General structure)
            return {
              name: 'HTSTR',
              // Card 1CCCG000: General data
              nh: 1,                        // 1 axial heat structure
              np: 3,                        // 3 radial mesh points
              geometryType: 1 as const,     // Rectangular
              ssInitFlag: 0 as const,       // Use input temperatures
              leftBoundaryCoord: 0.0,       // Left boundary at origin
              // Card 1CCCG100: Mesh flags
              meshLocationFlag: 0 as const, // Geometry data in this input
              meshFormatFlag: 1 as const,   // Intervals + coord format
              // Card 1CCCG101+: Mesh intervals
              meshIntervals: [
                { intervals: 1, rightCoord: 0.005 },
                { intervals: 1, rightCoord: 0.01 },
              ],
              // Card 1CCCG201+: Material composition
              materialCompositions: [
                { materialNumber: 1, interval: 1 },
                { materialNumber: 1, interval: 2 },
              ],
              // Card 1CCCG301+: Source distribution
              sourceDistributions: [
                { sourceValue: 1.0, interval: 1 },
                { sourceValue: 1.0, interval: 2 },
              ],
              // Card 1CCCG401+: Initial temperature
              initialTemperatures: [
                { temperature: 560.0, meshPoint: 1 },
                { temperature: 560.0, meshPoint: 2 },
                { temperature: 560.0, meshPoint: 3 },
              ],
              // Card 1CCCG501+: Left boundary conditions
              leftBoundaryConditions: [
                {
                  boundaryVolume: null,    // Insulated (no connection)
                  increment: 0,
                  bcType: 0 as const,      // Insulated
                  surfaceAreaCode: 0 as const,
                  surfaceArea: 0.0,
                  hsNumber: 1,
                },
              ],
              // Card 1CCCG601+: Right boundary conditions
              rightBoundaryConditions: [
                {
                  boundaryVolume: null,    // Insulated (no connection)
                  increment: 0,
                  bcType: 0 as const,      // Insulated
                  surfaceAreaCode: 0 as const,
                  surfaceArea: 0.0,
                  hsNumber: 1,
                },
              ],
              // Card 1CCCG701+: Source data
              sourceData: [
                {
                  sourceType: 0,           // No internal source
                  multiplier: 0.0,
                  dmhl: 0.0,
                  dmhr: 0.0,
                  hsNumber: 1,
                },
              ],
            };
          default:
            return {};
        }
      };
      
      const defaultParams = getDefaultParameters(type);
      // Junction components always start as 'incomplete' (require connections)
      const isJunctionComponent = ['sngljun', 'tmdpjun', 'mtpljun'].includes(type);
      const hasValidDefaults = !isJunctionComponent && Object.keys(defaultParams).length > 0;
      
      // 타입별 기본 SVG가 설정되어 있으면 appearance에 적용
      const defaultSvgByType = useStore.getState().defaultSvgByType;
      const defaultSvgId = defaultSvgByType[type];
      const appearance = defaultSvgId
        ? { ...getDefaultAppearance(type), shape: 'custom' as const, svgLibraryId: defaultSvgId }
        : undefined;

      const newNode = {
        id: nodeId,
        type,
        position,
        data: {
          componentId,
          componentName: `${type}_${componentId.slice(0, 3)}`,
          componentType: type,
          parameters: defaultParams,
          status: hasValidDefaults ? ('valid' as const) : ('incomplete' as const),
          errors: [],
          warnings: [],
          ...(appearance ? { appearance } : {}),
        } as MARSNodeData,
      };
      
      debugDnD('Drop:', type, componentId, position);

      // IMPORTANT: Deselect all nodes before adding new one
      setSelectedNodeId(null);
      addNode(newNode);
    },
    [screenToFlowPosition, addNode, generateComponentId, setSelectedNodeId]
  );
  
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Match the effectAllowed from palette
    event.dataTransfer.dropEffect = 'copy';
  }, []);
  
  return (
    <StyledReactFlowWrapper ref={reactFlowWrapper}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={isRestart ? undefined : onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={isRestart ? undefined : onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onMove={onMove}
        onInit={onInit}
        onDrop={isRestart ? undefined : onDrop}
        onDragOver={isRestart ? undefined : onDragOver}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Strict}
        fitView={false}
        snapToGrid
        snapGrid={[15, 15]}
        nodesDraggable={!isRestart}
        nodesConnectable={!isRestart}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        nodesFocusable={false}
        minZoom={0.1}
        deleteKeyCode={isRestart ? null : "Delete"}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: EDGE_COLORS.axial, // 기본 연결 색상 (저채도 파란)
            strokeWidth: 1.5,
          },
        }}
        edgesUpdatable={false}
        edgesFocusable={true}
        onlyRenderVisibleElements
      >
        <Background color="#aaa" gap={15} />
        <Controls>
          <ControlButton
            onClick={() => setEdgesVisible((v) => !v)}
            title={edgesVisible ? '엣지 숨기기' : '엣지 표시'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              {edgesVisible ? (
                <>
                  <path d="M4 20 L20 4" />
                  <circle cx="4" cy="20" r="2" fill="currentColor" />
                  <circle cx="20" cy="4" r="2" fill="currentColor" />
                </>
              ) : (
                <>
                  <path d="M4 20 L20 4" strokeDasharray="4 3" opacity="0.4" />
                  <circle cx="4" cy="20" r="2" fill="currentColor" opacity="0.4" />
                  <circle cx="20" cy="4" r="2" fill="currentColor" opacity="0.4" />
                  <path d="M2 2 L22 22" stroke="currentColor" strokeWidth="2.5" />
                </>
              )}
            </svg>
          </ControlButton>
          <ControlButton
            onClick={() => setEdgeLabelsVisible((v) => !v)}
            title={edgeLabelsVisible ? '엣지 라벨 숨기기' : '엣지 라벨 표시'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              {edgeLabelsVisible ? (
                <text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" stroke="none">T</text>
              ) : (
                <>
                  <text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.4">T</text>
                  <path d="M2 2 L22 22" stroke="currentColor" strokeWidth="2.5" />
                </>
              )}
            </svg>
          </ControlButton>
        </Controls>
        <MiniMap
          nodeColor={(node) => {
            // Appearance 배경색이 있으면 사용, 없으면 타입별 기본색
            const nodeData = node.data as MARSNodeData | undefined;
            if (nodeData) {
              const appearance = resolveAppearance(nodeData.appearance, nodeData.componentType);
              return appearance.backgroundColor;
            }
            return '#999';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {/* CrossFlow Button Panel - Top Left */}
        <Panel position="top-left">
          <CrossflowModeButton />
        </Panel>
      </ReactFlow>
      
      {/* Side Connection Dialog */}
      {pendingSideConnection && (
        <SideConnectionDialog
          open={!!pendingSideConnection}
          onClose={handleSideConnectionClose}
          onConfirm={handleSideConnectionConfirm}
          sourceNodeId={pendingSideConnection.sourceNodeId}
          targetNodeId={pendingSideConnection.targetNodeId}
          sourceHandleId={pendingSideConnection.sourceHandleId}
          targetHandleId={pendingSideConnection.targetHandleId}
          nodes={nodes}
        />
      )}

      {/* CrossFlow Connection Dialog */}
      <CrossflowConnectionDialog
        open={crossflowDialogOpen}
        onClose={closeCrossflowDialog}
        onConfirm={createCrossflowConnection}
        onApply={crossflowDialogOnApply}
        initialValues={crossflowDialogInitialValues}
        nodes={nodes}
      />

      {/* Node Context Menu (z-index control) */}
      <NodeContextMenu
        open={contextMenu !== null}
        position={contextMenu?.position ?? null}
        nodeId={contextMenu?.nodeId ?? null}
        onClose={() => setContextMenu(null)}
      />
    </StyledReactFlowWrapper>
  );
};

const FlowCanvas: React.FC<FlowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default FlowCanvas;

