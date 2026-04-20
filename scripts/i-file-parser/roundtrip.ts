/**
 * 라운드트립 검증 스크립트
 *
 * 원본 .i → (parser) → JSON → (fileGenerator) → exported .i → 비교
 *
 * 사용법:
 *   npx tsx scripts/i-file-parser/roundtrip.ts [input.i]
 *   기본값: documents/100%.i
 */

import * as fs from 'fs';
import * as path from 'path';
import { convert } from './converter';
import { normalizeFortranExponent } from './tokenizer';

// ============================================================
// Card 파싱 (compareCards2.py 로직 포팅)
// ============================================================

interface CardMap {
  [cardNum: string]: string[];
}

function parseCards(content: string): CardMap {
  const cards: CardMap = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith('*') || line.startsWith('=') || line.startsWith('.')) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (!parts.length || !/^\d/.test(parts[0])) continue;
    const cardNum = parts[0];
    if (!/^\d+$/.test(cardNum)) continue;
    // 인라인 코멘트 제거 (* 이후) + Fortran 지수 표기법 정규화
    const dataWords: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].startsWith('*')) break;
      dataWords.push(normalizeFortranExponent(parts[i]));
    }
    cards[cardNum] = dataWords;
  }
  return cards;
}

// ============================================================
// 수치 비교
// ============================================================

function numEqual(a: string, b: string): boolean {
  const fa = parseFloat(a), fb = parseFloat(b);
  if (isNaN(fa) || isNaN(fb)) return false;
  if (fa === 0 && fb === 0) return true;
  return Math.abs(fa - fb) < 1e-6 * Math.max(Math.abs(fa), Math.abs(fb), 1);
}

function wordsEqual(ow: string[], ew: string[]): boolean {
  if (ow.length !== ew.length) return false;
  return ow.every((a, i) => a === ew[i] || numEqual(a, ew[i]));
}

/**
 * SEF (Sequential Expansion Format) 풀어서 셀 배열로 변환
 * wordsPerEntry = 데이터 워드 수 (endCell 제외)
 * 예: 1-word SEF (area, endCell), 2-word SEF (fwd, rev, endCell)
 */
function expandSEF(words: string[], wordsPerEntry: number): number[][] | null {
  const entrySize = wordsPerEntry + 1; // data words + endCell
  if (words.length === 0 || words.length % entrySize !== 0) return null;
  if (words.length > 2000) return null; // 너무 큰 그룹은 SEF 비교 스킵

  const cells: number[][] = [];
  let prevEnd = 0;

  for (let i = 0; i < words.length; i += entrySize) {
    const dataWords = words.slice(i, i + wordsPerEntry).map(w => parseFloat(w));
    if (dataWords.some(isNaN)) return null;
    const endCell = parseInt(words[i + wordsPerEntry]);
    if (isNaN(endCell) || endCell <= prevEnd || endCell > 10000) return null;

    for (let j = prevEnd; j < endCell; j++) {
      cells.push([...dataWords]);
    }
    prevEnd = endCell;
  }

  return cells;
}

/**
 * SEF 풀어서 비교: 다른 압축 형태라도 같은 셀 배열이면 PASS
 */
function sefEqual(ow: string[], ew: string[]): boolean {
  // 다양한 words-per-entry 시도: 1 (area/length), 2 (loss/friction), 6 (IC: ebt,P,T,0,0,0)
  for (const wpe of [1, 2, 6]) {
    const origExp = expandSEF(ow, wpe);
    const expoExp = expandSEF(ew, wpe);
    if (!origExp || !expoExp) continue;
    if (origExp.length !== expoExp.length) continue;

    const match = origExp.every((row, i) =>
      row.length === expoExp[i].length &&
      row.every((v, j) => {
        const ev = expoExp[i][j];
        if (v === ev) return true;
        if (v === 0 && ev === 0) return true;
        return Math.abs(v - ev) < 1e-6 * Math.max(Math.abs(v), Math.abs(ev), 1);
      })
    );
    if (match) return true;
  }
  return false;
}

// ============================================================
// 카드 분류
// ============================================================

function categorizeCard(cardNum: string): string {
  const cn = parseInt(cardNum);
  if (cn < 1000) return 'global';
  if (cn < 10000000) {
    const xxxx = cn % 10000;
    return `hydro_${String(Math.floor(xxxx / 100)).padStart(2, '0')}xx`;
  }
  if (cn < 20000000) {
    const local = cn % 10000;
    return `hs_${String(Math.floor(local / 100)).padStart(2, '0')}xx`;
  }
  if (cn < 20300000) return 'general_table';
  if (cn < 20600000) return 'control_system';
  return 'other';
}

interface DiffItem {
  card: string;
  origWords: string[];
  expoWords: string[];
  diffDetail: string;
}

// ============================================================
// 카드 그룹 키: split/combined 포맷 차이를 무시하기 위해
// 같은 CCC + 같은 XX (끝 2자리 제거)의 카드를 하나로 합침
//
// 예: SNGLJUN CCC0101 + CCC0102 → 그룹 "CCC01"
//     TMDPVOL CCC0101 + CCC0102 + CCC0103 → 그룹 "CCC01"
//     PIPE CCC0101~0199 → 그룹 "CCC01" (SEF 항목들)
//     HS 1CCCG801~899 → 그룹 "1CCCG8"
// ============================================================

