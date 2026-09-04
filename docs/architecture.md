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
@beemvp/beeui-ui                 typed React Native components
        |
        +---- @beemvp/beeui-core engine-neutral helpers
        |
        +---- semantic class contract
        v
Uniwind OSS + Tailwind v4 (current implementation)
        |
        +---- escape hatch: StyleSheet / Reanimated
        v
React Native primitives
```

The public component API stops at `@beemvp/beeui-ui`. Applications should not need to know which styling engine implements a BeeUI component.

## Package and application responsibilities

### `@beemvp/beeui-tokens`

Owns the design vocabulary: semantic color names, spacing/radius contracts, and the canonical CSS theme consumed by the current Uniwind implementation.

Theme Tokens v3 is shipped: canonical DTCG token source/codegen, a typed theme registry/scoping system, runtime overrides/readers, density, high contrast, semantic data-viz, and motion/layout/typography/lifecycle contracts, enforced by strict semantic-consumption guardrails (see `docs/roadmap.md`). Future extensions to this semantic layer, such as expanded branding/focus contracts, should preserve those guardrails rather than leak styling-engine APIs into components.

### `@beemvp/beeui-core`

Owns small engine-neutral utilities such as anchored-overlay geometry. It must not import Expo or application code.

### `@beemvp/beeui-ui`

Owns reusable React Native components. Components preserve native props, add typed variants/behavior, and apply semantic styling.

### `apps/showcase`

A proving ground and product-quality integration surface, not a dependency of the UI library. The executable root uses local React state and exposes two mutually exclusive inspection surfaces without a router:

- **Components** mounts the preserved interactive component playground for foundation, form, feedback, overlay, selection, navigation, disclosure, data, and application-composition contracts;
- **Patterns** mounts the production Pattern Gallery over four domains and 37 screens.

The Pattern Gallery uses a declarative Showcase-local catalog plus local controlled demo adapters. It supports narrow mobile drill-down, wide master/detail browsing, representative state inspection, light/dark, a 960px desktop breakpoint, and a constrained 760px preview canvas without mounting all 37 screen trees simultaneously.

Four production pattern packs live under `apps/showcase/patterns/**`: Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings. Because the executable Showcase reaches those implementations through the Pattern Gallery, production pattern implementation files are native Showcase inputs rather than CI-safe documentation/demo-only files. Pattern-specific test files remain outside the native bundle.

Showcase navigation/adapters remain application/demo infrastructure rather than public BeeUI component architecture.

### `apps/visual-regression`

Owns both browser evidence layers:

1. deterministic Chromium pixel comparison with 28 canonical component screenshots;
2. durable Playwright integration QA against exported Web fixtures / real Showcase, including Components/Patterns navigation, representative Gallery scenarios, anchored-overlay browser contracts, and the full no-baseline Gallery acceptance matrix.

The Gallery layer uses structural assertions and in-memory screenshots. It does not create a 37 × viewport × theme baseline set.

### `registry/` + `packages/cli`

Own the current source-ownership distribution path. The engine is a single shared
implementation in `packages/cli/src/` (`@beemvp/beeui-cli`, #209), used both as the repo-local
`pnpm beeui <command>` and as a publication-ready packed CLI (`docs/registry-cli.md`).
It is implemented and tested, but not yet a public `npx @beemvp/beeui-cli` or remote registry
product.

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

Hot-path UI may bypass it when evidence warrants: gesture-driven interactions, high-frequency animations, large realtime canvases/charts, camera/video overlays, or measured list cells where styling becomes material. Those paths may use `StyleSheet.create` and Reanimated while preserving BeeUI contracts.

## Safe-area contract

Safe-area measurement is an application-root concern, while safe-area **edge ownership** is explicit at the composition point that touches a system edge.

- `BeeUIProvider` installs `react-native-safe-area-context` measurement and synchronizes measured insets to Uniwind safe-area utilities by default.
- `SafeArea` assigns explicit `top`, `bottom`, `left`, and/or `right` ownership.
- `Screen`, `AppHeader`, and `BottomActionBar` do not silently add insets.
- Applications that already synchronize Uniwind insets may set `syncUniwindInsets={false}`.

## Controlled interaction contract

Some BeeUI primitives are deliberately controlled (`Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Tabs`, and `SegmentedControl`). BeeUI does not invent hidden uncontrolled state for these APIs. Enabled controlled primitives must receive their matching change callback; development warnings surface malformed interactive usage.

## Form-group accessibility contract

React Native exposes explicit semantics such as `radiogroup`, but no generic cross-platform `fieldset`/`group` role. `FormGroup` therefore owns structural legend/description/error metadata; compatible descendants opt into that context intentionally.

## Modal overlay contract

Modal-class components use React Native core `Modal` as the accepted behavior kernel.

- `Dialog` owns generic dismissable modal composition.
- `AlertDialog` reuses the kernel while narrowing backdrop/request-close behavior.
- `DialogContent` defaults to `overFullScreen`, with `transparent=true` only for that presentation. `fullScreen`, `pageSheet`, and `formSheet` are non-transparent so RN can honor the requested native presentation rather than coercing it to `overFullScreen`.
- Higher-level modal components must not create independent overlay engines unless their platform contract requires it.

On Web, Dialog owns and tests browser-style Tab focus trapping, initial focus, and focus restoration. On native, BeeUI relies on native modal/accessibility behavior and does not claim DOM focus-trap semantics or unsupported native roles. Native focus, keyboard, VoiceOver/TalkBack, native sheet interaction, and destructive-confirmation interaction remain runtime/device release concerns where not automated.

## Transient notification contract

Toast v1 is separate from modal and anchored overlays. The provider-local Toast runtime owns descriptor notifications, queueing, timers, actions, safe-area-aware stacking, announcements, and provider isolation.

## Anchored overlay geometry contract

The first anchored-overlay layer is pure `@beemvp/beeui-core` geometry. It has no React, RN, Expo, DOM, portal, gesture, or keyboard dependency.

`resolveAnchoredOverlayPosition()` accepts measured anchor/overlay/viewport geometry plus preferred placement, alignment, direction, offsets, and collision padding. It supports four sides and logical alignment with deterministic flip/shift, finite normalization, and RTL rules. The geometry layer does not own rendering, measurement, dismissal, focus, portal behavior, or state.

## Logical direction contract

Direction (LTR/RTL) resolves through one stateless resolver in `@beemvp/beeui-ui` (`components/use-direction.ts`), per ADR-004. There is no direction context, store, or observer. `resolveDirection(explicit?)` applies a single precedence order — an explicit per-component value, then the platform ambient authority (`I18nManager.isRTL` on native, `document.documentElement.dir` on Web), then an `'ltr'` fallback — reading the ambient authority fresh on every call rather than subscribing to it. `Popover`, `DropdownMenu`, and `Select` default their `direction` prop through this one resolver instead of each duplicating an inline `I18nManager.isRTL` read; any future anchored-geometry component that needs JS-level direction resolution consumes the same resolver. BeeUI only reads these authorities and never writes them: applying an ambient RTL/LTR mode (native `I18nManager.forceRTL()` + reload, or setting the DOM `dir`) stays the host application's responsibility, and the host owns triggering the re-render (Web) or reload (native) when direction changes.

Component-level `start`/`end` semantics resolve against that same value. Logical spacing/alignment utilities (e.g. `pe-*`, `text-end`) and logical child slots (`leading`/`trailing`) mirror through React Native's own Yoga `direction` on the enclosing `View` subtree — BeeUI relies on that platform mechanism rather than reimplementing it. Directional default glyphs that encode logical navigation (pagination previous/next chevrons, the breadcrumb separator) flip with the resolved direction; inherently directional content (numerals, media-transport glyphs) stays physical.

## Anchored overlay runtime contract

The second layer lives internally in `@beemvp/beeui-ui` and is installed by `BeeUIProvider`.

One application runtime owns:

- one root overlay scope/host;
- zero or more modal-local scopes/hosts;
- one portal transport selected for the runtime lifetime;
- one runtime-local active-scope coordinator;
- one platform-dismiss subscription.

Nested BeeUI providers reuse the outer runtime and do not add another host/listener.

Each `OverlayScope` aligns four concerns:

1. **host destination**;
2. **reactive measured host geometry**;
3. **stable dismiss controller/stack**;
4. **semantic depth** (root `0`, each modal boundary parent depth + `1`).

Semantic depth makes global dismissal independent of React effect execution order. Initial-render `defaultOpen` and nested Dialog scopes therefore remain correct even when descendant layout effects run before ancestor layout effects. Same-depth siblings use activation order only as a tie-breaker.

Portal insertion order is deterministic. Host/anchor measurement uses window coordinates; rendering is translated into nearest-host local coordinates. Open overlays remeasure anchors when the nearest host geometry changes.

`measureInWindow` is asynchronous on native. Both host and anchor measurement use latest-request-wins generations: older callbacks cannot overwrite a newer measurement, stale invalid anchor callbacks cannot close an overlay after a newer successful measurement, and close/unmount invalidates outstanding anchor requests.

Safe-area collision applies only where unsafe edges intersect the nearest host. Keyboard-constrained viewport behavior is explicit policy input. Test measurement overrides are internal seams.

Outside press and accessibility escape target the topmost overlay of the nearest scope. Global Web Escape / Android root back targets the deepest active scope in the application runtime.

### Application runtime boundary

Active-scope state is runtime-local, not module-global. This prevents one runtime's coordinator from directly mutating another runtime's stack.

The supported **physical global-event arbitration** contract, however, is one application-root overlay runtime. Nested `BeeUIProvider`s reuse it. If several unrelated React application roots are mounted simultaneously, their runtime state remains separate, but BeeUI does not guarantee which application root owns one physical global Escape/back event while several roots are active.

### Overlay portal transport

Transport is runtime-selected and separated from geometry/dismissal/measurement:

- Web → `ReactDOM.createPortal`, consumer context preserved;
- native New Architecture with registered host → `react-native-teleport`, consumer context preserved;
- otherwise → defensive legacy store/reparent fallback, arbitrary consumer context not preserved.

Consumer contexts below `BeeUIProvider` therefore survive on web-dom and native-teleport. Legacy fallback remains an explicit capability/stale-build safety net.

Overlay content resolves to the nearest modal/root scope. In a Dialog this means portal host, geometry origin, dismissal stack, and semantic depth all follow that modal boundary.

### Platform request-close routing

- Android RN Modal hardware back arrives through `Modal.onRequestClose`; modal-local anchored child dismisses first, then Dialog when no child remains.
- iOS/other request-close may be the native sheet dismissal itself and is not child-intercepted.
- `onRequestClose` fires exactly once per native request and is disjoint from backdrop/accessibility-close paths.

### Modal-local anchored geometry

For `overFullScreen` and native `fullScreen`/`pageSheet`/`formSheet`, nested anchored overlays resolve against the measured modal host, not the application root. No hardcoded presentation offsets are used. Static non-zero-origin and host-movement behavior are deterministic-test contracts; live sheet placement/swipe remains final runtime evidence.

### Distribution boundary

The web transport is currently proven under Expo Web/current Metro platform resolution. Arbitrary generic Web bundlers and public npm conditional exports remain pre-1.0 distribution hardening. `react-native-teleport` is a peer dependency; its own `react-dom` peer can cause strict native-only consumers to require a matching installation even though BeeUI's native runtime does not import `react-dom`.

## Public Popover contract

`Popover` owns controlled/uncontrolled state, measured trigger, bottom/center default placement, safe-area/collision/flip/shift behavior, optional keyboard avoidance, anchor-loss close, topmost dismissal, explicit close, accessibility metadata, and non-modal behavior.

## Public DropdownMenu contract

`DropdownMenu` reuses the same runtime/geometry/portal/dismiss kernels and adds menu item/selection/checkbox/radio and deterministic Web keyboard navigation semantics.

`Select` and `Tooltip` must add their own semantic contracts rather than inheriting DropdownMenu behavior by visual similarity.

## Platform policy

BeeUI targets React Native first and must work with Expo, Expo prebuild/dev builds, bare RN, and documented RN Web environments. Expo-specific APIs belong in applications or optional adapters, never core UI packages.

## Distribution contract

BeeUI packages stay unpublished during `0.x`; no public npm availability is implied.

Current paths are workspace links, `pnpm pack` tarballs for boundary verification/controlled external smoke, and the repository-local Registry + source-ownership CLI. `pnpm release:verify` remains the canonical package gate. Public CLI/package distribution is roadmap work.

## Pattern architecture

Production screens under `apps/showcase/patterns/**` are product-driven stress tests/examples, not `@beemvp/beeui-ui` exports. They import public BeeUI APIs, own local domain composition, remain backend/router neutral where practical, and provide evidence for reusable gaps. Because the executable Showcase reaches them, pattern implementation files are native-sensitive; test-only pattern files remain outside native bundles.

## Verification architecture

BeeUI separates evidence classes.

### Automated cross-platform/package evidence

- frozen install;
- TypeScript;
- behavioral/contract tests;
- Registry/CLI tests;
- `pnpm release:verify`;
- Expo Web/Android/iOS export and Expo Prebuild;
- fresh packed-package bare RN install + Metro bundles;
- bare Android native compile;
- Chromium component pixel regression;
- real-browser anchored-overlay and Showcase integration QA;
- full 370-render Pattern Gallery acceptance when enabled.

### Automated native iOS compile evidence

The trusted macOS ARM64 `ios-native` gate compiles the Expo Showcase generated iOS workspace and a fresh true bare RN consumer. PRs use a conservative path-aware classifier; pushes to main always run the native gate. Caches are performance-only.

### Runtime/device evidence

Compilation/browser/deterministic contracts do not prove all native runtime behavior. Remaining runtime gates include live iOS `pageSheet`/`formSheet` placement/swipe, representative non-zero safe areas/scrolling, focus/keyboard behavior, VoiceOver/TalkBack, and representative native visuals. Exact final-head device evidence must be distinguished from deterministic or prior-head evidence.

## Versioning direction

`@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and the workspace root use one lockstep version. `0.x` may evolve documented APIs; intentional breaking changes require changelog/migration notes.

Current 1.0 exit criteria are canonical in `docs/roadmap.md` and include expanded theming/tokens, context-preserving anchored transport, production-ready remaining components, integrated pattern regression, protected runtime simulator/device verification, accessibility/RTL/large-text coverage, compatibility policy, public distribution/release automation, and consumer-grade docs/demo.

`docs/release.md` defines current release gates; `docs/roadmap.md` defines future readiness work.
