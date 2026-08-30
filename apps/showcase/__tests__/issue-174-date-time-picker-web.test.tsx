import { type CalendarDate } from '@beeui/core';
import { Field } from '@beeui/ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.web` suffix (mirrors `issue-173-date-picker-web.test.tsx`): Jest's default
// RN/`jest-expo` platform resolution picks the `.native.tsx` sibling for an
// extensionless `./date-time-picker` import, so exercising the Web presentation
// deterministically requires importing this exact file rather than going through the
// `@beeui/ui` barrel.
import { DateTimePicker } from '../../../packages/ui/src/components/date-time-picker.web';
import type { DateTimePickerValue } from '../../../packages/ui/src/components/date-time-picker-shared';

// BeeUI issue #174 (R4F.4, ADR-008 "DateTimePicker" contract). Deterministic
// rendering-contract tests for the Web presentation: controlled value/formatting, date
// selection composing with the existing/default time, time-field digit entry composing
// with the existing/default date, explicit clear policy, bounds/disabled-date
// forwarding to `Calendar`, `Field` integration, and disabled/read-only/controlled-open
// edge cases. Browser interaction evidence (keyboard grid navigation, Escape, focus
// restoration) is Playwright's responsibility
// (`apps/visual-regression/tests/date-time-picker-showcase.spec.ts`), not this file's.

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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 640 };
const TRIGGER_RECT = { x: 20, y: 40, width: 200, height: 44 };
const JAN_15_2026: CalendarDate = { day: 15, month: 1, year: 2026 };
const JAN_15_2026_1PM: DateTimePickerValue = { date: JAN_15_2026, time: { hour: 13, minute: 5 } };

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

