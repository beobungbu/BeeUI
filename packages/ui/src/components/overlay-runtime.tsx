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

/**
 * A dismiss controller is the **stable** identity of a scope's dismissal stack.
 * Its identity never changes for the lifetime of a scope, so overlay registration
 * lifecycles keyed on it are unaffected by reactive geometry (`hostRect`) updates.
 * Topmost ordering therefore follows overlay open/registration order, not layout.
 */
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
 * An overlay scope is the coherent unit an anchored overlay resolves against:
 * where its content is portaled (`hostName`), the window-space measurement origin
 * for geometry (`hostRect` / `remeasureHost`), and the dismissal `controller` that
 * decides "topmost" *within that scope*. The application root is one scope; each
 * modal-class surface (`DialogContent`) provisions its own. Overlays resolve the
 * **nearest** scope, so geometry stays in the modal's coordinate space and a root
 * overlay behind a modal can never become topmost over a modal-local child.
 *
 * Reactive geometry (`hostRect`) and the **stable** `controller` are deliberately
 * separated: the scope object changes identity when geometry changes so geometry
 * consumers re-render, but the `controller` identity is fixed, so dismissal
 * registration/ordering is never disturbed by a layout or host-move update.
 */
export type OverlayScope = {
  hostName: string;
  isModal: boolean;
  hostRect: AnchoredOverlayRect | null;
  remeasureHost: () => void;
  controller: OverlayDismissController;
};

// Exported for internal contract tests only (imported via the source path, never
// re-exported from the package index — not public API). Lets a test drive a scope
// whose geometry changes while its dismiss controller / remeasure identity stays
// stable, which cannot be reproduced through the hostRectOverride seam.
export const OverlayScopeContext = React.createContext<OverlayScope | null>(null);

function useNearestOverlayScope(): OverlayScope {
  const scope = React.useContext(OverlayScopeContext);
  if (!scope) {
    throw new Error('BeeUI anchored overlays require BeeUIProvider at the application root.');
  }
  return scope;
}

/**
 * Coordinates the active-scope stack for GLOBAL dismiss events (web Escape,
 * Android root hardware back) **within a single runtime**. Owned per
 * `OverlayRuntimeProviderRoot` (not module-global), so independent runtimes —
 * separate React roots, micro-frontends, embedded surfaces, test harnesses —
 * cannot dismiss each other's overlays or double-fire. Per-overlay events
 * (outside press, accessibility escape) route through the nearest scope directly
 * and never consult this coordinator.
 */
export type OverlayActiveScopeCoordinator = {
  /** Mark a scope's dismiss stack as the active (topmost) boundary. */
  activate: (stack: OverlayDismissStack) => void;
  deactivate: (stack: OverlayDismissStack) => void;
  /** Dispatch a global event to this runtime's topmost active scope. */
  dispatchTop: (reason: OverlayDismissReason) => boolean;
};

function createActiveScopeCoordinator(): OverlayActiveScopeCoordinator {
  // Ordered by activation; the last entry is the visible modal boundary. Stored
  // identities are the stable per-scope dismiss stacks, so hostRect updates never
  // reorder them.
  const stacks: OverlayDismissStack[] = [];
  return {
    activate(stack) {
      if (!stacks.includes(stack)) stacks.push(stack);
    },
    deactivate(stack) {
      const index = stacks.indexOf(stack);
      if (index >= 0) stacks.splice(index, 1);
    },
    dispatchTop(reason) {
      const top = stacks.at(-1);
      return top ? top.dismissTop(reason) : false;
    },
  };
}

const OverlayActiveScopeContext = React.createContext<OverlayActiveScopeCoordinator | null>(null);

// Window-level shared state (not dismissal — that lives on the per-scope
// controller, and geometry origin on the nearest scope). Keeping these separate
// from the scope keeps geometry/dismissal identities independent.
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
 * Measures a full-screen overlay host View in window coordinates. Shared by the
 * root runtime and each modal-local host so both derive their geometry origin the
 * same way — the modal host measures its own window origin (e.g. a `pageSheet`
 * inset), never the root's. `hostRectOverride` is a deterministic test seam.
 */
