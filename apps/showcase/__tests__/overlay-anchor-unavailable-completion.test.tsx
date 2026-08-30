/**
 * Anchor-unavailable completion contract (BeeUI issue #123, ADR-003
 * `docs/decisions/003-native-measurement-timeout.md` "Anchor-unavailable policy"
 * and "Late-callback handling").
 *
 * The bounded completion watchdog (issue #121) routes an unresponsive anchor
 * `measureInWindow` through `onAnchorUnavailable` instead of leaving anchored
 * content stuck in its unresolved/offscreen placeholder forever. This suite proves
 * the consumer-visible terminal behavior the #121 completion-budget suite does not
 * assert directly for the anchor path: an overlay that mirrors `Popover`'s
 * `onAnchorUnavailable -> setOpen(false)` wiring must reach a terminal state — it
 * either resolves to a positioned, interactive overlay, or it closes. No required
 * scenario may leave an invisible, non-interactive overlay open indefinitely because
 * the anchor callback disappeared (DoD #123).
 *
 * The six required anchor scenarios are covered end-to-end:
 *   1. initial open
 *   2. remeasure after host move
 *   3. anchor unmount
 *   4. close while a measurement is pending
 *   5. a newer successful request superseding an older dead request
 *   6. modal-local scope (a real `ModalOverlayHost`)
 *
 * Each was already terminal in the base runtime (shipped by #121); these tests are
 * the load-bearing anchor-path proof that it stays terminal. Reverting the watchdog
 * arming, the `onAnchorUnavailable` timeout path, the guard-before-cancel ordering,
 * or the supersession/close cancellation makes the corresponding test fail.
 *
 * Driven through the internal, deterministic `measurementScheduler` seam — no real
 * timers, no jest.useFakeTimers(), no sleeps. A manual scheduler only advances when
 * the test calls `tick()`; the watchdog re-arms one tick at a time, so elapsing the
 * ADR default budget (2 ticks) means calling `tick()` exactly twice.
 */

