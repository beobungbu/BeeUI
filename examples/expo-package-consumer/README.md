# BeeUI Expo package consumer (#230)

R10.1 — a minimal Expo SDK 57 starter consuming `@beeui/ui` through
release-ready packed packages, matching `apps/showcase`'s tested Expo SDK 57
dependency set (`docs/compatibility-matrix.md`) without any Showcase-only
internals.

## Unpublished status

BeeUI is not published to npm (see `../README.md`). `setup.sh` packs
`@beeui/core`, `@beeui/tokens`, and `@beeui/ui` with `pnpm pack` and installs
those tarballs with `npm install`, plus Expo SDK 57's own runtime deps
(`expo`, `@expo/metro-runtime`, `react-native-web`, and BeeUI's native peers).

## Run it

```sh
# from the repo root, once:
pnpm build

cd examples/expo-package-consumer
bash setup.sh
bash bundle.sh    # headless `expo export`, no simulator/device
# or, for local interactive development:
npx expo start
```

## Compile vs. runtime evidence

`bundle.sh` runs `expo export --platform android,ios,web`, which is Expo's
own headless Metro export for all three platforms — no `expo prebuild`, no
simulator/device, and no native compile. That is the evidence this
starter's acceptance requires; a full native run (`expo run:ios` /
`expo run:android`) is a heavier, separate pass this minimal starter does
not attempt.

## What it demonstrates

`BeeUIProvider`/`SafeArea`, the OS light/dark color scheme flowing through
BeeUI's semantic theme tokens (high contrast is a device accessibility
setting the same tokens already respond to, not toggled in-app), forms
(`Input`/`Checkbox`), `Dialog`/`Select`/`Tooltip`, the native `Sheet`
adapter, `Table`, `Calendar`, `Toast` (`useToast`), and a responsive-layout
hook (`useWindowDimensions`) — see `App.tsx`.

## Acceptance evidence (2026-08-31, base `06bca3a`, Expo SDK 57 / RN 0.86.2)

```
$ bash bundle.sh
==> Exporting Expo bundles for Android, iOS, and Web (Metro, no simulator/device)
Starting Metro Bundler

Web Bundled 19549ms index.js (663 modules)
Android Bundled 24380ms index.js (1479 modules)
iOS Bundled 27986ms index.js (1467 modules)

› web bundles (3):
_expo/static/css/global-afada490a4958a8b950bc7751072524e.css (16KB)
_expo/static/css/global-d41d8cd98f00b204e9800998ecf8427e.css (0B)
_expo/static/js/web/index-1b315985f2ddbaec9f56a29f7f482c21.js (1.1MB)

› android bundles (1):
_expo/static/js/android/index-d9db04b3ee4020b4242960b63b6da99d.hbc (3.5MB)

› ios bundles (1):
_expo/static/js/ios/index-07c93542bb287eeafea5f62df2dc781d.hbc (3.5MB)

Exported: dist
OK: Expo export produced Android, iOS, and Web bundle output under dist/.
```
