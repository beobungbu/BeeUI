#!/usr/bin/env node

// `pnpm release:literal-audit` — reports (with `--check`, fails on) tracked lines that name the
// current lockstep version outside explicit history/evidence/plan/generated/manifest allowlists.
//
// This complements `scripts/release/prepare-candidate.mjs`'s own best-effort scan: that tool looks
// backward after a bump (does anything still say the OLD version); this looks at the CURRENT
// version and asks whether every occurrence sits somewhere legitimate — a hand-maintained
// current-state sentence outside those allowlists is exactly the drift risk the release-flow plan
// exists to remove (scout report: "of the ~35 hand-maintained files, only 3 are covered by any
// drift check").
//
// `--check` fails only on a literal found *outside* every allowlist, including
// PENDING_CONVERSION_EXACT (files deliberately left hand-maintained; see the reasons recorded
// next to each entry below). That keeps this a real ratchet: shrinking PENDING_CONVERSION_EXACT
// is always safe, but a *new* uncovered file trips the gate instead of silently passing.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCurrentVersion, ROOT_DIR } from '../public-site-contract-lib.mjs';

// Point-in-time records that are supposed to keep naming past/current versions as history.
const HISTORY_EVIDENCE_PLAN_EXACT = new Set(['CHANGELOG.md', 'docs/rc-candidate.md']);
const HISTORY_EVIDENCE_PLAN_PREFIXES = ['plans/', 'docs/decisions/', '.changeset/'];

// Generated/freshness-checked surfaces: legitimately embed the current version, verified fresh by
// their own docs:*:check/llms:check/docs:foundation:check gates elsewhere in `pnpm typecheck`.
const GENERATED_EXACT = new Set([
  'docs/component-reference.md',
  'llms.txt',
  'llms-full.txt',
  'llms-components.txt',
  'llms-patterns.txt',
  'apps/docs/public/release-state.json',
  'apps/docs/public/route-manifest.json',
  'docs/registry-observation.json',
]);
const GENERATED_PREFIXES = [
  'apps/docs/src/content/docs/components/',
  'apps/docs/src/content/docs/patterns/',
  'apps/docs/src/content/docs/reference/',
];

// These three carry a `release-status:generated` marker block (see scripts/generate-release-status.mjs)
// that is freshness-checked by `pnpm release-status:check`; the rest of each file is reviewed
// evidence/history, or "pin an exact version in automation" per-command guidance deliberately
// left as hand-authored prose (see PENDING_CONVERSION_EXACT below for the same category).
const PARTIALLY_GENERATED_EXACT = new Set(['README.md', 'docs/dist-tag-policy.md', 'docs/consumer-compatibility-report.md']);

// Manifests: the current version is the *authored* value here (packages/ui/package.json) or a
// synced follower (`pnpm version:sync`) — this is the source of truth, not drift.
const MANIFEST_EXACT = new Set([
  'package.json',
  'packages/core/package.json',
  'packages/tokens/package.json',
  'packages/ui/package.json',
  'packages/cli/package.json',
  'web/worker/package.json',
  'apps/demo/app.json',
  'apps/showcase/app.json',
]);

// Test fixtures use arbitrary version strings that may coincidentally match the real current
// version; they are not release prose and derive their own expectations dynamically.
const TEST_PREFIXES = ['scripts/__tests__/'];

