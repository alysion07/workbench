/**
 * useModelTabs
 * 프로젝트 내 모델 탭 전환 공통 훅
 * - projectStore에서 모델 목록 조회
 * - URL searchParams의 modelId와 양방향 동기화
 */

import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import type { Model } from '@/types/supabase';

interface UseModelTabsOptions {
  /** 탭 전환 시 추가 사이드이펙트 (e.g. simulationStore.setActiveModel) */
  onSwitch?: (modelId: string | null) => void;
}

interface UseModelTabsReturn {
  models: Model[];
  activeModelId: string | null;
  switchModel: (modelId: string | null) => void;
  isMultiModel: boolean;
  showTabs: boolean;
}

export function useModelTabs(options?: UseModelTabsOptions): UseModelTabsReturn {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [searchParams, setSearchParams] = useSearchParams();

  const models = useMemo(
    () => currentProject?.data?.models ?? [],
    [currentProject],
  );

  const activeModelId = searchParams.get('modelId');

  const switchModel = useCallback(
    (modelId: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (modelId) {
          next.set('modelId', modelId);
        } else {
          next.delete('modelId');
        }
        return next;
      });
      options?.onSwitch?.(modelId);
    },
    [setSearchParams, options],
  );

  const isMultiModel = models.length > 1;

  return {
    models,
    activeModelId,
    switchModel,
    isMultiModel,
    showTabs: isMultiModel,
  };
}