function getCardGroupKey(cardNum: string): string {
  const cn = parseInt(cardNum);
  // 수력 컴포넌트 (7자리): CCCXXXX → 끝 2자리 제거 → CCCXX
  if (cn >= 1000000 && cn < 10000000) {
    return `H${Math.floor(cn / 100)}`;
  }
  // 열구조체 (8자리): 1CCCGXNN → 끝 2자리 제거 → 1CCCGX
  if (cn >= 10000000 && cn < 20000000) {
    return `S${Math.floor(cn / 100)}`;
  }
  // 제어변수 (205CCCNN): 끝 2자리 제거
  if (cn >= 20500000 && cn < 20600000) {
    return `V${Math.floor(cn / 100)}`;
  }
  // 글로벌/Trip/기타: 그룹 없음 (카드 단위 비교)
  return cardNum;
}

function buildGroupedCards(cards: CardMap): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const sortedKeys = Object.keys(cards).sort((a, b) => parseInt(a) - parseInt(b));
  for (const k of sortedKeys) {
    const group = getCardGroupKey(k);
    if (!groups[group]) groups[group] = [];
    groups[group].push(...cards[k]);
  }
  return groups;
}

function compare(origContent: string, expoContent: string) {
  const orig = parseCards(origContent);
  const expo = parseCards(expoContent);

  // Phase 1: 그룹 단위 비교 (split/combined 포맷 차이 흡수)
  const origGroups = buildGroupedCards(orig);
  const expoGroups = buildGroupedCards(expo);

  const origGKeys = new Set(Object.keys(origGroups));
  const expoGKeys = new Set(Object.keys(expoGroups));

  let formatOnly = 0;
  // mergedFormatOnly: 그룹 병합으로 해소된 포맷 차이 (향후 통계용)
  const cats: Record<string, DiffItem[]> = {};
  const onlyOrigGroups: string[] = [];
  const onlyExpoGroups: string[] = [];

  // 원본에만 있는 그룹
  for (const g of [...origGKeys].filter(k => !expoGKeys.has(k)).sort()) {
    onlyOrigGroups.push(g);
  }
  // Export에만 있는 그룹
  for (const g of [...expoGKeys].filter(k => !origGKeys.has(k)).sort()) {
    onlyExpoGroups.push(g);
  }

  // 양쪽에 있는 그룹 비교
  for (const g of [...origGKeys].sort()) {
    if (!expoGKeys.has(g)) continue;
    const ow = origGroups[g], ew = expoGroups[g];

    // 정확히 일치
    if (ow.length === ew.length && ow.every((v, i) => v === ew[i])) continue;
    // 수치적 일치 (포맷만 다름)
    if (wordsEqual(ow, ew)) { formatOnly++; continue; }
    // SEF 재압축 포맷 차이 (셀 배열이 동일하면 PASS)
    if (sefEqual(ow, ew)) { formatOnly++; continue; }
    // 기본값 생략 허용: 원본이 더 길고, export 부분이 일치하며,
    // 원본의 추가 워드가 MARS 기본값(1.0, 0.14 등)이면 PASS
    if (ow.length > ew.length && wordsEqual(ow.slice(0, ew.length), ew)) {
      const extraWords = ow.slice(ew.length);
      const allDefaults = extraWords.every(w => {
        const v = parseFloat(w);
        return v === 1.0 || v === 0.14 || v === 0.0 || w === '0' || w === '0.0';
      });
      if (allDefaults) { formatOnly++; continue; }
    }

    // 기능적 차이 → 해당 그룹의 대표 카드번호로 기록
    const maxLen = Math.max(ow.length, ew.length);
    const diffs: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const wo = i < ow.length ? ow[i] : '-';
      const we = i < ew.length ? ew[i] : '-';
      if (wo !== we && !numEqual(wo, we)) {
        diffs.push(`W${i + 1}:${wo}→${we}`);
      }
    }

    // 그룹 키에서 대표 카드번호/카테고리 추출
    let repCard = g;
    if (g.startsWith('H') || g.startsWith('S') || g.startsWith('V')) {
      repCard = g.substring(1) + '00';  // 그룹키 → 대표 카드번호
    }
    const cat = categorizeCard(repCard);
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push({
      card: `${repCard}(grp)`,
      origWords: ow,
      expoWords: ew,
      diffDetail: diffs.slice(0, 4).join(', '),
    });
  }

  // 결과 산출
  const totalFunctional = Object.values(cats).reduce((s, a) => s + a.length, 0);

  // "원본만 존재" 그룹에서 개별 카드 복원 (상세 표시용)
  const onlyOrigCards: string[] = [];
  for (const g of onlyOrigGroups) {
    // 이 그룹에 속하는 원본 카드 찾기
    for (const k of Object.keys(orig)) {
      if (getCardGroupKey(k) === g) onlyOrigCards.push(k);
    }
  }
  const onlyExpoCards: string[] = [];
  for (const g of onlyExpoGroups) {
    for (const k of Object.keys(expo)) {
      if (getCardGroupKey(k) === g) onlyExpoCards.push(k);
    }
  }

  // Phase 2: 카드 수준 포맷 차이 통계 (참고용)
  const origKeys = new Set(Object.keys(orig));
  const expoKeys = new Set(Object.keys(expo));
  const cardOnlyOrig = [...origKeys].filter(k => !expoKeys.has(k)).length;
  const cardOnlyExpo = [...expoKeys].filter(k => !origKeys.has(k)).length;

  console.log('\n========================================');
  console.log('        라운드트립 비교 결과');
  console.log('========================================');
  console.log(`원본 카드: ${origKeys.size}, Export 카드: ${expoKeys.size}`);
  console.log(`카드 수준 차이: 원본만 ${cardOnlyOrig}, Export만 ${cardOnlyExpo} (split/combined 포함)`);
  console.log(`그룹 수준: 원본만 ${onlyOrigCards.length}, Export만 ${onlyExpoCards.length}`);
  console.log(`포맷만 다름(그룹): ${formatOnly}`);
  console.log(`기능적 차이(그룹): ${totalFunctional}`);
  console.log('----------------------------------------');

  if (onlyOrigCards.length > 0) {
    console.log(`\n[그룹 원본만 존재] ${onlyOrigCards.length}개:`);
    for (const k of onlyOrigCards.sort().slice(0, 50)) {
      console.log(`  ${k}: ${orig[k].join(' ').substring(0, 80)}`);
    }
    if (onlyOrigCards.length > 50) console.log(`  ... 외 ${onlyOrigCards.length - 50}개`);
  }

  if (onlyExpoCards.length > 0) {
    console.log(`\n[그룹 Export만 존재] ${onlyExpoCards.length}개:`);
    for (const k of onlyExpoCards.sort().slice(0, 50)) {
      console.log(`  ${k}: ${expo[k].join(' ').substring(0, 80)}`);
    }
    if (onlyExpoCards.length > 50) console.log(`  ... 외 ${onlyExpoCards.length - 50}개`);
  }

  console.log('\n--- 카테고리별 기능적 차이 ---');
  for (const cat of Object.keys(cats).sort()) {
    const items = cats[cat];
    console.log(`\n[${cat}] ${items.length}개:`);
    for (const item of items.slice(0, 15)) {
      console.log(`  ${item.card}: ${item.diffDetail}`);
    }
    if (items.length > 15) console.log(`  ... 외 ${items.length - 15}개`);
  }

  const totalIssues = totalFunctional + onlyOrigCards.length + onlyExpoCards.length;
  console.log('\n========================================');
  if (totalIssues === 0) {
    console.log('  ✅ 완벽 일치! (포맷/split-combined 차이만 존재)');
  } else {
    console.log(`  ❌ 총 ${totalIssues}개 차이 (그룹 기능적: ${totalFunctional}, 누락: ${onlyOrigCards.length + onlyExpoCards.length})`);
  }
  console.log('========================================\n');

  return { totalFunctional, onlyOrig: onlyOrigCards.length, onlyExpo: onlyExpoCards.length, formatOnly, cats };
}

