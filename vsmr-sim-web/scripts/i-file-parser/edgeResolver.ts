/**
 * Phase 2: VolumeReference 해소 + ReactFlow Edge 생성
 *
 * 1. 모든 노드 파라미터의 { raw: "CCCVV000N" } → { nodeId, volumeNum, face } 변환
 * 2. Junction 연결 정보로부터 ReactFlow Edge 생성
 */

// ============================================================
// 타입 정의
// ============================================================

interface VolumeReference {
  nodeId: string;
  volumeNum: number;
  face: number;
}

interface RawVolumeRef {
  raw: string;
}

interface ProjectNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    componentId: string;
    componentName: string;
    componentType: string;
    parameters: Record<string, any>;
    status: string;
    errors: any[];
    warnings: any[];
  };
}

interface MARSEdgeData {
  fromVolume: VolumeReference;
  toVolume: VolumeReference;
  connectionType: 'axial' | 'crossflow';
  junctionNodeId?: string;
  junctionNumber?: number;
  area?: number;
  fwdLoss?: number;
  revLoss?: number;
  jefvcahs?: string;
  label?: string;
}

interface ProjectEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type?: string;
  data: MARSEdgeData;
}

// ============================================================
// CCC → nodeId 매핑 테이블
// ============================================================

function buildCccToNodeMap(nodes: ProjectNode[]): Map<string, ProjectNode> {
  const map = new Map<string, ProjectNode>();
  for (const node of nodes) {
    // VolumeReference(CCCVV000N)는 수력 컴포넌트만 참조
    // HS(8자리 componentId)는 제외하여 CCC 충돌 방지
    if (node.data.componentType === 'htstr') continue;

    const cid = node.data.componentId;
    if (cid && cid.length >= 3) {
      // componentId = CCC * 10000 (e.g., "1300000") → CCC = "130"
      const ccc = cid.slice(0, 3);
      map.set(ccc, node);
    }
  }
  return map;
}

// ============================================================
// raw → VolumeReference 변환
// ============================================================

function resolveRawRef(
  raw: string,
  cccMap: Map<string, ProjectNode>
): VolumeReference | null {
  if (!raw || raw.length < 7 || raw === '000000000' || raw === '0') return null;

  // 9자리: CCCVV000N
  const padded = raw.padStart(9, '0');
  const ccc = padded.substring(0, 3);
  const vv = parseInt(padded.substring(3, 5), 10);
  const face = parseInt(padded.substring(8, 9), 10);

  const node = cccMap.get(ccc);
  if (!node) return null;

  return {
    nodeId: node.id,
    volumeNum: vv,
    face: face,
  };
}

function isRawRef(obj: any): obj is RawVolumeRef {
  return obj && typeof obj === 'object' && typeof obj.raw === 'string' && !obj.nodeId;
}

// ============================================================
// 노드 파라미터 내 모든 raw VolumeReference 해소
// ============================================================

