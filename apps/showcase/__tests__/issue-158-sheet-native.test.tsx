import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../packages/ui/src/components/button';
import { Input } from '../../../packages/ui/src/components/input';
import {
  OverlayPortal,
  useOverlayRuntimeSnapshot,
} from '../../../packages/ui/src/components/overlay-runtime';
import { BeeUIProvider } from '../../../packages/ui/src/components/safe-area';
import { BeeThemeScope } from '../../../packages/ui/src/components/theme-scope';
import { useBeeThemeScopeSnapshot } from '../../../packages/ui/src/components/theme-scope-bridge';
import { useToast } from '../../../packages/ui/src/components/toast';
// Explicit `.native` suffix (mirrors `issue-173-date-picker-native.test.tsx`):
// forces the native presentation regardless of Jest's default platform
// resolution, and is the only way to exercise the file that imports
// `@gorhom/bottom-sheet` at all.
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetProvider,
  SheetTitle,
  SheetTrigger,
} from '../../../packages/ui/src/components/sheet.native';

// BeeUI issue #158 (R4B.3, ADR-006 `docs/decisions/006-sheet-gesture-engine.md`).
// Deterministic contract tests for the native `@gorhom/bottom-sheet` adapter:
// gorhom's own gesture/drag/spring physics are mocked (no native module
// registry, no Reanimated worklet runtime in Jest), so these tests prove
// BeeUI's own wiring around the seam — present/dismiss lifecycle, backdrop
// dismissal, Android Back precedence, `dismissOnRequestClose` veto/re-present,
// and accessibility relationship registration — not gorhom's own physics,
// which real native runtime acceptance (#160) owns.

// `react-native-reanimated` is mocked globally in `jest.setup.ts` (needed by
// every suite that imports `@beemvp/beeui-ui`, not just this one — see that file's
// docblock) so this suite does not redeclare its own copy.

type MockBackdropProps = { animatedIndex: { value: number } };
type MockHandleProps = Record<string, never>;

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestOnDismiss: (() => void) | undefined;
let latestBackdropComponent: ((props: MockBackdropProps) => React.ReactNode) | undefined;
let latestHandleComponent: ((props: MockHandleProps) => React.ReactNode) | null | undefined;
let latestEnableDynamicSizing: boolean | undefined;
let latestSnapPoints: readonly unknown[] | undefined;
let latestAccessible: boolean | undefined;
let bottomSheetViewRenders = 0;

// gorhom's real `BottomSheetModal` does not mount its children where it is
// rendered: it hands them to its own store-backed portal, which mounts them
// under `BottomSheetModalProvider`, outside the `Sheet` tree and outside any
// provider declared below the gorhom provider. `mockDetachChildren` makes the
// mock do the same — children are published to `mockDetachedStore` and only
// `MockDetachedHost` (rendered by the test, outside `Sheet`) mounts them.
let mockDetachChildren = false;
const mockDetachedStore = {
  children: null as React.ReactNode,
  listeners: new Set<() => void>(),
  publish(children: React.ReactNode) {
    mockDetachedStore.children = children;
    mockDetachedStore.listeners.forEach((listener) => listener());
  },
};

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  const BottomSheetModalInternalContext = ReactActual.createContext(null);
  const BottomSheetModalProvider = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(
      BottomSheetModalInternalContext.Provider,
      { value: { hostName: 'mock-bottom-sheet-host' } },
      children,
    );
  const useBottomSheetModalInternal = (_unsafe?: boolean) =>
    ReactActual.useContext(BottomSheetModalInternalContext);

  const BottomSheetModal = ReactActual.forwardRef(
    (
      props: {
        accessible?: boolean;
        backdropComponent?: (p: MockBackdropProps) => React.ReactNode;
        children?: React.ReactNode;
        enableDynamicSizing?: boolean;
        handleComponent?: ((p: MockHandleProps) => React.ReactNode) | null;
        onDismiss?: () => void;
        snapPoints?: readonly unknown[];
      },
      ref: unknown,
    ) => {
      latestOnDismiss = props.onDismiss;
      latestBackdropComponent = props.backdropComponent;
      latestHandleComponent = props.handleComponent;
      latestEnableDynamicSizing = props.enableDynamicSizing;
      latestSnapPoints = props.snapPoints;
      latestAccessible = props.accessible;
      ReactActual.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      const detached = mockDetachChildren;
      ReactActual.useEffect(() => {
        if (!detached) return undefined;
        mockDetachedStore.publish(props.children);
        return () => mockDetachedStore.publish(null);
      });
      return ReactActual.createElement(
        View,
        { testID: 'mock-bottom-sheet-modal' },
        props.backdropComponent
          ? props.backdropComponent({ animatedIndex: { value: 0 } })
          : null,
        props.handleComponent ? props.handleComponent({}) : null,
        detached ? null : props.children,
      );
    },
  );

  const BottomSheetView = ({ children }: { children?: React.ReactNode }) => {
    bottomSheetViewRenders += 1;
    return ReactActual.createElement(View, null, children);
  };

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetModalProvider,
    BottomSheetView,
    useBottomSheetModalInternal,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    GestureHandlerRootView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) =>
        ReactActual.createElement(View, { ref, ...props }, children),
    ),
  };
});

