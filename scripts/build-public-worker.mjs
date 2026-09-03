#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPublicSeo } from './build-public-seo.mjs';
import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';

function run(command, args, cwd = ROOT_DIR) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
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

function writeHeaders(outDir) {
  const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

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
  X-Robots-Tag: noindex
`;
  fs.writeFileSync(path.join(outDir, '_headers'), headers);
}

export function composeWorkerAssets({
  rootDir = ROOT_DIR,
  outDir = path.join(rootDir, 'web/worker/dist'),
  environment = process.env.BEEUI_WEB_ENV || 'local',
  commit,
} = {}) {
  const contract = buildPublicSiteContract(rootDir);
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
  fs.writeFileSync(path.join(outDir, 'build-identity.json'), `${JSON.stringify(identity, null, 2)}\n`);
  writeHeaders(outDir);
  return { claimed, identity, outDir };
}

export function buildWorkerSite({ rootDir = ROOT_DIR, environment = process.env.BEEUI_WEB_ENV || 'local' } = {}) {
  // Expo Router's static-render server resolves the package export map under
  // plain Node/Metro conditions. Build the publishable package outputs first
  // so SSR never depends on Metro's source fallback or a stale local dist/.
  run('pnpm', ['build'], rootDir);
  run('pnpm', ['docs:build'], rootDir);
  run('pnpm', ['--filter', '@beemvp/beeui-showcase', 'build:web:public'], rootDir);
  run('pnpm', ['--filter', '@beemvp/beeui-demo', 'build:web:public'], rootDir);
  buildPublicSeo({ rootDir, outDir: path.join(rootDir, 'web/dist') });
  return composeWorkerAssets({ rootDir, environment });
}

function main() {
  const composeOnly = process.argv.includes('--compose-only');
  const result = composeOnly ? composeWorkerAssets() : buildWorkerSite();
  console.log(`Built BeeUI Worker asset artifact (${result.claimed.size} files) at ${path.relative(ROOT_DIR, result.outDir)} for ${result.identity.environment} ${result.identity.commit}.`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