export function resolveAllVolumeReferences(nodes: ProjectNode[]): {
  resolved: number;
  failed: number;
} {
  const cccMap = buildCccToNodeMap(nodes);
  let resolved = 0;
  let failed = 0;

  for (const node of nodes) {
    const params = node.data.parameters;
    if (!params) continue;

    // 직접 from/to (SNGLJUN, TMDPJUN, VALVE)
    for (const key of ['from', 'to']) {
      if (isRawRef(params[key])) {
        const ref = resolveRawRef(params[key].raw, cccMap);
        if (ref) {
          params[key] = ref;
          resolved++;
        } else {
          // 해소 실패 시 빈 VolumeReference
          params[key] = { nodeId: '', volumeNum: 1, face: 0 };
          failed++;
        }
      }
    }

    // inletConnection / outletConnection (PUMP, TURBINE)
    for (const key of ['inletConnection', 'outletConnection']) {
      if (isRawRef(params[key])) {
        const ref = resolveRawRef(params[key].raw, cccMap);
        if (ref) {
          params[key] = ref;
          resolved++;
        } else {
          params[key] = { nodeId: '', volumeNum: 1, face: 0 };
          failed++;
        }
      }
    }

    // junctions[].from / junctions[].to (BRANCH, MTPLJUN, TANK)
    if (Array.isArray(params.junctions)) {
      for (const junc of params.junctions) {
        for (const key of ['from', 'to']) {
          if (isRawRef(junc[key])) {
            const ref = resolveRawRef(junc[key].raw, cccMap);
            if (ref) {
              junc[key] = ref;
              resolved++;
            } else {
              junc[key] = { nodeId: '', volumeNum: 1, face: 0 };
              failed++;
            }
          }
        }
      }
    }

    // Heat Structure: leftBoundaryConditions[].boundaryVolume, rightBoundaryConditions[].boundaryVolume
    for (const bcKey of ['leftBoundaryConditions', 'rightBoundaryConditions']) {
      if (Array.isArray(params[bcKey])) {
        for (const bc of params[bcKey]) {
          if (isRawRef(bc.boundaryVolume)) {
            const ref = resolveRawRef(bc.boundaryVolume.raw, cccMap);
            if (ref) {
              bc.boundaryVolume = ref;
              resolved++;
            } else {
              bc.boundaryVolume = { nodeId: '', volumeNum: 1, face: 0 };
              failed++;
            }
          }
        }
      }
    }

    // Heat Structure: gapConductance.referenceVolume
    if (params.gapConductance && isRawRef(params.gapConductance.referenceVolume)) {
      const ref = resolveRawRef(params.gapConductance.referenceVolume.raw, cccMap);
      if (ref) {
        params.gapConductance.referenceVolume = ref;
        resolved++;
      } else {
        params.gapConductance.referenceVolume = { nodeId: '', volumeNum: 1, face: 0 };
        failed++;
      }
    }
  }

  return { resolved, failed };
}

// ============================================================
// Handle ID 생성 헬퍼
// ============================================================

/**
 * VolumeReference가 가리키는 볼륨 노드의 Handle ID를 결정
 */
function getVolumeHandleId(ref: VolumeReference, nodeType: string): string {
  // Face 0 (Old Format): 모든 볼륨 노드 공통 → hidden center 'auto-connect' 핸들
  if (ref.face === 0) {
    return 'auto-connect';
  }
  if (nodeType === 'pipe') {
    return `cell-${ref.volumeNum}-face-${ref.face}`;
  }
  // 단일볼륨 노드 (snglvol, tmdpvol, branch, pump, turbine 등)
  if (ref.face === 1) return 'inlet';
  return 'outlet'; // face 2+ fallback
}

/**
 * 연결 타입 결정 (axial vs crossflow)
 */
function getConnectionType(face: number): 'axial' | 'crossflow' {
  return face >= 3 && face <= 6 ? 'crossflow' : 'axial';
}

// ============================================================
// Edge 생성
// ============================================================

let edgeCounter = 0;

function nextEdgeId(): string {
  return `edge_${++edgeCounter}`;
}

function createEdge(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  data: MARSEdgeData
): ProjectEdge {
  return {
    id: nextEdgeId(),
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'default',
    data,
  };
}

/**
 * 모든 연결 정보로부터 ReactFlow Edge 생성
 */
export function createEdges(nodes: ProjectNode[]): ProjectEdge[] {
  edgeCounter = 0;
  const edges: ProjectEdge[] = [];
  const nodeMap = new Map<string, ProjectNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (const node of nodes) {
    const params = node.data.parameters;
    const type = node.data.componentType;

    switch (type) {
      case 'sngljun':
      case 'tmdpjun':
      case 'valve':
        addJunctionEdges(node, params, nodeMap, edges);
        break;
      case 'branch':
      case 'tank':
      case 'separatr':
        addBranchEdges(node, params, nodeMap, edges);
        break;
      case 'mtpljun':
        addMtpljunEdges(node, params, nodeMap, edges);
        break;
      case 'pump':
      case 'turbine':
        addPumpTurbineEdges(node, params, nodeMap, edges);
        break;
      case 'htstr':
        addHtstrEdges(node, params, nodeMap, edges);
        break;
    }
  }

  return edges;
}

