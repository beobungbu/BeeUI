# ADR-001: Styling engine boundary

Status: Accepted

## Decision

BeeUI uses Uniwind OSS 1.10.1 with Tailwind CSS 4.3.3 as the current styling implementation.

BeeUI's stable behavior, semantic, and variant APIs are styling-engine independent. Components may expose an optional `className` escape hatch for rapid source-owned customization; this escape hatch is implementation-specific and is not part of BeeUI's portability guarantee. Engine-only bridge props remain internal.

## Rationale

- semantic-token theming across iOS, Android, and web
- Tailwind v4 authoring ergonomics without requiring application behavior to know engine internals
- strong mount/style performance relative to current NativeWind releases
- compatibility with Expo and bare React Native
- ability to keep `StyleSheet` and Reanimated as explicit hot-path escape hatches

## Constraints

- no dynamic construction of Tailwind utility names
- no literal brand colors in component source
- native color bridge props such as `colorClassName` remain internal
- reusable application contracts should prefer typed variants over arbitrary `className` overrides
- performance-sensitive interactive/animated paths may use `StyleSheet` or Reanimated
- engine upgrades are pinned and verified before adoption

## Consequence

BeeUI can replace or supplement Uniwind later while preserving stable behavior/variant APIs. Consumers that rely heavily on arbitrary `className` overrides accept migration work if the styling engine changes.
