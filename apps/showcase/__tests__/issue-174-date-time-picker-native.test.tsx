import { type CalendarDate } from '@beeui/core';
import { Field } from '@beeui/ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
// Explicit `.native` suffix (mirrors `issue-173-date-picker-native.test.tsx`): forces
// the native presentation regardless of Jest's default platform resolution, and is the
// only way to exercise the file that imports `@react-native-community/datetimepicker`
// at all.
import { DateTimePicker } from '../../../packages/ui/src/components/date-time-picker.native';
import type { DateTimePickerValue } from '../../../packages/ui/src/components/date-time-picker-shared';

// BeeUI issue #174 (R4F.4, ADR-008 "DateTimePicker" contract). Deterministic
// rendering-contract tests for the native presentation: the `@react-native-community/
// datetimepicker` boundary is mocked (no native module registry in Jest), so these
// tests prove BeeUI's own wiring — value/format, Field integration, disabled/read-only/
// clear, Android's two-step date-then-time chained flow, and the
// `{ date, time }` <-> `Date` boundary adapter calls — not the OS picker UI itself.
// Real device/simulator proof is owed to native runtime acceptance (#176/#177), per
// this file's own "known 1.0 limitation" comment in `date-time-picker.native.tsx`.

type MockOnChange = (event: { type: 'set' | 'dismissed' }, date?: Date) => void;

const mockAndroidOpen = jest.fn<
  void,
  [{ value: Date; onChange: MockOnChange; mode: string; [key: string]: unknown }]
>();

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockDateTimePicker = ReactActual.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactActual.createElement(View, { ...props, ref, testID: props.testID ?? 'mock-datetimepicker' }),
  );
  return {
    __esModule: true,
    default: MockDateTimePicker,
    DateTimePickerAndroid: {
      open: (...args: unknown[]) => mockAndroidOpen(...(args as [never])),
      dismiss: jest.fn(),
    },
  };
});

const JAN_15_2026: CalendarDate = { day: 15, month: 1, year: 2026 };
const JAN_15_2026_1PM: DateTimePickerValue = { date: JAN_15_2026, time: { hour: 13, minute: 5 } };
const originalPlatformOS = Platform.OS;

function setPlatform(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  mockAndroidOpen.mockClear();
});

