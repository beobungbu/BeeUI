---
title: Start
description: Pick the BeeUI path you need today — evaluate the library from this repository, or integrate it into an external product through the packed-package boundary.
---

BeeUI is **unpublished**, so onboarding does not begin with a package-install command. It begins with one question: are you *evaluating* BeeUI, or *integrating* it into a product you already own? Both intents are executable today, and each has a different starting point.

:::caution[Public distribution is closed]
No `@beemvp/beeui-*` package and no BeeUI CLI resolve from the public npm registry yet, so do not plan around a public install command. Every path below uses either this repository or real `pnpm pack` tarballs installed into an isolated application. Publication state is machine-checked from the release policy — see [Release & security](/docs/release-security/).
:::

## Which intent is yours

| Intent | You want to | Start at |
| --- | --- | --- |
| **Evaluate BeeUI today** | See the real component and pattern runtime, read the source, decide whether BeeUI fits | [Evaluate BeeUI today](#evaluate-beeui-today) |
| **Integrate BeeUI into an external product** | Get BeeUI rendering inside your own Expo, bare React Native or Web application | [Integrate BeeUI into an external product](#integrate-beeui-into-an-external-product) |

Both intents share the same prerequisites and the same first screen. They differ only in where the application lives.

## Prerequisites

BeeUI publishes *tested points*, not semver promises. The values below are the ones the consumer starters and CI actually install; the authoritative, machine-checked table lives in [Compatibility](/docs/compatibility/).

| Requirement | Tested value | Needed for |
| --- | --- | --- |
| Node.js | `24.13.1` | every path (this repository sets `engine-strict=true`) |
| pnpm | `10.15.0` | every repository command |
| React / React DOM | `19.2.3` | every path |
| React Native | `0.86.2` | Expo, bare React Native, Web (via React Native Web) |
| Expo SDK | `~57.0.0` | the Expo path only |
| `react-native-web` | `0.21.0` | the Web path |
| Tailwind CSS / Uniwind | `4.3.3` / `1.10.1` | styling entry on every path |

Confirm the full set — including the optional native peers for `Sheet`, `DatePicker` and `DateTimePicker` — in [Compatibility](/docs/compatibility/) before you pin anything.

## Starting project state

Every path on this page starts from a clean checkout of this repository with the workspace built:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` is a hard prerequisite, not a convenience. The shared packer (`examples/scripts/pack-beeui-packages.mjs`) refuses to produce tarballs when `packages/<name>/dist` is missing, so every consumer starter fails immediately without it.

## Evaluate BeeUI today

Use this when you want to judge BeeUI's real surface before writing integration code.

| What you want to see | Run or open | What it proves |
| --- | --- | --- |
| The complete component and pattern runtime | [Showcase](/showcase/) | the maintained Expo + Web Showcase, with a native preview path when a local simulator or device is available |
| A coherent routed product app | [Demo](/demo/) | Dashboard, Records, Detail, Schedule and Settings composed from BeeUI |
| A browsable API surface | [Components](/docs/components/) and [Patterns](/docs/patterns/) | the generated reference derived from the package barrel and the registry |
| The static docs and Web surfaces locally | the commands below | the same artifacts the public site is built from |

```bash
pnpm docs:build
pnpm --filter @beemvp/beeui-showcase build:web
pnpm --filter @beemvp/beeui-demo build:web
```

These are repository commands. They are not external package-install instructions, and they do not depend on public distribution.

## Integrate BeeUI into an external product

Use this when you want BeeUI inside an application that is not part of this monorepo. Pick your host platform:

| Platform | Guide | Executable authority | Evidence it produces |
| --- | --- | --- | --- |
| Expo (SDK 57) | [Expo](/docs/start/expo/) | `examples/expo-package-consumer` | Metro export for Android, iOS and Web |
| Bare React Native (no Expo) | [Bare React Native](/docs/start/bare-react-native/) | `examples/bare-rn-consumer` | Metro bundles for Android and iOS |
| Web (Vite + React Native Web) | [Web](/docs/start/web/) | `examples/web-consumer` | a Vite production build |

Each guide walks the maintained starter for that platform end to end. The starters are the executable authority: if a command in a guide and a command in the starter ever disagree, the starter wins and the docs gate fails.

BeeUI supports two consumption models. They are both available today, and they answer different questions.

### Package boundary

Choose this when you want BeeUI maintained behind package exports and upgraded centrally.

While public publication is closed, the three clean-consumer starters build real tarballs with `pnpm pack` and install them into an isolated application with npm. That is deliberately stricter than a monorepo demo: it catches deep imports, `workspace:*` leakage and copied-`dist` shortcuts that a link-based setup would hide.

Executable authorities:

- `examples/expo-package-consumer`
- `examples/bare-rn-consumer`
- `examples/web-consumer`

When publication opens, the integration code you write against this boundary does not change — only where the tarball comes from.

### Source ownership

Choose this when you want selected BeeUI component source committed into your own repository, reviewed there, and modified there.

The repository-local Registry CLI owns the inspect, add, diff and update semantics:

```bash
pnpm beeui -- list
pnpm beeui -- add --dry-run button
pnpm beeui -- add button
pnpm beeui -- doctor
```

`examples/source-ownership-starter` runs exactly this flow and then asserts that the resulting application does **not** resolve `@beemvp/beeui-ui` at all. Owning the source changes who owns the file; it does not create a different accessibility, behavior or token contract. Details are in [CLI & source ownership](/docs/cli/) and [Registry](/docs/registry/).

## First BeeUI shell

Whatever path you chose, the application root is the same: one `BeeUIProvider`, and explicit per-edge safe-area ownership.

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

Read [Provider & safe area](/docs/start/provider-safe-area/) for nested providers, overlay scopes, Toast ownership and the edge rules before you build a real shell.

## Verify

Work through these checkpoints in order. Each one has an observable result.

1. **Toolchain matches.** `node --version` prints `v24.13.1` and `pnpm --version` prints `10.15.0`. A different major Node version is rejected by `engine-strict=true` during install.
2. **Workspace builds.** `pnpm build` exits `0` and `packages/core/dist`, `packages/tokens/dist` and `packages/ui/dist` all exist. If they do not, no starter can pack.
3. **Docs and Web surfaces build.** `pnpm docs:build`, `pnpm --filter @beemvp/beeui-showcase build:web` and `pnpm --filter @beemvp/beeui-demo build:web` each exit `0`.
4. **Your chosen platform passes its own gate.** Follow the platform guide and stop at its `Verify` section; each one ends with a printed `OK:` line or a build summary you can compare against the starter's recorded evidence.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `packages/ui/dist is missing. Run "pnpm build" …` when a starter's `setup.sh` runs | the packer refuses to pack an unbuilt workspace | run `pnpm build` from the repository root, then re-run `bash setup.sh` |
| `Unsupported engine` / `EBADENGINE` during `pnpm install` | this repository sets `engine-strict=true` and pins Node `24.13.1` | switch Node versions (the pin is in `.nvmrc`), then reinstall |
| You look for a public install command and find none | BeeUI is unpublished; the install CTA is machine-gated off | use a starter from `examples/` or the Registry CLI; watch [Release & security](/docs/release-security/) for the publication gate |
| A starter resolves the Expo runtime when it should not | leftover `node_modules` from an earlier experiment in the same directory | delete the starter's `node_modules` (and `app/` for the bare starter) and re-run `bash setup.sh` |
| Components render but are completely unstyled | the CSS entry with the Tailwind, Uniwind and BeeUI theme imports was never wired or never imported | follow the styling step in your platform guide; the entry file is part of the starter, not optional |

More symptom-indexed diagnosis lives in [Troubleshooting](/docs/troubleshooting/).

## Next steps

- Browse [Components](/docs/components/) for the generated per-component reference.
- Compose real screens with [Patterns](/docs/patterns/).
- Diagnose a stuck setup with [Troubleshooting](/docs/troubleshooting/).
- Confirm exact versions in [Compatibility](/docs/compatibility/), then customize semantics in [Theming](/docs/theming/).
- Read [Accessibility](/docs/accessibility/) and [Responsive layout](/docs/responsive/) before shipping a production shell.

## Evidence classes

BeeUI never collapses these into a single "supported" badge, and neither should a report you write from these guides:

- **deterministic contract tests** — props, state, semantics and geometry logic;
- **bundle evidence** — module/package resolution and bundler output;
- **native compile evidence** — Gradle and Xcode acceptance;
- **browser runtime evidence** — keyboard, focus, visual and accessibility behavior on Web;
- **native runtime/device evidence** — real simulator or device interaction and assistive technology.

A passing Expo export or Metro bundle is not native runtime proof, and a Web preview is not iOS or Android proof.

## Source authority

- [`examples/README.md`](https://github.com/beobungbu/BeeUI/blob/main/examples/README.md) — the maintained starter inventory.
- [`examples/scripts/pack-beeui-packages.mjs`](https://github.com/beobungbu/BeeUI/blob/main/examples/scripts/pack-beeui-packages.mjs) — the shared package-boundary packer.
- [`docs/decisions/011-distribution-architecture.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md) — why both consumption models exist.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the tested version contract.
