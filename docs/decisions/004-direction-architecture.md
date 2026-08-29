# ADR-004: Direction architecture (LTR/RTL)

Status: Accepted

## Context

BeeUI 1.0 must ship one deterministic, testable answer to "which way does this render" across native (iOS/Android) and Web, for layout, anchored-overlay geometry, and future Table/Calendar/date controls. Today that answer is fragmented:

- **Anchored-overlay geometry** (`@beeui/core`) already has a real, platform-neutral direction contract. `packages/core/src/utils/anchored-overlay.ts:3` defines `AnchoredOverlayDirection = 'ltr' | 'rtl'`; `alignedCoordinate()` (`packages/core/src/utils/anchored-overlay.ts:140-158`) flips `'start'`/`'end'` alignment for top/bottom placements when `direction === 'rtl'` (`packages/core/src/utils/anchored-overlay.ts:177`); `resolveAnchoredOverlayPosition()` defaults to `direction: 'ltr'` when the caller omits it (`packages/core/src/utils/anchored-overlay.ts:244`). `docs/architecture.md:138` documents this as "logical alignment with deterministic flip/shift... and RTL rules." `@beeui/core` has no `react`/`react-native` dependency (`packages/core/package.json`: only `clsx` and `tailwind-merge`), so it cannot and does not read any platform direction signal — direction is always an explicit input to this layer.
- **`useAnchoredOverlayPosition()`** in `packages/ui/src/components/overlay-runtime.tsx:654-661` is the RN-facing hook that forwards to the core resolver. It also defaults `direction = 'ltr'` (`overlay-runtime.tsx:661`) and does not read any platform direction signal itself.
- **Three overlay components independently duplicate the platform read.** `PopoverContent` (`packages/ui/src/components/popover.tsx:200`), `DropdownMenuContent` (`packages/ui/src/components/dropdown-menu.tsx:232`), and `SelectContent` (`packages/ui/src/components/select.tsx:479`) each default their public `direction` prop with the identical inline expression `I18nManager.isRTL ? 'rtl' : 'ltr'`, importing `I18nManager` from `react-native` directly. There is no shared function, hook, or single read-site — the same ternary is copy-pasted three times, and any future anchored-overlay-geometry component (Table, Calendar/date controls) would either duplicate it a fourth time or invent something different.
- **No Web `document`/`dir` handling exists anywhere in the source tree.** A repo-wide search for `document.dir`, `documentElement.dir`, and any `dir="rtl"`/`dir={...}` usage returns no matches. The three components above import `I18nManager` from `react-native`, which resolves to `react-native-web`'s implementation on Web (the Showcase/production-demo Web target depends on `react-native-web@0.21.0`, `apps/showcase/package.json:24`), so there is currently one code path shared across platforms — but nothing in BeeUI reads or reconciles the DOM `dir` attribute that CSS logical properties and native browser bidi behavior (text selection, form controls, scrollbars) actually key off.
- **No RTL/direction test exists.** A repo-wide search for `RTL`/`isRTL`/`direction` under `*.test.ts*` returns no matches. Nothing currently pins the flip/shift/align behavior `docs/architecture.md:138` claims.
- **No logical component-level start/end vocabulary exists yet** beyond the overlay geometry `align: 'start' | 'end'` contract above. `packages/ui/src/components/form-group.tsx` and `packages/ui/src/components/stack.tsx` use `'start'`/`'end'` only as flex-alignment literals, not as a direction-aware logical-property system.
- BeeUI already has an established, accepted precedent for "read an ambient platform/host signal without owning a second state engine": `BeeThemeScope` (`packages/ui/src/components/theme-scope.tsx`) is documented to introduce "no `React.createContext`, no module-level mutable state, and no subscription mechanism of its own" (`theme-scope.tsx:114-118`) — it is a stateless resolver that forwards a computed value to Uniwind's own `ScopedTheme`. Direction architecture should follow the same shape: BeeUI does not own RTL state; it reads the platform's own authority and forwards an explicit value.

#139 requires one deterministic direction contract usable by components, overlays, docs, Table, Calendar/date controls, and the production demo, without introducing a second global state engine solely for RTL. #140 (logical-direction audit) and #141/#142 (RTL overlay/component acceptance) depend on this ADR's precedence table and mapping rules being mechanically applicable (`docs/roadmap.md:159-167`).

