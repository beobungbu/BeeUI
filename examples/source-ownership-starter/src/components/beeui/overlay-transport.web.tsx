import * as React from 'react';
import ReactDOM from 'react-dom';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  type OverlayHostOutletProps,
  type OverlayPortalOutletProps,
  type OverlayTransport,
} from './overlay-transport-shared';

export * from './overlay-transport-shared';

/**
 * Web transport backed by `ReactDOM.createPortal`. Content renders inline at its
 * declaration site (so it keeps its source React ancestry and consumer context)
 * while its DOM is portaled into the nearest host element. This is the real
 * context-preserving web path — unlike the legacy store host, which re-parents
 * the React children and drops context.
 */
export function createWebDomTransport(): OverlayTransport {
  const nodes = new Map<string, Element | null>();
  const listeners = new Map<string, Set<() => void>>();
  const emit = (name: string) => listeners.get(name)?.forEach((l) => l());

  const HostOutlet = ({ name, style }: OverlayHostOutletProps) => {
    // Track the element this outlet instance owns so its unmount only clears the
    // node it actually registered — a newer host with the same (dynamic) name
    // must not be wiped by an older instance's late cleanup.
    const owned = React.useRef<Element | null>(null);
    // On react-native-web a host View ref is the underlying DOM element.
    const setRef = React.useCallback(
      (node: unknown) => {
        const element = (node as Element | null) ?? null;
        if (element) {
          owned.current = element;
          nodes.set(name, element);
        } else {
          // Unmount: drop the key entirely (not name -> null) so a closed modal's
          // dynamic host name does not leak forever. Only clear if we still own it.
          if (nodes.get(name) === owned.current) nodes.delete(name);
          owned.current = null;
        }
        emit(name);
      },
      [name],
    );
    return (
      <View
        pointerEvents="box-none"
        ref={setRef as never}
        style={[StyleSheet.absoluteFill, style] as StyleProp<ViewStyle>}
      />
    );
  };

  const PortalOutlet = ({ hostName, children }: OverlayPortalOutletProps) => {
    const subscribe = React.useCallback(
      (onChange: () => void) => {
        let set = listeners.get(hostName);
        if (!set) listeners.set(hostName, (set = new Set()));
        set.add(onChange);
        return () => {
          set.delete(onChange);
          // Drop the listener bucket once its last portal unsubscribes so dead
          // dynamic host names do not accumulate.
          if (set.size === 0) listeners.delete(hostName);
        };
      },
      [hostName],
    );
    const getSnapshot = React.useCallback(() => nodes.get(hostName) ?? null, [hostName]);
    const node = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return node ? ReactDOM.createPortal(children, node) : null;
  };

  const RootBoundary = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  return { mode: 'web-dom', RootBoundary, HostOutlet, PortalOutlet };
}

export function resolveOverlayTransport(): OverlayTransport {
  return createWebDomTransport();
}
