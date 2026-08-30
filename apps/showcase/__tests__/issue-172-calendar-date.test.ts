import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  clampCalendarDate,
  compareCalendarDates,
  fromLocalDate,
  getCalendarDayOfWeek,
  getCalendarMonthGrid,
  getDaysInMonth,
  isCalendarDateDisabled,
  isCalendarDateWithinRange,
  isLeapYear,
  isSameCalendarDate,
  isValidCalendarDate,
  parseISODateString,
  toISODateString,
  toLocalDate,
  type CalendarDate,
} from '@beeui/core';

// BeeUI issue #172 (R4F.2, ADR-008 "Calendar" contract). Deterministic date-arithmetic
// and adapter tests for the new `@beeui/core` calendar-date module: leap years,
// month-grid generation across week starts, comparison/clamping, and — the ADR's
// hard, non-negotiable requirement — proof that no date-only value shifts calendar
// day through an implicit UTC/local timezone conversion.

describe('BeeUI issue #172 calendar-date leap years and month lengths', () => {
  it('identifies leap years using the Gregorian 4/100/400 rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('returns the correct month length, including the Feb 29 leap case', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2023, 2)).toBe(28);
  });
});

describe('BeeUI issue #172 calendar-date validation and comparison', () => {
  it('rejects structurally invalid dates', () => {
    expect(isValidCalendarDate({ day: 30, month: 2, year: 2026 })).toBe(false);
    expect(isValidCalendarDate({ day: 1, month: 13, year: 2026 })).toBe(false);
    expect(isValidCalendarDate({ day: 0, month: 1, year: 2026 })).toBe(false);
    expect(isValidCalendarDate({ day: 29, month: 2, year: 2024 })).toBe(true);
    expect(isValidCalendarDate({ day: 15, month: 6, year: 2026 })).toBe(true);
  });

  it('compares by field order, not by Date/epoch conversion', () => {
    expect(compareCalendarDates({ day: 1, month: 1, year: 2026 }, { day: 1, month: 1, year: 2026 })).toBe(0);
    expect(compareCalendarDates({ day: 1, month: 1, year: 2026 }, { day: 2, month: 1, year: 2026 })).toBeLessThan(0);
    expect(compareCalendarDates({ day: 1, month: 2, year: 2026 }, { day: 31, month: 1, year: 2026 })).toBeGreaterThan(0);
    expect(compareCalendarDates({ day: 1, month: 1, year: 2027 }, { day: 31, month: 12, year: 2026 })).toBeGreaterThan(0);
  });

  it('treats null/undefined as equal only to each other', () => {
    expect(isSameCalendarDate(null, null)).toBe(true);
    expect(isSameCalendarDate(null, { day: 1, month: 1, year: 2026 })).toBe(false);
    expect(isSameCalendarDate({ day: 1, month: 1, year: 2026 }, { day: 1, month: 1, year: 2026 })).toBe(true);
  });
});

describe('BeeUI issue #172 calendar-date day-of-week and stepping', () => {
  it('computes the correct UTC-anchored day of week', () => {
    // 2026-01-01 is a Thursday.
    expect(getCalendarDayOfWeek({ day: 1, month: 1, year: 2026 })).toBe(4);
    // 2026-01-04 is a Sunday.
    expect(getCalendarDayOfWeek({ day: 4, month: 1, year: 2026 })).toBe(0);
  });

  it('adds/subtracts days across month and year boundaries', () => {
    expect(addCalendarDays({ day: 30, month: 1, year: 2026 }, 2)).toEqual({ day: 1, month: 2, year: 2026 });
    expect(addCalendarDays({ day: 1, month: 1, year: 2026 }, -1)).toEqual({ day: 31, month: 12, year: 2025 });
    expect(addCalendarDays({ day: 15, month: 6, year: 2026 }, 0)).toEqual({ day: 15, month: 6, year: 2026 });
  });

  it('adds/subtracts months, clamping day-of-month instead of rolling into the next month', () => {
    // Jan 31 + 1 month must land on Feb 28 (non-leap), never roll into March.
    expect(addCalendarMonths({ day: 31, month: 1, year: 2026 }, 1)).toEqual({ day: 28, month: 2, year: 2026 });
    // Jan 31 + 1 month in a leap year clamps to Feb 29.
    expect(addCalendarMonths({ day: 31, month: 1, year: 2024 }, 1)).toEqual({ day: 29, month: 2, year: 2024 });
    // Crossing a year boundary.
    expect(addCalendarMonths({ day: 15, month: 12, year: 2026 }, 2)).toEqual({ day: 15, month: 2, year: 2027 });
    expect(addCalendarMonths({ day: 15, month: 1, year: 2026 }, -2)).toEqual({ day: 15, month: 11, year: 2025 });
  });

  it('adds/subtracts years, clamping Feb 29 to Feb 28 in a non-leap target year', () => {
    expect(addCalendarYears({ day: 29, month: 2, year: 2024 }, 1)).toEqual({ day: 28, month: 2, year: 2025 });
    expect(addCalendarYears({ day: 29, month: 2, year: 2024 }, 4)).toEqual({ day: 29, month: 2, year: 2028 });
  });
});

