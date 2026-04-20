/**
 * Connection Synchronization Module
 *
 * Centralized handler registry for edge ↔ component parameter synchronization.
 * Covers all 4 sync directions:
 *   A. Canvas edge created  → component parameters updated  (handleEdgeCreated)
 *   B. Form save            → edges reconciled              (syncEdgesFromParameters)
 *   C. Edge deleted         → component parameters cleared  (handleEdgeDeleted)
 *   D. Node deleted         → orphan VolumeReferences cleaned (cleanupOrphanedRefs)
 */

import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData, VolumeReference } from '@/types/mars';
import { getHandleIdForVolumeReference } from './edgeSyncUtils';
import { determineConnectionType } from './edgeStyleHelpers';
import { getEdgeStyle, getEdgeLabel } from './edgeStyleHelpers';

// ============================================================================
// Types
// ============================================================================

export interface HandleInfo {
  componentType: string;
  handleId: string;
  type: 'target' | 'source';
  junctionNumber?: number;
  face?: number;
  boundarySide?: 'left' | 'right';
}

export interface ExpectedEdge {
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
  data: Partial<MARSEdgeData>;
  style?: Record<string, unknown>;
  label?: string;
}

export interface NodeUpdate {
  nodeId: string;
  parameters: Record<string, unknown>;
}

export interface EdgeDiff {
  toAdd: Edge<MARSEdgeData>[];
  toRemove: string[];
}

// Empty VolumeReference for clearing fields
const EMPTY_REF: VolumeReference = { nodeId: '', volumeNum: 0, face: 0 };

// ============================================================================
// ConnectionHandler Interface
// ============================================================================

interface ConnectionHandler {
  parseHandle(handleId: string): HandleInfo | null;

  onEdgeCreated(
    node: Node<MARSNodeData>,
    edge: Edge<MARSEdgeData>,
    connectedNode: Node<MARSNodeData>,
    handleInfo: HandleInfo,
  ): Record<string, unknown> | null;

  onEdgeDeleted(
    node: Node<MARSNodeData>,
    edge: Edge<MARSEdgeData>,
    handleInfo: HandleInfo,
    remainingEdges: Edge<MARSEdgeData>[],
  ): Record<string, unknown> | null;

  buildExpectedEdges(
    node: Node<MARSNodeData>,
    allNodes: Node<MARSNodeData>[],
  ): ExpectedEdge[];

  cleanupOrphanedRefs(
    node: Node<MARSNodeData>,
    deletedNodeId: string,
  ): Record<string, unknown> | null;
}

// ============================================================================
// Handler: Branch (target-j{N} / source-j{N})
// ============================================================================

const branchHandler: ConnectionHandler = {
  parseHandle(handleId) {
    const m = handleId.match(/^(target|source)-j(\d+)$/);
    if (!m) return null;
    return {
      componentType: 'branch',
      handleId,
      type: m[1] as 'target' | 'source',
      junctionNumber: parseInt(m[2]),
    };
  },

  onEdgeCreated(node, edge, connectedNode, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const isBranchSource = edge.source === node.id;

    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, !isBranchSource,
    );
    const branchSelfRef: VolumeReference = {
      nodeId: node.id,
      volumeNum: 1,
      face: isBranchSource ? 2 : 1,
    };

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== handleInfo.junctionNumber) return j;
      return isBranchSource
        ? { ...j, from: branchSelfRef, to: connectedRef }
        : { ...j, from: connectedRef, to: branchSelfRef };
    });

    return { junctions: updatedJunctions };
  },

  onEdgeDeleted(node, _edge, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== handleInfo.junctionNumber) return j;
      // Branch: 양쪽 모두 초기화
      return { ...j, from: EMPTY_REF, to: EMPTY_REF };
    });

    return { junctions: updatedJunctions };
  },

  buildExpectedEdges(node, allNodes) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const edges: ExpectedEdge[] = [];

    for (const j of junctions) {
      const from = j.from as VolumeReference | null;
      const to = j.to as VolumeReference | null;

      const connType = determineConnectionType(from?.face ?? 2, to?.face ?? 1);
      const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;

      // FROM side: external node → branch/turbine (branch is target)
      if (from?.nodeId && from.nodeId !== node.id) {
        const fromNode = allNodes.find(n => n.id === from.nodeId);
        if (fromNode) {
          const fromHandle = resolveHandleForNode(fromNode, from);
          if (fromHandle) {
            edges.push({
              sourceNodeId: from.nodeId,
              sourceHandle: fromHandle.handleId,
              targetNodeId: node.id,
              targetHandle: `target-j${j.junctionNumber}`,
              data: {
                connectionType: edgeConnType,
                fromVolume: from,
                toVolume: to || { nodeId: node.id, volumeNum: 1, face: 1 },
              },
              style: getEdgeStyle(connType),
              label: getEdgeLabel(connType, from.volumeNum ?? 1, from.face ?? 2),
            });
          }
        }
      }

      // TO side: branch/turbine → external node (branch is source)
      if (to?.nodeId && to.nodeId !== node.id) {
        const toNode = allNodes.find(n => n.id === to.nodeId);
        if (toNode) {
          const toHandle = resolveHandleForNode(toNode, to);
          if (toHandle) {
            edges.push({
              sourceNodeId: node.id,
              sourceHandle: `source-j${j.junctionNumber}`,
              targetNodeId: to.nodeId,
              targetHandle: toHandle.handleId,
              data: {
                connectionType: edgeConnType,
                fromVolume: from || { nodeId: node.id, volumeNum: 1, face: 2 },
                toVolume: to,
              },
              style: getEdgeStyle(connType),
              label: getEdgeLabel(connType, from?.volumeNum ?? 1, from?.face ?? 2),
            });
          }
        }
      }
    }

    return edges;
  },

  cleanupOrphanedRefs(node, deletedNodeId) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    let changed = false;

    const updatedJunctions = junctions.map((j: any) => {
      const from = j.from as VolumeReference | null;
      const to = j.to as VolumeReference | null;
      const newJ = { ...j };
      if (from?.nodeId === deletedNodeId) { newJ.from = EMPTY_REF; changed = true; }
      if (to?.nodeId === deletedNodeId) { newJ.to = EMPTY_REF; changed = true; }
      return newJ;
    });

    return changed ? { junctions: updatedJunctions } : null;
  },
};

