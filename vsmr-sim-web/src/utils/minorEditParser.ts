/**
 * Minor Edit Parser
 * MARS 입력파일(.i)에서 Minor Edit 카드(301-399)를 파싱
 */

import type { MinorEdit, MinorEditVariableType } from '@/types/mars';

/**
 * 유효한 Minor Edit Variable Type 목록
 */
const VALID_VARIABLE_TYPES: MinorEditVariableType[] = [
  'rktpow',
  'cntrlvar',
  'p',
  'tempf',
  'mflowj',
  'voidf',
  'time',
];

/**
 * .i 파일 내용에서 Minor Edit을 파싱
 *
 * @param content .i 파일 내용 (문자열)
 * @returns 파싱된 MinorEdit 배열
 *
 * @example
 * // 입력 예시:
 * // 301  rktpow    0          300.0e6  400.0e6  1  1     *Total power(W)
 * // 302  cntrlvar  324        300.0e6  400.0e6  1  2     *HTRNR:Core to RCS
 */
export function parseMinorEdits(content: string): MinorEdit[] {
  const lines = content.split('\n');
  const minorEdits: MinorEdit[] = [];

  // Minor Edit 카드 정규식
  // 형식: cardNumber variableType parameter lowerLimit upperLimit editGroup editPriority [*comment]
  // 예: 301  rktpow    0          300.0e6  400.0e6  1  1     *Total power(W)
  const minorEditRegex = /^\s*(\d{3})\s+(\w+)\s+(\S+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+(\d+)\s+(\d+)\s*(?:\*(.*))?$/;

  for (const line of lines) {
    // 주석 라인 스킵 (단, * 뒤에 데이터가 있는 경우는 comment로 처리)
    if (line.trim().startsWith('*') && !line.match(/^\s*\d{3}/)) {
      continue;
    }

    // 빈 라인 스킵
    if (!line.trim()) {
      continue;
    }

    const match = line.match(minorEditRegex);
    if (match) {
      const cardNumber = parseInt(match[1], 10);

      // Card 301-399 범위만 처리
      if (cardNumber >= 301 && cardNumber <= 399) {
        const variableType = match[2].toLowerCase() as MinorEditVariableType;

        // 유효한 변수 타입인지 확인
        if (!VALID_VARIABLE_TYPES.includes(variableType)) {
          console.warn(`[minorEditParser] Unknown variable type: ${match[2]} at card ${cardNumber}`);
          continue;
        }

        const parameter = match[3];
        const lowerLimit = parseFloat(match[4]);
        const upperLimit = parseFloat(match[5]);
        const editGroup = parseInt(match[6], 10);
        const editPriority = parseInt(match[7], 10);
        const comment = match[8]?.trim();

        // NaN 체크
        if (isNaN(lowerLimit) || isNaN(upperLimit) || isNaN(editGroup) || isNaN(editPriority)) {
          console.warn(`[minorEditParser] Invalid numeric values at card ${cardNumber}`);
          continue;
        }

        minorEdits.push({
          cardNumber,
          variableType,
          parameter,
          lowerLimit,
          upperLimit,
          editGroup,
          editPriority,
          ...(comment && { comment }),
        });
      }
    }
  }

  // 카드 번호순 정렬
  minorEdits.sort((a, b) => a.cardNumber - b.cardNumber);

  console.log(`[minorEditParser] Parsed ${minorEdits.length} Minor Edits`);
  return minorEdits;
}

/**
 * Minor Edit 배열이 유효한지 검증
 */
export function validateMinorEdits(minorEdits: MinorEdit[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 카드 번호 중복 체크
  const cardNumbers = new Set<number>();
  for (const edit of minorEdits) {
    if (cardNumbers.has(edit.cardNumber)) {
      errors.push(`Duplicate card number: ${edit.cardNumber}`);
    }
    cardNumbers.add(edit.cardNumber);

    // 범위 체크
    if (edit.cardNumber < 301 || edit.cardNumber > 399) {
      errors.push(`Invalid card number: ${edit.cardNumber} (must be 301-399)`);
    }

    // 상하한 체크
    if (edit.lowerLimit >= edit.upperLimit) {
      errors.push(`Card ${edit.cardNumber}: lowerLimit (${edit.lowerLimit}) must be less than upperLimit (${edit.upperLimit})`);
    }

    // 그룹/우선순위 범위 체크
    if (edit.editGroup < 1 || edit.editGroup > 999) {
      errors.push(`Card ${edit.cardNumber}: editGroup must be 1-999`);
    }

    if (edit.editPriority < 1 || edit.editPriority > 999) {
      errors.push(`Card ${edit.cardNumber}: editPriority must be 1-999`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
