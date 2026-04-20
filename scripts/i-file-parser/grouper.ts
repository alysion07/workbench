/**
 * CCC 그룹핑 + 컴포넌트 타입 판별 모듈
 *
 * 토큰화된 카드 배열을 CCC(컴포넌트 번호)별로 그룹핑하고,
 * CCC0000 카드의 W2 값으로 컴포넌트 타입을 판별
 *
 * 카드 번호 구조:
 * - 수력 컴포넌트: CCCXXXX (7자리) → CCC = floor(cardNum / 10000)
 * - 열구조체: 1CCCGXNN (8자리) → CCC = 4자리 (1XXX)
 * - 글로벌 설정: 1~299
 * - Minor Edits: 301~399, 20800001+
 * - Trips: 401~799
 * - 제어변수: 205CCCNN
 * - Thermal Properties: 201MMMNN
 * - General Tables: 202TTTNN
 * - Reactor Kinetics: 30000XXX
 */

import { Card } from './tokenizer';

export type ComponentType =
  | 'snglvol' | 'sngljun' | 'pipe' | 'branch' | 'tmdpvol' | 'tmdpjun'
  | 'mtpljun' | 'pump' | 'valve' | 'turbine' | 'tank' | 'htstr';

export interface ComponentBlock {
  ccc: number;              // CCC 번호 (100~999 수력, 1000~9999 열구조체)
  componentType: ComponentType;
  componentName: string;    // CCC0000 W1 (이름)
  cards: Card[];            // 해당 CCC의 모든 카드
  componentId: string;      // Store용 ID ("1200000" 등)
}

export interface GlobalBlock {
  type: 'global' | 'minor-edits' | 'variable-trips' | 'logic-trips'
    | 'control-variables' | 'thermal-properties' | 'general-tables'
    | 'reactor-kinetics' | 'interactive-inputs';
  cards: Card[];
}

export interface GroupResult {
  components: ComponentBlock[];
  globals: GlobalBlock[];
  unclassified: Card[];     // 분류 실패 카드
}

// 유효한 컴포넌트 타입 목록
const VALID_TYPES = new Set<string>([
  'snglvol', 'sngljun', 'pipe', 'branch', 'tmdpvol', 'tmdpjun',
  'mtpljun', 'pump', 'valve', 'turbine', 'tank',
  'separatr',  // Separator — Branch 구조와 동일, 현 GUI에 미지원이므로 branch로 매핑
]);

/**
 * 카드 배열을 컴포넌트/글로벌 블록으로 분류
 */
