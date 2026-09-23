import { render } from '@testing-library/react-native';
import * as React from 'react';
// Explicit `.native`/`.web` suffixes (see `issue-173-date-picker-native.test.tsx`/
// `issue-173-date-picker-web.test.tsx`): Jest's default RN platform resolution
// picks `.native.tsx` for an extensionless `./date-picker` import.
import { DatePicker as NativeDatePicker } from '../../../packages/ui/src/components/date-picker.native';
import { DatePicker as WebDatePicker } from '../../../packages/ui/src/components/date-picker.web';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// `DatePicker.locale` only localized the *formatted selected value* (via
// `Intl.DateTimeFormat`) — the empty-value placeholder copy ("Select a date")
// stayed hardcoded English regardless of `locale`. A small built-in
// placeholder dictionary derives the default from `locale` when the caller
// does not pass an explicit `placeholder`.

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

describe('DatePicker locale-derived default placeholder (native)', () => {
  it('defaults to the English copy for locale="en-US"', () => {
    const screen = render(<NativeDatePicker locale="en-US" testID="date-picker" value={null} />);
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Select a date');
  });

  it('derives the vi-VN copy from locale when placeholder is omitted', () => {
    const screen = render(<NativeDatePicker locale="vi-VN" testID="date-picker" value={null} />);
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Chọn ngày');
  });

  it('lets an explicit placeholder override the locale-derived default', () => {
    const screen = render(
      <NativeDatePicker locale="vi-VN" placeholder="Pick one" testID="date-picker" value={null} />,
    );
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Pick one');
  });
});

describe('DatePicker locale-derived default placeholder (Web)', () => {
  it('derives the vi-VN copy from locale when placeholder is omitted', () => {
    const screen = render(
      <OverlayRuntimeProvider>
        <WebDatePicker locale="vi-VN" testID="date-picker" value={null} />
      </OverlayRuntimeProvider>,
    );
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Chọn ngày');
  });
});