// ============================================================
// 타입별 Edge 생성 로직
// ============================================================

/**
 * SNGLJUN / TMDPJUN / VALVE → 2개 Edge (from_vol→junction, junction→to_vol)
 */
function addJunctionEdges(
  juncNode: ProjectNode,
  params: Record<string, any>,
  nodeMap: Map<string, ProjectNode>,
  edges: ProjectEdge[]
): void {
  const fromRef: VolumeReference | null = isValidRef(params.from) ? params.from : null;
  const toRef: VolumeReference | null = isValidRef(params.to) ? params.to : null;

  // Edge 1: from_volume → junction (inlet)
  if (fromRef) {
    const fromNode = nodeMap.get(fromRef.nodeId);
    if (fromNode) {
      const sourceHandle = getVolumeHandleId(fromRef, fromNode.data.componentType);
      edges.push(createEdge(
        fromRef.nodeId,
        sourceHandle,
        juncNode.id,
        'inlet',
        {
          fromVolume: fromRef,
          toVolume: { nodeId: juncNode.id, volumeNum: 1, face: 1 },
          connectionType: getConnectionType(fromRef.face),
          junctionNodeId: juncNode.id,
          area: params.area,
          fwdLoss: params.fwdLoss,
          revLoss: params.revLoss,
          jefvcahs: params.jefvcahs,
          label: juncNode.data.componentName,
        }
      ));
    }
  }

  // Edge 2: junction (outlet) → to_volume
  if (toRef) {
    const toNode = nodeMap.get(toRef.nodeId);
    if (toNode) {
      const targetHandle = getVolumeHandleId(toRef, toNode.data.componentType);
      edges.push(createEdge(
        juncNode.id,
        'outlet',
        toRef.nodeId,
        targetHandle,
        {
          fromVolume: { nodeId: juncNode.id, volumeNum: 1, face: 2 },
          toVolume: toRef,
          connectionType: getConnectionType(toRef.face),
          junctionNodeId: juncNode.id,
          area: params.area,
          fwdLoss: params.fwdLoss,
          revLoss: params.revLoss,
          jefvcahs: params.jefvcahs,
          label: juncNode.data.componentName,
        }
      ));
    }
  }
}

/**
 * BRANCH / TANK → 각 junction별 Edge 생성
 * junction의 from/to 중 자기 자신이 아닌 쪽이 외부 연결
 */