// ============================================================
// 메인
// ============================================================

async function main() {
  const inputFile = process.argv[2] || 'documents/100%.i';
  const inputPath = path.resolve(inputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`파일 없음: ${inputPath}`);
    process.exit(1);
  }

  const origContent = fs.readFileSync(inputPath, 'utf-8');
  console.log(`[1/3] 원본 읽기: ${inputPath} (${(origContent.length / 1024).toFixed(1)} KB)\n`);

  // Step 1: Parse .i → JSON
  console.log('[2/3] 파싱 (.i → JSON)...');
  const projectName = path.basename(inputPath, '.i');
  const project = convert(origContent, projectName);

  const nodes = project.nodes || [];
  const edges = project.edges || [];
  const globalSettings = project.metadata?.globalSettings || {};

  console.log(`\n  노드: ${nodes.length}개, 엣지: ${edges.length}개`);

  // Step 2: Export JSON → .i
  console.log('\n[3/3] 내보내기 (JSON → .i)...');
  const { MARSInputFileGenerator } = await import('../../src/utils/fileGenerator.js');
  const generator = new MARSInputFileGenerator();
  const result = generator.generate(nodes, edges, projectName, globalSettings);
  const expoContent: string = result.content ?? '';

  console.log(`  Export 크기: ${(expoContent.length / 1024).toFixed(1)} KB`);

  // 중간 파일 저장 (디버깅용)
  const jsonPath = inputPath.replace(/\.i$/, '_roundtrip.json');
  const expoPath = inputPath.replace(/\.i$/, '_roundtrip.i');
  fs.writeFileSync(jsonPath, JSON.stringify(project, null, 2), 'utf-8');
  fs.writeFileSync(expoPath, expoContent, 'utf-8');
  console.log(`  JSON 저장: ${jsonPath}`);
  console.log(`  Export 저장: ${expoPath}`);

  // Step 3: Compare
  compare(origContent, expoContent);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
