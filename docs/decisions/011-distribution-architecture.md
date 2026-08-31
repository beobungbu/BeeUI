# ADR-011: Public distribution architecture

Status: Accepted

## Context

[#197](https://github.com/beobungbu/BeeUI/issues/197) (R7.1, parent #114) requires the
release-ready package distribution model to be defined **without publishing anything**. It
enumerates seven decide-points: the public package set, source vs built-output format, the
ESM/CJS/type strategy, the React Native/Metro/Web resolution contract, centralized package
consumption vs source-ownership coexistence, lockstep versioning, and artifact provenance
plus clean-consumer verification. Its DoD is that the architecture is reviewed and becomes
the authority for R7 (packages), R8 (CLI/source ownership), and R11 (release).

Today all three packages are pre-publication. `packages/core/package.json`,
`packages/tokens/package.json`, and `packages/ui/package.json` are each
`"name": "@beeui/*"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`, and
their `exports` map points at raw TypeScript source (`"./src/index.ts"`, plus the token
subpaths `./motion-runtime`, `./theme.css`, `./tokens.json`, `./tokens.resolver.json`,
`./lifecycle.json`). `docs/release.md` records the current model plainly: "BeeUI is not
publicly published to npm... remain `private: true`", with one lockstep version across the
workspace and packed tarballs used only as verification artifacts, not a public npm claim.

Two consumption models already coexist in the repository:

- **Centralized packages** — the packed-tarball path proven by `scripts/verify-bare-consumer.sh`
  and `scripts/verify-web-consumer.sh`, which `pnpm pack` all three packages
  (`beeui-core-*.tgz`, `beeui-tokens-*.tgz`, `beeui-ui-*.tgz`) and install them into an
  isolated bare-RN app and a Vite + react-native-web app with no monorepo fallback. The Web
  consumer wires the theme through `@import '@beeui/tokens/theme.css'` in `src/global.css`.
- **Source ownership** — the Registry + `beeui add` CLI (`registry/registry.json`,
  `scripts/registry-lib.mjs`), which copies component source into the consumer project and
  rewrites its `@beeui/core` imports via the two known transforms
  (`KNOWN_TRANSFORMS = { 'rewrite-beeui-core-cn', 'rewrite-beeui-core-module' }`).

The source-ownership model has a known systemic gap,
[#355](https://github.com/beobungbu/BeeUI/issues/355): copied component source imports
runtime values from `@beeui/tokens` via bare specifiers (`import { spacing } from '@beeui/tokens'`,
`import { resolveNativeMotion } from '@beeui/tokens/motion-runtime'`, `import { layer } from '@beeui/tokens'`),
but `@beeui/tokens` is `private: true`, unpublished, and — unlike `@beeui/core` — has **no**
registry item and **no** rewrite transform. The copied files therefore neither resolve
(no npm package) nor vendor (no registry item), so a clean consumer of `sheet`, `popover`,
`dropdown-menu`, `select`, `toast`, `tooltip`, `theme-scope`, `use-bee-token`, or the
transitively-pulled `overlay-runtime` cannot compile. #355 also documents a test gap: the
`beeui.test.mjs` "copied source contains no workspace references" check was curated around
a file list that excluded the affected files, which is why CI never caught it.

This ADR sets the architecture. It changes no `package.json`, no CLI code, and publishes
nothing. Each decision below names the concrete repo mechanism it rests on and the
downstream issue that implements it.

## Constraints

- **Publication-ready only, do not publish.** Per #197's owner guard and `docs/roadmap.md`
  ("R7 — Packages — publication-ready only, DO NOT publish"), this ADR only defines the
  model. No package or CLI is published until the owner explicitly commands the BeeUI 1.0
  release (#254, gated behind the `release` environment per `docs/release-ruleset.md`).
- **CI may claim only what its jobs prove** (`docs/release.md`). Any verification asserted
  here must map to a real gate or an explicitly scoped extension of one.
- **No package-version drift and no unresolved `workspace:*` in packed manifests**
  (`docs/release.md` versioning policy; `pnpm release:verify`).
- **Stable public contracts.** Behavior, semantic, and variant APIs are styling-engine
  independent ([ADR-001](001-styling-engine.md)); the distribution format must not force
  consumers to adopt BeeUI's build toolchain or engine internals.

## Decisions

### D1 — Public package set: publish all three scoped packages

`@beeui/core`, `@beeui/tokens`, and `@beeui/ui` are all published as **public** scoped
packages. `@beeui/tokens` is promoted from private alongside the other two; it is not kept
private, because both the centralized model (the Web consumer's
`@import '@beeui/tokens/theme.css'`) and the #355 fix (D5) depend on `@beeui/tokens` being
resolvable by name in a clean consumer.

- **Rests on:** all three already carry `@beeui/*` names and `MIT` license
  (`packages/*/package.json`); the bare and Web consumer scripts already pack and install
  all three tarballs.
- **Implemented by:** removing `"private": true` and finalizing publishable metadata is
  **#199/#200**, not this ADR. Scope/name reservation and permissions are **#198**
  (owner-gated).

### D2 — Package format: built output is the primary artifact; source ownership is the parallel path

The primary published artifact is **built/compiled output** — pre-compiled ESM plus `.d.ts`
type declarations — so consumers need no BeeUI build toolchain, styling-engine internals,
or TypeScript transpile step to consume the packages. The Registry + `beeui add`
source-ownership path is the **parallel** distribution for consumers who want to own the
component source in-tree.

- **Rests on:** today's `exports` map points at raw `./src/*.ts`; consumers currently rely
  on the monorepo/Metro toolchain to transpile. Compiled output removes that coupling and
  satisfies ADR-001's engine-independence intent at the package boundary.
- **Consequence:** `packages/*` gain a build step and their `exports`/`files` shift from
  `src` to a compiled `dist` (with `src` retained where the source-ownership registry reads
  from it). The `pnpm release:verify` packed-file inventory must assert the built output is
  present and the raw-source-only exports are gone for the centralized path.
- **Implemented by:** **#200** (package output format); export-map finalization is **#201**
  after #184; packed-file inventory is **#202**.

### D3 — Module/type strategy: dual ESM + CJS with `.d.ts`, ESM primary

Each package ships **dual ESM and CJS** builds with `.d.ts` type declarations, expressed
through the `exports` conditional map using `import` / `require` / `types` conditions, with
ESM as the primary/default and CJS provided for interop.

- **Rests on:** packages are `"type": "module"` today (ESM-only, uncompiled). Adding a CJS
  condition covers Node CJS and tooling that still resolves `require`, without demoting ESM.
- **Consequence:** the build emits both module formats plus declarations; `release:verify`'s
  existing exports check extends to assert every subpath resolves under `import`, `require`,
  and `types`.
- **Implemented by:** **#200** (output format) and **#201** (final export maps).

### D4 — Resolution contract: `exports` conditions for React Native / Metro / Web

Resolution is governed by the `exports` conditional map:

- a **`react-native`** condition for Metro so native platform files resolve;
- **Web** resolution (react-native-web) through the `browser` / `default` conditions;
- a Metro-resolvable primary entry;
- the Web theme delivered as a CSS subpath, `@beeui/tokens/theme.css`, exactly as
  `scripts/verify-bare-consumer.sh` already imports it;
- the `source` condition retained where it is useful (e.g. so Metro/uniwind `@source`
  scanning and the source-ownership path can still see `src`).

- **Rests on:** `packages/tokens/package.json` already exposes `./theme.css`,
  `./motion-runtime`, and the token JSON subpaths; the bare consumer resolves native
  platform files through Metro today; the Web consumer uses react-native-web via Vite.
  `docs/release.md` currently scopes proven Web resolution to "Expo Web / current Metro" and
  flags that "public npm conditional exports are not yet guaranteed" — this decision closes
  that gap by making conditional exports the contract.
- **Consequence:** platform file resolution (`*.web.tsx` / `*.native.tsx`) moves from
  implicit Metro platform-extension behavior to explicit, packaged `exports` conditions that
  a generic bundler can honor.
- **Implemented by:** **#201** (final export maps, after #184) and validated by **#204/#208**
  (clean consumers / compatibility report).

### D5 — Centralized and source-ownership coexistence; the #355 resolution

Both consumption models are supported and kept in **lockstep** so a component behaves
identically whether installed or copied:

- **(a) Centralized:** `npm i @beeui/ui` pulls `@beeui/core` and `@beeui/tokens` as normal
  dependencies; the consumer imports from the published packages.
- **(b) Source ownership:** `beeui add <component>` copies component source, rewrites its
  `@beeui/core` imports via the existing `rewrite-beeui-core-cn` / `rewrite-beeui-core-module`
  transforms, and — **the #355 fix** — resolves each copied file's `@beeui/tokens` runtime
  imports by **declaring `@beeui/tokens` as a consumer dependency the CLI adds and records**,
  rather than leaving a dangling bare specifier. This is now possible precisely because
  D1 publishes `@beeui/tokens`: an installed, versioned `@beeui/tokens` is a resolvable
  runtime dependency, so the copied source keeps importing `spacing`, `resolveMotion`,
  `resolveNativeMotion`, and `layer` from `@beeui/tokens` and the CLI ensures that package
  is present in the consumer.

This supersedes #355's originally-suggested acceptance — a new `core-tokens`-style registry
item plus a `rewrite-beeui-tokens-module` transform that vendors a subset of
`packages/tokens/src` into the consumer. That vendoring route existed only because
`@beeui/tokens` was unpublished; once D1 publishes it, treating tokens as a declared runtime
dependency is simpler and avoids fragmenting the token package (color/typography/spacing/
motion resolvers, DTCG-derived constants, theme registry) across copied projects. `@beeui/core`
remains vendored-by-transform because it is the small utility surface (`cn`, module
re-exports) the source-ownership model is designed to inline; `@beeui/tokens` is the shared
design-token runtime and is better carried as a dependency than copied.

The closure must also fix the **test gap**: the `beeui.test.mjs` "copied source contains no
workspace references or BeeUI monorepo imports" check must cover **all** registry items —
including the currently-curated-out `sheet`, `popover`, `dropdown-menu`, `select`, `toast`,
`tooltip`, `theme-scope`, `use-bee-token`, and `overlay-runtime` — so no affected file can
skip CI again.

- **Rests on:** `scripts/registry-lib.mjs` (`KNOWN_TRANSFORMS`, the core rewrite invariants)
  and `registry/registry.json` (per-item `files` / `transforms` / `registryDependencies` /
  `dependencies`), which already model per-item consumer `dependencies`.
- **Implemented by:** **#217** (complete stable 1.0 registry closure), explicitly gated by
  **#355** per `docs/roadmap.md`. This ADR is the architecture authority; #217 is the
  implementation owner. #217 cannot be called production-ready until #355 is closed.

### D6 — Lockstep versioning: one version, released together

All three packages share **one version** and are released together as a fixed/locked group
(e.g. via Changesets configured as a fixed package group). The BeeUI 1.0.0 candidate is a
single coordinated version bump across `@beeui/core`, `@beeui/tokens`, and `@beeui/ui`.

- **Rests on:** `docs/release.md` already mandates one lockstep version matching the
  workspace root and forbids version drift; all three are `0.1.0` today.
- **Consequence:** release tooling bumps the group atomically; `release:verify`'s existing
  package-name/version checks continue to assert no drift.
- **Implemented by:** **#199/#200** (metadata/format) and the R7 release chain; final
  publish is gated at #254.

### D7 — Provenance and clean-consumer verification

- **Provenance:** npm **provenance** via GitHub Actions **OIDC trusted publishing**, so
  published artifacts carry a verifiable build attestation.
- **Clean-consumer verification:** packed-tarball tests across **Expo**, **bare React
  Native**, and **Web**, extending the existing `scripts/verify-bare-consumer.sh` and
  `scripts/verify-web-consumer.sh` rather than replacing them.

- **Rests on:** the two verify scripts already pack real tarballs and install into isolated
  apps with no monorepo fallback; `docs/release.md` already lists `bare-native`,
  `web-consumer`, and Expo export/prebuild as blocking gates.
- **Owner-gated / referenced, not done here:** the npm account, trusted-publisher, and
  `release`-environment setup are **#205** (and account/permission actions in **#198**) —
  owner-gated per `docs/roadmap.md`'s owner-action list. The verification chain is
  **#202/#203/#204** and the integrity/provenance verification path is **#207**.

## Owner guard

This ADR prepares publication **only**. No package or CLI is published, and no npm account,
scope, or trusted-publisher/release environment is created or changed, until the owner
explicitly commands the BeeUI 1.0 release. Final publish is gated at **#254** behind the
`release` environment (`docs/release-ruleset.md`).

Downstream gates this ADR authorizes but does not execute:

| Gate | Owner-action? | What it does |
| --- | --- | --- |
| #198 | Yes (scope/account/permissions) | npm scope + package/CLI name reservation and permissions |
| #199 | No | publishable package metadata (removes `private: true`, finalizes fields) |
| #200 | No | package output format (built ESM+CJS+`.d.ts`) |
| #201 | No | final `exports` maps after #184 |
| #205 | Yes (account/environment) | trusted-publishing / provenance account + `release` environment |
| #217 (+#355) | No | registry CLI closure: `@beeui/tokens` resolution + test-gap fix |
| #254 | Yes | the actual 1.0 publish command |

## Consequences

- R7/R8/R11 issues inherit these seven decisions as settled architecture; they implement,
  they do not re-decide. Conflicts are raised against this ADR, not resolved silently.
- `@beeui/tokens` stops being an internal-only package: D1 makes it public and D5 makes the
  source-ownership CLI depend on that. Reverting tokens to private would reopen #355.
- The centralized packages gain a build step (D2/D3) and explicit conditional `exports`
  (D4); the raw-`src` export shape changes for the centralized path while `src` remains
  available for the source-ownership path and Metro/uniwind `@source` scanning.
- The R7 package/performance chain in `docs/roadmap.md`
  (`#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204`) is unblocked at
  its head by this ADR.

## Verification plan

None for this ADR itself — it is a doc-only decision and touches no package, CLI, registry,
or build file. The verification it *specifies* (D7) lands with its implementing issues:
`release:verify`, the `bare-native` and `web-consumer` clean-consumer gates, the Expo
export/prebuild gates, and the extended `beeui.test.mjs` no-workspace-reference check under
#217/#355.

## Revisit trigger

Revisit if: a target consumer environment cannot honor conditional `exports` (forcing a
different resolution contract under D4); npm trusted publishing / OIDC provenance is
unavailable for the chosen account (changing D7's provenance mechanism); or the
source-ownership model needs token *vendoring* after all (e.g. a consumer profile that must
avoid a runtime `@beeui/tokens` dependency), which would reopen the D5 vendor-vs-depend
choice that #355 originally raised.