// ============================================================================
// Handler: Turbine (target-j{N} / source-j{N}) — Branch와 동일한 junctions[] 구조
// ============================================================================

const turbineHandler: ConnectionHandler = {
  parseHandle: branchHandler.parseHandle,
  onEdgeCreated: branchHandler.onEdgeCreated,
  onEdgeDeleted: branchHandler.onEdgeDeleted,
  buildExpectedEdges: branchHandler.buildExpectedEdges,
  cleanupOrphanedRefs: branchHandler.cleanupOrphanedRefs,
};

// ============================================================================
// Handler: MTPLJUN (j{N}-from / j{N}-to)
// ============================================================================

const mtpljunHandler: ConnectionHandler = {
  parseHandle(handleId) {
    // target handles: j{N}-from (named from the junction's perspective)
    // source handles: j{N}-to
    const m = handleId.match(/^j(\d+)-(from|to)$/);
    if (!m) return null;
    return {
      componentType: 'mtpljun',
      handleId,
      type: m[2] === 'from' ? 'target' : 'source',
      junctionNumber: parseInt(m[1]),
    };
  },

  onEdgeCreated(node, edge, connectedNode, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const isFromHandle = handleInfo.handleId.endsWith('-from');

    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, isFromHandle,
    );

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== handleInfo.junctionNumber) return j;
      return { ...j, [isFromHandle ? 'from' : 'to']: connectedRef };
    });

    return { junctions: updatedJunctions };
  },

  onEdgeDeleted(node, _edge, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const isFromHandle = handleInfo.handleId.endsWith('-from');

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== handleInfo.junctionNumber) return j;
      return { ...j, [isFromHandle ? 'from' : 'to']: EMPTY_REF };
    });

    return { junctions: updatedJunctions };
  },

  buildExpectedEdges(node, allNodes) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const edges: ExpectedEdge[] = [];

    for (const j of junctions) {
      const from = normalizeVolumeRef(j.from, allNodes);
      const to = normalizeVolumeRef(j.to, allNodes);

      // from side: other → mtpljun
      if (from?.nodeId && from.nodeId !== node.id) {
        const fromNode = allNodes.find(n => n.id === from.nodeId);
        if (fromNode) {
          const handle = resolveHandleForNode(fromNode, from);
          if (handle) {
            const toSelf: VolumeReference = { nodeId: node.id, volumeNum: j.junctionNumber, face: 1 };
            const connType = determineConnectionType(from.face ?? 2, toSelf.face);
            const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
            edges.push({
              sourceNodeId: from.nodeId,
              sourceHandle: handle.handleId,
              targetNodeId: node.id,
              targetHandle: `j${j.junctionNumber}-from`,
              data: {
                connectionType: edgeConnType,
                fromVolume: from,
                toVolume: toSelf,
                junctionNodeId: node.id,
                junctionNumber: j.junctionNumber,
              },
              style: getEdgeStyle(connType),
              label: getEdgeLabel(connType, from.volumeNum ?? 1, from.face ?? 2),
            });
          }
        }
      }

      // to side: mtpljun → other
      if (to?.nodeId && to.nodeId !== node.id) {
        const toNode = allNodes.find(n => n.id === to.nodeId);
        if (toNode) {
          const handle = resolveHandleForNode(toNode, to);
          if (handle) {
            const fromSelf: VolumeReference = { nodeId: node.id, volumeNum: j.junctionNumber, face: 2 };
            const connType = determineConnectionType(fromSelf.face, to.face ?? 1);
            const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
            edges.push({
              sourceNodeId: node.id,
              sourceHandle: `j${j.junctionNumber}-to`,
              targetNodeId: to.nodeId,
              targetHandle: handle.handleId,
              data: {
                connectionType: edgeConnType,
                fromVolume: fromSelf,
                toVolume: to,
                junctionNodeId: node.id,
                junctionNumber: j.junctionNumber,
              },
              style: getEdgeStyle(connType),
              label: getEdgeLabel(connType, j.junctionNumber, fromSelf.face),
            });
          }
        }
      }
    }

    return edges;
  },

  cleanupOrphanedRefs(node, deletedNodeId) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    let changed = false;

    const updatedJunctions = junctions.map((j: any) => {
      const from = normalizeVolumeRef(j.from, []);
      const to = normalizeVolumeRef(j.to, []);
      const newJ = { ...j };
      if (from?.nodeId === deletedNodeId) { newJ.from = EMPTY_REF; changed = true; }
      if (to?.nodeId === deletedNodeId) { newJ.to = EMPTY_REF; changed = true; }
      return newJ;
    });

    return changed ? { junctions: updatedJunctions } : null;
  },
};

