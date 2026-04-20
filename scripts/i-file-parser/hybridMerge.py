#!/usr/bin/env python3
"""
하이브리드 병합: 파서 출력(데이터) + 100_test.json(레이아웃) → VsmrProjectFile

사용법:
  python3 scripts/i-file-parser/hybridMerge.py \
    --parsed /tmp/PRI_parsed.json \
    --ref /Users/l080-20180005/Downloads/100_test.json \
    --output /Users/l080-20180005/Downloads/PRI.json \
    --name PRI \
    --model-name pri-sys
"""

import json
import uuid
import argparse
from datetime import datetime, timezone
from collections import defaultdict


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_ref_lookup(ref_model):
    """100_test.json 모델에서 (componentId, componentType) → node 매핑"""
    lookup = {}
    for node in ref_model['nodes']:
        key = (node['data']['componentId'], node['data']['componentType'])
        lookup[key] = node
    return lookup


def build_ref_edge_lookup(ref_model):
    """100_test.json 모델의 엣지를 노드 기준으로 접근 가능하게"""
    node_ids = {n['id'] for n in ref_model['nodes']}
    return ref_model['edges']


def merge_node(parsed_node, ref_node):
    """파서 노드(데이터) + 참조 노드(레이아웃) 병합"""
    merged = {
        'id': ref_node['id'],
        'type': parsed_node['type'],
        'position': ref_node.get('position', parsed_node.get('position', {'x': 0, 'y': 0})),
        'data': {
            **parsed_node['data'],
            # 참조에서 appearance 복사
            'appearance': ref_node['data'].get('appearance'),
            'errors': [],
            'warnings': [],
            'status': 'valid',
        },
    }

    # ReactFlow 메타데이터 복사
    for key in ['style', 'width', 'height', 'dragging', 'resizing', 'selected', 'positionAbsolute']:
        if key in ref_node:
            merged[key] = ref_node[key]

    return merged


def remap_volume_reference(ref_obj, id_map):
    """VolumeReference 내 nodeId를 파서 ID → 참조 ID로 변환"""
    if not ref_obj or not isinstance(ref_obj, dict):
        return ref_obj
    if 'nodeId' in ref_obj and ref_obj['nodeId'] in id_map:
        ref_obj['nodeId'] = id_map[ref_obj['nodeId']]
    return ref_obj


def remap_node_references(params, id_map):
    """파라미터 내 모든 VolumeReference의 nodeId를 리맵"""
    if not isinstance(params, dict):
        return params

    for key, val in params.items():
        if isinstance(val, dict) and 'nodeId' in val:
            remap_volume_reference(val, id_map)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    remap_node_references(item, id_map)
    return params


def remap_settings_references(settings, id_map):
    """settings 내 VolumeReference (systems, minorEdits 등) 리맵"""
    if not settings:
        return settings

    # systems[].referenceVolume
    for sys in settings.get('systems', []):
        if 'referenceVolume' in sys:
            remap_volume_reference(sys['referenceVolume'], id_map)

    return settings


def filter_edges(ref_edges, valid_node_ids):
    """참조 엣지 중 양쪽 노드가 모두 존재하는 엣지만 필터링"""
    filtered = []
    for edge in ref_edges:
        if edge['source'] in valid_node_ids and edge['target'] in valid_node_ids:
            filtered.append(edge)
    return filtered


