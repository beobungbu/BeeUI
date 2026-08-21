# ADR-001: Styling engine boundary

Status: Accepted

## Decision

BeeUI uses Uniwind OSS 1.10.1 with Tailwind CSS 4.3.3 as the current styling implementation.

The styling engine is not part of BeeUI's public component API. Consumers interact with typed React Native props and BeeUI variants; Uniwind-specific props are confined to internal adapters.

## Rationale

- semantic-token theming across iOS, Android, and web
- Tailwind v4 authoring ergonomics without requiring application code to know engine internals
- strong mount/style performance relative to current NativeWind releases
- compatibility with Expo and bare React Native
- ability to keep `StyleSheet` and Reanimated as explicit hot-path escape hatches

## Constraints

- no dynamic construction of Tailwind utility names
- no literal brand colors in component source
- native color bridge props such as `colorClassName` remain internal
- performance-sensitive interactive/animated paths may use `StyleSheet` or Reanimated
- engine upgrades are pinned and verified before adoption

## Consequence

BeeUI can replace or supplement Uniwind later without changing application-facing component contracts.
