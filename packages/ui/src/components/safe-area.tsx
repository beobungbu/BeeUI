import * as React from 'react';
import {
  SafeAreaListener,
  SafeAreaProvider as NativeSafeAreaProvider,
  SafeAreaView as NativeSafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { Uniwind, withUniwind } from 'uniwind';
import { OverlayRuntimeProvider } from './overlay-runtime';

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
 * BeeUI application-root integration. It owns safe-area measurement and one shared
 * anchored-overlay runtime/host; individual screens/components still opt into the
 * safe-area edges and overlay behavior they need.
 */
export function BeeUIProvider({
  children,
  initialMetrics = initialWindowMetrics,
  syncUniwindInsets = true,
  ...props
}: BeeUIProviderProps) {
  return (
    <NativeSafeAreaProvider initialMetrics={initialMetrics} {...props}>
      <OverlayRuntimeProvider>
        {syncUniwindInsets ? <UniwindSafeAreaBridge>{children}</UniwindSafeAreaBridge> : children}
      </OverlayRuntimeProvider>
    </NativeSafeAreaProvider>
  );
}

BeeUIProvider.displayName = 'BeeUIProvider';

export type SafeAreaProps = React.ComponentProps<typeof NativeSafeAreaView> & {
  className?: string;
};

/**
 * Explicit safe-area surface. Defaults to all edges like react-native-safe-area-context.
 * Use `edges` to assign ownership to the exact shell element that touches a system edge.
 */
export const SafeArea = React.forwardRef<
  React.ComponentRef<typeof NativeSafeAreaView>,
  SafeAreaProps
>(({ className, ...props }, ref) => (
  <StyledSafeAreaView ref={ref} className={className} {...props} />
));

SafeArea.displayName = 'SafeArea';
