/**
 * 컴포넌트 타입별 파라미터 파서
 *
 * ComponentBlock → Partial<ComponentParameters>
 *
 * 각 파서는 CCC별로 그룹핑된 카드 배열을 받아
 * TypeScript 인터페이스에 맞는 파라미터 객체를 반환
 */

import { Card, toNumber } from './tokenizer';
import { ComponentBlock, ComponentType } from './grouper';

// ============================================================
// 유틸리티
// ============================================================

/** CCC 기준 로컬 카드 번호 추출: CCCXXXX → XXXX */
function localCard(cardNumber: number, ccc: number): number {
  return cardNumber - ccc * 10000;
}

/** 특정 로컬 카드 번호의 카드 찾기 */
function findCard(cards: Card[], ccc: number, local: number): Card | undefined {
  return cards.find(c => localCard(c.cardNumber, ccc) === local);
}

/** 특정 로컬 카드 번호 범위의 카드들 찾기 */
function findCards(cards: Card[], ccc: number, localMin: number, localMax: number): Card[] {
  return cards.filter(c => {
    const l = localCard(c.cardNumber, ccc);
    return l >= localMin && l <= localMax;
  }).sort((a, b) => a.cardNumber - b.cardNumber);
}

/** 워드를 숫자로 (없으면 기본값) */
function num(words: string[], index: number, defaultVal = 0): number {
  if (index >= words.length) return defaultVal;
  const v = toNumber(words[index]);
  return isNaN(v) ? defaultVal : v;
}

/** 워드를 문자열로 (없으면 기본값) */
function str(words: string[], index: number, defaultVal = ''): string {
  return index < words.length ? words[index] : defaultVal;
}

/**
 * SEF (Sequential Expansion Format) 역파싱
 * 카드들의 (value, endCell) 쌍 → 배열로 확장
 *
 * 예: [{0.125, 1}, {0.200, 11}, {0.341, 12}]
 *   → [0.125, 0.200, 0.200, ...(×10), 0.341]
 */
function parseSEF(cards: Card[], wordsPerEntry: number = 1): number[] {
  const result: number[] = [];
  let prevEnd = 0;

  for (const card of cards) {
    if (wordsPerEntry === 1) {
      const value = num(card.words, 0);
      const endCell = num(card.words, 1);
      for (let i = prevEnd; i < endCell; i++) {
        result.push(value);
      }
      prevEnd = endCell;
    }
  }

  return result;
}

/**
 * SEF 2워드 역파싱 (roughness + hd 같은 경우)
 */
function parseSEF2(cards: Card[]): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  let prevEnd = 0;

  for (const card of cards) {
    const va = num(card.words, 0);
    const vb = num(card.words, 1);
    const endCell = num(card.words, 2);
    for (let i = prevEnd; i < endCell; i++) {
      a.push(va);
      b.push(vb);
    }
    prevEnd = endCell;
  }

  return { a, b };
}

/**
 * SEF 문자열 역파싱 (플래그)
 */
function parseSEFstr(cards: Card[]): string[] {
  const result: string[] = [];
  let prevEnd = 0;

  for (const card of cards) {
    const value = str(card.words, 0);
    const endCell = num(card.words, 1);
    for (let i = prevEnd; i < endCell; i++) {
      result.push(value);
    }
    prevEnd = endCell;
  }

  return result;
}

// ============================================================
// Phase 1 VolumeReference (raw 보존)
// ============================================================

interface RawVolumeRef {
  raw: string;  // 9자리 원본 문자열
}

function rawRef(word: string): RawVolumeRef {
  return { raw: word };
}

// ============================================================
// 타입별 파서
// ============================================================

export function parseSnglvol(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  const c0102 = findCard(cards, ccc, 102);
  const c0103 = findCard(cards, ccc, 103);
  const c0200 = findCard(cards, ccc, 200);

  // Volume geometry format detection based on CCC0101 word count:
  //   9+ words: fully combined (area,len,vol,az,inc,dz,rough,hd,tlpvbfe)
  //   6-8 words: partial combined (area,len,vol,az,inc,dz) + CCC0102=rough,hd,flags
  //   3 words: split CCC0101(area,len,vol) + CCC0102(az,inc,dz) + CCC0103(rough,hd,flags)
  const wc = c0101 ? c0101.words.length : 0;
  const hasAnglesOn0101 = wc >= 6;
  const roughCard = hasAnglesOn0101 ? c0102 : c0103;
  return {
    name: block.componentName,
    xArea: c0101 ? num(c0101.words, 0) : 0,
    xLength: c0101 ? num(c0101.words, 1) : 0,
    volume: c0101 ? num(c0101.words, 2) : 0,
    azAngle: hasAnglesOn0101 ? num(c0101.words, 3) : (c0102 ? num(c0102.words, 0) : 0),
    incAngle: hasAnglesOn0101 ? num(c0101.words, 4) : (c0102 ? num(c0102.words, 1) : 0),
    dz: hasAnglesOn0101 ? num(c0101.words, 5) : (c0102 ? num(c0102.words, 2) : 0),
    wallRoughness: wc >= 7 ? num(c0101.words, 6) : (roughCard ? num(roughCard.words, 0) : 3.048e-5),
    hydraulicDiameter: wc >= 8 ? num(c0101.words, 7) : (roughCard ? num(roughCard.words, 1) : 0),
    tlpvbfe: wc >= 9 ? str(c0101.words, 8, '0000000') : (roughCard ? str(roughCard.words, 2, '0000000') : '0000000'),
    // εbt 초기조건: t=0 [P,Uf,Ug,αg], t=1 [T,xs], t=2 [P,xs], t=3 [P,T]
    ebt: c0200 ? str(c0200.words, 0, '003') : '003',
    // W2: ebt=001이면 temperature, 나머지는 pressure
    pressure: c0200 && str(c0200.words, 0, '003') !== '001' ? num(c0200.words, 1) : undefined,
    // W2(ebt=001) 또는 W3(ebt=003): temperature
    temperature: (() => {
      if (!c0200) return undefined;
      const ebtVal = str(c0200.words, 0, '003');
      if (ebtVal === '001') return num(c0200.words, 1); // W2=temperature
      if (ebtVal === '003') return num(c0200.words, 2);  // W3=temperature
      return undefined;
    })(),
    // W3(ebt=001/002): quality
    quality: c0200 && ['001', '002'].includes(str(c0200.words, 0, '003')) ? num(c0200.words, 2) : undefined,
  };
}

