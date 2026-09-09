---
title: Start
description: Install the BeeUI release candidate from npm or evaluate the repository, then follow the verified Expo, bare React Native or Web path.
---

BeeUI **`0.86.2-rc.1` is public on npm** under the opt-in `next` dist-tag. Stable `latest` is not promoted yet, so every release-candidate install should use `@next` or pin the exact RC version.

:::caution[Release-candidate channel]
Use `@next` while evaluating `0.86.2-rc.1`. Do not replace the commands below with unqualified package names until stable `0.86.2` has been promoted to `latest`.
:::

## Install the package boundary

For an application that will consume BeeUI as packages:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

The CLI is published separately in the same lockstep release:

```bash
npx @beemvp/beeui-cli@next --help
```

Pin `@0.86.2-rc.1` instead of `@next` when you need an immutable prerelease version in CI or a reproducible consumer fixture.

## Which intent is yours

| Intent | You want to | Start at |
| --- | --- | --- |
| **Integrate the public RC** | Install BeeUI into an Expo, bare React Native or Web app | [Pick a platform](#pick-a-platform) |
| **Evaluate the repository** | See Showcase, demo, source and verification evidence together | [Evaluate from source](#evaluate-from-source) |
| **Own component source** | Copy selected BeeUI source into your repository and maintain it there | [CLI & source ownership](/docs/guides/cli-source-ownership/) |

## Prerequisites

BeeUI documents tested points, not unlimited compatibility promises. The authoritative machine-checked table lives in [Compatibility](/docs/compatibility/).

| Requirement | Tested value | Needed for |
| --- | --- | --- |
| Node.js | `24.13.1` | repository tooling and verified consumers |
| pnpm | `10.15.0` | repository commands |
| React / React DOM | `19.2.3` | supported consumer paths |
| React Native | `0.86.2` | Expo, bare React Native, Web via React Native Web |
| Expo SDK | `~57.0.0` | Expo path |
| `react-native-web` | `0.21.0` | Web path |
| Tailwind CSS / Uniwind | `4.3.3` / `1.10.1` | styling entry |

Check [Compatibility](/docs/compatibility/) for peer ranges and optional native peers before changing versions.

## Pick a platform

| Platform | Guide | Maintained executable authority | Evidence |
| --- | --- | --- | --- |
| Expo | [Expo](/docs/start/expo/) | `examples/expo-package-consumer` | Metro export for Android, iOS and Web |
| Bare React Native | [Bare React Native](/docs/start/bare-react-native/) | `examples/bare-rn-consumer` | Metro bundles plus native compile coverage in CI |
| Web | [Web](/docs/start/web/) | `examples/web-consumer` | production Web build |

The maintained consumer examples remain valuable even after public publication: they prove the exact package boundary in clean projects and catch deep imports, peer drift and bundler-resolution problems.

## Evaluate from source

Use the repository when you want the complete Showcase, demo and release evidence rather than only package consumption:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm showcase
pnpm docs:build
pnpm --filter @beemvp/beeui-demo web
```

Repository-local packed tarballs are still used by CI and can be useful for testing an unreleased commit, but they are no longer required to consume the published RC.

## Two consumption models

### Package boundary

Choose packages when you want BeeUI upgrades to remain centralized behind package exports.

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

Use package subpaths documented by the generated component reference; do not deep-import unpublished internal files.

### Source ownership

Choose source ownership when you want selected BeeUI component source committed into your own repository, reviewed there and intentionally modified there.

```bash
npx @beemvp/beeui-cli@next list
npx @beemvp/beeui-cli@next add --dry-run button
npx @beemvp/beeui-cli@next add button
npx @beemvp/beeui-cli@next doctor
```

See [CLI & source ownership](/docs/guides/cli-source-ownership/) and [Registry](/docs/registry/) for the ownership/update contract.

## First BeeUI shell

Whatever path you choose, the application root uses one `BeeUIProvider` with explicit safe-area ownership:

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

Read [Provider & safe area](/docs/start/provider-safe-area/) before building a production shell.

## Verify your install

After installation:

1. Confirm `npm ls @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens` resolves `0.86.2-rc.1` when using `@next` today.
2. Typecheck your application.
3. Build or export for every platform you ship.
4. Exercise at least one real BeeUI component under `BeeUIProvider`.
5. For native applications, run the platform-specific guide's native checks rather than treating a Web build as native evidence.

For exact release-channel rules, see the repository authority [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md).
