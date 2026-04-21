import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jsonPath = resolve(__dirname, '../../documents/100%.json');
const outputPath = resolve(__dirname, '../../documents/100%_exported.i');

async function main() {
  const { MARSInputFileGenerator } = await import('../../src/utils/fileGenerator.js');

  const jsonStr = readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(jsonStr);

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const globalSettings = data.globalSettings || {};

  console.log(`Loaded: ${nodes.length} nodes, ${edges.length} edges`);

  const generator = new MARSInputFileGenerator();
  const result = generator.generate(nodes, edges, 'test_model', globalSettings);
  const fileContent = result.content;

  writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`Exported to: ${outputPath}`);
  console.log(`File size: ${(fileContent.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
