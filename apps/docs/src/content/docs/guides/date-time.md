---
title: Date & time
description: Pick, display and store dates with Calendar, DatePicker and DateTimePicker without a timezone day-shift bug.
---

**BeeUI's date values carry no timezone.** A `CalendarDate` is `{ year, month, day }` and a
`ClockTime` is `{ hour, minute }` — plain objects with no offset, no instant, and no hidden
`Date` inside. That is the whole design, and it exists to structurally eliminate the single
most common date-picker bug: a date-only value silently shifting a day because something
parsed it as UTC midnight.

Everything else follows from that. You control the value. You control the timezone, if you
need one. BeeUI controls the grid, the keyboard, the labels, and the platform presentation.

Three components:

| Component | Value type | Presentation |
| --- | --- | --- |
| `Calendar` | `CalendarDate \| null` | BeeUI's own grid, identical on every platform. |
| `DatePicker` | `CalendarDate \| null` | Web: `Calendar` in a `Popover`. Native: the OS system picker. |
| `DateTimePicker` | `{ date: CalendarDate; time: ClockTime } \| null` | Same split, plus a time part. |

For the generated prop and type inventory, use the
[Calendar](/docs/components/calendar/),
[DatePicker](/docs/components/date-picker/) and
[DateTimePicker](/docs/components/date-time-picker/) reference pages.

## Value semantics

```ts
import type { CalendarDate, ClockTime } from '@beemvp/beeui-core';

const dueDate: CalendarDate = { year: 2026, month: 9, day: 4 }; // month is 1–12
const reminder: ClockTime = { hour: 14, minute: 30 };           // 0–23, 0–59
```

- `month` is **1-based**. It is not a `Date` month index.
- Both types are timezone-free by construction. There is no field to put an offset in.
- `DateTimePicker` uses one coherent `{ date, time }` object, not two independently
  controlled props, so a date and a time can never drift out of sync mid-update.
- All three are **controlled**: `value` is required and may be `null`. Clearing differs by
  component: `DatePicker` and `DateTimePicker` emit `null` from `onValueChange` for an explicit
  clear, while `Calendar`'s callback is `(date: CalendarDate) => void` and fires only on a cell
  press — a `Calendar` clear affordance is the caller's own control.
- Single-date selection only. There is no range or multi-select value type, by design.

### Serialize to your backend

```ts
import { parseISODateString, toISODateString } from '@beemvp/beeui-core';

toISODateString({ year: 2026, month: 9, day: 4 }); // '2026-09-04'
parseISODateString('2026-09-04');                  // { year: 2026, month: 9, day: 4 }
parseISODateString('not-a-date');                  // null
```

`parseISODateString` splits the string itself and never calls `new Date(iso)` or
`Date.parse`, so it cannot inherit the UTC-midnight parsing bug. Round-tripping a date-only
value through these two functions is lossless in every timezone.

### Interop with `Date`

`toLocalDate` and `fromLocalDate` are the **only** sanctioned boundary between a BeeUI value
and a timezone-bearing `Date`:

```ts
import { clockTimeFromLocalDate, fromLocalDate, toLocalDate } from '@beemvp/beeui-core';

const local = toLocalDate({ year: 2026, month: 9, day: 4 }, { hour: 14, minute: 30 });
fromLocalDate(local);            // { year: 2026, month: 9, day: 4 }
clockTimeFromLocalDate(local);   // { hour: 14, minute: 30 }
```

`toLocalDate` constructs via the local-timezone `Date` constructor — never `Date.UTC` and
never ISO-`Z` parsing — so a date-only value always lands on local midnight of that *same*
calendar day. `fromLocalDate` reads the local getters for the reverse direction.

## Timezone ownership

BeeUI never stores, infers, or writes a timezone. If your product needs a specific IANA zone
that is not the device's local zone, composing that conversion is your application's job, at
your own boundary.

Practically:

| Question | Answer |
| --- | --- |
| Which timezone is a `CalendarDate` in? | None. It is a calendar day, like a birthday. |
| Which timezone does `toLocalDate` use? | The device's local zone, always, explicitly. |
| Can I make the picker operate in `Asia/Ho_Chi_Minh` while the device is elsewhere? | Convert at your own boundary before passing `value` in and after reading it out. BeeUI will not do it for you. |
| Where do business-calendar rules — holidays, fiscal periods, working days — live? | Your application. Express them as an `isDateDisabled` predicate. |
| What should I store? | For a date-only concept, store the ISO date string. Storing an instant for a birthday or a due date is the bug this design prevents. |

## Locale and i18n

`locale` is **explicit-only**. There is no ambient device or browser locale detection, and no
new context or store is introduced for it. Omitted, `locale` falls back to `'en-US'`.

