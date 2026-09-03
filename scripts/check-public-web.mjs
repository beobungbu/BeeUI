#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { ROOT_DIR } from './public-site-contract-lib.mjs';

export async function collectPublicWebViolations(rootDir = ROOT_DIR) {
  const checksDir = path.join(rootDir, 'scripts/public-web-checks');
  const violations = [];
  const files = fs
    .readdirSync(checksDir)
    .filter((name) => name.endsWith('.mjs'))
    .sort();

  for (const name of files) {
    const module = await import(pathToFileURL(path.join(checksDir, name)).href);
    if (typeof module.collectViolations !== 'function') {
      violations.push(`${name}: missing exported collectViolations(rootDir).`);
      continue;
    }
    const checkViolations = await module.collectViolations(rootDir);
    for (const violation of checkViolations) violations.push(`${name}: ${violation}`);
  }
  return violations;
}

async function main() {
  const violations = await collectPublicWebViolations();
  if (violations.length) {
    console.error('Public Web quality gate failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log('Public Web quality gate passed.');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
