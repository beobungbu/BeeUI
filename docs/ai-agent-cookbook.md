# BeeUI AI-agent development contract and prompt cookbook

This document tells a coding agent (Claude, Codex, or any other) how to reason about,
build applications with, and contribute to BeeUI **without relying on hidden maintainer
knowledge**. It is truthful to the current repository state: BeeUI is pre-1.0 and
**unpublished**. Everything an agent needs is in canonical, in-repo, machine-checkable
context.

It has two parts:

- **Part 1 — Development contract**: the rules an agent must respect. What is real today,
  how to consume BeeUI, and where BeeUI's ownership boundaries stop.
- **Part 2 — Prompt cookbook**: task-oriented prompt recipes for common jobs, each
  deriving its own base and stopping on blocked/owner-gated states.

The machine-readable entry points this contract cross-links are the canonical `llms.txt`
family: [llms.txt](../llms.txt), [llms-full.txt](../llms-full.txt),
[llms-components.txt](../llms-components.txt), and [llms-patterns.txt](../llms-patterns.txt).
A regression suite ([scripts/check-ai-agent-contract.mjs](../scripts/check-ai-agent-contract.mjs),
tested by [scripts/\_\_tests\_\_/ai-agent-contract.test.mjs](../scripts/__tests__/ai-agent-contract.test.mjs))
keeps this document from drifting away from the real component surface, scripts, and links.

<!-- ai-contract:components
BeeUIProvider, SafeArea, AppHeader, BottomActionBar, Box, Text,
Button, Field, FormGroup, Input, Textarea, Checkbox, Switch, RadioGroup, SegmentedControl,
Dialog, AlertDialog, Popover, DropdownMenu, Select, Tooltip, Sheet,
Table, TableRow, TableCell, Calendar, DatePicker, DateTimePicker,
Stat, Timeline, Badge, Avatar, DescriptionList, useToast
-->

---

## Part 1 — Development contract

### 1. Read this before anything else: the unpublished-status rules

BeeUI is **pre-1.0 and UNPUBLISHED**. This is the single most important fact for an agent,
because the natural instinct — "install the library from npm" — is wrong today.

- There is **no `@beemvp/beeui-*` package on npm**, **no `@beemvp/beeui-cli`**, **no `v1.0.0` tag**, and
  **no GitHub Release**. The repository is private by owner decision.
- The names `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` are
  **release-ready-but-not-published targets**. They are reserved intent, not live registry
  entries. See [docs/distribution-names.md](distribution-names.md) and
  [ADR-011](decisions/011-distribution-architecture.md).
- **Never** tell a user to run `npm install @beemvp/beeui-ui`, `npx @beemvp/beeui-cli add ...`, or
  `npx beeui ...`. Those resolve to nothing today (`beeui` unscoped is an unrelated
  unpublish tombstone — do not claim it).
- **Never** describe BeeUI as published or as being installable from npm. "Release-ready"
  is not "released".

The path that **works today** is repository-local source ownership:

```sh
pnpm beeui -- add <component>
```

Whenever you write install/setup instructions, present the package model as a
*future/target* path and the source-ownership CLI as the *working* path.

### 2. The two consumption models (package vs source ownership)

BeeUI deliberately supports two models. Pick per the consumer's needs.

