/**
 * ModelTabBar
 * Co-Sim 모니터링 시 모델별 탭 전환 UI
 */

import { Box, Tabs, Tab, Tooltip } from '@mui/material';

interface ModelTabInfo {
  modelId: string;
  modelName: string;
  status: string;
}

export interface ModelTabBarProps {
  models: ModelTabInfo[];
  activeModelId: string | null;
  onSelectModel: (modelId: string | null) => void;
  /** "All" 탭 표시 여부 (기본값 true) */
  showAllTab?: boolean;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  building: '#bdbdbd',
  running: '#4caf50',
  paused: '#ff9800',
  completed: '#2196f3',
  stopped: '#9e9e9e',
  failed: '#f44336',
};

export default function ModelTabBar({ models, activeModelId, onSelectModel, showAllTab = true }: ModelTabBarProps) {
  if (models.length <= 1) return null;

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    onSelectModel(newValue === '__all__' ? null : newValue);
  };

  // showAllTab=false 시, activeModelId가 null이면 첫 번째 모델 자동 선택
  const effectiveActiveId = !showAllTab && !activeModelId && models.length > 0
    ? models[0].modelId
    : activeModelId;

  const currentValue = showAllTab
    ? (effectiveActiveId ?? '__all__')
    : (effectiveActiveId ?? models[0]?.modelId ?? '__all__');

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 2,
      }}
    >
      <Tabs
        value={currentValue}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 36,
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0.5,
            px: 2,
            fontSize: '0.8rem',
            textTransform: 'none',
          },
        }}
      >
        {showAllTab && (
          <Tab
            label="All"
            value="__all__"
            sx={{ fontWeight: 600 }}
          />
        )}
        {models.map((model) => {
          const dotColor = STATUS_DOT_COLORS[model.status] ?? STATUS_DOT_COLORS.building;
          return (
            <Tab
              key={model.modelId}
              value={model.modelId}
              label={
                <Tooltip title={`${model.modelName} (${model.status})`} arrow>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: dotColor,
                        flexShrink: 0,
                        ...(model.status === 'running' && {
                          animation: 'pulse-dot 1.4s ease-in-out infinite',
                          '@keyframes pulse-dot': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.4 },
                          },
                        }),
                      }}
                    />
                    {model.modelName}
                  </Box>
                </Tooltip>
              }
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
