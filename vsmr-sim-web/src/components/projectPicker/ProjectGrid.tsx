/**
 * ProjectGrid Component
 * PRJ-001: 프로젝트 카드 그리드 (SimScale 스타일)
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
} from '@mui/material';
import {
  ArrowDownward as ArrowDownIcon,
  ArrowUpward as ArrowUpIcon,
} from '@mui/icons-material';
import ProjectCard from '../dashboard/ProjectCard';
import { Project } from '../../types/supabase';

// 정렬 옵션 타입
type SortField = 'updated_at' | 'created_at' | 'name';
type SortOrder = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updated_at', label: 'Last Modified' },
  { value: 'created_at', label: 'Creation Date' },
  { value: 'name', label: 'Name' },
];

interface ProjectGridProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

// 프로젝트에서 메타데이터 추출
const getProjectMetadata = (project: Project) => {
  const data = project.data;

  // 모델 수
  const modelCount = data?.models?.length ?? 0;

  // 노드 수 (모든 모델의 노드 합계 또는 레거시 nodes)
  let nodeCount = 0;
  if (data?.models && data.models.length > 0) {
    nodeCount = data.models.reduce((sum, model) => sum + (model.nodes?.length ?? 0), 0);
  } else if (data?.nodes) {
    nodeCount = data.nodes.length;
  }

  // 시뮬레이션 수
  const simulationCount = data?.simulationHistory?.length ?? 0;

  // 분석 코드 (모든 모델에서 수집, 중복 제거)
  const analysisCodes: string[] = [];
  if (data?.models) {
    data.models.forEach((model) => {
      model.analysisCodes?.forEach((code) => {
        if (!analysisCodes.includes(code)) {
          analysisCodes.push(code);
        }
      });
    });
  }

  return { modelCount, nodeCount, simulationCount, analysisCodes };
};

const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  loading,
  error,
  searchQuery,
  onSelectProject,
  onDeleteProject,
}) => {
  // 정렬 상태
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 정렬 필드 변경 핸들러
  const handleSortFieldChange = (event: SelectChangeEvent<SortField>) => {
    setSortField(event.target.value as SortField);
  };

  // 정렬 순서 토글 핸들러
  const handleSortOrderToggle = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // 필터링 + 정렬된 프로젝트 목록
  const sortedProjects = useMemo(() => {
    // 1. 검색 필터링
    let filtered = projects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    // 2. 정렬
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case 'updated_at':
          return multiplier * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        case 'created_at':
          return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'name':
          return multiplier * a.name.localeCompare(b.name, 'ko');
        default:
          return 0;
      }
    });
  }, [projects, searchQuery, sortField, sortOrder]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ flex: 1, p: 1 }}>
      {/* 정렬 헤더 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* 정렬 순서 토글 버튼 */}
          <Box
            onClick={handleSortOrderToggle}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'rgba(0, 0, 0, 0.23)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'text.primary',
              },
            }}
            title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
          >
            {sortOrder === 'asc' ? (
              <ArrowUpIcon sx={{ fontSize: 20, color: 'action.active' }} />
            ) : (
              <ArrowDownIcon sx={{ fontSize: 20, color: 'action.active' }} />
            )}
          </Box>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={sortField}
              onChange={handleSortFieldChange}
              displayEmpty
              sx={{
                '& .MuiSelect-select': {
                  display: 'flex',
                  alignItems: 'center',
                  py: '8.5px',
                },
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flexShrink: 0, ml: 2 }}
        >
          {sortedProjects.length}개 프로젝트
        </Typography>
      </Box>

      {/* 프로젝트 그리드 */}
      {sortedProjects.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">
            {searchQuery
              ? '검색 결과가 없습니다.'
              : '프로젝트가 없습니다. 새 프로젝트를 생성해주세요.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {sortedProjects.map((project) => {
            const { modelCount, nodeCount, simulationCount, analysisCodes } = getProjectMetadata(project);

            return (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
                xl={2.4}
                key={project.id}
              >
                <ProjectCard
                  variant="picker"
                  name={project.name}
                  count={nodeCount}
                  description={project.description || undefined}
                  updatedAt={project.updated_at}
                  onClick={() => onSelectProject(project.id)}
                  onSelect={() => onSelectProject(project.id)}
                  onDelete={() => onDeleteProject(project.id)}
                  modelCount={modelCount}
                  simulationCount={simulationCount}
                  analysisCodes={analysisCodes}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default ProjectGrid;
