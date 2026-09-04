---
title: Core reference
description: Public values and types exported by @beemvp/beeui-core.
---

:::caution[Generated file]
Do not hand-edit this page. It is written by `scripts/public-reference.mjs` from
`docs/public-surface.inventory.json`, so it lists exactly the surfaces the #473 ownership
gate routes here. Prose lives in `docs/reference.content.json`.
:::

`@beemvp/beeui-core` holds the platform-free logic the components are built on: calendar-date arithmetic, anchored-overlay positioning, and the overlay-runtime primitives. It has no React dependency and renders nothing.

Most applications never import it directly — the components already do. Reach for it when you are building a surface BeeUI does not provide and you want the same date semantics or positioning maths behind it, which is why most of this surface is classified `advanced-consumer` rather than `consumer`.

`cn` is the exception: it is ordinary consumer API for merging class strings. The calendar-date utilities are the same ones [Dates and times](/docs/guides/date-time/) documents behaviourally.

## Values (25)

| Name | Classification | Source |
| --- | --- | --- |
| `addCalendarDays` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `addCalendarMonths` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `addCalendarYears` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `clampCalendarDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `clockTimeFromLocalDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `cn` | normal-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `compareCalendarDates` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `constrainOverlayViewportToKeyboard` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `createOverlayDismissStack` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `fromLocalDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `getCalendarDayOfWeek` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `getCalendarMonthGrid` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `getDaysInMonth` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `getSafeAreaCollisionPadding` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `isCalendarDateDisabled` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `isCalendarDateWithinRange` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `isLeapYear` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `isSameCalendarDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `isValidCalendarDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `mergeOverlayCollisionPadding` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `parseISODateString` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `resolveAnchoredOverlayPosition` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `toISODateString` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `toLocalDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `windowRectToHostRect` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |

## Types (20)

| Name | Classification | Source |
| --- | --- | --- |
| `AnchoredOverlayAlign` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayAvailableSpace` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayCollisionPadding` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayDirection` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayInsets` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayOverflow` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayPlacement` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayPosition` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlayRect` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `AnchoredOverlaySize` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `CalendarDate` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `CalendarDateDisabledOptions` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `CalendarMonthGridDay` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `CalendarMonthGridOptions` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `CalendarWeekStartsOn` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `ClockTime` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `OverlayDismissHandler` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `OverlayDismissReason` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `OverlayDismissStack` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
| `ResolveAnchoredOverlayPositionOptions` | advanced-consumer | [`packages/core/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/index.ts) |
