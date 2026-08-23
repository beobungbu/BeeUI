# BeeUI

BeeUI is a production-oriented React Native UI system written in TypeScript.

The project is mobile-first, framework-light, and designed for long-lived client applications. Stable behavior, semantic, and variant APIs do not require callers to know the styling engine. The current implementation uses Uniwind + Tailwind CSS v4, with `StyleSheet` / Reanimated reserved as escape hatches for performance-sensitive paths.

BeeUI also exposes optional `className` overrides for source ownership and rapid application work. Those overrides are an implementation-specific escape hatch, not a portability guarantee.

## Current foundation

BeeUI currently includes:

- React Native + TypeScript;
- Expo SDK 57 Showcase on React Native 0.86.2 / React 19.2.3;
- Uniwind OSS 1.10.1 + Tailwind CSS 4.3.3;
- semantic light/dark design tokens;
- reusable `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` packages;
- explicit safe-area ownership through `BeeUIProvider` + `SafeArea`;
- broad layout, typography, action, form, selection, navigation, disclosure, data-display, feedback, state, and application-pattern coverage;
- React Native core `Modal` behavior for `Dialog` and `AlertDialog`;
- one shared non-modal anchored-overlay geometry/runtime with public `Popover` and `DropdownMenu`;
- provider-scoped Toast notifications with queueing, persistence, actions, safe-area-aware stacking, and accessibility announcements;
- deterministic unit/contract tests with `jest-expo` + React Native Testing Library;
- deterministic Chromium visual regression with 28 canonical screenshots;
- executable Showcase navigation between a preserved Component Gallery and a 37-screen production Pattern Gallery;
- durable Chromium Showcase integration smoke owned by `apps/visual-regression`, plus a full 370-render Pattern Gallery acceptance mode without committed PNG baselines;
- release-package verification through `pnpm release:verify`;
- Expo Web/Android/iOS export and Expo Prebuild verification;
- fresh package-installed bare React Native consumer verification;
- bare Android debug APK compilation;
- Expo Showcase native iOS Simulator compilation on a trusted macOS ARM64 runner;
- fresh bare React Native native iOS Simulator compilation on the same macOS gate;
- path-aware native iOS scheduling on pull requests plus persistent Xcode/DerivedData build caches;
- a phase-1 repository-local Registry + source-ownership CLI;
- four merged production pattern packs containing 37 screens.

The canonical component inventory lives in [`docs/components.md`](docs/components.md). The production-readiness plan lives in [`docs/roadmap.md`](docs/roadmap.md).

## Production pattern coverage

The executable Showcase contains a canonical Pattern Gallery over 37 production-oriented screens:

| Pack | Screens |
| --- | ---: |
| Authentication + Onboarding | 9 |
| Dashboard + Finance | 8 |
| Commerce + Social | 12 |
| Account + Settings | 8 |
| **Total** | **37** |