export function parseTmdpvol(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  const c0102 = findCard(cards, ccc, 102);
  const c0200 = findCard(cards, ccc, 200);
  const timeCards = findCards(cards, ccc, 201, 299);

  // CCC0200: conditionType [tripNumber] [variableType] [variableCode]
  const conditionType = c0200 ? str(c0200.words, 0, '003') : '003';
  const tripNumber = c0200 ? num(c0200.words, 1) : 0;
  const variableType = c0200 && c0200.words.length > 2 ? str(c0200.words, 2, 'time') : 'time';
  const variableCode = c0200 ? num(c0200.words, 3) : 0;

  // t 옵션 (conditionType의 마지막 자리)
  const tOption = parseInt(conditionType.slice(-1), 10);

  // 시간 테이블 파싱 (t에 따라 필드 달라짐)
  const timeTable = timeCards.map(card => {
    const entry: Record<string, any> = { time: num(card.words, 0) };

    // t=3: P, T
    if (tOption === 3) {
      entry.pressure = num(card.words, 1);
      entry.temperature = num(card.words, 2);
    }
    // t=2: P, Q
    else if (tOption === 2) {
      entry.pressure = num(card.words, 1);
      entry.quality = num(card.words, 2);
    }
    // t=1: T, Q
    else if (tOption === 1) {
      entry.temperature = num(card.words, 1);
      entry.quality = num(card.words, 2);
    }
    // 기타: 기본적으로 W2, W3 보존
    else {
      entry.pressure = num(card.words, 1);
      if (card.words.length > 2) entry.temperature = num(card.words, 2);
    }

    return entry;
  });

  const c0103 = findCard(cards, ccc, 103);

  // TMDPVOL geometry 카드: SNGLVOL과 동일한 3가지 형식 지원
  //   9+ words: fully combined on CCC0101 (area,len,vol,az,inc,dz,rough,hd,tlpvbfe)
  //   6-8 words: partial combined on CCC0101 + CCC0102=rough,hd,flags
  //   3 words: split CCC0101(area,len,vol) + CCC0102(az,inc,dz) + CCC0103(rough,hd,flags)
  const wc = c0101 ? c0101.words.length : 0;
  const hasAnglesOn0101 = wc >= 6;
  const roughCard = hasAnglesOn0101 ? c0102 : c0103;
  return {
    name: block.componentName,
    area: c0101 ? num(c0101.words, 0) : 0,
    length: c0101 ? num(c0101.words, 1) : 0,
    volume: c0101 ? num(c0101.words, 2) : 0,
    azAngle: hasAnglesOn0101 ? num(c0101.words, 3) : (c0102 ? num(c0102.words, 0) : 0),
    incAngle: hasAnglesOn0101 ? num(c0101.words, 4) : (c0102 ? num(c0102.words, 1) : 0),
    dz: hasAnglesOn0101 ? num(c0101.words, 5) : (c0102 ? num(c0102.words, 2) : 0),
    wallRoughness: wc >= 7 ? num(c0101.words, 6) : (roughCard ? num(roughCard.words, 0) : 0),
    hydraulicDiameter: wc >= 8 ? num(c0101.words, 7) : (roughCard ? num(roughCard.words, 1) : 0),
    tlpvbfe: wc >= 9 ? str(c0101.words, 8, '0000000') : (roughCard ? str(roughCard.words, 2, '0000000') : '0000000'),
    conditionType,
    tripNumber,
    variableType,
    variableCode,
    timeTable,
  };
}

export function parseSngljun(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  // 중복 카드번호 처리: 마지막 값 사용 (100%.i에서 1150102가 2줄)
  const c0102Cards = findCards(cards, ccc, 102, 102);
  const c0102 = c0102Cards.length > 0 ? c0102Cards[c0102Cards.length - 1] : undefined;
  const c0201 = findCard(cards, ccc, 201);

  // Combined format: CCC0101에 6개 이상 word (from,to,area,fwdLoss,revLoss,jefvcahs)
  // Split format: CCC0101 (from,to,area) + CCC0102 (fwdLoss,revLoss,jefvcahs)
  const isCombined = !c0102 && c0101 && c0101.words.length >= 6;
  return {
    name: block.componentName,
    from: c0101 ? rawRef(str(c0101.words, 0)) : rawRef('000000000'),
    to: c0101 ? rawRef(str(c0101.words, 1)) : rawRef('000000000'),
    area: c0101 ? num(c0101.words, 2) : 0,
    fwdLoss: isCombined ? num(c0101.words, 3) : (c0102 ? num(c0102.words, 0) : 0),
    revLoss: isCombined ? num(c0101.words, 4) : (c0102 ? num(c0102.words, 1) : 0),
    jefvcahs: isCombined ? str(c0101.words, 5, '00000000') : (c0102 ? str(c0102.words, 2, '00000000') : '00000000'),
    flowDirection: c0201 ? num(c0201.words, 0) : 0,
    mfl: c0201 ? num(c0201.words, 1) : 0,
    mfv: c0201 ? num(c0201.words, 2) : 0,
  };
}

export function parseTmdpjun(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  const c0200 = findCard(cards, ccc, 200);
  const timeCards = findCards(cards, ccc, 201, 299);

  const conditionType = c0200 ? num(c0200.words, 0) : 1;
  const tripNumber = c0200 ? num(c0200.words, 1) : 0;
  const variableType = c0200 && c0200.words.length > 2 ? str(c0200.words, 2, 'time') : 'time';
  const variableCode = c0200 ? num(c0200.words, 3) : 0;

  const timeTable = timeCards.map(card => ({
    time: num(card.words, 0),
    mfl: num(card.words, 1),
    mfv: num(card.words, 2),
  }));

  return {
    name: block.componentName,
    from: c0101 ? rawRef(str(c0101.words, 0)) : rawRef('000000000'),
    to: c0101 ? rawRef(str(c0101.words, 1)) : rawRef('000000000'),
    area: c0101 ? num(c0101.words, 2) : 0,
    jefvcahs: c0101 && c0101.words.length > 3 ? str(c0101.words, 3, '00000000') : '00000000',
    conditionType,
    tripNumber,
    variableType,
    variableCode,
    timeTable,
  };
}

