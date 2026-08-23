# BeeUI architecture

## Goal

BeeUI is a reusable, production-oriented React Native UI foundation for multiple client applications. It should make common application UI fast to compose without forcing applications to inherit a particular router, backend, state library, form library, or build system.

The public surface is behavior/accessibility-first. The current styling engine is an implementation detail.

## Layering

```text
Application / domain UI
        |
        v
production patterns / Showcase adapters
        |
        v
@beeui/ui                 typed React Native components
        |
        +---- @beeui/core engine-neutral helpers
        |
        +---- semantic class contract
        v
Uniwind OSS + Tailwind v4 (current implementation)
        |
        +---- escape hatch: StyleSheet / Reanimated
        v
React Native primitives
```

The public component API stops at `@beeui/ui`. Applications should not need to know which styling engine implements a BeeUI component.

## Package and application responsibilities

### `@beeui/tokens`

Owns the design vocabulary: semantic color names, spacing/radius contracts, and the canonical CSS theme consumed by the current Uniwind implementation.

Theme/token v2 work is tracked in `docs/roadmap.md`; future typography, sizing, elevation, motion, focus, and branding contracts should extend this semantic layer rather than leak styling-engine APIs into components.

### `@beeui/core`

Owns small engine-neutral utilities such as anchored-overlay geometry. It must not import Expo or application code.

### `@beeui/ui`

Owns reusable React Native components. Components preserve native props, add typed variants/behavior, and apply semantic styling.

### `apps/showcase`

A proving ground and product-quality integration surface, not a dependency of the UI library. It validates composition, theme switching, production patterns, controlled-state examples, responsive behavior, and real application stress cases.

Four production pattern packs are currently merged under `apps/showcase/patterns/**`, containing 37 screens across Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings.

The next Showcase integration step is a canonical Pattern Gallery over those 37 screens. It should remain application/demo infrastructure rather than becoming public BeeUI component architecture.

### `apps/visual-regression`

Owns the deterministic Chromium pixel-comparison fixture. It intentionally samples representative public component states rather than mirroring the entire interactive Showcase.

### `registry/` + repository-local CLI

Own the current phase-1 source-ownership distribution path. This is implemented and tested, but it is not yet a public `npx beeui` product or remote registry.

## Theme contract

Components use semantic concepts rather than brand palette values:

```text
background / foreground
surface / surface-muted / surface-raised
primary / primary-foreground / primary-hover / primary-pressed
secondary / secondary-foreground / secondary-hover
muted / muted-foreground / subtle-foreground
destructive / destructive-foreground
success / warning / info
border / border-strong / input / focus-ring
disabled / disabled-foreground
overlay
```

Changing a client's brand should primarily require changing semantic theme values, not editing component source.

Uniwind/Tailwind CSS variables are the preferred current mechanism. BeeUI should not create a second styling runtime or compiler without strong technical evidence.

## Styling engine boundary

Uniwind is selected for normal UI because it provides Tailwind v4 semantics, theme variables, responsive/mobile/Web support, and a small application-facing styling surface. It is not part of BeeUI's stable public API.

Hot-path UI may bypass it when evidence warrants:

- gesture-driven interactions;
- high-frequency animations;
- large realtime canvases/charts;
- camera/video overlays;
- measured list cells where styling becomes material.

Those paths may use `StyleSheet.create` and Reanimated while preserving BeeUI semantic contracts and component APIs.

## Safe-area contract

Safe-area measurement is an application-root concern, while safe-area **edge ownership** is explicit at the composition point that touches a system edge.

- `BeeUIProvider` installs `react-native-safe-area-context` measurement and synchronizes measured insets to Uniwind safe-area utilities by default.
- `SafeArea` assigns explicit `top`, `bottom`, `left`, and/or `right` ownership.
- `Screen`, `AppHeader`, and `BottomActionBar` do not silently add insets.
- Applications that already synchronize Uniwind insets may set `syncUniwindInsets={false}` on `BeeUIProvider`.

This avoids double insets when applications use native navigation headers, tab bars, maps, media surfaces, nested shells, or custom safe-area composition.

## Controlled interaction contract

Some BeeUI primitives are deliberately controlled (`Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Tabs`, and `SegmentedControl`). BeeUI does not invent hidden uncontrolled state for these APIs.

Enabled controlled primitives must receive their matching change callback. Development warnings surface malformed interactive usage instead of allowing controls that appear actionable but discard input.

`Field` remains a text-entry composition primitive. Boolean/choice controls keep explicit label/group semantics rather than inheriting `Field` behavior implicitly.

## Form-group accessibility contract

