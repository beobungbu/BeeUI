# @beeui/showcase

The executable BeeUI demo surface. One Expo app renders the **real** BeeUI public
contract — the same `@beeui/ui` components a consumer receives — across Web, iOS, and
Android from a single source tree. It is the app referenced throughout the docs and the
one BeeUI dogfoods.

The home screen mounts one inspection surface at a time (navigation is local React state;
the app owns no router):

- **Components** — the interactive component gallery (foundation, forms, feedback,
  overlays, selection, navigation, disclosure, data, and application composition),
  including Table/DataTable, Select, Calendar, DatePicker, and DateTimePicker demos.
- **Theme & tokens** — semantic color/typography/sizing/elevation/focus/motion inspection
  with Brand A/B and light/dark/high-contrast switching.
- **Patterns** — the 37-screen production Pattern Gallery across Authentication +
  Onboarding, Dashboard + Finance, Commerce + Social, and Account + Settings.
- **Runtime acceptance / stress / Dynamic Type / Localization stress** — deterministic
  native-oriented fixtures used for simulator/emulator smoke and evidence capture. These
  render on Web too, but they exist for native runtime QA.

> **Unpublished status.** BeeUI is pre-1.0 and unpublished. No `@beeui/*` package or the
> `beeui` CLI is on npm, and there is no `v1.0.0` tag or GitHub Release yet. This app is
> built from in-repo workspace source; it never runs `npm install @beeui/ui`. The home
> screen shows this status inline alongside the build identity.

## Prerequisites

Run everything from the repository root through the pinned toolchain (see
`docs/compatibility-matrix.md`): Node `24.13.1`, `corepack enable`, then
`pnpm install --frozen-lockfile`. The internal workspace packages compile straight from
`src/` via Metro (see `metro.config.js`), so no package build step is required to run the
Showcase.

## Web showcase

BeeUI targets Web through React Native Web. The Web showcase is a deterministic static
export deployable to any static host.

```bash
# Static production export → apps/showcase/dist-web/
pnpm --filter @beeui/showcase build:web

# Local iterative development (Metro dev server on the Web target)
pnpm --filter @beeui/showcase web
```

`build:web` runs `expo export --platform web` and writes a self-contained
`dist-web/` (an `index.html`, a hashed JS bundle, and the compiled Uniwind/Tailwind CSS).
Serve that directory with any static file server or upload it to any static host — there
is no server-side runtime.

```bash
# Example: preview the exported build locally
npx serve apps/showcase/dist-web
```

### Build identity

The home screen renders a build-identity row (`testID="showcase-build-identity"`) so any
Web deployment or native preview is traceable to an exact source revision. The app version
comes from `app.json`; the commit SHA is injected at export time through an Expo public
env var and defaults to a `local build` label when unset:

```bash
EXPO_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD) \
  pnpm --filter @beeui/showcase build:web
```

## Native preview path

Preview the same Showcase on a real device, simulator, or emulator. Pick the workflow that
matches your environment.

### 1. Expo Go / dev server + QR (fastest, no native build)

```bash
pnpm --filter @beeui/showcase start
```

Metro prints a QR code. Scan it with the Expo Go app (Android) or the Camera app (iOS) on
a device on the same network to load the JS bundle over the air. This requires no Xcode or
Android SDK. Native modules the Showcase depends on
(`react-native-gesture-handler`, `react-native-reanimated`,
`@react-native-community/datetimepicker`, `@gorhom/bottom-sheet`) are already part of the
Expo SDK 57 runtime, so Expo Go can render every surface.

### 2. Simulator / emulator (local native build)

Builds and installs a native debug app; requires the platform toolchain (Xcode for iOS,
Android Studio/SDK for Android).

```bash
pnpm --filter @beeui/showcase ios       # iOS Simulator (macOS + Xcode)
pnpm --filter @beeui/showcase android    # Android emulator or attached device
```

These run `expo run:ios` / `expo run:android`, which invoke `expo prebuild` to generate
the native projects on first run. If a prebuild goes stale after native dependency
changes, regenerate it with `npx expo prebuild --clean` from `apps/showcase`.

### 3. Verify native Metro bundling (evidence, no device)

Proves the exact source bundles for each native platform without a device or the native
toolchain — the reusable release-acceptance evidence path:

```bash
pnpm --filter @beeui/showcase bundle:ios       # → dist-ios/  (Hermes bytecode bundle)
pnpm --filter @beeui/showcase bundle:android    # → dist-android/
```

Each runs `expo export` for that platform and emits a Hermes `.hbc` bundle plus
`metadata.json`. A clean export is the deterministic proof that BeeUI's real source
resolves and bundles for native.

### Supported environments and limitations

- **iOS Simulator build** requires macOS with Xcode. **Android** requires the Android SDK
  and an emulator or attached device.
- **Expo Go** loads the JS over the network and needs no native toolchain, but the device
  and dev machine must share a network. Use `--tunnel` (`expo start --tunnel`) when they
  cannot.
- iOS `pageSheet`/`formSheet` `Dialog` presentation is **experimental** — see
  [`docs/native-verification.md`](../../docs/native-verification.md) and the docs
  Compatibility → Native page.
- Native **compile/bundle is not runtime**: bundling proves resolution and packaging, not
  live interaction (safe area, keyboard, VoiceOver/TalkBack, hardware Back). Those are
  covered by the runtime fixtures here and the Maestro flows under `runtime-smoke/maestro/`.

## Scripts

| Script | What it does |
| --- | --- |
| `start` | Expo dev server + QR (native preview over the air) |
| `web` | Metro dev server on the Web target |
| `build:web` | Static Web export → `dist-web/` |
| `ios` / `android` | Local native debug build + install (simulator/emulator/device) |
| `bundle:ios` / `bundle:android` | Native Metro bundle export (evidence) |
| `typecheck` | `tsc` over the app |
| `test` | Jest component/integration suite |

## Related

- Docs site: `apps/docs` (Getting started → Web, and Showcase & preview).
- Web support contract: `docs/web-support-contract.md`.
- Native verification: `docs/native-verification.md` and `docs/native-runtime-smoke.md`.
- Component and pattern inventories: `docs/component-reference.md`, `docs/pattern-library.md`.
