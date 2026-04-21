/**
 * MARS Input File Generator
 * Generates .i files from ReactFlow nodes and edges
 */

import { Node, Edge } from 'reactflow';
import { MARSNodeData, MARSEdgeData, SnglvolParameters, SngljunParameters, PipeParameters, BranchParameters, SeparatorParameters, TmdpvolParameters, TmdpjunParameters, MtpljunParameters, PumpParameters, HeatStructureParameters, ValveParameters, TurbineParameters, TankParameters, isSnglvolParameters, isSngljunParameters, isPipeParameters, isBranchParameters, isSeparatorParameters, isTmdpvolParameters, isTmdpjunParameters, isMtpljunParameters, isPumpParameters, isHeatStructureParameters, isValveParameters, isTurbineParameters, isTankParameters, GlobalSettings, VolumeReference, InteractiveInput, ThermalProperty, ControlVariable, isConstantControlVariable, isNonConstantControlVariable, SumData, TripUnitData, MultData, DivData, SingleVariableData, FunctionData, StdFunctionData, DelayData, DigitalData, TripDelayData, PowerIData, PowerRData, PowerXData, PropIntData, LagData, LeadLagData, PumpctlData, SteamctlData, FeedctlData, ShaftData, GeneralTable, PointReactorKinetics } from '@/types/mars';
import { getDefaultGlobalSettings } from './globalSettingsValidation';
import { NodeIdResolver } from './nodeIdResolver';

export interface ComponentLineMapping {
  nodeId: string;
  componentId: string;
  componentName: string;
  componentType: string;
  startLine: number;
  endLine: number;
}

export interface GenerationResult {
  success: boolean;
  content?: string;
  filename?: string;
  errors?: string[];
  warnings?: string[];
  componentLineMappings?: ComponentLineMapping[];
}

export class MARSInputFileGenerator {
  private resolver: NodeIdResolver | null = null;
  // HTSTR multi-geometry BC card offset: key = componentId, value = { leftOffset, rightOffset }
  private htstrBcOffsets: Map<string, { leftOffset: number; rightOffset: number }> = new Map();

  constructor(nodes?: Node<MARSNodeData>[]) {
    if (nodes) {
      this.resolver = new NodeIdResolver(nodes);
    }
  }
  
  generate(nodes: Node<MARSNodeData>[], _edges: Edge<MARSEdgeData>[], projectName: string = 'Untitled', globalSettings?: GlobalSettings): GenerationResult {
    // Update resolver with current nodes
    this.resolver = new NodeIdResolver(nodes);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Use provided global settings or defaults
    const settings = globalSettings || getDefaultGlobalSettings();
    const isRestart = settings.card100?.problemType === 'restart';

    // Validate — RESTART는 컴포넌트를 출력하지 않으므로 nodes 검증 스킵
    if (!isRestart && nodes.length === 0) {
      errors.push('No components added. Add at least one component.');
      return { success: false, errors };
    }

    if (!isRestart) {
      // Check for incomplete nodes (경고로 분류 - 파일 생성은 허용)
      const incompleteNodes = nodes.filter(n => n.data.status !== 'valid');
      if (incompleteNodes.length > 0) {
        const names = incompleteNodes.map(n => n.data.componentName || n.data.componentId).join(', ');
        warnings.push(`${incompleteNodes.length}개 컴포넌트의 파라미터가 불완전합니다: ${names}`);
      }
    }
    
    // Generate cards
    const cards: string[] = [];
    
    // Add header (Title Card - MARS reads first line as title)
    cards.push(`= ${projectName}`);
    
    // Global control cards
    cards.push('*' + '='.repeat(79));
    cards.push('* GLOBAL CONTROL CARDS');
    cards.push('*' + '='.repeat(79));
    cards.push('*');
    cards.push(...this.generateGlobalCards(settings));
    cards.push('*');
    
    // Minor edits — 단축형 (301-399) + 확장형 (20800001+) 분리 출력
    if (settings?.minorEdits && settings.minorEdits.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* MINOR EDITS');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      const sortedEdits = [...settings.minorEdits].sort((a, b) => a.cardNumber - b.cardNumber);
      const shortEdits = sortedEdits.filter(e => e.cardNumber >= 301 && e.cardNumber <= 399);
      const extEdits = sortedEdits.filter(e => e.cardNumber >= 20800001);

      // 단축형 카드 (301-399)
      shortEdits.forEach(edit => {
        cards.push(this.formatMinorEditCard(edit));
      });

      // 확장형 카드 (20800001+) — skip in RESTART (already defined in rstplt)
      if (!isRestart && extEdits.length > 0) {
        cards.push('*');
        cards.push('* --- Extended Minor Edits (20800001+) ---');
        extEdits.forEach(edit => {
          cards.push(this.formatMinorEditCard(edit));
        });
      }
      cards.push('*');
    }
    
    // Variable trips (restart에서도 재정의 가능)
    if (settings?.variableTrips && settings.variableTrips.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* VARIABLE TRIPS');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      // Sort by card number
      const sortedTrips = [...settings.variableTrips].sort((a, b) => a.cardNumber - b.cardNumber);
      sortedTrips.forEach(trip => {
        // Format: cardNumber  leftVar  leftParam  relation  rightVar  rightParam  actionValue  latch  [timeout]  [comment]
        // W8 (timeout) is optional per MARS manual Section 5.3:
        //   - omitted → trip false, TIMEOF=-1.0
        //   - -1.0    → trip false, TIMEOF=-1.0 (same as omitted)
        //   - 0/positive → trip initialized as TRUE
        // W8 must be present if W9 (trip message) follows
        const cardNum = trip.cardNumber.toString();
        // Use space-separated fields to stay within 80-char MARS line buffer
        const leftVar = trip.leftVar;
        const leftParam = trip.leftParam.toString();
        const relation = trip.relation;
        const rightVar = trip.rightVar;
        const rightParam = trip.rightParam.toString();
        const actionValueStr = this.formatNumber(trip.actionValue).trim();
        const latch = trip.latch;

        const hasComment = !!trip.comment;
        // timeout이 파싱 데이터에 존재할 때만 출력 (comment 유무와 무관)
        const hasTimeout = trip.timeout !== undefined;

        // Use explicit space separators instead of padEnd to avoid field merging
        const fields = [cardNum, leftVar, leftParam, relation, rightVar, rightParam, actionValueStr, latch];
        let line = fields.join('  ');
        if (hasTimeout) {
          const timeout = this.formatNumber(trip.timeout).trim();
          line += `  ${timeout}`;
        }
        if (hasComment) {
          line += trip.isTripMessage ? `   "${trip.comment}"` : `   * ${trip.comment}`;
        }
        cards.push(line);
      });
      cards.push('*');
    }

    // Logic Trips (Cards 601-799) (restart에서도 재정의 가능)
    if (settings?.logicTrips && settings.logicTrips.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* LOGICAL TRIPS');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      // Sort by card number
      const sortedLogicTrips = [...settings.logicTrips]
        .filter(trip => !isNaN(trip.cardNumber) && !isNaN(trip.trip1) && !isNaN(trip.trip2))
        .sort((a, b) => a.cardNumber - b.cardNumber);
      sortedLogicTrips.forEach(trip => {
        // Format: CardNumber  Trip1  Operator  Trip2  Latch  [Timeof]  [TripMessage]
        // W5 (timeof) is optional per MARS manual Section 5.4:
        //   - omitted → trip false, TIMEOF=-1.0
        //   - -1.0    → trip false (same as omitted)
        //   - 0/positive → trip initialized as TRUE
        // W5 must be present if W6 (trip message) follows
        const cardNum = trip.cardNumber.toString();
        const trip1Str = trip.trip1.toString().padEnd(10);
        const operatorStr = trip.operator.padEnd(14);
        const trip2Str = trip.trip2.toString().padEnd(18);
        const latchStr = trip.latch.padEnd(3);

        const hasComment = !!trip.comment;
        // timeof가 파싱 데이터에 존재할 때만 출력 (comment 유무와 무관)
        const hasTimeof = trip.timeof !== undefined;

        let line = `${cardNum}   ${trip1Str}${operatorStr}${trip2Str}${latchStr}`;
        if (hasTimeof) {
          const timeofStr = this.formatNumber(trip.timeof).trim();
          line += `${timeofStr}`;
        }
        if (hasComment) {
          line += trip.isTripMessage ? `  "${trip.comment}"` : `  * ${trip.comment}`;
        }
        cards.push(line);
      });
      cards.push('*');
    }

    // General Tables (Cards 202TTTNN) (restart에서도 재정의 가능)
    if (settings?.generalTables && settings.generalTables.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* GENERAL TABLES (202TTTNN)');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      cards.push(...this.generateGeneralTableCards(settings.generalTables));
      cards.push('*');
    }

    // Control Variables (Cards 205CCCNN) (restart에서도 재정의 가능)
    if (settings?.controlVariables && settings.controlVariables.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* CONTROL SYSTEM (205CCCNN)');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      cards.push(...this.generateControlVariableCards(settings.controlVariables));
      cards.push('*');
    }

    // Interactive Inputs (Cards 801-999) — skip in RESTART (already defined in rstplt)
    if (!isRestart && settings?.interactiveInputs && settings.interactiveInputs.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* INTERACTIVE INPUTS');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      const sortedInputs = [...settings.interactiveInputs].sort((a, b) => a.cardNumber - b.cardNumber);
      sortedInputs.forEach(input => {
        cards.push(this.formatInteractiveInputCard(input));
      });
      cards.push('*');
    }

    // Thermal Properties (Cards 201MMMNN) (restart에서도 재정의 가능)
    if (settings?.thermalProperties && settings.thermalProperties.length > 0) {
      cards.push('*' + '='.repeat(79));
      cards.push('* HEAT STRUCTURE THERMAL PROPERTIES (201MMMNN)');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      cards.push(...this.generateThermalPropertyCards(settings.thermalProperties));
      cards.push('*');
    }

    // Point Reactor Kinetics (Cards 30000000 series) (restart에서도 재정의 가능)
    if (settings?.reactorKinetics?.enabled) {
      cards.push('*' + '='.repeat(79));
      cards.push('* POINT REACTOR KINETICS (30000000)');
      cards.push('*' + '='.repeat(79));
      cards.push('*');
      cards.push(...this.generateReactorKineticsCards(settings.reactorKinetics));
      cards.push('*');
    }

    // Hydrodynamic components — RESTART 시 컴포넌��� 카드 전체 생략 (B-1 설계: rstplt에서 로드)
    const componentLineMappings: ComponentLineMapping[] = [];
    if (!isRestart) {
      cards.push('*' + '='.repeat(79));
      cards.push('* HYDRODYNAMIC COMPONENTS');
      cards.push('*' + '='.repeat(79));
      cards.push('*');

      // Sort nodes by component ID
      const sortedNodes = [...nodes].sort((a, b) => {
        const idA = parseInt(a.data.componentId);
        const idB = parseInt(b.data.componentId);
        return idA - idB;
      });

      // HTSTR multi-geometry BC card offsets: always 0
      // Each geometry's boundary condition cards (05xx, 06xx) start from 01,
      // since the geometry digit (G) in card number 1CCCGXXX already
      // distinguishes geometries. No cumulative offset needed.
      this.htstrBcOffsets = new Map();

      // Generate component cards
      sortedNodes.forEach(node => {
        const startLine = cards.length;

        // Use short component ID (first 3 digits, CCC format) for header
        const shortId = node.data.componentId.slice(0, 3);
        const componentTitle = `C${shortId}: ${node.data.componentName}, ${node.data.componentType.toUpperCase()}`;
        const titlePadded = componentTitle.padEnd(78);

        cards.push('*' + '-'.repeat(79) + '*');
        cards.push(`* ${titlePadded} *`);
        cards.push('*' + '-'.repeat(79) + '*');
        cards.push('*');

        const componentCards = this.generateComponentCards(node);
        cards.push(...componentCards);

        componentLineMappings.push({
          nodeId: node.id,
          componentId: node.data.componentId,
          componentName: node.data.componentName || '',
          componentType: node.data.componentType,
          startLine,
          endLine: cards.length,
        });
      });
    }
    
    // End card
    cards.push('*');
    cards.push('.');
    
    const content = cards.join('\n');
    const filename = `${projectName.trim().replace(/\s+/g, '_')}.i`;
    
    return {
      success: errors.length === 0,
      content,
      filename,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      componentLineMappings: componentLineMappings.length > 0 ? componentLineMappings : undefined,
    };
  }
  
  /**
   * 단일 노드의 .i 카드 텍스트를 생성 (미리보기용)
   */
  generatePreview(node: Node<MARSNodeData>): string {
    const shortId = node.data.componentId.slice(0, 3);
    const componentTitle = `C${shortId}: ${node.data.componentName}, ${node.data.componentType.toUpperCase()}`;
    const titlePadded = componentTitle.padEnd(78);

    const lines: string[] = [];
    lines.push('*' + '-'.repeat(79) + '*');
    lines.push(`* ${titlePadded} *`);
    lines.push('*' + '-'.repeat(79) + '*');
    lines.push('*');
    lines.push(...this.generateComponentCards(node));
    return lines.join('\n');
  }

  private generateComponentCards(node: Node<MARSNodeData>): string[] {
    const { componentId, componentName, componentType, parameters } = node.data;
    const cards: string[] = [];
    
    switch (componentType) {
      case 'snglvol':
        if (isSnglvolParameters(parameters)) {
          cards.push(...this.generateSnglvolCards(componentId, componentName, parameters));
        }
        break;
      case 'sngljun':
        if (isSngljunParameters(parameters)) {
          cards.push(...this.generateSngljunCards(componentId, componentName, parameters));
        }
        break;
      case 'pipe':
        if (isPipeParameters(parameters)) {
          cards.push(...this.generatePipeCards(componentId, componentName, parameters));
        }
        break;
      case 'branch':
        if (isBranchParameters(parameters)) {
          cards.push(...this.generateBranchCards(componentId, componentName, parameters, componentType));
        }
        break;
      case 'separatr':
        if (isSeparatorParameters(parameters)) {
          cards.push(...this.generateSeparatorCards(componentId, componentName, parameters));
        }
        break;
      case 'tmdpvol':
        if (isTmdpvolParameters(parameters)) {
          cards.push(...this.generateTmdpvolCards(componentId, componentName, parameters));
        }
        break;
      case 'tmdpjun':
        if (isTmdpjunParameters(parameters)) {
          cards.push(...this.generateTmdpjunCards(componentId, componentName, parameters));
        }
        break;
      case 'mtpljun':
        if (isMtpljunParameters(parameters)) {
          cards.push(...this.generateMtpljunCards(componentId, componentName, parameters));
        }
        break;
      case 'pump':
        if (isPumpParameters(parameters)) {
          cards.push(...this.generatePumpCards(componentId, componentName, parameters));
        }
        break;
      case 'htstr':
        if (isHeatStructureParameters(parameters)) {
          cards.push(...this.generateHeatStructureCards(componentId, componentName, parameters));
        }
        break;
      case 'valve':
        if (isValveParameters(parameters)) {
          cards.push(...this.generateValveCards(componentId, componentName, parameters));
        }
        break;
      case 'turbine':
        if (isTurbineParameters(parameters)) {
          cards.push(...this.generateTurbineCards(componentId, componentName, parameters));
        }
        break;
      case 'tank':
        if (isTankParameters(parameters)) {
          cards.push(...this.generateTankCards(componentId, componentName, parameters));
        }
        break;
      default:
        cards.push(`${componentId}  ${componentName.padEnd(12)}  ${componentType}`);
        cards.push(`* TODO: Implement ${componentType} card generation`);
    }
    
    return cards;
  }
  
  private generateSnglvolCards(id: string, name: string, params: SnglvolParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);  // Use first 3 digits for 7-digit card numbers (e.g., 1000000 -> 100)
    
    // Component definition
    cards.push(`${id}  ${name.padEnd(12)}  snglvol`);
    
    // Card CCC0101: xArea, xLength, volume (3 words)
    const xArea = params.xArea !== undefined ? params.xArea : 0.0;
    const azAngle = params.azAngle !== undefined ? params.azAngle : 0.0;
    const wallRough = params.wallRoughness !== undefined ? params.wallRoughness : 3.048e-5;
    const flags = params.tlpvbfe || '0000000';
    cards.push(`${shortId}0101  ${this.formatNumber(xArea)}  ${this.formatNumber(params.xLength)}  ${this.formatNumber(params.volume)}`);

