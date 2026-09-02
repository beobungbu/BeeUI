import { layer } from '@beemvp/beeui-tokens';
import * as React from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';

export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_MAX_VISIBLE = 3;

export type ToastId = string;
export type ToastVariant = 'neutral' | 'success' | 'warning' | 'destructive' | 'info';
export type ToastDuration = number | 'persistent';

export type ToastAction = {
  label: string;
  onPress: () => void;
  /** Dismisses after the callback by default. Set false for an explicit persistent action. */
  dismissOnPress?: boolean;
};

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: ToastDuration;
  action?: ToastAction;
};

export type ToastApi = {
  show: (options: ToastOptions) => ToastId;
  dismiss: (id: ToastId) => void;
  dismissAll: () => void;
};

type NormalizedToast = {
  id: ToastId;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: ToastDuration;
  action?: ToastAction;
};

type ToastState = {
  visible: NormalizedToast[];
  queued: NormalizedToast[];
};

type ToastStateAction =
  | { type: 'show'; toast: NormalizedToast }
  | { type: 'dismiss'; id: ToastId }
  | { type: 'dismiss-all' };

const EMPTY_TOAST_STATE: ToastState = { visible: [], queued: [] };
const TOAST_VARIANTS: readonly ToastVariant[] = [
  'neutral',
  'success',
  'warning',
  'destructive',
  'info',
];

const surfaceClassByVariant: Record<ToastVariant, string> = {
  neutral: 'border-border-strong',
  success: 'border-success',
  warning: 'border-warning',
  destructive: 'border-destructive',
  info: 'border-info',
};

const titleToneByVariant = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  info: 'info',
} as const;

function normalizeDuration(value: unknown): ToastDuration {
  if (value === 'persistent') return 'persistent';
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return TOAST_DEFAULT_DURATION;
}

function normalizeToastOptions(options: ToastOptions): Omit<NormalizedToast, 'id'> {
  if (!options || typeof options !== 'object' || typeof options.title !== 'string') {
    throw new TypeError('BeeUI toast show() requires a descriptor with a string title.');
  }

  const title = options.title.trim();
  if (!title) {
    throw new TypeError('BeeUI toast show() requires a non-empty string title.');
  }

  const variant = TOAST_VARIANTS.includes(options.variant as ToastVariant)
    ? (options.variant as ToastVariant)
    : 'neutral';
  const description =
    typeof options.description === 'string' && options.description.trim()
      ? options.description
      : undefined;

  let action: ToastAction | undefined;
  if (
    options.action &&
    typeof options.action === 'object' &&
    typeof options.action.label === 'string' &&
    options.action.label.trim() &&
    typeof options.action.onPress === 'function'
  ) {
    action = {
      label: options.action.label,
      onPress: options.action.onPress,
      dismissOnPress: options.action.dismissOnPress,
    };
  }

  return {
    title,
    description,
    variant,
    duration: normalizeDuration(options.duration),
    action,
  };
}

function toastExists(state: ToastState, id: ToastId) {
  return state.visible.some((toast) => toast.id === id) || state.queued.some((toast) => toast.id === id);
}

function dismissToast(state: ToastState, id: ToastId): ToastState {
  const visibleIndex = state.visible.findIndex((toast) => toast.id === id);
  if (visibleIndex >= 0) {
    const visible = state.visible.filter((toast) => toast.id !== id);
    if (state.queued.length === 0) return { visible, queued: state.queued };
    const [next, ...queued] = state.queued;
    return { visible: next ? [...visible, next] : visible, queued };
  }

  const queuedIndex = state.queued.findIndex((toast) => toast.id === id);
  if (queuedIndex < 0) return state;
  return { visible: state.visible, queued: state.queued.filter((toast) => toast.id !== id) };
}

function toastReducer(state: ToastState, action: ToastStateAction): ToastState {
  switch (action.type) {
    case 'show':
      if (toastExists(state, action.toast.id)) return state;
      if (state.visible.length < TOAST_MAX_VISIBLE) {
        return { visible: [...state.visible, action.toast], queued: state.queued };
      }
      return { visible: state.visible, queued: [...state.queued, action.toast] };
    case 'dismiss':
      return dismissToast(state, action.id);
    case 'dismiss-all':
      return state.visible.length === 0 && state.queued.length === 0 ? state : EMPTY_TOAST_STATE;
    default:
      return state;
  }
}

