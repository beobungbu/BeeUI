import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Text as RNText, UIManager } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { OverlayPortal } from '../../../packages/ui/src/components/overlay-runtime';
import { BeeUIProvider } from '../../../packages/ui/src/components/safe-area';
// Explicit `.native` suffix: forces the `@gorhom/bottom-sheet` adapter regardless of
// Jest's default platform resolution.
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '../../../packages/ui/src/components/sheet.native';

// Apps wired before `SheetProvider` existed mount gorhom's `BottomSheetModalProvider`
// ABOVE `BeeUIProvider`. gorhom then mounts presented Sheet content under its own host,
// outside BeeUI's overlay runtime and outside teleport's `PortalProvider`. Opening such
// a Sheet must not crash the app. Mocks: see `helpers/gorhom-modal-portal-mock.tsx`.

jest.mock('@gorhom/bottom-sheet', () =>
  require('./helpers/gorhom-modal-portal-mock').createGorhomModalPortalMock(),
);
jest.mock('react-native-teleport', () =>
  require('./helpers/gorhom-modal-portal-mock').createTeleportProviderGuardMock(),
);

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 600 };
  const SafeAreaInsetsContext = ReactActual.createContext(insets);
  const SafeAreaFrameContext = ReactActual.createContext(frame);
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) =>
        ReactActual.createElement(View, { ref, ...props }, children),
    ),
    useSafeAreaFrame: () => ReactActual.useContext(SafeAreaFrameContext),
    useSafeAreaInsets: () => ReactActual.useContext(SafeAreaInsetsContext),
  };
});

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  // A New Architecture runtime with teleport's host view registered, as in the
  // consumer build: BeeUIProvider picks the native-teleport overlay transport.
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
    remove: () => undefined,
  } as ReturnType<typeof AccessibilityInfo.addEventListener>);
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
});

function sheetProviderErrors() {
  return consoleError.mock.calls.filter((args) =>
    args.some((arg) => typeof arg === 'string' && arg.includes('SheetProvider')),
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Sheet (native) under an outer gorhom provider without SheetProvider', () => {
  it('opens without throwing, keeps nested overlays working, and logs one development error', async () => {
    const onOpenChange = jest.fn();
    const ui = (open: boolean) => (
      <BottomSheetModalProvider>
        <BeeUIProvider>
          <Sheet onOpenChange={onOpenChange} open={open}>
            <SheetContent testID="sheet-content">
              <SheetTitle>Filters</SheetTitle>
              <OverlayPortal overlayId="nested-overlay-probe">
                <RNText testID="nested-overlay-content">Nested overlay</RNText>
              </OverlayPortal>
              <SheetClose testID="sheet-close">Done</SheetClose>
            </SheetContent>
          </Sheet>
        </BeeUIProvider>
      </BottomSheetModalProvider>
    );

    const { rerender } = render(ui(false));
    await settle();
    rerender(ui(true));
    await settle();

    // The content mounts under gorhom's host, outside BeeUIProvider, and still works.
    expect(screen.getByTestId('sheet-content')).toBeTruthy();
    expect(
      screen.getByTestId('nested-overlay-content', { includeHiddenElements: true }),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(ui(false));
    await settle();
    rerender(ui(true));
    await settle();
    expect(screen.getByTestId('sheet-content')).toBeTruthy();

    const errors = sheetProviderErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0][0]).toContain('<BeeUIProvider><SheetProvider>');
  });
});
