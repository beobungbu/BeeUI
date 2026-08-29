/**
 * Bounded overlay-measurement completion contract (BeeUI issue #121, ADR-003
 * `docs/decisions/003-native-measurement-timeout.md`).
 *
 * Every host/anchor measurement request must terminate as exactly one of:
 * success | unavailable | fallback | superseded | cancelled. These tests drive the
 * watchdog through the internal, deterministic `measurementScheduler` seam — no real
 * timers, no jest.useFakeTimers(), no sleeps. They are load-bearing: reverting the
 * watchdog arming / guard / fallback / late-callback logic makes them fail.
 *
 * A manual scheduler only advances when the test calls `tick()`. The watchdog
 * re-arms one tick at a time, so elapsing the ADR default budget (2 ticks) means
 * calling `tick()` exactly twice.
 */

const mockHostMeasureCallbacks: Array<
  (x: number, y: number, width: number, height: number) => void
> = [];

jest.mock('react-native', () => {
  const React = require('react');
  const actual = jest.requireActual('react-native');
  const OriginalView = actual.View;
  const MockView = React.forwardRef(
    ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => mockHostMeasureCallbacks.push(callback),
      }));
      return React.createElement(OriginalView, props, children);
    },
  );
  MockView.displayName = 'MockMeasuredView';

  return new Proxy(actual, {
    get(target: Record<PropertyKey, unknown>, property: PropertyKey, receiver: unknown) {
      if (property === 'View') return MockView;
      return Reflect.get(target, property, receiver as object);
    },
  });
});

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

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  OverlayRuntimeProvider,
  OverlayScopeContext,
  defaultMeasurementScheduler,
  useAnchoredOverlayPosition,
  useOverlayEnvironment,
  type MeasurementScheduler,
  type OverlayDismissController,
} from '../../../packages/ui/src/components/overlay-runtime';

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

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

beforeEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = {};
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(true);
});

afterEach(() => {
  mockHostMeasureCallbacks.length = 0;
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
});

// --- Host path -------------------------------------------------------------

