/**
 * preCICE MARS NML 파일 생성기
 * NmlModelConfig + coupling_ids → precice_mars.nml 문자열 (Fortran namelist 포맷)
 */

import type { NmlModelConfig } from '@/types/cosim';
import { deriveWriteVariable } from '@/types/cosim';

export function generatePreciceMarsNml(
  participantName: string,
  meshName: string,
  modelConfig: NmlModelConfig,
  couplingIds: number[],
): string {
  const writeVariable = deriveWriteVariable(modelConfig);
  const n = couplingIds.length;

  const lines: string[] = [];
  lines.push('&precice_config');
  lines.push(`  participant      = '${participantName}'`);
  lines.push(`  mesh_name        = '${meshName}'`);
  lines.push(`  read_data_name   = '${modelConfig.readDataName}'`);
  lines.push(`  write_data_name  = '${modelConfig.writeDataName}'`);
  lines.push(`  config_path      = '/app/config/precice-config.xml'`);
  lines.push(`  n_coupling       = ${n}`);

  // coupling_ids: 6개씩 줄바꿈
  if (n > 0) {
    const firstChunk = couplingIds.slice(0, 6);
    const restChunks: string[] = [];
    for (let i = 6; i < n; i += 6) {
      const chunk = couplingIds.slice(i, i + 6);
      restChunks.push('                     ' + chunk.join(', '));
    }

    let idsLine = `  coupling_ids     = ${firstChunk.join(', ')}`;
    if (restChunks.length > 0) {
      idsLine += ',';
      lines.push(idsLine);
      for (let j = 0; j < restChunks.length; j++) {
        const isLast = j === restChunks.length - 1;
        lines.push(restChunks[j] + (isLast ? '' : ','));
      }
    } else {
      lines.push(idsLine);
    }
  }

  if (modelConfig.initWdata) {
    lines.push(`  init_wdata       = ${modelConfig.initWdata}`);
  }

  lines.push(`  write_variable   = '${writeVariable}'`);
  lines.push('  use_dummy_coords = .true.');
  lines.push('/');

  return lines.join('\n');
}
