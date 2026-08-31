import {
  constrainOverlayViewportToKeyboard,
  createOverlayDismissStack,
  getSafeAreaCollisionPadding,
  mergeOverlayCollisionPadding,
  windowRectToHostRect,
} from '@beemvp/beeui-core';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, View } from 'react-native';
import {
  measureOverlayNodeInWindow,
  OverlayDismissLayer,
  OverlayPortal,
  OverlayRuntimeProvider,
  useAnchoredOverlayPosition,
  useOverlayDismissable,
  type OverlayMeasurableNode,
} from '../../../packages/ui/src/components/overlay-runtime';
import { subscribeOverlayPlatformDismiss as subscribeWebOverlayDismiss } from '../../../packages/ui/src/components/overlay-dismiss-events.web';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
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

describe('BeeUI issue #19 pure overlay runtime helpers', () => {
  it('dismisses nested overlays child-first for back and escape reasons', () => {
    const parent = jest.fn();
    const child = jest.fn();
    const stack = createOverlayDismissStack();

    stack.register('parent', parent);
    stack.register('child', child);

    expect(stack.dismissTop('back')).toBe(true);
    expect(child).toHaveBeenCalledWith('back');
    expect(parent).not.toHaveBeenCalled();

    stack.unregister('child');
    expect(stack.dismissTop('escape')).toBe(true);
    expect(parent).toHaveBeenCalledWith('escape');
  });

  it('updates a registered dismiss handler without reordering the stack', () => {
    const first = jest.fn();
    const firstUpdated = jest.fn();
    const second = jest.fn();
    const stack = createOverlayDismissStack();

    stack.register('first', first);
    stack.register('second', second);
    stack.register('first', firstUpdated);

    expect(stack.ids()).toEqual(['first', 'second']);
    expect(stack.dismissIfTopmost('first', 'outside-press')).toBe(false);
    expect(stack.dismissIfTopmost('second', 'outside-press')).toBe(true);
    expect(second).toHaveBeenCalledWith('outside-press');
    expect(first).not.toHaveBeenCalled();
    expect(firstUpdated).not.toHaveBeenCalled();
  });

  it('translates window geometry into host-local coordinates without assuming a zero origin', () => {
    expect(
      windowRectToHostRect(
        { x: 140, y: 260, width: 80, height: 40 },
        { x: 50, y: 100, width: 300, height: 500 },
      ),
    ).toEqual({ x: 90, y: 160, width: 80, height: 40 });
  });

  it('constrains a viewport to an overlapping keyboard but ignores a non-overlapping keyboard', () => {
    const viewport = { x: 50, y: 100, width: 300, height: 500 };

    expect(
      constrainOverlayViewportToKeyboard(viewport, {
        x: 0,
        y: 400,
        width: 400,
        height: 300,
      }),
    ).toEqual({ x: 50, y: 100, width: 300, height: 300 });

    expect(
      constrainOverlayViewportToKeyboard(viewport, {
        x: 500,
        y: 400,
        width: 100,
        height: 300,
      }),
    ).toEqual(viewport);
  });

  it('derives only the safe-area padding that still intersects the overlay host', () => {
    expect(
      getSafeAreaCollisionPadding(
        { x: 0, y: 0, width: 390, height: 844 },
        { x: 0, y: 0, width: 390, height: 844 },
        { top: 47, right: 0, bottom: 34, left: 0 },
      ),
    ).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });

    expect(
      getSafeAreaCollisionPadding(
        { x: 0, y: 47, width: 390, height: 763 },
        { x: 0, y: 0, width: 390, height: 844 },
        { top: 47, right: 0, bottom: 34, left: 0 },
      ),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });

    expect(mergeOverlayCollisionPadding(8, { top: 4, right: 2 })).toEqual({
      top: 12,
      right: 10,
      bottom: 8,
      left: 8,
    });
  });
});