function HostProbe() {
  const { hostRect } = useOverlayEnvironment();
  return (
    <Text testID="host-probe">
      {hostRect ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}` : 'null'}
    </Text>
  );
}

describe('bounded host measurement completion (#121)', () => {
  it('commits the layout fallback rect when a scheduled host callback never fires (terminal: fallback)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 12, y: 24, width: 300, height: 200 } },
      });
    });

    // No native callback arrives. Elapse the tick budget deterministically.
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      'null',
    );
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '12,24,300,200',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('retains the pre-existing null state when a first host measurement times out with no fallback (terminal: fallback / retain)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    // Mount schedules a host measurement (no onLayout yet -> no fallback available).
    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      'null',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('drops a late host callback that arrives after the watchdog already retired its generation (terminal: late-callback inert)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 12, y: 24, width: 300, height: 200 } },
      });
    });
    const staleCallback = mockHostMeasureCallbacks.at(-1)!;

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '12,24,300,200',
    );

    // Late real callback for the retired generation must not overwrite geometry
    // and must not emit a second diagnostic.
    await act(async () => staleCallback(999, 999, 10, 10));
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '12,24,300,200',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('lets a real host callback within budget win and cancels the watchdog (terminal: success)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 12, y: 24, width: 300, height: 200 } },
      });
    });
    const callback = mockHostMeasureCallbacks.at(-1)!;

    await act(async () => callback(40, 50, 600, 400));
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '40,50,600,400',
    );

    // Watchdog was cancelled by success: advancing the scheduler is inert.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '40,50,600,400',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('a late stale host callback must not cancel the current request watchdog (terminal: current request still bounded)', async () => {
    // Regression for the ordering defect: a stale callback's generation-agnostic
    // cancel used to kill the CURRENT request's in-flight watchdog, leaving it
    // hanging forever. Request A times out; request B is scheduled; A's stale
    // native callback then fires while B's watchdog is pending; B must still
    // terminate via its OWN watchdog.
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );
    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });

    // Request A: layout fallback A recorded, callback A never fires.
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 12, y: 24, width: 300, height: 200 } },
      });
    });
    const staleCallbackA = mockHostMeasureCallbacks.at(-1)!;

    // A times out -> commits fallback A, retires A's generation.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '12,24,300,200',
    );

    // Request B: a newer layout schedules a fresh measurement + watchdog.
    await act(async () => {
      fireEvent(host, 'layout', {
        nativeEvent: { layout: { x: 40, y: 50, width: 600, height: 400 } },
      });
    });

    // A's stale native callback arrives now, while B's watchdog is pending.
    await act(async () => staleCallbackA(777, 777, 10, 10));

    // B's watchdog must still be armed: advancing the budget terminates B.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '40,50,600,400',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(2);
  });
});

// --- Anchor path -----------------------------------------------------------

const ROOT_RECT = { x: 0, y: 0, width: 1000, height: 800 };
const HOST_RECT = { x: 0, y: 0, width: 1000, height: 800 };

const noopController: OverlayDismissController = {
  register: () => undefined,
  unregister: () => undefined,
  isTopmost: () => false,
  dismissIfTopmost: () => false,
  dismissTop: () => false,
};

function makeScope(hostRect: { x: number; y: number; width: number; height: number }) {
  return {
    hostName: 'completion-budget-host',
    isModal: true,
    depth: 1,
    hostRect,
    remeasureHost: () => undefined,
    controller: noopController,
  };
}

type AnchorProbeProps = {
  anchorRef: React.RefObject<{
    measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void;
  }>;
  onAnchorUnavailable: () => void;
  open: boolean;
};

function AnchorProbe({ anchorRef, onAnchorUnavailable, open }: AnchorProbeProps) {
  const { anchorRect } = useAnchoredOverlayPosition({
    anchorRef,
    avoidSafeArea: false,
    onAnchorUnavailable,
    open,
  });
  return <Text testID="anchor-probe">{anchorRect ? 'anchor' : 'pending'}</Text>;
}

function renderAnchor(
  manual: ManualScheduler,
  props: AnchorProbeProps,
  hostRect = HOST_RECT,
) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
      <OverlayScopeContext.Provider value={makeScope(hostRect)}>
        <AnchorProbe {...props} />
      </OverlayScopeContext.Provider>
    </OverlayRuntimeProvider>,
  );
}

describe('bounded anchor measurement completion (#121)', () => {
  it('fires onAnchorUnavailable exactly once when a scheduled anchor callback never fires (terminal: unavailable via timeout)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const anchorRef = { current: { measureInWindow: () => undefined } };

    const screen = renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });

    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
    expect(onAnchorUnavailable).not.toHaveBeenCalled();

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      'pending',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('drops a late anchor callback after the watchdog retired its generation (terminal: late-callback inert)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const anchorRef = { current: { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => callbacks.push(cb) } };

    const screen = renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);

    // Late successful callback for the retired generation must be inert.
    await act(async () => callbacks.at(-1)!(100, 60, 40, 20));
    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      'pending',
    );
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('does not double-signal when a newer request supersedes a pending one before the budget elapses (terminal: superseded)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const anchorRef = { current: { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => callbacks.push(cb) } };

    // Two host rects -> a host-revision change re-runs remeasure (supersession)
    // before any tick fires. Only the newest watchdog may terminate the request.
    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <OverlayScopeContext.Provider value={makeScope(HOST_RECT)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>,
    );
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));

    await act(async () =>
      screen.rerender(
        <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
          <OverlayScopeContext.Provider value={makeScope({ x: 5, y: 5, width: 900, height: 700 })}>
            <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open />
          </OverlayScopeContext.Provider>
        </OverlayRuntimeProvider>,
      ),
    );
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    // The superseded (first) watchdog must not also fire: exactly one terminal
    // signal, from the current request's timeout.
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('is inert when the overlay closes before the budget elapses (terminal: cancelled)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const anchorRef = { current: { measureInWindow: () => undefined } };

    const screen = renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });
    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));

    // Close before ticking: the pending watchdog must be cancelled/retired.
    await act(async () =>
      screen.rerender(
        <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
          <OverlayScopeContext.Provider value={makeScope(HOST_RECT)}>
            <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open={false} />
          </OverlayScopeContext.Provider>
        </OverlayRuntimeProvider>,
      ),
    );

    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('is inert when the owning component unmounts before the budget elapses (terminal: cancelled)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const anchorRef = { current: { measureInWindow: () => undefined } };

    const screen = renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });
    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));

    await act(async () => screen.unmount());
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('rejects a timeout resolution when the host revision changed mid-flight (terminal: host-revision guard)', async () => {
    // A host-revision change starts a NEW measurement; the OLD watchdog, if it
    // somehow outlived supersession, must still be rejected by the host-revision
    // guard. Assert the newest request owns the single terminal signal.
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const anchorRef = { current: { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => callbacks.push(cb) } };

    const tree = (hostRect: { x: number; y: number; width: number; height: number }) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    const screen = render(tree(HOST_RECT));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));

    await act(async () => screen.rerender(tree({ x: 9, y: 9, width: 800, height: 600 })));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));

    // Resolve the NEW request successfully, then advance the scheduler. The stale
    // request's timeout must not fire onAnchorUnavailable against the new host.
    await act(async () => callbacks.at(-1)!(120, 70, 40, 20));
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      'anchor',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('a late stale anchor callback must not cancel the current request watchdog (terminal: current request still bounded)', async () => {
    // Regression for the ordering defect: a stale callback's generation-agnostic
    // cancel used to kill the CURRENT request's in-flight watchdog. Request A times
    // out; a host-revision change schedules request B; A's stale native callback
    // then fires while B's watchdog is pending; B must still terminate via its OWN
    // watchdog (a second onAnchorUnavailable).
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
    const anchorRef = {
      current: {
        measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) =>
          callbacks.push(cb),
      },
    };

    const tree = (hostRect: { x: number; y: number; width: number; height: number }) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    const screen = render(tree(HOST_RECT));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));
    const staleCallbackA = callbacks[0]!;

    // Request A times out -> onAnchorUnavailable #1, A's generation retired.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);

    // Request B: a host-revision change re-runs remeasure and arms a new watchdog.
    await act(async () => screen.rerender(tree({ x: 20, y: 20, width: 800, height: 600 })));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));

    // A's stale native callback arrives now, while B's watchdog is pending.
    await act(async () => staleCallbackA(100, 60, 40, 20));

    // B's watchdog must still be armed: advancing the budget terminates B.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(2);
    expect(budgetWarnings(warnSpy)).toHaveLength(2);
  });

  it('never warns under __DEV__ = false while keeping the functional fallback (terminal: unavailable, no diagnostic)', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const anchorRef = { current: { measureInWindow: () => undefined } };

    const globalWithDev = globalThis as { __DEV__?: boolean };
    const previousDev = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = false;
    try {
      renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });
      await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
      await act(async () => {
        for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
      });
    } finally {
      globalWithDev.__DEV__ = previousDev;
    }

    // Functional bounded completion still happens; only the dev diagnostic is gated.
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });
});

// --- Production scheduler (real requestAnimationFrame path) -----------------

/**
 * Controllable fake event loop where animation frames and macrotasks are drained
 * independently, faithfully reproducing headless Chromium: requestAnimationFrame can
 * fire several times before a pending macrotask (setTimeout) runs. react-native-web
 * delivers measureInWindow via a macrotask, so this models the exact Web race that a
 * frame-only watchdog tick lost (issue #121 visual-web regression).
 */
function installFakeEventLoop() {
  const frames: Array<{ handle: number; cb: () => void }> = [];
  const timers: Array<{ handle: number; cb: () => void }> = [];
  let nextHandle = 1;
  const original = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };

  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const handle = nextHandle++;
    frames.push({ handle, cb: () => cb(0) });
    return handle;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((handle: number) => {
    const index = frames.findIndex((frame) => frame.handle === handle);
    if (index >= 0) frames.splice(index, 1);
  }) as typeof globalThis.cancelAnimationFrame;
  globalThis.setTimeout = ((cb: () => void) => {
    const handle = nextHandle++;
    timers.push({ handle, cb });
    return handle as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof globalThis.setTimeout;
  globalThis.clearTimeout = ((handle: number) => {
    const index = timers.findIndex((timer) => timer.handle === handle);
    if (index >= 0) timers.splice(index, 1);
  }) as typeof globalThis.clearTimeout;

  return {
    runFrames: () => {
      const due = frames.splice(0);
      due.forEach((frame) => frame.cb());
    },
    runMacrotasks: () => {
      const due = timers.splice(0);
      due.forEach((timer) => timer.cb());
    },
    restore: () => {
      globalThis.requestAnimationFrame = original.requestAnimationFrame;
      globalThis.cancelAnimationFrame = original.cancelAnimationFrame;
      globalThis.setTimeout = original.setTimeout;
      globalThis.clearTimeout = original.clearTimeout;
    },
  };
}

describe('production measurement scheduler — Web headless rAF safety (#121)', () => {
  it('a macrotask-delivered measurement resolves before the production tick completes, even when frames fire repeatedly first', () => {
    const loop = installFakeEventLoop();
    try {
      const order: string[] = [];
      // react-native-web delivers the measurement on a macrotask, enqueued at
      // measure time (before the watchdog arms).
      globalThis.setTimeout(() => order.push('measurement'), 0);
      // The production watchdog tick for that same request.
      const cancel = defaultMeasurementScheduler.scheduleTick(() => order.push('tick'));

      // Headless: animation frames can fire back-to-back before any macrotask runs.
      loop.runFrames();
      loop.runFrames();
      // Now the macrotask queue drains in FIFO order.
      loop.runMacrotasks();
      loop.runMacrotasks();

      // The legitimate measurement must win; a frame-only tick would push 'tick'
      // first (and, in the real hook, retire the request and null the anchor).
      expect(order).toEqual(['measurement', 'tick']);
      cancel();
    } finally {
      loop.restore();
    }
  });

  it('cancelling the production tick before it completes prevents onTick entirely', () => {
    const loop = installFakeEventLoop();
    try {
      let fired = false;
      const cancel = defaultMeasurementScheduler.scheduleTick(() => {
        fired = true;
      });
      cancel();
      loop.runFrames();
      loop.runMacrotasks();
      expect(fired).toBe(false);
    } finally {
      loop.restore();
    }
  });
});

// --- Faithful open path: normal (non-dropped) measurement must reach success ---

/**
 * A scheduler that models the production "settled turn" (frame THEN macrotask) on
 * top of an injected event-loop model, paired with a measurement delivered on the
 * same model's macrotask queue. This exercises the real hook open sequence against
 * the headless race, asserting a normal measurement reaches success and the watchdog
 * never fires a premature fallback.
 */
describe('faithful anchor open under the settled-turn scheduler (#121)', () => {
  it('a normal macrotask-delivered anchor measurement reaches success; the watchdog does not fire', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();

    let frameCbs: Array<() => void> = [];
    let macroCbs: Array<() => void> = [];
    const settledTurnScheduler: MeasurementScheduler = {
      scheduleTick: (onTick) => {
        let cancelled = false;
        frameCbs.push(() => {
          if (cancelled) return;
          macroCbs.push(() => {
            if (!cancelled) onTick();
          });
        });
        return () => {
          cancelled = true;
        };
      },
    };
    const runFrames = () => {
      const due = frameCbs;
      frameCbs = [];
      due.forEach((fn) => fn());
    };
    const runMacrotasks = () => {
      const due = macroCbs;
      macroCbs = [];
      due.forEach((fn) => fn());
    };

    // Anchor measurement delivered on a macrotask (react-native-web style),
    // enqueued at measure time.
    const anchorRef = {
      current: {
        measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) =>
          macroCbs.push(() => cb(100, 60, 40, 20)),
      },
    };

    const screen = render(
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={settledTurnScheduler}>
        <OverlayScopeContext.Provider value={makeScope(HOST_RECT)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} open />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>,
    );

    // Headless: frames fire repeatedly before macrotasks drain. The measurement
    // macrotask is FIFO-before the tick's trailing macrotask, so it wins.
    await act(async () => {
      runFrames();
      runFrames();
      runMacrotasks();
      runMacrotasks();
    });

    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      'anchor',
    );
    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });
});
