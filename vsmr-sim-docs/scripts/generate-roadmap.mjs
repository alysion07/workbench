#!/usr/bin/env node
/**
 * ROADMAP.md 자동 생성 스크립트
 *
 * features/ 폴더의 프론트매터를 스캔하여 ROADMAP.md를 자동 생성합니다.
 *
 * 사용법:
 *   node scripts/generate-roadmap.mjs
 *   node scripts/generate-roadmap.mjs --check  # 변경사항만 확인 (CI용)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FEATURES_DIR = join(ROOT, 'features');
const ROADMAP_PATH = join(ROOT, 'ROADMAP.md');
const CHECK_MODE = process.argv.includes('--check');

// Parse YAML frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      let value = rest.join(':').trim();
      // Remove quotes
      value = value.replace(/^["']|["']$/g, '');
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
      }
      fm[key.trim()] = value;
    }
  }
  return fm;
}

// Read all feature documents
function readFeatures() {
  const files = readdirSync(FEATURES_DIR).filter(f => f.endsWith('.md'));
  const features = [];

  for (const file of files) {
    const content = readFileSync(join(FEATURES_DIR, file), 'utf-8');
    const fm = parseFrontmatter(content);
    if (fm) {
      features.push({ file, ...fm });
    }
  }
  return features;
}

// Status emoji
function statusEmoji(status) {
  switch (status) {
    case 'done': return '✅';
    case 'in-progress': return '🚧';
    case 'planned': return '⏳';
    case 'reference': return '📖';
    default: return '❓';
  }
}

// Generate ROADMAP content
function generateRoadmap(features) {
  const today = new Date().toISOString().split('T')[0];

  // Group by phase
  const phases = {};
  const noPhase = [];
  for (const f of features) {
    if (f.phase) {
      if (!phases[f.phase]) phases[f.phase] = [];
      phases[f.phase].push(f);
    } else {
      noPhase.push(f);
    }
  }

  // Count stats
  const total = features.length;
  const done = features.filter(f => f.status === 'done').length;
  const inProgress = features.filter(f => f.status === 'in-progress').length;
  const planned = features.filter(f => f.status === 'planned').length;

  let md = `# VSMR Simulator Roadmap

> **Auto-generated**: ${today} | \`node scripts/generate-roadmap.mjs\`로 자동 생성
> **Repository**: vsmr-sim-web
> **UI Spec**: [vsmr-sim-web.pdf](../vsmr-sim-web/public/vsmr-sim-web.pdf)

## Overview

MARS 원자로 시뮬레이터를 위한 웹 기반 GUI 개발 로드맵.

**전체 진행률**: ${done}/${total} 완료 | ${inProgress} 진행중 | ${planned} 예정

---

## Phase Summary

| Phase | 상태 | 설명 | 완료 |
|-------|------|------|------|
`;

  const phaseNames = {
    1: 'Core Editor MVP',
    2: 'Project & Model Management',
    3: 'Advanced Components',
    4: 'Simulation & Analysis',
  };

  for (const [num, name] of Object.entries(phaseNames)) {
    const pFeatures = phases[num] || [];
    const pDone = pFeatures.filter(f => f.status === 'done').length;
    const pTotal = pFeatures.length;
    const allDone = pDone === pTotal;
    const anyInProgress = pFeatures.some(f => f.status === 'in-progress');
    const emoji = allDone ? '✅' : anyInProgress ? '🚧' : '⏳';
    md += `| ${num} | ${emoji} | ${name} | ${pDone}/${pTotal} |\n`;
  }

  md += `\n---\n\n## Active Work (in-progress)\n\n`;
  md += `| Feature | Branch | 문서 |\n`;
  md += `|---------|--------|------|\n`;

  const active = features.filter(f => f.status === 'in-progress');
  if (active.length === 0) {
    md += `| _(없음)_ | | |\n`;
  } else {
    for (const f of active) {
      md += `| ${f.title} | \`${f.branch || '미정'}\` | [${f.file}](features/${f.file}) |\n`;
    }
  }

  md += `\n---\n\n## Planned (backlog)\n\n`;
  md += `| Feature | Phase | 문서 |\n`;
  md += `|---------|-------|------|\n`;

  const plannedFeatures = features.filter(f => f.status === 'planned');
  for (const f of plannedFeatures) {
    md += `| ${f.title} | ${f.phase || '-'} | [${f.file}](features/${f.file}) |\n`;
  }

  md += `\n---\n\n## All Features by Phase\n\n`;

  for (const [num, name] of Object.entries(phaseNames)) {
    const pFeatures = phases[num] || [];
    if (pFeatures.length === 0) continue;

    md += `### Phase ${num}: ${name}\n\n`;
    md += `| 상태 | Feature | Branch | 문서 |\n`;
    md += `|------|---------|--------|------|\n`;

    // Sort: in-progress first, then planned, then done
    const order = { 'in-progress': 0, 'planned': 1, 'done': 2, 'reference': 3 };
    pFeatures.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    for (const f of pFeatures) {
      md += `| ${statusEmoji(f.status)} | ${f.title} | ${f.branch ? `\`${f.branch}\`` : '-'} | [${f.file}](features/${f.file}) |\n`;
    }
    md += `\n`;
  }

  if (noPhase.length > 0) {
    md += `### Unphased\n\n`;
    md += `| 상태 | Feature | 문서 |\n`;
    md += `|------|---------|------|\n`;
    for (const f of noPhase) {
      md += `| ${statusEmoji(f.status)} | ${f.title} | [${f.file}](features/${f.file}) |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 기술 스택\n\n`;
  md += `| 영역 | 기술 |\n|------|------|\n`;
  md += `| Frontend | React 18, TypeScript, Vite |\n`;
  md += `| State | Zustand |\n`;
  md += `| UI | Tailwind CSS, shadcn/ui |\n`;
  md += `| Flow Editor | ReactFlow |\n`;
  md += `| Backend 통신 | gRPC-Web |\n`;
  md += `| 인증 | Supabase Auth |\n`;
  md += `| 저장소 | MinIO (S3), Supabase |\n`;

  return md;
}

// Main
const features = readFeatures();
const newContent = generateRoadmap(features);

if (CHECK_MODE) {
  try {
    const existing = readFileSync(ROADMAP_PATH, 'utf-8');
    // Compare ignoring the auto-generated date line
    const normalize = s => s.replace(/Auto-generated.*\n/, '');
    if (normalize(existing) !== normalize(newContent)) {
      console.log('ROADMAP.md is out of date. Run: node scripts/generate-roadmap.mjs');
      process.exit(1);
    } else {
      console.log('ROADMAP.md is up to date.');
    }
  } catch {
    console.log('ROADMAP.md does not exist. Run: node scripts/generate-roadmap.mjs');
    process.exit(1);
  }
} else {
  writeFileSync(ROADMAP_PATH, newContent);
  console.log(`ROADMAP.md generated (${features.length} features scanned)`);
}
