import {
  constrainOverlayViewportToKeyboard,
  createOverlayDismissStack,
  getSafeAreaCollisionPadding,
  mergeOverlayCollisionPadding,
  resolveAnchoredOverlayPosition,
  type AnchoredOverlayAlign,
  type AnchoredOverlayCollisionPadding,
  type AnchoredOverlayDirection,
  type AnchoredOverlayPlacement,
  type AnchoredOverlayPosition,
  type AnchoredOverlayRect,
  type AnchoredOverlaySize,
  type OverlayDismissHandler,
  type OverlayDismissReason,
  type OverlayDismissStack,
} from '@beemvp/beeui-core';
import { layer } from '@beemvp/beeui-tokens';
import * as React from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type KeyboardMetrics,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeOverlayPlatformDismiss } from './overlay-dismiss-events';
import {
  OverlayHostScopeProvider,
  ROOT_OVERLAY_HOST,
  resolveOverlayTransport,
  useNearestOverlayHost,
  type OverlayTransport,
} from './overlay-transport';

/**
 * Exposes the active portal transport (web `createPortal`, native teleport, or the
 * defensive legacy store host) to `OverlayPortal` and to modal-scoped hosts.
 */
const OverlayTransportContext = React.createContext<OverlayTransport | null>(null);

function useOverlayTransport(): OverlayTransport {
  const transport = React.useContext(OverlayTransportContext);
  if (!transport) {
    throw new Error('BeeUI anchored overlays require BeeUIProvider at the application root.');
  }
  return transport;
}

// Layout effects register dismiss scopes synchronously after commit so a native
// request-close (hardware back / modal onRequestClose) that arrives immediately
// after a modal becomes interactive always sees the registration. Falls back to
// a passive effect where there is no DOM/native layout phase (SSR).
const useIsomorphicLayoutEffect =
  typeof (globalThis as { window?: unknown }).window !== 'undefined'
    ? React.useLayoutEffect
    : React.useEffect;

export type OverlayMeasurableNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

/** Stable dismissal identity for one overlay scope. */
export type OverlayDismissController = {
  register: (id: string, handler: OverlayDismissHandler) => void;
  unregister: (id: string) => void;
  isTopmost: (id: string) => boolean;
  dismissIfTopmost: (id: string, reason: OverlayDismissReason) => boolean;
  dismissTop: (reason: OverlayDismissReason) => boolean;
};

function createDismissController(stack: OverlayDismissStack): OverlayDismissController {
  return {
    register: (id, handler) => stack.register(id, handler),
    unregister: (id) => stack.unregister(id),
    isTopmost: (id) => stack.isTopmost(id),
    dismissIfTopmost: (id, reason) => stack.dismissIfTopmost(id, reason),
    dismissTop: (reason) => stack.dismissTop(reason),
  };
}

/**
 * The coherent host/geometry/dismiss boundary an anchored overlay resolves against.
 * `depth` is semantic hierarchy, not effect registration order: root=0, each modal
 * boundary increments it. This keeps initial-open and nested-modal global dismissal
 * correct even though React may run descendant layout effects before parent effects.
 */
export type OverlayScope = {
  hostName: string;
  isModal: boolean;
  depth: number;
  hostRect: AnchoredOverlayRect | null;
  remeasureHost: () => void;
  controller: OverlayDismissController;
};

// Internal contract-test seam; not re-exported from the package index.
export const OverlayScopeContext = React.createContext<OverlayScope | null>(null);

function useNearestOverlayScope(): OverlayScope {
  const scope = React.useContext(OverlayScopeContext);
  if (!scope) {
    throw new Error('BeeUI anchored overlays require BeeUIProvider at the application root.');
  }
  return scope;
}

export type OverlayActiveScopeCoordinator = {
  activate: (stack: OverlayDismissStack, depth: number) => void;
  deactivate: (stack: OverlayDismissStack) => void;
  dispatchTop: (reason: OverlayDismissReason) => boolean;
};

function createActiveScopeCoordinator(): OverlayActiveScopeCoordinator {
  let activationOrder = 0;
  const entries = new Map<OverlayDismissStack, { depth: number; order: number }>();

  return {
    activate(stack, depth) {
      const existing = entries.get(stack);
      if (existing) {
        existing.depth = depth;
        return;
      }
      activationOrder += 1;
      entries.set(stack, { depth, order: activationOrder });
    },
    deactivate(stack) {
      entries.delete(stack);
    },
    dispatchTop(reason) {
      let selected: { stack: OverlayDismissStack; depth: number; order: number } | null = null;
      for (const [stack, entry] of entries) {
        if (
          !selected ||
          entry.depth > selected.depth ||
          (entry.depth === selected.depth && entry.order > selected.order)
        ) {
          selected = { stack, depth: entry.depth, order: entry.order };
        }
      }
      return selected ? selected.stack.dismissTop(reason) : false;
    },
  };
}

const OverlayActiveScopeContext = React.createContext<OverlayActiveScopeCoordinator | null>(null);

type OverlayRuntimeContextValue = {
  hostRect: AnchoredOverlayRect | null;
  keyboardRect: AnchoredOverlayRect | null;
  remeasureHost: () => void;
  safeAreaInsets: { top: number; right: number; bottom: number; left: number };
  windowRect: AnchoredOverlayRect;
};

const OverlayRuntimeContext = React.createContext<OverlayRuntimeContextValue | null>(null);

function finiteRect(rect: AnchoredOverlayRect): AnchoredOverlayRect | null {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return null;
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  };
}

