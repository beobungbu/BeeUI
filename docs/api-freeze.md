# BeeUI 1.0 public API freeze (#243, R11.1)

> **Status:** FROZEN. This document declares the immutable BeeUI 1.0 public API inventory —
> every published entry point across the four `@beemvp/beeui-*` packages plus the `beeui` CLI
> command contract — that the RC candidate ([#246](https://github.com/beobungbu/BeeUI/issues/246))
> is built from. It is **documentation-only**: it changes no package, CLI, registry, or token
> source, and it publishes nothing.
> **Freeze base commit:** `a1efd48e6b0dbcdb058fe5ed3ffd3328900890dd` (`main`).
> **Snapshot:** 2026-09-02.
> **Frozen packages:** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`
> (one lockstep group) and `@beemvp/beeui-cli` (binary `beeui`).
> **Binds to the RC candidate:** this freeze holds unchanged through the RC candidate `1.0.0-rc-ready.1`
> ([#246](https://github.com/beobungbu/BeeUI/issues/246)) at SHA `5cb061f` — the only public-surface
> commit since the freeze base, the CASE C overlay-Escape fix ([#402](https://github.com/beobungbu/BeeUI/issues/402)),
> touched internal overlay-runtime only and changed no package `exports`, barrel export, or token, so no
> re-freeze is required.

## What "frozen" means here (and what it does not)

This freeze is the R11 checkpoint that locks the shape of the 1.0 public surface so the RC
can be classified against a fixed target. It is the companion of the semver cleanliness audit
[docs/semver-audit.md](semver-audit.md) (#245), which inventoried and classified the same
surface; this document takes that reviewed inventory and marks it **immutable for 1.0**,
records the base commit it is frozen at, and states the un-freeze rule.

**Frozen is not published.** `1.0.0` is the first stable release BeeUI will ever cut, and it
has **not** been cut. Every `@beemvp/beeui-*` manifest reads `"version": "0.1.0"` at the
freeze base; the `1.0.0` lockstep bump and the actual publish are owner-gated at
[#254](https://github.com/beobungbu/BeeUI/issues/254)
([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md)). The `@beemvp` scope is
unpublished — all four names resolve `404` ([docs/distribution-names.md](distribution-names.md)).
Nothing in this document asserts that any artifact exists on npm.

## Freeze rule (un-freeze requires an explicit semver bump)

Once this inventory is frozen, **any change to the public surface enumerated below requires an
explicit, documented un-freeze plus a semver bump classified per
[docs/semver-audit.md](semver-audit.md)** ("What each release level means"):

- Removing or renaming a package `exports` entry or a component subpath; removing/renaming a
  barrel export; changing a component's typed prop contract incompatibly; removing a CLI
  command/flag or changing its exit-code / stdout-vs-stderr contract; removing a stable public
  token past its deprecation window; or a non-backward-compatible `schemaVersion` bump — is a
  **MAJOR** (`2.0.0`).
- Adding a component (new subpath + barrel export + registry item, kept in sync by the guards
  below), a new optional prop, a new CLI command/flag, a new token, a widening peer range, or
  promoting a documented `experimental` surface to stable — is a **MINOR** (`1.1.0`).
- Bug/behavior fixes that keep the documented contract are a **PATCH** (`1.0.1`).

Pre-1.0 (before `1.0.0` is cut) a surface correction is still possible, but it must be a
deliberate, documented decision recorded against this freeze — not a silent drift. After
`1.0.0`, the standard semver rules above are binding on the `1.x` line, and the standing
carve-outs in [docs/semver-audit.md](semver-audit.md) ("Standing carve-outs at 1.0") apply
(experimental iOS `pageSheet`/`formSheet` presentation, optional native peers, token lifecycle,
evidence-bounded compatibility).

## The frozen inventory matches the drift-guarded generated inventory

The freeze is not a hand-maintained list. Each part below is the exact output of a
drift-guarded generator that fails CI on divergence, so the frozen numbers equal the live
surface. Verified at the freeze base with Node 24.13.1:

| Guard | Command | Asserts | Result at freeze base |
| --- | --- | --- | --- |
| UI export map ⇄ barrel | `pnpm ui-exports:check` | the `@beemvp/beeui-ui` `exports` map is regenerated from `src/index.ts` | **PASS** — "exports are current (62 public component subpaths)" |
| Registry ⇄ barrel | `pnpm registry:verify` | `registry/registry.json` agrees with the barrel | **PASS** — "schema v1, 70 total items, 62 public components" |
| Token artifacts | `pnpm tokens:check` | generated token/lifecycle artifacts are byte-current | **PASS** — "Token artifacts are current (4 files)" |
| Release/distribution | `pnpm release:verify` | packed tarballs carry the frozen `dist/` + source-owned surface, install into clean consumers, and the CLI bin runs | **PASS** — "Release verification passed" |

`ui-exports:check` and `registry:verify` are the two guards that keep the subpath map, the
barrel, and the registry from ever disagreeing; both are part of `pnpm typecheck` /
`pnpm check` and run in CI. `release:verify` additionally proves the packed artifacts match
this contract.

## 1. Package entry points (`exports`)

All three libraries ship built `dist/` (dual ESM + CJS + `.d.ts` via `react-native-builder-bob`)
as the primary artifact, with `src` retained in `files` for the source-ownership path
([ADR-011](decisions/011-distribution-architecture.md) D2/D3). Each declares
`"sideEffects": false` and `publishConfig` `access: "public"` + `provenance: true`. No manifest
carries `private: true`.

| Package | Root entry | Additional public subpaths | Conditions per JS entry |
| --- | --- | --- | --- |
| `@beemvp/beeui-core` | `.` | `./package.json` | `source`, `react-native`, `import` (`types`+`default`), `require` (`types`+`default`), `browser`, `default` |
| `@beemvp/beeui-tokens` | `.` | `./motion-runtime` (JS) + machine-readable file subpaths `./theme.css`, `./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`, `./package.json` | JS entries: full conditional set as above; `./theme.css` / `*.json`: direct file targets |
| `@beemvp/beeui-ui` | `.` (barrel) | **62 component subpaths** + `./package.json` | full conditional set (`source`/`react-native`/`import`/`require`/`browser`/`default`) per entry |
| `@beemvp/beeui-cli` | — (no `exports`) | `bin: { "beeui": "./dist/beeui.mjs" }`, `engines.node: ">=24"` | n/a — CLI is a binary, not an import surface |

The `@beemvp/beeui-tokens` machine-readable subpaths are part of the frozen contract: the
canonical DTCG source (`./tokens.json`), the resolver projection (`./tokens.resolver.json`),
the lifecycle manifest (`./lifecycle.json`), the theme CSS (`./theme.css`), and the JS
`./motion-runtime` entry. These are the design-tool / agent interop surface and are frozen
alongside the token vocabulary in [docs/token-freeze.md](token-freeze.md) (#244).

## 2. The 62 `@beemvp/beeui-ui` component subpaths ([ADR-012](decisions/012-granular-subpath-exports.md))

Exactly the 62 public component modules the barrel re-exports and the registry tracks; equal
by construction (guarded by `ui-exports:check` and `registry:verify`):

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

Five entries resolve platform-specific implementations through the `exports` conditions and
are intentional, frozen, and consistent with the resolution rules in ADR-011 D4:

- `date-picker`, `date-time-picker`, `tooltip` — `react-native` → `.native.js`; web
  `import`/`require`/`browser`/`default` → `.web.js`.
- `sheet` — `react-native` → `.native.js`; `browser` → `.web.js`; other conditions → the
  shared `.js`.
- `table` — splits only its `browser` condition to `.web.js`; all other conditions → `.js`.

### Confirmed component contracts

The barrel is frozen at the exact named exports at the base commit. The specific contracts
called out in [#243](https://github.com/beobungbu/BeeUI/issues/243) are present and frozen:

- **Tooltip** — `Tooltip`, `TooltipContent`, `TooltipTrigger` + `TooltipAlign`,
  `TooltipCollisionPadding`, `TooltipContentProps`, `TooltipDirection`, `TooltipPlacement`,
  `TooltipProps`, `TooltipTriggerProps`.
- **Sheet** — `Sheet`, `SheetClose`, `SheetContent`, `SheetDescription`, `SheetFooter`,
  `SheetHandle`, `SheetTitle`, `SheetTrigger` + the matching `*Props` and `SheetSnapPoint`.
- **Table** — `Table`, `TableBody`, `TableCaption`, `TableCell`, `TableFooter`, `TableHead`,
  `TableHeader`, `TableRow` + `TableLayout`, `TableSortDirection`, and the `*Props` set.
  (BeeUI ships composable table primitives; there is no separate `DataTable` export.)
- **Calendar / DatePicker / DateTimePicker** — `Calendar` (`CalendarProps`,
  `CalendarVisibleMonth`), `DatePicker` and `DateTimePicker` with their Web-only positioning
  type aliases and `DateTimePickerValue`. The `@beemvp/beeui-core` date types `CalendarDate`,
  `CalendarWeekStartsOn`, `ClockTime` are re-exported from the barrel so consumers can type
  their own controlled state without reaching into `@beemvp/beeui-core` ([ADR-008]; the public
  component API stops at `@beemvp/beeui-ui`).

Internal helpers stay withheld from the public surface and are **not** part of the freeze:
`calendar-locale`, `date-picker-locale` / `date-picker-shared`, `date-time-picker-locale` /
`date-time-picker-shared`, `use-direction`, the field/form contexts, the anchored-overlay
kernel, and the `cn` helper. None appear in the barrel or the `ui` `exports` map.

## 3. CLI command contract (#210)

The locked public command surface of the `beeui` binary is: `help`/`--help`/`-h`,
`version`/`--version`/`-v`, `list`, `init`, `add <items...>`, `add --all`, `add --dry-run`,
`add --overwrite`, `doctor`/`verify`, `diff [items...]`, `update [items...]`, `update --force`,
`update --dry-run`. Exit code `0` on success, `1` for every usage/validation/runtime error;
stdout carries plan/status only, stderr carries every error. `engines.node: ">=24"`. Full
contract and negative cases: [docs/registry-cli.md](registry-cli.md) "Required command contract
(#210)", pinned by `scripts/__tests__/beeui.test.mjs` and
`scripts/__tests__/beeui-diff-update.test.mjs`; the packed bin is exercised by
`pnpm release:verify` (`help` + `list button` from a clean consumer).

## 4. Registry / source-owned surface

`registry/registry.json` (`schemaVersion: 1`) holds **70 total items**: **63 public add
targets** — the 62 public component items plus the public `theme` item — and **7 internal
transitive-only items** (`core-cn`, `core-overlay`, `field-context`, `form-group-context`,
`overlay-runtime`, `use-direction`, `use-required-callback-warning`) that are never
`public: true` and never directly addable. `beeui add --all` copies exactly the 63 public
targets. The config shape (`beeui.config.json`, `schemaVersion: 1`) and the content-addressed
`beeui.manifest.json` are the other frozen source-ownership contracts. `doctor`'s
"63 public components" line counts add targets; `list` prints the 62 component modules +
`theme`.

## 5. Governed public token surface (frozen separately)

The public token vocabulary — foundation scales and the semantic color vocabulary, all
governed by machine-readable lifecycle metadata — is inventoried and frozen in its own
checkpoint, [docs/token-freeze.md](token-freeze.md) (#244). The
`@beemvp/beeui-tokens/lifecycle.json`, `./tokens.json`, `./tokens.resolver.json`, and
`./theme.css` subpaths listed in §1 are the frozen machine-readable projection of that
vocabulary.

## Cross-references

- Semver cleanliness audit and level definitions: [docs/semver-audit.md](semver-audit.md)
- Token vocabulary freeze: [docs/token-freeze.md](token-freeze.md)
- Distribution architecture / granular subpaths: [ADR-011](decisions/011-distribution-architecture.md),
  [ADR-012](decisions/012-granular-subpath-exports.md)
- Owner gate (publish): [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md),
  [#254](https://github.com/beobungbu/BeeUI/issues/254)
- CLI command contract: [docs/registry-cli.md](registry-cli.md)
- Tested peer evidence: [docs/consumer-compatibility-report.md](consumer-compatibility-report.md),
  [docs/compatibility-matrix.md](compatibility-matrix.md)
- Component reference: [docs/component-reference.md](component-reference.md)
</content>
</invoke>
