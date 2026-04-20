/**
 * NodeContextMenu
 * 에디터 캔버스에서 노드 우클릭 시 표시되는 컨텍스트 메뉴.
 * z-index(앞/뒤 순서) 제어 기능 제공.
 */

import { memo, useCallback } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  FlipToFront as FlipToFrontIcon,
  FlipToBack as FlipToBackIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useStore } from '@/stores/useStore';

interface NodeContextMenuProps {
  open: boolean;
  position: { x: number; y: number } | null;
  nodeId: string | null;
  onClose: () => void;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  open,
  position,
  nodeId,
  onClose,
}) => {
  const nodes = useStore((s) => s.nodes);
  const setNodeZIndex = useStore((s) => s.setNodeZIndex);

  const handleZIndex = useCallback(
    (action: 'front' | 'forward' | 'backward' | 'back') => {
      if (!nodeId) return;

      const allZIndexes = nodes.map((n) => n.zIndex ?? 0);
      const currentZ = nodes.find((n) => n.id === nodeId)?.zIndex ?? 0;
      const maxZ = Math.max(...allZIndexes);
      const minZ = Math.min(...allZIndexes);

      let newZ: number;
      switch (action) {
        case 'front':
          newZ = maxZ + 1;
          break;
        case 'forward':
          newZ = currentZ + 1;
          break;
        case 'backward':
          newZ = currentZ - 1;
          break;
        case 'back':
          newZ = minZ - 1;
          break;
      }

      setNodeZIndex(nodeId, newZ);
      onClose();
    },
    [nodeId, nodes, setNodeZIndex, onClose],
  );

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ? { top: position.y, left: position.x } : undefined}
    >
      <MenuItem onClick={() => handleZIndex('front')}>
        <ListItemIcon>
          <FlipToFrontIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>맨 앞으로</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => handleZIndex('forward')}>
        <ListItemIcon>
          <ArrowUpwardIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>앞으로</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => handleZIndex('backward')}>
        <ListItemIcon>
          <ArrowDownwardIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>뒤로</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => handleZIndex('back')}>
        <ListItemIcon>
          <FlipToBackIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>맨 뒤로</ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default memo(NodeContextMenu);
