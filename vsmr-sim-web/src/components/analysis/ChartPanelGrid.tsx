/**
 * ChartPanelGrid
 * 다중 차트 패널을 조절 가능한 그리드(1/2/3열)로 배치 + 패널 추가 + CSV 내보내기
 */

import { useCallback } from 'react';
import { Box, Button, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import {
  Add as AddIcon,
  ViewColumn as Col2Icon,
  ViewModule as Col3Icon,
  ViewStream as Col1Icon,
  FileDownload as CsvIcon,
  SyncAlt as SyncIcon,
} from '@mui/icons-material';
import { useAnalysisStore, useFilteredData } from '@/stores/analysisStore';
import TimeSeriesChart from './TimeSeriesChart';

export default function ChartPanelGrid() {
  const panels = useAnalysisStore((s) => s.panels);
  const activePanelId = useAnalysisStore((s) => s.activePanelId);
  const setActivePanel = useAnalysisStore((s) => s.setActivePanel);
  const addPanel = useAnalysisStore((s) => s.addPanel);
  const gridColumns = useAnalysisStore((s) => s.gridColumns);
  const setGridColumns = useAnalysisStore((s) => s.setGridColumns);
  const syncZoom = useAnalysisStore((s) => s.syncZoom);
  const toggleSyncZoom = useAnalysisStore((s) => s.toggleSyncZoom);
  const data = useFilteredData();

  // CSV 내보내기: 활성 패널의 선택 변수 + timeRange 필터 데이터
  const handleExportCsv = useCallback(() => {
    const activePanel = panels.find((p) => p.id === activePanelId);
    if (!activePanel || activePanel.variables.length === 0 || data.length === 0) return;

    const vars = activePanel.variables;
    const header = ['time', ...vars.map((v) => `${v.label}${v.unit ? ` (${v.unit})` : ''}`)].join(',');

    const rows = data.map((row) => {
      const values = [row.time, ...vars.map((v) => row[v.dataKey] ?? '')];
      return values.join(',');
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activePanel.title.replace(/\s+/g, '_')}_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [panels, activePanelId, data]);

  const activePanel = panels.find((p) => p.id === activePanelId);
  const canExport = activePanel && activePanel.variables.length > 0 && data.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* 상단 툴바: 열 수 토글 + CSV 내보내기 + 차트 추가 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
        <ToggleButtonGroup
          value={gridColumns}
          exclusive
          onChange={(_, v) => { if (v !== null) setGridColumns(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.3, fontSize: '0.7rem' } }}
        >
          <ToggleButton value={1}><Col1Icon fontSize="small" sx={{ mr: 0.5 }} />1열</ToggleButton>
          <ToggleButton value={2}><Col2Icon fontSize="small" sx={{ mr: 0.5 }} />2열</ToggleButton>
          <ToggleButton value={3}><Col3Icon fontSize="small" sx={{ mr: 0.5 }} />3열</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={syncZoom ? 'X축 동기화 해제' : 'X축 동기화 (모든 차트 줌 연동)'}>
            <Button
              variant={syncZoom ? 'contained' : 'outlined'}
              startIcon={<SyncIcon />}
              onClick={toggleSyncZoom}
              size="small"
              color={syncZoom ? 'primary' : 'inherit'}
            >
              동기화
            </Button>
          </Tooltip>

          <Tooltip title={canExport ? '활성 패널의 변수 데이터를 CSV로 내보내기' : '변수를 선택하세요'}>
            <span>
              <Button
                variant="outlined"
                startIcon={<CsvIcon />}
                onClick={handleExportCsv}
                size="small"
                disabled={!canExport}
              >
                CSV
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => addPanel()}
            size="small"
          >
            차트 추가
          </Button>
        </Box>
      </Box>

      {/* 차트 그리드 */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: 1.5,
          alignContent: 'start',
        }}
      >
        {panels.map((panel) => (
          <Box key={panel.id} sx={{ height: gridColumns === 1 ? 420 : gridColumns === 2 ? 300 : 250, minHeight: 200 }}>
            <TimeSeriesChart
              panel={panel}
              data={data}
              isActive={panel.id === activePanelId}
              onActivate={() => setActivePanel(panel.id)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