React Native exposes explicit semantics such as `radiogroup`, but no generic cross-platform `fieldset`/`group` role. BeeUI must not fake a group role or collapse independently interactive descendants into one accessibility element.

`FormGroup` therefore owns structural legend/description/error metadata. Compatible semantic descendants opt into that context intentionally; `RadioGroup` currently does so because React Native exposes an explicit `radiogroup` role.

Future integrations require an unambiguous native accessibility contract, not merely visual similarity.

## Modal overlay contract

Centered modal-class components use React Native core `Modal` as the accepted behavior kernel.

- `Dialog` owns generic dismissable modal composition.
- `AlertDialog` reuses the same kernel while narrowing backdrop/request-close behavior for confirmation/destructive flows.
- Higher-level modal components must not create independent overlay engines unless their platform contract requires it.

BeeUI does not claim browser-style focus trapping or unsupported native roles where React Native does not expose those contracts. Focus, keyboard, VoiceOver/TalkBack, hardware-back, and destructive-confirmation interaction remain runtime/device release concerns.

## Transient notification contract

Toast v1 is implemented separately from both modal and anchored overlays.

The provider-local Toast runtime owns descriptor notifications, queueing, timers, actions, safe-area-aware stacking, announcement behavior, and provider isolation. It does not use React Native core `Modal`, anchored geometry, or arbitrary `ReactNode` transport.

Animation/swipe/custom-content work, if added later, must preserve this separation.

## Anchored overlay geometry contract

The first anchored-overlay layer is a pure geometry resolver in `@beeui/core`. It has no React, React Native, Expo, DOM, portal, gesture, or keyboard dependency.

`resolveAnchoredOverlayPosition()` accepts measured anchor/overlay/viewport geometry plus preferred placement, alignment, direction, offsets, and collision padding. It supports `top`/`right`/`bottom`/`left` placement and `start`/`center`/`end` alignment.

Key rules:

- preferred placement is evaluated first;
- the exact opposite side is considered only when preferred placement overflows;
- the opposite side wins only when total overflow is lower;
- optional shifting clamps the chosen candidate into the padded viewport without changing the resolved placement label;
- top/bottom `start` and `end` are logical and reverse under RTL;
- left/right vertical alignment does not reverse under RTL;
- non-finite geometry normalizes to finite safe values;
- negative sizes/padding normalize to zero.

The geometry layer does not own open state, rendering, measurement, dismissal, focus, keyboard handling, portal behavior, nested overlays, or z-order.

## Anchored overlay runtime contract

The second layer lives internally in `@beeui/ui` and is installed by `BeeUIProvider`.

- One runtime owns one native overlay host.
- Nested BeeUI providers reuse the outer anchored-overlay runtime.
- Portal insertion order is deterministic.
- Host/anchor measurement uses window coordinates; rendering is translated into host-local coordinates.
- Safe-area collision padding is applied only where unsafe window edges still intersect the host.
- Keyboard-constrained viewport behavior is explicit policy input.
- Anchor remeasurement occurs on open/environment changes and may be requested explicitly.
- Android hardware back, Web Escape, and outside press target only the topmost registered dismissable overlay.
- Test measurement overrides are internal seams, not public production fallbacks.

### Current React Context boundary

The current custom anchored-overlay host renders portal entries under an application-root sibling host. That changes React ancestry.

BeeUI re-provides the internal contexts its public overlay components need, but arbitrary consumer contexts scoped between `BeeUIProvider` and the overlay declaration are not guaranteed to be preserved inside portalled content.

Issue #35 and PR #38 established this as an explicit, regression-tested pre-1.0 contract. The issue is closed because the behavior is now documented rather than ambiguous; the current transport is **not** thereby context-preserving.

Until a context-preserving transport is proven, consumers should place required providers at or above `BeeUIProvider` or pass required values explicitly.

A context-preserving native/Web transport is a pre-1.0 roadmap item and must retain the accepted non-modal geometry, nested-dismiss, safe-area, keyboard-policy, and accessibility contracts. Component-specific context copying is not a generic fix.

## Public Popover contract

`Popover` is a public consumer of the accepted geometry/runtime kernels.

- Controlled mode uses `open` + `onOpenChange`; uncontrolled mode supports `defaultOpen`.
- `PopoverTrigger` is a BeeUI button-compatible measured anchor.
- `PopoverContent` defaults to bottom/center with finite offsets, safe-area collision handling, flip/shift, and opt-in keyboard avoidance.
- Content is non-modal and does not claim focus trapping.
- Unresolved content measures invisibly/offscreen and remains non-interactive.
- Losing the anchor while open closes the Popover rather than reusing stale geometry.
- Outside press, Android back, Web Escape, and accessibility escape may close only the topmost registered Popover.
- Title/description registration provides stable accessibility metadata while explicit caller props remain authoritative.