const ToastContext = React.createContext<ToastApi | null>(null);

function ToastCard({ toast, dismiss }: { toast: NormalizedToast; dismiss: (id: ToastId) => void }) {
  const announcement = toast.description ? `${toast.title}, ${toast.description}` : toast.title;

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibilityWithOptions?.(announcement, { queue: true });
  }, [announcement, toast.id]);

  React.useEffect(() => {
    if (toast.duration === 'persistent') return undefined;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration, toast.id]);

  const runAction = React.useCallback(() => {
    if (!toast.action) return;
    try {
      toast.action.onPress();
    } finally {
      if (toast.action.dismissOnPress !== false) dismiss(toast.id);
    }
  }, [dismiss, toast]);

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`w-full max-w-md rounded-lg border bg-surface p-4 ${surfaceClassByVariant[toast.variant]}`}
      testID={`beeui-toast-${toast.id}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text tone={titleToneByVariant[toast.variant]} variant="label">
            {toast.title}
          </Text>
          {toast.description ? (
            <Text tone="muted" variant="caption">
              {toast.description}
            </Text>
          ) : null}
          {toast.action ? (
            <View className="pt-2">
              <Pressable
                accessibilityLabel={toast.action.label}
                accessibilityRole="button"
                className="self-start rounded-md px-2 py-1"
                onPress={runAction}
              >
                <Text tone={titleToneByVariant[toast.variant]} variant="label">
                  {toast.action.label}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={`Dismiss ${toast.title}`}
          accessibilityRole="button"
          className="rounded-md px-2 py-1"
          onPress={() => dismiss(toast.id)}
        >
          <Text tone="muted" variant="label">×</Text>
        </Pressable>
      </View>
    </View>
  );
}

export type ToastRuntimeProviderProps = {
  children?: React.ReactNode;
};

/** Internal application-root runtime. BeeUIProvider owns this provider. */
export function ToastRuntimeProvider({ children }: ToastRuntimeProviderProps) {
  const [state, dispatch] = React.useReducer(toastReducer, EMPTY_TOAST_STATE);
  const runtimeId = React.useId().replace(/:/g, '');
  const nextIdRef = React.useRef(0);
  const insets = useSafeAreaInsets();

  const dismiss = React.useCallback((id: ToastId) => {
    if (typeof id !== 'string' || !id) return;
    dispatch({ type: 'dismiss', id });
  }, []);

  const dismissAll = React.useCallback(() => dispatch({ type: 'dismiss-all' }), []);

  const show = React.useCallback((options: ToastOptions) => {
    const normalized = normalizeToastOptions(options);
    nextIdRef.current += 1;
    const id = `beeui-toast-${runtimeId}-${nextIdRef.current}`;
    dispatch({ type: 'show', toast: { id, ...normalized } });
    return id;
  }, [runtimeId]);

  const api = React.useMemo<ToastApi>(() => ({ show, dismiss, dismissAll }), [dismiss, dismissAll, show]);
  const viewportStyle = React.useMemo<ViewStyle>(
    () => ({ top: insets.top + 12 }),
    [insets.top],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        accessible={false}
        pointerEvents="box-none"
        style={[styles.viewport, viewportStyle]}
        testID="beeui-toast-viewport"
      >
        <View className="w-full items-center gap-2" pointerEvents="box-none">
          {[...state.visible].reverse().map((toast) => (
            <ToastCard dismiss={dismiss} key={toast.id} toast={toast} />
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('BeeUI toast APIs require BeeUIProvider at the application root.');
  }
  return context;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    // Layer/z-order contract: toasts float above base content and anchored
    // overlays. On Android `elevation` also governs sibling draw order, so it is
    // fed the same semantic layer value (native draw-order parity, not shadow).
    zIndex: layer.toast,
    elevation: layer.toast,
  },
});
