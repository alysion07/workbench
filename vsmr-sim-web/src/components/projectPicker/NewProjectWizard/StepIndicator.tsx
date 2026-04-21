/**
 * StepIndicator Component
 * 위저드 진행 상태 표시 (●━━○━━○)
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import type { WizardStep, StepInfo } from './types';
import { WIZARD_STEPS } from './types';

interface StepIndicatorProps {
  currentStep: WizardStep;
  steps?: StepInfo[];
  onStepClick?: (step: WizardStep) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps, onStepClick }) => {
  const displaySteps = steps ?? WIZARD_STEPS;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 2,
        px: 2,
      }}
    >
      {displaySteps.map((stepInfo, index) => {
        const isActive = stepInfo.step === currentStep;
        const isCompleted = stepInfo.step < currentStep;
        const isClickable = onStepClick && stepInfo.step < currentStep;

        return (
          <React.Fragment key={stepInfo.step}>
            {/* Step Circle + Label */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isClickable ? 'pointer' : 'default',
                '&:hover': isClickable
                  ? {
                      '& .step-circle': {
                        transform: 'scale(1.1)',
                      },
                    }
                  : {},
              }}
              onClick={() => isClickable && onStepClick(stepInfo.step)}
            >
              {/* Circle */}
              <Box
                className="step-circle"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  ...(isCompleted
                    ? {
                        bgcolor: 'success.main',
                        color: 'white',
                      }
                    : isActive
                    ? {
                        bgcolor: 'primary.main',
                        color: 'white',
                        boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.2)',
                      }
                    : {
                        bgcolor: 'grey.200',
                        color: 'grey.500',
                      }),
                }}
              >
                {isCompleted ? (
                  <CheckIcon sx={{ fontSize: 20 }} />
                ) : (
                  <Typography variant="body2" fontWeight={600}>
                    {stepInfo.step}
                  </Typography>
                )}
              </Box>

              {/* Label */}
              <Typography
                variant="caption"
                sx={{
                  mt: 1,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'primary.main' : isCompleted ? 'success.main' : 'text.secondary',
                }}
              >
                {stepInfo.description}
              </Typography>
            </Box>

            {/* Connector Line */}
            {index < displaySteps.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 3,
                  mx: 2,
                  mb: 3, // Offset for label
                  borderRadius: 1.5,
                  bgcolor: stepInfo.step < currentStep ? 'success.main' : 'grey.200',
                  transition: 'background-color 0.3s ease',
                  maxWidth: 100,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default StepIndicator;
