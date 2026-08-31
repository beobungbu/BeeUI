# BeeUI bare React Native consumer (#232)

R10.3 — a true bare React Native starter (scaffolded via the official
`@react-native-community/cli`, the same tool `npx react-native init` uses),
separate from `scripts/verify-bare-consumer.sh`'s ephemeral CI-cache
generation: this directory's `App.tsx`/`index.js`/`metro.config.js`/`global.css`
are checked into git and maintained, even though the generated native
`android`/`ios` project tree (`app/`) is not (see "Why `app/` isn't
committed" below).

## Unpublished status

BeeUI is not published to npm (see `../README.md`). `setup.sh` packs
`@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui` with `pnpm pack` and installs
those tarballs with `npm install`, plus the same pinned native peers
`scripts/verify-bare-consumer.sh` uses (uniwind, tailwindcss,
react-native-safe-area-context, react-native-teleport,
@react-native-community/datetimepicker, @gorhom/bottom-sheet,
react-native-reanimated, react-native-gesture-handler,
react-native-worklets).

## Run it

```sh
# from the repo root, once:
pnpm build

cd examples/bare-rn-consumer
bash setup.sh    # react-native init -> overlay src-overrides/ -> pack + npm install
bash bundle.sh   # Metro bundle, both platforms, headless (no simulator/device)
```

## Why `app/` isn't committed

A bare RN native project tree is hundreds of generated files (Gradle
wrapper, Xcode project, pod configuration) that are mechanically reproduced
from a pinned `@react-native-community/cli`/React Native version. Committing
that tree to a public monorepo for a *minimal* starter would dwarf the
actual BeeUI-relevant source with regenerable boilerplate. `setup.sh`
regenerates it deterministically (pinned `CLI_VERSION`/`RN_VERSION`) and then
overlays this starter's real, reviewable source from `src-overrides/`.

## Compile vs. runtime evidence

This starter's acceptance is a **headless Metro bundle** for Android and
iOS (`bundle.sh`) — proving BeeUI's packed packages resolve and bundle
through Metro with no Expo runtime. It does **not** run `./gradlew
assembleDebug` or `xcodebuild` (full native compile) or drive a
simulator/device (runtime interaction, e.g. actually pressing Android Back
to dismiss the Sheet). `scripts/verify-bare-consumer.sh` already proves
those heavier native-compile gates in CI for the equivalent app shape; this
starter is scoped to the buildable-artifact evidence class.

## What it demonstrates

`BeeUIProvider`/`SafeArea`, forms (`Input`/`Checkbox`), anchored overlays
(`Dialog`/`Select`/`Tooltip`), the native `Sheet` adapter
(`@gorhom/bottom-sheet`), `Table`, `Calendar`/`DateTimePicker`, and a
`BackHandler` listener wired to close the Sheet on Android Back (compile/import
evidence — see above) — see `src-overrides/App.tsx`.

## Acceptance evidence (2026-08-31, base `06bca3a`, RN 0.86.2)

```
$ bash bundle.sh
==> Bundling bare React Native Android
LOG:Writing bundle output to: build/index.android.bundle
LOG:Done writing bundle output
==> Bundling bare React Native iOS
LOG:Writing bundle output to: build/main.jsbundle
LOG:Done writing bundle output
OK: both Android and iOS Metro bundles produced non-empty output.
```

`app/build/index.android.bundle` and `app/build/main.jsbundle` were each
~2.3 MB of real, non-empty Metro bundle output.
