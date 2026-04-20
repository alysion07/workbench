/**
 * Resizable Chart Card Component
 * 드래그 & 리사이즈 가능한 차트 카드
 */

import { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Fullscreen as FullscreenIcon,
  AspectRatio as AspectRatioIcon,
  MoreVert as MoreVertIcon,
  CenterFocusStrong as CenterFocusStrongIcon,
} from '@mui/icons-material';
import { useSimulationStore } from '@/stores/simulationStore';
import ChartCard from './ChartCard';
import type { ChartConfig, ChartSize } from '@/types/simulation';

interface ResizableChartCardProps {
  config: ChartConfig;
  data: Array<Record<string, any>>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  onLayoutChange?: (layout: { x: number; y: number; w: number; h: number }) => void;
  onDragStart?: () => void;
  onDragStop?: () => void;
  compareMode?: boolean;
  gridCols?: number; // 그리드 컬럼 수 (12, 8, 또는 4)
  compact?: boolean; // embedded 모드용 컴팩트 표시
}

const SIZE_ORDER: ChartSize[] = ['small', 'medium', 'large'];

/**
 * 그리드 컬럼 수에 따른 사이즈별 크기 계산
 */
const getSizeDimensions = (size: ChartSize, gridCols: number): { w: number; h: number } => {
  if (gridCols === 12) {
    // 3-column layout (xl)
    if (size === 'small') {
      return { w: 4, h: 3 }; // 1/3 width
    } else if (size === 'medium') {
      return { w: 8, h: 3 }; // 2/3 width
    } else {
      return { w: 8, h: 6 }; // large: 2/3 width, double height
    }
  } else if (gridCols === 8) {
    // 2-column layout (md)
    if (size === 'small') {
      return { w: 4, h: 3 }; // 1/2 width
    } else if (size === 'medium') {
      return { w: 8, h: 3 }; // full width
    } else {
      return { w: 8, h: 6 }; // large: full width, double height
    }
  } else {
    // 1-column layout (sm)
    if (size === 'small') {
      return { w: 4, h: 3 }; // full width
    } else if (size === 'medium') {
      return { w: 4, h: 3 }; // full width (same as small)
    } else {
      return { w: 4, h: 6 }; // large: full width, double height
    }
  }
};

