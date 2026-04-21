/**
 * Global Settings Dialog
 * Main dialog with categorized left navigation for global MARS control cards
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  Snackbar,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import ScienceIcon from '@mui/icons-material/Science';
import { useStore } from '@/stores/useStore';
import { GlobalSettings, Card001, Card100, Card101, Card102, Card104, Card105, Card110, Card115, Card200, TimePhase, SystemConfig, MinorEdit, VariableTrip, LogicTrip, ControlVariable, VolumeReference, ThermalProperty, GeneralTable, PointReactorKinetics } from '@/types/mars';
import { validateGlobalSettings, getDefaultGlobalSettings, validateSystemReferences, validateMinorEdits, validateVariableTrips, validateLogicTrips, validateControlVariables } from '@/utils/globalSettingsValidation';
import { ProjectSetupTab } from './globalSettings/ProjectSetupTab';
import { SystemConfigTab } from './globalSettings/SystemConfigTab';
import { SimulationControlTab } from './globalSettings/SimulationControlTab';
import { MinorEditsTab } from './globalSettings/MinorEditsTab';
import { VariableTripsTab } from './globalSettings/VariableTripsTab';
import { LogicTripsTab } from './globalSettings/LogicTripsTab';
import { ControlVariablesTab } from './globalSettings/ControlVariablesTab';
import { ThermalPropertiesTab } from './globalSettings/ThermalPropertiesTab';
import { GeneralTablesTab } from './globalSettings/GeneralTablesTab';
import { ReactorKineticsTab } from './globalSettings/ReactorKineticsTab';
import { NodeIdResolver } from '@/utils/nodeIdResolver';

// --- Category Navigation Configuration ---
interface NavItem {
  key: string;
  label: string;
  index: number;
}

interface NavCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const SETTING_CATEGORIES: NavCategory[] = [
  {
    key: 'basic',
    label: '기본 설정',
    icon: <SettingsIcon fontSize="small" />,
    items: [
      { key: 'projectSetup',    label: 'Project Setup',       index: 0 },
      { key: 'systemConfig',    label: 'System Config',       index: 1 },
      { key: 'simControl',      label: 'Simulation Control',  index: 2 },
      { key: 'minorEdits',      label: 'Minor Edits',         index: 3 },
    ],
  },
  {
    key: 'tripControl',
    label: '트립/제어',
    icon: <TuneIcon fontSize="small" />,
    items: [
      { key: 'variableTrips',   label: 'Variable Trips',      index: 4 },
      { key: 'logicTrips',      label: 'Logic Trips',         index: 5 },
      { key: 'controlVars',     label: 'Control Variables',   index: 6 },
    ],
  },
  {
    key: 'tablePhysics',
    label: '테이블/물리',
    icon: <ScienceIcon fontSize="small" />,
    items: [
      { key: 'generalTables',   label: 'General Tables',      index: 7 },
      { key: 'reactorKinetics', label: 'Reactor Kinetics',    index: 8 },
      { key: 'thermalProps',    label: 'Thermal Properties',  index: 9 },
    ],
  },
];

const NAV_WIDTH = 200;

// --- Interfaces ---
interface GlobalSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`global-settings-tabpanel-${index}`}
      aria-labelledby={`global-settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 1 }}>{children}</Box>}
    </div>
  );
}

// defaults와 settings를 deep merge하되, null/undefined 값은 defaults로 대체
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeCard<T>(defaults: T, settings: T | undefined): T {
  if (!settings) return defaults;
  const result = { ...defaults } as any;
  for (const key of Object.keys(result)) {
    const val = (settings as any)[key];
    if (val != null) result[key] = val;
  }
  return result as T;
}

// 기본값과 병합하여 불완전한 설정 객체 방지
const mergeWithDefaults = (settings: GlobalSettings | undefined): GlobalSettings => {
  const defaults = getDefaultGlobalSettings();
  if (!settings) return defaults;

  return {
    // 카드 객체: deep merge + null 필터링
    // card001: 이전 형식(value: number)에서 새 형식(values: number[])으로 마이그레이션
    card001: settings.card001
      ? { enabled: settings.card001.enabled ?? false, values: Array.isArray(settings.card001.values) ? settings.card001.values : [] }
      : defaults.card001,
    card104: mergeCard(defaults.card104, settings.card104),
    card105: mergeCard(defaults.card105, settings.card105),
    card100: mergeCard(defaults.card100, settings.card100),
    card101: mergeCard(defaults.card101, settings.card101),
    card102: mergeCard(defaults.card102, settings.card102),
    card110: mergeCard(defaults.card110, settings.card110),
    card115: mergeCard(defaults.card115, settings.card115),
    card200: mergeCard(defaults.card200, settings.card200),
    // 배열: 존재하면 사용, 없으면 기본값
    systems: settings.systems ?? defaults.systems,
    timePhases: settings.timePhases ?? defaults.timePhases,
    minorEdits: settings.minorEdits ?? defaults.minorEdits,
    variableTrips: settings.variableTrips ?? defaults.variableTrips,
    logicTrips: settings.logicTrips ?? defaults.logicTrips,
    controlVariables: settings.controlVariables ?? defaults.controlVariables,
    thermalProperties: settings.thermalProperties ?? defaults.thermalProperties,
    generalTables: settings.generalTables ?? defaults.generalTables,
    reactorKinetics: settings.reactorKinetics ?? defaults.reactorKinetics,
  };
};

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({ open, onClose, initialTab }) => {
  const { metadata, updateGlobalSettings, updateRestartSettings, nodes } = useStore();
  const isRestart = metadata.taskMode === 'restart';
  const [activeTab, setActiveTab] = useState(initialTab ?? 0);

  // Sync activeTab when initialTab changes (e.g. opened from ValveForm)
  useEffect(() => {
    if (open && initialTab !== undefined) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);
  // RESTART 모드: globalSettings를 base로 restartSettings를 overlay (오버라이드 카드만 덮어쓰기)
  // restartSettings에 존재하는 배열/카드만 globalSettings 위에 merge
  const activeSettings = useMemo(() => {
    if (!isRestart || !metadata.restartSettings) return metadata.globalSettings;
    const base = metadata.globalSettings ?? {};
    const override = metadata.restartSettings;
    return {
      ...base,
      ...Object.fromEntries(
        Object.entries(override).filter(([, v]) => v !== undefined && v !== null)
      ),
    } as GlobalSettings;
  }, [isRestart, metadata.globalSettings, metadata.restartSettings]);

  const [localSettings, setLocalSettings] = useState<GlobalSettings>(
    mergeWithDefaults(activeSettings)
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [dialogTopPosition, setDialogTopPosition] = useState<number | null>(null);

  // Update local settings when metadata changes
  useEffect(() => {
    if (open) {
      setLocalSettings(mergeWithDefaults(activeSettings));
      setValidationErrors([]);
      // Reset dialog top position when dialog opens
      setDialogTopPosition(null);
    }
  }, [open, activeSettings]);

  // Capture and fix dialog top position after it's rendered
  useEffect(() => {
    if (open && dialogTopPosition === null) {
      const capturePosition = () => {
        const dialogElement = document.querySelector('[role="dialog"]') as HTMLElement;
        if (dialogElement) {
          const rect = dialogElement.getBoundingClientRect();
          if (rect.top > 0) {
            setDialogTopPosition(rect.top);
          }
        }
      };

      const rafId = requestAnimationFrame(() => {
        capturePosition();
      });

      const timer1 = setTimeout(() => {
        capturePosition();
      }, 100);

      const timer2 = setTimeout(() => {
        capturePosition();
      }, 200);

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [open, dialogTopPosition]);

  // Find which category the active tab belongs to
  const activeCategoryKey = useMemo(() => {
    for (const cat of SETTING_CATEGORIES) {
      if (cat.items.some(item => item.index === activeTab)) {
        return cat.key;
      }
    }
    return SETTING_CATEGORIES[0].key;
  }, [activeTab]);

  // Generate Volume ID list for system configuration (face=0: center)
  const generateVolumeIds = (): Array<{ ref: VolumeReference; volumeId: string; label: string; componentName: string }> => {
    const resolver = new NodeIdResolver(nodes);
    const volumeIds: Array<{ ref: VolumeReference; volumeId: string; label: string; componentName: string }> = [];

    nodes.forEach(node => {
      const compName = node.data.componentName || 'Unknown';
      const compType = node.data.componentType;

      if (compType === 'snglvol' || compType === 'tmdpvol') {
        const ref: VolumeReference = { nodeId: node.id, volumeNum: 1, face: 0 };
        const volumeId = resolver.getVolumeIdFromReference(ref);
        if (volumeId) {
          volumeIds.push({
            ref,
            volumeId,
            label: `${volumeId} (${compName}, Volume 01, Center)`,
            componentName: compName
          });
        }
      } else if (compType === 'pipe') {
        const params = node.data.parameters;
        if (params && 'ncells' in params && typeof params.ncells === 'number') {
          const ncells = params.ncells || 1;
          for (let i = 1; i <= ncells; i++) {
            const ref: VolumeReference = { nodeId: node.id, volumeNum: i, face: 0 };
            const volumeId = resolver.getVolumeIdFromReference(ref);
            if (volumeId) {
              const volNum = i.toString().padStart(2, '0');
              volumeIds.push({
                ref,
                volumeId,
                label: `${volumeId} (${compName}, Volume ${volNum}, Center)`,
                componentName: compName
              });
            }
          }
        }
      }
    });

    return volumeIds;
  };

  const availableVolumeIds = generateVolumeIds();

  // --- Change Handlers ---
  const handleProjectSetupChange = (updates: {
    card001?: Partial<Card001>;
    card100?: Partial<Card100>;
    card101?: Partial<Card101>;
    card102?: Partial<Card102>;
    card110?: Partial<Card110>;
    card115?: Partial<Card115>;
  }) => {
    setLocalSettings({
      ...localSettings,
      ...(updates.card001 && { card001: { ...localSettings.card001!, ...updates.card001 } }),
      ...(updates.card100 && { card100: { ...localSettings.card100!, ...updates.card100 } }),
      ...(updates.card101 && { card101: { ...localSettings.card101!, ...updates.card101 } }),
      ...(updates.card102 && { card102: { ...localSettings.card102!, ...updates.card102 } }),
      ...(updates.card110 && { card110: { ...localSettings.card110!, ...updates.card110 } }),
      ...(updates.card115 && { card115: { ...localSettings.card115!, ...updates.card115 } })
    });
  };

  const handleSystemConfigChange = (systems: SystemConfig[]) => {
    setLocalSettings({ ...localSettings, systems });
  };

  const handleSimulationControlChange = (updates: {
    card104?: Partial<Card104>;
    card105?: Partial<Card105>;
    card200?: Partial<Card200>;
    timePhases?: TimePhase[];
  }) => {
    setLocalSettings({
      ...localSettings,
      ...(updates.card104 && { card104: { ...localSettings.card104!, ...updates.card104 } }),
      ...(updates.card105 && { card105: { ...localSettings.card105!, ...updates.card105 } }),
      ...(updates.card200 && { card200: { ...localSettings.card200!, ...updates.card200 } }),
      ...(updates.timePhases && { timePhases: updates.timePhases })
    });
  };

  const handleMinorEditsChange = (minorEdits: MinorEdit[]) => {
    setLocalSettings({ ...localSettings, minorEdits });
  };

  const handleVariableTripsChange = (variableTrips: VariableTrip[]) => {
    setLocalSettings({ ...localSettings, variableTrips });
  };

  const handleLogicTripsChange = (logicTrips: LogicTrip[]) => {
    setLocalSettings({ ...localSettings, logicTrips });
  };

  const handleControlVariablesChange = (controlVariables: ControlVariable[]) => {
    setLocalSettings({ ...localSettings, controlVariables });
  };

  const handleThermalPropertiesChange = (thermalProperties: ThermalProperty[]) => {
    setLocalSettings({ ...localSettings, thermalProperties });
  };

  const handleGeneralTablesChange = (generalTables: GeneralTable[]) => {
    setLocalSettings({ ...localSettings, generalTables });
  };

  const handleReactorKineticsChange = (reactorKinetics: PointReactorKinetics) => {
    setLocalSettings({ ...localSettings, reactorKinetics });
  };

  const handleSave = () => {
    // Validate before saving
    const validation = validateGlobalSettings(localSettings);

    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
      setValidationErrors(errorMessages);
      setSnackbar({
        open: true,
        message: `Validation failed: ${validation.errors.length} error(s) found`,
        severity: 'error'
      });
      return;
    }

    // Validate system references against actual components
    if (localSettings.systems && localSettings.systems.length > 0) {
      const systemValidation = validateSystemReferences(localSettings.systems, nodes);

      if (!systemValidation.valid) {
        const systemErrorMessages = systemValidation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
        setValidationErrors([...validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`), ...systemErrorMessages]);
        setSnackbar({
          open: true,
          message: `System validation failed: ${systemValidation.errors.length} error(s) found`,
          severity: 'error'
        });
        return;
      }
    }

    // Validate minor edits against actual components
    if (localSettings.minorEdits && localSettings.minorEdits.length > 0) {
      const minorEditsValidation = validateMinorEdits(localSettings.minorEdits, nodes);

      if (!minorEditsValidation.valid) {
        const minorEditsErrorMessages = minorEditsValidation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
        setValidationErrors([...validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`), ...minorEditsErrorMessages]);
        setSnackbar({
          open: true,
          message: `Minor edits validation failed: ${minorEditsValidation.errors.length} error(s) found`,
          severity: 'error'
        });
        return;
      }
    }

    // Collect all trip numbers (Variable + Logic) for cross-validation
    const variableTripNumbers = localSettings.variableTrips?.map(t => t.cardNumber) || [];
    const logicTripNumbers = localSettings.logicTrips?.map(t => t.cardNumber) || [];
    const allTripNumbers = [...variableTripNumbers, ...logicTripNumbers];

    // Validate variable trips against actual components
    if (localSettings.variableTrips && localSettings.variableTrips.length > 0) {
      const variableTripsValidation = validateVariableTrips(localSettings.variableTrips, nodes, undefined, allTripNumbers);

      if (!variableTripsValidation.valid) {
        const variableTripsErrorMessages = variableTripsValidation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
        setValidationErrors([...validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`), ...variableTripsErrorMessages]);
        setSnackbar({
          open: true,
          message: `Variable trips validation failed: ${variableTripsValidation.errors.length} error(s) found`,
          severity: 'error'
        });
        return;
      }
    }

    // Validate logic trips
    if (localSettings.logicTrips && localSettings.logicTrips.length > 0) {
      const logicTripsValidation = validateLogicTrips(
        localSettings.logicTrips, variableTripNumbers, logicTripNumbers
      );

      if (!logicTripsValidation.valid) {
        const logicTripsErrorMessages = logicTripsValidation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
        setValidationErrors([...validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`), ...logicTripsErrorMessages]);
        setSnackbar({
          open: true,
          message: `Logic trips validation failed: ${logicTripsValidation.errors.length} error(s) found`,
          severity: 'error'
        });
        return;
      }
    }

    // Validate control variables
    if (localSettings.controlVariables && localSettings.controlVariables.length > 0) {
      const controlVarsValidation = validateControlVariables(localSettings.controlVariables, allTripNumbers);

      if (!controlVarsValidation.valid) {
        const controlVarsErrorMessages = controlVarsValidation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`);
        setValidationErrors([...validation.errors.map(e => `Card ${e.card} (${e.field}): ${e.message}`), ...controlVarsErrorMessages]);
        setSnackbar({
          open: true,
          message: `Control variables validation failed: ${controlVarsValidation.errors.length} error(s) found`,
          severity: 'error'
        });
        return;
      }
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Global settings validation warnings:', validation.warnings);
    }

    // Save to store: RESTART 모드면 변경된 카드만 restartSettings에, 아니면 globalSettings에 저장
    if (isRestart) {
      // globalSettings(원본)과 비교하여 변경된 섹션만 추출
      const base = mergeWithDefaults(metadata.globalSettings);
      const diff: Partial<GlobalSettings> = {};

      // 카드 객체: 필드 단위 비교
      const cardKeys = ['card001', 'card100', 'card101', 'card102', 'card104', 'card105', 'card110', 'card115', 'card200'] as const;
      for (const key of cardKeys) {
        if (JSON.stringify(localSettings[key]) !== JSON.stringify(base[key])) {
          (diff as any)[key] = localSettings[key];
        }
      }

      // 배열/객체 섹션: 전체 비교 → 변경 시 전체 포함
      const arraySectionKeys = [
        'systems', 'timePhases', 'minorEdits', 'variableTrips', 'logicTrips',
        'controlVariables', 'interactiveInputs', 'generalTables', 'thermalProperties',
      ] as const;
      for (const key of arraySectionKeys) {
        if (JSON.stringify(localSettings[key]) !== JSON.stringify(base[key])) {
          (diff as any)[key] = localSettings[key];
        }
      }

      // reactorKinetics 객체 비교
      if (JSON.stringify(localSettings.reactorKinetics) !== JSON.stringify(base.reactorKinetics)) {
        diff.reactorKinetics = localSettings.reactorKinetics;
      }

      updateRestartSettings(diff);
    } else {
      updateGlobalSettings(localSettings);
    }

    setSnackbar({
      open: true,
      message: 'Global settings saved successfully!',
      severity: 'success'
    });

    // Close dialog after a short delay
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleCancel = () => {
    setLocalSettings(mergeWithDefaults(activeSettings));
    setValidationErrors([]);
    onClose();
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            height: '85vh',
            ...(dialogTopPosition !== null && {
              position: 'fixed',
              top: `${dialogTopPosition}px !important`,
              transform: 'translateX(-50%) !important',
              left: '50%',
              margin: 0,
            })
          }
        }}
      >
        <DialogTitle>Global Settings</DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', p: 0, overflow: 'hidden' }}>
          {/* Left Navigation */}
          <Box
            sx={{
              width: NAV_WIDTH,
              minWidth: NAV_WIDTH,
              borderRight: 1,
              borderColor: 'divider',
              overflowY: 'auto',
              bgcolor: 'grey.50',
            }}
          >
            <List dense disablePadding>
              {SETTING_CATEGORIES.map((category, catIdx) => (
                <Box key={category.key}>
                  {catIdx > 0 && <Divider />}
                  {/* Category header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      py: 1,
                      bgcolor: activeCategoryKey === category.key ? 'action.selected' : 'transparent',
                    }}
                  >
                    {category.icon}
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {category.label}
                    </Typography>
                  </Box>
                  {/* Category items */}
                  {category.items.map((item) => (
                    <ListItemButton
                      key={item.key}
                      selected={activeTab === item.index}
                      onClick={() => setActiveTab(item.index)}
                      sx={{ pl: 3, py: 0.5 }}
                    >
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: activeTab === item.index ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          </Box>

          {/* Right Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 1 }}>
            {validationErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setValidationErrors([])}>
                <strong>Validation Errors:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <TabPanel value={activeTab} index={0}>
              <ProjectSetupTab
                card001={localSettings.card001!}
                card100={localSettings.card100!}
                card101={localSettings.card101!}
                card102={localSettings.card102!}
                card110={localSettings.card110!}
                card115={localSettings.card115!}
                onChange={handleProjectSetupChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <SystemConfigTab
                systems={localSettings.systems || []}
                availableVolumeIds={availableVolumeIds}
                onChange={handleSystemConfigChange}
                isRestart={localSettings.card100?.problemType === 'restart'}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <SimulationControlTab
                card104={localSettings.card104!}
                card105={localSettings.card105!}
                card200={localSettings.card200!}
                timePhases={localSettings.timePhases || []}
                onChange={handleSimulationControlChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <MinorEditsTab
                minorEdits={localSettings.minorEdits || []}
                controlVariables={localSettings.controlVariables || []}
                onChange={handleMinorEditsChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={4}>
              <VariableTripsTab
                variableTrips={localSettings.variableTrips || []}
                logicTripNumbers={(localSettings.logicTrips || []).map(t => t.cardNumber)}
                controlVariables={localSettings.controlVariables || []}
                onChange={handleVariableTripsChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={5}>
              <LogicTripsTab
                logicTrips={localSettings.logicTrips || []}
                variableTrips={localSettings.variableTrips || []}
                onChange={handleLogicTripsChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={6}>
              <ControlVariablesTab
                controlVariables={localSettings.controlVariables || []}
                onChange={handleControlVariablesChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={7}>
              <GeneralTablesTab
                generalTables={localSettings.generalTables || []}
                variableTrips={localSettings.variableTrips || []}
                logicTrips={localSettings.logicTrips || []}
                onChange={handleGeneralTablesChange}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={8}>
              <ReactorKineticsTab
                kinetics={localSettings.reactorKinetics || getDefaultGlobalSettings().reactorKinetics!}
                onChange={handleReactorKineticsChange}
                generalTables={localSettings.generalTables || []}
                nodes={nodes}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={9}>
              <ThermalPropertiesTab
                thermalProperties={localSettings.thermalProperties || []}
                onChange={handleThermalPropertiesChange}
              />
            </TabPanel>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ top: '80px !important' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default GlobalSettingsDialog;
