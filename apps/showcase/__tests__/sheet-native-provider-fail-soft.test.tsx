import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Text as RNText, UIManager } from 'react-native';
import { useOverlayRuntimeSnapshot } from '../../../packages/ui/src/components/overlay-runtime';
import { BeeUIProvider } from '../../../packages/ui/src/components/safe-area';
// Explicit `.native` suffix: forces the `@gorhom/bottom-sheet` adapter regardless of
// Jest's default platform resolution.
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetProvider,
  SheetTitle,
} from '../../../packages/ui/src/components/sheet.native';

// A native Sheet must never take the app down when the app root lacks `SheetProvider`.
// The gorhom and teleport mocks keep only the provider topology of the real libraries
// (see `helpers/gorhom-modal-portal-mock.tsx`): gorhom throws without its modal provider
// and mounts presented content under that provider's host; teleport throws for any host
// or portal outside its provider.

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

function TransportProbe() {
  const { transport } = useOverlayRuntimeSnapshot();
  return <RNText testID="sheet-transport-probe">{transport?.mode ?? 'none'}</RNText>;
}

function ControlledSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent testID="sheet-content">
        <SheetTitle>Filters</SheetTitle>
        <TransportProbe />
        <SheetClose testID="sheet-close">Done</SheetClose>
      </SheetContent>
    </Sheet>
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

// Runs first: the missing-provider error is emitted once per JS runtime, so the
// "no error with SheetProvider" assertion must not follow a test that already emitted it.
describe('Sheet (native) with SheetProvider', () => {
  it('presents inside the BeeUI runtime with the native-teleport transport and logs nothing', async () => {
    const onOpenChange = jest.fn();
    const ui = (open: boolean) => (
      <BeeUIProvider>
        <SheetProvider>
          <ControlledSheet onOpenChange={onOpenChange} open={open} />
        </SheetProvider>
      </BeeUIProvider>
    );

    const { rerender } = render(ui(false));
    await settle();
    expect(screen.queryByTestId('sheet-content')).toBeNull();

    rerender(ui(true));
    await settle();

    expect(screen.getByTestId('sheet-content')).toBeTruthy();
    expect(screen.getByTestId('sheet-transport-probe').props.children).toBe('native-teleport');
    fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sheetProviderErrors()).toHaveLength(0);
  });
});

describe('Sheet (native) without any sheet modal provider', () => {
  it('does not throw when opened and logs one actionable development error', async () => {
    const onOpenChange = jest.fn();
    const ui = (open: boolean) => (
      <BeeUIProvider>
        <ControlledSheet onOpenChange={onOpenChange} open={open} />
        <Sheet defaultOpen>
          <SheetContent testID="second-sheet-content">
            <SheetTitle>Second</SheetTitle>
          </SheetContent>
        </Sheet>
      </BeeUIProvider>
    );

    const { rerender } = render(ui(false));
    await settle();
    rerender(ui(true));
    await settle();
    rerender(ui(false));
    await settle();
    rerender(ui(true));
    await settle();

    // Nothing can be presented without a modal host: the sheet stays hidden instead
    // of rendering in place or crashing the tree.
    expect(screen.queryByTestId('sheet-content')).toBeNull();
    expect(screen.queryByTestId('second-sheet-content')).toBeNull();

    const errors = sheetProviderErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0][0]).toContain('<BeeUIProvider><SheetProvider>');
  });
});
