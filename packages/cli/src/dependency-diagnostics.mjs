// `doctor`'s project-wide semver-aware dependency report (#212), built on
// top of `detectProject()` (#213) so the reported peer set matches the
// consumer's actual platform surface instead of dumping BeeUI's entire
// external-dependency universe (native-only peers on a Web-only project,
// etc.) at every `doctor` run.
//
// This module never mutates the project and never fails the `doctor`
// command on an incompatible/missing peer — it reports, the same
// non-blocking posture `add`'s existing dependency reporting already uses
// (docs/registry-cli.md: "External packages are not mutated automatically").
import { availableItems, classifyRequirement, mergeRequirements, resolveRegistryItems } from './registry-lib.mjs';

// Peers that matter regardless of detected platform: every public component
// depends on React and on the theme/token CSS pipeline.
const ALWAYS_RELEVANT_PEERS = new Set(['react', 'tailwindcss', 'uniwind']);
// Peers that only matter for a native (Expo/bare RN) consumer.
const NATIVE_ONLY_PEERS = new Set(['react-native', 'react-native-safe-area-context', 'react-native-teleport']);
// Peers that only matter for a Web consumer.
const WEB_ONLY_PEERS = new Set(['react-dom']);

// Mirrors docs/compatibility-matrix.md's machine-checked `expoSdkRange`
// (`"~57.0.0"`). Expo is not a `@beeui/ui` peerDependency (it is a
// Showcase/app-level concern per that doc), so this floor is not derivable
// from `registry/registry.json` the way the other rows are — it is
// intentionally duplicated data, kept honest by
// `scripts/__tests__/dependency-diagnostics.test.mjs`'s drift check against
// that doc's own machine-readable block.
export const EXPO_SDK_SUPPORTED_RANGE = '~57.0.0';

/**
 * Computes the semver-aware peer-compatibility report `doctor` prints.
 * Returns a sorted array of `{ name, range, declared, status }` rows — the
 * same shape `classifyRequirement` classifies for `add`'s per-plan report —
 * scoped to:
 *   - peers relevant to every project (`react`, `tailwindcss`, `uniwind`),
 *   - native-only peers, only when `detection.platforms.native` is true,
 *   - the Web-only peer (`react-dom`), only when `detection.platforms.web`,
 *   - any other peer (including every optional native adapter such as
 *     `@gorhom/bottom-sheet`) only if the consumer has already declared it —
 *     an undeclared optional peer is not a diagnostic, it is simply not
 *     needed yet,
 *   - `expo`, only when `detection.kind === 'expo'` (checked against
 *     `EXPO_SDK_SUPPORTED_RANGE` rather than a registry range).
 */
export function diagnoseProjectDependencies({ registry, detection }) {
  const items = resolveRegistryItems(registry, availableItems(registry));
  const merged = mergeRequirements(items);
  const declared = detection.declared;

  const rows = [];
  for (const requirement of merged.peerDependencies) {
    const { name, range } = requirement;
    const isDeclared = declared.has(name);
    const relevant =
      ALWAYS_RELEVANT_PEERS.has(name) ||
      (NATIVE_ONLY_PEERS.has(name) && detection.platforms.native) ||
      (WEB_ONLY_PEERS.has(name) && detection.platforms.web) ||
      isDeclared;
    if (!relevant) continue;
    const declaredEntry = declared.get(name) ?? null;
    rows.push({ name, range, declared: declaredEntry, status: classifyRequirement({ name, range, declared: declaredEntry }) });
  }

  if (detection.kind === 'expo') {
    const declaredEntry = declared.get('expo') ?? null;
    rows.push({
      name: 'expo',
      range: EXPO_SDK_SUPPORTED_RANGE,
      declared: declaredEntry,
      status: classifyRequirement({ name: 'expo', range: EXPO_SDK_SUPPORTED_RANGE, declared: declaredEntry }),
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

const REMEDIATION = Object.freeze({
  satisfied: () => 'ok',
  missing: (row) => `not declared; install ${row.name}@${row.range}`,
  incompatible: (row) =>
    `declared ${row.declared.range} in ${row.declared.section} does not satisfy required ${row.range}; ` +
    `update ${row.name} to a version within ${row.range}`,
  malformed: (row) =>
    `declared value '${row.declared.range}' in ${row.declared.section} is not a recognizable version or range; fix ${row.name} in package.json`,
  unverifiable: (row) =>
    `declared '${row.declared.range}' in ${row.declared.section} is a package-manager protocol or dist-tag; ` +
    `compatibility with required ${row.range} cannot be checked statically — confirm the resolved version manually`,
  'optional-not-declared': (row) => `optional, not declared; only needed if you use the feature that requires it (would need ${row.name}@${row.range})`,
});

const STATUS_LABEL = Object.freeze({
  satisfied: 'OK',
  missing: 'MISSING',
  incompatible: 'INCOMPATIBLE',
  malformed: 'MALFORMED',
  unverifiable: 'UNVERIFIABLE',
  'optional-not-declared': 'OPTIONAL',
});

/**
 * Renders one diagnostic row as a single deterministic line, e.g.:
 *   `  OK            react@>=19 <20 — ok`
 *   `  INCOMPATIBLE  uniwind@>=1.10.1 <2 — declared ^1.0.0 in dependencies does not satisfy required >=1.10.1 <2; update uniwind to a version within >=1.10.1 <2`
 */
export function formatDiagnosticLine(row) {
  const label = STATUS_LABEL[row.status] ?? row.status.toUpperCase();
  const remediation = (REMEDIATION[row.status] ?? (() => row.status))(row);
  return `  ${label.padEnd(13)} ${row.name}@${row.range} — ${remediation}`;
}

/**
 * Renders the detected-project summary line printed by both `init` and
 * `doctor`.
 */
export function formatDetectionSummary(detection) {
  const platformParts = [];
  if (detection.platforms.native) platformParts.push('native');
  if (detection.platforms.web) platformParts.push('web');
  const platforms = platformParts.length > 0 ? platformParts.join('+') : 'none detected';
  return (
    `Detected project: ${detection.kind} (platforms: ${platforms}), package manager: ${detection.packageManager}, ` +
    `TypeScript: ${detection.hasTypeScript ? 'yes' : 'no'}, monorepo: ${detection.isMonorepo ? 'yes' : 'no'}.`
  );
}
