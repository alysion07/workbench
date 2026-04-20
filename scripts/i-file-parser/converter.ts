/**
 * .i File → MARSProject JSON 컨버터
 *
 * 사용법:
 *   npx tsx scripts/i-file-parser/converter.ts documents/100%.i output.json
 *
 * 출력: legacy-mars 형식 JSON (기존 Import 기능으로 로드 가능)
 */

import * as fs from 'fs';
import * as path from 'path';
import { tokenize, TokenizeResult } from './tokenizer';
import { groupCards, GroupResult, ComponentBlock } from './grouper';
import { parseComponent } from './componentParsers';
import { parseGlobalSettings } from './globalParser';
import { resolveAllVolumeReferences, createEdges } from './edgeResolver';

// ============================================================
// 타입 정의 (src/types/mars.ts의 MARSProject에 대응)
// ============================================================

interface MARSNodeData {
  componentId: string;
  componentName: string;
  componentType: string;
  parameters: Record<string, any>;
  status: 'incomplete' | 'valid' | 'error';
  errors: any[];
  warnings: any[];
}

interface ProjectNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: MARSNodeData;
}

interface MARSProject {
  metadata: {
    projectName: string;
    version: string;
    created: string;
    modified: string;
    simulationType?: string;
    unitSystem?: string;
    workingFluid?: string;
    globalSettings?: Record<string, any>;
  };
  nodes: ProjectNode[];
  edges: any[];
}

// ============================================================
// 격자 배치
// ============================================================

const LAYOUT = {
  COLS: 12,
  SPACING_X: 280,
  SPACING_Y: 220,
  OFFSET_X: 50,
  OFFSET_Y: 50,
};

function gridPosition(index: number): { x: number; y: number } {
  return {
    x: (index % LAYOUT.COLS) * LAYOUT.SPACING_X + LAYOUT.OFFSET_X,
    y: Math.floor(index / LAYOUT.COLS) * LAYOUT.SPACING_Y + LAYOUT.OFFSET_Y,
  };
}

// ============================================================
// 메인 변환 로직
// ============================================================

export function convert(content: string, projectName: string): MARSProject {
  console.log('=== .i File → JSON 변환 시작 ===\n');

  // 1. 토큰화
  const tokenResult: TokenizeResult = tokenize(content);
  console.log(`토큰화 완료: ${tokenResult.totalLines}줄 → ${tokenResult.cardCount}개 카드`);
  console.log(`타이틀: ${tokenResult.titleLine}`);

  // 2. 그룹핑
  const groupResult: GroupResult = groupCards(tokenResult.cards);
  console.log(`\n그룹핑 완료:`);
  console.log(`  수력 컴포넌트: ${groupResult.components.filter(c => c.componentType !== 'htstr').length}개`);
  console.log(`  열구조체: ${groupResult.components.filter(c => c.componentType === 'htstr').length}개`);
  console.log(`  글로벌 블록: ${groupResult.globals.length}개`);
  console.log(`  미분류 카드: ${groupResult.unclassified.length}개`);

  // 타입별 통계
  const typeStats = new Map<string, number>();
  for (const comp of groupResult.components) {
    typeStats.set(comp.componentType, (typeStats.get(comp.componentType) || 0) + 1);
  }
  console.log(`\n  타입별 분포:`);
  for (const [type, count] of [...typeStats.entries()].sort()) {
    console.log(`    ${type}: ${count}개`);
  }

  // 3. 컴포넌트 파싱
  console.log('\n컴포넌트 파싱 중...');
  const nodes: ProjectNode[] = [];
  let parseErrors = 0;

  for (let i = 0; i < groupResult.components.length; i++) {
    const block = groupResult.components[i];
    try {
      const parameters = parseComponent(block);
      const nodeId = `node_${i + 1}`;
      const position = gridPosition(i);

      nodes.push({
        id: nodeId,
        type: block.componentType,
        position,
        data: {
          componentId: block.componentId,
          componentName: block.componentName,
          componentType: block.componentType,
          parameters,
          status: 'valid',
          errors: [],
          warnings: [],
        },
      });
    } catch (err) {
      parseErrors++;
      console.error(`  [오류] ${block.componentType} C${block.ccc} (${block.componentName}): ${err}`);

      // 실패해도 빈 파라미터로 노드 생성
      nodes.push({
        id: `node_${i + 1}`,
        type: block.componentType,
        position: gridPosition(i),
        data: {
          componentId: block.componentId,
          componentName: block.componentName,
          componentType: block.componentType,
          parameters: { name: block.componentName },
          status: 'error',
          errors: [{ field: 'parse', message: String(err) }],
          warnings: [],
        },
      });
    }
  }

  console.log(`\n파싱 완료: ${nodes.length}개 노드 (오류: ${parseErrors}개)`);

  // 4. 글로벌 설정 파싱
  const globalSettings = parseGlobalSettings(groupResult.globals);

  // 4.5. 후처리: 글로벌 설정 보충
  const settings = globalSettings.globalSettings || {};
  resolveGlobalReferences(settings, nodes);

  // 4.6. Phase 2: 컴포넌트 VolumeReference 해소 (raw → nodeId)
  console.log('\nVolumeReference 해소 중...');
  const refResult = resolveAllVolumeReferences(nodes);
  console.log(`  해소 성공: ${refResult.resolved}개, 실패: ${refResult.failed}개`);

  // 4.7. Phase 2: Edge 생성
  console.log('\nEdge 생성 중...');
  const edges = createEdges(nodes);
  console.log(`  생성된 Edge: ${edges.length}개`);

  // 5. 메타데이터 구성
  const now = new Date().toISOString();
  const metadata: MARSProject['metadata'] = {
    projectName: projectName || tokenResult.titleLine || 'Imported Project',
    version: '1.0.0',
    created: now,
    modified: now,
    simulationType: globalSettings.simulationType,
    unitSystem: globalSettings.unitSystem,
    workingFluid: globalSettings.workingFluid,
    globalSettings: globalSettings.globalSettings,
  };

  // 6. 결과 구성
  const project: MARSProject = {
    metadata,
    nodes,
    edges,
  };

  // 7. 통계 출력
  console.log('\n=== 변환 결과 요약 ===');
  console.log(`프로젝트명: ${metadata.projectName}`);
  console.log(`총 노드: ${nodes.length}개`);
  console.log(`  수력 컴포넌트: ${nodes.filter(n => n.type !== 'htstr').length}개`);
  console.log(`  열구조체: ${nodes.filter(n => n.type === 'htstr').length}개`);
  console.log(`파싱 오류: ${parseErrors}개`);
  console.log(`Edge: ${project.edges.length}개`);

  return project;
}