// ============================================================================
// Handler: Simple Junction (sngljun, tmdpjun, valve — inlet / outlet)
// ============================================================================

const simpleJunctionHandler: ConnectionHandler = {
  parseHandle(handleId) {
    if (handleId === 'inlet') {
      return { componentType: 'junction', handleId, type: 'target' };
    }
    if (handleId === 'outlet') {
      return { componentType: 'junction', handleId, type: 'source' };
    }
    return null;
  },

  onEdgeCreated(node, edge, connectedNode, _handleInfo) {
    const isSource = edge.source === node.id;
    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, !isSource,
    );
    return isSource ? { to: connectedRef } : { from: connectedRef };
  },

  onEdgeDeleted(node, edge, _handleInfo, remainingEdges) {
    const isSource = edge.source === node.id;

    // Try to find a replacement edge for the same direction
    const replacement = remainingEdges.find(e =>
      isSource ? e.source === node.id : e.target === node.id
    );

    if (replacement) {
      // Recalculate from replacement edge
      const connectedNodeId = isSource ? replacement.target : replacement.source;
      const ref: VolumeReference = {
        nodeId: connectedNodeId,
        volumeNum: 1,
        face: isSource ? 1 : 2,
      };
      return isSource ? { to: ref } : { from: ref };
    }

    return isSource ? { to: EMPTY_REF } : { from: EMPTY_REF };
  },

  buildExpectedEdges(node, allNodes) {
    const params = node.data.parameters as any;
    const edges: ExpectedEdge[] = [];
    const from = params?.from as VolumeReference | undefined;
    const to = params?.to as VolumeReference | undefined;

    if (from?.nodeId) {
      const fromNode = allNodes.find(n => n.id === from.nodeId);
      if (fromNode) {
        const handle = resolveHandleForNode(fromNode, from);
        if (handle) {
          const connType = determineConnectionType(from.face ?? 2, to?.face ?? 1);
          const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
          edges.push({
            sourceNodeId: from.nodeId,
            sourceHandle: handle.handleId,
            targetNodeId: node.id,
            targetHandle: 'inlet',
            data: {
              connectionType: edgeConnType,
              fromVolume: from,
              toVolume: { nodeId: node.id, volumeNum: 1, face: 1 },
            },
            style: getEdgeStyle(connType),
            label: getEdgeLabel(connType, from.volumeNum ?? 1, from.face ?? 2),
          });
        }
      }
    }

    if (to?.nodeId) {
      const toNode = allNodes.find(n => n.id === to.nodeId);
      if (toNode) {
        const handle = resolveHandleForNode(toNode, to);
        if (handle) {
          const connType = determineConnectionType(from?.face ?? 2, to.face ?? 1);
          const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
          edges.push({
            sourceNodeId: node.id,
            sourceHandle: 'outlet',
            targetNodeId: to.nodeId,
            targetHandle: handle.handleId,
            data: {
              connectionType: edgeConnType,
              fromVolume: { nodeId: node.id, volumeNum: 1, face: 2 },
              toVolume: to,
            },
            style: getEdgeStyle(connType),
            label: getEdgeLabel(connType, 1, to.face ?? 1),
          });
        }
      }
    }

    return edges;
  },

  cleanupOrphanedRefs(node, deletedNodeId) {
    const params = node.data.parameters as any;
    const from = params?.from as VolumeReference | undefined;
    const to = params?.to as VolumeReference | undefined;
    const updates: Record<string, unknown> = {};
    let changed = false;

    if (from?.nodeId === deletedNodeId) { updates.from = EMPTY_REF; changed = true; }
    if (to?.nodeId === deletedNodeId) { updates.to = EMPTY_REF; changed = true; }

    return changed ? updates : null;
  },
};