function MockDetachedHost() {
  const [, rerender] = React.useReducer((count: number) => count + 1, 0);
  React.useEffect(() => {
    mockDetachedStore.listeners.add(rerender);
    // The modal's effect may have published before this host subscribed.
    rerender();
    return () => {
      mockDetachedStore.listeners.delete(rerender);
    };
  }, []);
  return <View testID="mock-detached-host">{mockDetachedStore.children}</View>;
}

let androidBackListener: (() => boolean) | undefined;

function mockPressAndroidBack(): boolean {
  return androidBackListener ? androidBackListener() : false;
}

// `@react-native/jest-preset` (via jest-expo) does not ship a `mockPressBack`
// helper on `BackHandler` for this RN version; this hand-rolled mock covers
// exactly the `addEventListener('hardwareBackPress', ...)` seam
// `sheet.native.tsx` uses.
jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: (_eventName: string, handler: () => boolean) => {
      androidBackListener = handler;
      return { remove: () => { androidBackListener = undefined; } };
    },
    removeEventListener: () => undefined,
  },
}));

const SAFE_AREA_INSETS = { top: 20, right: 0, bottom: 30, left: 0 };
const ConsumerContext = React.createContext('missing-consumer-context');

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  const frame = { x: 0, y: 0, width: 300, height: 600 };
  const SafeAreaInsetsContext = ReactActual.createContext(SAFE_AREA_INSETS);
  const SafeAreaFrameContext = ReactActual.createContext(frame);

  return {
    initialWindowMetrics: { frame, insets: SAFE_AREA_INSETS },
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) =>
        ReactActual.createElement(View, { ref, ...props }, children),
    ),
    useSafeAreaFrame: () => ReactActual.useContext(SafeAreaFrameContext),
    useSafeAreaInsets: () => ReactActual.useContext(SafeAreaInsetsContext),
  };
});

const originalPlatformOS = Platform.OS;

function setPlatform(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
  latestOnDismiss = undefined;
  latestBackdropComponent = undefined;
  latestHandleComponent = undefined;
  latestAccessible = undefined;
  bottomSheetViewRenders = 0;
  mockDetachChildren = false;
  mockDetachedStore.children = null;
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
});

describe('BeeUI issue #619 SheetProvider native ownership contract', () => {
  it('mounts a BeeUI-owned gorhom provider for descendants', () => {
    const { useBottomSheetModalInternal } = require('@gorhom/bottom-sheet');

    function ProviderProbe() {
      const context = useBottomSheetModalInternal(true);
      return <RNText testID="sheet-provider-probe">{context ? 'provider:yes' : 'provider:no'}</RNText>;
    }

    render(
      <SheetProvider>
        <ProviderProbe />
      </SheetProvider>,
    );

    expect(screen.getByTestId('sheet-provider-probe').props.children).toBe('provider:yes');
  });

  it('reports an outer gorhom provider as a dev misconfiguration and still owns an inner provider', () => {
    const { BottomSheetModalProvider, useBottomSheetModalInternal } = require('@gorhom/bottom-sheet');
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    function ProviderProbe() {
      const context = useBottomSheetModalInternal(true);
      return <RNText testID="nested-sheet-provider-probe">{context ? 'provider:yes' : 'provider:no'}</RNText>;
    }

    render(
      <BottomSheetModalProvider>
        <SheetProvider>
          <ProviderProbe />
        </SheetProvider>
      </BottomSheetModalProvider>,
    );

    expect(screen.getByTestId('nested-sheet-provider-probe').props.children).toBe('provider:yes');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'SheetProvider detected an outer @gorhom/bottom-sheet BottomSheetModalProvider',
      ),
    );
    error.mockRestore();
  });
});

