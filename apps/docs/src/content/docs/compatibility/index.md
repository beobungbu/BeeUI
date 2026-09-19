---
title: Compatibility
description: Tested BeeUI React, React Native, Expo, Web and styling/runtime combinations.
---

Start with [Current tested versions](/docs/compatibility/current/). That table is
generated from BeeUI's machine-checked compatibility snapshot, so its Node/React/RN/Expo/
RNW/Uniwind/Tailwind/native-infrastructure pins cannot drift independently from the
canonical contract.

**Prerequisites:** none — check this page before you pin dependency versions, not after.

- [Native (RN / Expo)](/docs/compatibility/native/)
- [Web](/docs/compatibility/web/)

## Toolchain and native infrastructure pins

These values are repeated here intentionally because the public compatibility surface is
machine-checked against the canonical repository matrix. They are **tested points**, not
promises that adjacent versions are supported.

| Dependency | Tested / pinned value |
| --- | --- |
| Node.js repository toolchain | `24.13.1` |
| pnpm | `10.15.0` |
| Expo SDK | `~57.0.0` |
| `react-native-safe-area-context` in Showcase | `~5.7.0` |
| `react-native-teleport` in `@beemvp/beeui-ui` | `1.1.13` |
| `react-native-teleport` in Showcase | `~1.1.13` |

The tested point and the declared peer range are different concepts. BeeUI narrows public
support when a combination lacks evidence rather than assuming semver compatibility. RN
0.86.x is the current stable native line; historical/excluded rows remain in the full
[compatibility authority](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md).

## Declared peer dependencies

This is the complete `peerDependencies` set `@beemvp/beeui-ui` declares (`npm view @beemvp/beeui-ui peerDependencies`) — every one of these, not only the toolchain/runtime rows above:

| Peer | Range | Required or optional |
| --- | --- | --- |
| `react` | `>=19 <20` | Required |
| `react-native` | `>=0.86.0 <0.87.0` | Required |
| `tailwindcss` | `>=4 <5` | Required |
| `uniwind` | `>=1.10.1 <2` | Required |
| `react-native-safe-area-context` | `>=5 <6` | Required |
| `react-native-teleport` | `>=1.1 <2` | Required |
| `react-dom` | `>=19 <20` | Optional — Web only |
| `@gorhom/bottom-sheet` | `>=5.2 <6` | Optional — native `Sheet` |
| `react-native-gesture-handler` | `>=2.32 <3` | Optional — native `Sheet` |
| `react-native-reanimated` | `>=4.5 <5` | Optional — native `Sheet` |
| `react-native-worklets` | `>=0.10 <1` | Optional — native `Sheet` (Reanimated v4's own peer) |
| `@react-native-community/datetimepicker` | `>=9.1 <10` | Optional — native `DatePicker`/`DateTimePicker` |

Install only the optional peers your application actually uses; a missing optional peer only
breaks the specific component it backs, not the rest of BeeUI.