export function parsePipe(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0001 = findCard(cards, ccc, 1);
  const ncells = c0001 ? num(c0001.words, 0) : 1;

  // SEF 카드 그룹
  const xArea = parseSEF(findCards(cards, ccc, 101, 199));
  const junctionArea = parseSEF(findCards(cards, ccc, 201, 299));
  const xLength = parseSEF(findCards(cards, ccc, 301, 399));
  const volume = parseSEF(findCards(cards, ccc, 401, 499));
  const azAngle = parseSEF(findCards(cards, ccc, 501, 599));
  const vertAngle = parseSEF(findCards(cards, ccc, 601, 699));
  const xElev = parseSEF(findCards(cards, ccc, 701, 799));

  // 2워드 SEF (roughness + hd)
  const wallData = parseSEF2(findCards(cards, ccc, 801, 899));

  // 2워드 SEF (fwd/rev loss)
  const lossData = parseSEF2(findCards(cards, ccc, 901, 999));

  // 플래그 SEF
  const volumeFlags = parseSEFstr(findCards(cards, ccc, 1001, 1099));
  const junctionFlags = parseSEFstr(findCards(cards, ccc, 1101, 1199));

  // 볼륨 IC (SEF: ebt press temp/quality 0 0 0 endCell)
  const icCards = findCards(cards, ccc, 1201, 1299);
  const initialConditions: Array<{ebt: string; pressure: number; temperature?: number; quality?: number}> = [];
  {
    let prevEnd = 0;
    for (const card of icCards) {
      const ebt = str(card.words, 0, '003');
      const pressure = num(card.words, 1);
      const thirdVal = num(card.words, 2);
      const endCell = card.words.length > 6 ? num(card.words, 6) : prevEnd + 1;
      for (let i = prevEnd; i < endCell; i++) {
        if (ebt === '002') {
          initialConditions.push({ ebt, pressure, quality: thirdVal });
        } else {
          initialConditions.push({ ebt, pressure, temperature: thirdVal });
        }
      }
      prevEnd = endCell;
    }
  }

  // 접합부 제어 (CCC1300)
  const c1300 = findCard(cards, ccc, 1300);
  const junICCards = findCards(cards, ccc, 1301, 1399);

  let junctionControl: any = undefined;
  if (c1300) {
    // SEF: liquidVelOrFlow vaporVelOrFlow interfaceVel endJunction
    const conditions: Array<{liquidVelOrFlow: number; vaporVelOrFlow: number; interfaceVel: number; junctionId: number}> = [];
    let prevEnd = 0;
    for (const card of junICCards) {
      const w1 = num(card.words, 0);
      const w2 = num(card.words, 1);
      const w3 = num(card.words, 2);
      const endJun = num(card.words, 3, prevEnd + 1);
      for (let i = prevEnd; i < endJun; i++) {
        conditions.push({ liquidVelOrFlow: w1, vaporVelOrFlow: w2, interfaceVel: w3, junctionId: i + 1 });
      }
      prevEnd = endJun;
    }
    junctionControl = {
      controlWord: num(c1300.words, 0),
      conditions,
    };
  }

  // CCFL 데이터 (CCC1401-1499)
  // 카드 형식: W1=junctionDiameter, W2=beta, W3=gasIntercept(c), W4=slope(m), W5=endJun
  const ccflCards = findCards(cards, ccc, 1401, 1499);
  let ccflData: any = undefined;
  if (ccflCards.length > 0) {
    ccflData = {
      junctionDiameter: parseSEF(ccflCards.map(c => ({
        ...c, words: [c.words[0], c.words[4] || c.words[c.words.length - 1]]
      }))),
      beta: parseSEF(ccflCards.map(c => ({
        ...c, words: [c.words[1] || '0', c.words[4] || c.words[c.words.length - 1]]
      }))),
      gasIntercept: parseSEF(ccflCards.map(c => ({
        ...c, words: [c.words[2] || '0', c.words[4] || c.words[c.words.length - 1]]
      }))),
      slope: parseSEF(ccflCards.map(c => ({
        ...c, words: [c.words[3] || '0', c.words[4] || c.words[c.words.length - 1]]
      }))),
    };
  }

  return {
    name: block.componentName,
    ncells,
    xArea: xArea.length > 0 ? xArea : new Array(ncells).fill(0),
    xLength: xLength.length > 0 ? xLength : new Array(ncells).fill(0),
    volume: volume.length > 0 ? volume : new Array(ncells).fill(0),
    azAngle: azAngle.length > 0 ? azAngle : new Array(ncells).fill(0),
    vertAngle: vertAngle.length > 0 ? vertAngle : new Array(ncells).fill(0),
    xElev: xElev.length > 0 ? xElev : undefined,
    wallRoughness: wallData.a.length > 0 ? wallData.a : new Array(ncells).fill(0),
    hydraulicDiameter: wallData.b.length > 0 ? wallData.b : new Array(ncells).fill(0),
    junctionArea: junctionArea.length > 0 ? junctionArea : undefined,
    fwdLoss: lossData.a.length > 0 ? lossData.a : undefined,
    revLoss: lossData.b.length > 0 ? lossData.b : undefined,
    volumeFlags: volumeFlags.length > 0 ? volumeFlags : undefined,
    junctionFlags: junctionFlags.length > 0 ? junctionFlags : undefined,
    initialConditions,
    junctionControl,
    ccflData,
  };
}

