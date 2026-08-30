---
title: Compatibility
description: Supported React Native, React, Node, Expo, Tailwind/Uniwind, and Web versions — and how the promise stays honest.
---

BeeUI states a version support promise only where real CI evidence backs it. The rule
behind every row below, set by [#129](https://github.com/beobungbu/BeeUI/issues/129):

> If a combination cannot be tested, narrow the public promise instead of documenting
> hope.

`docs/compatibility-matrix.md` in the repository is the locked, machine-checked source of
truth this page summarizes. `scripts/check-compatibility-matrix.mjs` (`pnpm compat:check`,
part of `pnpm typecheck` and therefore of every CI run) parses the pinned/tested versions
straight out of `package.json`, `.nvmrc`, the CI workflows, `packages/ui/package.json`,
and `apps/showcase/package.json`, and fails the build the moment this page's numbers drift
from what the repository actually pins — the same guard also checks this published page,
so the table below cannot go stale silently.

The repository itself builds and releases with Node `24.13.1` exact and pnpm `10.15.0`
exact (`package.json`'s `engines.node`/`packageManager`, `.nvmrc`, and every CI
workflow's `NODE_VERSION`/`PNPM_VERSION`) — the toolchain every version below was
actually tested against.

## Supported today

| Dependency | Tested / pinned version | Public peer promise | Status |
| --- | --- | --- | --- |
| React / React DOM | `19.2.3` exact | `>=19 <20` | Confirmed ([#133](https://github.com/beobungbu/BeeUI/issues/133)) |
| React Native | `0.86.2` exact (floor) | `>=0.86.0 <0.87.0` | Confirmed ([#130](https://github.com/beobungbu/BeeUI/issues/130)) |
| React Native 0.87.x | `0.87.1` tested and excluded | outside the promise | Excluded on real evidence ([#131](https://github.com/beobungbu/BeeUI/issues/131)) |
| Expo SDK | `~57.0.0` | not a declared peer (app-level) | Confirmed — only tested line |
| `react-native-web` | `0.21.0` exact | not a declared `@beeui/ui` peer (bundler responsibility) | Confirmed, two independent bundlers |
| Node (repo/release toolchain) | `24.13.1` exact | `engines.node: "24.13.1"` | Confirmed |
| Node (CLI tooling) | `24` only | none published yet | Narrowed ([#134](https://github.com/beobungbu/BeeUI/issues/134)) |
| Tailwind CSS | `4.3.3` exact | `>=4 <5` | Confirmed ([#135](https://github.com/beobungbu/BeeUI/issues/135)) |
| Uniwind | `1.10.1` exact | `>=1.10.1 <2` | Confirmed ([#135](https://github.com/beobungbu/BeeUI/issues/135)) |
| `react-native-safe-area-context` | `5.7.0` (`ui`) / `~5.7.0` (Showcase) | `>=5 <6` | Confirmed for RN 0.86; fails Android compile against RN 0.87 |
| `react-native-teleport` | `1.1.13` (`ui`) / `~1.1.13` (Showcase) | `>=1.1 <2` | Confirmed |

React Native `0.85` is dropped from the promise entirely (not merely untested) —
[#132](https://github.com/beobungbu/BeeUI/issues/132). See `docs/compatibility-matrix.md`
for every remaining row (Reanimated, Gesture Handler, Worklets, `@gorhom/bottom-sheet`,
`@react-native-community/datetimepicker`), including which ones stop at deterministic/
compile evidence rather than native runtime evidence.

## Deeper contracts

- **[Native (RN/Expo)](/compatibility/native/)** — the bare-consumer, Android/iOS
  native-compile, and RN 0.87 exclusion evidence.
- **[Web](/compatibility/web/)** — the Chromium-only browser boundary, the two supported
  bundlers, and the independent Vite consumer proof.

Evidence language (deterministic contract, bundle/compile, native runtime,
assistive-technology, clean-consumer, and so on) follows
`docs/beeui-1.0-evidence-classes.md`'s fixed vocabulary: this page never claims a
stronger class than what CI actually produced.

## How the promise is kept from drifting

- **`pnpm compat:check`** (`scripts/check-compatibility-matrix.mjs`) fails on any mismatch
  between `docs/compatibility-matrix.md`'s machine-readable snapshot, the repository's
  actual pins, and this published page — run as part of `pnpm typecheck`, so it runs on
  every pull request and on push to `main`.
- **Scheduled compatibility CI** ([#137](https://github.com/beobungbu/BeeUI/issues/137)):
  `ci.yml` and `runtime-native.yml` re-run the pinned RN `0.86.2` row nightly from a clean
  state; `compat-rn-0-87.yml` re-runs the excluded RN `0.87.1` row nightly so an upstream
  fix is caught automatically; `web-consumer.yml` runs the independent Web consumer row
  weekly in addition to every PR/push. Every scheduled or dispatched run records the exact
  checked-out SHA in its job summary.
- **Package manifests** (`packages/ui/package.json`'s `peerDependencies`/`engines`) are the
  single authority for the declared public range; this matrix documents and checks that
  promise, it never widens it on its own.

## Where this feeds into setup

Every "Getting started" path documents the exact pinned/tested versions above, not a wider
aspirational range: see [Expo](/getting-started/expo/),
[Bare React Native](/getting-started/bare-react-native/), and
[Web](/getting-started/web/).

## Out of scope for BeeUI 1.0

- Non-Chromium browser engines (Firefox, Safari/WebKit) — see
  [Web](/compatibility/web/).
- React Native `0.85` and `0.87.x` — see the table above.
- Node `22.x` CLI tooling — no CI job exists yet; revisit if a real need emerges.
- Server-side rendering / static generation of BeeUI content.
