/**
 * CoSimStatusBanner — SimulationPage Co-Sim 미완료 경고 배너
 */

import { Alert, AlertTitle, Button } from '@mui/material';
import type { CoSimValidationResult } from '@/types/cosim';

interface CoSimStatusBannerProps {
  validation: CoSimValidationResult;
  onNavigateToSettings: () => void;
}

export default function CoSimStatusBanner({ validation, onNavigateToSettings }: CoSimStatusBannerProps) {
  if (validation.isComplete) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mx: 2, mt: 1 }}
      action={
        <Button color="inherit" size="small" onClick={onNavigateToSettings}>
          설정으로 이동
        </Button>
      }
    >
      <AlertTitle>Co-Sim 설정 미완료</AlertTitle>
      {validation.errors.slice(0, 3).map((err, i) => (
        <div key={i}>- {err}</div>
      ))}
    </Alert>
  );
}