export function parseBranch(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0001 = findCard(cards, ccc, 1);
  const njuns = c0001 ? num(c0001.words, 0) : 0;
  const icond = c0001 && c0001.words.length > 1 ? num(c0001.words, 1) : 0;

  // 볼륨 지오메트리 (CCC0101~0103)
  const c0101 = findCard(cards, ccc, 101);
  const c0102 = findCard(cards, ccc, 102);
  const c0103 = findCard(cards, ccc, 103);
  const c0200 = findCard(cards, ccc, 200);

  // 접합부: CCCN101, CCCN102, CCCN103, CCCN201 (N=1~9)
  const junctions: any[] = [];
  for (let n = 1; n <= 9; n++) {
    const nBase = n * 1000;
    const cn101 = findCard(cards, ccc, nBase + 101);
    if (!cn101) continue;

    const cn102 = findCard(cards, ccc, nBase + 102);
    const cn103 = findCard(cards, ccc, nBase + 103);
    const cn201 = findCard(cards, ccc, nBase + 201);

    // Combined format: cn101에 6개 이상 word → from,to,area,fwdLoss,revLoss,jefvcahs
    // Split format: cn101에 3 word (from,to,area) + cn102에 (fwdLoss,revLoss,jefvcahs)
    const isCombined = !cn102 && cn101.words.length >= 6;
    // direction/branchFace 추론: MARS 볼륨참조 CCCVV000F (9자리)
    // to의 CCC가 자기 자신이면 inlet, from의 CCC가 자기 자신이면 outlet
    // branchFace: 자기 자신 쪽 참조의 face 번호 (마지막 자리)
    const fromRaw = str(cn101.words, 0);
    const toRaw = str(cn101.words, 1);
    const fromPad = fromRaw.padStart(9, '0');
    const toPad = toRaw.padStart(9, '0');
    const fromCCC = fromPad.substring(0, 3);
    const toCCC = toPad.substring(0, 3);
    const cccStr = String(ccc).padStart(3, '0');
    const isInlet = toCCC === cccStr;
    const direction: 'inlet' | 'outlet' = isInlet ? 'inlet' : 'outlet';
    // branchFace: 자기 자신 쪽 볼륨참조의 face (inlet→to의 face, outlet→from의 face)
    const branchFace = Number(isInlet ? toPad.charAt(8) : fromPad.charAt(8)) || 1;

    // W7: voidFractionLimit (VOVER for N=1, VUNDER for N=2 in SEPARATR)
    const jefvcahsWord = isCombined ? 5 : -1;
    const voidFractionLimitWord = isCombined ? 6 : -1;
    const hasW7 = isCombined && cn101.words.length >= 7;

    // CCCN110: Junction Diameter and CCFL Data (optional)
    const cn110 = findCard(cards, ccc, nBase + 110);

    junctions.push({
      junctionNumber: n,
      direction,
      branchFace,
      from: rawRef(fromRaw),
      to: rawRef(toRaw),
      area: num(cn101.words, 2),
      fwdLoss: isCombined ? num(cn101.words, 3) : (cn102 ? num(cn102.words, 0) : 0),
      revLoss: isCombined ? num(cn101.words, 4) : (cn102 ? num(cn102.words, 1) : 0),
      jefvcahs: isCombined ? str(cn101.words, 5, '00000000') : (cn102 ? str(cn102.words, 2, '00000000') : '00000000'),
      ...(hasW7 ? { voidFractionLimit: num(cn101.words, 6) } : {}),
      dischargeCoefficient: cn103 ? num(cn103.words, 0) : undefined,
      thermalConstant: cn103 ? num(cn103.words, 1) : undefined,
      ...(cn110 ? {
        junctionDiameter: num(cn110.words, 0),
        ccflBeta: num(cn110.words, 1),
        ccflGasIntercept: cn110.words.length > 2 ? num(cn110.words, 2) : undefined,
        ccflSlope: cn110.words.length > 3 ? num(cn110.words, 3) : undefined,
      } : {}),
      initialLiquidFlow: cn201 ? num(cn201.words, 0) : 0,
      initialVaporFlow: cn201 ? num(cn201.words, 1) : 0,
    });
  }

  // Y/Z Crossflow (CCC0181, CCC0191)
  const c0181 = findCard(cards, ccc, 181);
  const c0191 = findCard(cards, ccc, 191);

  const parseCrossflow = (card: Card | undefined) => {
    if (!card) return undefined;
    return {
      area: num(card.words, 0),
      length: num(card.words, 1),
      roughness: num(card.words, 2),
      hydraulicDiameter: num(card.words, 3),
      controlFlags: str(card.words, 4, '0000000'),
      dz: num(card.words, 7),
    };
  };

  // Volume geometry format detection based on CCC0101 word count:
  //   9+ words: fully combined (area,len,vol,az,inc,dz,rough,hd,tlpvbfe)
  //   6-8 words: partial combined (area,len,vol,az,inc,dz) + CCC0102=rough,hd,flags
  //   3 words: split CCC0101(area,len,vol) + CCC0102(az,inc,dz) + CCC0103(rough,hd,flags)
  const brWc = c0101 ? c0101.words.length : 0;
  const brHasAnglesOn0101 = brWc >= 6;
  const brRoughCard = brHasAnglesOn0101 ? c0102 : c0103;

  return {
    name: block.componentName,
    njuns,
    initialConditionControl: icond,
    area: c0101 ? num(c0101.words, 0) : 0,
    length: c0101 ? num(c0101.words, 1) : 0,
    volume: c0101 ? num(c0101.words, 2) : 0,
    azAngle: brHasAnglesOn0101 ? num(c0101.words, 3) : (c0102 ? num(c0102.words, 0) : 0),
    incAngle: brHasAnglesOn0101 ? num(c0101.words, 4) : (c0102 ? num(c0102.words, 1) : 0),
    dz: brHasAnglesOn0101 ? num(c0101.words, 5) : (c0102 ? num(c0102.words, 2) : 0),
    wallRoughness: brWc >= 7 ? num(c0101.words, 6) : (brRoughCard ? num(brRoughCard.words, 0) : 0),
    hydraulicDiameter: brWc >= 8 ? num(c0101.words, 7) : (brRoughCard ? num(brRoughCard.words, 1) : 0),
    tlpvbfe: brWc >= 9 ? str(c0101.words, 8, '0000000') : (brRoughCard ? str(brRoughCard.words, 2, '0000000') : '0000000'),
    // εbt 초기조건: t=0 [P,Uf,Ug,αg], t=1 [T,xs], t=2 [P,xs], t=3 [P,T]
    ebt: c0200 ? str(c0200.words, 0, '003') : '003',
    // W2: ebt=001이면 temperature, 나머지는 pressure
    pressure: c0200 && str(c0200.words, 0, '003') !== '001' ? num(c0200.words, 1) : undefined,
    // W2(ebt=001) 또는 W3(ebt=003): temperature
    temperature: (() => {
      if (!c0200) return undefined;
      const ebtVal = str(c0200.words, 0, '003');
      if (ebtVal === '001') return num(c0200.words, 1); // W2=temperature
      if (ebtVal === '003') return num(c0200.words, 2);  // W3=temperature
      return undefined;
    })(),
    // W3(ebt=001/002): quality
    quality: c0200 && ['001', '002'].includes(str(c0200.words, 0, '003')) ? num(c0200.words, 2) : undefined,
    junctions,
    yCrossflowData: parseCrossflow(c0181),
    zCrossflowData: parseCrossflow(c0191),
  };
}

export function parseSeparator(block: ComponentBlock): Record<string, any> {
  // SEPARATR = BRANCH 기반 + CCC0002 (separator options, optional)
  const base = parseBranch(block);
  const { cards, ccc } = block;

  const c0002 = findCard(cards, ccc, 2);
  if (c0002) {
    base.separatorOption = num(c0002.words, 0, 0);
    if (c0002.words.length > 1) {
      base.numSeparatorComponents = num(c0002.words, 1);
    }
  } else {
    base.separatorOption = 0; // 매뉴얼: CCC0002는 optional, default ISEPST=0
  }

  return base;
}

export function parseTurbine(block: ComponentBlock): Record<string, any> {
  // TURBINE = BRANCH 기반 + shaft/performance 추가
  const base = parseBranch(block);
  const { cards, ccc } = block;

  const c0300 = findCard(cards, ccc, 300);
  const c0400 = findCard(cards, ccc, 400);

  // Shaft (CCC0300): speed, inertia, friction, shaftNo, trip [, drain]
  if (c0300) {
    base.shaftSpeed = num(c0300.words, 0);
    base.stageInertia = num(c0300.words, 1);
    base.shaftFriction = num(c0300.words, 2);
    base.shaftComponentNumber = num(c0300.words, 3);
    base.disconnectTrip = num(c0300.words, 4);
    base.drainFlag = num(c0300.words, 5);
  }

  // Performance (CCC0400): type, efficiency, fraction, radius
  if (c0400) {
    base.turbineType = num(c0400.words, 0);
    base.efficiency = num(c0400.words, 1);
    base.reactionFraction = num(c0400.words, 2);
    base.meanStageRadius = num(c0400.words, 3);
  }

  // Efficiency/MassFlow tables (CCC0401-0499) — type=3만
  const effCards = findCards(cards, ccc, 401, 450);
  if (effCards.length > 0) {
    base.efficiencyData = effCards.map(c => ({
      pressureRatio: num(c.words, 0),
      value: num(c.words, 1),
    }));
  }

  const mfrCards = findCards(cards, ccc, 451, 499);
  if (mfrCards.length > 0) {
    base.massFlowRateData = mfrCards.map(c => ({
      pressureRatio: num(c.words, 0),
      value: num(c.words, 1),
    }));
  }

  return base;
}

export function parseTank(block: ComponentBlock): Record<string, any> {
  // TANK = BRANCH 기반 + level/curve 추가
  const base = parseBranch(block);
  const { cards, ccc } = block;

  const c0400 = findCard(cards, ccc, 400);
  const curveCards = findCards(cards, ccc, 401, 499);

  base.initialLiquidLevel = c0400 ? num(c0400.words, 0) : 0;
  base.volumeLevelCurve = curveCards.map(c => ({
    volume: num(c.words, 0),
    level: num(c.words, 1),
  }));

  return base;
}

