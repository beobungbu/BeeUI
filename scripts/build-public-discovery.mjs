#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

const LLM_FILES = ['llms.txt', 'llms-full.txt', 'llms-components.txt', 'llms-patterns.txt'];

const EXAMPLES = [
  {
    name: 'Expo package consumer',
    path: 'examples/expo-package-consumer',
    model: 'Packed package boundary',
    purpose: 'Expo SDK 57 / Metro consumer using the same package boundary intended for public distribution.',
  },
  {
    name: 'Bare React Native consumer',
    path: 'examples/bare-rn-consumer',
    model: 'Packed package boundary',
    purpose: 'Bare React Native / Metro consumer proving BeeUI works without Expo application ownership.',
  },
  {
    name: 'Web consumer',
    path: 'examples/web-consumer',
    model: 'Packed package boundary',
    purpose: 'Vite + react-native-web consumer with real production build and browser interaction coverage.',
  },
  {
    name: 'Source ownership starter',
    path: 'examples/source-ownership-starter',
    model: 'Registry source ownership',
    purpose: 'Consumer-owned BeeUI source copied through the repository-local Registry workflow.',
  },
  {
    name: 'Agent reference app',
    path: 'examples/agent-reference-app',
    model: 'AI-context reference',
    purpose: 'Small application built from the public llms.txt family and agent-development contract.',
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderExamplesIndex(rootDir = ROOT_DIR) {
  const contract = buildPublicSiteContract(rootDir);
  const cards = EXAMPLES.map((example) => {
    const source = `https://github.com/beobungbu/BeeUI/tree/main/${example.path}`;
    return `<article><p><strong>${escapeHtml(example.name)}</strong></p><p>${escapeHtml(example.purpose)}</p><p><small>${escapeHtml(example.model)}</small></p><a href="${source}">View source</a></article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="Buildable BeeUI consumer examples for Expo, bare React Native, Web, source ownership, and coding-agent workflows." />
<title>BeeUI examples</title>
<link rel="canonical" href="${contract.origin}/examples/" />
<link rel="stylesheet" href="/assets/site.css" />
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><a class="brand" href="/">BeeUI</a><nav aria-label="Primary"><a href="/docs/">Docs</a><a href="/showcase/">Showcase</a><a href="/demo/">Demo</a></nav></header>
<main id="main" class="shell section">
<p class="eyebrow">Consumer examples · v${escapeHtml(contract.buildTruth.version)}</p>
<h1>Buildable examples, not screenshots.</h1>
<p>BeeUI is still unpublished. Package examples install locally packed tarballs; the source-ownership starter uses the repository-local Registry workflow. None of these pages imply a live npm package or public npx command.</p>
<div class="platform-grid">${cards}</div>
<p><a href="/docs/getting-started/">Choose an onboarding path →</a></p>
</main>
</body>
</html>`;
}

export function buildPublicDiscovery({ rootDir = ROOT_DIR, outDir = path.join(rootDir, 'web/dist') } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const examplesDir = path.join(outDir, 'examples');
  fs.mkdirSync(examplesDir, { recursive: true });
  fs.writeFileSync(path.join(examplesDir, 'index.html'), renderExamplesIndex(rootDir));

  for (const file of LLM_FILES) {
    fs.copyFileSync(path.join(rootDir, file), path.join(outDir, file));
  }

  return { examples: EXAMPLES, llmFiles: LLM_FILES, outDir };
}

function main() {
  const { outDir } = buildPublicDiscovery();
  console.log(`Built public examples and LLM assets into ${path.relative(ROOT_DIR, outDir)}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
