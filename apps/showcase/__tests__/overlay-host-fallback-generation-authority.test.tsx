/**
 * Deterministic host-measurement fallback generation-authority contract
 * (BeeUI issue #122, ADR-003 `docs/decisions/003-native-measurement-timeout.md`
 * "Host fallback").
 *
 * The bounded completion watchdog (issue #121) recovers a host rect when a scheduled
 * native `measureInWindow` callback silently disappears, by committing the most
 * recent `onLayout` fallback. This suite proves the guarantees that the recovery
 * must never violate, which the #121 completion-budget suite does not assert
 * directly for the host path:
 *
 *   - A committed fallback (from a dead-callback timeout) must be superseded by a
 *     newer *successful* measurement — the fallback must never win over newer,
 *     truthful geometry (DoD: "Fallback cannot override a newer successful
 *     measurement").
 *   - A late, stale success callback from a retired generation must never override a
 *     newer committed fallback (DoD: host-revision/ABA safety intact).
 *
 * Both directions are enforced by the single latest-request-wins generation ref
 * that the watchdog and every success callback already share — no second
 * supersession mechanism. The tests are load-bearing: reverting the host fallback
 * commit, or the generation guard on the host success/timeout path, makes them fail.
 *
 * Driven through the internal, deterministic `measurementScheduler` seam — no real
 * timers, no jest.useFakeTimers(), no sleeps. A manual scheduler only advances when
 * the test calls `tick()`; the watchdog re-arms one tick at a time, so elapsing the
 * ADR default budget (2 ticks) means calling `tick()` exactly twice.
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

  // React Native exposes several lazy getters. Spreading the module eagerly reads
  // all of them and pulls native-only TurboModules such as DevMenu into Jest. Keep
  // the real module lazy and override only View, which is the ref seam under test.
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

import { act, fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  OverlayRuntimeProvider,
  useOverlayEnvironment,
  type MeasurementScheduler,
} from '../../../packages/ui/src/components/overlay-runtime';

type ManualScheduler = {
  scheduler: MeasurementScheduler;
  /** Fire every currently-armed tick (the watchdog re-arms the next tick itself). */
  tick: () => void;
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
  };
}

const ADR_BUDGET_TICKS = 2;

function budgetWarnings(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((call) => String(call[0]).includes('completion budget'));
}

function HostProbe() {
  const { hostRect } = useOverlayEnvironment();
  return (
    <Text testID="host-probe">
      {hostRect ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}` : 'null'}
    </Text>
  );
}

function hostText(screen: ReturnType<typeof render>) {
  return screen.getByTestId('host-probe', { includeHiddenElements: true }).props.children;
}

function fireLayout(
  host: ReturnType<ReturnType<typeof render>['getByTestId']>,
  rect: { x: number; y: number; width: number; height: number },
) {
  fireEvent(host, 'layout', { nativeEvent: { layout: rect } });
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

describe('host measurement fallback generation authority (#122)', () => {
  it('lets a newer successful measurement supersede a committed dead-callback fallback', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );
    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });

    // Request A: an onLayout records a fallback and schedules a measurement whose
    // native callback silently disappears.
    await act(async () => fireLayout(host, { x: 12, y: 24, width: 300, height: 200 }));
    const deadCallbackA = mockHostMeasureCallbacks.at(-1)!;

    // The budget elapses with no callback: the host recovers via the layout fallback
    // rather than staying null forever.
    expect(hostText(screen)).toBe('null');
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(hostText(screen)).toBe('12,24,300,200');
    expect(budgetWarnings(warnSpy)).toHaveLength(1);

    // Request B: a newer measurement resolves *successfully* with truthful geometry.
    // The stale fallback must not survive over it — generation authority is the
    // single arbiter, so the newer success wins.
    await act(async () => fireLayout(host, { x: 40, y: 50, width: 600, height: 400 }));
    const successCallbackB = mockHostMeasureCallbacks.at(-1)!;
    await act(async () => successCallbackB(1, 2, 700, 500));
    expect(hostText(screen)).toBe('1,2,700,500');

    // Request A's original native callback finally fires, far too late, for a
    // generation the timeout already retired. It must be fully inert: it can neither
    // resurrect the fallback nor overwrite the newer success, and emits no second
    // diagnostic.
    await act(async () => deadCallbackA(999, 999, 10, 10));
    expect(hostText(screen)).toBe('1,2,700,500');
    expect(budgetWarnings(warnSpy)).toHaveLength(1);

    // The retired fallback watchdog left nothing armed: advancing the budget again is
    // inert and never re-commits the stale fallback over the newer success.
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(hostText(screen)).toBe('1,2,700,500');
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });

  it('drops a late stale success callback so it cannot override a newer committed fallback', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const screen = render(
      <OverlayRuntimeProvider measurementScheduler={manual.scheduler}>
        <HostProbe />
      </OverlayRuntimeProvider>,
    );
    const host = screen.getByTestId('beeui-overlay-host', { includeHiddenElements: true });

    // Request A schedules a measurement whose native callback is still in flight.
    await act(async () => fireLayout(host, { x: 12, y: 24, width: 300, height: 200 }));
    const staleSuccessA = mockHostMeasureCallbacks.at(-1)!;

    // Request B (a newer onLayout) supersedes A before A resolves: it cancels A's
    // watchdog and records a newer fallback. B's native callback also disappears.
    await act(async () => fireLayout(host, { x: 40, y: 50, width: 600, height: 400 }));

    // B's budget elapses: the host recovers to B's fallback (the most recent layout).
    await act(async () => {
      for (let i = 0; i < ADR_BUDGET_TICKS; i += 1) manual.tick();
    });
    expect(hostText(screen)).toBe('40,50,600,400');
    // Only B's timeout is a genuine unresponsiveness: A was retired by supersession,
    // not by its own timeout, so exactly one diagnostic fires.
    expect(budgetWarnings(warnSpy)).toHaveLength(1);

    // A's stale success callback (from the retired first generation) arrives late.
    // The generation guard must drop it: it cannot override B's newer fallback rect.
    await act(async () => staleSuccessA(7, 7, 70, 70));
    expect(hostText(screen)).toBe('40,50,600,400');
    expect(budgetWarnings(warnSpy)).toHaveLength(1);
  });
});
