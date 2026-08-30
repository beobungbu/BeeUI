import type { ClockTime } from '@beeui/core';
import { DEFAULT_CALENDAR_LOCALE } from './calendar-locale';
import type { DateTimePickerValue } from './date-time-picker-shared';

// Locale/format helpers for `DateTimePicker` (ADR-008, #174). Mirrors
// `date-picker-locale.ts`'s `toFormattableUTCDate`/`Intl.DateTimeFormat` pattern
// exactly, extended with hour/minute: `timeZone: 'UTC'` is always passed alongside a
// `Date.UTC`-anchored instant that never leaves this module, so the display string is
// never reinterpreted in the host's local timezone. This is formatting-only — not the
// sanctioned `CalendarDate`/`ClockTime` ⇄ `Date` boundary (`toLocalDate`/`fromLocalDate`/
// `clockTimeFromLocalDate` in `@beeui/core`).
//
// 12/24h display policy and AM/PM labels use `Intl` exclusively (ADR-008's "no huge
// locale database" constraint, #175) — no bundled locale table.

function toFormattableUTCDate(value: DateTimePickerValue): Date {
  return new Date(
    Date.UTC(value.date.year, value.date.month - 1, value.date.day, value.time.hour, value.time.minute),
  );
}

/**
 * Default `DateTimePicker` formatted-display value: a locale-appropriate medium
 * date + short time string (e.g. `"Jan 15, 2026, 1:45 PM"` for `'en-US'`). Consumers
 * may override via `DateTimePicker`'s `formatValue` prop for a different
 * `Intl.DateTimeFormatOptions` shape.
 */
export function getDateTimePickerFormattedValue(
  value: DateTimePickerValue,
  locale: string = DEFAULT_CALENDAR_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(toFormattableUTCDate(value));
}

/**
 * Locale/config-driven 12/24h display policy (ADR-008): explicit `hour12` prop wins;
 * otherwise derived from `Intl.DateTimeFormat(locale, { hour: 'numeric' })
 * .resolvedOptions().hour12`, which every ES2020+ engine implements (no feature
 * detection needed, unlike `Intl.Locale.prototype.getWeekInfo`).
 */
export function resolveDateTimePickerHour12(
  explicit: boolean | undefined,
  locale: string = DEFAULT_CALENDAR_LOCALE,
): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return Boolean(new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12);
}

export type DateTimePickerPeriodLabels = {
  am: string;
  pm: string;
};

// Arbitrary fixed UTC reference instants: 09:00 is unambiguously AM, 21:00 unambiguously
// PM, on every Gregorian locale — only their formatted `dayPeriod` part is read.
const AM_REFERENCE_UTC_MS = Date.UTC(2026, 0, 1, 9, 0);
const PM_REFERENCE_UTC_MS = Date.UTC(2026, 0, 1, 21, 0);

/**
 * Locale-correct AM/PM-equivalent labels (e.g. Vietnamese `"SA"`/`"CH"`) derived from
 * `Intl.DateTimeFormat.prototype.formatToParts`' `dayPeriod` part — never a hardcoded
 * `'AM'`/`'PM'` literal, satisfying #175's locale-label requirement without bundling a
 * locale table.
 */
export function getDateTimePickerPeriodLabels(
  locale: string = DEFAULT_CALENDAR_LOCALE,
): DateTimePickerPeriodLabels {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  });
  const readDayPeriod = (epochMs: number, fallback: string): string =>
    formatter.formatToParts(new Date(epochMs)).find((part) => part.type === 'dayPeriod')?.value ??
    fallback;
  return {
    am: readDayPeriod(AM_REFERENCE_UTC_MS, 'AM'),
    pm: readDayPeriod(PM_REFERENCE_UTC_MS, 'PM'),
  };
}

export type DateTimePickerPeriod = 'AM' | 'PM';

/** Converts a 24h `ClockTime` hour to a 12h display hour (1–12) + AM/PM period. */
export function toDisplayHour(hour: number): { displayHour: number; period: DateTimePickerPeriod } {
  const period: DateTimePickerPeriod = hour < 12 ? 'AM' : 'PM';
  const remainder = hour % 12;
  return { displayHour: remainder === 0 ? 12 : remainder, period };
}

/** The exact reverse of {@link toDisplayHour}: a 12h display hour (1–12) + period back to a 24h hour (0–23). */
export function fromDisplayHour(displayHour: number, period: DateTimePickerPeriod): number {
  const normalized = displayHour % 12;
  return period === 'AM' ? normalized : normalized + 12;
}

/** Clamps a `ClockTime`'s fields to their valid ranges (`hour` 0–23, `minute` 0–59). */
export function clampClockTime(time: ClockTime): ClockTime {
  return {
    hour: Math.min(23, Math.max(0, Math.trunc(time.hour))),
    minute: Math.min(59, Math.max(0, Math.trunc(time.minute))),
  };
}
