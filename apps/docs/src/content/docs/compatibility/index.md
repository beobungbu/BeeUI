---
title: Compatibility
description: Tested BeeUI React, React Native, Expo, Web and styling/runtime combinations.
---

Start with [Current tested versions](/docs/compatibility/current/). That table is
generated from BeeUI's machine-checked compatibility snapshot, so its Node/React/RN/Expo/
RNW/Uniwind/Tailwind/native-infrastructure pins cannot drift independently from the
canonical contract.

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
