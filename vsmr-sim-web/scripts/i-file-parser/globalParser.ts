/**
 * 글로벌/비컴포넌트 데이터 파서
 *
 * 앱의 GlobalSettings 타입(src/types/mars.ts)에 맞는 형태로 파싱
 *
 * Card 1~299: 글로벌 설정
 * Card 301~399, 20800001+: Minor Edits
 * Card 401~599: Variable Trips
 * Card 601~799: Logic Trips
 * Card 801~999: Interactive Inputs
 * Card 205CCCNN: Control Variables
 * Card 201MMMNN: Thermal Properties
 * Card 202TTTNN: General Tables
 * Card 30000XXX: Reactor Kinetics
 */

import { Card, toNumber } from './tokenizer';
import { GlobalBlock } from './grouper';

function num(words: string[], index: number, defaultVal = 0): number {
  if (index >= words.length) return defaultVal;
  const v = toNumber(words[index]);
  return isNaN(v) ? defaultVal : v;
}

function str(words: string[], index: number, defaultVal = ''): string {
  return index < words.length ? words[index] : defaultVal;
}

export interface GlobalParseResult {
  simulationType?: string;
  unitSystem?: string;
  workingFluid?: string;
  globalSettings?: Record<string, any>;
}

export function parseGlobalSettings(globals: GlobalBlock[]): GlobalParseResult {
  const result: GlobalParseResult = {};
  const settings: Record<string, any> = {};

  for (const block of globals) {
    switch (block.type) {
      case 'global':
        parseGlobalCards(block.cards, result, settings);
        break;
      case 'minor-edits':
        settings.minorEdits = parseMinorEdits(block.cards);
        break;
      case 'variable-trips':
        settings.variableTrips = parseVariableTrips(block.cards);
        break;
      case 'logic-trips':
        settings.logicTrips = parseLogicTrips(block.cards);
        break;
      case 'interactive-inputs':
        settings.interactiveInputs = parseInteractiveInputs(block.cards);
        break;
      case 'control-variables':
        settings.controlVariables = parseControlVariables(block.cards);
        break;
      case 'thermal-properties':
        settings.thermalProperties = parseThermalProperties(block.cards);
        break;
      case 'general-tables':
        settings.generalTables = parseGeneralTables(block.cards);
        break;
      case 'reactor-kinetics':
        settings.reactorKinetics = parseReactorKinetics(block.cards);
        break;
    }
  }

  result.globalSettings = settings;
  return result;
}

