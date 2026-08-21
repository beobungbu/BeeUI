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
- explicit safe-area foundation through `BeeUIProvider` + `SafeArea`, backed by `react-native-safe-area-context`
- 80 exported foundation components/subcomponents documented in `docs/components.md`
- 68 contract tests with `jest-expo` + React Native Testing Library
- reproducible `pnpm-lock.yaml` and frozen dependency installs
- CI smoke bundling for Web, Android, and iOS through Expo/Metro
- CI Expo Prebuild generation for Android and iOS native projects
- CI guard preventing Expo runtime imports in `@beeui/core` and `@beeui/ui`
- true bare React Native 0.86.2 consumer verification with Android/iOS Metro bundles
- Android bare React Native debug APK compilation in CI
- React Native core `Modal` behavior for `Dialog`; anchored overlays remain separately gated

## Component coverage

Current foundation includes application-root integration, layout, accessibility, typography, actions, forms, selection, navigation, disclosure, modal overlay, application chrome, application patterns, data display, feedback, and state compositions:

`BeeUIProvider`, `SafeArea`, `Screen`, `Box`, `Stack`, `HStack`, `VStack`, `Section`, `MetadataRow`, `VisuallyHidden`, `Text`, `Label`, `Button`, `ButtonLabel`, `IconButton`, `Link`, `Input`, `Textarea`, `Field`, `HelperText`, `FormMessage`, `SearchInput`, `PasswordInput`, `OTPInput`, `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Chip`, `ChipGroup`, `SegmentedControl`, `SegmentedControlItem`, `Pagination`, `PaginationItem`, `Breadcrumb`, `BreadcrumbItem`, `Stepper`, `StepperItem`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `AppHeader`, `BottomActionBar`, `ListGroup`, `ListGroupHeader`, `ListItem`, `SettingsItem`, `DescriptionList`, `DescriptionItem`, `Card`, `AlertBanner`, `Badge`, `Avatar`, `Stat`, `StatLabel`, `StatValue`, `StatHelpText`, `Timeline`, `TimelineItem`, `Progress`, `Spinner`, `Skeleton`, `Separator`, `EmptyState`, and `ErrorState`.

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

## Safe-area foundation

BeeUI measures safe areas at the application root but keeps edge ownership explicit so app shells do not get accidental double insets from navigation, tab bars, maps, media, or nested layouts.

```tsx
import {
  AppHeader,
  BeeUIProvider,
  BottomActionBar,
  SafeArea,
  Screen,
} from '@beeui/ui';

function AppShell() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']}>
          <AppHeader title="BeeUI" />
        </SafeArea>

        <SafeArea className="flex-1" edges={['left', 'right']}>
          {/* application content */}
        </SafeArea>

        <SafeArea edges={['bottom', 'left', 'right']}>
          <BottomActionBar>{/* actions */}</BottomActionBar>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

`Screen`, `AppHeader`, and `BottomActionBar` intentionally do not add safe-area padding themselves. Applications assign ownership to the shell element that actually touches a system edge. `BeeUIProvider` synchronizes measured insets to Uniwind safe-area utilities by default; set `syncUniwindInsets={false}` only when the application already owns that bridge.

## Accessibility and field composition

`Field` keeps the cross-platform explicit label fallback while also generating a stable label `nativeID` for React Native's Android `accessibilityLabelledBy` relationship. Required state is propagated to text-entry controls and explicit application accessibility props always win.

```tsx
import { Field, Input, Label, VisuallyHidden } from '@beeui/ui';

function ProfileFields() {
  return (
    <>
      <Field label="Email" required>
        <Input keyboardType="email-address" />
      </Field>

      <Label nativeID="nickname-label">Nickname</Label>
      <Input accessibilityLabelledBy="nickname-label" accessibilityLabel="Nickname" />

      <VisuallyHidden>
        {/* Non-interactive assistive copy only. */}
      </VisuallyHidden>
    </>
  );
}
```

`Field` is deliberately scoped to text-entry composition. `Checkbox`, `Radio`/`RadioGroup`, and `Switch` keep explicit control/group labels and state instead of inheriting Field metadata. Enabled controlled primitives warn in development when their matching change callback is missing, avoiding controls that look interactive but silently ignore input.

`VisuallyHidden` must not be used to hide an interactive control. Buttons, links, inputs, and other interactive elements should expose their own accessible label/state.

## Application primitive example

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  DescriptionItem,
  DescriptionList,
  HStack,
  Link,
  ListGroup,
  ListGroupHeader,
  ListItem,
  Stat,
  StatHelpText,
  StatLabel,
  StatValue,
  Stepper,
  StepperItem,
  Timeline,
  TimelineItem,
} from '@beeui/ui';

function AccountSummary() {
  return (
    <>
      <Breadcrumb>
        <BreadcrumbItem onPress={() => undefined}>Projects</BreadcrumbItem>
        <BreadcrumbItem current>BeeUI</BreadcrumbItem>
      </Breadcrumb>

      <HStack gap="lg" wrap>
        <Stat>
          <StatLabel>Active projects</StatLabel>
          <StatValue>12</StatValue>
          <StatHelpText>3 updated today</StatHelpText>
        </Stat>
      </HStack>

      <DescriptionList>
        <DescriptionItem label="Runtime" value="React Native 0.86.2" />
        <DescriptionItem label="Styling" value="Uniwind 1.10.1" />
      </DescriptionList>

      <Stepper currentStep={2} onStepChange={(step) => console.log(step)}>
        <StepperItem step={1} title="Account" />
        <StepperItem step={2} title="Profile" />
        <StepperItem step={3} title="Review" />
      </Stepper>

      <ListGroup>
        <ListGroupHeader title="Settings" />
        <ListItem title="Appearance" onPress={() => undefined} />
      </ListGroup>

      <Timeline>
        <TimelineItem status="success" title="Created" meta="09:00" />
        <TimelineItem status="primary" title="Reviewed" meta="10:30" />
      </Timeline>

      <Link onPress={() => undefined}>Documentation</Link>
    </>
  );
}
```

Navigation components intentionally own no router, and `Stepper` intentionally owns no workflow state. Applications provide those behaviors.

## Verification status

The current CI pipeline performs:

1. clean `pnpm install --frozen-lockfile`
2. an Expo-import boundary check for `packages/core/src` and `packages/ui/src`
3. strict TypeScript checks across the workspace
4. 68 React Native Testing Library contract tests
5. Expo/Metro export for Web
6. Expo/Metro export for Android
7. Expo/Metro export for iOS
8. `expo prebuild --clean --no-install` to generate both native projects
9. a fresh bare React Native 0.86.2 consumer that rejects Expo runtime resolution, bundles Android + iOS through Metro/Uniwind, and compiles an Android debug APK with Gradle

Every foundation tranche is accepted only after the complete pipeline passes on the PR head.

Expo export proves the JavaScript/Metro bundles resolve on all three targets, Expo Prebuild proves the current configuration can generate Android and iOS native projects, and the bare-native gate proves source portability plus Android native compilation outside Expo. Remaining release verification is native iOS binary compilation on macOS and simulator/device interaction smoke testing, including dialog hardware-back/focus/screen-reader behavior and assistive-technology behavior for visually hidden content.

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
  native-verification.md  bare React Native/native-build contract
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

See [`docs/architecture.md`](docs/architecture.md), [`docs/components.md`](docs/components.md), [`docs/native-verification.md`](docs/native-verification.md), and the ADRs in [`docs/decisions`](docs/decisions) for the full contract.
