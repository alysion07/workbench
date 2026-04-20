/**
 * ProjectPickerContent Component
 * PRJ-001: ProjectGrid + Collapsible SideInfoPanel
 */

import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  ChevronLeft as CollapseIcon,
} from '@mui/icons-material';
import ProjectGrid from './ProjectGrid';
import SideInfoPanel from './SideInfoPanel';
import { Project } from '../../types/supabase';

const PANEL_WIDTH = 320;

export interface ProjectPickerContentProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onNoticeClick?: (noticeId: string) => void;
  onTutorialClick?: (tutorialId: string) => void;
}

const ProjectPickerContent: React.FC<ProjectPickerContentProps> = ({
  projects,
  loading,
  error,
  searchQuery,
  onSelectProject,
  onDeleteProject,
  onNoticeClick,
  onTutorialClick,
}) => {
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  const toggleSidePanel = () => {
    setSidePanelOpen((prev) => !prev);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 좌측: 프로젝트 그리드 - 남은 공간 모두 사용 */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          pr: sidePanelOpen ? 2 : 6,  // 접혔을 때 버튼 공간 확보
          transition: 'padding-right 0.3s ease',
        }}
      >
        <ProjectGrid
          projects={projects}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
        />
      </Box>

      {/* 펼치기 버튼 - 패널이 접혔을 때만 표시 */}
      {!sidePanelOpen && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 8,
            zIndex: 10,
          }}
        >
          <Tooltip title="패널 펼치기" placement="left">
            <IconButton
              onClick={toggleSidePanel}
              size="small"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: 1,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <CollapseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* 우측: 사이드 패널 - 접기/펼치기 가능 */}
      <Box
        sx={{
          width: sidePanelOpen ? PANEL_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      >
        <Box
          sx={{
            width: PANEL_WIDTH,
            height: '100%',
            overflow: 'auto',
            opacity: sidePanelOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <SideInfoPanel
            onNoticeClick={onNoticeClick}
            onTutorialClick={onTutorialClick}
            onToggle={toggleSidePanel}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ProjectPickerContent;
