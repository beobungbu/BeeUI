# BeeUI architecture

## Goal

BeeUI is a reusable, production-oriented React Native UI foundation for multiple client applications. It should make common application UI fast to compose without forcing applications to inherit a particular router, backend, state library, or build system.

## Layering

```text
Application / domain UI
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

The public API stops at `@beeui/ui`. An application should never need to know which styling engine implements a BeeUI component.

## Package responsibilities

### `@beeui/tokens`

Owns the design vocabulary: semantic color names, spacing/radius contracts, and the canonical CSS theme consumed by the current Uniwind implementation.

### `@beeui/core`

Owns small engine-neutral utilities. It must not import Expo or application code.

### `@beeui/ui`

Owns reusable React Native components. Components preserve native props, add typed variants, and apply semantic styling.

### `apps/showcase`

A proving ground, not a dependency of the UI library. It validates composition, theme switching, mobile behavior, and eventually accessibility/visual regression scenarios.

## Theme contract

Components must use semantic concepts rather than brand palette values:

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
```

Changing a client's brand should primarily require changing theme values, not component source.

## Styling engine boundary

Uniwind is currently selected for normal UI because it provides Tailwind v4 semantics, theme variables, and mobile/web support with a relatively small runtime cost. It is not part of BeeUI's public API.

Hot-path UI is allowed to bypass it:

- gesture-driven interactions
- high-frequency animations
- large realtime canvases/charts
- camera/video overlays
- measured list cells where styling becomes material

Those paths may use `StyleSheet.create` and Reanimated directly while preserving the same semantic token contract and public API.

## Safe-area contract

Safe-area measurement is an application-root concern, while safe-area **edge ownership** is explicit at the composition point that touches the system edge.

- `BeeUIProvider` installs `react-native-safe-area-context` measurement at the root and synchronizes measured insets to Uniwind safe-area utilities by default.
- `SafeArea` is the explicit wrapper for assigning `top`, `bottom`, `left`, and/or `right` ownership.
- `Screen`, `AppHeader`, and `BottomActionBar` do not silently add insets. This prevents double insets when applications use native navigation headers, tab bars, maps, media surfaces, nested shells, or their own safe-area utilities.
- Applications that already synchronize Uniwind insets may set `syncUniwindInsets={false}` on `BeeUIProvider`.

A typical shell owns the top inset around `AppHeader`, side insets around main content, and the bottom inset around `BottomActionBar`. The exact split remains application-owned.

## Controlled interaction contract

Some BeeUI primitives are deliberately controlled (`Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Tabs`, and `SegmentedControl`). BeeUI does not invent hidden uncontrolled state for those APIs.

Enabled controlled primitives must receive their matching change callback. In development, BeeUI warns when such a control would otherwise look interactive while silently discarding user input. Disabled controls may omit the callback without warning.

`Field` is intentionally a text-entry composition primitive. It propagates label/required/disabled/invalid metadata to text controls; boolean and choice controls keep their own explicit label/group semantics rather than inheriting `Field` behavior implicitly.

## Form-group accessibility contract

React Native 0.86 exposes explicit semantics such as `radiogroup`, but it does not expose a generic cross-platform `fieldset`/`group` accessibility role. BeeUI must not invent one or set `accessible={true}` on a structural wrapper in a way that collapses independently interactive descendants into one accessibility element.

`FormGroup` therefore owns visual/context composition only: legend, required wording, description/error guidance, invalid state, and disabled metadata. A compatible semantic descendant opts into that context intentionally. `RadioGroup` consumes it because React Native has a native `radiogroup` role; explicit `RadioGroup` accessibility props always override inferred group metadata.

This contract deliberately avoids cloning arbitrary descendants or silently changing application state. Future group integrations must be justified by an unambiguous native accessibility contract rather than visual similarity.

## Modal overlay contract

Centered modal-class components use React Native core `Modal` as the accepted behavior kernel. `Dialog` owns the generic dismissable composition; `AlertDialog` reuses that kernel for confirmation/destructive flows instead of introducing a second overlay engine.

`DialogContent` owns title/description registration, modal accessibility isolation, backdrop behavior, Android `onRequestClose`, and accessibility-escape handling. `dismissOnRequestClose={false}` changes native request-close paths into notification-only callbacks while preserving the mounted dialog. Higher-level modal contracts may narrow backdrop or request-close behavior through that mechanism.

