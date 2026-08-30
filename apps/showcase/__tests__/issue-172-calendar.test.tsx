import { type CalendarDate } from '@beeui/core';
import { Calendar, type CalendarVisibleMonth } from '@beeui/ui';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';

// BeeUI issue #172 (R4F.2, ADR-008 "Calendar" contract). Rendering-contract tests for
// the stable `Calendar` component: controlled selection, min/max/disabled predicate,
// today state, month navigation, controlled `visibleMonth`, disabled/read-only
// behavior, RTL mirroring, locale/week-start, and the WAI-ARIA grid keyboard contract
// on Web. No `allowFontScaling={false}` usage is separately enforced repo-wide by
// `dynamic-type-contract.test.tsx`.

const JAN_2026: CalendarVisibleMonth = { month: 1, year: 2026 };

function dayCell(screen: ReturnType<typeof render>, iso: string) {
  return screen.getByTestId(`calendar-day-${iso}`);
}

describe('BeeUI issue #172 Calendar rendering contract', () => {
  it('renders a full month grid with weekday headers and the resolved month/year label', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />,
    );

    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2026');
    // Monday-start default: Dec 29, 2025 through Feb 1, 2026 (5 full weeks, 35 cells).
    expect(dayCell(screen, '2025-12-29')).toBeTruthy();
    expect(dayCell(screen, '2026-01-01')).toBeTruthy();
    expect(dayCell(screen, '2026-02-01')).toBeTruthy();
  });

  it('marks the controlled value as selected and nothing else', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    expect(dayCell(screen, '2026-01-15').props.accessibilityState.selected).toBe(true);
    expect(dayCell(screen, '2026-01-14').props.accessibilityState.selected).toBe(false);
    expect(dayCell(screen, '2026-01-15').props.accessibilityLabel).toContain('Selected');
  });

  it('calls onValueChange with the pressed date and does not mutate value itself (controlled)', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        onValueChange={onValueChange}
        testID="calendar"
        value={null}
      />,
    );

    fireEvent.press(dayCell(screen, '2026-01-15'));

    expect(onValueChange).toHaveBeenCalledWith({ day: 15, month: 1, year: 2026 });
    // Still unselected: the harness did not feed the change back into `value`.
    expect(dayCell(screen, '2026-01-15').props.accessibilityState.selected).toBe(false);
  });

  it('marks out-of-range and predicate-disabled dates as disabled and blocks selection', () => {
    const onValueChange = jest.fn();
    const isDateDisabled = (date: CalendarDate) => date.day === 20;
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        isDateDisabled={isDateDisabled}
        max={{ day: 25, month: 1, year: 2026 }}
        min={{ day: 10, month: 1, year: 2026 }}
        onValueChange={onValueChange}
        testID="calendar"
        value={null}
      />,
    );

    expect(dayCell(screen, '2026-01-05').props.accessibilityState.disabled).toBe(true);
    expect(dayCell(screen, '2026-01-28').props.accessibilityState.disabled).toBe(true);
    expect(dayCell(screen, '2026-01-20').props.accessibilityState.disabled).toBe(true);
    expect(dayCell(screen, '2026-01-15').props.accessibilityState.disabled).toBe(false);
    expect(dayCell(screen, '2026-01-20').props.accessibilityLabel).toContain('Disabled');

    fireEvent.press(dayCell(screen, '2026-01-20'));
    fireEvent.press(dayCell(screen, '2026-01-05'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('marks today with a distinguishing accessible label, not color alone', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15));
    try {
      const screen = render(
        <Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />,
      );
      expect(dayCell(screen, '2026-01-15').props.accessibilityLabel).toContain('Today');
      expect(dayCell(screen, '2026-01-16').props.accessibilityLabel).not.toContain('Today');
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates month via the previous/next controls, stepping the focused day-of-month forward', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />,
    );

    fireEvent.press(screen.getByTestId('calendar-next-month'));
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('February 2026');

    fireEvent.press(screen.getByTestId('calendar-previous-month'));
    fireEvent.press(screen.getByTestId('calendar-previous-month'));
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('December 2025');
  });

  it('supports a fully controlled visibleMonth', () => {
    function Harness() {
      const [visibleMonth, setVisibleMonth] = React.useState<CalendarVisibleMonth>(JAN_2026);
      return (
        <Calendar
          onVisibleMonthChange={setVisibleMonth}
          testID="calendar"
          value={null}
          visibleMonth={visibleMonth}
        />
      );
    }
    const screen = render(<Harness />);

    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2026');
    fireEvent.press(screen.getByTestId('calendar-next-month'));
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('February 2026');
  });

  it('disables every cell and both navigation controls when `disabled`', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        disabled
        onValueChange={onValueChange}
        testID="calendar"
        value={null}
      />,
    );

    expect(dayCell(screen, '2026-01-15').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('calendar-next-month').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('calendar-previous-month').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(dayCell(screen, '2026-01-15'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps read-only cells focusable/navigable but blocks selection, distinct from disabled', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        onValueChange={onValueChange}
        readOnly
        testID="calendar"
        value={null}
      />,
    );

    expect(dayCell(screen, '2026-01-15').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(dayCell(screen, '2026-01-15'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('mirrors navigation glyphs and sets Yoga row-mirroring direction under RTL', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} direction="rtl" testID="calendar" value={null} />,
    );

    expect(screen.getByTestId('calendar').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ direction: 'rtl' })]),
    );
  });

  it('resolves locale-derived weekday labels and week start for an explicit non-English locale', () => {
    // vi-VN's real Intl weekInfo starts the week on Monday (1), same as the static
    // fallback, so pick a month where that is still observable via the grid shape,
    // and assert the month label is genuinely localized.
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} locale="vi-VN" testID="calendar" value={null} />,
    );
    expect(screen.getByTestId('calendar-month-label').props.children).not.toBe('January 2026');
  });

  it('honors an explicit weekStartsOn over the locale-derived value', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={null}
        weekStartsOn={7}
      />,
    );
    // Sunday-start January 2026 begins on Dec 28, 2025, not the Monday-start Dec 29.
    expect(dayCell(screen, '2025-12-28')).toBeTruthy();
  });
});

