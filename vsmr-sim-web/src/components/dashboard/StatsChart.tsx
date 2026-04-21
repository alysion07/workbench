/**
 * Stats Chart Component
 * 프로젝트 해석 결과 차트 컴포넌트 (더미 데이터, 추후 실제 해석 결과로 교체 예정)
 */

import {
  Paper,
  Typography,
  Box,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface StatsChartProps {
  projectName?: string | null;
}

interface ChartDataPoint {
  cell: number;
  pressure: number;
  temperature: number;
}

// 프로젝트 선택 시 사용할 더미 데이터 (MARS 해석 결과와 유사한 구조)
const projectDummyData: ChartDataPoint[] = [
  { cell: 1, pressure: 15.5, temperature: 285.2 },
  { cell: 2, pressure: 15.3, temperature: 286.1 },
  { cell: 3, pressure: 15.1, temperature: 287.0 },
  { cell: 4, pressure: 14.9, temperature: 287.8 },
  { cell: 5, pressure: 14.7, temperature: 288.5 },
  { cell: 6, pressure: 14.5, temperature: 289.2 },
  { cell: 7, pressure: 14.3, temperature: 289.8 },
  { cell: 8, pressure: 14.1, temperature: 290.3 },
];

// 프로젝트 미선택 시 사용할 샘플 데이터
const sampleDummyData: ChartDataPoint[] = [
  { cell: 1, pressure: 10.0, temperature: 280.0 },
  { cell: 2, pressure: 10.2, temperature: 281.0 },
  { cell: 3, pressure: 10.4, temperature: 282.0 },
  { cell: 4, pressure: 10.6, temperature: 283.0 },
  { cell: 5, pressure: 10.8, temperature: 284.0 },
];

const StatsChart: React.FC<StatsChartProps> = ({ projectName }) => {
  const chartData = projectName ? projectDummyData : sampleDummyData;
  const chartTitle = projectName 
    ? `${projectName} 해석 결과`
    : '해석 결과 (샘플)';

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {chartTitle}
        </Typography>
        {!projectName && (
          <Typography variant="caption" color="text.secondary">
            프로젝트를 선택하면 실제 해석 결과가 표시됩니다
          </Typography>
        )}
      </Box>
      <Box sx={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="cell" 
              label={{ value: '셀 번호', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: '압력 (MPa)', angle: -90, position: 'insideLeft' }}
              domain={[0, 'dataMax + 2']}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              label={{ value: '온도 (K)', angle: 90, position: 'insideRight' }}
              domain={[0, 'dataMax + 10']}
            />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="pressure"
              stroke="#1976d2"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="압력 (MPa)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="temperature"
              stroke="#ff9800"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="온도 (K)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default StatsChart;