describe('BeeUI issue #174 DateTimePicker (Web) rendering contract', () => {
  it('renders the placeholder when unset and the formatted value when controlled-set', () => {
    const screen = renderDateTimePicker(
      <DateTimePicker placeholder="Pick a date and time" testID="date-time-picker" value={null} />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Pick a date and time');

    screen.rerender(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <DateTimePicker
          placeholder="Pick a date and time"
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />
      </OverlayRuntimeProvider>,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Jan 15, 2026, 1:05 PM');
  });

  it('supports a custom formatValue override', () => {
    const screen = renderDateTimePicker(
      <DateTimePicker
        formatValue={(value) => `${value.date.year}/${value.date.month}/${value.date.day} ${value.time.hour}:${value.time.minute}`}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('2026/1/15 13:5');
  });

  it('opens Calendar+time in a Popover and selecting a day keeps the popover open, composing with the existing time', async () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(false);
    await open(screen);
    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(true);
    onOpenChange.mockClear();

    fireEvent.press(screen.getByTestId('date-time-picker-calendar-day-2026-01-20'));

    expect(onValueChange).toHaveBeenCalledWith({
      date: { day: 20, month: 1, year: 2026 },
      time: { hour: 13, minute: 5 },
    });
    // Selecting a day does not close the popover — there is still a time part to set.
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('date-time-picker-content-done'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('composes a time-field commit with the existing date, defaulting to today when unset', async () => {
    const onValueChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker onValueChange={onValueChange} testID="date-time-picker" value={null} />,
    );

    await open(screen);
    const hourInput = screen.getByTestId('date-time-picker-time-hour');
    fireEvent.changeText(hourInput, '05');
    fireEvent(hourInput, 'blur');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const [committed] = onValueChange.mock.calls[0];
    expect(committed.time.minute).toBe(0);
    expect(committed.date).toBeTruthy();
  });

  it('commits hour/minute digit entry on blur, clamping out-of-range input, in 24h mode', async () => {
    const onValueChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker
        hour12={false}
        onValueChange={onValueChange}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );
    await open(screen);

    const hourInput = screen.getByTestId('date-time-picker-time-hour');
    fireEvent.changeText(hourInput, '99');
    fireEvent(hourInput, 'blur');
    expect(onValueChange).toHaveBeenLastCalledWith({
      date: JAN_15_2026,
      time: { hour: 23, minute: 5 },
    });

    const minuteInput = screen.getByTestId('date-time-picker-time-minute');
    fireEvent.changeText(minuteInput, '7');
    fireEvent(minuteInput, 'blur');
    expect(onValueChange).toHaveBeenLastCalledWith({
      date: JAN_15_2026,
      time: { hour: 13, minute: 7 },
    });
  });

  it('shows an AM/PM SegmentedControl in 12h mode and toggling it recomputes the 24h hour', async () => {
    const onValueChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker
        hour12
        onValueChange={onValueChange}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );
    await open(screen);

    expect(screen.getByTestId('date-time-picker-time-hour').props.value).toBe('01');
    fireEvent.press(screen.getByTestId('date-time-picker-time-period-am'));

    expect(onValueChange).toHaveBeenCalledWith({
      date: JAN_15_2026,
      time: { hour: 1, minute: 5 },
    });
  });

  it('hides the AM/PM control in 24h mode', async () => {
    const screen = renderDateTimePicker(
      <DateTimePicker hour12={false} testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );
    await open(screen);
    expect(screen.queryByTestId('date-time-picker-time-period')).toBeNull();
    expect(screen.getByTestId('date-time-picker-time-hour').props.value).toBe('13');
  });

  it('shows a clear affordance for a selected value and clears without opening the popover', () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );

    fireEvent.press(screen.getByTestId('date-time-picker-clear'));

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('hides the clear affordance when there is no value or clearable is false', () => {
    const empty = renderDateTimePicker(<DateTimePicker testID="date-time-picker" value={null} />);
    expect(empty.queryByTestId('date-time-picker-clear')).toBeNull();

    const notClearable = renderDateTimePicker(
      <DateTimePicker clearable={false} testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );
    expect(notClearable.queryByTestId('date-time-picker-clear')).toBeNull();
  });

  it('forwards min/max/isDateDisabled to the inner Calendar and blocks disabled-day selection', async () => {
    const onValueChange = jest.fn();
    const isDateDisabled = (date: CalendarDate) => date.day === 20;
    const screen = renderDateTimePicker(
      <DateTimePicker
        isDateDisabled={isDateDisabled}
        max={{ day: 25, month: 1, year: 2026 }}
        min={{ day: 10, month: 1, year: 2026 }}
        onValueChange={onValueChange}
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );
    await open(screen);

    expect(
      screen.getByTestId('date-time-picker-calendar-day-2026-01-05').props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('date-time-picker-calendar-day-2026-01-20').props.accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('date-time-picker-calendar-day-2026-01-20'));
    fireEvent.press(screen.getByTestId('date-time-picker-calendar-day-2026-01-05'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('derives disabled/invalid/accessibilityLabel/hint from an enclosing Field', () => {
    const screen = renderDateTimePicker(
      <Field error="Required" invalid label="Appointment" required>
        <DateTimePicker testID="date-time-picker" value={null} />
      </Field>,
    );
    const trigger = screen.getByTestId('date-time-picker-trigger');
    expect(trigger.props.accessibilityLabel).toBe('Appointment, required');
    expect(trigger.props.accessibilityHint).toBe('Required');
  });

  it('ORs its own disabled/invalid with the Field, never weakening either', () => {
    const screen = renderDateTimePicker(
      <Field disabled={false} label="Appointment">
        <DateTimePicker disabled testID="date-time-picker" value={null} />
      </Field>,
    );
    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.disabled).toBe(true);
  });

  it('disabled marks the trigger disabled and blocks opening', () => {
    const onOpenChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker disabled onOpenChange={onOpenChange} testID="date-time-picker" value={null} />,
    );

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('readOnly keeps the trigger enabled/announced but blocks opening and hides clear', () => {
    const onOpenChange = jest.fn();
    const screen = renderDateTimePicker(
      <DateTimePicker onOpenChange={onOpenChange} readOnly testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('date-time-picker-clear')).toBeNull();

    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('supports a fully controlled open state without mutating it itself', () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <View>
          <DateTimePicker onOpenChange={setOpen} open={open} testID="date-time-picker" value={null} />
        </View>
      );
    }
    const screen = renderDateTimePicker(<Harness />);

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(false);
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.expanded).toBe(true);
  });
});
