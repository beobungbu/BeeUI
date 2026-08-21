# BeeUI

BeeUI is a production-oriented UI system for React Native written in TypeScript.

The project is mobile-first, framework-light, and designed for long-lived client applications. Component APIs do not expose the styling engine. The current implementation uses Uniwind + Tailwind CSS v4, with `StyleSheet` / Reanimated reserved as escape hatches for performance-sensitive paths.

## Current foundation

- React Native + TypeScript
- Expo SDK 57 showcase (React Native 0.86)
- Uniwind OSS 1.10.1 + Tailwind CSS 4.3.3
- semantic light/dark design tokens
- reusable `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` packages
- engine-agnostic public component APIs
- contract tests with `jest-expo` + React Native Testing Library
- 18 foundation components/primitives documented in `docs/components.md`
- strict TypeScript CI definition

## Quick start

```bash
corepack enable
pnpm install
pnpm showcase
```

Then press `i` for iOS, `a` for Android, or `w` for web in the Expo terminal.

Run the verification suite with:

```bash
pnpm check
```

## Workspace

```text
apps/
  showcase/          Expo application that exercises BeeUI
packages/
  core/              engine-neutral utilities
  tokens/            semantic token contract + CSS theme
  ui/                React Native components
docs/
  architecture.md    architecture constraints
  components.md      canonical component inventory
  decisions/         architecture decision records
```

## Design principles

1. Public component APIs must not depend on Uniwind, Expo, or navigation libraries.
2. Components consume semantic tokens, never literal brand colors.
3. Behavior/accessibility and presentation should remain separable.
4. Native hot paths may use `StyleSheet` or Reanimated without changing component APIs.
5. Components must work in Expo, Expo prebuild/dev builds, and bare React Native.
6. Web support is additive; mobile correctness takes priority.
7. Behavior-heavy overlays are not considered production-ready until focus, portal, back-button, keyboard, and accessibility contracts are verified.

See [`docs/architecture.md`](docs/architecture.md), [`docs/components.md`](docs/components.md), and the ADRs in [`docs/decisions`](docs/decisions) for the full contract.
