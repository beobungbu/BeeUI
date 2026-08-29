/**
 * Overlay measurement-failure diagnostics (BeeUI issue #124, ADR-003
 * `docs/decisions/003-native-measurement-timeout.md`, Dev diagnostics).
 *
 * A silent measurement-contract failure must become ACTIONABLE during development:
 * the dev diagnostic has to identify which measurement missed its contract (host vs
 * anchor), the retired request's generation, the anchor host-revision scope, and the
 * concrete bounded terminal action taken (fallback-committed / retain-null /
 * anchor-unavailable). These tests drive the watchdog through the internal,
 * deterministic `measurementScheduler` seam — no real timers, no sleeps.
 *
 * They are load-bearing in both directions:
 *  - the actionable-content tests fail if the enriched host/anchor + generation +
 *    action information is dropped from the diagnostic;
 *  - the anti-spam tests fail if ANY diagnostic leaks onto a normal successful
 *    measurement path.
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

/** The dev diagnostic is the single console.warn carrying the budget-miss phrase. */
function diagnosticMessages(spy: jest.SpyInstance): string[] {
  return spy.mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.includes('completion budget'));
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

describe('overlay host measurement diagnostics (#124)', () => {
  it('names host, the request generation, and the fallback-committed action on a genuine host timeout', async () => {
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

    // No native callback arrives — elapse the tick budget deterministically.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    const messages = diagnosticMessages(warnSpy);
    expect(messages).toHaveLength(1);
    const [message] = messages;
    expect(message).toContain('Overlay host measurement');
    expect(message).toMatch(/generation=\d+/);
    expect(message).toContain("'fallback-committed'");
    // Actionable remediation pointer to the governing ADR.
    expect(message).toContain('docs/decisions/003-native-measurement-timeout.md');
  });

  it('reports the retain-null action when a first host measurement times out with no fallback', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );

    // Mount schedules a host measurement with no prior onLayout -> no fallback rect.
    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    const messages = diagnosticMessages(warnSpy);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Overlay host measurement');
    expect(messages[0]).toContain("'retain-null'");
    // The retain-null path must NOT mislabel itself as a committed fallback.
    expect(messages[0]).not.toContain("'fallback-committed'");
  });

  it('emits NO diagnostic when a host measurement resolves successfully within budget (anti-spam)', async () => {
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

    // Real callback resolves within budget: success, watchdog cancelled.
    await act(async () => mockHostMeasureCallbacks.at(-1)!(40, 50, 600, 400));
    expect(screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children).toBe(
      '40,50,600,400',
    );

    // Advancing the scheduler afterward must remain fully inert — no leaked warning.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(diagnosticMessages(warnSpy)).toHaveLength(0);
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
    hostName: 'diagnostics-host',
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

function renderAnchor(manual: ManualScheduler, props: AnchorProbeProps, hostRect = HOST_RECT) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
      <OverlayScopeContext.Provider value={makeScope(hostRect)}>
        <AnchorProbe {...props} />
      </OverlayScopeContext.Provider>
    </OverlayRuntimeProvider>,
  );
}

describe('overlay anchor measurement diagnostics (#124)', () => {
  it('names anchor, the request generation, the host-revision scope, and the anchor-unavailable action on a genuine anchor timeout', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const anchorRef = { current: { measureInWindow: () => undefined } };

    renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });

    await waitFor(() => expect(manual.pending()).toBeGreaterThanOrEqual(1));
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    const messages = diagnosticMessages(warnSpy);
    expect(messages).toHaveLength(1);
    const [message] = messages;
    expect(message).toContain('Overlay anchor measurement');
    expect(message).toMatch(/generation=\d+/);
    // The host-revision scope of the request is named (the request was keyed to the
    // scope's host rect: "x,y,width,height").
    expect(message).toContain(`host-revision=${HOST_RECT.x},${HOST_RECT.y},${HOST_RECT.width},${HOST_RECT.height}`);
    expect(message).toContain("'anchor-unavailable'");
    expect(message).toContain('docs/decisions/003-native-measurement-timeout.md');
  });

  it('emits NO diagnostic when an anchor measurement resolves successfully within budget (anti-spam)', async () => {
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

    const screen = renderAnchor(manual, { anchorRef, onAnchorUnavailable, open: true });
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));

    // Real anchor callback resolves within budget: success, watchdog cancelled.
    await act(async () => callbacks.at(-1)!(100, 60, 40, 20));
    expect(screen.getByTestId('anchor-probe', { includeHiddenElements: true }).props.children).toBe(
      'anchor',
    );

    // Advancing the scheduler must be inert — success must never spam a diagnostic.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });

    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(diagnosticMessages(warnSpy)).toHaveLength(0);
  });

  it('never emits the diagnostic under __DEV__ = false, even on a genuine timeout (production low-noise)', async () => {
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

    // Functional bounded completion still runs; only the dev diagnostic is gated.
    expect(onAnchorUnavailable).toHaveBeenCalledTimes(1);
    expect(diagnosticMessages(warnSpy)).toHaveLength(0);
  });
});
