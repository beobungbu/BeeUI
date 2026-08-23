import { Platform, UIManager } from 'react-native';

export type OverlayHostMode = 'teleport' | 'legacy';

const TELEPORT_HOST_VIEW = 'PortalHostView';

let warnedFallback = false;

/**
 * The New Architecture (Fabric) exposes its UI manager on the global scope. This
 * is the standard runtime signal that Fabric is active.
 */
function isNewArchitectureEnabled(): boolean {
  return (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager != null;
}

/**
 * Whether teleport's native host view is actually registered in this runtime.
 * This is false in JS-only environments (jest/jsdom) and in a native build whose
 * codegen has not registered the component yet — in both cases the teleport host
 * would fail to render (`Unimplemented component: <PortalHostView>`), so we must
 * fall back to the legacy host.
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
 * Selects the anchored-overlay host backend for the current runtime:
 *
 * - `web` → `legacy`. On web react-dom's portal already preserves context, and the
 *   teleport host leaves anchored content stuck in the measuring state (its
 *   `onLayout` does not fire on React Native Web).
 * - native + New Architecture + teleport host registered → `teleport`. Content stays
 *   in the source fiber tree, so consumer React context is preserved.
 * - native without the New Architecture → `legacy`, with a one-time dev warning. A
 *   consumer may ship with `newArchEnabled: false`; overlays keep working (context
 *   lost, matching the documented pre-teleport limitation) instead of crashing.
 * - native, Fabric on, but the host view is not registered (e.g. a stale build
 *   missing codegen, or a JS-only test env) → `legacy`, silently — this is a build
 *   or test artifact rather than a consumer misconfiguration.
 *
 * The result is stable for the lifetime of the runtime, so callers may cache it.
 */
export function resolveOverlayHostMode(): OverlayHostMode {
  if (Platform.OS === 'web') return 'legacy';

  if (!isNewArchitectureEnabled()) {
    if (__DEV__ && !warnedFallback) {
      warnedFallback = true;
      console.warn(
        '[BeeUI] Anchored overlay content falls back to the non-context-preserving ' +
          'host because the React Native New Architecture is disabled. Overlay content ' +
          'will not see consumer React context declared below BeeUIProvider. Enable the ' +
          'New Architecture to preserve it. See docs/anchored-overlays.md.',
      );
    }
    return 'legacy';
  }

  return isTeleportHostRegistered() ? 'teleport' : 'legacy';
}
