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

export type OverlayMeasurableNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

type OverlayRuntimeContextValue = {
  dismissIfTopmost: (id: string, reason: OverlayDismissReason) => boolean;
  dismissTop: (reason: OverlayDismissReason) => boolean;
  hostRect: AnchoredOverlayRect | null;
  isTopmost: (id: string) => boolean;
  keyboardRect: AnchoredOverlayRect | null;
  registerDismissable: (id: string, handler: OverlayDismissHandler) => void;
  remeasureHost: () => void;
  safeAreaInsets: { top: number; right: number; bottom: number; left: number };
  unregisterDismissable: (id: string) => void;
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
  const [hostRect, setHostRect] = React.useState<AnchoredOverlayRect | null>(null);
  const hostRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const dismissStackRef = React.useRef(createOverlayDismissStack());
  const safeAreaInsets = useSafeAreaInsets();
  const keyboardRect = useKeyboardRect();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const windowRect = React.useMemo(
    () => ({ x: 0, y: 0, width: windowWidth, height: windowHeight }),
    [windowHeight, windowWidth],
  );
  const overriddenHostRect = React.useMemo(
    () => (hostRectOverride ? finiteRect(hostRectOverride) : null),
    [
      hostRectOverride?.height,
      hostRectOverride?.width,
      hostRectOverride?.x,
      hostRectOverride?.y,
    ],
  );
  const resolvedHostRect = overriddenHostRect ?? hostRect;

  const registerDismissable = React.useCallback((id: string, handler: OverlayDismissHandler) => {
    dismissStackRef.current.register(id, handler);
  }, []);
  const unregisterDismissable = React.useCallback((id: string) => {
    dismissStackRef.current.unregister(id);
  }, []);
  const dismissTop = React.useCallback(
    (reason: OverlayDismissReason) => dismissStackRef.current.dismissTop(reason),
    [],
  );
  const dismissIfTopmost = React.useCallback(
    (id: string, reason: OverlayDismissReason) =>
      dismissStackRef.current.dismissIfTopmost(id, reason),
    [],
  );
  const isTopmost = React.useCallback((id: string) => dismissStackRef.current.isTopmost(id), []);

  const remeasureHost = React.useCallback(() => {
    if (overriddenHostRect) return;
    measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
      if (nextRect) setRectIfChanged(setHostRect, nextRect);
    });
  }, [overriddenHostRect]);

  const handleHostLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (overriddenHostRect) return;
      const fallback = finiteRect(event.nativeEvent.layout);
      const scheduled = measureOverlayNodeInWindow(hostRef.current, (nextRect) => {
        setRectIfChanged(setHostRect, nextRect ?? fallback);
      });
      if (!scheduled) setRectIfChanged(setHostRect, fallback);
    },
    [overriddenHostRect],
  );

  React.useEffect(() => remeasureHost(), [remeasureHost, windowHeight, windowWidth]);

  React.useEffect(() => subscribeOverlayPlatformDismiss(dismissTop), [dismissTop]);

  const context = React.useMemo<OverlayRuntimeContextValue>(
    () => ({
      dismissIfTopmost,
      dismissTop,
      hostRect: resolvedHostRect,
      isTopmost,
      keyboardRect,
      registerDismissable,
      remeasureHost,
      safeAreaInsets,
      unregisterDismissable,
      windowRect,
    }),
    [
      dismissIfTopmost,
      dismissTop,
      isTopmost,
      keyboardRect,
      registerDismissable,
      remeasureHost,
      resolvedHostRect,
      safeAreaInsets,
      unregisterDismissable,
      windowRect,
    ],
  );

  const { RootBoundary, HostOutlet } = transport;

  return (
    <OverlayTransportContext.Provider value={transport}>
      <RootBoundary>
        <OverlayRuntimeContext.Provider value={context}>
          <OverlayHostScopeProvider hostName={ROOT_OVERLAY_HOST}>{children}</OverlayHostScopeProvider>
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

export type ModalOverlayHostProps = { children?: React.ReactNode };

/**
 * Provisions a modal-local overlay host. React Native `Modal` renders in its own
 * native window; without a host inside it, anchored overlays declared in modal
 * content would target the root host and render behind the modal. Wrapping modal
 * content in this makes nested Popover / DropdownMenu / future anchored overlays
 * target a host in the same window. It no-ops outside `BeeUIProvider` (a modal
 * with no anchored overlays), so it is safe to always render around modal content.
 */
export function ModalOverlayHost({ children }: ModalOverlayHostProps) {
  const transport = React.useContext(OverlayTransportContext);
  const hostName = useOverlayId('beeui-overlay-modal');
  if (!transport) return <>{children}</>;
  const { HostOutlet } = transport;
  return (
    <>
      <OverlayHostScopeProvider hostName={hostName}>{children}</OverlayHostScopeProvider>
      <HostOutlet name={hostName} style={styles.host} />
    </>
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
  const { dismissIfTopmost, isTopmost, registerDismissable, unregisterDismissable } =
    useOverlayRuntime();
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  React.useEffect(() => {
    if (!open) return undefined;
    registerDismissable(overlayId, (reason) => onDismissRef.current(reason));
    return () => unregisterDismissable(overlayId);
  }, [open, overlayId, registerDismissable, unregisterDismissable]);

  return React.useMemo(
    () => ({
      dismissOutside: () => dismissIfTopmost(overlayId, 'outside-press'),
      isTopmost: () => isTopmost(overlayId),
    }),
    [dismissIfTopmost, isTopmost, overlayId],
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
  const { dismissIfTopmost } = useOverlayRuntime();

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
        dismissIfTopmost(overlayId, 'outside-press');
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
  const { hostRect, keyboardRect, remeasureHost, safeAreaInsets, windowRect } = useOverlayRuntime();
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

  React.useEffect(() => {
    if (!open) {
      setRectIfChanged(setAnchorRect, null);
      setOverlaySize(null);
      return;
    }
    remeasure();
  }, [keyboardRect, open, remeasure, windowRect.height, windowRect.width]);

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
  const { hostRect, keyboardRect, safeAreaInsets, windowRect } = useOverlayRuntime();
  return { hostRect, keyboardRect, safeAreaInsets, windowRect };
}

const styles = StyleSheet.create({
  host: {
    zIndex: 1,
  },
});
