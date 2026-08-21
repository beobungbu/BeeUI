# BeeUI

BeeUI is a production-oriented UI system for React Native written in TypeScript.

The project is mobile-first, framework-light, and designed for long-lived client applications. Its stable behavior, semantic, and variant APIs do not require callers to know the styling engine. The current implementation uses Uniwind + Tailwind CSS v4, with `StyleSheet` / Reanimated reserved as escape hatches for performance-sensitive paths.

BeeUI also exposes optional `className` overrides for shadcn-style source ownership and rapid application work. Those overrides are intentionally considered an implementation-specific styling escape hatch, not a portability guarantee.

## Current foundation

- React Native + TypeScript
- Expo SDK 57 showcase (React Native 0.86.2 / React 19.2.3)
- Uniwind OSS 1.10.1 + Tailwind CSS 4.3.3
- semantic light/dark design tokens
- reusable `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` packages
- engine-neutral stable behavior/variant contracts with optional `className` escape hatches
- 56 exported foundation components/subcomponents documented in `docs/components.md`
- 24 contract tests with `jest-expo` + React Native Testing Library
- reproducible `pnpm-lock.yaml` and frozen dependency installs
- CI smoke bundling for Web, Android, and iOS through Expo/Metro
- CI Expo Prebuild generation for Android and iOS native projects
- CI guard preventing Expo runtime imports in `@beeui/core` and `@beeui/ui`
- React Native core `Modal` behavior for `Dialog`; anchored overlays remain separately gated

## Component coverage

Current foundation includes layout, typography, actions, forms, selection, navigation, disclosure, modal overlay, application chrome, application patterns, data display, feedback, and state compositions:

`Screen`, `Box`, `Section`, `MetadataRow`, `Text`, `Button`, `ButtonLabel`, `IconButton`, `Input`, `Textarea`, `Field`, `SearchInput`, `PasswordInput`, `OTPInput`, `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Chip`, `ChipGroup`, `SegmentedControl`, `SegmentedControlItem`, `Pagination`, `PaginationItem`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `AppHeader`, `BottomActionBar`, `ListItem`, `SettingsItem`, `Card`, `AlertBanner`, `Badge`, `Avatar`, `Progress`, `Spinner`, `Skeleton`, `Separator`, `EmptyState`, and `ErrorState`.

Anchored overlays such as `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, and `Select` remain deferred until their positioning/focus/keyboard/accessibility behavior is verified across Expo, prebuild/bare React Native, and web.

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase
```

Then press `i` for iOS, `a` for Android, or `w` for web in the Expo terminal.

Run the unit/type verification suite with:

```bash
pnpm check
```

## Verification status

The current CI pipeline performs:

1. clean `pnpm install --frozen-lockfile`
2. an Expo-import boundary check for `packages/core/src` and `packages/ui/src`
3. strict TypeScript checks across the workspace
4. 24 React Native Testing Library contract tests
5. Expo/Metro export for Web
6. Expo/Metro export for Android
7. Expo/Metro export for iOS
8. `expo prebuild --clean --no-install` to generate both native projects

Every foundation tranche is accepted only after this complete pipeline passes on the PR head.

Expo export proves the JavaScript/Metro bundles resolve on all three targets, and Expo Prebuild proves the current configuration can generate Android and iOS native projects. These checks do **not** claim that an APK/AAB or iOS application has been compiled or installed on a physical device. Remaining release verification is native compilation/device smoke testing and a true bare React Native consumer test.

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

1. Stable behavior, semantic, and variant APIs must not depend on Uniwind, Expo, or navigation libraries.
2. Optional `className` is a current-engine escape hatch; prefer typed variants for reusable contracts.
3. Components consume semantic tokens, never literal brand colors.
4. Behavior/accessibility and presentation should remain separable.
5. Native hot paths may use `StyleSheet` or Reanimated without changing stable component APIs.
6. Components must work in Expo, Expo prebuild/dev builds, and bare React Native.
7. Web support is additive; mobile correctness takes priority.
8. Modal-class and anchored overlays may use different behavior primitives; neither class is considered production-ready until its platform-specific interaction contracts are verified.

See [`docs/architecture.md`](docs/architecture.md), [`docs/components.md`](docs/components.md), and the ADRs in [`docs/decisions`](docs/decisions) for the full contract.
