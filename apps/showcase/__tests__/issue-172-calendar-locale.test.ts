import {
  DEFAULT_CALENDAR_LOCALE,
  getCalendarDayAccessibilityLabel,
  getCalendarMonthLabel,
  getCalendarMonthYearLabel,
  getCalendarWeekdayLabels,
  resolveCalendarLocale,
  resolveCalendarWeekStartsOn,
} from '../../../packages/ui/src/components/calendar-locale';

// BeeUI issue #172 (ADR-008 "Locale / week-start ownership"). `resolveCalendarLocale`/
// `resolveCalendarWeekStartsOn` mirror `use-direction.ts`'s stateless-resolver shape:
// explicit input, pure function, no ambient device/browser locale auto-detection
// (Option B1 was rejected). Label helpers use `Intl.DateTimeFormat` exclusively.

describe('BeeUI issue #172 resolveCalendarLocale', () => {
  it('uses the explicit locale when provided', () => {
    expect(resolveCalendarLocale('vi-VN')).toBe('vi-VN');
  });

  it('falls back to the static en-US default with no ambient auto-detection', () => {
    expect(resolveCalendarLocale(undefined)).toBe(DEFAULT_CALENDAR_LOCALE);
    expect(resolveCalendarLocale()).toBe('en-US');
  });
});

describe('BeeUI issue #172 resolveCalendarWeekStartsOn precedence', () => {
  it('lets an explicit weekStartsOn win over everything else', () => {
    expect(resolveCalendarWeekStartsOn(7, 'en-US')).toBe(7);
    expect(resolveCalendarWeekStartsOn(7, undefined)).toBe(7);
    expect(resolveCalendarWeekStartsOn(3, 'ar-SA', { getWeekInfo: () => ({ firstDay: 6 }) })).toBe(3);
  });

  it('derives from Intl.Locale.getWeekInfo when locale is explicit and the runtime supports it', () => {
    expect(
      resolveCalendarWeekStartsOn(undefined, 'ar-SA', { getWeekInfo: () => ({ firstDay: 6 }) }),
    ).toBe(6);
    expect(
      resolveCalendarWeekStartsOn(undefined, 'en-US', { getWeekInfo: () => ({ firstDay: 7 }) }),
    ).toBe(7);
  });

  it('falls back to Monday when the injected ambient input cannot derive a first day', () => {
    expect(resolveCalendarWeekStartsOn(undefined, 'ar-SA', { getWeekInfo: () => undefined })).toBe(1);
  });

  it('derives from the real Intl.Locale.getWeekInfo when no ambient inputs are injected', () => {
    // Real ICU data: en-US weeks start Sunday (7), vi-VN weeks start Monday (1) — this
    // proves genuine `Intl` derivation, not a coincidental match with the static fallback.
    expect(resolveCalendarWeekStartsOn(undefined, 'en-US')).toBe(7);
    expect(resolveCalendarWeekStartsOn(undefined, 'vi-VN')).toBe(1);
  });

  it('falls back to Monday when the runtime lacks Intl.Locale support (feature-detected, not assumed)', () => {
    const original = (Intl as { Locale?: unknown }).Locale;
    Reflect.deleteProperty(Intl, 'Locale');
    try {
      expect(resolveCalendarWeekStartsOn(undefined, 'en-US')).toBe(1);
    } finally {
      (Intl as { Locale?: unknown }).Locale = original;
    }
  });

  it('falls back to Monday when no locale was explicitly provided at all', () => {
    expect(resolveCalendarWeekStartsOn(undefined, undefined)).toBe(1);
  });

  it('ignores an out-of-range getWeekInfo result rather than trusting it blindly', () => {
    expect(resolveCalendarWeekStartsOn(undefined, 'en-US', { getWeekInfo: () => ({ firstDay: 0 }) })).toBe(1);
    expect(resolveCalendarWeekStartsOn(undefined, 'en-US', { getWeekInfo: () => ({ firstDay: 9 }) })).toBe(1);
  });
});

describe('BeeUI issue #172 Intl-derived label helpers', () => {
  it('formats month and month/year labels through Intl.DateTimeFormat', () => {
    expect(getCalendarMonthLabel({ day: 1, month: 1, year: 2026 }, 'en-US')).toBe('January');
    expect(getCalendarMonthYearLabel({ day: 1, month: 1, year: 2026 }, 'en-US')).toBe('January 2026');
  });

  it('formats weekday labels starting from the given weekStartsOn, in every requested width', () => {
    expect(getCalendarWeekdayLabels(1, 'en-US', 'long')).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(getCalendarWeekdayLabels(7, 'en-US', 'long')).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(getCalendarWeekdayLabels(1, 'en-US', 'short')).toHaveLength(7);
  });

  it('formats a full day accessibility label including weekday/month/day/year', () => {
    expect(getCalendarDayAccessibilityLabel({ day: 15, month: 1, year: 2026 }, 'en-US')).toBe(
      'Thursday, January 15, 2026',
    );
  });

  it('produces distinct, locale-appropriate labels for non-English locales', () => {
    const vi = getCalendarMonthYearLabel({ day: 1, month: 1, year: 2026 }, 'vi-VN');
    const en = getCalendarMonthYearLabel({ day: 1, month: 1, year: 2026 }, 'en-US');
    expect(vi).not.toBe(en);
  });
});