export function parseMtpljun(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0001 = findCard(cards, ccc, 1);
  const njuns = c0001 ? num(c0001.words, 0) : 0;
  const icond = c0001 ? num(c0001.words, 1) : 0;

  // MTPLJUN 접합부 카드: CCCNN11, CCCNN12, CCCNN13
  // IC 카드: CCC1NN11
  const junctions: any[] = [];

  // NN = 01~99 (2자리)
  // 카드 번호 패턴: CCC0NN1 (CCCNN11 → 로컬 = NN*10 + 11? 아님)
  // 실제: 1250011 → CCC=125, 로컬=0011 → 접합부 1의 카드 11
  //        1250021 → CCC=125, 로컬=0021 → 접합부 2의 카드 11
  //        1250111 → CCC=125, 로컬=0111 → 접합부 11의 카드 11
  // 패턴: 로컬 = NN*100 + 11/12/13 (NN=00~99 but offset by 1)
  // 실제: NN=01 → 0011, NN=02 → 0021, ..., NN=10 → 0101, NN=11 → 0111
  // 즉 로컬 = (NN-1)*10 + 11 이 아니라...

  // 100%.i 분석:
  // 1250011 = CCC(125) + 0011 → jun1, card type 11
  // 1250021 = CCC(125) + 0021 → jun2, card type 11
  // 1250031 = CCC(125) + 0031 → jun3, card type 11
  // 패턴: 로컬 = NN * 10 + 1 (NN=01,02,...), 카드타입 = 끝 1자리
  // 좀더 정확히: 로컬 4자리 = XXYY, XX=접합부번호, YY=카드타입(11,12,13)

  // IC: 12510111 = CCC(125) + 10111 → 1NN11 형태
  // 12510111: 로컬 = 10111, 분해: 1 + 01 + 11 → IC flag(1) + NN(01) + type(11)

  // 첫 번째 접합부의 card11 형식으로 전체 포맷 결정
  const firstCard11 = findCard(cards, ccc, 1 * 10 + 1);
  const cardFormat = (firstCard11 && firstCard11.words.length >= 6) ? 'combined' : 'split';

  for (let nn = 1; nn <= njuns; nn++) {
    const card11 = findCard(cards, ccc, nn * 10 + 1);  // from/to/area + loss/flags/dc
    const card12 = findCard(cards, ccc, nn * 10 + 2);  // deprecated or extra
    const card13 = findCard(cards, ccc, nn * 10 + 3);  // incre/junid

    // IC 카드: CCC + 10000 + NN*10 + 1
    // 12510111: CCC=125, IC로컬 = 10111, 즉 10000 + 01*10 + 1 = 10011? 아님
    // 12510111 - 1250000 = 10111 → hmm, 5자리
    // 사실 MTPLJUN IC는 8자리 카드: 12510111
    // 12510111: 첫 3자리 CCC=125, 나머지=10111
    // 하지만 CCC*10000 = 1250000 → 12510111 - 1250000 = 10111 (5자리)
    // IC 로컬 = 10000 + NN*100 + 11
    // NN=01 → 10000 + 100 + 11 = 10111 ✓
    // NN=11 → 10000 + 1100 + 11 = 11111

    // 수정: 실제 카드번호 체계를 다시 확인
    // CCC=125, 카드번호 = CCC0XXYY (7자리)
    //   데이터: 125XXYY where XX=접합부번호, YY=카드타입
    //   XX=01: 1250011(YY=11), 1250012(YY=12), 1250013(YY=13)
    //   XX=02: 1250021, 1250022, 1250023
    // IC: 1251XXYY (8자리) → 125 + 1 + XXYY
    //   XX=01: 12510111, 12510112
    //   → 12510111 = CCC(125)*100000 + 10000 + 01*100 + 11

    // 맞다. 원래 7자리 카드번호 체계에서 MTPLJUN IC는 8자리가 됨
    // 그래서 grouper에서 이미 8자리 카드를 처리해야 함

    if (!card11) continue;

    // card11: from to area fLoss rLoss flags subDc twoDc supDc fIncre tIncre
    // card11 combined: from to area fwdLoss revLoss jefvcahs (6+ words)
    // card11 split: from to area (3 words), card12 = fwdLoss revLoss jefvcahs subDc twoDc
    const card11Combined = card11.words.length >= 6;
    const junction: any = {
      junctionNumber: nn,
      from: rawRef(str(card11.words, 0)),
      to: rawRef(str(card11.words, 1)),
      area: num(card11.words, 2),
    };

    if (card11Combined) {
      junction.fwdLoss = num(card11.words, 3);
      junction.revLoss = num(card11.words, 4);
      junction.jefvcahs = str(card11.words, 5, '00000000');
      // card12 contains dc + increments + endJunction when card11 is combined
      if (card12) {
        junction.subDc = num(card12.words, 0, 1.0);
        junction.twoDc = num(card12.words, 1, 1.0);
        junction.supDc = num(card12.words, 2, 1.0);
        junction.fIncre = num(card12.words, 3, 0);
        junction.tIncre = num(card12.words, 4, 0);
        // W5=unused, W6=endJunction
        if (card12.words.length > 6) {
          junction.endJunction = num(card12.words, 6);
        }
      }
    } else if (card12) {
      // card12: fwd loss, rev loss, flags, discharge coefficients
      junction.fwdLoss = num(card12.words, 0);
      junction.revLoss = num(card12.words, 1);
      junction.jefvcahs = str(card12.words, 2, '00000000');
      junction.subDc = num(card12.words, 3, 1.0);
      junction.twoDc = num(card12.words, 4, 1.0);
    }

    // card13: none, fIncre, tIncre, none, endJunction
    if (card13) {
      // W1은 미사용 (0.0), W2=fIncre, W3=tIncre, W4=unused, W5=endJunction
      junction.fIncre = num(card13.words, 1);
      junction.tIncre = num(card13.words, 2);
      // W5: Sequential Expansion Format — 이 set이 커버하는 마지막 junction 번호
      if (card13.words.length > 4) {
        junction.endJunction = num(card13.words, 4);
      }
    }

    junctions.push(junction);
  }

  // IC 카드 파싱: SEF(Sequential Expansion Format) 지원
  // IC 카드가 icEndJunction으로 범위를 지정하면 해당 범위의 모든 접합부에 동일 값 적용
  const icCards: { cardNumber: number; words: string[] }[] = [];
  for (const c of cards) {
    const local = c.cardNumber - ccc * 10000;
    if (local >= 1000 && local < 2000) {
      icCards.push(c);
    }
  }
  icCards.sort((a, b) => a.cardNumber - b.cardNumber);

  if (icCards.length > 0) {
    // SEF 방식: 각 IC 카드의 W3(endJunction)까지 값 적용
    let prevEnd = 0;
    for (const ic of icCards) {
      const mfl = num(ic.words, 0);
      const mfv = num(ic.words, 1);
      const endJun = ic.words.length > 2 ? num(ic.words, 2) : prevEnd + 1;

      for (let j = prevEnd; j < junctions.length && j < endJun; j++) {
        junctions[j].initialLiquidFlow = mfl;
        junctions[j].initialVaporFlow = mfv;
      }
      prevEnd = endJun;
    }
  }

  return {
    name: block.componentName,
    njuns,
    icond,
    cardFormat,
    junctions,
  };
}