function sameRect(a: AnchoredOverlayRect | null, b: AnchoredOverlayRect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function setRectIfChanged(
  setter: React.Dispatch<React.SetStateAction<AnchoredOverlayRect | null>>,
  next: AnchoredOverlayRect | null,
) {
  setter((current) => (sameRect(current, next) ? current : next));
}

function keyboardMetricsToRect(metrics: KeyboardMetrics | undefined): AnchoredOverlayRect | null {
  if (!metrics) return null;
  return finiteRect({
    x: metrics.screenX,
    y: metrics.screenY,
    width: metrics.width,
    height: metrics.height,
  });
}

function readKeyboardRect() {
  if (typeof Keyboard.metrics !== 'function') return null;
  return keyboardMetricsToRect(Keyboard.metrics());
}

function useKeyboardRect() {
  const [keyboardRect, setKeyboardRect] = React.useState<AnchoredOverlayRect | null>(() =>
    readKeyboardRect(),
  );

  React.useEffect(() => {
    const update = (event: KeyboardEvent) => {
      setRectIfChanged(setKeyboardRect, keyboardMetricsToRect(event.endCoordinates));
    };
    const hide = () => setRectIfChanged(setKeyboardRect, null);

    const showSubscription = Keyboard.addListener('keyboardDidShow', update);
    const frameSubscription = Keyboard.addListener('keyboardDidChangeFrame', update);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', hide);

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardRect;
}

export function measureOverlayNodeInWindow(
  node: OverlayMeasurableNode | null | undefined,
  callback: (rect: AnchoredOverlayRect | null) => void,
) {
  if (!node || typeof node.measureInWindow !== 'function') {
    callback(null);
    return false;
  }

  node.measureInWindow((x, y, width, height) => {
    callback(finiteRect({ x, y, width, height }));
  });
  return true;
}

/**
 * Timing primitive for the bounded-measurement watchdog (ADR-003,
 * `docs/decisions/003-native-measurement-timeout.md`). Each `scheduleTick`
 * schedules a single tick and returns a cancel function; calling cancel after the
 * tick already fired is a no-op. Production wires this to `requestAnimationFrame`;
 * deterministic tests inject a manual scheduler advanced by explicit `tick()`.
 */
export type MeasurementScheduler = {
  scheduleTick: (onTick: () => void) => () => void;
};

/**
 * Ticks a scheduled measurement is allowed before it is declared unresponsive.
 * ADR-003 starting default; frame-tick based (not wall-clock) so the budget scales
 * with actual frame delivery and stays deterministic under an injected scheduler.
 */
const MEASUREMENT_TICK_BUDGET = 2;

/**
 * Production tick = one animation frame followed by one macrotask — a fully
 * "settled event-loop turn". The trailing macrotask is load-bearing on the Web:
 * react-native-web delivers `measureInWindow` via a macrotask (`setTimeout`), and
 * headless / unthrottled `requestAnimationFrame` can fire several times before a
 * pending macrotask runs. A frame-only tick could therefore burn the whole budget
 * and declare a legitimately in-flight Web measurement "unresponsive" before its
 * callback ever fires — nulling the anchor and dropping the real measurement so the
 * overlay never becomes visible. Because the measurement's macrotask is enqueued
 * (at measure time) before this tick's trailing macrotask, macrotask FIFO ordering
 * guarantees a real measurement resolves — and cancels the watchdog — before the
 * tick completes. The leading frame keeps the budget frame-scaled on native, where
 * measurement delivery tracks the bridge/frame cadence.
 */
// Exported as an internal deterministic test seam (not re-exported from the package
// index) so the production tick's Web-safe frame+macrotask ordering can be asserted.
export const defaultMeasurementScheduler: MeasurementScheduler = {
  scheduleTick: (onTick) => {
    if (typeof requestAnimationFrame !== 'function') {
      // No frame clock available (e.g. SSR): the watchdog simply never fires,
      // which reproduces the pre-ADR "eternally pending" behavior rather than a
      // spurious timeout. Native and Web both expose requestAnimationFrame.
      return () => {};
    }
    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const frameHandle = requestAnimationFrame(() => {
      if (cancelled) return;
      if (typeof setTimeout !== 'function') {
        onTick();
        return;
      }
      timeoutHandle = setTimeout(() => {
        if (!cancelled) onTick();
      }, 0);
    });
    return () => {
      cancelled = true;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameHandle);
      if (timeoutHandle !== undefined && typeof clearTimeout === 'function') {
        clearTimeout(timeoutHandle);
      }
    };
  },
};

/**
 * Arms a cancellable frame-tick watchdog that invokes `onBudgetElapsed` once the
 * tick budget is consumed. Returns a cancel function that is safe to call multiple
 * times and after the budget already elapsed. Re-arms one tick at a time so a
 * manual test scheduler proves "budget elapsed" by advancing exactly `budgetTicks`
 * times, with no real timers.
 */
function armMeasurementWatchdog(
  scheduler: MeasurementScheduler,
  budgetTicks: number,
  onBudgetElapsed: () => void,
): () => void {
  let cancelled = false;
  let remaining = budgetTicks;
  let cancelCurrentTick: (() => void) | null = null;

  const armNext = () => {
    cancelCurrentTick = scheduler.scheduleTick(() => {
      cancelCurrentTick = null;
      if (cancelled) return;
      remaining -= 1;
      if (remaining <= 0) {
        onBudgetElapsed();
        return;
      }
      armNext();
    });
  };

  armNext();

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (cancelCurrentTick) {
      cancelCurrentTick();
      cancelCurrentTick = null;
    }
  };
}

/**
 * The bounded terminal action a genuine measurement timeout applied, named so the
 * dev diagnostic is actionable rather than merely "something timed out":
 * - `fallback-committed` — host path committed a layout/explicit fallback rect.
 * - `retain-null` — host path had no fallback; the previous (often `null`) rect
 *   was retained.
 * - `anchor-unavailable` — anchor path nulled the measurement and fired
 *   `onAnchorUnavailable`.
 */
type MeasurementDiagnosticAction = 'fallback-committed' | 'retain-null' | 'anchor-unavailable';

/**
 * Actionable context for a genuine unresponsive-measurement timeout, so a developer
 * can locate the specific request (host vs anchor, which generation, which host
 * scope) and see the concrete terminal action taken — not just that "a measurement
 * timed out somewhere".
 */
type MeasurementDiagnostic = {
  target: 'host' | 'anchor';
  /** The retired request's own generation (latest-request-wins counter value). */
  generation: number;
  action: MeasurementDiagnosticAction;
  /** Anchor requests carry the host-revision scope the request was keyed to. */
  hostRevision?: string | null;
};

/**
 * Development-only diagnostic for a genuine unresponsive-measurement timeout
 * (budget elapsed with the generation still current and no superseding cause).
 * Follows the `overlay-host-mode.ts` / `use-required-callback-warning.ts`
 * precedent: `__DEV__`-guarded, never thrown, stripped from production builds.
 *
 * The message names the measurement (host vs anchor), the retired request's
 * generation, the anchor host-revision scope, and the concrete terminal action so
 * the failure is actionable during development. Production (`__DEV__` false) never
 * warns; the functional fallback/unavailable behavior is unconditional and
 * identical in dev and production (ADR-003, Dev diagnostics).
 */
function warnMeasurementUnresponsive(diagnostic: MeasurementDiagnostic) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const { target, generation, action, hostRevision } = diagnostic;
    const scope =
      target === 'anchor' ? `, host-revision=${hostRevision ?? 'none'}` : '';
    // Web `measureInWindow` (react-native-web's `getBoundingClientRect`) resolves
    // effectively synchronously, so a Web timeout is a stronger signal of a genuine
    // defect (an unmeasurable/foreign ref) than of ordinary async latency; native
    // callbacks are legitimately async and can be dropped by a detached/recycled
    // view or a bridge failure (ADR-003, Web/native differences).
    const cause =
      Platform.OS === 'web'
        ? 'On Web, measurement is effectively synchronous, so this most likely indicates a genuine defect (an unmeasurable or foreign ref) rather than ordinary async latency'
        : 'On native this usually means a native measureInWindow callback was dropped (detached/recycled view or bridge failure)';
    console.warn(
      `[BeeUI] Overlay ${target} measurement did not resolve within its completion budget ` +
        `(generation=${generation}${scope}); applied the bounded '${action}' path. ` +
        `${cause}. See docs/decisions/003-native-measurement-timeout.md.`,
    );
  }
}