describe('BeeUI issue #174 DateTimePicker (native) rendering contract', () => {
  it('renders the placeholder when unset and the formatted value when controlled-set', () => {
    const screen = render(
      <DateTimePicker placeholder="Pick a date and time" testID="date-time-picker" value={null} />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Pick a date and time');

    screen.rerender(
      <DateTimePicker
        placeholder="Pick a date and time"
        testID="date-time-picker"
        value={JAN_15_2026_1PM}
      />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Jan 15, 2026, 1:05 PM');
  });

  it('shows a clear affordance for a selected value and clears it', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <DateTimePicker onValueChange={onValueChange} testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );

    fireEvent.press(screen.getByTestId('date-time-picker-clear'));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it('hides the clear affordance when there is no value or clearable is false', () => {
    const empty = render(<DateTimePicker testID="date-time-picker" value={null} />);
    expect(empty.queryByTestId('date-time-picker-clear')).toBeNull();

    const notClearable = render(
      <DateTimePicker clearable={false} testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );
    expect(notClearable.queryByTestId('date-time-picker-clear')).toBeNull();
  });

  it('derives disabled/invalid/accessibilityLabel/hint from an enclosing Field', () => {
    const screen = render(
      <Field error="Required" invalid label="Appointment" required>
        <DateTimePicker testID="date-time-picker" value={null} />
      </Field>,
    );
    const trigger = screen.getByTestId('date-time-picker-trigger');
    expect(trigger.props.accessibilityLabel).toBe('Appointment, required');
    expect(trigger.props.accessibilityHint).toBe('Required');
  });

  it('disabled marks the trigger disabled and blocks opening', () => {
    setPlatform('android');
    const screen = render(<DateTimePicker disabled testID="date-time-picker" value={null} />);

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  it('readOnly keeps the trigger enabled/announced but blocks opening and hides clear', () => {
    setPlatform('android');
    const screen = render(<DateTimePicker readOnly testID="date-time-picker" value={JAN_15_2026_1PM} />);

    expect(screen.getByTestId('date-time-picker-trigger').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('date-time-picker-clear')).toBeNull();
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  describe('Android — no native "datetime" mode, so date and time are chained steps', () => {
    beforeEach(() => setPlatform('android'));

    it('opens the date step first with the CalendarDate<->Date boundary applied', () => {
      const screen = render(
        <DateTimePicker
          max={{ day: 25, month: 1, year: 2026 }}
          min={{ day: 10, month: 1, year: 2026 }}
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));

      expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
      const call = mockAndroidOpen.mock.calls[0][0];
      expect(call.mode).toBe('date');
      expect((call.value as Date).getFullYear()).toBe(2026);
      expect((call.value as Date).getDate()).toBe(15);
      expect((call.value as Date).getHours()).toBe(13);
      expect((call.minimumDate as Date).getDate()).toBe(10);
      expect((call.maximumDate as Date).getDate()).toBe(25);
    });

    it('chains into the time step on "set" and commits the composed value on the time step\'s "set"', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DateTimePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      const { onChange: onDateChange } = mockAndroidOpen.mock.calls[0][0];
      onDateChange({ type: 'set' }, new Date(2026, 0, 20, 13, 5));

      expect(mockAndroidOpen).toHaveBeenCalledTimes(2);
      const timeCall = mockAndroidOpen.mock.calls[1][0];
      expect(timeCall.mode).toBe('time');
      expect(onValueChange).not.toHaveBeenCalled();

      const { onChange: onTimeChange } = timeCall;
      onTimeChange({ type: 'set' }, new Date(2026, 0, 20, 16, 30));

      expect(onValueChange).toHaveBeenCalledWith({
        date: { day: 20, month: 1, year: 2026 },
        time: { hour: 16, minute: 30 },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('cancels the whole flow without committing when the date step is dismissed', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DateTimePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      const { onChange } = mockAndroidOpen.mock.calls[0][0];
      onChange({ type: 'dismissed' });

      expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('cancels without committing when the time step is dismissed after a date is chosen', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DateTimePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      const { onChange: onDateChange } = mockAndroidOpen.mock.calls[0][0];
      onDateChange({ type: 'set' }, new Date(2026, 0, 20, 13, 5));
      const { onChange: onTimeChange } = mockAndroidOpen.mock.calls[1][0];
      onTimeChange({ type: 'dismissed' });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('maps hour12 to the time step\'s is24Hour', () => {
      const screen = render(
        <DateTimePicker hour12={false} testID="date-time-picker" value={JAN_15_2026_1PM} />,
      );
      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      const { onChange: onDateChange } = mockAndroidOpen.mock.calls[0][0];
      onDateChange({ type: 'set' }, new Date(2026, 0, 20, 13, 5));

      const timeCall = mockAndroidOpen.mock.calls[1][0];
      expect(timeCall.is24Hour).toBe(true);
    });
  });

  describe('iOS — a single native "datetime" widget inside a Dialog', () => {
    beforeEach(() => setPlatform('ios'));

    it('opens a Dialog-hosted inline datetime picker and applies changes immediately without closing', () => {
      const onValueChange = jest.fn();
      const screen = render(
        <DateTimePicker onValueChange={onValueChange} testID="date-time-picker" value={JAN_15_2026_1PM} />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      const picker = screen.getByTestId('mock-datetimepicker');
      expect(picker.props.mode).toBe('datetime');
      expect((picker.props.value as Date).getDate()).toBe(15);
      expect((picker.props.value as Date).getHours()).toBe(13);

      fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 0, 22, 9, 30));
      expect(onValueChange).toHaveBeenCalledWith({
        date: { day: 22, month: 1, year: 2026 },
        time: { hour: 9, minute: 30 },
      });
      // iOS stays open until Done is pressed explicitly.
      expect(screen.getByTestId('date-time-picker-content')).toBeTruthy();
    });

    it('closes on Done and clears via the content footer', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DateTimePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-time-picker"
          value={JAN_15_2026_1PM}
        />,
      );

      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      fireEvent.press(screen.getByTestId('date-time-picker-content-clear'));
      expect(onValueChange).toHaveBeenCalledWith(null);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      onOpenChange.mockClear();
      fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
      fireEvent.press(screen.getByTestId('date-time-picker-content-done'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
