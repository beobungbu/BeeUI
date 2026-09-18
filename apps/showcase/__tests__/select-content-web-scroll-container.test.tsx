import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@beemvp/beeui-ui';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// #612 — once a `SelectContent` listbox actually overflows and scrolls, a
// mouse press on any option on Web was silently swallowed: RN's `ScrollView`
// still negotiates the touch/pointer responder system even on Web, and once
// scrollable, that negotiation could win ahead of the pressed `SelectItem`'s
// own press. A real browser gesture race is not something `fireEvent.press`
// (a direct synthetic dispatch that bypasses any responder negotiation
// entirely) can reproduce in this non-jsdom, non-Playwright harness — see
// `plans/260918-1559-consumer-audit-fix-all/reports/ws-b-report.md` for that
// caveat. What this DOES prove, deterministically: on Web, `SelectContent`'s
// scroll container is an ordinary overflow `View` (a plain scrollable `div`
// once rendered by react-native-web, with no RN responder involved) instead
// of `ScrollView`, and every option — including the last one in an
// overflowing list — still fires selection through the normal press path;
// native keeps its original `ScrollView` container, unchanged.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 240 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof RNView>) => (
        <RNView ref={ref} {...props}>
          {children}
        </RNView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };
const ANCHOR_RECT = { x: 80, y: 40, width: 120, height: 44 };

function ManyOptionSelect({ onValueChange }: { onValueChange: (value: string) => void }) {
  return (
    <Select defaultOpen onValueChange={onValueChange}>
      <SelectTrigger testID="trigger">
        <SelectValue placeholder="Choose" />
      </SelectTrigger>
      <SelectContent testID="content">
        {Array.from({ length: 20 }, (_, index) => (
          <SelectItem key={index} testID={`option-${index}`} value={`option-${index}`}>
            {`Option ${index}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getOpenSelectContent(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(View).find((node) => {
    const nativeID = node.props.nativeID;
    return (
      typeof nativeID === 'string' &&
      nativeID.startsWith('beeui-select-') &&
      nativeID.endsWith('-content') &&
      StyleSheet.flatten(node.props.style)?.display !== 'none'
    );
  });
}

async function renderOpenSelect(onValueChange: (value: string) => void) {
  createAnchorSeam({
    match: (testID) => testID === 'trigger',
    rectFor: () => ANCHOR_RECT,
    modalHostRect: HOST_RECT,
  });

  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <ManyOptionSelect onValueChange={onValueChange} />
    </OverlayRuntimeProvider>,
  );

  await waitFor(() => expect(getOpenSelectContent(screen)).toBeTruthy());

  const content = getOpenSelectContent(screen);
  if (content) {
    fireEvent(content, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 120 } },
    });
  }

  await waitFor(() => {
    const settled = getOpenSelectContent(screen);
    expect(settled?.props.pointerEvents).toBe('auto');
  });

  return screen;
}

describe('SelectContent web scroll container (#612)', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    clearActiveAnchorSeam();
    jest.restoreAllMocks();
  });

  it('renders a plain overflow View (not ScrollView) as the options container on web', async () => {
    Platform.OS = 'web';
    const screen = await renderOpenSelect(() => undefined);

    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    const scrollContainers = screen.UNSAFE_getAllByType(View).filter((node) => {
      const style = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
      return style.some((entry: { overflow?: string } | undefined) => entry?.overflow === 'scroll');
    });
    expect(scrollContainers.length).toBeGreaterThan(0);
  });

  it('still selects the last option in an overflowing 20-item list on web', async () => {
    Platform.OS = 'web';
    const onValueChange = jest.fn();
    const screen = await renderOpenSelect(onValueChange);

    fireEvent.press(screen.getByTestId('option-19'));

    expect(onValueChange).toHaveBeenCalledWith('option-19');
  });

  it('keeps the native ScrollView container unchanged', async () => {
    jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(false);
    const onValueChange = jest.fn();
    const screen = await renderOpenSelect(onValueChange);

    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);

    fireEvent.press(screen.getByTestId('option-19'));
    expect(onValueChange).toHaveBeenCalledWith('option-19');
  });
});
