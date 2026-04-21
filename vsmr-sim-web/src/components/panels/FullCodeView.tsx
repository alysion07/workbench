/**
 * Full Code View
 * FlowCanvas 옆에 전체 MARS 입력 파일을 표시하는 읽기 전용 Text Code Preview
 * - 컴포넌트 블록 클릭 → 캔버스 노드 이동/하이라이트
 * - 캔버스 노드 선택 → 코드 블록 자동 스크롤/컬러바
 */

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData, COMPONENT_CONFIGS, ComponentType } from '@/types/mars';
import { MARSInputFileGenerator, ComponentLineMapping } from '@/utils/fileGenerator';
import { useStore } from '@/stores/useStore';

interface CodeSegment {
  type: 'global' | 'component';
  startLine: number;
  endLine: number;
  mapping?: ComponentLineMapping;
}

interface FullCodeViewProps {
  codeHighlightNodeId?: string | null;
  onCodeBlockClick?: (nodeId: string) => void;
}

const FullCodeView: React.FC<FullCodeViewProps> = ({ codeHighlightNodeId, onCodeBlockClick }) => {
  const nodes = useStore(state => state.nodes);
  const edges = useStore(state => state.edges);
  const getGlobalSettings = useStore(state => state.getGlobalSettings);
  const globalSettings = getGlobalSettings();
  const projectName = useStore(state => state.metadata.projectName);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { fullText, componentLineMappings } = useMemo(() => {
    if (nodes.length === 0) return { fullText: '* No components to generate', componentLineMappings: [] as ComponentLineMapping[] };
    const generator = new MARSInputFileGenerator(nodes as Node<MARSNodeData>[]);
    const result = generator.generate(
      nodes as Node<MARSNodeData>[],
      edges as Edge<MARSEdgeData>[],
      projectName,
      globalSettings,
    );
    return {
      fullText: result.content || '* Generation failed',
      componentLineMappings: result.componentLineMappings || [],
    };
  }, [nodes, edges, projectName, globalSettings]);

  const lines = useMemo(() => fullText.split('\n'), [fullText]);
  const lineCount = lines.length;

  // 라인을 세그먼트(글로벌/컴포넌트 블록)로 분할
  const segments = useMemo<CodeSegment[]>(() => {
    if (componentLineMappings.length === 0) {
      return [{ type: 'global', startLine: 0, endLine: lines.length }];
    }

    const segs: CodeSegment[] = [];
    let cursor = 0;

    for (const mapping of componentLineMappings) {
      if (cursor < mapping.startLine) {
        segs.push({ type: 'global', startLine: cursor, endLine: mapping.startLine });
      }
      segs.push({ type: 'component', startLine: mapping.startLine, endLine: mapping.endLine, mapping });
      cursor = mapping.endLine;
    }

    if (cursor < lines.length) {
      segs.push({ type: 'global', startLine: cursor, endLine: lines.length });
    }

    return segs;
  }, [lines.length, componentLineMappings]);

  // 역방향: 캔버스에서 노드 선택 → 코드 스크롤 + 컬러바 + 플래시
  useEffect(() => {
    if (!codeHighlightNodeId) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(codeHighlightNodeId);
    setFlashNodeId(codeHighlightNodeId);

    const el = blockRefs.current.get(codeHighlightNodeId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const timer = setTimeout(() => setFlashNodeId(null), 1000);
    return () => clearTimeout(timer);
  }, [codeHighlightNodeId]);

  // 정방향: 코드 블록 클릭 → 캔버스 이동
  const handleBlockClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    onCodeBlockClick?.(nodeId);
  }, [onCodeBlockClick]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
  };

  const getComponentColor = (componentType: string): string => {
    const config = COMPONENT_CONFIGS[componentType as ComponentType];
    return config?.color || '#1976d2';
  };

  // 헤더 라인 판별 (구분선 *---...---* 또는 타이틀 * C335: ...)
  const isHeaderLine = (line: string): boolean => {
    return /^\*-{10,}\*?$/.test(line) || /^\* C\d{3}:/.test(line);
  };

  const setBlockRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) {
      blockRefs.current.set(nodeId, el);
    } else {
      blockRefs.current.delete(nodeId);
    }
  }, []);

  const renderLineNumbers = (startLine: number, endLine: number) => {
    const nums: string[] = [];
    for (let i = startLine; i < endLine; i++) {
      nums.push(`${i + 1}\n`);
    }
    return nums.join('');
  };

  const renderSegment = (seg: CodeSegment, idx: number) => {
    const segLines = lines.slice(seg.startLine, seg.endLine);

    if (seg.type === 'global') {
      return (
        <Box key={`global-${idx}`} sx={{ display: 'flex' }}>
          {/* 컬러바 공간 */}
          <Box sx={{ width: 3, flexShrink: 0 }} />
          {/* 라인 넘버 */}
          <Box
            sx={{
              flexShrink: 0,
              px: 1,
              textAlign: 'right',
              borderRight: '1px solid #3c3c3c',
              userSelect: 'none',
            }}
          >
            <pre style={lineNumberStyle}>
              {renderLineNumbers(seg.startLine, seg.endLine)}
            </pre>
          </Box>
          {/* 코드 */}
          <Box sx={{ flex: 1, px: 1.5 }}>
            <pre style={codeStyle}>
              {segLines.join('\n') + '\n'}
            </pre>
          </Box>
        </Box>
      );
    }

    // 컴포넌트 블록
    const mapping = seg.mapping!;
    const nodeId = mapping.nodeId;
    const isSelected = selectedNodeId === nodeId;
    const isFlashing = flashNodeId === nodeId;
    const color = getComponentColor(mapping.componentType);

    return (
      <Box
        key={`component-${nodeId}`}
        ref={(el: HTMLDivElement | null) => setBlockRef(nodeId, el)}
        onClick={() => handleBlockClick(nodeId)}
        sx={{
          display: 'flex',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s ease',
          backgroundColor: isFlashing
            ? 'rgba(25, 118, 210, 0.15)'
            : isSelected
              ? 'rgba(255, 255, 255, 0.03)'
              : 'transparent',
          animation: isFlashing ? 'codeBlockFlash 1s ease-out' : 'none',
          '&:hover': {
            backgroundColor: isSelected
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.05)',
          },
          '@keyframes codeBlockFlash': {
            '0%': { backgroundColor: 'rgba(25, 118, 210, 0.15)' },
            '100%': { backgroundColor: 'transparent' },
          },
        }}
      >
        {/* 컬러 바 */}
        <Box
          sx={{
            width: 3,
            flexShrink: 0,
            backgroundColor: isSelected ? color : 'transparent',
            transition: 'background-color 0.2s ease',
          }}
        />
        {/* 라인 넘버 */}
        <Box
          sx={{
            flexShrink: 0,
            px: 1,
            textAlign: 'right',
            borderRight: '1px solid #3c3c3c',
            userSelect: 'none',
          }}
        >
          <pre style={lineNumberStyle}>
            {renderLineNumbers(seg.startLine, seg.endLine)}
          </pre>
        </Box>
        {/* 코드 (헤더 라인 하이라이트) */}
        <Box sx={{ flex: 1, px: 1.5 }}>
          <pre style={codeStyle}>
            {segLines.map((line, i) => (
              <span
                key={i}
                style={{ color: isHeaderLine(line) ? '#569cd6' : '#d4d4d4' }}
              >
                {line + '\n'}
              </span>
            ))}
          </pre>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        borderLeft: '1px solid #3c3c3c',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          backgroundColor: '#252526',
          borderBottom: '1px solid #3c3c3c',
          flexShrink: 0,
          minHeight: 36,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ color: '#cccccc', fontWeight: 600, fontSize: '0.8rem' }}>
            Text Code Preview
          </Typography>
          <Typography sx={{ color: '#666', fontSize: '0.7rem' }}>
            {lineCount} lines
          </Typography>
        </Box>
        <Tooltip title="Copy to clipboard">
          <IconButton size="small" onClick={handleCopy} sx={{ color: '#cccccc' }}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Code content */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          pt: 1,
          pb: 1,
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#555', borderRadius: 4 },
          '&::-webkit-scrollbar-track': { backgroundColor: '#1e1e1e' },
        }}
      >
        {segments.map((seg, idx) => renderSegment(seg, idx))}
      </Box>
    </Box>
  );
};

const lineNumberStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Consolas', 'Courier New', monospace",
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#858585',
};

const codeStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Consolas', 'Courier New', monospace",
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#d4d4d4',
  whiteSpace: 'pre',
  tabSize: 4,
};

export default FullCodeView;