function addBranchEdges(
  branchNode: ProjectNode,
  params: Record<string, any>,
  nodeMap: Map<string, ProjectNode>,
  edges: ProjectEdge[]
): void {
  if (!Array.isArray(params.junctions)) return;

  for (let i = 0; i < params.junctions.length; i++) {
    const junc = params.junctions[i];
    const juncNum = junc.junctionNumber || (i + 1);
    const fromRef: VolumeReference | null = isValidRef(junc.from) ? junc.from : null;
    const toRef: VolumeReference | null = isValidRef(junc.to) ? junc.to : null;

    // from이 외부 → 외부볼륨에서 branch로 유입
    if (fromRef && fromRef.nodeId !== branchNode.id) {
      const fromNode = nodeMap.get(fromRef.nodeId);
      if (fromNode) {
        const sourceHandle = getVolumeHandleId(fromRef, fromNode.data.componentType);
        edges.push(createEdge(
          fromRef.nodeId,
          sourceHandle,
          branchNode.id,
          `target-j${juncNum}`,
          {
            fromVolume: fromRef,
            toVolume: { nodeId: branchNode.id, volumeNum: 1, face: 1 },
            connectionType: getConnectionType(fromRef.face),
            junctionNodeId: branchNode.id,
            junctionNumber: juncNum,
            area: junc.area,
            fwdLoss: junc.fwdLoss,
            revLoss: junc.revLoss,
            jefvcahs: junc.jefvcahs,
          }
        ));
      }
    }

    // to가 외부 → branch에서 외부볼륨으로 유출
    if (toRef && toRef.nodeId !== branchNode.id) {
      const toNode = nodeMap.get(toRef.nodeId);
      if (toNode) {
        const targetHandle = getVolumeHandleId(toRef, toNode.data.componentType);
        edges.push(createEdge(
          branchNode.id,
          `source-j${juncNum}`,
          toRef.nodeId,
          targetHandle,
          {
            fromVolume: { nodeId: branchNode.id, volumeNum: 1, face: 2 },
            toVolume: toRef,
            connectionType: getConnectionType(toRef.face),
            junctionNodeId: branchNode.id,
            junctionNumber: juncNum,
            area: junc.area,
            fwdLoss: junc.fwdLoss,
            revLoss: junc.revLoss,
            jefvcahs: junc.jefvcahs,
          }
        ));
      }
    }

    // from이 자기 자신이고 to가 외부인 경우도 source-jN으로 처리 (이미 위에서 처리됨)
    // to가 자기 자신이고 from이 외부인 경우도 target-jN으로 처리 (이미 위에서 처리됨)
  }
}

/**
 * MTPLJUN → 각 junction별 Edge 생성
 */
function addMtpljunEdges(
  mtpNode: ProjectNode,
  params: Record<string, any>,
  nodeMap: Map<string, ProjectNode>,
  edges: ProjectEdge[]
): void {
  if (!Array.isArray(params.junctions)) return;

  for (let i = 0; i < params.junctions.length; i++) {
    const junc = params.junctions[i];
    const juncNum = junc.junctionNumber || (i + 1);
    const fromRef: VolumeReference | null = isValidRef(junc.from) ? junc.from : null;
    const toRef: VolumeReference | null = isValidRef(junc.to) ? junc.to : null;

    // from → mtpljun의 jN-from 핸들
    if (fromRef && fromRef.nodeId) {
      const fromNode = nodeMap.get(fromRef.nodeId);
      if (fromNode) {
        const sourceHandle = getVolumeHandleId(fromRef, fromNode.data.componentType);
        edges.push(createEdge(
          fromRef.nodeId,
          sourceHandle,
          mtpNode.id,
          `j${juncNum}-from`,
          {
            fromVolume: fromRef,
            toVolume: { nodeId: mtpNode.id, volumeNum: 1, face: 1 },
            connectionType: getConnectionType(fromRef.face),
            junctionNodeId: mtpNode.id,
            junctionNumber: juncNum,
            area: junc.area,
            fwdLoss: junc.fwdLoss,
            revLoss: junc.revLoss,
            jefvcahs: junc.jefvcahs,
          }
        ));
      }
    }

    // mtpljun의 jN-to → to
    if (toRef && toRef.nodeId) {
      const toNode = nodeMap.get(toRef.nodeId);
      if (toNode) {
        const targetHandle = getVolumeHandleId(toRef, toNode.data.componentType);
        edges.push(createEdge(
          mtpNode.id,
          `j${juncNum}-to`,
          toRef.nodeId,
          targetHandle,
          {
            fromVolume: { nodeId: mtpNode.id, volumeNum: 1, face: 2 },
            toVolume: toRef,
            connectionType: getConnectionType(toRef.face),
            junctionNodeId: mtpNode.id,
            junctionNumber: juncNum,
            area: junc.area,
            fwdLoss: junc.fwdLoss,
            revLoss: junc.revLoss,
            jefvcahs: junc.jefvcahs,
          }
        ));
      }
    }
  }
}

/**
 * PUMP / TURBINE → inlet/outlet Edge 생성
 */
