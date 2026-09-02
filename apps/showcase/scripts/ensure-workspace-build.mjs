import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

const requiredArtifacts = [
  'packages/core/dist/module/index.js',
  'packages/tokens/dist/module/motion-runtime.js',
  'packages/ui/dist/module/index.js',
  'packages/ui/dist/typescript/module/index.d.ts',
];

async function artifactExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

const artifactState = await Promise.all(requiredArtifacts.map(artifactExists));
if (artifactState.every(Boolean)) {
  process.exit(0);
}

const missing = requiredArtifacts.filter((_, index) => !artifactState[index]);
console.log(`Showcase test prerequisites missing (${missing.join(', ')}); building @beemvp/beeui-ui and workspace dependencies.`);

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  pnpm,
  ['--filter', '@beemvp/beeui-ui...', 'run', 'build'],
  {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
