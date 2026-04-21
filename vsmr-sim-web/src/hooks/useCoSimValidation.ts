/**
 * useCoSimValidation — Co-Sim 설정 검증 Hook
 * 모든 실행 경로에서 사용하여 Co-Sim 모드 판별 + 설정 완료 여부 확인
 */

import { useMemo } from 'react';
import { useCoSimConfigStore } from '@/stores/coSimConfigStore';
import { useModelTabs } from '@/hooks/useModelTabs';
import { validateCoSimConfig } from '@/types/cosim';
import type { CoSimValidationResult } from '@/types/cosim';

interface UseCoSimValidationReturn {
  /** 모델 2개 이상 = Co-Sim 모드 */
  isCoSimMode: boolean;
  /** Co-Sim 설정 검증 결과 */
  validation: CoSimValidationResult;
  /** 실행 가능 여부: 단일 모델이거나, Co-Sim 설정 완료 */
  canExecute: boolean;
  /** 미완료 시 상태 메시지 */
  statusMessage: string | null;
}

export function useCoSimValidation(): UseCoSimValidationReturn {
  const { isMultiModel } = useModelTabs();
  const config = useCoSimConfigStore((s) => s.config);

  return useMemo(() => {
    const isCoSimMode = isMultiModel;

    if (!isCoSimMode) {
      return {
        isCoSimMode: false,
        validation: { isNmlComplete: true, isXmlComplete: true, isComplete: true, errors: [] },
        canExecute: true,
        statusMessage: null,
      };
    }

    const validation = validateCoSimConfig(config);

    return {
      isCoSimMode: true,
      validation,
      canExecute: validation.isComplete,
      statusMessage: validation.isComplete
        ? null
        : `Co-Sim 설정 미완료: ${validation.errors[0] ?? '설정을 확인해주세요'}`,
    };
  }, [isMultiModel, config]);
}
