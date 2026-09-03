# BeeUI

**Production-oriented React Native UI for Expo, bare React Native, and Web.**

BeeUI is a mobile-first TypeScript UI system focused on long-lived application interfaces: accessible behavior, explicit responsive contracts, semantic theming, production screen patterns, and source ownership without coupling application code to a styling engine.

> **Distribution status — 2026-09-02:** the repository/package release label is `20260902.0.0`. BeeUI packages and the CLI are **not published to the public npm registry yet**. Do not treat public `npm install @beemvp/beeui-*` or `npx @beemvp/beeui-cli` commands as available. Publication remains an owner-gated action; `docs/dist-tag-policy.md` is the machine-checked authority.

## What is included

- `@beemvp/beeui-core` — engine-neutral utilities and contracts.
- `@beemvp/beeui-tokens` — semantic tokens, breakpoints, density, and Web theme output.
- `@beemvp/beeui-ui` — React Native components for iOS, Android, and Web.
- `apps/showcase` — executable Component + Pattern inspection surface.
- `apps/demo` — routed production reference application.
- `registry/` + repository-local CLI — source-ownership workflow.
- `apps/docs` — Astro + Starlight public documentation source.
- `llms*.txt` + AI-agent contracts — machine-readable discovery/context surfaces.

The current Pattern Gallery contains **37 production screens** across authentication/onboarding, dashboard/finance, commerce/social, and account/settings domains. Exact component and pattern inventories are generated/checked from canonical source rather than maintained as a second README list.

## Platform contract

BeeUI targets:

- Expo;
- bare React Native;
- React Native Web / Web;
- iOS and Android native builds.

The repository currently exercises Expo SDK 57, React Native 0.86.2, React 19.2.3, React Native Web 0.21.0, Uniwind 1.10.1, and Tailwind CSS 4.3.3. Treat [`docs/compatibility-matrix.md`](docs/compatibility-matrix.md) as the canonical, machine-checked compatibility authority rather than this summary when exact support matters.

## Evaluate BeeUI from this repository

Because public package publication is closed, the supported evaluation path today is the repository itself:

```bash
corepack enable
pnpm install --frozen-lockfile

# Interactive Component + Pattern Showcase
pnpm showcase

# Static docs build
pnpm docs:build

# Production reference app (Web)
pnpm --filter @beemvp/beeui-demo web
```

In the Showcase Expo terminal, press `i` for iOS, `a` for Android, or `w` for Web when the corresponding local toolchain is available.

## First application shell

`BeeUIProvider` owns shared safe-area measurement plus accepted Toast/anchored-overlay runtime services. Application shells keep safe-area ownership explicit:

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

`Screen`, `AppHeader`, and `BottomActionBar` do not silently add safe-area padding. See [`docs/architecture.md`](docs/architecture.md) and [`docs/components.md`](docs/components.md) for the full behavior contract.

## Two consumption models

BeeUI intentionally supports two product models, while public registry publication remains closed:

1. **Package boundary** — the Showcase, demo, and clean-consumer fixtures use the intended public `@beemvp/beeui-*` export shape through the workspace/packed-artifact verification paths.
2. **Source ownership** — the repository-local Registry CLI can inspect/add owned component source into a consumer project.

The two models share behavior, accessibility, token, compatibility, and component contracts. Source ownership is not permission to fork a second independent API inventory.

See [`docs/registry-cli.md`](docs/registry-cli.md) for the source-ownership contract.

## Production reference surfaces

### Showcase

`apps/showcase` is the canonical interactive component and Pattern Gallery runtime. It intentionally does not own an application router or business state.

```bash
pnpm --filter @beemvp/beeui-showcase start
pnpm --filter @beemvp/beeui-showcase web
pnpm --filter @beemvp/beeui-showcase build:web
```

### Demo

`apps/demo` is the separate coherent reference application. It owns Expo Router navigation, mock service/data seams, and app preferences, and includes Dashboard, Records, Record Detail/Edit, Schedule, and Settings routes.

```bash
pnpm --filter @beemvp/beeui-demo start
pnpm --filter @beemvp/beeui-demo web
pnpm --filter @beemvp/beeui-demo build:web
```

## Accessibility and responsive behavior

BeeUI treats accessibility/responsiveness as behavior contracts, not landing-page claims. Repository evidence covers deterministic semantics, focus/keyboard behavior, RTL, dynamic type/large text, reduced motion, responsive layout tokens, browser integration, native compilation, and explicitly classified device/runtime gates.

Important evidence boundaries remain explicit: native compilation is not native interaction proof, and a Web preview is not described as native runtime evidence.

Canonical references:

- [`docs/accessibility-contract.md`](docs/accessibility-contract.md)
- [`docs/responsive-layout.md`](docs/responsive-layout.md)
- [`docs/dynamic-type.md`](docs/dynamic-type.md)
- [`docs/reduced-motion-acceptance-matrix.md`](docs/reduced-motion-acceptance-matrix.md)
- [`docs/native-runtime-smoke.md`](docs/native-runtime-smoke.md)
- [`docs/web-support-contract.md`](docs/web-support-contract.md)

## Theming and density

Components consume semantic tokens rather than literal brand colors. BeeUI supports light/dark semantic themes, brand overrides, responsive layout tokens, and density controls while keeping stable component behavior independent of the styling engine.

See [`docs/theming.md`](docs/theming.md), [`docs/theme-scope.md`](docs/theme-scope.md), and [`docs/density.md`](docs/density.md).

## Documentation and AI discovery

The public website launch is being built for `https://beeui.beemvp.com` with canonical docs under `/docs/**`, Showcase under `/showcase/**`, and demo under `/demo/**`. Until that deployment is activated, repository docs remain the source authority.

Machine-readable agent surfaces already live in the repository:

- `llms.txt`
- `llms-full.txt`
- `llms-components.txt`
- `llms-patterns.txt`

They are generated/freshness-checked; see [`docs/ai-agent-cookbook.md`](docs/ai-agent-cookbook.md).

## Verification

Use repository gates instead of inferring readiness from prose:

```bash
pnpm typecheck
pnpm test
pnpm release:verify
pnpm --dir apps/visual-regression test
```

The CI matrix additionally covers clean consumer boundaries, Web accessibility/visual behavior, Expo/native compilation/runtime lanes when scheduled, and release-policy drift guards.

## Source-of-truth map

| Question | Authority |
| --- | --- |
| Exact component behavior/inventory | [`docs/components.md`](docs/components.md) + generated component reference |
| Compatibility | [`docs/compatibility-matrix.md`](docs/compatibility-matrix.md) |
| Accessibility | [`docs/accessibility-contract.md`](docs/accessibility-contract.md) |
| Responsive layout | [`docs/responsive-layout.md`](docs/responsive-layout.md) |
| Patterns | generated Pattern Gallery contract + `apps/showcase/src/patterns` |
| Registry/source ownership | [`docs/registry-cli.md`](docs/registry-cli.md) |
| Publication/dist-tags | [`docs/dist-tag-policy.md`](docs/dist-tag-policy.md) |
| Release process | [`docs/release.md`](docs/release.md) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, required gates, architecture invariants, and review discipline. Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

Report vulnerabilities privately using [`SECURITY.md`](SECURITY.md). Do **not** open a public issue for a suspected security vulnerability.

## License

MIT. See [`LICENSE`](LICENSE).
