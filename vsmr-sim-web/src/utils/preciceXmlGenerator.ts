/**
 * preCICE XML 설정 파일 생성기
 * NmlConfig + XmlConfig → precice-config.xml 문자열
 */

import type { NmlConfig, XmlConfig } from '@/types/cosim';

export function generatePreciceConfigXml(
  nml: NmlConfig,
  xml: XmlConfig,
  model1Name: string,
  model2Name: string,
): string {
  const p1 = model1Name;
  const p2 = model2Name;
  const m1 = `${p1}-mesh`;
  const m2 = `${p2}-mesh`;

  const p1Write = nml.model1.writeDataName;
  const p1Read = nml.model1.readDataName;
  const p2Write = nml.model2.writeDataName;
  const p2Read = nml.model2.readDataName;

  const mapping = xml.mappingType;
  const scheme = xml.schemeType;
  const isImplicit = scheme.includes('implicit');

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" ?>');
  lines.push('<precice-configuration>');
  lines.push('');

  // log
  lines.push('  <log>');
  lines.push('    <sink filter="%Severity% > info" format="---[precice] %ColorizedSeverity% %Message%" enabled="true" />');
  lines.push('  </log>');
  lines.push('');

  // data (T_WALL → Q_WALL 순서: 샘플 기준)
  const dataNames = [p1Write, p2Write].sort().reverse();
  lines.push(`  <data:scalar name="${dataNames[0]}" />`);
  lines.push(`  <data:scalar name="${dataNames[1]}" />`);
  lines.push('');

  // mesh
  for (const meshName of [m1, m2]) {
    lines.push(`  <mesh name="${meshName}" dimensions="3">`);
    lines.push(`    <use-data name="${dataNames[0]}" />`);
    lines.push(`    <use-data name="${dataNames[1]}" />`);
    lines.push('  </mesh>');
    lines.push('');
  }

  // participant 1
  lines.push(`  <participant name="${p1}">`);
  lines.push(`    <provide-mesh name="${m1}" />`);
  lines.push(`    <receive-mesh name="${m2}" from="${p2}" />`);
  lines.push(`    <write-data name="${p1Write}" mesh="${m1}" />`);
  lines.push(`    <read-data  name="${p1Read}" mesh="${m1}" />`);
  lines.push(`    <mapping:${mapping} direction="read" from="${m2}" to="${m1}" constraint="consistent" />`);
  lines.push('  </participant>');
  lines.push('');

  // participant 2
  lines.push(`  <participant name="${p2}">`);
  lines.push(`    <provide-mesh name="${m2}" />`);
  lines.push(`    <receive-mesh name="${m1}" from="${p1}" />`);
  lines.push(`    <write-data name="${p2Write}" mesh="${m2}" />`);
  lines.push(`    <read-data  name="${p2Read}" mesh="${m2}" />`);
  lines.push(`    <mapping:${mapping} direction="read" from="${m1}" to="${m2}" constraint="consistent" />`);
  lines.push('  </participant>');
  lines.push('');

  // m2n
  lines.push(`  <m2n:sockets acceptor="${p1}" connector="${p2}" exchange-directory="/app/precice-exchange" network="eth0" />`);
  lines.push('');

  // coupling-scheme
  lines.push(`  <coupling-scheme:${scheme}>`);
  lines.push(`    <time-window-size value="${xml.timeWindowSize}" />`);
  lines.push(`    <max-time value="${xml.maxTime}" />`);
  lines.push(`    <participants first="${p1}" second="${p2}" />`);
  lines.push(`    <exchange data="${p1Write}" mesh="${m1}" from="${p1}" to="${p2}" />`);
  lines.push(`    <exchange data="${p2Write}" mesh="${m2}" from="${p2}" to="${p1}" initialize="true" />`);

  if (isImplicit) {
    lines.push('    <max-iterations value="100" />');
    lines.push(`    <relative-convergence-measure limit="1e-4" data="${p1Write}" mesh="${m1}" />`);
  }

  lines.push(`  </coupling-scheme:${scheme}>`);
  lines.push('');
  lines.push('</precice-configuration>');

  return lines.join('\n');
}
