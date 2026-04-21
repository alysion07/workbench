/**
 * Project Picker Components
 *
 * PRJ-001: 프로젝트 선택/생성 페이지 관련 컴포넌트 모음
 */

// 기존 컴포넌트
export { default as ReactorSystemSVG } from './ReactorSystemSVG';
export type { ReactorComponentId } from './ReactorSystemSVG';
export { default as ComponentViewerDemo } from './ComponentViewerDemo';

// PRJ-001 신규 컴포넌트
export { default as ProjectGrid } from './ProjectGrid';
export { default as SideInfoPanel } from './SideInfoPanel';
export { default as ProjectPickerContent } from './ProjectPickerContent';
export { default as ProjectScopeSelector } from './ProjectScopeSelector';
export { default as PartitionCard } from './PartitionCard';

// 새 프로젝트 위저드 (3단계)
export { default as NewProjectWizard } from './NewProjectWizard';
/** @deprecated NewProjectWizard 사용 권장 */
export { default as NewProjectDialog } from './NewProjectDialog';

// 타입은 supabase.ts에서 import
export type { NewProjectFormData, PartitionFormData } from '@/types/supabase';
