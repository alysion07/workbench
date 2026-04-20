/**
 * Curve Table Editor
 * 상사곡선 X, Y 값을 테이블 형식으로 편집
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowsProp,
  GridRowModesModel,
  GridEventListener,
  GridRowEditStopReasons,
} from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SortIcon from '@mui/icons-material/Sort';
import type { PumpCurve, PumpCurvePoint } from '../../types/mars';
import { DataGridErrorBoundary } from '../common/DataGridErrorBoundary';

interface CurveTableProps {
  curve: PumpCurve;
  onChange: (updatedCurve: PumpCurve) => void;
}

interface Row {
  id: number;
  x: number;
  y: number;
}

export function CurveTable({ curve, onChange }: CurveTableProps) {
  // DataGrid용 row 데이터 변환 (hooks는 항상 먼저 호출)
  const rows: GridRowsProp<Row> = useMemo(
    () => curve?.points?.map((pt, idx) => ({ id: idx, x: pt.x, y: pt.y })) || [],
    [curve?.points]
  );

  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});

  // 조건부 렌더링 (hooks 이후)
  if (!curve) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          곡선 데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  // Row 업데이트 핸들러
  const handleProcessRowUpdate = (newRow: Row) => {
    const updatedPoints = [...curve.points];
    updatedPoints[newRow.id] = { x: newRow.x, y: newRow.y };

    onChange({
      ...curve,
      points: updatedPoints,
    });

    return newRow;
  };

  // Row 추가
  const handleAddRow = () => {
    const newPoint: PumpCurvePoint = { x: 0.0, y: 1.0 };
    const updatedPoints = [...curve.points, newPoint];

    onChange({
      ...curve,
      points: updatedPoints,
    });
  };

  // Row 삭제 (마지막 행 삭제)
  const handleDeleteRows = () => {
    if (curve.points.length === 0) return;

    const updatedPoints = curve.points.slice(0, -1);

    onChange({
      ...curve,
      points: updatedPoints.length > 0 ? updatedPoints : [{ x: 0.0, y: 1.0 }], // 최소 1개 유지
    });
  };

  // X 오름차순 정렬
  const handleSort = () => {
    const sortedPoints = [...curve.points].sort((a, b) => a.x - b.x);

    onChange({
      ...curve,
      points: sortedPoints,
    });
  };

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      (event as any).defaultMuiPrevented = true;
    }
  };

  // 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: '#',
      width: 60,
      editable: false,
      valueGetter: (_value, row) => row.id + 1,
    },
    {
      field: 'x',
      headerName: `X (${curve.xLabel})`,
      width: 200,
      editable: true,
      type: 'number',
      valueFormatter: (value: number | null | undefined) => {
        if (typeof value === 'number') {
          return value.toFixed(6);
        }
        return value ?? '';
      },
    },
    {
      field: 'y',
      headerName: `Y (${curve.yLabel})`,
      width: 200,
      editable: true,
      type: 'number',
      valueFormatter: (value: number | null | undefined) => {
        if (typeof value === 'number') {
          return value.toFixed(6);
        }
        return value ?? '';
      },
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 툴바 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Tooltip title="행 추가">
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddRow}
          >
            행 추가
          </Button>
        </Tooltip>

        <Tooltip title="마지막 행 삭제">
          <span>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteRows}
              disabled={curve.points.length === 0}
            >
              마지막 행 삭제
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="X 오름차순 정렬">
          <Button
            variant="outlined"
            size="small"
            startIcon={<SortIcon />}
            onClick={handleSort}
          >
            X 정렬
          </Button>
        </Tooltip>
      </Box>

      {/* DataGrid */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {rows.length > 0 ? (
          <DataGridErrorBoundary>
            <DataGrid
              key={`${curve?.name}-${rows.length}`}
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              editMode="row"
              rowModesModel={rowModesModel}
              onRowModesModelChange={setRowModesModel}
              onRowEditStop={handleRowEditStop}
              processRowUpdate={handleProcessRowUpdate}
              hideFooter
              sx={{
                '& .MuiDataGrid-cell': {
                  fontSize: '0.875rem',
                },
              }}
            />
          </DataGridErrorBoundary>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
            데이터 포인트가 없습니다. "행 추가" 버튼을 클릭하여 추가하세요.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