def hybrid_merge(parsed_path, ref_path, output_path, project_name, model_name):
    parsed = load_json(parsed_path)
    ref = load_json(ref_path)
    ref_model = ref['data']['models'][0]

    # 1. 참조 lookup 생성
    ref_lookup = build_ref_lookup(ref_model)

    # 2. 파서 노드 → 참조 노드 매칭, ID 매핑 생성
    id_map = {}  # parsed nodeId → ref nodeId
    merged_nodes = []
    unmatched = []

    for pnode in parsed['nodes']:
        key = (pnode['data']['componentId'], pnode['data']['componentType'])
        rnode = ref_lookup.get(key)

        if rnode:
            merged = merge_node(pnode, rnode)
            id_map[pnode['id']] = rnode['id']
            merged_nodes.append(merged)
        else:
            # 참조에 없는 노드 → 파서 레이아웃 그대로 사용
            unmatched.append(key)
            id_map[pnode['id']] = pnode['id']
            merged_nodes.append(pnode)

    print(f"  매칭 성공: {len(merged_nodes) - len(unmatched)}/{len(parsed['nodes'])}")
    if unmatched:
        print(f"  매칭 실패 (파서 레이아웃 사용): {len(unmatched)}")
        for k in unmatched[:10]:
            print(f"    {k}")

    # 3. 파라미터 내 VolumeReference nodeId 리맵
    for node in merged_nodes:
        remap_node_references(node['data'].get('parameters', {}), id_map)

    # 4. Settings 가져오기 (파서 출력 = source of truth)
    settings = parsed['metadata'].get('globalSettings', {})
    remap_settings_references(settings, id_map)

    # 5. 엣지 필터링 (참조 엣지 중 이 모델에 속하는 것만)
    valid_node_ids = {n['id'] for n in merged_nodes}
    filtered_edges = filter_edges(ref_model['edges'], valid_node_ids)
    print(f"  엣지: {len(filtered_edges)}/{len(ref_model['edges'])} (참조 기준)")

    # 6. VsmrProjectFile 구성
    now = datetime.now(timezone.utc).isoformat()
    model_id = str(uuid.uuid4())

    # scope 구성
    scope_systems = []
    if model_name and 'pri' in model_name.lower():
        scope_systems = ['primary']
    elif model_name and 'sec' in model_name.lower():
        scope_systems = ['secondary', 'bop']

    output = {
        '_vsmr_meta_': {
            'version': 2,
            'appVersion': '0.1.0',
            'exportedAt': now,
            'projectName': project_name,
        },
        'data': {
            'models': [
                {
                    'id': model_id,
                    'name': model_name or project_name,
                    'edges': filtered_edges,
                    'nodes': merged_nodes,
                    'scope': {
                        'systems': scope_systems,
                        'components': [],
                    },
                    'settings': {
                        # 파서에서 가져온 카드 설정
                        'maxDt': settings.get('timePhases', [{}])[-1].get('maxDt', 0.01) if settings.get('timePhases') else 0.01,
                        'minDt': settings.get('timePhases', [{}])[0].get('minDt', 1e-7) if settings.get('timePhases') else 1e-7,
                        'maxTime': settings.get('timePhases', [{}])[-1].get('endTime', 100) if settings.get('timePhases') else 100,
                        'card001': settings.get('card001', {'values': [90], 'enabled': True}),
                        'card100': settings.get('card100', {'problemType': 'new', 'calculationType': 'transnt'}),
                        'card101': settings.get('card101', {'runOption': 'run'}),
                        'card102': settings.get('card102', {'inputUnits': 'si', 'outputUnits': 'si'}),
                        'card110': settings.get('card110', {'gases': ['air']}),
                        'card115': settings.get('card115', {'fractions': [1]}),
                        'card200': settings.get('card200', {'initialTime': 0}),
                        # 핵심 데이터 (파서 = source of truth)
                        'systems': settings.get('systems', []),
                        'variableTrips': settings.get('variableTrips', []),
                        'logicTrips': settings.get('logicTrips', []),
                        'minorEdits': settings.get('minorEdits', []),
                        'timePhases': settings.get('timePhases', []),
                        'controlVariables': settings.get('controlVariables', []),
                        'generalTables': settings.get('generalTables', []),
                        'thermalProperties': settings.get('thermalProperties', []),
                        'interactiveInputs': settings.get('interactiveInputs', []),
                        # Reactor kinetics (PRI에만 존재)
                        **(
                            {'reactorKinetics': settings['reactorKinetics']}
                            if 'reactorKinetics' in settings
                            else {}
                        ),
                        # 기타 설정
                        'unitSystem': parsed['metadata'].get('unitSystem', 'si'),
                        'workingFluid': parsed['metadata'].get('workingFluid', 'h2onew'),
                        'simulationType': parsed['metadata'].get('simulationType', 'transnt'),
                        'marsConfig': {
                            'problemType': 'NEW',
                            'problemOption': 'TRANSNT',
                        },
                    },
                    'created_at': now,
                    'updated_at': now,
                    'description': None,
                    'analysisCodes': [{'code': 'mars', 'version': '4.3'}],
                    'updateHistory': [],
                }
            ],
            'metadata': {'tags': []},
            'totalScope': {
                'systems': scope_systems,
                'components': [],
            },
            'updateHistory': [
                {
                    'author': 'System',
                    'version': '1.0',
                    'timestamp': now,
                    'description': f'{project_name} 프로젝트 생성 (Co-Sim 분할)',
                }
            ],
            'simulationHistory': [],
        },
    }

    # 7. 저장
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    size_kb = len(json.dumps(output)) / 1024
    print(f"  출력: {output_path} ({size_kb:.1f} KB)")
    print(f"  노드: {len(merged_nodes)}, 엣지: {len(filtered_edges)}")

    return output


def main():
    parser = argparse.ArgumentParser(description='하이브리드 병합: 파서 출력 + 레이아웃 참조')
    parser.add_argument('--parsed', required=True, help='파서 출력 JSON 경로')
    parser.add_argument('--ref', required=True, help='100_test.json 참조 경로')
    parser.add_argument('--output', required=True, help='출력 JSON 경로')
    parser.add_argument('--name', required=True, help='프로젝트 이름')
    parser.add_argument('--model-name', required=True, help='모델 이름')
    args = parser.parse_args()

    print(f"\n=== 하이브리드 병합: {args.name} ===")
    hybrid_merge(args.parsed, args.ref, args.output, args.name, args.model_name)
    print("완료\n")


if __name__ == '__main__':
    main()
