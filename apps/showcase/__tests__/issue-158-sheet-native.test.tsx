import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';
import { Input } from '../../../packages/ui/src/components/input';
// Explicit `.native` suffix (mirrors `issue-173-date-picker-native.test.tsx`):
// forces the native presentation regardless of Jest's default platform
// resolution, and is the only way to exercise the file that imports
// `@gorhom/bottom-sheet` at all.
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
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

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = ReactActual.forwardRef(
    (
      props: {
        backdropComponent?: (p: MockBackdropProps) => React.ReactNode;
        children?: React.ReactNode;
        handleComponent?: ((p: MockHandleProps) => React.ReactNode) | null;
        onDismiss?: () => void;
      },
      ref: unknown,
    ) => {
      latestOnDismiss = props.onDismiss;
      latestBackdropComponent = props.backdropComponent;
      latestHandleComponent = props.handleComponent;
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
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
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

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockPresent).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Open sheet' }));
    expect(mockPresent).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockDismiss).toHaveBeenCalledTimes(2);
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
