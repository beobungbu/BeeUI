# BeeUI package consumer compatibility report

> **Status:** public release-candidate compatibility evidence.
> **Packages under test:** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`; `@beemvp/beeui-cli` is published in the same lockstep release group and is verified separately by the release/CLI smoke gates.

<!-- release-status:generated:start — written by `pnpm release-status:generate`; do not hand-edit between these markers. -->
BeeUI `0.86.2-rc.3` is public on npm under the opt-in `next` dist-tag (observed 2026-09-25T06:25:18.371Z). `latest` currently resolves to `0.86.2-rc.3` and lags `next` until the owner moves it for all four packages.
<!-- release-status:generated:end -->

This report does not widen any promise beyond `docs/compatibility-matrix.md` and the peer ranges declared by `packages/ui/package.json`.

## Public package verification

Post-publication registry observation on 2026-09-24T09:02:17Z verified all four `0.86.2-rc.3` versions are public and all four `next` tags resolve to `0.86.2-rc.3`. The owner then moved `latest` for all four packages; the observation at 2026-09-24T09:27:49Z recorded `latest` → `0.86.2-rc.3` for all four, with an untagged install resolving `0.86.2-rc.3`. Stable `0.86.2` has not been published. A clean consumer installed `@beemvp/beeui-ui`, `@beemvp/beeui-core` and `@beemvp/beeui-tokens` at `0.86.2-rc.3`, ran `npx @beemvp/beeui-cli@0.86.2-rc.3 --help` and `list`, and `npm audit signatures` verified 227 registry signatures and 59 attestations.

The exact registry integrity/shasum/unpacked-size evidence and release lineage are recorded in `docs/rc-candidate.md`. The release pipeline separately verifies canonical packed artifacts and clean consumer boundaries without monorepo/workspace fallback.

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

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

Registry publication is also a separate evidence class: a successful stage command is not proof that the npm-side staged package was approved and public. The post-publication observation in `docs/rc-candidate.md` is the authority for that state.

## Machine-readable evidence contract

Parsed by `scripts/check-distribution-policy.mjs`. Version pins must equal the compatibility-matrix snapshot; peer promises must equal `packages/ui/package.json`; clean-consumer script paths must exist. This block no longer authors a candidate version or a publication boolean — `packages/ui/package.json` is the single authored lockstep version and publication state is derived from `docs/registry-observation.json`; authoring `candidateVersion` or `published` here again is rejected with an actionable error.

```json consumer-compatibility
{
  "packageSet": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
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
- immutable candidate and registry evidence: `docs/rc-candidate.md`
- exact compatibility matrix: `docs/compatibility-matrix.md`
- CLI/source-ownership authority: `docs/registry-cli.md`

This report is evidence documentation only; it performs no registry mutation.
