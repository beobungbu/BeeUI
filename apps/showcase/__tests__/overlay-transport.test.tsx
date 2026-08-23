import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { Modal, Platform, Text, UIManager } from 'react-native';
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

function readEntryOrder(screen: ReturnType<typeof render>) {
  return screen
    .getAllByTestId('legacy-entry', { includeHiddenElements: true })
    .map((node) => node.props.children as string);
}

describe('legacy transport preserves portal insertion order on independent updates', () => {
  it('keeps an earlier portal ahead of a later one when only the earlier one updates', async () => {
    const { RootBoundary, HostOutlet, PortalOutlet } = createLegacyStoreTransport();

    let bumpA: () => void = () => undefined;
    function PortalA() {
      const [n, setN] = React.useState(0);
      bumpA = () => setN((value) => value + 1);
      return (
        <PortalOutlet hostName="legacy-host">
          <Text testID="legacy-entry">{`A${n}`}</Text>
        </PortalOutlet>
      );
    }

    const screen = render(
      <RootBoundary>
        <PortalA />
        <PortalOutlet hostName="legacy-host">
          <Text testID="legacy-entry">B</Text>
        </PortalOutlet>
        <HostOutlet name="legacy-host" />
      </RootBoundary>,
    );

    // A mounts before B, so the destination renders A ahead of B (B paints last,
    // i.e. visually topmost — matching the dismiss stack, which tracks B as the
    // most-recently-registered overlay).
    await waitFor(() => expect(readEntryOrder(screen)).toEqual(['A0', 'B']));

    // Only A's content changes. Before the split-lifecycle fix this ran the
    // registration cleanup+setup and moved A behind B (['B', 'A1']); now A keeps
    // its insertion position while its content updates in place.
    await act(async () => bumpA());
    expect(readEntryOrder(screen)).toEqual(['A1', 'B']);
  });
});

describe('legacy transport host lifecycle cleanup', () => {
  it('creates a destination on host mount, drops it on unmount, and re-creates it for a new host id', async () => {
    const { RootBoundary, HostOutlet, PortalOutlet } = createLegacyStoreTransport();

    // A modal-class surface mounts its portal content and its own host together,
    // and unmounts them together when it closes.
    function ModalScope({ hostName }: { hostName: string }) {
      return (
        <>
          <PortalOutlet hostName={hostName}>
            <Text testID="modal-portal">content</Text>
          </PortalOutlet>
          <HostOutlet name={hostName} />
        </>
      );
    }

    function Harness({ hostName, open }: { hostName: string; open: boolean }) {
      return <RootBoundary>{open ? <ModalScope hostName={hostName} /> : null}</RootBoundary>;
    }

    const screen = render(<Harness hostName="modal-host-1" open />);
    await waitFor(() =>
      expect(screen.queryByTestId('modal-portal', { includeHiddenElements: true })).toBeTruthy(),
    );

    // Closing the modal unmounts the host: the destination is gone and stale
    // content no longer renders (dead host name bookkeeping is dropped).
    screen.rerender(<Harness hostName="modal-host-1" open={false} />);
    await waitFor(() =>
      expect(screen.queryByTestId('modal-portal', { includeHiddenElements: true })).toBeNull(),
    );

    // A brand-new modal instance with a different host id mounts and receives its
    // portal again — repeated mount/unmount keeps working without leaking state.
    screen.rerender(<Harness hostName="modal-host-2" open />);
    await waitFor(() =>
      expect(screen.queryByTestId('modal-portal', { includeHiddenElements: true })).toBeTruthy(),
    );

    screen.rerender(<Harness hostName="modal-host-2" open={false} />);
    await waitFor(() =>
      expect(screen.queryByTestId('modal-portal', { includeHiddenElements: true })).toBeNull(),
    );
  });
});

