import { type CalendarDate } from '@beemvp/beeui-core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.native`/`.web` suffixes (see `issue-174-date-time-picker-native.test.tsx`/
// `issue-174-date-time-picker-web.test.tsx`): Jest's default RN platform resolution
// picks `.native.tsx` for an extensionless `./date-time-picker` import.
import { DateTimePicker as NativeDateTimePicker } from '../../../packages/ui/src/components/date-time-picker.native';
import { DateTimePicker as WebDateTimePicker } from '../../../packages/ui/src/components/date-time-picker.web';
import type { DateTimePickerValue } from '../../../packages/ui/src/components/date-time-picker-shared';

// `DateTimePicker.locale` only localized the *formatted selected value* (via
// `Intl.DateTimeFormat`) — the empty-value placeholder copy ("Select a date and time")
// and the "Done" footer button both stayed hardcoded English regardless of `locale`,
// the same gap `date-picker-locale-placeholder.test.tsx` covers for `DatePicker`. A
// small built-in dictionary (`date-time-picker-locale.ts`) derives both from `locale`.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
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

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const MockDateTimePicker = ReactActual.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactActual.createElement(RNView, { ...props, ref, testID: props.testID ?? 'mock-datetimepicker' }),
  );
  return {
    __esModule: true,
    default: MockDateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

const JAN_15_2026: CalendarDate = { day: 15, month: 1, year: 2026 };
const JAN_15_2026_1PM: DateTimePickerValue = { date: JAN_15_2026, time: { hour: 13, minute: 5 } };
const HOST_RECT = { x: 0, y: 0, width: 320, height: 640 };
const TRIGGER_RECT = { x: 20, y: 40, width: 200, height: 44 };
const originalPlatformOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  clearActiveAnchorSeam();
});

describe('DateTimePicker locale-derived default placeholder (native)', () => {
  it('defaults to the English copy for locale="en-US"', () => {
    const screen = render(
      <NativeDateTimePicker locale="en-US" testID="date-time-picker" value={null} />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe(
      'Select a date and time',
    );
  });

  it('derives the vi-VN copy from locale when placeholder is omitted', () => {
    const screen = render(
      <NativeDateTimePicker locale="vi-VN" testID="date-time-picker" value={null} />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Chọn ngày và giờ');
  });

  it('lets an explicit placeholder override the locale-derived default', () => {
    const screen = render(
      <NativeDateTimePicker
        locale="vi-VN"
        placeholder="Pick one"
        testID="date-time-picker"
        value={null}
      />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Pick one');
  });

  it('localizes the iOS Dialog footer "Done" button from locale', () => {
    setPlatform('ios');
    const screen = render(
      <NativeDateTimePicker locale="vi-VN" testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    expect(screen.getByText('Xong')).toBeTruthy();
  });
});

describe('DateTimePicker locale-derived default placeholder (Web)', () => {
  function renderWeb(ui: React.ReactNode) {
    createAnchorSeam({
      match: (testID) => testID === 'date-time-picker-trigger',
      rectFor: () => TRIGGER_RECT,
      modalHostRect: HOST_RECT,
    });
    return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>);
  }

  it('derives the vi-VN copy from locale when placeholder is omitted', () => {
    const screen = renderWeb(
      <WebDateTimePicker locale="vi-VN" testID="date-time-picker" value={null} />,
    );
    expect(screen.getByTestId('date-time-picker-value').props.children).toBe('Chọn ngày và giờ');
  });

  it('localizes the Popover footer "Done" button from locale', async () => {
    const screen = renderWeb(
      <WebDateTimePicker locale="vi-VN" testID="date-time-picker" value={JAN_15_2026_1PM} />,
    );
    fireEvent.press(screen.getByTestId('date-time-picker-trigger'));
    const content = await waitFor(() =>
      screen.getByTestId('date-time-picker-content', { includeHiddenElements: true }),
    );
    fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 420 } } });
    await waitFor(() => expect(screen.getByText('Xong')).toBeTruthy());
  });
});
