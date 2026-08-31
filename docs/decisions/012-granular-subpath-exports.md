# ADR-012: Granular per-component subpath exports for `@beemvp/beeui-ui`

Status: Accepted

## Context

[#184](https://github.com/beobungbu/BeeUI/issues/184) (R5.6, parent #114) asks whether
`@beemvp/beeui-ui` should ship stable subpath exports (`@beemvp/beeui-ui/button`, `@beemvp/beeui-ui/dialog`, …)
alongside the existing barrel, evaluated against real tree-shaking data from
[#183](https://github.com/beobungbu/BeeUI/issues/183). #184 explicitly gates
[#201](https://github.com/beobungbu/BeeUI/issues/201) (R7.5, "harden package export maps"),
which finalizes the export maps for all three public packages.

`docs/bundle-footprint-baseline.md` (#183) measured the barrel against real built
`dist/module` output, peers externalized, on both Web and a native-priority resolver proxy:

| Scenario | Platform | Gzip |
| --- | --- | ---: |
| `full-barrel` | web | 52.3 KiB |
| `single-component-via-barrel` (Button, through today's only export) | web | 50.8 KiB |
| `single-component-direct` (Button, hypothetical direct `dist/` import) | web | 10.2 KiB |
| `sheet-direct` | web | 17.6 KiB |
| `table-direct` | web | 11.0 KiB |
| `date-controls-direct` (Calendar+DatePicker+DateTimePicker) | web | 23.7 KiB |

`full-barrel` and `single-component-via-barrel` are within 2.4% of each other: importing only
`Button` through today's one `"."` export pulls essentially the entire component library,
because nothing prunes the barrel's ~90 other named re-exports. Bundling `Button`'s built
`dist/module/components/button.js` directly instead is **10.2 KiB gzip vs. 50.8 KiB gzip
through the barrel — an ~80% reduction** for a Button-only consumer, and `table-direct`
(11.0 KiB) / `sheet-direct` (17.6 KiB) confirm this at other component weights. This is
direct, reproducible evidence that today's public `exports` map (`.` and `./package.json`
only) is the single biggest lever left on the table for reducing a typical consumer's
footprint, and it is measured against ADR-011's real release-ready layout (dual ESM+CJS+`.d.ts`
`dist/`, `private` removed, `publishConfig` public+provenance), not a source estimate.

ADR-011 (`docs/decisions/011-distribution-architecture.md`) already commits to conditional
`exports` as the resolution contract (D4) and defers "final export maps" and "optional
granular UI subpaths" explicitly to #201-after-#184 (D2, D4). This ADR is the #184 decision
that unblocks #201; #201's implementation is described in its own PR, not re-litigated here.

## Decision

**#184 = yes.** `@beemvp/beeui-ui` ships stable, granular per-public-component subpath exports
(`@beemvp/beeui-ui/button`, `@beemvp/beeui-ui/dialog`, `@beemvp/beeui-ui/select`, …) for every component the
public barrel (`packages/ui/src/index.ts`) already re-exports, **additive** to the existing
barrel `"."` export — the barrel is not removed, deprecated, or changed in shape. This is
low-regret: existing barrel consumers see no change, and consumers who adopt subpaths get the
~80% measured reduction above.

### Scope of "public"

A component's subpath set is derived mechanically from the barrel's own
`from './components/<name>'` re-exports (`scripts/generate-ui-exports.mjs`), not curated by
hand. Files the barrel never imports by this pattern — internal locale/shared helpers
(`date-picker-locale.ts`, `tooltip-shared.tsx`, …), context modules (`field-context.ts`,
`form-group-context.ts`), the overlay transport internals (`overlay-runtime.tsx`,
`overlay-transport*.tsx`), and shared hooks (`use-direction.ts`,
`use-required-callback-warning.ts`) — never receive an export entry. This is the leak
guard: no `"./*"` wildcard exists anywhere in `packages/ui/package.json`, so an unsupported
deep import fails with Node's own `ERR_PACKAGE_PATH_NOT_EXPORTED`, not a permissive catch-all.

### Condition shape

Each subpath carries the identical condition shape as the barrel's `"."` entry —
`source` / `react-native` / `import.{types,default}` / `require.{types,default}` / `browser`
/ `default` — so a component resolves identically however a consumer reaches it. Three file
shapes exist among the 62 public components, and the generator derives the right target for
each from `packages/ui/src/components/`'s own file names:

1. **Single-file** (59 components, e.g. `button.tsx`): every condition points at the one
   compiled file (`dist/module/components/button.js` / `dist/commonjs/components/button.js`).
2. **Base + platform override** (`sheet` — native+web; `table` — web only): `react-native`
   and `browser` point at the platform-specific compiled file when one exists, falling back
   to the base file otherwise; `import.default`/`require.default`/`default` point at the base
   file — the same file a plain, platform-unaware resolver already gets today.
3. **Platform-only, no base** (`date-picker`, `date-time-picker`, `tooltip` — only
   `.native.tsx`/`.web.tsx` plus a `.d.ts` type shim, per the established
   `overlay-transport.d.ts` precedent): `react-native` → `.native.js`, `browser` → `.web.js`,
   and the generic `import.default`/`require.default`/`default` fall back to the **Web**
   variant as the documented universal default (Web is the platform every generic,
   platform-unaware resolver reaches first in this codebase's existing barrel behavior).
   `types` always resolve to the plain `<name>.d.ts` — either `tsc`'s own emission from a real
   base file, or the copied hand-written shim — never a platform-suffixed `.native.d.ts`/
   `.web.d.ts`, exactly mirroring the barrel's own type resolution today.

The `source` condition target is left extensionless (e.g. `./src/components/date-picker`,
not `./src/components/date-picker.tsx`) for every component, single-file or not. This is not
a new mechanism: it is the exact same pattern `index.ts`'s own barrel re-exports already use
today (`from './components/date-picker'`) — Metro (native) and `vite-plugin-rnw` (Web, via
`scripts/verify-web-consumer.sh`) both apply platform-extension resolution on top of any
resolved target, package-exports or plain relative import alike, and `tsc`'s Bundler-mode
resolution falls back to a co-located `.d.ts` when no runtime `.ts`/`.tsx` base exists. Adding
subpaths does not introduce a new resolution mechanism; it exposes the barrel's own existing
one at a finer grain.

### Rejected alternative: `"./*"` wildcard

A wildcard export (`"./*": "./dist/module/components/*.js"`) was rejected: it would resolve
*any* file name under `dist/module/components/`, including internal-only compiled output
(`overlay-runtime.js`, `table-shared.js`, `tooltip-shared.js`, …) that the barrel deliberately
never re-exports — exactly the "accidentally expose internals" risk #184/#201 call out. An
explicit, generated, per-component map with no wildcard is the only shape that keeps
"public" meaning what the barrel already says it means.

## Consequences

- #201 (this PR) implements the exports map this ADR authorizes: `packages/ui/package.json`
  gains 62 `./<name>` entries between `"."` and `"./package.json"`, generated and drift-checked
  by `scripts/generate-ui-exports.mjs` (`pnpm ui-exports:check`, wired into `pnpm typecheck`).
- `scripts/verify-release.mjs`'s export-target-existence check is generalized (not weakened)
  to accept an extensionless `source` target when a sibling platform/type variant exists on
  disk — the same probe Metro/`tsc` already perform — while still failing loudly on any
  target, extensionless or not, with no matching file at all.
- `@beemvp/beeui-core` and `@beemvp/beeui-tokens` are unaffected: `@beemvp/beeui-core`'s barrel has no public
  sub-entries to split, and `@beemvp/beeui-tokens`'s existing machine-readable subpaths
  (`./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`, `./theme.css`,
  `./motion-runtime`) are untouched.
- Every subpath is additive and versioned identically to the barrel (ADR-011 D6, lockstep
  versioning); removing a component from the barrel automatically drops its subpath on the
  next `pnpm ui-exports:generate` run, since the generator has no independent source of truth.

## Owner note

This ADR and #201's implementation are publication-preparation only, per ADR-011's owner
guard: no package is published, and no npm scope/account/provenance action is taken here.
The owner may override this decision (e.g. narrow the granular set, or decline it entirely)
before the BeeUI 1.0 publish command (#254).

## Verification plan

- `scripts/__tests__/generate-ui-exports.test.mjs`: unit tests for the generator's barrel
  parsing, per-component file-shape detection, and exports-entry construction (including
  idempotency against a previously generated `exports` field).
- `scripts/__tests__/verify-ui-export-map.test.mjs`: end-to-end proof, using Node's own
  package-exports resolution algorithm from a real pnpm-linked consumer (`apps/showcase`),
  that (a) every public component resolves via its subpath under `import`/`require`, with a
  types declaration on disk; (b) an internal deep import (`@beemvp/beeui-ui/overlay-runtime`) fails
  with `ERR_PACKAGE_PATH_NOT_EXPORTED`; (c) the barrel `"."` still resolves; (d) no `"./*"`
  wildcard exists in the exports map.
- `pnpm ui-exports:check` (wired into `pnpm typecheck`) fails CI on drift between the barrel
  and the generated exports map.
- `scripts/verify-bare-consumer.sh` (`prepare`, `bundle`) and `scripts/verify-web-consumer.sh
  all` re-verified green against this change (they exercise the barrel path, unregressed).
- `pnpm release:verify` re-verified green, including the generalized export-target-existence
  check.
- `pnpm registry:verify && pnpm registry:test` re-verified green (source-ownership path
  untouched; the registry's own independently-enumerated public-component count matches this
  ADR's 62).

## Revisit trigger

Revisit if a consumer environment cannot honor the extensionless `source`-condition pattern
for platform-only components (forcing per-platform subpath names instead, e.g.
`@beemvp/beeui-ui/date-picker.web`); if a future component needs a public subpath that is not a
1:1 mapping to a single `src/components/<name>` file (the generator's one-name-one-entry
assumption would need to change); or if the owner decides the barrel alone is sufficient and
withdraws the granular set before 1.0 publish.
