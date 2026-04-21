/**
 * ReactorSystemSVG - 원자로 시스템 다이어그램
 *
 * Component Viewer용 인터랙티브 SVG
 * 체크박스 선택에 따라 해당 컴포넌트가 하이라이트됨
 */

import React from 'react';
import { Box } from '@mui/material';
import type { SystemScope } from '@/types/supabase';
import { SCOPE_COLORS } from './NewProjectWizard/types';

// 컴포넌트 ID 타입 정의
export type ReactorComponentId =
  | 'reactor'
  | 'steamGenerator'
  | 'turbine'
  | 'condenser'
  | 'feedwaterPump'
  | 'coolingTower';

// 컴포넌트 → 스코프 매핑
const componentToScope: Record<ReactorComponentId, SystemScope> = {
  reactor: 'primary',
  steamGenerator: 'primary',
  turbine: 'secondary',
  condenser: 'secondary',
  feedwaterPump: 'secondary',
  coolingTower: 'bop',
};

interface ReactorSystemSVGProps {
  /** 하이라이트할 컴포넌트 ID 배열 */
  highlightedComponents: ReactorComponentId[];
  /** 컴포넌트 호버 시 콜백 */
  onComponentHover?: (componentId: ReactorComponentId | null) => void;
  /** 컴포넌트 클릭 시 콜백 */
  onComponentClick?: (componentId: ReactorComponentId) => void;
  /** SVG 너비 */
  width?: number | string;
  /** SVG 높이 */
  height?: number | string;
}

