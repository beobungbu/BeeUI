#!/usr/bin/env node

// Deterministic token migration/deprecation report derived from the canonical token
// source. Prints Markdown to stdout, or writes it to a path with `--out <file>`. The
// report is generated from canonical lifecycle metadata, never hand-maintained.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCanonicalTokens } from './generate-tokens.mjs';
import { buildMigrationReport } from './token-lifecycle.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      options.out = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }
  return options;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const { out } = parseArgs(process.argv.slice(2));
    const report = `${buildMigrationReport(loadCanonicalTokens())}\n`;
    if (out) {
      const target = path.isAbsolute(out) ? out : path.join(ROOT_DIR, out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, report, 'utf8');
      console.error(`Wrote migration report: ${path.relative(ROOT_DIR, target)}`);
    } else {
      process.stdout.write(report);
    }
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  }
}
