# ADR-013: Production demo application architecture

Status: Accepted

## Context

[#236](https://github.com/beobungbu/BeeUI/issues/236) (R10.7, parent #114) requires **one
production-grade BeeUI reference/demo application** to be designed — proving the component
system in a realistic multi-screen app **without turning BeeUI into an app framework**. It
is the design authority for the functional implementation epic
[#237](https://github.com/beobungbu/BeeUI/issues/237) and its six screen children
([#258](https://github.com/beobungbu/BeeUI/issues/258)–[#263](https://github.com/beobungbu/BeeUI/issues/263)),
and for the demo-level quality gates
[#238](https://github.com/beobungbu/BeeUI/issues/238)–[#242](https://github.com/beobungbu/BeeUI/issues/242).
Per #236's sequence rule it may be accepted once the hard component **contracts** are
accepted (Table [ADR-007](007-table-datatable-architecture.md), date/time
[ADR-008](008-datetime-architecture.md), overlays [ADR-002](002-overlay-behavior.md),
direction [ADR-004](004-direction-architecture.md), distribution
[ADR-011](011-distribution-architecture.md)); it need not wait for every implementation.

The repository already carries the surfaces this app consumes and the precedents it should
follow:

- **The public component surface.** `registry/registry.json` holds 70 items — 62 shippable
  components plus 8 supporting hooks/primitives (`use-bee-token`, `use-direction`,
  `use-required-callback-warning`, `core-cn`, `core-overlay`, `overlay-runtime`,
  `theme-scope`, `visually-hidden`) — all re-exported from `packages/ui/src/index.ts`.
- **A router-less catalog precedent, `apps/showcase`.** Its `showcase-root.tsx` navigates
  with local React state and explicitly "owns no router"; `app-providers.native.tsx` /
  `app-providers.web.tsx` split the `@gorhom/bottom-sheet` + gesture-handler root providers
  by platform. The Showcase is a **component catalog**, not an application flow — #237's DoD
  is explicit that the demo must be "a coherent multi-screen application flow, not a
  component catalog," so the demo diverges from the Showcase precisely on routing.
- **Consumer starters (#230–#233), `examples/`.** `examples/expo-package-consumer/App.tsx`
  composes `BeeUIProvider`/`Screen`/`SafeArea` and exercises Input/Checkbox/Select/Tooltip/
  Dialog/Sheet/Calendar/Table/Toast through the **public `@beeui/ui` barrel only**, resolved
  through packed tarballs (`@beeui/ui: file:.beeui-tarballs/beeui-ui-0.1.0.tgz`) on the
  pinned Expo SDK 57 / React 19.2.3 / RN 0.86.2 / react-native-web 0.21.0 stack.
- **The responsive vocabulary, `docs/responsive-layout.md`.** Three semantic classes —
  compact (`< 768px`, phone, no variant), `medium` (`768px`, `md:`), `expanded` (`1280px`,
  `xl:`) — with `pageGutter`/`contentWidth` cross-platform dimensions and `max-w-form/
  reading/page/dialog` containers. Tailwind/Uniwind is the **only** responsive execution
  engine; breakpoints are build-time, not a runtime API.
- **The production pattern library, `docs/pattern-library.md`.** 37 catalogued screens
  across Auth/Onboarding, Dashboard+Finance, Commerce+Social, Account+Settings — a proven
  vocabulary of realistic screens the demo's six functional flows draw from.

This ADR sets the demo app's architecture. It scaffolds nothing: it changes no package, no
registry item, no CLI, and no component source. Each decision names the concrete repo
mechanism it rests on and the downstream issue that implements it.

## Constraints

- **BeeUI must not become an app framework** (#236, #237). The demo owns its own
  navigation, data/service layer, and application state. Routing, fetching, and global
  state are **application-owned infrastructure**, never pushed into BeeUI public APIs.
- **Public BeeUI APIs only; no hidden monorepo dependency** (#237 DoD). The app imports from
  the published package entrypoints (`@beeui/ui`, `@beeui/tokens`, transitively
  `@beeui/core`) and never from `packages/**/src/**` deep paths or unexported internals.
- **No duplicate runtime.** No second theme, direction, overlay, or Sheet runtime
  (#258/#259/#263 constraints). Theme/density/direction/text-scale wire to the **existing**
  BeeUIProvider + Uniwind + `use-direction` runtimes.
- **Accepted component contracts are settled**, not re-litigated: Table stores no
  query/sort/filter/selection state (ADR-007 D2 — caller-owned); `CalendarDate`/`ClockTime`
  are timezone-free and date-only values must not silently drift a day (ADR-008); overlay
  modal-vs-anchored policy follows ADR-002; direction resolves through `useDirection()`
  (ADR-004).
- **Unpublished status must stay truthful.** Per ADR-011 and `docs/release.md`, `@beeui/*`
  are pre-publication (`private: true`). The demo may dogfood the **published package shape**
  but must make **no false npm claim** — exactly as the Showcase build-identity note already
  states ("The @beeui/* packages and beeui CLI are not on npm yet").
- **Mobile-first responsive** (#236, #258). Compact phone layout is the base; `medium`/
  `expanded` layouts are progressive enhancements using the ADR / `responsive-layout.md`
  vocabulary, not ad-hoc breakpoint literals.
- **Child-issue collision boundaries must be explicit** (#236 DoD, `docs/beeui-1.0-
  integration-discipline.md`). #258 establishes the shared shell/nav/state/service
  authority; siblings integrate against it rather than rewriting it.

## Options considered

Full option analysis is folded into each decision below (design summary / benefits /
risks / platform / dependency / a11y / migration / evidence), matching the decision-record
template. The load-bearing either/or choices were: **consumption model** (package vs
source-ownership), **navigation** (app-owned router vs Showcase-style local state), and
**state/data** (a store framework vs feature-local state + a thin service seam).

## Decisions

### D1 — Consumption model: package-consumption, dogfooding the published shape

The demo consumes BeeUI through the **public package entrypoints** — `@beeui/ui`,
`@beeui/tokens`, and transitively `@beeui/core` — importing only their exported barrels,
never `packages/**/src/**` deep paths. This **dogfoods the published package shape**
(ADR-011 D1–D5) that external consumers will see, giving the strongest possible signal that
the 1.0 public surface is coherent.

- **Design.** The app lives in-repo as **`apps/demo`**, a first-class Expo app parallel to
  `apps/showcase`. It declares `@beeui/ui`/`@beeui/tokens` as dependencies resolved via the
  workspace during development (same as `apps/showcase`), but its **import surface is
  identical to a clean consumer**: only public exports. A lint/hygiene rule (#239) forbids
  deep imports, so "in-repo for dev velocity" never leaks into "monorepo-coupled."
- **Benefits.** Zero pack step in the dev loop (fast iteration) while still exercising the
  exact public API a `npm i @beeui/ui` consumer gets; reuses `apps/showcase`'s proven Expo
  wiring; naturally feeds #238's clean-consumer-shaped acceptance.
- **Risk / mitigation.** Workspace resolution could mask a packaging gap (an export that
  works in-repo but not from a tarball). Mitigated because that class of gap is owned by
  ADR-011's clean-consumer gates (#202/#204) and the #230–#233 packed-tarball starters, not
  by this demo; the demo's contribution is API-surface realism, not packaging proof. The
  no-deep-import lint rule is the concrete guard.
- **Platform.** Identical resolution to `apps/showcase` on iOS/Android/Web.
- **Rejected: source-ownership (`beeui add`).** It would copy component source into the app,
  proving the CLI/registry path instead of the published-package path — but that path is
  already owned by ADR-011 D5 / #217 and blocked on #355 (the `@beeui/tokens` resolution
  gap). Making the flagship demo depend on an unclosed gap is a worse gate. Source-ownership
  remains validated by its own starter (`examples/source-ownership-starter`).

### D2 — Platform targets and runtime baseline: Expo SDK 57 + react-native-web, one codebase

iOS, Android, and Web from **one Expo React Native codebase** with **react-native-web** for
Web, on the repo's pinned matrix: **Expo SDK 57, React 19.2.3, React Native 0.86.2,
react-native-web 0.21.0** (`docs/compatibility-matrix.md`; matches `examples/expo-package-
consumer/package.json` and `apps/showcase`).

- **Design.** Platform-divergent code uses Metro's `.web.tsx` / `.native.tsx` file-split
  convention already used by `apps/showcase` (`app-providers.*`) and by BeeUI internally
  (`overlay-transport.*`, `date-picker.*`). Native app-root providers
  (`GestureHandlerRootView` + `BottomSheetModalProvider`, required by Sheet per ADR-006) are
  wired exactly as `apps/showcase/app-providers.native.tsx`; the Web providers file loads
  neither module.
- **Benefits.** Single source of truth across three platforms; inherits the Showcase's
  known-good native build/runtime setup and the compatibility matrix's pinned versions.
- **Risk / mitigation.** Native Sheet/gesture wiring is easy to get wrong; mitigated by
  copying the accepted `app-providers.native.tsx` shape verbatim as the #258 baseline.

### D3 — Navigation: app-owned file-based router (Expo Router), BeeUI supplies only chrome

Navigation is **application-owned infrastructure**: the demo adopts **Expo Router**
(file-based routes over React Navigation) as its routing engine. BeeUI supplies **navigation
chrome only** — `AppHeader`, `Screen`, `SafeArea`, `KeyboardAwareScreen`, `BottomActionBar`,
`SegmentedControl`, `Tabs`, `Breadcrumb`, `Link` — never the router itself.

- **Design.** Expo Router gives real URL routes on Web (deep-linkable detail/edit screens,
  browser back/forward) and native stack/tab navigation from one file tree. This is the
  deliberate divergence from `apps/showcase`, which "owns no router" because it is a catalog;
  #237 requires a coherent application flow, which needs real routes and history.
- **Responsive shell.** Mobile-first per `docs/responsive-layout.md`: **compact (`< 768px`)**
  uses a bottom tab bar (Expo Router `Tabs`, or a `BottomActionBar`-styled tab set);
  **`medium`/`expanded`** promote to a persistent side navigation rail with a wider content
  container (`max-w-page`/`max-w-reading`). The layout class is derived from the ADR's
  breakpoint tokens — Tailwind `md:`/`xl:` variants on Web, and a `useWindowDimensions()`
  comparison against `breakpoint.medium`/`breakpoint.expanded` on native (the single
  documented native width-switch pattern, mirroring the Pattern Gallery's one `width >= 960`
  switch). The app invents **no** breakpoint authority.
- **Benefits.** Deep links + Web history for free; the router stays entirely app-side, so
  BeeUI public APIs are never coupled to it (#258 constraint). Chrome reuse keeps the shell
  visually consistent with the rest of BeeUI.
- **Risk / mitigation.** Expo Router is a **new app-owned dependency** (not in the starters).
  Acceptable: #258 explicitly scopes navigation as application-owned infrastructure, and the
  dependency lives only in `apps/demo`, never in `packages/**`. Alternative React Navigation
  (bare) was rejected only for ergonomics — Expo Router is the modern Expo default and gives
  Web URLs without extra linking config.
- **A11y.** Tab/rail items expose accessible names and selected state; focus order and
  native Back/Escape are part of #258's DoD and #238's runtime matrix.

### D4 — State and data: feature-local state + a thin replaceable service seam; no store framework

The demo owns a **local/mock data layer behind a replaceable service interface** and keeps
UI state **feature-local**. It adds **no** global store framework (no Redux/Zustand/React
Query) — YAGNI for an app whose flows are self-contained.

- **Design.**
  - **Service seam.** A `services/` module exposes async functions per domain (e.g.
    `listRecords`, `getRecord`, `saveRecord`, `listSchedule`) returning in-memory fixtures.
    Each function can inject latency and deterministically produce **loading / empty / error
    / no-results** outcomes (fixtures/flags defined here), so every screen can prove those
    states are functional, not static screenshots (#259–#263 DoD). The interface is
    **replaceable** — a real backend could implement the same signatures — but BeeUI gains
    no backend ownership (#259 constraint).
  - **Async state.** One small app-owned hook (illustrative: `useAsync`) models the
    `idle → loading → success | empty | error` lifecycle and a `retry()`; screens consume it
    rather than each re-implementing state machines. This is the DRY seam every data screen
    shares.
  - **UI state.** Feature-local `useState`/`useReducer` inside each screen owns search/
    filter/sort/selection (Table, per ADR-007 D2 — the caller owns this state), form/dirty
    state (#261), and scheduling selection (#262).
  - **App preferences.** Theme / density / direction / text-scale live in a **single small
    app preferences context** that drives the **existing** runtimes — `BeeUIProvider` +
    `Uniwind.setTheme` for theme (as `apps/showcase`'s `ShowcaseThemeControl` already does),
    density tokens, and `useDirection()` (ADR-004) for RTL. This context is **not** a second
    theme/direction runtime (#263 constraint); it is a thin preference holder wired to
    BeeUI's runtimes.
- **Benefits.** Minimal surface, easy to audit as a reference implementation (#239); no
  framework lock-in a reader must learn to understand the demo.
- **Risk / mitigation.** Cross-screen continuity (#263 "state continuity across flows") could
  tempt a global store. Mitigated by keeping only **preferences** and a small **selected-
  entity** handoff in context; per-screen data stays local and re-fetches through the service
  seam on navigation, which is honest about a mock backend.

### D5 — The six functional screens and their component mapping (integration boundaries)

The app is exactly the six flows #258–#263 own. Each maps to **real, exported** BeeUI
components (verified against `packages/ui/src/index.ts`), and each owns a distinct feature
folder so parallel lanes never edit the same file.

| Issue | Screen / flow | Owned path (proposed) | Primary BeeUI components exercised |
| --- | --- | --- | --- |
| **#258** | Shell + responsive navigation | `apps/demo/app/_layout.tsx`, `apps/demo/src/shell/**`, `apps/demo/src/providers/**`, `apps/demo/src/services/**` (skeleton), `apps/demo/src/state/preferences.tsx` | `Screen`, `SafeArea`, `KeyboardAwareScreen`, `AppHeader`, `BottomActionBar`, `SegmentedControl`, `Tabs`, `Link`, `Box`, `HStack`/`VStack` |
| **#259** | Dashboard / data overview | `apps/demo/app/(tabs)/index.tsx`, `apps/demo/src/features/dashboard/**` | `Card`, `Stat`, `Badge`, `Progress`, `DescriptionList`, `MetadataRow`, `Timeline`, `Skeleton` (loading), `EmptyState`/`ErrorState` (empty/error), `Separator`, `Section` |
| **#260** | Searchable/filterable Table flow | `apps/demo/app/(tabs)/records/**`, `apps/demo/src/features/records/**` | `Table` (+ `TableHeader`/`TableBody`/`TableFooter`/`TableRow`/`TableHead`/`TableCell`/`TableCaption`), `SearchInput`, `Chip`/`ChipGroup` (filters), `SegmentedControl`, `Pagination`, `Checkbox` (selection), `DropdownMenu` (row actions), `EmptyState`/`ErrorState` (no-results/error), `Skeleton` |
| **#261** | Detail + edit-form flow | `apps/demo/app/(tabs)/records/[id]/**`, `apps/demo/src/features/record-detail/**` | `Field`, `FieldContext`, `FormGroup`, `FormMessage`, `Label`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Radio`, `DescriptionList` (read view), `AlertDialog` (discard confirm), `useToast` (save feedback), `Button` |
| **#262** | Scheduling / date-time flow | `apps/demo/app/(tabs)/schedule/**`, `apps/demo/src/features/schedule/**` | `Calendar`, `DatePicker`, `DateTimePicker` (`CalendarDate`/`ClockTime` values), `Popover`/`Dialog`/`Sheet` (per ADR-002/ADR-008 presentation), `SegmentedControl`, `useToast` (confirmation), `EmptyState`/`ErrorState` |
| **#263** | Settings + a11y + integrated states/E2E | `apps/demo/app/(tabs)/settings/**`, `apps/demo/src/features/settings/**`, cross-flow integration glue | `ListGroup`/`ListItem`, `Switch`, `SegmentedControl`, `Radio`, `Separator`, `Section`, `AlertBanner` (offline-ish/permission-like fixtures), `useToast`, theme/density/direction/text-scale controls wired to BeeUIProvider + Uniwind + `useDirection()` |

- **Overlay coverage across the app** (product-realistic, ADR-002 policy): `Dialog` +
  `AlertDialog` (modal confirmations), `Sheet` (mobile task, native `@gorhom/bottom-sheet`
  path), `Popover` + `DropdownMenu` (anchored actions), `Tooltip`, and `Toast` feedback —
  together satisfying #237's "modal/anchored actions; Sheet mobile task; Toast/feedback."
- **Table flow** honors ADR-007: the screen owns `page`/`sortDirection`/`onSortChange`/
  filter/selection state; `Table` stores none of it; narrow-viewport fallback uses the
  accepted horizontal-scroll default (opt-in stacked mode only if product-justified).
- **Scheduling** honors ADR-008: values are timezone-free `CalendarDate`/`ClockTime`;
  date-only values must not drift a day; native date/time entry delegates to the system
  picker (`@react-native-community/datetimepicker`, already a starter/showcase dep), Web
  renders `Calendar` in a `Popover`.

### D6 — Cross-cutting quality dimensions wired to existing runtimes

The app exercises theming, density, RTL, large-text, reduced-motion, and a11y through the
**existing** BeeUI foundations — proving them, not re-implementing them.

- **Theme / high-contrast.** `BeeUIProvider` + semantic tokens; light/dark/high-contrast via
  `Uniwind.setTheme` and OS scheme, following `apps/showcase`'s `ShowcaseThemeControl`.
- **Density.** Density tokens (`docs/density.md` compact/comfortable/spacious) driven from
  the settings screen; Table/list row metrics are density-token-driven per ADR-007 D6.
- **RTL.** `useDirection()` (ADR-004) — one direction read; no second direction runtime.
- **Large text.** Dynamic Type respected via BeeUI's type scale; the shell stays navigable at
  large scales (the `apps/showcase` scrolling-header lesson applies to the demo shell).
- **Reduced motion.** Honored per `docs/motion.md` where applicable (#263).
- **A11y.** Accessible names/roles/selected-state on nav, rows, form fields, and overlays;
  keyboard/focus and native Back/Escape are #238 runtime-matrix items.

### D7 — Engineering and quality-gate structure (#238–#242)

The app is held to production engineering standards so it reads as a reference
implementation, not marketing code (#239).

- **Static & tests.** Strict TypeScript; repo lint/hygiene incl. a **no-deep-BeeUI-import**
  rule (enforces D1); deterministic Jest domain/feature/state tests (following
  `apps/showcase/__tests__` + `jest.setup.ts`), including Table search/filter/sort/selection,
  form validation/dirty-state, and scheduling date-state (no-drift) unit tests.
- **E2E.** Critical-path Web **Playwright** flow across all six screens (#238/#263):
  navigate → dashboard → records search/filter → open detail → edit+save (Toast) → schedule
  a date-time (Toast) → change theme/density/RTL in settings.
- **Native runtime.** iOS/Android bundle + runtime smoke (keyboard-safe forms, Sheet gesture/
  keyboard, native Back, safe areas), reusing the Showcase's native-smoke approach and
  `docs/native-runtime-smoke.md` evidence classes.
- **Boundaries & hygiene.** Explicit service/state boundaries (D4); no private BeeUI imports;
  no duplicate theme/overlay runtime; error boundaries/recovery where relevant; clean config,
  no secrets; reproducible build; performance smoke + bundle awareness (#239).
- **Reproducibility & feedback.** The app is the substrate for #241 (a fresh agent extends/
  repairs it using only canonical docs) and #242 (classify demo/consumer feedback before API
  freeze). Documentation gaps found by #241 are fixed before RC; reusable blockers become
  focused issues per #242's categories.
- **Evidence, visual & product polish.** #238 records the platform matrix (iOS/Android/Web ×
  form factors × light/dark/high-contrast × LTR/RTL × large-text) with real captures; #240
  is the UI/UX polish review from real rendered captures; #240's accepted build produces the
  representative screenshots/video suitable for docs/launch.

### D8 — Repository placement and file-ownership boundaries (collision control)

- **Placement.** `apps/demo`, parallel to `apps/showcase`, in the pnpm workspace. Not in
  `examples/` (those are minimal starters); the demo is a first-class reference app.
- **Authority ownership (integration base).** **#258 creates and owns** the shared shell,
  navigation, root providers, app-preferences context, and the `services/` skeleton — this
  becomes the integration base per `docs/beeui-1.0-integration-discipline.md`. Siblings
  **integrate against the latest accepted base**; they do not rewrite shell/nav/state/service
  authority.
- **Feature isolation.** #259–#262 each own a disjoint `src/features/<domain>/**` and route
  folder (see D5 table) — no two parallel lanes touch the same file. #263 owns the settings
  feature **and** the final cross-flow integration (navigation links, state continuity,
  E2E), so it is sequenced **after** #259–#262 land (its DoD already declares this).
- **Shared-file discipline.** Only #258 and #263 touch shell/integration files; #259–#262
  touch only their feature folder plus additive route registration. Any sibling needing a
  shell/service change requests it against the #258 base rather than forking it.

## Rejected alternatives

- **Extend `apps/showcase` instead of a new app.** Rejected: the Showcase is a router-less
  catalog by design; #237 requires a coherent routed application. Bolting flows onto the
  catalog would blur "catalog" and "application" and violate the catalog's own "owns no
  router" contract.
- **Source-ownership consumption for the flagship demo.** Rejected for D1's reasons — it
  depends on the still-open #355 tokens-resolution gap and is already covered by its own
  starter and ADR-011 D5/#217.
- **A global store framework (Redux/Zustand) or React Query.** Rejected as YAGNI: the demo's
  flows are self-contained; a thin service seam + feature-local state + one `useAsync` hook
  covers loading/empty/error/retry without a framework a reader must learn.
- **A demo-owned breakpoint/media-query engine on native.** Rejected: `docs/responsive-
  layout.md` forbids a parallel media-query engine; the demo uses the canonical breakpoint
  tokens and the one documented native width-switch pattern.
- **Pushing routing/data/state into BeeUI.** Rejected outright — it would make BeeUI an app
  framework, the exact non-goal of #236/#237.

## Implementation consequences

- **Unblocks #237's children with settled architecture:** #258 (shell/nav/providers/services
  skeleton + preferences context, the integration base), #259 (dashboard), #260 (Table
  flow), #261 (detail/edit), #262 (scheduling), #263 (settings + final integration/E2E).
  Each can start from D5's component map and D8's ownership without re-deciding architecture.
- **Unblocks the demo quality gates:** #238 (platform acceptance), #239 (engineering gate),
  #240 (visual/product polish), #241 (fresh-agent reproduction), #242 (feedback
  classification) inherit D7's structure.
- **New app-owned dependency:** Expo Router is added to `apps/demo` only (D3). No
  `packages/**`, registry, or CLI change results from this ADR.
- **No publication, no scaffold.** This ADR authors architecture only; `apps/demo` is created
  by #258, not here.

## Verification plan

None for this ADR itself — it is a doc-only decision and touches no package, registry, CLI,
component, or app source (`pnpm typecheck` remains green; the known pre-existing
`apps/visual-regression` `@types/node` gap is out of scope). The verification it *specifies*
lands with the implementing issues: deterministic Jest domain/state tests (#258–#263), Web
Playwright critical-path E2E (#238/#263), iOS/Android runtime smoke (#238), the platform ×
form-factor × theme × direction × large-text matrix (#238), and the real-capture UI/UX polish
review (#240), all exact-head/build-keyed per `docs/beeui-1.0-evidence-classes.md`.

## Revisit trigger

Revisit if: a target platform cannot honor Expo Router's Web/native resolution (changing D3's
router choice); the accepted Table (ADR-007) or date/time (ADR-008) contracts change in a way
the six-screen mapping depends on; the mock-service seam proves insufficient to demonstrate a
required production state (forcing a richer data strategy under D4); or the package-consumption
model surfaces a public-API gap the demo cannot express without a deep import (which would be a
#242-category-1 BeeUI blocker, fixed in BeeUI — not worked around in the demo).
