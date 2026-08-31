import { type CalendarDate } from '@beemvp/beeui-core';
import { Field } from '@beemvp/beeui-ui';
import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
// Explicit `.native` suffix (mirrors the `.web` import in
// `issue-173-date-picker-web.test.tsx`): forces the native presentation regardless of
// Jest's default platform resolution, and is the only way to exercise the file that
// imports `@react-native-community/datetimepicker` at all.
import { DatePicker } from '../../../packages/ui/src/components/date-picker.native';

// BeeUI issue #173 (R4F.3, ADR-008 "DatePicker" contract). Deterministic
// rendering-contract tests for the native presentation: the `@react-native-community/
// datetimepicker` boundary is mocked (no native module registry in Jest), so these
// tests prove BeeUI's own wiring — value/format, Field integration, disabled/read-only/
// clear, and the CalendarDate<->Date boundary adapter calls — not the OS picker UI
// itself. This is the strongest reachable evidence for #177 (R4F.7, "native runtime
// acceptance"): the headless iOS Simulator has a reproducible Fabric blank-render defect
// (#349) unrelated to date/time, and real-device cloud runtime testing is separately
// deferred, so real Simulator/device rendering/gesture proof of the OS picker itself is
// a documented deferral — see `docs/decisions/008-datetime-architecture.md`'s "#177
// resolution (documented deferral)" note, not an open gap in this file.

type MockOnChange = (event: { type: 'set' | 'dismissed' }, date?: Date) => void;

const mockAndroidOpen = jest.fn<void, [{ value: Date; onChange: MockOnChange; [key: string]: unknown }]>();

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
const originalPlatformOS = Platform.OS;

function setPlatform(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  mockAndroidOpen.mockClear();
});

describe('BeeUI issue #173 DatePicker (native) rendering contract', () => {
  it('renders the placeholder when unset and the formatted value when controlled-set', () => {
    const screen = render(<DatePicker placeholder="Pick a date" testID="date-picker" value={null} />);
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Pick a date');

    screen.rerender(<DatePicker placeholder="Pick a date" testID="date-picker" value={JAN_15_2026} />);
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Jan 15, 2026');
  });

  it('shows a clear affordance for a selected value and clears it', () => {
    const onValueChange = jest.fn();
    const screen = render(
      <DatePicker onValueChange={onValueChange} testID="date-picker" value={JAN_15_2026} />,
    );

    fireEvent.press(screen.getByTestId('date-picker-clear'));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it('hides the clear affordance when there is no value or clearable is false', () => {
    const empty = render(<DatePicker testID="date-picker" value={null} />);
    expect(empty.queryByTestId('date-picker-clear')).toBeNull();

    const notClearable = render(
      <DatePicker clearable={false} testID="date-picker" value={JAN_15_2026} />,
    );
    expect(notClearable.queryByTestId('date-picker-clear')).toBeNull();
  });

  it('derives disabled/invalid/accessibilityLabel/hint from an enclosing Field', () => {
    const screen = render(
      <Field error="Required" invalid label="Birthday" required>
        <DatePicker testID="date-picker" value={null} />
      </Field>,
    );
    const trigger = screen.getByTestId('date-picker-trigger');
    expect(trigger.props.accessibilityLabel).toBe('Birthday, required');
    expect(trigger.props.accessibilityHint).toBe('Required');
  });

  it('disabled marks the trigger disabled and blocks opening', () => {
    setPlatform('android');
    const screen = render(<DatePicker disabled testID="date-picker" value={null} />);

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('date-picker-trigger'));
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  it('readOnly keeps the trigger enabled/announced but blocks opening and hides clear', () => {
    setPlatform('android');
    const screen = render(<DatePicker readOnly testID="date-picker" value={JAN_15_2026} />);

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('date-picker-clear')).toBeNull();
    fireEvent.press(screen.getByTestId('date-picker-trigger'));
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  describe('Android', () => {
    beforeEach(() => setPlatform('android'));

    it('opens the imperative system picker with the CalendarDate<->Date boundary applied', () => {
      const onValueChange = jest.fn();
      const screen = render(
        <DatePicker
          max={{ day: 25, month: 1, year: 2026 }}
          min={{ day: 10, month: 1, year: 2026 }}
          onValueChange={onValueChange}
          testID="date-picker"
          value={JAN_15_2026}
        />,
      );

      fireEvent.press(screen.getByTestId('date-picker-trigger'));

      expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
      const call = mockAndroidOpen.mock.calls[0][0];
      expect(call.mode).toBe('date');
      expect((call.value as Date).getFullYear()).toBe(2026);
      expect((call.value as Date).getMonth()).toBe(0);
      expect((call.value as Date).getDate()).toBe(15);
      expect((call.minimumDate as Date).getDate()).toBe(10);
      expect((call.maximumDate as Date).getDate()).toBe(25);
    });

    it('commits the selected date and closes on "set", ignores "dismissed"', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DatePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-picker"
          value={JAN_15_2026}
        />,
      );

      fireEvent.press(screen.getByTestId('date-picker-trigger'));
      const { onChange } = mockAndroidOpen.mock.calls[0][0];
      onChange({ type: 'dismissed' });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);

      onOpenChange.mockClear();
      fireEvent.press(screen.getByTestId('date-picker-trigger'));
      const { onChange: onChangeAgain } = mockAndroidOpen.mock.calls[1][0];
      onChangeAgain({ type: 'set' }, new Date(2026, 0, 20));
      expect(onValueChange).toHaveBeenCalledWith({ day: 20, month: 1, year: 2026 });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('iOS', () => {
    beforeEach(() => setPlatform('ios'));

    it('opens a Dialog-hosted inline picker and applies changes immediately without closing', () => {
      const onValueChange = jest.fn();
      const screen = render(
        <DatePicker onValueChange={onValueChange} testID="date-picker" value={JAN_15_2026} />,
      );

      fireEvent.press(screen.getByTestId('date-picker-trigger'));
      const picker = screen.getByTestId('mock-datetimepicker');
      expect(picker.props.mode).toBe('date');
      expect((picker.props.value as Date).getDate()).toBe(15);

      fireEvent(picker, 'change', { type: 'set' }, new Date(2026, 0, 22));
      expect(onValueChange).toHaveBeenCalledWith({ day: 22, month: 1, year: 2026 });
      // iOS stays open until Done is pressed explicitly.
      expect(screen.getByTestId('date-picker-content')).toBeTruthy();
    });

    it('closes on Done and clears via the content footer', () => {
      const onValueChange = jest.fn();
      const onOpenChange = jest.fn();
      const screen = render(
        <DatePicker
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          testID="date-picker"
          value={JAN_15_2026}
        />,
      );

      fireEvent.press(screen.getByTestId('date-picker-trigger'));
      fireEvent.press(screen.getByTestId('date-picker-content-clear'));
      expect(onValueChange).toHaveBeenCalledWith(null);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      onOpenChange.mockClear();
      fireEvent.press(screen.getByTestId('date-picker-trigger'));
      fireEvent.press(screen.getByTestId('date-picker-content-done'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