export function parsePump(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  const c0102 = findCard(cards, ccc, 102);
  const c0108 = findCard(cards, ccc, 108);
  const c0109 = findCard(cards, ccc, 109);
  const c0110 = findCard(cards, ccc, 110);  // Inlet CCFL (optional)
  const c0111 = findCard(cards, ccc, 111);  // Outlet CCFL (optional)
  const c0200 = findCard(cards, ccc, 200);

  // 유량 IC (CCC0201~0202) - 마지막 값 사용
  const flowCards = findCards(cards, ccc, 201, 202);
  const c0201 = flowCards.find(c => localCard(c.cardNumber, ccc) === 201);
  const c0202 = flowCards.find(c => localCard(c.cardNumber, ccc) === 202);

  // 옵션 (CCC0301) - 중복 시 마지막
  const c0301Cards = findCards(cards, ccc, 301, 301);
  const c0301 = c0301Cards.length > 0 ? c0301Cards[c0301Cards.length - 1] : undefined;

  // 기술 (CCC0302~0304): 12워드를 여러 카드에 분산 가능 (매뉴얼 8.16.12)
  const descCards = findCards(cards, ccc, 302, 304);
  const descWords: string[] = [];
  for (const dc of descCards) {
    descWords.push(...dc.words);
  }

  // 상사곡선 (CCC1100~CCC2600)
  const homologousCurves = parseHomologousCurves(cards, ccc);

  // 속도제어 (CCC6100+)
  const c6100 = findCard(cards, ccc, 6100);
  let speedControl: any = undefined;
  if (c6100) {
    const speedTableCards = findCards(cards, ccc, 6101, 6199);
    speedControl = {
      tripOrControl: num(c6100.words, 0),
      keyword: c6100.words.length > 1 ? str(c6100.words, 1) : undefined,
      parameter: c6100.words.length > 2 ? num(c6100.words, 2) : 0,
      speedTable: speedTableCards.map(c => ({
        searchVariable: num(c.words, 0),
        pumpSpeed: num(c.words, 1),
      })),
    };
  }

  return {
    name: block.componentName,
    area: c0101 ? num(c0101.words, 0) : 0,
    length: c0101 ? num(c0101.words, 1) : 0,
    volume: c0101 ? num(c0101.words, 2) : 0,
    azAngle: c0102 ? num(c0102.words, 0) : 0,
    incAngle: c0102 ? num(c0102.words, 1) : 0,
    dz: c0102 ? num(c0102.words, 2) : 0,
    tlpvbfe: c0102 ? str(c0102.words, 3, '0000000') : '0000000',
    inletConnection: c0108 ? rawRef(str(c0108.words, 0)) : null,
    inletArea: c0108 ? num(c0108.words, 1) : 0,
    inletFwdLoss: c0108 ? num(c0108.words, 2) : 0,
    inletRevLoss: c0108 ? num(c0108.words, 3) : 0,
    inletJefvcahs: c0108 ? str(c0108.words, 4, '00000000') : '00000000',
    outletConnection: c0109 ? rawRef(str(c0109.words, 0)) : null,
    outletArea: c0109 ? num(c0109.words, 1) : 0,
    outletFwdLoss: c0109 ? num(c0109.words, 2) : 0,
    outletRevLoss: c0109 ? num(c0109.words, 3) : 0,
    outletJefvcahs: c0109 ? str(c0109.words, 4, '00000000') : '00000000',
    inletCcflDiameter: c0110 ? num(c0110.words, 0) : undefined,
    inletCcflBeta: c0110 ? num(c0110.words, 1) : undefined,
    inletCcflSlope: c0110 ? num(c0110.words, 2) : undefined,
    inletCcflSlopeIncr: c0110 ? num(c0110.words, 3) : undefined,
    outletCcflDiameter: c0111 ? num(c0111.words, 0) : undefined,
    outletCcflBeta: c0111 ? num(c0111.words, 1) : undefined,
    outletCcflSlope: c0111 ? num(c0111.words, 2) : undefined,
    outletCcflSlopeIncr: c0111 ? num(c0111.words, 3) : undefined,
    // εbt 초기조건: t=0 [P,Uf,Ug,αg], t=1 [T,xs], t=2 [P,xs], t=3 [P,T]
    ebt: c0200 ? str(c0200.words, 0, '003') : '003',
    pressure: c0200 && str(c0200.words, 0, '003') !== '001' ? num(c0200.words, 1) : undefined,
    temperature: (() => {
      if (!c0200) return undefined;
      const ebtVal = str(c0200.words, 0, '003');
      if (ebtVal === '001') return num(c0200.words, 1);
      if (ebtVal === '003') return num(c0200.words, 2);
      return undefined;
    })(),
    quality: c0200 && ['001', '002'].includes(str(c0200.words, 0, '003')) ? num(c0200.words, 2) : undefined,
    inletFlowMode: c0201 ? num(c0201.words, 0) : 0,
    inletLiquidFlow: c0201 ? num(c0201.words, 1) : 0,
    inletVaporFlow: c0201 ? num(c0201.words, 2) : 0,
    outletFlowMode: c0202 ? num(c0202.words, 0) : 0,
    outletLiquidFlow: c0202 ? num(c0202.words, 1) : 0,
    outletVaporFlow: c0202 ? num(c0202.words, 2) : 0,
    tbli: c0301 ? num(c0301.words, 0) : 0,
    twophase: c0301 ? num(c0301.words, 1) : -1,
    tdiff: c0301 ? num(c0301.words, 2) : -3,
    mtorq: c0301 ? num(c0301.words, 3) : -1,
    tdvel: c0301 ? num(c0301.words, 4) : -1,
    ptrip: c0301 ? num(c0301.words, 5) : 0,
    rev: c0301 ? num(c0301.words, 6) : 0,
    ratedSpeed: num(descWords, 0),
    initialSpeedRatio: num(descWords, 1),
    ratedFlow: num(descWords, 2),
    ratedHead: num(descWords, 3),
    ratedTorque: num(descWords, 4),
    momentOfInertia: num(descWords, 5),
    ratedDensity: num(descWords, 6),
    ratedMotorTorque: num(descWords, 7),
    frictionTF2: num(descWords, 8),
    frictionTF0: num(descWords, 9),
    frictionTF1: num(descWords, 10),
    frictionTF3: num(descWords, 11),
    homologousCurves,
    speedControl,
  };
}

/**
 * 펌프 상사곡선 파싱 (CCC1100~CCC2600)
 *
 * 16종 곡선: han/ban/hvn/bvn/had/bad/hvd/bvd/hat/bat/hvt/bvt/har/bar/hvr/bvr
 * 각 곡선: 헤더(CCC XX00: type, regime) + 데이터(CCC XX01~: x, y)
 */
