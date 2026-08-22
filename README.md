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
- pure anchored-overlay geometry resolver with deterministic flip/shift/collision and RTL-aware alignment
- one shared anchored-overlay runtime under `BeeUIProvider` with portal ordering, window-coordinate measurement, safe-area/keyboard environment, and topmost-only dismiss handling
- public non-modal `Popover` and `DropdownMenu` compositions layered on the shared anchored-overlay kernels
- 104 exported foundation components/subcomponents documented in `docs/components.md`
- 119 contract tests with `jest-expo` + React Native Testing Library
- reproducible `pnpm-lock.yaml` and frozen dependency installs
- release-package verification with packed-manifest, export, dependency, and clean-consumer checks
- CI release-verification JSON artifact for the exact commit under review
- CI smoke bundling for Web, Android, and iOS through Expo/Metro
- CI Expo Prebuild generation for Android and iOS native projects
- CI guard preventing Expo runtime imports in `@beeui/core` and `@beeui/ui`
- true bare React Native 0.86.2 consumer verification using installed BeeUI tarballs rather than copied workspace source
- Android bare React Native debug APK compilation in CI
- React Native core `Modal` behavior for `Dialog` and `AlertDialog`; anchored overlays use a separate non-Modal host/runtime foundation

## Component coverage

Current foundation includes application-root integration, layout, accessibility, typography, actions, forms, selection, navigation, disclosure, modal overlays, anchored overlays, application chrome, application patterns, data display, feedback, and state compositions:

`BeeUIProvider`, `SafeArea`, `Screen`, `Box`, `Stack`, `HStack`, `VStack`, `Section`, `MetadataRow`, `VisuallyHidden`, `Text`, `Label`, `Button`, `ButtonLabel`, `IconButton`, `Link`, `Input`, `Textarea`, `Field`, `FormGroup`, `HelperText`, `FormMessage`, `SearchInput`, `PasswordInput`, `OTPInput`, `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Chip`, `ChipGroup`, `SegmentedControl`, `SegmentedControlItem`, `Pagination`, `PaginationItem`, `Breadcrumb`, `BreadcrumbItem`, `Stepper`, `StepperItem`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`, `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverTitle`, `PopoverDescription`, `PopoverClose`, `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `AppHeader`, `BottomActionBar`, `ListGroup`, `ListGroupHeader`, `ListItem`, `SettingsItem`, `DescriptionList`, `DescriptionItem`, `Card`, `AlertBanner`, `Badge`, `Avatar`, `Stat`, `StatLabel`, `StatValue`, `StatHelpText`, `Timeline`, `TimelineItem`, `Progress`, `Spinner`, `Skeleton`, `Separator`, `EmptyState`, and `ErrorState`.

`Select` and `Tooltip` remain deferred as public anchored components because they still need component-specific keyboard/focus/accessibility contracts. `Toast` will use a separate transient-notification contract because it is not anchor-positioned.

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

Run the package/release contract independently with:

```bash
pnpm release:verify
```

The release verifier packs all BeeUI packages, validates their packed manifests/exports, installs the tarballs into a clean package consumer, rejects Expo leakage, and writes `.artifacts/release-verification.json`.

## Pre-1.0 distribution

BeeUI packages intentionally remain `private: true`. The repository uses workspace packages for development and packed tarballs for package-boundary verification/controlled consumer smoke tests. This does not claim that BeeUI is publicly available from npm.

The intended pre-1.0 direction is a registry/CLI source-ownership workflow. That workflow is still a release-roadmap item; applications should not depend on monorepo-relative paths as a distribution contract. See `docs/release.md` for the versioning and release policy.

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
import { Field, FormGroup, Input, Label, Radio, RadioGroup, VisuallyHidden } from '@beeui/ui';