describe('BeeUI issue #19 overlay host runtime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('measures a native anchor in window coordinates through the shared measurement seam', () => {
    const measured = jest.fn();
    const node: OverlayMeasurableNode = {
      measureInWindow: (callback) => callback(110, 220, 40, 30),
    };

    expect(measureOverlayNodeInWindow(node, measured)).toBe(true);
    expect(measured).toHaveBeenCalledWith({ x: 110, y: 220, width: 40, height: 30 });
  });

  it('mounts, updates, and removes portal entries without leaking content', () => {
    function PortalHarness({ label, show }: { label: string; show: boolean }) {
      return show ? (
        <OverlayPortal overlayId="portal-a">
          <Text>{label}</Text>
        </OverlayPortal>
      ) : null;
    }

    const screen = render(
      <OverlayRuntimeProvider>
        <PortalHarness label="First version" show />
      </OverlayRuntimeProvider>,
    );

    expect(screen.getByText('First version')).toBeTruthy();

    screen.rerender(
      <OverlayRuntimeProvider>
        <PortalHarness label="Updated version" show />
      </OverlayRuntimeProvider>,
    );
    expect(screen.queryByText('First version')).toBeNull();
    expect(screen.getByText('Updated version')).toBeTruthy();

    screen.rerender(
      <OverlayRuntimeProvider>
        <PortalHarness label="Updated version" show={false} />
      </OverlayRuntimeProvider>,
    );
    expect(screen.queryByText('Updated version')).toBeNull();
  });

  it('preserves portal insertion order when existing portal content updates', () => {
    function Portals({ first }: { first: string }) {
      return (
        <>
          <OverlayPortal overlayId="first">
            <Text>{first}</Text>
          </OverlayPortal>
          <OverlayPortal overlayId="second">
            <Text>Second overlay</Text>
          </OverlayPortal>
        </>
      );
    }

    const screen = render(
      <OverlayRuntimeProvider>
        <Portals first="First overlay" />
      </OverlayRuntimeProvider>,
    );

    expect(screen.getAllByText(/overlay$/).map((node) => node.props.children)).toEqual([
      'First overlay',
      'Second overlay',
    ]);

    screen.rerender(
      <OverlayRuntimeProvider>
        <Portals first="Updated first overlay" />
      </OverlayRuntimeProvider>,
    );

    expect(screen.getAllByText(/overlay$/).map((node) => node.props.children)).toEqual([
      'Updated first overlay',
      'Second overlay',
    ]);
  });

  it('reuses the outer overlay host when BeeUIProvider is nested', () => {
    const screen = render(
      <BeeUIProvider syncUniwindInsets={false}>
        <BeeUIProvider syncUniwindInsets={false}>
          <Text>Nested app</Text>
        </BeeUIProvider>
      </BeeUIProvider>,
    );

    expect(screen.getAllByTestId('beeui-overlay-host')).toHaveLength(1);
    expect(screen.getByText('Nested app')).toBeTruthy();
  });

  it('lets only the topmost overlay consume an outside press', () => {
    const parentDismiss = jest.fn();
    const childDismiss = jest.fn();

    function Dismissable({ id, onDismiss }: { id: string; onDismiss: (reason: string) => void }) {
      useOverlayDismissable({
        open: true,
        overlayId: id,
        onDismiss: (reason) => onDismiss(reason),
      });
      return (
        <OverlayPortal overlayId={id}>
          <OverlayDismissLayer overlayId={id} testID={`outside-${id}`} />
        </OverlayPortal>
      );
    }

    function Tree({ child }: { child: boolean }) {
      return (
        <OverlayRuntimeProvider>
          <Dismissable id="parent" onDismiss={parentDismiss} />
          {child ? <Dismissable id="child" onDismiss={childDismiss} /> : null}
        </OverlayRuntimeProvider>
      );
    }

    const screen = render(<Tree child />);

    fireEvent.press(screen.getByTestId('outside-parent', { includeHiddenElements: true }));
    expect(parentDismiss).not.toHaveBeenCalled();
    expect(childDismiss).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('outside-child', { includeHiddenElements: true }));
    expect(childDismiss).toHaveBeenCalledWith('outside-press');
    expect(parentDismiss).not.toHaveBeenCalled();

    screen.rerender(<Tree child={false} />);
    fireEvent.press(screen.getByTestId('outside-parent', { includeHiddenElements: true }));
    expect(parentDismiss).toHaveBeenCalledWith('outside-press');
  });

  it('routes each web Escape event to only the current topmost dismissable overlay', () => {
    const target = globalThis as typeof globalThis & {
      addEventListener?: (type: string, listener: (event: any) => void) => void;
      removeEventListener?: (type: string, listener: (event: any) => void) => void;
    };
    const originalAdd = target.addEventListener;
    const originalRemove = target.removeEventListener;
    const listeners = new Map<string, (event: any) => void>();
    target.addEventListener = (type, listener) => listeners.set(type, listener);
    target.removeEventListener = (type) => listeners.delete(type);

    try {
      const parent = jest.fn();
      const child = jest.fn();
      const stack = createOverlayDismissStack();
      stack.register('parent', parent);
      stack.register('child', child);
      const unsubscribe = subscribeWebOverlayDismiss((reason) => stack.dismissTop(reason));
      const preventDefault = jest.fn();
      const stopPropagation = jest.fn();

      listeners.get('keydown')?.({ key: 'Escape', preventDefault, stopPropagation });
      expect(child).toHaveBeenCalledWith('escape');
      expect(parent).not.toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(stopPropagation).toHaveBeenCalledTimes(1);

      stack.unregister('child');
      listeners.get('keydown')?.({ key: 'Escape', preventDefault, stopPropagation });
      expect(parent).toHaveBeenCalledWith('escape');

      unsubscribe();
      expect(listeners.has('keydown')).toBe(false);
    } finally {
      if (originalAdd) target.addEventListener = originalAdd;
      else delete target.addEventListener;
      if (originalRemove) target.removeEventListener = originalRemove;
      else delete target.removeEventListener;
    }
  });

  it('resolves anchored coordinates relative to a non-zero overlay host origin', async () => {
    function PositionHarness() {
      const anchorRef = React.useRef<OverlayMeasurableNode>({
        measureInWindow: (callback) => callback(100, 150, 40, 20),
      });
      const { onOverlayLayout, position } = useAnchoredOverlayPosition({
        anchorRef,
        avoidSafeArea: false,
        open: true,
        placement: 'bottom',
        sideOffset: 10,
      });

      return (
        <>
          <View onLayout={onOverlayLayout} testID="overlay-content" />
          <Text testID="resolved-position">
            {position ? `${position.x},${position.y},${position.placement}` : 'pending'}
          </Text>
        </>
      );
    }

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={{ x: 50, y: 100, width: 300, height: 400 }}>
        <PositionHarness />
      </OverlayRuntimeProvider>,
    );

    fireEvent(screen.getByTestId('overlay-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 50 } },
    });

    await waitFor(() =>
      expect(screen.getByTestId('resolved-position').props.children).toBe('20,80,bottom'),
    );
  });
});
