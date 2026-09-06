// Moves the manifests changesets cannot reach to the version it just wrote.
//
// `changeset version` bumps the four public packages together (they are a `fixed` group) and
// stops there: the root manifest is private and not a workspace member, and the Worker manifest
// and the two Expo `app.json` identities are read by the release checks but owned by nobody
// changesets knows. Left alone they lag, and `check-release-control-plane` fails on its own
// output. This copies the packages' version onto them, so a bump is one command followed by this.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SOURCE_MANIFEST = 'packages/ui/package.json';
export const FOLLOWER_MANIFESTS = ['package.json', 'web/worker/package.json'];
export const FOLLOWER_EXPO_IDENTITIES = ['apps/demo/app.json', 'apps/showcase/app.json'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Rewrites only the `version` value, byte-for-byte otherwise, so the diff is the one line.
function setVersion(file, version) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/"version"\s*:\s*"/u.test(text)) throw new Error(`${file} has no "version" field to sync.`);
  const next = text.replace(/("version"\s*:\s*")[^"]*(")/u, `$1${version}$2`);
  if (next === text) return false;
  fs.writeFileSync(file, next);
  return true;
}

export function syncRootVersion(rootDir = ROOT_DIR) {
  const version = readJson(path.join(rootDir, SOURCE_MANIFEST)).version;
  const changed = [];
  for (const relative of FOLLOWER_MANIFESTS) {
    if (setVersion(path.join(rootDir, relative), version)) changed.push(relative);
  }
  for (const relative of FOLLOWER_EXPO_IDENTITIES) {
    const file = path.join(rootDir, relative);
    if (!fs.existsSync(file)) continue;
    if (setVersion(file, version)) changed.push(relative);
  }
  return { version, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version, changed } = syncRootVersion();
  console.log(changed.length ? `Synced ${changed.join(', ')} to ${version}.` : `Already at ${version}; nothing to sync.`);
  console.log('Next: update the dist-tag-policy block in docs/dist-tag-policy.md and candidateVersion in docs/consumer-compatibility-report.md, then run pnpm dist-policy:check.');
}
