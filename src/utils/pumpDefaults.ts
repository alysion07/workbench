/**
 * PUMP 컴포넌트 기본값 유틸리티
 * SMART.txt 기반 기본 상사곡선 및 속도 제어 데이터 제공
 */

import type { PumpCurve, PumpSpeedControl } from '../types/mars';

/**
 * SMART.txt 기반 기본 상사곡선 (Homologous Curves)
 * 16개 곡선 세트: han, ban, hvn, bvn, had, bad, hvd, bvd, hat, bat, hvt, bvt, har, bar, hvr, bvr
 *
 * 각 곡선은 최소 2개의 포인트(시작/끝)로 초기화
 * 실제 사용 시 사용자가 추가 포인트를 입력하거나 CSV로 임포트
 */
export function getDefaultHomologousCurves(): PumpCurve[] {
  return [
    // ===== Regime 1: 정방향 기본 영역 =====
    {
      name: 'han',
      type: 1,
      regime: 1,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'h/a2',
      points: [
        { x: 0.000, y: 1.652 },
        { x: 0.999, y: 0.996 },
      ],
    },
    {
      name: 'ban',
      type: 2,
      regime: 1,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'b/a2',
      points: [
        { x: 0.000, y: 1.125 },
        { x: 0.999, y: 0.998 },
      ],
    },

    // ===== Regime 2: 정방향 기본 영역 (a/v 표현) =====
    {
      name: 'hvn',
      type: 1,
      regime: 2,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'h/v2',
      points: [
        { x: 0.000, y: 1.000 },
        { x: 1.000, y: 1.652 },
      ],
    },
    {
      name: 'bvn',
      type: 2,
      regime: 2,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'b/v2',
      points: [
        { x: 0.000, y: 1.000 },
        { x: 1.000, y: 1.125 },
      ],
    },

    // ===== Regime 3: 정방향 저유량/특수 영역 =====
    {
      name: 'had',
      type: 1,
      regime: 3,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'h/a2',
      points: [
        { x: -1.000, y: 1.200 },
        { x: 0.000, y: 1.650 },
      ],
    },
    {
      name: 'bad',
      type: 2,
      regime: 3,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'b/a2',
      points: [
        { x: -1.000, y: 0.800 },
        { x: 0.000, y: 1.120 },
      ],
    },

    // ===== Regime 4: 정방향 저유량/특수 (a/v 표현) =====
    {
      name: 'hvd',
      type: 1,
      regime: 4,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'h/v2',
      points: [
        { x: -1.000, y: 1.200 },
        { x: 0.000, y: 1.000 },
      ],
    },
    {
      name: 'bvd',
      type: 2,
      regime: 4,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'b/v2',
      points: [
        { x: -1.000, y: 0.800 },
        { x: 0.000, y: 1.000 },
      ],
    },

    // ===== Regime 5: 과유량/특수 영역 =====
    {
      name: 'hat',
      type: 1,
      regime: 5,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'h/a2',
      points: [
        { x: 1.000, y: 0.995 },
        { x: 1.500, y: 0.700 },
      ],
    },
    {
      name: 'bat',
      type: 2,
      regime: 5,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'b/a2',
      points: [
        { x: 1.000, y: 0.998 },
        { x: 1.500, y: 1.200 },
      ],
    },

    // ===== Regime 6: 과유량/특수 (a/v 표현) =====
    {
      name: 'hvt',
      type: 1,
      regime: 6,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'h/v2',
      points: [
        { x: 1.000, y: 1.652 },
        { x: 1.500, y: 1.400 },
      ],
    },
    {
      name: 'bvt',
      type: 2,
      regime: 6,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'b/v2',
      points: [
        { x: 1.000, y: 1.125 },
        { x: 1.500, y: 1.300 },
      ],
    },

    // ===== Regime 7: 역운전 영역 =====
    {
      name: 'har',
      type: 1,
      regime: 7,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'h/a2',
      points: [
        { x: -1.000, y: -0.500 },
        { x: 0.000, y: 0.000 },
      ],
    },
    {
      name: 'bar',
      type: 2,
      regime: 7,
      enabled: false,
      xLabel: 'v/a',
      yLabel: 'b/a2',
      points: [
        { x: -1.000, y: -0.400 },
        { x: 0.000, y: 0.000 },
      ],
    },

    // ===== Regime 8: 역운전 영역 (a/v 표현) =====
    {
      name: 'hvr',
      type: 1,
      regime: 8,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'h/v2',
      points: [
        { x: -0.999, y: -3.576 },
        { x: 0.000, y: -1.723 },
      ],
    },
    {
      name: 'bvr',
      type: 2,
      regime: 8,
      enabled: false,
      xLabel: 'a/v',
      yLabel: 'b/v2',
      points: [
        { x: -0.999, y: -5.947 },
        { x: 0.000, y: -1.617 },
      ],
    },
  ];
}

/**
 * 기본 속도 제어 데이터
 * SMART.txt 기반: Control Variable 181, 제어변수에 따른 속도 테이블
 */
export function getDefaultSpeedControl(): PumpSpeedControl {
  return {
    tripOrControl: 603,
    keyword: 'cntrlvar',
    parameter: 181,
    speedTable: [
      { searchVariable: -1000.0, pumpSpeed: 0.0 },
      { searchVariable: 0.0, pumpSpeed: 494.2772 },
      { searchVariable: 500.0, pumpSpeed: 720.0 },
    ],
  };
}

/**
 * 곡선 이름별 카드 번호 베이스 매핑
 * 예: han → 1100, ban → 1200, hvn → 1300
 */
export const CURVE_NAME_TO_CARD_BASE: Record<string, string> = {
  han: '1100',
  ban: '1200',
  hvn: '1300',
  bvn: '1400',
  had: '1500',
  bad: '1600',
  hvd: '1700',
  bvd: '1800',
  hat: '1900',
  bat: '2000',
  hvt: '2100',
  bvt: '2200',
  har: '2300',
  bar: '2400',
  hvr: '2500',
  bvr: '2600',
};

/**
 * Regime별 곡선 이름 그룹
 */
export const REGIME_GROUPS = [
  {
    regime: 1,
    label: '정방향 기본',
    curves: ['han', 'ban'],
  },
  {
    regime: 2,
    label: '정방향 기본 (a/v)',
    curves: ['hvn', 'bvn'],
  },
  {
    regime: 3,
    label: '정방향 저유량',
    curves: ['had', 'bad'],
  },
  {
    regime: 4,
    label: '정방향 저유량 (a/v)',
    curves: ['hvd', 'bvd'],
  },
  {
    regime: 5,
    label: '과유량/특수',
    curves: ['hat', 'bat'],
  },
  {
    regime: 6,
    label: '과유량/특수 (a/v)',
    curves: ['hvt', 'bvt'],
  },
  {
    regime: 7,
    label: '역운전',
    curves: ['har', 'bar'],
  },
  {
    regime: 8,
    label: '역운전 (a/v)',
    curves: ['hvr', 'bvr'],
  },
];