export const ResizableChartCard: React.FC<ResizableChartCardProps> = ({
  config,
  data,
  layout,
  onLayoutChange,
  onDragStart,
  onDragStop,
  compareMode = false,
  gridCols = 12, // 기본값 12 (xl)
  compact = false,
}) => {
  const { favoriteChartIds, toggleFavorite, addToCompare, compareChartIds, chartYAxisModes, setChartYAxisMode } = useSimulationStore();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isFavorite = favoriteChartIds.has(config.id);
  const currentSize: ChartSize = config.size || 'small';
  const isInCompare = compareChartIds.includes(config.id);

  // Y축 모드 관리
  const cardNumber = config.minorEditCardNumber;
  const currentYAxisMode = cardNumber
    ? (chartYAxisModes[cardNumber] || config.yAxisMode || 'auto')
    : (config.yAxisMode || 'auto');

  const handleToggleYAxis = () => {
    if (cardNumber) {
      const newMode = currentYAxisMode === 'fixed' ? 'auto' : 'fixed';
      setChartYAxisMode(cardNumber, newMode);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 전파 방지
    toggleFavorite(config.id);
    setMenuAnchor(null);
  };

  const handleSizeChange = (newSize: ChartSize) => {
    // 그리드 컬럼 수에 맞는 정확한 크기 계산
    const { w, h } = getSizeDimensions(newSize, gridCols);
    
    if (onLayoutChange) {
      onLayoutChange({
        ...layout,
        w: w,
        h: h,
      });
    }
    
    // config의 size도 업데이트 (선택사항, 필요시)
    // config.size = newSize; // 직접 수정은 불가능하므로 상위 컴포넌트에서 처리 필요
    
    setMenuAnchor(null);
  };

  const handleAddToCompare = (position: 0 | 1) => (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 전파 방지
    addToCompare(config.id, position);
    setMenuAnchor(null);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setMenuAnchor(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // 이벤트 전파 방지
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const nextSize = SIZE_ORDER[(SIZE_ORDER.indexOf(currentSize) + 1) % SIZE_ORDER.length];

  const handleToggleYAxisClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 전파 방지
    handleToggleYAxis();
  };

  const handleSizeToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 전파 방지
    // 다음 사이즈로 토글
    handleSizeChange(nextSize);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        '&:hover .chart-controls': {
          opacity: 1,
        },
      }}
    >
      {/* Controls Overlay */}
      <Box
        className="chart-controls"
        onClick={(e) => e.stopPropagation()} // 컨트롤 영역 클릭 시 이벤트 전파 방지
        onMouseDown={(e) => e.stopPropagation()} // 마우스 다운 이벤트도 전파 방지
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          display: 'flex',
          gap: 0.5,
          opacity: 0,
          transition: 'opacity 0.2s',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 1,
          p: 0.5,
        }}
      >
        {/* Y-Axis Toggle (Fixed/Auto Scale) */}
        {cardNumber && (
          <Tooltip title={currentYAxisMode === 'auto' ? 'Auto Scale → Fixed Range' : 'Fixed Range → Auto Scale'}>
            <IconButton
              size="small"
              onClick={handleToggleYAxisClick}
              color={currentYAxisMode === 'auto' ? 'primary' : 'default'}
            >
              <CenterFocusStrongIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Favorite Toggle */}
        <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <IconButton size="small" onClick={handleToggleFavorite}>
            {isFavorite ? (
              <StarIcon fontSize="small" color="warning" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        {/* Size Toggle */}
        {!compareMode && (
          <Tooltip title={`Resize to ${nextSize}`}>
            <IconButton size="small" onClick={handleSizeToggleClick}>
              <AspectRatioIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Compare Mode Actions */}
        {compareMode && !isInCompare && (
          <>
            <Tooltip title="Add to left compare panel">
              <IconButton size="small" onClick={handleAddToCompare(0)}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add to right compare panel">
              <IconButton size="small" onClick={handleAddToCompare(1)}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {/* More Menu */}
        <Tooltip title="More options">
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem 
          onClick={(e) => {
            e.stopPropagation();
            handleSizeChange('small');
          }}
          selected={currentSize === 'small'}
        >
          Small ({gridCols === 12 ? '4x3' : gridCols === 8 ? '4x3' : '4x3'})
        </MenuItem>
        <MenuItem 
          onClick={(e) => {
            e.stopPropagation();
            handleSizeChange('medium');
          }}
          selected={currentSize === 'medium'}
        >
          Medium ({gridCols === 12 ? '8x3' : gridCols === 8 ? '8x3' : '4x3'})
        </MenuItem>
        <MenuItem 
          onClick={(e) => {
            e.stopPropagation();
            handleSizeChange('large');
          }}
          selected={currentSize === 'large'}
        >
          Large ({gridCols === 12 ? '8x6' : gridCols === 8 ? '8x6' : '4x6'})
        </MenuItem>
        <MenuItem 
          onClick={(e) => {
            e.stopPropagation();
            handleFullscreen();
          }}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </MenuItem>
      </Menu>

      {/* Chart Card */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: compareMode ? 'grab' : 'default',
          '&:active': {
            cursor: compareMode ? 'grabbing' : 'default',
          },
        }}
        draggable={compareMode}
        onDragStart={(e) => {
          if (compareMode) {
            e.stopPropagation(); // GridLayout의 드래그와 충돌 방지
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', config.id);
            e.dataTransfer.setData('chartId', config.id);
            // 드래그 중 시각적 피드백
            if (onDragStart) {
              onDragStart();
            }
          }
        }}
        onDragEnd={(e) => {
          if (compareMode) {
            e.stopPropagation();
            if (onDragStop) {
              onDragStop();
            }
          }
        }}
        onDrag={(e) => {
          if (compareMode) {
            e.stopPropagation();
          }
        }}
      >
        <ChartCard config={config} data={data} height="100%" showYAxisToggle={false} compact={compact} />
      </Box>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1400,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
          onClick={handleFullscreen}
        >
          <Box
            sx={{
              width: '90%',
              height: '90%',
              maxWidth: 1400,
              maxHeight: 900,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ChartCard config={config} data={data} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ResizableChartCard;