// Stable across the runtime's lifetime (resolved once), so it is kept separate from
// the geometry-carrying runtime context: reading the scheduler must not subscribe a
// consumer to host-rect/keyboard/window changes.
const OverlayMeasurementSchedulerContext = React.createContext<MeasurementScheduler>(
  defaultMeasurementScheduler,
);

/**
 * Measures an overlay host in window coordinates. Native measurement callbacks are
 * asynchronous, so only the newest request may commit. A stale callback from a
 * previous layout/orientation must never overwrite a newer host rectangle.
 */
function useMeasuredOverlayHost(
  scheduler: MeasurementScheduler,
  hostRectOverride?: AnchoredOverlayRect,
) {
  const [hostRect, setHostRect] = React.useState<AnchoredOverlayRect | null>(null);
  const hostRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const measurementGenerationRef = React.useRef(0);
  // Most recent onLayout-derived rect, used as the bounded-completion fallback for
  // a scheduled measurement that times out without an explicit fallback (e.g. a
  // window-resize remeasure), per ADR-003 "commit ... from the most recent onLayout".
  const lastLayoutRectRef = React.useRef<AnchoredOverlayRect | null>(null);
  // Cancel handle for the in-flight measurement watchdog, if any.
  const watchdogCancelRef = React.useRef<(() => void) | null>(null);
  const cancelWatchdog = React.useCallback(() => {
    if (watchdogCancelRef.current) {
      watchdogCancelRef.current();
      watchdogCancelRef.current = null;
    }
  }, []);
  const overridden = React.useMemo(
    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),
    // Intentionally track scalar geometry rather than caller object identity: a new
    // object with identical coordinates must not retire/restart native measurement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hostRectOverride?.height, hostRectOverride?.width, hostRectOverride?.x, hostRectOverride?.y],
  );

  useIsomorphicLayoutEffect(() => {
    measurementGenerationRef.current += 1;
    return () => {
      measurementGenerationRef.current += 1;
      // Retiring the generation on override change/unmount must also cancel any
      // outstanding watchdog so it can never fire after this hook is gone (ADR-003
      // Close/unmount invalidation).
      cancelWatchdog();
    };
  }, [cancelWatchdog, overridden?.height, overridden?.width, overridden?.x, overridden?.y]);

  const measureLatest = React.useCallback(
    (fallback?: AnchoredOverlayRect | null) => {
      if (overridden) return false;
      // A newer request supersedes the previous watchdog (ADR-003 row 6).
      cancelWatchdog();
      const generation = ++measurementGenerationRef.current;
      let callbackInvoked = false;
      const scheduled = measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
        callbackInvoked = true;
        // Guard BEFORE cancelling: a stale (superseded/retired) callback must be
        // fully inert. Cancelling here is generation-agnostic, so a late callback
        // from an already-retired request would otherwise kill the CURRENT
        // request's in-flight watchdog and let it hang unbounded (ADR-003).
        if (generation !== measurementGenerationRef.current) return;
        cancelWatchdog();
        const resolved = nextRect ?? fallback ?? null;
        if (resolved) setRectIfChanged(setHostRect, resolved);
      });
      if (!scheduled && !callbackInvoked && generation === measurementGenerationRef.current && fallback) {
        setRectIfChanged(setHostRect, fallback);
      }
      if (scheduled && !callbackInvoked) {
        watchdogCancelRef.current = armMeasurementWatchdog(
          scheduler,
          MEASUREMENT_TICK_BUDGET,
          () => {
            watchdogCancelRef.current = null;
            // Superseded by a newer request while pending: normal operation, no
            // fallback commit and no diagnostic (the newer request owns the state).
            if (generation !== measurementGenerationRef.current) return;
            // Retire this generation so a late real callback is dropped by the
            // existing generation guard (ADR-003 Late-callback handling).
            measurementGenerationRef.current += 1;
            const resolvedFallback = fallback ?? lastLayoutRectRef.current;
            // Commit the layout fallback if we have one; otherwise retain the last
            // good rect (or the pre-existing null state on a first measurement).
            if (resolvedFallback) setRectIfChanged(setHostRect, resolvedFallback);
            warnMeasurementUnresponsive({
              target: 'host',
              generation,
              action: resolvedFallback ? 'fallback-committed' : 'retain-null',
            });
          },
        );
      }
      return scheduled;
    },
    [cancelWatchdog, overridden, scheduler],
  );

  const remeasureHost = React.useCallback(() => {
    measureLatest();
  }, [measureLatest]);

  const handleHostLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (overridden) return;
      const fallback = finiteRect(event.nativeEvent.layout);
      lastLayoutRectRef.current = fallback;
      measureLatest(fallback);
    },
    [measureLatest, overridden],
  );

  return { handleHostLayout, hostRect: overridden ?? hostRect, hostRef, remeasureHost };
}