    // Card CCC0102: azAngle, incAngle, dz (3 words)
    cards.push(`${shortId}0102  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);

    // Card CCC0103: wallRoughness, hydraulicDiameter, controlFlags (3 words)
    cards.push(`${shortId}0103  ${this.formatNumber(wallRough)}  ${this.formatNumber(params.hydraulicDiameter)}  ${flags}`);
    
    // Initial conditions (Card 0200)
    // ebt t=1: [T, xs], t=2: [P, xs], t=3: [P, T]
    const ebt = params.ebt || '003';
    if (ebt === '001') {
      // t=1: Temperature & Quality
      const temp = params.temperature !== undefined ? params.temperature : 358.0;
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(temp)}  ${this.formatNumber(quality)}`);
    } else if (ebt === '002') {
      // t=2: Pressure & Quality
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(params.pressure)}  ${this.formatNumber(quality)}`);
    } else {
      // t=3: Pressure & Temperature
      const temp = params.temperature !== undefined ? params.temperature : 560.0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(params.pressure)}  ${this.formatNumber(temp)}`);
    }
    
    return cards;
  }
  
  private generateSngljunCards(id: string, name: string, params: Partial<SngljunParameters>): string[] {
    const cards: string[] = [];
    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }
    const shortId = id.slice(0, 3);
    
    // Component definition
    cards.push(`${id}  ${name.padEnd(12)}  sngljun`);
    
    // Connection (Card 0101)
    // Convert VolumeReference to VolumeId string
    const fromRef = params.from as VolumeReference | undefined;
    const toRef = params.to as VolumeReference | undefined;
    const from = fromRef ? this.resolver.getVolumeIdFromReference(fromRef) || '000000000' : '000000000';
    const to = toRef ? this.resolver.getVolumeIdFromReference(toRef) || '000000000' : '000000000';
    const area = params.area !== undefined ? params.area : 0.1;
    
    if (from === '000000000' || to === '000000000') {
      cards.push(`* WARNING: Junction not fully connected. Edit Volume IDs manually.`);
    }
    
    // Combined format: from, to, area, fwdLoss, revLoss, jefvcahs on one card
    const fwdLoss = params.fwdLoss !== undefined ? params.fwdLoss : 0.0;
    const revLoss = params.revLoss !== undefined ? params.revLoss : 0.0;
    const jefvcahs = params.jefvcahs || '00000000';
    cards.push(`${shortId}0101  ${from}  ${to}  ${this.formatNumber(area)}  ${this.formatNumber(fwdLoss)}  ${this.formatNumber(revLoss)}  ${jefvcahs}`);
    
    // Initial flow (Card 0201) - optional
    if (params.flowDirection !== undefined || params.mfl !== undefined || params.mfv !== undefined) {
      const flowDir = params.flowDirection !== undefined ? params.flowDirection : 1;
      const mfl = params.mfl !== undefined ? params.mfl : 0.0;
      const mfv = params.mfv !== undefined ? params.mfv : 0.0;
      cards.push(`${shortId}0201  ${flowDir}  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}  0.0`);
    }
    
    return cards;
  }
  
  /**
   * Generate TANK component cards (MARS 8.10)
   * Same as Branch + Tank-specific cards (CCC0400, CCC0401-0499)
   */
  private generateTankCards(id: string, name: string, params: TankParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);

    // Component definition (Card CCC0000)
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  tank`);

    // Number of junctions (Card CCC0001)
    cards.push(`*            njuns`);
    const initialControl = params.initialConditionControl !== undefined ? params.initialConditionControl : 0;
    cards.push(`${shortId}0001  ${params.njuns}${initialControl !== 0 ? `             ${initialControl}` : ''}`);

    // Card CCC0101: area, length, volume
    cards.push(`*            area          length         vol`);
    const area = params.area !== undefined ? params.area : 0.0;
    cards.push(`${shortId}0101  ${this.formatNumber(area)}  ${this.formatNumber(params.length)}  ${this.formatNumber(params.volume)}`);

    // Card CCC0102: az-angle, inc-angle, dz
    cards.push(`*            az-angle      inc-angle      dz`);
    const azAngle = params.azAngle !== undefined ? params.azAngle : 0.0;
    cards.push(`${shortId}0102  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);

    // Card CCC0103: x-wall, x-hd, flags
    cards.push(`*            x-wall        x-hd           flags`);
    const wallRough = params.wallRoughness !== undefined ? params.wallRoughness : 3.048e-5;
    const flags = params.tlpvbfe || '0000000';
    cards.push(`${shortId}0103  ${this.formatNumber(wallRough)}  ${this.formatNumber(params.hydraulicDiameter)}  ${flags}`);

    // Y-Coordinate Crossflow Volume Data (Card CCC0181) — optional
    if (params.yCrossflowData) {
      const y = params.yCrossflowData;
      cards.push(`*            y-area        y-length       y-rough        y-hd           y-flags        unused         unused         y-dz`);
      cards.push(`${shortId}0181  ${this.formatNumber(y.area)}  ${this.formatNumber(y.length)}  ${this.formatNumber(y.roughness)}  ${this.formatNumber(y.hydraulicDiameter)}  ${y.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(y.dz)}`);
    }

    // Z-Coordinate Crossflow Volume Data (Card CCC0191) — optional
    if (params.zCrossflowData) {
      const z = params.zCrossflowData;
      cards.push(`*            z-area        z-length       z-rough        z-hd           z-flags        unused         unused         z-dz`);
      cards.push(`${shortId}0191  ${this.formatNumber(z.area)}  ${this.formatNumber(z.length)}  ${this.formatNumber(z.roughness)}  ${this.formatNumber(z.hydraulicDiameter)}  ${z.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(z.dz)}`);
    }

    // Initial conditions (Card CCC0200)
    // ebt t=1: [T, xs], t=2: [P, xs], t=3: [P, T]
    const ebt = params.ebt || '003';
    const pressureStr = Math.abs(params.pressure) >= 1e6
      ? params.pressure.toExponential(6).trim().padEnd(12)
      : this.formatNumber(params.pressure);
    if (ebt === '001') {
      // t=1: Temperature & Quality
      cards.push(`*            ebt           temp           quality`);
      const temp = params.temperature !== undefined ? params.temperature : 358.0;
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(temp)}  ${this.formatNumber(quality)}`);
    } else if (ebt === '002') {
      // t=2: Pressure & Quality
      cards.push(`*            ebt           press          quality`);
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(quality)}`);
    } else {
      cards.push(`*            ebt           press          temp`);
      const temp = params.temperature !== undefined ? params.temperature : 594.05;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(temp)}`);
    }

    // Junctions (Cards CCCN101, CCCN102, CCCN103, CCCN201)
    const sortedJunctions = [...params.junctions].sort((a, b) => a.junctionNumber - b.junctionNumber);

    if (sortedJunctions.length > 0) {
      // Card CCCN101: Connection (from, to, area)
      cards.push(`*            from          to             area`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        let from = '000000000';
        let to = '000000000';
        if (!this.resolver) {
          throw new Error('Resolver not initialized. Call generate() first.');
        }
        if (junction.from?.nodeId) {
          const fromId = this.resolver.getVolumeIdFromReference(junction.from);
          if (fromId) from = fromId;
        }
        if (junction.to?.nodeId) {
          const toId = this.resolver.getVolumeIdFromReference(junction.to);
          if (toId) to = toId;
        }
        cards.push(`${cardBase}101  ${from}  ${to}  ${this.formatNumber(junction.area)}`);
      });

      // Card CCCN102: Loss coefficients
      cards.push(`*            fwd. loss     rev. loss      jefvcahs`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        const jefvcahs = junction.jefvcahs || '00000000';
        cards.push(`${cardBase}102  ${this.formatNumber(junction.fwdLoss)}  ${this.formatNumber(junction.revLoss)}  ${jefvcahs}`);
      });

      // Card CCCN103: Energy exchange
      cards.push(`*            discharge     thermal`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        const discharge = junction.dischargeCoefficient !== undefined ? junction.dischargeCoefficient : 1.0;
        const thermal = junction.thermalConstant !== undefined ? junction.thermalConstant : 0.14;
        cards.push(`${cardBase}103  ${this.formatNumber(discharge)}  ${this.formatNumber(thermal)}`);
      });

      // Card CCCN201: Initial flow
      cards.push(`*            mfl           mfv            unused`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        const mfl = junction.initialLiquidFlow !== undefined ? junction.initialLiquidFlow : 0.0;
        const mfv = junction.initialVaporFlow !== undefined ? junction.initialVaporFlow : 0.0;
        cards.push(`${cardBase}201  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}  0.0`);
      });
    }

    // ====== Tank-specific cards ======

    // Card CCC0400: Initial Liquid Level (required for Tank)
    cards.push(`*            initial liquid level`);
    cards.push(`${shortId}0400  ${this.formatNumber(params.initialLiquidLevel)}`);

    // Card CCC0401-0499: Volume vs Level Curve (required for Tank)
    if (params.volumeLevelCurve && params.volumeLevelCurve.length > 0) {
      cards.push(`*            volume        level`);
      params.volumeLevelCurve.forEach((pair, idx) => {
        const cardNum = String(401 + idx).padStart(4, '0');
        cards.push(`${shortId}${cardNum}  ${this.formatNumber(pair.volume)}  ${this.formatNumber(pair.level)}`);
      });
    }

    return cards;
  }

  private generateBranchCards(id: string, name: string, params: BranchParameters, typeName: string = 'branch'): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);  // Use first 3 digits (e.g., 1500000 -> 150)

    // Component definition (Card CCC0000)
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  ${typeName}`);
    
    // Number of junctions (Card CCC0001)
    cards.push(`*            njuns`);
    const initialControl = params.initialConditionControl !== undefined ? params.initialConditionControl : 0;
    cards.push(`${shortId}0001  ${params.njuns}${initialControl !== 0 ? `             ${initialControl}` : ''}`);
    
    // Card CCC0101: area, length, volume (3 fields)
    cards.push(`*            area          length         vol`);
    const area = params.area !== undefined ? params.area : 0.0;
    cards.push(`${shortId}0101  ${this.formatNumber(area)}  ${this.formatNumber(params.length)}  ${this.formatNumber(params.volume)}`);
    
    // Card CCC0102: az-angle, inc-angle, dz (3 fields)
    cards.push(`*            az-angle      inc-angle      dz`);
    const azAngle = params.azAngle !== undefined ? params.azAngle : 0.0;
    cards.push(`${shortId}0102  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);
    
    // Card CCC0103: x-wall, x-hd, flags (3 fields)
    cards.push(`*            x-wall        x-hd           flags`);
    const wallRough = params.wallRoughness !== undefined ? params.wallRoughness : 3.048e-5;
    const flags = params.tlpvbfe || '0000000';
    cards.push(`${shortId}0103  ${this.formatNumber(wallRough)}  ${this.formatNumber(params.hydraulicDiameter)}  ${flags}`);
    
    // Y-Coordinate Crossflow Volume Data (Card CCC0181) — optional
    if (params.yCrossflowData) {
      const y = params.yCrossflowData;
      cards.push(`*            y-area        y-length       y-rough        y-hd           y-flags        unused         unused         y-dz`);
      cards.push(`${shortId}0181  ${this.formatNumber(y.area)}  ${this.formatNumber(y.length)}  ${this.formatNumber(y.roughness)}  ${this.formatNumber(y.hydraulicDiameter)}  ${y.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(y.dz)}`);
    }

    // Z-Coordinate Crossflow Volume Data (Card CCC0191) — optional
    if (params.zCrossflowData) {
      const z = params.zCrossflowData;
      cards.push(`*            z-area        z-length       z-rough        z-hd           z-flags        unused         unused         z-dz`);
      cards.push(`${shortId}0191  ${this.formatNumber(z.area)}  ${this.formatNumber(z.length)}  ${this.formatNumber(z.roughness)}  ${this.formatNumber(z.hydraulicDiameter)}  ${z.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(z.dz)}`);
    }

    // Initial conditions (Card CCC0200)
    // ebt t=1: [T, xs], t=2: [P, xs], t=3: [P, T]
    const ebt = params.ebt || '003';
    // Format pressure with scientific notation for large values (>= 1e6)
    const pressureStr = Math.abs(params.pressure) >= 1e6
      ? params.pressure.toExponential(6).trim().padEnd(12)
      : this.formatNumber(params.pressure);
    if (ebt === '001') {
      // t=1: Temperature & Quality
      cards.push(`*            ebt           temp           quality`);
      const temp = params.temperature !== undefined ? params.temperature : 358.0;
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(temp)}  ${this.formatNumber(quality)}`);
    } else if (ebt === '002') {
      // t=2: Pressure & Quality
      cards.push(`*            ebt           press          quality`);
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(quality)}`);
    } else {
      cards.push(`*            ebt           press          temp`);
      const temp = params.temperature !== undefined ? params.temperature : 594.05;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(temp)}`);
    }

    // Junctions (Cards CCCN101-N109, CCCN102-N109, CCCN103-N109, CCCN201-N209)
    // Sort junctions by junction number
    const sortedJunctions = [...params.junctions].sort((a, b) => a.junctionNumber - b.junctionNumber);
    
    // Card CCCN101: Connection (from, to, area) - Header once, then all junctions
    cards.push(`*            from          to             area`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;
      
      // Convert VolumeReference to VolumeId strings (handle both VolumeReference and legacy string format)
      let from = '000000000';
      let to = '000000000';
      
      if (!this.resolver) {
        throw new Error('Resolver not initialized. Call generate() first.');
      }
      
      // Convert VolumeReference → 9-digit Volume ID
      if (junction.from?.nodeId) {
        const fromId = this.resolver.getVolumeIdFromReference(junction.from);
        if (fromId) from = fromId;
      }
      if (junction.to?.nodeId) {
        const toId = this.resolver.getVolumeIdFromReference(junction.to);
        if (toId) to = toId;
      }
      
      cards.push(`${cardBase}101  ${from}  ${to}  ${this.formatNumber(junction.area)}`);
    });
    
    // Card CCCN102: Loss coefficients (fwdLoss, revLoss, jefvcahs) - Header once, then all junctions
    cards.push(`*            fwd. loss     rev. loss      jefvcahs`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;
      const jefvcahs = junction.jefvcahs || '00000000';
      cards.push(`${cardBase}102  ${this.formatNumber(junction.fwdLoss)}  ${this.formatNumber(junction.revLoss)}  ${jefvcahs}`);
    });
    
    // Card CCCN103: Energy exchange (dischargeCoefficient, thermalConstant) - Header once, then all junctions
    cards.push(`*            discharge     thermal`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;
      const discharge = junction.dischargeCoefficient !== undefined ? junction.dischargeCoefficient : 1.0;
      const thermal = junction.thermalConstant !== undefined ? junction.thermalConstant : 0.14;
      cards.push(`${cardBase}103  ${this.formatNumber(discharge)}  ${this.formatNumber(thermal)}`);
    });

    // Card CCCN110: Junction Diameter and CCFL Data (optional)
    // Output when any junction has CCFL data (junctionDiameter, ccflBeta, ccflGasIntercept, ccflSlope)
    const hasAnyCcfl = sortedJunctions.some(j =>
      j.junctionDiameter !== undefined || j.ccflBeta !== undefined ||
      j.ccflGasIntercept !== undefined || j.ccflSlope !== undefined
    );
    if (hasAnyCcfl) {
      cards.push(`*            dhyd          beta           c              m`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        const dhyd = junction.junctionDiameter ?? 0.0;
        const beta = junction.ccflBeta ?? 0.0;
        const gasInt = junction.ccflGasIntercept ?? 1.0;
        const slope = junction.ccflSlope ?? 1.0;
        cards.push(`${cardBase}110  ${this.formatNumber(dhyd)}  ${this.formatNumber(beta)}  ${this.formatNumber(gasInt)}  ${this.formatNumber(slope)}`);
      });
    }

    // Card CCCN201: Initial flow (initialLiquidFlow, initialVaporFlow) - Header once, then all junctions
    cards.push(`*            mfl           mfv            unused`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;
      const mfl = junction.initialLiquidFlow !== undefined ? junction.initialLiquidFlow : 0.0;
      const mfv = junction.initialVaporFlow !== undefined ? junction.initialVaporFlow : 0.0;
      cards.push(`${cardBase}201  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}  0.0`);
    });

    return cards;
  }

  private generateSeparatorCards(id: string, name: string, params: SeparatorParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);

    // Card CCC0000: Component definition
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  separatr`);

    // Card CCC0001: nj=3 (fixed), initialConditionControl
    cards.push(`*            njuns`);
    const initialControl = params.initialConditionControl ?? 0;
    cards.push(`${shortId}0001  3${initialControl !== 0 ? `             ${initialControl}` : ''}`);

    // Card CCC0002: Separator Options (ISEPST)
    if (params.separatorOption !== undefined && params.separatorOption !== 0) {
      cards.push(`*            isepst        numsep`);
      const numSep = params.numSeparatorComponents ?? '';
      cards.push(`${shortId}0002  ${params.separatorOption}${numSep ? `             ${numSep}` : ''}`);
    }

    // Card CCC0101: area, length, volume, azAngle, incAngle, dz (6 words)
    cards.push(`*            area          length         vol            az-angle      inc-angle      dz`);
    const area = params.area ?? 0.0;
    const azAngle = params.azAngle ?? 0.0;
    cards.push(`${shortId}0101  ${this.formatNumber(area)}  ${this.formatNumber(params.length)}  ${this.formatNumber(params.volume)}  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);

    // Card CCC0102: wall roughness, hydraulic diameter, volume control flags (3 words)
    cards.push(`*            x-wall        x-hd           flags`);
    const wallRough = params.wallRoughness ?? 3.048e-5;
    const volFlags = params.volumeControlFlags || '0';
    cards.push(`${shortId}0102  ${this.formatNumber(wallRough)}  ${this.formatNumber(params.hydraulicDiameter)}  ${volFlags}`);

    // Card CCC0200: Initial conditions (same format as Branch)
    // ebt t=1: [T, xs], t=2: [P, xs], t=3: [P, T]
    const ebt = params.ebt || '003';
    const pressureStr = Math.abs(params.pressure) >= 1e6
      ? params.pressure.toExponential(6).trim().padEnd(12)
      : this.formatNumber(params.pressure);
    if (ebt === '001') {
      // t=1: Temperature & Quality
      cards.push(`*            ebt           temp           quality`);
      const temp = params.temperature !== undefined ? params.temperature : 358.0;
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${this.formatNumber(temp)}  ${this.formatNumber(quality)}`);
    } else if (ebt === '002') {
      // t=2: Pressure & Quality
      cards.push(`*            ebt           press          quality`);
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(quality)}`);
    } else {
      cards.push(`*            ebt           press          temp`);
      const temp = params.temperature ?? 558.0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(temp)}`);
    }

    // Junctions (N=1,2,3 fixed)
    const sortedJunctions = [...params.junctions].sort((a, b) => a.junctionNumber - b.junctionNumber);

    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }

    // Card CCCN101: Connection (from, to, area, fwdLoss, revLoss, juncFlags, voidFractionLimit)
    cards.push(`*            from          to             area           fwd.loss       rev.loss       jefvcahs       vover/vunder`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;

      let from = '000000000';
      let to = '000000000';
      if (junction.from?.nodeId) {
        const fromId = this.resolver!.getVolumeIdFromReference(junction.from);
        if (fromId) from = fromId;
      }
      if (junction.to?.nodeId) {
        const toId = this.resolver!.getVolumeIdFromReference(junction.to);
        if (toId) to = toId;
      }

      const jefvcahsRaw = junction.jefvcahs || '00000000';
      // Convert to integer then pad to 6 digits to match reference .i format (00001000 → 001000)
      const jefvcahs = String(parseInt(jefvcahsRaw, 10)).padStart(6, '0');
      // W7: voidFractionLimit — only for N=1 (VOVER) and N=2 (VUNDER)
      const vfl = junction.voidFractionLimit;
      const vflStr = (N === 1 || N === 2) && vfl !== undefined ? `  ${this.formatNumber(vfl)}` : '';

      cards.push(`${cardBase}101  ${from}  ${to}  ${this.formatNumber(junction.area)}  ${this.formatNumber(junction.fwdLoss)}  ${this.formatNumber(junction.revLoss)}  ${jefvcahs}${vflStr}`);
    });

    // Card CCCN110: Junction Diameter and CCFL Data (optional)
    const hasAnyCcfl = sortedJunctions.some(j =>
      j.junctionDiameter !== undefined || j.ccflBeta !== undefined ||
      j.ccflGasIntercept !== undefined || j.ccflSlope !== undefined
    );
    if (hasAnyCcfl) {
      cards.push(`*            dhyd          beta           c              m`);
      sortedJunctions.forEach(junction => {
        const N = junction.junctionNumber;
        const cardBase = `${shortId}${N}`;
        const dhyd = junction.junctionDiameter ?? 0.0;
        const beta = junction.ccflBeta ?? 0.0;
        const gasInt = junction.ccflGasIntercept ?? 1.0;
        const slope = junction.ccflSlope ?? 1.0;
        cards.push(`${cardBase}110  ${this.formatNumber(dhyd)}  ${this.formatNumber(beta)}  ${this.formatNumber(gasInt)}  ${this.formatNumber(slope)}`);
      });
    }

    // Card CCCN201: Initial flow
    cards.push(`*            mfl           mfv            unused`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const cardBase = `${shortId}${N}`;
      const mfl = junction.initialLiquidFlow ?? 0.0;
      const mfv = junction.initialVaporFlow ?? 0.0;
      cards.push(`${cardBase}201  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}  0.0`);
    });

    return cards;
  }

  private generatePipeCards(id: string, name: string, params: PipeParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);  // Use first 3 digits for 7-digit card numbers (e.g., 1200000 -> 120)
    
    // Component definition
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  pipe`);
    
    // Number of volumes (Card 0001)
    cards.push(`*            ncells`);
    cards.push(`${shortId}0001  ${params.ncells}`);
    
    // X-Area for volumes (Cards CCC0101-0199) - Sequential Expansion Format
    // Note: 0 values are kept as-is (MARS will auto-calculate internally)
    cards.push(`*            x-area        volid`);
    const areaRows = this.compressToSequentialExpansion(params.xArea);
    areaRows.forEach((row, idx) => {
      const cardNum = (idx + 1).toString().padStart(2, '0');
      cards.push(`${shortId}01${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
    });
    
    // Junction area (Card CCC0201) - Always output (0.0 = MARS auto-calculates from adjacent volumes)
    cards.push(`*            j-area        jun num`);
    if (params.junctionArea !== undefined) {
      if (Array.isArray(params.junctionArea)) {
        // Array: per-junction values using Sequential Expansion Format
        const areaRows = this.compressToSequentialExpansion(params.junctionArea);
        areaRows.forEach((row, idx) => {
          const cardNum = (idx + 1).toString().padStart(2, '0');
          cards.push(`${shortId}02${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
        });
      } else {
        // Single value: apply to all junctions
        cards.push(`${shortId}0201  ${this.formatNumber(params.junctionArea)}  ${params.ncells - 1}`);
      }
    } else {
      // Default: 0.0 for all junctions (MARS auto-calculates)
      cards.push(`${shortId}0201  ${this.formatNumber(0.0)}  ${params.ncells - 1}`);
    }
    
    // X-Length (Cards CCC0301-0399) - Sequential Expansion Format
    cards.push(`*            x-length      volid`);
    const lengthRows = this.compressToSequentialExpansion(params.xLength);
    lengthRows.forEach((row, idx) => {
      const cardNum = (idx + 1).toString().padStart(2, '0');
      cards.push(`${shortId}03${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
    });
    
    // Volume (Cards CCC0401-0499) - Sequential Expansion Format
    cards.push(`*            volume        volid`);
    const volumeRows = this.compressToSequentialExpansion(params.volume);
    volumeRows.forEach((row, idx) => {
      const cardNum = (idx + 1).toString().padStart(2, '0');
      cards.push(`${shortId}04${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
    });
    
    // Azimuthal angle (Card CCC0501) - Optional, single value or array
    cards.push(`*            azim-angle    volid`);
    if (params.azAngle === undefined) {
      // Default: 0.0 for all cells
      cards.push(`${shortId}0501  ${this.formatNumber(0.0)}  ${params.ncells}`);
    } else if (typeof params.azAngle === 'number') {
      // Single value: apply to all cells
      cards.push(`${shortId}0501  ${this.formatNumber(params.azAngle)}  ${params.ncells}`);
    } else {
      // Array: per-cell values using Sequential Expansion Format
      const azRows = this.compressToSequentialExpansion(params.azAngle);
      azRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}05${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
      });
    }
    
    // Vertical angle (Card CCC0601) - Required, single value or array
    cards.push(`*            vert-angle    volid`);
    if (typeof params.vertAngle === 'number') {
      // Single value: apply to all cells
      cards.push(`${shortId}0601  ${this.formatNumber(params.vertAngle)}  ${params.ncells}`);
    } else {
      // Array: per-cell values using Sequential Expansion Format
      const vertRows = this.compressToSequentialExpansion(params.vertAngle);
      vertRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}06${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
      });
    }
    
    // Elevation (Card CCC0701) - Optional
    // Only output if xElev is explicitly provided by user (not undefined/empty)
    if (params.xElev && params.xElev.length > 0) {
      cards.push(`*            x-elev        volid`);
      const elevRows = this.compressToSequentialExpansion(params.xElev);
      elevRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}07${cardNum}  ${this.formatNumber(row.value)}  ${row.endCell}`);
      });
    }
    // If xElev is not provided, skip the elevation cards entirely (MARS will use default calculation)
    
    // Wall properties (Card CCC0801) - Required
    cards.push(`*            x-wall        xhd            volid`);
    
    // Check if wallRoughness or hydraulicDiameter are arrays
    const wallRoughArray = Array.isArray(params.wallRoughness);
    const hydDiamArray = Array.isArray(params.hydraulicDiameter);
    
    if (wallRoughArray || hydDiamArray) {
      // At least one is an array - expand both to full arrays
      const wallRough = wallRoughArray 
        ? params.wallRoughness as number[]
        : Array(params.ncells).fill(params.wallRoughness !== undefined ? params.wallRoughness : 3.048e-5);
      const hydDiam = hydDiamArray
        ? params.hydraulicDiameter as number[]
        : Array(params.ncells).fill(params.hydraulicDiameter);
      
      // Compress into rows with (wallRoughness, hydraulicDiameter, endCell) format
      const wallRows: { wallRough: number; hydDiam: number; endCell: number }[] = [];
      let currentWallRough = wallRough[0];
      let currentHydDiam = hydDiam[0];
      
      for (let i = 1; i <= params.ncells; i++) {
        const isLast = i === params.ncells;
        const valueChanged = !isLast && (wallRough[i] !== currentWallRough || hydDiam[i] !== currentHydDiam);
        
        if (valueChanged || isLast) {
          wallRows.push({
            wallRough: currentWallRough,
            hydDiam: currentHydDiam,
            endCell: i
          });
          
          if (!isLast) {
            currentWallRough = wallRough[i];
            currentHydDiam = hydDiam[i];
          }
        }
      }
      
      // Write each row as a separate card
      wallRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}08${cardNum}  ${this.formatNumber(row.wallRough)}  ${this.formatNumber(row.hydDiam)}  ${row.endCell}`);
      });
    } else {
      // Single values for both (both are numbers, not arrays, since we're in else branch)
      const wallRough = params.wallRoughness !== undefined 
        ? (typeof params.wallRoughness === 'number' ? params.wallRoughness : 3.048e-5)
        : 3.048e-5;
      // In else branch, hydraulicDiameter is guaranteed to be a number (not array)
      const hydDiam = typeof params.hydraulicDiameter === 'number' 
        ? params.hydraulicDiameter 
        : (Array.isArray(params.hydraulicDiameter) && params.hydraulicDiameter.length > 0 ? params.hydraulicDiameter[0] : 0.1);
      cards.push(`${shortId}0801  ${this.formatNumber(wallRough)}  ${this.formatNumber(hydDiam)}  ${params.ncells}`);
    }
    
    // Loss coefficients (Card CCC0901) - Optional
    if (params.fwdLoss !== undefined || params.revLoss !== undefined) {
      cards.push(`*            fwd. loss     rev. loss      junid`);
      
      const fwdArray = Array.isArray(params.fwdLoss);
      const revArray = Array.isArray(params.revLoss);
      
      if (fwdArray || revArray) {
        // At least one is an array - expand both to full arrays
        const numJunctions = params.ncells - 1;
        const fwd = fwdArray 
          ? params.fwdLoss as number[]
          : Array(numJunctions).fill(params.fwdLoss !== undefined ? params.fwdLoss : 0.0);
        const rev = revArray
          ? params.revLoss as number[]
          : Array(numJunctions).fill(params.revLoss !== undefined ? params.revLoss : 0.0);
        
        // Compress into rows
        const lossRows: { fwd: number; rev: number; endJun: number }[] = [];
        let currentFwd = fwd[0];
        let currentRev = rev[0];
        
        for (let i = 1; i <= numJunctions; i++) {
          const isLast = i === numJunctions;
          const valueChanged = !isLast && (fwd[i] !== currentFwd || rev[i] !== currentRev);
          
          if (valueChanged || isLast) {
            lossRows.push({
              fwd: currentFwd,
              rev: currentRev,
              endJun: i
            });
            
            if (!isLast) {
              currentFwd = fwd[i];
              currentRev = rev[i];
            }
          }
        }
        
        // Write each row as a separate card
        lossRows.forEach((row, idx) => {
          const cardNum = (idx + 1).toString().padStart(2, '0');
          cards.push(`${shortId}09${cardNum}  ${this.formatNumber(row.fwd)}  ${this.formatNumber(row.rev)}  ${row.endJun}`);
        });
      } else {
        // Single values
        const fwd = params.fwdLoss !== undefined 
          ? (typeof params.fwdLoss === 'number' ? params.fwdLoss : params.fwdLoss[0])
          : 0.0;
        const rev = params.revLoss !== undefined 
          ? (typeof params.revLoss === 'number' ? params.revLoss : params.revLoss[0])
          : 0.0;
        cards.push(`${shortId}0901  ${this.formatNumber(fwd)}  ${this.formatNumber(rev)}  ${params.ncells - 1}`);
      }
    }
    
    // Volume flags (Card CCC1001) - Optional
    if (params.volumeFlags) {
      cards.push(`*            x-flags       volid`);
      
      if (Array.isArray(params.volumeFlags)) {
        // Array: per-cell values using Sequential Expansion Format
        const flagRows: { value: string; endCell: number }[] = [];
        let currentValue = params.volumeFlags[0];
        
        for (let i = 1; i <= params.ncells; i++) {
          const isLast = i === params.ncells;
          const valueChanged = !isLast && params.volumeFlags[i] !== currentValue;
          
          if (valueChanged || isLast) {
            flagRows.push({
              value: currentValue,
              endCell: i
            });
            
            if (!isLast) {
              currentValue = params.volumeFlags[i];
            }
          }
        }
        
        // Write each row as a separate card
        flagRows.forEach((row, idx) => {
          const cardNum = (idx + 1).toString().padStart(2, '0');
          cards.push(`${shortId}10${cardNum}  ${row.value}       ${row.endCell}`);
        });
      } else {
        // Single value: apply to all cells
        cards.push(`${shortId}1001  ${params.volumeFlags}       ${params.ncells}`);
      }
    }
    
    // Junction flags (Card CCC1101) - Optional
    if (params.junctionFlags) {
      cards.push(`*            jefvcahs      jun num`);
      
      if (Array.isArray(params.junctionFlags)) {
        // Array: per-junction values using Sequential Expansion Format
        const numJunctions = params.ncells - 1;
        const flagRows: { value: string; endJun: number }[] = [];
        let currentValue = params.junctionFlags[0];
        
        for (let i = 1; i <= numJunctions; i++) {
          const isLast = i === numJunctions;
          const valueChanged = !isLast && params.junctionFlags[i] !== currentValue;
          
          if (valueChanged || isLast) {
            flagRows.push({
              value: currentValue,
              endJun: i
            });
            
            if (!isLast) {
              currentValue = params.junctionFlags[i];
            }
          }
        }
        
        // Write each row as a separate card
        flagRows.forEach((row, idx) => {
          const cardNum = (idx + 1).toString().padStart(2, '0');
          cards.push(`${shortId}11${cardNum}  ${row.value}      ${row.endJun}`);
        });
      } else {
        // Single value: apply to all junctions
        cards.push(`${shortId}1101  ${params.junctionFlags}      ${params.ncells - 1}`);
      }
    }
    
    // Initial conditions (Cards CCC1201-12XX) - Sequential Expansion Format
    // Compress consecutive cells with identical (ebt, pressure, temperature/quality)
    // Note: EBT 002 uses quality (xs) instead of temperature
    const hasQuality = params.initialConditions.some(ic => ic.ebt === '002');
    const headerLabel = hasQuality ? 'xs' : 'temp';
    cards.push(`*            ebt           press          ${headerLabel}      none  none  none  id`);

    {
      // Build compressed rows for initial conditions
      type ICRow = { ebt: string; pressure: number; thirdValue: number; endCell: number };
      const icRows: ICRow[] = [];

      const getThirdValue = (ic: typeof params.initialConditions[0]) => {
        const ebt = ic.ebt || '003';
        return ebt === '002'
          ? (ic.quality !== undefined ? ic.quality : 0.0)
          : (ic.temperature !== undefined ? ic.temperature : 560.0);
      };

      let curEbt = params.initialConditions[0].ebt || '003';
      let curPressure = params.initialConditions[0].pressure;
      let curThird = getThirdValue(params.initialConditions[0]);

      for (let i = 0; i < params.initialConditions.length; i++) {
        const isLast = i === params.initialConditions.length - 1;
        const valueChanged = !isLast && (
          (params.initialConditions[i + 1].ebt || '003') !== curEbt ||
          params.initialConditions[i + 1].pressure !== curPressure ||
          getThirdValue(params.initialConditions[i + 1]) !== curThird
        );

        if (valueChanged || isLast) {
          icRows.push({ ebt: curEbt, pressure: curPressure, thirdValue: curThird, endCell: i + 1 });
          if (!isLast) {
            curEbt = params.initialConditions[i + 1].ebt || '003';
            curPressure = params.initialConditions[i + 1].pressure;
            curThird = getThirdValue(params.initialConditions[i + 1]);
          }
        }
      }

      icRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}12${cardNum}  ${row.ebt}           ${this.formatNumber(row.pressure)}  ${this.formatNumber(row.thirdValue)}  0.0   0.0   0.0  ${row.endCell}`);
      });
    }
    
    // Junction Initial Conditions (Cards CCC1300-13XX) - Optional
    if (params.junctionControl && params.junctionControl.conditions && params.junctionControl.conditions.length > 0) {
      // Card CCC1300: Control word (0=velocity, 1=mass flow)
      cards.push(`*            jun control`);
      cards.push(`${shortId}1300  ${params.junctionControl.controlWord}`);
      
      // Cards CCC1301-13XX: Junction initial conditions
      // Compress consecutive identical values to Sequential Expansion Format
      const controlWord = params.junctionControl.controlWord;
      const label = controlWord === 0 ? 'velocity' : 'mass flow';
      cards.push(`*            liq-${label}   vap-${label}    intf-vel  junid`);
      
      const conditions = params.junctionControl.conditions;
      const compressedRows: Array<{ 
        w1: number; 
        w2: number; 
        w3: number; 
        endJun: number 
      }> = [];
      
      let currentW1 = conditions[0].liquidVelOrFlow;
      let currentW2 = conditions[0].vaporVelOrFlow;
      let currentW3 = conditions[0].interfaceVel;
      
      for (let i = 0; i < conditions.length; i++) {
        const isLast = i === conditions.length - 1;
        const valueChanged = !isLast && (
          conditions[i + 1].liquidVelOrFlow !== currentW1 ||
          conditions[i + 1].vaporVelOrFlow !== currentW2 ||
          conditions[i + 1].interfaceVel !== currentW3
        );
        
        if (valueChanged || isLast) {
          compressedRows.push({
            w1: currentW1,
            w2: currentW2,
            w3: currentW3,
            endJun: i + 1
          });
          
          if (!isLast) {
            currentW1 = conditions[i + 1].liquidVelOrFlow;
            currentW2 = conditions[i + 1].vaporVelOrFlow;
            currentW3 = conditions[i + 1].interfaceVel;
          }
        }
      }
      
      // Write compressed rows
      compressedRows.forEach((row, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        cards.push(`${shortId}13${cardNum}  ${this.formatNumber(row.w1)}  ${this.formatNumber(row.w2)}  ${this.formatNumber(row.w3)}  ${row.endJun}`);
      });
    }

    // Junction Diameter and CCFL Data (Cards CCC1401-14XX)
    // Only output when user has provided CCFL data (MARS uses internal defaults when absent)
    if (params.ccflData) {
      const numJunctions = params.ncells - 1;
      cards.push(`*CCFL        jdh            b              c              m      jun num`);

      {
        // User-provided CCFL data
        const jdh = Array.isArray(params.ccflData.junctionDiameter)
          ? params.ccflData.junctionDiameter
          : Array(numJunctions).fill(params.ccflData.junctionDiameter);
        const beta = Array.isArray(params.ccflData.beta)
          ? params.ccflData.beta
          : Array(numJunctions).fill(params.ccflData.beta);
        const gasInt = Array.isArray(params.ccflData.gasIntercept)
          ? params.ccflData.gasIntercept
          : Array(numJunctions).fill(params.ccflData.gasIntercept);
        const slope = Array.isArray(params.ccflData.slope)
          ? params.ccflData.slope
          : Array(numJunctions).fill(params.ccflData.slope);

        // Compress consecutive identical groups
        type CCFLRow = { jdh: number; beta: number; c: number; m: number; endJun: number };
        const ccflRows: CCFLRow[] = [];
        let curJdh = jdh[0], curBeta = beta[0], curC = gasInt[0], curM = slope[0];

        for (let i = 0; i < numJunctions; i++) {
          const isLast = i === numJunctions - 1;
          const valueChanged = !isLast && (
            jdh[i + 1] !== curJdh || beta[i + 1] !== curBeta ||
            gasInt[i + 1] !== curC || slope[i + 1] !== curM
          );

          if (valueChanged || isLast) {
            ccflRows.push({ jdh: curJdh, beta: curBeta, c: curC, m: curM, endJun: i + 1 });
            if (!isLast) {
              curJdh = jdh[i + 1]; curBeta = beta[i + 1];
              curC = gasInt[i + 1]; curM = slope[i + 1];
            }
          }
        }

        ccflRows.forEach((row, idx) => {
          const cardNum = (idx + 1).toString().padStart(2, '0');
          cards.push(`${shortId}14${cardNum}  ${this.formatNumber(row.jdh)}  ${this.formatNumber(row.beta)}  ${this.formatNumber(row.c)}  ${this.formatNumber(row.m)}  ${row.endJun}`);
        });
      }
    }

    return cards;
  }
  
  /**
   * Compress array to Sequential Expansion Format
   * Groups consecutive identical values and returns [value, endCell] pairs
   */
  private compressToSequentialExpansion(values: number[]): Array<{ value: number; endCell: number }> {
    if (values.length === 0) return [];
    
    const result: Array<{ value: number; endCell: number }> = [];
    let currentValue = values[0];
    
    for (let i = 1; i <= values.length; i++) {
      const nextValue = i < values.length ? values[i] : undefined;
      
      if (nextValue === undefined || nextValue !== currentValue) {
        // End of current group
        result.push({
          value: currentValue,
          endCell: i, // Cell number (1-based)
        });
        
        if (nextValue !== undefined) {
          currentValue = nextValue;
        }
      }
    }
    
    return result;
  }
  
  private generateTmdpvolCards(id: string, name: string, params: TmdpvolParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);  // Use first 3 digits for 7-digit card numbers
    
    // Component definition
    cards.push('*                name          type');
    cards.push(`${id}  ${name.padEnd(14)}  tmdpvol`);
    
    // Card CCC0101: area, length, volume, azAngle, incAngle, dz (6 words)
    const area = params.area !== undefined ? params.area : 0.0;
    const length = params.length !== undefined ? params.length : 1.0;
    const azAngle = params.azAngle !== undefined ? params.azAngle : 0.0;
    cards.push(`${shortId}0101  ${this.formatNumber(area)}  ${this.formatNumber(length)}  ${this.formatNumber(params.volume)}  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);

    // Card CCC0102: wallRoughness, hydraulicDiameter, flags (3 words)
    const wallRough = params.wallRoughness !== undefined ? params.wallRoughness : 0.0;
    const hydDiam = params.hydraulicDiameter !== undefined ? params.hydraulicDiameter : 0.0;
    const flags = params.tlpvbfe || '0000000';
    cards.push(`${shortId}0102  ${this.formatNumber(wallRough)}  ${this.formatNumber(hydDiam)}  ${flags}`);
    
    // Boundary condition type (Card 0200) - εbt format with optional trip and variable
    let card0200Header = '*               cword';
    let card0200 = `${shortId}0200  ${params.conditionType.padStart(14)}`;
    
    // Optional: Trip number (W2) or non-time search variable (W3)
    const varType = params.variableType || 'time';
    if ((params.tripNumber !== undefined && params.tripNumber !== 0) || varType !== 'time') {
      card0200Header = '*               cword          trip         a_var     n_var';
      const trip = params.tripNumber !== undefined ? params.tripNumber : 0;
      const varCode = params.variableCode !== undefined ? params.variableCode : 0;
      card0200 = `${shortId}0200  ${params.conditionType.padStart(14)}${trip.toString().padStart(14)}${varType.padStart(14)}${varCode.toString().padStart(10)}`;
    }
    
    cards.push(card0200Header);
    cards.push(card0200);
    
    // Parse εbt format to determine output format
    const ebt = params.conditionType;
    const thermoOption = parseInt(ebt[2]); // t = thermodynamic option (0-8)
    const boronFlag = parseInt(ebt[1]) === 1; // b = boron flag
    
    // Get comment for time table header based on thermodynamic option
    const getTimeTableHeader = (): string => {
      const searchVar = 'srch';
      switch (thermoOption) {
        case 0: 
          return boronFlag 
            ? `*                ${searchVar}         press       Uf          Ug          αg          boron`
            : `*                ${searchVar}         press       Uf          Ug          αg`;
        case 1: 
          return boronFlag
            ? `*                ${searchVar}          temp       quality       boron`
            : `*                ${searchVar}          temp       quality`;
        case 2: 
          return boronFlag
            ? `*                ${searchVar}         press       quality       boron`
            : `*                ${searchVar}         press       quality`;
        case 3: 
          return boronFlag
            ? `*                ${searchVar}         press          temp       boron`
            : `*                ${searchVar}         press          temp`;
        case 4: 
          return boronFlag
            ? `*                ${searchVar}         press          temp       quality       boron`
            : `*                ${searchVar}         press          temp       quality`;
        case 5: 
          return boronFlag
            ? `*                ${searchVar}          temp       quality     xn          boron`
            : `*                ${searchVar}          temp       quality     xn`;
        case 6:
          return boronFlag
            ? `*                ${searchVar}         press       Uf          Ug          αg          xn          boron`
            : `*                ${searchVar}         press       Uf          Ug          αg          xn`;
        case 7:
          return boronFlag
            ? `*                ${searchVar}         press          Tf          Tg          αg          boron`
            : `*                ${searchVar}         press          Tf          Tg          αg`;
        case 8:
          return boronFlag
            ? `*                ${searchVar}         press          temp       quality        RH          boron`
            : `*                ${searchVar}         press          temp       quality        RH`;
        default:
          return `*                ${searchVar}         data...`;
      }
    };
    
    // Time-dependent data (Cards 0201-02XX)
    // Add header comment for first row
    if (params.timeTable.length > 0) {
      cards.push(getTimeTableHeader());
    }
    
    // Format depends on thermodynamic option
    params.timeTable.forEach((point, idx) => {
      const cardNum = (idx + 1).toString().padStart(2, '0');
      const time = this.formatNumber(point.time);
      
      let dataLine = '';
      
      switch (thermoOption) {
        case 0: {
          // t=0: P, Uf, Ug, αg (+ boron)
          const p = this.formatNumber(point.pressure!);
          const uf = this.formatNumber(point.internalEnergyLiquid!);
          const ug = this.formatNumber(point.internalEnergyVapor!);
          const ag = this.formatNumber(point.voidFraction!);
          dataLine = `${time}${p}${uf}${ug}${ag}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 1: {
          // t=1: T, xs (+ boron)
          const t = this.formatNumber(point.temperature!);
          const xs = this.formatNumber(point.quality!);
          dataLine = `${time}${t}${xs}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 2: {
          // t=2: P, xs (+ boron)
          const p = this.formatNumber(point.pressure!);
          const xs = this.formatNumber(point.quality!);
          dataLine = `${time}${p}${xs}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 3: {
          // t=3: P, T (+ boron)
          const p = this.formatNumber(point.pressure!);
          const t = this.formatNumber(point.temperature!);
          dataLine = `${time}${p}${t}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 4: {
          // t=4: P, T, xs (+ boron) - Two Components (Steam/Water/Air)
          const p = this.formatNumber(point.pressure ?? 0.0);
          const t = this.formatNumber(point.temperature ?? 0.0);
          const xs = this.formatNumber(point.quality ?? 0.0);
          dataLine = `${time}${p}${t}${xs}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 5: {
          // t=5: T, xs, xn (+ boron)
          const t = this.formatNumber(point.temperature!);
          const xs = this.formatNumber(point.quality!);
          const xn = this.formatNumber(point.noncondensableQuality!);
          dataLine = `${time}${t}${xs}${xn}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }
        
        case 6: {
          // t=6: P, Uf, Ug, αg, xn (+ boron)
          const p = this.formatNumber(point.pressure!);
          const uf = this.formatNumber(point.internalEnergyLiquid!);
          const ug = this.formatNumber(point.internalEnergyVapor!);
          const ag = this.formatNumber(point.voidFraction!);
          const xn = this.formatNumber(point.noncondensableQuality!);
          dataLine = `${time}${p}${uf}${ug}${ag}${xn}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }

        case 7: {
          // t=7: P, Tf, Tg, αg (+ boron) - TRACE compatible
          const p7 = this.formatNumber(point.pressure!);
          const tf = this.formatNumber(point.temperatureLiquid!);
          const tg = this.formatNumber(point.temperatureVapor!);
          const ag7 = this.formatNumber(point.voidFraction!);
          dataLine = `${time}${p7}${tf}${tg}${ag7}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }

        case 8: {
          // t=8: P, T, xs, RH (+ boron) - relative humidity
          const p8 = this.formatNumber(point.pressure!);
          const t8 = this.formatNumber(point.temperature!);
          const xs8 = this.formatNumber(point.quality!);
          const rh = this.formatNumber(point.relativeHumidity!);
          dataLine = `${time}${p8}${t8}${xs8}${rh}`;
          if (boronFlag && point.boronConcentration !== undefined) {
            dataLine += this.formatNumber(point.boronConcentration);
          }
          break;
        }

        default:
          // Fallback to simple P-T format
          const p = point.pressure ? this.formatNumber(point.pressure) : this.formatNumber(0.0);
          const t = point.temperature ? this.formatNumber(point.temperature) : this.formatNumber(0.0);
          dataLine = `${time}${p}${t}`;
      }
      
      cards.push(`${shortId}02${cardNum}  ${dataLine}`);
    });
    
    return cards;
  }
  
  private generateTmdpjunCards(id: string, name: string, params: Partial<TmdpjunParameters>): string[] {
    const cards: string[] = [];
    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }
    const shortId = id.slice(0, 3);
    
    // Component definition
    cards.push('*                name          type');
    cards.push(`${id}  ${name.padEnd(14)}  tmdpjun`);
    cards.push('*');
    
    // Connection (Card 0101)
    // Convert VolumeReference to VolumeId string
    const fromRef = params.from as VolumeReference | undefined;
    const toRef = params.to as VolumeReference | undefined;
    const from = fromRef ? this.resolver.getVolumeIdFromReference(fromRef) || '000000000' : '000000000';
    const to = toRef ? this.resolver.getVolumeIdFromReference(toRef) || '000000000' : '000000000';
    const area = params.area !== undefined ? params.area : 0.0;  // 0 = auto
    
    // jefvcahs: Only e-flag supported (00000000 or 01000000)
    const jefvcahs = params.useModifiedPvTerm ? '01000000' : (params.jefvcahs || '00000000');
    
    // Validation warnings
    if (from === '000000000' || to === '000000000') {
      cards.push(`* WARNING: Junction not fully connected. Edit Volume IDs manually.`);
    }
    
    // Format validation for TMDPJUN (CCCVV000N format)
    const tmdpjunVolumeIdRegex = /^\d{5}000[0-6]$/;
    if (from !== '000000000' && !tmdpjunVolumeIdRegex.test(from)) {
      cards.push(`* WARNING: 'from' must be CCCVV000N format (N=0-6: 0=legacy, 1-6=face)`);
    }
    if (to !== '000000000' && !tmdpjunVolumeIdRegex.test(to)) {
      cards.push(`* WARNING: 'to' must be CCCVV000N format (N=0-6: 0=legacy, 1-6=face)`);
    }
    
    cards.push('*                from            to          area    jefvcahs');
    cards.push(`${shortId}0101  ${from}  ${to}  ${this.formatNumber(area)}  ${jefvcahs}`);
    cards.push('*');
    
    // Boundary condition type (Card 0200)
    const condType = params.conditionType !== undefined ? params.conditionType : 1;
    const junVarType = params.variableType || 'time';
    if (params.tripNumber !== undefined || junVarType !== 'time') {
      cards.push('*               cword          trip         a_var     n_var');
      const junTrip = params.tripNumber !== undefined ? params.tripNumber : 0;
      const junVarCode = params.variableCode !== undefined ? params.variableCode : 0;
      cards.push(`${shortId}0200  ${condType.toString().padStart(14)}${junTrip.toString().padStart(14)}${junVarType.padStart(14)}${junVarCode.toString().padStart(10)}`);
    } else {
      cards.push('*               cword');
      cards.push(`${shortId}0200  ${condType.toString().padStart(14)}`);
    }
    cards.push('*');
    
    // Time-dependent flow (Cards 0201-02XX)
    if (params.timeTable && params.timeTable.length > 0) {
      cards.push('*                srch           mfl           mfv      unused');
      params.timeTable.forEach((point, idx) => {
        const cardNum = (idx + 1).toString().padStart(2, '0');
        const mfl = point.mfl !== undefined ? point.mfl : 0.0;
        const mfv = point.mfv !== undefined ? point.mfv : 0.0;
        cards.push(`${shortId}02${cardNum}  ${this.formatNumber(point.time)}  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}         0.0`);
      });
    } else {
      // Default: steady state at 0 flow
      cards.push('*                srch           mfl           mfv      unused');
      cards.push(`${shortId}0201           0.0  0.0  0.0         0.0`);
      cards.push(`${shortId}0202         1.0e9           0.0           0.0         0.0`);
    }
    
    return cards;
  }

  private generateMtpljunCards(id: string, name: string, params: MtpljunParameters): string[] {
    const cards: string[] = [];
    const shortId = id.slice(0, 3);  // Use first 3 digits (e.g., 1650000 -> 165)

    // Component definition (Card CCC0000)
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  mtpljun`);
    cards.push('*');

    // Number of junctions (Card CCC0001)
    cards.push(`*            no of jun     icond`);
    cards.push(`${shortId}0001  ${params.njuns}             ${params.icond}`);
    cards.push('*');

    // Sort junctions by junction number
    const sortedJunctions = [...params.junctions].sort((a, b) =>
      a.junctionNumber - b.junctionNumber
    );

    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }

    // cardFormat: 'combined' (6-word card11) or 'split' (3-card per junction)
    const isCombined = params.cardFormat === 'combined';

    // Helper: resolve junction from/to Volume IDs
    const resolveJunction = (junction: any) => {
      let from = '000000000';
      let to = '000000000';
      if (junction.from?.nodeId) {
        const fromId = this.resolver!.getVolumeIdFromReference(junction.from);
        if (fromId) from = fromId;
      }
      if (junction.to?.nodeId) {
        const toId = this.resolver!.getVolumeIdFromReference(junction.to);
        if (toId) to = toId;
      }
      return { from, to };
    };

    if (isCombined) {
      // === Combined format ===
      // Card CCC0NN1: from, to, area, fwdLoss, revLoss, jefvcahs (6 words)
      cards.push(`*            from      to         area       fwdLoss  revLoss  jefvcahs`);
      sortedJunctions.forEach(junction => {
        const nn = junction.junctionNumber.toString().padStart(2, '0');
        const { from, to } = resolveJunction(junction);
        if (from === '000000000' || to === '000000000') {
          cards.push(`* WARNING: Junction ${junction.junctionNumber} not fully connected.`);
        }
        const jefvcahs = junction.jefvcahs || '00000000';
        cards.push(`${shortId}0${nn}1  ${from}  ${to} ${this.formatNumber(junction.area)}${this.formatNumber(junction.fwdLoss)}${this.formatNumber(junction.revLoss)}  ${jefvcahs}`);
      });
      cards.push('*');

      // Card CCC0NN2: subDc, twoDc, supDc, fIncre, tIncre, 0, endJunction (7 words)
      cards.push(`*            subDc  twoDc  supDc      fIncre  tIncre  0  junid`);
      sortedJunctions.forEach(junction => {
        const nn = junction.junctionNumber.toString().padStart(2, '0');
        const subDc = junction.subDc !== undefined ? junction.subDc : 1.0;
        const twoDc = junction.twoDc !== undefined ? junction.twoDc : 1.0;
        const supDc = junction.supDc !== undefined ? junction.supDc : 1.0;
        const fIncre = junction.fIncre !== undefined ? junction.fIncre : 0;
        const tIncre = junction.tIncre !== undefined ? junction.tIncre : 0;
        const endJun = junction.endJunction !== undefined ? junction.endJunction : junction.junctionNumber;
        cards.push(`${shortId}0${nn}2  ${this.formatNumber(subDc).trim()}  ${this.formatNumber(twoDc).trim()}   ${this.formatNumber(supDc).trim()}        ${fIncre}         ${tIncre}            0  ${endJun}`);
      });
      cards.push('*');
    } else {
      // === Split format ===
      // Card CCC0NN1: from, to, area (3 words)
      cards.push(`*            from          to             area`);
      sortedJunctions.forEach(junction => {
        const nn = junction.junctionNumber.toString().padStart(2, '0');
        const { from, to } = resolveJunction(junction);
        if (from === '000000000' || to === '000000000') {
          cards.push(`* WARNING: Junction ${junction.junctionNumber} not fully connected.`);
        }
        cards.push(`${shortId}0${nn}1     ${from}     ${to}        ${this.formatNumber(junction.area).trim()}`);
      });
      cards.push('*');

      // Card CCC0NN2: fwdLoss, revLoss, jefvcahs, subDc, twoDc (5 words)
      cards.push(`*            fwdLoss       revLoss       flags         subDc         twoDc`);
      sortedJunctions.forEach(junction => {
        const nn = junction.junctionNumber.toString().padStart(2, '0');
        const jefvcahs = junction.jefvcahs || '00000000';
        const subDc = junction.subDc !== undefined ? junction.subDc : 1.0;
        const twoDc = junction.twoDc !== undefined ? junction.twoDc : 1.0;
        cards.push(`${shortId}0${nn}2  ${this.formatNumber(junction.fwdLoss)}  ${this.formatNumber(junction.revLoss)}       ${jefvcahs}            ${this.formatNumber(subDc).trim()}           ${this.formatNumber(twoDc).trim()}`);
      });
      cards.push('*');

      // Card CCC0NN3: 0.0, fIncre, tIncre, 0, endJunction (5 words)
      cards.push(`*            unused        fIncre        tIncre        unused  junid`);
      sortedJunctions.forEach(junction => {
        const nn = junction.junctionNumber.toString().padStart(2, '0');
        const fIncre = junction.fIncre !== undefined ? junction.fIncre : 0;
        const tIncre = junction.tIncre !== undefined ? junction.tIncre : 0;
        const endJun = junction.endJunction !== undefined ? junction.endJunction : junction.junctionNumber;
        cards.push(`${shortId}0${nn}3  ${this.formatNumber(0.0)}  ${fIncre.toString().padStart(14)}  ${tIncre.toString().padStart(14)}              0              ${endJun}`);
      });
      cards.push('*');
    }

    // Card CCC1NNM: Initial flow — preserve original endJunction values (SEF format)
    cards.push(`*            mfl           mfv            junid`);
    sortedJunctions.forEach(junction => {
      const nn = junction.junctionNumber.toString().padStart(2, '0');
      const cardNum = `${shortId}1${nn}1`;
      const mfl = junction.initialLiquidFlow !== undefined ? junction.initialLiquidFlow : 0.0;
      const mfv = junction.initialVaporFlow !== undefined ? junction.initialVaporFlow : 0.0;
      const endJun = junction.endJunction !== undefined ? junction.endJunction : junction.junctionNumber;
      cards.push(`${cardNum}  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}              ${endJun}`);
    });

    return cards;
  }

  private generatePumpCards(id: string, name: string, params: PumpParameters): string[] {
    const cards: string[] = [];
    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }
    const shortId = id.slice(0, 3);
    const W = 14; // 표준 컬럼 폭
    const col = (v: number | string, w = W) =>
      typeof v === 'number' ? this.formatNumber(v, w) : String(v).padStart(w);
    const icol = (v: number | string, w = W) =>
      typeof v === 'number' ? this.formatInt(v, w) : String(v).padStart(w);
    const hdr = (...labels: string[]) =>
      '*        ' + labels.map(l => l.padStart(W)).join('');

    // Component definition (Card CCC0000)
    cards.push(hdr('name', 'type'));
    cards.push(`${id}  ${col(name)}${col('pump')}`);

    // === CCC0101: Volume Geometry (7 words on one card) ===
    cards.push(hdr('area', 'length', 'vol', 'az-angle', 'inc-angle', 'dz', 'tlpvbfe'));
    cards.push(`${shortId}0101  ${col(params.area)}${col(params.length)}${col(params.volume)}${col(params.azAngle)}${col(params.incAngle)}${col(params.dz)}${col(params.tlpvbfe)}`);

    // === CCC0108: Inlet Junction ===
    const inletRef = params.inletConnection;
    const inlet = inletRef ? this.resolver.getVolumeIdFromReference(inletRef) || '000000000' : '000000000';

    if (inlet === '000000000') {
      cards.push(`* WARNING: Inlet junction not connected. Edit Volume ID manually.`);
    }

    cards.push(hdr('from', 'area', 'kfor', 'krev', 'jefvcahs'));
    cards.push(`${shortId}0108  ${col(inlet)}${col(params.inletArea)}${col(params.inletFwdLoss)}${col(params.inletRevLoss)}${col(params.inletJefvcahs)}`);

    // === CCC0109: Outlet Junction ===
    const outletRef = params.outletConnection;
    const outlet = outletRef ? this.resolver.getVolumeIdFromReference(outletRef) || '000000000' : '000000000';

    if (outlet === '000000000') {
      cards.push(`* WARNING: Outlet junction not connected. Edit Volume ID manually.`);
    }

    cards.push(hdr('to', 'area', 'kfor', 'krev', 'jefvcahs'));
    cards.push(`${shortId}0109  ${col(outlet)}${col(params.outletArea)}${col(params.outletFwdLoss)}${col(params.outletRevLoss)}${col(params.outletJefvcahs)}`);

    // === CCC0110/0111: Junction Diameter & CCFL (optional) ===
    if (params.inletCcflDiameter !== undefined) {
      cards.push(hdr('d_hyd', 'beta', 'slope', 'incr'));
      cards.push(`${shortId}0110  ${col(params.inletCcflDiameter)}${col(params.inletCcflBeta ?? 0)}${col(params.inletCcflSlope ?? 0)}${col(params.inletCcflSlopeIncr ?? 0)}`);
    }
    if (params.outletCcflDiameter !== undefined) {
      cards.push(hdr('d_hyd', 'beta', 'slope', 'incr'));
      cards.push(`${shortId}0111  ${col(params.outletCcflDiameter)}${col(params.outletCcflBeta ?? 0)}${col(params.outletCcflSlope ?? 0)}${col(params.outletCcflSlopeIncr ?? 0)}`);
    }

    // === CCC0200: Initial Conditions ===
    cards.push(hdr('ebt', 'press', 'temp'));
    cards.push(`${shortId}0200  ${icol(params.ebt)}${col(params.pressure)}${col(params.temperature)}`);

    // === CCC0201-0202: Initial Flows ===
    cards.push(hdr('flow', 'mfl', 'mfv', 'unused'));

    // Inlet flow (Card 0201)
    cards.push(`${shortId}0201  ${icol(params.inletFlowMode)}${col(params.inletLiquidFlow)}${col(params.inletVaporFlow)}${col(0.0)}`);

    // Outlet flow (Card 0202)
    cards.push(`${shortId}0202  ${icol(params.outletFlowMode)}${col(params.outletLiquidFlow)}${col(params.outletVaporFlow)}${col(0.0)}`);

    // === CCC0301: Options & Control (7 integer fields, 10-char columns) ===
    const IW = 10; // 정수 필드 좁은 컬럼
    const ihdr = (...labels: string[]) =>
      '*        ' + labels.map(l => l.padStart(IW)).join('');
    cards.push(ihdr('tbli', 'twophase', 'tdiff', 'mtorq', 'tdvel', 'ptrip', 'rev'));
    cards.push(`${shortId}0301  ${icol(params.tbli, IW)}${icol(params.twophase, IW)}${icol(params.tdiff, IW)}${icol(params.mtorq, IW)}${icol(params.tdvel, IW)}${icol(params.ptrip, IW)}${icol(params.rev, IW)}`);

    // === CCC0302: Rated Speed, Ratio, Flow, Head, Torque, Inertia (6 words) ===
    cards.push(hdr('pvel', 'pratio', 'rflow', 'rhead', 'rtorq', 'imoment'));
    cards.push(`${shortId}0302  ${col(params.ratedSpeed)}${col(params.initialSpeedRatio)}${col(params.ratedFlow)}${col(params.ratedHead)}${col(params.ratedTorque)}${col(params.momentOfInertia)}`);

    // === CCC0303: Rated Density, Motor Torque, Friction Coefficients (6 words) ===
    cards.push(hdr('rdens', 'rmtor', 'tf2', 'tf0', 'tf1', 'tf3'));
    cards.push(`${shortId}0303  ${col(params.ratedDensity)}${col(params.ratedMotorTorque)}${col(params.frictionTF2)}${col(params.frictionTF0)}${col(params.frictionTF1)}${col(params.frictionTF3)}`);

    // === Homologous Curves (CCC1100~CCCxxxx) ===
    console.log('[FileGenerator] PUMP homologousCurves:', params.homologousCurves?.length || 0, 'curves');
    if (params.homologousCurves && params.homologousCurves.length > 0) {
      cards.push(...this.generateHomologousCurveCards(shortId, params.homologousCurves));
    } else {
      console.warn('[FileGenerator] No homologous curves found for PUMP', shortId);
    }

    // === Speed Control (CCC6100~CCC6199) ===
    if (params.speedControl) {
      cards.push(...this.generateSpeedControlCards(shortId, params.speedControl));
    }

    cards.push('*');

    return cards;
  }

  /**
   * Generate Homologous Curve Cards (CCC1100~CCCxxxx)
   * 사용자가 명시적으로 활성화한 곡선만 출력
   */
  private generateHomologousCurveCards(shortId: string, curves: import('../types/mars').PumpCurve[]): string[] {
    const cards: string[] = [];

    // 곡선 이름 → 카드 번호 베이스 매핑
    const curveCardBase: Record<string, string> = {
      han: '1100', ban: '1200', hvn: '1300', bvn: '1400',
      had: '1500', bad: '1600', hvd: '1700', bvd: '1800',
      hat: '1900', bat: '2000', hvt: '2100', bvt: '2200',
      har: '2300', bar: '2400', hvr: '2500', bvr: '2600',
    };

    // enabled=true인 곡선만 필터링
    const enabledCurves = curves.filter(c => c.enabled);

    enabledCurves.forEach((curve) => {
      const cardBase = curveCardBase[curve.name];
      if (!cardBase) return; // 알 수 없는 곡선 이름은 스킵

      // 헤더 카드 (예: 1811100) - SMART.i 포맷에 맞춘 정렬
      cards.push(`* ${curve.name}        type          regime`);
      cards.push(`${shortId}${cardBase}      ${String(curve.type).padEnd(14)}${curve.regime}`);

      // 데이터 카드 (예: 1811101~1811115) - SMART.i 포맷에 맞춘 정렬
      cards.push(`*            ${curve.xLabel.padEnd(14)}${curve.yLabel}`);
      curve.points.forEach((pt, idx) => {
        const cardNum = `${shortId}${cardBase.slice(0, 2)}${String(idx + 1).padStart(2, '0')}`;
        // SMART.i 스타일: 숫자를 14칸 고정폭으로 오른쪽 정렬
        const xFormatted = this.formatNumber(pt.x, 14);
        const yFormatted = this.formatNumber(pt.y, 14);
        cards.push(`${cardNum}  ${xFormatted}${yFormatted}`);
      });

      cards.push('*');
    });

    return cards;
  }

  /**
   * Generate Speed Control Cards (CCC6100~CCC6199)
   */
  private generateSpeedControlCards(shortId: string, speedControl: import('../types/mars').PumpSpeedControl): string[] {
    const cards: string[] = [];
    const W = 14;
    const col = (v: number | string, w = W) =>
      typeof v === 'number' ? this.formatNumber(v, w) : String(v).padStart(w);
    const icol = (v: number | string, w = W) =>
      typeof v === 'number' ? this.formatInt(v, w) : String(v).padStart(w);
    const hdr = (...labels: string[]) =>
      '*        ' + labels.map(l => l.padStart(W)).join('');

    // CCC6100: 속도 제어 설정
    cards.push('* Speed Control Configuration');
    if (speedControl.keyword) {
      cards.push(hdr('tripNumber', 'keyword', 'parameter'));
      cards.push(`${shortId}6100  ${icol(speedControl.tripOrControl)}${col(speedControl.keyword)}${icol(speedControl.parameter ?? 0)}`);
    } else {
      cards.push(hdr('tripNumber'));
      cards.push(`${shortId}6100  ${icol(speedControl.tripOrControl)}`);
    }

    // CCC6101~6199: 시간 의존 펌프 속도 테이블
    cards.push('* Time-Dependent Pump Velocity Table');
    cards.push(hdr('searchVar', 'pumpSpeed'));
    speedControl.speedTable.forEach((entry, idx) => {
      const cardNum = `${shortId}61${String(idx + 1).padStart(2, '0')}`;
      cards.push(`${cardNum}  ${col(entry.searchVariable)}${col(entry.pumpSpeed)}`);
    });

    cards.push('*');

    return cards;
  }

  /**
   * Generate Heat Structure Cards (1CCCGXNN format)
   * Phase 1: General structures only (no fuel rod features)
   *
   * NOTE: Heat Structure does NOT have a definition card (CCC0000 name type).
   *       Unlike SNGLVOL/PIPE/etc., Heat Structure starts directly with 1CCCG000 card.
   */
  private generateHeatStructureCards(id: string, name: string, params: HeatStructureParameters): string[] {
    const cards: string[] = [];
    // Heat Structure card format: 1CCCGXNN (8 digits)
    // componentId is 7-digit: CCC + G + 0000 (no leading '1')
    // e.g., componentId "9880000" → CCC=988, G=0
    const ccc = id.slice(0, 3);       // "9880000" → "988", "1000000" → "100"
    const g = id.slice(3, 4) || '0';  // geometry number from componentId

    // Heat Structure header comment (no definition card - different from hydro components!)
    cards.push('*------------------------------------------------------------------------------*');
    cards.push(`* S${id.slice(0, 4)} : ${name.padEnd(62)}*`);
    cards.push('*------------------------------------------------------------------------------*');

    // === Card 1CCCG000: General Heat Structure Data ===
    // Format: nh  np  geom  ss-init  left-coord  reflood  bvi  mai
    // Phase 1: Words 1-5 only (reflood=0)
    // Phase 2 (Fuel Rod): Words 6-8 (refloodFlag, boundaryVolumeIndicator, maxAxialIntervals)
    const refloodFlag = params.isFuelRod ? (params.refloodFlag ?? 0) : 0;
    const bvi = params.isFuelRod ? (params.boundaryVolumeIndicator ?? 0) : 0;
    const mai = params.isFuelRod ? (params.maxAxialIntervals ?? 2) : 0;

    if (params.isFuelRod) {
      cards.push('*          nh   np      geom      ssif     leftcoord reflood   bvi   mai');
      cards.push(`1${ccc}${g}000    ${params.nh.toString().padEnd(4)}${params.np.toString().padEnd(8)}${params.geometryType.toString().padEnd(10)}${params.ssInitFlag.toString().padEnd(9)}${this.formatNumber(params.leftBoundaryCoord, 10)}       ${refloodFlag}     ${bvi}     ${mai}`);
    } else {
      cards.push('*          nh   np      geom      ssif     leftcoord reflood');
      cards.push(`1${ccc}${g}000    ${params.nh.toString().padEnd(4)}${params.np.toString().padEnd(8)}${params.geometryType.toString().padEnd(10)}${params.ssInitFlag.toString().padEnd(9)}${this.formatNumber(params.leftBoundaryCoord, 10)}       0`);
    }

    // === Phase 2: Fuel Rod Cards (only when isFuelRod=true) ===
    if (params.isFuelRod) {
      // Card 1CCCG001: Gap Conductance Data
      if (params.gapConductance) {
        cards.push('*   Gap Conductance Data');
        const refVolId = params.gapConductance.referenceVolume && this.resolver
          ? this.resolver.getVolumeIdFromReference(params.gapConductance.referenceVolume) || '0'
          : '0';
        const condMult = params.gapConductance.conductanceMultiplier;
        let line = `1${ccc}${g}001  ${this.formatNumber(params.gapConductance.initialGapPressure)}  ${refVolId}`;
        if (condMult !== undefined && condMult !== 1.0) {
          line += `  ${this.formatNumber(condMult)}`;
        }
        cards.push(line);
      }

      // Card 1CCCG003: Metal-Water Reaction
      if (params.metalWaterReaction) {
        cards.push('*   Metal-Water Reaction Data');
        cards.push('*            init-oxide');
        cards.push(`1${ccc}${g}003  ${this.formatNumber(params.metalWaterReaction.initialOxideThickness)}`);
      }

      // Card 1CCCG004: Cladding Deformation
      if (params.claddingDeformation) {
        cards.push('*   Cladding Deformation Data');
        cards.push('*            form-loss');
        cards.push(`1${ccc}${g}004             ${params.claddingDeformation.formLossFlag}`);
      }

      // Cards 1CCCG011-099: Gap Deformation Data
      if (params.gapDeformationData && params.gapDeformationData.length > 0) {
        cards.push('*   Gap Deformation Data');
        cards.push('*            fuel-rough    clad-rough     swelling      creepdown     hs-num');
        params.gapDeformationData.forEach((gap, idx) => {
          const cardNum = (11 + idx).toString().padStart(3, '0');
          cards.push(`1${ccc}${g}${cardNum}  ${this.formatNumber(gap.fuelSurfaceRoughness)}  ${this.formatNumber(gap.cladSurfaceRoughness)}  ${this.formatNumber(gap.fuelSwelling)}  ${this.formatNumber(gap.cladCreepdown)}        ${gap.hsNumber}`);
        });
      }
    }

    // === Card 1CCCG100: Mesh Location and Format Flags ===
    // Format: mesh-loc-flag  mesh-format-flag
    cards.push('*                 mesh        format');
    cards.push(`1${ccc}${g}100             ${params.meshLocationFlag}             ${params.meshFormatFlag}`);

    // === Cards 1CCCG101-199: Mesh Intervals ===
    // Format varies by meshFormatFlag, using flag=1: intervals + right-coord
    cards.push('*            intervals        radius');
    params.meshIntervals.forEach((mesh, idx) => {
      const cardNum = (101 + idx).toString().padStart(3, '0');
      cards.push(`1${ccc}${g}${cardNum}             ${mesh.intervals.toString().padEnd(9)}${this.formatNumber(mesh.rightCoord)}`);
    });

    // === Cards 1CCCG201-299: Material Composition ===
    // Format: material-number  interval
    cards.push('*             material      interval');
    params.materialCompositions.forEach((mat, idx) => {
      const cardNum = (201 + idx).toString().padStart(3, '0');
      cards.push(`1${ccc}${g}${cardNum}             ${mat.materialNumber.toString().padEnd(13)}${mat.interval}`);
    });

    // === Cards 1CCCG301-399: Source Distribution ===
    // Format: source-value  interval
    cards.push('*                 rpkf      interval');
    params.sourceDistributions.forEach((src, idx) => {
      const cardNum = (301 + idx).toString().padStart(3, '0');
      cards.push(`1${ccc}${g}${cardNum}  ${this.formatNumber(src.sourceValue)}  ${src.interval}`);
    });

    // === Card 1CCCG400: Initial Temperature Flag ===
    // 0 = use temperature data from G401-G499 (only output if explicitly present)
    if (params.initialTempFlag !== undefined) {
      cards.push('*         initial temp flag');
      cards.push(`1${ccc}${g}400  ${params.initialTempFlag}`);
    }

    // === Cards 1CCCG401-499: Initial Temperature ===
    // Format: temperature  mesh-point
    cards.push('*          temperature      meshpoint');
    params.initialTemperatures.forEach((temp, idx) => {
      const cardNum = (401 + idx).toString().padStart(3, '0');
      cards.push(`1${ccc}${g}${cardNum}  ${this.formatNumber(temp.temperature)}  ${temp.meshPoint}`);
    });

    // === Cards 1CCCG501-599: Left Boundary Conditions ===
    // Format: bound-vol  incr  bc-type  area-code  area  hs-num
    // Multi-geometry: card numbers continue cumulatively across geometries
    const bcOffsets = this.htstrBcOffsets.get(id) || { leftOffset: 0, rightOffset: 0 };
    cards.push('*   Left Boundary Condition Data');
    cards.push('*            bound      incr      type      code        factor      node');
    params.leftBoundaryConditions.forEach((bc, idx) => {
      const cardNum = (501 + bcOffsets.leftOffset + idx).toString().padStart(3, '0');
      // Convert VolumeReference to VolumeId string, or use 0 for insulated
      let boundVol = '0';
      if (bc.boundaryVolume && this.resolver) {
        const volId = this.resolver.getVolumeIdFromReference(bc.boundaryVolume);
        if (volId) {
          boundVol = volId;
        }
      }
      cards.push(`1${ccc}${g}${cardNum} ${boundVol.padEnd(10)}${bc.increment.toString().padEnd(10)}${bc.bcType.toString().padEnd(10)}${bc.surfaceAreaCode.toString().padEnd(12)}${this.formatNumber(bc.surfaceArea)}  ${bc.hsNumber}`);
    });

    // === Cards 1CCCG601-699: Right Boundary Conditions ===
    // Format: bound-vol  incr  bc-type  area-code  area  hs-num
    cards.push('*   Right Boundary Condition Data');
    cards.push('*            bound      incr      type      code        factor      node');
    params.rightBoundaryConditions.forEach((bc, idx) => {
      const cardNum = (601 + bcOffsets.rightOffset + idx).toString().padStart(3, '0');
      // Convert VolumeReference to VolumeId string, or use 0 for insulated
      let boundVol = '0';
      if (bc.boundaryVolume && this.resolver) {
        const volId = this.resolver.getVolumeIdFromReference(bc.boundaryVolume);
        if (volId) {
          boundVol = volId;
        }
      }
      cards.push(`1${ccc}${g}${cardNum} ${boundVol.padEnd(10)}${bc.increment.toString().padEnd(10)}${bc.bcType.toString().padEnd(10)}${bc.surfaceAreaCode.toString().padEnd(12)}${this.formatNumber(bc.surfaceArea)}  ${bc.hsNumber}`);
    });

    // === Cards 1CCCG701-799: Source Data ===
    // Format: source-type  multiplier  dmhl  dmhr  hs-num
    cards.push('*               source          mult          dmhl          dmhr           num');
    params.sourceData.forEach((src, idx) => {
      const cardNum = (701 + idx).toString().padStart(3, '0');
      cards.push(`1${ccc}${g}${cardNum}             ${src.sourceType.toString().padEnd(12)}${this.formatNumber(src.multiplier)}${this.formatNumber(src.dmhl)}${this.formatNumber(src.dmhr)} ${src.hsNumber}`);
    });

    // === Cards 1CCCG800-899: Additional Left Boundary ===
    // Card 1CCCG800: Additional boundary option flag
    // 0=none, 1+=with additional BC data. Force >=1 when data rows exist.
    cards.push('*   Left Additional Boundary Condition Data');
    const hasLeftAddData = params.leftAdditionalBoundary && params.leftAdditionalBoundary.length > 0;
    const leftAddOption = params.leftAdditionalOption ?? 0;
    cards.push(`1${ccc}${g}800             ${leftAddOption}`);

    // Cards 1CCCG801-899: Additional boundary data - only if data exists
    if (hasLeftAddData) {
      // Use 12-word format when fuel rod mode is active or NC fields are explicitly set
      const has12Word = params.isFuelRod || params.leftAdditionalBoundary!.some((add) =>
        'naturalCirculationLength' in add && add.naturalCirculationLength !== undefined
      );
      if (has12Word) {
        cards.push('*        hthd  hlf  hlr gslf gslr glcf glcr lbf nclength p/d foul node');
      } else {
        cards.push('*        hthd  hlf  hlr gslf gslr glcf glcr lbf node');
      }
      params.leftAdditionalBoundary!.forEach((add, idx) => {
        const cardNum = (801 + idx).toString().padStart(3, '0');
        // Use compact format (single space between fields) to stay within 80-char limit
        const f = (v: number) => this.formatNumber(v, 1);
        const fields = [f(add.heatTransferDiameter), f(add.heatedLengthForward), f(add.heatedLengthReverse), f(add.gridSpacerLengthFwd), f(add.gridSpacerLengthRev), f(add.gridLossCoeffFwd), f(add.gridLossCoeffRev), f(add.localBoilingFactor)];
        if (has12Word && 'naturalCirculationLength' in add) {
          const a12 = add as { naturalCirculationLength?: number; pitchToDiameterRatio?: number; foulingFactor?: number };
          fields.push(f(a12.naturalCirculationLength ?? 0), f(a12.pitchToDiameterRatio ?? 0), f(a12.foulingFactor ?? 0));
        }
        cards.push(`1${ccc}${g}${cardNum}  ${fields.join(' ')}   ${add.hsNumber}`);
      });
    }

    // === Cards 1CCCG900-999: Additional Right Boundary ===
    // Card 1CCCG900: Additional boundary option flag
    // 0=none, 1+=with additional BC data. Force >=1 when data rows exist.
    cards.push('*   Right Additional Boundary Condition Data');
    const hasRightAddData = params.rightAdditionalBoundary && params.rightAdditionalBoundary.length > 0;
    const rightAddOption = params.rightAdditionalOption ?? 0;
    cards.push(`1${ccc}${g}900             ${rightAddOption}`);

    // Cards 1CCCG901-999: Additional boundary data - only if data exists
    if (hasRightAddData) {
      // Use 12-word format when fuel rod mode is active or NC fields are explicitly set
      const has12Word = params.isFuelRod || params.rightAdditionalBoundary!.some((add) =>
        'naturalCirculationLength' in add && add.naturalCirculationLength !== undefined
      );
      if (has12Word) {
        cards.push('*        hthd  hlf  hlr gslf gslr glcf glcr lbf nclength p/d foul node');
      } else {
        cards.push('*        hthd  hlf  hlr gslf gslr glcf glcr lbf node');
      }
      params.rightAdditionalBoundary!.forEach((add, idx) => {
        const cardNum = (901 + idx).toString().padStart(3, '0');
        // Use compact format (single space between fields) to stay within 80-char limit
        const f = (v: number) => this.formatNumber(v, 1);
        const fields = [f(add.heatTransferDiameter), f(add.heatedLengthForward), f(add.heatedLengthReverse), f(add.gridSpacerLengthFwd), f(add.gridSpacerLengthRev), f(add.gridLossCoeffFwd), f(add.gridLossCoeffRev), f(add.localBoilingFactor)];
        if (has12Word && 'naturalCirculationLength' in add) {
          const a12 = add as { naturalCirculationLength?: number; pitchToDiameterRatio?: number; foulingFactor?: number };
          fields.push(f(a12.naturalCirculationLength ?? 0), f(a12.pitchToDiameterRatio ?? 0), f(a12.foulingFactor ?? 0));
        }
        cards.push(`1${ccc}${g}${cardNum}  ${fields.join(' ')}   ${add.hsNumber}`);
      });
    }

    cards.push('*');

    return cards;
  }

  /**
   * Generate TURBINE component cards (MARS 8.13)
   * Specialized Branch with shaft geometry + performance data
   */
  private generateTurbineCards(id: string, name: string, params: TurbineParameters): string[] {
    const cards: string[] = [];
    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }
    const shortId = id.slice(0, 3);

    // CCC0000: Component definition
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  turbine`);

    // CCC0001: Number of junctions + initial condition control
    cards.push(`*            njuns         cntrl`);
    const initialControl = params.initialConditionControl ?? 0;
    cards.push(`${shortId}0001  ${params.njuns}${initialControl !== 0 ? `             ${initialControl}` : ''}`);

    // CCC0101: Volume geometry (area, length, volume, azAngle, incAngle, dz)
    cards.push(`*            area          length         vol            az-angle      inc-angle      dz`);
    const area = params.area ?? 0.0;
    const azAngle = params.azAngle ?? 0.0;
    cards.push(`${shortId}0101  ${this.formatNumber(area)}  ${this.formatNumber(params.length)}  ${this.formatNumber(params.volume)}  ${this.formatNumber(azAngle)}  ${this.formatNumber(params.incAngle)}  ${this.formatNumber(params.dz)}`);

    // CCC0102: Wall roughness, hydraulic diameter, volume control flags
    cards.push(`*            rough         dh             tlpvbfe`);
    const wallRough = params.wallRoughness ?? 0.0;
    const flags = params.tlpvbfe || '0000010';
    cards.push(`${shortId}0102  ${this.formatNumber(wallRough)}  ${this.formatNumber(params.hydraulicDiameter)}  ${flags}`);

    // CCC0181: Y-Coordinate Crossflow Volume Data — optional
    if (params.yCrossflowData) {
      const y = params.yCrossflowData;
      cards.push(`*            y-area        y-length       y-rough        y-hd           y-flags        unused         unused         y-dz`);
      cards.push(`${shortId}0181  ${this.formatNumber(y.area)}  ${this.formatNumber(y.length)}  ${this.formatNumber(y.roughness)}  ${this.formatNumber(y.hydraulicDiameter)}  ${y.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(y.dz)}`);
    }

    // CCC0191: Z-Coordinate Crossflow Volume Data — optional
    if (params.zCrossflowData) {
      const z = params.zCrossflowData;
      cards.push(`*            z-area        z-length       z-rough        z-hd           z-flags        unused         unused         z-dz`);
      cards.push(`${shortId}0191  ${this.formatNumber(z.area)}  ${this.formatNumber(z.length)}  ${this.formatNumber(z.roughness)}  ${this.formatNumber(z.hydraulicDiameter)}  ${z.controlFlags.padEnd(12)}  0.0  0.0  ${this.formatNumber(z.dz)}`);
    }

    // CCC0200: Volume initial conditions
    cards.push(`*            cntrl         pressure       temp/quality`);
    const ebt = params.ebt || '003';
    const pressureStr = Math.abs(params.pressure) >= 1e6
      ? params.pressure.toExponential(6).trim().padEnd(12)
      : this.formatNumber(params.pressure);
    if (ebt === '003') {
      const temp = params.temperature ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(temp)}`);
    } else if (ebt === '002') {
      const quality = params.quality ?? 0;
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}  ${this.formatNumber(quality)}`);
    } else {
      cards.push(`${shortId}0200  ${ebt}  ${pressureStr}`);
    }

    // CCCN101: Junction geometry (from, to, area, fwdLoss, revLoss, jefvcahs)
    const sortedJunctions = [...params.junctions].sort((a, b) => a.junctionNumber - b.junctionNumber);
    cards.push(`*            from          to             area           kforw          kbackw         jefvcahs`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      let from = '000000000';
      let to = '000000000';
      if (junction.from?.nodeId) {
        const fromId = this.resolver!.getVolumeIdFromReference(junction.from);
        if (fromId) from = fromId;
      }
      if (junction.to?.nodeId) {
        const toId = this.resolver!.getVolumeIdFromReference(junction.to);
        if (toId) to = toId;
      }
      const jefvcahs = junction.jefvcahs || '00000000';
      cards.push(`${shortId}${N}101  ${from}  ${to}  ${this.formatNumber(junction.area)}  ${this.formatNumber(junction.fwdLoss)}  ${this.formatNumber(junction.revLoss)}  ${jefvcahs}`);
    });

    // CCCN201: Junction initial conditions
    cards.push(`*            mfl           mfv            unused`);
    sortedJunctions.forEach(junction => {
      const N = junction.junctionNumber;
      const mfl = junction.initialLiquidFlow ?? 0.0;
      const mfv = junction.initialVaporFlow ?? 0.0;
      cards.push(`${shortId}${N}201  ${this.formatNumber(mfl)}  ${this.formatNumber(mfv)}  0.0`);
    });

    // CCC0300: Shaft geometry
    cards.push(`*Turbine Shaft Geometry`);
    cards.push(`*            speed         inertia        friction       shaft-no       trip`);
    cards.push(`${shortId}0300  ${this.formatNumber(params.shaftSpeed)}  ${this.formatNumber(params.stageInertia)}  ${this.formatNumber(params.shaftFriction)}  ${String(params.shaftComponentNumber).padStart(3, '0').padEnd(12)}  ${params.disconnectTrip}`);

    // CCC0400: Performance data
    cards.push(`*Turbine Performance Data`);
    cards.push(`*            t-type        efficiency     fraction       radius`);
    cards.push(`${shortId}0400  ${params.turbineType}             ${this.formatNumber(params.efficiency)}  ${this.formatNumber(params.reactionFraction)}  ${this.formatNumber(params.meanStageRadius)}`);

    // CCC0401-0450: Efficiency data (type=3 only)
    if (params.turbineType === 3 && params.efficiencyData && params.efficiencyData.length > 0) {
      cards.push(`*Turbine Efficiency Data`);
      let cardIdx = 1;
      for (let i = 0; i < params.efficiencyData.length; i += 2) {
        const pair1 = params.efficiencyData[i];
        const pair2 = i + 1 < params.efficiencyData.length ? params.efficiencyData[i + 1] : null;
        const cardNum = String(400 + cardIdx).padStart(4, '0');
        let line = `${shortId}${cardNum}  ${this.formatNumber(pair1.pressureRatio)}  ${this.formatNumber(pair1.value)}`;
        if (pair2) {
          line += `  ${this.formatNumber(pair2.pressureRatio)}  ${this.formatNumber(pair2.value)}`;
        }
        cards.push(line);
        cardIdx++;
      }
    }

    // CCC0451-0499: Mass flow rate data (type=3 only)
    if (params.turbineType === 3 && params.massFlowRateData && params.massFlowRateData.length > 0) {
      cards.push(`*Turbine Mass Flow Rate Data`);
      let cardIdx = 51;
      for (let i = 0; i < params.massFlowRateData.length; i += 2) {
        const pair1 = params.massFlowRateData[i];
        const pair2 = i + 1 < params.massFlowRateData.length ? params.massFlowRateData[i + 1] : null;
        const cardNum = String(400 + cardIdx).padStart(4, '0');
        let line = `${shortId}${cardNum}  ${this.formatNumber(pair1.pressureRatio)}  ${this.formatNumber(pair1.value)}`;
        if (pair2) {
          line += `  ${this.formatNumber(pair2.pressureRatio)}  ${this.formatNumber(pair2.value)}`;
        }
        cards.push(line);
        cardIdx++;
      }
    }

    return cards;
  }

  /**
   * Generate VALVE component cards
   * Supports: trpvlv (Trip), srvvlv (Servo), mtrvlv (Motor)
   */
  private generateValveCards(id: string, name: string, params: ValveParameters): string[] {
    const cards: string[] = [];
    if (!this.resolver) {
      throw new Error('Resolver not initialized. Call generate() first.');
    }
    const shortId = id.slice(0, 3);

    const valveSubType = params.valveSubType || 'trpvlv';

    // CCC0000: Component definition
    cards.push(`*            name          type`);
    cards.push(`${id}  ${name.padEnd(12)}  valve`);

    // Junction connection data
    const fromRef = params.from as VolumeReference | undefined;
    const toRef = params.to as VolumeReference | undefined;
    const from = fromRef ? this.resolver.getVolumeIdFromReference(fromRef) || '000000000' : '000000000';
    const to = toRef ? this.resolver.getVolumeIdFromReference(toRef) || '000000000' : '000000000';
    const area = params.area !== undefined ? params.area : 0.01;
    const fwdLoss = params.fwdLoss !== undefined ? params.fwdLoss : 0.0;
    const revLoss = params.revLoss !== undefined ? params.revLoss : 0.0;
    const jefvcahs = params.jefvcahs || '00000000';

    if (from === '000000000' || to === '000000000') {
      cards.push(`* WARNING: Valve not fully connected. Edit Volume IDs manually.`);
    }

    // All valve types: CCC0101 (3-word) + CCC0102 (3-word) + CCC0103 (2-word)
    cards.push(`*            from          to             area`);
    cards.push(`${shortId}0101  ${from.padEnd(12)}  ${to.padEnd(12)}  ${this.formatNumber(area)}`);
    cards.push(`*            fwdLoss       revLoss        jefvcahs`);
    cards.push(`${shortId}0102  ${this.formatNumber(fwdLoss)}  ${this.formatNumber(revLoss)}  ${jefvcahs}`);
    // CCC0103: Discharge coefficient and thermal expansion coefficient (optional)
    if (params.dischargeCoeff !== undefined || params.thermalCoeff !== undefined) {
      const dischargeCoeff = params.dischargeCoeff !== undefined ? params.dischargeCoeff : 1.0;
      const thermalCoeff = params.thermalCoeff !== undefined ? params.thermalCoeff : 0.14;
      cards.push(`*            discharge     thermal`);
      cards.push(`${shortId}0103  ${this.formatNumber(dischargeCoeff)}  ${this.formatNumber(thermalCoeff)}`);
    }

    // CCC0201: Initial conditions
    const initControl = params.initialConditionType !== undefined ? params.initialConditionType : 1;
    const initLiquidFlow = params.initialLiquidFlow !== undefined ? params.initialLiquidFlow : 0.0;
    const initVaporFlow = params.initialVaporFlow !== undefined ? params.initialVaporFlow : 0.0;
    cards.push(`*`);
    cards.push(`*            cntrl         liqFlow        vapFlow       x`);
    cards.push(`${shortId}0201  ${String(initControl).padEnd(12)}  ${this.formatNumber(initLiquidFlow)}  ${this.formatNumber(initVaporFlow)}  0.0`);

    // CCC0300: Valve type
    cards.push(`*`);
    cards.push(`*            valve type`);
    cards.push(`${shortId}0300  ${valveSubType}`);

    // CCC0301: Valve-specific data
    cards.push(`*`);
    switch (valveSubType) {
      case 'trpvlv': {
        const tripNumber = params.tripNumber;
        cards.push(`*            trip number`);
        if (tripNumber != null) {
          cards.push(`${shortId}0301  ${tripNumber}`);
        } else {
          cards.push(`* WARNING: Trip number not set. Assign a Variable Trip (401-599).`);
          cards.push(`${shortId}0301  401`);
        }
        break;
      }

      case 'srvvlv': {
        const controlVariable = params.controlVariable;
        const valveTableNumber = params.valveTableNumber;
        cards.push(`*            cntrlvar${valveTableNumber != null ? '      table_nr' : ''}`);
        if (controlVariable != null) {
          const cvStr = String(controlVariable).padEnd(12);
          if (valveTableNumber != null) {
            cards.push(`${shortId}0301  ${cvStr}${valveTableNumber}`);
          } else {
            cards.push(`${shortId}0301  ${controlVariable}`);
          }
        } else {
          cards.push(`* WARNING: Control variable not set. Assign a Control Variable.`);
          cards.push(`${shortId}0301  101`);
        }
        break;
      }

      case 'mtrvlv': {
        const openTrip = params.openTripNumber;
        const closeTrip = params.closeTripNumber;
        const valveRate = params.valveRate !== undefined ? params.valveRate : 0.2;
        const initialPosition = params.initialPosition !== undefined ? params.initialPosition : 0.0;
        cards.push(`*            openTrip      closeTrip      rate          initPos`);
        if (openTrip == null || closeTrip == null) {
          cards.push(`* WARNING: Trip numbers not set. Assign Variable Trips for open/close.`);
        }
        cards.push(`${shortId}0301  ${String(openTrip ?? 510).padEnd(12)}  ${String(closeTrip ?? 510).padEnd(12)}  ${this.formatNumber(valveRate)}  ${this.formatNumber(initialPosition)}`);
        break;
      }

      case 'chkvlv': {
        const chkType = params.checkValveType ?? 0;
        const chkInitPos = params.checkInitialPosition ?? 0;
        const backPressure = params.closingBackPressure ?? 0.0;
        const leakRatio = params.leakRatio ?? 0.0;
        cards.push(`*            type          initPos       backP         leak`);
        cards.push(`${shortId}0301  ${String(chkType).padEnd(12)}  ${String(chkInitPos).padEnd(12)}  ${this.formatNumber(backPressure)}  ${this.formatNumber(leakRatio)}`);
        break;
      }
    }

    return cards;
  }

  /**
   * Generate global control cards from GlobalSettings
   */
  private generateGlobalCards(settings: GlobalSettings): string[] {
    const cards: string[] = [];

    // Card 001: Development Model Control (optional)
    if (settings.card001?.enabled && settings.card001.values.length > 0) {
      cards.push(`*`);
      cards.push(`* Card 001 : Development Model Control`);
      cards.push(`1  ${settings.card001.values.join('  ')}`);
      cards.push(`*`);
    }

    // Card 100: Problem Type
    if (settings.card100) {
      cards.push(`100   ${settings.card100.problemType.padEnd(8)}  ${settings.card100.calculationType}`);
    }
    
    // Card 101: Run Option
    if (settings.card101) {
      cards.push(`101   ${settings.card101.runOption}`);
    }
    
    cards.push('*');
    
    // Card 102: Units
    if (settings.card102) {
      cards.push(`102   ${settings.card102.inputUnits.padEnd(8)}  ${settings.card102.outputUnits}`);
    }

    // Determine if restart mode
    const isRestart = settings.card100?.problemType === 'restart';

    // Card 103: Restart Input File Control (required for RESTART, not allowed for NEW — MARS Manual 2.9)
    if (isRestart) {
      const restartNumber = settings.card103?.restartNumber ?? -1;
      cards.push(`*`);
      cards.push(`* Card 103 : Restart Input File Control`);
      cards.push(`103   ${restartNumber}`);
    }

    // Card 104: Restart-Plot File Control (optional)
    if (settings.card104?.enabled && settings.card104.fileName) {
      cards.push(`*`);
      cards.push(`* Card 104 : Restart-Plot File Control Card`);
      cards.push(`104  ${settings.card104.action.padEnd(10)}${settings.card104.fileName}`);
    }

    // Card 105: CPU Time Remaining and Diagnostic Edit (optional)
    if (settings.card105?.enabled) {
      cards.push(`*`);
      cards.push(`* Card 105 : CPU Time Remaining and Diagnostic Edit`);
      cards.push(`105  ${this.formatNumber(settings.card105.limit1)}${this.formatNumber(settings.card105.limit2)}`);
    }

    // Card 110: Non-condensable Gases (skip in restart mode — MARS Manual Card 110)
    if (!isRestart && settings.card110 && settings.card110.gases.length > 0) {
      const gasesStr = settings.card110.gases.join('  ');
      cards.push(`110   ${gasesStr}`);
      
      // Card 115: Gas Mass Fractions
      if (settings.card115 && settings.card115.fractions.length > 0) {
        const fractionsStr = settings.card115.fractions.map(f => f.toFixed(4)).join('  ');
        cards.push(`115   ${fractionsStr}`);
      }
    }
    
    cards.push('*');
    
    // Card 120-129: System Configuration (needed in both NEW and RESTART modes)
    if (settings.systems && settings.systems.length > 0) {
      cards.push('*' + '-'.repeat(79));
      cards.push('* SYSTEM CONFIGURATION');
      cards.push('*' + '-'.repeat(79));
      cards.push('*');
      
      // Sort systems by system number
      const sortedSystems = [...settings.systems].sort((a, b) => a.systemNumber - b.systemNumber);
      
      sortedSystems.forEach(sys => {
        const cardNum = 120 + sys.systemNumber;
        // Format elevation as float — MARS requires floating point format for this field
        const elevationStr = Number.isInteger(sys.referenceElevation)
          ? sys.referenceElevation.toFixed(1)
          : sys.referenceElevation.toString();
        // Convert VolumeReference to volumeId string
        const volumeId = this.resolver?.getVolumeIdFromReference(sys.referenceVolume) || '';
        // Format: cardNum  referenceVolume(12)  elevation(12)  fluid(6)  systemName
        // Match SMART.i format: "120  100010000      0.7965      h2o      pri-sys"
        cards.push(
          `${cardNum}   ${volumeId.padEnd(12)}  ${elevationStr.padEnd(12)}  ${sys.fluid.padEnd(6)}  ${sys.systemName}`
        );
      });
      
      cards.push('*');
    }
    
    // Card 200: Initial Time
    if (settings.card200 !== undefined) {
      cards.push('*' + '-'.repeat(79));
      cards.push('* TIME STEP CONTROL');
      cards.push('*' + '-'.repeat(79));
      cards.push('*');
      cards.push(`200   ${this.formatNumber(settings.card200.initialTime).trim()}`);
      cards.push('*');
    }
    
    // Card 201-299: Time Phases
    if (settings.timePhases && settings.timePhases.length > 0) {
      settings.timePhases.forEach((phase, idx) => {
        const cardNum = 201 + idx;
        const line = [
          cardNum.toString(),
          this.formatNumber(phase.endTime).trim(),
          phase.minDt.toExponential(1),
          phase.maxDt.toExponential(1),
          phase.controlOption,
          phase.minorEditFreq.toString(),
          phase.majorEditFreq.toString(),
          phase.restartFreq.toString()
        ].join('  ');
        
        cards.push(line);
      });
      
      cards.push('*');
    }
    
    return cards;
  }
  
  /**
   * Format an Interactive Input card (801-999)
   * Format: CardNumber  ControlType  Parameter  "Comment"
   */
  /**
   * Format a Minor Edit card (301-399 or 20800001+)
   */
  private formatMinorEditCard(edit: { cardNumber: number; variableType: string; parameter: string | number; lowerLimit?: number; upperLimit?: number; editGroup?: number; editPriority?: number; comment?: string }): string {
    const cardNum = edit.cardNumber.toString();
    const varType = edit.variableType.padEnd(10);
    const paramStr = edit.parameter.toString();
    const commentStr = edit.comment ? `     *${edit.comment}` : '';
    const lowerLimit = edit.lowerLimit ?? 0;
    const upperLimit = edit.upperLimit ?? 0;
    const editGroup = edit.editGroup ?? 0;
    const editPriority = edit.editPriority ?? 0;
    // 여분 필드가 모두 0(기본값)이면 생략 (MARS에서 기본값으로 처리)
    const hasExtras = lowerLimit !== 0 || upperLimit !== 0 || editGroup !== 0 || editPriority !== 0;
    if (hasExtras) {
      const lowerStr = this.formatNumber(lowerLimit);
      const upperStr = this.formatNumber(upperLimit);
      const groupStr = editGroup.toString().padEnd(6);
      const priorityStr = editPriority.toString().padEnd(6);
      return `${cardNum}  ${varType}${paramStr.padEnd(12)}${lowerStr}${upperStr}${groupStr}${priorityStr}${commentStr}`;
    }
    return `${cardNum}  ${varType}${paramStr}${commentStr}`;
  }

  private formatInteractiveInputCard(input: InteractiveInput): string {
    const cardNum = input.cardNumber.toString().padEnd(5);
    const controlType = input.controlType.padEnd(10);
    const param = input.parameter.toString().padEnd(12);
    const comment = input.comment ? `  "${input.comment}"` : '';
    return `${cardNum}${controlType}${param}${comment}`;
  }

  private formatNumber(value: number | undefined, width: number = 14): string {
    // Handle undefined/null values - use 0.0 as default
    if (value === undefined || value === null || isNaN(value)) {
      value = 0.0;
    }
    
    let result: string;
    
    // For very large numbers, check if we can fit them in the field width
    // MARS accepts both scientific notation and full decimal notation
    if (Math.abs(value) >= 1e6) {
      const fullDecimal = Number.isInteger(value) ? value.toFixed(1) : value.toString();
      
      // If the full decimal fits in the field width, use it (preserves exact value)
      // Otherwise, use scientific notation with high precision
      if (fullDecimal.length <= width) {
        result = fullDecimal;
      } else {
        // Use auto-precision to preserve all significant digits from input
        // e.g., 15125000 → 1.5125e+7, 169348000 → 1.69348e+8
        result = value.toExponential();
      }
    } else if (Math.abs(value) < 1e-3 && value !== 0) {
      // Very small numbers always use scientific notation
      // Auto-precision preserves all significant digits (no rounding)
      result = value.toExponential();
    } else {
      // For regular numbers, always include decimal point
      if (Number.isInteger(value)) {
        result = value.toFixed(1); // e.g., 1 -> 1.0
      } else {
        result = value.toString();
      }
    }
    
    // MARS Fortran 호환: 소수점 없는 과학적 표기법 방지
    // JS의 toExponential()은 정수 mantissa에서 "1e+6" 생성 → MARS가 잘못 파싱
    // "1e+6" → "1.0e+6", "-5e-3" → "-5.0e-3"
    if (/^-?\d+e/i.test(result)) {
      result = result.replace(/^(-?\d+)(e)/i, '$1.0$2');
    }

    // Minimal padding: single leading space ensures field separation.
    // MARS Fortran has 80-char line buffer; avoid excessive padding.
    return ' ' + result;
  }

  /**
   * MARS 정수(I) 타입 워드 포매팅
   * trip 번호, 제어 워드, 옵션 플래그 등 정수 필드에 사용
   */
  private formatInt(value: number | undefined, width: number = 14): string {
    if (value === undefined || value === null || isNaN(value)) {
      value = 0;
    }
    return Math.round(value).toString().padStart(width);
  }

  /**
   * Generate General Table Cards (202TTTNN)
   * x-y lookup tables referenced by FUNCTION CVs and Reactor Kinetics
   * Table 12.1-1: POWER, HTRNRATE, HTC-T, HTC-TEMP, TEMP, REAC-T, NORMAREA
   */
  private generateGeneralTableCards(tables: GeneralTable[]): string[] {
    const cards: string[] = [];
    const sortedTables = [...tables].sort((a, b) => a.tableNumber - b.tableNumber);

    for (const table of sortedTables) {
      const ttt = table.tableNumber.toString().padStart(3, '0');
      cards.push(`* General Table ${ttt} : ${table.name}`);

      // Header card: 202TTT00 — W1(A):type, W2(I):trip, W3-W5(R):factors (TTT = 3-digit zero-padded)
      const headerCardNum = `202${ttt}00`;
      const typeKeyword = table.type;
      const fields: string[] = [typeKeyword];

      // W2: Trip number (integer type)
      if (table.tripNumber !== undefined) {
        fields.push(this.formatInt(table.tripNumber, 0).trim());
      }

      // W3-W5: Factors (only output if explicitly set)
      const hasFactors = table.scaleX !== undefined || table.scaleY !== undefined || table.factor3 !== undefined;
      if (hasFactors) {
        // If trip was not added but factors exist, add 0 as trip placeholder
        if (table.tripNumber === undefined) {
          fields.push('0');
        }
        if (table.scaleX !== undefined) fields.push(this.formatNumber(table.scaleX).trim());
        if (table.scaleY !== undefined) fields.push(this.formatNumber(table.scaleY).trim());
        if (table.factor3 !== undefined) fields.push(this.formatNumber(table.factor3).trim());
      }

      cards.push(`${headerCardNum}   ${fields.join('   ')}`);

      // X/Y label comment
      const labelX = table.labelX || 'X';
      const labelY = table.labelY || 'Y';
      cards.push('*');
      cards.push(`*          ${labelX.padEnd(16)}${labelY}`);

      // Data point cards: 202TTTNN (NN = 01~99, preserve original card numbers if available)
      table.dataPoints.forEach((dp, idx) => {
        const nnVal = dp.cardIndex !== undefined ? dp.cardIndex : (idx + 1);
        const nn = nnVal.toString().padStart(2, '0');
        const dataCardNum = `202${ttt}${nn}`;  // 202 + TTT(3-digit) + NN(2-digit) = 8 digits
        const xStr = this.formatNumber(dp.x).trim();
        const yStr = this.formatNumber(dp.y).trim();
        cards.push(`${dataCardNum}   ${xStr}   ${yStr}`);
      });

      cards.push('*');
    }

    return cards;
  }

  /**
   * Generate Reactor Kinetics Cards (30000000 series)
   * Point Reactor Kinetics with separable/non-separable feedback
   */
  private generateReactorKineticsCards(kinetics: PointReactorKinetics): string[] {
    const cards: string[] = [];

    // 30000000 - Basic settings
    cards.push(`30000000   ${kinetics.kineticsType}   ${kinetics.feedbackType}`);

    // 30000001 - Neutron physics parameters
    const powerStr = this.formatNumber(kinetics.power).trim();
    const reactStr = this.formatNumber(kinetics.reactivity).trim();
    const invLambdaStr = this.formatNumber(kinetics.inverseLambda).trim();
    const fpyfStr = this.formatNumber(kinetics.fpyf).trim();
    cards.push(`30000001   ${kinetics.decayType}   ${powerStr}   ${reactStr}   ${invLambdaStr}   ${fpyfStr}`);

    // 30000002 - Decay heat
    const decayHeatStr = this.formatNumber(kinetics.additionalDecayHeat).trim();
    cards.push(`30000002   ${kinetics.ansStandard}   ${decayHeatStr}`);
    cards.push('*');

    // 30000011-0020 - Reactivity curve or control variable numbers (Section 16.8.1)
    const curveNumbers = kinetics.reactivityCurveNumbers
      ?? (kinetics.externalReactivityTableNumber !== undefined
        ? [kinetics.externalReactivityTableNumber] : []);
    if (curveNumbers.length > 0) {
      curveNumbers.forEach((num, idx) => {
        cards.push(`300000${(11 + idx).toString().padStart(2, '0')}   ${num}`);
      });
      cards.push('*');
    }

    // 30000101-0199 - Delayed neutron constants (Section 16.4)
    if (kinetics.delayedNeutronConstants && kinetics.delayedNeutronConstants.length > 0) {
      cards.push('* Delayed Neutron Constants');
      kinetics.delayedNeutronConstants.forEach((dnc, idx) => {
        const nn = (idx + 1).toString().padStart(2, '0');
        const yieldStr = this.formatNumber(dnc.yield).trim();
        const decayStr = this.formatNumber(dnc.decayConstant).trim();
        cards.push(`300001${nn}   ${yieldStr}   ${decayStr}`);
      });
      cards.push('*');
    }

    // 3000050N - Moderator density reactivity table
    if (kinetics.moderatorDensityReactivity.length > 0) {
      cards.push('* Moderator Density Reactivity');
      kinetics.moderatorDensityReactivity.forEach((dp, idx) => {
        const nn = (idx + 1).toString().padStart(2, '0');
        const valStr = this.formatNumber(dp.value).trim();
        const reactStr = this.formatNumber(dp.reactivity).trim();
        cards.push(`300005${nn}   ${valStr}   ${reactStr}`);
      });
      cards.push('*');
    }

    // 3000060N - Doppler reactivity table
    if (kinetics.dopplerReactivity.length > 0) {
      cards.push('* Doppler Reactivity');
      kinetics.dopplerReactivity.forEach((dp, idx) => {
        const nn = (idx + 1).toString().padStart(2, '0');
        const valStr = this.formatNumber(dp.value).trim();
        const reactStr = this.formatNumber(dp.reactivity).trim();
        cards.push(`300006${nn}   ${valStr}   ${reactStr}`);
      });
      cards.push('*');
    }

    // 3000070N - Density weighting factors
    if (kinetics.densityWeightingFactors.length > 0) {
      cards.push('* Density Weighting Factors');
      kinetics.densityWeightingFactors.forEach((wf, idx) => {
        const nn = (idx + 1).toString().padStart(2, '0');
        const incStr = this.formatNumber(wf.increment).trim();
        const factStr = this.formatNumber(wf.factor).trim();
        const coefStr = this.formatNumber(wf.coefficient).trim();
        cards.push(`300007${nn}   ${wf.componentId}   ${incStr}   ${factStr}   ${coefStr}`);
      });
      cards.push('*');
    }

    // 3000080N - Doppler weighting factors
    if (kinetics.dopplerWeightingFactors.length > 0) {
      cards.push('* Doppler Weighting Factors');
      kinetics.dopplerWeightingFactors.forEach((wf, idx) => {
        const nn = (idx + 1).toString().padStart(2, '0');
        const incStr = this.formatNumber(wf.increment).trim();
        const factStr = this.formatNumber(wf.factor).trim();
        const coefStr = this.formatNumber(wf.coefficient).trim();
        cards.push(`300008${nn}   ${wf.componentId}   ${incStr}   ${factStr}   ${coefStr}`);
      });
    }

    return cards;
  }

  /**
   * Generate Thermal Property Cards (201MMMNN)
   * Heat Structure Thermal Properties
   */
  private generateThermalPropertyCards(properties: ThermalProperty[]): string[] {
    const cards: string[] = [];

    // Sort by material number
    const sortedProperties = [...properties].sort((a, b) => a.materialNumber - b.materialNumber);

    for (const prop of sortedProperties) {
      const mmm = prop.materialNumber.toString().padStart(3, '0');

      cards.push(`* Material ${mmm}: ${prop.name}`);
      cards.push('*');

      // Built-in materials: only output material type
      if (prop.materialType !== 'TBL/FCTN') {
        cards.push(`201${mmm}00     ${prop.materialType}`);
        cards.push('*');
        continue;
      }

      // TBL/FCTN: Include W2 (conductivity format) and W3 (capacity format)
      const w2 = prop.conductivityFormat ?? 1;
      // W3 is always required for TBL/FCTN (per MARS manual Section 10.1)
      const w3 = prop.capacityFormat ?? 1;
      cards.push(`201${mmm}00     tbl/fctn     ${w2}     ${w3}`);

      // Thermal Conductivity Data (201MMM01-49)
      if (w2 === 1) {
        // Table format
        if (prop.isConstantConductivity && prop.constantConductivity !== undefined) {
          // Constant conductivity
          cards.push(`201${mmm}01     ${this.formatNumber(prop.constantConductivity)}`);
        } else if (prop.conductivityTable && prop.conductivityTable.length > 0) {
          // Temperature-conductivity table
          cards.push('*            Temp (K)       k (W/m-K)');
          prop.conductivityTable.forEach((entry, idx) => {
            const nn = (idx + 1).toString().padStart(2, '0');
            cards.push(`201${mmm}${nn}     ${this.formatNumber(entry.temperature)}     ${this.formatNumber(entry.value)}`);
          });
        }
      } else if (w2 === 3) {
        // Gap gas composition
        if (prop.gapGasComposition && prop.gapGasComposition.length > 0) {
          cards.push('*            Gas Name       Mole Fraction');
          prop.gapGasComposition.forEach((gas, idx) => {
            const nn = (idx + 1).toString().padStart(2, '0');
            cards.push(`201${mmm}${nn}     ${gas.gasName.toLowerCase().padEnd(12)}     ${this.formatNumber(gas.moleFraction)}`);
          });
        }
      }

      // Volumetric Heat Capacity Data (201MMM51-99)
      // Required for all TBL/FCTN materials including Gap Gas (W2=3)
      if (w2 === 1 || w2 === 3) {
        cards.push('*');

        if (prop.isConstantCapacity && prop.constantCapacity !== undefined) {
          // Constant capacity
          cards.push(`201${mmm}51     ${this.formatNumber(prop.constantCapacity)}`);
        } else if (prop.capacityFormat === -1 && prop.capacityValues && prop.capacityValues.length > 0) {
          // W3=-1: Values only (temperatures shared with conductivity table)
          cards.push('*            rho*Cp (J/m3-K)');
          prop.capacityValues.forEach((value, idx) => {
            const nn = (51 + idx).toString().padStart(2, '0');
            cards.push(`201${mmm}${nn}     ${this.formatNumber(value)}`);
          });
        } else if (prop.capacityFormat === 1 && prop.capacityTable && prop.capacityTable.length > 0) {
          // W3=1: Separate temperature-capacity table
          cards.push('*            Temp (K)       rho*Cp (J/m3-K)');
          prop.capacityTable.forEach((entry, idx) => {
            const nn = (51 + idx).toString().padStart(2, '0');
            cards.push(`201${mmm}${nn}     ${this.formatNumber(entry.temperature)}     ${this.formatNumber(entry.value)}`);
          });
        }
      }

      cards.push('*');
    }

    return cards;
  }

  /**
   * Generate Control Variable Cards (205CCCNN)
   * Control System Variable Definitions
   *
   * All 22 types supported (MPLEX excluded)
   *
   * Card Format:
   * - 205CCC00: Type definition card
   * - 205CCC01-98: Data cards (type-specific)
   */
  /** CV 카드 필드 포맷: 최소 minWidth 보장 + 항상 2칸 이상 후행 공백 */
  private cvField(value: string, minWidth: number = 10): string {
    return value.padEnd(Math.max(value.length + 2, minWidth));
  }

  private generateControlVariableCards(controlVariables: ControlVariable[]): string[] {
    const cards: string[] = [];

    // Sort by control variable number
    const sortedVars = [...controlVariables].sort((a, b) => a.number - b.number);

    for (const cv of sortedVars) {
      const ccc = cv.number.toString().padStart(3, '0');

      // Comment with variable name
      cards.push(`* Control Variable ${ccc}: ${cv.name}`);
      if (cv.comment) {
        cards.push(`* ${cv.comment}`);
      }
      cards.push('*');

      if (isConstantControlVariable(cv)) {
        // CONSTANT type: Special case (Manual p278, Section 14.3.17)
        // Card 205CCC00: W1=name, W2='constant', W3=constant value
        // No data cards required
        const fields = [cv.name || '', 'constant', this.formatNumber(cv.scalingFactor).trim()];
        cards.push(`205${ccc}00   ${fields.join('  ')}`);
      } else if (isNonConstantControlVariable(cv)) {
        const compType = cv.componentType.toLowerCase();

        // Card 205CCC00: W1=name, W2=type, W3=scalingFactor, W4=initialValue, W5=flag, W6=limiter [W7=min/max] [W8=max]
        // Reference: 20560900   vlv_ctrl  feedctl    1.0       0.1       0      3     0.0      1.0
        // 자유 포맷: 필드 간 명시적 공백 구분자 사용 (padEnd 결합 시 필드 병합 방지)
        const fields: string[] = [
          cv.name || '',
          compType,
          this.formatNumber(cv.scalingFactor).trim(),
          this.formatNumber(cv.initialValue).trim(),
          cv.initialValueFlag.toString(),
        ];

        const limiter = cv.limiterControl ?? 0;
        if (cv.limiterControl !== undefined) {
          fields.push(limiter.toString());
        }

        if (limiter > 0) {
          if (limiter === 1 && cv.minValue !== undefined) {
            fields.push(this.formatNumber(cv.minValue).trim());
          } else if (limiter === 2 && cv.maxValue !== undefined) {
            fields.push(this.formatNumber(cv.maxValue).trim());
          } else if (limiter === 3) {
            if (cv.minValue !== undefined) {
              fields.push(this.formatNumber(cv.minValue).trim());
            }
            if (cv.maxValue !== undefined) {
              fields.push(this.formatNumber(cv.maxValue).trim());
            }
          }
        }

        cards.push(`205${ccc}00   ${fields.join('  ')}`);

        // Data cards based on component type
        if (cv.componentType === 'SUM') {
          const sumData = cv.data as SumData;
          if (sumData.terms && sumData.terms.length > 0) {
            // First data card (205CCC01): W1=A0, W2=A1, W3=varName, W4=varCode
            // Reference: 20530101   0.0    1.0    q        120020000
            const firstTerm = sumData.terms[0];
            const a0 = this.cvField(this.formatNumber(sumData.constant || 0).trim());
            const a1 = this.cvField(this.formatNumber(firstTerm.coefficient).trim());
            const v1 = this.cvField(firstTerm.variable?.variableName || '');
            const c1 = firstTerm.variable?.parameterCode !== undefined
              ? firstTerm.variable.parameterCode.toString() : '';

            cards.push(`205${ccc}01   ${a0}${a1}${v1}${c1}`);

            // Subsequent data cards (205CCC02+): W1=blank, W2=Aj, W3=varName, W4=varCode
            // Reference: 20530102          1.0    q        120030000
            for (let i = 1; i < sumData.terms.length; i++) {
              const term = sumData.terms[i];
              const nn = (i + 1).toString().padStart(2, '0');
              const ai = this.cvField(this.formatNumber(term.coefficient).trim());
              const vi = this.cvField(term.variable?.variableName || '');
              const ci = term.variable?.parameterCode !== undefined
                ? term.variable.parameterCode.toString() : '';

              cards.push(`205${ccc}${nn}   ${''.padEnd(7)}${ai}${vi}${ci}`);
            }
          }
        } else if (cv.componentType === 'TRIPUNIT') {
          const tripData = cv.data as TripUnitData;
          // Card 205CCC01: W1=trip number
          cards.push(`205${ccc}01   ${tripData.tripNumber.toString()}`);

        } else if (cv.componentType === 'TRIPDLAY') {
          const tripData = cv.data as TripDelayData;
          // Card 205CCC01: W1=trip number (same format as TRIPUNIT)
          cards.push(`205${ccc}01   ${tripData.tripNumber.toString()}`);

        } else if (cv.componentType === 'FUNCTION') {
          const funcData = cv.data as FunctionData;
          // Card 205CCC01: W1=varName, W2=varCode, W3=tableNumber
          // Reference: 20551101  cntrlvar  510    501
          const v1 = this.cvField(funcData.variable?.variableName || '');
          const c1 = funcData.variable?.parameterCode !== undefined
            ? this.cvField(funcData.variable.parameterCode.toString()) : '';
          const tbl = funcData.tableNumber.toString();
          cards.push(`205${ccc}01   ${v1}${c1}${tbl}`);

        } else if (cv.componentType === 'STDFNCTN') {
          const stdData = cv.data as StdFunctionData;
          // Card 205CCC01: W1=functionName, W2=varName1, W3=varCode1 [, W4=varName2, W5=varCode2]
          // Reference: 20551201  max  cntrlvar  513  cntrlvar  514
          const fn = this.cvField(stdData.functionName || '');
          let argStr = '';
          if (stdData.arguments && stdData.arguments.length > 0) {
            argStr = stdData.arguments.map(arg => {
              const vn = this.cvField(arg.variableName || '');
              const vc = arg.parameterCode !== undefined ? arg.parameterCode.toString() : '';
              return `${vn}${vc}`;
            }).join('  ');
          }
          cards.push(`205${ccc}01   ${fn}${argStr}`);

        } else if (cv.componentType === 'MULT') {
          const multData = cv.data as MultData;
          // Card 205CCC01: W1=varName1, W2=varCode1, W3=varName2, W4=varCode2, ...
          // Reference: 20555601  cntrlvar  557  cntrlvar  555
          if (multData.factors && multData.factors.length > 0) {
            const factorStr = multData.factors.map(f => {
              const vn = this.cvField(f.variableName || '');
              const vc = f.parameterCode !== undefined ? f.parameterCode.toString() : '';
              return `${vn}${vc}`;
            }).join('  ');
            cards.push(`205${ccc}01   ${factorStr}`);
          }

        } else if (cv.componentType === 'DIV') {
          const divData = cv.data as DivData;
          // Card 205CCC01: W1=varName1(denom), W2=varCode1 [, W3=varName2(numer), W4=varCode2]
          const v1 = this.cvField(divData.denominator?.variableName || '');
          const c1 = divData.denominator?.parameterCode !== undefined
            ? this.cvField(divData.denominator.parameterCode.toString()) : '';
          let line = `205${ccc}01   ${v1}${c1}`;
          if (divData.numerator) {
            const v2 = this.cvField(divData.numerator.variableName || '');
            const c2 = divData.numerator.parameterCode !== undefined
              ? divData.numerator.parameterCode.toString() : '';
            line += `  ${v2}${c2}`;
          }
          cards.push(line);

        } else if (cv.componentType === 'INTEGRAL' || cv.componentType === 'DIFFRENI' || cv.componentType === 'DIFFREND') {
          const singleData = cv.data as SingleVariableData;
          // Card 205CCC01: W1=varName, W2=varCode
          // Reference: 20560201  cntrlvar  600
          const v1 = this.cvField(singleData.variable?.variableName || '');
          const c1 = singleData.variable?.parameterCode !== undefined
            ? singleData.variable.parameterCode.toString() : '';
          cards.push(`205${ccc}01   ${v1}${c1}`);

        } else if (cv.componentType === 'PROP-INT') {
          const piData = cv.data as PropIntData;
          // Card 205CCC01: W1=A1(proportionalGain), W2=A2(integralGain), W3=varName, W4=varCode
          // Reference: 20551701  1.0  5.5556e-4  cntrlvar  516
          const a1 = this.cvField(this.formatNumber(piData.proportionalGain).trim());
          const a2 = this.cvField(this.formatNumber(piData.integralGain).trim(), 12);
          const v1 = this.cvField(piData.variable?.variableName || '');
          const c1 = piData.variable?.parameterCode !== undefined
            ? piData.variable.parameterCode.toString() : '';
          cards.push(`205${ccc}01   ${a1}${a2}${v1}${c1}`);

        } else if (cv.componentType === 'LAG') {
          const lagData = cv.data as LagData;
          // Card 205CCC01: W1=lagTime(A1), W2=varName, W3=varCode
          const a1 = this.cvField(this.formatNumber(lagData.lagTime).trim());
          const v1 = this.cvField(lagData.variable?.variableName || '');
          const c1 = lagData.variable?.parameterCode !== undefined
            ? lagData.variable.parameterCode.toString() : '';
          cards.push(`205${ccc}01   ${a1}${v1}${c1}`);

        } else if (cv.componentType === 'LEAD-LAG') {
          const llData = cv.data as LeadLagData;
          // Card 205CCC01: W1=leadTime(A1), W2=lagTime(A2), W3=varName, W4=varCode
          const a1 = this.cvField(this.formatNumber(llData.leadTime).trim());
          const a2 = this.cvField(this.formatNumber(llData.lagTime).trim());
          const v1 = this.cvField(llData.variable?.variableName || '');
          const c1 = llData.variable?.parameterCode !== undefined
            ? llData.variable.parameterCode.toString() : '';
          cards.push(`205${ccc}01   ${a1}${a2}${v1}${c1}`);

        } else if (cv.componentType === 'POWERI') {
          const piData = cv.data as PowerIData;
          // Card 205CCC01: W1=varName, W2=varCode, W3=integerPower
          const v1 = this.cvField(piData.variable?.variableName || '');
          const c1 = piData.variable?.parameterCode !== undefined
            ? this.cvField(piData.variable.parameterCode.toString()) : '';
          const pw = piData.integerPower.toString();
          cards.push(`205${ccc}01   ${v1}${c1}${pw}`);

        } else if (cv.componentType === 'POWERR') {
          const prData = cv.data as PowerRData;
          // Card 205CCC01: W1=varName, W2=varCode, W3=realPower
          const v1 = this.cvField(prData.variable?.variableName || '');
          const c1 = prData.variable?.parameterCode !== undefined
            ? this.cvField(prData.variable.parameterCode.toString()) : '';
          const pw = this.formatNumber(prData.realPower).trim();
          cards.push(`205${ccc}01   ${v1}${c1}${pw}`);

        } else if (cv.componentType === 'POWERX') {
          const pxData = cv.data as PowerXData;
          // Card 205CCC01: W1=baseName, W2=baseCode, W3=exponentName, W4=exponentCode
          const v1 = this.cvField(pxData.base?.variableName || '');
          const c1 = pxData.base?.parameterCode !== undefined
            ? this.cvField(pxData.base.parameterCode.toString()) : '';
          const v2 = this.cvField(pxData.exponent?.variableName || '');
          const c2 = pxData.exponent?.parameterCode !== undefined
            ? pxData.exponent.parameterCode.toString() : '';
          cards.push(`205${ccc}01   ${v1}${c1}${v2}${c2}`);

        } else if (cv.componentType === 'DELAY') {
          const delayData = cv.data as DelayData;
          // Card 205CCC01: W1=varName, W2=varCode, W3=delayTime, W4=holdPositions
          const v1 = this.cvField(delayData.variable?.variableName || '');
          const c1 = delayData.variable?.parameterCode !== undefined
            ? this.cvField(delayData.variable.parameterCode.toString()) : '';
          const dt = this.cvField(this.formatNumber(delayData.delayTime).trim());
          const hp = delayData.holdPositions.toString();
          cards.push(`205${ccc}01   ${v1}${c1}${dt}${hp}`);

        } else if (cv.componentType === 'DIGITAL') {
          const digData = cv.data as DigitalData;
          // Card 205CCC01: W1=varName, W2=varCode, W3=samplingTime, W4=delayTime
          const v1 = this.cvField(digData.variable?.variableName || '');
          const c1 = digData.variable?.parameterCode !== undefined
            ? this.cvField(digData.variable.parameterCode.toString()) : '';
          const st = this.cvField(this.formatNumber(digData.samplingTime).trim());
          const dt = this.formatNumber(digData.delayTime).trim();
          cards.push(`205${ccc}01   ${v1}${c1}${st}${dt}`);

        } else if (cv.componentType === 'PUMPCTL' || cv.componentType === 'STEAMCTL') {
          const ctlData = cv.data as PumpctlData | SteamctlData;
          // Card 205CCC01: W1=setpointName, W2=setpointCode, W3=sensedName, W4=sensedCode,
          //                W5=scaleFactor, W6=integralTime, W7=proportionalTime
          const spN = this.cvField(ctlData.setpointVariable?.variableName || '');
          const spC = ctlData.setpointVariable?.parameterCode !== undefined
            ? this.cvField(ctlData.setpointVariable.parameterCode.toString()) : '';
          const snN = this.cvField(ctlData.sensedVariable?.variableName || '');
          const snC = ctlData.sensedVariable?.parameterCode !== undefined
            ? this.cvField(ctlData.sensedVariable.parameterCode.toString()) : '';
          const sf = this.cvField(this.formatNumber(ctlData.scaleFactor).trim());
          const ti = this.cvField(this.formatNumber(ctlData.integralTime).trim());
          const tp = this.formatNumber(ctlData.proportionalTime).trim();
          cards.push(`205${ccc}01   ${spN}${spC}${snN}${snC}${sf}${ti}${tp}`);

        } else if (cv.componentType === 'FEEDCTL') {
          const feedData = cv.data as FeedctlData;
          // FEEDCTL: 12 words across multiple cards
          // Card 205CCC01: W1=sp1Name, W2=sp1Code, W3=sn1Name, W4=sn1Code, W5=scale1
          const sp1N = this.cvField(feedData.setpointVariable1?.variableName || '');
          const sp1C = feedData.setpointVariable1?.parameterCode !== undefined
            ? this.cvField(feedData.setpointVariable1.parameterCode.toString()) : '';
          const sn1N = this.cvField(feedData.sensedVariable1?.variableName || '');
          const sn1C = feedData.sensedVariable1?.parameterCode !== undefined
            ? this.cvField(feedData.sensedVariable1.parameterCode.toString()) : '';
          const sf1 = this.formatNumber(feedData.scaleFactor1).trim();
          cards.push(`205${ccc}01   ${sp1N}${sp1C}${sn1N}${sn1C}${sf1}`);

          // Card 205CCC02: W6=sp2Name, W7=sp2Code, W8=sn2Name, W9=sn2Code, W10=scale2
          const sp2N = this.cvField(feedData.setpointVariable2?.variableName || '');
          const sp2C = feedData.setpointVariable2?.parameterCode !== undefined
            ? this.cvField(feedData.setpointVariable2.parameterCode.toString()) : '';
          const sn2N = this.cvField(feedData.sensedVariable2?.variableName || '');
          const sn2C = feedData.sensedVariable2?.parameterCode !== undefined
            ? this.cvField(feedData.sensedVariable2.parameterCode.toString()) : '';
          const sf2 = this.formatNumber(feedData.scaleFactor2).trim();
          cards.push(`205${ccc}02   ${sp2N}${sp2C}${sn2N}${sn2C}${sf2}`);

          // Card 205CCC03: W11=integralTime(T6), W12=proportionalTime(T5)
          const ti = this.cvField(this.formatNumber(feedData.integralTime).trim());
          const tp = this.formatNumber(feedData.proportionalTime).trim();
          cards.push(`205${ccc}03   ${ti}${tp}`);

        } else if (cv.componentType === 'SHAFT') {
          const shaftData = cv.data as ShaftData;

          // Card 205CCC01: Shaft Description (매뉴얼 14.3.18.1)
          // W1=torqueCV, W2=inertia, W3=friction
          const torqueCV = shaftData.torqueControlVariable.toString();
          const inertia = this.formatNumber(shaftData.momentOfInertia).trim();
          const friction = this.formatNumber(shaftData.frictionFactor).trim();
          cards.push(`205${ccc}01   ${torqueCV}  ${inertia}  ${friction}`);

          // Cards 205CCC02~05: Attached components (max 4 type+number pairs per card)
          const comps = shaftData.attachedComponents;
          let cardIdx = 2;
          for (let i = 0; i < comps.length; i += 4) {
            const chunk = comps.slice(i, i + 4);
            const pairStr = chunk.map(c => {
              const typeStr = c.type.toLowerCase().padEnd(9);
              const numStr = c.componentNumber.toString();
              return `${typeStr}${numStr}`;
            }).join('    ');
            const nn = cardIdx.toString().padStart(2, '0');
            cards.push(`205${ccc}${nn}   ${pairStr}`);
            cardIdx++;
          }

          // Card 205CCC06: Generator Description (optional)
          if (shaftData.generatorData) {
            const gen = shaftData.generatorData;
            const iniV = this.formatNumber(gen.initialVelocity);
            const synV = this.formatNumber(gen.synchronousVelocity);
            const moment = this.formatNumber(gen.momentOfInertia);
            const fric = this.formatNumber(gen.frictionFactor);
            const trip1 = gen.tripNumber1.toString();
            const trip2 = gen.tripNumber2.toString();
            cards.push(`205${ccc}06  ${iniV}${synV}${moment}${fric}  ${trip1}  ${trip2}`);
          }
        }
      }

      cards.push('*');
    }

    return cards;
  }
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

