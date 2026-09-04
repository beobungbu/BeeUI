import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildPublicDiscovery } from '../build-public-discovery.mjs';
import { buildPublicComponentManifest } from '../public-component-reference.mjs';
import { buildPublicPatternManifest } from '../public-pattern-reference.mjs';

const LLM_FILES = ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt'];

export async function collectViolations(rootDir) {
  const violations = [];
  const cliPath = path.join(rootDir, 'apps/docs/src/content/docs/guides/cli-source-ownership.md');
  const registryPath = path.join(rootDir, 'apps/docs/src/content/docs/registry/index.md');
  const aiPath = path.join(rootDir, 'apps/docs/src/content/docs/ai/index.md');

  for (const file of [cliPath, registryPath, aiPath]) {
    if (!fs.existsSync(file)) violations.push(`missing public discovery guide ${path.relative(rootDir, file)}`);
  }

  if (fs.existsSync(cliPath)) {
    const cli = fs.readFileSync(cliPath, 'utf8');
    for (const token of ['pnpm beeui add --dry-run', 'pnpm beeui doctor', 'pnpm beeui diff', 'pnpm beeui update']) {
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
    const canonicalComponents = buildPublicComponentManifest(rootDir);
    const canonicalPatterns = buildPublicPatternManifest(rootDir);

    if (!fs.existsSync(path.join(outDir, 'examples/index.html'))) violations.push('public /examples/ index was not built.');
    if (!fs.existsSync(path.join(outDir, 'assets/examples.css'))) violations.push('public examples stylesheet was not built.');
    if (!fs.existsSync(path.join(outDir, 'assets/examples.js'))) violations.push('public examples interaction script was not built.');
    if (result.examples.length < 5) violations.push('public examples index does not cover all intended consumer classes.');
    if (result.components.length !== canonicalComponents.length) {
      violations.push(`examples component recipe count ${result.components.length} drifted from canonical public component count ${canonicalComponents.length}.`);
    }
    if (result.patterns.length !== canonicalPatterns.length) {
      violations.push(`examples pattern recipe count ${result.patterns.length} drifted from canonical pattern count ${canonicalPatterns.length}.`);
    }
    if (result.featured.length < 10) violations.push('featured examples should cover the primary product recipe classes.');

    const hub = fs.readFileSync(path.join(outDir, 'examples/index.html'), 'utf8');
    for (const token of ['Featured recipes', 'Component recipes', 'Production patterns', 'Starter apps', 'data-example-search']) {
      if (!hub.includes(token)) violations.push(`public /examples/ hub is missing ${token}.`);
    }

    for (const component of canonicalComponents) {
      const recipe = path.join(outDir, 'examples/components', component.name, 'index.html');
      if (!fs.existsSync(recipe)) {
        violations.push(`missing component example route /examples/components/${component.name}/.`);
        continue;
      }
      const html = fs.readFileSync(recipe, 'utf8');
      for (const token of ['role="tablist"', 'data-copy-target=', 'Open in Showcase', component.route]) {
        if (!html.includes(token)) violations.push(`${component.name} recipe is missing ${token}.`);
      }
    }

    for (const pattern of canonicalPatterns) {
      const recipe = path.join(outDir, 'examples/patterns', pattern.pack, pattern.slug, 'index.html');
      if (!fs.existsSync(recipe)) {
        violations.push(`missing pattern example route /examples/patterns/${pattern.pack}/${pattern.slug}/.`);
        continue;
      }
      const html = fs.readFileSync(recipe, 'utf8');
      for (const token of ['role="tablist"', 'data-copy-target=', 'Principal BeeUI exports', pattern.sourceHref]) {
        if (!html.includes(token)) violations.push(`${pattern.pack}/${pattern.slug} recipe is missing ${token}.`);
      }
    }

    for (const starter of result.starters) {
      const recipe = path.join(outDir, 'examples/starters', starter.slug, 'index.html');
      if (!fs.existsSync(recipe)) violations.push(`missing starter example route /examples/starters/${starter.slug}/.`);
    }

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