export type OverlayRuntimeProviderProps = {
  children?: React.ReactNode;
  /** Internal deterministic measurement seam used by contract tests. */
  hostRectOverride?: AnchoredOverlayRect;
  /**
   * Internal deterministic scheduler seam for the bounded-measurement watchdog
   * (ADR-003). Defaults to a `requestAnimationFrame` tick clock in production;
   * contract tests inject a manual scheduler. Not a public API.
   */
  measurementScheduler?: MeasurementScheduler;
  /** Internal deterministic transport seam used by contract tests. */
  transport?: OverlayTransport;
};

function OverlayRuntimeProviderRoot({
  children,
  hostRectOverride,
  measurementScheduler,
  transport: transportOverride,
}: OverlayRuntimeProviderProps) {
  const transportRef = React.useRef<OverlayTransport | null>(null);
  if (transportRef.current === null) {
    transportRef.current = transportOverride ?? resolveOverlayTransport();
  }
  const transport = transportRef.current;
  // Resolve the scheduler once for the lifetime of the runtime so host and anchor
  // watchdogs share one stable timing primitive.
  const schedulerRef = React.useRef<MeasurementScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = measurementScheduler ?? defaultMeasurementScheduler;
  }
  const scheduler = schedulerRef.current;
  const {
    handleHostLayout,
    hostRect: resolvedHostRect,
    hostRef,
    remeasureHost,
  } = useMeasuredOverlayHost(scheduler, hostRectOverride);
  const dismissStackRef = React.useRef(createOverlayDismissStack());
  const safeAreaInsets = useSafeAreaInsets();
  const keyboardRect = useKeyboardRect();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const windowRect = React.useMemo(
    () => ({ x: 0, y: 0, width: windowWidth, height: windowHeight }),
    [windowHeight, windowWidth],
  );

  const controllerRef = React.useRef<OverlayDismissController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createDismissController(dismissStackRef.current);
  }
  const rootController = controllerRef.current;

  const coordinatorRef = React.useRef<OverlayActiveScopeCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createActiveScopeCoordinator();
  }
  const coordinator = coordinatorRef.current;

  React.useEffect(() => remeasureHost(), [remeasureHost, windowHeight, windowWidth]);

  // Global event state is runtime-local. BeeUI still treats one application-root
  // overlay runtime as the supported physical Escape/back arbitration boundary;
  // nested BeeUIProviders reuse it rather than installing another listener.
  React.useEffect(
    () => subscribeOverlayPlatformDismiss((reason) => coordinator.dispatchTop(reason)),
    [coordinator],
  );

  useIsomorphicLayoutEffect(() => {
    const stack = dismissStackRef.current;
    coordinator.activate(stack, 0);
    return () => coordinator.deactivate(stack);
  }, [coordinator]);

  const rootScope = React.useMemo<OverlayScope>(
    () => ({
      hostName: ROOT_OVERLAY_HOST,
      isModal: false,
      depth: 0,
      hostRect: resolvedHostRect,
      remeasureHost,
      controller: rootController,
    }),
    [remeasureHost, resolvedHostRect, rootController],
  );

  const context = React.useMemo<OverlayRuntimeContextValue>(
    () => ({
      hostRect: resolvedHostRect,
      keyboardRect,
      remeasureHost,
      safeAreaInsets,
      windowRect,
    }),
    [keyboardRect, remeasureHost, resolvedHostRect, safeAreaInsets, windowRect],
  );

  const { RootBoundary, HostOutlet } = transport;

  return (
    <OverlayTransportContext.Provider value={transport}>
      <OverlayMeasurementSchedulerContext.Provider value={scheduler}>
        <RootBoundary>
          <OverlayRuntimeContext.Provider value={context}>
            <OverlayActiveScopeContext.Provider value={coordinator}>
              <OverlayScopeContext.Provider value={rootScope}>
                <OverlayHostScopeProvider hostName={ROOT_OVERLAY_HOST}>
                  {children}
                </OverlayHostScopeProvider>
                <View
                  ref={hostRef}
                  accessible={false}
                  collapsable={false}
                  onLayout={handleHostLayout}
                  pointerEvents="box-none"
                  style={[StyleSheet.absoluteFill, styles.host]}
                  testID="beeui-overlay-host"
                />
                <HostOutlet name={ROOT_OVERLAY_HOST} style={styles.host} />
              </OverlayScopeContext.Provider>
            </OverlayActiveScopeContext.Provider>
          </OverlayRuntimeContext.Provider>
        </RootBoundary>
      </OverlayMeasurementSchedulerContext.Provider>
    </OverlayTransportContext.Provider>
  );
}

