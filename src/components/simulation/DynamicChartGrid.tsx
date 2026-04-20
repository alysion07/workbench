/**
 * Dynamic Chart Grid
 * Minor Edit 기반 동적 차트 생성 및 대시보드 레이아웃
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  AutoAwesome as AutoGroupIcon,
} from '@mui/icons-material';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { usePlotData, useSimulationStore } from '@/stores/simulationStore';
import ChartToolbar from './ChartToolbar';
import ChartSummaryCard from './ChartSummaryCard';
import ResizableChartCard from './ResizableChartCard';
import ChartComparePanel from './ChartComparePanel';
import type { Node } from 'reactflow';
import type { ChartConfig, ChartSummary } from '@/types/simulation';
import type { MinorEdit } from '@/types/mars';
import {
  generateChartsFromMinorEdits as buildCharts,
  generateChartsAutoGrouped as buildChartsAutoGrouped,
  transformPlotData,
} from '@/utils/chartConfigBuilder';

interface DynamicChartGridProps {
  taskId: string;
  nodes: Node[];
  minorEdits?: MinorEdit[];
  onOpenGlobalSettings?: () => void;
  /** Co-Sim All 탭: 특정 모델의 데이터를 직접 지정 */
  modelId?: string;
  /** full: 모니터링 탭 (기본), embedded: ICV 차트 패널 (탭+그리드만, Toolbar/Favorite/Compare 숨김) */
  mode?: 'full' | 'embedded';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: string;
  value: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`chart-tabpanel-${index}`}
      aria-labelledby={`chart-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

/**
 * Generate fallback charts from raw plotData (MinorEdit 미설정 시)
 */
function generateFallbackChartsFromPlotData(plotData: Array<Record<string, any>>): ChartConfig[] {
  if (!plotData || plotData.length === 0) return [];

  const keySet = new Set<string>();
  for (const point of plotData) {
    Object.keys(point).forEach((key) => {
      if (key !== 'time' && /^v\d+$/.test(key)) {
        keySet.add(key);
      }
    });
  }

  const sortedKeys = Array.from(keySet).sort((a, b) => {
    const ai = Number.parseInt(a.slice(1), 10);
    const bi = Number.parseInt(b.slice(1), 10);
    return ai - bi;
  });

  if (sortedKeys.length === 0) return [];

  const colors = [
    '#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#F44336',
    '#00BCD4', '#607D8B', '#795548', '#9E9E9E', '#E91E63',
  ];

  return [{
    id: 'chart-fallback-runtime',
    title: 'Runtime Signals',
    type: 'line',
    dataKeys: sortedKeys.map((key, idx) => ({
      key,
      label: `Signal ${key.toUpperCase()}`,
      color: colors[idx % colors.length],
    })),
    unit: '',
    yAxisMode: 'auto',
    size: 'large',
    tags: ['Runtime'],
  }];
}

/**
 * Generate chart summary from data
 */
const generateChartSummary = (
  config: ChartConfig,
  chartData: Array<Record<string, any>>
): ChartSummary => {
  if (!config.dataKeys || chartData.length === 0) {
    return {
      chartId: config.id,
      currentValue: null,
      minValue: null,
      maxValue: null,
      sparklineData: [],
    };
  }

  // 모든 dataKeys의 값 수집
  const allValues: number[] = [];
  config.dataKeys.forEach((dataKey) => {
    chartData.forEach((point) => {
      const value = point[dataKey.key];
      if (typeof value === 'number' && !isNaN(value)) {
        allValues.push(value);
      }
    });
  });

  // 현재값 (마지막 포인트의 모든 dataKey 값의 평균)
  const lastPoint = chartData[chartData.length - 1];
  let currentValue: number | null = null;
  if (lastPoint && config.dataKeys.length > 0) {
    const values = config.dataKeys
      .map((dk) => lastPoint[dk.key] as number)
      .filter((v) => typeof v === 'number' && !isNaN(v));
    if (values.length > 0) {
      currentValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  }

  // 최댓값/최솟값
  const minValue = allValues.length > 0 ? Math.min(...allValues) : null;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : null;

  // 스파크라인 데이터 (최근 20개 포인트, 모든 dataKey의 실제 값 포함)
  const sparklineData = chartData.slice(-20).map((point) => {
    const dataPoint: any = {
      time: point.time as number,
    };

    // 각 dataKey의 실제 값을 포함
    config.dataKeys?.forEach((dk) => {
      const value = point[dk.key] as number;
      if (typeof value === 'number' && !isNaN(value)) {
        dataPoint[dk.key] = value;
      }
    });

    return dataPoint;
  });

  return {
    chartId: config.id,
    currentValue,
    minValue,
    maxValue,
    sparklineData,
  };
};

const DynamicChartGrid: React.FC<DynamicChartGridProps> = ({
  taskId: _taskId,
  nodes,
  minorEdits = [],
  onOpenGlobalSettings,
  modelId,
  mode = 'full',
}) => {
  const isEmbedded = mode === 'embedded';
  const plotData = usePlotData(modelId);

  const {
    activeTabId: monitoringTabId,
    setActiveTab: setMonitoringTab,
    icvActiveTabId,
    setIcvActiveTab,
    favoriteChartIds,
    chartLayouts,
    setChartLayout,
    customTabs,
    chartCompareMode,
    autoGroupMode,
    setAutoGroupMode,
  } = useSimulationStore();

  // embedded 모드는 독립 탭 상태 사용
  const activeTabId = isEmbedded ? icvActiveTabId : monitoringTabId;
  const setActiveTab = isEmbedded ? setIcvActiveTab : setMonitoringTab;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'group' | 'priority' | 'name'>('group');
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const [gridContainerHeight, setGridContainerHeight] = useState(600);

  const theme = useTheme();
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));
  const isMd = useMediaQuery(theme.breakpoints.up('md'));

  // Calculate grid columns based on breakpoint
  const gridCols = useMemo(() => {
    if (isXl) return 12; // 3 columns
    if (isMd) return 8;  // 2 columns
    return 4; // 1 column
  }, [isXl, isMd]);

  // Update grid width and height on resize (ResizeObserver for container changes)
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      setGridWidth(Math.max(0, el.offsetWidth - 32));
      setGridContainerHeight(Math.max(0, el.clientHeight));
    };

    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Generate all charts (기본 editGroup 또는 자동 그룹핑)
  const allCharts = useMemo(() => {
    if (!minorEdits || minorEdits.length === 0) {
      return generateFallbackChartsFromPlotData(plotData);
    }
    return autoGroupMode
      ? buildChartsAutoGrouped(minorEdits, nodes)
      : buildCharts(minorEdits, nodes);
  }, [minorEdits, nodes, autoGroupMode, plotData]);

  // Transform plot data (공유 유틸 사용)
  const chartData = useMemo(() => {
    if (plotData.length === 0) return [];
    if (!minorEdits || minorEdits.length === 0) return plotData;
    return transformPlotData(plotData, minorEdits);
  }, [plotData, minorEdits]);

  // Filter and sort charts
  const filteredCharts = useMemo(() => {
    let filtered = [...allCharts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((chart) =>
        chart.title.toLowerCase().includes(query) ||
        chart.dataKeys?.some((dk) => dk.label.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((chart) =>
        chart.tags?.some((tag) => selectedTags.includes(tag))
      );
    }

    // Tab filter
    if (activeTabId === 'all') {
      // Show all
    } else if (activeTabId.startsWith('chart-auto-')) {
      // 자동 그룹핑 모드: chart ID로 필터
      filtered = filtered.filter((chart) => chart.id === activeTabId);
    } else if (activeTabId.startsWith('group-')) {
      const groupNum = parseInt(activeTabId.replace('group-', ''), 10);
      filtered = filtered.filter((chart) => chart.editGroup === groupNum);
    } else {
      // Custom tab
      const customTab = customTabs.find((tab) => tab.id === activeTabId);
      if (customTab) {
        filtered = filtered.filter((chart) => customTab.chartIds.includes(chart.id));
      }
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'group') {
        return (a.editGroup || 0) - (b.editGroup || 0);
      } else if (sortBy === 'priority') {
        return (a.editPriority || 0) - (b.editPriority || 0);
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    return filtered;
  }, [allCharts, searchQuery, selectedTags, activeTabId, customTabs, sortBy]);

  // Favorite charts for summary section
  const favoriteCharts = useMemo(() => {
    return allCharts.filter((chart) => favoriteChartIds.has(chart.id));
  }, [allCharts, favoriteChartIds]);

  // Generate summaries
  const chartSummaries = useMemo(() => {
    const summaries = new Map<string, ChartSummary>();
    favoriteCharts.forEach((chart) => {
      summaries.set(chart.id, generateChartSummary(chart, chartData));
    });
    return summaries;
  }, [favoriteCharts, chartData]);

  // editGroup이 모두 0(또는 미지정)이면 자동 그룹핑 활성화
  useEffect(() => {
    if (autoGroupMode) return;
    if (!minorEdits || minorEdits.length === 0) return;
    const allZero = minorEdits.every((e) => !e.editGroup || e.editGroup === 0);
    if (allZero) {
      setAutoGroupMode(true);
    }
  }, [minorEdits, autoGroupMode, setAutoGroupMode]);

  // Tab groups (기본 모드: editGroup 번호, 자동 그룹핑 모드: chart ID에서 auto-{type} 추출)
  const groupNumbers = useMemo(() => {
    if (autoGroupMode) return []; // 자동 그룹핑 시 숫자 그룹 탭 미표시
    const groups = new Set<number>();
    allCharts.forEach((chart) => {
      if (chart.editGroup !== undefined) {
        groups.add(chart.editGroup);
      }
    });
    return Array.from(groups).sort((a, b) => a - b);
  }, [allCharts, autoGroupMode]);

  // 자동 그룹핑 모드용 탭 목록
  const autoGroupTabs = useMemo(() => {
    if (!autoGroupMode) return [];
    return allCharts.map((chart) => ({
      id: chart.id,
      label: chart.title,
    }));
  }, [allCharts, autoGroupMode]);

  // Generate grid layouts
  // 탭이 변경되면 필터링된 차트들을 y=0부터 시작해서 깔끔하게 재배치
  const gridLayouts = useMemo(() => {
    const layouts: Layout[] = [];
    let y = 0;
    const cols = gridCols;
    const itemsPerRow = cols === 12 ? 3 : cols === 8 ? 2 : 1;

    // 컨테이너 전체를 채우도록 h 계산 (margin/padding 감안)
    const ROW_HEIGHT = 60;
    const MARGIN = isEmbedded ? 8 : 16;
    const totalRows = Math.ceil(filteredCharts.length / itemsPerRow);
    // embedded 모드: 고정 높이 사용 (컨테이너가 작으므로 스크롤로 처리)
    // full 모드: 컨테이너에 맞춰 동적 높이 계산
    const dynamicH = isEmbedded
      ? 3
      : Math.max(
          4,
          Math.floor((gridContainerHeight - MARGIN * (totalRows + 1)) / (totalRows * (ROW_HEIGHT + MARGIN)))
        );

    filteredCharts.forEach((chart, index) => {
      const existingLayout = chartLayouts[chart.id];
      const size = chart.size || 'small';

      // 차트 1개: 전체 너비 + 컨테이너 높이에 맞춤
      if (filteredCharts.length === 1) {
        const w = cols;
        layouts.push({
          i: chart.id,
          x: 0,
          y: 0,
          w: existingLayout?.w ?? w,
          h: dynamicH,
          minW: 2,
          minH: 2,
          maxW: cols,
        });
        return;
      }

      // Calculate width based on grid columns
      let w: number;

      if (cols === 12) {
        w = size === 'small' ? 4 : 8;
      } else if (cols === 8) {
        w = size === 'small' ? 4 : 8;
      } else {
        w = 4;
      }

      // 위치 재계산
      const x = (index % itemsPerRow) * (cols / itemsPerRow);

      layouts.push({
        i: chart.id,
        x: x,
        y: y,
        w: existingLayout?.w ?? w,
        h: dynamicH,
        minW: 2,
        minH: 2,
        maxW: cols,
      });

      // 다음 행으로 이동 (같은 행의 마지막 차트일 때)
      if ((index + 1) % itemsPerRow === 0) {
        y += dynamicH;
      }
    });

    return layouts;
  }, [filteredCharts, chartLayouts, gridCols, gridContainerHeight]);

  const handleLayoutChange = useCallback((layout: Layout[]) => {
    // 사용자가 드래그/리사이즈한 경우에만 레이아웃 저장
    // 탭 변경으로 인한 자동 재배치는 저장하지 않음 (다음 탭 변경 시 다시 재배치되도록)
    layout.forEach((item) => {
      // 현재 필터링된 차트 목록에 있는 차트만 저장
      const chart = filteredCharts.find((c) => c.id === item.i);
      if (chart) {
        setChartLayout(item.i, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        });
      }
    });
  }, [setChartLayout, filteredCharts]);

  const handleNavigateToChart = useCallback((chartId: string) => {
    const chart = allCharts.find((c) => c.id === chartId);
    if (chart && chart.editGroup !== undefined) {
      setActiveTab(`group-${chart.editGroup}`);
    }
  }, [allCharts, setActiveTab]);

  // Empty state
  if (allCharts.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'text.secondary',
          p: 4,
        }}
      >
        <SettingsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          No Charts Available
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', maxWidth: 400 }}>
          Configure Minor Edits in Global Settings or wait for runtime signals to appear.
        </Typography>
        {onOpenGlobalSettings && (
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={onOpenGlobalSettings}
          >
            Open Global Settings
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar — full 모드에서만 표시 */}
      {!isEmbedded && (
        <ChartToolbar
          charts={allCharts}
          onSearchChange={setSearchQuery}
          onTagFilterChange={setSelectedTags}
          onSortChange={(sort) => setSortBy(sort as typeof sortBy)}
        />
      )}

      {/* Summary Section — full 모드에서만 표시 */}
      {!isEmbedded && favoriteCharts.length > 0 && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'grey.50' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Favorite Charts
          </Typography>
          <Grid container spacing={2}>
            {favoriteCharts.map((chart) => {
              const summary = chartSummaries.get(chart.id);
              if (!summary) return null;
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={chart.id}>
                  <ChartSummaryCard
                    config={chart}
                    summary={summary}
                    onNavigate={handleNavigateToChart}
                  />
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* Tabs + Auto Group Toggle */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: isEmbedded ? 0.5 : 0 }}>
        <Tabs
          value={activeTabId}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            ...(isEmbedded && { minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.72rem' } }),
          }}
        >
          <Tab label="All" value="all" />
          {autoGroupMode
            ? autoGroupTabs.map((tab) => (
                <Tab key={tab.id} label={tab.label} value={tab.id} />
              ))
            : groupNumbers.map((groupNum) => (
                <Tab
                  key={groupNum}
                  label={`Group ${groupNum}`}
                  value={`group-${groupNum}`}
                />
              ))
          }
          {!autoGroupMode && customTabs.map((tab) => (
            <Tab key={tab.id} label={tab.label} value={tab.id} />
          ))}
        </Tabs>
        <Tooltip title={autoGroupMode ? '원래 그룹으로 보기' : '변수 타입별 자동 그룹핑'}>
          <Button
            size="small"
            variant={autoGroupMode ? 'contained' : 'outlined'}
            color={autoGroupMode ? 'primary' : 'inherit'}
            startIcon={isEmbedded ? undefined : <AutoGroupIcon />}
            onClick={() => setAutoGroupMode(!autoGroupMode)}
            sx={{
              mx: isEmbedded ? 0.5 : 1,
              mr: isEmbedded ? 1 : 1,
              whiteSpace: 'nowrap',
              minWidth: 'auto',
              textTransform: 'none',
              fontSize: isEmbedded ? '0.65rem' : '0.75rem',
              px: isEmbedded ? 1 : 1.5,
              py: isEmbedded ? 0.25 : 0.5,
            }}
          >
            Auto Group
          </Button>
        </Tooltip>
      </Box>

      {/* Tab Panels */}
      <Box
        ref={gridContainerRef}
        sx={{ flex: 1, overflow: 'auto', p: isEmbedded ? 1 : 2, backgroundColor: 'grey.50' }}
      >
        <TabPanel value={activeTabId} index={activeTabId}>
          {filteredCharts.length === 0 ? (
            <Alert severity="info">No charts match the current filters.</Alert>
          ) : (
            <GridLayout
              className="layout"
              layout={gridLayouts}
              cols={gridCols}
              rowHeight={60}
              width={gridWidth}
              onLayoutChange={handleLayoutChange}
              isDraggable={!isEmbedded && !chartCompareMode}
              isResizable={!chartCompareMode}
              margin={isEmbedded ? [8, 8] : [16, 16]}
              containerPadding={[0, 0]}
            >
              {filteredCharts.map((chart) => {
                const layout = gridLayouts.find((l) => l.i === chart.id);
                return (
                  <Box key={chart.id}>
                    <ResizableChartCard
                      config={chart}
                      data={chartData}
                      layout={layout || { x: 0, y: 0, w: 4, h: 8 }}
                      gridCols={gridCols}
                      onLayoutChange={(newLayout) => {
                        setChartLayout(chart.id, {
                          x: newLayout.x,
                          y: newLayout.y,
                          w: newLayout.w,
                          h: newLayout.h,
                        });
                      }}
                      compareMode={!isEmbedded && chartCompareMode}
                      compact={isEmbedded}
                    />
                  </Box>
                );
              })}
            </GridLayout>
          )}
        </TabPanel>
      </Box>

      {/* Compare Panel — full 모드에서만 표시 */}
      {!isEmbedded && chartCompareMode && (
        <ChartComparePanel charts={allCharts} chartData={chartData} />
      )}
    </Box>
  );
};

export default DynamicChartGrid;