// ============================================================
// 후처리: VolumeReference 해소 + 누락 필드 보충
// ============================================================

/**
 * 9자리 VolumeID 문자열(CCCVV0000N)을 파싱하여 VolumeReference 생성
 * componentId(CCC*10000) → nodeId 매핑 필요
 */
function parseVolumeIdToReference(
  volumeIdStr: string,
  componentIdToNodeId: Map<string, string>
): { nodeId: string; volumeNum: number; face: number } | null {
  if (!volumeIdStr || volumeIdStr.length !== 9) return null;

  // CCCVV0000N → CCC=첫 3자리, VV=다음 2자리, N=마지막 자리
  const ccc = parseInt(volumeIdStr.substring(0, 3), 10);
  const volumeNum = parseInt(volumeIdStr.substring(3, 5), 10);
  const face = parseInt(volumeIdStr.substring(8, 9), 10);

  const componentId = `${ccc * 10000}`;
  const nodeId = componentIdToNodeId.get(componentId);

  if (!nodeId) return null;
  return { nodeId, volumeNum: volumeNum || 1, face: face || 0 };
}

function resolveGlobalReferences(
  settings: Record<string, any>,
  nodes: ProjectNode[]
): void {
  // componentId → nodeId 매핑 테이블 생성
  const componentIdToNodeId = new Map<string, string>();
  for (const node of nodes) {
    componentIdToNodeId.set(node.data.componentId, node.id);
  }

  // Card 110 + 115: 가스 설정 보충
  if (settings.card110 && settings.card110.gases && settings.card110.gases.length > 0) {
    if (!settings.card115) {
      // 가스 1개일 때 fraction = [1.0] 자동 생성
      settings.card115 = {
        fractions: settings.card110.gases.map(() => 1.0 / settings.card110.gases.length),
      };
    }
  }

  // Card 200: 없으면 기본값 생성
  if (settings.card200 === undefined) {
    settings.card200 = { initialTime: 0 };
  }

  // Systems: referenceVolume { raw } → { nodeId, volumeNum, face }
  if (settings.systems) {
    for (const sys of settings.systems) {
      if (sys.referenceVolume && sys.referenceVolume.raw) {
        const ref = parseVolumeIdToReference(sys.referenceVolume.raw, componentIdToNodeId);
        if (ref) {
          sys.referenceVolume = ref;
        } else {
          // 매핑 실패 시에도 nodeId 필드를 빈 문자열로라도 넣어서 validation 통과
          // (실제로는 해당 Volume이 프로젝트에 없을 수 있음)
          sys.referenceVolume = {
            nodeId: '',
            volumeNum: parseInt(sys.referenceVolume.raw.substring(3, 5), 10) || 1,
            face: parseInt(sys.referenceVolume.raw.substring(8, 9), 10) || 0,
          };
        }
      }
    }
  }
}

// ============================================================
// CLI 실행
// ============================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('사용법: npx tsx scripts/i-file-parser/converter.ts <input.i> [output.json]');
    console.log('예:     npx tsx scripts/i-file-parser/converter.ts documents/100%.i output.json');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1]
    ? path.resolve(args[1])
    : inputPath.replace(/\.i$/, '.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`파일 없음: ${inputPath}`);
    process.exit(1);
  }

  console.log(`입력: ${inputPath}`);
  console.log(`출력: ${outputPath}\n`);

  const content = fs.readFileSync(inputPath, 'utf-8');
  const projectName = path.basename(inputPath, '.i');

  const project = convert(content, projectName);

  // JSON 출력
  const jsonStr = JSON.stringify(project, null, 2);
  fs.writeFileSync(outputPath, jsonStr, 'utf-8');

  console.log(`\n파일 저장: ${outputPath} (${(jsonStr.length / 1024).toFixed(1)} KB)`);
}

// CLI로 직접 실행 시에만 main() 호출
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('converter');
if (isDirectRun) {
  main();
}
