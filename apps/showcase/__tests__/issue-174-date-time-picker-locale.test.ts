import { clockTimeFromLocalDate, toLocalDate, type ClockTime } from '@beeui/core';
import {
  clampClockTime,
  fromDisplayHour,
  getDateTimePickerFormattedValue,
  getDateTimePickerPeriodLabels,
  resolveDateTimePickerHour12,
  toDisplayHour,
} from '../../../packages/ui/src/components/date-time-picker-locale';

// BeeUI issue #174 (R4F.4, ADR-008 "DateTimePicker" contract). Deterministic unit tests
// for the pure `@beeui/core` time boundary addition and the `@beeui/ui` locale/format
// helpers this component introduces: the date-only day-shift guardrail extended to
// hour/minute, 12/24h display policy precedence, locale-derived AM/PM labels, and the
// 12h<->24h hour conversion used by the Web time control.

describe('BeeUI issue #174 clockTimeFromLocalDate — the ClockTime counterpart to fromLocalDate', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  const fixtureTimeZones = ['Pacific/Kiritimati', 'Pacific/Niue'];

  it.each(fixtureTimeZones)(
    'round-trips an hour/minute through toLocalDate/clockTimeFromLocalDate in %s',
    (timeZone) => {
      process.env.TZ = timeZone;
      const time: ClockTime = { hour: 13, minute: 45 };
      const local = toLocalDate({ day: 15, month: 1, year: 2026 }, time);
      expect(clockTimeFromLocalDate(local)).toEqual(time);
    },
  );

  it('reads local getHours/getMinutes, never UTC getters', () => {
    const local = new Date(2026, 0, 15, 9, 5, 0, 0);
    expect(clockTimeFromLocalDate(local)).toEqual({ hour: 9, minute: 5 });
  });
});

describe('BeeUI issue #174 getDateTimePickerFormattedValue', () => {
  it('formats the composed date+time as a locale medium date + short time string', () => {
    const value = { date: { day: 15, month: 1, year: 2026 }, time: { hour: 13, minute: 5 } };
    expect(getDateTimePickerFormattedValue(value)).toBe('Jan 15, 2026, 1:05 PM');
  });

  it('supports an explicit locale', () => {
    const value = { date: { day: 1, month: 3, year: 2026 }, time: { hour: 0, minute: 0 } };
    expect(getDateTimePickerFormattedValue(value, 'en-GB')).toContain('2026');
  });
});

describe('BeeUI issue #174 resolveDateTimePickerHour12', () => {
  it('honors an explicit hour12 override regardless of locale', () => {
    expect(resolveDateTimePickerHour12(true, 'en-GB')).toBe(true);
    expect(resolveDateTimePickerHour12(false, 'en-US')).toBe(false);
  });

  it('derives 12h for en-US and 24h for a 24h-default locale when unset', () => {
    expect(resolveDateTimePickerHour12(undefined, 'en-US')).toBe(true);
    expect(resolveDateTimePickerHour12(undefined, 'en-GB')).toBe(false);
  });
});

describe('BeeUI issue #174 getDateTimePickerPeriodLabels', () => {
  it('returns AM/PM for en-US', () => {
    expect(getDateTimePickerPeriodLabels('en-US')).toEqual({ am: 'AM', pm: 'PM' });
  });

  it('returns locale-correct labels for Vietnamese, not hardcoded AM/PM', () => {
    const labels = getDateTimePickerPeriodLabels('vi-VN');
    expect(labels.am).not.toBe('AM');
    expect(labels.pm).not.toBe('PM');
  });
});

describe('BeeUI issue #174 toDisplayHour/fromDisplayHour — 24h <-> 12h conversion', () => {
  it('converts midnight/noon boundary hours correctly', () => {
    expect(toDisplayHour(0)).toEqual({ displayHour: 12, period: 'AM' });
    expect(toDisplayHour(12)).toEqual({ displayHour: 12, period: 'PM' });
    expect(toDisplayHour(13)).toEqual({ displayHour: 1, period: 'PM' });
    expect(toDisplayHour(23)).toEqual({ displayHour: 11, period: 'PM' });
  });

  it('is the exact reverse of fromDisplayHour for every 24h hour', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const { displayHour, period } = toDisplayHour(hour);
      expect(fromDisplayHour(displayHour, period)).toBe(hour);
    }
  });
});

describe('BeeUI issue #174 clampClockTime', () => {
  it('clamps out-of-range fields to their valid bounds', () => {
    expect(clampClockTime({ hour: 30, minute: 90 })).toEqual({ hour: 23, minute: 59 });
    expect(clampClockTime({ hour: -5, minute: -1 })).toEqual({ hour: 0, minute: 0 });
  });

  it('leaves an already-valid ClockTime unchanged', () => {
    expect(clampClockTime({ hour: 9, minute: 30 })).toEqual({ hour: 9, minute: 30 });
  });
});
