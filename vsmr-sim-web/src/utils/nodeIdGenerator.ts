/**
 * Node ID Generator
 * Generates unique, opaque ReactFlow node IDs decoupled from componentId.
 * Format: node_{8 hex chars} (e.g., "node_a1b2c3d4")
 */

export function generateNodeId(): string {
  const uuid = crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  return `node_${uuid.replace(/-/g, '').slice(0, 8)}`;
}
