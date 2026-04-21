/**
 * Edge Synchronization Utilities
 * Convert junction connections to ReactFlow edges
 */

import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData, VolumeReference } from '@/types/mars';

/**
 * Parse Volume ID to extract component info
 * Format: CCCVV000F
 * - CCC: Component ID (e.g., "100")
 * - VV: Cell/Volume number (e.g., "01")
 * - 000: Separator
 * - F: Face (1=inlet, 2=outlet, 3-6=other faces)
 */
interface ParsedVolumeId {
  componentId: string; // "100"
  cellNumber: number;  // 1
  face: number;        // 1 or 2
  isValid: boolean;
}

export function parseVolumeId(volumeId: string): ParsedVolumeId {
  if (!volumeId || volumeId.length !== 9) {
    return { componentId: '', cellNumber: 0, face: 0, isValid: false };
  }

  const componentId = volumeId.slice(0, 3); // "100"
  const cellStr = volumeId.slice(3, 5);     // "01"
  const faceStr = volumeId.slice(8, 9);     // "1"

  const cellNumber = parseInt(cellStr, 10);
  const face = parseInt(faceStr, 10);

  // Face 0 (old format CCCVV0000): cellNumber 0-99 is valid; Face 1-6: cellNumber 1+ is valid
  const isValid = !isNaN(cellNumber) && !isNaN(face) && (
    (face === 0 && cellNumber >= 0 && cellNumber <= 99) ||
    (face >= 1 && face <= 6 && cellNumber > 0)
  );

  return {
    componentId,
    cellNumber,
    face,
    isValid,
  };
}

/**
 * Find node by component ID prefix
 */
export function findNodeByComponentId(
  nodes: Node<MARSNodeData>[],
  componentId: string
): Node<MARSNodeData> | null {
  return nodes.find(node => node.data.componentId.startsWith(componentId)) || null;
}

/**
 * Convert cell handle ID to meta-handle ID (for backward compatibility)
 * Old format: ${shortId}${cellId}0001/0002 → New format: f1/f2
 * @param cellHandleId Cell handle ID (e.g., "120010001")
 * @returns Meta-handle ID (e.g., "f1") or null if invalid
 */
export function convertCellHandleToMetaHandle(cellHandleId: string): string | null {
  if (!cellHandleId || cellHandleId.length !== 9) {
    return null;
  }

  // Extract face number from last digit
  const faceNum = parseInt(cellHandleId.slice(8, 9));

  // Only f1 (inlet) and f2 (outlet) for axial connections
  if (faceNum === 1) {
    return 'f1';
  } else if (faceNum === 2) {
    return 'f2';
  }

  return null;
}

/**
 * Get handle ID for PIPE node based on component ID, cell number and face
 * NEW: Returns meta-handle IDs (f1~f6) instead of cell-specific handles
 * @param componentId Full component ID (e.g., "1200000")
 * @param cellNumber Cell number (1-based, used for validation only)
 * @param face Face number (1=inlet, 2=outlet, 3~6=side)
 */
export function getPipeHandleId(_componentId: string, _cellNumber: number, face: number): string | null {
  // Face 0 (Old Format): use auto-connect hidden center handle
  if (face === 0) {
    return 'auto-connect';
  }
  // Face 1-6 map to meta-handles f1-f6
  if (face >= 1 && face <= 6) {
    return `f${face}`;
  }

  return null;
}

/**
 * Get handle ID for MTPLJUN node based on junction number and direction
 */
export function getMtpljunHandleId(junctionNumber: number, direction: 'source' | 'target'): string {
  return `${direction}-j${junctionNumber}`;
}

/**
 * Get handle ID for any node type based on volume ID (legacy - for backward compatibility)
 */
