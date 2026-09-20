import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
// Explicit `.native` suffix (mirrors `sheet-native-rapid-close-reopen.test.tsx`): forces the
// native presentation regardless of Jest's default platform resolution, and is the only way
// to exercise the file that imports `@gorhom/bottom-sheet` at all.
import { Sheet, SheetContent, SheetTitle } from '../../../packages/ui/src/components/sheet.native';

// Astra review #2, item 10 (plausible-but-unverified): `sheet-native-rapid-close-reopen.test.tsx`
// proves `handleDismiss` correctly ignores a single stale `onDismiss` superseded by one
// reopen. That fix tracked exactly one outstanding BeeUI-issued `dismiss()` call in a scalar
// ref. A second close→reopen before the *first* close's `onDismiss` arrives leaves *two*
// outstanding `dismiss()` calls in flight — gorhom exposes only one shared `onDismiss` prop
// for every completion, so a scalar ref that the first arriving callback overwrites/clears
// can no longer tell the second, later-arriving callback that it also answers a stale,
// superseded close. This is a deterministic reproduction: open → close → open → close →
// open, then both delayed `onDismiss` callbacks arrive (in each possible order across the
// two `it`s below) — the sheet must end presented and neither stale callback may fire
// `onOpenChange(false)`.

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

function sheetElement(onOpenChange: (open: boolean) => void, open: boolean) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent testID="sheet-content">
        <SheetTitle>Filters</SheetTitle>
      </SheetContent>
    </Sheet>
  );
}

// Drives open → close → open → close → open, capturing the `onDismiss` callback pending
// right after each of the two closes (both resolve to the same shared `handleDismiss`
// closure at runtime — gorhom exposes exactly one `onDismiss` prop per sheet, never one per
// `dismiss()` call — captured separately here only to mirror the two *conceptually*
// outstanding completions the review scenario describes).
function driveDoubleCloseReopenRace(onOpenChange: (open: boolean) => void) {
  const { rerender } = render(sheetElement(onOpenChange, true));
  expect(mockPresent).toHaveBeenCalledTimes(1);

  rerender(sheetElement(onOpenChange, false));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  const firstPendingOnDismiss = latestOnDismiss;

  rerender(sheetElement(onOpenChange, true));
  expect(mockPresent).toHaveBeenCalledTimes(2);

  rerender(sheetElement(onOpenChange, false));
  expect(mockDismiss).toHaveBeenCalledTimes(2);
  const secondPendingOnDismiss = latestOnDismiss;

  rerender(sheetElement(onOpenChange, true));
  expect(mockPresent).toHaveBeenCalledTimes(3);

  onOpenChange.mockClear();
  return { firstPendingOnDismiss, secondPendingOnDismiss };
}

describe('Sheet (native) double close→reopen dismiss race', () => {
  it('ignores both stale onDismiss callbacks arriving in call order, and still ends presented', () => {
    const onOpenChange = jest.fn();
    const { firstPendingOnDismiss, secondPendingOnDismiss } = driveDoubleCloseReopenRace(onOpenChange);

    act(() => firstPendingOnDismiss?.());
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => secondPendingOnDismiss?.());
    expect(onOpenChange).not.toHaveBeenCalled();

    // The sheet is still genuinely presented, not stuck: a real gorhom-initiated dismiss
    // fired now (the current, non-stale one) still closes it and notifies the caller.
    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores both stale onDismiss callbacks arriving in reverse order, and still ends presented', () => {
    const onOpenChange = jest.fn();
    const { firstPendingOnDismiss, secondPendingOnDismiss } = driveDoubleCloseReopenRace(onOpenChange);

    // The later close's completion arrives first — the literal "out of order" case.
    act(() => secondPendingOnDismiss?.());
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => firstPendingOnDismiss?.());
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => latestOnDismiss?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