## Constraints

- **Platform**: iOS, Android (bare RN + Expo), and Web (Expo Web / `react-native-web`) must all resolve direction coherently; native and Web have different ambient authorities (`I18nManager` vs. DOM `dir`) and no shared "watch for change" primitive.
- **No second global state engine (hard invariant, #139 scope)**: no new `React.createContext`, module-level mutable store, or subscription/observer system dedicated to RTL. BeeUI may only *read* existing platform authorities (`I18nManager`, DOM `dir`) and *forward* an explicit value through existing composition (props, RN's own Yoga `direction` style).
- **Reuse, don't duplicate, existing authorities**: `@beeui/core`'s `AnchoredOverlayDirection` type and `resolveAnchoredOverlayPosition()`'s direction-aware math are already accepted and must not be reimplemented; theme/scope precedent (`BeeThemeScope`) sets the pattern to mirror, not compete with.
- **Package boundary**: `@beeui/core` has zero `react`/`react-native` dependency (`packages/core/package.json`) and "must not import Expo or application code" (`docs/architecture.md:43`). Any platform read (`I18nManager`, `document`) must live in `@beeui/ui` or above, never in `@beeui/core`.
- **Source-ownership**: no new runtime npm dependency for direction detection; native `I18nManager` and the DOM `dir` attribute are already-available platform APIs.
- **Accessibility**: RTL is an accessibility/correctness contract per `docs/agent-execution-contract.md:78,132` and `docs/beeui-1.0-review-checklist.md:45` ("RTL/logical start/end behavior"), not a cosmetic toggle.
- **Non-goal**: this ADR does not implement the logical-direction audit of existing components (#140), RTL overlay acceptance (#141), or the RTL component matrix (#142). It defines the contract those issues execute against.
- **Non-goal**: this ADR does not design Table or Calendar/date-control APIs; it defines the direction contract those future components must consume when they are built.

## Options considered

### Option A — New `BeeDirectionProvider` with React Context + subscription store

- **Design summary**: A new provider component holds `direction` in state, subscribes to `I18nManager` change events and/or a DOM `MutationObserver` on `document.documentElement`, and exposes `useDirection()` reading from context.
- **Benefits**: single call site; automatic re-render on ambient change without the host app forcing one.
- **Risks/tradeoffs**: directly violates the #139 hard invariant — it is a second global state engine solely for RTL, duplicating the ambient authority (`I18nManager`/DOM `dir`) instead of reading it. Requires every root to be wrapped, conflicts with `@beeui/core`'s no-React-dependency boundary if any part leaks downward, and duplicates the "own no context, own no store" precedent `BeeThemeScope` already established for theme.
- **Web/iOS/Android implications**: `MutationObserver` is Web-only and non-trivial to make behave identically to native `I18nManager` listeners; adds asymmetric platform code for a problem that doesn't need it.
- **Dependency/package/registry impact**: new public provider component, new required root wrapping — a public-API and possibly breaking addition.
- **Accessibility/RTL/large-text/reduced-motion impact**: none beyond what Option B/C provide; the store adds risk (stale subscription, unmount races) without added correctness.
- **Migration/semver impact**: introduces a new required-or-optional provider; scope creep beyond #139's ADR-only deliverable.
- **Testing/runtime evidence required**: subscription lifecycle tests, unmount/cleanup tests — extra surface with no behavioral benefit over Option B.
- **Rejected**: violates the explicit hard invariant.

### Option B — Single stateless resolver + explicit prop, platform-appropriate ambient authority (native `I18nManager`, Web DOM `dir`)

- **Design summary**: One pure function/hook in `@beeui/ui` (not `@beeui/core`, which cannot read platform APIs) resolves direction as `explicit ?? ambient ?? 'ltr'`, where the ambient read is `I18nManager.isRTL` on native and `document.documentElement.dir === 'rtl'` on Web. All current and future anchored-overlay-geometry components (`Popover`, `DropdownMenu`, `Select`, future `Table`/`Calendar`) call this one resolver instead of duplicating the ternary. Component-level logical start/end (icon slots, alignment, margin/padding) is defined relative to the same resolved value. Subtree-level visual mirroring reuses React Native's existing Yoga `direction` style on `View` (`'ltr' | 'rtl' | 'inherit'`) — a platform mechanism BeeUI does not need to reimplement. No context, no store, no observer.
- **Benefits**: satisfies the hard invariant exactly; collapses three duplicated read-sites into one; keeps `@beeui/core` platform-pure; keeps the existing explicit `direction` prop (already an accepted, tested-by-construction seam) as the override mechanism; mirrors the `BeeThemeScope` precedent (stateless resolver forwarding to an existing authority) instead of inventing a new pattern.
- **Risks/tradeoffs**: a Web `document.dir` change made without a subsequent re-render of a given component is not reflected until that component re-renders (no live subscription) — an explicit, documented, and accepted limitation rather than a defect (see Decision, "Change/reload expectations"). Nested per-instance override still requires callers to pass the `direction` prop explicitly when they need it to diverge from the ambient read (JS geometry math cannot observe an ancestor's Yoga-resolved layout direction).
- **Web/iOS/Android implications**: symmetric, minimal, platform-honest — each platform's own authority is read directly, no synthetic bridging layer.
- **Dependency/package/registry impact**: no new runtime dependency; one new small exported utility from `@beeui/ui` (or extended existing `overlay-runtime.tsx` export surface); no required root wrapping, non-breaking.
- **Accessibility/RTL/large-text/reduced-motion impact**: makes the existing (currently-untested) flip/shift/align RTL math in `@beeui/core` reachable and testable through one mechanically consistent seam, unblocking #141/#142.
- **Migration/semver impact**: additive; existing `direction` props on `Popover`/`DropdownMenu`/`Select` keep their current default *behavior* (still resolves to `I18nManager.isRTL` on native), only the *implementation* of the default collapses from three inline copies to one shared call.
- **Testing/runtime evidence required**: deterministic unit tests for the resolver's precedence (explicit / native ambient / Web ambient / fallback) with `Platform.OS`, `I18nManager.isRTL`, and `document.documentElement.dir` as injectable seams rather than global mutation; deterministic unit tests already possible today for `resolveAnchoredOverlayPosition()`'s RTL align-flip (pure function, no seam needed); native runtime evidence for `I18nManager.forceRTL()` + reload; Web interaction evidence for `dir`-attribute-driven layout.
- **Selected.**

### Option C — Treat direction purely as an explicit per-component prop; no shared ambient-read utility at all

- **Design summary**: Remove the ambient-read defaults entirely; every component requires the application to pass `direction` explicitly (no `I18nManager`/DOM read anywhere in BeeUI).
- **Benefits**: maximally simple; zero platform-read code in BeeUI.
- **Risks/tradeoffs**: breaks today's accepted default behavior on `Popover`/`DropdownMenu`/`Select` (currently default to the ambient platform direction); pushes a correctness-relevant default onto every consuming application, which is exactly the kind of per-consumer reimplementation BeeUI exists to avoid; contradicts the "components mirror ambient app direction by default" expectation implied by the existing `I18nManager.isRTL` defaults and by `docs/architecture.md:138`'s "RTL rules" framing as a built-in contract, not an opt-in one.
- **Web/iOS/Android implications**: shifts an already-solved concern back onto every host app; increases likelihood of inconsistent behavior across a single application's own component tree.
- **Dependency/package/registry impact**: technically the smallest diff, but a behavioral regression / silent default change for the three existing components.
- **Accessibility/RTL/large-text/reduced-motion impact**: negative — makes correct RTL rendering opt-in per component instance instead of ambient-correct by default, raising the chance of missed RTL support in consumer apps.
- **Migration/semver impact**: behavioral/default change on three existing public components; not accepted without an explicit, separately-scoped decision to make direction fully opt-in, which is out of scope for #139.
- **Rejected**: regresses existing accepted default behavior without new evidence justifying the reversal (per verified-decision rules — the current ambient-default behavior on `Popover`/`DropdownMenu`/`Select` is already shipped and accepted; reversing it needs its own decision, not a side effect of this ADR).

## Decision

BeeUI 1.0 adopts **Option B**: one stateless, platform-appropriate direction resolver, reused everywhere, with the existing per-component `direction` prop as the sole override seam. No new context, store, or subscription is introduced anywhere in the direction path.

### Direction source precedence (highest to lowest)

| Precedence | Source | Scope | Notes |
|---|---|---|---|
| 1 | Explicit per-component `direction` prop (already exists on `Popover`/`DropdownMenu`/`Select`; required for any future `Table`/`Calendar`/anchored-geometry component) | Single component instance | Opt-in override; always wins. This is the nested-scope override mechanism for anchored-overlay geometry (see below). |
| 2a | `I18nManager.isRTL` (from `react-native`) | Ambient, native (iOS/Android) | Sole native ambient authority. BeeUI reads it; never writes it. |
| 2b | `document.documentElement.dir === 'rtl'` (DOM) | Ambient, Web | Sole Web ambient authority — not RNW's in-memory `I18nManager.isRTL` flag. The DOM `dir` attribute is what CSS logical properties and native browser bidi behavior actually key off, and it stays correct even when a host application (or its own SSR/i18n routing) sets `dir` on `<html>` without ever calling RNW's `I18nManager.forceRTL()`. Reading the DOM directly means BeeUI's Web behavior does not depend on undocumented internal wiring between RNW's `I18nManager` and the DOM; that wiring, if any, is treated as unverified for BeeUI's purposes. |
| 3 | Default | Global fallback | `'ltr'` |

Native and Web never both apply — the resolver branches on `Platform.OS`, so exactly one ambient source is consulted per platform.

### Read/write ownership

- **Read**: BeeUI reads `I18nManager.isRTL` (native) and `document.documentElement.dir` (Web). This is the same ownership pattern as `BeeThemeScope` reading a registry-resolved value and forwarding it to Uniwind's `ScopedTheme` (`theme-scope.tsx:26-28`, "Application-level theme switching... stays an explicit... call the application owns").
- **Write**: BeeUI never calls `I18nManager.allowRTL()`/`forceRTL()` and never sets `document.documentElement.dir`, anywhere in `@beeui/core` or `@beeui/ui`. Choosing and applying the application's ambient RTL/LTR mode remains entirely the host application's responsibility — the exact same boundary `BeeThemeScope` draws for `Uniwind.setTheme()`.

### Change/reload expectations on native

`I18nManager.forceRTL()` is documented React Native platform behavior that applies to newly mounted native view hierarchies; already-mounted native screens are not retroactively re-mirrored without the host application reloading. BeeUI does not attempt to hot-patch already-mounted native layout when `I18nManager.isRTL` changes mid-session — that remains the host application's reload orchestration, unchanged and out of BeeUI's scope. BeeUI's own resolver simply re-reads `I18nManager.isRTL` on every call, so it is correct immediately after the host application has reloaded with the new mode; it does nothing before that reload completes.

### Change expectations on Web

Because the Web ambient authority is a live DOM read (`document.documentElement.dir`) rather than a subscribed value, a `dir` change is picked up the next time a BeeUI component that calls the resolver re-renders — there is no automatic re-render triggered by BeeUI when `dir` changes out from under a mounted tree, consistent with the hard invariant against adding an observer/store. A host application that changes `dir` at runtime (e.g., a locale switch) is responsible for triggering a re-render of the affected subtree (for example, keying its root on the active locale), exactly as it already must for any other locale-dependent rendering.

### Logical start/end mapping used by geometry/components

- **Overlay geometry (`@beeui/core`)**: unchanged, already-accepted contract. `AnchoredOverlayAlign`'s `'start'`/`'end'` values are direction-relative for `top`/`bottom` placements via `alignedCoordinate()`'s `reverseStartEnd` flip (`anchored-overlay.ts:140-158,177`). `AnchoredOverlayPlacement`'s `'left'`/`'right'` values remain physical, not logical — placement side is not flipped by `direction`, only alignment along the anchor's cross axis is. This ADR ratifies that existing, already-tested-by-construction split as final: physical placement, logical alignment. Reversing it would need new evidence, not this ADR.
- **Component-level start/end (icon slots, text alignment, spacing)**: any BeeUI component prop or token named with `start`/`end` semantics (as opposed to `left`/`right`) is defined relative to the same resolved direction value from this ADR's precedence table — never hardcoded to a physical side. This is the concrete, mechanical rule #140's logical-direction audit applies component-by-component; #140 does the enumeration and remediation, this ADR only fixes the rule it must satisfy.
- **Layout mirroring (View subtree)**: React Native's own Yoga-backed `View` style prop `direction: 'ltr' | 'rtl' | 'inherit'` is the supported mechanism for mirroring a subtree's flex layout and any RN logical style properties (e.g. `marginStart`/`marginEnd`, `paddingStart`/`paddingEnd`) it drives. BeeUI does not reimplement this — it is documented platform behavior BeeUI relies on, the same way `BeeThemeScope` relies on Uniwind's `ScopedTheme` instead of reimplementing scoped theming. BeeUI has not yet exercised or verified this mechanism with its own test suite; #140/#141 are responsible for adding that coverage.

### Nested scoped direction behavior

Two independent, non-overlapping mechanisms are supported, and neither is a new state engine:

1. **Layout-level scoping**: the Yoga `direction` style on any `View` ancestor, per the previous section. Purely a rendering/layout concern; BeeUI adds no code for this beyond documenting and testing it.
2. **Geometry-level scoping**: the explicit `direction` prop already accepted by `Popover`/`DropdownMenu`/`Select` (and required on any future anchored-geometry component) overrides the ambient platform read for that component instance's JS geometry math.

These two do **not** automatically stay in sync: a component nested inside a `View style={{ direction: 'rtl' }}` subtree, without an explicit `direction` prop of its own, still resolves its anchored-overlay geometry from the ambient platform read (source 2a/2b above), not from the enclosing Yoga direction — because BeeUI has no runtime mechanism to read an ancestor's Yoga-resolved layout direction from JS, and adding one would be exactly the kind of new observation/state engine the hard invariant forbids. A caller that needs anchored-overlay geometry to follow a local Yoga-direction override must pass the explicit `direction` prop itself. This is a documented, deliberate non-goal, not an oversight.

### Testing seams

- The existing explicit `direction` prop on `Popover`/`DropdownMenu`/`Select` (and required on future anchored-geometry components) remains the primary test seam: RTL rendering/behavior tests pass `direction="rtl"` directly and never need to mutate global `I18nManager`/DOM state.
- `resolveAnchoredOverlayPosition()` (`@beeui/core`) is already a pure function taking `direction` as a parameter — no new seam needed; #141/#142 close the current test gap (no `*.test.ts*` file references `RTL`/`isRTL`/`direction` today) by adding deterministic unit tests pinning the flip/shift/align behavior `docs/architecture.md:138` already claims.
- The new shared resolver (native `I18nManager.isRTL` / Web `document.documentElement.dir` / `'ltr'` fallback) must take its ambient inputs as injectable parameters (or via a small internal indirection) rather than reading `I18nManager`/`document` unconditionally inside every call site, so its precedence logic is unit-testable without mutating real global platform state — the same "deterministic seam over global mutation" discipline already used for latest-request-wins generation guards in overlay measurement (`docs/decisions/002-overlay-behavior.md`, "Measurement concurrency decision").
- Native runtime evidence (simulator/device) is required to confirm `I18nManager.forceRTL()` + reload actually mirrors layout as expected; Web interaction evidence is required to confirm `document.documentElement.dir` changes drive the expected re-render/layout once triggered. Neither is a deterministic-contract substitute for the other, per `docs/beeui-1.0-evidence-classes.md`.

## Rejected alternatives

- **Option A (Context/store/observer-based `BeeDirectionProvider`)**: rejected outright — it is a second global state engine solely for RTL, the exact thing #139 forbids. See Options Considered above for the full analysis.
- **Option C (no ambient read at all, direction always explicit)**: rejected — it would silently change the existing accepted default behavior of `Popover`/`DropdownMenu`/`Select` (today default to `I18nManager.isRTL`), pushing a correctness-relevant default onto every consuming application instead of providing an ambient-correct default, which is exactly the kind of duplicated per-consumer work BeeUI exists to prevent. Per the verified-decisions rule, reversing an already-shipped default needs its own evidence-backed decision, not a side effect of this ADR.
- **A DOM `MutationObserver`-based live-reflow layer for Web** (considered as a partial patch on top of Option B): rejected as its own new observation/state engine; the accepted answer is that the host application triggers its own re-render on a `dir` change, exactly as it already must for other locale-driven rendering.
- **Making `AnchoredOverlayPlacement`'s `left`/`right` values logical (`inline-start`/`inline-end`) instead of physical**: rejected without new evidence; the current physical-placement/logical-alignment split is already accepted (`docs/architecture.md:138`) and exercised by the three shipped overlay components. Revisiting it would be its own scoped decision with its own migration analysis, not an incidental change bundled into this ADR.

## Implementation consequences

- **#140 (logical-direction audit of existing reusable source)** must: (1) introduce the single shared resolver in `@beeui/ui` (native `I18nManager.isRTL` / Web `document.documentElement.dir` / `'ltr'` fallback, explicit-prop override first) and have `Popover`/`DropdownMenu`/`Select` call it instead of their current independently duplicated `I18nManager.isRTL ? 'rtl' : 'ltr'` defaults (`popover.tsx:200`, `dropdown-menu.tsx:232`, `select.tsx:479`); (2) enumerate and remediate any component prop/token that encodes a physical `left`/`right` semantic where a logical `start`/`end` semantic is intended, per the mapping rule in this ADR; (3) confirm/document the Yoga `direction`-style subtree-mirroring behavior this ADR relies on.
- **#141 (RTL overlay acceptance)** and **#142 (RTL component matrix)** must add the deterministic unit tests this ADR identifies as currently missing (RTL align-flip on `resolveAnchoredOverlayPosition()`; resolver precedence with injected ambient inputs) plus native/Web runtime evidence for the reload/re-render expectations this ADR states.
- **Future Table and Calendar/date controls** must consume the shared resolver and the logical start/end mapping rule from first implementation, not invent their own direction handling.
- **The production demo** must exercise at least one native `I18nManager.forceRTL()` + reload path and one Web `document.documentElement.dir="rtl"` path as part of its own RTL acceptance evidence (owned by whichever issue covers production-demo RTL acceptance in `docs/roadmap.md`), not merely unit-test the resolver in isolation.
- No existing public API's default *behavior* changes as a result of this ADR; `Popover`/`DropdownMenu`/`Select` continue to default to the ambient platform direction. Only the *implementation* of that default is consolidated.

## Verification plan

- **Deterministic contract evidence**: unit tests for the shared resolver's precedence (explicit prop > native `I18nManager.isRTL` > Web `document.documentElement.dir` > `'ltr'` fallback) using injected/mocked ambient inputs, not global mutation; unit tests for `resolveAnchoredOverlayPosition()`'s existing RTL align-flip behavior (currently unexercised by any test).
- **Browser interaction evidence**: Playwright/RTL-focused check that a Web-rendered anchored overlay's alignment mirrors correctly when `document.documentElement.dir="rtl"` is set before render.
- **Native runtime evidence**: iOS Simulator and Android Emulator runs demonstrating `I18nManager.forceRTL()` + app reload produces mirrored layout and correct overlay alignment on a representative anchored-overlay component.
- **Visual evidence**: representative LTR/RTL screenshot pairs for at least one anchored-overlay component per platform, once #141/#142 execute.
- This ADR itself ships no code; the verification plan above is the acceptance bar for #140/#141/#142, not for this document. This PR's own self-test is ADR/docs-only (see PR body).

## Revisit trigger

Revisit this ADR if any of the following become true with concrete evidence:

- A shipped host application demonstrates a real, reproducible need for BeeUI to auto-detect a runtime `document.dir`/`I18nManager` change without the host re-rendering (i.e., evidence that the "host triggers its own re-render" contract is insufficient in practice) — that would require re-evaluating the no-second-state-engine invariant itself, which is an owner-level scope decision, not something this ADR pre-authorizes.
- A future component (Table, Calendar/date controls, or otherwise) proves the physical-placement/logical-alignment split in `AnchoredOverlayPlacement` is insufficient and needs fully logical placement (`inline-start`/`inline-end` instead of `left`/`right`) — that is its own scoped ADR-style decision with its own migration/semver analysis.
- RNW's actual (verified, not assumed) binding between `I18nManager.forceRTL()` and `document.documentElement.dir` is characterized by future runtime evidence and found to conflict with, or make redundant, the Web ambient-read decision above.
