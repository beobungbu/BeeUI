import * as React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Overlay transport = the portal layer only. The overlay runtime keeps geometry,
 * dismissal, registration, and measurement; a transport decides *how* overlay
 * content travels from its declaration site to a host destination and whether the
 * source React ancestry (consumer context) survives.
 *
 * - `web-dom` uses `ReactDOM.createPortal`, which preserves context on the web.
 * - `native-teleport` uses `react-native-teleport`, which keeps content in the
 *   source fiber tree on the New Architecture.
 * - `legacy` is the defensive store-and-reparent fallback; it does NOT preserve
 *   consumer context and exists only so overlays still render where the native or
 *   web transport is unavailable (e.g. a JS-only test env or a missing host view).
 */
export type OverlayTransportMode = 'web-dom' | 'native-teleport' | 'legacy';

export type OverlayHostOutletProps = { name: string; style?: StyleProp<ViewStyle> };
export type OverlayPortalOutletProps = { hostName: string; children?: React.ReactNode };

export interface OverlayTransport {
  mode: OverlayTransportMode;
  /** Wraps the provider subtree (e.g. a PortalProvider); passthrough by default. */
  RootBoundary: React.ComponentType<{ children?: React.ReactNode }>;
  /** Renders a named, full-screen host destination. */
  HostOutlet: React.ComponentType<OverlayHostOutletProps>;
  /** Delivers children into the named host. */
  PortalOutlet: React.ComponentType<OverlayPortalOutletProps>;
}

const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/** Root host destination name; modal-class surfaces provide their own scope. */
export const ROOT_OVERLAY_HOST = 'beeui-overlay-root';

/**
 * Nearest overlay host destination. `OverlayPortal` targets this scope, so a
 * modal-class surface can provision a local host in its own native window and
 * have nested anchored overlays land there instead of the root host.
 */
const OverlayHostScopeContext = React.createContext<string>(ROOT_OVERLAY_HOST);

export function OverlayHostScopeProvider({
  hostName,
  children,
}: {
  hostName: string;
  children?: React.ReactNode;
}) {
  return (
    <OverlayHostScopeContext.Provider value={hostName}>{children}</OverlayHostScopeContext.Provider>
  );
}

export function useNearestOverlayHost(): string {
  return React.useContext(OverlayHostScopeContext);
}

// --- Legacy store transport (defensive fallback; re-parents, loses context) ---

type LegacyEntry = { id: string; node: React.ReactNode };
type LegacyStore = {
  subscribe: (hostName: string, listener: () => void) => () => void;
  set: (hostName: string, id: string, node: React.ReactNode) => void;
  remove: (hostName: string, id: string) => void;
  read: (hostName: string) => LegacyEntry[];
};

const EMPTY_ENTRIES: LegacyEntry[] = [];

function createLegacyStore(): LegacyStore {
  const hosts = new Map<string, Map<string, React.ReactNode>>();
  const listeners = new Map<string, Set<() => void>>();
  // Cached snapshots keep `read` referentially stable for useSyncExternalStore;
  // they are rebuilt only when a host's entries actually change.
  const snapshots = new Map<string, LegacyEntry[]>();
  const invalidate = (hostName: string) => {
    const host = hosts.get(hostName);
    snapshots.set(
      hostName,
      host && host.size ? [...host.entries()].map(([id, node]) => ({ id, node })) : EMPTY_ENTRIES,
    );
    listeners.get(hostName)?.forEach((l) => l());
  };
  return {
    subscribe(hostName, listener) {
      let set = listeners.get(hostName);
      if (!set) listeners.set(hostName, (set = new Set()));
      set.add(listener);
      return () => set?.delete(listener);
    },
    set(hostName, id, node) {
      let host = hosts.get(hostName);
      if (!host) hosts.set(hostName, (host = new Map()));
      host.set(id, node);
      invalidate(hostName);
    },
    remove(hostName, id) {
      hosts.get(hostName)?.delete(id);
      invalidate(hostName);
    },
    read(hostName) {
      return snapshots.get(hostName) ?? EMPTY_ENTRIES;
    },
  };
}

const LegacyStoreContext = React.createContext<LegacyStore | null>(null);

/**
 * Builds the defensive store-and-reparent transport. Content is stored and
 * re-rendered under the host, changing React ancestry — consumer context is lost.
 */
export function createLegacyStoreTransport(): OverlayTransport {
  const RootBoundary = ({ children }: { children?: React.ReactNode }) => {
    const store = React.useRef(createLegacyStore()).current;
    return <LegacyStoreContext.Provider value={store}>{children}</LegacyStoreContext.Provider>;
  };

  const HostOutlet = ({ name, style }: OverlayHostOutletProps) => {
    const store = React.useContext(LegacyStoreContext);
    const subscribe = React.useCallback(
      (onChange: () => void) => store?.subscribe(name, onChange) ?? (() => undefined),
      [name, store],
    );
    const getSnapshot = React.useCallback(() => store?.read(name) ?? EMPTY_ENTRIES, [name, store]);
    const entries = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return (
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, style]}>
        {entries.map((entry) => (
          <React.Fragment key={entry.id}>{entry.node}</React.Fragment>
        ))}
      </View>
    );
  };

  let counter = 0;
  const PortalOutlet = ({ hostName, children }: OverlayPortalOutletProps) => {
    const store = React.useContext(LegacyStoreContext);
    const id = React.useRef<string | undefined>(undefined);
    if (!id.current) id.current = `legacy-${(counter += 1)}`;
    const entryId = id.current;
    React.useLayoutEffect(() => {
      store?.set(hostName, entryId, children);
      return () => store?.remove(hostName, entryId);
    }, [children, entryId, hostName, store]);
    return null;
  };

  return { mode: 'legacy', RootBoundary, HostOutlet, PortalOutlet };
}

export const passthroughRootBoundary = Passthrough;
