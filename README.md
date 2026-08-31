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
- durable Chromium Showcase integration smoke plus a full 370-render Pattern Gallery acceptance mode without committed PNG baselines;
- release-package verification through `pnpm release:verify`;
- Expo Web/Android/iOS export and Expo Prebuild verification;
- fresh package-installed bare React Native consumer verification;
- bare Android debug APK compilation;
- Expo Showcase and fresh bare React Native native iOS Simulator compilation on a trusted macOS ARM64 gate;
- path-aware native iOS scheduling on pull requests plus persistent build caches;
- a phase-1 repository-local Registry + source-ownership CLI;
- four merged production pattern packs containing 37 screens.

The canonical component inventory lives in [`docs/components.md`](docs/components.md). The production-readiness plan lives in [`docs/roadmap.md`](docs/roadmap.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, required gates, and BeeUI's
architecture invariants (Rule of Two, semantic-token/brand-blind rule, no-self-merge
review discipline). Participation is governed by
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Report security issues privately per
[`SECURITY.md`](SECURITY.md) — do not open a public issue for a vulnerability.

## Production pattern coverage

| Pack | Screens |
| --- | ---: |
| Authentication + Onboarding | 9 |
| Dashboard + Finance | 8 |
| Commerce + Social | 12 |
| Account + Settings | 8 |
| **Total** | **37** |

Showcase starts at a local section chooser: **Components** opens the preserved interactive component playground, while **Patterns** opens the declarative Pattern Gallery. No router or global store is required.

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase
```

Then press `i` for iOS, `a` for Android, or `w` for Web in the Expo terminal.

Run verification with:

```bash
pnpm check
pnpm release:verify
pnpm --dir apps/visual-regression test
```

Run the full Pattern Gallery acceptance matrix explicitly with:

```bash
BEEUI_FULL_PATTERN_GALLERY_QA=1 pnpm --dir apps/visual-regression test
```

## Pre-1.0 distribution

BeeUI packages and the CLI are release-preparation only and remain unpublished: `private: true`, not published to npm, no `v1.0.0` release or tag exists. The GitHub repository itself also remains private by explicit owner decision, and will not be made public autonomously.

The repository supports workspace package consumption, packed tarballs for package-boundary/controlled consumer testing, and a Registry + source-ownership CLI available both as `pnpm beeui -- <command>` (repo-local) and as the publication-ready `packages/cli` (`@beeui/cli`) package (#209). This is not yet a public `npx @beeui/cli` distribution contract.

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

`Screen`, `AppHeader`, and `BottomActionBar` do not add safe-area padding themselves. Applications assign ownership to the shell element that touches a system edge.

## Forms and accessibility

`Field` owns text-entry label/description/error composition and stable accessibility metadata. `FormGroup` owns structural legend/description/error metadata for related controls without collapsing independently interactive descendants into one accessibility element.

Controlled primitives warn in development when enabled usage omits the matching change callback. `VisuallyHidden` is restricted to non-interactive assistive content.

## Modal and anchored overlays

BeeUI deliberately separates modal-class overlays from anchored overlays.

- `Dialog` and `AlertDialog` use React Native core `Modal`.
- `Popover` and `DropdownMenu` use shared non-modal anchored geometry/runtime infrastructure.
- Toast uses a separate transient-notification runtime.

### Anchored-overlay React Context

`PopoverContent` and `DropdownMenuContent` render through a runtime-selected portal transport:

- **Web (`web-dom`)** → `ReactDOM.createPortal`, consumer context preserved.
- **Native New Architecture (`native-teleport`)** → `react-native-teleport`, consumer context preserved when the native host is registered.
- **Defensive `legacy` fallback** → store/reparent fallback for an unavailable/stale native host capability; arbitrary consumer context is not preserved. This is a safety net, not a recommended deployment.

Overlays resolve against the nearest `OverlayScope`. The root scope is depth `0`; every modal boundary increments its parent depth. Each scope owns its portal host, measured geometry, stable dismiss controller, and semantic depth. Global dismissal chooses the **deepest active scope**, not whichever layout effect happened to register last, so initial-render `defaultOpen` and nested Dialogs remain correct.

Host and anchor geometry use `measureInWindow`. Because native measurement callbacks are asynchronous, BeeUI uses **latest-request-wins generation guards**: stale callbacks cannot overwrite newer geometry or close an overlay after a newer successful anchor measure. Open overlays also remeasure anchors when their nearest host moves/resizes.

A root overlay behind a Dialog cannot steal outside press/accessibility/Web Escape from a modal-local child, even if the root overlay opens later. Web regression coverage uses a staged fixture that commits Dialog + menu first and opens the root Popover in a later commit.

### Native Modal presentations

`DialogContent` defaults to `presentationStyle="overFullScreen"`. BeeUI sets `transparent=true` only for `overFullScreen`. Native `fullScreen`, `pageSheet`, and `formSheet` use `transparent=false`, because RN Fabric otherwise maps a transparent modal to `overFullScreen` regardless of the requested sheet style.

Nested anchored content in a Dialog uses the measured modal-local host. Deterministic tests cover non-zero host origins, host movement, and iOS request-close semantics. **Live iOS `pageSheet`/`formSheet` placement and swipe dismissal remain a simulator/device acceptance gate** and are not claimed from Jest alone.

### iOS `pageSheet`/`formSheet` support policy (#128, tracks #62)

**Status for BeeUI 1.0: EXPERIMENTAL.** Native `pageSheet`/`formSheet` `DialogContent` presentation is not EXCLUDED and is not yet SUPPORTED at release-quality confidence.

**Guaranteed deterministic/compile evidence:** Jest/RNTL contracts prove `transparent=false` Modal props for `pageSheet`/`formSheet`, modal-local host geometry (non-zero origin, host-move remeasurement), and iOS `onRequestClose` non-interception. Native iOS compilation (Expo Showcase and bare RN consumer, `ios-native` CI job) proves these presentations build. Neither proves live presentation, placement, or swipe dismissal.

**Required evidence for release-level support:** recorded exact-head real iOS Simulator or physical-device runtime evidence — actual `pageSheet`/`formSheet` presentation, child Popover/DropdownMenu, keyboard interaction, and swipe-to-dismiss with `onRequestClose` firing, per `docs/native-runtime-smoke.md`'s I4/I5/I6/I7 cases and the runtime-gate record format in `docs/release.md`. Until that evidence exists for an exact release-candidate head, the status stays EXPERIMENTAL.

**Current CI representation — quarantine, not a pass:** the `pageSheet`/`formSheet` section of `apps/showcase/runtime-smoke/maestro/ios-sheets.yaml` is explicitly QUARANTINED (skipped) on the headless CI iOS Simulator, where the trigger tap is swallowed and the sheet never presents (state stays closed, `requestClose: 0`) per #62's investigation. This is not reproducible as a hard failure in bare RN 0.86.2 and reproduces only ~33% locally (not ~100% as on CI), so it is treated as a documented RN-Modal/headless-CI-simulator limitation, not a BeeUI kernel defect. A quarantined/skipped section must never be reported or counted as a passing runtime gate. `overFullScreen` (transparent) presentation is unaffected, is exercised in the same suite, and passes.

**Conditions to remove the quarantine:** re-enable the `pageSheet`/`formSheet` Maestro section once either (a) upstream React Native/iOS Simulator behavior changes so the presentation reliably fires on the headless CI simulator, or (b) a CI-proven, non-flaky presentation path is found at the BeeUI layer — in both cases the re-enabled section must pass on CI before the quarantine is lifted. Do not re-attempt the previously reverted kernel accessibility-gating fix without new CI-proven evidence (see #62).

### Platform dismissal

- **Android** hardware back under RN Modal reaches BeeUI through `Modal.onRequestClose`; modal child closes first, Dialog closes on the next request when no child remains.
- **iOS/other** request-close can be native sheet dismissal itself, so BeeUI does not child-intercept it.
- `onRequestClose` fires exactly once per native request and remains disjoint from backdrop/accessibility-close paths.

### Application runtime boundary

Nested `BeeUIProvider`s reuse one application-root overlay runtime. Active-scope state is runtime-local rather than module-global. Separate unrelated React application roots may hold isolated runtime state, but BeeUI does **not** guarantee which root arbitrates one physical global Escape/back event when multiple independent application roots are simultaneously active. The supported application contract is one application-root overlay runtime.

Preserving native context requires a native rebuild after installing teleport. The `web-dom` path is proven under Expo Web/current Metro; arbitrary bundler resolution and public npm distribution remain pre-1.0 hardening.

See [`docs/anchored-overlays.md`](docs/anchored-overlays.md) for the full contract.

## Toast

Toast v1 is provider-scoped and descriptor-driven through `useToast()`. It supports show/dismiss/dismissAll, semantic variants, timed/persistent modes, FIFO overflow queueing, actions, safe-area-aware stacking, and accessibility announcements.

## Verification status

Current release evidence includes frozen install, Expo-import boundaries, TypeScript, behavioral contracts, Registry/CLI tests, package verification, Expo Web/Android/iOS exports, Expo Prebuild, packed true-bare Android/iOS Metro bundles, bare Android native compilation, deterministic Chromium component pixels, real-browser Showcase/overlay integration, full 370-render Pattern Gallery acceptance, and trusted native iOS compilation when scheduled.

Native compilation is not runtime interaction proof. Remaining runtime/device gates include live iOS `pageSheet`/`formSheet` placement/swipe, representative safe-area/scrolling behavior, focus/keyboard restoration, VoiceOver/TalkBack, and representative native visuals. Exact final-head device evidence must be separated from deterministic or prior-head evidence.

## Workspace

```text
apps/
  showcase/              executable Component + Pattern inspection surface
  visual-regression/     canonical pixels + durable browser QA
packages/
  core/                  engine-neutral utilities
  tokens/                semantic token contract + CSS theme
  ui/                    React Native components
registry/                source-ownership registry data
docs/
  architecture.md
  anchored-overlays.md
  ci-native-classification.md
  components.md
  native-verification.md
  registry-cli.md
  release.md
  roadmap.md
  toast.md
  visual-regression.md
  decisions/
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

See [`docs/architecture.md`](docs/architecture.md), [`docs/components.md`](docs/components.md), [`docs/release.md`](docs/release.md), and [`docs/roadmap.md`](docs/roadmap.md) for canonical contracts and the pre-1.0 plan.
