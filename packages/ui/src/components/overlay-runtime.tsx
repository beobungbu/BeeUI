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
} from '@beeui/core';
import * as React from 'react';
import {
  Keyboard,
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
 * Measures an overlay host in window coordinates. Native measurement callbacks are
 * asynchronous, so only the newest request may commit. A stale callback from a
 * previous layout/orientation must never overwrite a newer host rectangle.
 */
function useMeasuredOverlayHost(hostRectOverride?: AnchoredOverlayRect) {
  const [hostRect, setHostRect] = React.useState<AnchoredOverlayRect | null>(null);
  const hostRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const measurementGenerationRef = React.useRef(0);
  const overridden = React.useMemo(
    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),
    [hostRectOverride?.height, hostRectOverride?.width, hostRectOverride?.x, hostRectOverride?.y],
  );

  useIsomorphicLayoutEffect(() => {
    measurementGenerationRef.current += 1;
    return () => {
      measurementGenerationRef.current += 1;
    };
  }, [overridden?.height, overridden?.width, overridden?.x, overridden?.y]);

  const measureLatest = React.useCallback(
    (fallback?: AnchoredOverlayRect | null) => {
      if (overridden) return false;
      const generation = ++measurementGenerationRef.current;
      let callbackInvoked = false;
      const scheduled = measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
        callbackInvoked = true;
        if (generation !== measurementGenerationRef.current) return;
        const resolved = nextRect ?? fallback ?? null;
        if (resolved) setRectIfChanged(setHostRect, resolved);
      });
      if (!scheduled && !callbackInvoked && generation === measurementGenerationRef.current && fallback) {
        setRectIfChanged(setHostRect, fallback);
      }
      return scheduled;
    },
    [overridden],
  );

  const remeasureHost = React.useCallback(() => {
    measureLatest();
  }, [measureLatest]);

  const handleHostLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (overridden) return;
      const fallback = finiteRect(event.nativeEvent.layout);
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
  /** Internal deterministic transport seam used by contract tests. */
  transport?: OverlayTransport;
};

function OverlayRuntimeProviderRoot({
  children,
  hostRectOverride,
  transport: transportOverride,
}: OverlayRuntimeProviderProps) {
  const transportRef = React.useRef<OverlayTransport | null>(null);
  if (transportRef.current === null) {
    transportRef.current = transportOverride ?? resolveOverlayTransport();
  }
  const transport = transportRef.current;
  const {
    handleHostLayout,
    hostRect: resolvedHostRect,
    hostRef,
    remeasureHost,
  } = useMeasuredOverlayHost(hostRectOverride);
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
    </OverlayTransportContext.Provider>
  );
}

export function OverlayRuntimeProvider({
  children,
  hostRectOverride,
  transport,
}: OverlayRuntimeProviderProps) {
  const parent = React.useContext(OverlayRuntimeContext);
  if (parent) return <>{children}</>;
  return (
    <OverlayRuntimeProviderRoot hostRectOverride={hostRectOverride} transport={transport}>
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
  const {
    handleHostLayout,
    hostRect,
    hostRef,
    remeasureHost,
  } = useMeasuredOverlayHost(hostRectOverride);
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

  if (!transport) return <>{children}</>;
  const { HostOutlet } = transport;
  return (
    <OverlayScopeContext.Provider value={scope}>
      <OverlayHostScopeProvider hostName={hostName}>{children}</OverlayHostScopeProvider>
      <View
        ref={hostRef}
        accessible={false}
        collapsable={false}
        onLayout={handleHostLayout}
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, styles.host]}
      />
      <HostOutlet name={hostName} style={styles.host} />
    </OverlayScopeContext.Provider>
  );
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
  const [anchorRect, setAnchorRect] = React.useState<AnchoredOverlayRect | null>(null);
  const [overlaySize, setOverlaySize] = React.useState<AnchoredOverlaySize | null>(null);
  const anchorMeasurementGenerationRef = React.useRef(0);

  React.useEffect(
    () => () => {
      anchorMeasurementGenerationRef.current += 1;
    },
    [],
  );

  const remeasure = React.useCallback(() => {
    remeasureHost();
    const generation = ++anchorMeasurementGenerationRef.current;
    let callbackInvoked = false;
    const scheduled = measureOverlayNodeInWindow(anchorRef.current, (nextRect) => {
      callbackInvoked = true;
      if (generation !== anchorMeasurementGenerationRef.current) return;
      if (!nextRect) {
        setRectIfChanged(setAnchorRect, null);
        onAnchorUnavailable?.();
        return;
      }
      setRectIfChanged(setAnchorRect, nextRect);
    });
    if (!scheduled && !callbackInvoked && generation === anchorMeasurementGenerationRef.current) {
      onAnchorUnavailable?.();
    }
  }, [anchorRef, onAnchorUnavailable, remeasureHost]);

  const hostRevision = hostRect
    ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}`
    : null;

  React.useEffect(() => {
    if (!open) {
      anchorMeasurementGenerationRef.current += 1;
      setRectIfChanged(setAnchorRect, null);
      setOverlaySize(null);
      return;
    }
    remeasure();
  }, [hostRevision, keyboardRect, open, remeasure, windowRect.height, windowRect.width]);

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
    zIndex: 1,
  },
});
