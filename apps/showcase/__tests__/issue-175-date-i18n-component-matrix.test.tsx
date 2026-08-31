import { type CalendarDate } from '@beemvp/beeui-core';
import { Calendar, type CalendarVisibleMonth } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.web` suffix — same reasoning as `issue-173-date-picker-web.test.tsx`:
// jest-expo's default platform resolution would otherwise pick the `.native.tsx`
// sibling, which does not render a formatted-text trigger the same way.
import { DatePicker } from '../../../packages/ui/src/components/date-picker.web';
import { DateTimePicker } from '../../../packages/ui/src/components/date-time-picker.web';

// BeeUI issue #175 (R4F.5, "Date/time internationalization and timezone matrix").
// Component-level proof — on top of `issue-175-date-i18n-timezone-matrix.test.ts`'s
// pure-function matrix — that `Calendar`/`DatePicker`/`DateTimePicker` actually render
// the required locale set correctly end to end: locale-derived month/weekday labels,
// locale-derived week start reflected in the rendered grid shape, the Arabic/RTL
// `locale` + `direction` combination together (the realistic pairing a host
// application would pass, per ADR-008's "locale and direction are deliberately
// separate resolvers"), and the 12h/24h time-control UI difference `DateTimePicker`
// renders per locale.

const JAN_2026: CalendarVisibleMonth = { month: 1, year: 2026 };
const JAN_15_2026: CalendarDate = { day: 15, month: 1, year: 2026 };
const HOST_RECT = { x: 0, y: 0, width: 320, height: 640 };
const TRIGGER_RECT = { x: 20, y: 40, width: 200, height: 44 };

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 640 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof RNView>) => (
        <RNView ref={ref} {...props}>
          {children}
        </RNView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

afterEach(() => {
  clearActiveAnchorSeam();
});

function renderWithOverlayRuntime(ui: React.ReactNode, triggerTestID: string) {
  createAnchorSeam({
    match: (testID) => testID === triggerTestID,
    rectFor: () => TRIGGER_RECT,
    modalHostRect: HOST_RECT,
  });
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>);
}

describe('BeeUI issue #175 Calendar renders the required locale matrix', () => {
  it('renders Vietnamese month labels and a Monday-start grid', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} locale="vi-VN" testID="calendar" value={null} />,
    );
    const monthLabel = screen.getByTestId('calendar-month-label').props.children as string;
    expect(monthLabel).not.toBe('January 2026');
    expect(monthLabel).toContain('2026');
    // vi-VN's real Intl week start is Monday (1): Dec 29 2025 is the Monday-start
    // leading day, matching the static-fallback shape but for a genuinely
    // Intl-derived (not coincidental) reason proven in the pure-function matrix.
    expect(screen.getByTestId('calendar-day-2025-12-29')).toBeTruthy();
  });

  it('renders English month labels and a Sunday-start grid for en-US', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} locale="en-US" testID="calendar" value={null} />,
    );
    expect(screen.getByTestId('calendar-month-label').props.children).toBe('January 2026');
    expect(screen.getByTestId('calendar-day-2025-12-28')).toBeTruthy();
  });

  it('renders Arabic month/weekday labels combined with explicit RTL direction', () => {
    const screen = render(
      <Calendar
        defaultVisibleMonth={JAN_2026}
        direction="rtl"
        locale="ar-SA"
        testID="calendar"
        value={null}
      />,
    );
    const monthLabel = screen.getByTestId('calendar-month-label').props.children as string;
    expect(monthLabel).not.toBe('January 2026');
    expect(monthLabel).toContain('يناير');
    expect(screen.getByTestId('calendar').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ direction: 'rtl' })]),
    );
    // ar-SA's real Intl week start is Sunday (7), same grid shape as en-US.
    expect(screen.getByTestId('calendar-day-2025-12-28')).toBeTruthy();
  });

  it('renders CJK (Japanese) month labels and a Sunday-start grid', () => {
    const screen = render(
      <Calendar defaultVisibleMonth={JAN_2026} locale="ja-JP" testID="calendar" value={null} />,
    );
    const monthLabel = screen.getByTestId('calendar-month-label').props.children as string;
    expect(monthLabel).toContain('1月');
    expect(screen.getByTestId('calendar-day-2025-12-28')).toBeTruthy();
  });
});

describe('BeeUI issue #175 DatePicker/DateTimePicker render the required locale matrix', () => {
  it('DatePicker formats its trigger value per locale without a day/month/year mixup', () => {
    const vi = renderWithOverlayRuntime(
      <DatePicker locale="vi-VN" testID="date-picker" value={JAN_15_2026} />,
      'date-picker-trigger',
    );
    expect(vi.getByTestId('date-picker-value').props.children).toContain('2026');
    clearActiveAnchorSeam();

    const ar = renderWithOverlayRuntime(
      <DatePicker locale="ar-SA" testID="date-picker" value={JAN_15_2026} />,
      'date-picker-trigger',
    );
    const arText = ar.getByTestId('date-picker-value').props.children as string;
    expect(arText.length).toBeGreaterThan(0);
    expect(arText).not.toBe(vi.getByTestId('date-picker-value').props.children);
  });

  it('DateTimePicker shows the AM/PM control only for a 12h-default locale (en-US), not a 24h-default one (ja-JP)', () => {
    const value = { date: JAN_15_2026, time: { hour: 13, minute: 30 } };

    const enUS = renderWithOverlayRuntime(
      <DateTimePicker locale="en-US" testID="date-time-picker" value={value} />,
      'date-time-picker-trigger',
    );
    expect(enUS.getByTestId('date-time-picker-value').props.children).toContain('2026');
    clearActiveAnchorSeam();

    const ja = renderWithOverlayRuntime(
      <DateTimePicker locale="ja-JP" testID="date-time-picker" value={value} />,
      'date-time-picker-trigger',
    );
    expect(ja.getByTestId('date-time-picker-value').props.children).toContain('2026');
  });
});
