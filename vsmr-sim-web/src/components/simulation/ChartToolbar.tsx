/**
 * Chart Toolbar Component
 * 차트 필터/정렬 도구 모음
 */

import { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  CompareArrows as CompareArrowsIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useSimulationStore } from '@/stores/simulationStore';
import type { ChartConfig } from '@/types/simulation';

interface ChartToolbarProps {
  charts: ChartConfig[];
  onSearchChange?: (query: string) => void;
  onTagFilterChange?: (tags: string[]) => void;
  onSortChange?: (sortBy: string) => void;
}

type SortOption = 'group' | 'priority' | 'name';

const VARIABLE_TAG_MAP: Record<string, string> = {
  'p': 'Pressure',
  'tempf': 'Temperature',
  'mflowj': 'Flow',
  'voidf': 'Void Fraction',
  'rktpow': 'Power',
  'cntrlvar': 'Control',
};

export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  charts,
  onSearchChange,
  onTagFilterChange,
  onSortChange,
}) => {
  const { chartCompareMode, setCompareMode, resetLayouts } = useSimulationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('group');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // 사용 가능한 태그 목록 추출
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    charts.forEach((chart) => {
      if (chart.tags) {
        chart.tags.forEach((tag) => tagSet.add(tag));
      }
      // 변수 타입 기반 태그 자동 생성
      if (chart.dataKeys && chart.dataKeys.length > 0) {
        const firstKey = chart.dataKeys[0].key;
        const varType = firstKey.split('_')[0];
        const tag = VARIABLE_TAG_MAP[varType];
        if (tag) {
          tagSet.add(tag);
        }
      }
    });
    return Array.from(tagSet).sort();
  }, [charts]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (onSearchChange) {
      onSearchChange(query);
    }
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    if (onTagFilterChange) {
      onTagFilterChange(newTags);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    if (onSortChange) {
      onSortChange(newSort);
    }
  };

  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    if (onSearchChange) {
      onSearchChange('');
    }
    if (onTagFilterChange) {
      onTagFilterChange([]);
    }
  };

  const handleToggleCompareMode = () => {
    setCompareMode(!chartCompareMode);
  };

  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        alignItems: 'center',
      }}
    >
      {/* Search Bar */}
      <TextField
        size="small"
        placeholder="Search charts..."
        value={searchQuery}
        onChange={handleSearchChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => handleSearchChange({ target: { value: '' } } as any)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ flex: 1, minWidth: 200 }}
      />

      {/* Tag Filters */}
      <Button
        variant={selectedTags.length > 0 ? 'contained' : 'outlined'}
        size="small"
        startIcon={<FilterListIcon />}
        onClick={handleFilterMenuOpen}
      >
        Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
      </Button>
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={handleFilterMenuClose}
        PaperProps={{
          sx: { maxHeight: 300, width: 250 },
        }}
      >
        {availableTags.length === 0 ? (
          <MenuItem disabled>No tags available</MenuItem>
        ) : (
          availableTags.map((tag) => (
            <MenuItem
              key={tag}
              onClick={() => {
                handleTagToggle(tag);
              }}
              selected={selectedTags.includes(tag)}
            >
              {tag}
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {selectedTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onDelete={() => handleTagToggle(tag)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}

      {/* Sort Dropdown */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Sort by</InputLabel>
        <Select
          value={sortBy}
          label="Sort by"
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          startAdornment={
            <InputAdornment position="start">
              <SortIcon fontSize="small" />
            </InputAdornment>
          }
        >
          <MenuItem value="group">Group</MenuItem>
          <MenuItem value="priority">Priority</MenuItem>
          <MenuItem value="name">Name</MenuItem>
        </Select>
      </FormControl>

      {/* Compare Mode Toggle */}
      <Tooltip title={chartCompareMode ? 'Exit Compare Mode' : 'Enter Compare Mode'}>
        <IconButton
          color={chartCompareMode ? 'primary' : 'default'}
          onClick={handleToggleCompareMode}
        >
          <CompareArrowsIcon />
        </IconButton>
      </Tooltip>

      {/* Reset Layout */}
      <Tooltip title="Reset Layout">
        <IconButton onClick={resetLayouts}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button size="small" onClick={handleClearFilters}>
          Clear Filters
        </Button>
      )}
    </Box>
  );
};

export default ChartToolbar;