// Known remaining hand-maintained docs deliberately left unconverted for now: README, the
// dist-tag policy, the consumer-compatibility report, the llms.txt family, generated component
// pages and the Starlight start/guides/ai/theming/release-security pages were converted to render
// from the shared derivation; the rest of the hand-maintained corpus that also names the current
// version was not, to keep this change bounded. This is a ratchet, not a permanent exemption —
// shrink it as later work converts more files; a *new* file outside this list still trips `--check`.
const PENDING_CONVERSION_EXACT = new Set([
  // "Pin `@<version>` instead of `@next`" is per-command CI/reproducibility guidance, not a
  // registry-state claim; this phase's public-truth rule (scripts/check-public-doc-truth.mjs)
  // targets "is published"/"is public on npm" sentences, not exact-version pin suggestions.
  'apps/docs/src/content/docs/guides/cli-source-ownership.md',
  'apps/docs/src/content/docs/guides/migration-versioning.md',
  'apps/docs/src/content/docs/guides/troubleshooting.md',
  'apps/docs/src/content/docs/start/index.md',
  'apps/docs/src/content/docs/start/web.md',
  'apps/docs/src/content/docs/start/expo.md',
  'apps/docs/src/content/docs/start/bare-react-native.md',
  // Hand-authored generator input (scripts/public-reference.mjs joins this with derived inventory
  // data); the generated output pages themselves are in GENERATED_PREFIXES above.
  'docs/reference.content.json',
  // Remaining hand-maintained operational docs, distinct from the files already converted above
  // (README/dist-tag-policy/consumer-compatibility-report/llms/component pages/Starlight pages).
  // Each still states "is publicly published"/"is public on npm" by hand.
  'docs/registry-cli.md',
  'docs/ai-agent-cookbook.md',
  'docs/release.md',
  'examples/README.md',
  'examples/agent-reference-app/README.md',
  'examples/bare-rn-consumer/README.md',
  'examples/demo-reproduction-records/README.md',
  'examples/expo-package-consumer/README.md',
  'examples/web-consumer/README.md',
  'examples/scripts/pack-beeui-packages.mjs',
]);
const PENDING_CONVERSION_PREFIXES = [];

function isAllowed(relative) {
  if (HISTORY_EVIDENCE_PLAN_EXACT.has(relative)) return true;
  if (HISTORY_EVIDENCE_PLAN_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
  if (GENERATED_EXACT.has(relative)) return true;
  if (GENERATED_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
  if (PARTIALLY_GENERATED_EXACT.has(relative)) return true;
  if (MANIFEST_EXACT.has(relative)) return true;
  if (TEST_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
  if (PENDING_CONVERSION_EXACT.has(relative)) return true;
  if (PENDING_CONVERSION_PREFIXES.some((prefix) => relative.startsWith(prefix))) return true;
  return false;
}

/**
 * @param {string} rootDir
 * @param {string} version
 * @param {(args: string[]) => string} [gitGrep] injectable for tests
 */
export function collectLiteralAuditViolations(rootDir = ROOT_DIR, version = readCurrentVersion(rootDir), gitGrep = defaultGitGrep) {
  let output;
  try {
    output = gitGrep(rootDir, version);
  } catch (error) {
    if (error.status === 1) return { total: 0, violations: [], allowed: [] }; // git grep: no matches
    throw error;
  }
  const hits = output.split('\n').filter(Boolean);
  const violations = [];
  const allowed = [];
  for (const hit of hits) {
    const relative = hit.slice(0, hit.indexOf(':'));
    (isAllowed(relative) ? allowed : violations).push(hit);
  }
  return { total: hits.length, violations, allowed };
}

function defaultGitGrep(rootDir, version) {
  return execFileSync('git', ['grep', '-n', '--fixed-strings', '-I', version], { cwd: rootDir, encoding: 'utf8' });
}

function main() {
  const check = process.argv.includes('--check');
  const version = readCurrentVersion(ROOT_DIR);
  const { total, violations, allowed } = collectLiteralAuditViolations(ROOT_DIR, version);

  console.log(`release:literal-audit — current version ${version}: ${total} tracked line(s) found, ${allowed.length} allowed, ${violations.length} outside every allowlist.`);
  if (violations.length) {
    console.log('\nLines outside history/evidence/plan/generated/manifest/pending-conversion allowlists:');
    for (const hit of violations) console.log(`- ${hit}`);
  }

  if (check && violations.length) {
    console.error(
      '\nrelease:literal-audit --check failed: the line(s) above hand-author the current version with no ' +
        'recognized allowlist entry. Either convert the sentence to a generated block/shared-renderer ' +
        'output, or add the file to PENDING_CONVERSION_EXACT in scripts/release/literal-audit.mjs with a reason.',
    );
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try { main(); } catch (error) {
    console.error(`release:literal-audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
