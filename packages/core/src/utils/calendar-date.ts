// Pure, timezone-free calendar-day/wall-clock-time primitives for `Calendar`,
// `DatePicker`, and `DateTimePicker` (ADR-008, docs/decisions/008-datetime-architecture.md).
//
// `CalendarDate`/`ClockTime` carry no timezone field by construction, so they cannot
// express — and therefore cannot silently reintroduce — the classic
// `new Date('2026-01-15')` UTC-midnight day-shift bug. Every function in this module is
// pure and zero-dependency (no React/React Native/DOM import), consistent with
// `@beeui/core`'s existing purity boundary (`anchored-overlay.ts`).
//
// Implementation guardrail (ADR-008): any internal arithmetic implemented via `Date`
// must exclusively use UTC-anchored construction (`Date.UTC(y, m - 1, d)`), never the
// local-timezone `Date` constructor and never `Date`/`Date.parse` on an ISO string.
// `toLocalDate`/`fromLocalDate` below are the *only* sanctioned place a `CalendarDate`
// becomes a local-timezone-bearing `Date`.

/** A plain, timezone-free calendar day. `month` is 1–12 (January = 1). */
export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

/** A plain, timezone-free wall-clock time. `hour` is 0–23. */
export type ClockTime = {
  hour: number;
  minute: number;
};

/**
 * ISO 8601 / `Intl` `weekInfo` convention: `1` = Monday … `7` = Sunday.
 */
export type CalendarWeekStartsOn = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CalendarMonthGridDay = {
  date: CalendarDate;
  /** `false` for leading/trailing days borrowed from the adjacent month to fill full weeks. */
  isCurrentMonth: boolean;
};

export type CalendarMonthGridOptions = {
  month: number;
  weekStartsOn?: CalendarWeekStartsOn;
  year: number;
};

export type CalendarDateDisabledOptions = {
  isDateDisabled?: (date: CalendarDate) => boolean;
  max?: CalendarDate | null;
  min?: CalendarDate | null;
};

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** `month` must be an integer 1–12. */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1];
}

export function isValidCalendarDate(date: CalendarDate): boolean {
  const { day, month, year } = date;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > getDaysInMonth(year, month)) return false;
  return true;
}

/** Field-order comparator: negative when `a` is earlier, positive when later, `0` when equal. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isSameCalendarDate(
  a: CalendarDate | null | undefined,
  b: CalendarDate | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function fromUTCEpoch(epochMs: number): CalendarDate {
  const utc = new Date(epochMs);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/** `0` = Sunday … `6` = Saturday (matches `Date.prototype.getUTCDay()`/`Intl` day-index convention). */