// ============================================================================
// Handler: Pump (inlet / outlet)
// ============================================================================

const pumpHandler: ConnectionHandler = {
  parseHandle(handleId) {
    if (handleId === 'inlet') {
      return { componentType: 'pump', handleId, type: 'target' };
    }
    if (handleId === 'outlet') {
      return { componentType: 'pump', handleId, type: 'source' };
    }
    return null;
  },

  onEdgeCreated(node, edge, connectedNode, handleInfo) {
    const isOutlet = handleInfo.handleId === 'outlet';
    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, isOutlet,
    );
    return isOutlet
      ? { outletConnection: connectedRef }
      : { inletConnection: connectedRef };
  },

  onEdgeDeleted(_node, _edge, handleInfo) {
    const isOutlet = handleInfo.handleId === 'outlet';
    return isOutlet
      ? { outletConnection: EMPTY_REF }
      : { inletConnection: EMPTY_REF };
  },

  buildExpectedEdges(node, allNodes) {
    const params = node.data.parameters as any;
    const edges: ExpectedEdge[] = [];
    const inletConn = params?.inletConnection as VolumeReference | undefined;
    const outletConn = params?.outletConnection as VolumeReference | undefined;

    if (inletConn?.nodeId) {
      const inletNode = allNodes.find(n => n.id === inletConn.nodeId);
      if (inletNode) {
        const handle = resolveHandleForNode(inletNode, inletConn);
        if (handle) {
          const toSelf: VolumeReference = { nodeId: node.id, volumeNum: 1, face: 1 };
          const connType = determineConnectionType(inletConn.face ?? 2, toSelf.face);
          const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
          edges.push({
            sourceNodeId: inletConn.nodeId,
            sourceHandle: handle.handleId,
            targetNodeId: node.id,
            targetHandle: 'inlet',
            data: {
              connectionType: edgeConnType,
              fromVolume: inletConn,
              toVolume: toSelf,
              junctionId: node.data.componentId,
            },
            style: getEdgeStyle(connType),
            label: getEdgeLabel(connType, inletConn.volumeNum ?? 1, inletConn.face ?? 2),
          });
        }
      }
    }

    if (outletConn?.nodeId) {
      const outletNode = allNodes.find(n => n.id === outletConn.nodeId);
      if (outletNode) {
        const handle = resolveHandleForNode(outletNode, outletConn);
        if (handle) {
          const fromSelf: VolumeReference = { nodeId: node.id, volumeNum: 1, face: 2 };
          const connType = determineConnectionType(fromSelf.face, outletConn.face ?? 1);
          const edgeConnType: 'axial' | 'crossflow' = connType === 'legacy' ? 'axial' : connType;
          edges.push({
            sourceNodeId: node.id,
            sourceHandle: 'outlet',
            targetNodeId: outletConn.nodeId,
            targetHandle: handle.handleId,
            data: {
              connectionType: edgeConnType,
              fromVolume: fromSelf,
              toVolume: outletConn,
              junctionId: node.data.componentId,
            },
            style: getEdgeStyle(connType),
            label: getEdgeLabel(connType, 1, fromSelf.face),
          });
        }
      }
    }

    return edges;
  },

  cleanupOrphanedRefs(node, deletedNodeId) {
    const params = node.data.parameters as any;
    const updates: Record<string, unknown> = {};
    let changed = false;

    if ((params?.inletConnection as VolumeReference)?.nodeId === deletedNodeId) {
      updates.inletConnection = EMPTY_REF; changed = true;
    }
    if ((params?.outletConnection as VolumeReference)?.nodeId === deletedNodeId) {
      updates.outletConnection = EMPTY_REF; changed = true;
    }

    return changed ? updates : null;
  },
};

// ============================================================================
// Handler: Heat Structure (left-boundary / right-boundary)
// ============================================================================

