/**
 * Homologous Curve Editor
 * PUMP 상사곡선 편집 메인 컴포넌트
 *
 * 구조:
 * - 좌측: Regime 리스트 + 곡선 선택
 * - 우측: 선택된 곡선 편집 (테이블 + CSV 붙여넣기)
 */

import { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Card,
  CardContent,
  Button,
  Checkbox,
  Tooltip,
} from '@mui/material';
import type { PumpCurve } from '../../types/mars';
import { REGIME_GROUPS } from '../../utils/pumpDefaults';
import { CurveTable } from './CurveTable';
import { CSVPasteDialog } from './CSVPasteDialog';

interface HomologousCurveEditorProps {
  curves: PumpCurve[];
  onChange: (curves: PumpCurve[]) => void;
}

export function HomologousCurveEditor({ curves, onChange }: HomologousCurveEditorProps) {
  const [selectedCurveName, setSelectedCurveName] = useState<string>(curves[0]?.name || 'han');
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  // 선택된 곡선 객체
  const selectedCurve = curves.find((c) => c.name === selectedCurveName);

  // 곡선 업데이트 핸들러
  const handleCurveUpdate = (updatedCurve: PumpCurve) => {
    const newCurves = curves.map((c) =>
      c.name === updatedCurve.name ? updatedCurve : c
    );
    onChange(newCurves);
  };

  // 곡선 활성화/비활성화 토글 핸들러
  const handleToggleEnabled = (curveName: string) => {
    const newCurves = curves.map((c) =>
      c.name === curveName ? { ...c, enabled: !c.enabled } : c
    );
    onChange(newCurves);
  };

  // CSV 붙여넣기 완료 핸들러
  const handleCsvPaste = (points: { x: number; y: number }[]) => {
    if (!selectedCurve) return;

    const updatedCurve: PumpCurve = {
      ...selectedCurve,
      points,
    };
    handleCurveUpdate(updatedCurve);
    setCsvDialogOpen(false);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={2} sx={{ flex: 1 }}>
        {/* 좌측: Regime 리스트 */}
        <Grid item xs={3}>
          <Paper sx={{ height: '600px', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
              Regime / 곡선 목록
            </Typography>

            {REGIME_GROUPS.map((group) => (
              <Box key={group.regime} sx={{ mb: 1 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ px: 2, py: 1, bgcolor: 'grey.100', fontWeight: 'bold' }}
                >
                  Regime {group.regime}: {group.label}
                </Typography>
                <List dense>
                  {group.curves.map((curveName) => {
                    const curve = curves.find((c) => c.name === curveName);
                    if (!curve) return null;

                    const isSelected = selectedCurveName === curveName;
                    const curveTypeLabel = curve.type === 1 ? 'Head' : 'Torque';
                    const pointCount = curve.points.length;

                    return (
                      <ListItem
                        key={curveName}
                        disablePadding
                        secondaryAction={
                          <Tooltip title={curve.enabled ? '.i 파일에 출력됨' : '.i 파일에 출력 안됨'}>
                            <Checkbox
                              edge="end"
                              checked={curve.enabled}
                              onChange={() => handleToggleEnabled(curveName)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Tooltip>
                        }
                      >
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => setSelectedCurveName(curveName)}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {curve.name}
                                </Typography>
                                <Chip
                                  label={curveTypeLabel}
                                  size="small"
                                  color={curve.type === 1 ? 'primary' : 'secondary'}
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {curve.xLabel} → {curve.yLabel} ({pointCount} pts)
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* 우측: 곡선 편집 */}
        <Grid item xs={9}>
          {selectedCurve ? (
            <Paper sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
              {/* 곡선 메타 정보 */}
              <Card sx={{ m: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {selectedCurve.name.toUpperCase()} - Regime {selectedCurve.regime}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary">
                        곡선 타입
                      </Typography>
                      <Typography variant="body1">
                        {selectedCurve.type === 1 ? 'Head (type=1)' : 'Torque (type=2)'}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary">
                        X축
                      </Typography>
                      <Typography variant="body1">{selectedCurve.xLabel}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary">
                        Y축
                      </Typography>
                      <Typography variant="body1">{selectedCurve.yLabel}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2" color="text.secondary">
                        데이터 포인트
                      </Typography>
                      <Typography variant="body1">{selectedCurve.points.length}개</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* CSV 붙여넣기 버튼 */}
              <Box sx={{ px: 2, pb: 1 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setCsvDialogOpen(true)}
                  size="small"
                >
                  CSV/엑셀에서 붙여넣기
                </Button>
              </Box>

              {/* 곡선 테이블 */}
              <Box sx={{ flex: 1, overflow: 'hidden', px: 2, pb: 2 }}>
                <CurveTable
                  curve={selectedCurve}
                  onChange={handleCurveUpdate}
                />
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                좌측에서 곡선을 선택하세요
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* CSV 붙여넣기 다이얼로그 */}
      {selectedCurve && (
        <CSVPasteDialog
          open={csvDialogOpen}
          onClose={() => setCsvDialogOpen(false)}
          onApply={handleCsvPaste}
          curveName={selectedCurve.name}
          xLabel={selectedCurve.xLabel}
          yLabel={selectedCurve.yLabel}
        />
      )}
    </Box>
  );
}
