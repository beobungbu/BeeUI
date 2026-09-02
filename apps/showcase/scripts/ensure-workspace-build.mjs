import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

// Showcase tests must execute against the current workspace source, not merely
// whatever dist files happen to exist from an earlier local build. Always
// rebuild the UI package and its workspace dependencies before tests so a
// long-lived checkout cannot silently validate stale compiled artifacts.
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
