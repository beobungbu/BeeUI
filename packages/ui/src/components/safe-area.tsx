import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
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

// Once caller padding moves to an inner wrapper, that wrapper becomes the
// direct parent of the caller's children. Container-layout utilities therefore
// need to be mirrored onto it or the wrapper would silently change the layout
// contract (`flex-row gap-4 px-4` would become a row containing one wrapper,
// while the caller's actual children fall back to the wrapper's default column).
// Keep item/sizing/position/background classes on the public outer node; mirror
// only properties whose semantics are specifically about arranging children.
const CHILD_LAYOUT_CLASS_PATTERN =
  /(?:^|:)(?:flex-(?:row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap)|items-(?:start|end|center|baseline|stretch)|justify-(?:normal|start|end|center|between|around|evenly|stretch)|content-(?:normal|center|start|end|between|around|evenly|baseline|stretch)|gap(?:-[xy])?-.+|space-[xy]-.+)/;

const PADDING_STYLE_KEYS = new Set([
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingStart',
  'paddingEnd',
  'paddingBlock',
  'paddingBlockStart',
  'paddingBlockEnd',
  'paddingInline',
  'paddingInlineStart',
  'paddingInlineEnd',
]);

const CHILD_LAYOUT_STYLE_KEYS = new Set([
  'alignContent',
  'alignItems',
  'columnGap',
  'direction',
  'flexDirection',
  'flexWrap',
  'gap',
  'justifyContent',
  'rowGap',
]);

function splitPaddingClassName(className: string | undefined): {
  childLayoutClassName?: string;
  outerClassName?: string;
  paddingClassName?: string;
} {
  if (!className) return {};
  const childLayout: string[] = [];
  const outer: string[] = [];
  const padding: string[] = [];
  className.split(/\s+/).filter(Boolean).forEach((token) => {
    if (PADDING_CLASS_PATTERN.test(token)) {
      padding.push(token);
      return;
    }
    outer.push(token);
    if (CHILD_LAYOUT_CLASS_PATTERN.test(token)) childLayout.push(token);
  });
  return {
    childLayoutClassName: childLayout.length ? childLayout.join(' ') : undefined,
    outerClassName: outer.length ? outer.join(' ') : undefined,
    paddingClassName: padding.length ? padding.join(' ') : undefined,
  };
}

function splitPaddingStyle(style: SafeAreaProps['style']): {
  childLayoutStyle?: ViewStyle;
  outerStyle?: ViewStyle;
  paddingStyle?: ViewStyle;
} {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return {};
  const childLayout: Record<string, unknown> = {};
  const outer: Record<string, unknown> = {};
  const padding: Record<string, unknown> = {};
  Object.entries(flattened).forEach(([key, value]) => {
    if (PADDING_STYLE_KEYS.has(key)) {
      padding[key] = value;
      return;
    }
    outer[key] = value;
    if (CHILD_LAYOUT_STYLE_KEYS.has(key)) childLayout[key] = value;
  });
  return {
    childLayoutStyle: Object.keys(childLayout).length ? (childLayout as ViewStyle) : undefined,
    outerStyle: Object.keys(outer).length ? (outer as ViewStyle) : undefined,
    paddingStyle: Object.keys(padding).length ? (padding as ViewStyle) : undefined,
  };
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
 * the device inset on that edge (#617 regression). Both now compose instead of competing: only
 * caller padding moves to an inner wrapper. Non-padding sizing/background/margin/positioning
 * stays on the public outer SafeArea root, while child-container layout (`flex-row`/wrap,
 * alignment, justification and gap/space) is mirrored onto the inner wrapper because it becomes
 * the caller's children's direct parent (#653). This keeps additive inset + caller padding
 * without changing flex-row/gap/alignment semantics. When caller padding is absent, everything
 * stays on the single node it always had.
 */
export const SafeArea = React.forwardRef<
  React.ComponentRef<typeof NativeSafeAreaView>,
  SafeAreaProps
>(({ className, style, ...props }, ref) => {
  const { childLayoutClassName, outerClassName, paddingClassName } =
    splitPaddingClassName(className);
  const { childLayoutStyle, outerStyle, paddingStyle } = splitPaddingStyle(style);
  const hasCallerPadding = paddingClassName !== undefined || paddingStyle !== undefined;

  if (!hasCallerPadding) {
    return <StyledSafeAreaView ref={ref} className={cn(outerClassName)} style={outerStyle} {...props} />;
  }

  const { children, ...outerProps } = props;
  return (
    <StyledSafeAreaView ref={ref} {...outerProps} className={cn(outerClassName)} style={outerStyle}>
      <View
        className={cn('flex-1', childLayoutClassName, paddingClassName)}
        style={[childLayoutStyle, paddingStyle]}
      >
        {children}
      </View>
    </StyledSafeAreaView>
  );
});

SafeArea.displayName = 'SafeArea';
