/**
 * MARS .i 파일 카드 토큰화 모듈
 *
 * .i 파일의 각 줄을 파싱하여 Card 객체 배열로 변환
 *
 * 규칙:
 * - `*` 시작: 주석 (컴포넌트명 힌트로 활용 가능)
 * - `.` 만 있는 줄: End card (파일 종료)
 * - `$` 시작: 주석
 * - 빈줄: skip
 * - 나머지: 카드 데이터 (cardNumber + words)
 */

export interface Card {
  cardNumber: number;
  words: string[];        // 원본 문자열 (숫자 변환은 파서에서)
  comment?: string;       // 인라인 주석
  lineNumber: number;     // 원본 파일 줄 번호 (디버깅용)
  rawLine: string;        // 원본 줄 (디버깅용)
}

export interface CommentLine {
  type: 'comment';
  text: string;
  lineNumber: number;
}

export interface TokenizeResult {
  cards: Card[];
  comments: CommentLine[];  // 주석 보존 (컴포넌트명 힌트 등)
  titleLine: string;        // 첫 줄 (= 으로 시작하는 타이틀)
  totalLines: number;
  cardCount: number;
}

/**
 * .i 파일 전체를 토큰화
 */
export function tokenize(content: string): TokenizeResult {
  const lines = content.split(/\r?\n/);
  const cards: Card[] = [];
  const comments: CommentLine[] = [];
  let titleLine = '';

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    // 빈줄 skip
    if (trimmed === '') continue;

    // End card
    if (trimmed === '.') break;

    // 타이틀 줄 (= 으로 시작)
    if (trimmed.startsWith('=') && titleLine === '') {
      titleLine = trimmed.replace(/^=\s*/, '');
      continue;
    }

    // 주석 줄 (* 또는 $ 시작)
    if (trimmed.startsWith('*') || trimmed.startsWith('$')) {
      comments.push({ type: 'comment', text: trimmed, lineNumber });
      continue;
    }

    // 카드 데이터 파싱
    const card = parseLine(trimmed, lineNumber, raw);
    if (card) {
      cards.push(card);
    }
  }

  return {
    cards,
    comments,
    titleLine,
    totalLines: lines.length,
    cardCount: cards.length,
  };
}

/**
 * 단일 카드 줄 파싱
 *
 * 형식: cardNumber  word1  word2  ...  [* comment]
 *
 * 주의:
 * - 카드 번호가 숫자가 아닌 경우가 있음 (예: 타이틀 줄)
 * - 인라인 주석은 `*` 이후
 * - 탭/공백 혼용 가능
 */
function parseLine(line: string, lineNumber: number, rawLine: string): Card | null {
  // 인라인 주석 분리
  // 주의: 과학적 표기법(e-10) 안의 '-'와 구분 필요
  // * 이후를 주석으로 처리하되, 단어 중간의 *는 무시
  let datapart = line;
  let comment: string | undefined;

  // 공백+* 또는 탭+* 패턴으로 인라인 주석 분리
  const commentMatch = line.match(/\s+\*\s*(.*)/);
  if (commentMatch) {
    const commentStart = line.indexOf(commentMatch[0]);
    datapart = line.substring(0, commentStart).trim();
    comment = commentMatch[1]?.trim() || undefined;
  }

  // 공백/탭으로 분리
  const tokens = datapart.split(/\s+/).filter(t => t !== '');

  if (tokens.length === 0) return null;

  // 첫 토큰이 카드 번호
  const cardNumStr = tokens[0];
  const cardNumber = parseInt(cardNumStr, 10);

  if (isNaN(cardNumber)) {
    // 카드 번호가 아닌 줄 (예: 문자열만 있는 줄)
    // 일부 .i 파일에서 'end' 같은 키워드가 올 수 있음
    return null;
  }

  const words = tokens.slice(1);

  return {
    cardNumber,
    words,
    comment,
    lineNumber,
    rawLine,
  };
}

/**
 * 문자열을 숫자로 변환 (과학적 표기법 지원)
 * 실패 시 NaN 반환
 */
export function toNumber(word: string): number {
  // MARS 포맷: 1.0e-10, 15.125e6, 3.048e-5 등
  // Fortran 지수 표기법: 1.69348-6 → 1.69348e-6, 4.2337-9 → 4.2337e-9
  const normalized = normalizeFortranExponent(word);
  return parseFloat(normalized);
}

/**
 * Fortran 스타일 지수 표기법을 표준 과학 표기법으로 변환
 * 예: "1.69348-6" → "1.69348e-6", "3.5+8" → "3.5e+8"
 * 일반 숫자/과학표기법은 그대로 반환
 */
export function normalizeFortranExponent(word: string): string {
  // 패턴: 숫자부(소수점 필수) + 부호(+/-) + 정수(지수)
  // 소수점 필수 조건으로 일반 음수(예: -6)와 구분
  const match = word.match(/^([+-]?\d+\.\d*)([-+])(\d+)$/);
  if (match) {
    return `${match[1]}e${match[2]}${match[3]}`;
  }
  return word;
}

/**
 * 문자열이 숫자인지 판별
 */
export function isNumeric(word: string): boolean {
  return !isNaN(parseFloat(word)) && isFinite(parseFloat(word));
}
