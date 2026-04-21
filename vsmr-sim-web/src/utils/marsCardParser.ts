/**
 * MARS Card Parser
 * 범용 MARS 입력 카드 파서 + 카드 타입별 전용 파서
 *
 * 1단계: CCC1201 (Volume Initial Conditions) 파서 구현
 * 향후 확장: CCC0101, CCC0301, CCC0901, CCC1301 등
 */

// ============================================================================
// 범용 MARS 카드 파싱
// ============================================================================

/** 파싱된 MARS 카드 한 줄 */
export interface MarsCardLine {
  cardNumber: string;   // 전체 카드 번호 (e.g., "6081201")
  componentId: string;  // 컴포넌트 ID (e.g., "608")
  cardType: string;     // 카드 타입 (e.g., "1201")
  values: string[];     // 나머지 값들 (공백 구분)
  rawLine: string;      // 원본 라인
}

/** 여러 줄 파싱 결과 */
export interface MarsCardParseResult {
  cards: MarsCardLine[];
  skipped: string[];    // 주석/빈줄 등 스킵된 라인
}

/**
 * MARS 카드 한 줄 파싱
 * 카드 번호(3자리 이상 숫자)와 나머지 값들을 분리
 *
 * 형식: CCCXXXX  value1  value2  ...  [*comment]
 * - CCC: 컴포넌트 ID (3자리)
 * - XXXX: 카드 타입 (4자리)
 * - 값들은 공백으로 구분
 * - * 이후는 주석으로 무시
 */
export function parseMarsCardLine(line: string): MarsCardLine | null {
  // 주석 제거 (* 이후)
  const commentIdx = line.indexOf('*');
  const dataStr = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

  const trimmed = dataStr.trim();
  if (trimmed === '') return null;

  // 공백으로 토큰 분리
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const cardNumber = tokens[0];

  // 카드 번호 검증: 7자리 이상 숫자 (CCC + XXXX)
  if (!/^\d{7,}$/.test(cardNumber)) return null;

  // 컴포넌트 ID (앞 3자리) + 카드 타입 (뒤 4자리)
  const componentId = cardNumber.substring(0, cardNumber.length - 4);
  const cardType = cardNumber.substring(cardNumber.length - 4);

  return {
    cardNumber,
    componentId,
    cardType,
    values: tokens.slice(1),
    rawLine: line,
  };
}

/**
 * 여러 줄의 MARS 카드 텍스트를 파싱
 * - 주석 라인 (* 시작) 제거
 * - 빈 줄 제거
 * - 카드 번호가 없는 라인은 skipped에 기록
 */
export function parseMarsCardLines(text: string): MarsCardParseResult {
  const cards: MarsCardLine[] = [];
  const skipped: string[] = [];

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // 빈 줄 스킵
    if (trimmed === '') continue;

    // 주석 줄 스킵 (* 시작)
    if (trimmed.startsWith('*')) {
      skipped.push(trimmed);
      continue;
    }

    // 카드 파싱
    const card = parseMarsCardLine(line);
    if (card) {
      cards.push(card);
    } else {
      skipped.push(trimmed);
    }
  }

  return { cards, skipped };
}

// ============================================================================
// CCC1201: Volume Initial Conditions 전용 파서
// ============================================================================

/** 파싱된 Initial Condition 행 */
export interface ParsedInitialCondition {
  ebt: '001' | '002' | '003' | '004' | '005';
  pressure: number;
  temperature?: number; // ebt !== '002'
  quality?: number;     // ebt === '002'
  endCell: number;      // 마지막 값 (셀 번호)
}

/** CCC1201 파싱 결과 */
export interface ParseInitialConditionsResult {
  rows: ParsedInitialCondition[];
  errors: string[];
  warnings: string[];
}

const VALID_EBT_VALUES = ['001', '002', '003', '004', '005'] as const;
type EbtType = typeof VALID_EBT_VALUES[number];

/**
 * EBT 값 정규화 (숫자 → 3자리 문자열)
 * 예: "3" → "003", "03" → "003", "003" → "003"
 */
function normalizeEbt(value: string): EbtType | null {
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num < 1 || num > 5) return null;
  return String(num).padStart(3, '0') as EbtType;
}

/**
 * CCC1201 카드 텍스트를 파싱하여 Initial Condition 행 배열로 변환
 *
 * CCC1201 카드 형식 (8.6.14):
 *   CCCXXXX  W1  W2  W3  W4  W5  W6  W7
 *   - W1: EBT (001~005)
 *   - W2: Pressure (Pa)
 *   - W3: Temperature(K) or Quality (0.0~1.0) depending on EBT
 *   - W4~W6: Boron/etc (0.0)
 *   - W7: End cell number
 *
 * 지원:
 * - 과학적 표기법 (6.679e6, 1.51100e+07, 45.3e5)
 * - 주석 라인 (*)
 * - 다양한 카드 타입 (12XX 패턴만 유효, 그 외 warning)
 */
export function parseInitialConditionCards(text: string): ParseInitialConditionsResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { cards, skipped } = parseMarsCardLines(text);

  if (skipped.length > 0) {
    warnings.push(`${skipped.length}개 주석/비데이터 라인 무시됨`);
  }

  if (cards.length === 0) {
    errors.push('유효한 MARS 카드 데이터가 없습니다.');
    return { rows: [], errors, warnings };
  }

  const rows: ParsedInitialCondition[] = [];

  for (const card of cards) {
    // 카드 타입 검증: 12XX 패턴
    if (!card.cardType.startsWith('12')) {
      warnings.push(`카드 ${card.cardNumber}: 카드 타입 ${card.cardType}은 CCC12XX가 아닙니다. 건너뜁니다.`);
      continue;
    }

    // 최소 7개 값 필요: EBT, Pressure, Temp/Quality, 0.0, 0.0, 0.0, EndCell
    if (card.values.length < 2) {
      errors.push(`카드 ${card.cardNumber}: 최소 2개 값(EBT, Pressure)이 필요합니다.`);
      continue;
    }

    // W1: EBT
    const ebt = normalizeEbt(card.values[0]);
    if (!ebt) {
      errors.push(`카드 ${card.cardNumber}: EBT 값 "${card.values[0]}"이 유효하지 않습니다 (001~005).`);
      continue;
    }

    // W2: Pressure
    const pressure = Number(card.values[1]);
    if (Number.isNaN(pressure) || pressure <= 0) {
      errors.push(`카드 ${card.cardNumber}: 압력 "${card.values[1]}"이 유효한 양수가 아닙니다.`);
      continue;
    }

    // W3: Temperature or Quality
    let temperature: number | undefined;
    let quality: number | undefined;
    if (card.values.length >= 3) {
      const w3 = Number(card.values[2]);
      if (!Number.isNaN(w3)) {
        if (ebt === '002') {
          quality = w3;
        } else {
          temperature = w3;
        }
      }
    }

    // W7 (마지막 값): End Cell
    const lastValue = card.values[card.values.length - 1];
    const endCell = parseInt(lastValue, 10);
    if (Number.isNaN(endCell) || endCell <= 0) {
      errors.push(`카드 ${card.cardNumber}: 마지막 값 "${lastValue}"이 유효한 셀 번호가 아닙니다.`);
      continue;
    }

    rows.push({
      ebt,
      pressure,
      ...(temperature !== undefined && { temperature }),
      ...(quality !== undefined && { quality }),
      endCell,
    });
  }

  // endCell 오름차순 정렬
  rows.sort((a, b) => a.endCell - b.endCell);

  return { rows, errors, warnings };
}
