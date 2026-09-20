import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View } from 'react-native';
import {
  SafeAreaListener,
  SafeAreaProvider as NativeSafeAreaProvider,
  SafeAreaView as NativeSafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { Uniwind, withUniwind } from 'uniwind';
import { OverlayRuntimeProvider } from './overlay-runtime';
import { ToastRuntimeProvider, type ToastPlacement } from './toast';

const StyledSafeAreaView = withUniwind(NativeSafeAreaView);

export type BeeUIProviderProps = Omit<
  React.ComponentProps<typeof NativeSafeAreaProvider>,
  'children'
> & {
  children?: React.ReactNode;
  /**
   * Keeps Uniwind OSS safe-area utilities (`pt-safe`, `bottom-safe`, etc.) in sync
   * with react-native-safe-area-context. Disable only when the application already
   * owns that bridge elsewhere.
   */
  syncUniwindInsets?: boolean;
  /**
   * Where the transient `useToast()` notification stack docks. Defaults to `'bottom'` on
   * native (so it clears the bottom tab bar / home indicator) and `'top'` on Web.
   */
  toastPlacement?: ToastPlacement;
};

function UniwindSafeAreaBridge({ children }: { children?: React.ReactNode }) {
  return (
    <SafeAreaListener
      onChange={({ insets }) => {
        Uniwind.updateInsets(insets);
      }}
    >
      {children}
    </SafeAreaListener>
  );
}

/**
 * BeeUI application-root integration. It owns safe-area measurement, a provider-local
 * transient-notification runtime, and one shared anchored-overlay runtime/host;
 * individual screens/components still opt into the safe-area edges and overlay behavior they need.
 */
export function BeeUIProvider({
  children,
  initialMetrics = initialWindowMetrics,
  syncUniwindInsets = true,
  toastPlacement,
  ...props
}: BeeUIProviderProps) {
  return (
    <NativeSafeAreaProvider initialMetrics={initialMetrics} {...props}>
      <ToastRuntimeProvider placement={toastPlacement}>
        <OverlayRuntimeProvider>
          {syncUniwindInsets ? <UniwindSafeAreaBridge>{children}</UniwindSafeAreaBridge> : children}
        </OverlayRuntimeProvider>
      </ToastRuntimeProvider>
    </NativeSafeAreaProvider>
  );
}

BeeUIProvider.displayName = 'BeeUIProvider';

export type SafeAreaProps = React.ComponentProps<typeof NativeSafeAreaView> & {
  className?: string;
};

// Matches one Tailwind/Uniwind padding utility token (`p-4`, `pt-6`,
// `py-[10px]`, an optional leading variant chain like `md:pt-6`, etc.).
// Only used to decide whether an inner wrapper is needed to hold the
// caller's own padding — never to guess, strip, or reassign a specific
// safe-area edge.
const PADDING_CLASS_PATTERN = /(?:^|:)(?:p|pt|pr|pb|pl|px|py)-/;

const PADDING_STYLE_KEYS = [
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingStart',
  'paddingEnd',
] as const;

function classNameHasPadding(className: string | undefined): boolean {
  if (!className) return false;
  return className.split(/\s+/).some((token) => PADDING_CLASS_PATTERN.test(token));
}

function styleHasPadding(style: SafeAreaProps['style']): boolean {
  if (!style) return false;
  const styles = Array.isArray(style) ? style : [style];
  return styles.some(
    (entry) =>
      !!entry &&
      typeof entry === 'object' &&
      PADDING_STYLE_KEYS.some((key) => (entry as Record<string, unknown>)[key] !== undefined),
  );
}

/**
 * Explicit safe-area surface: a pass-through to react-native-safe-area-context's own view.
 * `edges` (and the resulting inset) are always fully owned by that library and forwarded
 * unchanged — BeeUI adds no default and no per-edge arithmetic of its own. Use `edges` to
 * assign ownership to the exact shell element that touches a system edge.
 *
 * A caller's own `className`/`style` padding used to fight the library's own inset padding:
 * an inline style always beats a CSS class regardless of source order, so a naive merge silently
 * dropped the caller's padding (#598); stripping the conflicting edge instead silently dropped
 * the device inset on that edge (#617 regression). Both now compose instead of competing: when
 * the caller supplies padding (via `className` or `style`), it renders on an inner wrapper `View`
 * that fills the safe box, while the outer element keeps only the safe-area inset — a caller's
 * `pt-6` then sits *inside* the device's own top inset rather than replacing or fighting it. When
 * the caller supplies no padding, everything still renders on the single node it always has, with
 * no extra wrapper.
 */
export const SafeArea = React.forwardRef<
  React.ComponentRef<typeof NativeSafeAreaView>,
  SafeAreaProps
>(({ className, style, ...props }, ref) => {
  const hasCallerPadding = classNameHasPadding(className) || styleHasPadding(style);

  if (!hasCallerPadding) {
    return <StyledSafeAreaView ref={ref} className={cn(className)} style={style} {...props} />;
  }

  const { children, ...outerProps } = props;

  return (
    <StyledSafeAreaView ref={ref} {...outerProps}>
      <View className={cn('flex-1', className)} style={style}>
        {children}
      </View>
    </StyledSafeAreaView>
  );
});

SafeArea.displayName = 'SafeArea';
