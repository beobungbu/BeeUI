#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_EXECUTABLES = new Set(['scripts/verify-bare-consumer.sh']);

function trackedEntries() {
  const output = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d{6}) [0-9a-f]+ \d\t(.+)$/.exec(entry);
      if (!match) throw new Error(`Unable to parse git index entry: ${entry}`);
      return { mode: match[1], file: match[2] };
    });
}

function trackedTextFiles() {
  const result = spawnSync('git', ['grep', '-Il', '-z', '-e', '', '--', '.'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep failed with status ${result.status}: ${result.stderr}`);
  }

  return result.stdout.split('\0').filter(Boolean);
}

export function collectRepositoryHygieneViolations() {
  const violations = [];
  const entries = trackedEntries();
  const modeByFile = new Map(entries.map(({ mode, file }) => [file, mode]));

  for (const { mode, file } of entries) {
    if (mode === '100755' && !ALLOWED_EXECUTABLES.has(file)) {
      violations.push(`${file}: unexpected executable bit (expected mode 100644)`);
    }
  }

  for (const file of ALLOWED_EXECUTABLES) {
    if (modeByFile.has(file) && modeByFile.get(file) !== '100755') {
      violations.push(`${file}: expected executable mode 100755`);
    }
  }

  for (const file of trackedTextFiles()) {
    const data = fs.readFileSync(path.join(ROOT_DIR, file));
    if (data.length > 0 && data[data.length - 1] !== 0x0a) {
      violations.push(`${file}: missing final LF newline`);
    }
  }

  return violations;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const violations = collectRepositoryHygieneViolations();
  if (violations.length > 0) {
    console.error('Repository hygiene check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('Repository hygiene check passed (file modes + final LF).');
  }
}