// Android `Modal` suppresses the root BackHandler while open, so hardware back
// reaches BeeUI only through `Modal.onRequestClose`. These prove the modal-local
// dismissal scope makes that path child-first without letting a root overlay
// behind the Dialog consume the Dialog's back event. `onRequestClose` is fired
// directly (it is the exact prop the OS invokes on hardware back).
describe('modal request-close is child-first for anchored overlays (Android hardware back)', () => {
  beforeEach(() => setTeleportAvailable(true));

  const fireModalBack = async (screen: ReturnType<typeof render>, index = 0) => {
    const modal = screen.UNSAFE_getAllByType(Modal)[index];
    await act(async () => modal.props.onRequestClose?.());
  };
  const dialogVisible = (screen: ReturnType<typeof render>, index = 0) =>
    screen.UNSAFE_getAllByType(Modal)[index].props.visible;

  it('Dialog → DropdownMenu: back #1 closes the menu, back #2 closes the Dialog', async () => {
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle testID="dialog-title">Dialog</DialogTitle>
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    // Back #1: only the menu closes; the Dialog stays open.
    await fireModalBack(screen);
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(dialogVisible(screen)).toBe(true);

    // Back #2: no modal-local child remains, so the Dialog closes.
    await fireModalBack(screen);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
  });

  it('Dialog → Popover: back #1 closes the Popover, back #2 closes the Dialog', async () => {
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle testID="dialog-title">Dialog</DialogTitle>
          <Popover defaultOpen>
            <PopoverTrigger testID="trigger">Open</PopoverTrigger>
            <PopoverContent avoidSafeArea={false} testID="content">
              <Text testID="popover-body">body</Text>
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );

    await fireModalBack(screen);
    await waitFor(() =>
      expect(screen.queryByTestId('popover-body', { includeHiddenElements: true })).toBeNull(),
    );
    expect(dialogVisible(screen)).toBe(true);

    await fireModalBack(screen);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
  });

  it('does not dismiss a root Popover behind the Dialog; the Dialog closes instead', async () => {
    const screen = renderOverlay(
      <>
        <Popover defaultOpen>
          <PopoverTrigger testID="trigger">Open</PopoverTrigger>
          <PopoverContent avoidSafeArea={false} testID="content">
            <Text testID="root-popover-body">root</Text>
          </PopoverContent>
        </Popover>
        <Dialog defaultOpen>
          <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
          <DialogContent>
            <DialogTitle testID="dialog-title">Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );

    // The Dialog's modal scope has no child, so hardware back closes the Dialog —
    // the root Popover behind it is a different scope and must not be consumed.
    await fireModalBack(screen);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
    expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy();
  });

  it('AlertDialog → DropdownMenu: the child closes first; the alert stays open', async () => {
    const screen = renderOverlay(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger testID="alert-trigger">Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle testID="alert-title">Alert</AlertDialogTitle>
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    // Back #1: child-first — the menu closes, the AlertDialog stays open.
    await fireModalBack(screen);
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(dialogVisible(screen)).toBe(true);

    // Back #2 (no child): AlertDialog's request-close policy applies — the default
    // cancelOnRequestClose closes it.
    await fireModalBack(screen);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
  });

  it('AlertDialog cancelOnRequestClose={false}: back with no child keeps the alert open', async () => {
    const onRequestClose = jest.fn();
    const screen = renderOverlay(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger testID="alert-trigger">Open</AlertDialogTrigger>
        <AlertDialogContent cancelOnRequestClose={false} onRequestClose={onRequestClose}>
          <AlertDialogTitle testID="alert-title">Alert</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('alert-title', { includeHiddenElements: true })).toBeTruthy(),
    );

    // No modal-local child, so the request-close policy runs: it notifies but does
    // not dismiss.
    await fireModalBack(screen);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(dialogVisible(screen)).toBe(true);
  });

  it('nested Dialog: only the active modal scope consumes its own onRequestClose', async () => {
    const screen = renderOverlay(
      <Dialog defaultOpen>
        <DialogTrigger testID="outer-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle testID="outer-title">Outer</DialogTitle>
          <Dialog defaultOpen>
            <DialogTrigger testID="inner-trigger">Open inner</DialogTrigger>
            <DialogContent>
              <DialogTitle testID="inner-title">Inner</DialogTitle>
              <DropdownMenu defaultOpen>
                <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    // The inner modal (index 1 in tree order) owns the menu in its own scope. Its
    // back dismisses the menu and consumes the event; both Dialogs stay open.
    await fireModalBack(screen, 1);
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(dialogVisible(screen, 0)).toBe(true);
    expect(dialogVisible(screen, 1)).toBe(true);

    // Next inner back (no child) closes the inner Dialog only; the outer stays.
    await fireModalBack(screen, 1);
    await waitFor(() => expect(dialogVisible(screen, 1)).toBe(false));
    expect(dialogVisible(screen, 0)).toBe(true);
  });
});