```tsx
import { DatePicker, type CalendarDate } from '@beemvp/beeui-ui';
import * as React from 'react';

export function DueDateField() {
  const [value, setValue] = React.useState<CalendarDate | null>(null);
  return <DatePicker locale="vi-VN" onValueChange={setValue} value={value} />;
}
```

Month names, weekday headers, the formatted trigger text, and AM/PM labels all come from the
JS engine's built-in `Intl`. BeeUI bundles **no** locale database, so label coverage is
exactly what your runtime's ICU data provides. Override the display entirely with
`formatValue` when your product has its own format rule.

RTL locales mirror the grid and resolve the previous/next navigation glyphs through BeeUI's
existing direction resolver — there is no second direction read to configure.

## Week start

`weekStartsOn` uses the ISO convention: `1` is Monday through `7` is Sunday. Resolution
order:

1. The explicit `weekStartsOn` prop.
2. The week info the runtime derives from an explicitly provided `locale`, when the runtime
   supports that lookup (feature-detected, not assumed).
3. A static Monday (`1`) fallback.

So `locale="en-US"` yields a Sunday-first grid on a runtime with week-info support, while
`locale="en-GB"` yields Monday-first — same language, different grid. Pass `weekStartsOn`
explicitly when you need the grid pinned regardless of locale.

## DST edge behavior

Because `CalendarDate` and `ClockTime` are wall-clock values, daylight-saving transitions
cannot shift the selected *day*. Two edges are worth knowing, both verified against a real
DST rule engine rather than asserted:

| Case | Behavior |
| --- | --- |
| Ordinary time on a transition date | Round-trips unchanged through `toLocalDate` / `fromLocalDate`. |
| A time inside the spring-forward gap (a wall clock hour that does not exist) | The platform `Date` normalizes it forward to the next valid instant — a `02:30` becomes `03:30` — exactly like a browser time input or an OS clock app on the same platform. The **day is still correct**; only the in-gap hour moves. |
| The ambiguous fall-back hour that occurs twice | The wall-clock hour and minute round-trip to the same values. Which of the two real instants the platform chose is not stored or inferred by BeeUI. |

If your product must resolve an ambiguous or non-existent local time to a specific instant,
that resolution belongs in your application's timezone layer, not in the picker.

## Controlled state and validation

All three components are controlled and integrate with `Field` using the same pattern as
`Input`: the component ORs its own `disabled`/`invalid` with the field's, and derives its
accessible label, hint, and label association from the field.

```tsx
import { DateTimePicker, Field, type DateTimePickerValue } from '@beemvp/beeui-ui';
import { compareCalendarDates } from '@beemvp/beeui-core';
import * as React from 'react';

const MIN = { year: 2026, month: 1, day: 1 };

export function AppointmentField() {
  const [value, setValue] = React.useState<DateTimePickerValue | null>(null);
  const tooEarly = value !== null && compareCalendarDates(value.date, MIN) < 0;

  return (
    <Field
      description="We will send a reminder the morning of your appointment."
      error={tooEarly ? 'Pick a date in 2026 or later.' : undefined}
      invalid={tooEarly}
      label="Appointment"
      required
    >
      <DateTimePicker
        locale="en-GB"
        min={MIN}
        onValueChange={setValue}
        value={value}
      />
    </Field>
  );
}
```

BeeUI introduces **no second validation engine**. `min`, `max`, and the single
`isDateDisabled` predicate constrain what the grid lets you pick; computing `invalid` and the
message from the selected value stays yours, passed into the enclosing `Field` exactly as for
any other input.

`isDateDisabled` is a predicate rather than a list because a predicate is a strict superset —
closing over a set of ISO date strings is one line:

```ts
import { toISODateString, type CalendarDate } from '@beemvp/beeui-core';

const blackout = new Set(['2026-12-24', '2026-12-25']);
const isDateDisabled = (date: CalendarDate) => blackout.has(toISODateString(date));
```

Other state notes:

- `visibleMonth` / `defaultVisibleMonth` control the displayed month independently of the
  selection, so "jump to today" and "open on the deadline month" are yours to drive.
- `open` / `defaultOpen` / `onOpenChange` follow the standard controlled/uncontrolled overlay
  pattern, because BeeUI owns the Web presentation.
- `readOnly` keeps the control focusable and announced but blocks opening and clearing;
  `disabled` removes it from interaction entirely. They are not the same state.
- `clearable` defaults to `true`; clearing emits `null`.

## Platform behavior

| Aspect | Web | iOS / Android |
| --- | --- | --- |
| `Calendar` | BeeUI's own grid | BeeUI's own grid — identical component, every platform |
| `DatePicker` / `DateTimePicker` surface | `Calendar` (and the time control) inside a `Popover`, at every viewport width | The OS system picker |
| Time entry | Digit fields for hour and minute, plus an AM/PM control when the resolved locale is 12-hour | The same OS picker in its time or datetime mode |
| Value contract | Identical | Identical |
| Overlay props (`placement`, `align`, `sideOffset`, `flip`, `shift`, `collisionPadding`, `closeOnOutsidePress`, `direction`) | Honored | **Ignored** — the OS owns its own presentation |

