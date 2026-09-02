#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_COMPONENT_DIR,
  buildPublicComponentManifest,
} from './public-component-reference.mjs';
import { ROOT_DIR } from './component-docs-lib.mjs';

function anatomy(component) {
  const rootCandidate = component.title.replaceAll(' ', '');
  const root = component.values.find((value) => value === rootCandidate) ?? component.values[0];
  const parts = component.values.filter((value) => value !== root);
  const lines = [`- **Family root / primary export:** \`${root}\``];
  if (parts.length) {
    lines.push('  - Public composition parts / helpers:');
    for (const part of parts) lines.push(`    - \`${part}\``);
  }
  if (component.types.length) {
    lines.push('  - Exported type surface:');
    for (const typeName of component.types) lines.push(`    - \`${typeName}\``);
  }
  return lines.join('\n');
}

export function buildPreviewDescriptor(component, rootDir = ROOT_DIR) {
  const fixture = component.examples[0];
  if (!fixture) throw new Error(`${component.name}: cannot build preview descriptor without an executable fixture.`);
  return {
    component: component.name,
    title: component.title,
    fixture,
    source: fs.readFileSync(path.join(rootDir, fixture), 'utf8'),
    sourceHref: `https://github.com/beobungbu/BeeUI/blob/main/${fixture}`,
    showcaseHref: `${component.showcaseHref}&embed=1`,
    anatomy: anatomy(component),
  };
}

export function renderPreviewAddon(descriptor) {
  return `## Live Web preview\n\n<div class="beeui-component-preview" data-component="${descriptor.component}">\n  <iframe\n    src="${descriptor.showcaseHref}"\n    title="Live Web preview of ${descriptor.title}"\n    loading="lazy"\n    style="width:100%;min-height:32rem;border:1px solid var(--sl-color-gray-5);border-radius:0.75rem;background:var(--sl-color-bg);"\n  ></iframe>\n</div>\n\nThis frame loads the **real BeeUI Web Showcase** on demand; it is not a second docs-only implementation. It proves browser behavior only. Use [native preview](/docs/showcase/) for iOS/Android simulator, emulator or device paths.\n\n### Composition anatomy\n\n${descriptor.anatomy}\n\nThe tree above is ordinary document structure so it remains readable with keyboard and assistive technology; it is derived from the real public export family rather than a canvas-only diagram.\n\n## Verified example source\n\nThe following is the exact typechecked Showcase fixture used as this page's primary example: [\`${descriptor.fixture}\`](${descriptor.sourceHref}). The displayed source and executable source are the same file; there is no separately maintained demo snippet.\n\n\`\`\`\`tsx\n${descriptor.source}\n\`\`\`\`\n\nUse the code block's copy affordance to copy the exact fixture. For a smaller app-specific example, start from the public imports shown above and keep only the state your screen owns.\n\n`;
}

export function collectPublicComponentPreviewViolations(rootDir = ROOT_DIR) {
  const violations = [];
  for (const component of buildPublicComponentManifest(rootDir)) {
    let descriptor;
    try {
      descriptor = buildPreviewDescriptor(component, rootDir);
    } catch (error) {
      violations.push(error.message);
      continue;
    }
    if (!descriptor.source.includes("from '@beemvp/beeui-ui'")) {
      violations.push(`${component.name}: primary fixture does not consume the public BeeUI package boundary.`);
    }
    if (descriptor.source.includes('/packages/ui/src/') || descriptor.source.includes("from '../../packages/")) {
      violations.push(`${component.name}: primary fixture leaks a private monorepo import.`);
    }
    if (!descriptor.showcaseHref.startsWith(`/showcase/?component=${encodeURIComponent(component.name)}`)) {
      violations.push(`${component.name}: preview is not addressable through the canonical Showcase component query.`);
    }
    const addon = renderPreviewAddon(descriptor);
    if (!addon.includes(descriptor.source)) violations.push(`${component.name}: displayed code drifted from running fixture source.`);
    if (!addon.includes('loading="lazy"')) violations.push(`${component.name}: Showcase preview must lazy-load.`);
    if (!addon.includes(`title="Live Web preview of ${component.title}"`)) violations.push(`${component.name}: preview iframe lacks an accessible title.`);
  }
  return violations;
}

export function enhanceGeneratedPublicComponentPages({ rootDir = ROOT_DIR, outDir = path.join(rootDir, PUBLIC_COMPONENT_DIR) } = {}) {
  const violations = collectPublicComponentPreviewViolations(rootDir);
  if (violations.length) throw new Error(`Public component preview contract failed:\n- ${violations.join('\n- ')}`);

  const manifest = buildPublicComponentManifest(rootDir);
  for (const component of manifest) {
    const file = path.join(outDir, `${component.name}.md`);
    if (!fs.existsSync(file)) throw new Error(`${component.name}: generated public reference page is missing before preview enhancement.`);
    const page = fs.readFileSync(file, 'utf8');
    const marker = '## Limitations';
    if (!page.includes(marker)) throw new Error(`${component.name}: generated page lacks the Limitations insertion marker.`);
    const addon = renderPreviewAddon(buildPreviewDescriptor(component, rootDir));
    fs.writeFileSync(file, page.replace(marker, `${addon}${marker}`));
  }
  return manifest;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = collectPublicComponentPreviewViolations(ROOT_DIR);
  if (violations.length) {
    console.error('Public component preview check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  if (check) {
    console.log(`Public component preview check passed (${buildPublicComponentManifest(ROOT_DIR).length} source-equal previews).`);
    return;
  }
  const manifest = enhanceGeneratedPublicComponentPages();
  console.log(`Enhanced ${manifest.length} public component pages with lazy Showcase previews and exact fixture source.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
