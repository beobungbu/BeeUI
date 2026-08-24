import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  OverlayRuntimeProvider,
  OverlayScopeContext,
  useAnchoredOverlayPosition,
  type OverlayDismissController,
} from '../../../packages/ui/src/components/overlay-runtime';

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

const ROOT_RECT = { x: 0, y: 0, width: 1000, height: 800 };
const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
});

describe('anchor host-revision render/effect gap', () => {
  it('rejects a stale old-host unavailable callback before the new-host passive remeasure runs', async () => {
    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
    jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);

    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const onAnchorUnavailable = jest.fn();
    let staleHostACallback:
      | ((x: number, y: number, width: number, height: number) => void)
      | undefined;

    const controller: OverlayDismissController = {
      register: () => undefined,
      unregister: () => undefined,
      isTopmost: () => false,
      dismissIfTopmost: () => false,
      dismissTop: () => false,
    };
    const hostA = { x: 0, y: 0, width: 1000, height: 800 };
    const hostB = { x: 50, y: 40, width: 800, height: 600 };
    const makeScope = (hostRect: typeof hostA) => ({
      hostName: 'render-effect-gap-host',
      isModal: true,
      depth: 1,
      hostRect,
      remeasureHost: () => undefined,
      controller,
    });

    function Probe() {
      const anchorRef = React.useRef({
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callbacks.push(callback),
      });
      const { anchorRect } = useAnchoredOverlayPosition({
        anchorRef,
        avoidSafeArea: false,
        onAnchorUnavailable,
        open: true,
      });
      return <Text testID="revision-gap-probe">{anchorRect ? 'anchor' : 'pending'}</Text>;
    }

    function FireStaleCallbackInLayout({ fire }: { fire: boolean }) {
      React.useLayoutEffect(() => {
        if (fire && staleHostACallback) {
          staleHostACallback(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
        }
      }, [fire]);
      return null;
    }

    const renderTree = (hostRect: typeof hostA, fireStaleCallback: boolean) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <Probe />
          <FireStaleCallbackInLayout fire={fireStaleCallback} />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    const screen = render(renderTree(hostA, false));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));
    staleHostACallback = callbacks.at(-1)!;

    // The rerender commits host B first. Layout effects then run before the hook's
    // passive host-revision remeasure effect. Firing the pending host-A callback in
    // this exact gap means its generation is still current; only the requested-host
    // revision guard may reject it. Without that guard this invokes
    // onAnchorUnavailable spuriously.
    await act(async () => screen.rerender(renderTree(hostB, true)));

    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(screen.getByTestId('revision-gap-probe', { includeHiddenElements: true }).props.children).toBe(
      'pending',
    );

    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));
    const hostBCallback = callbacks.at(-1)!;
    expect(hostBCallback).not.toBe(staleHostACallback);

    await act(async () => hostBCallback(260, 210, 40, 20));
    await waitFor(() =>
      expect(
        screen.getByTestId('revision-gap-probe', { includeHiddenElements: true }).props.children,
      ).toBe('anchor'),
    );
    expect(onAnchorUnavailable).not.toHaveBeenCalled();
  });
});