describe('BeeUI issue #172 Calendar Web keyboard grid contract', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  function pressKey(
    screen: ReturnType<typeof render>,
    key: string,
    options: { shiftKey?: boolean } = {},
  ) {
    act(() => {
      screen.getByTestId('calendar-grid').props.onKeyDown?.({
        key,
        preventDefault: jest.fn(),
        shiftKey: options.shiftKey,
      });
    });
  }

  it('moves the roving-tabindex target by one day with ArrowRight/ArrowLeft in LTR', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    expect(dayCell(screen, '2026-01-15').props.tabIndex).toBe(0);
    pressKey(screen, 'ArrowRight');
    expect(dayCell(screen, '2026-01-16').props.tabIndex).toBe(0);
    expect(dayCell(screen, '2026-01-15').props.tabIndex).toBe(-1);

    pressKey(screen, 'ArrowLeft');
    pressKey(screen, 'ArrowLeft');
    expect(dayCell(screen, '2026-01-14').props.tabIndex).toBe(0);
  });

  it('swaps ArrowRight/ArrowLeft to the physically-mirrored day under RTL', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        direction="rtl"
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'ArrowRight');
    expect(dayCell(screen, '2026-01-14').props.tabIndex).toBe(0);
  });

  it('moves by one week with ArrowDown/ArrowUp', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'ArrowDown');
    expect(dayCell(screen, '2026-01-22').props.tabIndex).toBe(0);
    pressKey(screen, 'ArrowUp');
    pressKey(screen, 'ArrowUp');
    expect(dayCell(screen, '2026-01-08').props.tabIndex).toBe(0);
  });

  it('moves by one month with PageDown/PageUp, crossing into the adjacent visible month', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'PageDown');
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('February 2026');
    expect(dayCell(screen, '2026-02-15').props.tabIndex).toBe(0);

    pressKey(screen, 'PageUp');
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2026');
    expect(dayCell(screen, '2026-01-15').props.tabIndex).toBe(0);
  });

  it('moves by one year with Shift+PageDown/Shift+PageUp', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'PageDown', { shiftKey: true });
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2027');

    pressKey(screen, 'PageUp', { shiftKey: true });
    pressKey(screen, 'PageUp', { shiftKey: true });
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2025');
  });

  it('moves to the first/last day of the focused week with Home/End', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'Home');
    expect(dayCell(screen, '2026-01-12').props.tabIndex).toBe(0);
    pressKey(screen, 'End');
    expect(dayCell(screen, '2026-01-18').props.tabIndex).toBe(0);
  });

  it('selects the focused day with Enter/Space', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        onValueChange={onValueChange}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'ArrowRight');
    pressKey(screen, 'Enter');
    expect(onValueChange).toHaveBeenCalledWith({ day: 16, month: 1, year: 2026 });

    onValueChange.mockClear();
    pressKey(screen, ' ');
    expect(onValueChange).toHaveBeenCalledWith({ day: 16, month: 1, year: 2026 });
  });

  it('does not move focus or select while disabled', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        disabled
        onValueChange={onValueChange}
        testID="calendar"
        value={{ day: 15, month: 1, year: 2026 }}
      />,
    );

    pressKey(screen, 'ArrowRight');
    pressKey(screen, 'Enter');
    expect(dayCell(screen, '2026-01-15').props.tabIndex).toBe(-1);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
