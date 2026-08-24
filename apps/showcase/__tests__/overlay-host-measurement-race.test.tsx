const mockHostMeasureCallbacks: Array<
  (x: number, y: number, width: number, height: number) => void
> = [];

jest.mock('react-native', () => {
  const React = require('react');
  const actual = jest.requireActual('react-native');
  const OriginalView = actual.View;
  const MockView = React.forwardRef(
    ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => mockHostMeasureCallbacks.push(callback),
      }));
      return React.createElement(OriginalView, props, children);
    },
  );
  MockView.displayName = 'MockMeasuredView';

  // React Native exposes several lazy getters. Spreading the module eagerly reads
  // all of them and pulls native-only TurboModules such as DevMenu into Jest. Keep
  // the real module lazy and override only View, which is the ref seam under test.
  return new Proxy(actual, {
    get(target: Record<PropertyKey, unknown>, property: PropertyKey, receiver: unknown) {
      if (property === 'View') return MockView;
      return Reflect.get(target, property, receiver as object);
    },
  });
});

jest.mock('react-native-teleport', () => {
  const React = require('react');
  return {
    PortalProvider: ({ children }: { children?: React.ReactNode }) => children,
    PortalHost: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  OverlayRuntimeProvider,
  useOverlayEnvironment,
} from '../../../packages/ui/src/components/overlay-runtime';

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

afterEach(() => {
  mockHostMeasureCallbacks.length = 0;
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
});

describe('overlay host latest-measurement-wins contract', () => {
  it('ignores an older host measureInWindow callback that resolves after a newer request', async () => {
    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
    jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);

    function HostProbe() {
      const { hostRect } = useOverlayEnvironment();
      return (
        <Text testID="host-probe">
          {hostRect ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}` : 'null'}
        </Text>
      );
    }

    const screen = render(
      <OverlayRuntimeProvider>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 10, y: 10, width: 500, height: 500 } },
      });
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 20, y: 20, width: 600, height: 600 } },
      });
    });

    await waitFor(() => expect(mockHostMeasureCallbacks.length).toBeGreaterThanOrEqual(2));
    const older = mockHostMeasureCallbacks.at(-2)!;
    const newer = mockHostMeasureCallbacks.at(-1)!;

    await act(async () => newer(20, 20, 600, 600));
    await waitFor(() =>
      expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
        '20,20,600,600',
      ),
    );

    await act(async () => older(10, 10, 500, 500));
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '20,20,600,600',
    );
  });
});
