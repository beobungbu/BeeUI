import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
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

// react-native-safe-area-context's own documented default when `edges` is
// omitted — encoded here only so a caller-supplied padding conflict (below)
// can compute the exact resulting edge set; BeeUI adds no default of its own.
const DEFAULT_SAFE_AREA_EDGES = ['top', 'right', 'bottom', 'left'] as const;

type SafeAreaEdge = (typeof DEFAULT_SAFE_AREA_EDGES)[number];

// Matches one Tailwind/Uniwind padding utility token (`p-4`, `pt-6`,
// `py-[10px]`, an optional leading variant chain like `md:pt-6`, etc.) and
// captures its property prefix (`p`, `pt`, `pr`, `pb`, `pl`, `px`, `py`).
const PADDING_TOKEN_PATTERN = /(?:^|:)(p|pt|pr|pb|pl|px|py)-/;

const PADDING_PREFIXES_BY_EDGE: Record<SafeAreaEdge, readonly string[]> = {
  top: ['p', 'pt', 'py'],
  right: ['p', 'pr', 'px'],
  bottom: ['p', 'pb', 'py'],
  left: ['p', 'pl', 'px'],
};

/**
 * Whether `className` already carries a padding utility for `edge`. Only
 * inspects the caller-provided string for known literal prefixes — it never
 * builds or guesses a new class name, so it stays compatible with Uniwind's
 * static-class-discovery requirement.
 */
function classNameSetsPadding(className: string | undefined, edge: SafeAreaEdge): boolean {
  if (!className) return false;
  const prefixes = PADDING_PREFIXES_BY_EDGE[edge];
  return className.split(/\s+/).some((token) => {
    const match = PADDING_TOKEN_PATTERN.exec(token);
    return match !== null && prefixes.includes(match[1]);
  });
}

/**
 * Explicit safe-area surface: a pass-through to react-native-safe-area-context's own view, with
 * no `edges` default and no inset arithmetic added here — whichever edges that library pads by
 * default are what a caller who omits `edges` gets.
 * Use `edges` to assign ownership to the exact shell element that touches a system edge.
 *
 * `className`'s own padding utilities win on conflict (per the documented `cn()` contract): the
 * library's own inset padding is a native inline style, which otherwise always beats a CSS class
 * regardless of source order (#598). BeeUI resolves that by dropping insetting for exactly the
 * edges where the caller's own `className` already sets padding — the library then applies no
 * competing style for that edge and the caller's class wins cleanly; every other edge keeps its
 * normal safe-area inset. Only the documented array form of `edges` (`['top', ...]`) is resolved
 * this way; the newer per-edge object form is forwarded unchanged.
 */
export const SafeArea = React.forwardRef<
  React.ComponentRef<typeof NativeSafeAreaView>,
  SafeAreaProps
>(({ className, edges, ...props }, ref) => {
  const resolvedEdges = Array.isArray(edges)
    ? (edges as readonly SafeAreaEdge[]).filter((edge) => !classNameSetsPadding(className, edge))
    : (edges ?? DEFAULT_SAFE_AREA_EDGES.filter((edge) => !classNameSetsPadding(className, edge)));

  return (
    <StyledSafeAreaView ref={ref} className={cn(className)} edges={resolvedEdges} {...props} />
  );
});

SafeArea.displayName = 'SafeArea';