export function OverlayRuntimeProvider({
  children,
  hostRectOverride,
  measurementScheduler,
  transport,
}: OverlayRuntimeProviderProps) {
  const parent = React.useContext(OverlayRuntimeContext);
  if (parent) return <>{children}</>;
  return (
    <OverlayRuntimeProviderRoot
      hostRectOverride={hostRectOverride}
      measurementScheduler={measurementScheduler}
      transport={transport}
    >
      {children}
    </OverlayRuntimeProviderRoot>
  );
}

function useOverlayRuntime() {
  const context = React.useContext(OverlayRuntimeContext);
  if (!context) {
    throw new Error('BeeUI anchored overlays require BeeUIProvider at the application root.');
  }
  return context;
}

export type OverlayPortalProps = {
  children?: React.ReactNode;
  overlayId: string;
};

export function OverlayPortal({ children }: OverlayPortalProps) {
  useOverlayRuntime();
  const transport = useOverlayTransport();
  const hostName = useNearestOverlayHost();
  const { PortalOutlet } = transport;
  return <PortalOutlet hostName={hostName}>{children}</PortalOutlet>;
}

export function useOverlayId(prefix = 'beeui-overlay') {
  const reactId = React.useId().replace(/:/g, '');
  return `${prefix}-${reactId}`;
}

export type ModalOverlayDismissScope = {
  dismissTopmostChild: (reason: OverlayDismissReason) => boolean;
};

export type ModalOverlayHostProps = {
  children?: React.ReactNode;
  active?: boolean;
  hostRectOverride?: AnchoredOverlayRect;
  dismissScopeRef?: React.MutableRefObject<ModalOverlayDismissScope | null>;
};

/** Provisions the nearest modal-local host, geometry origin, and dismiss boundary. */
export function ModalOverlayHost({
  active = true,
  children,
  dismissScopeRef,
  hostRectOverride,
}: ModalOverlayHostProps) {
  const transport = React.useContext(OverlayTransportContext);
  const parentScope = React.useContext(OverlayScopeContext);
  const depth = (parentScope?.depth ?? 0) + 1;
  const hostName = useOverlayId('beeui-overlay-modal');
  const dismissStackRef = React.useRef<OverlayDismissStack | null>(null);
  if (dismissStackRef.current === null) dismissStackRef.current = createOverlayDismissStack();
  const dismissStack = dismissStackRef.current;
  const controllerRef = React.useRef<OverlayDismissController | null>(null);
  if (controllerRef.current === null) controllerRef.current = createDismissController(dismissStack);
  const controller = controllerRef.current;
  const coordinator = React.useContext(OverlayActiveScopeContext);
  // A modal-local host reuses the runtime's single (stable) scheduler.
  const measurementScheduler = React.useContext(OverlayMeasurementSchedulerContext);
  const {
    handleHostLayout,
    hostRect,
    hostRef,
    remeasureHost,
  } = useMeasuredOverlayHost(measurementScheduler, hostRectOverride);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  React.useEffect(() => remeasureHost(), [remeasureHost, windowHeight, windowWidth]);

  const scope = React.useMemo<OverlayScope>(
    () => ({
      hostName,
      isModal: true,
      depth,
      hostRect,
      remeasureHost,
      controller,
    }),
    [controller, depth, hostName, hostRect, remeasureHost],
  );

  useIsomorphicLayoutEffect(() => {
    if (!dismissScopeRef) return undefined;
    dismissScopeRef.current = transport
      ? { dismissTopmostChild: (reason) => dismissStack.dismissTop(reason) }
      : null;
    return () => {
      dismissScopeRef.current = null;
    };
  }, [dismissScopeRef, dismissStack, transport]);

  useIsomorphicLayoutEffect(() => {
    if (!transport || !active || !coordinator) return undefined;
    coordinator.activate(dismissStack, depth);
    return () => coordinator.deactivate(dismissStack);
  }, [active, coordinator, depth, dismissStack, transport]);

  const HostOutlet = transport?.HostOutlet;
  const boundary = (
    <View
      accessibilityViewIsModal
      collapsable={false}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
    >
      <OverlayHostScopeProvider hostName={hostName}>{children}</OverlayHostScopeProvider>
    {HostOutlet ? (
        <>
          <View
            ref={hostRef}
            accessible={false}
            collapsable={false}
            onLayout={handleHostLayout}
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, styles.host]}
          />
          <HostOutlet name={hostName} style={styles.host} />
        </>
      ) : null}
    </View>
  );

  // The iOS accessibility modal boundary must contain BOTH the dialog content
  // and the portal destination: accessibilityViewIsModal prunes sibling
  // subtrees from the a11y tree, so a boundary drawn around the dialog alone
  // would hide every anchored overlay opened inside it (#60). The boundary's
  // own siblings are only the Modal scaffolding. It renders with or without a
  // transport so the legacy fallback keeps a boundary too.
  if (!transport) return boundary;
  return <OverlayScopeContext.Provider value={scope}>{boundary}</OverlayScopeContext.Provider>;
}

