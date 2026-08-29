// #145 — loads the narrow, rationale-carrying allowlist of unavoidable
// platform/tool false positives from `a11y-allowlist.json`. Kept separate
// from `a11y-gate.ts` (which stays fs-free and Node/browser-agnostic) so the
// pure evaluation logic can be unit-tested without touching the filesystem.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { A11yAllowlistEntry } from './a11y-gate';

// Playwright's TS test transform compiles this module to CommonJS, so
// `__dirname` (not `import.meta.url`) is the portable way to locate the
// sibling JSON file at runtime.
const allowlistPath = join(__dirname, 'a11y-allowlist.json');

/**
 * Reads and parses `a11y-allowlist.json`. Every entry must be a narrow,
 * single-rule/single-target exemption with a real rationale — see
 * `isAllowlistEntryValid` in `a11y-gate.ts` for the rationale requirement
 * enforced at evaluation time. There is no mechanism here (or in the gate)
 * for a blanket/wildcard exemption: `selector` and `id` must match exactly.
 */
export function loadA11yAllowlist(): A11yAllowlistEntry[] {
  const raw = readFileSync(allowlistPath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('apps/visual-regression/src/a11y-allowlist.json must contain a JSON array');
  }
  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as A11yAllowlistEntry).id !== 'string' ||
      typeof (entry as A11yAllowlistEntry).selector !== 'string' ||
      typeof (entry as A11yAllowlistEntry).reason !== 'string'
    ) {
      throw new Error(
        `apps/visual-regression/src/a11y-allowlist.json entry is malformed: ${JSON.stringify(entry)}`,
      );
    }
  }
  return parsed as A11yAllowlistEntry[];
}
