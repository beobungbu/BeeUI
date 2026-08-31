---
title: Showcase & preview
description: Run the BeeUI Showcase on Web and preview it natively on iOS and Android.
---

The BeeUI Showcase (`apps/showcase`) is one Expo app that renders the **real** BeeUI
public contract — the same `@beeui/ui` components a consumer receives — across Web, iOS,
and Android from a single source tree. It is the app BeeUI dogfoods and the surface these
docs reference.

Its home screen mounts one inspection surface at a time (navigation is local React state;
the app owns no router):

- **Components** — the interactive gallery, including Table/DataTable, Select, Tooltip,
  Sheet, Calendar, DatePicker, and DateTimePicker.
- **Theme & tokens** — semantic tokens with Brand A/B and light/dark/high-contrast switching.
- **Patterns** — the 37-screen production Pattern Gallery.
- **Runtime / Dynamic Type / Localization stress** — deterministic fixtures for native
  runtime QA, large-text scaling, and RTL/long-content localization.

:::caution[Unpublished status]
BeeUI is pre-1.0 and unpublished. No `@beeui/*` package or the `beeui` CLI is on npm, and
there is no `v1.0.0` tag or GitHub Release. The Showcase is built from in-repo workspace
source; it never runs `npm install @beeui/ui`. Its home screen shows this status inline
next to the build identity.
:::

## Prerequisites

From the repository root, using the pinned toolchain (see
[Compatibility](/compatibility/)): Node `24.13.1`, then:

```bash
corepack enable
pnpm install --frozen-lockfile
```

The workspace packages compile straight from source through Metro, so no separate package
build step is needed to run the Showcase.

## Web (publish-ready static export)

```bash
# Iterative development (Metro dev server, Web target)
pnpm --filter @beeui/showcase web

# Deterministic static production export → apps/showcase/dist-web/
pnpm --filter @beeui/showcase build:web
```

`build:web` runs `expo export --platform web` and writes a self-contained `dist-web/`
(`index.html`, a hashed JS bundle, and the compiled Uniwind/Tailwind CSS). Deploy that
directory to any static host — there is no server-side runtime. Preview it locally with any
static file server, for example `npx serve apps/showcase/dist-web`.

### Build identity

The home screen renders a build-identity row so any deployment is traceable to an exact
revision. The version comes from `app.json`; inject the commit SHA at export time:

```bash
EXPO_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD) \
  pnpm --filter @beeui/showcase build:web
```

When the SHA is unset the row shows a `local build` label — no environment is assumed.

## Native preview (iOS / Android)

Preview the same Showcase on a real device, simulator, or emulator.

### Expo Go + QR (fastest, no native build)

```bash
pnpm --filter @beeui/showcase start
```

Metro prints a QR code. Scan it with Expo Go (Android) or the Camera app (iOS) on a device
sharing the dev machine's network to load the bundle over the air — no Xcode or Android SDK
required. Use `expo start --tunnel` when the device and machine cannot share a network.

### Simulator / emulator (local native build)

Requires the platform toolchain (Xcode for iOS on macOS; Android Studio/SDK for Android):

```bash
pnpm --filter @beeui/showcase ios       # iOS Simulator
pnpm --filter @beeui/showcase android    # Android emulator or attached device
```

These run `expo run:ios` / `expo run:android`, which invoke `expo prebuild` to generate
the native projects on first run. Regenerate with `npx expo prebuild --clean` if a prebuild
goes stale after native dependency changes.

### Verify native bundling (evidence, no device)

Proves the exact source resolves and bundles for each native platform without a device or
the native toolchain — the reusable release-acceptance evidence path:

```bash
pnpm --filter @beeui/showcase bundle:ios       # → dist-ios/  (Hermes bytecode bundle)
pnpm --filter @beeui/showcase bundle:android    # → dist-android/
```

## Supported environments and limitations

- iOS Simulator builds require macOS with Xcode; Android requires the Android SDK plus an
  emulator or device. Expo Go needs no native toolchain but requires network reachability.
- Native **bundle/compile is not runtime**: a clean bundle proves resolution and packaging,
  not live interaction (safe area, keyboard, VoiceOver/TalkBack, hardware Back). Those are
  exercised by the Showcase's runtime fixtures and the Maestro flows in the repository.
- iOS `pageSheet`/`formSheet` `Dialog` presentation is **experimental** — see
  [Compatibility → Native](/compatibility/native/).

Full command detail lives in the Showcase app README (`apps/showcase/README.md`).
