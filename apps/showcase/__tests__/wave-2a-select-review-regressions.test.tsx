import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type SelectContentProps,
  type SelectLabelProps,
} from '@beemvp/beeui-ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
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
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };

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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };
const ANCHOR_RECT = { x: 80, y: 40, width: 120, height: 44 };
const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

type Screen = ReturnType<typeof render>;

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

function getOpenSelectContents(screen: Screen) {
  return screen.UNSAFE_getAllByType(View).filter((node) => {
    const nativeID = node.props.nativeID;
    return (
      typeof nativeID === 'string' &&
      nativeID.startsWith('beeui-select-') &&
      nativeID.endsWith('-content') &&
      StyleSheet.flatten(node.props.style)?.display !== 'none'
    );
  });
}

async function settleOpenSelect(screen: Screen) {
  await waitFor(() => expect(getOpenSelectContents(screen).length).toBeGreaterThan(0));
  for (const content of getOpenSelectContents(screen)) {
    fireEvent(content, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 120 } },
    });
  }
  await waitFor(() => {
    for (const content of getOpenSelectContents(screen)) {
      expect(content.props.pointerEvents).toBe('auto');
    }
  });
}

async function renderOpen(children: React.ReactNode) {
  createAnchorSeam({
    match: (testID) => testID === 'trigger',
    rectFor: () => ANCHOR_RECT,
    modalHostRect: HOST_RECT,
  });
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
  );
  await settleOpenSelect(screen);
  return screen;
}

function pressContentKey(screen: Screen, key: string) {
  act(() => {
    screen.getByTestId('content', { includeHiddenElements: true }).props.onKeyDown?.({
      key,
      preventDefault: jest.fn(),
    });
  });
}

describe('Wave 2A Select review regressions', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    setTeleportAvailable(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  });

  afterEach(() => {
    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    clearActiveAnchorSeam();
    jest.restoreAllMocks();
  });

  it('tracks keyboard Home/End/Arrow order after stable-key option reordering', async () => {
    function Fixture() {
      const [reversed, setReversed] = React.useState(false);
      const values = reversed ? ['c', 'b', 'a'] : ['a', 'b', 'c'];
      return (
        <>
          <Pressable testID="reorder" onPress={() => setReversed(true)} />
          <Select defaultOpen>
            <SelectTrigger testID="trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent testID="content">
              {values.map((value) => (
                <SelectItem key={value} testID={value} value={value}>
                  {value.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      );
    }

    const screen = await renderOpen(<Fixture />);
    await waitFor(() => expect(screen.getByTestId('a').props.tabIndex).toBe(0));

    fireEvent.press(screen.getByTestId('reorder'));
    pressContentKey(screen, 'Home');
    await waitFor(() => expect(screen.getByTestId('c').props.tabIndex).toBe(0));

    pressContentKey(screen, 'End');
    await waitFor(() => expect(screen.getByTestId('a').props.tabIndex).toBe(0));

    pressContentKey(screen, 'Home');
    pressContentKey(screen, 'ArrowDown');
    await waitFor(() => expect(screen.getByTestId('b').props.tabIndex).toBe(0));
  });

  it('keeps internal accessibility IDs authoritative even under unsafe runtime prop injection', async () => {
    const unsafeContentProps = { nativeID: 'caller-content' } as unknown as SelectContentProps;
    const unsafeLabelProps = { nativeID: 'caller-label' } as unknown as SelectLabelProps;
    const screen = await renderOpen(
      <Select defaultOpen defaultValue="a">
        <SelectTrigger testID="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent {...unsafeContentProps} testID="content">
          <SelectGroup testID="group">
            <SelectLabel {...unsafeLabelProps} testID="label">
              Group
            </SelectLabel>
            <SelectItem testID="a" value="a">
              A
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByTestId('trigger');
    const content = screen.getByTestId('content');
    const group = screen.getByTestId('group');
    const label = screen.getByTestId('label');

    expect(content.props.nativeID).toBe(trigger.props['aria-controls']);
    expect(content.props.nativeID).not.toBe('caller-content');
    expect(group.props['aria-labelledby']).toBe(label.props.nativeID);
    expect(label.props.nativeID).not.toBe('caller-label');
  });
});