export type UseOverlayDismissableOptions = {
  onDismiss: OverlayDismissHandler;
  open: boolean;
  overlayId: string;
};

export function useOverlayDismissable({
  onDismiss,
  open,
  overlayId,
}: UseOverlayDismissableOptions) {
  const { controller } = useNearestOverlayScope();
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useIsomorphicLayoutEffect(() => {
    if (!open) return undefined;
    const handler: OverlayDismissHandler = (reason) => onDismissRef.current(reason);
    controller.register(overlayId, handler);
    return () => controller.unregister(overlayId);
  }, [controller, open, overlayId]);

  return React.useMemo(
    () => ({
      dismissOutside: () => controller.dismissIfTopmost(overlayId, 'outside-press'),
      isTopmost: () => controller.isTopmost(overlayId),
    }),
    [controller, overlayId],
  );
}

// `packages/ui` excludes the `dom` lib (see `use-direction.ts`'s
// `WebDocumentLike` convention), so this reaches the DOM through a narrow
// structural type rather than `lib.dom.d.ts`. Deliberately minimal: only the
// surface `useOverlayEscapeKey` itself needs, not the full shape
// `dialog.tsx`/`sheet.web.tsx` use for their own Tab focus-trap DOM queries.
type WebOverlayKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
};

type WebOverlayDocument = {
  addEventListener: (
    type: string,
    listener: (event: WebOverlayKeyboardEvent) => void,
    useCapture?: boolean,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: WebOverlayKeyboardEvent) => void,
    useCapture?: boolean,
  ) => void;
};

function getWebOverlayDocument(): WebOverlayDocument | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { document?: WebOverlayDocument }).document;
}

export type UseOverlayEscapeKeyOptions = {
  /** From this overlay's own `useOverlayDismissable()` — preserves the exact
   * same nested-overlay precedence the caller already established. */
  isTopmost: () => boolean;
  onDismiss: () => void;
  open: boolean;
};

/**
 * Shared Web-only capture-phase `Escape` dismissal for any overlay already
 * registered into a dismiss scope via `useOverlayDismissable` (#318).
 *
 * BeeUI's cross-overlay Escape bridge (`overlay-dismiss-events.web.ts`)
 * listens in the bubble phase at `window`. A focused text `Input` inside an
 * overlay's content (search/filter forms, an editable field — a common
 * shape for `Dialog`/`Sheet`/`Popover` content alike) stops that keydown's
 * propagation before it bubbles that far, silently swallowing Escape for
 * that overlay. `DialogContent` and `SheetContent` each already carried an
 * identical capture-phase binding of their own (predating this hook, #146/
 * #159); `Popover` had none and depended entirely on the bubble-phase
 * bridge, so a focused Input inside `PopoverContent` reproduced the same
 * silent-swallow defect. This lifts that one seam into `overlay-runtime.tsx`
 * so every overlay — present and future — shares one implementation instead
 * of a per-component copy.
 *
 * Capture fires on the way down, before the focused element's own bubble-
 * phase handling runs, so it reaches this listener regardless of what a
 * descendant does with the event afterwards.
 *
 * Every open overlay that carries this binding (Dialog, Popover, Sheet)
 * installs its OWN capture-phase `document` listener, and — because
 * `stopPropagation()` never suppresses *other* listeners already registered
 * on the same node (only `stopImmediatePropagation()` does) — all of them
 * fire for a single physical Escape keydown, each with its own `isTopmost()`
 * scoped only to its OWN nearest dismiss stack. A root-level, non-modal
 * overlay (e.g. a `Popover` rendered outside any `ModalOverlayHost`) is
 * always alone in the root stack, so its LOCAL `isTopmost()` is trivially
 * true regardless of what is open in a deeper, unrelated modal scope. Left
 * unchecked, that overlay would call its own `onDismiss` and
 * `stopPropagation()` — which, because capture always precedes the bubble
 * phase, permanently prevents the event from ever reaching
 * `overlay-dismiss-events.web.ts`'s `window` bubble listener, i.e. the ONE
 * mechanism (`OverlayActiveScopeCoordinator.dispatchTop`) that actually knows
 * how to compare scopes by modal depth. The result: a later- or
 * earlier-registered shallow overlay can silently steal Escape from a
 * deeper, genuinely topmost modal overlay (proven by the visual-regression
 * "Web Escape CASE C" fixture).
 *
 * The fix: `isTopmost()` still gates whether THIS instance is even a
 * candidate to act (preserving existing nested-overlay precedence within one
 * scope, e.g. a `Popover` opened from inside a `Dialog` is dismissed
 * child-first), but the actual dismissal is delegated to the SAME
 * depth-aware `dispatchTop` the platform-dismiss bridge and bubble-phase
 * fallback already use, instead of this instance's own `onDismiss`. That
 * always resolves to the topmost entry of the deepest ACTIVE modal scope —
 * which may be a different overlay than the one whose listener happened to
 * fire — so a shallow overlay's own trivially-true local `isTopmost()` can
 * no longer hijack an Escape meant for a deeper nested overlay.
 * `stopImmediatePropagation()` additionally stops the other same-node
 * capture listeners from redundantly re-dispatching once one has already
 * resolved the event.
 */
