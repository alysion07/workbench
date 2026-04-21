/**
 * Node ID Migration Utility
 * Converts legacy cmp_XXXXXXX node IDs to node_{random} format.
 * Applied automatically on project load for backward compatibility.
 */

import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData } from '@/types/mars';
import { generateNodeId } from './nodeIdGenerator';

/** Check if a node ID uses the legacy cmp_ format */
export function isLegacyCmpId(id: string): boolean {
  return /^cmp_\d+$/.test(id);
}

/** Build old→new ID mapping table for all legacy cmp_ nodes */
export function buildNodeIdMapping(
  nodes: Array<{ id: string }>,
): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const node of nodes) {
    if (isLegacyCmpId(node.id)) {
      mapping.set(node.id, generateNodeId());
    }
  }
  return mapping;
}

/**
 * Recursively replace node ID values in an object.
 * Only replaces string values that exist in the mapping AND are in known nodeId fields.
 */
function deepReplaceNodeIds(obj: unknown, mapping: Map<string, string>): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => deepReplaceNodeIds(item, mapping));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string' && mapping.has(value)) {
      // Known fields that store node IDs
      if (
        key === 'nodeId' ||
        key === 'heatStructureNodeId' ||
        key === 'sourceNodeId' ||
        key === 'targetNodeId' ||
        key === 'fromNodeId' ||
        key === 'toNodeId'
      ) {
        result[key] = mapping.get(value)!;
        continue;
      }
    }
    result[key] = deepReplaceNodeIds(value, mapping);
  }
  return result;
}

/**
 * Migrate all cmp_ node IDs in a project's nodes, edges, and settings.
 * Returns the original objects unchanged if no migration is needed.
 */
export function migrateProjectNodeIds(
  nodes: Node<MARSNodeData>[],
  edges: Edge<MARSEdgeData>[],
  globalSettings?: unknown,
): {
  nodes: Node<MARSNodeData>[];
  edges: Edge<MARSEdgeData>[];
  globalSettings?: unknown;
  migrated: boolean;
} {
  const hasCmpNodes = nodes.some(n => isLegacyCmpId(n.id));
  if (!hasCmpNodes) {
    return { nodes, edges, globalSettings, migrated: false };
  }

  const mapping = buildNodeIdMapping(nodes);
  console.log('[Migration] Node ID mapping:', Object.fromEntries(mapping));

  // Migrate node IDs + deep-replace nodeId fields inside node.data
  const migratedNodes = nodes.map(n => ({
    ...n,
    id: mapping.get(n.id) ?? n.id,
    data: deepReplaceNodeIds(n.data, mapping) as MARSNodeData,
  }));

  // Migrate edge source/target + deep-replace nodeId fields inside edge.data
  const migratedEdges = edges.map(e => ({
    ...e,
    source: mapping.get(e.source) ?? e.source,
    target: mapping.get(e.target) ?? e.target,
    data: deepReplaceNodeIds(e.data, mapping) as MARSEdgeData,
  }));

  // Deep-replace nodeId fields inside globalSettings
  const migratedSettings = globalSettings
    ? deepReplaceNodeIds(globalSettings, mapping)
    : globalSettings;

  return {
    nodes: migratedNodes,
    edges: migratedEdges,
    globalSettings: migratedSettings,
    migrated: true,
  };
}
