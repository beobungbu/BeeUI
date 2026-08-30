import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Platform, ScrollView, Text, UIManager } from 'react-native';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../packages/ui/src/components/dropdown-menu';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.native` suffix (mirrors `issue-158-sheet-native.test.tsx`): forces
// the real `@gorhom/bottom-sheet` adapter regardless of Jest's default
// platform resolution.
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '../../../packages/ui/src/components/sheet.native';

// BeeUI issue #160 (R4B.5): dedicated Sheet runtime-acceptance evidence.
//
// #158 (issue-158-sheet-native.test.tsx) already proves the present/dismiss
// lifecycle, backdrop dismissal, gorhom-initiated dismiss handling, Android
// Back precedence (no nested child), accessibility relationship
// registration, handle visibility, and basic text-input focus. This file
// covers the #160-specific matrix items #158 did not exercise: snap-point/
// presentation-change wiring reaching the real native engine seam, the
// reduced-motion -> `overrideReduceMotion` mapping, the `avoidKeyboard`->
// `keyboardBehavior` mapping, nested scrollable content, and child-overlay
// dismiss-scope precedence combined with a real Android hardware-back event.
//
// Per `docs/beeui-1.0-evidence-classes.md`, every assertion here is
// deterministic contract evidence: gorhom's own gesture/spring/velocity
// physics, real nested-scroll gesture arbitration (finger deciding
// sheet-drag vs. list-scroll), true keyboard-avoidance geometry, RTL mirror
// rendering, and VoiceOver/TalkBack focus-into-sheet are NOT exercised here
// -- they require a real iOS Simulator/Android Emulator or physical device.
// That native-runtime evidence is explicitly deferred: the headless iOS
// Simulator has a documented Fabric blank-render bug (#349) that blocks the
// existing Maestro runtime-smoke suite for exactly this class of gesture/
// overlay interaction, and real-device cloud testing is a parked owner
// decision (see `plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md`).
// See `docs/native-runtime-smoke.md` for the acceptance-matrix documentation
// of this deferral.

type MockBackdropProps = { animatedIndex: { value: number } };
type MockHandleProps = Record<string, never>;
type MockBottomSheetModalProps = {
  android_keyboardInputMode?: string;
  backdropComponent?: (p: MockBackdropProps) => React.ReactNode;
  children?: React.ReactNode;
  handleComponent?: ((p: MockHandleProps) => React.ReactNode) | null;
  index?: number;
  keyboardBehavior?: string;
  onDismiss?: () => void;
  overrideReduceMotion?: unknown;
  snapPoints?: Array<string | number>;
};

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestProps: MockBottomSheetModalProps | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = ReactActual.forwardRef(
    (props: MockBottomSheetModalProps, ref: unknown) => {
      latestProps = props;
      ReactActual.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return ReactActual.createElement(
        View,
        { testID: 'mock-bottom-sheet-modal' },
        props.backdropComponent
          ? props.backdropComponent({ animatedIndex: { value: 0 } })
          : null,
        props.handleComponent ? props.handleComponent({}) : null,
        props.children,
      );
    },
  );

  const BottomSheetView = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(View, null, children);

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetView,
  };
});

let mockAndroidBackListeners: Array<() => boolean> = [];

// Real `BackHandler` invokes listeners LIFO (most-recently-added first) and
// falls through to the next one when a listener returns false -- both
// `OverlayRuntimeProvider`'s single root dispatcher (registered once at the
// provider) and Sheet's own explicit listener (registered per open
// `SheetContent`, since `@gorhom/bottom-sheet` does not integrate
// `BackHandler` itself) are live at once whenever a Sheet is open, so this
// hand-rolled mock (this Jest RN preset ships no `mockPressBack` helper for
// this RN version) must reproduce the real fall-through stack, not just the
// single most-recent listener the way `issue-158-sheet-native.test.tsx`'s
// simpler mock does (that file never has two concurrent listeners).
function mockPressAndroidBack(): boolean {
  for (let index = mockAndroidBackListeners.length - 1; index >= 0; index -= 1) {
    if (mockAndroidBackListeners[index]()) return true;
  }
  return false;
}

jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: (_eventName: string, handler: () => boolean) => {
      mockAndroidBackListeners.push(handler);
      return {
        remove: () => {
          mockAndroidBackListeners = mockAndroidBackListeners.filter((listener) => listener !== handler);
        },
      };
    },
    removeEventListener: () => undefined,
  },
}));