function parseGlobalCards(
  cards: Card[],
  result: GlobalParseResult,
  settings: Record<string, any>
): void {
  for (const card of cards) {
    const cn = card.cardNumber;

    switch (cn) {
      case 1: {
        // Card 001: Development Model Control (optional)
        // 단순히 값 보존 - 앱의 Card001 = { enabled: boolean, values: number[] }
        const values = card.words.map(w => toNumber(w)).filter(v => !isNaN(v));
        if (values.length > 0) {
          settings.card001 = { enabled: true, values };
        }
        break;
      }
      case 100: {
        // Card 100: Problem Type → { problemType, calculationType }
        const problemType = str(card.words, 0, 'new') as 'new' | 'restart';
        const calculationType = str(card.words, 1, 'transnt') as 'transnt' | 'stdy-st';
        result.simulationType = calculationType;
        settings.card100 = { problemType, calculationType };
        break;
      }
      case 101: {
        // Card 101: Run Option → { runOption }
        settings.card101 = { runOption: str(card.words, 0, 'run') };
        break;
      }
      case 102: {
        // Card 102: Units → { inputUnits, outputUnits }
        const inputUnits = str(card.words, 0, 'si');
        const outputUnits = str(card.words, 1, 'si');
        result.unitSystem = inputUnits;
        settings.card102 = { inputUnits, outputUnits };
        break;
      }
      case 104: {
        // Card 104: Restart-Plot File Control → { enabled, action, fileName }
        settings.card104 = {
          enabled: true,
          action: str(card.words, 0, ''),
          fileName: str(card.words, 1, ''),
        };
        break;
      }
      case 105: {
        // Card 105: CPU Time Limits → { enabled, limit1, limit2 }
        settings.card105 = {
          enabled: true,
          limit1: num(card.words, 0),
          limit2: num(card.words, 1),
        };
        break;
      }
      case 110: {
        // Card 110: Non-condensable Gas → { gases: string[] }
        // 카드 110에 여러 가스가 올 수 있음
        const gases = card.words
          .map(w => w.toLowerCase())
          .filter(w => w.length > 0);
        settings.card110 = { gases: gases.length > 0 ? gases : ['air'] };
        break;
      }
      case 115: {
        // Card 115: Gas Mass Fractions → { fractions: number[] }
        const fractions = card.words.map(w => toNumber(w)).filter(v => !isNaN(v));
        settings.card115 = { fractions };
        break;
      }
      default: {
        // Card 120~129: System Configuration → SystemConfig[]
        if (cn >= 120 && cn <= 129) {
          if (!settings.systems) settings.systems = [];
          const systemNumber = cn - 120;
          const refVolumeStr = str(card.words, 0, '0');
          settings.systems.push({
            systemNumber,
            referenceVolume: { raw: refVolumeStr },
            referenceElevation: num(card.words, 1),
            fluid: normalizeFluid(str(card.words, 2, 'h2o')),
            systemName: str(card.words, 3, ''),
          });
          // 첫 시스템의 유체를 working fluid로 (원본 문자열 보존)
          if (!result.workingFluid) {
            result.workingFluid = normalizeFluid(str(card.words, 2, 'h2o'));
          }
        }
        // Card 200: Initial Time → { initialTime }
        else if (cn === 200) {
          settings.card200 = { initialTime: num(card.words, 0, 0) };
        }
        // Card 201~299: Time Phases → TimePhase[]
        else if (cn >= 201 && cn <= 299) {
          if (!settings.timePhases) settings.timePhases = [];
          // W3(option)은 5자리 controlOption 문자열로 변환
          const optionNum = num(card.words, 3, 3);
          const controlOption = String(optionNum).padStart(5, '0');
          settings.timePhases.push({
            endTime: num(card.words, 0),
            minDt: num(card.words, 1),
            maxDt: num(card.words, 2),
            controlOption,
            minorEditFreq: num(card.words, 4, 1000),
            majorEditFreq: num(card.words, 5, 10000),
            restartFreq: num(card.words, 6, 100000),
          });
        }
        break;
      }
    }
  }
}

/**
 * fluid 문자열 — 원본 문자열 보존 (MARS가 h2onew, h2o 등 구분)
 */
function normalizeFluid(fluid: string): string {
  return fluid.toLowerCase();
}

/**
 * Minor Edits → MinorEdit[]
 * { cardNumber, variableType, parameter, lowerLimit, upperLimit, editGroup, editPriority, comment? }
 */
function parseMinorEdits(cards: Card[]): any[] {
  return cards.map(card => ({
    cardNumber: card.cardNumber,
    variableType: str(card.words, 0),
    parameter: str(card.words, 1, '0'),
    lowerLimit: num(card.words, 2, 0),
    upperLimit: num(card.words, 3, 0),
    editGroup: num(card.words, 4, 0),
    editPriority: num(card.words, 5, 0),
    ...(card.comment && { comment: card.comment }),
  }));
}

/**
 * Variable Trips → VariableTrip[]
 * { cardNumber, leftVar, leftParam, relation, rightVar, rightParam, actionValue, latch, timeout?, comment? }
 */
