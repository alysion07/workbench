/**
 * Edge Label Formatting Utilities
 * Formats edge labels for multi-cell connections and crossflow connections
 */

import { MultiCellConnectionSpec, SideConnectionSpec, ConnectionConfig } from '@/types/mars';

/**
 * Format multi-cell connection edge label
 * (구 formatSideEdgeLabel - MARS 명세와 일치하도록 이름 변경)
 *
 * Examples:
 * - Single cell: "v02 · F3↔F4"
 * - Multiple cells: "v02,04,06 · F3↔F4" or "v02–06(3) · F3↔F4"
 */
export function formatMultiCellEdgeLabel(spec: MultiCellConnectionSpec): string {
  const { cells, fromFace, toFace } = spec;

  if (!cells || cells.length === 0) {
    return `F${fromFace}↔F${toFace}`;
  }

  // Format cell list
  let cellStr = '';
  if (cells.length === 1) {
    cellStr = `v${cells[0].toString().padStart(2, '0')}`;
  } else if (cells.length <= 3) {
    // Short list: v02,04,06
    cellStr = cells.map(c => `v${c.toString().padStart(2, '0')}`).join(',');
  } else {
    // Long list: v02–06(5) or v02,04,06,08,10
    const sorted = [...cells].sort((a, b) => a - b);
    const isConsecutive = sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1);

    if (isConsecutive && sorted.length > 3) {
      cellStr = `v${sorted[0].toString().padStart(2, '0')}–${sorted[sorted.length - 1].toString().padStart(2, '0')}(${sorted.length})`;
    } else {
      cellStr = cells.map(c => `v${c.toString().padStart(2, '0')}`).join(',');
    }
  }

  return `${cellStr} · F${fromFace}↔F${toFace}`;
}

/**
 * @deprecated Use formatMultiCellEdgeLabel instead
 * 하위 호환성을 위해 유지
 */
export function formatSideEdgeLabel(spec: SideConnectionSpec): string {
  return formatMultiCellEdgeLabel(spec);
}

/**
 * Format crossflow connection edge label
 * Examples:
 * - "v02·F3 → v01·F5"
 * - "v01·F4 → v03·F2"
 */
export function formatCrossflowEdgeLabel(config: ConnectionConfig): string {
  const { sourceCell, sourceFace, targetCell, targetFace } = config;

  const sourceStr = `v${sourceCell.toString().padStart(2, '0')}·F${sourceFace}`;
  const targetStr = `v${targetCell.toString().padStart(2, '0')}·F${targetFace}`;

  return `${sourceStr} → ${targetStr}`;
}