function ProfileFields() {
  return (
    <>
      <Field label="Email" required>
        <Input keyboardType="email-address" />
      </Field>

      <FormGroup description="Choose one plan." legend="Plan" required>
        <RadioGroup onValueChange={() => undefined} value="starter">
          <Radio label="Starter" value="starter" />
          <Radio label="Pro" value="pro" />
        </RadioGroup>
      </FormGroup>

      <Label nativeID="nickname-label">Nickname</Label>
      <Input accessibilityLabelledBy="nickname-label" accessibilityLabel="Nickname" />

      <VisuallyHidden>
        {/* Non-interactive assistive copy only. */}
      </VisuallyHidden>
    </>
  );
}
```

`Field` is deliberately scoped to text-entry composition. `FormGroup` provides structural legend/description/error metadata for related controls without becoming one accessibility element or cloning state into arbitrary descendants. React Native has a native `radiogroup` role but no generic cross-platform `fieldset/group` role, so `RadioGroup` consumes the FormGroup metadata directly while its radio descendants remain independently discoverable.

Enabled controlled primitives warn in development when their matching change callback is missing, avoiding controls that look interactive but silently ignore input. `VisuallyHidden` must not be used to hide an interactive control. Buttons, links, inputs, and other interactive elements should expose their own accessible label/state.

## Alert dialog confirmation

`AlertDialog` reuses the accepted React Native core `Modal`/Dialog behavior kernel. Backdrop presses never dismiss it. Android hardware-back and accessibility escape act like cancellation by default; set `cancelOnRequestClose={false}` when a critical flow should receive those requests without closing automatically.

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@beeui/ui';

function DeleteProject() {
  return (
    <AlertDialog>
      <AlertDialogTrigger variant="destructive">Delete project</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete project?</AlertDialogTitle>
        <AlertDialogDescription>
          This action permanently removes the project.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onPress={() => undefined}>Delete permanently</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

BeeUI does not claim a browser-style focus trap or a dedicated native `alertdialog` accessibility role where React Native core does not expose that contract. Native simulator/device screen-reader behavior remains part of the release verification matrix.

## Anchored overlay foundation, Popover, and DropdownMenu

BeeUI has two shared anchored-overlay layers:

1. a pure `@beeui/core` geometry resolver for placement, RTL alignment, offsets, flip/shift, collision padding, overflow, and available-space metadata;
2. an internal `@beeui/ui` runtime under `BeeUIProvider` for one shared host, portal lifecycle, window-coordinate anchor/host measurement, host-local translation, safe-area/keyboard environment, explicit remeasurement, and deterministic topmost dismissal.

`Popover` is the first public component built on those kernels:

```tsx
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@beeui/ui';