describe('BeeUI issue #172 calendar-date clamping and disabled-predicate evaluation', () => {
  const min: CalendarDate = { day: 10, month: 1, year: 2026 };
  const max: CalendarDate = { day: 20, month: 1, year: 2026 };

  it('clamps a date into an inclusive [min, max] range', () => {
    expect(clampCalendarDate({ day: 1, month: 1, year: 2026 }, min, max)).toEqual(min);
    expect(clampCalendarDate({ day: 31, month: 1, year: 2026 }, min, max)).toEqual(max);
    expect(clampCalendarDate({ day: 15, month: 1, year: 2026 }, min, max)).toEqual({
      day: 15,
      month: 1,
      year: 2026,
    });
  });

  it('reports range membership without mutating the input', () => {
    expect(isCalendarDateWithinRange({ day: 10, month: 1, year: 2026 }, min, max)).toBe(true);
    expect(isCalendarDateWithinRange({ day: 20, month: 1, year: 2026 }, min, max)).toBe(true);
    expect(isCalendarDateWithinRange({ day: 9, month: 1, year: 2026 }, min, max)).toBe(false);
    expect(isCalendarDateWithinRange({ day: 21, month: 1, year: 2026 }, min, max)).toBe(false);
  });

  it('combines min/max and an arbitrary predicate, short-circuiting on the first violation', () => {
    const isWeekend = (date: CalendarDate) => {
      const weekday = getCalendarDayOfWeek(date);
      return weekday === 0 || weekday === 6;
    };
    // 2026-01-17 is a Saturday, inside [min, max], but excluded by the predicate.
    expect(
      isCalendarDateDisabled({ day: 17, month: 1, year: 2026 }, { isDateDisabled: isWeekend, max, min }),
    ).toBe(true);
    // 2026-01-15 is a Thursday, inside range and not a weekend.
    expect(
      isCalendarDateDisabled({ day: 15, month: 1, year: 2026 }, { isDateDisabled: isWeekend, max, min }),
    ).toBe(false);
    // Outside the range entirely — disabled regardless of the predicate.
    expect(
      isCalendarDateDisabled({ day: 1, month: 1, year: 2026 }, { isDateDisabled: () => false, max, min }),
    ).toBe(true);
    // No options at all — nothing is disabled.
    expect(isCalendarDateDisabled({ day: 1, month: 1, year: 2026 })).toBe(false);
  });
});

