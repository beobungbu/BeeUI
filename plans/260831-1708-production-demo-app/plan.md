---
title: "Production demo app build (#237 / #258–#263)"
description: "Screen-by-screen build plan for the BeeUI production demo, executing ADR-013."
status: pending
priority: P2
effort: 6 lanes (see phases)
branch: feat/236-demo-architecture
tags: [demo, architecture, expo, r10]
created: 2026-08-31
---

# Production demo application — build plan

Executes **[ADR-013](../../docs/decisions/013-production-demo-architecture.md)**. This plan
is the task breakdown for the #237 integration epic; the architecture is already decided in
ADR-013 and is **not** re-opened here. App lives at `apps/demo` (Expo SDK 57 / RN 0.86.2 /
react-native-web 0.21.0), package-consumption of public `@beeui/*` only, Expo Router owned
by the app, feature-local state + a thin `services/` mock seam.

**Scope guard:** this plan does NOT authorize scaffolding during #236. Scaffolding starts at
#258. No npm/CLI/release publication.

## Dependency graph

```
#258 shell/nav/providers/services-skeleton  (INTEGRATION BASE — must land first)
   ├─ #259 dashboard        ─┐
   ├─ #260 Table flow       ─┤ parallel; each owns a disjoint src/features/<domain>/**
   ├─ #261 detail/edit      ─┤ + route folder (no shared-file edits)
   └─ #262 scheduling       ─┘
        └─ #263 settings + final integration + critical-path E2E  (after #259–#262)
             └─ #238 platform acceptance → #239 engineering gate → #240 polish
                  → #241 fresh-agent reproduction → #242 feedback classification
```

