/**
 * Property Panel Component
 * Right sidebar for editing component parameters
 * Resizable via react-resizable-panels in App.tsx
 */

import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Divider, Alert, Chip, Button, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  IconButton, Tooltip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Node } from 'reactflow';
import { useStore } from '@/stores/useStore';
import { MARSNodeData } from '@/types/mars';
import { MARSInputFileGenerator } from '@/utils/fileGenerator';
import SnglvolForm from './forms/SnglvolForm';
import SngljunForm from './forms/SngljunForm';
import PipeFormSpread from './forms/PipeFormSpread';
import BranchForm from './forms/BranchForm';
import TmdpvolForm from './forms/TmdpvolForm';
import TmdpjunForm from './forms/TmdpjunForm';
import MtpljunForm from './forms/MtpljunForm';
import PumpForm from './forms/PumpForm';
import HeatStructureForm from './forms/HeatStructureForm';
import ValveForm from './forms/ValveForm';
import TurbineForm from './forms/TurbineForm';
import TankForm from './forms/TankForm';
import SeparatorForm from './forms/SeparatorForm';
import AppearanceForm from './forms/AppearanceForm';
import EdgePropertyPanel from './panels/EdgePropertyPanel';

// Empty state component
const EmptyState: React.FC = () => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    height="100%"
    px={2}
  >
    <Typography variant="body2" color="text.secondary" textAlign="center">
      Select a component to edit its properties
    </Typography>
  </Box>
);

// Panel header component
interface PanelHeaderProps {
  componentType: string;
  componentName: string;
  componentId: string;
  status: 'valid' | 'incomplete' | 'error';
}

const PanelHeader: React.FC<PanelHeaderProps> = ({
  componentType,
  componentName,
  componentId,
  status
}) => {
  const statusColor = status === 'valid' ? 'success' : status === 'error' ? 'error' : 'warning';
  const propertyFormState = useStore(state => state.propertyFormState);
  const formSubmitHandler = useStore(state => state.formSubmitHandler);

  const handleSave = () => {
    if (formSubmitHandler) {
      formSubmitHandler();
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 1,
        borderBottom: '1px solid #e0e0e0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'white',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="stretch">
        <Box>
          <Typography variant="overline" color="text.secondary">
            {componentType.toUpperCase()}
          </Typography>
          <Typography variant="h6" fontWeight="600">
            {componentName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ID: {componentId}
          </Typography>
        </Box>
        <Box display="flex" flexDirection="column" justifyContent="space-between" alignItems="flex-end" gap={1}>
          <Chip label={status} size="small" color={statusColor} />
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            disabled={!propertyFormState.isDirty}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

// Error/Warning alerts component
interface ValidationAlertsProps {
  errors: Array<{ message: string }>;
  warnings: Array<{ message: string }>;
}

const ValidationAlerts: React.FC<ValidationAlertsProps> = ({ errors, warnings }) => {
  return (
  <>
    {errors && errors.length > 0 && (
      <Box p={2}>
        <Alert severity="error" sx={{ mb: 1 }}>
          <Typography variant="caption" fontWeight="600">
            {errors.length} Error{errors.length > 1 ? 's' : ''}
          </Typography>
          {errors.slice(0, 3).map((error, idx) => (
            <Typography key={idx} variant="caption" display="block">
              {error.message}
            </Typography>
          ))}
        </Alert>
      </Box>
    )}

    {warnings && warnings.length > 0 && (
      <Box px={2} pb={2}>
        <Alert severity="warning">
          <Typography variant="caption" fontWeight="600">
            {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
          </Typography>
          {warnings.slice(0, 2).map((warning, idx) => (
            <Typography key={idx} variant="caption" display="block">
              {warning.message}
            </Typography>
          ))}
        </Alert>
      </Box>
    )}
  </>
  );
};

// Component text preview tab content
const ComponentPreview: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const node = useStore(state =>
    state.nodes.find(n => n.id === nodeId)
  ) as Node<MARSNodeData> | undefined;
  const nodes = useStore(state => state.nodes);

  const previewText = useMemo(() => {
    if (!node) return '';
    const generator = new MARSInputFileGenerator(nodes as Node<MARSNodeData>[]);
    return generator.generatePreview(node);
  }, [node, nodes]);

  const handleCopy = () => {
    navigator.clipboard.writeText(previewText);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 0.5 }}>
        <Tooltip title="Copy to clipboard">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 1.5,
          pb: 1.5,
          backgroundColor: '#1e1e1e',
          borderRadius: 1,
          mx: 1,
          mb: 1,
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#555', borderRadius: 4 },
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: '12px 0',
            fontFamily: "'Consolas', 'Courier New', monospace",
            fontSize: '11px',
            lineHeight: 1.5,
            color: '#d4d4d4',
            whiteSpace: 'pre',
            tabSize: 4,
          }}
        >
          {previewText || '* No preview available'}
        </pre>
      </Box>
    </Box>
  );
};

const PropertyPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const selectedNode = useStore(state =>
    state.selectedNodeId ? state.nodes.find(n => n.id === state.selectedNodeId) : null
  );
  const selectedEdgeId = useStore(state => state.selectedEdgeId);
  const propertyFormState = useStore(state => state.propertyFormState);
  const formSubmitHandler = useStore(state => state.formSubmitHandler);

  // RESTART 모드: 프로퍼티 읽기 전용
  const isRestart = useStore(state => state.metadata?.globalSettings?.card100?.problemType === 'restart');

  // Reset tab when node changes
  React.useEffect(() => {
    setActiveTab(0);
  }, [selectedNode?.id]);

  // Handle tab change with save confirmation for Text Preview
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 2 && propertyFormState.isDirty) {
      setSaveConfirmOpen(true);
    } else {
      setActiveTab(newValue);
    }
  };

  const handleSaveConfirm = () => {
    setSaveConfirmOpen(false);
    if (formSubmitHandler) {
      formSubmitHandler();
    }
    setTimeout(() => setActiveTab(2), 100);
  };

  const handleSaveCancel = () => {
    setSaveConfirmOpen(false);
  };

  // Show edge panel if edge is selected
  if (selectedEdgeId) {
    return <EdgePropertyPanel edgeId={selectedEdgeId} />;
  }

  // Empty state
  if (!selectedNode) {
    return (
      <Box
        sx={{
          height: '100%',
          borderLeft: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          overflow: 'auto',
        }}
      >
        <EmptyState />
      </Box>
    );
  }

  const { data } = selectedNode;

  const renderForm = () => {
    switch (data.componentType) {
      case 'snglvol':
        return <SnglvolForm nodeId={selectedNode.id} data={data} />;
      case 'sngljun':
        return <SngljunForm nodeId={selectedNode.id} data={data} />;
      case 'pipe':
        return <PipeFormSpread nodeId={selectedNode.id} data={data} />;
      case 'branch':
        return <BranchForm nodeId={selectedNode.id} data={data} />;
      case 'pump':
        return <PumpForm nodeId={selectedNode.id} data={data} />;
      case 'tmdpvol':
        return <TmdpvolForm nodeId={selectedNode.id} data={data} />;
      case 'tmdpjun':
        return <TmdpjunForm nodeId={selectedNode.id} data={data} />;
      case 'mtpljun':
        return <MtpljunForm nodeId={selectedNode.id} data={data} />;
      case 'htstr':
        return <HeatStructureForm nodeId={selectedNode.id} data={data} />;
      case 'valve':
        return <ValveForm nodeId={selectedNode.id} data={data} />;
      case 'turbine':
        return <TurbineForm nodeId={selectedNode.id} data={data} />;
      case 'tank':
        return <TankForm nodeId={selectedNode.id} data={data} />;
      case 'separatr':
        return <SeparatorForm nodeId={selectedNode.id} data={data} />;
      default:
        return <Typography variant="body2">Unknown component type</Typography>;
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        borderLeft: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PanelHeader
        componentType={data.componentType}
        componentName={data.componentName}
        componentId={data.componentId}
        status={data.status}
      />

      <ValidationAlerts errors={data.errors} warnings={data.warnings} />

      {/* Tab Navigation: Properties / Appearance / Text Preview */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          flexShrink: 0,
          '& .MuiTab-root': { minHeight: 36, fontSize: '0.8rem', textTransform: 'none' },
        }}
      >
        <Tab label="Properties" />
        <Tab label="Appearance" />
        <Tab label="Text Preview" />
      </Tabs>

      <Divider />

      {/* Properties tab */}
      {activeTab === 0 && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isRestart && (
            <Alert severity="info" sx={{ m: 1, mb: 0 }}>
              RESTART 모드에서는 컴포넌트 속성을 변경할 수 없습니다.
            </Alert>
          )}
          <Box p={1.5} sx={isRestart ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
            {renderForm()}
          </Box>
        </Box>
      )}

      {/* Appearance tab */}
      {activeTab === 1 && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <AppearanceForm nodeId={selectedNode.id} data={data} />
        </Box>
      )}

      {/* Text Preview tab */}
      {activeTab === 2 && (
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ComponentPreview nodeId={selectedNode.id} />
        </Box>
      )}

      {/* 저장 확인 다이얼로그 */}
      <Dialog open={saveConfirmOpen} onClose={handleSaveCancel}>
        <DialogTitle>저장되지 않은 변경사항</DialogTitle>
        <DialogContent>
          <DialogContentText>
            저장되지 않은 변경사항이 있습니다. 미리보기를 열기 전에 저장하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveCancel}>취소</Button>
          <Button onClick={handleSaveConfirm} variant="contained" autoFocus>
            저장 후 미리보기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyPanel;