export function useOverlayEscapeKey({ isTopmost, onDismiss, open }: UseOverlayEscapeKeyOptions) {
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const isTopmostRef = React.useRef(isTopmost);
  isTopmostRef.current = isTopmost;
  const coordinator = React.useContext(OverlayActiveScopeContext);
  const coordinatorRef = React.useRef(coordinator);
  coordinatorRef.current = coordinator;

  React.useEffect(() => {
    if (!open) return undefined;
    const doc = getWebOverlayDocument();
    if (!doc) return undefined;

    const handleKeyDown = (event: WebOverlayKeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopmostRef.current()) return;
      const activeCoordinator = coordinatorRef.current;
      let dismissed: boolean;
      if (activeCoordinator) {
        dismissed = activeCoordinator.dispatchTop('escape');
      } else {
        // No coordinator available (a minimal test harness without the full
        // runtime provider): fall back to the pre-existing local decision
        // rather than silently doing nothing.
        onDismissRef.current();
        dismissed = true;
      }
      if (!dismissed) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    };

    doc.addEventListener('keydown', handleKeyDown, true);
    return () => doc.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);
}

export type OverlayDismissLayerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'onPress' | 'role' | 'style'
> & {
  onPress?: PressableProps['onPress'];
  overlayId: string;
  style?: StyleProp<ViewStyle>;
};

