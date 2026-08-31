---
title: Expo
description: Run BeeUI inside an Expo project.
---

BeeUI's own Showcase app runs on Expo SDK 57 with React Native 0.86.2 and React 19.2.3.

## Preview the Showcase on Expo

The Showcase app (`apps/showcase`) is the reference Expo integration. Run it on a device,
simulator, or emulator:

```bash
corepack enable
pnpm install --frozen-lockfile

pnpm --filter @beeui/showcase start      # Expo dev server + QR (Expo Go, over the air)
pnpm --filter @beeui/showcase ios        # iOS Simulator (macOS + Xcode)
pnpm --filter @beeui/showcase android     # Android emulator or attached device
```

`start` prints a QR code you can scan with Expo Go without any native toolchain. See
[Showcase & preview](/showcase/) for the full native-preview workflow, prebuild notes, and
the environments each path supports.

:::note[Content pending]
A standalone step-by-step guide for adding BeeUI to a *new* Expo project (config plugin
requirements, Metro/Uniwind wiring) is tracked for a follow-up docs content issue and will
be sourced from the Showcase app's setup once the public package surface publishes.
:::

See [Compatibility](/compatibility/) for the exact tested Expo/React Native/React version
combination.
