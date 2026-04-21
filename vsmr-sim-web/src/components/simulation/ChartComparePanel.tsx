/**
 * Chart Compare Panel Component
 * 차트 비교 패널 (드래그 앤 드롭)
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { useSimulationStore } from '@/stores/simulationStore';
import ChartCard from './ChartCard';
import type { ChartConfig } from '@/types/simulation';

interface ChartComparePanelProps {
  charts: ChartConfig[];
  chartData: Array<Record<string, any>>;
}

export const ChartComparePanel: React.FC<ChartComparePanelProps> = ({
  charts,
  chartData,
}) => {
  const { compareChartIds, clearCompare, chartCompareMode, addToCompare } = useSimulationStore();
  const [dragOver, setDragOver] = useState<0 | 1 | null>(null);

  if (!chartCompareMode) {
    return null;
  }

  const [chart1Id, chart2Id] = compareChartIds;
  const chart1 = chart1Id ? charts.find((c) => c.id === chart1Id) : null;
  const chart2 = chart2Id ? charts.find((c) => c.id === chart2Id) : null;

  const handleClose = () => {
    clearCompare();
  };

  const handleDragOver = (e: React.DragEvent, position: 0 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(position);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, position: 0 | 1) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    
    const chartId = e.dataTransfer.getData('chartId');
    if (chartId) {
      addToCompare(chartId, position);
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40vh',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        borderTop: 2,
        borderColor: 'primary.main',
        boxShadow: 8,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Compare Charts
        </Typography>
        <Tooltip title="Close Compare Panel">
          <IconButton size="small" onClick={handleClose} sx={{ color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Chart Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: 2,
          p: 2,
          overflow: 'auto',
        }}
      >
        {/* Chart 1 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
          onDragOver={(e) => handleDragOver(e, 0)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 0)}
        >
          {chart1 ? (
            <>
              <Typography variant="caption" sx={{ mb: 1, fontWeight: 600 }}>
                {chart1.title}
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ChartCard config={chart1} data={chartData} />
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 2,
                borderColor: dragOver === 0 ? 'primary.main' : 'divider',
                borderStyle: 'dashed',
                borderRadius: 1,
                color: dragOver === 0 ? 'primary.main' : 'text.secondary',
                backgroundColor: dragOver === 0 ? 'action.hover' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <Typography variant="body2">Drag a chart here</Typography>
            </Box>
          )}
        </Box>

        {/* Divider */}
        <Box
          sx={{
            width: 2,
            backgroundColor: 'divider',
            alignSelf: 'stretch',
          }}
        />

        {/* Chart 2 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
          onDragOver={(e) => handleDragOver(e, 1)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 1)}
        >
          {chart2 ? (
            <>
              <Typography variant="caption" sx={{ mb: 1, fontWeight: 600 }}>
                {chart2.title}
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ChartCard config={chart2} data={chartData} />
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 2,
                borderColor: dragOver === 1 ? 'primary.main' : 'divider',
                borderStyle: 'dashed',
                borderRadius: 1,
                color: dragOver === 1 ? 'primary.main' : 'text.secondary',
                backgroundColor: dragOver === 1 ? 'action.hover' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <Typography variant="body2">Drag a chart here</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default ChartComparePanel;

