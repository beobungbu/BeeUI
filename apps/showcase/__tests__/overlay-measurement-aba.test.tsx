/**
 * Overlay measurement A→B→A (ABA) regression coverage — BeeUI issue #125, ADR-003
 * (`docs/decisions/003-native-measurement-timeout.md`), completing the bounded
 * measurement state-machine matrix built across #121–#124.
 *
 * MATRIX COVERAGE MAP (case → existing coverage, or filled here). The bounded
 * state machine's eleven required cases are load-bearing across these suites; this
 * file fills the one genuine gap the others do not exercise (the ABA value-return).
 *
 *   1  host success ................ overlay-measurement-completion-budget.test.tsx (host-within-budget)
 *   2  anchor success .............. overlay-measurement-diagnostics.test.tsx (anti-spam) / anchor-measurement-seam-proof.test.tsx
 *   3  host callback never returns . overlay-measurement-completion-budget.test.tsx (fallback + retain-null)
 *   4  anchor callback never returns overlay-measurement-completion-budget.test.tsx / overlay-anchor-unavailable-completion.test.tsx
 *   5  late callback after fallback  overlay-measurement-completion-budget.test.tsx / overlay-host-fallback-generation-authority.test.tsx
 *   6  older-after-newer supersede . overlay-host-measurement-race.test.tsx / overlay-runtime-hardening.test.tsx
 *   7  close/unmount while pending . overlay-measurement-completion-budget.test.tsx / overlay-anchor-unavailable-completion.test.tsx
 *   8  host A→B→A ABA .............. THIS FILE (the return-to-prior-revision hazard)
 *   9  host revision mid-flight .... overlay-host-revision-gap.test.tsx / overlay-measurement-completion-budget.test.tsx
 *   10 modal-local origin .......... overlay-scope.test.tsx (Blocker 3)
 *   11 nested scope isolation ...... overlay-scope.test.tsx (dismissal) + overlay-nested-scope-measurement.test.tsx (geometry)
 *
 * Why the ABA is a distinct, load-bearing case (not a duplicate of #6 / #9):
 * The anchor callback guard rejects a stale result on ANY of three conditions —
 * generation, host-revision, or open (overlay-runtime.tsx anchor `remeasure`). The
 * existing host-revision suite proves the *host-revision* clause by keeping the
 * generation current while the revision differs (A→B). It never exercises the case
 * where the host geometry RETURNS to a previous value (A→B→A): then the stale
 * A-request's `requestedHostRevision` string equals the CURRENT revision again, so
 * the host-revision clause passes and ONLY the monotonic generation clause can
 * reject the retired A callback. This file drives exactly that value-return and
 * asserts the stale callback stays inert — falsified by reverting the generation
 * clause even though every host-revision assertion elsewhere still passes.
 *
 * Deterministic seams only: an injected manual scheduler (never ticked here, so no
 * watchdog fires) and hand-driven measure callbacks. No real timers, no sleeps.
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

import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Text, UIManager } from 'react-native';
import {
  OverlayRuntimeProvider,
  OverlayScopeContext,
  useAnchoredOverlayPosition,
  type MeasurementScheduler,
  type OverlayDismissController,
} from '../../../packages/ui/src/components/overlay-runtime';

type MeasureCallback = (x: number, y: number, width: number, height: number) => void;

type ManualScheduler = {
  scheduler: MeasurementScheduler;
  tick: () => void;
  pending: () => number;
};

// Same manual scheduler seam the #121 suite uses: only advances on explicit tick().
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
// A and A_AGAIN are byte-identical, so the derived host-revision string returns to
// its original value — the ABA value-collision that only the generation guard sees.
const HOST_A = { x: 0, y: 0, width: 1000, height: 800 };
const HOST_B = { x: 50, y: 40, width: 800, height: 600 };
const HOST_A_AGAIN = { x: 0, y: 0, width: 1000, height: 800 };

const noopController: OverlayDismissController = {
  register: () => undefined,
  unregister: () => undefined,
  isTopmost: () => false,
  dismissIfTopmost: () => false,
  dismissTop: () => false,
};

function makeScope(hostRect: { x: number; y: number; width: number; height: number }) {
  return {
    hostName: 'aba-host',
    isModal: true,
    depth: 1,
    hostRect,
    remeasureHost: () => undefined,
    controller: noopController,
  };
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

function AnchorProbe({
  anchorRef,
  onAnchorUnavailable,
}: {
  anchorRef: React.RefObject<{ measureInWindow: (cb: MeasureCallback) => void }>;
  onAnchorUnavailable: () => void;
}) {
  const { anchorRect } = useAnchoredOverlayPosition({
    anchorRef,
    avoidSafeArea: false,
    onAnchorUnavailable,
    open: true,
  });
  return (
    <Text testID="aba-anchor">
      {anchorRect
        ? `${anchorRect.x},${anchorRect.y},${anchorRect.width},${anchorRect.height}`
        : 'pending'}
    </Text>
  );
}

describe('overlay measurement A→B→A ABA (#125, ADR-003 row 5/8)', () => {
  it('drops a retired A-generation anchor callback that arrives after the host revision cycled back to A', async () => {
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: MeasureCallback[] = [];
    const anchorRef = {
      current: { measureInWindow: (cb: MeasureCallback) => callbacks.push(cb) },
    };

    const tree = (hostRect: { x: number; y: number; width: number; height: number }) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    // Request A (generation G1, host-revision = A). Capture but never fire it yet.
    const screen = render(tree(HOST_A));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));
    const staleCallbackA = callbacks[0]!;

    // Host moves A→B: a new request supersedes A (G2, revision = B).
    await act(async () => screen.rerender(tree(HOST_B)));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));

    // Host moves B→A: revision RETURNS to A's exact string (G3, revision = A again).
    await act(async () => screen.rerender(tree(HOST_A_AGAIN)));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(3));
    const currentCallback = callbacks[2]!;

    // The current request resolves normally — the overlay is positioned against A.
    await act(async () => currentCallback(100, 60, 40, 20));
    expect(screen.getByTestId('aba-anchor', { includeHiddenElements: true }).props.children).toBe(
      '100,60,40,20',
    );

    // ABA: the retired A callback now fires. Its requestedHostRevision equals the
    // CURRENT revision (A returned), so the host-revision guard passes; only the
    // generation guard (G1 !== G3) may reject it. A corrupt payload proves it must
    // never overwrite the live measurement.
    await act(async () => staleCallbackA(999, 999, 1, 1));
    expect(screen.getByTestId('aba-anchor', { includeHiddenElements: true }).props.children).toBe(
      '100,60,40,20',
    );
    expect(onAnchorUnavailable).not.toHaveBeenCalled();

    // No watchdog was ever ticked: the whole sequence resolved via real callbacks.
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });

  it('drops a retired A-generation UNAVAILABLE result after the host revision cycled back to A (no spurious close)', async () => {
    // The same ABA hazard, but the retired A callback reports "unavailable" (null
    // rect). Without the generation guard this would fire onAnchorUnavailable against
    // the live, successfully-measured overlay and tear it down.
    const manual = createManualScheduler();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onAnchorUnavailable = jest.fn();
    const callbacks: MeasureCallback[] = [];
    const anchorRef = {
      current: { measureInWindow: (cb: MeasureCallback) => callbacks.push(cb) },
    };

    const tree = (hostRect: { x: number; y: number; width: number; height: number }) => (
      <OverlayRuntimeProvider hostRectOverride={ROOT_RECT} measurementScheduler={manual.scheduler}>
        <OverlayScopeContext.Provider value={makeScope(hostRect)}>
          <AnchorProbe anchorRef={anchorRef} onAnchorUnavailable={onAnchorUnavailable} />
        </OverlayScopeContext.Provider>
      </OverlayRuntimeProvider>
    );

    const screen = render(tree(HOST_A));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(1));
    const staleCallbackA = callbacks[0]!;

    await act(async () => screen.rerender(tree(HOST_B)));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(2));

    await act(async () => screen.rerender(tree(HOST_A_AGAIN)));
    await waitFor(() => expect(callbacks.length).toBeGreaterThanOrEqual(3));
    const currentCallback = callbacks[2]!;

    await act(async () => currentCallback(100, 60, 40, 20));
    expect(screen.getByTestId('aba-anchor', { includeHiddenElements: true }).props.children).toBe(
      '100,60,40,20',
    );

    // Retired A reports unavailable. NaN → measureOverlayNodeInWindow delivers a
    // null rect; the generation guard must drop it before onAnchorUnavailable.
    await act(async () => staleCallbackA(Number.NaN, Number.NaN, Number.NaN, Number.NaN));
    expect(onAnchorUnavailable).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-anchor', { includeHiddenElements: true }).props.children).toBe(
      '100,60,40,20',
    );
    expect(budgetWarnings(warnSpy)).toHaveLength(0);
  });
});
