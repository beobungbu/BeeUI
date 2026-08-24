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
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Modal, Platform, Text, UIManager, View, type LayoutChangeEvent } from 'react-native';
import {
  ModalOverlayHost,
  OverlayRuntimeProvider,
  useAnchoredOverlayPosition,
} from '../../../packages/ui/src/components/overlay-runtime';

// Native portal is mocked to render children inline so the scope/fiber behavior is
// exercised deterministically (never to bypass scope routing).
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
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
const originalPlatformOS = Platform.OS;

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
});

// createNodeMock that returns a fixed window rect for any anchor trigger, so the
// geometry kernel has a deterministic anchor to resolve against.
const anchorNodeMock = (element: { props?: { testID?: string } }) => {
  if (!/anchor$|trigger$/.test(element.props?.testID ?? '')) return null;
  return {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
  };
};

function renderRoot(ui: React.ReactNode) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>{ui}</OverlayRuntimeProvider>,
    { createNodeMock: anchorNodeMock },
  );
}

// ---------------------------------------------------------------------------
// Blocker 1 — iOS request-close must NOT use Android child-first interception.
// ---------------------------------------------------------------------------
describe('platform request-close routing (Blocker 1)', () => {
  beforeEach(() => setTeleportAvailable(true));

  const fireModalRequestClose = async (screen: ReturnType<typeof render>) =>
    act(async () => screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose?.());
  const dialogVisible = (screen: ReturnType<typeof render>) =>
    screen.UNSAFE_getAllByType(Modal)[0].props.visible;

  it('iOS pageSheet + allowSwipeDismissal: request-close closes the Dialog, not just the child', async () => {
    setPlatform('ios');
    const onRequestClose = jest.fn();
    const screen = renderRoot(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent
          modalProps={{ presentationStyle: 'pageSheet', allowSwipeDismissal: true }}
          onRequestClose={onRequestClose}
        >
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

    // On iOS onRequestClose can be a native modal dismissal (swipe). It must NOT be
    // intercepted to only close the nested menu — the Dialog itself closes and the
    // child unmounts with it, so React state does not desync from the native modal.
    await fireModalRequestClose(screen);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
    expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull();
  });

  it('iOS controlled Dialog: request-close drives onOpenChange(false); no child-only interception', async () => {
    setPlatform('ios');
    const onOpenChange = jest.fn();
    function Controlled() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          open={open}
        >
          <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
          <DialogContent modalProps={{ presentationStyle: 'formSheet', allowSwipeDismissal: true }}>
            <DialogTitle testID="dialog-title">Dialog</DialogTitle>
            <Popover defaultOpen>
              <PopoverTrigger testID="trigger">Open</PopoverTrigger>
              <PopoverContent avoidSafeArea={false} testID="content">
                <Text testID="popover-body">body</Text>
              </PopoverContent>
            </Popover>
          </DialogContent>
        </Dialog>
      );
    }
    const screen = renderRoot(<Controlled />);
    await waitFor(() =>
      expect(screen.getByTestId('popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );

    await fireModalRequestClose(screen);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(dialogVisible(screen)).toBe(false));
    expect(screen.queryByTestId('popover-body', { includeHiddenElements: true })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Blocker 2 — dismissal is scope-aware: a root overlay behind a modal never
// steals topmost from a modal-local child, regardless of registration order.
// ---------------------------------------------------------------------------
describe('scope-aware dismissal hierarchy (Blocker 2)', () => {
  beforeEach(() => setTeleportAvailable(true));

  it('CASE A: outside press on a dialog menu closes the menu; Dialog and root Popover remain', async () => {
    const screen = renderRoot(
      <>
        <Popover defaultOpen>
          <PopoverTrigger testID="root-anchor">Open</PopoverTrigger>
          <PopoverContent avoidSafeArea={false} testID="root-content">
            <Text testID="root-popover-body">root</Text>
          </PopoverContent>
        </Popover>
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
        </Dialog>
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    await act(async () =>
      fireEvent.press(screen.getByTestId('menu-outside', { includeHiddenElements: true })),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('dialog-title', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy();
  });

  it('CASE B: root Popover opened AFTER the dialog menu still does not become topmost', async () => {
    function Harness() {
      const [rootOpen, setRootOpen] = React.useState(false);
      return (
        <>
          <Text testID="open-root" onPress={() => setRootOpen(true)}>
            open root
          </Text>
          <Popover onOpenChange={setRootOpen} open={rootOpen}>
            <PopoverTrigger testID="root-anchor">Open</PopoverTrigger>
            <PopoverContent avoidSafeArea={false} testID="root-content">
              <Text testID="root-popover-body">root</Text>
            </PopoverContent>
          </Popover>
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
          </Dialog>
        </>
      );
    }
    const screen = renderRoot(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
    );

    // Register the root Popover LAST — with a single flat stack it would become
    // global-topmost and steal the menu's outside-press. Scope-awareness keeps the
    // menu topmost within the modal scope.
    await act(async () =>
      fireEvent.press(screen.getByTestId('open-root', { includeHiddenElements: true })),
    );
    await waitFor(() =>
      expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );

    await act(async () =>
      fireEvent.press(screen.getByTestId('menu-outside', { includeHiddenElements: true })),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('dialog-title', { includeHiddenElements: true })).toBeTruthy();
  });

  it('CASE D: accessibility escape closes the modal-local child even if a root overlay registered later', async () => {
    setPlatform('web'); // accessibility escape uses the deterministic web contract
    function Harness() {
      const [rootOpen, setRootOpen] = React.useState(false);
      return (
        <>
          <Text testID="open-root" onPress={() => setRootOpen(true)}>
            open root
          </Text>
          <Popover onOpenChange={setRootOpen} open={rootOpen}>
            <PopoverTrigger testID="root-anchor">Open</PopoverTrigger>
            <PopoverContent avoidSafeArea={false} testID="root-content">
              <Text testID="root-popover-body">root</Text>
            </PopoverContent>
          </Popover>
          <Dialog defaultOpen>
            <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
            <DialogContent>
              <DialogTitle testID="dialog-title">Dialog</DialogTitle>
              <Popover defaultOpen>
                <PopoverTrigger testID="trigger">Open</PopoverTrigger>
                <PopoverContent avoidSafeArea={false} testID="modal-content">
                  <Text testID="modal-popover-body">modal</Text>
                </PopoverContent>
              </Popover>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    const screen = renderRoot(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId('modal-popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );
    await act(async () =>
      fireEvent.press(screen.getByTestId('open-root', { includeHiddenElements: true })),
    );
    await waitFor(() =>
      expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy(),
    );

    await act(async () =>
      screen
        .getByTestId('modal-content', { includeHiddenElements: true })
        .props.onAccessibilityEscape?.(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('modal-popover-body', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.getByTestId('root-popover-body', { includeHiddenElements: true })).toBeTruthy();
  });

  it('CASE E: nested Dialog — only the inner (active) modal scope handles its request-close', async () => {
    setPlatform('android');
    const screen = renderRoot(
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
    const modals = screen.UNSAFE_getAllByType(Modal);
    // Inner modal (tree order index 1) owns the menu in its own scope.
    await act(async () => modals[1].props.onRequestClose?.());
    await waitFor(() =>
      expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
    );
    expect(screen.UNSAFE_getAllByType(Modal)[0].props.visible).toBe(true); // outer stays
    expect(screen.UNSAFE_getAllByType(Modal)[1].props.visible).toBe(true); // inner stays
  });
});

// ---------------------------------------------------------------------------
// Blocker 3 — modal-local geometry resolves against the modal host origin.
// ---------------------------------------------------------------------------
describe('modal-local geometry origin (Blocker 3)', () => {
  beforeEach(() => setTeleportAvailable(true));

  const MODAL_RECT = { x: 180, y: 120, width: 640, height: 560 };
  const PROBE_ANCHOR = { x: 300, y: 220, width: 40, height: 20 };

  function PositionProbe() {
    // Inject a deterministic measurable anchor — exactly the window rect a real
    // trigger's measureInWindow provides — so the geometry kernel resolves without
    // a native measurement pass. This exercises the real scope hostRect wiring, not
    // a mocked position.
    const anchorRef = React.useRef<{
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null>(null);
    if (anchorRef.current === null) {
      anchorRef.current = {
        measureInWindow: (cb) =>
          cb(PROBE_ANCHOR.x, PROBE_ANCHOR.y, PROBE_ANCHOR.width, PROBE_ANCHOR.height),
      };
    }
    const { onOverlayLayout, position, windowPosition } = useAnchoredOverlayPosition({
      align: 'start',
      anchorRef,
      avoidSafeArea: false,
      flip: false,
      open: true,
      placement: 'bottom',
      shift: false,
    });
    React.useEffect(() => {
      onOverlayLayout({
        nativeEvent: { layout: { width: 100, height: 50, x: 0, y: 0 } },
      } as LayoutChangeEvent);
    }, [onOverlayLayout]);
    return (
      <>
        <Text testID="probe-position">
          {position ? `${Math.round(position.x)},${Math.round(position.y)}` : 'null'}
        </Text>
        <Text testID="probe-window">
          {windowPosition ? `${Math.round(windowPosition.x)},${Math.round(windowPosition.y)}` : 'null'}
        </Text>
      </>
    );
  }

  it('positions a modal-local overlay relative to the modal host origin, not the root', async () => {
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <ModalOverlayHost hostRectOverride={MODAL_RECT}>
          <PositionProbe />
        </ModalOverlayHost>
      </OverlayRuntimeProvider>,
      {
        createNodeMock: (element: { props?: { testID?: string } }) => {
          if (element.props?.testID !== 'probe-anchor') return null;
          return {
            measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
              cb(PROBE_ANCHOR.x, PROBE_ANCHOR.y, PROBE_ANCHOR.width, PROBE_ANCHOR.height),
          };
        },
      },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('probe-position', { includeHiddenElements: true }).props.children,
      ).not.toBe('null'),
    );

    const windowText = screen.getByTestId('probe-window', { includeHiddenElements: true }).props
      .children as string;
    const positionText = screen.getByTestId('probe-position', { includeHiddenElements: true }).props
      .children as string;
    const [winX, winY] = windowText.split(',').map(Number);
    const [posX, posY] = positionText.split(',').map(Number);

    // The window-space solution anchors under the trigger (bottom/start).
    expect([winX, winY]).toEqual([PROBE_ANCHOR.x, PROBE_ANCHOR.y + PROBE_ANCHOR.height]);
    // Host-local position subtracts the MODAL host origin (180,120) — the fix.
    // Against root-based geometry this would be (300,240), not (120,120).
    expect([posX, posY]).toEqual([winX - MODAL_RECT.x, winY - MODAL_RECT.y]);
    expect([posX, posY]).toEqual([120, 120]);
  });
});

// ---------------------------------------------------------------------------
// Blocker 5 — dismiss registration is synchronous (layout effect), so a native
// request-close immediately after a modal opens still routes child-first.
// ---------------------------------------------------------------------------
describe('modal registration timing (Blocker 5)', () => {
  beforeEach(() => {
    setTeleportAvailable(true);
    setPlatform('android');
  });

  it('a request-close fired immediately after render dismisses the child (no unregistered window)', async () => {
    const screen = renderRoot(
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
    // No waitFor: registration ran in the same commit via the layout effect.
    await act(async () => screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose?.());
    expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull();
    expect(screen.UNSAFE_getAllByType(Modal)[0].props.visible).toBe(true); // dialog stays
  });
});