describe('BeeUI issue #158 Sheet (native/@gorhom/bottom-sheet adapter) contract', () => {
  it('presents on open and dismisses on close, driven by the controlled/uncontrolled contract', () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
          <SheetClose>Done</SheetClose>
        </SheetContent>
      </Sheet>,
    );

    // A closed sheet that was never presented sends gorhom nothing: a
    // mount-time `dismiss()` unmounts a modal that never mounted and the
    // later `present()` then renders nothing on device (#584).
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockPresent).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
    expect(mockPresent).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // #584 — gorhom v5's `enableDynamicSizing` defaults to `true`, which
  // measures `BottomSheetView`'s own `flex: 1` content (unbounded, so it
  // measures 0) as the first snap point instead of respecting the explicit
  // `snapPoints` BeeUI already always supplies. A real-device report showed
  // `present()` called with no visible sheet and no `onChange` at all;
  // real-device confirmation of the fix remains an owner gate (see
  // `plans/260918-1559-consumer-audit-fix-all/reports/ws-b-sheet-584.md`),
  // but this locks in the deterministic part: the prop is always passed.
  it('always disables gorhom dynamic sizing, since snapPoints is always explicit (#584)', () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(latestEnableDynamicSizing).toBe(false);
    expect(latestSnapPoints).toEqual(['90%']);
  });

  it('disables dynamic sizing the same way when the caller supplies explicit snapPoints', () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent snapPoints={['50%', '90%']} testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(latestEnableDynamicSizing).toBe(false);
    expect(latestSnapPoints).toEqual(['50%', '90%']);
  });

  it('honors the controlled open/onOpenChange contract via the custom backdrop press', () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent overlayTestID="sheet-overlay" testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(mockPresent).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('sheet-overlay', { includeHiddenElements: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the Sheet open when backdrop dismissal is disabled', () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent closeOnBackdropPress={false} overlayTestID="sheet-overlay" testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.press(screen.getByTestId('sheet-overlay', { includeHiddenElements: true }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('treats a gorhom-initiated dismiss (gesture/swipe) as a real close and notifies the caller', () => {
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('re-presents after a gorhom-initiated dismiss when dismissOnRequestClose is false', () => {
    const onOpenChange = jest.fn();
    const onRequestClose = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent
          dismissOnRequestClose={false}
          onRequestClose={onRequestClose}
          testID="sheet-content"
        >
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    mockPresent.mockClear();

    act(() => latestOnDismiss?.());

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });

  it('does not treat our own effect-driven dismiss() as a gorhom-initiated close', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    rerender(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockDismiss).toHaveBeenCalled();

    onOpenChange.mockClear();
    act(() => latestOnDismiss?.());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('consumes Android hardware back while open and closes the Sheet', () => {
    setPlatform('android');
    const onOpenChange = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const handled = mockPressAndroidBack();
    expect(handled).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('notifies onRequestClose without closing on Android back when dismissOnRequestClose is false', () => {
    setPlatform('android');
    const onOpenChange = jest.fn();
    const onRequestClose = jest.fn();
    render(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent
          dismissOnRequestClose={false}
          onRequestClose={onRequestClose}
          testID="sheet-content"
        >
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    const handled = mockPressAndroidBack();
    expect(handled).toBe(true);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('registers SheetTitle/SheetDescription into the content accessibility relationship', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine results by category.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const content = screen.getByTestId('sheet-content');
    expect(content.props.role).toBe('dialog');
    expect(content.props.accessibilityLabel).toBe('Filters');
    expect(content.props.accessibilityHint).toBe('Refine results by category.');
    const title = screen.getByText('Filters');
    expect(content.props.accessibilityLabelledBy).toBe(title.props.nativeID);
  });

  it('renders the default drag handle through the gorhom handle slot and can hide it', () => {
    const { rerender } = render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(latestHandleComponent).toBeTruthy();

    rerender(
      <Sheet defaultOpen>
        <SheetContent showHandle={false} testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(latestHandleComponent).toBeNull();
  });

  it('accepts text input focus and edits inside the panel', () => {
    const onChangeText = jest.fn();
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Add note</SheetTitle>
          <Input accessibilityLabel="Note" onChangeText={onChangeText} />
        </SheetContent>
      </Sheet>,
    );

    fireEvent.changeText(screen.getByLabelText('Note'), 'Follow up tomorrow');
    expect(onChangeText).toHaveBeenCalledWith('Follow up tomorrow');
  });
});

// #584 — a real Expo 57 consumer on iPhone 16 Pro / iOS 18.6 called
// `present()` on a mounted `BottomSheetModal` and nothing rendered: no error,
// no `onChange`. Two things had to be true for that, and both are pinned here.
describe('BeeUI issue #584 Sheet presents on the native gorhom engine', () => {
  it('sends dismiss() only for a sheet it presented, never on mount and never after gorhom dismissed it', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    // A closed, never-presented modal must not be told to dismiss: gorhom's
    // closed-state early exit then unmounts a portal that never mounted and
    // the following `present()` mounts nothing.
    expect(mockDismiss).not.toHaveBeenCalled();

    rerender(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockPresent).toHaveBeenCalledTimes(1);

    // gorhom closed itself (swipe, backdrop): it has already unmounted, so
    // the caller's matching `open={false}` has nothing left to dismiss.
    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    rerender(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockDismiss).not.toHaveBeenCalled();

    // A sheet BeeUI presented and the caller closes is dismissed once.
    rerender(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockPresent).toHaveBeenCalledTimes(2);
    rerender(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the Sheet root, safe-area, and overlay runtime contexts reachable when the engine mounts the content elsewhere', () => {
    mockDetachChildren = true;
    const onOpenChange = jest.fn();
    const bridgedInsets = { top: 0, right: 0, bottom: 44, left: 0 };

    function ContextProbe() {
      const insets = useSafeAreaInsets();
      const overlay = useOverlayRuntimeSnapshot();
      const consumer = React.useContext(ConsumerContext);
      const theme = useBeeThemeScopeSnapshot();
      const toast = useToast();
      return (
        <>
          <RNText testID="context-probe">
            {`inset-bottom:${insets.bottom} runtime:${overlay.runtime ? 'yes' : 'no'} transport:${
              overlay.transport?.mode ?? 'none'
            } consumer:${consumer} theme:${theme ?? 'none'}`}
          </RNText>
          <Button testID="sheet-toast" onPress={() => toast.show({ title: 'Inside sheet toast' })}>
            Toast
          </Button>
        </>
      );
    }

    render(
      <>
        <BeeUIProvider>
          <SafeAreaInsetsContext.Provider value={bridgedInsets}>
            <ConsumerContext.Provider value="consumer-ok">
              <BeeThemeScope appearance="dark" brand="violet">
                <Sheet onOpenChange={onOpenChange} open>
                  <SheetContent bridgeContexts={[ConsumerContext]} testID="sheet-content">
                    <SheetTitle>Filters</SheetTitle>
                    <ContextProbe />
                    <SheetClose testID="sheet-close">Done</SheetClose>
                  </SheetContent>
                </Sheet>
              </BeeThemeScope>
            </ConsumerContext.Provider>
          </SafeAreaInsetsContext.Provider>
        </BeeUIProvider>
        <MockDetachedHost />
      </>,
    );

    // The content really mounted under the detached host, not under `Sheet`.
    const content = screen.getByTestId('sheet-content');
    let ancestor = content.parent;
    let underDetachedHost = false;
    while (ancestor) {
      if (ancestor.props?.testID === 'mock-detached-host') underDetachedHost = true;
      ancestor = ancestor.parent;
    }
    expect(underDetachedHost).toBe(true);
    expect(screen.queryByTestId('mock-detached-host')).toBeTruthy();

    // Without the bridge `SheetClose` throws "Sheet components must be used
    // inside Sheet." on the device; with it, the close reaches the root.
    fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // The insets declared above the Sheet (not the mock default) and the
    // overlay runtime from `BeeUIProvider` both reach the detached content.
    expect(screen.getByTestId('context-probe').props.children).toBe(
      'inset-bottom:44 runtime:yes transport:legacy consumer:consumer-ok theme:violet-dark',
    );

    fireEvent.press(screen.getByTestId('sheet-toast'));
    expect(screen.getByText('Inside sheet toast', { includeHiddenElements: true })).toBeTruthy();
    const localViewport = screen.getByTestId('beeui-toast-local-viewport', {
      includeHiddenElements: true,
    });
    let viewportAncestor = localViewport.parent;
    let viewportUnderDetachedHost = false;
    while (viewportAncestor) {
      if (viewportAncestor.props?.testID === 'mock-detached-host') viewportUnderDetachedHost = true;
      viewportAncestor = viewportAncestor.parent;
    }
    expect(viewportUnderDetachedHost).toBe(true);
    expect(
      screen.queryByTestId('beeui-toast-viewport', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('keeps the root toast viewport when a mounted Sheet is closed', () => {
    render(
      <BeeUIProvider>
        <Sheet onOpenChange={() => {}} open={false}>
          <SheetContent testID="closed-sheet-content">
            <SheetTitle>Closed sheet</SheetTitle>
          </SheetContent>
        </Sheet>
      </BeeUIProvider>,
    );

    expect(screen.getByTestId('beeui-toast-viewport')).toBeTruthy();
    expect(
      screen.queryByTestId('beeui-toast-local-viewport', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('renders the shared toast store only in the topmost active Sheet viewport', async () => {
    render(
      <BeeUIProvider>
        <Sheet onOpenChange={() => {}} open>
          <SheetContent testID="first-sheet-content">
            <SheetTitle>First</SheetTitle>
          </SheetContent>
        </Sheet>
        <Sheet onOpenChange={() => {}} open>
          <SheetContent testID="second-sheet-content">
            <SheetTitle>Second</SheetTitle>
          </SheetContent>
        </Sheet>
      </BeeUIProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByTestId('beeui-toast-local-viewport', { includeHiddenElements: true }),
      ).toHaveLength(1);
    });
    expect(
      screen.queryByTestId('beeui-toast-viewport', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('routes anchored-overlay portal content inside a detached Sheet to its modal-local host', async () => {
    mockDetachChildren = true;

    render(
      <>
        <BeeUIProvider>
          <Sheet onOpenChange={() => {}} open>
            <SheetContent testID="overlay-sheet-content">
              <SheetTitle>Overlay sheet</SheetTitle>
              <OverlayPortal overlayId="sheet-overlay-probe">
                <RNText testID="sheet-overlay-portal-content">Overlay inside sheet</RNText>
              </OverlayPortal>
            </SheetContent>
          </Sheet>
        </BeeUIProvider>
        <MockDetachedHost />
      </>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('sheet-overlay-portal-content', { includeHiddenElements: true }),
      ).toBeTruthy();
    });

    const overlay = screen.getByTestId('sheet-overlay-portal-content', {
      includeHiddenElements: true,
    });
    let ancestor = overlay.parent;
    let underDetachedHost = false;
    while (ancestor) {
      if (ancestor.props?.testID === 'mock-detached-host') underDetachedHost = true;
      ancestor = ancestor.parent;
    }
    expect(underDetachedHost).toBe(true);
  });

  it('renders the content in an in-flow flex box directly under the modal, with the modal not claiming accessibility for it', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    // gorhom's `BottomSheetView` is absolutely positioned and content-sized
    // for its dynamic sizing, which BeeUI turns off; wrapping the content in
    // it left the sheet content-sized at the top of a transparent sheet.
    expect(bottomSheetViewRenders).toBe(0);

    // modal > flex:1 View (in flow) > absolute-fill a11y boundary > content.
    const modal = screen.getByTestId('mock-bottom-sheet-modal');
    const content = screen.getByTestId('sheet-content');
    const chain: Array<{ props: Record<string, unknown> }> = [];
    let node = content.parent;
    while (node && node !== modal) {
      if (typeof node.type === 'string') chain.push(node);
      node = node.parent;
    }
    expect(node).toBe(modal);
    const hostViews = chain.map((view) => StyleSheet.flatten(view.props.style as never) ?? {});
    const fillBox = hostViews[hostViews.length - 1];
    expect(fillBox).toMatchObject({ flex: 1 });
    expect(fillBox.position).toBeUndefined();
    const boundary = chain.find((view) => view.props.accessibilityViewIsModal === true);
    expect(boundary).toBeTruthy();
    expect(hostViews.filter((style) => style.position === 'absolute')).toHaveLength(1);

    // gorhom's default `accessible` container would fold the whole subtree
    // into one "Bottom Sheet" element, hiding the dialog content from
    // VoiceOver and from the native smoke flow.
    expect(latestAccessible).toBe(false);
  });
});