function addPumpTurbineEdges(
  pumpNode: ProjectNode,
  params: Record<string, any>,
  nodeMap: Map<string, ProjectNode>,
  edges: ProjectEdge[]
): void {
  const inletRef: VolumeReference | null = isValidRef(params.inletConnection) ? params.inletConnection : null;
  const outletRef: VolumeReference | null = isValidRef(params.outletConnection) ? params.outletConnection : null;

  // inlet_volume → pump
  if (inletRef) {
    const inletNode = nodeMap.get(inletRef.nodeId);
    if (inletNode) {
      const sourceHandle = getVolumeHandleId(inletRef, inletNode.data.componentType);
      edges.push(createEdge(
        inletRef.nodeId,
        sourceHandle,
        pumpNode.id,
        'inlet',
        {
          fromVolume: inletRef,
          toVolume: { nodeId: pumpNode.id, volumeNum: 1, face: 1 },
          connectionType: 'axial',
          area: params.inletArea,
          fwdLoss: params.inletFwdLoss,
          revLoss: params.inletRevLoss,
          jefvcahs: params.inletJefvcahs,
          label: pumpNode.data.componentName,
        }
      ));
    }
  }

  // pump → outlet_volume
  if (outletRef) {
    const outletNode = nodeMap.get(outletRef.nodeId);
    if (outletNode) {
      const targetHandle = getVolumeHandleId(outletRef, outletNode.data.componentType);
      edges.push(createEdge(
        pumpNode.id,
        'outlet',
        outletRef.nodeId,
        targetHandle,
        {
          fromVolume: { nodeId: pumpNode.id, volumeNum: 1, face: 2 },
          toVolume: outletRef,
          connectionType: 'axial',
          area: params.outletArea,
          fwdLoss: params.outletFwdLoss,
          revLoss: params.outletRevLoss,
          jefvcahs: params.outletJefvcahs,
          label: pumpNode.data.componentName,
        }
      ));
    }
  }
}

/**
 * HTSTR → 좌/우 경계조건 Edge 생성
 */
function addHtstrEdges(
  hsNode: ProjectNode,
  params: Record<string, any>,
  nodeMap: Map<string, ProjectNode>,
  edges: ProjectEdge[]
): void {
  // 좌측 경계조건
  if (Array.isArray(params.leftBoundaryConditions)) {
    for (const bc of params.leftBoundaryConditions) {
      if (isValidRef(bc.boundaryVolume)) {
        const ref = bc.boundaryVolume as VolumeReference;
        const volNode = nodeMap.get(ref.nodeId);
        if (volNode) {
          const sourceHandle = getVolumeHandleId(ref, volNode.data.componentType);
          edges.push(createEdge(
            ref.nodeId,
            sourceHandle,
            hsNode.id,
            'left-boundary',
            {
              fromVolume: ref,
              toVolume: { nodeId: hsNode.id, volumeNum: 1, face: 0 },
              connectionType: 'axial',
              label: `${hsNode.data.componentName} (L)`,
            }
          ));
        }
      }
    }
  }

  // 우측 경계조건
  if (Array.isArray(params.rightBoundaryConditions)) {
    for (const bc of params.rightBoundaryConditions) {
      if (isValidRef(bc.boundaryVolume)) {
        const ref = bc.boundaryVolume as VolumeReference;
        const volNode = nodeMap.get(ref.nodeId);
        if (volNode) {
          const sourceHandle = getVolumeHandleId(ref, volNode.data.componentType);
          edges.push(createEdge(
            ref.nodeId,
            sourceHandle,
            hsNode.id,
            'right-boundary',
            {
              fromVolume: ref,
              toVolume: { nodeId: hsNode.id, volumeNum: 1, face: 0 },
              connectionType: 'axial',
              label: `${hsNode.data.componentName} (R)`,
            }
          ));
        }
      }
    }
  }
}

// ============================================================
// 유틸리티
// ============================================================

function isValidRef(obj: any): obj is VolumeReference {
  return obj && typeof obj === 'object' && typeof obj.nodeId === 'string' && obj.nodeId !== '';
}
