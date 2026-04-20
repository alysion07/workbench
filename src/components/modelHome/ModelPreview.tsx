/**
 * ModelPreview Component
 * MDH-001: ReactFlow 노드 다이어그램 미리보기 (읽기 전용)
 *
 * - nodes, edges를 받아 미니 ReactFlow 렌더링
 * - fitView, 인터랙션 비활성화
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper, Chip, Stack } from '@mui/material';
import { AccessTime as AccessTimeIcon } from '@mui/icons-material';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface ModelPreviewProps {
  nodes: Node[];
  edges: Edge[];
  title?: string;
  updatedAt?: string;
}

// 노드 타입별 표시명 및 색상
const nodeTypeConfig: Record<string, { label: string; color: string }> = {
  snglvol: { label: 'SNGLVOL', color: '#4caf50' },
  sngljun: { label: 'SNGLJUN', color: '#ff9800' },
  pipe: { label: 'PIPE', color: '#2196f3' },
  tmdpvol: { label: 'TMDPVOL', color: '#9c27b0' },
  tmdpjun: { label: 'TMDPJUN', color: '#e91e63' },
  branch: { label: 'BRANCH', color: '#00bcd4' },
  pump: { label: 'PUMP', color: '#ff5722' },
  valve: { label: 'VALVE', color: '#607d8b' },
  htstr: { label: 'HTSTR', color: '#795548' },
};

// 날짜 포맷팅
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 미니맵 노드 색상
const nodeColor = (node: Node): string => {
  const colorMap: Record<string, string> = {
    snglvol: '#4caf50',
    sngljun: '#ff9800',
    pipe: '#2196f3',
    tmdpvol: '#9c27b0',
    tmdpjun: '#e91e63',
    branch: '#00bcd4',
    pump: '#ff5722',
    valve: '#607d8b',
  };
  return colorMap[node.type || ''] || '#9e9e9e';
};

const ModelPreview: React.FC<ModelPreviewProps> = ({
  nodes,
  edges,
  title = 'Nodalization Diagram',
  updatedAt,
}) => {
  // 노드/엣지가 없는 경우 플레이스홀더 표시
  const isEmpty = useMemo(() => nodes.length === 0, [nodes]);

  // 노드 타입별 카운트 계산
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((node) => {
      const type = node.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [nodes]);

  // ReactFlow 기본 옵션
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      style: { strokeWidth: 2, stroke: '#b1b1b7' },
    }),
    []
  );

  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 2,
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {nodes.length} nodes, {edges.length} connections
            </Typography>
          </Box>
          {updatedAt && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(updatedAt)}
              </Typography>
            </Box>
          )}
        </Box>
        {/* 컴포넌트 종류 태그 */}
        {Object.keys(nodeTypeCounts).length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {Object.entries(nodeTypeCounts).map(([type, count]) => {
              const config = nodeTypeConfig[type] || { label: type.toUpperCase(), color: '#9e9e9e' };
              return (
                <Chip
                  key={type}
                  label={`${config.label}: ${count}`}
                  size="small"
                  sx={{
                    bgcolor: config.color,
                    color: '#fff',
                    fontSize: '0.7rem',
                    height: 22,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ReactFlow 미리보기 */}
      <Box sx={{ flex: 1, position: 'relative', minHeight: 300 }}>
        {isEmpty ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.100',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No nodes to display
            </Typography>
          </Box>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{
              padding: 0.2,
              includeHiddenNodes: false,
            }}
            // 읽기 전용 설정
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            preventScrolling={true}
            // 스타일
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e0e0e0" gap={16} />
            <Controls
              showInteractive={false}
              position="bottom-right"
              style={{ marginBottom: 8, marginRight: 8 }}
            />
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
              position="bottom-left"
              style={{ marginBottom: 8, marginLeft: 8 }}
            />
          </ReactFlow>
        )}
      </Box>
    </Paper>
  );
};

export default ModelPreview;