The native picker import is isolated to native-only files, so it never reaches the Web
bundle. The rendered UI differs on purpose; the public value contract does not. `Dialog`
remains available for application-composed flows around a bare `Calendar`, but it is not an
automatic picker presentation mode.

## Accessibility

- **Web keyboard** follows the date-picker grid pattern: `ArrowLeft`/`ArrowRight` move a day,
  `ArrowUp`/`ArrowDown` move a week, `PageUp`/`PageDown` move a month,
  `Shift+PageUp`/`Shift+PageDown` move a year, `Home`/`End` move to the first/last day of the
  focused week, `Enter`/`Space` selects, and `Escape` closes the enclosing popover through the
  existing dismissal contract rather than a bespoke handler.
- **Focus restoration** returns to the picker trigger on close, via the same overlay contract
  every other BeeUI anchored overlay uses.
- **Day cells** expose grid and gridcell semantics on Web, and on native carry an accessible
  label containing the full date plus today, selected, and disabled state — state is never
  conveyed by color alone.
- **Touch targets** use the shared semantic touch-target token, not a bespoke pixel constant,
  so they follow density and large-text settings.
- Give the picker a name: either wrap it in a `Field` with a `label`, or pass
  `accessibilityLabel`. Override the month navigation labels with
  `previousMonthAccessibilityLabel` / `nextMonthAccessibilityLabel` when your app is
  localized.

## Build your own surface

`Calendar` is usable standalone, and the calendar arithmetic is exported as pure functions
with no React, React Native, or DOM dependency — so a custom month strip, an availability
heatmap, or a server-side computation can reuse exactly the same logic the grid uses:

```ts
import {
  addCalendarDays,
  clampCalendarDate,
  getCalendarMonthGrid,
  isCalendarDateDisabled,
} from '@beemvp/beeui-core';

const weeks = getCalendarMonthGrid({ month: 9, weekStartsOn: 1, year: 2026 });
const nextWeek = addCalendarDays({ year: 2026, month: 9, day: 4 }, 7);
const bounded = clampCalendarDate(nextWeek, { year: 2026, month: 1, day: 1 }, null);
const blocked = isCalendarDateDisabled(bounded, { min: { year: 2026, month: 9, day: 1 } });
```

`getCalendarMonthGrid` returns one array per week of exactly seven cells, including the
leading and trailing days borrowed from adjacent months (flagged `isCurrentMonth: false`), so
every week is complete. It is not padded to a fixed row count — expect five or six weeks.

## Limitations and what stays yours

- **No range or multi-date selection**, and no range value type.
- **No timezone conversion, no IANA zone handling, no instant arithmetic.** Yours.
- **No business-calendar rules** — holidays, fiscal calendars, working-day math. Express them
  as `isDateDisabled`, compute them yourself.
- **No bundled locale data.** Label quality is your runtime's `Intl`/ICU coverage. Week-start
  derivation from locale is feature-detected and falls back to Monday.
- **No ambient locale detection.** Pass `locale` explicitly or accept `'en-US'`.
- **No third-party date library.** The arithmetic is a small, dependency-free Gregorian
  implementation; if you need calendars other than Gregorian, that is outside BeeUI.
- **No time-wheel component on Web.** Time entry is digit fields plus an AM/PM control.
- **Overlay geometry props are Web-only** and silently ignored on native, where the OS owns
  presentation.
- **Evidence boundary:** BeeUI's own selection, dismissal, `Field` integration, and value
  round-trip on the native path are proven by deterministic tests against the native picker
  boundary. The OS picker's own on-screen rendering and gesture handling are not covered by
  that evidence class. Web keyboard, presentation, and dismissal behavior are covered by real
  browser interaction evidence. Read [Compatibility](/docs/compatibility/native/) for how
  BeeUI names evidence classes.

## Related

- [Calendar reference](/docs/components/calendar/) · [DatePicker reference](/docs/components/date-picker/) · [DateTimePicker reference](/docs/components/date-time-picker/)
- [Accessibility](/docs/accessibility/) and [RTL & localization](/docs/accessibility/rtl/)
- [Compatibility](/docs/compatibility/) — the optional native picker peer range.
- [Troubleshooting](/docs/guides/troubleshooting/) — missing native module and overlay symptoms.

## Canonical sources

- [ADR-008: Date/time architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/008-datetime-architecture.md)
- [Calendar date utilities](https://github.com/beobungbu/BeeUI/blob/main/packages/core/src/utils/calendar-date.ts)
- [Anchored overlays](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md)
- [Component behavior catalog](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)