export function getHandleIdForVolume(
  node: Node<MARSNodeData>,
  volumeId: string
): { handleId: string; handleType: 'source' | 'target' } | null {
  const parsed = parseVolumeId(volumeId);
  if (!parsed.isValid) return null;

  // Face 0 (Old Format): 모든 볼륨 노드 공통 → 'auto-connect' hidden center 핸들
  if (parsed.face === 0) {
    return { handleId: 'auto-connect', handleType: parsed.cellNumber === 0 ? 'target' : 'source' };
  }

  const componentType = node.data.componentType;

  switch (componentType) {
    case 'pipe': {
      // PIPE now uses meta-handles (f1~f6) instead of cell-specific handles
      // Face 1 = inlet = f1 = target, Face 2 = outlet = f2 = source
      // Face 3~6 = side connections = f3~f6 = source
      const handleId = getPipeHandleId(node.data.componentId, parsed.cellNumber, parsed.face);
      if (!handleId) return null;

      // Face 1 = inlet = target, Face 2-6 = outlet/side = source
      const handleType = parsed.face === 1 ? 'target' : 'source';
      return { handleId, handleType };
    }

    case 'snglvol':
    case 'tmdpvol': {
      // Single volume components: face 1 = inlet (target), face 2 = outlet (source)
      if (parsed.face === 1) {
        return { handleId: 'inlet', handleType: 'target' };
      } else if (parsed.face === 2) {
        return { handleId: 'outlet', handleType: 'source' };
      }
      return null;
    }

    case 'branch':
    case 'tank': {
      // Branch/Tank faces (1-6) - determined by junction configuration
      // For now, we'll return generic face handles
      // The actual direction (inlet/outlet) is in the junction data
      return { handleId: `face-${parsed.face}`, handleType: 'target' }; // Placeholder
    }

    default:
      return null;
  }
}

/**
 * Get handle ID for any node type based on VolumeReference (new ID management system)
 */
