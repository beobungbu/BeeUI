---
title: Provider & safe area
description: How BeeUIProvider and SafeArea share ownership of system insets.
---

`BeeUIProvider` measures safe areas at the application root and synchronizes them to
Uniwind safe-area utilities by default, but never applies inset padding on its own.
`SafeArea` is the explicit, caller-owned boundary that opts a specific edge into system
inset padding. See the worked example on the [Getting started](/getting-started/) overview
page.

:::note[Content pending]
A full explanation of nested providers, overlay-runtime reuse, and Toast viewport scoping
is tracked for a follow-up docs content issue.
:::
