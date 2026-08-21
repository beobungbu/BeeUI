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

## Platform policy

BeeUI targets React Native first. It must work with Expo, Expo prebuild/dev builds, and bare React Native. Expo-specific APIs belong in applications or optional adapters, never the UI core.

Web support is allowed through React Native Web or a future dedicated web implementation sharing the same token/component contracts. Native ergonomics and correctness take priority over forcing 100% code reuse.

## Versioning direction

`0.x` may evolve component APIs while the foundation is validated. Before `1.0`, BeeUI should have:

- stable token names
- accessibility coverage for interactive primitives
- component tests
- visual regression coverage
- 25-30 production primitives
- registry/CLI distribution workflow
- documented migration policy
