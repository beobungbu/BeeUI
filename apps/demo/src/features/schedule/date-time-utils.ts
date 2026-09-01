import type { CalendarDate, ClockTime } from '@beemvp/beeui-ui';

/**
 * Small, app-owned, pure date/time helpers for the scheduling flow (#262).
 * `@beemvp/beeui-ui` re-exports the `CalendarDate`/`ClockTime` *types* (ADR-008)
 * but not the internal `@beemvp/beeui-core` arithmetic helpers — the public
 * surface stops at the component barrel (ADR-013 D1: public BeeUI APIs only,
 * no deep `packages/**\/src/**` imports). These helpers are this feature's own
 * minimal, timezone-honest equivalents, following the same guardrail
 * `@beemvp/beeui-core`'s `calendar-date.ts` documents: never round-trip a
 * date-only value through `new Date(isoString)`/`Date.parse`, so a
 * `CalendarDate` can never silently drift to a different day.
 */

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isSameCalendarDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  if (!a || !b) return a === b;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function compareClockTimes(a: ClockTime, b: ClockTime): number {
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

/** Field-order comparator: earliest date+time first. */
export function compareSchedule(
  a: { date: CalendarDate; time: ClockTime },
  b: { date: CalendarDate; time: ClockTime },
): number {
  const dateComparison = compareCalendarDates(a.date, b.date);
  return dateComparison !== 0 ? dateComparison : compareClockTimes(a.time, b.time);
}

/**
 * Adds (or subtracts, for a negative `amount`) whole days. Uses UTC-anchored
 * `Date` construction purely as an integer day-counter (never read back via a
 * local-timezone getter, never round-tripped through an ISO string) — the
 * same guardrail `@beemvp/beeui-core`'s own `addCalendarDays` documents, so
 * this arithmetic cannot silently shift a calendar day.
 */
export function addCalendarDays(date: CalendarDate, amount: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/**
 * Reads today's calendar day from the local wall clock — the one place this
 * module reads an ambient `Date`, mirroring `@beemvp/beeui-core`'s own
 * `fromLocalDate` boundary. Every other function here is pure field
 * arithmetic with no `Date` involved at all.
 */
export function today(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Direct field formatting — never `Date`/`Intl` — so it cannot inherit a timezone-shift bug. */
export function formatCalendarDate(date: CalendarDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Direct field formatting (12h by default) — no `Date` construction needed. */
export function formatClockTime(time: ClockTime, hour12 = true): string {
  if (!hour12) return `${pad2(time.hour)}:${pad2(time.minute)}`;
  const period = time.hour >= 12 ? 'PM' : 'AM';
  const hour12Value = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${hour12Value}:${pad2(time.minute)} ${period}`;
}
