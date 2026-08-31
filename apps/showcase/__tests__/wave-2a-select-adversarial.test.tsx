import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@beemvp/beeui-ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Modal, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';

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
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
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

const ROOT_RECT = { x: 0, y: 0, width: 390, height: 844 };
const ANCHOR_RECT = { x: 40, y: 100, width: 220, height: 44 };
const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;
const originalPlatformOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}


function getSelectContents(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(View).filter((node) => {
    const nativeID = node.props.nativeID;
    return (
      typeof nativeID === 'string' &&
      nativeID.startsWith('beeui-select-') &&
      nativeID.endsWith('-content')
    );
  });
}

function getOpenSelectContents(screen: ReturnType<typeof render>) {
  return getSelectContents(screen).filter(
    (content) => StyleSheet.flatten(content.props.style)?.display !== 'none',
  );
}

function getOpenSelectTriggerCount(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(View).filter(
    (node) => node.props.role === 'combobox' && node.props.accessibilityState?.expanded === true,
  ).length;
}

function layoutOpenSelectContents(screen: ReturnType<typeof render>) {
  for (const content of getOpenSelectContents(screen)) {
    fireEvent(content, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 260, height: 180 } },
    });
  }
}

async function settleOpenSelectContents(screen: ReturnType<typeof render>) {
  const openTriggerCount = getOpenSelectTriggerCount(screen);
  if (openTriggerCount === 0) return;

  await waitFor(() => {
    expect(getOpenSelectContents(screen).length).toBeGreaterThanOrEqual(openTriggerCount);
  });

  layoutOpenSelectContents(screen);

  await waitFor(() => {
    const openContents = getOpenSelectContents(screen);
    expect(openContents.length).toBeGreaterThanOrEqual(openTriggerCount);
    for (const content of openContents) {
      expect(content.props.pointerEvents).toBe('auto');
      expect(content.props['aria-hidden']).not.toBe(true);
    }
  });
}

async function renderRoot(ui: React.ReactNode) {
  const seam = createAnchorSeam({
    match: (testID) => testID.includes('trigger'),
    rectFor: () => ANCHOR_RECT,
    modalHostRect: ROOT_RECT,
  });
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>{ui}</OverlayRuntimeProvider>,
  );
  await settleOpenSelectContents(screen);
  return screen;
}

beforeEach(() => {
  setTeleportAvailable(true);
});

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
  clearActiveAnchorSeam();
});

