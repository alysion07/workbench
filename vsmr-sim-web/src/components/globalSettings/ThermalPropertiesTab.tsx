/**
 * Thermal Properties Tab
 * Cards 201MMMNN: Heat Structure Thermal Properties
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  IconButton,
  FormControl,
  InputLabel,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  ThermalProperty,
  ThermalMaterialType,
  ThermalConductivityFormat,
  VolumetricCapacityFormat,
  GapGasName,
} from '@/types/mars';
import { formatNumber } from '@/utils/formatNumber';

interface ThermalPropertiesTabProps {
  thermalProperties: ThermalProperty[];
  onChange: (properties: ThermalProperty[]) => void;
}

// Material type options
const MATERIAL_TYPE_OPTIONS: { value: ThermalMaterialType; label: string; builtin: boolean }[] = [
  { value: 'TBL/FCTN', label: 'User Defined (Table)', builtin: false },
  { value: 'C-STEEL', label: 'Carbon Steel (Built-in)', builtin: true },
  { value: 'S-STEEL', label: 'Stainless Steel (Built-in)', builtin: true },
  { value: 'UO2', label: 'Uranium Dioxide (Built-in)', builtin: true },
  { value: 'ZR', label: 'Zirconium (Built-in)', builtin: true },
];

// Conductivity format options
const CONDUCTIVITY_FORMAT_OPTIONS: { value: ThermalConductivityFormat; label: string }[] = [
  { value: 1, label: 'Table' },
  { value: 3, label: 'Gap Gas Model' },
  // { value: 2, label: 'Polynomial Function' }, // Phase 3.5
];

// Capacity format options
const CAPACITY_FORMAT_OPTIONS: { value: VolumetricCapacityFormat; label: string }[] = [
  { value: 1, label: 'Separate Table' },
  { value: -1, label: 'Same Temperatures' },
  // { value: 2, label: 'Polynomial Function' }, // Phase 3.5
];

// Gap gas options
const GAP_GAS_OPTIONS: GapGasName[] = [
  'HELIUM', 'ARGON', 'KRYPTON', 'XENON', 'NITROGEN', 'HYDROGEN', 'OXYGEN'
];

// Default new property
const createDefaultProperty = (materialNumber: number): ThermalProperty => ({
  materialNumber,
  name: `Material ${materialNumber}`,
  materialType: 'TBL/FCTN',
  conductivityFormat: 1,
  capacityFormat: 1,
  isConstantConductivity: false,
  constantConductivity: 40.0,
  conductivityTable: [{ temperature: 293.15, value: 40.0 }],
  isConstantCapacity: false,
  constantCapacity: 3.5e6,
  capacityTable: [{ temperature: 293.15, value: 3.5e6 }],
  capacityValues: [3.5e6],
  gapGasComposition: [{ gasName: 'HELIUM', moleFraction: 1.0 }],
});

// Use shared formatNumber from @/utils/formatNumber

// Parse number from string input
const parseNumber = (str: string): number | undefined => {
  if (!str || str.trim() === '') return undefined;
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
};

export const ThermalPropertiesTab: React.FC<ThermalPropertiesTabProps> = ({
  thermalProperties,
  onChange,
}) => {
  const [selectedMaterialNumber, setSelectedMaterialNumber] = useState<number | null>(
    thermalProperties.length > 0 ? thermalProperties[0].materialNumber : null
  );

  // Get selected property
  const selectedProperty = useMemo(() => {
    if (selectedMaterialNumber === null) return null;
    return thermalProperties.find(p => p.materialNumber === selectedMaterialNumber) || null;
  }, [thermalProperties, selectedMaterialNumber]);

  // Get next available material number
  const getNextMaterialNumber = (): number => {
    if (thermalProperties.length === 0) return 1;
    const maxNum = Math.max(...thermalProperties.map(p => p.materialNumber));
    return maxNum + 1;
  };

  // Add new material
  const handleAddMaterial = () => {
    const newNum = getNextMaterialNumber();
    const newProperty = createDefaultProperty(newNum);
    const newProperties = [...thermalProperties, newProperty].sort((a, b) => a.materialNumber - b.materialNumber);
    onChange(newProperties);
    setSelectedMaterialNumber(newNum);
  };

  // Delete selected material
  const handleDeleteMaterial = () => {
    if (selectedMaterialNumber === null) return;
    const newProperties = thermalProperties.filter(p => p.materialNumber !== selectedMaterialNumber);
    onChange(newProperties);
    setSelectedMaterialNumber(newProperties.length > 0 ? newProperties[0].materialNumber : null);
  };

  // Update selected property
  const updateProperty = (updates: Partial<ThermalProperty>) => {
    if (selectedMaterialNumber === null) return;
    const newProperties = thermalProperties.map(p =>
      p.materialNumber === selectedMaterialNumber ? { ...p, ...updates } : p
    );
    // If material number changed, re-sort
    if (updates.materialNumber !== undefined && updates.materialNumber !== selectedMaterialNumber) {
      newProperties.sort((a, b) => a.materialNumber - b.materialNumber);
      setSelectedMaterialNumber(updates.materialNumber);
    }
    onChange(newProperties);
  };

  // Table row operations for conductivity table
  const addConductivityRow = () => {
    if (!selectedProperty) return;
    const table = selectedProperty.conductivityTable || [];
    const lastTemp = table.length > 0 ? table[table.length - 1].temperature : 293.15;
    const newTable = [...table, { temperature: lastTemp + 50, value: 40.0 }];
    updateProperty({ conductivityTable: newTable });

    // If capacity format is -1, also add a capacity value
    if (selectedProperty.capacityFormat === -1) {
      const values = selectedProperty.capacityValues || [];
      updateProperty({ conductivityTable: newTable, capacityValues: [...values, 3.5e6] });
    }
  };

  const removeConductivityRow = (index: number) => {
    if (!selectedProperty || !selectedProperty.conductivityTable) return;
    const newTable = selectedProperty.conductivityTable.filter((_, i) => i !== index);
    updateProperty({ conductivityTable: newTable });

    // If capacity format is -1, also remove corresponding capacity value
    if (selectedProperty.capacityFormat === -1 && selectedProperty.capacityValues) {
      const newValues = selectedProperty.capacityValues.filter((_, i) => i !== index);
      updateProperty({ conductivityTable: newTable, capacityValues: newValues });
    }
  };

  const updateConductivityRow = (index: number, field: 'temperature' | 'value', value: number) => {
    if (!selectedProperty || !selectedProperty.conductivityTable) return;
    const newTable = [...selectedProperty.conductivityTable];
    newTable[index] = { ...newTable[index], [field]: value };
    updateProperty({ conductivityTable: newTable });
  };

  // Table row operations for capacity table
  const addCapacityRow = () => {
    if (!selectedProperty) return;
    const table = selectedProperty.capacityTable || [];
    const lastTemp = table.length > 0 ? table[table.length - 1].temperature : 293.15;
    updateProperty({ capacityTable: [...table, { temperature: lastTemp + 50, value: 3.5e6 }] });
  };

  const removeCapacityRow = (index: number) => {
    if (!selectedProperty || !selectedProperty.capacityTable) return;
    updateProperty({ capacityTable: selectedProperty.capacityTable.filter((_, i) => i !== index) });
  };

  const updateCapacityRow = (index: number, field: 'temperature' | 'value', value: number) => {
    if (!selectedProperty || !selectedProperty.capacityTable) return;
    const newTable = [...selectedProperty.capacityTable];
    newTable[index] = { ...newTable[index], [field]: value };
    updateProperty({ capacityTable: newTable });
  };

  // Capacity values operations (for format -1)
  const updateCapacityValue = (index: number, value: number) => {
    if (!selectedProperty || !selectedProperty.capacityValues) return;
    const newValues = [...selectedProperty.capacityValues];
    newValues[index] = value;
    updateProperty({ capacityValues: newValues });
  };

  // Gap gas composition operations
  const addGasRow = () => {
    if (!selectedProperty) return;
    const gases = selectedProperty.gapGasComposition || [];
    // Find a gas that's not already used
    const usedGases = new Set(gases.map(g => g.gasName));
    const availableGas = GAP_GAS_OPTIONS.find(g => !usedGases.has(g)) || 'HELIUM';
    updateProperty({ gapGasComposition: [...gases, { gasName: availableGas, moleFraction: 0.0 }] });
  };

  const removeGasRow = (index: number) => {
    if (!selectedProperty || !selectedProperty.gapGasComposition) return;
    updateProperty({ gapGasComposition: selectedProperty.gapGasComposition.filter((_, i) => i !== index) });
  };

  const updateGasRow = (index: number, field: 'gasName' | 'moleFraction', value: GapGasName | number) => {
    if (!selectedProperty || !selectedProperty.gapGasComposition) return;
    const newGases = [...selectedProperty.gapGasComposition];
    if (field === 'gasName') {
      newGases[index] = { ...newGases[index], gasName: value as GapGasName };
    } else {
      newGases[index] = { ...newGases[index], moleFraction: value as number };
    }
    updateProperty({ gapGasComposition: newGases });
  };

  const normalizeGasFractions = () => {
    if (!selectedProperty || !selectedProperty.gapGasComposition) return;
    const total = selectedProperty.gapGasComposition.reduce((sum, g) => sum + g.moleFraction, 0);
    if (total === 0) return;
    const normalized = selectedProperty.gapGasComposition.map(g => ({
      ...g,
      moleFraction: g.moleFraction / total,
    }));
    updateProperty({ gapGasComposition: normalized });
  };

  // Calculate gas total
  const gasTotal = useMemo(() => {
    if (!selectedProperty?.gapGasComposition) return 0;
    return selectedProperty.gapGasComposition.reduce((sum, g) => sum + g.moleFraction, 0);
  }, [selectedProperty?.gapGasComposition]);

  // Check if built-in material
  const isBuiltIn = selectedProperty?.materialType !== 'TBL/FCTN';
  const isGapModel = selectedProperty?.conductivityFormat === 3;

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 500 }}>
      {/* Left Panel: Material List */}
      <Paper sx={{ width: 250, p: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Materials</Typography>
          <IconButton size="small" color="primary" onClick={handleAddMaterial}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        <List dense sx={{ flex: 1, overflow: 'auto' }}>
          {thermalProperties.map((prop) => (
            <ListItem key={prop.materialNumber} disablePadding>
              <ListItemButton
                selected={selectedMaterialNumber === prop.materialNumber}
                onClick={() => setSelectedMaterialNumber(prop.materialNumber)}
              >
                <ListItemText
                  primary={`${prop.materialNumber}: ${prop.name}`}
                  secondary={prop.materialType === 'TBL/FCTN'
                    ? (prop.conductivityFormat === 3 ? 'Gap Gas' : 'Table')
                    : prop.materialType}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {thermalProperties.length === 0 && (
            <ListItem>
              <ListItemText secondary="No materials defined" />
            </ListItem>
          )}
        </List>

        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteMaterial}
          disabled={selectedMaterialNumber === null}
          sx={{ mt: 1 }}
        >
          Delete Selected
        </Button>
      </Paper>

      {/* Right Panel: Material Editor */}
      <Paper sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {selectedProperty ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Basic Info */}
            <Typography variant="subtitle1" fontWeight="bold">Basic Info</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Material Number"
                type="number"
                value={selectedProperty.materialNumber}
                onChange={(e) => {
                  const num = parseInt(e.target.value);
                  if (num >= 1 && num <= 999) {
                    updateProperty({ materialNumber: num });
                  }
                }}
                size="small"
                sx={{ width: 120 }}
                inputProps={{ min: 1, max: 999 }}
              />
              <TextField
                label="Name"
                value={selectedProperty.name}
                onChange={(e) => updateProperty({ name: e.target.value })}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Material Type</InputLabel>
                <Select
                  value={selectedProperty.materialType}
                  label="Material Type"
                  onChange={(e) => updateProperty({ materialType: e.target.value as ThermalMaterialType })}
                >
                  {MATERIAL_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!isBuiltIn && (
                <>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Conductivity Format</InputLabel>
                    <Select
                      value={selectedProperty.conductivityFormat || 1}
                      label="Conductivity Format"
                      onChange={(e) => updateProperty({ conductivityFormat: e.target.value as ThermalConductivityFormat })}
                    >
                      {CONDUCTIVITY_FORMAT_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Capacity Format</InputLabel>
                    <Select
                      value={selectedProperty.capacityFormat || 1}
                      label="Capacity Format"
                      onChange={(e) => updateProperty({ capacityFormat: e.target.value as VolumetricCapacityFormat })}
                    >
                      {CAPACITY_FORMAT_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </Box>

            {/* Built-in Material Info */}
            {isBuiltIn && (
              <Alert severity="info">
                Built-in material: Thermal properties are predefined in the program. No table input required.
              </Alert>
            )}

            {/* User-defined Material Tables */}
            {!isBuiltIn && !isGapModel && (
              <>
                <Divider />

                {/* Thermal Conductivity Section */}
                <Typography variant="subtitle1" fontWeight="bold">Thermal Conductivity</Typography>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedProperty.isConstantConductivity || false}
                      onChange={(e) => updateProperty({ isConstantConductivity: e.target.checked })}
                    />
                  }
                  label="Constant Value"
                />

                {selectedProperty.isConstantConductivity ? (
                  <TextField
                    label="Constant Conductivity (W/m-K)"
                    value={formatNumber(selectedProperty.constantConductivity)}
                    onChange={(e) => {
                      const val = parseNumber(e.target.value);
                      if (val !== undefined) updateProperty({ constantConductivity: val });
                    }}
                    size="small"
                    sx={{ width: 200 }}
                  />
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Temperature (K)</TableCell>
                          <TableCell>k (W/m-K)</TableCell>
                          <TableCell width={80}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(selectedProperty.conductivityTable || []).map((entry, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={entry.temperature}
                                onChange={(e) => updateConductivityRow(idx, 'temperature', parseFloat(e.target.value))}
                                size="small"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                value={formatNumber(entry.value)}
                                onChange={(e) => {
                                  const val = parseNumber(e.target.value);
                                  if (val !== undefined) updateConductivityRow(idx, 'value', val);
                                }}
                                size="small"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => removeConductivityRow(idx)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {!selectedProperty.isConstantConductivity && (
                  <Button size="small" startIcon={<AddIcon />} onClick={addConductivityRow}>
                    Add Row
                  </Button>
                )}

                <Divider />

                {/* Volumetric Heat Capacity Section */}
                <Typography variant="subtitle1" fontWeight="bold">
                  Volumetric Heat Capacity {selectedProperty.capacityFormat === -1 && '(Same Temperatures)'}
                </Typography>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedProperty.isConstantCapacity || false}
                      onChange={(e) => updateProperty({ isConstantCapacity: e.target.checked })}
                    />
                  }
                  label="Constant Value"
                />

                {selectedProperty.isConstantCapacity ? (
                  <TextField
                    label="Constant Capacity (J/m³-K)"
                    value={formatNumber(selectedProperty.constantCapacity)}
                    onChange={(e) => {
                      const val = parseNumber(e.target.value);
                      if (val !== undefined) updateProperty({ constantCapacity: val });
                    }}
                    size="small"
                    sx={{ width: 200 }}
                  />
                ) : selectedProperty.capacityFormat === -1 ? (
                  /* W3 = -1: Values only (shares temperatures with conductivity table) */
                  <>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Temp (K) - from conductivity</TableCell>
                            <TableCell>ρCp (J/m³-K)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(selectedProperty.conductivityTable || []).map((condEntry, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>{condEntry.temperature}</TableCell>
                              <TableCell>
                                <TextField
                                  value={formatNumber(selectedProperty.capacityValues?.[idx])}
                                  onChange={(e) => {
                                    const val = parseNumber(e.target.value);
                                    if (val !== undefined) updateCapacityValue(idx, val);
                                  }}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {(selectedProperty.capacityValues?.length || 0) !== (selectedProperty.conductivityTable?.length || 0) && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Capacity values count ({selectedProperty.capacityValues?.length || 0}) must match conductivity table ({selectedProperty.conductivityTable?.length || 0})
                      </Alert>
                    )}
                  </>
                ) : (
                  /* W3 = 1: Separate temperature-capacity table */
                  <>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Temperature (K)</TableCell>
                            <TableCell>ρCp (J/m³-K)</TableCell>
                            <TableCell width={80}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(selectedProperty.capacityTable || []).map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <TextField
                                  type="number"
                                  value={entry.temperature}
                                  onChange={(e) => updateCapacityRow(idx, 'temperature', parseFloat(e.target.value))}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  value={formatNumber(entry.value)}
                                  onChange={(e) => {
                                    const val = parseNumber(e.target.value);
                                    if (val !== undefined) updateCapacityRow(idx, 'value', val);
                                  }}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => removeCapacityRow(idx)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Button size="small" startIcon={<AddIcon />} onClick={addCapacityRow}>
                      Add Row
                    </Button>
                  </>
                )}
              </>
            )}

            {/* Gap Gas Composition (W2 = 3) */}
            {!isBuiltIn && isGapModel && (
              <>
                <Divider />
                <Typography variant="subtitle1" fontWeight="bold">Gap Gas Composition</Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Gas Name</TableCell>
                        <TableCell>Mole Fraction</TableCell>
                        <TableCell width={80}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(selectedProperty.gapGasComposition || []).map((gas, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Select
                              value={gas.gasName}
                              onChange={(e) => updateGasRow(idx, 'gasName', e.target.value as GapGasName)}
                              size="small"
                              fullWidth
                            >
                              {GAP_GAS_OPTIONS.map((g) => (
                                <MenuItem key={g} value={g}>{g}</MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={gas.moleFraction}
                              onChange={(e) => updateGasRow(idx, 'moleFraction', parseFloat(e.target.value))}
                              size="small"
                              fullWidth
                              inputProps={{ min: 0, max: 1, step: 0.01 }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => removeGasRow(idx)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button size="small" startIcon={<AddIcon />} onClick={addGasRow}>
                    Add Gas
                  </Button>
                  <Typography variant="body2">
                    Total: {gasTotal.toFixed(4)}
                    {Math.abs(gasTotal - 1.0) > 0.001 && (
                      <Typography component="span" color="warning.main" sx={{ ml: 1 }}>
                        ⚠️ Should be 1.0
                      </Typography>
                    )}
                  </Typography>
                  {Math.abs(gasTotal - 1.0) > 0.001 && gasTotal > 0 && (
                    <Button size="small" variant="outlined" onClick={normalizeGasFractions}>
                      Normalize
                    </Button>
                  )}
                </Box>
              </>
            )}

            {/* Gap Gas Model: Volumetric Heat Capacity Section */}
            {!isBuiltIn && isGapModel && (
              <>
                <Divider />
                <Typography variant="subtitle1" fontWeight="bold">
                  Volumetric Heat Capacity {selectedProperty?.capacityFormat === -1 && '(Same Temperatures)'}
                </Typography>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedProperty?.isConstantCapacity || false}
                      onChange={(e) => updateProperty({ isConstantCapacity: e.target.checked })}
                    />
                  }
                  label="Constant Value"
                />

                {selectedProperty?.isConstantCapacity ? (
                  <TextField
                    label="Constant Capacity (J/m³-K)"
                    value={formatNumber(selectedProperty.constantCapacity)}
                    onChange={(e) => {
                      const val = parseNumber(e.target.value);
                      if (val !== undefined) updateProperty({ constantCapacity: val });
                    }}
                    size="small"
                    sx={{ width: 200 }}
                  />
                ) : selectedProperty?.capacityFormat === 1 ? (
                  <>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Temperature (K)</TableCell>
                            <TableCell>ρCp (J/m³-K)</TableCell>
                            <TableCell width={80}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(selectedProperty.capacityTable || []).map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <TextField
                                  type="number"
                                  value={entry.temperature}
                                  onChange={(e) => updateCapacityRow(idx, 'temperature', parseFloat(e.target.value))}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  value={formatNumber(entry.value)}
                                  onChange={(e) => {
                                    const val = parseNumber(e.target.value);
                                    if (val !== undefined) updateCapacityRow(idx, 'value', val);
                                  }}
                                  size="small"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => removeCapacityRow(idx)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Button size="small" startIcon={<AddIcon />} onClick={addCapacityRow}>
                      Add Row
                    </Button>
                  </>
                ) : (
                  <Alert severity="info">
                    Gap Gas model with W3=-1 (Same Temperatures) is not applicable — no conductivity temperature table to reference. Please use W3=1 (Separate Table).
                  </Alert>
                )}
              </>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">
              Select a material or add a new one
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