Blockers: #260 also needs stable Table (#170 / ADR-007); #262 also needs stable date/time
(#178 / ADR-008). #258 needs nothing beyond ADR-013.

## Phases

| # | Phase | Issue | Depends on | Owned paths | Status |
|---|-------|-------|-----------|-------------|--------|
| 1 | Shell + responsive navigation (integration base) | #258 | ADR-013 | `apps/demo/app/_layout.tsx`, `src/shell/**`, `src/providers/**`, `src/state/preferences.tsx`, `src/services/**` (skeleton) | pending |
| 2 | Dashboard / data overview | #259 | Phase 1 | `app/(tabs)/index.tsx`, `src/features/dashboard/**` | pending |
| 3 | Searchable/filterable Table flow | #260 | Phase 1, #170 | `app/(tabs)/records/index.tsx`, `src/features/records/**` | pending |
| 4 | Detail + edit-form flow | #261 | Phase 1 | `app/(tabs)/records/[id]/**`, `src/features/record-detail/**` | pending |
| 5 | Scheduling / date-time flow | #262 | Phase 1, #178 | `app/(tabs)/schedule/**`, `src/features/schedule/**` | pending |
| 6 | Settings + a11y + final integration + E2E | #263 | Phases 1–5 | `app/(tabs)/settings/**`, `src/features/settings/**`, cross-flow glue, `e2e/**` | pending |

Quality gates after Phase 6: #238 (platform matrix) → #239 (engineering gate) → #240
(visual/product polish) → #241 (fresh-agent reproduction) → #242 (feedback classification).

## Per-phase detail

### Phase 1 — #258 shell + navigation (INTEGRATION BASE)
- **Do:** create `apps/demo` Expo app; root providers split `.native.tsx`/`.web.tsx`
  (GestureHandlerRootView + BottomSheetModalProvider on native, per ADR-006 / showcase);
  Expo Router layout with compact bottom-tabs and medium/expanded side-rail (breakpoint
  tokens, `useWindowDimensions` native switch); app-preferences context (theme/density/
  direction/text-scale) wired to BeeUIProvider + Uniwind + `useDirection()`; `services/`
  skeleton with the async signatures + latency/error/empty injection; route placeholders
  for #259–#262.
- **Components:** Screen, SafeArea, KeyboardAwareScreen, AppHeader, BottomActionBar,
  SegmentedControl/Tabs, Link, Box, HStack/VStack.
- **Validate:** strict typecheck; Web narrow+desktop nav smoke; native bundle/compile;
  narrow-phone & desktop captures; RTL/large-text shell usable; no viewport overflow.
- **Risk:** native Sheet/gesture root wiring — copy accepted `app-providers.native.tsx`
  shape verbatim. **Rollback:** app is additive under `apps/demo`; revert = delete app.

### Phase 2 — #259 dashboard
- **Do:** summary/metric cards, meaningful overview, loading/empty/error/refresh via
  `useAsync` + service seam; responsive; representative long labels/numbers.
- **Components:** Card, Stat, Badge, Progress, DescriptionList, MetadataRow, Timeline,
  Skeleton, EmptyState/ErrorState, Separator, Section.
- **Validate:** deterministic feature/state tests; typecheck; narrow+wide visual; light/
  dark/high-contrast/RTL/large-text; states functional (not screenshots).

### Phase 3 — #260 Table flow
- **Do:** caller-owned search/filter/sort/selection (ADR-007 D2 — Table stores none);
  loading/empty/error/no-results; row actions via DropdownMenu; narrow horizontal-scroll
  fallback; realistic long text/numbers.
- **Components:** Table family, SearchInput, Chip/ChipGroup, SegmentedControl, Pagination,
  Checkbox, DropdownMenu, EmptyState/ErrorState, Skeleton.
- **Validate:** deterministic search/filter/sort/selection tests; Web keyboard/Table
  interaction; narrow/wide visual; RTL/large-text/high-contrast/long-data; no overflow or
  inaccessible row action.

### Phase 4 — #261 detail/edit
- **Do:** detail read view; controlled editable form with validation/error/help; save/
  cancel/dirty behavior; AlertDialog discard confirm; Toast save feedback; keyboard-safe.
- **Components:** Field, FieldContext, FormGroup, FormMessage, Label, Input, Textarea,
  Select, Checkbox, Switch, Radio, DescriptionList, AlertDialog, useToast, Button.
- **Validate:** deterministic form/state/validation tests; Web keyboard/focus/error flow;
  native keyboard proof; RTL/large-text/high-contrast/long-content; states functional.

### Phase 5 — #262 scheduling/date-time
- **Do:** calendar/date selection in a scheduling workflow; date-time edit/confirm; locale-
  aware; min/max/disabled; mobile presentation per ADR-002/ADR-008 (Web Calendar-in-Popover,
  native system picker); Toast after completion. **Date-only values must not drift a day.**
- **Components:** Calendar, DatePicker, DateTimePicker (CalendarDate/ClockTime), Popover/
  Dialog/Sheet, SegmentedControl, useToast, EmptyState/ErrorState.
- **Validate:** deterministic scheduling/date-state tests incl. no-drift; Web date/keyboard/
  focus; iOS/Android picker evidence; vi/en + RTL/large-text; timezone/date-only boundaries
  explicit.

### Phase 6 — #263 settings + integration + E2E
- **Do:** settings for theme/density/a11y prefs (light/dark/high-contrast, RTL, large-text,
  reduced-motion) wired to existing runtimes (no second runtime); Toast/feedback; offline-ish/
  permission-like/error-recovery fixtures (AlertBanner); final nav links + state continuity
  across all flows; critical-path Web E2E.
- **Components:** ListGroup/ListItem, Switch, SegmentedControl, Radio, Separator, Section,
  AlertBanner, useToast + theme/density/direction controls.
- **Validate:** typecheck; deterministic preference/state tests; Web E2E across all six
  screens; iOS/Android smoke; full theme/direction/large-text/reduced-motion matrix;
  loading/empty/error/recovery reachable; no duplicate authority/private import.

## Cross-cutting acceptance (all phases)
Strict TypeScript · no deep `@beeui/**/src` imports (lint-enforced) · public API only · no
duplicate theme/overlay/direction/Sheet runtime · deterministic tests · PRs unmerged, each
independently reviewed · honest unpublished status (no npm claims).

## File-ownership rule
Only #258 and #263 edit shell/integration files. #259–#262 edit only their
`src/features/<domain>/**` + additive route registration. Shell/service changes are
requested against the #258 base, never forked.

## Unresolved questions
1. **Route group shape** — `app/(tabs)/records/[id]` vs a modal route for detail/edit on
   Web: deferred to #258/#261 implementation (both satisfy ADR-013 D3).
2. **Stacked Table mode** (ADR-007 D4 opt-in) — enable only if #260's narrow-viewport review
   shows horizontal-scroll is insufficient; not pre-committed.
3. **Demo domain/entity** — the concrete product domain (e.g. team/projects/scheduling) is a
   #258 product choice; ADR-013 fixes the flows, not the fiction.
