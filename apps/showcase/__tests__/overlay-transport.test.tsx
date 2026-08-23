import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Text, UIManager } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  createLegacyStoreTransport,
  type OverlayTransport,
} from '../../../packages/ui/src/components/overlay-transport-shared';
import { resolveOverlayTransport } from '../../../packages/ui/src/components/overlay-transport';
import { isNativeTeleportAvailable } from '../../../packages/ui/src/components/overlay-host-mode';

// Mock the native portal so its fiber-preserving behavior (render children inline)
// is exercised deterministically in jest.
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
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
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

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };
const ScreenContext = React.createContext('context-default');

function ContextProbe() {
  return <Text testID="probe">{React.useContext(ScreenContext)}</Text>;
}

function renderOverlay(ui: React.ReactNode, transport?: OverlayTransport) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT} transport={transport}>
      <ScreenContext.Provider value="screen-value">{ui}</ScreenContext.Provider>
    </OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        if (!/trigger$/.test(element.props?.testID ?? '')) return null;
        return {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
            cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
        };
      },
    },
  );
}

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
const originalPlatformOS = Platform.OS;

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
});

describe('overlay transport selection', () => {
  it('reports the native teleport host available only with Fabric + a registered host view', () => {
    setTeleportAvailable(true);
    expect(isNativeTeleportAvailable()).toBe(true);

    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = undefined;
    expect(isNativeTeleportAvailable()).toBe(false);

    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
    jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(false);
    expect(isNativeTeleportAvailable()).toBe(false);
  });

  it('selects the native teleport transport when available', () => {
    setTeleportAvailable(true);
    expect(resolveOverlayTransport().mode).toBe('native-teleport');
  });

  it('selects the legacy transport when the native host is unavailable', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTeleportAvailable(false);
    expect(resolveOverlayTransport().mode).toBe('legacy');
  });
});

describe('native teleport transport preserves consumer context', () => {
  beforeEach(() => setTeleportAvailable(true));

  it('resolves consumer context inside PopoverContent to the provided value', async () => {
    const screen = renderOverlay(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent avoidSafeArea={false} testID="content">
          <ContextProbe />
        </PopoverContent>
      </Popover>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('probe', { includeHiddenElements: true }).props.children,
      ).toBe('screen-value');
    });
  });

  it('mounts and unmounts overlay content as the overlay opens and closes', async () => {
    let setOpen: (open: boolean) => void = () => undefined;
    function Harness() {
      const [open, setOpenState] = React.useState(true);
      setOpen = setOpenState;
      return (
        <Popover onOpenChange={setOpenState} open={open}>
          <PopoverTrigger testID="trigger">Open</PopoverTrigger>
          <PopoverContent avoidSafeArea={false} testID="content">
            <ContextProbe />
          </PopoverContent>
        </Popover>
      );
    }

    const screen = renderOverlay(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('probe', { includeHiddenElements: true })).toBeTruthy(),
    );

    await act(async () => setOpen(false));
    await waitFor(() =>
      expect(screen.queryByTestId('probe', { includeHiddenElements: true })).toBeNull(),
    );

    await act(async () => setOpen(true));
    await waitFor(() =>
      expect(
        screen.getByTestId('probe', { includeHiddenElements: true }).props.children,
      ).toBe('screen-value'),
    );
  });
});

describe('anchored overlays inside a modal-class surface', () => {
  beforeEach(() => setTeleportAvailable(true));

  it('preserves consumer context for a Popover declared inside DialogContent', async () => {
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open dialog</DialogTrigger>
        <DialogContent>
          <Popover defaultOpen>
            <PopoverTrigger testID="trigger">Open</PopoverTrigger>
            <PopoverContent avoidSafeArea={false} testID="content">
              <ContextProbe />
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('probe', { includeHiddenElements: true }).props.children,
      ).toBe('screen-value');
    });
  });

  it('opens, preserves context, selects, and closes a DropdownMenu inside DialogContent', async () => {
    // Web selection uses the menu's deterministic keyboard contract; the transport
    // is still teleport (resolved by capability, not platform).
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onSelect = jest.fn();
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle testID="dialog-title">Dialog</DialogTitle>
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent testID="menu-content">
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              <ContextProbe />
              <DropdownMenuItem onSelect={onSelect} testID="menu-item">
                Select
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>,
    );

    // Targets the modal-local host and preserves consumer context.
    await waitFor(() =>
      expect(screen.getByTestId('probe', { includeHiddenElements: true }).props.children).toBe(
        'screen-value',
      ),
    );
    // Opens (item mounted).
    expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy();
    // Selects via the menu's deterministic keyboard contract; the menu closes and
    // the dialog stays open (child-first).
    await act(async () =>
      screen
        .getByTestId('menu-content', { includeHiddenElements: true })
        .props.onKeyDown?.({ key: 'Enter', preventDefault: jest.fn() }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('dialog-title', { includeHiddenElements: true })).toBeTruthy();
  });

  it('dismisses a dialog-nested DropdownMenu topmost-first on outside press', async () => {
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle testID="dialog-title">Dialog</DialogTitle>
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent outsidePressTestID="menu-outside">
              <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );
    // Outside press dismisses the topmost anchored overlay (the menu) first; the
    // dialog stays open.
    await act(async () =>
      fireEvent.press(screen.getByTestId('menu-outside', { includeHiddenElements: true })),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('dialog-title', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('legacy defensive transport drops consumer context', () => {
  it('resolves consumer context inside PopoverContent to the default value', async () => {
    const screen = renderOverlay(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent avoidSafeArea={false} testID="content">
          <ContextProbe />
        </PopoverContent>
      </Popover>,
      createLegacyStoreTransport(),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('probe', { includeHiddenElements: true }).props.children,
      ).toBe('context-default');
    });
  });
});
