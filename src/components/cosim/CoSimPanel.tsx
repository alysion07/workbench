/**
 * CoSimPanel — Co-Sim 설정 메인 패널
 * EditorPage 우측 패널에 PropertyPanel 대신 렌더링
 * 3탭 구조 + 상단 Stepper
 */

import { useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Stepper, Step, StepLabel, Chip, Button,
} from '@mui/material';
import {
  Check as CheckIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import useProjectStore from '@/stores/projectStore';
import CouplingIdsSection from './CouplingIdsSection';
import DataExchangeSection from './DataExchangeSection';
import XmlConfigSection from './XmlConfigSection';
import { generateCouplingIds, getParticipantName, getMeshName } from '@/types/cosim';
import { generatePreciceConfigXml } from '@/utils/preciceXmlGenerator';
import { generatePreciceMarsNml } from '@/utils/preciceMarsNmlGenerator';

const STEPS = ['경계면', '데이터 교환', '프로젝트 설정'];

export default function CoSimPanel() {
  const [tabIndex, setTabIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const { config, isDirty, getValidation } = useCoSimConfigStore();
  const validation = getValidation();
  const { currentProject, updateProject } = useProjectStore();

  const models = currentProject?.data?.models ?? [];

  const downloadFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadFiles = useCallback(() => {
    if (models.length < 2) {
      toast.error('모델이 2개 이상 필요합니다');
      return;
    }

    const p1 = getParticipantName(0);
    const p2 = getParticipantName(1);
    const ids = generateCouplingIds(config.nml.componentGroups);

    // precice-config.xml
    const xmlContent = generatePreciceConfigXml(config.nml, config.xml, p1, p2);
    downloadFile('precice-config.xml', xmlContent);

    // precice_mars.nml (모델별)
    const modelConfigs = [config.nml.model1, config.nml.model2];
    for (let mi = 0; mi < 2; mi++) {
      const pName = getParticipantName(mi);
      const nmlContent = generatePreciceMarsNml(pName, getMeshName(mi), modelConfigs[mi], ids);
      downloadFile(`precice_mars_${models[mi].name}.nml`, nmlContent);
    }

    toast.success('Co-Sim 설정 파일 3개 다운로드 완료');
  }, [config, models, downloadFile]);

  const handleSave = useCallback(async () => {
    const projectId = currentProject?.id;
    if (!projectId) {
      toast.error('프로젝트 정보가 없습니다');
      return;
    }
    setSaving(true);
    try {
      // 최신 프로젝트 data 재조회 (다른 경로의 최근 변경 병행 보존)
      const latestData = useProjectStore.getState().currentProject?.data;
      const success = await updateProject(projectId, {
        data: {
          ...latestData,
          coSimConfig: useCoSimConfigStore.getState().config,
        },
      });
      if (success) {
        useCoSimConfigStore.getState().loadConfig(useCoSimConfigStore.getState().config);
        toast.success('Co-Sim 설정이 저장되었습니다');
      }
    } catch {
      toast.error('Co-Sim 설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }, [currentProject, updateProject]);

  // Stepper 상태 계산 — 순차 의존성 강제: 이전 스텝 완료 없이 다음 스텝 완료 불가
  const couplingIds = generateCouplingIds(config.nml.componentGroups);
  const hasIds = couplingIds.length > 0;
  const hasDataExchange = !!config.nml.model1.writeDataName && !!config.nml.model2.writeDataName;

  const getStepState = (step: number): 'completed' | 'active' | 'disabled' => {
    if (step === 0) return hasIds ? 'completed' : 'active';
    if (step === 1) return !hasIds ? 'disabled' : hasDataExchange ? 'completed' : 'active';
    if (step === 2) return !validation.isNmlComplete ? 'disabled' : validation.isXmlComplete ? 'completed' : 'active';
    return 'disabled';
  };

  const activeStep = validation.isComplete ? 3
    : validation.isNmlComplete ? 2
    : hasIds ? 1
    : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Co-Sim 설정</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {validation.isComplete ? (
              <Chip label="완료" size="small" color="success" icon={<CheckIcon />} />
            ) : (
              <Chip label="미완료" size="small" color="warning" variant="outlined" />
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadFiles}
              disabled={!validation.isComplete || models.length < 2}
              sx={{ minWidth: 0, px: 1, fontSize: '0.75rem' }}
            >
              내보내기
            </Button>
            <Button
              size="small"
              variant={isDirty ? 'contained' : 'outlined'}
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !isDirty}
              sx={{ minWidth: 0, px: 1, fontSize: '0.75rem' }}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Box>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem' } }}>
          {STEPS.map((label, index) => (
            <Step key={label} completed={getStepState(index) === 'completed'}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        variant="fullWidth"
        sx={{ borderBottom: '1px solid #e0e0e0', flexShrink: 0, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}
      >
        <Tab label="경계면" />
        <Tab label="데이터 교환" />
        <Tab label="프로젝트 설정" />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tabIndex === 0 && <CouplingIdsSection />}
        {tabIndex === 1 && <DataExchangeSection />}
        {tabIndex === 2 && <XmlConfigSection />}
      </Box>
    </Box>
  );
}
