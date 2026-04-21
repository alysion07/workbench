/**
 * WidgetContextMenu
 * 노드 우클릭 시 표시되는 위젯 관리 메뉴.
 * - 미등록 노드: "Add Widgets" 버튼 → 위젯 활성화
 * - 등록된 노드: Display Mode 토글 + 위젯별 설정 + "Remove Widgets"
 */

import { memo } from 'react';
import {
  Menu,
  MenuItem,
  Checkbox,
  Select,
  Typography,
  Divider,
  Box,
  ListItemText,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  BarChart as ChartIcon,
  TextFields as LabelIcon,
  AddCircleOutline as AddIcon,
  RemoveCircleOutline as RemoveIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
} from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import type { WidgetPosition, WidgetOverride, AvailableWidget } from '@/types/interactive';

type DisplayMode = 'chart' | 'label';

const POSITION_OPTIONS: { value: WidgetPosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

interface WidgetContextMenuProps {
  open: boolean;
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  /** 해당 노드의 컴포넌트 타입별 가용 위젯 목록 */
  availableWidgets: AvailableWidget[];
  /** 현재 오버라이드 상태 (dataKey → override) */
  overrides: Record<string, WidgetOverride>;
  /** 개별 위젯 오버라이드 변경 */
  onOverrideChange: (dataKey: string, override: WidgetOverride) => void;
  /** 해당 노드 오버라이드 전체 초기화 */
  onReset: () => void;
  /** 차트/라벨 수치형 위젯이 있는지 */
  hasNumericWidgets: boolean;
  /** 현재 노드의 표시 모드 */
  displayMode: DisplayMode;
  /** 노드 표시 모드 변경 */
  onDisplayModeChange: (mode: DisplayMode) => void;
  /** 이 노드에 위젯이 활성화되어 있는지 */
  isNodeEnabled: boolean;
  /** 위젯 추가 (enabledWidgetNodes에 등록) */
  onAddWidgets: () => void;
  /** 위젯 제거 (enabledWidgetNodes에서 제거) */
  onRemoveWidgets: () => void;
}

const WidgetContextMenu: React.FC<WidgetContextMenuProps> = ({
  open,
  anchorPosition,
  onClose,
  availableWidgets,
  overrides,
  onOverrideChange,
  onReset,
  hasNumericWidgets,
  displayMode,
  onDisplayModeChange,
  isNodeEnabled,
  onAddWidgets,
  onRemoveWidgets,
}) => {
  if (availableWidgets.length === 0) return null;

  const handleVisibleToggle = (dataKey: string, currentVisible: boolean) => {
    onOverrideChange(dataKey, {
      ...overrides[dataKey],
      visible: !currentVisible,
    });
  };

  const handlePositionChange = (dataKey: string, e: SelectChangeEvent<WidgetPosition>) => {
    onOverrideChange(dataKey, {
      ...overrides[dataKey],
      position: e.target.value as WidgetPosition,
      // 위치 방향 변경 시 커스텀 오프셋 초기화 (새 방향 기본값 사용)
      offsetX: undefined,
      offsetY: undefined,
    });
  };

  const handlePinToggle = (dataKey: string) => {
    const current = overrides[dataKey]?.pinned ?? false;
    onOverrideChange(dataKey, {
      ...overrides[dataKey],
      pinned: !current,
    });
  };

  // 미등록 노드: "Add Widgets" 메뉴만 표시
  if (!isNodeEnabled) {
    return (
      <Menu
        open={open}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        slotProps={{
          paper: {
            sx: { minWidth: 200 },
          },
        }}
      >
        <MenuItem disabled sx={{ py: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#333', fontSize: '0.75rem' }}>
            No Widgets
          </Typography>
        </MenuItem>
        <Divider />
        <Box sx={{ px: 1.5, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
            {availableWidgets.map((w) => w.label + (w.unit ? ` (${w.unit})` : '')).join(', ')}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={onAddWidgets}
            sx={{ fontSize: '0.75rem', textTransform: 'none', mt: 0.5 }}
          >
            Add Widgets
          </Button>
        </Box>
      </Menu>
    );
  }

  // 등록된 노드: 기존 위젯 설정 메뉴 + Remove 버튼
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      slotProps={{
        paper: {
          sx: { minWidth: 260, maxWidth: 320 },
        },
      }}
    >
      <MenuItem disabled sx={{ py: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#333', fontSize: '0.75rem' }}>
          Widget Settings
        </Typography>
      </MenuItem>
      <Divider />

      {/* Display Mode 토글 (수치형 위젯이 있는 노드만) */}
      {hasNumericWidgets && (
        <>
          <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
              Display
            </Typography>
            <ToggleButtonGroup
              value={displayMode}
              exclusive
              onChange={(_, v) => { if (v) onDisplayModeChange(v); }}
              size="small"
              sx={{ height: 24 }}
            >
              <ToggleButton value="label" sx={{ px: 0.75, py: 0, fontSize: '0.65rem' }}>
                <LabelIcon sx={{ fontSize: 13, mr: 0.3 }} />
                Label
              </ToggleButton>
              <ToggleButton value="chart" sx={{ px: 0.75, py: 0, fontSize: '0.65rem' }}>
                <ChartIcon sx={{ fontSize: 13, mr: 0.3 }} />
                Chart
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Divider />
        </>
      )}

      {availableWidgets.map((widget) => {
        const override = overrides[widget.dataKey];
        const isVisible = override?.visible !== false;
        const isPinned = override?.pinned ?? false;
        const position = override?.position ?? widget.defaultPosition;

        return (
          <MenuItem
            key={widget.dataKey}
            sx={{ py: 0.5, px: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
            disableRipple
          >
            <Checkbox
              size="small"
              checked={isVisible}
              onChange={() => handleVisibleToggle(widget.dataKey, isVisible)}
              sx={{ p: 0.25 }}
            />
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {widget.label}
                  {widget.unit && (
                    <Typography component="span" sx={{ color: '#888', fontSize: '0.7rem', ml: 0.5 }}>
                      ({widget.unit})
                    </Typography>
                  )}
                </Typography>
              }
              sx={{ flex: '1 1 auto', my: 0 }}
            />
            {/* F3.3: Pin/Unpin 토글 */}
            <Box
              onClick={(e) => { e.stopPropagation(); handlePinToggle(widget.dataKey); }}
              sx={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                p: 0.25,
                borderRadius: 0.5,
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.06)' },
              }}
              title={isPinned ? 'Unpin (줌아웃 시 축소)' : 'Pin (줌아웃 시 유지)'}
            >
              {isPinned
                ? <PinIcon sx={{ fontSize: 16, color: '#1976d2' }} />
                : <PinOutlinedIcon sx={{ fontSize: 16, color: '#999' }} />
              }
            </Box>
            <Select<WidgetPosition>
              size="small"
              value={position}
              onChange={(e) => handlePositionChange(widget.dataKey, e)}
              disabled={!isVisible}
              sx={{
                fontSize: '0.7rem',
                height: 24,
                minWidth: 70,
                '& .MuiSelect-select': { py: 0.25, px: 1 },
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {POSITION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem', py: 0.25 }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </MenuItem>
        );
      })}

      <Divider />
      <Box sx={{ px: 1.5, py: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          size="small"
          onClick={() => { onReset(); onClose(); }}
          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
        >
          Reset to Default
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<RemoveIcon sx={{ fontSize: 14 }} />}
          onClick={onRemoveWidgets}
          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
        >
          Remove Widgets
        </Button>
      </Box>
    </Menu>
  );
};

export default memo(WidgetContextMenu);