function parseHomologousCurves(cards: Card[], ccc: number): any[] {
  const curveNames = [
    'han', 'ban', 'hvn', 'bvn',
    'had', 'bad', 'hvd', 'bvd',
    'hat', 'bat', 'hvt', 'bvt',
    'har', 'bar', 'hvr', 'bvr',
  ];

  // 곡선 카드 범위: CCC1100~CCC2600 (간격 100)
  const curveBaseCards = [
    1100, 1200, 1300, 1400,
    1500, 1600, 1700, 1800,
    1900, 2000, 2100, 2200,
    2300, 2400, 2500, 2600,
  ];

  const curves: any[] = [];

  for (let i = 0; i < 16; i++) {
    const base = curveBaseCards[i];
    const header = findCard(cards, ccc, base);
    if (!header) continue;

    const dataCards = findCards(cards, ccc, base + 1, base + 99);
    if (dataCards.length === 0) continue;

    // xLabel/yLabel 결정: h=head, b=torque, a=v/a, v=a/v
    const cName = curveNames[i];
    const isV = cName[1] === 'v'; // hvn, hvd, hvt, hvr, bvn, bvd, bvt, bvr
    const isH = cName[0] === 'h';
    const xLabel = isV ? 'a/v' : 'v/a';
    const yLabel = isH
      ? (isV ? 'h/v2' : 'h/a2')
      : (isV ? 'b/v2' : 'b/a2');

    curves.push({
      name: curveNames[i],
      type: num(header.words, 0),
      regime: num(header.words, 1),
      enabled: true,
      xLabel,
      yLabel,
      points: dataCards.map(c => ({
        x: num(c.words, 0),
        y: num(c.words, 1),
      })),
    });
  }

  return curves;
}

export function parseValve(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  const c0101 = findCard(cards, ccc, 101);
  const c0102 = findCard(cards, ccc, 102);
  const c0103 = findCard(cards, ccc, 103);
  const c0201 = findCard(cards, ccc, 201);
  const c0300 = findCard(cards, ccc, 300);
  // 중복 카드 시 마지막 값
  const c0301Cards = findCards(cards, ccc, 301, 301);
  const c0301 = c0301Cards.length > 0 ? c0301Cards[c0301Cards.length - 1] : undefined;

  const valveSubType = c0300 ? str(c0300.words, 0, 'trpvlv') : 'trpvlv';

  // CCC0101 워드 수에 따라 분기:
  // 3워드: from, to, area (trpvlv/srvvlv)
  // 6워드: from, to, area, fwdLoss, revLoss, jefvcahs (일부)
  const from = c0101 ? rawRef(str(c0101.words, 0)) : rawRef('000000000');
  const to = c0101 ? rawRef(str(c0101.words, 1)) : rawRef('000000000');
  const area = c0101 ? num(c0101.words, 2) : 0;

  let fwdLoss = 0, revLoss = 0, jefvcahs = '00000000';
  if (c0101 && c0101.words.length >= 6) {
    fwdLoss = num(c0101.words, 3);
    revLoss = num(c0101.words, 4);
    jefvcahs = str(c0101.words, 5, '00000000');
  } else if (c0102) {
    fwdLoss = num(c0102.words, 0);
    revLoss = num(c0102.words, 1);
    jefvcahs = str(c0102.words, 2, '00000000');
  }

  const result: Record<string, any> = {
    name: block.componentName,
    from,
    to,
    area,
    fwdLoss,
    revLoss,
    jefvcahs,
    initialConditionType: c0201 ? num(c0201.words, 0) : 0,
    initialLiquidFlow: c0201 ? num(c0201.words, 1) : 0,
    initialVaporFlow: c0201 ? num(c0201.words, 2) : 0,
    valveSubType,
  };

  // Discharge / Thermal coefficient 파싱
  if (valveSubType === 'mtrvlv') {
    // mtrvlv: CCC0103 = dischargeCoeff, thermalCoeff
    if (c0103) {
      result.enableDischargeCoeffs = true;
      result.dischargeCoeff = num(c0103.words, 0, 1.0);
      result.thermalCoeff = num(c0103.words, 1, 0.14);
    }
  } else {
    // trpvlv/srvvlv/chkvlv: CCC0101이 6워드(loss 포함)일 때
    // CCC0102는 dischargeCoeff, thermalCoeff 용도
    if (c0101 && c0101.words.length >= 6 && c0102) {
      result.enableDischargeCoeffs = true;
      result.dischargeCoeff = num(c0102.words, 0, 1.0);
      result.thermalCoeff = num(c0102.words, 1, 0.14);
    }
  }

  // 서브타입별 CCC0301 파싱
  if (c0301) {
    switch (valveSubType) {
      case 'trpvlv':
        result.tripNumber = num(c0301.words, 0);
        break;
      case 'mtrvlv':
        result.openTripNumber = num(c0301.words, 0);
        result.closeTripNumber = num(c0301.words, 1);
        result.valveRate = num(c0301.words, 2);
        result.initialPosition = num(c0301.words, 3);
        break;
      case 'srvvlv':
        result.controlVariable = num(c0301.words, 0);
        result.valveTableNumber = num(c0301.words, 1);
        break;
      case 'chkvlv':
        result.checkValveType = num(c0301.words, 0);
        result.checkInitialPosition = num(c0301.words, 1);
        result.closingBackPressure = num(c0301.words, 2);
        result.leakRatio = num(c0301.words, 3);
        break;
    }
  }

  return result;
}

