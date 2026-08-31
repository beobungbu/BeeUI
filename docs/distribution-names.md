# BeeUI 1.0 distribution package names

Preflight for [#198](https://github.com/beobungbu/BeeUI/issues/198) (R7.2 — reserve and
verify public package names). This is a **docs/analysis preflight only**: it changes no
`package.json`, no CLI code, and no registry data, and it reserves nothing on npm. The
distribution authority is [ADR-011](decisions/011-distribution-architecture.md); the
release-permission gate is [#205](https://github.com/beobungbu/BeeUI/issues/205); name
alignment across manifests/docs/registry is [#199](https://github.com/beobungbu/BeeUI/issues/199)
(package metadata) and [#217](https://github.com/beobungbu/BeeUI/issues/217) (registry/CLI
closure). No package or CLI is published until the owner commands the 1.0 release
([#254](https://github.com/beobungbu/BeeUI/issues/254)).

## Availability evidence

Verified against `https://registry.npmjs.org/<name>` on 2026-08-31. `HTTP 404` = the name
has never been claimed and is available; `HTTP 200` = the name resolves (either a live
package or an unpublished tombstone — distinguished below).

| Name | Role | HTTP | Verdict |
| --- | --- | --- | --- |
| `@beemvp/beeui-core` | library (D1) | 404 | **Available** |
| `@beemvp/beeui-tokens` | library (D1) | 404 | **Available** |
| `@beemvp/beeui-ui` | library (D1) | 404 | **Available** |
| `@beemvp/beeui-cli` | CLI (recommended) | 404 | **Available** |
| `create-beeui` | CLI (alternative) | 404 | Available |
| `beeui` (unscoped) | CLI (current repo-local command) | 200 | **Unavailable / do not use** — unpublished tombstone (see below) |

**Scope decision (model B, owner-authorized 2026-08-30): the npm scope is `@beemvp`** — the
Hive Enterprise public-company org, not a `beeui`-only scope (the shorter `@beeui` scope was
the original model A candidate; the owner chose model B, the same pattern as `@shopify/polaris`,
so the org scope can host future public packages beyond BeeUI). All four `@beemvp/beeui-*`
names resolve 404 (verified above), so reserving `@beemvp` reserves the coherent set in one
action.

### The `beeui` unscoped name is a tombstone, not a live competitor

`beeui` returns `HTTP 200`, but its metadata is an **unpublish tombstone**: an unrelated
package published `0.0.1`/`2.0.0`/`3.0.0` between 2017-07 and 2017-10 and fully unpublished
it on 2021-09-26 (`time.unpublished.versions = ["0.0.1","2.0.0","3.0.0"]`, no live
`versions`). npm does not let a different account cleanly republish over another owner's
unpublished name, and claiming a tombstoned identity carries dependency-confusion and trust
baggage. Treat `beeui` (unscoped) as **not available** for BeeUI. This is why the scoped
namespace, not the bare name, is the reliable path — and it matches the repo's existing
posture (`docs/registry-cli.md`: "must not be described as `npx beeui` yet").

## Library package names — confirmed

`@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui` are **locked** as the public 1.0 library names.

- They match what the repo already ships: `packages/{core,tokens,ui}/package.json` are each
  `"name": "@beemvp/beeui-*"`, `"license": "MIT"`, and the bare/Web consumer verify scripts already
  pack `beeui-core-*.tgz` / `beeui-tokens-*.tgz` / `beeui-ui-*.tgz`.
- They are non-confusable: the scope prefix disambiguates them from the unrelated
  hyphenated `bee-ui` (a live 2017-era React Native UI package, `latest 0.0.45`) and from
  the `beeui` tombstone. No scoped `@beemvp/beeui-*` name collides.
- ADR-011 D1 promotes `@beemvp/beeui-tokens` from `private: true` to public alongside the other
  two (the Web theme import `@import '@beemvp/beeui-tokens/theme.css'` and the #355 fix both need
  it resolvable by name). Removing `"private": true` and finalizing publishable metadata is
  **#199**, not this preflight.

No library name needs to change, so the `@beemvp/beeui-*` **import examples throughout the docs
are already final** and are out of scope for the rename alignment below.

## CLI name — recommendation

**Recommendation: publish the CLI as the scoped package `@beemvp/beeui-cli`, invoked as
`npx @beemvp/beeui-cli add <component>`, exposing a `beeui` binary (`"bin": { "beeui": … }`).**

The owner deferred this choice to this preflight because the unscoped `beeui` command name
currently shown in `docs/registry-cli.md` (`pnpm beeui -- add …`) cannot become a published
`npx beeui`: the unscoped name is a tombstone (above).

### `@beemvp/beeui-cli` vs `create-beeui`

| Dimension | `@beemvp/beeui-cli` → `npx @beemvp/beeui-cli add` | `create-beeui` → `npm create beeui` |
| --- | --- | --- |
| npm convention | Ordinary scoped CLI, run repeatedly for subcommands | `create-*` / `npm init` **initializer** convention — designed for one-shot project scaffolding |
| Fits BeeUI's tool? | **Yes.** The tool is an ongoing source-ownership tool (`add`, `list`, `init`, `doctor`, `--dry-run`, `--overwrite`) run many times over a project's life | Poor fit. `npm create` semantics imply "scaffold a new project once"; the tool is not primarily a scaffolder |
| Peer precedent | shadcn/ui's `npx shadcn add …` — the closest analog to `beeui add` — is a persistent recurring-subcommand CLI, not a `create-*` initializer | `create-vite`, `create-next-app` scaffold a new app then exit |
| Namespace coherence | Lives inside the reserved `@beemvp` scope with the libraries; one scope reservation covers everything | Sits in the unscoped global namespace, disconnected from `@beemvp/beeui-*` |
| Binary name | Can still be `beeui`, so end users type `beeui add button` once installed / `npx @beemvp/beeui-cli add button` ad hoc | Binary convention is tied to the `create` invocation |

`create-beeui` is available and could be added **later** as a thin optional scaffolder
(`npm create beeui` → new starter app) without conflicting with `@beemvp/beeui-cli`; the two are
complementary, not either/or. But the primary add-component CLI should be `@beemvp/beeui-cli`.

### Binary name stays `beeui`

The published package name and the binary name are independent. `@beemvp/beeui-cli` should declare
`"bin": { "beeui": "./dist/beeui.js" }`, so the user-facing command remains `beeui add …`
(matching every existing `docs/registry-cli.md` example after the `pnpm beeui --` shim is
dropped), even though the install/package name is `@beemvp/beeui-cli`. This preserves the
documented command surface while sidestepping the taken unscoped package name.

### Confusable / typosquat survey (evidence, 2026-08-31)

| Name | HTTP | Status | Note |
| --- | --- | --- | --- |
| `bee-ui` | 200 | **Live, unrelated** | Old (2017) React Native UI kit, `latest 0.0.45` — the main confusable; scope prefix avoids it |
| `beeui` | 200 | Tombstone | Unpublished 2021; do not use |
| `beui` | 404 | Available | Near-typo of `beeui` — candidate defensive hold |
| `beeui-cli` | 404 | Available | Unscoped CLI variant — candidate defensive hold |
| `beeui-core` | 404 | Available | Unscoped library variant |
| `create-bee` | 200 | Live, unrelated | Occupied; irrelevant to chosen names |
| `create-beeui` | 404 | Available | Reserve if a scaffolder is later wanted |

Optional defensive reservations (owner's discretion, not required for 1.0): unscoped
`beeui`-adjacent typos are largely free (`beui`, `beeui-cli`, `beeui-core`), but scoping
under `@beemvp/beeui-*` already gives the primary protection. `bee-ui` and the `beeui` tombstone
are the only real-world collisions and neither is claimable, so no rename is forced.

## References to update when the CLI name is finalized

Do **not** edit these here — the alignment is owned by **#199** (package metadata) and
**#217** (registry/CLI closure, part of the R8 packed-CLI tranche #209–#219). Only the
**CLI invocation** wording changes; `@beemvp/beeui-*` library import examples do not. Files that
advertise the CLI invocation or the "no public `npx beeui` yet" posture:

- `docs/registry-cli.md` — all `pnpm beeui -- <cmd>` examples, the "Why there is no public
  `npx beeui` yet" section, and the Roadmap section (item 1: "decide the publishable CLI
  package/binary name").
- `README.md` (line ~86) — "not yet a public `npx beeui` distribution contract".
- `docs/architecture.md` (line ~73) — "not yet a public `npx beeui` or remote registry
  product".
- `docs/compatibility-matrix.md` (Node/CLI-tooling row) — "The packed BeeUI CLI (R8,
  #209–#219) … does not exist as a distributable artifact yet"; "No published CLI package
  yet; … `pnpm beeui -- add <item>`".
- Root `package.json` — the `"beeui": "node ./scripts/beeui.mjs"` workspace script (repo-local
  shim; a future `packages/cli` with `"name": "@beemvp/beeui-cli"` + `"bin": { "beeui": … }` is the
  publish target, created under the R8 tranche, not #198).
- `scripts/beeui.mjs`, `scripts/registry-lib.mjs`, `scripts/__tests__/beeui.test.mjs` — help
  text and the `run 'pnpm beeui -- init' first` invariant message.
- `docs/decisions/011-distribution-architecture.md` uses `beeui add` as the invocation name;
  as the authority ADR it should be updated only if the invocation form itself changes (the
  `beeui` binary name is retained, so the ADR text stays valid).

## Owner permission / reservation checklist (OWNER ACTION REQUIRED)

Ties to [#205](https://github.com/beobungbu/BeeUI/issues/205) and the owner-gate list in
`docs/beeui-1.0-owner-gates.md`. An implementation agent may prepare evidence and config but
must stop at each of these boundaries with `OWNER_ACTION_REQUIRED`.

1. **Create/own the npm `@beemvp` organization (scope).** Owner-only. Reserving the scope
   secures `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` together. Publishing
   scoped packages publicly requires `--access public` (or org default access = public).
2. **Reserve the CLI package `@beemvp/beeui-cli`** (and, if desired, defensively publish/hold
   `create-beeui`, `beui`, `beeui-cli`). Owner-only. Do **not** attempt to claim unscoped
   `beeui` — it is a tombstone.
3. **Grant publish permissions / team membership** on the `@beemvp` org to the release
   identity used by CI. Owner/admin-only.
4. **Enable OIDC trusted publishing** (npm "Trusted Publisher" linked to the GitHub Actions
   workflow) so releases carry npm **provenance** (ADR-011 D7). Preferred over long-lived
   tokens; configured on the npm side by the owner. Owner-only. This is #205's core setup.
5. **If not using OIDC:** create an npm **automation access token** with 2FA-for-publish
   satisfied by the automation token, stored as a GitHub Actions secret. Owner-only; least
   privilege (publish scope only). OIDC (step 4) is the recommended path and avoids this.
6. **Create the GitHub `release` environment** with required reviewers, per
   `docs/release-ruleset.md`, so the publish job cannot run without owner approval. Owner/admin-only.
   (This is the mechanism behind the #254 hard gate.)

None of steps 1–6 are performed by this preflight. Steps 1–2 are #198's owner actions;
steps 4–6 are #205's owner actions. Technical readiness is not release authorization
(`docs/beeui-1.0-owner-gates.md` #254).

## Summary of locked / recommended names

| Artifact | Name | Invocation | Status |
| --- | --- | --- | --- |
| Core library | `@beemvp/beeui-core` | `import … from '@beemvp/beeui-core'` | Locked, available |
| Tokens library | `@beemvp/beeui-tokens` | `import … from '@beemvp/beeui-tokens'` | Locked, available |
| UI library | `@beemvp/beeui-ui` | `npm i @beemvp/beeui-ui` | Locked, available |
| CLI | `@beemvp/beeui-cli` | `npx @beemvp/beeui-cli add <component>` (binary `beeui`) | **Recommended**, available |
