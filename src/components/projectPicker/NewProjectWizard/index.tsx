/**
 * NewProjectWizard Component
 * 3단계 위저드 형식의 새 프로젝트 생성 다이얼로그
 *
 * Step 1: 기본 정보 (Title, Description, Tags)
 * Step 2: Project Scope 선택
 * Step 3: Partition 설정
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';

import StepIndicator from './StepIndicator';
import Step1BasicInfo from './Step1BasicInfo';
import Step2ScopeSelect from './Step2ScopeSelect';
import Step3PartitionSetup from './Step3PartitionSetup';
import Step4MarsConfig from './Step4MarsConfig';
import type { WizardStep, WizardFormData } from './types';
import { INITIAL_WIZARD_DATA, SCOPE_LABELS, getWizardSteps } from './types';
import type { NewProjectFormData } from '@/types/supabase';

interface NewProjectWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
  loading?: boolean;
  error?: string | null;
  onCreate: (data: NewProjectFormData) => Promise<string | null>;
}

const NewProjectWizard: React.FC<NewProjectWizardProps> = ({
  open,
  onClose,
  onCreated,
  loading = false,
  error,
  onCreate,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_WIZARD_DATA);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // MARS 파티션 존재 여부 → 동적 Step 4
  const hasMarsPartition = formData.partitions.some((p) => p.analysisCode === 'MARS');
  const lastStep: WizardStep = hasMarsPartition ? 4 : 3;
  const wizardSteps = getWizardSteps(hasMarsPartition);

  // 폼 데이터 업데이트
  const handleFormChange = useCallback((updates: Partial<WizardFormData>) => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };

      // Step 4에 있는데 MARS 파티션이 모두 제거된 경우 Step 3으로 되돌림
      const stillHasMars = next.partitions.some((p) => p.analysisCode === 'MARS');
      if (!stillHasMars) {
        setCurrentStep((step) => (step === 4 ? 3 : step) as WizardStep);
      }

      return next;
    });
    setLocalError(null);
  }, []);

  // 스텝 이동 가능 여부 검증
  const canProceedToStep = (targetStep: WizardStep): string | null => {
    if (targetStep === 2) {
      // Step 1 → Step 2: Title 필수
      if (!formData.title.trim()) {
        return '프로젝트 이름을 입력해주세요.';
      }
    }

    if (targetStep === 3) {
      // Step 2 → Step 3: Scope 최소 1개
      if (formData.scope.length === 0) {
        return 'Project Scope를 최소 1개 이상 선택해주세요.';
      }
    }

    if (targetStep === 4) {
      // Step 3 → Step 4: Partition 유효성 (기본 검증)
      if (formData.partitions.length === 0) {
        return 'Partition을 최소 1개 이상 추가해주세요.';
      }
      for (const partition of formData.partitions) {
        if (!partition.name.trim()) {
          return '모든 Partition의 이름을 입력해주세요.';
        }
        if (partition.scope.length === 0) {
          return `"${partition.name}" Partition의 Scope를 선택해주세요.`;
        }
      }
    }

    return null;
  };

  // 최종 생성 검증
  const validateForCreate = (): string | null => {
    if (!formData.title.trim()) {
      return '프로젝트 이름을 입력해주세요.';
    }

    if (formData.scope.length === 0) {
      return 'Project Scope를 최소 1개 이상 선택해주세요.';
    }

    if (formData.partitions.length === 0) {
      return 'Partition을 최소 1개 이상 추가해주세요.';
    }

    // 파티션 유효성 검사
    for (const partition of formData.partitions) {
      if (!partition.name.trim()) {
        return '모든 Partition의 이름을 입력해주세요.';
      }
      if (partition.scope.length === 0) {
        return `"${partition.name}" Partition의 Scope를 선택해주세요.`;
      }
    }

    // 스코프 커버리지 검사
    const usedScopes = new Set(formData.partitions.flatMap((p) => p.scope));
    const unassignedScopes = formData.scope.filter((s) => !usedScopes.has(s));

    if (unassignedScopes.length > 0) {
      const unassignedLabels = unassignedScopes.map((s) => SCOPE_LABELS[s]).join(', ');
      return `다음 Scope가 Partition에 할당되지 않았습니다: ${unassignedLabels}`;
    }

    // MARS RESTART 검증: 소스 프로젝트/모델 필수
    for (const partition of formData.partitions) {
      if (
        partition.analysisCode === 'MARS' &&
        partition.marsConfig?.problemType === 'RESTART'
      ) {
        const source = partition.marsConfig.restartSource;
        if (!source?.projectId || !source?.modelId) {
          return `"${partition.name}" RESTART 파티션의 Source Project와 Model을 선택해주세요.`;
        }
      }
    }

    return null;
  };

  // 다음 스텝으로 이동
  const handleNext = () => {
    const nextStep = (currentStep + 1) as WizardStep;
    const validationError = canProceedToStep(nextStep);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    setCurrentStep(nextStep);
  };

  // 이전 스텝으로 이동
  const handleBack = () => {
    setLocalError(null);
    setCurrentStep((prev) => (prev - 1) as WizardStep);
  };

  // 스텝 클릭으로 이동 (완료된 스텝만)
  const handleStepClick = (step: WizardStep) => {
    if (step < currentStep) {
      setLocalError(null);
      setCurrentStep(step);
    }
  };

  // 프로젝트 생성
  const handleCreate = async () => {
    const validationError = validateForCreate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setIsCreating(true);
    try {
      const projectData: NewProjectFormData = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
        scope: formData.scope,
        partitions: formData.partitions,
      };

      const projectId = await onCreate(projectData);
      if (projectId) {
        onCreated?.(projectId);
        handleClose();
      }
    } catch (err) {
      setLocalError('프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // 다이얼로그 닫기
  const handleClose = () => {
    setFormData(INITIAL_WIZARD_DATA);
    setCurrentStep(1);
    setLocalError(null);
    onClose();
  };

  const displayError = localError || error;

  // 현재 스텝 렌더링
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicInfo data={formData} onChange={handleFormChange} />;
      case 2:
        return <Step2ScopeSelect data={formData} onChange={handleFormChange} />;
      case 3:
        return <Step3PartitionSetup data={formData} onChange={handleFormChange} />;
      case 4:
        return <Step4MarsConfig data={formData} onChange={handleFormChange} />;
      default:
        return null;
    }
  };

  // 버튼 상태
  const isLastStep = currentStep === lastStep;
  const isFirstStep = currentStep === 1;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '85vh' },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, pb: 0 }}>New Project</DialogTitle>

      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pt: 0,
          pb: 1,
        }}
      >
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={wizardSteps} onStepClick={handleStepClick} />

        {/* Error Alert */}
        {displayError && (
          <Alert severity="error" sx={{ mb: 1, mx: 1 }}>
            {displayError}
          </Alert>
        )}

        {/* Step Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: 1,
          }}
        >
          {renderCurrentStep()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        {/* Back Button */}
        {!isFirstStep && (
          <Button onClick={handleBack} disabled={loading || isCreating} startIcon={<ArrowBack />}>
            Back
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Cancel Button */}
        <Button onClick={handleClose} disabled={loading || isCreating}>
          Cancel
        </Button>

        {/* Next / Create Button */}
        {isLastStep ? (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={loading || isCreating || formData.partitions.length === 0}
            startIcon={isCreating ? <CircularProgress size={16} /> : null}
          >
            {isCreating ? 'Creating…' : 'Create'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading || isCreating}
            endIcon={<ArrowForward />}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NewProjectWizard;