function parseVariableTrips(cards: Card[]): any[] {
  return cards.map(card => {
    const w = card.words;
    const trip: any = {
      cardNumber: card.cardNumber,
      leftVar: str(w, 0, 'time'),
      leftParam: str(w, 1, '0'),
      relation: str(w, 2, 'gt'),
      rightVar: str(w, 3, 'null'),
      rightParam: str(w, 4, '0'),
      actionValue: num(w, 5, 0),
      latch: str(w, 6, 'l') as 'l' | 'n',
    };

    // W7: timeout
    if (w.length > 7) {
      trip.timeout = num(w, 7, -1);
    }

    // 주석 or trip message (따옴표로 감싸여 있으면 isTripMessage)
    if (card.comment) {
      if (card.comment.startsWith('"') || card.comment.startsWith("'")) {
        trip.comment = card.comment.replace(/^["']|["']$/g, '');
        trip.isTripMessage = true;
      } else {
        trip.comment = card.comment;
      }
    }
    // W8이 따옴표로 시작하면 trip message
    if (w.length > 8 && w[8]) {
      const msgParts = w.slice(8).join(' ');
      if (msgParts) {
        trip.comment = msgParts.replace(/^["']|["']$/g, '');
        trip.isTripMessage = true;
      }
    }

    return trip;
  });
}

/**
 * Logic Trips → LogicTrip[]
 * { cardNumber, trip1, operator, trip2, latch, timeof?, comment? }
 */
function parseLogicTrips(cards: Card[]): any[] {
  return cards.map(card => {
    const w = card.words;
    const trip: any = {
      cardNumber: card.cardNumber,
      trip1: num(w, 0, 0),
      operator: str(w, 1, 'and') as 'and' | 'or',
      trip2: num(w, 2, 0),
      latch: str(w, 3, 'n') as 'l' | 'n',
    };

    if (w.length > 4) {
      trip.timeof = num(w, 4, -1);
    }

    // tripMessage: card.comment 또는 words에 따옴표 문자열이 있는 경우
    if (card.comment) {
      if (card.comment.startsWith('"') || card.comment.startsWith("'")) {
        trip.comment = card.comment.replace(/^["']|["']$/g, '');
        trip.isTripMessage = true;
      } else {
        trip.comment = card.comment;
      }
    }

    // words에 따옴표로 시작하는 tripMessage가 있을 수 있음 (예: "PZR PSV TRIP")
    if (!trip.comment && w.length > 5) {
      const msgStart = w.findIndex((word, idx) => idx >= 5 && (word.startsWith('"') || word.startsWith("'")));
      if (msgStart >= 0) {
        const msgParts = w.slice(msgStart).join(' ');
        trip.comment = msgParts.replace(/^["']|["']$/g, '');
        trip.isTripMessage = true;
      }
    }

    return trip;
  });
}

/**
 * Interactive Inputs → InteractiveInput[]
 * { cardNumber, controlType, parameter, comment? }
 */
function parseInteractiveInputs(cards: Card[]): any[] {
  return cards.map(card => {
    // words[2]에 따옴표 코멘트가 올 수 있음: "load-follow", "MFIV #1" 등
    // 또는 words[2]+words[3]로 분리될 수 있음: "MFIV + #1"
    let comment = card.comment;
    if (!comment && card.words.length > 2) {
      // words[2] 이후를 합쳐서 따옴표 제거
      const rest = card.words.slice(2).join(' ').replace(/^"|"$/g, '');
      if (rest) comment = rest;
    }
    return {
      cardNumber: card.cardNumber,
      controlType: str(card.words, 0, 'trip'),
      parameter: str(card.words, 1, '0'),
      ...(comment && { comment }),
    };
  });
}

/**
 * Control Variables → ControlVariable[]
 * 앱의 ControlVariable 타입에 맞게 파싱
 * 205CCCNN → CCC = 제어변수 번호, NN = 카드 서브넘버
 *
 * ConstantControlVariable: { number, name, componentType:'CONSTANT', scalingFactor }
 * NonConstantControlVariable: { number, name, componentType, scalingFactor, initialValue,
 *                               initialValueFlag, limiterControl, minValue, maxValue, data }
 */
function parseControlVariables(cards: Card[]): any[] {
  const cvMap = new Map<number, Card[]>();

  for (const card of cards) {
    const cvCCC = Math.floor((card.cardNumber - 20500000) / 100);
    if (!cvMap.has(cvCCC)) cvMap.set(cvCCC, []);
    cvMap.get(cvCCC)!.push(card);
  }

  const result: any[] = [];
  for (const [cvCCC, cvCards] of cvMap) {
    const sorted = cvCards.sort((a, b) => a.cardNumber - b.cardNumber);
    const header = sorted.find(c => c.cardNumber % 100 === 0);
    const dataCards = sorted.filter(c => c.cardNumber % 100 !== 0);

    if (!header) continue;

    const cvType = str(header.words, 1, 'CONSTANT').toUpperCase();

    if (cvType === 'CONSTANT') {
      // ConstantControlVariable
      result.push({
        number: cvCCC,
        name: str(header.words, 0, `cv_${cvCCC}`),
        componentType: 'CONSTANT',
        scalingFactor: num(header.words, 2, 0),
      });
      continue;
    }

    // NonConstantControlVariable
    // 205CCC00: W1=name, W2=type, W3=scalingFactor, W4=initialValue, W5=flag, W6=limiter, W7=min, W8=max
    const cv: any = {
      number: cvCCC,
      name: str(header.words, 0, `cv_${cvCCC}`),
      componentType: cvType,
      scalingFactor: num(header.words, 2, 1.0),
      initialValue: num(header.words, 3, 0),
      initialValueFlag: num(header.words, 4, 0) as 0 | 1,
      limiterControl: header.words.length > 5 ? num(header.words, 5, 0) : undefined,
      minValue: header.words.length > 6 ? num(header.words, 6, 0) : undefined,
      maxValue: header.words.length > 7 ? num(header.words, 7, 0) : undefined,
    };

    // 타입별 data 필드 생성
    cv.data = buildControlVariableData(cvType, dataCards);

    result.push(cv);
  }

  return result;
}

/**
 * CV 타입별 data 필드 구성
 */
function buildControlVariableData(cvType: string, dataCards: Card[]): any {
  switch (cvType) {
    case 'SUM': {
      // NN01: W1=A0, W2=A1, W3=varName1, W4=varCode1
      // NN02+: triplet 반복 (Aj, varNameJ, varCodeJ) — 한 카드에 다중 triplet 가능
      const first = dataCards[0];
      const data: any = { constant: first ? num(first.words, 0, 0) : 0, terms: [] };
      if (first && first.words.length >= 4) {
        data.terms.push({
          coefficient: num(first.words, 1, 0),
          variable: { variableName: str(first.words, 2), parameterCode: num(first.words, 3, 0) },
        });
      }
      for (let i = 1; i < dataCards.length; i++) {
        const dc = dataCards[i];
        // 한 카드에 여러 triplet (coefficient, varName, varCode)이 있을 수 있음
        for (let j = 0; j + 2 < dc.words.length; j += 3) {
          data.terms.push({
            coefficient: num(dc.words, j, 0),
            variable: { variableName: str(dc.words, j + 1), parameterCode: num(dc.words, j + 2, 0) },
          });
        }
      }
      return data;
    }
    case 'MULT': {
      // NN01+: W1=varName, W2=varCode, W3=varName, W4=varCode ...
      const factors: any[] = [];
      for (const dc of dataCards) {
        for (let i = 0; i + 1 < dc.words.length; i += 2) {
          factors.push({
            variableName: str(dc.words, i),
            parameterCode: num(dc.words, i + 1, 0),
          });
        }
      }
      return { factors };
    }
    case 'DIV': {
      const dc = dataCards[0];
      const data: any = {
        denominator: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
      };
      if (dc && dc.words.length >= 4) {
        data.numerator = { variableName: str(dc.words, 2), parameterCode: num(dc.words, 3, 0) };
      }
      return data;
    }
    case 'TRIPUNIT':
    case 'TRIPDLAY': {
      const dc = dataCards[0];
      return { tripNumber: dc ? num(dc.words, 0, 0) : 0 };
    }
    case 'FUNCTION': {
      const dc = dataCards[0];
      return {
        variable: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
        tableNumber: dc ? num(dc.words, 2, 0) : 0,
      };
    }
    case 'STDFNCTN': {
      const dc = dataCards[0];
      const funcName = str(dc?.words, 0, 'ABS').toUpperCase();
      const args: any[] = [];
      if (dc) {
        for (let i = 1; i + 1 < dc.words.length; i += 2) {
          args.push({ variableName: str(dc.words, i), parameterCode: num(dc.words, i + 1, 0) });
        }
      }
      return { functionName: funcName, arguments: args };
    }
    case 'PUMPCTL':
    case 'STEAMCTL': {
      // 7 words across cards 01-98 (매뉴얼 14.3.19/20)
      // W1=setpointName, W2=setpointCode, W3=sensedName, W4=sensedCode, W5=scale, W6=integral, W7=proportional
      const allWords: string[] = [];
      for (const dc of dataCards) {
        allWords.push(...dc.words);
      }
      return {
        setpointVariable: { variableName: str(allWords, 0), parameterCode: num(allWords, 1, 0) },
        sensedVariable: { variableName: str(allWords, 2), parameterCode: num(allWords, 3, 0) },
        scaleFactor: num(allWords, 4, 1),
        integralTime: num(allWords, 5, 0),
        proportionalTime: num(allWords, 6, 0),
      };
    }
    case 'FEEDCTL': {
      // 12 words across multiple cards
      const allWords: string[] = [];
      for (const dc of dataCards) {
        allWords.push(...dc.words);
      }
      return {
        setpointVariable1: { variableName: str(allWords, 0), parameterCode: num(allWords, 1, 0) },
        sensedVariable1: { variableName: str(allWords, 2), parameterCode: num(allWords, 3, 0) },
        scaleFactor1: num(allWords, 4, 1),
        setpointVariable2: { variableName: str(allWords, 5), parameterCode: num(allWords, 6, 0) },
        sensedVariable2: { variableName: str(allWords, 7), parameterCode: num(allWords, 8, 0) },
        scaleFactor2: num(allWords, 9, 1),
        integralTime: num(allWords, 10, 0),
        proportionalTime: num(allWords, 11, 0),
      };
    }
    case 'SHAFT': {
      // NN01: W1=torqueCV, W2=inertia, W3=friction (매뉴얼 14.3.18.1)
      // NN02~05: component type+number pairs
      // NN06: generator data (optional)
      const first = dataCards[0];
      const data: any = {
        torqueControlVariable: first ? num(first.words, 0, 0) : 0,
        momentOfInertia: first ? num(first.words, 1, 0) : 0,
        frictionFactor: first ? num(first.words, 2, 0) : 0,
        attachedComponents: [],
      };
      for (let i = 1; i < dataCards.length; i++) {
        const dc = dataCards[i];
        const nn = dc.cardNumber % 100;
        if (nn >= 2 && nn <= 5) {
          for (let j = 0; j + 1 < dc.words.length; j += 2) {
            const typeStr = str(dc.words, j).toUpperCase();
            const compNum = num(dc.words, j + 1, 0);
            if (typeStr && compNum > 0) {
              data.attachedComponents.push({ type: typeStr, componentNumber: compNum });
            }
          }
        } else if (nn === 6) {
          data.generatorData = {
            initialVelocity: num(dc.words, 0, 0),
            synchronousVelocity: num(dc.words, 1, 0),
            momentOfInertia: num(dc.words, 2, 0),
            frictionFactor: num(dc.words, 3, 0),
            tripNumber1: num(dc.words, 4, 0),
            tripNumber2: num(dc.words, 5, 0),
          };
        }
      }
      return data;
    }
    case 'PROP-INT': {
      const dc = dataCards[0];
      return {
        proportionalGain: num(dc?.words || [], 0, 0),
        integralGain: num(dc?.words || [], 1, 0),
        variable: { variableName: str(dc?.words, 2), parameterCode: num(dc?.words || [], 3, 0) },
      };
    }
    case 'LAG': {
      const dc = dataCards[0];
      return {
        lagTime: num(dc?.words || [], 0, 0),
        variable: { variableName: str(dc?.words, 1), parameterCode: num(dc?.words || [], 2, 0) },
      };
    }
    case 'LEAD-LAG': {
      const dc = dataCards[0];
      return {
        leadTime: num(dc?.words || [], 0, 0),
        lagTime: num(dc?.words || [], 1, 0),
        variable: { variableName: str(dc?.words, 2), parameterCode: num(dc?.words || [], 3, 0) },
      };
    }
    case 'DELAY': {
      const dc = dataCards[0];
      return {
        variable: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
        delayTime: num(dc?.words || [], 2, 0),
        holdPositions: num(dc?.words || [], 3, 0),
      };
    }
    case 'POWERI': {
      const dc = dataCards[0];
      return {
        variable: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
        integerPower: num(dc?.words || [], 2, 0),
      };
    }
    case 'POWERR': {
      const dc = dataCards[0];
      return {
        variable: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
        realPower: num(dc?.words || [], 2, 0),
      };
    }
    case 'POWERX': {
      const dc = dataCards[0];
      return {
        base: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
        exponent: { variableName: str(dc?.words, 2), parameterCode: num(dc?.words || [], 3, 0) },
      };
    }
    default: {
      // 미지원 타입: DIFFRENI, DIFFREND, INTEGRAL, DIGITAL 등
      const dc = dataCards[0];
      return {
        variable: { variableName: str(dc?.words, 0), parameterCode: num(dc?.words || [], 1, 0) },
      };
    }
  }
}

/**
 * Thermal Properties → ThermalProperty[]
 * { materialNumber, name, materialType, conductivityFormat?, capacityFormat?, ... }
 */
function parseThermalProperties(cards: Card[]): any[] {
  const matMap = new Map<number, Card[]>();

  for (const card of cards) {
    const mmm = Math.floor((card.cardNumber - 20100000) / 100);
    if (!matMap.has(mmm)) matMap.set(mmm, []);
    matMap.get(mmm)!.push(card);
  }

  const result: any[] = [];
  for (const [mmm, matCards] of matMap) {
    const sorted = matCards.sort((a, b) => a.cardNumber - b.cardNumber);
    const header = sorted.find(c => c.cardNumber % 100 === 0);

    const materialType = header ? str(header.words, 0, 'C-STEEL').toUpperCase() : 'C-STEEL';
    const tp: any = {
      materialNumber: mmm,
      name: `material_${mmm}`,
      materialType,
    };

    // TBL/FCTN인 경우 추가 필드
    if (materialType === 'TBL/FCTN') {
      tp.conductivityFormat = header ? num(header.words, 1, 1) : 1;
      tp.capacityFormat = header ? num(header.words, 2, -1) : -1;

      // 데이터 카드 파싱: NN=01-49 conductivity, NN=51-99 capacity
      const dataPairs = sorted.filter(c => c.cardNumber % 100 !== 0);
      const condCards = dataPairs.filter(c => (c.cardNumber % 100) >= 1 && (c.cardNumber % 100) <= 49);
      const capCards = dataPairs.filter(c => (c.cardNumber % 100) >= 51 && (c.cardNumber % 100) <= 99);

      if (tp.conductivityFormat === 1) {
        // W2=1: Temperature-conductivity table
        tp.conductivityTable = [];
        for (const dc of condCards) {
          tp.conductivityTable.push({
            temperature: num(dc.words, 0),
            value: num(dc.words, 1),
          });
        }
      } else if (tp.conductivityFormat === 3) {
        // W2=3: Gap gas composition (Section 10.5)
        // NN=01-49: W1=gas name, W2=mole fraction
        tp.gapGasComposition = [];
        for (const dc of condCards) {
          tp.gapGasComposition.push({
            gasName: str(dc.words, 0).toUpperCase(),
            moleFraction: num(dc.words, 1),
          });
        }
      }

      // Capacity 카드 (NN=51-99) — W2=1, W2=3 모두 동일하게 처리
      if (tp.capacityFormat === 1 && capCards.length > 0) {
        // W3=1: 별도 temperature-capacity 테이블
        tp.capacityTable = [];
        for (const dc of capCards) {
          tp.capacityTable.push({
            temperature: num(dc.words, 0),
            value: num(dc.words, 1),
          });
        }
      } else if (tp.capacityFormat === -1 && capCards.length > 0) {
        // W3=-1: 값만 (temperature는 conductivity와 공유)
        tp.capacityValues = [];
        for (const dc of capCards) {
          tp.capacityValues.push(num(dc.words, 0));
        }
      }
    }

    result.push(tp);
  }

  return result;
}

/**
 * General Tables → GeneralTable[]
 * { tableNumber, name, type, tripNumber?, scaleX?, scaleY?, factor3?, dataPoints }
 */
function parseGeneralTables(cards: Card[]): any[] {
  const tblMap = new Map<number, Card[]>();

  for (const card of cards) {
    const ttt = Math.floor((card.cardNumber - 20200000) / 100);
    if (!tblMap.has(ttt)) tblMap.set(ttt, []);
    tblMap.get(ttt)!.push(card);
  }

  const result: any[] = [];
  for (const [ttt, tblCards] of tblMap) {
    const sorted = tblCards.sort((a, b) => a.cardNumber - b.cardNumber);
    const header = sorted.find(c => c.cardNumber % 100 === 0);
    const dataPairs = sorted.filter(c => c.cardNumber % 100 !== 0);

    const tbl: any = {
      tableNumber: ttt,
      name: header?.comment || `table_${ttt}`,
      type: header ? str(header.words, 0, 'POWER') : 'POWER',
      tripNumber: header && header.words.length > 1 ? num(header.words, 1) : undefined,
      scaleX: header && header.words.length > 2 ? num(header.words, 2, 1) : undefined,
      scaleY: header && header.words.length > 3 ? num(header.words, 3, 1) : undefined,
      factor3: header && header.words.length > 4 ? num(header.words, 4) : undefined,
      dataPoints: [] as any[],
    };

    // 데이터 카드: 각 카드에 x, y 쌍 (1~5개)
    // 원본 카드 번호(NN) 보존하여 라운드트립 시 동일한 번호 사용
    for (const dc of dataPairs) {
      const nn = dc.cardNumber % 100;
      for (let i = 0; i + 1 < dc.words.length; i += 2) {
        const x = toNumber(dc.words[i]);
        const y = toNumber(dc.words[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          tbl.dataPoints.push({ x, y, cardIndex: nn });
        }
      }
    }

    result.push(tbl);
  }

  return result;
}

/**
 * Reactor Kinetics → PointReactorKinetics
 * 30000XXX 카드를 PointReactorKinetics 구조로 변환
 */
function parseReactorKinetics(cards: Card[]): Record<string, any> {
  const sorted = cards.sort((a, b) => a.cardNumber - b.cardNumber);
  const cardMap = new Map<number, Card>();
  for (const c of sorted) {
    cardMap.set(c.cardNumber - 30000000, c);
  }

  const rk: any = {
    enabled: true,
    kineticsType: 'point',
    feedbackType: 'separabl',
    decayType: 'gamma-ac',
    power: 0,
    reactivity: 0,
    inverseLambda: 0,
    fpyf: 0,
    ansStandard: 'ans79-1',
    additionalDecayHeat: 0,
    moderatorDensityReactivity: [],
    dopplerReactivity: [],
    densityWeightingFactors: [],
    dopplerWeightingFactors: [],
  };

  // 30000000: 기본 설정
  const c0 = cardMap.get(0);
  if (c0) {
    rk.kineticsType = str(c0.words, 0, 'point');
    rk.feedbackType = str(c0.words, 1, 'separabl');
  }

  // 30000001: 중성자 물리 파라미터
  const c1 = cardMap.get(1);
  if (c1) {
    rk.decayType = str(c1.words, 0, 'gamma-ac');
    rk.power = num(c1.words, 1, 0);
    rk.reactivity = num(c1.words, 2, 0);
    rk.inverseLambda = num(c1.words, 3, 0);
    rk.fpyf = num(c1.words, 4, 0);
  }

  // 30000002: 붕괴열
  const c2 = cardMap.get(2);
  if (c2) {
    rk.ansStandard = str(c2.words, 0, 'ans79-1');
    rk.additionalDecayHeat = num(c2.words, 1, 0);
  }

  // 30000011-0020: 반응도 곡선/제어변수 참조 (Section 16.8.1)
  rk.reactivityCurveNumbers = [];
  for (let i = 11; i <= 20; i++) {
    const c = cardMap.get(i);
    if (c) {
      rk.reactivityCurveNumbers.push(num(c.words, 0, 0));
    }
  }
  // UI 하위호환: 첫 번째 값을 기존 단일 필드에도 저장
  if (rk.reactivityCurveNumbers.length > 0) {
    rk.externalReactivityTableNumber = rk.reactivityCurveNumbers[0];
  }

  // 3000050N: 감속재 밀도 반응도 (N=1~)
  for (const c of sorted) {
    const local = c.cardNumber - 30000000;
    // 30000101-0199: 지연중성자 상수 (Section 16.4)
    if (local >= 101 && local <= 199) {
      if (!rk.delayedNeutronConstants) rk.delayedNeutronConstants = [];
      rk.delayedNeutronConstants.push({
        yield: toNumber(c.words[0]),
        decayConstant: toNumber(c.words[1]),
      });
    }
    else if (local >= 501 && local <= 599) {
      for (let i = 0; i + 1 < c.words.length; i += 2) {
        rk.moderatorDensityReactivity.push({
          value: toNumber(c.words[i]),
          reactivity: toNumber(c.words[i + 1]),
        });
      }
    }
    // 3000060N: 도플러 반응도
    else if (local >= 601 && local <= 699) {
      for (let i = 0; i + 1 < c.words.length; i += 2) {
        rk.dopplerReactivity.push({
          value: toNumber(c.words[i]),
          reactivity: toNumber(c.words[i + 1]),
        });
      }
    }
    // 3000070N: 밀도 가중치 인수
    else if (local >= 701 && local <= 799) {
      for (let i = 0; i + 3 < c.words.length; i += 4) {
        rk.densityWeightingFactors.push({
          componentId: c.words[i],
          increment: toNumber(c.words[i + 1]),
          factor: toNumber(c.words[i + 2]),
          coefficient: toNumber(c.words[i + 3]),
        });
      }
    }
    // 3000080N: 도플러 가중치 인수
    else if (local >= 801 && local <= 899) {
      for (let i = 0; i + 3 < c.words.length; i += 4) {
        rk.dopplerWeightingFactors.push({
          componentId: c.words[i],
          increment: toNumber(c.words[i + 1]),
          factor: toNumber(c.words[i + 2]),
          coefficient: toNumber(c.words[i + 3]),
        });
      }
    }
  }

  return rk;
}
