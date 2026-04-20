/**
 * VsmrProjectFile JSON → fileGenerator → .i 출력 → 원본 비교
 *
 * 사용법:
 *   npx tsx scripts/i-file-parser/roundtripVsmr.ts <vsmr.json> <original.i>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

async function main() {
  const vsmrPath = resolve(process.argv[2]);
  const origPath = process.argv[3] ? resolve(process.argv[3]) : null;

  console.log(`[1/3] VsmrProjectFile 읽기: ${vsmrPath}`);
  const vsmrData = JSON.parse(readFileSync(vsmrPath, 'utf-8'));

  // VsmrProjectFile → nodes, edges, settings 추출
  const model = vsmrData.data.models[0];
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const settings = model.settings || {};
  const projectName = model.name || vsmrData._vsmr_meta_.projectName || 'test';

  console.log(`  모델: ${model.name}, 노드: ${nodes.length}, 엣지: ${edges.length}`);

  // [2/3] fileGenerator로 .i 파일 생성
  console.log(`\n[2/3] Export (JSON → .i)...`);
  const { MARSInputFileGenerator } = await import('../../src/utils/fileGenerator.js');
  const generator = new MARSInputFileGenerator();
  const result = generator.generate(nodes, edges, projectName, settings);
  const exportContent: string = result.content ?? '';

  const exportPath = vsmrPath.replace(/\.json$/, '_exported.i');
  writeFileSync(exportPath, exportContent, 'utf-8');
  console.log(`  Export 저장: ${exportPath} (${(exportContent.length / 1024).toFixed(1)} KB)`);

  // [3/3] 원본과 비교
  if (origPath) {
    console.log(`\n[3/3] 원본 비교: ${origPath}`);
    const origContent = readFileSync(origPath, 'utf-8');

    // 간단한 카드 비교
    const parseCards = (content: string) => {
      const cards: Record<string, string[]> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trimEnd();
        if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('=') || trimmed.startsWith('.')) continue;
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (!parts.length || !/^\d/.test(parts[0])) continue;
        const cardNum = parts[0];
        if (!/^\d+$/.test(cardNum)) continue;
        const dataWords: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].startsWith('*')) break;
          dataWords.push(parts[i]);
        }
        cards[cardNum] = dataWords;
      }
      return cards;
    };

    const origCards = parseCards(origContent);
    const expoCards = parseCards(exportContent);

    const origKeys = new Set(Object.keys(origCards));
    const expoKeys = new Set(Object.keys(expoCards));

    const onlyOrig = [...origKeys].filter(k => !expoKeys.has(k));
    const onlyExpo = [...expoKeys].filter(k => !origKeys.has(k));
    const common = [...origKeys].filter(k => expoKeys.has(k));

    let match = 0, formatDiff = 0, valueDiff = 0;
    const valueDiffs: string[] = [];

    for (const k of common) {
      const ow = origCards[k], ew = expoCards[k];
      if (ow.join(' ') === ew.join(' ')) {
        match++;
      } else {
        // 수치 비교
        const numEq = ow.length === ew.length && ow.every((v, i) => {
          if (v === ew[i]) return true;
          const a = parseFloat(v), b = parseFloat(ew[i]);
          if (isNaN(a) || isNaN(b)) return v.toLowerCase() === ew[i].toLowerCase();
          if (a === 0 && b === 0) return true;
          return Math.abs(a - b) < 1e-6 * Math.max(Math.abs(a), Math.abs(b), 1);
        });
        if (numEq) {
          formatDiff++;
        } else {
          valueDiff++;
          if (valueDiffs.length < 30) {
            valueDiffs.push(`  ${k}: orig=[${ow.join(',')}] expo=[${ew.join(',')}]`);
          }
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`       라운드트립 비교 결과`);
    console.log(`========================================`);
    console.log(`원본 카드: ${origKeys.size}, Export 카드: ${expoKeys.size}`);
    console.log(`공통 카드: ${common.length}`);
    console.log(`  완전 일치: ${match}`);
    console.log(`  포맷만 다름: ${formatDiff}`);
    console.log(`  값 차이: ${valueDiff}`);
    console.log(`원본만: ${onlyOrig.length}, Export만: ${onlyExpo.length}`);

    if (valueDiffs.length > 0) {
      console.log(`\n--- 값 차이 상세 ---`);
      for (const d of valueDiffs) console.log(d);
    }

    if (onlyOrig.length > 0) {
      console.log(`\n--- 원본만 존재 (처음 20개) ---`);
      for (const k of onlyOrig.sort((a,b) => parseInt(a)-parseInt(b)).slice(0, 20)) {
        console.log(`  ${k}: ${origCards[k].join(' ').substring(0, 60)}`);
      }
      if (onlyOrig.length > 20) console.log(`  ... 외 ${onlyOrig.length - 20}개`);
    }

    console.log(`\n========================================`);
    if (valueDiff === 0) {
      console.log(`  ✅ 기능적 차이 없음!`);
    } else {
      console.log(`  ❌ ${valueDiff}개 값 차이`);
    }
    console.log(`========================================\n`);
  }
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