jest.mock('react-native-teleport', () => {
  const React = require('react');
  return {
    PortalProvider: ({ children }: { children?: React.ReactNode }) => children,
    PortalHost: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  ModalOverlayHost,
  OverlayRuntimeProvider,
  useAnchoredOverlayPosition,
  type MeasurementScheduler,
} from '../../../packages/ui/src/components/overlay-runtime';

type MeasureCallback = (x: number, y: number, width: number, height: number) => void;
type MeasurableAnchor = { measureInWindow: (callback: MeasureCallback) => void };

type ManualScheduler = {
  scheduler: MeasurementScheduler;
  /** Fire every currently-armed tick (the watchdog re-arms the next tick itself). */
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

const ADR_BUDGET_TICKS = 2;

function budgetWarnings(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((call) => String(call[0]).includes('completion budget'));
}

const ROOT_RECT = { x: 0, y: 0, width: 1000, height: 800 };
const ROOT_RECT_MOVED = { x: 20, y: 30, width: 900, height: 700 };
const MODAL_RECT = { x: 40, y: 60, width: 600, height: 500 };
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };
const OVERLAY_LAYOUT = { x: 0, y: 0, width: 120, height: 48 };

/** A measure source that never invokes its callback — a dropped native callback. */
function droppedAnchor(): MeasurableAnchor {
  return { measureInWindow: () => undefined };
}

/**
 * A measure source whose delivery is toggled at runtime: `mode = 'ok'` resolves the
 * configured rect synchronously (react-native-web style), `mode = 'drop'` never
 * invokes the callback (a dropped native callback).
 */
function toggleableAnchor(rect = ANCHOR_RECT) {
  const state = { mode: 'ok' as 'ok' | 'drop' };
  const anchor: MeasurableAnchor = {
    measureInWindow: (callback) => {
      if (state.mode === 'ok') callback(rect.x, rect.y, rect.width, rect.height);
    },
  };
  return { anchor, state };
}

type HarnessControls = { remeasure: () => void; close: () => void };

type AnchorOverlayHarnessProps = {
  anchorRef: React.RefObject<MeasurableAnchor | null>;
  controlsRef?: React.Ref<HarnessControls>;
  initialOpen: boolean;
  onClose?: () => void;
};

/**
 * Mirrors the exact `Popover` contract under test: `onAnchorUnavailable` closes the
 * overlay (`setOpen(false)`), so a lost anchor unmounts the content rather than
 * leaving an offscreen, non-interactive placeholder mounted. Renders `positioned`
 * only once geometry fully resolves, matching `PopoverContent`'s
 * placeholder-vs-positioned split.
 */
function AnchorOverlayHarness({
  anchorRef,
  controlsRef,
  initialOpen,
  onClose,
}: AnchorOverlayHarnessProps) {
  const [open, setOpen] = React.useState(initialOpen);
  const openRef = React.useRef(open);
  openRef.current = open;

  const handleAnchorUnavailable = React.useCallback(() => {
    if (!openRef.current) return;
    onClose?.();
    setOpen(false);
  }, [onClose]);

  const { position, onOverlayLayout, remeasure } = useAnchoredOverlayPosition({
    anchorRef,
    avoidSafeArea: false,
    onAnchorUnavailable: handleAnchorUnavailable,
    open,
  });

  React.useImperativeHandle(controlsRef, () => ({ remeasure, close: () => setOpen(false) }), [
    remeasure,
  ]);

  if (!open) return null;
  return (
    <Text testID="overlay-content" onLayout={onOverlayLayout}>
      {position ? 'positioned' : 'measuring'}
    </Text>
  );
}

function contentNode(screen: ReturnType<typeof render>) {
  return screen.queryByTestId('overlay-content', { includeHiddenElements: true });
}

function contentState(screen: ReturnType<typeof render>): 'positioned' | 'measuring' | 'closed' {
  const node = contentNode(screen);
  if (!node) return 'closed';
  return node.props.children as 'positioned' | 'measuring';
}

function fireOverlayLayout(screen: ReturnType<typeof render>) {
  const node = screen.getByTestId('overlay-content', { includeHiddenElements: true });
  fireEvent(node, 'layout', { nativeEvent: { layout: OVERLAY_LAYOUT } });
}

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

beforeEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);
});

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
});

