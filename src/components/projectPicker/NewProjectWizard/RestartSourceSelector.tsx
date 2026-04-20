/**
 * RestartSourceSelector Component
 * RESTART 시 소스 프로젝트 → 모델 → 시뮬레이션 run을 선택하는 Cascading Select
 *
 * 시뮬레이션 이력은 BFF의 listSimulationHistoriesByProject API로 조회.
 * "마지막 시점" 선택 시 simulationId를 비워두면,
 * SimulationPage에서 {userId}/{projectId}/simulation/rstplt (최신)를 사용.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Chip,
} from '@mui/material';
import type { RestartSource } from '@/types/supabase';
import type { SimulationEntry } from '@/types/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { listSimulationHistoriesByProject } from '@/services/pm/projectManagerService';

interface RestartSourceSelectorProps {
  value?: RestartSource;
  onChange: (source: RestartSource) => void;
}

const STATUS_COLOR: Record<SimulationEntry['status'], 'success' | 'warning' | 'error' | 'info'> = {
  Success: 'success',
  Running: 'info',
  Stopped: 'warning',
  Failed: 'error',
};

const RestartSourceSelector: React.FC<RestartSourceSelectorProps> = ({ value, onChange }) => {
  const { projects, fetchProjects } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [simulationRuns, setSimulationRuns] = useState<SimulationEntry[]>([]);

  useEffect(() => {
    if (projects.length === 0) {
      setLoading(true);
      fetchProjects().finally(() => setLoading(false));
    }
  }, [projects.length, fetchProjects]);

  // MARS 모델이 있는 프로젝트만
  const marsProjects = useMemo(() => {
    return projects.filter((p) => {
      const models = p.data?.models ?? [];
      return models.some((m) => m.analysisCodes.includes('MARS'));
    });
  }, [projects]);

  // 선택된 프로젝트
  const selectedProject = useMemo(() => {
    if (!value?.projectId) return null;
    return marsProjects.find((p) => p.id === value.projectId) ?? null;
  }, [marsProjects, value?.projectId]);

  // 선택된 프로젝트의 MARS 모델 목록
  const marsModels = useMemo(() => {
    if (!selectedProject?.data?.models) return [];
    return selectedProject.data.models.filter((m) =>
      m.analysisCodes.includes('MARS')
    );
  }, [selectedProject]);

  // 모델 선택 후 BFF에서 시뮬레이션 이력 조회
  const fetchSimulationRuns = useCallback(async () => {
    if (!selectedProject || !value?.modelId) {
      setSimulationRuns([]);
      return;
    }

    setRunsLoading(true);
    try {
      const entries = await listSimulationHistoriesByProject(selectedProject.id);
      // 성공/중지된 run만 (rstplt가 있을 가능성이 높음)
      const validRuns = entries.filter(
        (e) => e.status === 'Success' || e.status === 'Stopped'
      );
      setSimulationRuns(validRuns);
    } catch (err) {
      console.error('[RestartSourceSelector] Failed to list simulation histories:', err);
      setSimulationRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [selectedProject, value?.modelId]);

  useEffect(() => {
    fetchSimulationRuns();
  }, [fetchSimulationRuns]);

  // 프로젝트 선택
  const handleProjectChange = (projectId: string) => {
    const project = marsProjects.find((p) => p.id === projectId);
    if (!project) return;

    setSimulationRuns([]);
    onChange({
      projectId,
      projectName: project.name,
      modelId: '',
      modelName: '',
      restartNumber: -1,
    });
  };

  // 모델 선택
  const handleModelChange = (modelId: string) => {
    const model = marsModels.find((m) => m.id === modelId);
    if (!model || !value) return;

    onChange({
      ...value,
      modelId,
      modelName: model.name,
      simulationId: undefined,
      rstpltPath: undefined,
      restartNumber: -1,
    });
  };

  // 시뮬레이션 run 선택
  const handleRunChange = (runId: string) => {
    if (!value) return;

    const run = simulationRuns.find((r) => r.id === runId);
    if (!run) return;
    onChange({
      ...value,
      simulationId: run.id,
      restartNumber: -1,
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          프로젝트 목록 로딩 중...
        </Typography>
      </Box>
    );
  }

  if (marsProjects.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        MARS 모델이 있는 프로젝트가 없습니다. 먼저 NEW 해석으로 프로젝트를 생성해주세요.
      </Typography>
    );
  }

  const hasModel = !!value?.modelId;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Source Project */}
      <FormControl size="small" fullWidth>
        <InputLabel>Source Project</InputLabel>
        <Select
          value={value?.projectId ?? ''}
          label="Source Project"
          onChange={(e) => handleProjectChange(e.target.value)}
        >
          {marsProjects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Source Model */}
      <FormControl size="small" fullWidth disabled={!value?.projectId}>
        <InputLabel>Source Model</InputLabel>
        <Select
          value={value?.modelId ?? ''}
          label="Source Model"
          onChange={(e) => handleModelChange(e.target.value)}
        >
          {marsModels.map((model) => (
            <MenuItem key={model.id} value={model.id}>
              {model.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Simulation Run */}
      {hasModel && (
        <FormControl size="small" fullWidth disabled={runsLoading}>
          <InputLabel>Simulation Run</InputLabel>
          <Select
            value={value?.simulationId ?? ''}
            label="Simulation Run"
            onChange={(e) => handleRunChange(e.target.value)}
            startAdornment={runsLoading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
          >
            {simulationRuns.map((run) => {
              const color = STATUS_COLOR[run.status] ?? 'info';
              const dateLabel = new Date(run.timestamp).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <MenuItem key={run.id} value={run.id} sx={{ py: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flex: 1, mr: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {run.name || dateLabel}
                      </Typography>
                      <Chip
                        label={run.status}
                        color={color}
                        size="small"
                        sx={{ height: 18, fontSize: '0.7rem' }}
                      />
                    </Box>
                    {run.name && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {dateLabel} | {run.duration}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
          {!runsLoading && simulationRuns.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 0.5 }}>
              해석 히스토리가 없습니다. 마지막 시점의 RSTPLT를 사용합니다.
            </Typography>
          )}
        </FormControl>
      )}

    </Box>
  );
};

export default RestartSourceSelector;
