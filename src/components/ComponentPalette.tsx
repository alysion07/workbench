/**
 * Component Palette
 * Drag & Drop component selector
 */

import { useState } from 'react';
import { Box, Typography, Paper, Tooltip, Collapse, IconButton } from '@mui/material';
import {
  Circle as CircleIcon,
  Remove as JunctionIcon,
  HorizontalRule as PipeIcon,
  CallSplit as BranchIcon,
  AccessTime as TimeVolIcon,
  TrendingFlat as TimeJunIcon,
  AccountTree as MtpljunIcon,
  Loop as LoopIcon,
  LocalFireDepartment as HeatIcon,
  ToggleOnOutlined as ValveIcon,
  SettingsOutlined as TurbineIcon,
  InboxOutlined as TankIcon,
  FilterAltOutlined as SeparatorIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { ComponentType, COMPONENT_CONFIGS } from '@/types/mars';

interface PaletteItemProps {
  type: ComponentType;
}

interface CategorySectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({ 
  title, 
  children, 
  defaultExpanded = true 
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <Box mb={1}>
      <Box 
        display="flex" 
        alignItems="center" 
        onClick={() => setExpanded(!expanded)}
        sx={{ cursor: 'pointer', py: 0.5 }}
      >
        <IconButton size="small" sx={{ p: 0, mr: 0.5 }}>
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box display="flex" flexDirection="column" gap={0.5} mt={0.5}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

const PaletteItem: React.FC<PaletteItemProps> = ({ type }) => {
  const config = COMPONENT_CONFIGS[type];
  
  const getIcon = () => {
    switch (type) {
      case 'snglvol': return <CircleIcon />;
      case 'sngljun': return <JunctionIcon />;
      case 'pipe': return <PipeIcon />;
      case 'branch': return <BranchIcon />;
      case 'pump': return <LoopIcon />;
      case 'tmdpvol': return <TimeVolIcon />;
      case 'tmdpjun': return <TimeJunIcon />;
      case 'mtpljun': return <MtpljunIcon />;
      case 'htstr': return <HeatIcon />;
      case 'valve': return <ValveIcon />;
      case 'turbine': return <TurbineIcon />;
      case 'tank': return <TankIcon />;
      case 'separatr': return <SeparatorIcon />;
    }
  };
  
  const handleDragStart = (e: React.DragEvent) => {
    console.log('[Palette] Drag start:', type);
    
    // Important: use 'copy' not 'move' to prevent node repositioning
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Mark this as palette drag, not node drag
    e.dataTransfer.setData('application/source', 'palette');
    
    // Create a drag image with fixed width to prevent stretching
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      const rect = e.currentTarget.getBoundingClientRect();

      // Fix the width to match original element
      dragImage.style.width = `${rect.width}px`;
      dragImage.style.opacity = '0.8';

      // Position off-screen (required for drag image to work)
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.left = '-9999px';

      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, rect.width / 2, 20);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };
  
  return (
    <Tooltip title={config.description} placement="right" arrow>
      <Box
        draggable={true}
        onDragStart={handleDragStart}
        sx={{
          userSelect: 'none',
          WebkitUserDrag: 'element',
          pointerEvents: 'auto',
        }}
      >
        <Paper
          elevation={1}
          sx={{
            padding: 1,
            cursor: 'grab',
            borderLeft: `3px solid ${config.color}`,
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: 2,
              transform: 'translateX(2px)',
            },
            '&:active': {
              cursor: 'grabbing',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ color: config.color, display: 'flex', fontSize: '1.2rem' }}>
              {getIcon()}
            </Box>
            <Typography variant="body2" fontWeight="500">
              {config.label}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Tooltip>
  );
};

const ComponentPalette: React.FC = () => {
  return (
    <Box
      sx={{
        width: 220,
        height: '100%',
        borderRight: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        overflow: 'auto',
        padding: 2,
      }}
    >
      <Typography variant="h6" fontWeight="600" mb={2}>
        Components
      </Typography>
      
      <CategorySection title="VOLUME" defaultExpanded={true}>
        <PaletteItem type="snglvol" />
      </CategorySection>
      
      <CategorySection title="JUNCTION" defaultExpanded={true}>
        <PaletteItem type="sngljun" />
        <PaletteItem type="mtpljun" />
        <PaletteItem type="valve" />
      </CategorySection>
      
      <CategorySection title="PIPING" defaultExpanded={true}>
        <PaletteItem type="pipe" />
        <PaletteItem type="branch" />
        <PaletteItem type="pump" />
        <PaletteItem type="turbine" />
        <PaletteItem type="tank" />
        <PaletteItem type="separatr" />
      </CategorySection>
      
      <CategorySection title="BOUNDARY CONDITIONS" defaultExpanded={true}>
        <PaletteItem type="tmdpvol" />
        <PaletteItem type="tmdpjun" />
      </CategorySection>

      <CategorySection title="THERMAL" defaultExpanded={true}>
        <PaletteItem type="htstr" />
      </CategorySection>
    </Box>
  );
};

export default ComponentPalette;