## Public DropdownMenu contract

`DropdownMenu` reuses the same geometry/runtime/portal/dismiss kernels as Popover.

- Root state supports controlled and uncontrolled modes.
- Content defaults to bottom/start with collision handling and opt-in keyboard avoidance.
- Normal items close after selection by default.
- Disabled items do not activate or become the keyboard current item.
- Checkbox/radio items expose controlled selection requests and remain open by default unless `closeOnSelect` is requested.
- Web ArrowUp/ArrowDown, Home/End, and Enter/Space use a deterministic enabled-item navigation model.

`Select` and `Tooltip` must add their own semantic contracts rather than inheriting DropdownMenu behavior by visual similarity.

The detailed current anchored-overlay contract lives in `docs/anchored-overlays.md`.

## Platform policy

BeeUI targets React Native first and must work with:

- Expo;
- Expo prebuild/dev builds;
- bare React Native;
- React Native Web where the documented public contract applies.

Expo-specific APIs belong in applications or optional adapters, never core UI packages.

Native ergonomics/correctness and Web support are both first-class, but BeeUI does not force 100% implementation reuse when platform behavior differs materially.

## Distribution contract

BeeUI packages remain private during `0.x`; no public npm availability is implied.

Current distribution/verification paths are:

1. workspace links inside the monorepo;
2. `pnpm pack` tarballs for package-boundary verification and controlled external smoke tests;
3. the implemented phase-1 repository-local Registry + source-ownership CLI.

`pnpm release:verify` remains the canonical package verification gate. It validates explicit packed surfaces, exports, rewritten workspace dependency ranges, package installation, and clean consumer behavior.

The Registry/CLI engine already exists and is documented in `docs/registry-cli.md`. Before public 1.0, it still needs productization: publishable CLI naming/distribution, expanded stable-component coverage, compatibility policy, and any future remote-registry integrity contract.

Public npm package distribution is a separate roadmap item.

## Pattern architecture

Production screens under `apps/showcase/patterns/**` are product-driven stress tests and examples, not part of the `@beeui/ui` package surface.

Patterns:

- import public BeeUI APIs only;
- own local domain-specific composition;
- remain router/backend/SDK neutral where practical;
- should not promote one-off domain components into the foundation;
- provide evidence for reusable gaps.

The Rule of Two and `gap:` issue policy are defined in `docs/roadmap.md`.

## Verification architecture

BeeUI intentionally separates evidence classes:

### Automated cross-platform/package evidence

- frozen install;
- TypeScript;
- behavioral/contract tests;
- Registry/CLI tests;
- `pnpm release:verify`;
- Expo Web/Android/iOS export;
- Expo Prebuild;
- fresh bare React Native package install and Metro bundles;
- bare Android native compilation;
- deterministic Chromium visual regression.

### Automated native iOS compile evidence

The trusted macOS ARM64 `ios-native` gate compiles:

- the Expo Showcase generated iOS workspace;
- a fresh true bare React Native consumer.

Pull requests use a conservative path-aware classifier; pushes to `main` always run the full native iOS gate. Persistent caches are performance optimizations only.

### Runtime/device evidence

Compilation does not prove:

- non-zero safe-area behavior;
- keyboard/focus interaction;
- VoiceOver/TalkBack;
- Android hardware-back behavior;
- runtime navigation/accessibility flows;
- representative native visuals.

These remain release gates until the roadmap's protected simulator/device runtime tier is implemented.

## Versioning direction

`@beeui/core`, `@beeui/tokens`, `@beeui/ui`, and the workspace root use one lockstep version. `0.x` may evolve documented APIs; intentional breaking changes require changelog and migration notes.

The old “25–30 primitives + a future CLI” threshold is obsolete: BeeUI already has broader component coverage, Toast, visual regression, a phase-1 CLI, and 37 production pattern screens.

The current BeeUI 1.0 exit criteria are defined canonically in `docs/roadmap.md` and include, among other things:

- stable expanded theming/token contracts;
- context-preserving anchored-overlay strategy or an explicitly reviewed replacement of the current arbitrary-consumer-context limitation;
- production-ready Select/Tooltip and Sheet if first-class modern mobile coverage is claimed;
- integrated Pattern Gallery and representative pattern regression coverage;
- protected runtime simulator/device verification;
- accessibility/RTL/large-text coverage;
- compatibility matrix;
- public distribution/release automation;
- consumer-grade documentation and demo.

`docs/release.md` defines the current release gates; `docs/roadmap.md` defines future readiness work.