export function parseHtstr(block: ComponentBlock): Record<string, any> {
  const { cards, ccc } = block;

  // 열구조체 카드는 8자리: 1CCCGXNN
  // grouper에서 ccc = 1CCCG (5자리, Geometry별 분리)
  // componentId = 1CCCG * 1000 → cardBase
  // 예: ccc=11200 → cardBase=11200000
  //     G000=11200000, G001=11200001, G100=11200100, ...

  const cardBase = ccc * 1000;

  const g000 = cards.find(c => c.cardNumber === cardBase);
  const g001 = cards.find(c => c.cardNumber === cardBase + 1);
  const g003 = cards.find(c => c.cardNumber === cardBase + 3);
  const g004 = cards.find(c => c.cardNumber === cardBase + 4);
  const g100 = cards.find(c => c.cardNumber === cardBase + 100);

  // G000: nh, np, geom, ssif, leftcoord [, reflood, bvi, mai]
  const nh = g000 ? num(g000.words, 0) : 1;
  const np = g000 ? num(g000.words, 1) : 2;

  const result: Record<string, any> = {
    name: block.componentName,
    nh,
    np,
    geometryType: g000 ? num(g000.words, 2) : 1,
    ssInitFlag: g000 ? num(g000.words, 3) : 0,
    leftBoundaryCoord: g000 ? num(g000.words, 4) : 0,
    isFuelRod: !!g001,
  };

  // Reflood options (G000 W6~W8)
  if (g000 && g000.words.length > 5) {
    result.refloodFlag = num(g000.words, 5);
    result.boundaryVolumeIndicator = num(g000.words, 6);
    result.maxAxialIntervals = num(g000.words, 7);
  }

  // Fuel rod cards
  if (g001) {
    result.gapConductance = {
      initialGapPressure: num(g001.words, 0),
      referenceVolume: rawRef(str(g001.words, 1)),
    };
  }
  if (g003) {
    result.metalWaterReaction = { initialOxideThickness: num(g003.words, 0) };
  }
  if (g004) {
    result.claddingDeformation = { formLossFlag: num(g004.words, 0) };
  }

  // Gap deformation (G011~G099)
  const gapCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 11 && local <= 99;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  if (gapCards.length > 0) {
    result.gapDeformationData = gapCards.map(c => ({
      fuelSurfaceRoughness: num(c.words, 0),
      cladSurfaceRoughness: num(c.words, 1),
      fuelSwelling: num(c.words, 2),
      cladCreepdown: num(c.words, 3),
      hsNumber: num(c.words, 4),
    }));
  }

  // Mesh (G100, G101~G199)
  if (g100) {
    result.meshLocationFlag = num(g100.words, 0);
    result.meshFormatFlag = num(g100.words, 1);
  }

  const meshCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 101 && local <= 199;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.meshIntervals = meshCards.map(c => ({
    intervals: num(c.words, 0),
    rightCoord: num(c.words, 1),
  }));

  // Material compositions (G201~G299)
  const matCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 201 && local <= 299;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.materialCompositions = matCards.map(c => ({
    materialNumber: num(c.words, 0),
    interval: num(c.words, 1),
  }));

  // Source distribution (G301~G399)
  const srcDistCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 301 && local <= 399;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.sourceDistributions = srcDistCards.map(c => ({
    sourceValue: num(c.words, 0),
    interval: num(c.words, 1),
  }));

  // Initial temperature flag (G400)
  const g400 = cards.find(c => c.cardNumber === cardBase + 400);
  if (g400) {
    result.initialTempFlag = num(g400.words, 0);
  }

  // Initial temperatures (G401~G499)
  const tempCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 401 && local <= 499;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.initialTemperatures = tempCards.map(c => ({
    temperature: num(c.words, 0),
    meshPoint: num(c.words, 1),
  }));

  // Left boundary conditions (G501~G599)
  const lbcCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 501 && local <= 599;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.leftBoundaryConditions = lbcCards.map(c => ({
    boundaryVolume: rawRef(str(c.words, 0, '0')),
    increment: num(c.words, 1),
    bcType: num(c.words, 2),
    surfaceAreaCode: num(c.words, 3),
    surfaceArea: num(c.words, 4),
    hsNumber: num(c.words, 5),
  }));

  // Right boundary conditions (G601~G699)
  const rbcCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 601 && local <= 699;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.rightBoundaryConditions = rbcCards.map(c => ({
    boundaryVolume: rawRef(str(c.words, 0, '0')),
    increment: num(c.words, 1),
    bcType: num(c.words, 2),
    surfaceAreaCode: num(c.words, 3),
    surfaceArea: num(c.words, 4),
    hsNumber: num(c.words, 5),
  }));

  // Source data (G701~G799)
  const srcDataCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 701 && local <= 799;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  result.sourceData = srcDataCards.map(c => ({
    sourceType: num(c.words, 0),
    multiplier: num(c.words, 1),
    dmhl: num(c.words, 2),
    dmhr: num(c.words, 3),
    hsNumber: num(c.words, 4),
  }));

  // Additional left boundary (G800, G801~G899)
  const g800 = cards.find(c => c.cardNumber === cardBase + 800);
  if (g800) {
    result.leftAdditionalOption = num(g800.words, 0);
  }

  const leftAddCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 801 && local <= 899;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  if (leftAddCards.length > 0) {
    const leftFormatFlag = result.leftAdditionalOption || 0;
    result.leftAdditionalBoundary = leftAddCards.map(c => {
      if (leftFormatFlag >= 1 || c.words.length >= 12) {
        // 12-word format: includes natural circulation length, P/D ratio, fouling factor
        return {
          heatTransferDiameter: num(c.words, 0),
          heatedLengthForward: num(c.words, 1),
          heatedLengthReverse: num(c.words, 2),
          gridSpacerLengthFwd: num(c.words, 3),
          gridSpacerLengthRev: num(c.words, 4),
          gridLossCoeffFwd: num(c.words, 5),
          gridLossCoeffRev: num(c.words, 6),
          localBoilingFactor: num(c.words, 7, 1.0),
          naturalCirculationLength: num(c.words, 8),
          pitchToDiameterRatio: num(c.words, 9),
          foulingFactor: num(c.words, 10),
          hsNumber: num(c.words, 11),
        };
      }
      // 9-word format
      return {
        heatTransferDiameter: num(c.words, 0),
        heatedLengthForward: num(c.words, 1),
        heatedLengthReverse: num(c.words, 2),
        gridSpacerLengthFwd: num(c.words, 3),
        gridSpacerLengthRev: num(c.words, 4),
        gridLossCoeffFwd: num(c.words, 5),
        gridLossCoeffRev: num(c.words, 6),
        localBoilingFactor: num(c.words, 7, 1.0),
        hsNumber: num(c.words, 8),
      };
    });
  }

  // Additional right boundary (G900, G901~G999)
  const g900 = cards.find(c => c.cardNumber === cardBase + 900);
  if (g900) {
    result.rightAdditionalOption = num(g900.words, 0);
  }

  const rightAddCards = cards.filter(c => {
    const local = c.cardNumber - cardBase;
    return local >= 901 && local <= 999;
  }).sort((a, b) => a.cardNumber - b.cardNumber);

  if (rightAddCards.length > 0) {
    const formatFlag = result.rightAdditionalOption || 0;
    result.rightAdditionalBoundary = rightAddCards.map(c => {
      if (formatFlag >= 1) {
        // 12-word format
        return {
          heatTransferDiameter: num(c.words, 0),
          heatedLengthForward: num(c.words, 1),
          heatedLengthReverse: num(c.words, 2),
          gridSpacerLengthFwd: num(c.words, 3),
          gridSpacerLengthRev: num(c.words, 4),
          gridLossCoeffFwd: num(c.words, 5),
          gridLossCoeffRev: num(c.words, 6),
          localBoilingFactor: num(c.words, 7, 1.0),
          naturalCirculationLength: num(c.words, 8),
          pitchToDiameterRatio: num(c.words, 9),
          foulingFactor: num(c.words, 10),
          hsNumber: num(c.words, 11),
        };
      }
      return {
        heatTransferDiameter: num(c.words, 0),
        heatedLengthForward: num(c.words, 1),
        heatedLengthReverse: num(c.words, 2),
        gridSpacerLengthFwd: num(c.words, 3),
        gridSpacerLengthRev: num(c.words, 4),
        gridLossCoeffFwd: num(c.words, 5),
        gridLossCoeffRev: num(c.words, 6),
        localBoilingFactor: num(c.words, 7, 1.0),
        hsNumber: num(c.words, 8),
      };
    });
  }

  return result;
}

// ============================================================
// 디스패처
// ============================================================

const PARSERS: Record<ComponentType, (block: ComponentBlock) => Record<string, any>> = {
  snglvol: parseSnglvol,
  tmdpvol: parseTmdpvol,
  sngljun: parseSngljun,
  tmdpjun: parseTmdpjun,
  pipe: parsePipe,
  branch: parseBranch,
  separatr: parseSeparator,
  turbine: parseTurbine,
  tank: parseTank,
  mtpljun: parseMtpljun,
  pump: parsePump,
  valve: parseValve,
  htstr: parseHtstr,
};

export function parseComponent(block: ComponentBlock): Record<string, any> {
  const parser = PARSERS[block.componentType];
  if (!parser) {
    console.warn(`No parser for component type: ${block.componentType} (CCC=${block.ccc})`);
    return { name: block.componentName };
  }
  return parser(block);
}