`AlertDialogContent` always disables backdrop dismissal. Android hardware-back and accessibility escape act like cancellation by default and may be made notification-only through `cancelOnRequestClose={false}`. `AlertDialogCancel` and `AlertDialogAction` are explicit close paths; the action defaults to the destructive semantic button variant.

BeeUI does not claim browser-style focus trapping or a dedicated native `alertdialog` role when React Native core does not expose those semantics. Focus, keyboard, VoiceOver/TalkBack, hardware-back, and destructive-confirmation interaction remain simulator/device release gates.

Anchored overlays are a separate behavior class. `Popover`, `DropdownMenu`, `Tooltip`, and `Select` must not be approximated by full-screen modal behavior because positioning, collision, nested overlay behavior, keyboard/focus semantics, and accessibility are part of their contract. `Toast` is likewise an above-content surface but is not anchor-positioned and will use a separate transient-notification contract.

## Anchored overlay geometry contract

The first anchored-overlay layer is a pure geometry resolver in `@beeui/core`. It intentionally has no React, React Native, Expo, DOM, portal, gesture, or keyboard dependency.

`resolveAnchoredOverlayPosition()` accepts measured anchor/overlay/viewport geometry plus preferred placement, alignment, direction, offsets, and collision padding. It supports `top`/`right`/`bottom`/`left` placement and `start`/`center`/`end` alignment.

The resolver follows these rules:

- preferred placement is evaluated first
- the exact opposite side is considered only when the preferred candidate overflows
- the opposite side wins only when its total overflow is lower
- optional shifting clamps the chosen candidate into the padded viewport without changing the resolved placement label
- top/bottom `start` and `end` are logical and reverse under RTL
- left/right vertical alignment does not reverse under RTL
- non-finite geometry normalizes to finite safe values and negative sizes/padding normalize to zero
- the result exposes resolved coordinates, flip/shift flags, pre-shift placement overflow, final overflow, and available space on all four sides

The geometry layer does not render or measure anything and does not own open state, dismissal, focus, keyboard handling, portal/host behavior, nested overlays, or z-order.

## Anchored overlay runtime contract

The second anchored-overlay layer lives internally in `@beeui/ui` and is installed by `BeeUIProvider`. Applications should not need a separate overlay provider.

- One runtime owns one native overlay host. Nested BeeUI providers reuse the outer runtime rather than creating another host.
- Portal entries retain deterministic insertion order and are removed when their owner unmounts.
- The host and anchors are measured in window coordinates. Rendering coordinates are derived by translating the resolved window position into host-local coordinates; host origin `(0,0)` is never assumed.
- The runtime reuses safe-area data already owned at the application root and only applies collision padding for unsafe window edges that still intersect the host.
- Keyboard-constrained viewport behavior is explicit policy input. The runtime exposes keyboard geometry but does not force all overlays to avoid it.
- Anchor remeasurement occurs on open and environment changes and is also exposed explicitly for scroll/layout integrations. BeeUI does not hide continuous high-frequency polling inside the runtime.
- Android hardware back, Web Escape, and outside presses target only the topmost registered dismissable overlay. Nested overlays therefore dismiss child-first and one event never cascades through multiple levels.
- Measurement overrides used by automated tests are internal seams only; production positioning continues to rely on real window-coordinate measurement.

The current custom portal host changes React ancestry by rendering entries under the application-root host. BeeUI re-provides the internal contexts required by each public overlay, but arbitrary consumer React contexts scoped between `BeeUIProvider` and an anchored overlay source are not guaranteed to be preserved today. Until the context-preserving portal investigation is resolved, applications should place providers needed by portalled content at or above `BeeUIProvider`, or pass the required values explicitly. This limitation is tracked separately and must not be hidden by component-specific context copying.

## Public Popover contract

`Popover` is the first public component layered on the accepted geometry/runtime kernels. It does not introduce another portal, positioning engine, or Modal path.

- Controlled mode requires `open` + `onOpenChange`; uncontrolled mode supports `defaultOpen` and optional observation through `onOpenChange`.
- `PopoverTrigger` remains a BeeUI `Button`-compatible anchor, toggles state, preserves caller accessibility state, adds `expanded`, and links to content through React Native 0.86's typed `aria-controls` prop.
- `PopoverContent` delegates all coordinates to `useAnchoredOverlayPosition()`. Default placement is bottom/center with finite offsets, safe-area collision handling, flip/shift enabled, and keyboard avoidance opt-in.
- Content is non-modal. It does not hide application siblings, set modal accessibility isolation, or claim a browser-style focus trap.
- Until both anchor geometry and content size exist, the content measures invisibly offscreen with pointer interaction disabled rather than rendering visibly at `(0,0)`.
- Losing the anchor while open closes the Popover instead of reusing stale coordinates.
- Outside press, Android hardware back, Web Escape, and accessibility escape may close only the topmost registered Popover, so nested overlays dismiss child-first.
- Title/description composition follows stable native-ID registration and explicit caller accessibility text remains authoritative.

