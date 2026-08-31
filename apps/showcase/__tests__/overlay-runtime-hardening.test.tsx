import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beemvp/beeui-ui';
import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { BackHandler, Modal, Platform, Text, UIManager } from 'react-native';
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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const ROOT_RECT = { x: 0, y: 0, width: 1000, height: 800 };
const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
const originalPlatformOS = Platform.OS;

function setTeleportAvailable() {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);
}

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
});

describe('native Modal presentation contract', () => {
  beforeEach(() => {
    setTeleportAvailable();
    setPlatform('ios');
  });

  it.each([
    ['pageSheet', false],
    ['formSheet', false],
    ['fullScreen', false],
    ['overFullScreen', true],
  ] as const)('maps %s to transparent=%s so RN can honor the requested presentation', (presentationStyle, transparent) => {
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <Dialog defaultOpen>
          <DialogContent modalProps={{ presentationStyle }}>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </OverlayRuntimeProvider>,
    );

    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.presentationStyle).toBe(presentationStyle);
    expect(modal.props.transparent).toBe(transparent);
  });
});

describe('semantic scope depth is independent of React effect order', () => {
  beforeEach(() => {
    setTeleportAvailable();
    setPlatform('android');
  });

  function capturePlatformDismissHandler() {
    let handler: (() => boolean) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_type: string, cb: () => boolean) => {
      handler = cb;
      return { remove: () => undefined };
    }) as typeof BackHandler.addEventListener);
    return () => handler;
  }

  it('initial-open root + Dialog menu dispatches to the modal scope, not the root scope', async () => {
    const getHandler = capturePlatformDismissHandler();
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <Popover defaultOpen>
          <PopoverTrigger testID="root-trigger">Root</PopoverTrigger>
          <PopoverContent avoidSafeArea={false}>
            <Text testID="root-body">root</Text>
          </PopoverContent>
        </Popover>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <DropdownMenu defaultOpen>
              <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem testID="menu-item">Item</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogContent>
        </Dialog>
      </OverlayRuntimeProvider>,
      {
        createNodeMock: (element: { props?: { testID?: string } }) =>
          /trigger$/.test(element.props?.testID ?? '')
            ? { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(100, 100, 40, 20) }
            : null,
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('root-body', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy();
    });

    await act(async () => getHandler()?.());
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('root-body', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true);
  });

  it('initial-open nested Dialog dispatches to the deepest active modal scope', async () => {
    const getHandler = capturePlatformDismissHandler();
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <Popover defaultOpen>
          <PopoverTrigger testID="root-trigger">Root</PopoverTrigger>
          <PopoverContent avoidSafeArea={false}>
            <Text testID="root-body">root</Text>
          </PopoverContent>
        </Popover>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Outer</DialogTitle>
            <Dialog defaultOpen>
              <DialogContent>
                <DialogTitle>Inner</DialogTitle>
                <DropdownMenu defaultOpen>
                  <DropdownMenuTrigger testID="inner-menu-trigger">Menu</DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem testID="inner-menu-item">Item</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      </OverlayRuntimeProvider>,
      {
        createNodeMock: (element: { props?: { testID?: string } }) =>
          /trigger$/.test(element.props?.testID ?? '')
            ? { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(100, 100, 40, 20) }
            : null,
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId('inner-menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    await act(async () => getHandler()?.());
    await waitFor(() =>
      expect(screen.queryByTestId('inner-menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('root-body', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(Modal).every((modal) => modal.props.visible)).toBe(true);
  });
});

describe('latest async measurement wins', () => {
  beforeEach(() => setTeleportAvailable());

  it('ignores an older anchor callback and stale unavailable result after a newer successful measure', async () => {
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const onAnchorUnavailable = jest.fn();
    let requestAnotherMeasure = () => undefined;

    const controller: OverlayDismissController = {
      register: () => undefined,
      unregister: () => undefined,
      isTopmost: () => false,
      dismissIfTopmost: () => false,
      dismissTop: () => false,
    };
    const scope = {
      hostName: 'race-host',
      isModal: true,
      depth: 1,
      hostRect: ROOT_RECT,
      remeasureHost: () => undefined,
      controller,
    };

    function Probe() {
      const anchorRef = React.useRef({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => callbacks.push(cb),
      });
      const { anchorRect, remeasure } = useAnchoredOverlayPosition({
        anchorRef,
        avoidSafeArea: false,
        onAnchorUnavailable,
        open: true,
      });
      requestAnotherMeasure = remeasure;
      return (
        <Text testID="anchor-probe">
          {anchorRect ? `${anchorRect.x},${anchorRect.y},${anchorRect.width},${anchorRect.height}` : 'null'}
        </Text>
      );
    }

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <OverlayScopeContext.Provider value={scope}>
          <Probe />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>,
    );

    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));
    const older = callbacks[0];
    await act(async () => requestAnotherMeasure());
    const newer = callbacks.at(-1)!;
    expect(newer).not.toBe(older);

    await act(async () => newer(300, 240, 40, 20));
    await waitFor(() =>
      expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
        '300,240,40,20',
      ),
    );

    // The stale request returns an invalid rect after the newer success. It must
    // neither overwrite anchorRect nor spuriously close the overlay.
    await act(async () => older(Number.NaN, Number.NaN, Number.NaN, Number.NaN));
    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      '300,240,40,20',
    );
    expect(onAnchorUnavailable).not.toHaveBeenCalled();
  });

  it('never exposes a new host revision with an anchor measured for the previous host', async () => {
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const onAnchorUnavailable = jest.fn();
    let requestAnotherMeasure = () => undefined;
    let reportOverlayLayout = (_event: unknown) => undefined;

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
      hostName: 'revision-host',
      isModal: true,
      depth: 1,
      hostRect,
      remeasureHost: () => undefined,
      controller,
    });

    function Probe() {
      const anchorRef = React.useRef({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => callbacks.push(cb),
      });
      const { anchorRect, onOverlayLayout, position, remeasure } = useAnchoredOverlayPosition({
        anchorRef,
        avoidSafeArea: false,
        onAnchorUnavailable,
        open: true,
      });
      requestAnotherMeasure = remeasure;
      reportOverlayLayout = onOverlayLayout as unknown as (event: unknown) => void;
      return (
        <Text testID="revision-probe">
          {`${anchorRect ? 'anchor' : 'no-anchor'}:${position ? 'positioned' : 'pending'}`}
        </Text>
      );
    }

    const renderTree = (hostRect: typeof hostA) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <Probe />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    const screen = render(renderTree(hostA));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));

    await act(async () => {
      reportOverlayLayout({ nativeEvent: { layout: { width: 120, height: 80 } } });
      callbacks[0](200, 160, 40, 20);
    });
    await waitFor(() =>
      expect(screen.getByTestId('revision-probe', { includeHiddenElements: true }).props.children).toBe(
        'anchor:positioned',
      ),
    );

    // Leave one host-A request pending, then change the host. The hook must become
    // pending immediately instead of calculating one frame from host-B + anchor-A.
    await act(async () => requestAnotherMeasure());
    const staleHostARequest = callbacks.at(-1)!;
    await act(async () => screen.rerender(renderTree(hostB)));
    const hostBRequest = callbacks.at(-1)!;
    expect(hostBRequest).not.toBe(staleHostARequest);
    expect(screen.getByTestId('revision-probe', { includeHiddenElements: true }).props.children).toBe(
      'no-anchor:pending',
    );

    // A stale unavailable result from the old host revision must also be ignored,
    // even if it lands before the current host-B measurement resolves.
    await act(async () =>
      staleHostARequest(Number.NaN, Number.NaN, Number.NaN, Number.NaN),
    );
    expect(screen.getByTestId('revision-probe', { includeHiddenElements: true }).props.children).toBe(
      'no-anchor:pending',
    );
    expect(onAnchorUnavailable).not.toHaveBeenCalled();

    await act(async () => hostBRequest(260, 210, 40, 20));
    await waitFor(() =>
      expect(screen.getByTestId('revision-probe', { includeHiddenElements: true }).props.children).toBe(
        'anchor:positioned',
      ),
    );
  });
});