export function getCalendarDayOfWeek(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Adds (or subtracts, for a negative `amount`) whole days, normalizing month/year overflow. */
export function addCalendarDays(date: CalendarDate, amount: number): CalendarDate {
  return fromUTCEpoch(Date.UTC(date.year, date.month - 1, date.day + amount));
}

/**
 * Adds (or subtracts) whole calendar months. The day-of-month clamps to the target
 * month's length (e.g. Jan 31 + 1 month = Feb 28/29, never rolls into March). Pure
 * integer arithmetic — no `Date` construction needed for month-only stepping.
 */
export function addCalendarMonths(date: CalendarDate, amount: number): CalendarDate {
  const totalMonths = date.month - 1 + amount;
  const year = date.year + Math.floor(totalMonths / 12);
  const month = (((totalMonths % 12) + 12) % 12) + 1;
  const day = Math.min(date.day, getDaysInMonth(year, month));
  return { year, month, day };
}

/** Adds (or subtracts) whole years, clamping Feb 29 to Feb 28 in a non-leap target year. */
export function addCalendarYears(date: CalendarDate, amount: number): CalendarDate {
  const year = date.year + amount;
  const day = Math.min(date.day, getDaysInMonth(year, date.month));
  return { year, month: date.month, day };
}

export function clampCalendarDate(
  date: CalendarDate,
  min?: CalendarDate | null,
  max?: CalendarDate | null,
): CalendarDate {
  if (min && compareCalendarDates(date, min) < 0) return min;
  if (max && compareCalendarDates(date, max) > 0) return max;
  return date;
}

export function isCalendarDateWithinRange(
  date: CalendarDate,
  min?: CalendarDate | null,
  max?: CalendarDate | null,
): boolean {
  if (min && compareCalendarDates(date, min) < 0) return false;
  if (max && compareCalendarDates(date, max) > 0) return false;
  return true;
}

export function isCalendarDateDisabled(
  date: CalendarDate,
  options: CalendarDateDisabledOptions = {},
): boolean {
  const { isDateDisabled, max, min } = options;
  if (!isCalendarDateWithinRange(date, min, max)) return true;
  if (isDateDisabled?.(date)) return true;
  return false;
}

/**
 * Generates the full-week grid for a month: one array per week, each with exactly 7
 * `CalendarMonthGridDay` cells (Sunday/Monday-first per `weekStartsOn`). Leading/
 * trailing cells borrowed from the adjacent month are included (`isCurrentMonth:
 * false`) so every week is complete; the grid is not padded to a fixed row count.
 */
export function getCalendarMonthGrid(options: CalendarMonthGridOptions): CalendarMonthGridDay[][] {
  const { month, year } = options;
  const weekStartsOn = options.weekStartsOn ?? 1;
  const weekStartOffset = weekStartsOn % 7;

  const firstOfMonth: CalendarDate = { year, month, day: 1 };
  const firstWeekday = getCalendarDayOfWeek(firstOfMonth);
  const leadingDays = (firstWeekday - weekStartOffset + 7) % 7;
  const gridStart = addCalendarDays(firstOfMonth, -leadingDays);

  const daysInMonth = getDaysInMonth(year, month);
  const lastOfMonth: CalendarDate = { year, month, day: daysInMonth };
  const lastWeekday = getCalendarDayOfWeek(lastOfMonth);
  const trailingDays = (weekStartOffset + 6 - lastWeekday + 7) % 7;
  const gridEnd = addCalendarDays(lastOfMonth, trailingDays);

  const weeks: CalendarMonthGridDay[][] = [];
  let cursor = gridStart;
  while (compareCalendarDates(cursor, gridEnd) <= 0) {
    const week: CalendarMonthGridDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({ date: cursor, isCurrentMonth: cursor.month === month && cursor.year === year });
      cursor = addCalendarDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const ISO_DATE_PATTERN = /^(-?\d{4,})-(\d{2})-(\d{2})$/;

function pad(value: number, length: number): string {
  return String(Math.trunc(Math.abs(value))).padStart(length, '0');
}

/** Never round-trips through `Date`/`Date.parse` — direct field formatting only. */
export function toISODateString(date: CalendarDate): string {
  const sign = date.year < 0 ? '-' : '';
  return `${sign}${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/**
 * Parses a `"YYYY-MM-DD"` string by splitting/regex-matching its fields directly. Never
 * calls `new Date(iso)`/`Date.parse`, so it cannot inherit the UTC-midnight parsing bug.
 * Returns `null` for a malformed string or a structurally invalid date (e.g. day 31 in
 * a 30-day month).
 */
export function parseISODateString(iso: string): CalendarDate | null {
  if (typeof iso !== 'string') return null;
  const match = ISO_DATE_PATTERN.exec(iso.trim());
  if (!match) return null;
  const date: CalendarDate = {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
  };
  return isValidCalendarDate(date) ? date : null;
}

/**
 * The sole sanctioned `CalendarDate` → `Date` boundary (ADR-008): constructs via the
 * local-timezone `Date` constructor, so a date-only value always lands on local
 * midnight (or the given local wall-clock time) of the same calendar day — never
 * shifted by a UTC/`Z` reinterpretation.
 */
export function toLocalDate(date: CalendarDate, time?: ClockTime): Date {
  return new Date(date.year, date.month - 1, date.day, time?.hour ?? 0, time?.minute ?? 0, 0, 0);
}

/**
 * The sole sanctioned `Date` → `CalendarDate` boundary (ADR-008): reads local-timezone
 * getters only, the exact reverse of {@link toLocalDate}.
 */
export function fromLocalDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}
