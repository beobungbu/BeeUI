import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@beemvp/beeui-ui';
import { Platform } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Astra review #2, item 9: `SelectContent.scrollViewProps` was typed as `ScrollViewProps`
// even though the Web host renders a plain overflow `View`, not a `ScrollView` (#612 — a
// real `ScrollView` on Web can swallow a mouse press on an option once the list overflows).
// A ScrollView-only prop like `keyboardShouldPersistTaps` type-checked fine there but had no
// effect at runtime. `scrollViewProps` is now native-only; Web's own plain `View` wrapper
// takes the separate `listProps`, typed to what a `View` actually honours. This is a
// type-level contract — every assertion here is enforced by `tsc`, not by the render (the
// render only proves the surviving, type-correct usages still mount).
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };
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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };

function renderSelect(children: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>);
}

describe('SelectContent scrollViewProps/listProps type split', () => {
  const originalPlatformOS = Platform.OS;
  afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS }));

  it('accepts a ScrollView-only prop through scrollViewProps', () => {
    expect(() =>
      renderSelect(
        <Select>
          <SelectTrigger accessibilityLabel="Choose" />
          <SelectContent scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });

  it('rejects a ScrollView-only prop through listProps at compile time', () => {
    expect(() =>
      renderSelect(
        <Select>
          <SelectTrigger accessibilityLabel="Choose" />
          <SelectContent
            // @ts-expect-error - `keyboardShouldPersistTaps` is a ScrollView-only prop; `listProps` wraps a plain `View` on Web and does not accept it.
            listProps={{ keyboardShouldPersistTaps: 'handled' }}
          >
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });

  it('keeps legacy Web View-compatible scrollViewProps non-silent during migration', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const screen = renderSelect(
      <Select defaultOpen>
        <SelectTrigger accessibilityLabel="Choose" />
        <SelectContent listProps={{ testID: 'new-select-list' }} scrollViewProps={{ testID: 'legacy-select-list' }}>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(
      screen.getByTestId('new-select-list', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scrollViewProps'));
    warn.mockRestore();
  });

  it('accepts a plain View prop through listProps', () => {
    expect(() =>
      renderSelect(
        <Select>
          <SelectTrigger accessibilityLabel="Choose" />
          <SelectContent listProps={{ testID: 'select-list' }}>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });
});
