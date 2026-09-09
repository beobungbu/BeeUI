# BeeUI package consumer compatibility report

> **Status:** public release-candidate compatibility evidence.
> **Snapshot:** 2026-09-09.
> **Packages under test:** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`; candidate version `0.86.2-rc.1` today.

BeeUI `0.86.2-rc.1` is publicly published under the npm `next` dist-tag. This report records consumer compatibility evidence for the three library packages. `@beemvp/beeui-cli` is published in the same release group and is verified separately by the release/CLI smoke gates.

This report does not widen any promise beyond `docs/compatibility-matrix.md` and the peer ranges declared by `packages/ui/package.json`.

## Public package verification

The release pipeline verifies canonical packed artifacts before publication and clean consumer boundaries without monorepo/workspace fallback. Public RC availability is now additional registry evidence on top of that package-boundary proof.

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

Stable `latest` is intentionally not promoted yet.

## Clean-consumer evidence

| Consumer | Executable authority | Strongest maintained evidence |
| --- | --- | --- |
| Bare React Native | `scripts/verify-bare-consumer.sh` | isolated package install, strict TypeScript, Android/iOS Metro bundles, native compile lanes |
| Web (Vite + React Native Web) | `scripts/verify-web-consumer.sh` | isolated package install, Vite production build, Chromium interaction + axe coverage |
| Expo SDK 57 | `scripts/verify-expo-consumer.sh` | isolated package install, TypeScript and Expo Metro export for Android/iOS/Web |

The Showcase remains a workspace development/runtime surface, not a clean consumer.

## Compatibility rows

| Dependency | Tested point | Declared package promise / boundary | Evidence note |
| --- | --- | --- | --- |
| React | `19.2.3` | `>=19 <20` | type, bundle/compile and consumer evidence |
| React DOM | `19.2.3` | `>=19 <20`, optional for BeeUI | Web consumer/browser evidence |
| React Native | `0.86.2` | `>=0.86.0 <0.87.0` | bare consumer and native evidence; 0.87 excluded by recorded compile evidence |
| Expo SDK | `~57.0.0` | app-level tested point | Expo clean consumer/export evidence |
| Node | `24.13.1` | repo exact; CLI `>=24` | release and CLI toolchain evidence |
| React Native Web | `0.21.0` | bundler-level tested point | Vite + Expo Web evidence |
| Tailwind CSS | `4.3.3` | `>=4 <5` | token/style and consumer build evidence |
| Uniwind | `1.10.1` | `>=1.10.1 <2` | package/style and consumer build evidence |
| `react-native-safe-area-context` | `5.7.0` | `>=5 <6` | native/bundle evidence |
| `react-native-teleport` | `1.1.13` | `>=1.1 <2` | overlay package/native evidence |
| `@react-native-community/datetimepicker` | `9.1.0` | `>=9.1 <10`, optional | deterministic/type evidence; native runtime claim remains bounded |
| `@gorhom/bottom-sheet` | `5.2.14` | `>=5.2 <6`, optional | deterministic + native compile evidence; runtime remains separately gated |
| `react-native-reanimated` | `4.5.1` | `>=4.5 <5`, optional | deterministic + native compile evidence |
| `react-native-gesture-handler` | `2.32.0` | `>=2.32 <3`, optional | deterministic + native compile evidence |
| `react-native-worklets` | `0.10.1` | `>=0.10 <1`, optional | deterministic + native compile evidence |

Exact tested pins and evidence sources remain authoritative in `docs/compatibility-matrix.md`.

## Evidence boundaries

Current Web evidence is centered on React Native Web `0.21.0`, Vite and Expo/Metro Web, with Chromium browser interaction. Firefox, WebKit/Safari, Next.js/Webpack/Parcel, SSR and SSG are not implied unless a later compatibility record explicitly adds them.

Metro/bundle proof, native compilation and simulator/device interaction are separate evidence classes. Compile-only evidence must not be translated into runtime/accessibility claims. See `docs/release.md`, `docs/native-verification.md` and `docs/native-runtime-smoke.md`.

## Machine-readable evidence contract

Parsed by `scripts/check-distribution-policy.mjs`. Version pins must equal the compatibility-matrix snapshot; peer promises must equal `packages/ui/package.json`; clean-consumer script paths must exist; publication state must match `docs/dist-tag-policy.md`.

```json consumer-compatibility
{
  "published": true,
  "packageSet": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "candidateVersion": "0.86.2-rc.1",
  "cleanConsumerScripts": [
    "scripts/verify-bare-consumer.sh",
    "scripts/verify-web-consumer.sh",
    "scripts/verify-expo-consumer.sh"
  ],
  "versionPins": {
    "react": "19.2.3",
    "reactDom": "19.2.3",
    "reactNative": "0.86.2",
    "reactNativeWeb": "0.21.0",
    "node": "24.13.1",
    "tailwindcss": "4.3.3",
    "uniwind": "1.10.1"
  },
  "peerPromises": {
    "react": ">=19 <20",
    "react-dom": ">=19 <20",
    "react-native": ">=0.86.0 <0.87.0",
    "react-native-safe-area-context": ">=5 <6",
    "react-native-teleport": ">=1.1 <2",
    "@gorhom/bottom-sheet": ">=5.2 <6",
    "@react-native-community/datetimepicker": ">=9.1 <10",
    "react-native-reanimated": ">=4.5 <5",
    "react-native-gesture-handler": ">=2.32 <3",
    "react-native-worklets": ">=0.10 <1",
    "tailwindcss": ">=4 <5",
    "uniwind": ">=1.10.1 <2"
  }
}
```

## Release relationship

- channel/publication authority: `docs/dist-tag-policy.md`
- release/evidence authority: `docs/release.md`
- exact compatibility matrix: `docs/compatibility-matrix.md`
- CLI/source-ownership authority: `docs/registry-cli.md`

This report is evidence documentation only; it performs no registry mutation.
