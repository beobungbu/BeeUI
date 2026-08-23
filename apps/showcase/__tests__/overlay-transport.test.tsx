import { Popover, PopoverContent, PopoverTrigger } from '@beeui/ui';
import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
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
        if (element.props?.testID !== 'trigger') return null;
        return {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
            cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
        };
      },
    },
  );
}

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
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