export function groupCards(cards: Card[]): GroupResult {
  const components: ComponentBlock[] = [];
  const globals: GlobalBlock[] = [];
  const unclassified: Card[] = [];

  // 1단계: 카드 범위별 분류
  const globalCards: Card[] = [];
  const minorEditCards: Card[] = [];
  const variableTripCards: Card[] = [];
  const logicTripCards: Card[] = [];
  const interactiveCards: Card[] = [];
  const controlVarCards: Card[] = [];
  const thermalPropCards: Card[] = [];
  const generalTableCards: Card[] = [];
  const reactorKineticsCards: Card[] = [];
  const componentCards: Card[] = [];       // CCC XXXX 형태
  const heatStructureCards: Card[] = [];   // 1CCCGXNN 형태

  for (const card of cards) {
    const cn = card.cardNumber;

    if (cn >= 1 && cn <= 199) {
      globalCards.push(card);
    } else if (cn >= 200 && cn <= 299) {
      globalCards.push(card);
    } else if (cn >= 301 && cn <= 399) {
      minorEditCards.push(card);
    } else if (cn >= 401 && cn <= 599) {
      variableTripCards.push(card);
    } else if (cn >= 601 && cn <= 799) {
      logicTripCards.push(card);
    } else if (cn >= 801 && cn <= 999) {
      interactiveCards.push(card);
    } else if (cn >= 20800001 && cn <= 20899999) {
      // 확장 Minor Edits
      minorEditCards.push(card);
    } else if (cn >= 30000000 && cn <= 30099999) {
      // Reactor Kinetics
      reactorKineticsCards.push(card);
    } else if (isHeatStructureCard(cn)) {
      heatStructureCards.push(card);
    } else if (isControlVariableCard(cn)) {
      controlVarCards.push(card);
    } else if (isThermalPropertyCard(cn)) {
      thermalPropCards.push(card);
    } else if (isGeneralTableCard(cn)) {
      generalTableCards.push(card);
    } else if (cn >= 1000000 && cn <= 9999999) {
      // 수력 컴포넌트 (CCCXXXX, 7자리)
      componentCards.push(card);
    } else {
      unclassified.push(card);
    }
  }

  // 2단계: 글로벌 블록 수집 (중복 카드 제거: MARS 마지막 유효 규칙)
  if (globalCards.length > 0) {
    globals.push({ type: 'global', cards: deduplicateCards(globalCards) });
  }
  if (minorEditCards.length > 0) {
    globals.push({ type: 'minor-edits', cards: deduplicateCards(minorEditCards) });
  }
  if (variableTripCards.length > 0) {
    globals.push({ type: 'variable-trips', cards: deduplicateCards(variableTripCards) });
  }
  if (logicTripCards.length > 0) {
    globals.push({ type: 'logic-trips', cards: deduplicateCards(logicTripCards) });
  }
  if (interactiveCards.length > 0) {
    globals.push({ type: 'interactive-inputs', cards: deduplicateCards(interactiveCards) });
  }
  if (controlVarCards.length > 0) {
    globals.push({ type: 'control-variables', cards: deduplicateCards(controlVarCards) });
  }
  if (thermalPropCards.length > 0) {
    globals.push({ type: 'thermal-properties', cards: deduplicateCards(thermalPropCards) });
  }
  if (generalTableCards.length > 0) {
    globals.push({ type: 'general-tables', cards: deduplicateCards(generalTableCards) });
  }
  if (reactorKineticsCards.length > 0) {
    globals.push({ type: 'reactor-kinetics', cards: deduplicateCards(reactorKineticsCards) });
  }

  // 3단계: 수력 컴포넌트 CCC 그룹핑
  const cccMap = new Map<number, Card[]>();
  for (const card of componentCards) {
    const ccc = Math.floor(card.cardNumber / 10000);
    if (!cccMap.has(ccc)) {
      cccMap.set(ccc, []);
    }
    cccMap.get(ccc)!.push(card);
  }

  // CCC0000 카드에서 타입/이름 추출
  for (const [ccc, cccCards] of cccMap) {
    const typeCard = cccCards.find(c => c.cardNumber === ccc * 10000);
    if (!typeCard) {
      // CCC0000 카드 없음 → unclassified
      unclassified.push(...cccCards);
      continue;
    }

    const componentName = typeCard.words[0] || `comp_${ccc}`;
    const typeStr = typeCard.words[1]?.toLowerCase();

    if (!typeStr || !VALID_TYPES.has(typeStr)) {
      // 알 수 없는 타입
      unclassified.push(...cccCards);
      continue;
    }

    // separatr: branch와 구조 동일, 매핑 없이 원본 타입 보존
    const mappedType = typeStr;

    components.push({
      ccc,
      componentType: mappedType as ComponentType,
      componentName,
      cards: deduplicateCards(cccCards),
      componentId: `${ccc * 10000}`,
    });
  }

  // 4단계: 열구조체 CCCG 그룹핑 (Geometry별 분리)
  const hsCccgMap = new Map<number, Card[]>();
  for (const card of heatStructureCards) {
    const hsCccg = extractHeatStructureCCCG(card.cardNumber);
    if (hsCccg === null) {
      unclassified.push(card);
      continue;
    }
    if (!hsCccgMap.has(hsCccg)) {
      hsCccgMap.set(hsCccg, []);
    }
    hsCccgMap.get(hsCccg)!.push(card);
  }

  for (const [hsCccg, hsCards] of hsCccgMap) {
    // componentId = CCCG * 1000 → 7자리 (예: hsCccg=11200 → CCCG=1200 → 1200000)
    // Generator expects 7-digit format: id.slice(0,3)=CCC, id.slice(3,4)=G
    const cccg = hsCccg % 10000;  // strip leading '1' from 1CCCG
    components.push({
      ccc: hsCccg,
      componentType: 'htstr',
      componentName: `hs_${hsCccg}`,
      cards: deduplicateCards(hsCards),
      componentId: `${cccg * 1000}`,
    });
  }

  // CCC 번호 순 정렬
  components.sort((a, b) => a.ccc - b.ccc);

  return { components, globals, unclassified };
}

/**
 * 중복 카드 제거 (MARS 규칙: 같은 카드번호 반복 시 마지막이 유효)
 * 입력 순서가 파일 순서를 유지한다고 가정하고, Map으로 마지막 덮어쓰기
 */
function deduplicateCards(cards: Card[]): Card[] {
  const map = new Map<number, Card>();
  for (const card of cards) {
    map.set(card.cardNumber, card);
  }
  return [...map.values()].sort((a, b) => a.cardNumber - b.cardNumber);
}

/**
 * 열구조체 카드 판별
 * 카드 번호 8자리, 1CCCGXNN 형태
 */
function isHeatStructureCard(cardNumber: number): boolean {
  // 8자리 (10000000 ~ 99999999)이고, 컴포넌트 CCC 범위
  if (cardNumber < 10000000 || cardNumber > 99999999) return false;

  // 제어변수(205XXXXX), Thermal Property(201XXXXX), General Table(202XXXXX) 제외
  const prefix3 = Math.floor(cardNumber / 100000);
  if (prefix3 >= 201 && prefix3 <= 209) return false;

  return true;
}

/**
 * 열구조체 카드에서 CCCG 추출
 * 1CCCGXNN → 1CCCG (5자리)
 *
 * 같은 CCC라도 Geometry(G)가 다르면 별도 열구조체 그룹이므로
 * CCC+G 단위로 그룹핑해야 함
 */
function extractHeatStructureCCCG(cardNumber: number): number | null {
  // 8자리: 1CCCGXNN
  const str = cardNumber.toString();
  if (str.length !== 8) return null;

  // 1CCCG = str[0..5] (5자리)
  const cccg = parseInt(str.substring(0, 5), 10);
  return cccg;
}

/**
 * 제어변수 카드 판별 (205CCCNN)
 */
function isControlVariableCard(cardNumber: number): boolean {
  // 205XXXXX (20500000 ~ 20599999)
  return cardNumber >= 20500000 && cardNumber <= 20599999;
}

/**
 * Thermal Property 카드 판별 (201MMMNN)
 */
function isThermalPropertyCard(cardNumber: number): boolean {
  return cardNumber >= 20100000 && cardNumber <= 20199999;
}

/**
 * General Table 카드 판별 (202TTTNN)
 */
function isGeneralTableCard(cardNumber: number): boolean {
  return cardNumber >= 20200000 && cardNumber <= 20299999;
}
