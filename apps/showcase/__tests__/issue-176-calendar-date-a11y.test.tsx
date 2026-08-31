import { type CalendarDate, type ClockTime } from '@beemvp/beeui-core';
import { Calendar, type CalendarVisibleMonth } from '@beemvp/beeui-ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.web` suffix — same reasoning as `issue-173-date-picker-web.test.tsx`.
import { DateTimePicker } from '../../../packages/ui/src/components/date-time-picker.web';

// BeeUI issue #176 (R4F.6, "Calendar/date accessibility and keyboard acceptance").
// This file closes the specific semantic-a11y gaps not already covered by #172/#173/
// #174's own contract tests: the grid/row/cell ARIA-equivalent role contract, the
// minimum-touch-target token on day cells, the announced-month-change live region, and
// `DateTimePicker`'s hour/minute/AM-PM screen-reader names (default and overridden).
// The WAI-ARIA keyboard grid contract itself (Arrow/PageUp/PageDown/Home/End/Enter/
// Escape, RTL mirroring) already has full deterministic coverage in
// `issue-172-calendar.test.tsx`; real-browser keyboard/focus-restoration/visible-focus/
// touch-target/RTL/large-text evidence is
// `apps/visual-regression/tests/calendar-accessibility-showcase.spec.ts`.

const JAN_2026: CalendarVisibleMonth = { month: 1, year: 2026 };

describe('BeeUI issue #176 Calendar grid role contract', () => {
  it('exposes grid/row/cell roles, with each cell genuinely nested inside a row inside the grid', () => {
    const screen = render(<Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />);

    expect(screen.getByTestId('calendar-grid').props.role).toBe('grid');

    const cell = screen.getByTestId('calendar-day-2026-01-15');
    expect(cell.props.role).toBe('cell');

    // Walks up the test-instance tree (bounded) to prove the cell is genuinely nested
    // inside a `role="row"` ancestor, which is itself inside `role="grid"` — the
    // WAI-ARIA grid>row>cell hierarchy, not merely three same-level role attributes
    // with no real nesting relationship.
    let rowAncestor: typeof cell | null = cell.parent;
    for (let hops = 0; hops < 8 && rowAncestor && rowAncestor.props.role !== 'row'; hops += 1) {
      rowAncestor = rowAncestor.parent;
    }
    expect(rowAncestor?.props.role).toBe('row');

    let gridAncestor: typeof cell | null = rowAncestor;
    for (let hops = 0; hops < 8 && gridAncestor && gridAncestor.props.testID !== 'calendar-grid'; hops += 1) {
      gridAncestor = gridAncestor.parent;
    }
    expect(gridAncestor?.props.testID).toBe('calendar-grid');
  });

  it('names the grid via accessibilityLabel, defaulting to the visible month/year', () => {
    const screen = render(<Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />);
    expect(screen.getByTestId('calendar-grid').props.accessibilityLabel).toBe('January 2026');
  });

  it('supports an explicit accessibilityLabel override for the grid', () => {
    const screen = render(
      <Calendar
        accessibilityLabel="Appointment date"
        defaultVisibleMonth={JAN_2026}
        testID="calendar"
        value={null}
      />,
    );
    expect(screen.getByTestId('calendar-grid').props.accessibilityLabel).toBe('Appointment date');
  });

  it('gives every day cell a minimum touch-target size, not a smaller ad hoc size', () => {
    const screen = render(<Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />);
    const cellClassName = screen.getByTestId('calendar-day-2026-01-15').props.className as string;
    expect(cellClassName).toContain('min-h-touch-target');
    expect(cellClassName).toContain('min-w-touch-target');
  });

  it('announces the visible month/year change via a polite live region as navigation happens', () => {
    const screen = render(<Calendar defaultVisibleMonth={JAN_2026} testID="calendar" value={null} />);
    const monthLabel = screen.getByTestId('calendar-month-label');
    expect(monthLabel.props.accessibilityLiveRegion).toBe('polite');
    expect(monthLabel.props.children).toBe('January 2026');

    fireEvent.press(screen.getByTestId('calendar-next-month'));

    const updatedMonthLabel = screen.getByTestId('calendar-month-label');
    expect(updatedMonthLabel.props.accessibilityLiveRegion).toBe('polite');
    expect(updatedMonthLabel.props.children).toBe('February 2026');
  });
});

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

function renderDateTimePicker(ui: React.ReactNode) {
  createAnchorSeam({
    match: (testID) => testID === 'date-time-picker-trigger',
    rectFor: () => TRIGGER_RECT,
    modalHostRect: HOST_RECT,
  });
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>);
}

// Mirrors `issue-174-date-time-picker-web.test.tsx`'s own `open` helper: the time
// field only mounts once the Popover content is open.
async function open(screen: ReturnType<typeof renderDateTimePicker>) {
  fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
  const content = await waitFor(() =>
    screen.getByTestId('date-time-picker-content', { includeHiddenElements: true }),
  );
  fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 420 } } });
  await waitFor(() =>
    expect(
      screen.getByTestId('date-time-picker-content', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('auto'),
  );
}

const CONTROLLED_VALUE: { date: CalendarDate; time: ClockTime } = {
  date: { day: 15, month: 1, year: 2026 },
  time: { hour: 13, minute: 30 },
};

describe('BeeUI issue #176 DateTimePicker time-field screen-reader names', () => {
  it('gives the hour/minute/period controls default, distinguishable accessibility labels', async () => {
    const screen = renderDateTimePicker(
      <DateTimePicker testID="date-time-picker" value={CONTROLLED_VALUE} />,
    );
    await open(screen);

    expect(screen.getByTestId('date-time-picker-time-hour').props.accessibilityLabel).toBe('Hour');
    expect(screen.getByTestId('date-time-picker-time-minute').props.accessibilityLabel).toBe('Minute');
    expect(screen.getByTestId('date-time-picker-time-period').props.accessibilityLabel).toBe('AM or PM');
  });

  it('honors explicit hour/minute/period accessibility label overrides', async () => {
    const screen = renderDateTimePicker(
      <DateTimePicker
        hourAccessibilityLabel="Appointment hour"
        minuteAccessibilityLabel="Appointment minute"
        periodAccessibilityLabel="Morning or afternoon"
        testID="date-time-picker"
        value={CONTROLLED_VALUE}
      />,
    );
    await open(screen);

    expect(screen.getByTestId('date-time-picker-time-hour').props.accessibilityLabel).toBe('Appointment hour');
    expect(screen.getByTestId('date-time-picker-time-minute').props.accessibilityLabel).toBe(
      'Appointment minute',
    );
    expect(screen.getByTestId('date-time-picker-time-period').props.accessibilityLabel).toBe(
      'Morning or afternoon',
    );
  });

  it('omits the AM/PM control (and its accessibility label) entirely for a 24h locale, not merely hiding it visually', async () => {
    const screen = renderDateTimePicker(
      <DateTimePicker hour12={false} testID="date-time-picker" value={CONTROLLED_VALUE} />,
    );
    await open(screen);
    expect(screen.getByTestId('date-time-picker-time-hour')).toBeTruthy();
    expect(screen.queryByTestId('date-time-picker-time-period')).toBeNull();
  });
});