const htstrHandler: ConnectionHandler = {
  parseHandle(handleId) {
    if (handleId === 'left-boundary') {
      return { componentType: 'htstr', handleId, type: 'target', boundarySide: 'left' };
    }
    if (handleId === 'right-boundary') {
      return { componentType: 'htstr', handleId, type: 'source', boundarySide: 'right' };
    }
    return null;
  },

  onEdgeCreated(node, edge, connectedNode, handleInfo) {
    const side = handleInfo.boundarySide!;
    const params = node.data.parameters as any;
    const boundaryKey = side === 'left' ? 'leftBoundaryConditions' : 'rightBoundaryConditions';
    const currentBCs = params[boundaryKey] || [];

    if (currentBCs.length === 0) return null;

    // Build volume reference from connected node
    const isHsSource = edge.source === node.id;
    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, isHsSource,
    );

    const updatedBCs = [...currentBCs];
    updatedBCs[0] = {
      ...updatedBCs[0],
      boundaryVolume: connectedRef,
      bcType: 101, // Convective
    };

    return { [boundaryKey]: updatedBCs };
  },

  onEdgeDeleted(node, edge, handleInfo) {
    // Only process if this edge's heatStructureSide matches our handleInfo
    const edgeData = edge.data as MARSEdgeData | undefined;
    if (edgeData?.heatStructureNodeId !== node.id) return null;

    const side = handleInfo.boundarySide || edgeData?.heatStructureSide;
    if (!side) return null;

    const params = node.data.parameters as any;
    const boundaryKey = side === 'left' ? 'leftBoundaryConditions' : 'rightBoundaryConditions';
    const currentBCs = params[boundaryKey] || [];

    if (currentBCs.length === 0) return null;

    const updatedBCs = [...currentBCs];
    updatedBCs[0] = {
      ...updatedBCs[0],
      boundaryVolume: null,
      bcType: 0, // Insulated
    };

    return { [boundaryKey]: updatedBCs };
  },

  buildExpectedEdges(_node, _allNodes) {
    // HTSTR uses dedicated createHeatStructureEdge/deleteHeatStructureEdge methods
    // buildExpectedEdges is not used for htstr — edges managed via explicit UI calls
    return [];
  },

  cleanupOrphanedRefs(node, deletedNodeId) {
    const params = node.data.parameters as any;
    const updates: Record<string, unknown> = {};
    let changed = false;

    for (const side of ['left', 'right'] as const) {
      const key = side === 'left' ? 'leftBoundaryConditions' : 'rightBoundaryConditions';
      const bcs = params[key] || [];
      const updatedBCs = bcs.map((bc: any) => {
        if (bc.boundaryVolume?.nodeId === deletedNodeId) {
          changed = true;
          return { ...bc, boundaryVolume: null, bcType: 0 };
        }
        return bc;
      });
      if (changed) updates[key] = updatedBCs;
    }

    return changed ? updates : null;
  },
};

// ============================================================================
// Handler: Volume (pipe, snglvol, tmdpvol, break, fill — passive)
// ============================================================================

const volumeHandler: ConnectionHandler = {
  parseHandle(handleId) {
    // pipe meta-handles
    const fMatch = handleId.match(/^f([1-6])$/);
    if (fMatch) {
      const face = parseInt(fMatch[1]);
      return {
        componentType: 'volume',
        handleId,
        type: face === 1 ? 'target' : 'source',
        face,
      };
    }
    // simple volume handles
    if (handleId === 'inlet') return { componentType: 'volume', handleId, type: 'target', face: 1 };
    if (handleId === 'outlet') return { componentType: 'volume', handleId, type: 'source', face: 2 };
    // cell-based handles
    const cellMatch = handleId.match(/^cell-(\d+)-face-([1-6])$/);
    if (cellMatch) {
      const face = parseInt(cellMatch[2]);
      return {
        componentType: 'volume',
        handleId,
        type: face === 1 ? 'target' : 'source',
        face,
      };
    }
    return null;
  },

  // Volumes are passive — they don't store connection references
  onEdgeCreated() { return null; },
  onEdgeDeleted() { return null; },
  buildExpectedEdges() { return []; },
  cleanupOrphanedRefs() { return null; },
};

// ============================================================================
// Handler Registry
// ============================================================================

// ============================================================================
// Handler: Tank (target-j{N} / source-j{N}) — Branch와 동일한 junctions[] 구조
// ============================================================================

const tankHandler: ConnectionHandler = {
  parseHandle: branchHandler.parseHandle,
  onEdgeCreated: branchHandler.onEdgeCreated,
  onEdgeDeleted: branchHandler.onEdgeDeleted,
  buildExpectedEdges: branchHandler.buildExpectedEdges,
  cleanupOrphanedRefs: branchHandler.cleanupOrphanedRefs,
};

// ============================================================================
// Handler: Separator (target-j{N} / source-j{N}) — Branch와 동일한 junctions[] 구조
// ============================================================================

