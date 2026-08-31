import type { CalendarDate, CalendarWeekStartsOn } from '@beemvp/beeui-core';

// Stateless `locale`/`weekStartsOn` resolver for `Calendar` (ADR-008, "Locale /
// week-start ownership"), mirroring `use-direction.ts`'s shape exactly: explicit input,
// pure function, unit-testable, no `React.createContext`/store/subscription. Unlike
// `resolveDirection()`, there is no ambient device/browser locale auto-detection here —
// ADR-008 rejected that (Option B1) as resting on undocumented native primitives and
// duplicating i18n ownership the host application already has. `locale` is therefore an
// explicit-only prop with a static fallback.
//
// Month/weekday/day-accessibility labels use `Intl.DateTimeFormat` exclusively — no
// bundled CLDR/locale table (ADR-008/#175's "no huge locale database" constraint).

export const DEFAULT_CALENDAR_LOCALE = 'en-US';

/** Precedence-2 (`Intl`-derived) fallback when the runtime lacks `getWeekInfo`/`weekInfo`. */
const DEFAULT_CALENDAR_WEEK_STARTS_ON: CalendarWeekStartsOn = 1;

/** Testing seam mirroring `DirectionAmbientInputs` — real `Intl.Locale` is read when omitted. */
export type CalendarLocaleAmbientInputs = {
  getWeekInfo?: (locale: string) => { firstDay?: number } | undefined;
};

type IntlLocaleWithWeekInfo = {
  getWeekInfo?: () => { firstDay?: number } | undefined;
  weekInfo?: { firstDay?: number };
};

function normalizeFirstDay(firstDay: number | undefined): CalendarWeekStartsOn | undefined {
  if (typeof firstDay !== 'number' || !Number.isInteger(firstDay)) return undefined;
  if (firstDay < 1 || firstDay > 7) return undefined;
  return firstDay as CalendarWeekStartsOn;
}

function readIntlWeekInfoFirstDay(
  locale: string,
  inputs?: CalendarLocaleAmbientInputs,
): CalendarWeekStartsOn | undefined {
  if (inputs?.getWeekInfo) return normalizeFirstDay(inputs.getWeekInfo(locale)?.firstDay);

  const IntlLocaleCtor = (Intl as unknown as { Locale?: new (tag: string) => IntlLocaleWithWeekInfo })
    .Locale;
  if (!IntlLocaleCtor) return undefined;

  try {
    const localeObject = new IntlLocaleCtor(locale);
    // `getWeekInfo()` is the current TC39 method form; `weekInfo` was an earlier getter
    // shape some engines still expose. Feature-detect both rather than assuming either.
    const info =
      typeof localeObject.getWeekInfo === 'function' ? localeObject.getWeekInfo() : localeObject.weekInfo;
    return normalizeFirstDay(info?.firstDay);
  } catch {
    return undefined;
  }
}

/** Explicit prop wins; else static `'en-US'` fallback. No ambient locale auto-detection. */
export function resolveCalendarLocale(explicit?: string): string {
  return explicit ?? DEFAULT_CALENDAR_LOCALE;
}

/**
 * Precedence: explicit `weekStartsOn` prop; else `Intl.Locale(locale).getWeekInfo()
 * .firstDay` when `locale` was explicitly provided and the runtime supports it
 * (feature-detected); else static Monday (`1`).
 */
export function resolveCalendarWeekStartsOn(
  explicit: CalendarWeekStartsOn | undefined,
  locale: string | undefined,
  inputs?: CalendarLocaleAmbientInputs,
): CalendarWeekStartsOn {
  if (explicit) return explicit;
  if (locale) {
    const derived = readIntlWeekInfoFirstDay(locale, inputs);
    if (derived) return derived;
  }
  return DEFAULT_CALENDAR_WEEK_STARTS_ON;
}

function toFormattableUTCDate(date: CalendarDate): Date {
  // Formatting-only, discarded immediately: `timeZone: 'UTC'` is always passed alongside
  // this value so the `Date.UTC`-anchored instant is never reinterpreted in the host's
  // local timezone. This is not the sanctioned `CalendarDate` ⇄ `Date` boundary
  // (`toLocalDate`/`fromLocalDate` in `@beemvp/beeui-core`) — it never leaves this module.
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function getCalendarMonthLabel(date: CalendarDate, locale: string = DEFAULT_CALENDAR_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    toFormattableUTCDate(date),
  );
}

export function getCalendarMonthYearLabel(
  date: CalendarDate,
  locale: string = DEFAULT_CALENDAR_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC', year: 'numeric' }).format(
    toFormattableUTCDate(date),
  );
}

export type CalendarWeekdayFormat = 'long' | 'narrow' | 'short';

// 2026-01-04 is a UTC Sunday — an arbitrary fixed known-Sunday reference date lets every
// weekday label be derived by day offset without depending on the current date.
const KNOWN_SUNDAY_UTC_EPOCH_MS = Date.UTC(2026, 0, 4);
const MS_PER_DAY = 86_400_000;

export function getCalendarWeekdayLabels(
  weekStartsOn: CalendarWeekStartsOn,
  locale: string = DEFAULT_CALENDAR_LOCALE,
  format: CalendarWeekdayFormat = 'short',
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: format });
  const weekStartOffset = weekStartsOn % 7;
  const labels: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayIndex = (weekStartOffset + i) % 7;
    labels.push(formatter.format(new Date(KNOWN_SUNDAY_UTC_EPOCH_MS + dayIndex * MS_PER_DAY)));
  }
  return labels;
}

export function getCalendarDayAccessibilityLabel(
  date: CalendarDate,
  locale: string = DEFAULT_CALENDAR_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(toFormattableUTCDate(date));
}