function ProfilePopover() {
  return (
    <Popover>
      <PopoverTrigger variant="outline">Profile details</PopoverTrigger>
      <PopoverContent align="start" placement="bottom">
        <PopoverTitle>Profile</PopoverTitle>
        <PopoverDescription>
          Review the account details associated with this workspace.
        </PopoverDescription>
        <PopoverClose variant="ghost">Done</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
```

Popover is non-modal and does not use React Native core `Modal` for positioning. Its trigger is the measured anchor; unresolved content measures invisibly offscreen instead of flashing at `(0,0)`. Safe-area collision handling is enabled by default, keyboard avoidance is opt-in, and outside press / Android back / Web Escape affect only the topmost overlay so nested Popovers close child-first.

`DropdownMenu` adds menu-specific selection and keyboard contracts on the same runtime:

```tsx
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@beeui/ui';

function WorkspaceMenu() {
  const [toolbar, setToolbar] = React.useState(true);
  const [density, setDensity] = React.useState('comfortable');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="outline">Workspace</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => undefined}>Edit project</DropdownMenuItem>
        <DropdownMenuItem disabled>Archive unavailable</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={toolbar} onCheckedChange={setToolbar}>
          Show toolbar
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup onValueChange={setDensity} value={density}>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Normal menu items close after selection by default. Checkbox/radio items stay open by default, and `closeOnSelect` can opt them into closing. On Web, ArrowUp/ArrowDown, Home/End, and Enter/Space operate on a deterministic current enabled item; disabled items are skipped. `onSelect` is the cross-input semantic action, while pointer `onPress` remains available for pointer-specific handling.

The current custom anchored-overlay portal re-parents content under the root overlay host. BeeUI re-provides the internal contexts its own overlay components require, but arbitrary React contexts declared between `BeeUIProvider` and the overlay source are not currently guaranteed inside portalled content. Put providers needed by overlay content at or above `BeeUIProvider`, or pass those values explicitly, until the context-preserving portal follow-up is resolved.

BeeUI does not yet claim automatic focus restoration, a browser-style focus trap, or complete VoiceOver/TalkBack keyboard/focus behavior for Popover or DropdownMenu. Those remain explicit web/simulator/device release gates. See `docs/anchored-overlays.md` for the full contract.

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
4. 119 React Native Testing Library contract tests
5. `pnpm release:verify`, including real tarball packing and clean-consumer installation plus packed anchored-overlay/runtime source assertions
6. upload of `.artifacts/release-verification.json` for the PR commit
7. Expo/Metro export for Web
8. Expo/Metro export for Android
9. Expo/Metro export for iOS
10. `expo prebuild --clean --no-install` to generate both native projects
11. a fresh bare React Native 0.86.2 consumer that installs the packed BeeUI tarballs, rejects Expo runtime resolution, bundles Android + iOS through Metro/Uniwind, and compiles an Android debug APK with Gradle

Every foundation tranche is accepted only after the complete pipeline passes on the exact PR head.

Expo export proves the JavaScript/Metro bundles resolve on all three targets, Expo Prebuild proves the current configuration can generate Android and iOS native projects, and the bare-native gate proves installed-package portability plus Android native compilation outside Expo. Native iOS binary compilation on macOS and simulator/device interaction remain explicit release gates rather than claims made by Linux CI. Those gates include safe-area behavior, Dialog/AlertDialog hardware-back/focus/keyboard/screen-reader behavior, Popover and DropdownMenu scrolling/anchor movement/focus/keyboard/screen-reader behavior, VoiceOver/TalkBack behavior for visually hidden content, and representative light/dark visual review.

## Workspace

```text
apps/
  showcase/          Expo application that exercises BeeUI
packages/
  core/              engine-neutral utilities
  tokens/            semantic token contract + CSS theme
  ui/                React Native components
docs/
  anchored-overlays.md anchored overlay geometry/runtime/public-component contract
  architecture.md    architecture constraints
  components.md      canonical component inventory
  native-verification.md  bare React Native/native-build contract
  release.md         versioning, distribution, and release gates
  decisions/         architecture decision records
scripts/
  verify-release.mjs package/export/installability verifier
  verify-bare-consumer.sh  package-installed bare RN smoke/build
CHANGELOG.md          consumer-facing release changes and migrations
```

## Design principles

1. Stable behavior, semantic, and variant APIs must not depend on Uniwind, Expo, or navigation libraries.
2. Optional `className` is a current-engine escape hatch; prefer typed variants for reusable contracts.
3. Components consume semantic tokens, never literal brand colors.
4. Behavior/accessibility and presentation should remain separable.
5. Native hot paths may use `StyleSheet` or Reanimated without changing stable component APIs.
6. Components must work in Expo, Expo prebuild/dev builds, and bare React Native.
7. Web support is additive; mobile correctness takes priority.
8. Modal-class and anchored overlays may use different behavior primitives; a public overlay component is accepted only after its component-specific platform interaction contract is defined and its automated gates pass.

See [`docs/architecture.md`](docs/architecture.md), [`docs/anchored-overlays.md`](docs/anchored-overlays.md), [`docs/components.md`](docs/components.md), [`docs/native-verification.md`](docs/native-verification.md), [`docs/release.md`](docs/release.md), and the ADRs in [`docs/decisions`](docs/decisions) for the full contract.