const separatorHandler: ConnectionHandler = {
  parseHandle: branchHandler.parseHandle,

  onEdgeCreated(node, edge, connectedNode, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const jNum = handleInfo.junctionNumber;
    const isBranchSource = edge.source === node.id;

    const connectedRef = buildVolumeRefFromConnectedNode(
      connectedNode, edge, node.id, !isBranchSource,
    );

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== jNum) return j;

      // J1 (Vapor Outlet): from=자신 Face 2 (고정), to=외부
      // J2 (Liquid Fall Back): from=자신 Face 1 (고정), to=외부
      if (jNum === 1 || jNum === 2) {
        const branchFace = jNum === 1 ? 2 : 1;
        return {
          ...j,
          from: { nodeId: node.id, volumeNum: 1, face: branchFace },
          to: connectedRef,
        };
      }

      // J3 (Separator Inlet): Branch와 동일하게 방향에 따라 결정
      const branchSelfRef: VolumeReference = {
        nodeId: node.id,
        volumeNum: 1,
        face: isBranchSource ? 2 : 1,
      };
      return isBranchSource
        ? { ...j, from: branchSelfRef, to: connectedRef }
        : { ...j, from: connectedRef, to: branchSelfRef };
    });

    return { junctions: updatedJunctions };
  },

  onEdgeDeleted(node, _edge, handleInfo) {
    const params = node.data.parameters as any;
    const junctions = params?.junctions || [];
    const jNum = handleInfo.junctionNumber;

    const updatedJunctions = junctions.map((j: any) => {
      if (j.junctionNumber !== jNum) return j;

      // J1/J2: from은 자기 자신(고정) 유지, to만 초기화
      if (jNum === 1 || jNum === 2) {
        return { ...j, to: EMPTY_REF };
      }
      // J3: 양쪽 모두 초기화
      return { ...j, from: EMPTY_REF, to: EMPTY_REF };
    });

    return { junctions: updatedJunctions };
  },

  buildExpectedEdges: branchHandler.buildExpectedEdges,
  cleanupOrphanedRefs: branchHandler.cleanupOrphanedRefs,
};

const handlers: Record<string, ConnectionHandler> = {
  branch: branchHandler,
  turbine: turbineHandler,
  tank: tankHandler,
  separatr: separatorHandler,
  mtpljun: mtpljunHandler,
  sngljun: simpleJunctionHandler,
  tmdpjun: simpleJunctionHandler,
  valve: simpleJunctionHandler,
  pump: pumpHandler,
  htstr: htstrHandler,
  pipe: volumeHandler,
  snglvol: volumeHandler,
  tmdpvol: volumeHandler,
  break: volumeHandler,
  fill: volumeHandler,
};

export function getHandler(componentType: string): ConnectionHandler | null {
  return handlers[componentType] || null;
}

/**
 * Returns true if this component type "owns" edges (stores from/to in parameters).
 * Volume types (pipe, snglvol, tmdpvol, break, fill) are passive — they never
 * generate expected edges, so syncEdgesFromParameters should NOT be called on them.
 */
export function isEdgeOwner(componentType: string): boolean {
  const handler = handlers[componentType];
  return handler !== undefined && handler !== volumeHandler;
}

// ============================================================================
// Core Functions — called from useStore.ts
// ============================================================================

/**
 * Direction A: Edge created on canvas → update both nodes' parameters
 */
export function handleEdgeCreated(
  nodes: Node<MARSNodeData>[],
  edge: Edge<MARSEdgeData>,
): NodeUpdate[] {
  const updates: NodeUpdate[] = [];
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return updates;

  // Source side
  const sourceHandler = getHandler(sourceNode.data.componentType);
  if (sourceHandler && edge.sourceHandle) {
    const info = sourceHandler.parseHandle(edge.sourceHandle);
    if (info) {
      const params = sourceHandler.onEdgeCreated(sourceNode, edge, targetNode, info);
      if (params) updates.push({ nodeId: sourceNode.id, parameters: params });
    }
  }

  // Target side
  const targetHandler = getHandler(targetNode.data.componentType);
  if (targetHandler && edge.targetHandle) {
    const info = targetHandler.parseHandle(edge.targetHandle);
    if (info) {
      const params = targetHandler.onEdgeCreated(targetNode, edge, sourceNode, info);
      if (params) updates.push({ nodeId: targetNode.id, parameters: params });
    }
  }

  return updates;
}

/**
 * Direction C: Edge deleted → clear both nodes' parameters
 */