Showcase starts at a local section chooser with two application-owned surfaces: **Components** opens the extracted interactive component playground, while **Patterns** opens the declarative Pattern Gallery. No router or global store is required. The Pattern Gallery supplies local controlled demo adapters, representative state inspection, responsive mobile/desktop browsing, light/dark support, and a constrained desktop preview canvas without mounting all 37 heavy screen trees at once.

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase
```

Then press `i` for iOS, `a` for Android, or `w` for Web in the Expo terminal.

Run the normal verification suite with:

```bash
pnpm check
```

Run package/release verification independently with:

```bash
pnpm release:verify
```

Run deterministic Web visual comparison plus the durable Showcase browser smoke layer with:

```bash
pnpm --dir apps/visual-regression test
```

Run the full 5-viewport × 2-theme × 37-screen Pattern Gallery acceptance matrix explicitly with:

```bash
BEEUI_FULL_PATTERN_GALLERY_QA=1 pnpm --dir apps/visual-regression test
```

The full Gallery mode uses in-memory screenshots and structural/runtime assertions; it does not add 370 committed PNG baselines.

## Pre-1.0 distribution

BeeUI packages intentionally remain `private: true`; BeeUI is not currently published to npm.

The repository supports:

1. workspace package consumption inside the monorepo;
2. packed tarballs for package-boundary/release verification and controlled consumer testing;
3. a phase-1 repository-local Registry + source-ownership CLI.

Current CLI entry points include:

```bash
pnpm beeui -- init
pnpm beeui -- list
pnpm beeui -- add button
pnpm beeui -- add --dry-run button
pnpm beeui -- doctor
pnpm registry:verify
pnpm registry:test
```

This is not yet a public `npx beeui` distribution contract. See [`docs/registry-cli.md`](docs/registry-cli.md) for the implemented phase-1 behavior and [`docs/roadmap.md`](docs/roadmap.md) for CLI/public-package productization.

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

## Forms and accessibility

`Field` owns text-entry label/description/error composition and stable accessibility metadata. `FormGroup` owns structural legend/description/error metadata for related controls without collapsing independently interactive descendants into one accessibility element.

Controlled primitives such as `Checkbox`, `RadioGroup`, `Switch`, `Tabs`, and `SegmentedControl` warn in development when enabled usage omits the matching change callback.

`VisuallyHidden` is restricted to non-interactive assistive content. Interactive controls must carry their own accessible name and state.

## Modal and anchored overlays

BeeUI deliberately separates modal-class overlays from anchored overlays.

- `Dialog` and `AlertDialog` use the accepted React Native core `Modal` kernel.
- `Popover` and `DropdownMenu` use shared non-modal anchored geometry/runtime infrastructure.
- Toast uses a separate transient-notification runtime; it does not use the anchored portal or React Native core `Modal`.

### Anchored-overlay React Context

`PopoverContent` and `DropdownMenuContent` render through BeeUI's `OverlayPortal`, which keeps their content in the source fiber tree so consumer contexts declared between `BeeUIProvider` and the overlay — form, navigation, localization, custom theme — resolve to the provided value inside the overlay. The portal is a runtime-selected transport:

- **Web** (`web-dom`) uses `ReactDOM.createPortal`, which preserves context.
- **Native with the React Native New Architecture** (`native-teleport`) uses a native context-preserving portal (`react-native-teleport`, a peer dependency). Verified on iOS and Android.
- **Native without the New Architecture** (`newArchEnabled: false`), or any build where the native host view is unavailable, falls back to the `legacy` store transport: content is re-parented, consumer context is **not** preserved (resolves to defaults), and a one-time development warning is logged. Enable the New Architecture, or place providers at/above `BeeUIProvider` (or pass values in explicitly).

Overlays target the **nearest host scope**: the root host, or a modal-local host that `DialogContent` provisions in its own window — so a `Popover` or `DropdownMenu` declared inside a `Dialog` renders in front of the modal with context intact (both proven on iOS and Android). Dismissal is child-first on both input paths: outside press is consumed by the overlay's topmost dismiss layer, and Android hardware **back** — which reaches a `Modal` only through `onRequestClose` — is handled by a modal-local dismissal scope that closes the nested overlay first and the Dialog only once no nested overlay remains (a root overlay behind the Dialog is never consumed).

Preserving context on native requires a native rebuild (not an over-the-air JS change); run `expo prebuild --clean` after adding the dependency so the native host view is registered. `react-dom` is optional as BeeUI's own peer (web transport only), but `react-native-teleport` peers on `react-dom`, so a strict package manager may still require a matching `react-dom` even in a native-only app. Automatic focus restoration and complete VoiceOver/TalkBack keyboard/focus behavior remain runtime/device release gates.

See [`docs/anchored-overlays.md`](docs/anchored-overlays.md) for the complete current contract.

## Toast

Toast v1 is implemented as a provider-scoped, descriptor-driven runtime exposed through `useToast()`.

It supports:

- `show`, `dismiss`, and `dismissAll`;
- semantic variants;
- default timed dismissal and explicit persistent mode;
- up to three visible notifications with FIFO overflow queueing;
- optional actions;
- safe-area-aware stacking;
- accessibility announcements;
- provider isolation.

See [`docs/toast.md`](docs/toast.md).

## Verification status

The current release pipeline proves, as applicable to the exact commit under review:

1. frozen dependency installation;
2. Expo-import boundaries for core/UI packages;
3. strict workspace TypeScript;
4. behavioral/contract tests;
5. Registry/CLI tests;
6. package packing, export, manifest, and clean-consumer release verification;
7. Expo Web, Android, and iOS exports;
8. Expo Prebuild generation;
9. fresh packed-package bare React Native Android/iOS Metro bundles;
10. bare Android debug APK compilation;
11. deterministic Chromium component pixel regression in the separate `visual-web` workflow;
12. durable real-Showcase Chromium integration QA for component/pattern navigation, representative layouts, runtime errors, light/dark, and overflow;
13. the full 370-render Pattern Gallery matrix in CI or through the explicit full-mode flag;
14. Expo Showcase native iOS Simulator compilation when the native classifier schedules it;
15. fresh bare React Native native iOS Simulator compilation in the same macOS job.

On pull requests, the expensive `ios-native` job may be skipped only for conservative native-safe diffs. Production pattern implementation under `apps/showcase/patterns/**` is native-sensitive because those modules are now reachable from the executable Showcase through the Pattern Gallery. Pattern-specific test files remain safe because they are not bundled into the native Showcase. Pushes to `main` always run the full native iOS gate. Native build caches are performance-only; they do not replace current-source build evaluation.

Native compilation is not runtime interaction proof. Safe-area behavior, focus/keyboard behavior, VoiceOver/TalkBack, Android hardware-back interaction, runtime navigation/accessibility flows, and representative device visuals remain explicit runtime/device release gates until the roadmap's protected simulator/device tier is implemented.

## Workspace

```text
apps/
  showcase/              executable Component + Pattern inspection surface
  visual-regression/     canonical pixels + durable Showcase browser QA
packages/
  core/                  engine-neutral utilities
  tokens/                semantic token contract + CSS theme
  ui/                    React Native components
registry/                source-ownership registry data
docs/
  architecture.md        architecture constraints/current contracts
  anchored-overlays.md   anchored overlay contract and current limitation
  ci-native-classification.md  PR native scheduling policy
  components.md          canonical component inventory
  native-verification.md package-installed/native-build contract
  registry-cli.md        implemented phase-1 Registry/CLI contract
  release.md             versioning, distribution, and release gates
  roadmap.md             canonical production-readiness roadmap
  toast.md               Toast runtime contract
  visual-regression.md   deterministic visual + Showcase browser QA contract
  decisions/             architecture decision records
scripts/
  verify-release.mjs
  verify-bare-consumer.sh
  classify-ci-changes.mjs
CHANGELOG.md
```

## Design principles

1. Stable behavior, semantic, and variant APIs must not depend on Uniwind, Expo, or navigation libraries.
2. Optional `className` is a current-engine escape hatch; prefer typed variants for reusable contracts.
3. Components consume semantic tokens, never literal brand colors.
4. Behavior/accessibility and presentation should remain separable.
5. Native hot paths may use `StyleSheet` or Reanimated without changing stable component APIs.
6. Components must work in Expo, Expo prebuild/dev builds, and bare React Native.
7. Web support is additive; native ergonomics and correctness remain first-class.
8. Modal-class and anchored overlays may use different behavior primitives.
9. Product-pattern evidence should drive promotion of new shared primitives.
10. BeeUI should not build a styling compiler, router, backend, form framework, or chart framework merely to match another UI ecosystem's feature list.

See [`docs/architecture.md`](docs/architecture.md), [`docs/components.md`](docs/components.md), [`docs/release.md`](docs/release.md), and [`docs/roadmap.md`](docs/roadmap.md) for the canonical contracts and pre-1.0 plan.
