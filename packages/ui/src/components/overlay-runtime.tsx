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
// Spike (#35): native portal that preserves the React fiber tree (and therefore
// consumer context) instead of storing the node and re-rendering it at the host.
import { Portal, PortalHost, PortalProvider } from 'react-native-teleport';
import { subscribeOverlayPlatformDismiss } from './overlay-dismiss-events';

const OVERLAY_PORTAL_HOST = 'beeui-overlay';

type OverlayPortalEntry = {
  id: string;
  node: React.ReactNode;
};

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
  mountPortal: (id: string, node: React.ReactNode) => void;
  registerDismissable: (id: string, handler: OverlayDismissHandler) => void;
  remeasureHost: () => void;
  safeAreaInsets: { top: number; right: number; bottom: number; left: number };
  unmountPortal: (id: string) => void;
  unregisterDismissable: (id: string) => void;
  updatePortal: (id: string, node: React.ReactNode) => void;
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
};

function OverlayRuntimeProviderRoot({
  children,
  hostRectOverride,
}: OverlayRuntimeProviderProps) {
  const [entries, setEntries] = React.useState<OverlayPortalEntry[]>([]);
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

  const mountPortal = React.useCallback((id: string, node: React.ReactNode) => {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      if (index < 0) return [...current, { id, node }];
      if (current[index]?.node === node) return current;
      return current.map((entry) => (entry.id === id ? { id, node } : entry));
    });
  }, []);

  const updatePortal = React.useCallback((id: string, node: React.ReactNode) => {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      if (index < 0) return [...current, { id, node }];
      if (current[index]?.node === node) return current;
      return current.map((entry) => (entry.id === id ? { id, node } : entry));
    });
  }, []);

  const unmountPortal = React.useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

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
      mountPortal,
      registerDismissable,
      remeasureHost,
      safeAreaInsets,
      unmountPortal,
      unregisterDismissable,
      updatePortal,
      windowRect,
    }),
    [
      dismissIfTopmost,
      dismissTop,
      isTopmost,
      keyboardRect,
      mountPortal,
      registerDismissable,
      remeasureHost,
      resolvedHostRect,
      safeAreaInsets,
      unmountPortal,
      unregisterDismissable,
      updatePortal,
      windowRect,
    ],
  );

  return (
    <PortalProvider>
      <OverlayRuntimeContext.Provider value={context}>
        {children}
        {/* Kept only to measure the window-origin host rect for geometry. */}
        <View
          ref={hostRef}
          accessible={false}
          collapsable={false}
          onLayout={handleHostLayout}
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, styles.host]}
          testID="beeui-overlay-host"
        >
          {entries.map((entry) => (
            <React.Fragment key={entry.id}>{entry.node}</React.Fragment>
          ))}
        </View>
        {/* Teleport destination: overlay content renders here but stays in the
            source fiber tree, so consumer context is preserved. */}
        <PortalHost name={OVERLAY_PORTAL_HOST} style={StyleSheet.absoluteFill} />
      </OverlayRuntimeContext.Provider>
    </PortalProvider>
  );
}

export function OverlayRuntimeProvider({
  children,
  hostRectOverride,
}: OverlayRuntimeProviderProps) {
  const parent = React.useContext(OverlayRuntimeContext);
  if (parent) return <>{children}</>;
  return (
    <OverlayRuntimeProviderRoot hostRectOverride={hostRectOverride}>
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
  // Guard that BeeUIProvider is mounted, same as before.
  useOverlayRuntime();
  // Render inline (under the caller's context) and teleport the native views to
  // the root PortalHost. The fiber tree is preserved, so consumer context flows.
  return <Portal hostName={OVERLAY_PORTAL_HOST}>{children}</Portal>;
}

export function useOverlayId(prefix = 'beeui-overlay') {
  const reactId = React.useId().replace(/:/g, '');
  return `${prefix}-${reactId}`;
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