export function handleEdgeDeleted(
  nodes: Node<MARSNodeData>[],
  allEdges: Edge<MARSEdgeData>[],
  removedEdge: Edge<MARSEdgeData>,
): NodeUpdate[] {
  const updates: NodeUpdate[] = [];

  const sides: Array<{ nodeId: string; handleId: string | null | undefined }> = [
    { nodeId: removedEdge.source, handleId: removedEdge.sourceHandle },
    { nodeId: removedEdge.target, handleId: removedEdge.targetHandle },
  ];

  for (const { nodeId, handleId } of sides) {
    if (!handleId) continue;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const handler = getHandler(node.data.componentType);
    if (!handler) continue;

    const info = handler.parseHandle(handleId);
    if (!info) continue;

    // Remaining edges = all edges minus the removed one, connected to this node
    const remaining = allEdges.filter(
      e => e.id !== removedEdge.id && (e.source === nodeId || e.target === nodeId),
    );

    const params = handler.onEdgeDeleted(node, removedEdge, info, remaining);
    if (params) updates.push({ nodeId, parameters: params });
  }

  return updates;
}

/**
 * Direction B: Form save → reconcile edges to match parameters
 */
export function syncEdgesFromParameters(
  node: Node<MARSNodeData>,
  allNodes: Node<MARSNodeData>[],
  currentEdges: Edge<MARSEdgeData>[],
): EdgeDiff {
  const handler = getHandler(node.data.componentType);
  if (!handler) return { toAdd: [], toRemove: [] };

  const expected = handler.buildExpectedEdges(node, allNodes);

  // Junction 기반 컴포넌트의 모든 핸들을 owned로 등록
  // (from/to가 null인 junction도 포함하여, 초기화 시 기존 엣지 삭제 가능)
  const additionalOwned = new Set<string>();
  const params = node.data.parameters as any;
  const junctions = params?.junctions;
  if (junctions && Array.isArray(junctions)) {
    for (const j of junctions) {
      const jNum = j.junctionNumber;
      if (jNum != null) {
        additionalOwned.add(`source:source-j${jNum}`);
        additionalOwned.add(`target:target-j${jNum}`);
      }
    }
  }

  const diff = reconcileEdges(node.id, expected, currentEdges, additionalOwned.size > 0 ? additionalOwned : undefined);
  return diff;
}

/**
 * Direction D: Node deleted → clean up orphan VolumeReferences in all other nodes
 */
export function cleanupOrphanedRefs(
  deletedNodeId: string,
  nodes: Node<MARSNodeData>[],
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();

  for (const node of nodes) {
    if (node.id === deletedNodeId) continue;
    const handler = getHandler(node.data.componentType);
    if (!handler) continue;

    const updates = handler.cleanupOrphanedRefs(node, deletedNodeId);
    if (updates) result.set(node.id, updates);
  }

  return result;
}

// ============================================================================
// Edge Reconciliation
// ============================================================================

/**
 * Compare expected edges (from parameters) with actual edges (in store).
 * Returns edges to add and edge IDs to remove.
 * Match key: source + sourceHandle + target + targetHandle
 */
