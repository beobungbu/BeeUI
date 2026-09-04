---
title: Current tested versions
description: Machine-sourced BeeUI compatibility snapshot.
---

# Current tested versions

This page is generated from the machine-checked snapshot in [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md). These are the **tested/pinned points**, not permission to widen a peer range beyond the package manifests.

| Surface | Tested / pinned |
| --- | --- |
| Node | `24.13.1` |
| pnpm | `10.15.0` |
| React | `19.2.3` |
| React DOM | `19.2.3` |
| React Native | `0.86.2` |
| React Native Web | `0.21.0` |
| Expo SDK | `~57.0.0` |
| Tailwind CSS | `4.3.3` |
| Uniwind | `1.10.1` |
| react-native-safe-area-context | `5.7.0` (UI dev), `~5.7.0` (Showcase) |
| react-native-teleport | `1.1.13` (UI dev), `~1.1.13` (Showcase) |

## Evidence scope

BeeUI distinguishes type/contract checks, bundle or native compile checks, browser interaction, and simulator/emulator/device runtime evidence. A stronger-sounding claim is never inferred from a weaker class. Current stable support centers on RN 0.86.x; RN 0.87 is outside the stable promise because retained native compatibility evidence found an upstream Android incompatibility.

For peer ranges and optional native dependencies, inspect [`packages/ui/package.json`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/package.json) and the [full compatibility authority](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md).
