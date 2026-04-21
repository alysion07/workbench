/**
 * Interactive Node Types
 * 모든 노드를 withNodeWidgets HOC로 래핑한 nodeTypes 맵.
 * InteractiveControlView에서만 사용 (EditorPage의 nodeTypes와 분리).
 */

import { NodeTypes } from 'reactflow';
import { withNodeWidgets } from './withNodeWidgets';

import SnglvolNode from '../nodes/SnglvolNode';
import SngljunNode from '../nodes/SngljunNode';
import PipeNode from '../nodes/PipeNode';
import BranchNode from '../nodes/BranchNode';
import TmdpvolNode from '../nodes/TmdpvolNode';
import TmdpjunNode from '../nodes/TmdpjunNode';
import MtpljunNode from '../nodes/MtpljunNode';
import PumpNode from '../nodes/PumpNode';
import HeatStructureNode from '../nodes/HeatStructureNode';
import ValveNode from '../nodes/ValveNode';
import TurbineNode from '../nodes/TurbineNode';
import TankNode from '../nodes/TankNode';
import SeparatorNode from '../nodes/SeparatorNode';

export const interactiveNodeTypes: NodeTypes = {
  snglvol: withNodeWidgets(SnglvolNode),
  sngljun: withNodeWidgets(SngljunNode),
  pipe: withNodeWidgets(PipeNode),
  branch: withNodeWidgets(BranchNode),
  tmdpvol: withNodeWidgets(TmdpvolNode),
  tmdpjun: withNodeWidgets(TmdpjunNode),
  mtpljun: withNodeWidgets(MtpljunNode),
  pump: withNodeWidgets(PumpNode),
  htstr: withNodeWidgets(HeatStructureNode),
  valve: withNodeWidgets(ValveNode),
  turbine: withNodeWidgets(TurbineNode),
  tank: withNodeWidgets(TankNode),
  separatr: withNodeWidgets(SeparatorNode),
};