export const OverlayDismissLayer = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  OverlayDismissLayerProps
>(({ onPress, overlayId, style, ...props }, ref) => {
  const { controller } = useNearestOverlayScope();

  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityElementsHidden
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      onPress={(event) => {
        onPress?.(event);
        controller.dismissIfTopmost(overlayId, 'outside-press');
      }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
});

OverlayDismissLayer.displayName = 'OverlayDismissLayer';

export type UseAnchoredOverlayPositionOptions = {
  align?: AnchoredOverlayAlign;
  alignOffset?: number;
  anchorRef: React.RefObject<OverlayMeasurableNode | null>;
  avoidKeyboard?: boolean;
  avoidSafeArea?: boolean;
  collisionPadding?: AnchoredOverlayCollisionPadding;
  direction?: AnchoredOverlayDirection;
  flip?: boolean;
  onAnchorUnavailable?: () => void;
  open: boolean;
  placement?: AnchoredOverlayPlacement;
  shift?: boolean;
  sideOffset?: number;
};

export type UseAnchoredOverlayPositionResult = {
  anchorRect: AnchoredOverlayRect | null;
  hostRect: AnchoredOverlayRect | null;
  onOverlayLayout: (event: LayoutChangeEvent) => void;
  overlaySize: AnchoredOverlaySize | null;
  position: AnchoredOverlayPosition | null;
  remeasure: () => void;
  viewportRect: AnchoredOverlayRect | null;
  windowPosition: AnchoredOverlayPosition | null;
};

type AnchoredOverlayMeasurement = {
  hostRevision: string | null;
  rect: AnchoredOverlayRect;
};

export function useAnchoredOverlayPosition({
  align = 'center',
  alignOffset = 0,
  anchorRef,
  avoidKeyboard = false,
  avoidSafeArea = true,
  collisionPadding,
  direction = 'ltr',
  flip = true,
  onAnchorUnavailable,
  open,
  placement = 'bottom',
  shift = true,
  sideOffset = 0,
}: UseAnchoredOverlayPositionOptions): UseAnchoredOverlayPositionResult {
  const { hostRect, remeasureHost } = useNearestOverlayScope();
  const { keyboardRect, safeAreaInsets, windowRect } = useOverlayRuntime();
  const measurementScheduler = React.useContext(OverlayMeasurementSchedulerContext);
  const hostRevision = hostRect
    ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}`
    : null;
  const hostRevisionRef = React.useRef(hostRevision);
  hostRevisionRef.current = hostRevision;
  const openRef = React.useRef(open);
  openRef.current = open;
  const [anchorMeasurement, setAnchorMeasurement] =
    React.useState<AnchoredOverlayMeasurement | null>(null);
  const anchorRect =
    anchorMeasurement?.hostRevision === hostRevision ? anchorMeasurement.rect : null;
  const [overlaySize, setOverlaySize] = React.useState<AnchoredOverlaySize | null>(null);
  const anchorMeasurementGenerationRef = React.useRef(0);
  // Cancel handle for the in-flight anchor measurement watchdog, if any.
  const watchdogCancelRef = React.useRef<(() => void) | null>(null);
  const cancelWatchdog = React.useCallback(() => {
    if (watchdogCancelRef.current) {
      watchdogCancelRef.current();
      watchdogCancelRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      anchorMeasurementGenerationRef.current += 1;
      // Unmount retires the generation and must cancel any outstanding watchdog so
      // it can never fire after unmount (ADR-003 Close/unmount invalidation).
      cancelWatchdog();
    },
    [cancelWatchdog],
  );

  const remeasure = React.useCallback(() => {
    if (!openRef.current) return;
    remeasureHost();
    // A newer request supersedes the previous watchdog (ADR-003 row 6).
    cancelWatchdog();
    const generation = ++anchorMeasurementGenerationRef.current;
    const requestedHostRevision = hostRevision;
    let callbackInvoked = false;
    const scheduled = measureOverlayNodeInWindow(anchorRef.current, (nextRect) => {
      callbackInvoked = true;
      // Guard BEFORE cancelling: a stale (superseded/host-revised/closed/retired)
      // callback must be fully inert. Cancelling here is generation-agnostic, so a
      // late callback from an already-retired request would otherwise kill the
      // CURRENT request's in-flight watchdog and let it hang unbounded (ADR-003).
      if (
        generation !== anchorMeasurementGenerationRef.current ||
        requestedHostRevision !== hostRevisionRef.current ||
        !openRef.current
      ) {
        return;
      }
      cancelWatchdog();
      if (!nextRect) {
        setAnchorMeasurement(null);
        onAnchorUnavailable?.();
        return;
      }
      setAnchorMeasurement((current) =>
        current?.hostRevision === requestedHostRevision && sameRect(current.rect, nextRect)
          ? current
          : { hostRevision: requestedHostRevision, rect: nextRect },
      );
    });
    if (
      !scheduled &&
      !callbackInvoked &&
      generation === anchorMeasurementGenerationRef.current &&
      requestedHostRevision === hostRevisionRef.current &&
      openRef.current
    ) {
      onAnchorUnavailable?.();
    }
    if (scheduled && !callbackInvoked) {
      watchdogCancelRef.current = armMeasurementWatchdog(
        measurementScheduler,
        MEASUREMENT_TICK_BUDGET,
        () => {
          watchdogCancelRef.current = null;
          // Superseded, host geometry changed, or overlay closed while pending:
          // normal retirement, not unresponsiveness — no callback, no diagnostic.
          // Reuses the exact guards that already reject a stale successful callback.
          if (
            generation !== anchorMeasurementGenerationRef.current ||
            requestedHostRevision !== hostRevisionRef.current ||
            !openRef.current
          ) {
            return;
          }
          // Retire this generation so a late real callback is dropped by the
          // existing generation guard (ADR-003 Late-callback handling).
          anchorMeasurementGenerationRef.current += 1;
          setAnchorMeasurement(null);
          onAnchorUnavailable?.();
          warnMeasurementUnresponsive({
            target: 'anchor',
            generation,
            action: 'anchor-unavailable',
            hostRevision: requestedHostRevision,
          });
        },
      );
    }
  }, [anchorRef, cancelWatchdog, hostRevision, measurementScheduler, onAnchorUnavailable, remeasureHost]);

  React.useEffect(() => {
    if (!open) {
      anchorMeasurementGenerationRef.current += 1;
      // Close retires the generation and must cancel any outstanding watchdog
      // (ADR-003 Close/unmount invalidation).
      cancelWatchdog();
      setAnchorMeasurement(null);
      setOverlaySize(null);
      return;
    }
    remeasure();
  }, [cancelWatchdog, hostRevision, keyboardRect, open, remeasure, windowRect.height, windowRect.width]);

  const onOverlayLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = {
      width: Number.isFinite(width) ? Math.max(0, width) : 0,
      height: Number.isFinite(height) ? Math.max(0, height) : 0,
    };
    setOverlaySize((current) =>
      current?.width === next.width && current.height === next.height ? current : next,
    );
  }, []);

  const viewportRect = React.useMemo(() => {
    if (!hostRect) return null;
    return avoidKeyboard
      ? constrainOverlayViewportToKeyboard(hostRect, keyboardRect)
      : hostRect;
  }, [avoidKeyboard, hostRect, keyboardRect]);

  const windowPosition = React.useMemo(() => {
    if (!anchorRect || !hostRect || !overlaySize || !viewportRect) return null;

    const safePadding = avoidSafeArea
      ? getSafeAreaCollisionPadding(hostRect, windowRect, safeAreaInsets)
      : { top: 0, right: 0, bottom: 0, left: 0 };
    if (avoidKeyboard && viewportRect.height < hostRect.height) safePadding.bottom = 0;

    return resolveAnchoredOverlayPosition({
      anchorRect,
      overlaySize,
      viewportRect,
      placement,
      align,
      direction,
      sideOffset,
      alignOffset,
      collisionPadding: mergeOverlayCollisionPadding(collisionPadding, safePadding),
      flip,
      shift,
    });
  }, [
    align,
    alignOffset,
    anchorRect,
    avoidKeyboard,
    avoidSafeArea,
    collisionPadding,
    direction,
    flip,
    hostRect,
    overlaySize,
    placement,
    safeAreaInsets,
    shift,
    sideOffset,
    viewportRect,
    windowRect,
  ]);

  const position = React.useMemo(() => {
    if (!windowPosition || !hostRect) return null;
    return {
      ...windowPosition,
      x: windowPosition.x - hostRect.x,
      y: windowPosition.y - hostRect.y,
    };
  }, [hostRect, windowPosition]);

  return {
    anchorRect,
    hostRect,
    onOverlayLayout,
    overlaySize,
    position,
    remeasure,
    viewportRect,
    windowPosition,
  };
}

export function useOverlayEnvironment() {
  const { hostRect } = useNearestOverlayScope();
  const { keyboardRect, safeAreaInsets, windowRect } = useOverlayRuntime();
  return { hostRect, keyboardRect, safeAreaInsets, windowRect };
}

const styles = StyleSheet.create({
  host: {
    zIndex: layer.overlay,
  },
});