const SAFE_AREA_INSETS = { top: 20, right: 0, bottom: 30, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  return {
    initialWindowMetrics: { frame: { x: 0, y: 0, width: 300, height: 600 }, insets: SAFE_AREA_INSETS },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) =>
        ReactActual.createElement(View, { ref, ...props }, children),
    ),
    useSafeAreaInsets: () => SAFE_AREA_INSETS,
  };
});

// Native portal mocked to render children inline (same as `overlay-scope.test.tsx`)
// so scope/dismiss-stack routing is exercised deterministically without a real
// native module registry.
jest.mock('react-native-teleport', () => {
  const ReactActual = require('react');
  return {
    PortalProvider: ({ children }: { children?: React.ReactNode }) => children,
    PortalHost: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => children,
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

const anchorNodeMock = (element: { props?: { testID?: string } }) => {
  if (!/anchor$|trigger$/.test(element.props?.testID ?? '')) return null;
  return {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
  };
};

// `SheetContent` always mounts `useReducedMotionPreference`, which calls the
// real `AccessibilityInfo.isReduceMotionEnabled()` promise on every render.
// Left unmocked, that promise settles on a later microtask outside any
// `act()` scope and React logs an "not wrapped in act" warning for every
// other test in this file. Default it to an immediately-resolved value here;
// the "reduced-motion mapping" tests below install their own more detailed
// spy that takes precedence for their own test body.
function mockDefaultReducedMotionSignal() {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
    remove: () => undefined,
  } as ReturnType<typeof AccessibilityInfo.addEventListener>);
}

/** Flushes the pending `isReduceMotionEnabled()` microtask inside `act()`. */
async function flushReducedMotionSignal() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderAndSettle(ui: React.ReactNode) {
  const utils = render(ui);
  await flushReducedMotionSignal();
  return utils;
}

async function rerenderAndSettle(rerender: (ui: React.ReactNode) => void, ui: React.ReactNode) {
  rerender(ui);
  await flushReducedMotionSignal();
}

async function renderRoot(ui: React.ReactNode) {
  const utils = render(
    <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>{ui}</OverlayRuntimeProvider>,
    { createNodeMock: anchorNodeMock },
  );
  await flushReducedMotionSignal();
  return utils;
}

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
  latestProps = undefined;
  mockAndroidBackListeners = [];
  setTeleportAvailable(true);
  mockDefaultReducedMotionSignal();
});

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
});

