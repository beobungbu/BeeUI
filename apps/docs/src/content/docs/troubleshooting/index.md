---
title: Troubleshooting
description: Diagnose BeeUI setup, safe-area, theme, Metro, overlay, data-control and Registry problems by symptom.
---

# Troubleshooting

## Imports or versions do not resolve
Check [Compatibility](/docs/compatibility/) and remember public npm/CLI distribution is not
available yet. In this repository use the documented workspace/packed-consumer paths.

## Provider/overlay/toast behavior is missing
Mount one application-root `BeeUIProvider`. Nested providers reuse the supported root
runtime; do not create unrelated roots and expect them to arbitrate one global Escape/back
event.

## Content is double-inset or under system UI
Assign each edge to the `SafeArea` that actually touches it. A `Screen`, header or bottom
bar does not secretly own all insets. See [Provider & safe area](/docs/getting-started/provider-safe-area/).

## Web looks unstyled
Verify the token theme CSS plus Tailwind/Uniwind imports in [Web onboarding](/docs/getting-started/web/).

## Metro/native module cannot resolve
Compare your peer/native dependencies to [Compatibility](/docs/compatibility/). After
adding/changing a native dependency, rebuild the native app; a JavaScript refresh cannot
install native code.

## Popover/Select/Dropdown placement or focus is wrong
Check that the app root/provider and modal-local overlay hosts are intact; avoid moving
interactive children out of their documented composition. See [anchored overlays](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md).

## Dialog/sheet differs by platform
Read the component limitation plus native compatibility evidence. iOS sheet presentation
has explicitly qualified support; do not infer it from Web behavior.

## Table/date controls overflow
Start with the [responsive guide](/docs/responsive/) and component reference. Keep page
horizontal scrolling off; give genuinely wide data/code its own bounded scroll region.

## Registry verify/doctor fails
Run the repository-local CLI exactly as documented in [CLI & source ownership](/docs/cli/)
and inspect the reported source/dependency drift before updating files.

## Web keyboard behavior is wrong
Use [Keyboard & focus](/docs/accessibility/keyboard-focus/) and test real Tab/Escape flows.

Canonical behavior sources: [registry CLI](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md), [components](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md), and [Web support](https://github.com/beobungbu/BeeUI/blob/main/docs/web-support-contract.md).
