import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
// Explicit `.native` suffix (mirrors `issue-158-sheet-native.test.tsx`): forces the native
// presentation regardless of Jest's default platform resolution, and is the only way to
// exercise the file that imports `@gorhom/bottom-sheet` at all.
import { Sheet, SheetContent, SheetTitle } from '../../../packages/ui/src/components/sheet.native';

// #618 (Astra review, item 4), plausible-but-unverified: `sheet.native.tsx`'s
// `handleDismiss` (gorhom's `onDismiss`) resets `presentedRef` and checks `openRef.current`
// to tell "gorhom closed itself, notify the caller" from "we already caused and notified
// this close ourselves" — but it has no way to tell a *stale* dismiss apart from a current
// one: if the caller toggles open=true -> false -> true (a rapid close-then-reopen) before
// gorhom's asynchronous `onDismiss` for the middle `dismiss()` call finally arrives, that
// late callback used to overwrite the just-reopened state and fire `onOpenChange(false)`
// for a close the caller had already superseded. This is a deterministic reproduction using
// the gorhom mock: open -> close -> open, then fire the pending (stale) `onDismiss`.

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestOnDismiss: (() => void) | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');

  const BottomSheetModal = ReactActual.forwardRef(
    (props: { children?: React.ReactNode; onDismiss?: () => void }, ref: unknown) => {
      latestOnDismiss = props.onDismiss;
      ReactActual.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return ReactActual.createElement(RNView, { testID: 'mock-bottom-sheet-modal' }, props.children);
    },
  );

  const BottomSheetView = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement(RNView, null, children);

  return { __esModule: true, BottomSheetModal, BottomSheetView };
});

const SAFE_AREA_INSETS = { top: 20, right: 0, bottom: 30, left: 0 };

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');

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
        ReactActual.createElement(RNView, { ref, ...props }, children),
    ),
    useSafeAreaFrame: () => ReactActual.useContext(SafeAreaFrameContext),
    useSafeAreaInsets: () => ReactActual.useContext(SafeAreaInsetsContext),
  };
});

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
  latestOnDismiss = undefined;
});

function renderSheet(onOpenChange: (open: boolean) => void, open: boolean) {
  return render(
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent testID="sheet-content">
        <SheetTitle>Filters</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
}

describe('Sheet (native) rapid close→reopen race', () => {
  it('queues reopen until the in-flight dismiss completes', () => {
    const onOpenChange = jest.fn();
    const { rerender } = renderSheet(onOpenChange, true);

    rerender(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    const pending = latestOnDismiss;

    rerender(
      <Sheet onOpenChange={onOpenChange} open>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(mockPresent).toHaveBeenCalledTimes(1);

    onOpenChange.mockClear();
    act(() => pending?.());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mockPresent).toHaveBeenCalledTimes(2);

    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('still treats a non-racing gorhom dismiss as a real close', () => {
    const onOpenChange = jest.fn();
    renderSheet(onOpenChange, true);
    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('no-ops for our own effect-driven dismiss when no reopen races it', () => {
    const onOpenChange = jest.fn();
    const { rerender } = renderSheet(onOpenChange, true);

    rerender(
      <Sheet onOpenChange={onOpenChange} open={false}>
        <SheetContent testID="sheet-content">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    onOpenChange.mockClear();
    act(() => latestOnDismiss?.());

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });
});
