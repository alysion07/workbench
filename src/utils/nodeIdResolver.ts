/**
 * Node ID Resolver
 * Central utility for resolving component IDs and generating VolumeIds
 * Uses immutable node.id as the single source of truth
 */

import { Node } from 'reactflow';
import { MARSNodeData, VolumeReference } from '@/types/mars';

export class NodeIdResolver {
  private nodeMap: Map<string, Node<MARSNodeData>>;
  private componentIdMap: Map<string, Node<MARSNodeData>>; // shortId (first 3 digits) -> Node

  constructor(nodes: Node<MARSNodeData>[]) {
    this.nodeMap = new Map();
    this.componentIdMap = new Map();

    // Build lookup maps
    nodes.forEach(node => {
      this.nodeMap.set(node.id, node);

      // Index by component ID prefix (first 3 digits)
      const componentId = node.data.componentId;
      if (componentId && componentId.length >= 3) {
        const shortId = componentId.slice(0, 3);
        // If multiple nodes share same prefix, last one wins (shouldn't happen in practice)
        this.componentIdMap.set(shortId, node);
      }
    });
  }

  /**
   * Get component ID for a node ID
   */
  getComponentId(nodeId: string): string | null {
    const node = this.nodeMap.get(nodeId);
    return node?.data.componentId || null;
  }

  /**
   * Get short component ID (first 3 digits) for a node ID
   */
  getShortComponentId(nodeId: string): string | null {
    const componentId = this.getComponentId(nodeId);
    if (!componentId || componentId.length < 3) {
      return null;
    }
    return componentId.slice(0, 3);
  }

  /**
   * Get node by node ID
   */
  getNode(nodeId: string): Node<MARSNodeData> | null {
    return this.nodeMap.get(nodeId) || null;
  }

  /**
   * Find node by component ID prefix (first 3 digits)
   */
  findNodeByComponentId(shortId: string): Node<MARSNodeData> | null {
    return this.componentIdMap.get(shortId) || null;
  }

  /**
   * Generate VolumeId string from VolumeReference
   * Format: CCCVVFFFF (for general use) or CCCVV000N (for TMDPJUN/MTPLJUN compatibility)
   * - CCC: Component ID prefix (first 3 digits)
   * - VV: Volume number (01-99)
   * - FFFF: Face (0000=center, 0001=inlet, 0002=outlet, 0003-0006=crossflow)
   * - 000N: Face in compact format (N=0-6, for TMDPJUN/MTPLJUN)
   * 
   * Note: For compatibility with TMDPJUN/MTPLJUN forms that expect CCCVV000N format,
   * this function generates CCCVV000N format (last 1 digit is face).
   */
  getVolumeId(nodeId: string, volumeNum: number, face: number): string | null {
    const shortId = this.getShortComponentId(nodeId);
    if (!shortId) {
      return null;
    }

    // Validate face (0-6: 0=legacy/auto, 1=inlet, 2=outlet, 3-6=crossflow)
    if (face < 0 || face > 6) {
      return null;
    }

    // Legacy format (face=0): CCCVV0000
    // Any volumeNum 0-99 is valid (e.g., 160020000 = CCC=160, VV=02, face=0000)
    if (face === 0) {
      if (volumeNum < 0 || volumeNum > 99) {
        return null;
      }
      const vv = volumeNum.toString().padStart(2, '0');
      return `${shortId}${vv}0000`;
    }

    // Validate volumeNum (1-99) for expanded format
    if (volumeNum < 1 || volumeNum > 99) {
      return null;
    }

    const vv = volumeNum.toString().padStart(2, '0');
    // Use CCCVV000N format for compatibility with TMDPJUN/MTPLJUN
    // Format: CCC + VV + 000 + N (where N is face 0-6)
    return `${shortId}${vv}000${face}`;
  }

  /**
   * Generate VolumeId from VolumeReference object
   */
  getVolumeIdFromReference(ref: VolumeReference): string | null {
    return this.getVolumeId(ref.nodeId, ref.volumeNum, ref.face);
  }

  /**
   * Parse VolumeId string to VolumeReference
   * Supports both CCCVVFFFF and CCCVV000N formats
   * Returns null if node not found or invalid format
   */
  parseVolumeId(volumeId: string): VolumeReference | null {
    if (!volumeId || volumeId.length !== 9 || !/^\d{9}$/.test(volumeId)) {
      return null;
    }

    const shortId = volumeId.slice(0, 3);
    const vv = volumeId.slice(3, 5);

    // Try CCCVV000N format first (last 1 digit is face)
    const faceStr = volumeId.slice(8, 9);
    let face = parseInt(faceStr, 10);

    // If face is 0-6 and positions 5-7 are "000", it's CCCVV000N format
    if (volumeId.slice(5, 8) === '000' && face >= 0 && face <= 6) {
      // CCCVV000N format confirmed
      const volumeNum = parseInt(vv, 10);

      // Validate: face=0 (old format CCCVV0000) allows volumeNum 0-99, otherwise 1-99
      if (isNaN(volumeNum) || isNaN(face)) {
        return null;
      }
      if (face === 0 && (volumeNum < 0 || volumeNum > 99)) {
        return null;
      }
      if (face !== 0 && (volumeNum < 1 || volumeNum > 99)) {
        return null;
      }

      // Find node by component ID prefix
      const node = this.findNodeByComponentId(shortId);
      if (!node) {
        return null;
      }

      return {
        nodeId: node.id,
        volumeNum,
        face,
      };
    }

    // Fallback to CCCVVFFFF format (last 4 digits are face)
    const ffff = volumeId.slice(5, 9);
    face = parseInt(ffff, 10);
    const volumeNum = parseInt(vv, 10);

    // Validate
    if (isNaN(volumeNum) || isNaN(face) || volumeNum < 1 || volumeNum > 99 || face < 0 || face > 6) {
      return null;
    }

    // Find node by component ID prefix
    const node = this.findNodeByComponentId(shortId);
    if (!node) {
      return null;
    }

    return {
      nodeId: node.id,
      volumeNum,
      face,
    };
  }

  /**
   * Validate that a node exists
   */
  validateNodeExists(nodeId: string): boolean {
    return this.nodeMap.has(nodeId);
  }

  /**
   * Validate VolumeReference
   */
  validateVolumeReference(ref: VolumeReference): boolean {
    if (!this.validateNodeExists(ref.nodeId)) {
      return false;
    }

    // Face 0 (old format CCCVV0000): volumeNum 0-99 allowed
    if (ref.face === 0) {
      return ref.volumeNum >= 0 && ref.volumeNum <= 99;
    }

    if (ref.volumeNum < 1 || ref.volumeNum > 99) {
      return false;
    }

    if (ref.face < 0 || ref.face > 6) {
      return false;
    }

    return true;
  }

  /**
   * Get display label for a VolumeReference
   * Format: "120010001 (pipe_120, Volume 01, Face 1)"
   */
  getVolumeLabel(ref: VolumeReference): string {
    const volumeId = this.getVolumeIdFromReference(ref);
    const node = this.getNode(ref.nodeId);
    const nodeName = node?.data.componentName || 'Unknown';

    if (!volumeId) {
      return `Invalid (${ref.nodeId})`;
    }

    if (ref.face === 0) {
      const side = ref.volumeNum === 0 ? 'Inlet Side' : 'Outlet Side';
      return `${volumeId} (${nodeName}, ${side})`;
    }
    return `${volumeId} (${nodeName}, Volume ${ref.volumeNum.toString().padStart(2, '0')}, Face ${ref.face})`;
  }
}







