import { UIManager } from 'react-native';

const TELEPORT_HOST_VIEW = 'PortalHostView';

let warnedUnavailable = false;

/**
 * The New Architecture (Fabric) exposes its UI manager on the global scope — the
 * standard runtime signal that Fabric is active. BeeUI peers on React Native
 * >= 0.85, where the New Architecture is the norm; the check exists so overlays
 * degrade instead of crashing in the rare or transitional case where it is off.
 */
function isNewArchitectureEnabled(): boolean {
  return (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager != null;
}

/**
 * Whether teleport's native host view is registered in this runtime. False in
 * JS-only environments (jest) and in a native build whose codegen has not
 * registered the component (e.g. a stale build, or JS reloaded onto an app that
 * predates the dependency) — cases where the teleport host would fail to render.
 */
function isTeleportHostRegistered(): boolean {
  try {
    return (
      typeof UIManager.hasViewManagerConfig === 'function' &&
      UIManager.hasViewManagerConfig(TELEPORT_HOST_VIEW)
    );
  } catch {
    return false;
  }
}

/**
 * True when the native teleport host can be used (New Architecture on and the
 * host view registered). When false, the native transport falls back to the
 * defensive legacy host and logs a one-time development warning — overlays keep
 * working (with context loss) instead of crashing on a missing native view.
 */
export function isNativeTeleportAvailable(): boolean {
  if (isNewArchitectureEnabled() && isTeleportHostRegistered()) return true;

  if (__DEV__ && !warnedUnavailable) {
    warnedUnavailable = true;
    const reason = isNewArchitectureEnabled()
      ? 'the native overlay host view is not registered (a stale native build, or JS reloaded onto an app built before react-native-teleport was added — run a clean native rebuild)'
      : 'the React Native New Architecture is disabled';
    console.warn(
      `[BeeUI] Anchored overlay content falls back to the non-context-preserving host because ${reason}. ` +
        'Overlay content will not see consumer React context declared below BeeUIProvider. ' +
        'See docs/anchored-overlays.md.',
    );
  }
  return false;
}
