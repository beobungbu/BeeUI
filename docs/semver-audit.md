# BeeUI 1.0 semver and breaking-change audit (#245, R11.3)

> **Status:** Freeze-review audit. This is the final semantic-versioning cleanliness check of
> the public API surface that the BeeUI 1.0 candidate will carry, plus the go-forward semver
> policy for the `1.x` line. It is a **documentation-only** audit: it changes no package,
> CLI, registry, or token source, and it publishes nothing.
> **Snapshot:** 2026-09-02.
> **Audited packages:** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`
> (one lockstep group) and `@beemvp/beeui-cli` (binary `beeui`).

## Owner guard — nothing published

`1.0.0` is the first stable release BeeUI will ever cut, and it has **not** been cut. Every
`@beemvp/beeui-*` manifest reads `"version": "0.1.0"` today; the `1.0.0` lockstep bump and the
actual publish are owner-gated at [#254](https://github.com/beobungbu/BeeUI/issues/254)
([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md)). The scope `@beemvp` is
unpublished — all four names resolve `404`
([docs/distribution-names.md](distribution-names.md)). This audit describes the **frozen
target 1.0 surface** so the candidate can be classified against it; it does not assert that
any artifact exists on npm. Distribution authority is
[ADR-011](decisions/011-distribution-architecture.md); the tag/version mechanics are
[docs/dist-tag-policy.md](dist-tag-policy.md); the incident/forward-fix policy is
[docs/rollback-runbook.md](rollback-runbook.md).

## Why this audit is a surface audit, not a diff audit

A conventional semver audit diffs a previous published major/minor against the candidate.
BeeUI has no published predecessor, so there is no `0.x` published contract to have "broken":
the meaningful risk at the `0.x → 1.0` boundary is not an accidental regression against a
shipped version, it is **shipping something into the stable 1.0 contract that should not be
frozen yet** — an experimental or internal shape leaking out as a public, semver-protected
surface. This audit therefore inventories the exact public surface the candidate freezes and
checks each part against four cleanliness criteria:

- **C1 — no unstable/experimental surface leaking as stable public API.** Anything the
  project has not committed to must be either not exported, or explicitly labelled
  experimental so `1.0` does not silently promise it.
- **C2 — no `0.x`-only shapes.** No `private: true`, no raw-`src`-only entry, no
  `workspace:*` in a packed manifest, no placeholder metadata that only made sense pre-1.0.
- **C3 — the subpath/export map matches the documented surface.** The `exports` maps, the
  62 component subpaths, the CLI command contract, and the registry must agree with each
  other and with the docs — no orphan export, no undocumented entry point.
- **C4 — peer ranges are semver-honest.** The declared peer ranges must equal what the
  compatibility matrix actually tested; a `1.0` peer promise may not exceed tested evidence.

Migration guidance for consumers of the pre-1.0 *repository* shape is
[docs/migration-guide.md](migration-guide.md) (#252); this file is the classification and
policy half.

## Audited surface

### 1. Package entry points (`exports`)

| Package | Root entry | Additional public subpaths | Conditions per entry |
| --- | --- | --- | --- |
| `@beemvp/beeui-core` | `.` | `./package.json` | `source`, `react-native`, `import` (`types`+`default`), `require` (`types`+`default`), `browser`, `default` |
| `@beemvp/beeui-tokens` | `.` | `./motion-runtime`, `./theme.css`, `./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`, `./package.json` | JS subpaths: full conditional set as above; `./theme.css` / `*.json`: direct file targets |
| `@beemvp/beeui-ui` | `.` (barrel) | **62 component subpaths** + `./package.json` | full conditional set (`source`/`react-native`/`import`/`require`/`browser`/`default`) per entry |
| `@beemvp/beeui-cli` | — (no `exports`) | `bin: { "beeui": "./dist/beeui.mjs" }`, `engines.node: ">=24"` | n/a — CLI is a binary, not an import surface |

All three libraries ship built `dist/` (dual ESM + CJS + `.d.ts` via `react-native-builder-bob`)
as the primary artifact, with `src` retained in `files` for the source-ownership path
(ADR-011 D2/D3). Each declares `"sideEffects": false` and `publishConfig.access: "public"` +
`provenance: true`.

### 2. The 62 `@beemvp/beeui-ui` component subpaths (ADR-012)

The granular subpath surface is exactly the 62 public component modules the barrel
re-exports and the registry tracks. Verified equal by construction (see C3 below):

```
accordion, alert-banner, alert-dialog, app-header, avatar, badge, bottom-action-bar, box,
breadcrumb, button, calendar, card, checkbox, chip, collapsible, date-picker,
date-time-picker, description-list, dialog, dropdown-menu, field, form-group, form-message,
icon-button, input, keyboard-aware-screen, label, link, list-group, list-item, metadata-row,
otp-input, pagination, password-input, popover, progress, radio, safe-area, screen,
search-input, select, segmented-control, section, separator, sheet, skeleton, spinner, stack,
stat, state-message, stepper, switch, table, tabs, text, textarea, theme-scope, use-bee-token,
timeline, toast, tooltip, visually-hidden
```

Four of these resolve platform-specific implementations through the `exports` conditions
(`react-native` → `.native.js`, web `default`/`browser` → `.web.js`): `date-picker`,
`date-time-picker`, `sheet`, `tooltip`. `table` splits only its `browser` condition to a
`.web.js` build. These are intentional, part of the frozen contract, and consistent with the
resolution rules in ADR-011 D4.

### 3. CLI command contract (#210)

The locked public command surface of the `beeui` binary is: `help`/`--help`/`-h`,
`version`/`--version`/`-v`, `list`, `init`, `add <items...>`, `add --all`,
`add --dry-run`, `add --overwrite`, `doctor`/`verify`, `diff [items...]`,
`update [items...]`, `update --force`, `update --dry-run`. Exit code `0` on success, `1` for
every usage/validation/runtime error; stdout carries plan/status only, stderr carries every
error. Full contract and negative cases:
[docs/registry-cli.md](registry-cli.md) "Required command contract (#210)", pinned by
`scripts/__tests__/beeui.test.mjs` and `scripts/__tests__/beeui-diff-update.test.mjs`.

### 4. Registry / source-owned surface

`registry/registry.json` (`schemaVersion: 1`) holds **63 public add targets** — the 62 public
component items plus the public `theme` item — and 7 internal transitive-only items
(`core-cn`, `core-overlay`, `field-context`, `form-group-context`, `overlay-runtime`,
`use-direction`, `use-required-callback-warning`) that are never `public: true` and never
directly addable. `beeui add --all` copies exactly the 63 public targets. The config shape
(`beeui.config.json`, `schemaVersion: 1`) and the content-addressed `beeui.manifest.json` are
the other frozen source-ownership contracts.

### 5. Governed public token surface

Public foundation scales (`spacing`, `radius`, `fontFamily`, `fontSize`, `lineHeight`,
`fontWeight`, `letterSpacing`, `controlSize`, `iconSize`, `avatarSize`, `contentWidth`,
`elevation`, `motionDuration`, `motionEasing`) and the semantic color vocabulary, all governed
by machine-readable lifecycle metadata ([docs/token-lifecycle.md](token-lifecycle.md)). The
generated `@beemvp/beeui-tokens/lifecycle.json` reports each token's status
(`stable`/`experimental`/`deprecated`).

## Findings against the cleanliness criteria

| Ref | Criterion | Area | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| C1-a | No experimental export leak | `@beemvp/beeui-ui` barrel + 62 subpaths | **PASS** | Every subpath maps to a shipped, documented component; no `experimental`/`unstable`/`internal`-named export in the barrel. Anchored-overlay kernel, direction resolver, field/form contexts, and the `cn` helper stay **internal** (registry `public: false`; not in the `ui` `exports` map). |
| C1-b | Experimental *behavior* is labelled, not silently frozen | iOS `pageSheet`/`formSheet` `DialogContent` presentation | **PASS (labelled)** | Documented **EXPERIMENTAL** for 1.0 with a compile/deterministic-vs-runtime evidence split ([docs/release.md](release.md) #128, tracks [#62](https://github.com/beobungbu/BeeUI/issues/62)). Not exported as a separate API; it is a presentation mode of a stable component, carved out explicitly so `1.0` does not promise unproven native runtime behavior. |
| C1-c | Optional/native-only surface is opt-in, not implied | `sheet` native adapters; native date pickers | **PASS** | `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`, `@react-native-community/datetimepicker` are `peerDependenciesMeta.optional: true`; reported by `beeui add` only when the requiring item is requested. |
| C2-a | No `private: true` / raw-`src`-only entry | all 3 libraries | **PASS** | No `private` field in any manifest; `exports` point at built `dist/` with `src` retained for source ownership (ADR-011 D2). |
| C2-b | No unresolved `workspace:*` in packed manifests | `@beemvp/beeui-ui` deps | **PASS** | `@beemvp/beeui-core`/`@beemvp/beeui-tokens` are `workspace:*` in-repo; `pnpm release:verify` rewrites and asserts no `workspace:*` survives the packed manifest ([docs/release.md](release.md)). |
| C3-a | UI subpath map ⇄ barrel ⇄ registry agree | 62 components | **PASS** | 62 `exports` component subpaths == 62 barrel component modules == 62 public registry components. `pnpm ui-exports:check` (export map vs barrel) and `pnpm registry:verify` (registry vs barrel) both fail CI on drift. |
| C3-b | Documented surface count is consistent | registry/docs | **PASS** | 62 public components + `theme` = 63 public add targets; `doctor`'s "63 public components" line counts add targets, `list` prints the 62 component modules + `theme`. Consistent, no orphan entry. |
| C3-c | CLI contract ⇄ tests agree | `beeui` binary | **PASS** | Command/flag/exit-code contract pinned by `beeui.test.mjs` + `beeui-diff-update.test.mjs`; unknown command/option/item all fail non-zero before any write. |
| C4-a | Peer ranges == tested evidence | `@beemvp/beeui-ui` peers | **PASS** | `packages/ui` `peerDependencies` equal the machine-checked block in [docs/consumer-compatibility-report.md](consumer-compatibility-report.md); `pnpm dist:policy:check` fails if they diverge from the matrix or the manifest. RN capped `>=0.86.0 <0.87.0` on real 0.87 compile-failure evidence (not a BeeUI defect). |
| F-1 | Doc accuracy (not an API leak) | `docs/token-lifecycle.md` line 6 | **FOLLOW-UP** | States "BeeUI packages are `0.x` and `private: true`." The `0.x`/pre-1.0 posture is correct for the current unpublished state, but `private: true` is stale — ADR-011 D1 removed it and no manifest carries it today. Recommend a one-line doc correction under a follow-up issue; **no code change**. |

### Disposition of F-1

F-1 is a documentation-accuracy drift, not a public-API break and not an accidental
semver-relevant change to the frozen surface. Per this audit's mandate it is **flagged, not
fixed here** (it lives in a sibling token-lifecycle doc with its own governance/tests). It
does not block the freeze: the token *contract* — status vocabulary, deprecation path,
compatibility windows — is correct; only the one incidental "private" clause is stale.
Recommended follow-up: a docs issue to update that clause to the published-metadata posture
when the token-lifecycle policy is refreshed for the `1.x` window (see the policy note below
on token lifecycle at 1.0).

**No accidental breaking change was found that must be reverted before 1.0.** Every
platform-split, optional-peer, and experimental-behavior carve-out above is intentional and
already documented; the internal kernel/context/utility surface is correctly withheld from
the public contract.

## Go-forward semver policy for the `1.x` line

Once `1.0.0` is published (owner-gated, #254), BeeUI follows standard semver against the
public surface inventoried above. The three libraries move in **lockstep** (ADR-011 D6): one
version across `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui`, bumped
together. The CLI (`@beemvp/beeui-cli`) shares the same `latest`/`next` dist-tag scheme and a
given CLI line targets the matching library line ([docs/dist-tag-policy.md](dist-tag-policy.md)).

### What each release level means

| Level | Meaning for BeeUI's public surface |
| --- | --- |
| **MAJOR** (`2.0.0`) | Removing or renaming a package `exports` entry or a component subpath; removing/renaming a barrel export or changing a component's typed prop contract incompatibly; removing a CLI command/flag or changing its exit-code/stdout-vs-stderr contract; removing a stable public token past its deprecation window; narrowing a peer range in a way that drops a still-supported tested version; a `beeui.config.json`/`registry` `schemaVersion` bump that is not backward-compatible. |
| **MINOR** (`1.1.0`) | Adding a new component (new subpath + barrel export + registry item, kept in sync by `ui-exports:check`/`registry:verify`); adding a new optional prop, a new CLI command/flag, a new token, or a new **widening** peer range (e.g. admitting a newly tested React/RN line); promoting a documented `experimental` surface to stable after it earns the required runtime evidence. |
| **PATCH** (`1.0.1`) | Bug/behavior fixes that keep the documented public contract; dependency/build fixes with no consumer-visible API change; docs. Must not intentionally change a documented public behavior. A security or emergency fix uses this level per [docs/rollback-runbook.md](rollback-runbook.md). |

### Standing carve-outs at 1.0

- **Experimental behaviors are not covered by the `1.x` stability promise** until promoted.
  The one standing carve-out at 1.0 is iOS `pageSheet`/`formSheet` presentation (C1-b): it
  may change without a major bump while EXPERIMENTAL, and is promoted to stable (a minor)
  only once exact-head native runtime evidence exists per [docs/release.md](release.md) #128.
- **Optional native peers** (C1-c) may have their ranges widened in a minor as new versions
  are tested; they are never a required peer, so admitting one is additive.
- **Token lifecycle at 1.0.** The pre-1.0 "at least one subsequent minor" window
  ([docs/token-lifecycle.md](token-lifecycle.md)) becomes the `1.x` deprecation contract:
  a stable public token is deprecated (kept generating as a compatibility alias) before
  removal, and only removed in a MAJOR once its `removal.target`, migration evidence, and
  compatibility window are satisfied. Experimental tokens keep the lighter-notice policy.
- **Compatibility promise is evidence-bounded.** A peer range is never widened past what the
  compatibility matrix has actually tested; the `dist:policy:check` guard keeps the manifest,
  this policy, and [docs/consumer-compatibility-report.md](consumer-compatibility-report.md)
  from drifting apart.

### Prerelease and correction mechanics

Prereleases are `1.0.0-rc.N` under the `next` dist-tag only; `latest` is only ever a stable
version, promoted atomically after the whole lockstep set verifies
([docs/dist-tag-policy.md](dist-tag-policy.md)). A bad published version is corrected
**forward** — dist-tag re-point, `npm deprecate`, and a new patched version — never by
unpublishing ([docs/rollback-runbook.md](rollback-runbook.md)).

## Cross-references

- Distribution architecture: [ADR-011](decisions/011-distribution-architecture.md)
- Granular subpath exports: [ADR-012](decisions/012-granular-subpath-exports.md)
- Tag/version/prerelease mechanics: [docs/dist-tag-policy.md](dist-tag-policy.md)
- Incident / forward-fix policy: [docs/rollback-runbook.md](rollback-runbook.md)
- Consumer migration guide: [docs/migration-guide.md](migration-guide.md)
- Tested peer evidence: [docs/consumer-compatibility-report.md](consumer-compatibility-report.md),
  [docs/compatibility-matrix.md](compatibility-matrix.md)
- Release contract and evidence rules: [docs/release.md](release.md)
- CLI command contract: [docs/registry-cli.md](registry-cli.md)
- Token lifecycle/deprecation: [docs/token-lifecycle.md](token-lifecycle.md)
- Changelog: [CHANGELOG.md](../CHANGELOG.md)