function useMeasuredOverlayHost(hostRectOverride?: AnchoredOverlayRect) {
  const [hostRect, setHostRect] = React.useState<AnchoredOverlayRect | null>(null);
  const hostRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const overridden = React.useMemo(
    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),
    [hostRectOverride?.height, hostRectOverride?.width, hostRectOverride?.x, hostRectOverride?.y],
  );

  const remeasureHost = React.useCallback(() => {
    if (overridden) return;
    measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
      if (nextRect) setRectIfChanged(setHostRect, nextRect);
    });
  }, [overridden]);

  const handleHostLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (overridden) return;
      const fallback = finiteRect(event.nativeEvent.layout);
      const scheduled = measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
        setRectIfChanged(setHostRect, nextRect ?? fallback);
      });
      if (!scheduled) setRectIfChanged(setHostRect, fallback);
    },
    [overridden],
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
  // Resolve the portal transport once, lazily, on first render — creating a web
  // transport builds Maps and components, so we must not re-run the initializer
  // every render and discard the result. The transport is intentionally fixed
  // for the lifetime of the runtime: a changed `transport` prop after mount is
  // ignored (the seam is for injecting a transport before first render in tests,
  // not for hot-swapping the portal implementation at runtime).
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

  // Stable per-runtime dismiss controller and active-scope coordinator. Both are
  // created once (fixed identity) so geometry updates never disturb dismissal
  // registration/ordering, and so this runtime's global-event routing is isolated
  // from any other runtime.
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

  // Global platform dismiss (web Escape, Android root back) is dispatched to THIS
  // runtime's topmost active scope, so an open modal boundary handles it before
  // any root overlay behind it, and a sibling runtime is never affected. On
  // Android the root back handler is suppressed while a Modal is open, so this
  // only fires for the root scope; the modal boundary routes hardware back through
  // `Modal.onRequestClose` instead.
  React.useEffect(
    () => subscribeOverlayPlatformDismiss((reason) => coordinator.dispatchTop(reason)),
    [coordinator],
  );

  // The root scope is always active (bottom of this runtime's stack).
  useIsomorphicLayoutEffect(() => {
    const stack = dismissStackRef.current;
    coordinator.activate(stack);
    return () => coordinator.deactivate(stack);
  }, [coordinator]);

  const rootScope = React.useMemo<OverlayScope>(
    () => ({
      hostName: ROOT_OVERLAY_HOST,
      isModal: false,
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
            {/* Measurement host: provides the window-origin rect that anchors
                geometry. Overlay content itself lands in the transport HostOutlet. */}
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
  useOverlayRuntime(); // require BeeUIProvider
  const transport = useOverlayTransport();
  // Target the nearest host scope: the root host, or a modal-class surface's own
  // local host when the overlay is declared inside one.
  const hostName = useNearestOverlayHost();
  const { PortalOutlet } = transport;
  return <PortalOutlet hostName={hostName}>{children}</PortalOutlet>;
}

export function useOverlayId(prefix = 'beeui-overlay') {
  const reactId = React.useId().replace(/:/g, '');
  return `${prefix}-${reactId}`;
}

/**
 * Minimal bridge a modal boundary (e.g. `DialogContent`) uses to reach its own
 * modal scope from `Modal.onRequestClose`, which runs *above* the scope provider.
 * On Android the Modal suppresses the root back handler, so hardware back arrives
 * only through `onRequestClose`; the boundary dismisses the modal's topmost
 * anchored child first and consumes the event.
 */
export type ModalOverlayDismissScope = {
  /** Dismiss the modal scope's topmost anchored child; false if it has none. */
  dismissTopmostChild: (reason: OverlayDismissReason) => boolean;
};

export type ModalOverlayHostProps = {
  children?: React.ReactNode;
  /**
   * Whether this modal surface is the visible/active boundary. While active its
   * dismiss stack sits atop the global active-scope stack, so web Escape / root
   * back reach it before any root overlay behind it. `DialogContent` passes its
   * `open` state.
   */
  active?: boolean;
  /** Internal deterministic measurement seam used by geometry contract tests. */
  hostRectOverride?: AnchoredOverlayRect;
  /** Bridge for the modal boundary to run child-first dismissal on request-close. */
  dismissScopeRef?: React.MutableRefObject<ModalOverlayDismissScope | null>;
};

/**
 * Provisions a modal-local overlay scope: its own portal host (React Native
 * `Modal` renders in a separate native window), its own measured geometry origin
 * (so anchored overlays inside a `pageSheet`/`formSheet` position relative to the
 * sheet, not the root window), and its own dismiss stack (so outside press,
 * accessibility escape, web Escape, and hardware back stay scoped to the modal and
 * a root overlay behind it can never become topmost over a modal-local child). It
 * no-ops outside `BeeUIProvider` (a modal with no anchored overlays), so it is
 * safe to always render around modal content.
 */
export function ModalOverlayHost({
  active = true,
  children,
  dismissScopeRef,
  hostRectOverride,
}: ModalOverlayHostProps) {
  const transport = React.useContext(OverlayTransportContext);
  const hostName = useOverlayId('beeui-overlay-modal');
  const dismissStackRef = React.useRef<OverlayDismissStack | null>(null);
  if (dismissStackRef.current === null) dismissStackRef.current = createOverlayDismissStack();
  const dismissStack = dismissStackRef.current;
  // Stable dismiss controller identity for this modal scope — geometry updates
  // never disturb its registration/ordering.
  const controllerRef = React.useRef<OverlayDismissController | null>(null);
  if (controllerRef.current === null) controllerRef.current = createDismissController(dismissStack);
  const controller = controllerRef.current;
  // The active-scope coordinator is owned by the nearest runtime (root provider),
  // not module-global, so this modal only ever activates within its own runtime.
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
      hostRect,
      remeasureHost,
      controller,
    }),
    [controller, hostName, hostRect, remeasureHost],
  );

  // Bridge child-first dismissal to the modal boundary above this provider. Only
  // expose it when a transport (BeeUIProvider) is present; otherwise the boundary
  // falls back to closing directly.
  useIsomorphicLayoutEffect(() => {
    if (!dismissScopeRef) return undefined;
    dismissScopeRef.current = transport
      ? { dismissTopmostChild: (reason) => dismissStack.dismissTop(reason) }
      : null;
    return () => {
      dismissScopeRef.current = null;
    };
  }, [dismissScopeRef, dismissStack, transport]);

  // While active, this modal's dismiss stack is the topmost active scope for
  // global events (web Escape / root back) within its runtime. Registered
  // synchronously so a native request-close immediately after the modal opens
  // still routes correctly.
  useIsomorphicLayoutEffect(() => {
    if (!transport || !active || !coordinator) return undefined;
    coordinator.activate(dismissStack);
    return () => coordinator.deactivate(dismissStack);
  }, [active, coordinator, dismissStack, transport]);

  if (!transport) return <>{children}</>;
  const { HostOutlet } = transport;
  return (
    <OverlayScopeContext.Provider value={scope}>
      <OverlayHostScopeProvider hostName={hostName}>{children}</OverlayHostScopeProvider>
      {/* Modal-local measurement host: window origin of this modal's content
          (e.g. a pageSheet inset), the geometry origin for overlays inside it. */}
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
  // Register with the NEAREST scope's **stable dismiss controller** — the root
  // controller, or the modal controller when declared inside a modal. Topmost and
  // dismissal are evaluated within that scope, so a root overlay behind a modal
  // never affects a modal-local child's topmost state (and vice versa). Crucially,
  // the controller identity is fixed across geometry (hostRect) updates, so the
  // registration effect never re-runs on layout/host-move — dismiss ordering
  // follows open order, not geometry.
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
  // Geometry origin comes from the NEAREST scope's host: a modal-local overlay
  // measures against its modal host window origin (e.g. a pageSheet inset), not
  // the root window. Keyboard / safe-area / window rects are window-level and
  // stay shared from the runtime.
  const { hostRect, remeasureHost } = useNearestOverlayScope();
  const { keyboardRect, safeAreaInsets, windowRect } = useOverlayRuntime();
  const [anchorRect, setAnchorRect] = React.useState<AnchoredOverlayRect | null>(null);
  const [overlaySize, setOverlaySize] = React.useState<AnchoredOverlaySize | null>(null);

  const remeasure = React.useCallback(() => {
    remeasureHost();
    const scheduled = measureOverlayNodeInWindow(anchorRef.current, (nextRect) => {
      if (!nextRect) {
        setRectIfChanged(setAnchorRect, null);
        onAnchorUnavailable?.();
        return;
      }
      setRectIfChanged(setAnchorRect, nextRect);
    });
    if (!scheduled) onAnchorUnavailable?.();
  }, [anchorRef, onAnchorUnavailable, remeasureHost]);

  // A stable revision key from the nearest host geometry: when the host moves or
  // resizes (e.g. a sheet resize/orientation) while the root window dimensions are
  // unchanged, the anchor must be remeasured so a new host origin is never paired
  // with a stale anchor. Identical rect values produce the same key, so no
  // remeasure loop occurs (measureInWindow → setRectIfChanged is a no-op on equal
  // values, keeping the key stable).
  const hostRevision = hostRect
    ? `${hostRect.x},${hostRect.y},${hostRect.width},${hostRect.height}`
    : null;

  React.useEffect(() => {
    if (!open) {
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