describe('BeeUI issue #172 calendar-date month-grid generation', () => {
  it('generates full Monday-start weeks for January 2026, including borrowed adjacent-month days', () => {
    const weeks = getCalendarMonthGrid({ month: 1, weekStartsOn: 1, year: 2026 });
    expect(weeks).toHaveLength(5);
    for (const week of weeks) expect(week).toHaveLength(7);

    expect(weeks[0][0]).toEqual({ date: { day: 29, month: 12, year: 2025 }, isCurrentMonth: false });
    expect(weeks[0][3]).toEqual({ date: { day: 1, month: 1, year: 2026 }, isCurrentMonth: true });
    const lastCell = weeks[weeks.length - 1][weeks[0].length - 1];
    expect(lastCell).toEqual({ date: { day: 1, month: 2, year: 2026 }, isCurrentMonth: false });

    const currentMonthCount = weeks.flat().filter((cell) => cell.isCurrentMonth).length;
    expect(currentMonthCount).toBe(31);
  });

  it('generates full Sunday-start weeks for the same month with a different grid shape', () => {
    const weeks = getCalendarMonthGrid({ month: 1, weekStartsOn: 7, year: 2026 });
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ date: { day: 28, month: 12, year: 2025 }, isCurrentMonth: false });
    const lastCell = weeks[weeks.length - 1][weeks[0].length - 1];
    // Jan 31, 2026 is a Saturday, the last day of a Sunday-start week — no Feb trailing days.
    expect(lastCell).toEqual({ date: { day: 31, month: 1, year: 2026 }, isCurrentMonth: true });
  });

  it('defaults to a Monday week start when `weekStartsOn` is omitted', () => {
    const withDefault = getCalendarMonthGrid({ month: 1, year: 2026 });
    const explicitMonday = getCalendarMonthGrid({ month: 1, weekStartsOn: 1, year: 2026 });
    expect(withDefault).toEqual(explicitMonday);
  });
});

describe('BeeUI issue #172 ISO date-only adapter', () => {
  it('round-trips a valid date through toISODateString/parseISODateString', () => {
    const date: CalendarDate = { day: 5, month: 3, year: 2026 };
    expect(toISODateString(date)).toBe('2026-03-05');
    expect(parseISODateString('2026-03-05')).toEqual(date);
  });

  it('rejects malformed or structurally invalid strings instead of guessing', () => {
    expect(parseISODateString('not-a-date')).toBeNull();
    expect(parseISODateString('2026-13-01')).toBeNull();
    expect(parseISODateString('2026-02-30')).toBeNull();
    expect(parseISODateString('2026/03/05')).toBeNull();
  });

  it('never constructs a `Date` from the ISO string (load-bearing: no UTC-midnight parsing bug)', () => {
    const dateConstructorSpy = jest.spyOn(global, 'Date');
    try {
      expect(parseISODateString('2026-03-05')).toEqual({ day: 5, month: 3, year: 2026 });
      expect(dateConstructorSpy).not.toHaveBeenCalled();
    } finally {
      dateConstructorSpy.mockRestore();
    }
  });
});

describe('BeeUI issue #172 toLocalDate/fromLocalDate boundary — no timezone-induced day shift', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  // Pacific/Kiritimati is UTC+14 (the earliest civil timezone); Pacific/Niue is
  // UTC-11 (one of the latest). Together they bracket practically every real-world
  // offset the classic `new Date('2026-01-15')` UTC-midnight bug can trigger.
  const fixtureTimeZones = ['Pacific/Kiritimati', 'Pacific/Niue'];

  it.each(fixtureTimeZones)('keeps the same calendar day round-tripping through toLocalDate/fromLocalDate in %s', (timeZone) => {
    process.env.TZ = timeZone;
    const date: CalendarDate = { day: 15, month: 1, year: 2026 };
    const local = toLocalDate(date);
    expect(fromLocalDate(local)).toEqual(date);
  });

  it.each(fixtureTimeZones)('constructs local midnight, never a UTC-`Z`-interpreted instant, in %s', (timeZone) => {
    process.env.TZ = timeZone;
    const date: CalendarDate = { day: 15, month: 1, year: 2026 };
    const local = toLocalDate(date);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(0);
    expect(local.getDate()).toBe(15);
    expect(local.getHours()).toBe(0);
    expect(local.getMinutes()).toBe(0);
  });

  it('applies an optional ClockTime onto the same local calendar day', () => {
    const date: CalendarDate = { day: 15, month: 1, year: 2026 };
    const local = toLocalDate(date, { hour: 13, minute: 45 });
    expect(fromLocalDate(local)).toEqual(date);
    expect(local.getHours()).toBe(13);
    expect(local.getMinutes()).toBe(45);
  });
});