export function reconcileEdges(
  nodeId: string,
  expected: ExpectedEdge[],
  actual: Edge<MARSEdgeData>[],
  additionalOwnedHandles?: Set<string>,
): EdgeDiff {
  // Collect all handle patterns that the handler expects to own.
  // Only edges using these handles on the nodeId side should be reconciled.
  const ownedHandles = new Set<string>();
  for (const exp of expected) {
    if (exp.sourceNodeId === nodeId) ownedHandles.add(`source:${exp.sourceHandle}`);
    if (exp.targetNodeId === nodeId) ownedHandles.add(`target:${exp.targetHandle}`);
  }
  // Junction 기반 컴포넌트(branch/separator 등)에서 to=null로 초기화된 핸들도
  // owned로 등록하여 기존 엣지가 삭제되도록 함
  if (additionalOwnedHandles) {
    for (const h of additionalOwnedHandles) ownedHandles.add(h);
  }

  // Get all actual edges connected to this node
  const nodeEdges = actual.filter(e => e.source === nodeId || e.target === nodeId);
  const toRemove: string[] = [];
  const matched = new Set<number>(); // indices in expected[]

  // For each actual edge, check if expected
  for (const edge of nodeEdges) {
    // Determine which handle this edge uses on nodeId's side
    const handleKey = edge.source === nodeId
      ? `source:${edge.sourceHandle}`
      : `target:${edge.targetHandle}`;

    // Skip edges whose handle is not owned by this handler.
    // e.g. 'auto-connect' edges on branch/turbine aren't managed by branchHandler.
    if (!ownedHandles.has(handleKey)) {
      continue;
    }

    const idx = expected.findIndex((exp, i) =>
      !matched.has(i) &&
      exp.sourceNodeId === edge.source &&
      exp.sourceHandle === edge.sourceHandle &&
      exp.targetNodeId === edge.target &&
      exp.targetHandle === edge.targetHandle
    );

    if (idx !== -1) {
      matched.add(idx);
    } else {
      // Not expected → should be removed
      toRemove.push(edge.id);
    }
  }

  // Remaining expected edges → need to be created
  const toAdd: Edge<MARSEdgeData>[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (matched.has(i)) continue;
    const exp = expected[i];
    toAdd.push({
      id: `edge_${exp.sourceNodeId}_${exp.targetNodeId}_${Date.now()}_${i}`,
      source: exp.sourceNodeId,
      sourceHandle: exp.sourceHandle,
      target: exp.targetNodeId,
      targetHandle: exp.targetHandle,
      type: 'smoothstep',
      animated: false,
      data: exp.data as MARSEdgeData,
      style: exp.style as any,
      label: exp.label as any,
    });
  }

  return { toAdd, toRemove };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Build a VolumeReference for the node connected to `myNodeId` via `edge`.
 * `isSource` indicates whether the connected node is the edge's source.
 */
function buildVolumeRefFromConnectedNode(
  connectedNode: Node<MARSNodeData>,
  edge: Edge<MARSEdgeData>,
  _myNodeId: string,
  isConnectedSource: boolean,
): VolumeReference {
  // Try to get volume info from edge data
  const edgeData = edge.data as MARSEdgeData | undefined;
  if (edgeData) {
    const ref = isConnectedSource ? edgeData.fromVolume : edgeData.toVolume;
    if (ref?.nodeId === connectedNode.id) return ref;
  }

  // Fallback: construct from handle info
  const handleId = isConnectedSource ? edge.sourceHandle : edge.targetHandle;
  if (handleId) {
    const handler = getHandler(connectedNode.data.componentType);
    if (handler) {
      const info = handler.parseHandle(handleId);
      if (info?.face) {
        return { nodeId: connectedNode.id, volumeNum: 1, face: info.face };
      }
    }
  }

  // Default fallback
  return {
    nodeId: connectedNode.id,
    volumeNum: 1,
    face: isConnectedSource ? 2 : 1,
  };
}

/**
 * Resolve handle ID for a volume node given a VolumeReference.
 * Uses existing edgeSyncUtils when possible, with fallback logic.
 */
function resolveHandleForNode(
  node: Node<MARSNodeData>,
  ref: VolumeReference,
): { handleId: string; handleType: 'source' | 'target' } | null {
  const ct = node.data.componentType;

  // Pipe: onConnect converts meta-handles (f2) → cell-handles (cell-1-face-2),
  // so reconcileEdges must compare using the same cell-handle format.
  if (ct === 'pipe') {
    // Face 0 (Old Format): use center auto-connect handle
    if (ref.face === 0) {
      return { handleId: 'auto-connect', handleType: ref.volumeNum === 0 ? 'target' : 'source' };
    }
    const cellNum = ref.volumeNum ?? 1;
    const face = ref.face ?? 1;
    const handleId = `cell-${cellNum}-face-${face}`;
    const handleType: 'source' | 'target' = face === 1 ? 'target' : 'source';
    return { handleId, handleType };
  }

  // Try the existing utility for snglvol, tmdpvol, etc.
  const result = getHandleIdForVolumeReference(node, ref);
  if (result) return result;

  // Fallback for single-volume types with crossflow faces (3-6)
  if (['snglvol', 'tmdpvol'].includes(ct)) {
    return ref.face === 1
      ? { handleId: 'inlet', handleType: 'target' }
      : { handleId: 'outlet', handleType: 'source' };
  }

  // Fallback for junction-type components
  if (['sngljun', 'tmdpjun', 'valve', 'pump'].includes(ct)) {
    return ref.face === 1
      ? { handleId: 'inlet', handleType: 'target' }
      : { handleId: 'outlet', handleType: 'source' };
  }

  return null;
}

/**
 * Normalize a junction from/to value that might be a 9-digit string (legacy MTPLJUN)
 * or a VolumeReference object. Returns VolumeReference or null.
 */
function normalizeVolumeRef(
  value: VolumeReference | string | null | undefined,
  allNodes: Node<MARSNodeData>[],
): VolumeReference | null {
  if (!value) return null;

  // Already a VolumeReference
  if (typeof value === 'object' && 'nodeId' in value) {
    return value.nodeId ? value : null;
  }

  // Legacy 9-digit string: CCCVV000F
  if (typeof value === 'string' && value.length === 9) {
    const componentId = value.slice(0, 3);
    const volumeNum = parseInt(value.slice(3, 5), 10);
    const face = parseInt(value.slice(8, 9), 10);

    if (isNaN(volumeNum) || isNaN(face)) return null;

    // Find node by component ID prefix
    const node = allNodes.find(n => n.data.componentId.startsWith(componentId));
    if (!node) return null;

    return { nodeId: node.id, volumeNum, face };
  }

  return null;
}