export function getHandleIdForVolumeReference(
  node: Node<MARSNodeData>,
  ref: VolumeReference
): { handleId: string; handleType: 'source' | 'target' } | null {
  // Face 0 (Old Format): use auto-connect hidden center handle
  // volumeNum=0 → Inlet Side (source from this node), volumeNum=1 → Outlet Side (source from this node)
  if (ref.face === 0) {
    return { handleId: 'auto-connect', handleType: ref.volumeNum === 0 ? 'target' : 'source' };
  }

  const componentType = node.data.componentType;

  switch (componentType) {
    case 'pipe': {
      // PIPE uses meta-handles (f1~f6)
      const handleId = `f${ref.face}`;
      // Face 1 = inlet = target, Face 2-6 = outlet/side = source
      const handleType = ref.face === 1 ? 'target' : 'source';
      return { handleId, handleType };
    }

    case 'snglvol':
    case 'tmdpvol':
    case 'pump': {
      // Single volume / pump components: face 1 = inlet (target), face 2-6 = outlet/crossflow (source)
      if (ref.face === 1) {
        return { handleId: 'inlet', handleType: 'target' };
      } else if (ref.face >= 2 && ref.face <= 6) {
        return { handleId: 'outlet', handleType: 'source' };
      }
      return null;
    }

    case 'branch':
    case 'tank': {
      // Branch/Tank faces (1-6)
      return { handleId: `face-${ref.face}`, handleType: 'target' }; // Placeholder
    }

    case 'separatr': {
      // Separator has 3 fixed junctions with handle IDs: source-j1/target-j1, etc.
      // volumeNum maps to junction number (1-3)
      if (ref.volumeNum >= 1 && ref.volumeNum <= 3) {
        // Face 1 = inlet = target, Face 2 = outlet = source
        const handleType = ref.face === 2 ? 'source' : 'target';
        return { handleId: `${handleType}-j${ref.volumeNum}`, handleType };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Create ReactFlow edges from MTPLJUN junction connections
 * Returns array of new edges to add
 */
export function createEdgesFromMtpljunJunctions(
  mtpljunNode: Node<MARSNodeData>,
  nodes: Node<MARSNodeData>[],
  existingEdges: Edge<MARSEdgeData>[]
): Edge<MARSEdgeData>[] {
  if (mtpljunNode.data.componentType !== 'mtpljun') {
    console.warn('[EdgeSync] Node is not MTPLJUN type');
    return [];
  }

  const params = mtpljunNode.data.parameters as any;
  if (!params || !params.junctions) {
    console.warn('[EdgeSync] MTPLJUN node has no junctions');
    return [];
  }

  const newEdges: Edge<MARSEdgeData>[] = [];
  const mtpljunNodeId = mtpljunNode.id;

  // Process each junction
  for (const junction of params.junctions) {
    const { junctionNumber, from, to } = junction;

    if (!from && !to) {
      // No connections for this junction
      continue;
    }

    // Parse volume IDs
    const parsedFrom = from ? parseVolumeId(from) : null;
    const parsedTo = to ? parseVolumeId(to) : null;

    // Find source and target nodes
    const fromNode = parsedFrom?.isValid ? findNodeByComponentId(nodes, parsedFrom.componentId) : null;
    const toNode = parsedTo?.isValid ? findNodeByComponentId(nodes, parsedTo.componentId) : null;

    // Get MTPLJUN handle IDs
    const mtpljunTargetHandle = getMtpljunHandleId(junctionNumber, 'target'); // Left side (from)
    const mtpljunSourceHandle = getMtpljunHandleId(junctionNumber, 'source'); // Right side (to)

    // Create edge from "from" volume to MTPLJUN (if exists)
    if (fromNode && parsedFrom) {
      const fromHandleInfo = getHandleIdForVolume(fromNode, from);

      if (fromHandleInfo) {
        const edgeId = `e-${fromNode.id}-${fromHandleInfo.handleId}-to-${mtpljunNodeId}-${mtpljunTargetHandle}`;

        // Check if edge already exists
        const edgeExists = existingEdges.some(e => e.id === edgeId);

        if (!edgeExists) {
          // VolumeReference 생성
          const fromVolume: VolumeReference = {
            nodeId: fromNode.id,
            volumeNum: parsedFrom.cellNumber,
            face: parsedFrom.face,
          };

          const toVolume: VolumeReference = {
            nodeId: mtpljunNodeId,
            volumeNum: junctionNumber,
            face: 1, // MTPLJUN inlet (left side)
          };

          const newEdge: Edge<MARSEdgeData> = {
            id: edgeId,
            source: fromNode.id,
            sourceHandle: fromHandleInfo.handleId,
            target: mtpljunNodeId,
            targetHandle: mtpljunTargetHandle,
            type: 'smoothstep',
            animated: false,
            data: {
              connectionType: 'axial',
              fromVolume,
              toVolume,
              junctionNodeId: mtpljunNodeId,
              junctionNumber,
              // Legacy (migration용)
              junctionId: mtpljunNode.data.componentId,
              volumeIdFrom: from,
              volumeIdTo: undefined,
            },
          };

          newEdges.push(newEdge);
          console.log('[EdgeSync] Created edge FROM:', fromNode.data.componentId, '→', mtpljunNode.data.componentId);
        }
      }
    }

    // Create edge from MTPLJUN to "to" volume (if exists)
    if (toNode && parsedTo) {
      const toHandleInfo = getHandleIdForVolume(toNode, to);

      if (toHandleInfo) {
        const edgeId = `e-${mtpljunNodeId}-${mtpljunSourceHandle}-to-${toNode.id}-${toHandleInfo.handleId}`;

        // Check if edge already exists
        const edgeExists = existingEdges.some(e => e.id === edgeId);

        if (!edgeExists) {
          // VolumeReference 생성
          const fromVolume: VolumeReference = {
            nodeId: mtpljunNodeId,
            volumeNum: junctionNumber,
            face: 2, // MTPLJUN outlet (right side)
          };

          const toVolume: VolumeReference = {
            nodeId: toNode.id,
            volumeNum: parsedTo.cellNumber,
            face: parsedTo.face,
          };

          const newEdge: Edge<MARSEdgeData> = {
            id: edgeId,
            source: mtpljunNodeId,
            sourceHandle: mtpljunSourceHandle,
            target: toNode.id,
            targetHandle: toHandleInfo.handleId,
            type: 'smoothstep',
            animated: false,
            data: {
              connectionType: 'axial',
              fromVolume,
              toVolume,
              junctionNodeId: mtpljunNodeId,
              junctionNumber,
              // Legacy (migration용)
              junctionId: mtpljunNode.data.componentId,
              volumeIdFrom: undefined,
              volumeIdTo: to,
            },
          };

          newEdges.push(newEdge);
          console.log('[EdgeSync] Created edge TO:', mtpljunNode.data.componentId, '→', toNode.data.componentId);
        }
      }
    }
  }

  return newEdges;
}

/**
 * Remove edges connected to MTPLJUN node
 * Used when clearing junction connections
 */
export function removeMtpljunEdges(
  mtpljunNodeId: string,
  existingEdges: Edge<MARSEdgeData>[]
): Edge<MARSEdgeData>[] {
  return existingEdges.filter(edge =>
    edge.source !== mtpljunNodeId && edge.target !== mtpljunNodeId
  );
}
