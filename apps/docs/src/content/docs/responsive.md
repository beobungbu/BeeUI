---
title: Responsive & mobile-first
description: Build BeeUI screens from narrow-phone defaults to medium and expanded layouts.
---

# Responsive & mobile-first

BeeUI starts from the **smallest supported logical phone width** and adds layout capability
as width becomes available. Desktop is an enhancement, not the default design that gets
shrunk later.

## Use the shared breakpoints

Read BeeUI breakpoint tokens instead of inventing a second screen taxonomy. On native,
responsive decisions typically use `useWindowDimensions()`; on Web, CSS/media-query
composition can express the same compact/medium/expanded policy. The production demo uses
one width contract to promote compact bottom navigation into a wider rail layout.

## Safe area and scrolling

`BeeUIProvider` measures safe areas; the app shell assigns each physical edge to the
`SafeArea` that actually touches it. Avoid double-insetting nested screens. Long content
belongs in a scroll container; code/data regions may scroll locally, but the page should
not require viewport-level horizontal scrolling.

## Stress the layout, not just width

Check narrow phones, short-height landscape, 200% Web zoom/large text, long localization,
RTL and keyboard-visible states. Fixed-height rows are exceptions that need an explicit
reason; text-bearing controls should be able to grow.

See the [Pattern library](/docs/patterns/reference/), [reference app](/demo/), and canonical
[responsive layout contract](https://github.com/beobungbu/BeeUI/blob/main/docs/responsive-layout.md).
BeeUI intentionally does not own your router, navigation information architecture, data
fetching or product-specific adaptive decisions.
