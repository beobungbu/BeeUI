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

// `DatePicker`'s own copy — the empty-value placeholder, distinct from
// `formatValue`/`Intl`, which only format an already-selected date — never
// localized with `locale`: setting `locale="vi-VN"` with no value still
// showed the English "Select a date". A small built-in dictionary (matching
// ADR-008's "explicit-only, no ambient auto-detection" locale contract the
// rest of this module already follows) covers the locale BeePOS actually
// shipped with; `formatValue`'s caller-owned override remains the escape
// hatch for a locale this dictionary does not know about, and an unknown
// locale here still falls back to the same English default `DatePicker`
// always had.
const DATE_PICKER_PLACEHOLDER_BY_LOCALE: Record<string, string> = {
  'en-US': 'Select a date',
  'vi-VN': 'Chọn ngày',
};

/**
 * Locale-appropriate default for `DatePicker`'s `placeholder` prop, used only
 * when the caller omits `placeholder` entirely. Falls back to the `'en-US'`
 * copy for a `locale` this built-in dictionary does not cover.
 */
export function getDatePickerDefaultPlaceholder(locale: string = DEFAULT_CALENDAR_LOCALE): string {
  return (
    DATE_PICKER_PLACEHOLDER_BY_LOCALE[locale] ??
    DATE_PICKER_PLACEHOLDER_BY_LOCALE[DEFAULT_CALENDAR_LOCALE]
  );
}
