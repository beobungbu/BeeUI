/**
 * Nested modal-scope measurement isolation — BeeUI issue #125, ADR-003
 * (`docs/decisions/003-native-measurement-timeout.md`), matrix case 11.
 *
 * `overlay-scope.test.tsx` (CASE E) already proves nested Dialog scopes isolate
 * DISMISSAL/back routing to the deepest active modal scope, and its Blocker-3 test
 * proves a SINGLE modal-local overlay resolves geometry against its modal host
 * origin. Neither exercises the MEASUREMENT dimension across NESTED scopes: that an
 * overlay inside an inner modal host resolves against the inner origin (nearest
 * scope), independent of the outer host, and that a per-scope measurement timeout
 * fires only its own scope's `onAnchorUnavailable`.
 *
 * ADR-003 constrains the watchdog to "preserve latest-request-wins and scope
 * semantics": each scope reuses the runtime's single shared scheduler
 * (`OverlayMeasurementSchedulerContext`) yet keeps its own generation/host-revision
 * state. These two tests are the regression fence for that isolation.
 *
 * HONEST load-bearing scope (per the #123 defense-in-depth precedent):
 *  - Test 1 (geometry) falsifies the nearest-scope host-origin resolution
 *    (`useNearestOverlayScope` → `position = windowPosition − hostRect.origin`). It
 *    is not a single-mutation falsifier for the #59 watchdog; it fences the scope
 *    semantics the watchdog must not break.
 *  - Test 2 (per-scope timeout) IS a watchdog falsifier: reverting the anchor
 *    watchdog arming leaves the inner overlay hung and never calls its
 *    `onAnchorUnavailable`, and mis-scoping the guard would leak the inner timeout
 *    to the outer scope.
 *
 * Deterministic seams only: the prototype-patching anchor seam resolves configured
 * anchors synchronously, and an injected manual scheduler drives the timeout. No
 * real timers, no sleeps.
 */

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
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
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

import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager, View, type LayoutChangeEvent } from 'react-native';
import {
  ModalOverlayHost,
  OverlayRuntimeProvider,
  useAnchoredOverlayPosition,
  type MeasurementScheduler,
} from '../../../packages/ui/src/components/overlay-runtime';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/anchor-measurement-seam';

type ManualScheduler = {
  scheduler: MeasurementScheduler;
  tick: () => void;
  pending: () => number;
};

function createManualScheduler(): ManualScheduler {
  let queue: Array<() => void> = [];
  return {
    scheduler: {
      scheduleTick: (onTick) => {
        queue.push(onTick);
        return () => {
          queue = queue.filter((fn) => fn !== onTick);
        };
      },
    },
    tick: () => {
      const fns = queue;
      queue = [];
      fns.forEach((fn) => fn());
    },
    pending: () => queue.length,
  };
}

function budgetWarnings(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((call) => String(call[0]).includes('completion budget'));
}

const ROOT_RECT = { x: 0, y: 0, width: 1000, height: 800 };
const OUTER_RECT = { x: 100, y: 80, width: 700, height: 600 };
const INNER_RECT = { x: 220, y: 180, width: 400, height: 300 };
const OUTER_ANCHOR = { x: 300, y: 200, width: 40, height: 20 };
const INNER_ANCHOR = { x: 340, y: 260, width: 40, height: 20 };

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

beforeEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);
});

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
  clearActiveAnchorSeam();
});

function PositionProbe({
  anchorTestID,
  idPrefix,
  onAnchorUnavailable,
}: {
  anchorTestID: string;
  idPrefix: string;
  onAnchorUnavailable?: () => void;
}) {
  const anchorRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const { onOverlayLayout, position, windowPosition } = useAnchoredOverlayPosition({
    align: 'start',
    anchorRef,
    avoidSafeArea: false,
    flip: false,
    onAnchorUnavailable,
    open: true,
    placement: 'bottom',
    shift: false,
  });
  React.useEffect(() => {
    onOverlayLayout({
      nativeEvent: { layout: { width: 100, height: 50, x: 0, y: 0 } },
    } as LayoutChangeEvent);
  }, [onOverlayLayout]);
  return (
    <>
      <View ref={anchorRef} testID={anchorTestID} />
      <Text testID={`${idPrefix}-position`}>
        {position ? `${Math.round(position.x)},${Math.round(position.y)}` : 'null'}
      </Text>
      <Text testID={`${idPrefix}-window`}>
        {windowPosition ? `${Math.round(windowPosition.x)},${Math.round(windowPosition.y)}` : 'null'}
      </Text>
    </>
  );
}