describe('Wave 2A Select adversarial contracts', () => {
  it.each([0, 1, 20, 101])('keeps a %i-option list structurally usable', async (count) => {
    const options = Array.from({ length: count }, (_, index) => `option-${index}`);
    const screen = await renderRoot(
      <Select defaultOpen>
        <SelectTrigger testID="list-trigger"><SelectValue placeholder="Empty" /></SelectTrigger>
        <SelectContent maxHeight={180} testID="list-content">
          {options.map((option) => (
            <SelectItem key={option} testID={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('list-trigger').props.accessibilityState.expanded).toBe(true));
    if (count === 0) {
      expect(screen.queryByText('option-0')).toBeNull();
    } else {
      expect(screen.getByTestId('option-0')).toBeTruthy();
      expect(screen.getByTestId(`option-${count - 1}`)).toBeTruthy();
    }
  });

  it('keeps the selected value stable when the selected item becomes disabled', async () => {
    const onValueChange = jest.fn();
    function Fixture() {
      const [disabled, setDisabled] = React.useState(false);
      return (
        <>
          <Text testID="disable-selected" onPress={() => setDisabled(true)}>disable</Text>
          <Select defaultOpen defaultValue="apple" onValueChange={onValueChange}>
            <SelectTrigger testID="selected-trigger"><SelectValue testID="selected-value" /></SelectTrigger>
            <SelectContent>
              <SelectItem disabled={disabled} testID="selected-item" value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </>
      );
    }
    const screen = await renderRoot(<Fixture />);

    await waitFor(() => expect(screen.getByTestId('selected-value').props.children).toBe('Apple'));
    fireEvent.press(screen.getByTestId('disable-selected'));
    await waitFor(() => {
      expect(screen.getByTestId('selected-item').props.accessibilityState.disabled).toBe(true);
      expect(screen.getByTestId('selected-item').props.accessibilityState.selected).toBe(true);
    });
    fireEvent.press(screen.getByTestId('selected-item'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected-value').props.children).toBe('Apple');
  });

  it('survives rapid trigger open/close without mutating selection', async () => {
    const screen = await renderRoot(
      <Select defaultValue="apple">
        <SelectTrigger testID="rapid-trigger"><SelectValue testID="rapid-value" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('rapid-value').props.children).toBe('Apple'));
    for (let index = 0; index < 6; index += 1) fireEvent.press(screen.getByTestId('rapid-trigger'));
    expect(screen.getByTestId('rapid-trigger').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('rapid-value').props.children).toBe('Apple');
  });

  it('can select after its overlay host geometry moves', async () => {
    const onValueChange = jest.fn();
    function Fixture({ hostX }: { hostX: number }) {
      return (
        <OverlayRuntimeProvider hostRectOverride={{ ...ROOT_RECT, x: hostX }}>
          <Select defaultOpen defaultValue="apple" onValueChange={onValueChange}>
            <SelectTrigger testID="move-trigger"><SelectValue testID="move-value" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem testID="move-banana" value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </OverlayRuntimeProvider>
      );
    }
    const seam = createAnchorSeam({
      match: (testID) => testID.includes('trigger'),
      rectFor: () => ANCHOR_RECT,
    });
    const screen = render(<Fixture hostX={0} />);
    await settleOpenSelectContents(screen);
    await waitFor(() => expect(screen.getByTestId('move-value').props.children).toBe('Apple'));

    screen.rerender(<Fixture hostX={18} />);
    await settleOpenSelectContents(screen);
    fireEvent.press(screen.getByTestId('move-banana'));

    expect(onValueChange).toHaveBeenCalledWith('banana');
    await waitFor(() => expect(screen.getByTestId('move-value').props.children).toBe('Banana'));
  });

  it('treats an explicit controlled value={undefined} as controlled empty selection', async () => {
    const onValueChange = jest.fn();
    const screen = await renderRoot(
      <Select defaultOpen value={undefined} onValueChange={onValueChange}>
        <SelectTrigger testID="empty-controlled-trigger">
          <SelectValue placeholder="Nothing selected" testID="empty-controlled-value" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem testID="empty-controlled-apple" value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('empty-controlled-value').props.children).toBe('Nothing selected'));
    fireEvent.press(screen.getByTestId('empty-controlled-apple'));
    expect(onValueChange).toHaveBeenCalledWith('apple');
    expect(screen.getByTestId('empty-controlled-value').props.children).toBe('Nothing selected');
  });

  it('does not restore focus until a controlled close request is actually committed', async () => {
    setPlatform('web');
    const onOpenChange = jest.fn();
    const focus = jest.fn();
    const seam = createAnchorSeam({
      match: () => true,
      rectFor: (testID) => (testID === 'delayed-trigger' ? ANCHOR_RECT : undefined),
      explicitFocus: { 'delayed-trigger': focus },
    });
    function Fixture({ open }: { open: boolean }) {
      return (
        <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
          <Select open={open} onOpenChange={onOpenChange} defaultValue="apple">
            <SelectTrigger testID="delayed-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem testID="delayed-banana" value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </OverlayRuntimeProvider>
      );
    }
    const screen = render(<Fixture open />);
    await settleOpenSelectContents(screen);
    await waitFor(() => expect(screen.getByTestId('delayed-trigger').props.accessibilityState.expanded).toBe(true));

    fireEvent.press(screen.getByTestId('delayed-banana'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('delayed-trigger').props.accessibilityState.expanded).toBe(true);
    expect(focus).not.toHaveBeenCalled();

    screen.rerender(<Fixture open={false} />);
    await waitFor(() => expect(focus).toHaveBeenCalled());
  });

  it('Android Modal request-close dismisses a dialog-local Select before the Dialog', async () => {
    setPlatform('android');
    setTeleportAvailable(true);
    const screen = await renderRoot(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
          <Select defaultOpen>
            <SelectTrigger testID="modal-select-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>,
    );

    await waitFor(() => expect(screen.getByTestId('modal-select-trigger').props.accessibilityState.expanded).toBe(true));
    await act(async () => screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose?.());

    await waitFor(() => expect(screen.getByTestId('modal-select-trigger').props.accessibilityState.expanded).toBe(false));
    expect(screen.UNSAFE_getAllByType(Modal)[0].props.visible).toBe(true);
  });

  it('iOS Dialog request-close closes the Dialog while its Select is open', async () => {
    setPlatform('ios');
    setTeleportAvailable(true);
    const screen = await renderRoot(
      <Dialog defaultOpen>
        <DialogTrigger testID="dialog-trigger">Open</DialogTrigger>
        <DialogContent modalProps={{ presentationStyle: 'pageSheet', allowSwipeDismissal: true }}>
          <DialogTitle>Dialog</DialogTitle>
          <Select defaultOpen>
            <SelectTrigger testID="ios-select-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>,
    );

    await waitFor(() => expect(screen.getByTestId('ios-select-trigger').props.accessibilityState.expanded).toBe(true));
    await act(async () => screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose?.());

    await waitFor(() => expect(screen.UNSAFE_getAllByType(Modal)[0].props.visible).toBe(false));
  });
});
