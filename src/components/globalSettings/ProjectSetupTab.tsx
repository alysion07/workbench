/**
 * Project Setup Tab
 * Cards 001, 100, 101, 102, 110, 115
 */

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import { Card001, Card100, Card101, Card102, Card110, Card115 } from '@/types/mars';
import { NumericTextField } from '@/components/common/NumericTextField';

interface ProjectSetupTabProps {
  card001: Card001;
  card100: Card100;
  card101: Card101;
  card102: Card102;
  card110: Card110;
  card115: Card115;
  onChange: (updates: {
    card001?: Partial<Card001>;
    card100?: Partial<Card100>;
    card101?: Partial<Card101>;
    card102?: Partial<Card102>;
    card110?: Partial<Card110>;
    card115?: Partial<Card115>;
  }) => void;
}

const ALL_GASES = ['nitrogen', 'helium', 'argon', 'krypton', 'xenon', 'hydrogen', 'air', 'sf6'] as const;

const GAS_LABELS: Record<string, string> = {
  nitrogen: 'Nitrogen',
  helium: 'Helium',
  argon: 'Argon',
  krypton: 'Krypton',
  xenon: 'Xenon',
  hydrogen: 'Hydrogen',
  air: 'Air',
  sf6: 'SF6',
};

export const ProjectSetupTab: React.FC<ProjectSetupTabProps> = ({
  card001,
  card100,
  card101,
  card102,
  card110,
  card115,
  onChange
}) => {
  // Restart mode: Card 110/115 disabled, Problem Type Select disabled (Q3 결정)
  const isRestart = card100.problemType === 'restart';

  // Calculate fraction sum for validation display
  const fractionSum = card115.fractions.reduce((a, b) => a + b, 0);
  const sumError = Math.abs(fractionSum - 1.0) > 0.001;

  const handleGasToggle = (gas: typeof ALL_GASES[number]) => {
    const currentGases = [...card110.gases];
    const currentFractions = [...card115.fractions];
    
    const gasIndex = currentGases.indexOf(gas);
    
    if (gasIndex >= 0) {
      // Remove gas
      currentGases.splice(gasIndex, 1);
      currentFractions.splice(gasIndex, 1);
      
      // If this was the last gas, add nitrogen with fraction 1.0
      if (currentGases.length === 0) {
        currentGases.push('nitrogen');
        currentFractions.push(1.0);
      } else {
        // Redistribute fractions proportionally
        const remainingSum = currentFractions.reduce((a, b) => a + b, 0);
        if (remainingSum > 0) {
          currentFractions.forEach((_, idx) => {
            currentFractions[idx] = currentFractions[idx] / remainingSum;
          });
        }
      }
    } else {
      // Add gas
      currentGases.push(gas);
      // Add with equal distribution
      const newFraction = 1.0 / currentGases.length;
      currentFractions.length = 0;
      currentFractions.push(...Array(currentGases.length).fill(newFraction));
    }
    
    onChange({
      card110: { gases: currentGases },
      card115: { fractions: currentFractions }
    });
  };

  const handleFractionChange = (index: number, value: number) => {
    const newFractions = [...card115.fractions];
    if (!isNaN(value) && value >= 0 && value <= 1) {
      newFractions[index] = value;
      onChange({ card115: { fractions: newFractions } });
    }
  };

  const normalizeFractions = () => {
    const sum = card115.fractions.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      const normalized = card115.fractions.map(f => f / sum);
      onChange({ card115: { fractions: normalized } });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Card 100: Problem Type */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 100: Problem Type
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Problem Type</InputLabel>
            <Select
              value={card100.problemType}
              label="Problem Type"
              disabled
              onChange={(e) => onChange({ card100: { problemType: e.target.value as 'new' | 'restart' } })}
            >
              <MenuItem value="new">NEW</MenuItem>
              <MenuItem value="restart">RESTART</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth>
            <InputLabel>Calculation Type</InputLabel>
            <Select
              value={card100.calculationType}
              label="Calculation Type"
              onChange={(e) => onChange({ card100: { calculationType: e.target.value as 'transnt' | 'stdy-st' } })}
            >
              <MenuItem value="transnt">TRANSNT</MenuItem>
              <MenuItem value="stdy-st">STDY-ST</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Card 101: Run Option */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 101: Run Option
        </Typography>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Run Option</InputLabel>
          <Select
            value={card101.runOption}
            label="Run Option"
            onChange={(e) => onChange({ card101: { runOption: e.target.value as 'run' | 'input-chk' } })}
          >
            <MenuItem value="run">RUN</MenuItem>
            <MenuItem value="input-chk">INPUT-CHK (Input check only)</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Card 102: Units */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 102: Units
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Input Units</InputLabel>
            <Select
              value={card102.inputUnits}
              label="Input Units"
              onChange={(e) => onChange({ card102: { inputUnits: e.target.value as 'si' | 'british' } })}
            >
              <MenuItem value="si">SI</MenuItem>
              <MenuItem value="british">BRITISH</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth>
            <InputLabel>Output Units</InputLabel>
            <Select
              value={card102.outputUnits}
              label="Output Units"
              onChange={(e) => onChange({ card102: { outputUnits: e.target.value as 'si' | 'british' } })}
            >
              <MenuItem value="si">SI</MenuItem>
              <MenuItem value="british">BRITISH</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Card 110 & 115: Non-condensable Gases */}
      <Paper sx={{ p: 2, opacity: isRestart ? 0.6 : 1 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 110: Non-condensable Gases
        </Typography>
        {isRestart && (
          <Alert severity="info" sx={{ mb: 2 }}>
            RESTART 모드에서는 비응축가스 설정을 변경할 수 없습니다. (MARS 매뉴얼 Card 110/115)
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Select which non-condensable gases are present in the system
        </Typography>

        <FormGroup row sx={{ mt: 2 }}>
          {ALL_GASES.map((gas) => (
            <FormControlLabel
              key={gas}
              control={
                <Checkbox
                  checked={card110.gases.includes(gas)}
                  onChange={() => handleGasToggle(gas)}
                  disabled={isRestart || (card110.gases.includes(gas) && card110.gases.length === 1)}
                />
              }
              label={GAS_LABELS[gas] || gas}
            />
          ))}
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Card 115: Gas Mass Fractions
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Mass fractions must sum to 1.0
        </Typography>

        {sumError && (
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            Sum of fractions: {fractionSum.toFixed(4)} (must be 1.0)
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          {card110.gases.map((gas, idx) => (
            <Box key={gas} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography sx={{ minWidth: 100 }}>
                {GAS_LABELS[gas] || gas}:
              </Typography>
              <NumericTextField
                value={card115.fractions[idx] || 0}
                onChange={(num) => handleFractionChange(idx, num)}
                size="small"
                sx={{ width: 150 }}
                disabled={isRestart}
              />
            </Box>
          ))}
        </Box>

        {sumError && !isRestart && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="body2"
              color="primary"
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={normalizeFractions}
            >
              Click to normalize fractions to sum = 1.0
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Current sum: {fractionSum.toFixed(4)}
          </Typography>
        </Box>
      </Paper>

      {/* Card 001: Development Model Control (Optional) */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Card 001: Development Model Control
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={card001.enabled}
                onChange={(e) => onChange({ card001: { enabled: e.target.checked } })}
                size="small"
              />
            }
            label={card001.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Optional development model flags (most simulations use defaults)
        </Typography>
        {card001.enabled && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Model Flags</InputLabel>
            <Select
              multiple
              value={card001.values}
              label="Model Flags"
              onChange={(e) => {
                const val = e.target.value;
                onChange({ card001: { values: typeof val === 'string' ? val.split(',').map(Number) : val as number[] } });
              }}
              renderValue={(selected) => (selected as number[]).join(', ')}
            >
              <MenuItem value={76}>76 - Junction Hydraulic Dia.</MenuItem>
              <MenuItem value={85}>85 - tecplt.dat for MULTID output</MenuItem>
            </Select>
          </FormControl>
        )}
      </Paper>
    </Box>
  );
};



