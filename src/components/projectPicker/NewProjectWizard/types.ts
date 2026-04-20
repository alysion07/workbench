/**
 * NewProjectWizard Types
 * 위저드 관련 타입 정의
 */

import type { SystemScope, PartitionFormData } from '@/types/supabase';

// 위저드 스텝 정의 (Step 4: MARS 파티션 존재 시 동적 추가)
export type WizardStep = 1 | 2 | 3 | 4;

// 위저드 스텝 정보
export interface StepInfo {
  step: WizardStep;
  label: string;
  description: string;
}

// 동적 위저드 스텝 생성 (MARS 파티션 유무에 따라 Step 4 추가)
export const getWizardSteps = (hasMarsPartition: boolean): StepInfo[] => {
  const steps: StepInfo[] = [
    { step: 1, label: 'Step 1', description: '기본 정보' },
    { step: 2, label: 'Step 2', description: 'Scope 선택' },
    { step: 3, label: 'Step 3', description: 'Partition 설정' },
  ];

  if (hasMarsPartition) {
    steps.push({ step: 4, label: 'Step 4', description: 'MARS 설정' });
  }

  return steps;
};

// 하위 호환용 기본 스텝 (Step 4 없음)
export const WIZARD_STEPS: StepInfo[] = getWizardSteps(false);

// 위저드 폼 데이터
export interface WizardFormData {
  // Step 1: 기본 정보
  title: string;
  description: string;
  tags: string[];
  // Step 2: Project Scope
  scope: SystemScope[];
  // Step 3: Partitions
  partitions: PartitionFormData[];
}

// 초기 폼 데이터
export const INITIAL_WIZARD_DATA: WizardFormData = {
  title: '',
  description: '',
  tags: [],
  scope: [],
  partitions: [],
};

// Scope 라벨
export const SCOPE_LABELS: Record<SystemScope, string> = {
  primary: 'Primary Loop',
  secondary: 'Secondary Loop',
  bop: 'BOP',
};

// 스코프별 색상 정의
export const SCOPE_COLORS: Record<SystemScope, { bg: string; color: string; border: string }> = {
  primary: { bg: '#ffebee', color: '#c62828', border: '#c62828' },
  secondary: { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0' },
  bop: { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32' },
};

// Partition 색상 (Step 3 SVG 연동용)
export const PARTITION_COLORS = [
  { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0' },   // Blue
  { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32' },   // Green
  { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32' },   // Green
  { bg: '#f3e5f5', color: '#7b1fa2', border: '#7b1fa2' },   // Purple
  { bg: '#fce4ec', color: '#c2185b', border: '#c2185b' },   // Pink
];

export const ALL_SCOPES: SystemScope[] = ['primary', 'secondary', 'bop'];
