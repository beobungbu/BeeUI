#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderNavigation(navigation) {
  return navigation
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join('');
}

export function renderPublicLanding(rootDir = ROOT_DIR) {
  const contract = buildPublicSiteContract(rootDir);
  const template = fs.readFileSync(path.join(rootDir, 'web/site/index.template.html'), 'utf8');
  const publicationLabel = contract.buildTruth.publication.published ? 'Published' : 'Unpublished';
  const replacements = new Map([
    ['{{ORIGIN}}', contract.origin],
    ['{{VERSION}}', contract.buildTruth.version],
    ['{{PUBLICATION_LABEL}}', publicationLabel],
    ['{{NAVIGATION}}', renderNavigation(contract.navigation)],
  ]);

  let html = template;
  for (const [token, value] of replacements) html = html.replaceAll(token, value);
  const unresolved = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (unresolved) throw new Error(`landing template has unresolved tokens: ${[...new Set(unresolved)].join(', ')}`);
  return { html, contract, publicationLabel };
}

export function buildPublicLanding({ rootDir = ROOT_DIR, outDir = path.join(rootDir, 'web/dist') } = {}) {
  const { html } = renderPublicLanding(rootDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.copyFileSync(path.join(rootDir, 'web/site/site.css'), path.join(outDir, 'assets/site.css'));
  return outDir;
}

function main() {
  const outDir = buildPublicLanding();
  console.log(`Built BeeUI public landing into ${path.relative(ROOT_DIR, outDir)}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
