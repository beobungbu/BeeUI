// Package/bundle footprint regression budgets (#185, R5.7).
//
// This is DATA, not a runner — mirrors the scenario-registry philosophy
// (`lib/registry.mjs`'s header) of keeping the machine-checkable policy
// separate from the code that evaluates it (`lib/budget-evaluator.mjs`) and
// the code that runs it (`budget-check.mjs`).
//
// Every `baselineGzipBytes` value below is copied verbatim from the recorded,
// committed baseline (`docs/bundle-footprint-baseline.md`, #183), which was
// itself measured against the real release-ready `dist/` layout (#200) — not
// invented ahead of data, per #185's rule. Package/bundle bytes are a
// deterministic measurement (same source + same esbuild/npm versions produce
// the same bytes), unlike wall-clock timing, so a percentage-of-baseline
// tolerance is the appropriate budget shape here — there is no host-noise
// case to guard against the way there is for `maxOverheadRatio` on a sampled
// timing scenario.
//
// Two-tier policy, per #185's "treat severe regressions separately from
// informational drift":
//   - `warnPct`  — growth beyond this is reported as WARN (informational,
//     does not fail the check). 10% covers legitimate small growth from a
//     new prop/variant/dependency patch bump without demanding a budget PR
//     for every routine change.
//   - `failPct`  — growth beyond this FAILS the check (`budget-check.mjs`
//     exits non-zero). 20% is chosen because it is comfortably above the
//     ~1% organic drift actually observed between the #183 baseline commit
//     and a same-branch rebuild (see `docs/benchmark-harness.md`'s budgets
//     section for the rebuild comparison), so it only trips on a materially
//     sized regression (e.g. an accidentally un-externalized peer, a new
//     always-bundled dependency, or the barrel/tree-shaking regressing) —
//     not on routine development noise.
//
// Updating a budget: bump `baselineGzipBytes` in the SAME PR that
// intentionally grows a package/scenario's real footprint, with the new
// `pnpm bench:footprint` numbers pasted into the PR description and
// `docs/bundle-footprint-baseline.md` updated to match — the same review bar
// as any other public-contract change (`docs/code-standards.md`). Do not
// raise a budget to silence a failure without that evidence.

const DEFAULT_TOLERANCE = { warnPct: 0.10, failPct: 0.20 };

export const PACKAGE_FOOTPRINT_BUDGETS = {
  '@beeui/core': { baselineGzipBytes: 25.1 * 1024, ...DEFAULT_TOLERANCE },
  '@beeui/tokens': { baselineGzipBytes: 97.3 * 1024, ...DEFAULT_TOLERANCE },
  '@beeui/ui': { baselineGzipBytes: 495.3 * 1024, ...DEFAULT_TOLERANCE },
};

export const BUNDLE_SCENARIO_FOOTPRINT_BUDGETS = {
  'web/full-barrel': { baselineGzipBytes: 52.3 * 1024, ...DEFAULT_TOLERANCE },
  'web/single-component-via-barrel': { baselineGzipBytes: 50.8 * 1024, ...DEFAULT_TOLERANCE },
  'web/single-component-direct': { baselineGzipBytes: 10.2 * 1024, ...DEFAULT_TOLERANCE },
  'web/core-tokens-baseline': { baselineGzipBytes: 17.0 * 1024, ...DEFAULT_TOLERANCE },
  'web/sheet-direct': { baselineGzipBytes: 17.6 * 1024, ...DEFAULT_TOLERANCE },
  'web/table-direct': { baselineGzipBytes: 11.0 * 1024, ...DEFAULT_TOLERANCE },
  'web/date-controls-direct': { baselineGzipBytes: 23.7 * 1024, ...DEFAULT_TOLERANCE },
  'native/full-barrel': { baselineGzipBytes: 51.0 * 1024, ...DEFAULT_TOLERANCE },
  'native/button-direct': { baselineGzipBytes: 10.2 * 1024, ...DEFAULT_TOLERANCE },
  'native/sheet-direct': { baselineGzipBytes: 16.4 * 1024, ...DEFAULT_TOLERANCE },
};