describe('BeeUI issue #160 Sheet runtime acceptance (deterministic contract layer)', () => {
  describe('snap-point / presentation-change wiring', () => {
    it('forwards the resolved snap points and current index to the native engine', async () => {
      const { rerender } = await renderAndSettle(
        <Sheet defaultOpen>
          <SheetContent testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(latestProps?.snapPoints).toEqual(['90%']);
      expect(latestProps?.index).toBe(0);

      await rerenderAndSettle(
        rerender,
        <Sheet defaultOpen>
          <SheetContent initialSnapIndex={1} snapPoints={['40%', '80%']} testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(latestProps?.snapPoints).toEqual(['40%', '80%']);
      expect(latestProps?.index).toBe(1);
    });

    it('clamps an out-of-range initialSnapIndex instead of forwarding an invalid index', async () => {
      await renderAndSettle(
        <Sheet defaultOpen>
          <SheetContent initialSnapIndex={5} snapPoints={['40%', '80%']} testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(latestProps?.index).toBe(1);
    });
  });

  describe('reduced-motion mapping', () => {
    it('forwards the ambient reduced-motion signal into overrideReduceMotion, live', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      let changeListener: ((value: boolean) => void) | undefined;
      jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
        ((_event: string, listener: (value: boolean) => void) => {
          changeListener = listener;
          return { remove: () => { changeListener = undefined; } };
        }) as typeof AccessibilityInfo.addEventListener,
      );

      render(
        <Sheet defaultOpen>
          <SheetContent testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await waitFor(() => expect(latestProps?.overrideReduceMotion).toBe('never'));

      await act(async () => changeListener?.(true));
      expect(latestProps?.overrideReduceMotion).toBe('always');
    });
  });

  describe('keyboard-avoidance mapping', () => {
    it('maps avoidKeyboard to the native engine keyboardBehavior seam, with no true off switch', async () => {
      const { rerender } = await renderAndSettle(
        <Sheet defaultOpen>
          <SheetContent testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(latestProps?.keyboardBehavior).toBe('interactive');
      expect(latestProps?.android_keyboardInputMode).toBe('adjustResize');

      await rerenderAndSettle(
        rerender,
        <Sheet defaultOpen>
          <SheetContent avoidKeyboard={false} testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      // Documented limitation (sheet.native.tsx module docblock): gorhom has
      // no "ignore the keyboard" mode, so `avoidKeyboard={false}` maps to the
      // closest available (still keyboard-aware) behavior rather than a true
      // off switch.
      expect(latestProps?.keyboardBehavior).toBe('fillParent');
    });
  });

  describe('nested scrollable content', () => {
    it('renders long scrollable content inside the panel without remounting the engine', async () => {
      const rows = Array.from({ length: 40 }, (_unused, index) => `Row ${index}`);

      await renderAndSettle(
        <Sheet defaultOpen>
          <SheetContent testID="sheet-content">
            <SheetTitle>Long list</SheetTitle>
            <ScrollView testID="sheet-scroll">
              {rows.map((row) => (
                <Text key={row}>{row}</Text>
              ))}
            </ScrollView>
          </SheetContent>
        </Sheet>,
      );

      expect(screen.getByText('Row 0')).toBeTruthy();
      expect(screen.getByText('Row 39')).toBeTruthy();
      // The engine presented exactly once for this initial open render (no
      // duplicate remount/reset of the drag/spring seam caused by nesting a
      // scrollable child).
      expect(mockPresent).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('mock-bottom-sheet-modal')).toBeTruthy();
    });
  });

  describe('child overlay dismiss-scope precedence + Android Back', () => {
    it('dismisses a DropdownMenu nested inside the Sheet on hardware back before closing the Sheet itself', async () => {
      setPlatform('android');
      const onOpenChange = jest.fn();

      await renderRoot(
        <Sheet onOpenChange={onOpenChange} open>
          <SheetContent testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
            <DropdownMenu defaultOpen>
              <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
              <DropdownMenuContent outsidePressTestID="menu-outside">
                <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SheetContent>
        </Sheet>,
      );

      await waitFor(() =>
        expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
      );

      const handled = await act(async () => mockPressAndroidBack());

      expect(handled).toBe(true);
      await waitFor(() =>
        expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
      );
      // The Sheet itself was not asked to close -- the nested menu absorbed
      // the back press first, matching Dialog's documented child-first
      // precedence (`overlay-scope.test.tsx` CASE A/E).
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it('closes the Sheet on a second hardware back once no child overlay remains', async () => {
      setPlatform('android');
      const onOpenChange = jest.fn();

      await renderRoot(
        <Sheet onOpenChange={onOpenChange} open>
          <SheetContent testID="sheet-content">
            <SheetTitle>Filters</SheetTitle>
            <DropdownMenu defaultOpen>
              <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
              <DropdownMenuContent outsidePressTestID="menu-outside">
                <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SheetContent>
        </Sheet>,
      );

      await waitFor(() =>
        expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy(),
      );

      await act(async () => mockPressAndroidBack());
      await waitFor(() =>
        expect(screen.queryByTestId('menu-item', { includeHiddenElements: true })).toBeNull(),
      );

      const handled = await act(async () => mockPressAndroidBack());

      expect(handled).toBe(true);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('RTL / large text (inherited contract, not net-new geometry)', () => {
    it('renders SheetTitle/panel structure using the same logical-direction primitives already RTL-tested for other overlays', async () => {
      // Sheet introduces no new directional positioning logic of its own: it
      // has one fixed edge (bottom) that is not mirrored by RTL, and its
      // title/description/handle are the same `Text`/`View` primitives whose
      // logical-direction behavior is already proven by #141
      // (`issue-141-rtl-overlay-acceptance.test.tsx`) against the shared
      // `resolveDirection` resolver. This test only re-confirms Sheet's own
      // title uses a logical (`pe-`, not `pr-`/`pl-`) class rather than
      // re-deriving RTL acceptance from scratch.
      await renderAndSettle(
        <Sheet defaultOpen>
          <SheetContent testID="sheet-content">
            <SheetTitle testID="sheet-title">Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      const title = screen.getByTestId('sheet-title');
      const className = String(title.props.className ?? '');
      expect(className).toMatch(/\bpe-8\b/);
      expect(className).not.toMatch(/\bpr-8\b|\bpl-8\b/);
    });
  });
});