describe('nested modal-scope measurement isolation (#125, ADR-003)', () => {
  it('resolves an inner-modal overlay against the inner host origin, isolated from the outer scope', async () => {
    createAnchorSeam({
      match: (testID) => testID === 'outer-anchor' || testID === 'inner-anchor',
      rectFor: (testID) => (testID === 'outer-anchor' ? OUTER_ANCHOR : INNER_ANCHOR),
    });

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT}>
        <ModalOverlayHost hostRectOverride={OUTER_RECT}>
          <PositionProbe anchorTestID="outer-anchor" idPrefix="outer" />
          <ModalOverlayHost hostRectOverride={INNER_RECT}>
            <PositionProbe anchorTestID="inner-anchor" idPrefix="inner" />
          </ModalOverlayHost>
        </ModalOverlayHost>
      </OverlayRuntimeProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('inner-position', { includeHiddenElements: true }).props.children,
      ).not.toBe('null');
      expect(
        screen.getByTestId('outer-position', { includeHiddenElements: true }).props.children,
      ).not.toBe('null');
    });

    const read = (testID: string) =>
      (screen.getByTestId(testID, { includeHiddenElements: true }).props.children as string)
        .split(',')
        .map(Number);

    // Window-space solutions anchor directly under each trigger (bottom/start).
    expect(read('outer-window')).toEqual([OUTER_ANCHOR.x, OUTER_ANCHOR.y + OUTER_ANCHOR.height]);
    expect(read('inner-window')).toEqual([INNER_ANCHOR.x, INNER_ANCHOR.y + INNER_ANCHOR.height]);

    // Each host-local position subtracts ITS OWN nearest modal host origin.
    expect(read('outer-position')).toEqual([
      OUTER_ANCHOR.x - OUTER_RECT.x,
      OUTER_ANCHOR.y + OUTER_ANCHOR.height - OUTER_RECT.y,
    ]);
    // The isolation assertion: the inner overlay subtracts the INNER origin
    // (220,180) — not the outer (100,80) and not the root (0,0). Against a leaked
    // outer scope this would be [240,200]; against root it would be [340,280].
    expect(read('inner-position')).toEqual([
      INNER_ANCHOR.x - INNER_RECT.x,
      INNER_ANCHOR.y + INNER_ANCHOR.height - INNER_RECT.y,
    ]);
    expect(read('inner-position')).toEqual([120, 100]);
  });

  it('scopes a per-modal measurement timeout to its own onAnchorUnavailable; the sibling scope is unaffected', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const outerUnavailable = jest.fn();
    const innerUnavailable = jest.fn();

    // Outer anchor resolves; inner anchor is measurable but its callback never
    // fires (rectFor → undefined makes the patched measureInWindow return without
    // invoking the callback), so only the inner watchdog is armed.
    createAnchorSeam({
      match: (testID) => testID === 'outer-anchor' || testID === 'inner-anchor',
      rectFor: (testID) => (testID === 'outer-anchor' ? OUTER_ANCHOR : undefined),
    });

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <ModalOverlayHost hostRectOverride={OUTER_RECT}>
          <PositionProbe
            anchorTestID="outer-anchor"
            idPrefix="outer"
            onAnchorUnavailable={outerUnavailable}
          />
          <ModalOverlayHost hostRectOverride={INNER_RECT}>
            <PositionProbe
              anchorTestID="inner-anchor"
              idPrefix="inner"
              onAnchorUnavailable={innerUnavailable}
            />
          </ModalOverlayHost>
        </ModalOverlayHost>
      </OverlayRuntimeProvider>,
    );

    // Outer resolved synchronously; inner is pending on its armed watchdog.
    await waitFor(() =>
      expect(
        screen.getByTestId('outer-position', { includeHiddenElements: true }).props.children,
      ).not.toBe('null'),
    );
    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
    expect(innerUnavailable).not.toHaveBeenCalled();

    // Elapse the shared scheduler's budget: only the inner scope's request times out.
    await act(async () => {
      manual.tick();
      manual.tick();
    });

    expect(innerUnavailable).toHaveBeenCalledTimes(1);
    // Isolation: the inner timeout must not signal the outer scope, whose overlay
    // stays positioned.
    expect(outerUnavailable).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('outer-position', { includeHiddenElements: true }).props.children,
    ).not.toBe('null');
    expect(
      screen.getByTestId('inner-position', { includeHiddenElements: true }).props.children,
    ).toBe('null');
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });
});
