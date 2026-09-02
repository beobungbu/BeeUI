# BeeUI

**Production-oriented React Native components and patterns for Expo, bare React Native, and Web.**

BeeUI is a mobile-first UI system written in TypeScript. It keeps stable behavior, accessibility, semantic tokens, and typed variants above styling-engine details so product teams can build long-lived React Native applications without rebuilding the same UI infrastructure for every screen.

[Documentation source](apps/docs/) · [Component inventory](docs/components.md) · [Showcase](apps/showcase/) · [Roadmap](docs/roadmap.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## Release status

The current repository release candidate is **`20260902.0.0`** for `@beemvp/beeui-ui`.

Public npm publication is still owner-gated in [#254](https://github.com/beobungbu/BeeUI/issues/254). Until that gate closes, the repository, packed-package verification, and Showcase are the canonical executable surfaces; this README does not present `npm install @beemvp/beeui-ui` as an available public contract.

## Why BeeUI

- **Mobile-first behavior** — safe areas, keyboards, native overlays, Dynamic Type, RTL/localization, and platform interaction are first-class constraints.
- **Stable semantic APIs** — reusable component contracts use semantic tokens and typed variants instead of literal brand values or styling-engine knowledge.
- **Accessible by design** — behavior contracts are covered by deterministic tests with dedicated native/runtime acceptance paths where static tests are insufficient.
- **Package or source ownership** — consume stable package APIs, or use the Registry/CLI workflow when an application needs to own and adapt component source.
- **Production composition evidence** — 37 production screens exercise components together instead of treating isolated gallery demos as the finish line.
- **Cross-platform verification** — Web, Android, iOS, Expo, and bare React Native boundaries are verified independently.

## Current foundation

| Area | Current baseline |
| --- | --- |
| Language | TypeScript |
| React | 19.2.x |
| React Native | 0.86.x |
| Expo Showcase | SDK 57 |
| Styling | Uniwind + Tailwind CSS v4 |
| Design tokens | Semantic light/dark token contract |
| Package runtime | Expo + bare React Native + Web |
| License | MIT |

The package peer-dependency ranges in [`packages/ui/package.json`](packages/ui/package.json) are the canonical compatibility contract. See the docs compatibility section for platform-specific notes and experimental boundaries.

## Repository quick start

BeeUI is currently consumed and verified from the monorepo:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm showcase
```

Then press `i` for iOS, `a` for Android, or `w` for Web in the Expo terminal.

Run the main verification surfaces with:

```bash
pnpm check
pnpm release:verify
pnpm --dir apps/visual-regression test
```

Run the complete Pattern Gallery acceptance matrix explicitly with:

```bash
BEEUI_FULL_PATTERN_GALLERY_QA=1 pnpm --dir apps/visual-regression test
```

## Consumer API shape

BeeUI keeps application shells explicit about safe-area ownership:

```tsx
import {
  AppHeader,
  BeeUIProvider,
  BottomActionBar,
  SafeArea,
  Screen,
} from '@beemvp/beeui-ui';

export function AppShell() {
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

`Screen`, `AppHeader`, and `BottomActionBar` do not add safe-area padding implicitly. The shell element touching a system edge owns that inset through `SafeArea`.

## What ships in the repository

```text
apps/
  docs/                  Starlight documentation portal
  showcase/              executable component + pattern inspection surface
  visual-regression/     canonical browser pixels + integration QA
packages/
  core/                  engine-neutral utilities
  tokens/                semantic token contract + CSS theme
  ui/                    React Native components
  cli/                   Registry/source-ownership CLI
registry/                source-ownership registry data
docs/                    architecture, release, verification, decisions
scripts/                 release and consumer-boundary verification
```

### Production pattern coverage

| Pack | Screens |
| --- | ---: |
| Authentication + Onboarding | 9 |
| Dashboard + Finance | 8 |
| Commerce + Social | 12 |
| Account + Settings | 8 |
| **Total** | **37** |

The Showcase exposes Components, Theme & Tokens, Patterns, and dedicated runtime/Dynamic Type/localization stress fixtures from one Expo application.

## Architecture principles

1. Stable behavior, semantic, and variant APIs do not depend on a styling engine, navigation library, or application framework.
2. Components consume semantic tokens rather than literal brand colors.
3. Behavior/accessibility and presentation remain separable.
4. Native hot paths may use `StyleSheet` or Reanimated without changing stable component APIs.
5. Components must work across Expo, Expo prebuild/dev builds, and bare React Native.
6. Web support is additive; native ergonomics and correctness remain first-class.
7. Modal and anchored-overlay behavior may use different primitives when platform semantics require it.
8. Product-pattern evidence drives promotion of new shared primitives.

For deep contracts, use [`docs/architecture.md`](docs/architecture.md), [`docs/anchored-overlays.md`](docs/anchored-overlays.md), [`docs/release.md`](docs/release.md), and [`docs/roadmap.md`](docs/roadmap.md) instead of expanding the README into a maintainer manual.

## Verification philosophy

BeeUI separates deterministic evidence from native runtime evidence. TypeScript, behavior contracts, package boundaries, browser integration, exports/bundles, and native compilation can prove different classes of correctness; none is reported as a substitute for live device interaction where safe area, keyboard, focus, VoiceOver/TalkBack, hardware Back, or native presentation behavior must be observed.

See [`docs/native-verification.md`](docs/native-verification.md), [`docs/visual-regression.md`](docs/visual-regression.md), and [`docs/release.md`](docs/release.md) for the canonical evidence model.

## Documentation

The documentation portal lives in [`apps/docs`](apps/docs/) and is built with Astro + Starlight. Start with:

- [`Getting started`](apps/docs/src/content/docs/getting-started/index.md)
- [`Showcase & preview`](apps/docs/src/content/docs/showcase.md)
- [`Components`](apps/docs/src/content/docs/components/)
- [`Accessibility`](apps/docs/src/content/docs/accessibility/)
- [`Compatibility`](apps/docs/src/content/docs/compatibility/)
- [`Release & security`](apps/docs/src/content/docs/release-security/)

## Contributing and security

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change. It documents local setup, required gates, architecture invariants, and review discipline. Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md). **Do not open a public issue for a security vulnerability.**

## License

BeeUI is released under the [MIT License](LICENSE).