| | Centralized packages | Source ownership |
| --- | --- | --- |
| Command | `npm i @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens` (**target, not yet on npm**) | `pnpm beeui -- add <component>` (**works today, repo-local**) |
| Consumer gets | a dependency on `@beemvp/beeui-*` | copied component **source files it now owns** |
| Import | `import { Button } from '@beemvp/beeui-ui'` | imports rewritten to consumer-local copies (e.g. `@beemvp/beeui-core` → copied `cn`) |
| Upgrades | bump the package | re-run `add`, or hand-maintain the owned copy |
| Available now | no (release-gated, #254) | yes |

Details: [docs/registry-cli.md](registry-cli.md), [docs/distribution-names.md](distribution-names.md),
[ADR-011](decisions/011-distribution-architecture.md). The machine-readable registry that
drives `add` is [registry/registry.json](../registry/registry.json).

The source-ownership CLI:

- `pnpm beeui -- init` — create `beeui.config.json` in the consumer.
- `pnpm beeui -- list` — list the supported public components (generated from the registry).
- `pnpm beeui -- add <items...>` — resolve transitive BeeUI dependencies and copy source in
  deterministic order. It **does not** install npm packages, **does not** fetch remote
  executable code, and **does not** create a dependency back to this monorepo.
- `pnpm beeui -- add --dry-run <items...>` — print the deterministic plan with no filesystem
  mutation. Prefer this first when reasoning about impact.
- `pnpm beeui -- doctor` — validate the registry and local config.

Copied source may declare external peers/dependencies (e.g. `@beemvp/beeui-tokens`, and for `sheet`
the `@gorhom/bottom-sheet` / Reanimated / Gesture-Handler / Worklets native stack). The CLI
prints those requirements; the consumer installs them like any other dependency. Source-owned
code must **never** leak `workspace:*`, private monorepo imports, or undeclared dependencies.

### 3. What BeeUI owns — and what it does not

BeeUI owns **UI only**: typed, accessible React Native + Web components plus a semantic
design-token contract. It intentionally does **not** own routers, data fetching, backend,
auth, payment, a form-management library, or a chart framework. Do not add those into
`@beemvp/beeui-ui`, and do not expect BeeUI to provide them. See [docs/architecture.md](architecture.md).

The public surface is **62 public component modules** exported from `@beemvp/beeui-ui`, plus
`@beemvp/beeui-core` (engine-neutral helpers) and `@beemvp/beeui-tokens` (semantic tokens + theme CSS).
The authoritative inventory is [llms-components.txt](../llms-components.txt), generated from
[packages/ui/src/index.ts](../packages/ui/src/index.ts) and
[registry/registry.json](../registry/registry.json). The per-component contract table is
[docs/components.md](components.md).

### 4. Component selection and the Rule of Two

- **Compose existing primitives first.** Keep domain-specific composition local to the
  consumer app, not in `@beemvp/beeui-ui`.
- **Rule of Two**: promote a shared primitive only after repeated (or behaviorally complex)
  evidence — do not generalize on the first use. See [docs/roadmap.md](roadmap.md).
- Use [llms-patterns.txt](../llms-patterns.txt) and the executable Pattern Gallery
  (`apps/showcase/patterns/**`) as composition examples. Patterns import public `@beemvp/beeui-ui`
  APIs and own local domain composition; they are **not** exports and are **not**
  installable via the registry.

### 5. Provider, theme, density, accessibility, RTL, large text

- **App shell**: wrap the app in `BeeUIProvider`. Own safe-area edges explicitly with
  `SafeArea` around `AppHeader` / content / `BottomActionBar`.
- **Theme/density**: brand and density changes live in tokens/themes, not in component
  source. Every semantic color token exists in every theme; light and dark are both
  first-class. Prefer semantic tokens (`bg-primary`, `text-foreground`, `border-border`)
  over palette or literal colors. See [docs/theming.md](theming.md) and
  [docs/density.md](density.md).
- **Accessibility is part of correctness**, not an add-on: roles/states/names, focus and
  keyboard behavior, RTL/logical direction, large text (Dynamic Type), high contrast, and
  reduced motion. Merge caller-provided accessibility state with BeeUI-required state rather
  than discarding it. See [docs/accessibility-contract.md](accessibility-contract.md),
  [docs/dynamic-type.md](dynamic-type.md), and [docs/motion.md](motion.md).
- **Styling engine is an implementation detail.** Uniwind/Tailwind is replaceable behind
  BeeUI's stable contracts. `className` is an optional escape hatch, not a portability
  guarantee; never build application logic on it, and never construct utility names
  dynamically (`bg-${x}` is forbidden — map state to complete literal class strings).

### 6. Ownership boundaries you must not cross

These are the boundaries agents most often get wrong. Respect the ADRs.

- **Table / DataTable**: `Table` is a composable primitive family (`TableRow`, `TableCell`,
  …). You map your own rows; **sort and selection state stay caller-owned**. BeeUI does not
  ship a data-grid with built-in fetching/sorting. See
  [ADR-007](decisions/007-table-datatable-architecture.md).
- **Date and time**: `Calendar`, `DatePicker`, and `DateTimePicker` are **timezone-free,
  single-date, `Intl`-driven**. The **app owns** any timezone or business-calendar
  conversion. See [ADR-008](decisions/008-datetime-architecture.md) and
  [docs/date-i18n-timezone-matrix.md](date-i18n-timezone-matrix.md).
- **Overlays / Sheet**: use `Dialog`/`AlertDialog` for modal-class flows;
  `Popover`/`DropdownMenu`/`Select`/`Tooltip` for anchored non-modal content; `Sheet` for
  gesture bottom sheets. `Sheet` requires `GestureHandlerRootView` + `BottomSheetModalProvider`
  at the app root on native ([ADR-006](decisions/006-sheet-gesture-engine.md)). Anchored
  overlays share one geometry/runtime/portal contract
  ([docs/anchored-overlays.md](anchored-overlays.md), [ADR-002](decisions/002-overlay-behavior.md));
  do not introduce a second overlay/portal authority. Use `useToast()` for transient
  notifications ([docs/toast.md](toast.md)).
- Do not introduce duplicate theme, overlay, focus, direction, or state authority anywhere.

### 7. Contributing to BeeUI: required tests and evidence

If the task is to **modify BeeUI itself** (not just build an app with it), the full protocol
is [docs/agent-execution-contract.md](agent-execution-contract.md) and the code rules are
[AGENTS.md](../AGENTS.md) / [CONTRIBUTING.md](../CONTRIBUTING.md). Summary of what an agent
must do:

- **Self-test on the exact PR head** — repo hygiene + `git diff --check`, strict typecheck,
  targeted load-bearing tests, the normal suite when applicable, and release/package/registry
  verification when the public surface is touched. Run `pnpm typecheck` and `pnpm test`; add
  `pnpm registry:verify` for source-ownership/registry changes.
- **Load-bearing tests only**: a new regression test must fail when the fix/contract is
  reverted. Do not satisfy an interaction/runtime risk with mock/snapshot/type-only tests.
- **Match the claimed evidence class** to what actually ran. Browser/compile evidence must
  not be presented as device/simulator proof.
- **Definition of done for a new primitive** (from [AGENTS.md](../AGENTS.md)): typed public
  API, ref forwarding where applicable, accessibility semantics, semantic-token-only styling,
  light/dark behavior, a showcase example, and a contract test.

### 8. Review, self-merge, and owner/release gates

- **Mandatory self-review** of the exact head before handoff, then **independent review** by
  a different pass. A self-review is required but never a substitute for independent review.
- **No self-merge.** An implementation agent must not merge its own PR, merge sibling PRs,
  update `main` directly, weaken required checks, or claim "CI green" without identifying the
  exact green head.
- **Owner/admin/release gates are hard stops.** An agent must not publish npm packages or the
  CLI, create stable tags/dist-tags/releases, make the repo public, or decide owner-gated
  legal/business policy. Prepare a decision packet and stop with `OWNER_ACTION_REQUIRED`.
  Final 1.0 publication is owner-commanded (#254) only. See
  [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md).

### 9. Common failure recovery

| Symptom | Cause | Recovery |
| --- | --- | --- |
| `npm install @beemvp/beeui-ui` fails / 404 | package is unpublished | Use `pnpm beeui -- add <component>` (source ownership). Do not invent a registry. |
| `npx beeui add ...` does nothing / wrong package | `beeui` unscoped is a tombstone; CLI is repo-local | Use `pnpm beeui -- add ...` inside the repo. |
| Copied component fails to resolve `@beemvp/beeui-core` | expected — imports are rewritten to a local copy | Ensure `pnpm beeui -- add` ran fully; it copies `core-cn`/`core-overlay` and rewrites imports. |
| `Sheet` throws at runtime on native | missing gesture/bottom-sheet providers | Add `GestureHandlerRootView` + `BottomSheetModalProvider` at the app root (ADR-006) and install the native peers the CLI reported. |
| Overlay renders in the wrong place / no dismiss | second overlay authority introduced | Use the shared anchored-overlay contract; do not add a parallel portal. |
| Dates shift by a day across timezones | expecting BeeUI to own timezones | It does not (ADR-008). Do the timezone conversion in the app. |
| `pnpm llms:check` or `registry:verify` fails after edits | generated artifacts / registry drift | Run `pnpm llms:generate`; update `registry/registry.json` for public export changes. |
| Dependency named by an issue is unmerged/red | you are on a stale or wrong base | **STOP** and report `BLOCKED_BY_DEPENDENCY`; do not implement on an unsatisfied base. |

---

## Part 2 — Prompt cookbook

These are task-oriented prompts an agent (or a dispatcher writing a prompt for one) can use.
They rely only on canonical, public, in-repo context. Every recipe must **derive its own
base** (do not paste a stale SHA), and **stop** on a blocked or owner-gated state instead of
guessing. Replace `<...>` placeholders.

The canonical dispatcher prompt these align with is
[docs/claude-dispatch-prompt.md](claude-dispatch-prompt.md).

### Shared preamble (prepend to any recipe)

> Read [llms.txt](../llms.txt) first, then the specific docs it links. BeeUI is pre-1.0 and
> UNPUBLISHED: never use `npm install @beemvp/beeui-*` or `npx @beemvp/beeui-cli`; the working path is
> `pnpm beeui -- add <component>`. Derive the current base with `git fetch` + record the
> `origin/main` SHA. Prefer semantic tokens; keep domain composition in the app. Stop and
> report `BLOCKED_BY_DEPENDENCY` or `OWNER_ACTION_REQUIRED` rather than guessing.

### Recipe A — Add and use a component (source ownership)

> Goal: add `<component>` to `<consumer app>` using BeeUI source ownership. Steps: run
> `pnpm beeui -- add --dry-run <component>` and show me the plan; then `pnpm beeui -- add
> <component>`; wire the app shell with `BeeUIProvider` + `SafeArea`; import from the copied
> local path (not `@beemvp/beeui-ui`, which is unpublished). Install any external peers the CLI
> reports. Do not add a router, data layer, or form library.

### Recipe B — Build a responsive form

> Goal: build a `<purpose>` form. Use `Field` to compose label/description/error for each
> text `Input`/`Textarea`; use `FormGroup` for related controls (`Checkbox`, `RadioGroup`,
> `Switch`, `SegmentedControl`) so the group keeps one legend/description/error without
> collapsing the controls into a single accessibility element. Controlled selection controls
> must receive their change callback. Keep the layout responsive with semantic spacing
> tokens. Reference [llms-patterns.txt](../llms-patterns.txt).

### Recipe C — Build a Table / DataTable screen

> Goal: build a `<domain>` table screen. Use the `Table` family (`Table`, `TableRow`,
> `TableCell`). Keep sort and selection state **caller-owned** — BeeUI does not ship a
> fetching/sorting data-grid (ADR-007). Map my rows to `TableRow`/`TableCell`; put any
> sorting/paging logic in the app. Add `Badge`/`Stat` for cell adornments if useful.

### Recipe D — Build a Calendar / DatePicker flow

> Goal: build a `<use case>` date flow using `Calendar` / `DatePicker` / `DateTimePicker`.
> These are timezone-free, single-date, `Intl`-driven (ADR-008): the app owns any timezone or
> business-calendar conversion. Do the conversion in app code and pass plain single dates in.
> Do not expect multi-date range selection from these primitives.

### Recipe E — Use Tooltip and Sheet

> Goal: add a `Tooltip` on `<trigger>` and a `Sheet` for `<bottom-sheet content>`. `Tooltip`
> is anchored non-modal content (shared overlay contract). `Sheet` is a gesture bottom sheet
> that requires `GestureHandlerRootView` + `BottomSheetModalProvider` at the native app root
> (ADR-006); install the native peers the CLI reports. Do not introduce a second overlay or
> portal authority.

### Recipe F — Apply theme and density

> Goal: apply a `<brand>` theme and `<comfortable|compact>` density. Make brand/density
> changes in tokens/themes only (`@beemvp/beeui-tokens`), never in component source. Keep every
> semantic color token defined in every theme and verify light and dark. Wire the Web theme
> via `@import '@beemvp/beeui-tokens/theme.css'`. Reference [docs/theming.md](theming.md) and
> [docs/density.md](density.md).

### Recipe G — Satisfy RTL and accessibility rules

> Goal: audit `<screen>` for RTL and accessibility. Confirm logical direction/RTL mirroring,
> large-text (Dynamic Type) reflow, high contrast, and reduced motion. Confirm interactive
> components expose correct role/name/state and keyboard/focus behavior, and that
> caller-provided accessibility state is merged, not discarded. Reference
> [docs/accessibility-contract.md](accessibility-contract.md).

### Recipe H — Diagnose an intentional setup error

> Goal: a consumer reports `<error>` (e.g. `Cannot find module '@beemvp/beeui-ui'`, or `Sheet`
> throwing on native). Diagnose from the failure-recovery table in
> [docs/ai-agent-cookbook.md](ai-agent-cookbook.md) §9: identify whether the root cause is the
> unpublished-package assumption, missing source-ownership `add`, missing native
> Sheet providers, a second overlay authority, or timezone expectations — then apply the
> documented recovery from [§9](ai-agent-cookbook.md). Do not fix it by inventing an npm package.

### Recipe I — Contribute a change to BeeUI (full protocol)

> Goal: implement issue `<#N>`. Follow [docs/agent-execution-contract.md](agent-execution-contract.md):
> `git fetch`, record the accepted base SHA, verify all named dependencies are merged on that
> base (else STOP `BLOCKED_BY_DEPENDENCY`), branch once, inspect current code before editing,
> implement only the assigned scope, add load-bearing tests, run `pnpm typecheck` and
> `pnpm test` (plus `pnpm registry:verify` if the registry/public surface changed), do the
> mandatory self-review, and open an **unmerged** PR with base+head SHAs and the evidence
> block. Do not self-merge, publish, or cross an owner gate.

---

Generated docs the family links to are produced by
[scripts/generate-llms-txt.mjs](../scripts/generate-llms-txt.mjs) (`pnpm llms:generate`).
This cookbook is guarded against drift by `pnpm ai-contract:check` and `pnpm ai-contract:test`.
