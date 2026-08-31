import type { CalendarDate } from '@beemvp/beeui-core';
import { DEFAULT_CALENDAR_LOCALE } from './calendar-locale';

// Formatted-display helper for `DatePicker` (ADR-008, #173). Mirrors
// `calendar-locale.ts`'s `toFormattableUTCDate`/`Intl.DateTimeFormat` pattern exactly:
// `timeZone: 'UTC'` is always passed alongside a `Date.UTC`-anchored instant that never
// leaves this function, so the display string is never reinterpreted in the host's local
// timezone. This is a formatting-only helper, not the sanctioned `CalendarDate` ⇄ `Date`
// boundary (`toLocalDate`/`fromLocalDate` in `@beemvp/beeui-core`).

function toFormattableUTCDate(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

/**
 * Default `DatePicker` formatted-display value: a locale-appropriate medium date string
 * (e.g. `"Jan 15, 2026"` for `'en-US'`). Consumers may override via `DatePicker`'s
 * `formatValue` prop for a different `Intl.DateTimeFormatOptions` shape.
 */
export function getDatePickerFormattedValue(
  date: CalendarDate,
  locale: string = DEFAULT_CALENDAR_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    toFormattableUTCDate(date),
  );
}
