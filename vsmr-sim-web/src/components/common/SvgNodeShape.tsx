/**
 * SvgNodeShape - SVG 기반 렌더링 컴포넌트
 * P&ID 프리셋 심볼 (배경색 오버라이드) + Custom SVG (원본 색상 유지)
 * 선택적으로 SVG 실루엣 내부에 셀 구분선(점선) 오버레이 지원
 */

import { useMemo } from 'react';
import { Box } from '@mui/material';
import { NodeShape } from '@/types/mars';
import { PID_SVG_PATHS } from '@/utils/nodeAppearance';

interface CellDividers {
  count: number;                    // 셀 수 (divider = count - 1개)
  direction: 'row' | 'column';     // row = 좌→우, column = 위→아래
}

interface SvgNodeShapeProps {
  shape: NodeShape;
  width: number;
  height: number;
  backgroundColor: string;
  svgMarkup?: string;       // Custom SVG 전체 마크업 (라이브러리에서 조회된 값)
  svgViewBox?: string;      // Custom SVG viewBox (reserved)
  selected?: boolean;
  children?: React.ReactNode;
  dividers?: CellDividers;  // 셀 구분선 (Pipe 등)
}

export default function SvgNodeShape({
  shape,
  width,
  height,
  backgroundColor,
  svgMarkup,
  svgViewBox: _svgViewBox,
  selected = false,
  children,
  dividers,
}: SvgNodeShapeProps) {
  const strokeColor = selected ? '#1976d2' : '#bdbdbd';
  const strokeWidth = selected ? 1.5 : 0.8;

  // P&ID 프리셋 심볼
  const preset = PID_SVG_PATHS[shape];

  // Custom SVG: 전체 마크업을 dangerouslySetInnerHTML로 렌더링
  const isCustomMarkup = shape === 'custom' && svgMarkup;

  // Custom SVG 마크업에서 width/height를 100%로 강제 변환
  const scaledSvgMarkup = useMemo(() => {
    if (!isCustomMarkup || !svgMarkup) return '';
    let markup = svgMarkup;
    markup = markup.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
      let newAttrs = attrs;
      newAttrs = newAttrs.replace(/\s*width\s*=\s*["'][^"']*["']/gi, '');
      newAttrs = newAttrs.replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');
      newAttrs = newAttrs.replace(/\s*preserveAspectRatio\s*=\s*["'][^"']*["']/gi, '');
      return `<svg${newAttrs} width="100%" height="100%" preserveAspectRatio="none">`;
    });
    return markup;
  }, [isCustomMarkup, svgMarkup]);

  // CSS mask용 data URL (SVG 실루엣으로 클리핑)
  const maskDataUrl = useMemo(() => {
    if (!scaledSvgMarkup || !dividers || dividers.count <= 1) return '';
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaledSvgMarkup)}")`;
  }, [scaledSvgMarkup, dividers]);

  return (
    <Box
      sx={{
        width,
        height,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {isCustomMarkup ? (
        /* Custom SVG: 원본 색상 유지, 전체 마크업 렌더링 */
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            '& svg': {
              width: '100%',
              height: '100%',
              display: 'block',
            },
          }}
          dangerouslySetInnerHTML={{ __html: scaledSvgMarkup }}
          aria-hidden="true"
        />
      ) : (
        /* P&ID 프리셋 심볼: 배경색 오버라이드 */
        <svg
          viewBox={preset?.viewBox ?? '0 0 100 100'}
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          aria-hidden="true"
        >
          {(preset?.paths ?? []).map((d, i) => (
            <path
              key={i}
              d={d}
              fill={backgroundColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {/* 셀 구분선 오버레이 - SVG 실루엣 내부에만 표시 (CSS mask) */}
      {dividers && dividers.count > 1 && maskDataUrl && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            maskImage: maskDataUrl,
            WebkitMaskImage: maskDataUrl,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            display: 'flex',
            flexDirection: dividers.direction,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {Array.from({ length: dividers.count }, (_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                boxSizing: 'border-box',
                ...(i < dividers.count - 1
                  ? dividers.direction === 'row'
                    ? { borderRight: '1px dashed rgba(0,0,0,0.35)' }
                    : { borderBottom: '1px dashed rgba(0,0,0,0.35)' }
                  : {}),
              }}
            />
          ))}
        </Box>
      )}

      {/* 텍스트 레이블 오버레이 */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
