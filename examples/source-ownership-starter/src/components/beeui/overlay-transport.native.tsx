import * as React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, PortalHost, PortalProvider } from 'react-native-teleport';

import { isNativeTeleportAvailable } from './overlay-host-mode';
import {
  createLegacyStoreTransport,
  type OverlayHostOutletProps,
  type OverlayPortalOutletProps,
  type OverlayTransport,
} from './overlay-transport-shared';

export * from './overlay-transport-shared';

/**
 * Native teleport transport. `PortalProvider` wraps the runtime, each scope
 * renders a `PortalHost`, and content teleports into the nearest host while
 * staying in its source fiber tree — so consumer context is preserved. A modal
 * surface can render its own `PortalHost` (its own native window), and nested
 * overlays targeting that scope render inside the modal rather than behind it.
 */
function createTeleportTransport(): OverlayTransport {
  return {
    mode: 'native-teleport',
    RootBoundary: ({ children }: { children?: React.ReactNode }) => (
      <PortalProvider>{children}</PortalProvider>
    ),
    HostOutlet: ({ name, style }: OverlayHostOutletProps) => (
      <PortalHost name={name} style={[StyleSheet.absoluteFill, style]} />
    ),
    PortalOutlet: ({ hostName, children }: OverlayPortalOutletProps) => (
      <Portal hostName={hostName}>{children}</Portal>
    ),
  };
}

export function resolveOverlayTransport(): OverlayTransport {
  return isNativeTeleportAvailable() ? createTeleportTransport() : createLegacyStoreTransport();
}