describe('anchor-unavailable completion drives a terminal overlay state (#123)', () => {
  it('closes an overlay whose anchor callback never fires on initial open (terminal: unavailable)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: droppedAnchor() };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <AnchorOverlayHarness anchorRef={anchorRef} initialOpen onClose={onClose} />
      </OverlayRuntimeProvider>,
    );

    // Before the budget elapses the overlay is mounted but unresolved — exactly the
    // invisible/non-interactive placeholder the DoD forbids leaving open forever.
    expect(contentState(screen)).toBe('measuring');
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(contentState(screen)).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('closes the overlay when a remeasure after a host move never resolves (terminal: unavailable)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const { anchor, state } = toggleableAnchor();
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: anchor };

    const tree = (hostRect: typeof ROOT_RECT) => (
      <OverlayRuntimeProvider hostRectOverride={hostRect} measurementScheduler={manual.scheduler}>
        <AnchorOverlayHarness anchorRef={anchorRef} initialOpen onClose={onClose} />
      </OverlayRuntimeProvider>
    );

    const screen = render(tree(ROOT_RECT));
    // Initial open resolves synchronously and positions the overlay.
    await act(async () => fireOverlayLayout(screen));
    expect(contentState(screen)).toBe('positioned');

    // Host moves: the stored measurement is invalidated (host-revision mismatch), a
    // fresh remeasure is scheduled, and this time the native callback disappears.
    state.mode = 'drop';
    await act(async () => screen.rerender(tree(ROOT_RECT_MOVED)));
    expect(contentState(screen)).toBe('measuring');

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(contentState(screen)).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('closes the overlay synchronously when the anchor has unmounted before a remeasure (terminal: unavailable)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const controlsRef = React.createRef<HarnessControls>();
    const { anchor } = toggleableAnchor();
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: anchor };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <AnchorOverlayHarness
          anchorRef={anchorRef}
          controlsRef={controlsRef}
          initialOpen
          onClose={onClose}
        />
      </OverlayRuntimeProvider>,
    );
    await act(async () => fireOverlayLayout(screen));
    expect(contentState(screen)).toBe('positioned');

    // The anchor node unmounts: its ref clears (as PopoverTrigger's ref callback does
    // on unmount). The next remeasure finds no anchor and routes synchronously through
    // onAnchorUnavailable — no watchdog, no diagnostic, no dependence on a dropped
    // callback ever timing out.
    anchorRef.current = null;
    await act(async () => controlsRef.current?.remeasure());

    expect(contentState(screen)).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(manual.pending()).toBe(0);
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('is inert when the overlay closes while a measurement is still pending (terminal: cancelled)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const controlsRef = React.createRef<HarnessControls>();
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: droppedAnchor() };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <AnchorOverlayHarness
          anchorRef={anchorRef}
          controlsRef={controlsRef}
          initialOpen
          onClose={onClose}
        />
      </OverlayRuntimeProvider>,
    );
    expect(contentState(screen)).toBe('measuring');
    expect(manual.pending()).toBeGreaterThanOrEqual(1);

    // Close (e.g. an explicit dismiss) before the budget elapses. The pending
    // watchdog must be cancelled by the close, not left armed to fire later.
    await act(async () => controlsRef.current?.close());
    expect(contentState(screen)).toBe('closed');
    // The close-path invalidation actually retired the armed watchdog.
    expect(manual.pending()).toBe(0);

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    // The close was the only terminal transition: onAnchorUnavailable never fired,
    // so the overlay cannot be spuriously "re-closed" or diagnosed as unresponsive.
    expect(contentState(screen)).toBe('closed');
    expect(onClose).not.toHaveBeenCalled();
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('keeps the overlay open when a newer successful request supersedes an older dead one (terminal: superseded)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const controlsRef = React.createRef<HarnessControls>();
    const { anchor, state } = toggleableAnchor();
    state.mode = 'drop';
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: anchor };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <AnchorOverlayHarness
          anchorRef={anchorRef}
          controlsRef={controlsRef}
          initialOpen
          onClose={onClose}
        />
      </OverlayRuntimeProvider>,
    );

    // First request is dead: a watchdog is armed and the overlay is unresolved.
    expect(contentState(screen)).toBe('measuring');
    expect(manual.pending()).toBeGreaterThanOrEqual(1);

    // A newer remeasure (same host revision) resolves successfully. It must cancel
    // the older request's watchdog so the dead request can never later fire
    // onAnchorUnavailable and spuriously close a now-resolved overlay.
    state.mode = 'ok';
    await act(async () => controlsRef.current?.remeasure());
    await act(async () => fireOverlayLayout(screen));
    expect(contentState(screen)).toBe('positioned');
    expect(manual.pending()).toBe(0);

    // Advancing what would have been the old budget is fully inert.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(contentState(screen)).toBe('positioned');
    expect(onClose).not.toHaveBeenCalled();
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('closes an anchored overlay inside a modal-local scope when its anchor callback never fires (terminal: unavailable)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const anchorRef: React.RefObject<MeasurableAnchor | null> = { current: droppedAnchor() };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <ModalOverlayHost active hostRectOverride={MODAL_RECT}>
          <AnchorOverlayHarness anchorRef={anchorRef} initialOpen onClose={onClose} />
        </ModalOverlayHost>
      </OverlayRuntimeProvider>,
    );

    // The overlay resolves against the modal-local host and shares the one runtime
    // scheduler; a dropped anchor callback must still terminate, not hang inside the
    // modal window.
    expect(contentState(screen)).toBe('measuring');
    expect(manual.pending()).toBeGreaterThanOrEqual(1);

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(contentState(screen)).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });
});
