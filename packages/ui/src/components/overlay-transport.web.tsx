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
    // On react-native-web a host View ref is the underlying DOM element.
    const setRef = React.useCallback(
      (node: unknown) => {
        nodes.set(name, (node as Element | null) ?? null);
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
        return () => set?.delete(onChange);
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