const ReactorSystemSVG: React.FC<ReactorSystemSVGProps> = ({
  highlightedComponents,
  onComponentHover,
  onComponentClick,
  width = '100%',
  height = 'auto',
}) => {
  // 색상 정의
  const colors = {
    // 기본 컴포넌트 색상
    default: {
      fill: '#E5E7EB',
      stroke: '#9CA3AF',
    },
    // Primary Loop 파이프 색상
    primaryLoop: {
      pipe: '#EF4444',
      pipeLight: '#FCA5A5',
    },
    // Secondary Loop 파이프 색상
    secondaryLoop: {
      pipe: '#3B82F6',
      pipeLight: '#93C5FD',
    },
    // 텍스트
    text: '#374151',
  };

  // 하이라이트 여부 확인
  const isHighlighted = (id: ReactorComponentId) => highlightedComponents.includes(id);

  // 스코프별 하이라이트 색상 반환
  const getScopeHighlight = (id: ReactorComponentId) => {
    const scope = componentToScope[id];
    const scopeColor = SCOPE_COLORS[scope];
    return {
      fill: scopeColor.bg,
      stroke: scopeColor.border,
      shadow: `drop-shadow(0 0 8px ${scopeColor.border}40)`,
    };
  };

  // 컴포넌트 스타일 반환
  const getComponentStyle = (id: ReactorComponentId) => {
    const highlighted = isHighlighted(id);
    const highlight = highlighted ? getScopeHighlight(id) : null;
    return {
      fill: highlighted ? highlight!.fill : colors.default.fill,
      stroke: highlighted ? highlight!.stroke : colors.default.stroke,
      strokeWidth: highlighted ? 3 : 2,
      cursor: onComponentClick ? 'pointer' : 'default',
      transition: 'all 0.3s ease',
      filter: highlighted ? highlight!.shadow : 'none',
    };
  };

  // 텍스트 스타일 (항상 진한 색 유지 - 가독성)
  const getTextStyle = (_id: ReactorComponentId) => ({
    fill: colors.text,
    fontSize: '12px',
    fontWeight: 400 as const,
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
  });

  // 이벤트 핸들러
  const handleMouseEnter = (id: ReactorComponentId) => {
    onComponentHover?.(id);
  };

  const handleMouseLeave = () => {
    onComponentHover?.(null);
  };

  const handleClick = (id: ReactorComponentId) => {
    onComponentClick?.(id);
  };

  return (
    <Box
      sx={{
        width,
        height,
        minHeight: 0, // flex child가 shrink할 수 있도록
        bgcolor: '#F9FAFB',
        borderRadius: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 800 450"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxHeight: '100%' }}
      >
        {/* 배경 그리드 (선택적) */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
          </pattern>

          {/* 그라디언트 정의 */}
          <linearGradient id="reactorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3F4F6" />
            <stop offset="100%" stopColor="#D1D5DB" />
          </linearGradient>

          <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3F4F6" />
            <stop offset="100%" stopColor="#D1D5DB" />
          </linearGradient>
        </defs>

        {/* 영역 라벨 */}
        <text x="150" y="30" fontSize="14" fontWeight="600" fill="#6B7280">
          Primary Loop
        </text>
        <text x="550" y="30" fontSize="14" fontWeight="600" fill="#6B7280">
          Secondary Loop
        </text>

        {/* ========== 파이프라인 (배경) ========== */}

        {/* Primary Loop 파이프 */}
        <g id="primary-pipes">
          {/* Reactor → Steam Generator (상단) */}
          <path
            d="M 160 120 L 160 80 L 280 80 L 280 100"
            fill="none"
            stroke={colors.primaryLoop.pipe}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Steam Generator → Reactor (하단) */}
          <path
            d="M 280 220 L 280 260 L 160 260 L 160 220"
            fill="none"
            stroke={colors.primaryLoop.pipeLight}
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>

        {/* Secondary Loop 파이프 */}
        <g id="secondary-pipes">
          {/* Steam Generator → Turbine */}
          <path
            d="M 330 140 L 420 140"
            fill="none"
            stroke={colors.secondaryLoop.pipe}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Turbine → Condenser */}
          <path
            d="M 520 170 L 580 170 L 580 280"
            fill="none"
            stroke={colors.secondaryLoop.pipeLight}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Condenser → Feedwater Pump */}
          <path
            d="M 540 320 L 420 320"
            fill="none"
            stroke={colors.secondaryLoop.pipeLight}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Feedwater Pump → Steam Generator */}
          <path
            d="M 380 290 L 380 200 L 330 200"
            fill="none"
            stroke={colors.secondaryLoop.pipe}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Generator → Switchyard (전력 전송선) */}
          <path
            d="M 560 160 L 660 160 L 660 305 L 680 305"
            fill="none"
            stroke="#2e7d32"
            strokeWidth="3"
            strokeDasharray="6,3"
            strokeLinecap="round"
          />
          {/* 전력 심볼 - MUI Bolt 아이콘 (수평 구간 중앙) */}
          <circle cx="610" cy="160" r="11" fill="white" stroke="#2e7d32" strokeWidth="1.5" />
          <g transform="translate(601, 151) scale(0.8)">
            <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" fill="#2e7d32" />
          </g>
        </g>

        {/* ========== 컴포넌트들 ========== */}

        {/* 1. Reactor Pressure Vessel */}
        <g
          id="reactor"
          onMouseEnter={() => handleMouseEnter('reactor')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('reactor')}
          style={getComponentStyle('reactor')}
        >
          {/* 원통형 용기 */}
          <ellipse cx="160" cy="120" rx="60" ry="20" />
          <rect x="100" y="120" width="120" height="100" />
          <ellipse cx="160" cy="220" rx="60" ry="20" />

          {/* 내부 코어 표시 */}
          <rect x="130" y="140" width="60" height="60" rx="5" fill="#FCD34D" stroke="#2e7d32" strokeWidth="2" />
        </g>
        {/* Reactor 라벨 (하이라이트 영역 밖) */}
        <text x="160" y="175" {...getTextStyle('reactor')} fontSize="10">Core</text>
        <text x="160" y="255" {...getTextStyle('reactor')}>Reactor</text>
        <text x="160" y="270" {...getTextStyle('reactor')} fontSize="10">Pressure Vessel</text>

        {/* 2. Steam Generator */}
        <g
          id="steamGenerator"
          onMouseEnter={() => handleMouseEnter('steamGenerator')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('steamGenerator')}
          style={getComponentStyle('steamGenerator')}
        >
          {/* U-튜브 형태 표현 */}
          <ellipse cx="280" cy="100" rx="40" ry="15" />
          <rect x="240" y="100" width="80" height="120" />
          <ellipse cx="280" cy="220" rx="40" ry="15" />

          {/* 내부 튜브 표시 */}
          <path
            d="M 260 120 L 260 180 Q 280 200 300 180 L 300 120"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
          />
        </g>
        {/* Steam Generator 라벨 (하이라이트 영역 밖) */}
        <text x="280" y="250" {...getTextStyle('steamGenerator')}>Steam</text>
        <text x="280" y="265" {...getTextStyle('steamGenerator')} fontSize="10">Generator</text>

        {/* 3. Turbine Generator */}
        <g
          id="turbine"
          onMouseEnter={() => handleMouseEnter('turbine')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('turbine')}
          style={getComponentStyle('turbine')}
        >
          {/* 터빈 본체 */}
          <polygon points="420,100 520,120 520,200 420,220" />

          {/* 터빈 블레이드 표시 */}
          <circle cx="470" cy="160" r="30" fill="none" stroke="#6B7280" strokeWidth="2" />
          <line x1="470" y1="130" x2="470" y2="190" stroke="#6B7280" strokeWidth="2" />
          <line x1="440" y1="160" x2="500" y2="160" stroke="#6B7280" strokeWidth="2" />

          {/* 발전기 */}
          <rect x="520" y="130" width="40" height="60" rx="5" />
        </g>
        {/* Turbine 라벨 (하이라이트 영역 밖) */}
        <text x="540" y="165" fontSize="8" fill="#6B7280" textAnchor="middle">GEN</text>
        <text x="470" y="245" {...getTextStyle('turbine')}>Turbine</text>
        <text x="470" y="260" {...getTextStyle('turbine')} fontSize="10">Generator</text>

        {/* 4. Condenser */}
        <g
          id="condenser"
          onMouseEnter={() => handleMouseEnter('condenser')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('condenser')}
          style={getComponentStyle('condenser')}
        >
          {/* 콘덴서 본체 */}
          <rect x="540" y="280" width="80" height="60" rx="5" />

          {/* 내부 튜브 표시 */}
          <line x1="555" y1="290" x2="555" y2="330" stroke="#3B82F6" strokeWidth="2" />
          <line x1="570" y1="290" x2="570" y2="330" stroke="#3B82F6" strokeWidth="2" />
          <line x1="585" y1="290" x2="585" y2="330" stroke="#3B82F6" strokeWidth="2" />
          <line x1="600" y1="290" x2="600" y2="330" stroke="#3B82F6" strokeWidth="2" />
        </g>
        {/* Condenser 라벨 (하이라이트 영역 밖) */}
        <text x="580" y="365" {...getTextStyle('condenser')}>Condenser</text>

        {/* 5. Feedwater Pump */}
        <g
          id="feedwaterPump"
          onMouseEnter={() => handleMouseEnter('feedwaterPump')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('feedwaterPump')}
          style={getComponentStyle('feedwaterPump')}
        >
          {/* 펌프 본체 */}
          <circle cx="400" cy="320" r="30" />

          {/* 임펠러 표시 */}
          <circle cx="400" cy="320" r="15" fill="none" stroke="#6B7280" strokeWidth="2" />
          <path
            d="M 400 305 L 410 320 L 400 335 L 390 320 Z"
            fill="#6B7280"
          />
        </g>
        {/* Feedwater Pump 라벨 (하이라이트 영역 밖) */}
        <text x="400" y="370" {...getTextStyle('feedwaterPump')}>Feedwater</text>
        <text x="400" y="385" {...getTextStyle('feedwaterPump')} fontSize="10">Pump</text>

        {/* 6. Switchyard / BOP */}
        <g
          id="coolingTower"
          onMouseEnter={() => handleMouseEnter('coolingTower')}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick('coolingTower')}
          style={getComponentStyle('coolingTower')}
        >
          {/* 변압기 본체 */}
          <rect x="680" y="290" width="70" height="50" rx="4" />

          {/* 변압기 코일 심볼 (1차/2차 권선) */}
          <circle cx="703" cy="315" r="12" fill="none" stroke="#6B7280" strokeWidth="2" />
          <circle cx="727" cy="315" r="12" fill="none" stroke="#6B7280" strokeWidth="2" />

          {/* 입력 단자 (좌측) */}
          <line x1="680" y1="305" x2="668" y2="305" stroke="#6B7280" strokeWidth="2" />
          <line x1="680" y1="325" x2="668" y2="325" stroke="#6B7280" strokeWidth="2" />

          {/* 출력 → 송전선 */}
          <line x1="750" y1="315" x2="770" y2="315" stroke="#6B7280" strokeWidth="2" />

          {/* 송전탑 */}
          <line x1="770" y1="280" x2="770" y2="340" stroke="#6B7280" strokeWidth="3" />
          <line x1="758" y1="288" x2="782" y2="288" stroke="#6B7280" strokeWidth="2" />
          <line x1="760" y1="298" x2="780" y2="298" stroke="#6B7280" strokeWidth="2" />

          {/* 송전선 */}
          <path
            d="M 758 288 Q 745 282 735 288"
            fill="none" stroke="#6B7280" strokeWidth="1.5"
          />
          <path
            d="M 782 288 Q 792 282 800 288"
            fill="none" stroke="#6B7280" strokeWidth="1.5"
          />
        </g>
        {/* Switchyard 라벨 (하이라이트 영역 밖) */}
        <text x="715" y="365" {...getTextStyle('coolingTower')}>Switchyard</text>

        {/* ========== 범례 ========== */}
        <g id="legend" transform="translate(20, 400)">
          <rect x="0" y="0" width="290" height="40" fill="white" stroke="#E5E7EB" rx="5" />
          <rect x="10" y="12" width="16" height="16" fill={colors.primaryLoop.pipe} rx="2" />
          <text x="32" y="24" fontSize="10" fill="#374151">Primary Loop</text>
          <rect x="100" y="12" width="16" height="16" fill={colors.secondaryLoop.pipe} rx="2" />
          <text x="122" y="24" fontSize="10" fill="#374151">Secondary Loop</text>
          <rect x="205" y="12" width="16" height="16" fill="#2e7d32" rx="2" />
          <text x="227" y="24" fontSize="10" fill="#374151">BOP (Power)</text>
        </g>
      </svg>
    </Box>
  );
};

export default ReactorSystemSVG;
