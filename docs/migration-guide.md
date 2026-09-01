# BeeUI 1.0 migration guide (#252, R11.10)

> **Status:** Consumer-facing migration guide for the frozen BeeUI 1.0 shape. It is written
> against the **target 1.0 contract**; the packages are **not yet on npm**. `1.0.0` and the
> publish are owner-gated at [#254](https://github.com/beobungbu/BeeUI/issues/254), and the
> `@beemvp` scope is unpublished today (all four names resolve `404`,
> [docs/distribution-names.md](distribution-names.md)). Every `npm i` / `npx` command below is
> **the shape a consumer will use once BeeUI is published**, not a claim that it works today.
> **Snapshot:** 2026-09-02.

## Who this guide is for

You consumed BeeUI before 1.0 — from the **repository shape** (workspace links, the
repo-local `pnpm beeui -- add …` shim, or `@import`-ing the theme through a monorepo path) —
and you are moving to the published 1.0 packages. This guide maps the pre-1.0 shape to the
final 1.0 shape and gives validated upgrade steps.

If you are new to BeeUI, you do not need this guide — start from the README and
[docs/component-reference.md](component-reference.md). The semver classification behind every
change here is [docs/semver-audit.md](semver-audit.md).

## What changed at 1.0, at a glance

| Area | Pre-1.0 shape | 1.0 shape | Class |
| --- | --- | --- | --- |
| npm scope | unpublished; `@beemvp/beeui-*` names reserved but not on npm | `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui` published (public, scoped) | Distribution |
| Package format | `exports` pointed at raw `./src/*.ts`; consumer transpiled via the monorepo/Metro toolchain | built `dist/` (dual ESM + CJS + `.d.ts`) is the primary artifact; no BeeUI build toolchain required | Breaking (packaging) |
| Imports | barrel-only, resolved through the workspace | barrel **and** 62 granular per-component subpaths (`@beemvp/beeui-ui/button`) | Additive |
| Theme CSS | `@import` through a monorepo path | `@import '@beemvp/beeui-tokens/theme.css'` (package subpath) | Breaking (path) |
| Tokens package | internal / `private: true` | published public package; a real runtime dependency for source-owned components | Breaking (visibility) |
| CLI | repo-local `pnpm beeui -- add …` shim | `@beemvp/beeui-cli` (binary `beeui`); `npx @beemvp/beeui-cli add …` once published | Distribution |
| Tokens vocabulary | Theme Tokens v3 (DTCG source, scoping, density, overrides, lifecycle) | same, frozen as the stable token contract | Stable |
| New surfaces | Tooltip/Sheet/Table/Calendar/date-time were in progress | all shipped and public | Additive |

None of these is a change to a *published* predecessor (there is none) — they are the
delta from the pre-1.0 **repository** shape to the frozen 1.0 **package** shape. See
[docs/semver-audit.md](semver-audit.md) for why the `0.x → 1.0` boundary is audited as a
surface freeze rather than a version diff.

## Installation paths at 1.0

BeeUI 1.0 supports two coexisting consumption models (ADR-011 D5), kept in lockstep so a
component behaves identically whether installed or copied.

### A. Centralized packages (install and import)

```sh
npm i @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens
```

`@beemvp/beeui-ui` depends on `@beemvp/beeui-core` and `@beemvp/beeui-tokens`, so a package
manager pulls all three. Then wire the theme and the provider (see "Theme wiring" below) and
import components:

```tsx
import { Button, Card, useToast } from '@beemvp/beeui-ui';
```

Every component is also reachable from its own granular subpath (for example
`@beemvp/beeui-ui/button`) — the ADR-012 tree-shaking-friendly entry that resolves the correct
platform build (`react-native` vs web) through the package `exports` conditions. Both forms
resolve to the same implementation; subpath examples are shown under "New in 1.0" below.

### B. Source ownership (copy the source in)

Once the CLI is published:

```sh
npx @beemvp/beeui-cli init
npx @beemvp/beeui-cli add button
```

`add` copies the component source (and its transitive BeeUI dependencies) into your project;
you own the copied files. It rewrites the copied files' `@beemvp/beeui-core` imports to local
copies, and declares `@beemvp/beeui-tokens` as a normal runtime dependency you install (the
#355 resolution — see "Tokens is now a real dependency" below). The command surface, config,
and safety model are unchanged from the pre-1.0 shim ([docs/registry-cli.md](registry-cli.md)).

## Upgrade steps from the pre-1.0 repository shape

### 1. Repoint imports to the published packages

If you consumed BeeUI through a workspace link or a monorepo-relative path, change nothing in
your import *symbols* — the barrel export names are unchanged — only ensure they resolve to
the published `@beemvp/beeui-ui` package rather than a local path. Barrel imports keep working:

```tsx
import { Button, Badge, Card, Dialog, useToast } from '@beemvp/beeui-ui';
```

Optionally migrate hot paths to the per-component subpaths for better tree-shaking (for
example `@beemvp/beeui-ui/table` in place of the barrel) — same symbols, same components. See
the subpath examples under "New in 1.0" below.

### 2. Fix the theme CSS import (Web)

The Web theme now loads from the tokens package subpath, not a monorepo path:

```css
/* src/global.css */
@import '@beemvp/beeui-tokens/theme.css';
```

This is the exact import the clean Web consumer verifies
([docs/consumer-compatibility-report.md](consumer-compatibility-report.md);
`scripts/verify-web-consumer.sh`).

### 3. Theme wiring and provider

Wrap your app root with the provider (required for overlays, toasts, safe-area, and scoped
theming) and, for a Web app, alias `react-native` to `react-native-web` in your bundler as
before:

```tsx
import { BeeUIProvider, useToast } from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      {/* your tree */}
    </BeeUIProvider>
  );
}
```

Scoped theming uses `BeeThemeScope` (barrel export) or `@beemvp/beeui-ui/theme-scope`;
token reads use `useBeeToken` / `getBeeToken`.

### 4. Tokens is now a real dependency

Pre-1.0, the tokens package was internal. At 1.0 it is a **published package** and, for the
source-ownership path, a **declared runtime dependency** rather than a vendored copy
(ADR-011 D5, resolving [#355](https://github.com/beobungbu/BeeUI/issues/355)). Copied
components keep importing runtime values (`spacing`, `layer`, `resolveMotion`,
`resolveNativeMotion`, …) from `@beemvp/beeui-tokens`; the CLI reports it like any other
required package and you install it. Nothing to change in your own code — just ensure
`@beemvp/beeui-tokens` is installed when you own component source that imports it.

### 5. CLI invocation name

The repo-local `pnpm beeui -- add …` shim becomes `npx @beemvp/beeui-cli add …` (binary
`beeui`) once published. The command/flag/exit-code contract is identical
([docs/registry-cli.md](registry-cli.md)); only the invocation prefix changes.

## Compatibility (what 1.0 is tested against)

The declared peer ranges are the public promise; the tested point in each range is the
evidence. Both are governed together — see
[docs/consumer-compatibility-report.md](consumer-compatibility-report.md) and
[docs/compatibility-matrix.md](compatibility-matrix.md).

| Peer | 1.0 range | Notes |
| --- | --- | --- |
| `react` | `>=19 <20` | only the `19.x` line is exercised |
| `react-dom` (Web, optional) | `>=19 <20` | Chromium-only browser evidence |
| `react-native` | `>=0.86.0 <0.87.0` | `0.87` **excluded on real compile-failure evidence** (safe-area-context Kotlin), not a BeeUI defect |
| `tailwindcss` | `>=4 <5` | tested at `4.3.3` |
| `uniwind` | `>=1.10.1 <2` | tested at the `1.10.1` floor |
| `react-native-safe-area-context` | `>=5 <6` | tested `5.7.0` vs RN `0.86.2` |
| `react-native-teleport` | `>=1.1 <2` | anchored-overlay transport |
| `@gorhom/bottom-sheet` (optional) | `>=5.2 <6` | native `Sheet` adapter |
| `@react-native-community/datetimepicker` (optional) | `>=9.1 <10` | native date pickers |
| `react-native-reanimated` / `-gesture-handler` / `-worklets` (optional) | `>=4.5 <5` / `>=2.32 <3` / `>=0.10 <1` | native `Sheet` peers |
| Node (CLI) | `>=24` | CLI runtime; tested on `24.13.1` only |

Expo SDK 57 is the tested Expo line. Web support is evidence-bounded: **Chromium only**, via
the **Expo/Metro** export and the **Vite** consumer; Firefox, Safari/WebKit, other bundlers,
and SSR/SSG are **not claimed** ([docs/web-support-contract.md](web-support-contract.md)).

## New in 1.0: Tooltip, Sheet, Table, Calendar, date-time surfaces

All shipped and public — barrel exports and granular subpaths:

```tsx
import { Tooltip } from '@beemvp/beeui-ui/tooltip';
import { Sheet } from '@beemvp/beeui-ui/sheet';
import { Table } from '@beemvp/beeui-ui/table';
import { Calendar } from '@beemvp/beeui-ui/calendar';
import { DatePicker } from '@beemvp/beeui-ui/date-picker';
import { DateTimePicker } from '@beemvp/beeui-ui/date-time-picker';
```

`Select` ships its own anchored value-selection contract (not an alias of `DropdownMenu`).
`Toast` is provider-scoped via `useToast()`. Component contracts, props, and executable
examples: [docs/component-reference.md](component-reference.md).

### Accessibility, RTL, large text

Logical-direction (RTL/LTR) support is built into direction-aware components; Dynamic
Type/large-text and reduced-motion contracts are part of the component surface. The
accessibility contract and acceptance matrices are
[docs/accessibility-contract.md](accessibility-contract.md) and the keyboard/VoiceOver/TalkBack
release matrices. VoiceOver/TalkBack, RTL/large-text stress, and physical-device behavior are
recorded as their own evidence classes, not implied by compile/deterministic proof
([docs/release.md](release.md)).

## Known limitations at 1.0

- **iOS `pageSheet`/`formSheet` presentation is EXPERIMENTAL** ([#62](https://github.com/beobungbu/BeeUI/issues/62)
  policy, [docs/release.md](release.md) #128). Compile and deterministic contracts are
  proven; live native presentation/placement/swipe on the headless CI simulator is
  quarantined (not a passing runtime gate) and reproduces only intermittently locally. It is
  treated as a documented RN-Modal/headless-simulator limitation, **not** a BeeUI kernel
  defect, and is outside the `1.x` stability promise until exact-head native runtime evidence
  promotes it. `overFullScreen` (transparent) presentation is unaffected and passes.
- **Native runtime for optional Sheet/date-picker peers** and physical-device behavior are
  not certified beyond the recorded evidence classes.
- **Web is Chromium-only** through two proven bundlers, as above.

## Source ownership, production demo, AI-native docs

- **Source ownership**: `beeui add` / `diff` / `update` give you deterministic, non-destructive
  re-sync of copied source ([docs/registry-cli.md](registry-cli.md)).
- **Production demo**: the demo app under `apps/` exercises the real 1.0 surface (dashboard,
  searchable table, detail/edit forms, scheduling, settings) as an integration reference.
- **AI-native docs**: the `llms.txt` family (`llms.txt`, `llms-full.txt`, `llms-components.txt`,
  `llms-patterns.txt`) and the agent cookbook ([docs/ai-agent-cookbook.md](ai-agent-cookbook.md))
  give agents a machine-readable view of the same frozen surface.

## Release-ready vs published — read this before you rely on a command

Every install/`npx` command in this guide describes the **1.0 target shape**. Until the owner
executes the #254 publication gate, `@beemvp/beeui-*` is **not on npm**, no dist-tag exists,
and `npx @beemvp/beeui-cli` is not available. "Release-ready" artifacts, packed tarballs, and
dry runs are **not** publication ([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md),
[docs/dist-tag-policy.md](dist-tag-policy.md)). When the packages are published, these
commands become live as written.

## Cross-references

- Semver classification: [docs/semver-audit.md](semver-audit.md)
- Distribution architecture: [ADR-011](decisions/011-distribution-architecture.md);
  subpath exports: [ADR-012](decisions/012-granular-subpath-exports.md)
- Compatibility: [docs/consumer-compatibility-report.md](consumer-compatibility-report.md),
  [docs/compatibility-matrix.md](compatibility-matrix.md)
- CLI: [docs/registry-cli.md](registry-cli.md)
- Tokens/theme: [docs/token-lifecycle.md](token-lifecycle.md), [docs/theming.md](theming.md)
- Rollback / incident policy: [docs/rollback-runbook.md](rollback-runbook.md)
- Changelog: [CHANGELOG.md](../CHANGELOG.md)
