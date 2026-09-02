import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildPublicDiscovery } from '../build-public-discovery.mjs';

const LLM_FILES = ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt'];

export async function collectViolations(rootDir) {
  const violations = [];
  const cliPath = path.join(rootDir, 'apps/docs/src/content/docs/cli/index.md');
  const registryPath = path.join(rootDir, 'apps/docs/src/content/docs/registry/index.md');
  const aiPath = path.join(rootDir, 'apps/docs/src/content/docs/ai/index.md');

  for (const file of [cliPath, registryPath, aiPath]) {
    if (!fs.existsSync(file)) violations.push(`missing public discovery guide ${path.relative(rootDir, file)}`);
  }

  if (fs.existsSync(cliPath)) {
    const cli = fs.readFileSync(cliPath, 'utf8');
    for (const token of ['pnpm beeui -- add --dry-run', 'pnpm beeui -- doctor', 'pnpm beeui -- diff', 'pnpm beeui -- update']) {
      if (!cli.includes(token)) violations.push(`CLI guide is missing canonical repository-local command: ${token}`);
    }
    if (/```[^`]*(?:npx\s+(?:@beemvp\/beeui-cli|beeui)|npm\s+(?:i|install)\s+@beemvp\/beeui-ui)/s.test(cli)) {
      violations.push('CLI guide contains a runnable public npm/npx command while distribution is unpublished.');
    }
  }

  if (fs.existsSync(aiPath)) {
    const ai = fs.readFileSync(aiPath, 'utf8');
    for (const file of LLM_FILES) {
      if (!ai.includes(`/${file}`)) violations.push(`AI guide does not link /${file}.`);
    }
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-discovery-'));
  try {
    const result = buildPublicDiscovery({ rootDir, outDir });
    if (!fs.existsSync(path.join(outDir, 'examples/index.html'))) violations.push('public /examples/ index was not built.');
    if (result.examples.length < 5) violations.push('public examples index does not cover all intended consumer classes.');
    for (const file of LLM_FILES) {
      const source = fs.readFileSync(path.join(rootDir, file));
      const built = fs.readFileSync(path.join(outDir, file));
      if (!source.equals(built)) violations.push(`${file} public asset differs from canonical root file.`);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const examplesReadme = fs.readFileSync(path.join(rootDir, 'examples/README.md'), 'utf8');
  for (const dir of ['expo-package-consumer', 'bare-rn-consumer', 'web-consumer', 'source-ownership-starter', 'agent-reference-app']) {
    if (!fs.existsSync(path.join(rootDir, 'examples', dir))) violations.push(`missing curated example source examples/${dir}`);
    if (!examplesReadme.includes(`${dir}/`)) violations.push(`examples/README.md no longer documents ${dir}.`);
  }

  return violations;
}
