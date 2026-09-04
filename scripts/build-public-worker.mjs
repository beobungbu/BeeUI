#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPublicSeo } from './build-public-seo.mjs';
import { buildRedirectRules, renderRedirectsFile } from './generate-docs-foundation.mjs';
import {
  DEMO_FALLBACK_MARKER,
  SHOWCASE_FALLBACK_MARKER,
  injectFallback,
  renderDemoFallback,
  renderShowcaseFallback,
} from './public-portal-shell.mjs';
import { ROOT_DIR, buildPublicSiteContract, readPublicSiteConfig } from './public-site-contract-lib.mjs';

function run(command, args, cwd = ROOT_DIR, env = process.env) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
}

function collectFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(path.relative(root, absolute));
    }
  }
  walk(root);
  return files.sort();
}

function copyOutput(sourceDir, destinationDir, composedRoot, claimed, label) {
  if (!fs.existsSync(sourceDir)) throw new Error(`${label} output is missing: ${path.relative(ROOT_DIR, sourceDir)}`);
  for (const relative of collectFiles(sourceDir)) {
    const destination = path.join(destinationDir, relative);
    const key = path.relative(composedRoot, destination).replaceAll(path.sep, '/');
    if (key.startsWith('../')) throw new Error(`${label} attempted to write outside the composed asset root: ${key}`);
    if (claimed.has(key)) throw new Error(`asset collision: ${key} from ${label} conflicts with ${claimed.get(key)}`);
    claimed.set(key, label);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceDir, relative), destination);
  }
}

export function renderWorkerHeaders(contract) {
  const globalRobots = contract.indexPolicy === 'index,follow'
    ? ''
    : '  X-Robots-Tag: noindex, nofollow\n';
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${globalRobots}
/docs/_astro/*
  Cache-Control: public, max-age=31556952, immutable

/showcase/_expo/static/*
  Cache-Control: public, max-age=31556952, immutable

/demo/_expo/static/*
  Cache-Control: public, max-age=31556952, immutable

/llms*.txt
  Cache-Control: public, max-age=300, must-revalidate

/build-identity.json
  Cache-Control: no-store

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex, nofollow
`;
}

// Files the composed root owns itself rather than copying from a build output. They go
// through the same `claimed` map as copied assets so an upstream build that ever emits one
// raises the collision error instead of being silently overwritten — and so the set is a
// value a test can assert against, which is what the redirect defect needed and lacked.
export function buildComposedRootFiles({ rootDir, contract, identity }) {
  const rules = buildRedirectRules(readPublicSiteConfig(rootDir));
  return {
    'build-identity.json': `${JSON.stringify(identity, null, 2)}\n`,
    _headers: renderWorkerHeaders(contract),
    // The redirect manifest was declared in config, published into the route manifest and
    // validated for duplicates/loops/cycles, and never written to disk, so every legacy
    // URL 404ed in production while every check stayed green.
    _redirects: renderRedirectsFile(rules),
  };
}

export function composeWorkerAssets({
  rootDir = ROOT_DIR,
  outDir = path.join(rootDir, 'web/worker/dist'),
  environment = process.env.BEEUI_WEB_ENV || 'local',
  commit,
} = {}) {
  const contract = buildPublicSiteContract(rootDir, { environment });
  const exactCommit = commit || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const claimed = new Map();

  copyOutput(path.join(rootDir, 'web/dist'), outDir, outDir, claimed, 'landing/discovery/seo');
  copyOutput(path.join(rootDir, 'apps/docs/dist'), path.join(outDir, 'docs'), outDir, claimed, 'docs');
  copyOutput(path.join(rootDir, 'apps/showcase/dist-public-web'), path.join(outDir, 'showcase'), outDir, claimed, 'showcase');
  copyOutput(path.join(rootDir, 'apps/demo/dist-public-web'), path.join(outDir, 'demo'), outDir, claimed, 'demo');

  const identity = {
    service: 'beeui-web',
    version: contract.buildTruth.version,
    commit: exactCommit,
    environment,
  };
  // /showcase/ and /demo/ are JS-only Expo exports that sit in the sitemap. Give each a
  // static catalog for readers and crawlers that never run the app (#464, #465).
  for (const [portal, render, marker] of [
    ['showcase', () => renderShowcaseFallback({ rootDir, identity }), SHOWCASE_FALLBACK_MARKER],
    ['demo', () => renderDemoFallback({ identity }), DEMO_FALLBACK_MARKER],
  ]) {
    const indexPath = path.join(outDir, portal, 'index.html');
    if (!fs.existsSync(indexPath)) throw new Error(`${portal} export has no index.html to attach a static fallback to`);
    fs.writeFileSync(indexPath, injectFallback(fs.readFileSync(indexPath, 'utf8'), render(), marker));
  }

  const rootFiles = buildComposedRootFiles({ rootDir, contract, identity });
  for (const [name, contents] of Object.entries(rootFiles)) {
    if (claimed.has(name)) throw new Error(`asset collision: ${name} from composed root conflicts with ${claimed.get(name)}`);
    claimed.set(name, 'composed root');
    fs.writeFileSync(path.join(outDir, name), contents);
  }

  // The portals are the same failure shape as the redirect manifest: injection can be deleted
  // and every upstream check still passes, because they all run before the write. Read the
  // markers back out of the composed output.
  for (const [portal, marker] of [['showcase', SHOWCASE_FALLBACK_MARKER], ['demo', DEMO_FALLBACK_MARKER]]) {
    const written = fs.readFileSync(path.join(outDir, portal, 'index.html'), 'utf8');
    if (!written.includes(marker)) throw new Error(`${portal} export was composed without its static fallback`);
  }

  // Read back what the composed root declared. The redirect manifest was declared,
  // published and validated for a year while never reaching disk, and every check stayed
  // green because they all sat upstream of the write. Verifying the write here means
  // dropping it fails the build itself rather than waiting for someone to notice a 404.
  for (const [name, contents] of Object.entries(rootFiles)) {
    const written = path.join(outDir, name);
    if (!fs.existsSync(written)) throw new Error(`composed root declared ${name} but never wrote it`);
    if (fs.readFileSync(written, 'utf8') !== contents) throw new Error(`composed root wrote ${name} with unexpected contents`);
  }

  return { claimed, identity, outDir, contract };
}

export function buildWorkerSite({ rootDir = ROOT_DIR, environment = process.env.BEEUI_WEB_ENV || 'local' } = {}) {
  // Expo Router's static-render server resolves the package export map under
  // plain Node/Metro conditions. Build the publishable package outputs first
  // so SSR never depends on Metro's source fallback or a stale local dist/.
  const buildEnv = { ...process.env, BEEUI_WEB_ENV: environment };
  run('pnpm', ['build'], rootDir, buildEnv);
  run('pnpm', ['docs:build'], rootDir, buildEnv);
  run('pnpm', ['--filter', '@beemvp/beeui-showcase', 'build:web:public'], rootDir, buildEnv);
  run('pnpm', ['--filter', '@beemvp/beeui-demo', 'build:web:public'], rootDir, buildEnv);
  buildPublicSeo({ rootDir, outDir: path.join(rootDir, 'web/dist'), environment });
  return composeWorkerAssets({ rootDir, environment });
}

function main() {
  const composeOnly = process.argv.includes('--compose-only');
  const result = composeOnly ? composeWorkerAssets() : buildWorkerSite();
  console.log(`Built BeeUI Worker asset artifact (${result.claimed.size} files) at ${path.relative(ROOT_DIR, result.outDir)} for ${result.identity.environment} ${result.identity.commit}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