Automated Linux tests establish state, geometry integration, nesting/dismiss ordering, semantics, package inclusion, and cross-target bundling. They do not claim automatic focus restoration or final keyboard/VoiceOver/TalkBack interaction. Those remain web/simulator/device release gates.

## Public DropdownMenu contract

`DropdownMenu` is the second public anchored component and reuses the exact same geometry/runtime/portal/dismiss kernels as Popover.

- Root state supports controlled `open` + `onOpenChange` and uncontrolled `defaultOpen`.
- `DropdownMenuTrigger` is a BeeUI `Button`-compatible measured anchor that preserves caller accessibility state, adds `expanded`, and links to content.
- `DropdownMenuContent` defaults to bottom/start with finite offsets, safe-area collision handling, flip/shift enabled, and keyboard avoidance opt-in.
- Until anchor geometry and content size resolve, content remains invisibly offscreen, hidden from accessibility, and non-interactive.
- Losing the anchor while open closes the menu instead of reusing stale coordinates.
- Outside press, Android hardware back, Web Escape, and accessibility escape only close the topmost registered menu.
- Normal items expose menu-item semantics and close after selection by default. Disabled items neither activate nor become the keyboard current item.
- `onSelect` is the cross-input semantic item action. Pointer `onPress`, when supplied, runs before selection/default close behavior.
- Checkbox items expose checked state and request the next boolean value. Radio groups/items expose one controlled value; duplicate radio values fail safe as disabled.
- Checkbox and radio items remain open by default unless `closeOnSelect` is explicitly requested.
- Labels and separators are non-interactive.
- On Web, ArrowDown/ArrowUp move through enabled items, Home/End select the first/last enabled item, and Enter/Space activate the current item. Current-item navigation is not application selection state.

Automated Linux tests cover root state, menu semantics, disabled behavior, checkbox/radio requests, unresolved geometry, anchor loss, nested topmost dismissal, accessibility escape, and deterministic Web keyboard navigation. They do not claim browser-grade focus restoration or final native keyboard/VoiceOver/TalkBack parity.

`Select` and `Tooltip` must add their own component semantics on the same runtime rather than inheriting DropdownMenu behavior by visual similarity.

The detailed contract and phase split are documented in `docs/anchored-overlays.md`.

## Platform policy

BeeUI targets React Native first. It must work with Expo, Expo prebuild/dev builds, and bare React Native. Expo-specific APIs belong in applications or optional adapters, never the UI core.

Web support is allowed through React Native Web or a future dedicated web implementation sharing the same token/component contracts. Native ergonomics and correctness take priority over forcing 100% code reuse.

## Distribution contract

BeeUI's `0.x` packages intentionally remain private while the distribution workflow is being validated. The monorepo may consume packages through workspace links, while CI and controlled external smoke tests consume `pnpm pack` tarballs through a normal `node_modules` boundary.

A packed package is accepted only when its declared exports exist, its packed surface is explicit, internal `workspace:*` ranges have been rewritten to the lockstep release version, and the tarballs can be installed into a clean consumer. `pnpm release:verify` is the canonical automated gate for this contract.

Packed tarballs are not a substitute for the intended source-ownership workflow. Before `1.0`, BeeUI still needs a registry/CLI distribution path that lets an application adopt component source deliberately without depending on monorepo-relative paths. Until that workflow exists, the package manifests remain `private: true` and no public npm distribution is implied.

## Versioning direction

`@beeui/core`, `@beeui/tokens`, `@beeui/ui`, and the workspace root use one lockstep version. `0.x` may evolve component APIs while the foundation is validated; intentional breaking changes require changelog and migration notes.

Before `1.0`, BeeUI should have:

- stable token names
- accessibility coverage for interactive primitives
- component tests
- visual regression coverage
- 25-30 production primitives
- registry/CLI distribution workflow
- documented migration policy

The release gates and the distinction between automated Linux cross-platform/Android proof, automated macOS ARM64 native iOS compile proof, and manual runtime/device interaction proof are defined in `docs/release.md`.
