/**
 * Zustand Store for MARS Editor
 * Central state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { MARSNodeData, MARSEdgeData, ProjectMetadata, GlobalSettings, VolumeReference, ConnectionConfig, FaceType, ConnectionType, MtpljunParameters, SngljunParameters, TmdpjunParameters, PumpParameters, ValveParameters, BranchParameters, TurbineParameters, CrossflowDialogInitialValues, ThermalProperty, NodeAppearance, SvgLibraryItem, ComponentType } from '@/types/mars';
import { getDefaultGlobalSettings } from '@/utils/globalSettingsValidation';
import { debugStore, debugConnection } from '@/utils/debug';
import { getHandleIdForVolume, convertCellHandleToMetaHandle } from '@/utils/edgeSyncUtils';
import { parseCellHandleId, convertMetaHandleToCellHandle, generateCellHandleId, parseVolumeId } from '@/utils/pipeHandleHelpers';
import { autoValidateNode } from '@/utils/componentValidation';
import { getEdgeStyle, getEdgeLabel, determineConnectionType } from '@/utils/edgeStyleHelpers';
import { resolveAppearance, getDefaultAppearance as getDefaultAppearanceUtil } from '@/utils/nodeAppearance';
import { handleEdgeCreated, handleEdgeDeleted, syncEdgesFromParameters, cleanupOrphanedRefs, isEdgeOwner, NodeUpdate } from '@/utils/connectionSync';
import { migrateProjectNodeIds } from '@/utils/nodeIdMigration';
import { resolveVolumeRefToHandle } from '@/utils/handleResolver';
import { useSimulationStore } from '@/stores/simulationStore';
import { useAnalysisStore } from '@/stores/analysisStore';

interface EditorState {
  // ReactFlow state
  nodes: Node<MARSNodeData>[];
  edges: Edge<MARSEdgeData>[];

  // Project metadata
  metadata: ProjectMetadata;

  // User state
  userId: string | null;

  // UI state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isDirty: boolean;
  sidebarExpanded: boolean;

  // Property form state
  propertyFormState: {
    isDirty: boolean;
    isValid: boolean;
  };
  formSubmitHandler: (() => void) | null;

  // Full code view state (전체 Text Code Preview)
  fullCodeViewOpen: boolean;

  // CrossFlow dialog state
  crossflowDialogOpen: boolean;
  crossflowDialogSourceNode: string | null;
  crossflowDialogInitialValues: CrossflowDialogInitialValues | null;
  crossflowDialogOnApply: ((config: ConnectionConfig) => void) | null;

  // Side connection dialog state
  pendingSideConnection: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandleId: string;
    targetHandleId: string;
  } | null;

  // Pending connection for wizard
  pendingConnection: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandleId: string;
    targetHandleId: string;
  } | null;

  // Actions
  setNodes: (nodes: Node<MARSNodeData>[]) => void;
  setEdges: (edges: Edge<MARSEdgeData>[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: Node<MARSNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<MARSNodeData>) => void;
  updateNodeAppearance: (nodeId: string, appearance: Partial<NodeAppearance>) => void;
  deleteNode: (nodeId: string) => void;
  setNodeZIndex: (nodeId: string, zIndex: number) => void;

  // Heat Structure edge management (Phase 1.5.1)
  deleteHeatStructureEdge: (nodeId: string, side: 'left' | 'right') => void;
  createHeatStructureEdge: (nodeId: string, side: 'left' | 'right', volumeRef: VolumeReference) => void;

  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;

  // Side connection actions
  setPendingSideConnection: (connection: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandleId: string;
    targetHandleId: string;
  } | null) => void;

  // CrossFlow dialog actions
  openCrossflowDialog: (options?: {
    sourceNodeId?: string;
    initialValues?: CrossflowDialogInitialValues;
    onApply?: (config: ConnectionConfig) => void;
  }) => void;
  closeCrossflowDialog: () => void;
  createCrossflowConnection: (config: ConnectionConfig) => void;

  // Connection wizard actions
  setPendingConnection: (connection: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandleId: string;
    targetHandleId: string;
  } | null) => void;
  onConnectionWizardConfirm: (config: ConnectionConfig) => void;

  // Project actions
  updateMetadata: (metadata: Partial<ProjectMetadata>) => void;
  loadProject: (project: { metadata: ProjectMetadata; nodes: Node<MARSNodeData>[]; edges: Edge<MARSEdgeData>[]; svgLibrary?: SvgLibraryItem[]; defaultSvgByType?: Partial<Record<ComponentType, string>> }) => void;
  swapModelNodes: (nodes: Node<MARSNodeData>[], edges: Edge<MARSEdgeData>[], settings?: Partial<ProjectMetadata>) => void;
  resetProject: () => void;
  setIsDirty: (isDirty: boolean) => void;

  // Global settings dialog state
  globalSettingsDialogOpen: boolean;
  globalSettingsDialogInitialTab: number;
  openGlobalSettingsDialog: (initialTab?: number) => void;
  closeGlobalSettingsDialog: () => void;

  // Global settings actions
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  updateRestartSettings: (settings: Partial<GlobalSettings>) => void;
  getGlobalSettings: () => GlobalSettings | undefined;

  // Thermal Property actions (Phase 3)
  addThermalProperty: (property: ThermalProperty) => void;
  updateThermalProperty: (materialNumber: number, updates: Partial<ThermalProperty>) => void;
  deleteThermalProperty: (materialNumber: number) => void;
  getThermalProperty: (materialNumber: number) => ThermalProperty | undefined;
  getThermalProperties: () => ThermalProperty[];
  normalizeThermalPropertyGas: (materialNumber: number) => void;

  // Component ID generation
  generateComponentId: (type: string) => string;

  // User management
  setUserId: (userId: string | null) => void;
  resetUser: () => void;

  // Sidebar management
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;

  // Property form management
  setPropertyFormState: (state: { isDirty: boolean; isValid: boolean }) => void;
  setFormSubmitHandler: (handler: (() => void) | null) => void;

  // Preview panel management
  setFullCodeViewOpen: (open: boolean) => void;
  toggleFullCodeView: () => void;

  // SVG Library (프로젝트 단위)
  svgLibrary: SvgLibraryItem[];
  defaultSvgByType: Partial<Record<ComponentType, string>>;
  addSvgToLibrary: (item: Omit<SvgLibraryItem, 'id' | 'createdAt'>) => string;
  removeSvgFromLibrary: (svgId: string) => void;
  setDefaultSvgForType: (componentType: ComponentType, svgId: string | null) => void;
}

// Default metadata
const defaultMetadata: ProjectMetadata = {
  projectName: 'Untitled Project',
  version: '1.0.0',
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  simulationType: 'transnt',
  maxTime: 100.0,
  minDt: 1.0e-6,
  maxDt: 0.1,
  unitSystem: 'si',
  workingFluid: 'h2o',
  globalSettings: getDefaultGlobalSettings(),
};

// Throttle mechanism for drag operations using requestAnimationFrame
// This prevents excessive store updates during node dragging (~60fps → ~16fps)
let rafId: number | null = null;
let pendingNodes: Node<MARSNodeData>[] | null = null;

const throttledSetNodes = (updatedNodes: Node<MARSNodeData>[], set: any) => {
  // Store the latest nodes
  pendingNodes = updatedNodes;

  // If already scheduled, just update pendingNodes and return
  if (rafId !== null) return;

  // Schedule update on next animation frame
  rafId = requestAnimationFrame(() => {
    if (pendingNodes) {
      set({ nodes: pendingNodes });
      pendingNodes = null;
    }
    rafId = null;
  });
};

export const useStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      metadata: defaultMetadata,
      userId: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      pendingSideConnection: null,
      pendingConnection: null,
      crossflowDialogOpen: false,
      crossflowDialogSourceNode: null,
      crossflowDialogInitialValues: null,
      crossflowDialogOnApply: null,
      globalSettingsDialogOpen: false,
      globalSettingsDialogInitialTab: 0,
      isDirty: false,
      // persist 미들웨어가 하이드레이트 시 덮어쓰므로 기본값만 제공
      sidebarExpanded: true,
      propertyFormState: {
        isDirty: false,
        isValid: true,
      },
      svgLibrary: [],
      defaultSvgByType: {},
      formSubmitHandler: null,
      fullCodeViewOpen: false,

      // ReactFlow handlers
      setNodes: (nodes) => set({ nodes, isDirty: true }),
      setEdges: (edges) => set({ edges, isDirty: true }),

      onNodesChange: (changes) => {
        const currentNodes = get().nodes;
        const updatedNodes = applyNodeChanges(changes, currentNodes);

        // Detect change types
        const isDragging = changes.some(
          change => change.type === 'position' && change.dragging === true
        );

        const isDragComplete = changes.some(
          change => change.type === 'position' && change.dragging === false
        );

        const hasNonPositionChange = changes.some(
          change => change.type !== 'position'
        );

        // Performance optimization: Apply throttling during drag operations
        // This reduces store updates from ~60fps to ~16fps using requestAnimationFrame
        if (isDragging) {
          // Throttle updates during dragging
          throttledSetNodes(updatedNodes, set);
        } else {
          // Immediate update for non-drag operations or drag completion
          const shouldMarkDirty = isDragComplete || hasNonPositionChange;

          set({
            nodes: updatedNodes,
            ...(shouldMarkDirty && { isDirty: true }),
          });
        }
      },

      onEdgesChange: (changes) => {
        const { edges, nodes } = get();
        const updatedEdges = applyEdgeChanges(changes, edges);

        // Check for removed edges to update junction nodes
        const removedEdges = changes
          .filter(change => change.type === 'remove')
          .map(change => edges.find(e => e.id === change.id))
          .filter(edge => edge !== undefined);

        if (removedEdges.length > 0) {
          debugStore('Edge(s) removed:', removedEdges.map(e => e?.id));

          // Use connectionSync handlers to update parameters for all affected nodes
          const allNodeUpdates: Array<{ nodeId: string; parameters: Record<string, unknown> }> = [];
          for (const removedEdge of removedEdges) {
            if (!removedEdge) continue;
            const updates = handleEdgeDeleted(nodes, updatedEdges, removedEdge);
            for (const u of updates) {
              // Merge updates for same nodeId
              const existing = allNodeUpdates.find(x => x.nodeId === u.nodeId);
              if (existing) {
                Object.assign(existing.parameters, u.parameters);
              } else {
                allNodeUpdates.push({ ...u });
              }
            }
          }

          let updatedNodes = nodes;
          if (allNodeUpdates.length > 0) {
            updatedNodes = nodes.map(node => {
              const update = allNodeUpdates.find(u => u.nodeId === node.id);
              if (!update) return node;
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    ...update.parameters,
                  },
                },
              };
            });
            debugStore('Edge deletion: updated nodes:', allNodeUpdates.map(u => u.nodeId));
          }

          set({
            edges: updatedEdges,
            nodes: updatedNodes,
            isDirty: true,
          });
        } else {
          set({
            edges: updatedEdges,
            isDirty: true,
          });
        }
      },

      onConnect: (connection) => {
        const { nodes, edges } = get();
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) {
          console.warn('Source or target node not found');
          return;
        }

        // Common helper: after edge creation, update node parameters via connectionSync
        const applyConnectionUpdates = (edgelike: { source?: string | null; sourceHandle?: string | null; target?: string | null; targetHandle?: string | null; data?: MARSEdgeData }) => {
          const mockEdge = edgelike as Edge<MARSEdgeData>;
          const nodeUpdates = handleEdgeCreated(nodes, mockEdge);
          if (nodeUpdates.length === 0) return;

          let updatedNodes = nodes.map(n => {
            const update = nodeUpdates.find((u: NodeUpdate) => u.nodeId === n.id);
            if (!update) return n;
            return { ...n, data: { ...n.data, parameters: { ...n.data.parameters, ...update.parameters } } };
          });

          // Auto-validate affected nodes
          for (const update of nodeUpdates) {
            const validationResult = autoValidateNode(update.nodeId, updatedNodes);
            if (validationResult) {
              updatedNodes = updatedNodes.map(n => n.id === update.nodeId
                ? { ...n, data: { ...n.data, status: validationResult.status!, errors: validationResult.errors!, warnings: validationResult.warnings! } }
                : n);
            }
          }

          set({ nodes: updatedNodes, isDirty: true });
          debugStore('Connection params updated:', nodeUpdates.map((u: NodeUpdate) => u.nodeId));
        };

        // Parse cell handle IDs
        let sourceHandleId = connection.sourceHandle;
        let targetHandleId = connection.targetHandle;

        // Parse cell handle IDs
        let sourceHandleInfo = sourceHandleId ? parseCellHandleId(sourceHandleId) : null;
        let targetHandleInfo = targetHandleId ? parseCellHandleId(targetHandleId) : null;

        // 하위 호환성: 메타 핸들 → 셀 핸들 변환
        if (!sourceHandleInfo && sourceHandleId?.match(/^f[1-6]$/)) {
          const converted = convertMetaHandleToCellHandle(sourceHandleId, 1);
          sourceHandleId = converted;
          sourceHandleInfo = parseCellHandleId(converted);
        }

        if (!targetHandleInfo && targetHandleId?.match(/^f[1-6]$/)) {
          const converted = convertMetaHandleToCellHandle(targetHandleId, 1);
          targetHandleId = converted;
          targetHandleInfo = parseCellHandleId(converted);
        }

        // Legacy handle ID 변환 (outlet/inlet, cell-X-inlet/outlet)
        if (sourceNode.data.componentType === 'pipe' && !sourceHandleInfo) {
          if (sourceHandleId === 'outlet' || (sourceHandleId && /^cell-\d+-outlet$/.test(sourceHandleId))) {
            sourceHandleId = 'cell-1-face-2';
            sourceHandleInfo = parseCellHandleId(sourceHandleId);
          } else if (sourceHandleId === 'inlet' || (sourceHandleId && /^cell-\d+-inlet$/.test(sourceHandleId))) {
            sourceHandleId = 'cell-1-face-1';
            sourceHandleInfo = parseCellHandleId(sourceHandleId);
          } else if (sourceHandleId && /^\d{9}$/.test(sourceHandleId)) {
            // Convert cell handle ID (9 digits) to cell handle
            const metaHandle = convertCellHandleToMetaHandle(sourceHandleId);
            if (metaHandle) {
              sourceHandleId = convertMetaHandleToCellHandle(metaHandle, 1);
              sourceHandleInfo = parseCellHandleId(sourceHandleId);
            }
          }
        }

        if (targetNode.data.componentType === 'pipe' && !targetHandleInfo) {
          if (targetHandleId === 'outlet' || (targetHandleId && /^cell-\d+-outlet$/.test(targetHandleId))) {
            targetHandleId = 'cell-1-face-2';
            targetHandleInfo = parseCellHandleId(targetHandleId);
          } else if (targetHandleId === 'inlet' || (targetHandleId && /^cell-\d+-inlet$/.test(targetHandleId))) {
            targetHandleId = 'cell-1-face-1';
            targetHandleInfo = parseCellHandleId(targetHandleId);
          } else if (targetHandleId && /^\d{9}$/.test(targetHandleId)) {
            // Convert cell handle ID (9 digits) to cell handle
            const metaHandle = convertCellHandleToMetaHandle(targetHandleId);
            if (metaHandle) {
              targetHandleId = convertMetaHandleToCellHandle(metaHandle, 1);
              targetHandleInfo = parseCellHandleId(targetHandleId);
            }
          }
        }

        // Update connection with converted handle IDs
        const updatedConnection = {
          ...connection,
          sourceHandle: sourceHandleId,
          targetHandle: targetHandleId,
        };

        // 연결 타입 판단
        const isSourcePipe = sourceNode.data.componentType === 'pipe';
        const isTargetPipe = targetNode.data.componentType === 'pipe';
        const isSourcePump = sourceNode.data.componentType === 'pump';
        const isTargetPump = targetNode.data.componentType === 'pump';
        const isSourceHeatStructure = sourceNode.data.componentType === 'htstr';
        const isTargetHeatStructure = targetNode.data.componentType === 'htstr';
        const isSourceJunction = ['sngljun', 'tmdpjun', 'mtpljun', 'valve'].includes(sourceNode.data.componentType);
        const isTargetJunction = ['sngljun', 'tmdpjun', 'mtpljun', 'valve'].includes(targetNode.data.componentType);
        const isSourceVolume = ['snglvol', 'tmdpvol', 'branch', 'turbine', 'tank', 'separatr'].includes(sourceNode.data.componentType);
        const isTargetVolume = ['snglvol', 'tmdpvol', 'branch', 'turbine', 'tank', 'separatr'].includes(targetNode.data.componentType);
        const isCrossflow =
          sourceHandleInfo && targetHandleInfo &&
          (sourceHandleInfo.face >= 3 || targetHandleInfo.face >= 3);

        // PUMP 연결 처리 (Legacy connection logic보다 먼저 처리)
        if (isSourcePump || isTargetPump) {
          const pumpNode = isSourcePump ? sourceNode : targetNode;
          const volumeNode = isSourcePump ? targetNode : sourceNode;
          const isPumpSource = isSourcePump;

          // PUMP handle 확인
          const pumpHandleId = isPumpSource ? sourceHandleId : targetHandleId;
          const isPumpOutlet = isPumpSource && pumpHandleId === 'outlet';
          const isPumpInlet = !isPumpSource && pumpHandleId === 'inlet';

          debugConnection('PUMP connection:', { pumpNode: pumpNode.id, volumeNode: volumeNode.id, isPumpOutlet, isPumpInlet });

          if (isPumpOutlet || isPumpInlet) {
            // volumeNode의 실제 핸들 정보 추출
            const volumeHandleInfo = isPumpSource ? targetHandleInfo : sourceHandleInfo;
            const volumeNum = volumeHandleInfo?.cellNum || 1;
            const volumeFace = volumeHandleInfo?.face || (isPumpOutlet ? 1 : 2);

            debugConnection('PUMP volume handle:', { volumeNum, volumeFace, isPumpOutlet, isPumpInlet });

            // Create edge data
            const fromVolume: VolumeReference = isPumpOutlet
              ? { nodeId: pumpNode.id, volumeNum: 1, face: 2 } // pump outlet
              : { nodeId: volumeNode.id, volumeNum: volumeNum, face: volumeFace }; // volume outlet

            const toVolume: VolumeReference = isPumpOutlet
              ? { nodeId: volumeNode.id, volumeNum: volumeNum, face: volumeFace } // volume inlet
              : { nodeId: pumpNode.id, volumeNum: 1, face: 1 }; // pump inlet

            const edgeData: MARSEdgeData = {
              connectionType: 'axial',
              fromVolume,
              toVolume,
              junctionId: pumpNode.data.componentId,
            };

            const newEdge = { ...updatedConnection, data: edgeData };
            set({ edges: addEdge(newEdge, edges), isDirty: true });
            applyConnectionUpdates(newEdge);
            return; // Exit early
          }
        }

        // ============ HEAT STRUCTURE 연결 처리 ============
        if (isSourceHeatStructure || isTargetHeatStructure) {
          const hsNode = isSourceHeatStructure ? sourceNode : targetNode;
          const volumeNode = isSourceHeatStructure ? targetNode : sourceNode;

          // Heat Structure handle 확인 (left-boundary 또는 right-boundary)
          const hsHandleId = isSourceHeatStructure ? sourceHandleId : targetHandleId;
          const isLeftBoundary = hsHandleId === 'left-boundary';
          const isRightBoundary = hsHandleId === 'right-boundary';

          // Volume 노드인지 확인 (snglvol, tmdpvol, pipe, branch)
          const volumeComponentType = volumeNode.data.componentType;
          const isVolumeComponent = ['snglvol', 'tmdpvol', 'pipe', 'branch', 'turbine', 'tank'].includes(volumeComponentType);

          debugConnection('HTSTR connection:', { hsNode: hsNode.id, volumeNode: volumeNode.id, side: isLeftBoundary ? 'left' : 'right' });

          if ((isLeftBoundary || isRightBoundary) && isVolumeComponent) {
            // Volume 노드에서 핸들 정보 추출
            const volumeHandleInfo = isSourceHeatStructure ? targetHandleInfo : sourceHandleInfo;
            const volumeNum = volumeHandleInfo?.cellNum || 1;
            // Heat Structure BC는 축방향만 사용 (SMART 분석 결과)
            const volumeFace = volumeHandleInfo?.face || (isLeftBoundary ? 2 : 1);

            // VolumeReference 생성
            const volumeRef: VolumeReference = {
              nodeId: volumeNode.id,
              volumeNum: volumeNum,
              face: volumeFace,
            };

            debugConnection('HTSTR volume ref:', volumeRef);

            // Edge 데이터 생성
            const edgeData: MARSEdgeData = {
              connectionType: 'axial',
              fromVolume: isSourceHeatStructure
                ? { nodeId: hsNode.id, volumeNum: 1, face: isLeftBoundary ? 1 : 2 }
                : volumeRef,
              toVolume: isSourceHeatStructure
                ? volumeRef
                : { nodeId: hsNode.id, volumeNum: 1, face: isLeftBoundary ? 1 : 2 },
              heatStructureNodeId: hsNode.id,
              heatStructureSide: isLeftBoundary ? 'left' : 'right',
            };

            const newEdge = { ...updatedConnection, data: edgeData };
            set({ edges: addEdge(newEdge, edges), isDirty: true });
            applyConnectionUpdates(newEdge);
            return; // Exit early
          }
        }

        // Crossflow 연결: 마법사 표시 (향후 구현)
        // 하지만 일단 엣지는 생성하여 표시
        if (isCrossflow && isSourcePipe && isTargetPipe) {
          if (sourceHandleId && targetHandleId && connection.source && connection.target) {
            const sourceFace = sourceHandleInfo?.face || 3;
            const targetFace = targetHandleInfo?.face || 3;

            const fromVolume: VolumeReference = {
              nodeId: sourceNode.id,
              volumeNum: sourceHandleInfo?.cellNum || 1,
              face: sourceFace,
            };

            const toVolume: VolumeReference = {
              nodeId: targetNode.id,
              volumeNum: targetHandleInfo?.cellNum || 1,
              face: targetFace,
            };

            // Connection type 결정: face 값에 따라 crossflow 또는 axial
            const connectionType = determineConnectionType(sourceFace, targetFace);
            const edgeStyle = getEdgeStyle(connectionType);
            const edgeLabel = getEdgeLabel(connectionType, fromVolume.volumeNum, fromVolume.face);

            // Convert edgeStyleHelpers ConnectionType to mars.ts ConnectionType
            // 'legacy'는 axial로 변환 (MARS 공식 타입: axial, crossflow만 사용)
            const marsConnectionType: ConnectionType =
              connectionType === 'legacy' ? 'axial' : connectionType;

            // MARSEdgeData용 연결 타입 (MARS 공식 타입만 사용)
            const edgeConnectionType: 'axial' | 'crossflow' =
              connectionType === 'legacy' ? 'axial' : connectionType;

            const edgeData: MARSEdgeData = {
              connectionType: edgeConnectionType,
              fromVolume,
              toVolume,
              connectionConfig: {
                type: marsConnectionType,
                sourceNodeId: connection.source!,
                targetNodeId: connection.target!,
                sourceCell: fromVolume.volumeNum,
                sourceFace: fromVolume.face as FaceType,
                targetCell: toVolume.volumeNum,
                targetFace: toVolume.face as FaceType,
              },
            };

            const newEdge = {
              ...updatedConnection,
              data: edgeData,
              label: edgeLabel,
              style: edgeStyle,
            };
            set({
              edges: addEdge(newEdge, edges),
              isDirty: true,
              pendingConnection: {
                sourceNodeId: connection.source,
                targetNodeId: connection.target,
                sourceHandleId,
                targetHandleId,
              },
            });
          }
          return; // 마법사는 나중에 표시
        }

        // Axial 연결: 즉시 생성 (PIPE 또는 Volume-Junction 연결)
        if (isSourcePipe || isTargetPipe || isSourceJunction || isTargetJunction || isSourceVolume || isTargetVolume) {
          const sourceFace = sourceHandleInfo?.face || 2;
          const targetFace = targetHandleInfo?.face || 1;

          const fromVolume: VolumeReference = {
            nodeId: sourceNode.id,
            volumeNum: sourceHandleInfo?.cellNum || 1,
            face: sourceFace,
          };

          const toVolume: VolumeReference = {
            nodeId: targetNode.id,
            volumeNum: targetHandleInfo?.cellNum || 1,
            face: targetFace,
          };

          // Connection type 결정: face 값에 따라 axial 또는 crossflow
          const connectionType = determineConnectionType(sourceFace, targetFace);
          const edgeStyle = getEdgeStyle(connectionType);
          const edgeLabel = getEdgeLabel(connectionType, fromVolume.volumeNum, fromVolume.face);

          // Convert edgeStyleHelpers ConnectionType to mars.ts ConnectionType
          // 'legacy'는 axial로 변환 (MARS 공식 타입: axial, crossflow만 사용)
          const marsConnectionType: ConnectionType =
            connectionType === 'legacy' ? 'axial' : connectionType;

          // MARSEdgeData용 연결 타입 (MARS 공식 타입만 사용)
          const edgeConnectionType: 'axial' | 'crossflow' =
            connectionType === 'legacy' ? 'axial' : connectionType;

          const edgeData: MARSEdgeData = {
            connectionType: edgeConnectionType,
            fromVolume,
            toVolume,
            connectionConfig: {
              type: marsConnectionType,
              sourceNodeId: connection.source!,
              targetNodeId: connection.target!,
              sourceCell: fromVolume.volumeNum,
              sourceFace: fromVolume.face as FaceType,
              targetCell: toVolume.volumeNum,
              targetFace: toVolume.face as FaceType,
            },
          };

          const newEdge = {
            ...updatedConnection,
            data: edgeData,
            label: edgeLabel,
            style: edgeStyle,
          };
          set({ edges: addEdge(newEdge, edges), isDirty: true });
          applyConnectionUpdates(newEdge);
          return; // Edge created, exit
        }

        // 기존 메타 핸들 처리 (하위 호환성)
        const isMetaHandle = (handleId: string | null | undefined) => {
          return handleId ? /^f[1-6]$/.test(handleId) : false;
        };

        const sourceIsMetaHandle = isMetaHandle(sourceHandleId);
        const targetIsMetaHandle = isMetaHandle(targetHandleId);

        // If PIPE node uses meta-handle, handle it
        if (sourceNode.data.componentType === 'pipe' && sourceIsMetaHandle) {
          const faceNum = sourceHandleId ? parseInt(sourceHandleId.replace('f', '')) : 0;

          // Side connections (f3~f6) between PIPE nodes
          if (faceNum >= 3 && faceNum <= 6 && targetNode.data.componentType === 'pipe' && targetIsMetaHandle) {
            // Set pending connection to open dialog
            if (sourceHandleId && targetHandleId && connection.source && connection.target) {
              set({
                pendingSideConnection: {
                  sourceNodeId: connection.source,
                  targetNodeId: connection.target,
                  sourceHandleId,
                  targetHandleId,
                },
              });
            }
            return; // Don't create edge yet, wait for dialog confirmation
          }

          // Axial connections (f1/f2) - create edge immediately
          if (faceNum === 1 || faceNum === 2) {
            // Create VolumeReference objects for meta-handle connections
            let fromVolume: VolumeReference;
            let toVolume: VolumeReference;
            let junctionId = '';

            if (sourceIsMetaHandle && targetIsMetaHandle) {
              // PIPE meta-handle to PIPE meta-handle (axial)
              // Source PIPE outlet (f2) -> Target PIPE inlet (f1)
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // First cell outlet
              toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 }; // First cell inlet
            } else if (sourceIsMetaHandle) {
              // PIPE meta-handle -> Junction/Volume
              const sourceFace = sourceHandleId ? parseInt(sourceHandleId.replace('f', '')) : 2;
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: sourceFace }; // outlet

              const targetIsJunction = targetNode.data.componentType === 'sngljun' || targetNode.data.componentType === 'tmdpjun';
              if (targetIsJunction) {
                junctionId = targetNode.data.componentId;
                toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 }; // junction inlet
              } else {
                // Target is volume (SNGLVOL, TMDPVOL, BRANCH)
                toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 }; // volume inlet
              }
            } else if (targetIsMetaHandle) {
              // PIPE (non-meta-handle) -> PIPE meta-handle
              // In this block, source is always PIPE (due to line 793 condition)
              const targetFace = targetHandleId ? parseInt(targetHandleId.replace('f', '')) : 1;
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // pipe outlet
              toVolume = { nodeId: targetNode.id, volumeNum: 1, face: targetFace }; // pipe inlet
            } else {
              // Fallback: both are non-meta-handles (shouldn't happen in this branch)
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 };
              toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 };
            }

            // Create edge with volume reference data
            const edgeData: MARSEdgeData = {
              connectionType: 'axial',
              fromVolume,
              toVolume,
              junctionId: junctionId || undefined,
            };

            const newEdge = {
              ...updatedConnection,
              data: edgeData,
            };

            set({
              edges: addEdge(newEdge, edges),
              isDirty: true,
            });
            applyConnectionUpdates(newEdge);
            return; // Edge created, exit
          }
        }

        // Handle target PIPE meta-handle (when source is not PIPE)
        if (targetNode.data.componentType === 'pipe' && targetIsMetaHandle) {
          const faceNum = targetHandleId ? parseInt(targetHandleId.replace('f', '')) : 0;

          if (faceNum === 1 || faceNum === 2) {
            // Axial connection to PIPE
            let fromVolume: VolumeReference;
            let toVolume: VolumeReference;
            let junctionId = '';

            toVolume = { nodeId: targetNode.id, volumeNum: 1, face: faceNum }; // PIPE inlet/outlet

            const sourceIsJunction = sourceNode.data.componentType === 'sngljun' || sourceNode.data.componentType === 'tmdpjun';
            if (sourceIsJunction) {
              junctionId = sourceNode.data.componentId;
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // junction outlet
            } else {
              // Source is volume (SNGLVOL, TMDPVOL, BRANCH)
              fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // volume outlet
            }

            const edgeData: MARSEdgeData = {
              connectionType: 'axial',
              fromVolume,
              toVolume,
              junctionId: junctionId || undefined,
            };

            const newEdge = {
              ...updatedConnection,
              data: edgeData,
            };

            set({
              edges: addEdge(newEdge, edges),
              isDirty: true,
            });
            applyConnectionUpdates(newEdge);

            return; // Edge created, exit
          }
        }

        // Legacy connection logic for non-PIPE components (Volume <-> Junction)
        // Validation: Volume -> Junction -> Volume
        const junctionTypes = ['sngljun', 'tmdpjun', 'mtpljun', 'pump'];
        const sourceIsVolume = !junctionTypes.includes(sourceNode.data.componentType);
        const targetIsVolume = !junctionTypes.includes(targetNode.data.componentType);

        // Don't allow Volume -> Volume or Junction -> Junction
        if (sourceIsVolume === targetIsVolume) {
          console.warn('Invalid connection: Must connect Volume <-> Junction');
          return;
        }

        // Create VolumeReference objects for the connection
        let fromVolume: VolumeReference;
        let toVolume: VolumeReference;
        let junctionId = '';

        // Determine which is volume and which is junction
        if (sourceIsVolume) {
          // Volume -> Junction
          fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // outlet of source volume
          toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 }; // inlet of junction
          junctionId = targetNode.data.componentId;
        } else {
          // Junction -> Volume
          fromVolume = { nodeId: sourceNode.id, volumeNum: 1, face: 2 }; // outlet of junction
          toVolume = { nodeId: targetNode.id, volumeNum: 1, face: 1 }; // inlet of target volume
          junctionId = sourceNode.data.componentId;
        }

        // Create edge with volume reference data
        const edgeData: MARSEdgeData = {
          connectionType: 'axial',
          fromVolume,
          toVolume,
          junctionId,
        };

        debugStore('Creating edge:', edgeData);

        const newEdge = {
          ...updatedConnection,
          data: edgeData,
        };

        set({
          edges: addEdge(newEdge, edges),
          isDirty: true,
        });
        applyConnectionUpdates(newEdge);
      },

      // Node operations
      addNode: (node) => {
        // CRITICAL: Always get fresh state to prevent stale closure issues
        const currentNodes = get().nodes;

        // Check for duplicate node ID
        if (currentNodes.some(n => n.id === node.id)) {
          console.error('[Store] Attempted to add duplicate node:', node.id);
          return;
        }

        // Check for duplicate component ID (within same MARS namespace)
        // 열구조체(1CCCGXNN)와 수력 컴포넌트(CCCXXNN)는 독립된 번호 네임스페이스
        const isNewHtstr = node.data.componentType === 'htstr';
        if (currentNodes.some(n => n.data.componentId === node.data.componentId && (n.data.componentType === 'htstr') === isNewHtstr)) {
          console.error('[Store] Attempted to add node with duplicate componentId:', node.data.componentId);
          return;
        }

        debugStore('addNode:', node.id, node.type);
        set({
          nodes: [...currentNodes, node],
          isDirty: true,
        });
      },

      updateNodeData: (nodeId, data) => {
        const currentState = get();
        const currentNodes = currentState.nodes;

        // If updating componentId, validate and cascade update all references
        if (data.componentId) {
          const targetNode = currentNodes.find(n => n.id === nodeId);
          if (!targetNode) {
            console.error('[Store] Target node not found:', nodeId);
            return;
          }

          const oldComponentId = targetNode.data.componentId;
          const newComponentId = data.componentId;

          // If componentId changed, validate uniqueness
          if (oldComponentId !== newComponentId) {
            debugStore('ComponentId change:', oldComponentId, '→', newComponentId);

            // Check against other nodes' component IDs (within same MARS namespace)
            // 열구조체(1CCCGXNN)와 수력 컴포넌트(CCCXXNN)는 독립된 번호 네임스페이스
            const isUpdatingHtstr = targetNode.data.componentType === 'htstr';
            const componentIdConflict = currentNodes.some(
              n => n.id !== nodeId && n.data.componentId === newComponentId && (n.data.componentType === 'htstr') === isUpdatingHtstr
            );

            if (componentIdConflict) {
              console.error('[Store] Cannot update componentId: conflicts with existing component ID', newComponentId);
              return;
            }
          }
        }

        // Regular update: Always update node data (whether componentId changed or not)
        const updatedNodes = currentNodes.map(node =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        );

        // ===== Form → Edge sync: Use connectionSync to reconcile edges from parameters =====
        const targetNode = updatedNodes.find(n => n.id === nodeId);
        let updatedEdges = currentState.edges;

        if (targetNode && data.parameters && isEdgeOwner(targetNode.data.componentType)) {
          const { toAdd, toRemove } = syncEdgesFromParameters(targetNode, updatedNodes, updatedEdges);
          if (toRemove.length > 0 || toAdd.length > 0) {
            updatedEdges = updatedEdges.filter(e => !toRemove.includes(e.id)).concat(toAdd);
            debugStore('Form→Edge Sync:', nodeId, 'added:', toAdd.length, 'removed:', toRemove.length);
          }
        }

        set({
          nodes: updatedNodes,
          edges: updatedEdges,
          isDirty: true,
        });
      },

      updateNodeAppearance: (nodeId, appearanceUpdate) => {
        const currentNodes = get().nodes;
        const targetNode = currentNodes.find(n => n.id === nodeId);
        if (!targetNode) return;

        const currentAppearance = resolveAppearance(
          targetNode.data.appearance,
          targetNode.data.componentType,
        );
        const newAppearance = { ...currentAppearance, ...appearanceUpdate };

        // Sync ReactFlow node style with display dimensions (for NodeResizer)
        const isSwapped = newAppearance.rotation === 90 || newAppearance.rotation === 270;
        const displayWidth = isSwapped ? newAppearance.height : newAppearance.width;
        const displayHeight = isSwapped ? newAppearance.width : newAppearance.height;

        const updatedNodes = currentNodes.map(n =>
          n.id === nodeId
            ? {
                ...n,
                data: { ...n.data, appearance: newAppearance },
                style: { ...n.style, width: displayWidth, height: displayHeight },
              }
            : n
        );

        set({ nodes: updatedNodes, isDirty: true });
      },

      deleteNode: (nodeId) => {
        const { nodes, edges } = get();

        // Clean up orphan VolumeReferences in other nodes
        const orphanCleanups = cleanupOrphanedRefs(nodeId, nodes);
        let updatedNodes = nodes;
        if (orphanCleanups.size > 0) {
          updatedNodes = nodes.map(n => {
            const updates = orphanCleanups.get(n.id);
            if (!updates) return n;
            return { ...n, data: { ...n.data, parameters: { ...n.data.parameters, ...updates } } };
          });
          debugStore('Cleaned orphan refs for deleted node:', nodeId, 'affected:', [...orphanCleanups.keys()]);
        }

        set({
          nodes: updatedNodes.filter(n => n.id !== nodeId),
          edges: edges.filter(e => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
          isDirty: true,
        });
      },

      setNodeZIndex: (nodeId, zIndex) => {
        const nodes = get().nodes.map(n =>
          n.id === nodeId ? { ...n, zIndex } : n
        );
        const edges = get().edges.map(e =>
          e.source === nodeId || e.target === nodeId ? { ...e, zIndex } : e
        );
        set({ nodes, edges, isDirty: true });
      },

      /**
       * Heat Structure BC 변경 시 연결된 엣지 삭제 (Phase 1.5.1)
       * @param nodeId Heat Structure 노드 ID
       * @param side 'left' | 'right' 경계 방향
       */
      deleteHeatStructureEdge: (nodeId, side) => {
        const currentEdges = get().edges;
        const edgesToDelete = currentEdges.filter(
          (e) => e.data?.heatStructureNodeId === nodeId &&
                 e.data?.heatStructureSide === side
        );

        if (edgesToDelete.length > 0) {
          set({
            edges: currentEdges.filter((e) => !edgesToDelete.includes(e)),
            isDirty: true,
          });
          debugConnection('deleteHeatStructureEdge:', nodeId, side, edgesToDelete.length);
        }
      },

      /**
       * Heat Structure BC 수동 추가 시 엣지 생성 (Phase 1.5.1)
       * @param nodeId Heat Structure 노드 ID
       * @param side 'left' | 'right' 경계 방향
       * @param volumeRef 연결할 볼륨 참조
       */
      createHeatStructureEdge: (nodeId, side, volumeRef) => {
        const { nodes, edges } = get();

        // 이미 해당 side에 연결된 엣지가 있는지 확인
        const existingEdge = edges.find(
          (e) => e.data?.heatStructureNodeId === nodeId &&
                 e.data?.heatStructureSide === side
        );

        if (existingEdge) {
          debugConnection('createHeatStructureEdge: already exists', nodeId, side);
          return;
        }

        // Heat Structure 노드 찾기
        const hsNode = nodes.find((n) => n.id === nodeId);
        if (!hsNode) {
          console.error(`[createHeatStructureEdge] Heat Structure node not found: ${nodeId}`);
          return;
        }

        // Volume 노드 찾기
        const volumeNode = nodes.find((n) => n.id === volumeRef.nodeId);
        if (!volumeNode) {
          console.error(`[createHeatStructureEdge] Volume node not found: ${volumeRef.nodeId}`);
          return;
        }

        // 핸들 ID 결정
        const hsHandleId = side === 'left' ? 'left-boundary' : 'right-boundary';
        const volumeHandleId = `cell-${volumeRef.volumeNum}-face-${volumeRef.face}`;

        // Edge ID 생성
        const edgeId = `e-${volumeNode.id}-${hsNode.id}-${side}`;

        // Edge 데이터 생성
        const edgeData: MARSEdgeData = {
          connectionType: 'axial',
          fromVolume: volumeRef,
          toVolume: { nodeId: hsNode.id, volumeNum: 1, face: side === 'left' ? 1 : 2 },
          heatStructureNodeId: hsNode.id,
          heatStructureSide: side,
        };

        // 새 엣지 생성 (Volume → Heat Structure 방향)
        const newEdge: Edge<MARSEdgeData> = {
          id: edgeId,
          source: volumeNode.id,
          target: hsNode.id,
          sourceHandle: volumeHandleId,
          targetHandle: hsHandleId,
          data: edgeData,
          type: 'smoothstep',
          animated: false,
        };

        set({
          edges: [...edges, newEdge],
          isDirty: true,
        });

        debugConnection('createHeatStructureEdge:', nodeId, side, edgeId);
      },

      setSelectedNodeId: (nodeId) => {
        set({ selectedNodeId: nodeId, selectedEdgeId: null }); // 노드 선택 시 엣지 선택 해제
      },

      setSelectedEdgeId: (edgeId) => {
        set({ selectedEdgeId: edgeId, selectedNodeId: null }); // 엣지 선택 시 노드 선택 해제
      },

      setPendingSideConnection: (connection) => {
        set({ pendingSideConnection: connection });
      },

      // Project management
      updateMetadata: (metadata) => {
        set({
          metadata: {
            ...get().metadata,
            ...metadata,
            modified: new Date().toISOString(),
          },
          isDirty: true,
        });
      },

      loadProject: (project) => {
        // 시뮬레이션/분석 상태 전체 초기화 (프로젝트 전환 시 이전 데이터 잔존 방지)
        useSimulationStore.getState().resetAll();
        useAnalysisStore.getState().resetAll();

        // Migrate legacy cmp_ node IDs to node_ format
        const migration = migrateProjectNodeIds(
          project.nodes,
          project.edges,
          project.metadata?.globalSettings,
        );
        const loadNodes = migration.nodes;
        const loadEdges = migration.edges;
        const loadMetadata = migration.migrated
          ? { ...project.metadata, globalSettings: migration.globalSettings ?? project.metadata?.globalSettings }
          : project.metadata;
        if (migration.migrated) {
          debugStore('Legacy cmp_ node IDs migrated to node_ format');
        }

        // Restore edge handle IDs from volume IDs if needed
        // Convert meta-handles (f1-f6) to cell handles (cell-X-face-Y) for new system
        const restoredEdges = loadEdges.map(edge => {
          const sourceNode = loadNodes.find(n => n.id === edge.source);
          const targetNode = loadNodes.find(n => n.id === edge.target);

          let sourceHandle = edge.sourceHandle;
          let targetHandle = edge.targetHandle;

          // 메타 핸들 → 셀 핸들 변환
          if (sourceHandle?.match(/^f[1-6]$/)) {
            sourceHandle = convertMetaHandleToCellHandle(sourceHandle, 1);
          }

          if (targetHandle?.match(/^f[1-6]$/)) {
            targetHandle = convertMetaHandleToCellHandle(targetHandle, 1);
          }

          // 기존 Volume ID 기반 핸들 복원
          const edgeData = edge.data as MARSEdgeData;
          if (!sourceHandle && edgeData?.volumeIdFrom) {
            const cellInfo = parseVolumeId(edgeData.volumeIdFrom);
            if (cellInfo) {
              sourceHandle = generateCellHandleId(cellInfo.volumeNum, cellInfo.face);
            }
          }

          if (!targetHandle && edgeData?.volumeIdTo) {
            const cellInfo = parseVolumeId(edgeData.volumeIdTo);
            if (cellInfo) {
              targetHandle = generateCellHandleId(cellInfo.volumeNum, cellInfo.face);
            }
          }

          // Face 0 (Old Format) 강제 정규화:
          // 기존 저장된 핸들('outlet', 'inlet', 'cell-0-face-0' 등)이 잘못되었을 수 있으므로
          // fromVolume/toVolume에 face=0이 있으면 무조건 'auto-connect'로 교체
          if (edgeData?.fromVolume?.face === 0 && sourceNode) {
            sourceHandle = 'auto-connect';
          }
          if (edgeData?.toVolume?.face === 0 && targetNode) {
            targetHandle = 'auto-connect';
          }

          // fromVolume/toVolume 기반 핸들 복원 (Face 1-6)
          if (!sourceHandle && edgeData?.fromVolume && sourceNode) {
            sourceHandle = resolveVolumeRefToHandle(
              edgeData.fromVolume.face, edgeData.fromVolume.volumeNum, sourceNode.data.componentType
            );
          }

          if (!targetHandle && edgeData?.toVolume && targetNode) {
            targetHandle = resolveVolumeRefToHandle(
              edgeData.toVolume.face, edgeData.toVolume.volumeNum, targetNode.data.componentType
            );
          }

          // Legacy: Convert old cell handles (9 digits) to cell handles
          if (sourceHandle && sourceNode?.data.componentType === 'pipe') {
            if (/^\d{9}$/.test(sourceHandle)) {
              const cellInfo = parseVolumeId(sourceHandle);
              if (cellInfo) {
                sourceHandle = generateCellHandleId(cellInfo.volumeNum, cellInfo.face);
              }
            }
          }

          if (targetHandle && targetNode?.data.componentType === 'pipe') {
            if (/^\d{9}$/.test(targetHandle)) {
              const cellInfo = parseVolumeId(targetHandle);
              if (cellInfo) {
                targetHandle = generateCellHandleId(cellInfo.volumeNum, cellInfo.face);
              }
            }
          }

          // 엣지 시각 속성 복원 (type, style, label, animated)
          const fromFace = edgeData?.fromVolume?.face ?? 0;
          const toFace = edgeData?.toVolume?.face ?? 0;
          const connType = determineConnectionType(fromFace, toFace);
          const edgeVisualStyle = edge.style || getEdgeStyle(connType);
          const edgeLabel = edge.label || getEdgeLabel(connType, edgeData?.fromVolume?.volumeNum ?? 0, fromFace);

          // If edge already has handle IDs (after conversion), keep them
          if (sourceHandle && targetHandle) {
            return {
              ...edge,
              sourceHandle,
              targetHandle,
              type: edge.type || 'smoothstep',
              animated: false,
              style: edgeVisualStyle,
              label: edgeLabel,
            };
          }

          // Otherwise, try to restore from volume IDs in edge data (legacy fallback)
          if (!edgeData) {
            return {
              ...edge,
              sourceHandle: sourceHandle || edge.sourceHandle,
              targetHandle: targetHandle || edge.targetHandle,
              type: edge.type || 'smoothstep',
              animated: false,
            };
          }

          // Restore handles from volume IDs
          // volumeIdFrom: source volume's outlet (source handle)
          // volumeIdTo: target volume's inlet (target handle)

          if (sourceNode && edgeData.volumeIdFrom) {
            // volumeIdFrom points to the source volume's outlet
            const handleInfo = getHandleIdForVolume(sourceNode, edgeData.volumeIdFrom);
            if (handleInfo) {
              sourceHandle = handleInfo.handleId;
            } else {
              // If sourceNode is a junction (SNGLJUN/TMDPJUN), use default handles
              if (sourceNode.data.componentType === 'sngljun' || sourceNode.data.componentType === 'tmdpjun') {
                // Junction outlet connects to volume inlet
                sourceHandle = 'outlet';
              }
            }
          }

          if (targetNode && edgeData.volumeIdTo) {
            // volumeIdTo points to the target volume's inlet
            const handleInfo = getHandleIdForVolume(targetNode, edgeData.volumeIdTo);
            if (handleInfo) {
              targetHandle = handleInfo.handleId;
            } else {
              // If targetNode is a junction (SNGLJUN/TMDPJUN), use default handles
              if (targetNode.data.componentType === 'sngljun' || targetNode.data.componentType === 'tmdpjun') {
                // Volume outlet connects to junction inlet
                targetHandle = 'inlet';
              }
            }
          }

          // Fallback: if volume IDs don't exist but we have junction connections, infer from node types
          if (!sourceHandle && sourceNode && edgeData) {
            if (sourceNode.data.componentType === 'sngljun' || sourceNode.data.componentType === 'tmdpjun') {
              sourceHandle = 'outlet';
            } else if (sourceNode.data.componentType === 'pipe') {
              // For PIPE, try to infer from volumeIdFrom if available
              if (edgeData.volumeIdFrom) {
                const handleInfo = getHandleIdForVolume(sourceNode, edgeData.volumeIdFrom);
                if (handleInfo) {
                  // Convert to cell handle if needed
                  const parsed = parseCellHandleId(handleInfo.handleId);
                  if (parsed) {
                    sourceHandle = handleInfo.handleId;
                  } else if (handleInfo.handleId.match(/^f[1-6]$/)) {
                    sourceHandle = convertMetaHandleToCellHandle(handleInfo.handleId, 1);
                  } else {
                    sourceHandle = handleInfo.handleId;
                  }
                } else {
                  // Default to cell-1-face-2 (outlet) for PIPE
                  sourceHandle = 'cell-1-face-2';
                }
              } else {
                // Default to cell-1-face-2 (outlet) for PIPE
                sourceHandle = 'cell-1-face-2';
              }
            }
          }

          if (!targetHandle && targetNode && edgeData) {
            if (targetNode.data.componentType === 'sngljun' || targetNode.data.componentType === 'tmdpjun') {
              targetHandle = 'inlet';
            } else if (targetNode.data.componentType === 'pipe') {
              // For PIPE, try to infer from volumeIdTo if available
              if (edgeData.volumeIdTo) {
                const handleInfo = getHandleIdForVolume(targetNode, edgeData.volumeIdTo);
                if (handleInfo) {
                  // Convert to cell handle if needed
                  const parsed = parseCellHandleId(handleInfo.handleId);
                  if (parsed) {
                    targetHandle = handleInfo.handleId;
                  } else if (handleInfo.handleId.match(/^f[1-6]$/)) {
                    targetHandle = convertMetaHandleToCellHandle(handleInfo.handleId, 1);
                  } else {
                    targetHandle = handleInfo.handleId;
                  }
                } else {
                  // Default to cell-1-face-1 (inlet) for PIPE
                  targetHandle = 'cell-1-face-1';
                }
              } else {
                // Default to cell-1-face-1 (inlet) for PIPE
                targetHandle = 'cell-1-face-1';
              }
            }
          }

          return {
            ...edge,
            sourceHandle: sourceHandle || edge.sourceHandle,
            targetHandle: targetHandle || edge.targetHandle,
            type: edge.type || 'smoothstep',
            animated: false,
            style: edgeVisualStyle,
            label: edgeLabel,
          };
        });

        // Edge recovery: junction 데이터는 있지만 edge가 누락된 노드에 대해 자동 보충
        let finalEdges = restoredEdges;
        for (const node of loadNodes) {
          if (isEdgeOwner(node.data.componentType)) {
            const { toAdd } = syncEdgesFromParameters(node, loadNodes, finalEdges);
            if (toAdd.length > 0) {
              finalEdges = [...finalEdges, ...toAdd] as typeof finalEdges;
              debugStore('Edge recovery on load:', node.data.componentType, node.id, 'added:', toAdd.length);
            }
          }
        }

        set({
          nodes: loadNodes,
          edges: finalEdges,
          metadata: loadMetadata,
          selectedNodeId: null,
          selectedEdgeId: null,
          pendingSideConnection: null,
          pendingConnection: null,
          crossflowDialogOpen: false,
          crossflowDialogSourceNode: null,
          crossflowDialogInitialValues: null,
          crossflowDialogOnApply: null,
          propertyFormState: { isDirty: false, isValid: true },
          formSubmitHandler: null,
          fullCodeViewOpen: false,
          isDirty: false,
          svgLibrary: project.svgLibrary ?? [],
          defaultSvgByType: project.defaultSvgByType ?? {},
        });
      },

      swapModelNodes: (nodes, edges, settings) => {
        set((state) => ({
          nodes,
          edges,
          metadata: settings ? { ...state.metadata, ...settings } : state.metadata,
          selectedNodeId: null,
          selectedEdgeId: null,
        }));
      },

      resetProject: () => {
        set({
          nodes: [],
          edges: [],
          metadata: {
            ...defaultMetadata,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
          },
          svgLibrary: [],
          defaultSvgByType: {},
          selectedNodeId: null,
          selectedEdgeId: null,
          pendingSideConnection: null,
          pendingConnection: null,
          crossflowDialogOpen: false,
          crossflowDialogSourceNode: null,
          crossflowDialogInitialValues: null,
          crossflowDialogOnApply: null,
          propertyFormState: { isDirty: false, isValid: true },
          formSubmitHandler: null,
          fullCodeViewOpen: false,
          isDirty: false,
        });
      },

      setIsDirty: (isDirty) => {
        set({ isDirty });
      },

      // Global settings management
      updateGlobalSettings: (settings) => {
        const currentMetadata = get().metadata;
        set({
          metadata: {
            ...currentMetadata,
            globalSettings: {
              ...currentMetadata.globalSettings,
              ...settings
            },
            modified: new Date().toISOString()
          },
          isDirty: true
        });
      },

      updateRestartSettings: (settings) => {
        const currentMetadata = get().metadata;
        set({
          metadata: {
            ...currentMetadata,
            // diff 전체를 교체 (Dialog에서 매번 diff를 새로 계산하므로 merge 대신 replace)
            restartSettings: settings as GlobalSettings,
            modified: new Date().toISOString()
          },
          isDirty: true
        });
      },

      getGlobalSettings: () => {
        return get().metadata.globalSettings;
      },

      // Thermal Property actions (Phase 3)
      addThermalProperty: (property: ThermalProperty) => {
        const state = get();
        const currentSettings = state.metadata.globalSettings || getDefaultGlobalSettings();
        const currentProperties = currentSettings.thermalProperties || [];

        // Check for duplicate material number
        if (currentProperties.some(p => p.materialNumber === property.materialNumber)) {
          console.warn(`[Store] Thermal property with material number ${property.materialNumber} already exists`);
          return;
        }

        const newProperties = [...currentProperties, property].sort((a, b) => a.materialNumber - b.materialNumber);

        set({
          metadata: {
            ...state.metadata,
            globalSettings: {
              ...currentSettings,
              thermalProperties: newProperties,
            },
          },
          isDirty: true,
        });
      },

      updateThermalProperty: (materialNumber: number, updates: Partial<ThermalProperty>) => {
        const state = get();
        const currentSettings = state.metadata.globalSettings || getDefaultGlobalSettings();
        const currentProperties = currentSettings.thermalProperties || [];

        const index = currentProperties.findIndex(p => p.materialNumber === materialNumber);
        if (index === -1) {
          console.warn(`[Store] Thermal property with material number ${materialNumber} not found`);
          return;
        }

        const newProperties = [...currentProperties];
        newProperties[index] = { ...newProperties[index], ...updates };

        // If material number changed, re-sort
        if (updates.materialNumber !== undefined && updates.materialNumber !== materialNumber) {
          newProperties.sort((a, b) => a.materialNumber - b.materialNumber);
        }

        set({
          metadata: {
            ...state.metadata,
            globalSettings: {
              ...currentSettings,
              thermalProperties: newProperties,
            },
          },
          isDirty: true,
        });
      },

      deleteThermalProperty: (materialNumber: number) => {
        const state = get();
        const currentSettings = state.metadata.globalSettings || getDefaultGlobalSettings();
        const currentProperties = currentSettings.thermalProperties || [];

        const newProperties = currentProperties.filter(p => p.materialNumber !== materialNumber);

        set({
          metadata: {
            ...state.metadata,
            globalSettings: {
              ...currentSettings,
              thermalProperties: newProperties,
            },
          },
          isDirty: true,
        });
      },

      getThermalProperty: (materialNumber: number) => {
        const state = get();
        const currentSettings = state.metadata.globalSettings;
        const currentProperties = currentSettings?.thermalProperties || [];
        return currentProperties.find(p => p.materialNumber === materialNumber);
      },

      getThermalProperties: () => {
        const state = get();
        const currentSettings = state.metadata.globalSettings;
        return currentSettings?.thermalProperties || [];
      },

      normalizeThermalPropertyGas: (materialNumber: number) => {
        const state = get();
        const currentSettings = state.metadata.globalSettings || getDefaultGlobalSettings();
        const currentProperties = currentSettings.thermalProperties || [];

        const index = currentProperties.findIndex(p => p.materialNumber === materialNumber);
        if (index === -1) return;

        const property = currentProperties[index];
        if (!property.gapGasComposition || property.gapGasComposition.length === 0) return;

        const total = property.gapGasComposition.reduce((sum, g) => sum + g.moleFraction, 0);
        if (total === 0 || Math.abs(total - 1.0) < 0.001) return; // Already normalized or zero

        const normalizedGas = property.gapGasComposition.map(g => ({
          ...g,
          moleFraction: g.moleFraction / total,
        }));

        const newProperties = [...currentProperties];
        newProperties[index] = { ...property, gapGasComposition: normalizedGas };

        set({
          metadata: {
            ...state.metadata,
            globalSettings: {
              ...currentSettings,
              thermalProperties: newProperties,
            },
          },
          isDirty: true,
        });
      },

      // Component ID generation
      generateComponentId: (type) => {
        // CRITICAL: Always get fresh state to prevent stale closure issues
        const currentNodes = get().nodes;

        // MARS에서 열구조체(1CCCGXNN)와 수력 컴포넌트(CCCXXNN)는 독립된 번호 네임스페이스
        // 같은 카테고리 내에서만 중복 체크
        const isHtstr = type === 'htstr';
        const existingIds = currentNodes
          .filter(n => (n.data.componentType === 'htstr') === isHtstr)
          .map(n => parseInt(n.data.componentId))
          .filter(id => !isNaN(id));

        // Find next available ID in sequence
        let baseId = 100;

        // Different starting ranges for different types
        switch (type) {
          case 'snglvol':
          case 'tmdpvol':
            baseId = 100;
            break;
          case 'sngljun':
          case 'tmdpjun':
            baseId = 110;
            break;
          case 'pipe':
            baseId = 120;
            break;
          case 'branch':
            baseId = 140;
            break;
          case 'mtpljun':
            baseId = 150;
            break;
          case 'pump':
            baseId = 180;
            break;
          case 'htstr':
            baseId = 130;
            break;
          case 'turbine':
            baseId = 160;
            break;
          case 'tank':
            baseId = 170;
            break;
          case 'separatr':
            baseId = 190;
            break;
        }

        // Convert to full 7-digit ID for comparison
        let fullId = baseId * 10000; // 100 -> 1000000

        // Find next available (increment by 10)
        while (existingIds.includes(fullId)) {
          baseId += 10;
          fullId = baseId * 10000;

          // Safety check to prevent infinite loop
          if (baseId > 990) {
            console.error('[Store] Reached maximum ID range!');
            throw new Error(`No available component IDs for type ${type}`);
          }
        }

        const result = fullId.toString();
        debugStore('generateComponentId:', type, '→', result);
        return result;
      },

      // User management
      setUserId: (userId) => {
        set({ userId });
      },

      resetUser: () => {
        set({ userId: null });
      },

      // Sidebar management
      setSidebarExpanded: (expanded) => {
        set({ sidebarExpanded: expanded });
      },

      toggleSidebar: () => {
        const current = get().sidebarExpanded;
        const newState = !current;
        set({ sidebarExpanded: newState });
      },

      // Property form management
      setPropertyFormState: (state) => {
        set({ propertyFormState: state });
      },

      setFormSubmitHandler: (handler) => {
        set({ formSubmitHandler: handler });
      },

      // Preview panel management
      setFullCodeViewOpen: (open) => {
        set({ fullCodeViewOpen: open });
      },

      toggleFullCodeView: () => {
        set({ fullCodeViewOpen: !get().fullCodeViewOpen });
      },

      // ===== SVG Library Actions =====
      addSvgToLibrary: (item) => {
        const id = `svg_${crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
        const newItem: SvgLibraryItem = { ...item, id, createdAt: Date.now() };
        set((state) => ({
          svgLibrary: [...state.svgLibrary, newItem],
          isDirty: true,
        }));
        return id;
      },

      removeSvgFromLibrary: (svgId) => {
        set((state) => {
          const svgLibrary = state.svgLibrary.filter(s => s.id !== svgId);

          // 참조 중인 노드의 svgLibraryId 초기화 → shape를 타입 기본값으로 복원
          const nodes = state.nodes.map(n => {
            if (n.data.appearance?.svgLibraryId === svgId) {
              const defaultShape = getDefaultAppearanceUtil(n.data.componentType).shape;
              const { svgLibraryId: _, ...rest } = n.data.appearance;
              return {
                ...n,
                data: {
                  ...n.data,
                  appearance: { ...rest, shape: defaultShape },
                },
              };
            }
            return n;
          });

          // 타입별 기본 매핑에서도 제거
          const defaultSvgByType = { ...state.defaultSvgByType };
          for (const [key, val] of Object.entries(defaultSvgByType)) {
            if (val === svgId) delete defaultSvgByType[key as ComponentType];
          }

          return { svgLibrary, nodes, defaultSvgByType, isDirty: true };
        });
      },

      setDefaultSvgForType: (componentType, svgId) => {
        set((state) => {
          const defaultSvgByType = { ...state.defaultSvgByType };
          if (svgId) {
            defaultSvgByType[componentType] = svgId;
          } else {
            delete defaultSvgByType[componentType];
          }
          return { defaultSvgByType, isDirty: true };
        });
      },

      // CrossFlow dialog actions
      openCrossflowDialog: (options) => {
        set({
          crossflowDialogOpen: true,
          crossflowDialogSourceNode: options?.sourceNodeId || null,
          crossflowDialogInitialValues: options?.initialValues || null,
          crossflowDialogOnApply: options?.onApply || null,
        });
      },

      closeCrossflowDialog: () => {
        set({
          crossflowDialogOpen: false,
          crossflowDialogSourceNode: null,
          crossflowDialogInitialValues: null,
          crossflowDialogOnApply: null,
        });
      },

      openGlobalSettingsDialog: (initialTab?: number) => {
        set({
          globalSettingsDialogOpen: true,
          globalSettingsDialogInitialTab: initialTab ?? 0,
        });
      },

      closeGlobalSettingsDialog: () => {
        set({
          globalSettingsDialogOpen: false,
          globalSettingsDialogInitialTab: 0,
        });
      },

      createCrossflowConnection: (config: ConnectionConfig) => {
        const { nodes, edges } = get();

        // CrossFlow 구조: From Volume → Junction → To Volume (2개의 엣지 필요)
        const fromNode = nodes.find(n => n.id === config.sourceNodeId);
        const junctionNode = nodes.find(n => n.id === config.junctionNodeId);
        const toNode = nodes.find(n => n.id === config.targetNodeId);

        if (!fromNode || !junctionNode || !toNode) {
          console.error('Cannot create crossflow connection: nodes not found', {
            sourceNodeId: config.sourceNodeId,
            junctionNodeId: config.junctionNodeId,
            targetNodeId: config.targetNodeId,
          });
          return;
        }

        // VolumeReference 생성
        const fromVolume: VolumeReference = {
          nodeId: fromNode.id,
          volumeNum: config.sourceCell,
          face: config.sourceFace,
        };

        const toVolume: VolumeReference = {
          nodeId: toNode.id,
          volumeNum: config.targetCell,
          face: config.targetFace,
        };

        // Connection type 결정: face 값에 따라 crossflow 또는 axial
        const connectionType = determineConnectionType(config.sourceFace, config.targetFace);

        // MARSEdgeData용 연결 타입 (MARS 공식 타입만 사용)
        const edgeConnectionType: 'axial' | 'crossflow' =
          connectionType === 'legacy' ? 'axial' : connectionType;

        // Edge 스타일 및 라벨 가져오기
        const edgeStyle = getEdgeStyle(connectionType);

        // Junction 파라미터 업데이트
        let updatedNodes = nodes;

        if (junctionNode.data.componentType === 'sngljun' ||
            junctionNode.data.componentType === 'tmdpjun' ||
            junctionNode.data.componentType === 'valve') {
          // SNGLJUN/TMDPJUN/VALVE: 단일 from/to 업데이트
          const params = junctionNode.data.parameters as Partial<SngljunParameters | TmdpjunParameters | ValveParameters>;
          updatedNodes = updatedNodes.map(n =>
            n.id === junctionNode.id
              ? {
                ...n,
                data: {
                  ...n.data,
                  parameters: {
                    ...params,
                    from: fromVolume,
                    to: toVolume,
                    area: config.area,
                    fwdLoss: config.fwdLoss,
                    revLoss: config.revLoss,
                    jefvcahs: config.jefvcahs,
                  },
                },
              }
              : n
          );
        } else if (junctionNode.data.componentType === 'pump') {
          // PUMP: inletConnection/outletConnection 업데이트
          const params = junctionNode.data.parameters as Partial<PumpParameters>;
          updatedNodes = updatedNodes.map(n =>
            n.id === junctionNode.id
              ? {
                ...n,
                data: {
                  ...n.data,
                  parameters: {
                    ...params,
                    inletConnection: fromVolume,
                    outletConnection: toVolume,
                  },
                },
              }
              : n
          );
        } else if (junctionNode.data.componentType === 'mtpljun' ||
                   junctionNode.data.componentType === 'branch' ||
                   junctionNode.data.componentType === 'turbine' ||
                   junctionNode.data.componentType === 'tank') {
          // MTPLJUN/BRANCH/TURBINE/TANK: junctions 배열의 특정 junction 업데이트
          const params = junctionNode.data.parameters as Partial<MtpljunParameters | BranchParameters | TurbineParameters>;
          const junctions = (params as { junctions?: { junctionNumber: number; from?: VolumeReference; to?: VolumeReference; area?: number; fwdLoss?: number; revLoss?: number; jefvcahs?: string }[] }).junctions;
          const junctionIndex = junctions?.findIndex(
            j => j.junctionNumber === config.junctionNumber
          );

          if (junctionIndex !== undefined && junctionIndex >= 0 && junctions) {
            const updatedJunctions = [...junctions];
            updatedJunctions[junctionIndex] = {
              ...updatedJunctions[junctionIndex],
              from: fromVolume,
              to: toVolume,
              area: config.area || updatedJunctions[junctionIndex].area,
              fwdLoss: config.fwdLoss || updatedJunctions[junctionIndex].fwdLoss,
              revLoss: config.revLoss || updatedJunctions[junctionIndex].revLoss,
              jefvcahs: config.jefvcahs || updatedJunctions[junctionIndex].jefvcahs,
            };

            updatedNodes = updatedNodes.map(n =>
              n.id === junctionNode.id
                ? {
                  ...n,
                  data: {
                    ...n.data,
                    parameters: { ...params, junctions: updatedJunctions },
                  },
                }
                : n
            );
          }
        }

        // Handle ID 생성: 노드 타입에 따라 적절한 handle 사용
        // FROM 노드 handle
        let fromHandleId: string;
        if (config.sourceFace === 0) {
          // Face 0 (Old Format): 중앙 hidden auto-connect 핸들 사용
          fromHandleId = 'auto-connect';
        } else if (fromNode.data.componentType === 'pipe') {
          fromHandleId = generateCellHandleId(config.sourceCell, config.sourceFace);
        } else {
          // SNGLVOL, TMDPVOL, BRANCH: CrossFlow는 outlet 사용
          fromHandleId = 'outlet';
        }

        // TO 노드 handle
        let toHandleId: string;
        if (config.targetFace === 0) {
          // Face 0 (Old Format): 중앙 hidden auto-connect 핸들 사용
          toHandleId = 'auto-connect';
        } else if (toNode.data.componentType === 'pipe') {
          toHandleId = generateCellHandleId(config.targetCell, config.targetFace);
        } else {
          // SNGLVOL, TMDPVOL, BRANCH: CrossFlow는 inlet 사용
          toHandleId = 'inlet';
        }

        // Junction handle ID
        let junctionFromHandleId: string;
        let junctionToHandleId: string;

        if (junctionNode.data.componentType === 'mtpljun') {
          // MTPLJUN: j{num}-from, j{num}-to
          junctionFromHandleId = `j${config.junctionNumber}-from`;
          junctionToHandleId = `j${config.junctionNumber}-to`;
        } else if (junctionNode.data.componentType === 'branch' ||
                   junctionNode.data.componentType === 'turbine' ||
                   junctionNode.data.componentType === 'tank') {
          // BRANCH/TURBINE/TANK: target-j{num}, source-j{num}
          junctionFromHandleId = `target-j${config.junctionNumber}`;
          junctionToHandleId = `source-j${config.junctionNumber}`;
        } else {
          // SNGLJUN/TMDPJUN/PUMP/VALVE: inlet/outlet 사용
          junctionFromHandleId = 'inlet';
          junctionToHandleId = 'outlet';
        }

        // Edge 1: From Volume → Junction
        const edge1Label = getEdgeLabel(connectionType, config.sourceCell, config.sourceFace);
        const edge1: Edge<MARSEdgeData> = {
          id: `crossflow-from-${Date.now()}`,
          source: fromNode.id,
          target: junctionNode.id,
          sourceHandle: fromHandleId,
          targetHandle: junctionFromHandleId,
          type: 'smoothstep',
          label: edge1Label,
          style: edgeStyle,
          data: {
            connectionType: edgeConnectionType,
            fromVolume,
            toVolume: {
              nodeId: junctionNode.id,
              volumeNum: config.junctionNumber || 1,
              face: 1, // Junction inlet
            },
            junctionNodeId: junctionNode.id,
            junctionNumber: config.junctionNumber,
            area: config.area,
            fwdLoss: config.fwdLoss,
            revLoss: config.revLoss,
            jefvcahs: config.jefvcahs,
          },
        };

        // Edge 2: Junction → To Volume
        const edge2Label = getEdgeLabel(connectionType, config.targetCell, config.targetFace);
        const edge2: Edge<MARSEdgeData> = {
          id: `crossflow-to-${Date.now() + 1}`,
          source: junctionNode.id,
          target: toNode.id,
          sourceHandle: junctionToHandleId,
          targetHandle: toHandleId,
          type: 'smoothstep',
          label: edge2Label,
          style: edgeStyle,
          data: {
            connectionType: edgeConnectionType,
            fromVolume: {
              nodeId: junctionNode.id,
              volumeNum: config.junctionNumber || 1,
              face: 2, // Junction outlet
            },
            toVolume,
            junctionNodeId: junctionNode.id,
            junctionNumber: config.junctionNumber,
            area: config.area,
            fwdLoss: config.fwdLoss,
            revLoss: config.revLoss,
            jefvcahs: config.jefvcahs,
          },
        };

        set({ edges: [...edges, edge1, edge2], nodes: updatedNodes });
        get().closeCrossflowDialog();
      },

      // Connection wizard actions
      setPendingConnection: (connection) => {
        set({ pendingConnection: connection });
      },

      onConnectionWizardConfirm: (config: ConnectionConfig) => {
        const { pendingConnection, nodes, edges } = get();
        if (!pendingConnection) return;

        const sourceNode = nodes.find(n => n.id === pendingConnection.sourceNodeId);
        const targetNode = nodes.find(n => n.id === pendingConnection.targetNodeId);

        if (!sourceNode || !targetNode) return;

        // VolumeReference 생성
        const fromVolume: VolumeReference = {
          nodeId: sourceNode.id,
          volumeNum: config.sourceCell,
          face: config.sourceFace,
        };

        const toVolume: VolumeReference = {
          nodeId: targetNode.id,
          volumeNum: config.targetCell,
          face: config.targetFace,
        };

        // Connection type 결정: face 값에 따라 crossflow 또는 axial
        const connectionType = determineConnectionType(config.sourceFace, config.targetFace);
        const edgeStyle = getEdgeStyle(connectionType);
        const edgeLabel = getEdgeLabel(connectionType, fromVolume.volumeNum, fromVolume.face);

        // MARSEdgeData용 연결 타입 (MARS 공식 타입만 사용)
        const edgeConnectionType: 'axial' | 'crossflow' =
          connectionType === 'legacy' ? 'axial' : connectionType;

        // Edge 생성
        const edgeData: MARSEdgeData = {
          connectionType: edgeConnectionType,
          fromVolume,
          toVolume,
          connectionConfig: config,
        };

        const newEdge: Edge<MARSEdgeData> = {
          id: `edge-${Date.now()}`,
          source: pendingConnection.sourceNodeId,
          target: pendingConnection.targetNodeId,
          sourceHandle: pendingConnection.sourceHandleId,
          targetHandle: pendingConnection.targetHandleId,
          label: edgeLabel,
          style: edgeStyle,
          data: edgeData,
        };

        set({
          edges: addEdge(newEdge, edges),
          pendingConnection: null,
          isDirty: true,
        });
      },
    }),
    {
      name: 'vsmr-user-storage',
      partialize: (state) => ({
        userId: state.userId,
        sidebarExpanded: state.sidebarExpanded,
      }),
    }
  )
);
