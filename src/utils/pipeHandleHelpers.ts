/**
 * PIPE Handle ID Utilities
 * Helper functions for cell-based handle ID system
 */

import { Edge } from 'reactflow';
import { MARSEdgeData } from '@/types/mars';

/**
 * Cell Handle ID Format: cell-{cellNum}-face-{faceNum}
 * Example: cell-1-face-1, cell-5-face-3
 */

/**
 * Generate cell handle ID from cell number and face
 */
export function generateCellHandleId(cellNum: number, face: number): string {
  return `cell-${cellNum}-face-${face}`;
}

/**
 * Parse cell handle ID to extract cell number and face
 */
export function parseCellHandleId(handleId: string): { cellNum: number; face: number } | null {
  const match = handleId.match(/^cell-(\d+)-face-([1-6])$/);
  if (!match) return null;
  return { cellNum: parseInt(match[1]), face: parseInt(match[2]) };
}

/**
 * Generate Volume ID (CCCVV000N) from component ID, cell number, and face
 */
export function generateVolumeIdFromHandle(
  componentId: string,
  cellNum: number,
  face: number
): string {
  const ccc = componentId.slice(0, 3);
  const vv = cellNum.toString().padStart(2, '0');
  return `${ccc}${vv}000${face}`;
}

/**
 * Convert meta-handle (f1-f6) to cell handle ID (for backward compatibility)
 */
export function convertMetaHandleToCellHandle(
  metaHandleId: string,
  defaultCellNum: number = 1
): string {
  const match = metaHandleId.match(/^f([1-6])$/);
  if (!match) return metaHandleId;
  const face = parseInt(match[1]);
  return generateCellHandleId(defaultCellNum, face);
}

/**
 * Parse Volume ID (CCCVV000N) to extract component ID, volume number, and face
 */
export function parseVolumeId(volumeId: string): {
  componentId: string;
  volumeNum: number;
  face: number;
} | null {
  // CCCVV000N 형식
  if (volumeId.length !== 9) return null;

  const ccc = volumeId.slice(0, 3);
  const vv = volumeId.slice(3, 5);
  const n = volumeId.slice(8, 9);

  return {
    componentId: ccc,
    volumeNum: parseInt(vv),
    face: parseInt(n),
  };
}

/**
 * Cell connection information
 */
export interface CellConnectionInfo {
  cellNum: number;
  hasConnection: boolean;
  connectedFaces: number[];
}

/**
 * Calculate connection status for each cell in a PIPE node
 */
export function calculateCellConnections(
  nodeId: string,
  ncells: number,
  edges: Edge<MARSEdgeData>[]
): CellConnectionInfo[] {
  const connections: CellConnectionInfo[] = [];

  for (let cellNum = 1; cellNum <= ncells; cellNum++) {
    const connectedFaces: number[] = [];

    edges.forEach(edge => {
      // edge.data 기반 연결 확인 (우선순위)
      if (edge.data?.fromVolume || edge.data?.toVolume) {
        // Source 연결 확인 (이 노드가 source인 경우)
        if (edge.source === nodeId && edge.data.fromVolume) {
          if (edge.data.fromVolume.nodeId === nodeId && edge.data.fromVolume.volumeNum === cellNum) {
            connectedFaces.push(edge.data.fromVolume.face);
          }
        }

        // Target 연결 확인 (이 노드가 target인 경우)
        if (edge.target === nodeId && edge.data.toVolume) {
          if (edge.data.toVolume.nodeId === nodeId && edge.data.toVolume.volumeNum === cellNum) {
            connectedFaces.push(edge.data.toVolume.face);
          }
        }
      } else {
        // Fallback: handle ID 파싱 (legacy 지원)
        // Source 핸들 확인
        if (edge.source === nodeId) {
          const handleInfo = parseCellHandleId(edge.sourceHandle || '');
          if (handleInfo && handleInfo.cellNum === cellNum) {
            connectedFaces.push(handleInfo.face);
          }
        }

        // Target 핸들 확인
        if (edge.target === nodeId) {
          const handleInfo = parseCellHandleId(edge.targetHandle || '');
          if (handleInfo && handleInfo.cellNum === cellNum) {
            connectedFaces.push(handleInfo.face);
          }
        }
      }
    });

    connections.push({
      cellNum,
      hasConnection: connectedFaces.length > 0,
      connectedFaces: [...new Set(connectedFaces)],
    });
  }

  return connections;
}

/**
 * Get face color for visualization
 */
export function getFaceColor(face: number): string {
  if (face === 0) return '#9c27b0'; // Face 0: Purple (Legacy/Old Format)
  const faceColors = [
    '#4caf50',  // Face 1: Green (Inlet)
    '#2196f3',  // Face 2: Blue (Outlet)
    '#ff9800',  // Face 3: Orange
    '#9c27b0',  // Face 4: Purple
    '#f44336',  // Face 5: Red
    '#00bcd4',  // Face 6: Cyan
  ];
  return faceColors[face - 1] || '#bdbdbd';
}

/**
 * Get face description for tooltip
 */
export function getFaceDescription(face: number, cellNum?: number): string {
  if (face === 0) {
    const side = cellNum === 0 ? 'Inlet Side' : cellNum === 1 ? 'Outlet Side' : 'Auto';
    return `Face 0 (Old Format, ${side})`;
  }
  const cellInfo = cellNum !== undefined && cellNum >= 1 ? `Cell ${cellNum.toString().padStart(2, '0')} · ` : '';
  const faceDescriptions = [
    'Face 1 (x−, Inlet)',
    'Face 2 (x+, Outlet)',
    'Face 3 (y−, CF)',
    'Face 4 (y+, CF)',
    'Face 5 (z−, CF)',
    'Face 6 (z+, CF)',
  ];
  return cellInfo + (faceDescriptions[face - 1] || `Face ${face}`);
}

